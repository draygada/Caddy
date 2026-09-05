"""Immutable core snapshot to Tripwire review-readiness runtime."""

from __future__ import annotations

import argparse
from copy import deepcopy
from dataclasses import dataclass
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
from typing import Any, Callable, Mapping
from urllib.parse import unquote, urlsplit

from compliance_bridge import (
    ComplianceBridgeError,
    canonical_sha256,
    compute_node_id,
    compute_projection_hash,
    evaluate_compliance,
    validate_binding_receipt,
    validate_observation,
)
from . import REPOSITORY_ROOT

CANDIDATE_TIME = "2026-09-05T20:00:00Z"
TRIPWIRE_SOURCE_COMMIT = "898f6167e4305a4f86f3ebe4a473278ffbd56530"
PRODUCT_THREAD_ID = "product-thread:caddydaddy-demo-01"
BOUNDED_CLAIM = "CADdyDaddy binds a selected CAD entity to its immutable product revision and runs a review-readiness guardrail through Tripwire; Candidate 0.1 returns insufficient evidence and requires human review, not a compliance determination."
POSITIONING = "We're closing the loop from idea to execution for high-stakes industries."
REQUEST_KEYS = {"entity_id", "node_id", "product_thread_id", "forge_record_id", "occurrence_path", "forge_record_revision_id", "forge_revision_id"}
MAX_REQUEST_BODY_BYTES = 65536
SNAPSHOT_SCHEMA = "caddydaddy.core-snapshot/1"
SNAPSHOT_FILENAME = "candidate-snapshot.v1.json"
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_TRIPWIRE_EVALUATOR = REPOSITORY_ROOT / "features" / "tripwire" / "backend" / "engine" / "evaluate.py"
_EMPTY_RULES: list[dict[str, Any]] = []


@dataclass(slots=True)
class CandidateState:
    public: dict[str, Any]
    revision: dict[str, Any]
    bindings: dict[str, dict[str, Any]]
    records: dict[str, dict[str, Any]]
    integrity_hash: str
    snapshot_receipt: dict[str, Any]

    def preimage(self) -> dict[str, Any]:
        return {"public": self.public, "revision": self.revision, "bindings": self.bindings, "records": self.records}


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _snapshot_error(code: str) -> RuntimeError:
    return RuntimeError(code)


def _require_identity(value: Any, pattern: re.Pattern[str], code: str) -> str:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        raise _snapshot_error(code)
    return value


def _verify_resolved_manifest(snapshot: Mapping[str, Any], snapshot_path: Path, manifest_path: Path) -> None:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        generated = manifest["generated_snapshot"]
        if manifest["source"] != snapshot["source"]:
            raise _snapshot_error("SNAPSHOT_STALE")
        if generated["schema_version"] != SNAPSHOT_SCHEMA:
            raise _snapshot_error("SNAPSHOT_SCHEMA_INVALID")
        if generated["file_sha256"] != _sha256_file(snapshot_path):
            raise _snapshot_error("SNAPSHOT_TAMPERED")
        if generated["document_sha256"] != snapshot["snapshot_hash"]:
            raise _snapshot_error("SNAPSHOT_TAMPERED")
        if generated["provenance"] != snapshot["generation"] or manifest["tripwire"] != snapshot["tripwire"]:
            raise _snapshot_error("SNAPSHOT_STALE")
        if manifest["build_command"] != snapshot["generation"]["build_command"]:
            raise _snapshot_error("SNAPSHOT_STALE")
        records = {record["path"]: record for record in manifest["files"]}
        record = records[generated["path"]]
        if record["sha256"] != generated["file_sha256"]:
            raise _snapshot_error("SNAPSHOT_TAMPERED")
    except RuntimeError:
        raise
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise _snapshot_error("RESOLVED_MANIFEST_INVALID") from error


