"""Fail-closed, recording-only order API with client-carried continuity.

The adapter has no live connector and performs no supplier I/O. A canonical,
SHA-256-sealed inline package and state token make the bounded rehearsal usable
across serverless cold starts without turning process memory into authority.
"""

from __future__ import annotations

import base64
import binascii
from copy import deepcopy
import hashlib
import json
from pathlib import Path, PurePosixPath
import threading
from typing import Any, Callable, Mapping

from order_execution import (
    AuditEvent,
    CandidateIdentity,
    ConnectorKind,
    DeliveryOutcome,
    DispatchReceipt,
    DispatchRequest,
    ExecutionMode,
    OrderExecutionError,
    OrderState,
    RetryDisposition,
    SendEffect,
    VerifiedManifest,
    verify_audit_chain,
    verify_record_hash,
    verify_sealed_manifest,
)
from order_execution.canonical import digest_json, parse_json
from order_execution.records import build_audit_event, build_receipt, build_request


SCHEMA_VERSION = "caddydaddy.order-api/1"
PACKAGE_ENVELOPE_SCHEMA = "caddydaddy.order-package-envelope/1"
STATE_TOKEN_SCHEMA = "caddydaddy.order-state-token/1"
MAX_INLINE_FILE_BYTES = 3_000_000
MAX_INLINE_TOTAL_BYTES = 3_500_000
RUNTIME_BOUNDARY = {
    "persistence": "PROCESS_LOCAL_DEMO_ONLY",
    "connector": "RECORDING_ONLY",
    "external_effect": "NONE",
    "external_calls": 0,
}
CLAIM_CEILING = (
    "Client-carried transaction-state rehearsal only. No supplier was contacted, "
    "no order was sent, and no durable server-side order record was created."
)
LIMITATIONS = [
    "The service retains no durable authority; callers must preserve the returned sealed state token across cold starts.",
    "SHA-256 seals prove canonical content integrity, not caller authenticity or global replay freshness.",
    "Only recording-only outcomes exist; EDI, API, email, and supplier transports are absent.",
    "A previously valid token cannot be globally revoked or detected as stale without an external durable compare-and-swap store.",
    "UNKNOWN requires a definitive send-effect disposition and evidence reference before closure.",
]


def _raise(code: str, message: str, **details: Any) -> None:
    raise OrderExecutionError(code, message, **details)


