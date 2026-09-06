"""Fail-closed, recording-only HTTP adapter for order execution.

This module deliberately exposes no live connector. All state is process-local,
all dispatch outcomes are simulations, and every response repeats that boundary.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path, PurePosixPath
import threading
from typing import Any, Callable, Mapping

from order_execution import (
    CandidateIdentity,
    DeliveryOutcome,
    DispatchReceipt,
    DispatchResult,
    OrderDispatcher,
    OrderExecutionError,
    OrderState,
    RecordingConnector,
    SendEffect,
    verify_audit_chain,
    verify_record_hash,
    verify_sealed_manifest,
)


SCHEMA_VERSION = "caddydaddy.order-api/1"
RUNTIME_BOUNDARY = {
    "persistence": "PROCESS_LOCAL_DEMO_ONLY",
    "connector": "RECORDING_ONLY",
    "external_effect": "NONE",
    "external_calls": 0,
}
CLAIM_CEILING = (
    "Local transaction-state rehearsal only. No supplier was contacted, no order "
    "was sent, and no durable order record was created."
)
LIMITATIONS = [
    "All requests, receipts, idempotency bindings, and audit events are lost when this process exits.",
    "Only RecordingConnector is available; EDI, API, and email-like transports cannot be selected.",
    "DISPATCHED, ACKNOWLEDGED, EXCEPTION, and UNKNOWN are simulated recording outcomes, not supplier facts.",
    "UNKNOWN must be reconciled with an evidence reference before closure or safe retry.",
]


def _raise(code: str, message: str, **details: Any) -> None:
    raise OrderExecutionError(code, message, **details)


class OrderApiRuntime:
    """Process-local adapter around the immutable order-execution records."""

    def __init__(self, package_root: Path, candidate: Mapping[str, Any]) -> None:
        self.package_root = Path(package_root).resolve(strict=True)
        if not self.package_root.is_dir():
            _raise("PACKAGE_ROOT_INVALID", "configured package root must be a directory")
        self.candidate = self._parse_candidate(candidate)
        self.dispatcher = OrderDispatcher()
        self._requests: dict[str, Any] = {}
        self._receipts: dict[str, DispatchReceipt] = {}
        self._latest_receipt_by_request: dict[str, str] = {}
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

    def _error_status(self, code: str) -> int:
        if code in {"RECEIPT_NOT_FOUND", "REQUEST_NOT_FOUND"}:
            return 404
        if code.endswith("_INVALID") or code in {
            "API_REQUEST_INVALID",
            "CANDIDATE_HASH_INVALID",
            "CANDIDATE_ID_INVALID",
            "CANDIDATE_REVISION_INVALID",
            "IDEMPOTENCY_KEY_INVALID",
            "TIMESTAMP_INVALID",
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
        except (KeyError, TypeError, ValueError) as exc:
            return 400, self._envelope(
                "BLOCKED",
                diagnostic={"code": "API_REQUEST_INVALID", "message": str(exc), "details": {}},
            )

    @staticmethod
    def _parse_candidate(value: Mapping[str, Any]) -> CandidateIdentity:
        if not isinstance(value, Mapping) or set(value) != {
            "candidate_id",
            "revision",
            "artifact_sha256",
        }:
            _raise("CANDIDATE_INVALID", "candidate must contain exactly candidate_id, revision, and artifact_sha256")
        if not all(isinstance(value[key], str) for key in value):
            _raise("CANDIDATE_INVALID", "candidate fields must be strings")
        return CandidateIdentity(
            candidate_id=value["candidate_id"],
            revision=value["revision"],
            artifact_sha256=value["artifact_sha256"],
        )

    def _require_current_candidate(self, request: Any) -> CandidateIdentity:
        if not isinstance(request, Mapping):
            _raise("API_REQUEST_INVALID", "request body must be an object")
        supplied = self._parse_candidate(request.get("candidate"))
        if supplied != self.candidate:
            _raise(
                "STALE_CANDIDATE",
                "request candidate does not match the configured immutable candidate",
                expected=self.candidate.as_dict(),
                actual=supplied.as_dict(),
            )
        return supplied

    def _text(self, request: Mapping[str, Any], key: str) -> str:
        value = request.get(key)
        if not isinstance(value, str) or not value.strip():
            _raise("API_REQUEST_INVALID", f"{key} must be non-empty text", field=key)
        return value

    def _manifest_path(self, request: Mapping[str, Any]) -> Path:
        relative = self._text(request, "manifest_relative_path")
        pure = PurePosixPath(relative)
        if pure.is_absolute() or relative != pure.as_posix() or any(part in {"", ".", ".."} for part in pure.parts):
            _raise("MANIFEST_PATH_INVALID", "manifest path must be normalized and relative")
        manifest = self.package_root.joinpath(*pure.parts)
        if not manifest.exists() or manifest.is_symlink():
            _raise("MANIFEST_INVALID", "manifest must be an existing non-symlink file")
        resolved = manifest.resolve(strict=True)
        if not resolved.is_relative_to(self.package_root):
            _raise("MANIFEST_PATH_ESCAPE", "manifest escapes the configured package root")
        return resolved

    def _verified_manifest(self, request: Mapping[str, Any]):
        candidate = self._require_current_candidate(request)
        return verify_sealed_manifest(self._manifest_path(request), self.package_root, candidate)

    def _capture_dispatch(self, result: DispatchResult) -> None:
        self._requests[result.request.request_id] = result.request
        self._receipts[result.receipt.receipt_id] = result.receipt
        self._latest_receipt_by_request[result.request.request_id] = result.receipt.receipt_id

    def _capture_transition(self, receipt: DispatchReceipt) -> None:
        self._receipts[receipt.receipt_id] = receipt
        self._latest_receipt_by_request[receipt.request_id] = receipt.receipt_id

    def _current_receipt(self, request: Mapping[str, Any]) -> DispatchReceipt:
        receipt_id = self._text(request, "receipt_id")
        receipt = self._receipts.get(receipt_id)
        if receipt is None:
            _raise("RECEIPT_NOT_FOUND", "receipt is not present in this process-local runtime")
        latest_id = self._latest_receipt_by_request.get(receipt.request_id)
        if latest_id != receipt_id:
            _raise("STALE_RECEIPT", "state transition must target the latest receipt", latest_receipt_id=latest_id)
        verify_record_hash(receipt.as_dict(), "receipt_sha256", "receipt_id", "order-receipt:")
        return receipt

    def _events_for(self, request_id: str) -> list[dict[str, Any]]:
        return [
            event.as_dict()
            for event in self.dispatcher.audit_events
            if event.as_dict()["request_id"] == request_id
        ]

    def validate_package(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            verified = self._verified_manifest(request)
            return 200, self._envelope(
                "VALIDATED_RECORDING_ONLY",
                package={
                    "package_id": verified.package_id,
                    "manifest_sha256": verified.manifest_sha256,
                    "selection_count": verified.selection_count,
                    "file_count": verified.file_count,
                    "byte_reread_verified": True,
                },
            )

        return self._guard(action)

    def dispatch_recording(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                verified = self._verified_manifest(request)
                expected_hash = self._text(request, "manifest_sha256")
                if expected_hash != verified.manifest_sha256:
                    _raise(
                        "MANIFEST_HASH_MISMATCH",
                        "dispatch manifest hash does not match freshly verified package bytes",
                        expected=verified.manifest_sha256,
                        actual=expected_hash,
                    )
                outcome_text = self._text(request, "recording_outcome")
                try:
                    outcome = DeliveryOutcome(outcome_text)
                except ValueError:
                    _raise("RECORDING_OUTCOME_INVALID", "recording outcome is not supported", outcome=outcome_text)
                key = self._text(request, "idempotency_key")
                detail = {
                    DeliveryOutcome.DISPATCHED: "RECORDED_DISPATCH_SIMULATION",
                    DeliveryOutcome.ACKNOWLEDGED: "RECORDED_ACKNOWLEDGEMENT_SIMULATION",
                    DeliveryOutcome.EXCEPTION: "RECORDED_NOT_SENT_EXCEPTION",
                    DeliveryOutcome.UNKNOWN: "RECORDED_UNKNOWN_SEND_SIMULATION",
                }[outcome]
                connector = RecordingConnector(
                    outcome=outcome,
                    connector_reference=f"recording:{key}",
                    detail_code=detail,
                )
                result = self.dispatcher.dispatch(
                    manifest_path=self._manifest_path(request),
                    package_root=self.package_root,
                    expected_candidate=self.candidate,
                    connector=connector,
                    route_ref=self._text(request, "route_ref"),
                    idempotency_key=key,
                    actor_id=self._text(request, "actor_id"),
                    occurred_at=self._text(request, "occurred_at"),
                    retry_of_request_id=request.get("retry_of_request_id"),
                )
                self._capture_dispatch(result)
                return 200, self._envelope(
                    "REPLAYED_RECORDING_ONLY" if result.replayed else "DISPATCH_RECORDED_ONLY",
                    replayed=result.replayed,
                    request=result.request.as_dict(),
                    receipt=result.receipt.as_dict(),
                    audit_events=[event.as_dict() for event in result.audit_events],
                )

        return self._guard(action)

    def read_receipt(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                self._require_current_candidate(request)
                receipt_id = self._text(request, "receipt_id")
                receipt = self._receipts.get(receipt_id)
                if receipt is None:
                    _raise("RECEIPT_NOT_FOUND", "receipt is not present in this process-local runtime")
                request_record = self._requests.get(receipt.request_id)
                if request_record is None:
                    _raise("REQUEST_NOT_FOUND", "receipt request is not present in this process-local runtime")
                if request_record.candidate != self.candidate:
                    _raise("STALE_CANDIDATE", "receipt is bound to a different candidate")
                verify_record_hash(request_record.as_dict(), "request_sha256", "request_id", "order-request:")
                verify_record_hash(receipt.as_dict(), "receipt_sha256", "receipt_id", "order-receipt:")
                latest_id = self._latest_receipt_by_request[receipt.request_id]
                return 200, self._envelope(
                    "RECEIPT_READ_PROCESS_LOCAL",
                    is_latest=latest_id == receipt_id,
                    latest_receipt_id=latest_id,
                    request=request_record.as_dict(),
                    receipt=receipt.as_dict(),
                    audit_events=self._events_for(receipt.request_id),
                )

        return self._guard(action)

    def acknowledge(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                self._require_current_candidate(request)
                prior = self._current_receipt(request)
                receipt = self.dispatcher.acknowledge(
                    prior.receipt_id,
                    acknowledgement_ref=self._text(request, "acknowledgement_ref"),
                    actor_id=self._text(request, "actor_id"),
                    occurred_at=self._text(request, "occurred_at"),
                )
                self._capture_transition(receipt)
                return 200, self._envelope(
                    "ACKNOWLEDGEMENT_RECORDED_ONLY",
                    receipt=receipt.as_dict(),
                    audit_events=self._events_for(receipt.request_id),
                )

        return self._guard(action)

    def close(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                self._require_current_candidate(request)
                prior = self._current_receipt(request)
                if prior.state == OrderState.UNKNOWN:
                    _raise(
                        "UNKNOWN_RECONCILIATION_REQUIRED",
                        "UNKNOWN receipts must use the reconciliation route before closure",
                    )
                receipt = self.dispatcher.close(
                    prior.receipt_id,
                    actor_id=self._text(request, "actor_id"),
                    occurred_at=self._text(request, "occurred_at"),
                    resolution_ref=request.get("resolution_ref"),
                )
                self._capture_transition(receipt)
                return 200, self._envelope(
                    "CLOSED_PROCESS_LOCAL",
                    receipt=receipt.as_dict(),
                    audit_events=self._events_for(receipt.request_id),
                )

        return self._guard(action)

    def reconcile_unknown(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                self._require_current_candidate(request)
                prior = self._current_receipt(request)
                if prior.state != OrderState.UNKNOWN:
                    _raise("STATE_TRANSITION_INVALID", "only an UNKNOWN receipt can be reconciled", state=prior.state.value)
                effect_text = self._text(request, "reconciled_send_effect")
                try:
                    effect = SendEffect(effect_text)
                except ValueError:
                    _raise(
                        "UNKNOWN_RECONCILIATION_REQUIRED",
                        "reconciled send effect must be NOT_SENT or SENT",
                    )
                if effect not in {SendEffect.NOT_SENT, SendEffect.SENT}:
                    _raise(
                        "UNKNOWN_RECONCILIATION_REQUIRED",
                        "reconciled send effect must be NOT_SENT or SENT",
                    )
                receipt = self.dispatcher.close(
                    prior.receipt_id,
                    actor_id=self._text(request, "actor_id"),
                    occurred_at=self._text(request, "occurred_at"),
                    resolution_ref=self._text(request, "resolution_ref"),
                    reconciled_send_effect=effect,
                )
                self._capture_transition(receipt)
                return 200, self._envelope(
                    "UNKNOWN_RECONCILED_PROCESS_LOCAL",
                    receipt=receipt.as_dict(),
                    audit_events=self._events_for(receipt.request_id),
                )

        return self._guard(action)

    def verify_audit(self, request: Any) -> tuple[int, dict[str, Any]]:
        def action() -> tuple[int, dict[str, Any]]:
            with self._lock:
                self._require_current_candidate(request)
                supplied = request.get("events")
                events = self.dispatcher.audit_events if supplied is None else supplied
                if not isinstance(events, (list, tuple)):
                    _raise("AUDIT_EVENTS_INVALID", "events must be an array when supplied")
                checked = verify_audit_chain(events)
                head = checked[-1].event_sha256 if checked else None
                return 200, self._envelope(
                    "AUDIT_CHAIN_VERIFIED_PROCESS_LOCAL",
                    event_count=len(checked),
                    audit_head_sha256=head,
                    events=[event.as_dict() for event in checked],
                )

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