def load_candidate_state(snapshot_path: Path | None = None, manifest_path: Path | None = None) -> CandidateState:
    configured = os.environ.get("CADDYDADDY_SNAPSHOT_PATH")
    active_snapshot = (snapshot_path or (Path(configured) if configured else Path(__file__).with_name(SNAPSHOT_FILENAME))).resolve()
    if not active_snapshot.is_file():
        raise _snapshot_error("SNAPSHOT_MISSING")
    try:
        snapshot = json.loads(active_snapshot.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise _snapshot_error("SNAPSHOT_INVALID") from error
    if not isinstance(snapshot, dict) or snapshot.get("schema_version") != SNAPSHOT_SCHEMA:
        raise _snapshot_error("SNAPSHOT_SCHEMA_INVALID")
    _require_identity(snapshot.get("snapshot_hash"), _HEX64, "SNAPSHOT_IDENTITY_INVALID")
    unsigned = {key: value for key, value in snapshot.items() if key != "snapshot_hash"}
    if canonical_sha256(unsigned) != snapshot["snapshot_hash"]:
        raise _snapshot_error("SNAPSHOT_TAMPERED")
    try:
        source = snapshot["source"]
        _require_identity(source["commit"], _HEX40, "SNAPSHOT_SOURCE_IDENTITY_INVALID")
        _require_identity(source["tree"], _HEX40, "SNAPSHOT_SOURCE_IDENTITY_INVALID")
        _require_identity(source["commit_tree"], _HEX40, "SNAPSHOT_SOURCE_IDENTITY_INVALID")
        if source["tree_state"] not in {"COMMITTED", "STAGED_CANDIDATE"}:
            raise _snapshot_error("SNAPSHOT_SOURCE_IDENTITY_INVALID")
        generation = snapshot["generation"]
        if generation["mode"] != "LOCAL_CORE_RECOMPUTE" or not generation["build_command"]:
            raise _snapshot_error("SNAPSHOT_PROVENANCE_INVALID")
        evaluator = snapshot["tripwire"]["evaluator"]
        _require_identity(evaluator["source_commit"], _HEX40, "EVALUATOR_IDENTITY_INVALID")
        _require_identity(evaluator["source_tree"], _HEX40, "EVALUATOR_IDENTITY_INVALID")
        _require_identity(evaluator["sha256"], _HEX64, "EVALUATOR_IDENTITY_INVALID")
        rulepack = snapshot["tripwire"]["rulepack"]
        _require_identity(rulepack["sha256"], _HEX64, "RULEPACK_IDENTITY_INVALID")
        if rulepack["state"] != "DRAFT_REVIEW_ONLY" or rulepack["rule_count"] != 0:
            raise _snapshot_error("RULEPACK_IDENTITY_INVALID")
        raw_state = snapshot["candidate_state"]
        state = CandidateState(
            public=raw_state["public"],
            revision=raw_state["revision"],
            bindings=raw_state["bindings"],
            records=raw_state["records"],
            integrity_hash=raw_state["integrity_hash"],
            snapshot_receipt={
                "path": str(active_snapshot),
                "file_sha256": _sha256_file(active_snapshot),
                "document_sha256": snapshot["snapshot_hash"],
                "source": deepcopy(source),
                "generation": deepcopy(generation),
                "core": deepcopy(snapshot["core"]),
                "tripwire": deepcopy(snapshot["tripwire"]),
            },
        )
    except RuntimeError:
        raise
    except (KeyError, TypeError, ValueError) as error:
        raise _snapshot_error("SNAPSHOT_INVALID") from error
    if canonical_sha256(state.preimage()) != state.integrity_hash:
        raise _snapshot_error("SNAPSHOT_STATE_TAMPERED")
    expected_public_source = {"commit": source["commit"], "tree": source["tree"]}
    if state.public.get("snapshotProvenance", {}).get("source") != expected_public_source:
        raise _snapshot_error("SNAPSHOT_STALE")
    active_manifest = manifest_path
    if active_manifest is None:
        default_manifest = REPOSITORY_ROOT / "bundle-manifest.resolved.json"
        active_manifest = default_manifest if default_manifest.is_file() else None
    if active_manifest is not None:
        _verify_resolved_manifest(snapshot, active_snapshot, active_manifest.resolve())
    return state


def review_readiness_guardrail(record: Mapping[str, Any]) -> dict[str, Any]:
    """Report evidence presence only; this function cannot clear or classify."""

    requirements = (
        ("origin", "tripwire_payload", "origin"),
        ("material", "tripwire_payload", "material"),
        ("supplier", "business_fields", "vendor"),
        ("end_use", "tripwire_payload", "end_use"),
    )
    missing: list[dict[str, str]] = []
    present: list[dict[str, str]] = []
    for field, container, key in requirements:
        value = record.get(container, {}).get(key)
        has_value = value is not None and (not isinstance(value, (str, list, tuple, dict)) or bool(value))
        target = present if has_value else missing
        target.append({
            "field": field,
            "source": f"{container}.{key}",
            "reason_code": f"REVIEW_EVIDENCE_{'PRESENT' if has_value else 'MISSING'}:{field.upper()}",
            "reason": (
                f"{field.replace('_', ' ').title()} evidence is present for human review; no inference or determination was made."
                if has_value
                else f"{field.replace('_', ' ').title()} evidence is missing from the bound product record."
            ),
        })
    return {
        "guardrail": "caddydaddy.review-readiness/1",
        "scope": "EVIDENCE_PRESENCE_ONLY",
        "outcome": "MISSING_EVIDENCE" if missing else "EVIDENCE_FIELDS_PRESENT",
        "missing": missing,
        "present": present,
        "can_clear": False,
        "can_classify": False,
        "regulatory_determination": "NOT_PERFORMED",
        "human_review_requirement": "HUMAN_REVIEW_REQUIRED",
    }


class CandidateRuntime:
    def __init__(self, state: CandidateState | None = None, bridge_evaluate: Callable[..., dict[str, Any]] | None = None, *, snapshot_path: Path | None = None, manifest_path: Path | None = None) -> None:
        self.state = state or load_candidate_state(snapshot_path, manifest_path)
        self.bridge_evaluate = bridge_evaluate or evaluate_compliance
        self.evaluator_path = _TRIPWIRE_EVALUATOR
        self._verify_runtime_inputs()

    def _verify_runtime_inputs(self) -> None:
        evaluator = self.state.snapshot_receipt["tripwire"]["evaluator"]
        if not self.evaluator_path.is_file():
            raise _snapshot_error("EVALUATOR_MISSING")
        if _sha256_file(self.evaluator_path) != evaluator["sha256"]:
            raise _snapshot_error("EVALUATOR_TAMPERED")
        rulepack = self.state.snapshot_receipt["tripwire"]["rulepack"]
        if canonical_sha256(_EMPTY_RULES) != rulepack["sha256"]:
            raise _snapshot_error("RULEPACK_TAMPERED")

    def candidate(self) -> dict[str, Any]:
        return deepcopy(self.state.public)

    def health(self) -> dict[str, Any]:
        return {"ok": True, "service": "caddydaddy-product-service", "candidate": "0.1", "status": "SNAPSHOT_RUNTIME", "policy_state": "DRAFT_REVIEW_ONLY", "snapshot": {"sha256": self.state.snapshot_receipt["document_sha256"], "source": deepcopy(self.state.snapshot_receipt["source"]), "verified": True}}

    def evaluate_request(self, request: Any) -> tuple[int, dict[str, Any]]:
        try:
            self._verify_runtime_inputs()
        except RuntimeError as error:
            return self._blocked(503, str(error), "Immutable runtime evidence failed verification.")
        if canonical_sha256(self.state.preimage()) != self.state.integrity_hash:
            return self._blocked(503, "CANDIDATE_TAMPERED", "The in-memory candidate no longer matches its startup receipt.")
        if not isinstance(request, dict) or set(request) != REQUEST_KEYS:
            return self._blocked(400, "REQUEST_SCHEMA_INVALID", "The selection binding fields are incomplete or unexpected.")
        entity_id = request.get("entity_id")
        expected = self.state.bindings.get(entity_id, {}).get("request")
        if expected is None:
            return self._blocked(409, "SELECTION_NOT_CURRENT", "The selected entity is not current.")
        checks = (
            ("product_thread_id", "WRONG_PRODUCT_THREAD"),
            ("forge_record_id", "WRONG_RECORD"),
            ("occurrence_path", "WRONG_OCCURRENCE"),
            ("forge_record_revision_id", "STALE_RECORD_REVISION"),
            ("forge_revision_id", "STALE_FORGE_REVISION"),
            ("node_id", "SELECTION_NODE_MISMATCH"),
        )
        for field, code in checks:
            if request.get(field) != expected[field]:
                return self._blocked(409, code, f"The submitted {field} does not match the current immutable selection.")
        record = self.state.records[request["forge_record_id"]]
        rules = deepcopy(_EMPTY_RULES)
        guardrail = review_readiness_guardrail(record)
        compliance_input = {
            "schema_version": "caddydaddy.compliance-input/1",
            "projection_id": "compliance-input:" + "0" * 64,
            "projection_hash": "0" * 64,
            "product_thread_id": PRODUCT_THREAD_ID,
            "created_at": CANDIDATE_TIME,
            "producer": {"system": "FORGE", "runtime": "SERVER"},
            "forge_revision": deepcopy(self.state.revision),
            "unit_conversion": {"source_length_unit": "mm", "target_length_unit": "m", "exact_factor": "0.001"},
            "rule_pack": {"state": "DRAFT_REVIEW_ONLY", "content_hash": canonical_sha256(rules), "source_ref": "rules:synthetic-empty-draft-0.1"},
            "nodes": [{"node_id": record["tripwire_node_id"], "identity_preimage": {"product_thread_id": PRODUCT_THREAD_ID, "forge_record_id": request["forge_record_id"], "occurrence_path": request["occurrence_path"]}, "forge_record_revision_id": request["forge_record_revision_id"], "kind": "part", "parent_node_id": None, "business_fields": record["business_fields"], "measurements": record["measurements"], "tripwire_payload": record["tripwire_payload"]}],
        }
        projection_hash = compute_projection_hash(compliance_input)
        compliance_input["projection_hash"] = projection_hash
        compliance_input["projection_id"] = "compliance-input:" + projection_hash
        try:
            result = self.bridge_evaluate(
                compliance_input,
                current_forge_revision=self.state.revision,
                current_records={request["forge_record_id"]: {"forge_record_revision_id": request["forge_record_revision_id"], "occurrence_path": request["occurrence_path"]}},
                rules=rules,
                chart={"countries": {}},
                observed_at=CANDIDATE_TIME,
                recorded_at=CANDIDATE_TIME,
                source_commit=TRIPWIRE_SOURCE_COMMIT,
            )
        except ComplianceBridgeError as error:
            receipt = self._safe_blocked_receipt(error.binding_receipt, request)
            return self._blocked(502, error.code, "Tripwire evaluation failed closed.", receipt)
        try:
            observation = result["observation"]
            receipt = result["binding_receipt"]
            validate_observation(observation)
            validate_binding_receipt(receipt)
            findings = observation["findings"]
            if (
                receipt["binding_status"] != "BOUND"
                or receipt["compliance_claim_gate"] != "HUMAN_REVIEW_REQUIRED"
                or receipt["product_thread_id"] != request["product_thread_id"]
                or receipt["forge_revision_id"] != request["forge_revision_id"]
                or receipt["forge_recompute"]["geometry_artifact_hash"] != self.state.revision["geometry_artifact_hash"]
                or receipt["tripwire"]["input_ref"] != observation["input_ref"]
                or len(findings) != 1
                or findings[0]["node_id"] != record["tripwire_node_id"]
                or findings[0]["outcome"] != "INSUFFICIENT_EVIDENCE"
                or findings[0]["rule_ids"]
                or observation["legal_effect"] != "NONE"
            ):
                raise ComplianceBridgeError("BINDING_MISMATCH", "Bound evidence does not match selection")
        except (ComplianceBridgeError, KeyError, TypeError) as error:
            code = error.code if isinstance(error, ComplianceBridgeError) else "BRIDGE_RESPONSE_INVALID"
            return self._blocked(502, code, "The evaluator response failed receipt validation.")
        return 200, {
            "status": "REVIEW_REQUIRED",
            "evidence_status": "INSUFFICIENT_EVIDENCE",
            "cleared": False,
            "policy_state": "DRAFT_REVIEW_ONLY",
            "human_review_requirement": "HUMAN_REVIEW_REQUIRED",
            "claim_ceiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION",
            "claim_ceiling_statement": BOUNDED_CLAIM,
            "legal_effect": "NONE",
            "binding": {"request": deepcopy(request), "tripwire_node_id": record["tripwire_node_id"], "projection_ref": {"projection_id": compliance_input["projection_id"], "projection_hash": compliance_input["projection_hash"]}},
            "evidence": {"finding": deepcopy(findings[0]), "determination": deepcopy(result["evaluator_output"][record["tripwire_node_id"]])},
            "review_readiness_guardrail": guardrail,
            "observation": deepcopy(observation),
            "binding_receipt": deepcopy(receipt),
        }

    def _safe_blocked_receipt(self, receipt: Any, request: Mapping[str, Any]) -> dict[str, Any] | None:
        try:
            validate_binding_receipt(receipt)
            if receipt["binding_status"] == "BOUND" or receipt["compliance_claim_gate"] != "BLOCKED" or receipt["product_thread_id"] != request["product_thread_id"] or receipt["forge_revision_id"] != request["forge_revision_id"]:
                return None
            return deepcopy(receipt)
        except Exception:
            return None

    @staticmethod
    def _blocked(status_code: int, code: str, message: str, receipt: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
        return status_code, {"status": "BLOCKED", "cleared": False, "policy_state": "BLOCKED", "human_review_requirement": "BLOCKED", "claim_ceiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION", "legal_effect": "NONE", "diagnostic": {"code": code, "message": message}, "binding_receipt": receipt}


class ProductServer(ThreadingHTTPServer):
    daemon_threads = True


def create_handler(
    runtime: CandidateRuntime | None = None,
    static_root: Path | None = None,
) -> type[BaseHTTPRequestHandler]:
    """Bind the product runtime to one reusable local/Vercel HTTP handler."""

    active_runtime = runtime or CandidateRuntime()
    default_assets = REPOSITORY_ROOT / "public"
    if not default_assets.is_dir():
        default_assets = REPOSITORY_ROOT / "apps" / "browser-workbench" / "dist"
    assets = (static_root or default_assets).resolve()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            path = urlsplit(self.path).path
            if path in {"/api/health", "/healthz"}:
                self._json(200, active_runtime.health())
                return
            if path == "/api/candidate":
                self._json(200, active_runtime.candidate())
                return
            if path == "/api/compliance-at-design-click":
                self._method_not_allowed("POST")
                return
            if path == "/api" or path.startswith("/api/"):
                self._json(404, {"status": "BLOCKED", "diagnostic": {"code": "ROUTE_NOT_FOUND"}})
                return
            relative = unquote(path).lstrip("/") or "index.html"
            if ".." in Path(relative).parts:
                self._json(404, {"status": "BLOCKED", "diagnostic": {"code": "ASSET_NOT_FOUND"}})
                return
            try:
                candidate = (assets / relative).resolve()
                if assets not in candidate.parents or not candidate.is_file():
                    if Path(relative).suffix:
                        raise FileNotFoundError
                    candidate = (assets / "index.html").resolve()
                if assets not in candidate.parents or not candidate.is_file():
                    raise FileNotFoundError
                content = candidate.read_bytes()
            except (FileNotFoundError, OSError, ValueError):
                self._json(404, {"status": "BLOCKED", "diagnostic": {"code": "ASSET_NOT_FOUND"}})
                return
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; worker-src 'self'")
            self.end_headers()
            self.wfile.write(content)

        def do_POST(self) -> None:
            path = urlsplit(self.path).path
            if path in {"/api/health", "/healthz", "/api/candidate"}:
                self._method_not_allowed("GET")
                return
            if path != "/api/compliance-at-design-click":
                self._json(404, {"status": "BLOCKED", "diagnostic": {"code": "ROUTE_NOT_FOUND"}})
                return
            if self.headers.get_content_type() != "application/json":
                self._json(*CandidateRuntime._blocked(415, "CONTENT_TYPE_UNSUPPORTED", "Content-Type must be application/json."))
                return
            if self.headers.get("Transfer-Encoding") is not None:
                self._json(*CandidateRuntime._blocked(400, "REQUEST_BODY_INVALID", "Transfer-Encoding is not supported."))
                return
            raw_length = self.headers.get("Content-Length")
            if raw_length is None:
                self._json(*CandidateRuntime._blocked(411, "CONTENT_LENGTH_REQUIRED", "Content-Length is required."))
                return
            try:
                length = int(raw_length)
                if length <= 0:
                    raise ValueError
            except ValueError:
                self._json(*CandidateRuntime._blocked(400, "REQUEST_BODY_INVALID", "A bounded JSON request is required."))
                return
            if length > MAX_REQUEST_BODY_BYTES:
                self._json(*CandidateRuntime._blocked(413, "REQUEST_BODY_TOO_LARGE", "The JSON request exceeds 65536 bytes."))
                return
            try:
                body = self.rfile.read(length)
                if len(body) != length:
                    raise ValueError
                request = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
                self._json(*CandidateRuntime._blocked(400, "REQUEST_BODY_INVALID", "A bounded JSON request is required."))
                return
            self._json(*active_runtime.evaluate_request(request))

        def do_DELETE(self) -> None:
            self._method_not_allowed("GET, POST")

        def do_OPTIONS(self) -> None:
            self._method_not_allowed("GET, POST")

        def do_PATCH(self) -> None:
            self._method_not_allowed("GET, POST")

        def do_PUT(self) -> None:
            self._method_not_allowed("GET, POST")

        def _method_not_allowed(self, allow: str) -> None:
            content = json.dumps(
                {"status": "BLOCKED", "diagnostic": {"code": "METHOD_NOT_ALLOWED"}},
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            self.send_response(405)
            self.send_header("Allow", allow)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(content)

        def _json(self, status: int, body: dict[str, Any]) -> None:
            content = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format: str, *args: object) -> None:
            return

    return Handler


def create_server(host: str, port: int, runtime: CandidateRuntime | None = None, static_root: Path | None = None) -> ProductServer:
    return ProductServer((host, port), create_handler(runtime, static_root))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve local CADdyDaddy Candidate 0.1")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args(argv)
    server = create_server(args.host, args.port)
    print(f"CADdyDaddy Candidate 0.1 listening at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0