def _object(value: Any, code: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        _raise(code, "value must be an object")
    return deepcopy(dict(value))


def _exact(value: Mapping[str, Any], expected: set[str], code: str) -> None:
    actual = set(value)
    if actual != expected:
        _raise(code, "record fields do not match the contract", missing=sorted(expected - actual), extra=sorted(actual - expected))


def _text_value(value: Any, code: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _raise(code, "value must be non-empty text")
    return value


def _safe_relative(value: Any, code: str) -> str:
    relative = _text_value(value, code)
    pure = PurePosixPath(relative)
    if pure.is_absolute() or relative != pure.as_posix() or any(part in {"", ".", ".."} for part in pure.parts):
        _raise(code, "path must be normalized and relative", path=relative)
    return relative


def _sealed(preimage: Mapping[str, Any], field: str) -> dict[str, Any]:
    return {"algorithm": "SHA-256", field: digest_json(dict(preimage))}


class OrderApiRuntime:
    """Recording-only adapter whose portable tokens are the continuity source."""

    def __init__(self, package_root: Path | None, candidate: Mapping[str, Any]) -> None:
        self.package_root: Path | None = None
        if package_root is not None:
            root = Path(package_root).resolve(strict=True)
            if not root.is_dir():
                _raise("PACKAGE_ROOT_INVALID", "configured package root must be a directory")
            self.package_root = root
        self.candidate = self._parse_candidate(candidate)
        self._tokens_by_receipt: dict[str, dict[str, Any]] = {}
        self._tokens_by_key: dict[str, dict[str, Any]] = {}
        self._latest_receipt_by_request: dict[str, str] = {}
        self._latest_token: dict[str, Any] | None = None
        self._lock = threading.RLock()

    def _envelope(self, status: str, **values: Any) -> dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "status": status,
            "runtime_boundary": deepcopy(RUNTIME_BOUNDARY),
            "claim_ceiling": CLAIM_CEILING,
            "limitations": list(LIMITATIONS),
            "candidate": self.candidate.as_dict(),
            **values,
        }

    @staticmethod
    def _error_status(code: str) -> int:
        if code in {"RECEIPT_NOT_FOUND", "REQUEST_NOT_FOUND"}:
            return 404
        if code.endswith("_INVALID") or code in {
            "API_REQUEST_INVALID", "CANDIDATE_HASH_INVALID", "CANDIDATE_ID_INVALID",
            "CANDIDATE_REVISION_INVALID", "IDEMPOTENCY_KEY_INVALID", "TIMESTAMP_INVALID",
        }:
            return 400
        return 409

    def _guard(self, action: Callable[[], tuple[int, dict[str, Any]]]) -> tuple[int, dict[str, Any]]:
        try:
            return action()
        except OrderExecutionError as exc:
            return self._error_status(exc.code), self._envelope(
                "BLOCKED",
                diagnostic={"code": exc.code, "message": exc.message, "details": deepcopy(exc.details)},
            )
        except (KeyError, TypeError, ValueError, binascii.Error, json.JSONDecodeError) as exc:
            return 400, self._envelope(
                "BLOCKED",
                diagnostic={"code": "API_REQUEST_INVALID", "message": str(exc), "details": {}},
            )

    @staticmethod
    def _parse_candidate(value: Any) -> CandidateIdentity:
        candidate = _object(value, "CANDIDATE_INVALID")
        _exact(candidate, {"candidate_id", "revision", "artifact_sha256"}, "CANDIDATE_INVALID")
        return CandidateIdentity(
            _text_value(candidate["candidate_id"], "CANDIDATE_ID_INVALID"),
            _text_value(candidate["revision"], "CANDIDATE_REVISION_INVALID"),
            _text_value(candidate["artifact_sha256"], "CANDIDATE_HASH_INVALID"),
        )

    def _require_current_candidate(self, request: Any) -> Mapping[str, Any]:
        if not isinstance(request, Mapping):
            _raise("API_REQUEST_INVALID", "request body must be an object")
        supplied = self._parse_candidate(request.get("candidate"))
        if supplied != self.candidate:
            _raise(
                "STALE_CANDIDATE",
                "request candidate does not match the configured immutable candidate",
                expected=self.candidate.as_dict(), actual=supplied.as_dict(),
            )
        return request

    @staticmethod
    def _text(request: Mapping[str, Any], key: str) -> str:
        return _text_value(request.get(key), "API_REQUEST_INVALID")

    def _manifest_path(self, request: Mapping[str, Any]) -> Path:
        if self.package_root is None:
            _raise("PACKAGE_ROOT_UNAVAILABLE", "this runtime requires a sealed inline package envelope")
        relative = _safe_relative(request.get("manifest_relative_path"), "MANIFEST_PATH_INVALID")
        manifest = self.package_root.joinpath(*PurePosixPath(relative).parts)
        if not manifest.exists() or manifest.is_symlink():
            _raise("MANIFEST_INVALID", "manifest must be an existing non-symlink file")
        resolved = manifest.resolve(strict=True)
        if not resolved.is_relative_to(self.package_root):
            _raise("MANIFEST_PATH_ESCAPE", "manifest escapes the configured package root")
        return resolved

    def _package_from_path(self, request: Mapping[str, Any]) -> tuple[VerifiedManifest, dict[str, Any]]:
        if self.package_root is None:
            _raise("PACKAGE_ROOT_UNAVAILABLE", "this runtime requires a sealed inline package envelope")
        path = self._manifest_path(request)
        verify_sealed_manifest(path, self.package_root, self.candidate, max_file_bytes=MAX_INLINE_FILE_BYTES)
        manifest = _object(parse_json(path.read_bytes()), "MANIFEST_INVALID")
        files: list[dict[str, Any]] = []
        for declared in manifest["files"]:
            relative = _safe_relative(declared["path"], "PACKAGE_PATH_INVALID")
            raw = self.package_root.joinpath(*PurePosixPath(relative).parts).read_bytes()
            files.append({
                "path": relative,
                "byte_length": len(raw),
                "sha256": declared["sha256"],
                "content_base64": base64.b64encode(raw).decode("ascii"),
            })
        preimage = {"schema_version": PACKAGE_ENVELOPE_SCHEMA, "manifest": manifest, "files": files}
        return self._verify_package_envelope({**preimage, "seal": _sealed(preimage, "envelope_sha256")})

    def _verify_package_envelope(self, value: Any) -> tuple[VerifiedManifest, dict[str, Any]]:
        envelope = _object(value, "PACKAGE_ENVELOPE_INVALID")
        _exact(envelope, {"schema_version", "manifest", "files", "seal"}, "PACKAGE_ENVELOPE_FIELDS_INVALID")
        if envelope["schema_version"] != PACKAGE_ENVELOPE_SCHEMA:
            _raise("PACKAGE_ENVELOPE_SCHEMA_UNSUPPORTED", "unsupported package envelope schema")
        manifest = _object(envelope["manifest"], "MANIFEST_INVALID")
        _exact(manifest, {"schema_version", "package_id", "package_status", "candidate", "selections", "files", "seal"}, "MANIFEST_FIELDS_INVALID")
        if manifest["schema_version"] != "strafe.sealed-sourcing-package/1" or manifest["package_status"] != "SEALED":
            _raise("MANIFEST_SCHEMA_UNSUPPORTED", "inline sourcing manifest must be a sealed v1 package")
        package_id = _text_value(manifest["package_id"], "PACKAGE_ID_INVALID")
        if self._parse_candidate(manifest["candidate"]) != self.candidate:
            _raise("STALE_CANDIDATE", "inline package belongs to another candidate")
        selections = manifest["selections"]
        if not isinstance(selections, list) or not selections:
            _raise("SELECTIONS_INVALID", "at least one selected offer is required")
        line_ids: set[str] = set()
        for raw_selection in selections:
            selection = _object(raw_selection, "SELECTION_INVALID")
            _exact(selection, {"line_id", "offer_id", "selected", "offer_status", "gate_state"}, "SELECTION_FIELDS_INVALID")
            line_id = _text_value(selection["line_id"], "LINE_ID_INVALID")
            _text_value(selection["offer_id"], "OFFER_ID_INVALID")
            if line_id in line_ids:
                _raise("DUPLICATE_LINE_SELECTION", "a sourcing line may have only one selected offer", line_id=line_id)
            line_ids.add(line_id)
            if selection["selected"] is not True or selection["offer_status"] != "APPROVED" or selection["gate_state"] != "CLEARED":
                _raise("ORDER_GATE_BLOCKED", "inline package includes a selection that is not approved and cleared", line_id=line_id)
        declared_files = manifest["files"]
        inline_files = envelope["files"]
        if not isinstance(declared_files, list) or not declared_files or not isinstance(inline_files, list):
            _raise("PACKAGE_FILES_INVALID", "inline package must contain every declared file")
        by_path: dict[str, dict[str, Any]] = {}
        total = 0
        for raw_file in inline_files:
            item = _object(raw_file, "PACKAGE_FILE_INVALID")
            _exact(item, {"path", "byte_length", "sha256", "content_base64"}, "PACKAGE_FILE_FIELDS_INVALID")
            relative = _safe_relative(item["path"], "PACKAGE_PATH_INVALID")
            if relative in by_path:
                _raise("PACKAGE_FILE_DUPLICATE", "inline file path is duplicated", path=relative)
            raw = base64.b64decode(_text_value(item["content_base64"], "PACKAGE_FILE_INVALID"), validate=True)
            total += len(raw)
            if len(raw) > MAX_INLINE_FILE_BYTES or total > MAX_INLINE_TOTAL_BYTES:
                _raise("PACKAGE_FILE_TOO_LARGE", "inline package exceeds the serverless-safe limit", path=relative)
            if item["byte_length"] != len(raw):
                _raise("PACKAGE_FILE_SIZE_MISMATCH", "inline bytes do not match the declared length", path=relative)
            actual = hashlib.sha256(raw).hexdigest()
            if item["sha256"] != actual:
                _raise("PACKAGE_FILE_HASH_MISMATCH", "inline bytes do not match their SHA-256", path=relative)
            by_path[relative] = item
        declared_paths: set[str] = set()
        for raw_declared in declared_files:
            declared = _object(raw_declared, "PACKAGE_FILE_INVALID")
            _exact(declared, {"path", "byte_length", "sha256"}, "PACKAGE_FILE_FIELDS_INVALID")
            relative = _safe_relative(declared["path"], "PACKAGE_PATH_INVALID")
            if relative in declared_paths:
                _raise("PACKAGE_FILE_DUPLICATE", "manifest file path is duplicated", path=relative)
            declared_paths.add(relative)
            inline = by_path.get(relative)
            if inline is None:
                _raise("PACKAGE_FILE_MISSING", "declared package file is absent from the inline envelope", path=relative)
            if inline["byte_length"] != declared["byte_length"] or inline["sha256"] != declared["sha256"]:
                _raise("PACKAGE_FILE_HASH_MISMATCH", "inline file descriptor differs from the sealed manifest", path=relative)
        if set(by_path) != declared_paths:
            _raise("PACKAGE_FILE_UNDECLARED", "inline envelope contains files absent from the sealed manifest")
        manifest_seal = _object(manifest["seal"], "MANIFEST_SEAL_INVALID")
        _exact(manifest_seal, {"algorithm", "manifest_sha256"}, "MANIFEST_SEAL_FIELDS_INVALID")
        manifest_preimage = {key: child for key, child in manifest.items() if key != "seal"}
        manifest_sha256 = digest_json(manifest_preimage)
        if manifest_seal != {"algorithm": "SHA-256", "manifest_sha256": manifest_sha256}:
            _raise("MANIFEST_SEAL_MISMATCH", "manifest seal does not match canonical content")
        seal = _object(envelope["seal"], "PACKAGE_ENVELOPE_SEAL_INVALID")
        _exact(seal, {"algorithm", "envelope_sha256"}, "PACKAGE_ENVELOPE_SEAL_INVALID")
        preimage = {key: child for key, child in envelope.items() if key != "seal"}
        expected_seal = {"algorithm": "SHA-256", "envelope_sha256": digest_json(preimage)}
        if seal != expected_seal:
            _raise("PACKAGE_ENVELOPE_SEAL_MISMATCH", "package envelope seal does not match canonical content")
        return VerifiedManifest(package_id, self.candidate, manifest_sha256, len(selections), len(declared_files)), envelope

    def _verified_package(self, request: Mapping[str, Any], fallback: Any = None) -> tuple[VerifiedManifest, dict[str, Any]]:
        supplied = request.get("package_envelope", fallback)
        result = self._verify_package_envelope(supplied) if supplied is not None else self._package_from_path(request)
        expected = request.get("manifest_sha256")
        if expected is not None and expected != result[0].manifest_sha256:
            _raise("MANIFEST_HASH_MISMATCH", "dispatch manifest hash differs from verified package bytes", expected=result[0].manifest_sha256, actual=expected)
        return result

    def _parse_request_record(self, value: Any) -> DispatchRequest:
        record = _object(value, "ORDER_REQUEST_INVALID")
        _exact(record, {
            "schema_version", "request_id", "request_sha256", "idempotency_key", "candidate", "package",
            "connector", "execution_mode", "created_at", "actor_id", "retry_of_request_id",
        }, "ORDER_REQUEST_INVALID")
        verify_record_hash(record, "request_sha256", "request_id", "order-request:")
        if record["schema_version"] != "strafe.order-dispatch-request/1":
            _raise("ORDER_REQUEST_INVALID", "unsupported request record schema")
        candidate = self._parse_candidate(record["candidate"])
        if candidate != self.candidate:
            _raise("STALE_CANDIDATE", "state request belongs to another candidate")
        package = _object(record["package"], "ORDER_REQUEST_INVALID")
        connector = _object(record["connector"], "ORDER_REQUEST_INVALID")
        _exact(package, {"package_id", "sealed_manifest_sha256", "selection_count", "file_count"}, "ORDER_REQUEST_INVALID")
        _exact(connector, {"kind", "connector_id", "route_ref"}, "ORDER_REQUEST_INVALID")
        if connector["kind"] != "RECORDING" or connector["connector_id"] != "recording:v1" or record["execution_mode"] != "RECORDING_ONLY":
            _raise("ORDER_BOUNDARY_VIOLATION", "state request exceeds the recording-only connector boundary")
        return DispatchRequest(
            request_id=record["request_id"], request_sha256=record["request_sha256"],
            idempotency_key=record["idempotency_key"], candidate=candidate,
            package_id=package["package_id"], sealed_manifest_sha256=package["sealed_manifest_sha256"],
            selection_count=package["selection_count"], file_count=package["file_count"],
            connector_kind=ConnectorKind.RECORDING, connector_id="recording:v1", route_ref=connector["route_ref"],
            execution_mode=ExecutionMode.RECORDING_ONLY, created_at=record["created_at"], actor_id=record["actor_id"],
            retry_of_request_id=record["retry_of_request_id"],
        )

    @staticmethod
    def _parse_receipt_record(value: Any) -> DispatchReceipt:
        record = _object(value, "ORDER_RECEIPT_INVALID")
        _exact(record, {
            "schema_version", "receipt_id", "receipt_sha256", "request_id", "request_sha256", "idempotency_key",
            "state", "delivery_outcome", "send_effect", "retry_disposition", "execution_mode", "external_effect",
            "connector_reference", "detail_code", "created_at", "supersedes_receipt_id",
        }, "ORDER_RECEIPT_INVALID")
        verify_record_hash(record, "receipt_sha256", "receipt_id", "order-receipt:")
        if record["schema_version"] != "strafe.order-dispatch-receipt/1" or record["execution_mode"] != "RECORDING_ONLY" or record["external_effect"] != "NONE":
            _raise("ORDER_BOUNDARY_VIOLATION", "receipt exceeds the recording-only, zero-effect boundary")
        return DispatchReceipt(
            receipt_id=record["receipt_id"], receipt_sha256=record["receipt_sha256"], request_id=record["request_id"],
            request_sha256=record["request_sha256"], idempotency_key=record["idempotency_key"],
            state=OrderState(record["state"]), delivery_outcome=DeliveryOutcome(record["delivery_outcome"]),
            send_effect=SendEffect(record["send_effect"]), retry_disposition=RetryDisposition(record["retry_disposition"]),
            execution_mode=ExecutionMode.RECORDING_ONLY, external_effect="NONE",
            connector_reference=record["connector_reference"], detail_code=record["detail_code"],
            created_at=record["created_at"], supersedes_receipt_id=record["supersedes_receipt_id"],
        )

    @staticmethod
    def _dispatch_input(request: Mapping[str, Any]) -> dict[str, Any]:
        retry = request.get("retry_of_request_id")
        if retry is not None and (not isinstance(retry, str) or not retry):
            _raise("API_REQUEST_INVALID", "retry_of_request_id must be null or non-empty text")
        return {
            "recording_outcome": _text_value(request.get("recording_outcome"), "RECORDING_OUTCOME_INVALID"),
            "idempotency_key": _text_value(request.get("idempotency_key"), "IDEMPOTENCY_KEY_INVALID"),
            "route_ref": _text_value(request.get("route_ref"), "API_REQUEST_INVALID"),
            "actor_id": _text_value(request.get("actor_id"), "API_REQUEST_INVALID"),
            "occurred_at": _text_value(request.get("occurred_at"), "TIMESTAMP_INVALID"),
            "retry_of_request_id": retry,
        }

    def _make_token(
        self, *, package_envelope: dict[str, Any], dispatch_input: dict[str, Any], request: DispatchRequest,
        receipts: list[DispatchReceipt], events: list[AuditEvent], state_sequence: int,
        parent_state_sha256: str | None,
    ) -> dict[str, Any]:
        preimage = {
            "schema_version": STATE_TOKEN_SCHEMA,
            "candidate": self.candidate.as_dict(),
            "package_envelope": deepcopy(package_envelope),
            "dispatch_input": deepcopy(dispatch_input),
            "dispatch_fingerprint_sha256": digest_json(dispatch_input),
            "request": request.as_dict(),
            "receipts": [receipt.as_dict() for receipt in receipts],
            "latest_receipt_id": receipts[-1].receipt_id,
            "audit_events": [event.as_dict() for event in events],
            "state_sequence": state_sequence,
            "parent_state_sha256": parent_state_sha256,
        }
        return {**preimage, "seal": _sealed(preimage, "state_sha256")}

    def _verify_state_token(self, value: Any) -> dict[str, Any]:
        token = _object(value, "STATE_TOKEN_INVALID")
        _exact(token, {
            "schema_version", "candidate", "package_envelope", "dispatch_input", "dispatch_fingerprint_sha256",
            "request", "receipts", "latest_receipt_id", "audit_events", "state_sequence", "parent_state_sha256", "seal",
        }, "STATE_TOKEN_FIELDS_INVALID")
        if token["schema_version"] != STATE_TOKEN_SCHEMA or self._parse_candidate(token["candidate"]) != self.candidate:
            _raise("STATE_TOKEN_INVALID", "state token schema or candidate is unsupported")
        seal = _object(token["seal"], "STATE_TOKEN_SEAL_INVALID")
        preimage = {key: child for key, child in token.items() if key != "seal"}
        expected_seal = {"algorithm": "SHA-256", "state_sha256": digest_json(preimage)}
        if seal != expected_seal:
            _raise("STATE_TOKEN_TAMPERED", "state token seal does not match canonical content")
        verified, package_envelope = self._verify_package_envelope(token["package_envelope"])
        dispatch_input = _object(token["dispatch_input"], "STATE_TOKEN_INVALID")
        _exact(dispatch_input, {"recording_outcome", "idempotency_key", "route_ref", "actor_id", "occurred_at", "retry_of_request_id"}, "STATE_TOKEN_INVALID")
        if token["dispatch_fingerprint_sha256"] != digest_json(dispatch_input):
            _raise("STATE_TOKEN_TAMPERED", "dispatch fingerprint does not match the sealed input")
        request = self._parse_request_record(token["request"])
        if (
            request.idempotency_key != dispatch_input["idempotency_key"]
            or request.route_ref != dispatch_input["route_ref"]
            or request.actor_id != dispatch_input["actor_id"]
            or request.created_at != dispatch_input["occurred_at"]
            or request.retry_of_request_id != dispatch_input["retry_of_request_id"]
        ):
            _raise("STATE_TOKEN_TAMPERED", "request record differs from its dispatch binding")
        if (
            request.package_id != verified.package_id
            or request.sealed_manifest_sha256 != verified.manifest_sha256
            or request.selection_count != verified.selection_count
            or request.file_count != verified.file_count
        ):
            _raise("STATE_TOKEN_TAMPERED", "request record differs from its sealed package")
        receipts_raw = token["receipts"]
        if not isinstance(receipts_raw, list) or not receipts_raw:
            _raise("STATE_TOKEN_INVALID", "state token must include receipt history")
        receipts = [self._parse_receipt_record(item) for item in receipts_raw]
        previous: str | None = None
        for receipt in receipts:
            if receipt.request_id != request.request_id or receipt.request_sha256 != request.request_sha256 or receipt.idempotency_key != request.idempotency_key:
                _raise("STATE_TOKEN_TAMPERED", "receipt is not bound to the sealed dispatch request")
            if receipt.supersedes_receipt_id != previous:
                _raise("STATE_TOKEN_STALE", "receipt history is not a contiguous latest-state chain")
            previous = receipt.receipt_id
        if token["latest_receipt_id"] != receipts[-1].receipt_id:
            _raise("STATE_TOKEN_STALE", "latest receipt pointer does not match receipt history")
        events_raw = token["audit_events"]
        if not isinstance(events_raw, list) or not events_raw:
            _raise("AUDIT_EVENTS_INVALID", "state token must include its audit chain")
        events = list(verify_audit_chain(events_raw))
        receipt_ids = {receipt.receipt_id for receipt in receipts}
        for event in events:
            event_value = event.as_dict()
            if event_value["request_id"] != request.request_id or (event_value["receipt_id"] is not None and event_value["receipt_id"] not in receipt_ids):
                _raise("STATE_TOKEN_TAMPERED", "audit event is not bound to this dispatch history")
        if events[-1].as_dict()["receipt_id"] != receipts[-1].receipt_id:
            _raise("STATE_TOKEN_STALE", "audit head does not describe the latest receipt")
        if not isinstance(token["state_sequence"], int) or isinstance(token["state_sequence"], bool) or token["state_sequence"] < 0:
            _raise("STATE_TOKEN_INVALID", "state sequence must be a non-negative integer")
        parent = token["parent_state_sha256"]
        if parent is not None and (not isinstance(parent, str) or len(parent) != 64):
            _raise("STATE_TOKEN_INVALID", "parent state hash must be null or SHA-256")
        return {
            "token": token, "package_envelope": package_envelope, "verified": verified,
            "dispatch_input": dispatch_input, "request": request, "receipts": receipts, "events": events,
        }

    def _cache(self, token: dict[str, Any]) -> None:
        state = self._verify_state_token(token)
        latest = state["receipts"][-1]
        self._tokens_by_receipt[latest.receipt_id] = deepcopy(token)
        self._tokens_by_key[state["request"].idempotency_key] = deepcopy(token)
        self._latest_receipt_by_request[state["request"].request_id] = latest.receipt_id
        self._latest_token = deepcopy(token)

    def _load_state(self, request: Mapping[str, Any], *, require_receipt: bool = True) -> dict[str, Any]:
        token = request.get("state_token")
        receipt_id = request.get("receipt_id")
        if token is None and isinstance(receipt_id, str):
            token = self._tokens_by_receipt.get(receipt_id)
        if token is None:
            _raise("STATE_TOKEN_REQUIRED", "a sealed state token is required after a serverless cold start")
        state = self._verify_state_token(token)
        latest = state["receipts"][-1]
        locally_latest = self._latest_receipt_by_request.get(state["request"].request_id)
        if locally_latest is not None and locally_latest != latest.receipt_id:
            _raise("STALE_RECEIPT", "state token has been superseded in this runtime", latest_receipt_id=locally_latest)
        if require_receipt and receipt_id != latest.receipt_id:
            _raise("STALE_RECEIPT", "transition must target the token's latest receipt", latest_receipt_id=latest.receipt_id)
        return state

    @staticmethod
    def _append_event(
        events: list[AuditEvent], *, event_type: str, state: OrderState, request: DispatchRequest,
        receipt: DispatchReceipt | None, actor_id: str, occurred_at: str, payload: dict[str, Any],
    ) -> None:
        events.append(build_audit_event(
            sequence=len(events), previous_event_sha256=events[-1].event_sha256 if events else None,
            event_type=event_type, state=state, request_id=request.request_id,
            receipt_id=receipt.receipt_id if receipt else None, actor_id=actor_id,
            occurred_at=occurred_at, payload=payload,
        ))

    def _response_state(self, status: str, token: dict[str, Any], state: dict[str, Any] | None = None, **values: Any) -> tuple[int, dict[str, Any]]:
        checked = state or self._verify_state_token(token)
        return 200, self._envelope(
            status,
            state_token=deepcopy(token),
            state_token_sha256=token["seal"]["state_sha256"],
            receipt=checked["receipts"][-1].as_dict(),
            audit_events=[event.as_dict() for event in checked["events"]],
            **values,
        )

    def validate_package(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            checked = self._require_current_candidate(request)
            verified, package_envelope = self._verified_package(checked)
            return 200, self._envelope(
                "VALIDATED_RECORDING_ONLY",
                package={
                    "package_id": verified.package_id,
                    "manifest_sha256": verified.manifest_sha256,
                    "selection_count": verified.selection_count,
                    "file_count": verified.file_count,
                    "byte_reread_verified": True,
                },
                package_envelope=package_envelope,
            )
        return self._guard(action)

    def dispatch_recording(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                checked = self._require_current_candidate(request)
                dispatch_input = self._dispatch_input(checked)
                try:
                    outcome = DeliveryOutcome(dispatch_input["recording_outcome"])
                except ValueError:
                    _raise("RECORDING_OUTCOME_INVALID", "recording outcome is not supported")
                prior_token = checked.get("state_token") or self._tokens_by_key.get(dispatch_input["idempotency_key"])
                if prior_token is not None:
                    prior = self._verify_state_token(prior_token)
                    if prior["request"].idempotency_key != dispatch_input["idempotency_key"] or prior["dispatch_input"] != dispatch_input:
                        _raise("IDEMPOTENCY_CONFLICT", "idempotency key is bound to another sealed dispatch input")
                    token = prior["token"]
                    self._cache(token)
                    return self._response_state("REPLAYED_RECORDING_ONLY", token, prior, replayed=True, request=prior["request"].as_dict())
                verified, package_envelope = self._verified_package(checked)
                request_record = build_request(
                    idempotency_key=dispatch_input["idempotency_key"], candidate=self.candidate,
                    package_id=verified.package_id, sealed_manifest_sha256=verified.manifest_sha256,
                    selection_count=verified.selection_count, file_count=verified.file_count,
                    connector_kind=ConnectorKind.RECORDING, connector_id="recording:v1",
                    route_ref=dispatch_input["route_ref"], execution_mode=ExecutionMode.RECORDING_ONLY,
                    created_at=dispatch_input["occurred_at"], actor_id=dispatch_input["actor_id"],
                    retry_of_request_id=dispatch_input["retry_of_request_id"],
                )
                events: list[AuditEvent] = []
                receipts: list[DispatchReceipt] = []
                self._append_event(
                    events, event_type="ORDER_DRAFTED", state=OrderState.DRAFT, request=request_record,
                    receipt=None, actor_id=dispatch_input["actor_id"], occurred_at=dispatch_input["occurred_at"],
                    payload={"sealed_manifest_sha256": verified.manifest_sha256, "candidate": self.candidate.as_dict()},
                )
                self._append_event(
                    events, event_type="ORDER_DISPATCH_PENDING", state=OrderState.DISPATCH_PENDING, request=request_record,
                    receipt=None, actor_id=dispatch_input["actor_id"], occurred_at=dispatch_input["occurred_at"],
                    payload={"connector_id": "recording:v1", "execution_mode": "RECORDING_ONLY"},
                )
                state, effect, retry = {
                    DeliveryOutcome.DISPATCHED: (OrderState.DISPATCHED, SendEffect.SENT, RetryDisposition.NOT_RETRYABLE),
                    DeliveryOutcome.ACKNOWLEDGED: (OrderState.ACKNOWLEDGED, SendEffect.SENT, RetryDisposition.NOT_RETRYABLE),
                    DeliveryOutcome.EXCEPTION: (OrderState.EXCEPTION, SendEffect.NOT_SENT, RetryDisposition.SAFE_WITH_NEW_KEY),
                    DeliveryOutcome.UNKNOWN: (OrderState.UNKNOWN, SendEffect.POSSIBLY_SENT, RetryDisposition.RECONCILE_REQUIRED),
                }[outcome]
                detail = {
                    DeliveryOutcome.DISPATCHED: "RECORDED_DISPATCH_SIMULATION",
                    DeliveryOutcome.ACKNOWLEDGED: "RECORDED_ACKNOWLEDGEMENT_SIMULATION",
                    DeliveryOutcome.EXCEPTION: "RECORDED_NOT_SENT_EXCEPTION",
                    DeliveryOutcome.UNKNOWN: "RECORDED_UNKNOWN_SEND_SIMULATION",
                }[outcome]
                supersedes = None
                if outcome == DeliveryOutcome.ACKNOWLEDGED:
                    dispatched = build_receipt(
                        request_record, state=OrderState.DISPATCHED, delivery_outcome=DeliveryOutcome.DISPATCHED,
                        send_effect=SendEffect.SENT, retry_disposition=RetryDisposition.NOT_RETRYABLE,
                        external_effect="NONE", connector_reference=f"recording:{dispatch_input['idempotency_key']}",
                        detail_code="CONNECTOR_ACCEPTED_DISPATCH", created_at=dispatch_input["occurred_at"],
                    )
                    receipts.append(dispatched)
                    self._append_event(
                        events, event_type="ORDER_DISPATCHED", state=OrderState.DISPATCHED, request=request_record,
                        receipt=dispatched, actor_id=dispatch_input["actor_id"], occurred_at=dispatch_input["occurred_at"],
                        payload={"delivery_outcome": "DISPATCHED", "external_effect": "NONE"},
                    )
                    supersedes = dispatched.receipt_id
                receipt = build_receipt(
                    request_record, state=state, delivery_outcome=outcome, send_effect=effect, retry_disposition=retry,
                    external_effect="NONE", connector_reference=f"recording:{dispatch_input['idempotency_key']}",
                    detail_code=detail, created_at=dispatch_input["occurred_at"], supersedes_receipt_id=supersedes,
                )
                receipts.append(receipt)
                self._append_event(
                    events, event_type=f"ORDER_{state.value}", state=state, request=request_record,
                    receipt=receipt, actor_id=dispatch_input["actor_id"], occurred_at=dispatch_input["occurred_at"],
                    payload={
                        "delivery_outcome": outcome.value, "send_effect": effect.value,
                        "retry_disposition": retry.value, "external_effect": "NONE", "detail_code": detail,
                    },
                )
                token = self._make_token(
                    package_envelope=package_envelope, dispatch_input=dispatch_input, request=request_record,
                    receipts=receipts, events=events, state_sequence=0, parent_state_sha256=None,
                )
                self._cache(token)
                return self._response_state("DISPATCH_RECORDED_ONLY", token, replayed=False, request=request_record.as_dict())
        return self._guard(action)

    def read_receipt(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                checked = self._require_current_candidate(request)
                state = self._load_state(checked)
                return self._response_state(
                    "RECEIPT_READ_CLIENT_CARRIED", state["token"], state,
                    is_latest=True, latest_receipt_id=state["receipts"][-1].receipt_id,
                    request=state["request"].as_dict(),
                )
        return self._guard(action)

    def _transition(self, request: Mapping[str, Any], *, kind: str) -> tuple[int, dict[str, Any]]:
        state = self._load_state(request)
        prior: DispatchReceipt = state["receipts"][-1]
        request_record: DispatchRequest = state["request"]
        actor_id = self._text(request, "actor_id")
        occurred_at = self._text(request, "occurred_at")
        if kind == "acknowledge":
            if prior.state != OrderState.DISPATCHED:
                _raise("STATE_TRANSITION_INVALID", "only a dispatched recording can be acknowledged", state=prior.state.value)
            reference = self._text(request, "acknowledgement_ref")
            receipt = build_receipt(
                request_record, state=OrderState.ACKNOWLEDGED, delivery_outcome=DeliveryOutcome.ACKNOWLEDGED,
                send_effect=SendEffect.SENT, retry_disposition=RetryDisposition.NOT_RETRYABLE,
                external_effect="NONE", connector_reference=reference, detail_code="ACKNOWLEDGEMENT_RECORDED",
                created_at=occurred_at, supersedes_receipt_id=prior.receipt_id,
            )
            event_type = "ORDER_ACKNOWLEDGED"
            payload = {"acknowledgement_ref": reference}
            status = "ACKNOWLEDGEMENT_RECORDED_ONLY"
        else:
            if prior.state not in {OrderState.ACKNOWLEDGED, OrderState.EXCEPTION, OrderState.UNKNOWN}:
                _raise("STATE_TRANSITION_INVALID", "receipt cannot transition to closed", state=prior.state.value)
            resolution = request.get("resolution_ref")
            if kind == "reconcile":
                if prior.state != OrderState.UNKNOWN:
                    _raise("STATE_TRANSITION_INVALID", "only UNKNOWN can use reconciliation", state=prior.state.value)
                resolution = self._text(request, "resolution_ref")
                try:
                    effect = SendEffect(self._text(request, "reconciled_send_effect"))
                except ValueError:
                    _raise("UNKNOWN_RECONCILIATION_REQUIRED", "reconciled send effect must be NOT_SENT or SENT")
                if effect not in {SendEffect.NOT_SENT, SendEffect.SENT}:
                    _raise("UNKNOWN_RECONCILIATION_REQUIRED", "reconciled send effect must be NOT_SENT or SENT")
            elif prior.state == OrderState.UNKNOWN:
                _raise("UNKNOWN_RECONCILIATION_REQUIRED", "UNKNOWN receipts require evidence-backed reconciliation before closure")
            else:
                effect = prior.send_effect
            retry = RetryDisposition.SAFE_WITH_NEW_KEY if effect == SendEffect.NOT_SENT else RetryDisposition.NOT_RETRYABLE
            receipt = build_receipt(
                request_record, state=OrderState.CLOSED, delivery_outcome=prior.delivery_outcome,
                send_effect=effect, retry_disposition=retry, external_effect="NONE",
                connector_reference=resolution or prior.connector_reference, detail_code="ORDER_CLOSED",
                created_at=occurred_at, supersedes_receipt_id=prior.receipt_id,
            )
            event_type = "ORDER_CLOSED"
            payload = {"resolution_ref": resolution, "send_effect": effect.value, "retry_disposition": retry.value}
            status = "UNKNOWN_RECONCILED_CLIENT_CARRIED" if kind == "reconcile" else "CLOSED_CLIENT_CARRIED"
        receipts = [*state["receipts"], receipt]
        events = list(state["events"])
        self._append_event(
            events, event_type=event_type, state=receipt.state, request=request_record, receipt=receipt,
            actor_id=actor_id, occurred_at=occurred_at, payload=payload,
        )
        token = self._make_token(
            package_envelope=state["package_envelope"], dispatch_input=state["dispatch_input"], request=request_record,
            receipts=receipts, events=events, state_sequence=state["token"]["state_sequence"] + 1,
            parent_state_sha256=state["token"]["seal"]["state_sha256"],
        )
        self._cache(token)
        return self._response_state(status, token)

    def acknowledge(self, request: Any) -> tuple[int, dict[str, Any]]:
        return self._guard(lambda: self._transition(self._require_current_candidate(request), kind="acknowledge"))

    def close(self, request: Any) -> tuple[int, dict[str, Any]]:
        return self._guard(lambda: self._transition(self._require_current_candidate(request), kind="close"))

    def reconcile_unknown(self, request: Any) -> tuple[int, dict[str, Any]]:
        return self._guard(lambda: self._transition(self._require_current_candidate(request), kind="reconcile"))

    def verify_audit(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                checked = self._require_current_candidate(request)
                token = checked.get("state_token") or self._latest_token
                state = self._verify_state_token(token) if token is not None else None
                supplied = checked.get("events")
                if supplied is None:
                    if state is None:
                        _raise("STATE_TOKEN_REQUIRED", "audit verification requires events or a sealed state token")
                    events = state["events"]
                else:
                    if not isinstance(supplied, (list, tuple)):
                        _raise("AUDIT_EVENTS_INVALID", "events must be an array")
                    events = list(verify_audit_chain(supplied))
                    if state is not None and [event.as_dict() for event in events] != [event.as_dict() for event in state["events"]]:
                        _raise("AUDIT_STATE_MISMATCH", "supplied audit events differ from the sealed state token")
                head = events[-1].event_sha256 if events else None
                values: dict[str, Any] = {
                    "event_count": len(events), "audit_head_sha256": head,
                    "events": [event.as_dict() for event in events],
                }
                if state is not None:
                    values.update(state_token=state["token"], state_token_sha256=state["token"]["seal"]["state_sha256"])
                return 200, self._envelope("AUDIT_CHAIN_VERIFIED_CLIENT_CARRIED", **values)
        return self._guard(action)


def create_fastapi_router(runtime: OrderApiRuntime) -> Any | None:
    """Create the recording-only order router when FastAPI is installed."""
    try:
        from fastapi import APIRouter
        from fastapi.responses import JSONResponse
    except ImportError:
        return None
    router = APIRouter(prefix="/api/orders", tags=["orders-recording-only"])

    def bind(path: str, action: Callable[[Any], tuple[int, dict[str, Any]]]) -> None:
        async def endpoint(request: dict[str, Any]) -> JSONResponse:
            status, body = action(request)
            return JSONResponse(status_code=status, content=body)
        router.add_api_route(path, endpoint, methods=["POST"])

    bind("/packages/validate", runtime.validate_package)
    bind("/dispatches", runtime.dispatch_recording)
    bind("/receipts/read", runtime.read_receipt)
    bind("/receipts/acknowledge", runtime.acknowledge)
    bind("/receipts/reconcile", runtime.reconcile_unknown)
    bind("/receipts/close", runtime.close)
    bind("/audit/verify", runtime.verify_audit)
    return router
