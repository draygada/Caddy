"""Immutable core snapshot to Tripwire review-readiness runtime."""

from __future__ import annotations

import argparse
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
import os
from pathlib import Path
import re
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

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
RELEASE_CANDIDATE_VERSION = "0.2"
RELEASE_CANDIDATE_ID = f"candidate:{RELEASE_CANDIDATE_VERSION}"
RELEASE_REVISION_ID = "revision:caddydaddy-candidate-0.2"
RELEASE_IDENTITY_SCHEMA = "caddydaddy.release-identity/1"
BOUNDED_CLAIM = "CADdyDaddy Candidate 0.2 connects bounded CAD authoring and execution-support workflows while preserving explicit review, evidence, and no-external-effect boundaries; no response is a legal determination, transaction clearance, or permission to ship."
POSITIONING = "We're closing the loop from idea to execution for high-stakes industries."
REQUEST_KEYS = {"entity_id", "node_id", "product_thread_id", "forge_record_id", "occurrence_path", "forge_record_revision_id", "forge_revision_id"}
MAX_REQUEST_BODY_BYTES = 65536
MAX_PROVIDER_BODY_BYTES = 4_250_000
MAX_CAD_REQUEST_BODY_BYTES = MAX_PROVIDER_BODY_BYTES
MAX_CAD_RESPONSE_BODY_BYTES = MAX_PROVIDER_BODY_BYTES
MAX_RESPONSE_BODY_BYTES = MAX_PROVIDER_BODY_BYTES
CAD_CLIENT_STATE_SCHEMA = "caddydaddy.cad-client-state/1"
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
        legacy_public = deepcopy(self.state.public)
        source_candidate = legacy_public.get("candidate", {})
        source_document = legacy_public.get("document", {})
        snapshot_sha256 = self.state.snapshot_receipt["document_sha256"]

        public = {
            key: deepcopy(value)
            for key, value in legacy_public.items()
            if key not in {
                "candidate",
                "capabilities",
                "capabilityContracts",
                "boundaryMetadata",
                "legacySnapshotEvidence",
                "releaseIdentity",
                "sourceSnapshotIdentity",
                "document",
            }
        }
        public["candidate"] = {
            **deepcopy(source_candidate),
            "id": RELEASE_CANDIDATE_ID,
            "version": RELEASE_CANDIDATE_VERSION,
            "revisionId": RELEASE_REVISION_ID,
            "status": "CANDIDATE_0_2_RUNTIME",
            "claim": BOUNDED_CLAIM,
            "claimCeiling": BOUNDED_CLAIM,
        }
        public["releaseIdentity"] = {
            "schemaVersion": RELEASE_IDENTITY_SCHEMA,
            "candidateId": RELEASE_CANDIDATE_ID,
            "candidateVersion": RELEASE_CANDIDATE_VERSION,
            "revisionId": RELEASE_REVISION_ID,
            "snapshotSha256": snapshot_sha256,
        }
        public["capabilities"] = {
            "authoring": True,
            "recompute": True,
            "import": True,
            "export": True,
            "regulatoryClassification": True,
            "classification": True,
            "sourcing": True,
            "provenance": True,
            "cadOutputs": True,
            "ordering": True,
            "liveSupplierSend": False,
            "govCloudAuthorized": False,
            "cuiAuthorized": False,
        }
        public["capabilityContracts"] = {
            "cadAuthoring": {
                "status": "IMPLEMENTED_BOUNDED",
                "operations": [
                    "SKETCH",
                    "EXTRUDE",
                    "REVOLVE",
                    "BOOLEAN",
                    "HOLE",
                    "FILLET",
                    "CHAMFER",
                    "TRANSFORM",
                ],
                "multiBody": True,
                "assemblies": True,
            },
            "liveKernelRecompute": {
                "status": "IMPLEMENTED_BOUNDED",
                "kernel": "OpenCascade 7.9.3",
                "staleRevisionRejection": True,
                "dependencyGraph": True,
            },
            "cadExchange": {
                "status": "IMPLEMENTED_BOUNDED",
                "formats": ["STEP", "IGES", "STL"],
                "editableExternalNativeHistoryRoundTrip": False,
            },
            "classification": {
                "status": "IMPLEMENTED_REVIEW_SUPPORT_ONLY",
                "orderedRoute": ["USML", "CCL", "EAR99"],
                "intentionalResidualEar99FallThrough": True,
                "legalDetermination": False,
            },
            "sourcingAndProvenance": {
                "status": "IMPLEMENTED_BOUNDED",
                "fullCslScreening": False,
                "liveSupplierSend": False,
            },
            "cadOutputs": {
                "status": "IMPLEMENTED_BOUNDED",
                "outputs": ["CADDYDADDY_SNAPSHOT", "SVG", "DXF", "BOM_CSV", "SEALED_MANUFACTURING_BUNDLE"],
                "camOrGcode": False,
                "gdtCertification": False,
            },
            "ordering": {
                "status": "IMPLEMENTED_RECORDING_ONLY",
                "externalEffect": "NONE",
                "connector": "RECORDING_ONLY",
            },
        }
        public["boundaryMetadata"] = {
            "cad": {
                "sketchSolver": "BOUNDED_GAUSS_NEWTON",
                "degreesOfFreedom": "LOCAL_JACOBIAN_RANK_ESTIMATE",
                "assemblyMates": "BOUNDED_RIGID_RESOLUTION",
                "topologyPersistence": "HEURISTIC_REMAP_NOT_PERFECT_PERSISTENT_NAMING",
                "editableExternalNativeHistory": "NOT_IMPLEMENTED",
            },
            "assurance": {
                "legalDetermination": "NOT_PERFORMED",
                "fullCslScreening": "NOT_IMPLEMENTED",
                "sourceAuthorityCurrencyAndCompleteness": "NOT_VERIFIED",
            },
            "operations": {
                "supplierCommunication": "NONE",
                "productionOrderExecution": "NONE",
            },
            "deployment": {
                "govCloudAuthorization": "NOT_CLAIMED",
                "cuiAuthorization": "NOT_CLAIMED",
            },
            "continuity": {
                "model": "HASH_SEALED_CLIENT_CARRIED_STATE",
                "durableGlobalState": False,
                "authenticatedState": False,
                "globalReplayPrevention": False,
            },
        }

        current_document = deepcopy(source_document)
        current_document["revisionId"] = RELEASE_REVISION_ID
        current_document["evidenceRole"] = "LEGACY_CANDIDATE_0_1_TRIPWIRE_BINDING_PROJECTION"
        current_document["sourceSnapshotRevisionId"] = str(source_document.get("revisionId", "revision:unknown"))
        scene = current_document.get("scene")
        if isinstance(scene, dict):
            legacy_scene_revision = scene.get("revisionId")
            scene["revisionId"] = RELEASE_REVISION_ID
            scene["legacyRevisionId"] = legacy_scene_revision
            for node in scene.get("nodes", []):
                metadata = node.get("metadata") if isinstance(node, dict) else None
                if isinstance(metadata, dict) and "sourceRevisionId" in metadata:
                    metadata["legacySourceRevisionId"] = metadata["sourceRevisionId"]
                    metadata["sourceRevisionId"] = RELEASE_REVISION_ID
        public["document"] = current_document

        forge_revision = public.get("forgeRevision")
        if isinstance(forge_revision, dict) and "revision_id" in forge_revision:
            forge_revision["legacy_revision_id"] = forge_revision["revision_id"]
            forge_revision["revision_id"] = RELEASE_REVISION_ID
            forge_revision["evidenceRole"] = "LEGACY_CANDIDATE_0_1_GEOMETRY_PROJECTION"

        sourcing_round = public.get("sourcingRound")
        if isinstance(sourcing_round, dict) and "sourceRevisionId" in sourcing_round:
            sourcing_round["legacySourceRevisionId"] = sourcing_round["sourceRevisionId"]
            sourcing_round["sourceRevisionId"] = RELEASE_REVISION_ID
            sourcing_round["evidenceRole"] = "LEGACY_CANDIDATE_0_1_SOURCING_PROJECTION"

        for history_entry in public.get("history", []):
            if isinstance(history_entry, dict) and "revisionId" in history_entry:
                history_entry["legacyRevisionId"] = history_entry["revisionId"]
                history_entry["revisionId"] = RELEASE_REVISION_ID
                history_entry["evidenceRole"] = "LEGACY_CANDIDATE_0_1_HISTORY_PROJECTION"

        states = public.get("states")
        current_state = states.get("current") if isinstance(states, dict) else None
        if isinstance(current_state, dict):
            for key in ("displayedRevisionId", "requestedRevisionId"):
                if key in current_state:
                    current_state[f"legacy{key[0].upper()}{key[1:]}"] = current_state[key]
                    current_state[key] = RELEASE_REVISION_ID
            current_state["evidenceRole"] = "LEGACY_CANDIDATE_0_1_STATE_PROJECTION"

        if isinstance(public.get("kernelProvenance"), dict):
            public["kernelProvenance"]["evidenceRole"] = "LEGACY_CANDIDATE_0_1_BUILD_EVIDENCE"
        if isinstance(public.get("snapshotProvenance"), dict):
            public["snapshotProvenance"]["evidenceRole"] = "LEGACY_CANDIDATE_0_1_BUILD_EVIDENCE"

        public["legacySnapshotEvidence"] = {
            "role": "IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY",
            "candidateVersion": str(source_candidate.get("version", "unknown")),
            "revisionId": str(source_document.get("revisionId", "revision:unknown")),
            "snapshotSha256": snapshot_sha256,
            "immutable": True,
            "currentCapabilityAuthority": False,
            "publicSnapshot": legacy_public,
        }
        return public

    def health(self) -> dict[str, Any]:
        source_candidate = self.state.public.get("candidate", {})
        source_document = self.state.public.get("document", {})
        return {
            "ok": True,
            "service": "caddydaddy-product-service",
            "candidate": RELEASE_CANDIDATE_VERSION,
            "candidate_id": RELEASE_CANDIDATE_ID,
            "revision_id": RELEASE_REVISION_ID,
            "status": "CANDIDATE_0_2_RUNTIME",
            "policy_state": "DRAFT_REVIEW_ONLY",
            "snapshot": {
                "sha256": self.state.snapshot_receipt["document_sha256"],
                "source": deepcopy(self.state.snapshot_receipt["source"]),
                "source_candidate_version": str(source_candidate.get("version", "unknown")),
                "source_revision_id": str(source_document.get("revisionId", "revision:unknown")),
                "verified": True,
            },
        }

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


CANDIDATE02_POST_ROUTES = (
    "/api/classification",
    "/api/sourcing/rounds",
    "/api/sourcing/adjudications",
    "/api/sourcing/selections",
    "/api/sourcing/packages",
    "/api/sourcing/dispatches",
    "/api/provenance/inspect",
    "/api/provenance/verify",
    "/api/provenance/accept",
    "/api/cad/recompute",
    "/api/cad/import",
    "/api/cad/export",
    "/api/cad/outputs/native/seal",
    "/api/cad/outputs/native/load",
    "/api/cad/outputs/generate",
    "/api/orders/packages/validate",
    "/api/orders/dispatches",
    "/api/orders/receipts/read",
    "/api/orders/receipts/acknowledge",
    "/api/orders/receipts/reconcile",
    "/api/orders/receipts/close",
    "/api/orders/audit/verify",
)

CAD_UPSTREAM_ROUTES = {
    "/api/cad/recompute": "/v1/recompute",
    "/api/cad/import": "/v1/exchange",
    "/api/cad/export": "/v1/exchange",
}


class CadAdapterError(ValueError):
    def __init__(self, code: str, message: str, status: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _candidate02_error(code: str, message: str, *, domain: str = "candidate-0.2") -> dict[str, Any]:
    return {
        "schema_version": "caddydaddy.service-error/1",
        "status": "BLOCKED",
        "domain": domain,
        "diagnostic": {"code": code, "message": message},
    }


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Candidate02Routes:
    """Mount Candidate 0.2 adapters on the dependency-light HTTP runtime.

    The committed modules expose optional FastAPI router factories, but this
    product service intentionally remains a BaseHTTPRequestHandler deployment.
    Their exact route declarations are mounted here against the same adapters;
    no second implementation of classification, sourcing, or provenance exists.
    """

    def __init__(
        self,
        candidate_identity: Mapping[str, str],
        *,
        classification_action: Callable[[Any], tuple[int, dict[str, Any]]] | None = None,
        sourcing_runtime: Any | None = None,
        provenance_runtime: Any | None = None,
        order_runtime: Any | None = None,
        cad_output_runtime: Any | None = None,
        cad_transport: Callable[[str, dict[str, Any]], tuple[int, dict[str, Any]]] | None = None,
        cad_service_url: str | None = None,
    ) -> None:
        required = {"candidate_id", "revision_id", "snapshot_sha256"}
        if set(candidate_identity) != required or not all(isinstance(candidate_identity[key], str) and candidate_identity[key] for key in required):
            raise ValueError("CANDIDATE_IDENTITY_INVALID")
        self.candidate_identity = dict(candidate_identity)
        self.cad_service_url = (cad_service_url if cad_service_url is not None else os.environ.get("CADDYDADDY_CAD_SERVICE_URL", "")).rstrip("/")
        self._cad_transport = cad_transport or self._http_cad_transport
        unavailable: dict[str, str] = {}
        default_inline_order_runtime = False

        if classification_action is None:
            try:
                from .classification_api import ClassificationAdapter

                classification_action = ClassificationAdapter().classify
            except Exception:
                unavailable["/api/classification"] = "Classification adapter is unavailable in this product-service artifact."
        if sourcing_runtime is None:
            try:
                from .sourcing_api import SourcingRuntime

                sourcing_runtime = SourcingRuntime(self.candidate_identity)
            except Exception:
                unavailable["/api/sourcing"] = "Sourcing adapter is unavailable in this product-service artifact."
        if provenance_runtime is None:
            try:
                from .provenance_api import ProvenanceRuntime

                provenance_runtime = ProvenanceRuntime(self.candidate_identity)
            except Exception:
                unavailable["/api/provenance"] = "Provenance adapter is unavailable in this product-service artifact."
        if cad_output_runtime is None:
            try:
                from .cad_output_api import CadOutputRuntime

                cad_output_runtime = CadOutputRuntime()
            except Exception:
                unavailable["/api/cad/outputs"] = "CAD-output adapter is unavailable in this product-service artifact."
        if order_runtime is None:
            package_root = os.environ.get("CADDYDADDY_ORDER_PACKAGE_ROOT")
            try:
                from .order_api import OrderApiRuntime

                order_runtime = OrderApiRuntime(Path(package_root) if package_root else None, {
                    "candidate_id": self.candidate_identity["candidate_id"],
                    "revision": self.candidate_identity["revision_id"],
                    "artifact_sha256": self.candidate_identity["snapshot_sha256"],
                })
                default_inline_order_runtime = package_root is None
            except Exception:
                if package_root:
                    unavailable["/api/orders"] = "Recording-only order adapter could not verify its configured package root."
                else:
                    unavailable["/api/orders"] = "Recording-only inline order adapter is unavailable in this product-service artifact."

        def order_action(name: str) -> Callable[[Any], tuple[int, dict[str, Any]]]:
            action = getattr(order_runtime, name, None)
            if action is None:
                return self._unavailable(unavailable.get("/api/orders", "Recording-only order adapter is unavailable."), "orders")
            if not default_inline_order_runtime:
                return action

            def invoke(payload: Any) -> tuple[int, dict[str, Any]]:
                if payload == {}:
                    return self._unavailable(
                        "Inline recording-only order routes require a sealed client-carried payload.",
                        "orders",
                    )(payload)
                return action(payload)

            return invoke

        self._actions: dict[str, Callable[[Any], tuple[int, dict[str, Any]]]] = {
            "/api/classification": classification_action or self._unavailable(unavailable["/api/classification"], "classification"),
            "/api/sourcing/rounds": getattr(sourcing_runtime, "create_round", self._unavailable(unavailable.get("/api/sourcing", "Sourcing adapter is unavailable."), "sourcing")),
            "/api/sourcing/adjudications": getattr(sourcing_runtime, "adjudicate_offer", self._unavailable(unavailable.get("/api/sourcing", "Sourcing adapter is unavailable."), "sourcing")),
            "/api/sourcing/selections": getattr(sourcing_runtime, "select_offer", self._unavailable(unavailable.get("/api/sourcing", "Sourcing adapter is unavailable."), "sourcing")),
            "/api/sourcing/packages": getattr(sourcing_runtime, "build_package", self._unavailable(unavailable.get("/api/sourcing", "Sourcing adapter is unavailable."), "sourcing")),
            "/api/sourcing/dispatches": getattr(sourcing_runtime, "stage_dispatch", self._unavailable(unavailable.get("/api/sourcing", "Sourcing adapter is unavailable."), "sourcing")),
            "/api/provenance/inspect": getattr(provenance_runtime, "inspect_source", self._unavailable(unavailable.get("/api/provenance", "Provenance adapter is unavailable."), "provenance")),
            "/api/provenance/verify": getattr(provenance_runtime, "verify_span", self._unavailable(unavailable.get("/api/provenance", "Provenance adapter is unavailable."), "provenance")),
            "/api/provenance/accept": getattr(provenance_runtime, "accept_verified_change", self._unavailable(unavailable.get("/api/provenance", "Provenance adapter is unavailable."), "provenance")),
            "/api/cad/recompute": self._cad_recompute,
            "/api/cad/import": self._cad_import,
            "/api/cad/export": self._cad_export,
            "/api/cad/outputs/native/seal": getattr(cad_output_runtime, "seal_native", self._unavailable(unavailable.get("/api/cad/outputs", "CAD-output adapter is unavailable."), "cad-output")),
            "/api/cad/outputs/native/load": getattr(cad_output_runtime, "load_native", self._unavailable(unavailable.get("/api/cad/outputs", "CAD-output adapter is unavailable."), "cad-output")),
            "/api/cad/outputs/generate": getattr(cad_output_runtime, "generate", self._unavailable(unavailable.get("/api/cad/outputs", "CAD-output adapter is unavailable."), "cad-output")),
            "/api/orders/packages/validate": order_action("validate_package"),
            "/api/orders/dispatches": order_action("dispatch_recording"),
            "/api/orders/receipts/read": order_action("read_receipt"),
            "/api/orders/receipts/acknowledge": order_action("acknowledge"),
            "/api/orders/receipts/reconcile": order_action("reconcile_unknown"),
            "/api/orders/receipts/close": order_action("close"),
            "/api/orders/audit/verify": order_action("verify_audit"),
        }

    @classmethod
    def from_runtime(cls, runtime: CandidateRuntime) -> "Candidate02Routes":
        public = runtime.candidate()
        release = public.get("releaseIdentity", {})
        return cls({
            "candidate_id": str(release.get("candidateId", RELEASE_CANDIDATE_ID)),
            "revision_id": str(release.get("revisionId", RELEASE_REVISION_ID)),
            "snapshot_sha256": str(release.get("snapshotSha256", runtime.state.snapshot_receipt["document_sha256"])),
        })

    @property
    def post_paths(self) -> frozenset[str]:
        return frozenset(self._actions)

    @staticmethod
    def _unavailable(message: str, domain: str) -> Callable[[Any], tuple[int, dict[str, Any]]]:
        return lambda _payload: (503, _candidate02_error("ADAPTER_UNAVAILABLE", message, domain=domain))

    def dispatch(self, path: str, payload: Any) -> tuple[int, dict[str, Any]]:
        action = self._actions.get(path)
        if action is None:
            return 404, _candidate02_error("ROUTE_NOT_FOUND", "Candidate 0.2 route does not exist.")
        try:
            return action(payload)
        except CadAdapterError as error:
            return error.status, _candidate02_error(error.code, error.message, domain="cad")
        except Exception:
            return 500, _candidate02_error("ROUTE_EXECUTION_FAILED", "The service adapter failed closed without returning a result.")

    def _http_cad_transport(self, path: str, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        if not self.cad_service_url:
            return 503, _candidate02_error(
                "CAD_SERVICE_NOT_CONFIGURED",
                "Set CADDYDADDY_CAD_SERVICE_URL on the product service to the separately deployed OpenCascade service base URL.",
                domain="cad",
            )
        parsed = urlsplit(self.cad_service_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            return 503, _candidate02_error("CAD_SERVICE_URL_INVALID", "CADDYDADDY_CAD_SERVICE_URL must be an HTTP(S) origin or base path without credentials, query, or fragment.", domain="cad")
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        if len(body) > MAX_CAD_REQUEST_BODY_BYTES:
            return 413, _candidate02_error("CAD_REQUEST_TOO_LARGE", "The encoded CAD request exceeded the bounded proxy limit.", domain="cad")
        request = Request(
            f"{self.cad_service_url}{path}",
            data=body,
            method="POST",
            headers={"Accept": "application/json", "Content-Type": "application/json", "Content-Length": str(len(body))},
        )
        try:
            response = urlopen(request, timeout=30)
            status = response.status
            raw = response.read(MAX_CAD_RESPONSE_BODY_BYTES + 1)
        except HTTPError as error:
            status = error.code
            raw = error.read(MAX_CAD_RESPONSE_BODY_BYTES + 1)
        except (URLError, TimeoutError, OSError):
            return 502, _candidate02_error("CAD_SERVICE_UNREACHABLE", "The configured CAD service could not be reached; the browser must preserve its last valid revision.", domain="cad")
        if len(raw) > MAX_CAD_RESPONSE_BODY_BYTES:
            return 502, _candidate02_error("CAD_RESPONSE_TOO_LARGE", "The CAD service response exceeded the bounded proxy limit.", domain="cad")
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return 502, _candidate02_error("CAD_RESPONSE_INVALID", "The CAD service returned a non-JSON response.", domain="cad")
        if not isinstance(decoded, dict):
            return 502, _candidate02_error("CAD_RESPONSE_INVALID", "The CAD service returned a non-object response.", domain="cad")
        return status, decoded

    def _cad_recompute(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not isinstance(request, Mapping) or not isinstance(request.get("document"), Mapping) or not isinstance(request.get("operation"), Mapping):
            raise CadAdapterError("CAD_REQUEST_INVALID", "Recompute requires document, operation, and expectedRevisionId.", 400)
        expected = request.get("expectedRevisionId")
        document = deepcopy(dict(request["document"]))
        operation = dict(request["operation"])
        if not isinstance(expected, str) or document.get("revisionId") != expected:
            raise CadAdapterError("CAD_STALE", "The submitted document does not match expectedRevisionId.", 409)
        if str(operation.get("kind", "")).startswith("assembly."):
            return self._cad_assembly(document, expected)

        candidate = self._kernel_document(document, expected)
        upstream: dict[str, Any] = {"candidate_document": candidate}
        if expected != "revision:new":
            continuation = self._cad_continuation(document, expected, require_base=True)
            upstream.update({"base_document": continuation["base_document"], "expected_base_revision_id": expected})
        elif document.get("kernelState") is not None:
            raise CadAdapterError("CAD_STATE_UNEXPECTED", "A new document cannot carry a prior kernel continuation.", 409)
        status, body = self._cad_transport(CAD_UPSTREAM_ROUTES["/api/cad/recompute"], upstream)
        if not 200 <= status < 300:
            return status, body
        response = self._frontend_recompute(document, body)
        revision = response["revisionId"]
        artifacts = {
            str(item["body_id"]): str(item["brep_base64"])
            for item in body.get("bodies", [])
            if isinstance(item, Mapping) and isinstance(item.get("body_id"), str) and isinstance(item.get("brep_base64"), str)
        }
        response["document"]["kernelState"] = self._seal_cad_continuation(revision, candidate, artifacts)
        return 200, response

    def _cad_import(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not isinstance(request, Mapping):
            raise CadAdapterError("CAD_IMPORT_INVALID", "Import request must be an object.", 400)
        format_name = str(request.get("format", "")).upper()
        file_name = request.get("fileName")
        content = request.get("dataBase64")
        expected = request.get("expectedRevisionId")
        if format_name not in {"STEP", "IGES", "STL"} or not all(isinstance(value, str) and value for value in (file_name, content, expected)):
            raise CadAdapterError("CAD_IMPORT_INVALID", "Import requires STEP, IGES, or STL bytes plus file and revision identity.", 400)
        status, body = self._cad_transport(CAD_UPSTREAM_ROUTES["/api/cad/import"], {
            "request_id": f"import:{hashlib.sha256(content.encode('ascii', errors='ignore')).hexdigest()}",
            "direction": "IMPORT",
            "format": format_name,
            "content_base64": content,
        })
        if not 200 <= status < 300:
            return status, body
        required = ("content_sha256", "bounds_mm", "diagnostics")
        if not isinstance(body, Mapping) or any(key not in body for key in required):
            raise CadAdapterError("CAD_RESPONSE_INVALID", "CAD import response omitted verified exchange evidence.", 502)
        revision = f"cad-import:{body['content_sha256']}"
        body_id = f"body:import:{str(body['content_sha256'])[:16]}"
        browser_document = {
            "schemaVersion": "caddydaddy.cad-document/1",
            "id": f"document:import:{str(body['content_sha256'])[:16]}",
            "name": file_name,
            "revisionId": revision,
            "units": {"length": "mm", "angle": "deg"},
            "parameters": [],
            "sketches": [],
            "operations": [],
            "bodies": [{"id": body_id, "name": file_name, "featureIds": [], "material": None, "visible": True, "state": "valid"}],
            "assembly": {"instances": [], "mates": []},
        }
        mesh = self._bounds_mesh(body.get("bounds_mm"), body_id, revision)
        diagnostics = self._frontend_diagnostics(body.get("diagnostics", []))
        diagnostics.append({"id": "cad:import-preview", "severity": "warning", "code": "IMPORT_PREVIEW_BOUNDS_PROXY", "message": "The semantic preview is a verified-bounds proxy; exchange succeeded in OCCT but exact tessellation was not returned by the exchange endpoint.", "operationId": None, "entityIds": [body_id]})
        brep = body.get("brep_base64")
        browser_document["kernelState"] = self._seal_cad_continuation(
            revision,
            None,
            {body_id: brep} if isinstance(brep, str) and brep else {},
        )
        return 200, {
            "document": browser_document,
            "revisionId": revision,
            "documentHash": body["content_sha256"],
            "dependencyGraph": self._dependency_graph(browser_document),
            "mesh": mesh,
            "diagnostics": diagnostics,
            "kernel": {"name": "OpenCascade", "version": "7.9.3", "mode": "live", "computedAt": _iso_now(), "artifactHash": body["content_sha256"]},
        }

    def _cad_export(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not isinstance(request, Mapping) or not isinstance(request.get("document"), Mapping):
            raise CadAdapterError("CAD_EXPORT_INVALID", "Export requires a current document.", 400)
        revision = request.get("revisionId")
        format_name = str(request.get("format", "")).upper()
        document = request["document"]
        if not isinstance(revision, str) or document.get("revisionId") != revision or format_name not in {"STEP", "IGES", "STL"}:
            raise CadAdapterError("CAD_EXPORT_INVALID", "Export format and revision must match the current document.", 400)
        artifacts = self._cad_continuation(document, revision, require_base=False)["body_artifacts"]
        if len(artifacts) != 1:
            raise CadAdapterError("CAD_EXPORT_BODY_SELECTION_REQUIRED", "Candidate 0.2 exports exactly one revision-bound body; zero-body and multi-body export need an explicit body or assembly selection.", 422)
        body_id, brep = next(iter(artifacts.items()))
        status, body = self._cad_transport(CAD_UPSTREAM_ROUTES["/api/cad/export"], {
            "request_id": f"export:{revision}:{body_id}:{format_name}",
            "direction": "EXPORT",
            "format": format_name,
            "content_base64": brep,
            "source_revision_id": revision,
        })
        if not 200 <= status < 300:
            return status, body
        data = body.get("content_base64") if isinstance(body, Mapping) else None
        content_hash = body.get("content_sha256") if isinstance(body, Mapping) else None
        if not isinstance(data, str) or not isinstance(content_hash, str):
            raise CadAdapterError("CAD_RESPONSE_INVALID", "CAD export response omitted verified artifact bytes.", 502)
        extension = {"STEP": "step", "IGES": "iges", "STL": "stl"}[format_name]
        mime = {"STEP": "model/step", "IGES": "model/iges", "STL": "model/stl"}[format_name]
        stem = re.sub(r"[^A-Za-z0-9._-]+", "-", str(document.get("name", "caddydaddy"))).strip("-.") or "caddydaddy"
        return 200, {"fileName": f"{stem}.{extension}", "format": format_name, "mimeType": mime, "dataBase64": data, "revisionId": revision, "documentHash": content_hash}

    def _cad_assembly(self, document: dict[str, Any], expected: str) -> tuple[int, dict[str, Any]]:
        continuation = self._cad_continuation(document, expected, require_base=False)
        artifacts = continuation["body_artifacts"]
        assembly = document.get("assembly")
        if not isinstance(assembly, Mapping) or not isinstance(assembly.get("instances"), list) or not assembly["instances"]:
            raise CadAdapterError("CAD_ASSEMBLY_INVALID", "Assembly solve requires at least one instance.", 422)
        instances = []
        for instance in assembly["instances"]:
            body_id = instance.get("bodyId") if isinstance(instance, Mapping) else None
            brep = artifacts.get(body_id)
            rotation = instance.get("transform", {}).get("rotationDegrees", []) if isinstance(instance, Mapping) else []
            translation = instance.get("transform", {}).get("translation", []) if isinstance(instance, Mapping) else []
            if not isinstance(brep, str) or len(rotation) != 3 or len(translation) != 3 or any(abs(float(value)) > 1e-9 for value in rotation[:2]):
                raise CadAdapterError("CAD_ASSEMBLY_INPUT_UNAVAILABLE", "Every instance needs a current body B-rep; Candidate 0.2 supports translation plus Z-axis rotation.", 422)
            instances.append({"instance_id": instance["id"], "body_id": body_id, "source_revision_id": expected, "brep_base64": brep, "transform": {"translation": {"x": translation[0], "y": translation[1], "z": translation[2]}, "rotation_axis": {"z": 1}, "rotation_degrees": rotation[2]}})
        mate_kinds = {"fixed": "FIXED", "coincident": "POINT_COINCIDENT", "concentric": "AXIS_CONCENTRIC_PREALIGNED", "distance": "DISTANCE"}
        mates = []
        for mate in assembly.get("mates", []):
            kind = mate_kinds.get(mate.get("kind")) if isinstance(mate, Mapping) else None
            if kind is None:
                raise CadAdapterError("CAD_MATE_UNSUPPORTED", "Candidate 0.2 does not adapt angle mates to the bounded OCCT solver.", 422)
            mates.append({"mate_id": mate["id"], "kind": kind, "moving_instance_id": mate["instanceBId"], "target_instance_id": mate["instanceAId"], "distance_mm": mate.get("offset", 0)})
        status, body = self._cad_transport("/v1/assemblies/solve", {"assembly_id": document.get("id", "assembly:candidate-0.2"), "instances": instances, "mates": mates})
        if not 200 <= status < 300:
            return status, body
        assembly_body = body.get("assembly_body") if isinstance(body, Mapping) else None
        revision = body.get("assembly_revision_id") if isinstance(body, Mapping) else None
        geometry_hash = body.get("geometry_hash") if isinstance(body, Mapping) else None
        if not isinstance(assembly_body, Mapping) or not isinstance(revision, str) or not isinstance(geometry_hash, str):
            raise CadAdapterError("CAD_RESPONSE_INVALID", "Assembly service response omitted revision-bound geometry.", 502)
        document["revisionId"] = revision
        assembly_brep = assembly_body.get("brep_base64")
        assembly_body_id = assembly_body.get("body_id")
        next_artifacts = (
            {str(assembly_body_id): str(assembly_brep)}
            if isinstance(assembly_body_id, str) and isinstance(assembly_brep, str)
            else dict(artifacts)
        )
        document["kernelState"] = self._seal_cad_continuation(revision, None, next_artifacts)
        return 200, {
            "document": document,
            "revisionId": revision,
            "documentHash": geometry_hash,
            "dependencyGraph": self._dependency_graph(document),
            "mesh": self._mesh_from_bodies([assembly_body], revision),
            "diagnostics": self._frontend_diagnostics(body.get("diagnostics", [])),
            "kernel": {"name": "OpenCascade", "version": "7.9.3", "mode": "live", "computedAt": _iso_now(), "artifactHash": geometry_hash},
        }

    @staticmethod
    def _seal_cad_continuation(
        revision: str,
        base_document: Mapping[str, Any] | None,
        body_artifacts: Mapping[str, str],
    ) -> dict[str, Any]:
        state: dict[str, Any] = {
            "schema_version": CAD_CLIENT_STATE_SCHEMA,
            "revision_id": revision,
            "base_document": deepcopy(dict(base_document)) if base_document is not None else None,
            "body_artifacts": dict(sorted(body_artifacts.items())),
        }
        state["state_sha256"] = hashlib.sha256(
            json.dumps(state, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        return state

    @staticmethod
    def _cad_continuation(
        document: Mapping[str, Any],
        expected_revision: str,
        *,
        require_base: bool,
    ) -> dict[str, Any]:
        raw = document.get("kernelState")
        if not isinstance(raw, Mapping):
            raise CadAdapterError("CAD_STATE_REQUIRED", "This operation requires the hash-sealed kernel continuation returned with the current document.", 409)
        state = deepcopy(dict(raw))
        supplied_hash = state.pop("state_sha256", None)
        computed_hash = hashlib.sha256(
            json.dumps(state, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        if not isinstance(supplied_hash, str) or not _HEX64.fullmatch(supplied_hash) or supplied_hash != computed_hash:
            raise CadAdapterError("CAD_STATE_TAMPERED", "The client-carried kernel continuation failed SHA-256 verification.", 409)
        artifacts = state.get("body_artifacts")
        base_document = state.get("base_document")
        if (
            state.get("schema_version") != CAD_CLIENT_STATE_SCHEMA
            or state.get("revision_id") != expected_revision
            or document.get("revisionId") != expected_revision
            or not isinstance(artifacts, Mapping)
            or any(not isinstance(key, str) or not isinstance(value, str) for key, value in artifacts.items())
            or (base_document is not None and not isinstance(base_document, Mapping))
        ):
            raise CadAdapterError("CAD_STATE_INVALID", "The kernel continuation does not match the submitted revision.", 409)
        if require_base and not isinstance(base_document, Mapping):
            raise CadAdapterError("CAD_BASE_STATE_REQUIRED", "This imported or assembly-only revision cannot be used as a parametric recompute base.", 409)
        return {
            **state,
            "state_sha256": supplied_hash,
            "body_artifacts": dict(artifacts),
            "base_document": deepcopy(dict(base_document)) if isinstance(base_document, Mapping) else None,
        }

    def _kernel_document(self, document: Mapping[str, Any], expected: str) -> dict[str, Any]:
        if document.get("schemaVersion") != "caddydaddy.cad-document/1" or document.get("units") != {"length": "mm", "angle": "deg"}:
            raise CadAdapterError("CAD_DOCUMENT_UNSUPPORTED", "Candidate 0.2 live kernel accepts the browser CAD document in millimetres and degrees.")
        sketches = document.get("sketches")
        operations = document.get("operations")
        if not isinstance(sketches, list) or not isinstance(operations, list):
            raise CadAdapterError("CAD_DOCUMENT_INVALID", "CAD document omitted sketches or operations.", 400)
        kernel_sketches = [self._kernel_sketch(sketch) for sketch in sketches]
        sketch_features: dict[str, str] = {}
        entity_sketch: dict[str, str] = {}
        for sketch in sketches:
            if isinstance(sketch, Mapping):
                for entity in sketch.get("entities", []):
                    if isinstance(entity, Mapping) and isinstance(entity.get("id"), str):
                        entity_sketch[entity["id"]] = str(sketch.get("id"))
        for operation in operations:
            if isinstance(operation, Mapping) and operation.get("kind") == "sketch.create":
                sketch = operation.get("sketch", {})
                if isinstance(sketch, Mapping) and isinstance(sketch.get("id"), str):
                    sketch_features[sketch["id"]] = str(operation.get("id"))
        bodies = document.get("bodies", [])
        body_for_feature = {
            str(feature_id): str(body.get("id"))
            for body in bodies if isinstance(body, Mapping)
            for feature_id in body.get("featureIds", [])
        }
        body_producer: dict[str, str] = {}
        features: list[dict[str, Any]] = []
        known_features: set[str] = set()

        def dependency(reference: Any) -> str | None:
            ref = str(reference)
            if ref in known_features:
                return ref
            if ref in sketch_features:
                return sketch_features[ref]
            if ref in entity_sketch:
                return sketch_features.get(entity_sketch[ref])
            return body_producer.get(ref)

        for operation in operations:
            if not isinstance(operation, Mapping) or not isinstance(operation.get("id"), str):
                raise CadAdapterError("CAD_OPERATION_INVALID", "Every CAD operation requires a stable ID.", 400)
            operation_id = operation["id"]
            kind = operation.get("kind")
            if kind == "sketch.create":
                sketch_id = operation.get("sketch", {}).get("id") if isinstance(operation.get("sketch"), Mapping) else None
                if not isinstance(sketch_id, str):
                    raise CadAdapterError("CAD_SKETCH_INVALID", "Sketch operation omitted its sketch identity.")
                feature = {"feature_id": operation_id, "kind": "SKETCH", "depends_on": [], "parameters": {"sketch_id": sketch_id}, "enabled": not bool(operation.get("suppressed"))}
            elif kind in {"parameter.set", "assembly.instance.add", "assembly.mate.add"}:
                continue
            elif isinstance(kind, str) and kind.startswith("feature."):
                refs = [*operation.get("inputIds", []), *operation.get("targetBodyIds", [])]
                dependencies = [item for item in dict.fromkeys(dependency(ref) for ref in refs) if item]
                output_body = body_for_feature.get(operation_id) or (operation.get("targetBodyIds") or [None])[0] or f"body:{operation_id}"
                raw = operation.get("parameters", {})
                if not isinstance(raw, Mapping):
                    raise CadAdapterError("CAD_FEATURE_PARAMETERS_INVALID", "Feature parameters must be an object.")
                number = next((float(value) for value in raw.values() if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))), 1.0)
                if kind in {"feature.extrude", "feature.revolve"}:
                    source = next((dependency(ref) for ref in operation.get("inputIds", []) if dependency(ref) in sketch_features.values()), None)
                    source = source or next(reversed(sketch_features.values()), None)
                    if source is None:
                        raise CadAdapterError("CAD_SKETCH_REFERENCE_MISSING", f"{kind} requires a committed sketch reference.")
                    kernel_kind = "EXTRUDE" if kind == "feature.extrude" else "REVOLVE"
                    parameters = {"sketch_feature_id": source, "distance_mm": number, "direction": {"z": 1}} if kernel_kind == "EXTRUDE" else {"sketch_feature_id": source, "angle_degrees": number, "axis_direction": {"y": 1}}
                    dependencies = list(dict.fromkeys([*dependencies, source]))
                elif kind.startswith("feature.boolean."):
                    targets = [str(ref) for ref in refs if str(ref) in body_producer or any(str(body.get("id")) == str(ref) for body in bodies if isinstance(body, Mapping))]
                    if len(targets) < 2:
                        raise CadAdapterError("CAD_BOOLEAN_INPUT_MISSING", "Boolean operations require two body references.")
                    kernel_kind = "BOOLEAN"
                    parameters = {"left_body_id": targets[0], "right_body_id": targets[1], "mode": {"feature.boolean.union": "UNION", "feature.boolean.subtract": "CUT", "feature.boolean.intersect": "INTERSECT"}[kind]}
                else:
                    targets = [str(ref) for ref in operation.get("targetBodyIds", []) if isinstance(ref, str)]
                    if not targets:
                        targets = [str(ref) for ref in operation.get("inputIds", []) if str(ref) in body_producer]
                    if not targets:
                        raise CadAdapterError("CAD_BODY_REFERENCE_MISSING", f"{kind} requires a current target body.")
                    target = targets[0]
                    if kind == "feature.hole":
                        kernel_kind = "HOLE"
                        parameters = {"target_body_id": target, "diameter_mm": max(number * 2, 0.001), "depth_mm": max(float(raw.get("depth", number * 2)), 0.001), "center": {"x": 0, "y": 0, "z": 0}, "direction": {"z": 1}}
                    elif kind == "feature.fillet":
                        kernel_kind = "FILLET"
                        parameters = {"target_body_id": target, "radius_mm": number, "edge_selector": "EDGE_INDICES", "edge_indices": [0]}
                    elif kind == "feature.chamfer":
                        kernel_kind = "CHAMFER"
                        parameters = {"target_body_id": target, "distance_mm": number, "edge_selector": "EDGE_INDICES", "edge_indices": [0]}
                    else:
                        raise CadAdapterError("CAD_FEATURE_UNSUPPORTED", f"Candidate 0.2 adapter does not support {kind}.")
                    producer = body_producer.get(target)
                    if producer:
                        dependencies = list(dict.fromkeys([*dependencies, producer]))
                feature = {"feature_id": operation_id, "kind": kernel_kind, "depends_on": dependencies, "output_body_id": output_body, "parameters": parameters, "enabled": not bool(operation.get("suppressed"))}
                body_producer[str(output_body)] = operation_id
            else:
                raise CadAdapterError("CAD_OPERATION_UNSUPPORTED", f"Candidate 0.2 adapter does not support {kind}.")
            features.append(feature)
            known_features.add(operation_id)
        if not features:
            raise CadAdapterError("CAD_EMPTY_FEATURE_GRAPH", "Commit a sketch or feature before requesting live kernel recompute.")
        parameters = document.get("parameters", [])
        return {
            "schema_version": "caddydaddy.cad-document/1",
            "document_id": document.get("id"),
            "parent_revision_id": None if expected == "revision:new" else expected,
            "units": "mm",
            "sketches": kernel_sketches,
            "features": features,
            "metadata": {"browser_name": str(document.get("name", "Untitled assembly")), "parameters_json": json.dumps(parameters, sort_keys=True, separators=(",", ":"))},
        }

    @staticmethod
    def _kernel_sketch(sketch: Any) -> dict[str, Any]:
        if not isinstance(sketch, Mapping) or not isinstance(sketch.get("id"), str):
            raise CadAdapterError("CAD_SKETCH_INVALID", "Every sketch requires a stable ID.")
        plane = sketch.get("plane")
        if not isinstance(plane, Mapping) or plane.get("kind") != "origin" or plane.get("plane") not in {"XY", "XZ", "YZ"}:
            raise CadAdapterError("CAD_SKETCH_PLANE_UNSUPPORTED", "Candidate 0.2 live recompute supports XY, XZ, and YZ origin planes; face attachment needs topological naming.")
        entities: list[dict[str, Any]] = []
        for entity in sketch.get("entities", []):
            if not isinstance(entity, Mapping) or not isinstance(entity.get("id"), str):
                raise CadAdapterError("CAD_SKETCH_ENTITY_INVALID", "Sketch entities require stable IDs.")
            entity_id = entity["id"]
            kind = entity.get("kind")
            if kind == "line":
                entities.append({"kind": "LINE", "entity_id": entity_id, "start": entity.get("start"), "end": entity.get("end")})
            elif kind == "circle":
                entities.append({"kind": "CIRCLE", "entity_id": entity_id, "center": entity.get("center"), "radius": entity.get("radius")})
            elif kind == "rectangle":
                origin = entity.get("origin", {})
                x, y = float(origin.get("x", 0)), float(origin.get("y", 0))
                width, height = float(entity.get("width", 0)), float(entity.get("height", 0))
                points = ((x, y), (x + width, y), (x + width, y + height), (x, y + height))
                for index, (start, end) in enumerate(zip(points, points[1:] + points[:1])):
                    entities.append({"kind": "LINE", "entity_id": f"{entity_id}:edge:{index}", "start": {"x": start[0], "y": start[1]}, "end": {"x": end[0], "y": end[1]}})
            elif kind == "arc":
                center = entity.get("center", {})
                radius = float(entity.get("radius", 0))
                angles = [math.radians(float(entity.get("startAngle", 0))), math.radians((float(entity.get("startAngle", 0)) + float(entity.get("endAngle", 0))) / 2), math.radians(float(entity.get("endAngle", 0)))]
                points = [{"x": float(center.get("x", 0)) + radius * math.cos(angle), "y": float(center.get("y", 0)) + radius * math.sin(angle)} for angle in angles]
                entities.append({"kind": "ARC", "entity_id": entity_id, "start": points[0], "mid": points[1], "end": points[2]})
            elif kind == "spline":
                points = entity.get("points", [])
                if not isinstance(points, list) or len(points) < 2:
                    raise CadAdapterError("CAD_SPLINE_INVALID", "A spline needs at least two points.")
                pairs = list(zip(points, points[1:]))
                if entity.get("closed"):
                    pairs.append((points[-1], points[0]))
                for index, (start, end) in enumerate(pairs):
                    entities.append({"kind": "LINE", "entity_id": f"{entity_id}:segment:{index}", "start": start, "end": end})
            else:
                raise CadAdapterError("CAD_SKETCH_ENTITY_UNSUPPORTED", f"Candidate 0.2 adapter does not support sketch entity {kind}.")
        if not entities:
            raise CadAdapterError("CAD_SKETCH_EMPTY", "A live sketch requires geometry.")
        constraints = []
        constraint_kinds = {"horizontal": "HORIZONTAL", "vertical": "VERTICAL", "parallel": "PARALLEL", "perpendicular": "PERPENDICULAR", "equal": "EQUAL_LENGTH", "fixed": "FIXED", "coincident": "COINCIDENT"}
        for item in sketch.get("constraints", []):
            kind = constraint_kinds.get(item.get("kind")) if isinstance(item, Mapping) else None
            if kind is None:
                raise CadAdapterError("CAD_CONSTRAINT_UNSUPPORTED", f"Candidate 0.2 kernel does not solve {item.get('kind') if isinstance(item, Mapping) else 'unknown'} constraints.")
            entity_ids = [str(value) for value in item.get("entityIds", [])]
            record: dict[str, Any] = {"constraint_id": item.get("id"), "kind": kind, "entity_ids": entity_ids}
            if kind == "COINCIDENT" and len(entity_ids) >= 2:
                record.update({"entity_ids": [], "point_refs": [f"{entity_ids[0]}.end", f"{entity_ids[1]}.start"]})
            constraints.append(record)
        dimension_kinds = {"distance": "DISTANCE", "horizontal-distance": "DISTANCE", "vertical-distance": "DISTANCE", "radius": "RADIUS", "diameter": "RADIUS", "angle": "ANGLE"}
        for item in sketch.get("dimensions", []):
            if not isinstance(item, Mapping) or item.get("kind") not in dimension_kinds:
                raise CadAdapterError("CAD_DIMENSION_UNSUPPORTED", "Sketch dimension is not supported by Candidate 0.2.")
            value = float(item.get("value", 0)) / 2 if item.get("kind") == "diameter" else float(item.get("value", 0))
            constraints.append({"constraint_id": item.get("id"), "kind": dimension_kinds[item["kind"]], "entity_ids": item.get("entityIds", []), "value": value})
        return {"sketch_id": sketch["id"], "plane": plane["plane"], "loops": [{"loop_id": f"{sketch['id']}:loop:0", "entities": entities}], "constraints": constraints}

    def _frontend_recompute(self, document: dict[str, Any], body: Mapping[str, Any]) -> dict[str, Any]:
        revision = body.get("revision_id")
        document_hash = body.get("document_hash")
        geometry_hash = body.get("geometry_hash")
        kernel_bodies = body.get("bodies")
        if not isinstance(revision, str) or not isinstance(document_hash, str) or not isinstance(geometry_hash, str) or not isinstance(kernel_bodies, list):
            raise CadAdapterError("CAD_RESPONSE_INVALID", "CAD recompute response omitted revision, hash, or bodies.", 502)
        document["revisionId"] = revision
        browser_bodies = document.setdefault("bodies", [])
        known = {item.get("id"): item for item in browser_bodies if isinstance(item, dict)}
        for kernel_body in kernel_bodies:
            if not isinstance(kernel_body, Mapping) or not isinstance(kernel_body.get("body_id"), str):
                raise CadAdapterError("CAD_RESPONSE_INVALID", "CAD recompute returned a malformed body.", 502)
            body_id = kernel_body["body_id"]
            if body_id in known:
                known[body_id]["state"] = "valid"
            else:
                browser_bodies.append({"id": body_id, "name": body_id, "featureIds": [kernel_body.get("producing_feature_id")], "material": None, "visible": True, "state": "valid"})
        kernel = body.get("kernel", {})
        return {
            "document": document,
            "revisionId": revision,
            "documentHash": document_hash,
            "dependencyGraph": self._dependency_graph(document),
            "mesh": self._mesh_from_bodies(kernel_bodies, revision),
            "diagnostics": self._frontend_diagnostics(body.get("diagnostics", [])),
            "kernel": {"name": str(kernel.get("name", "OpenCascade")), "version": str(kernel.get("version", "unknown")), "mode": "live", "computedAt": _iso_now(), "artifactHash": geometry_hash},
        }

    @staticmethod
    def _dependency_graph(document: Mapping[str, Any]) -> dict[str, Any]:
        nodes = []
        for key, kind in (("sketches", "sketch"), ("operations", "feature"), ("bodies", "body"), ("parameters", "parameter")):
            for item in document.get(key, []):
                if isinstance(item, Mapping) and isinstance(item.get("id"), str):
                    nodes.append({"id": item["id"], "label": str(item.get("name", item["id"])), "kind": kind, "state": "suppressed" if item.get("suppressed") else "clean"})
        assembly = document.get("assembly", {})
        for key, kind in (("instances", "instance"), ("mates", "mate")):
            for item in assembly.get(key, []) if isinstance(assembly, Mapping) else []:
                if isinstance(item, Mapping) and isinstance(item.get("id"), str):
                    nodes.append({"id": item["id"], "label": str(item.get("name", item["id"])), "kind": kind, "state": "clean"})
        node_ids = {node["id"] for node in nodes}
        edges = []
        for operation in document.get("operations", []):
            if isinstance(operation, Mapping) and operation.get("id") in node_ids:
                edges.extend({"from": str(ref), "to": operation["id"], "relation": "depends-on"} for ref in operation.get("dependsOn", []) if str(ref) in node_ids)
        return {"nodes": nodes, "edges": edges}

    @staticmethod
    def _frontend_diagnostics(diagnostics: Any) -> list[dict[str, Any]]:
        if not isinstance(diagnostics, list):
            return []
        return [{"id": f"cad:diagnostic:{index}", "severity": str(item.get("severity", "WARNING")).lower(), "code": str(item.get("code", "CAD_DIAGNOSTIC")), "message": str(item.get("message", "CAD service diagnostic")), "operationId": item.get("feature_id"), "entityIds": []} for index, item in enumerate(diagnostics) if isinstance(item, Mapping)]

    @staticmethod
    def _mesh_from_bodies(bodies: list[Any], revision: str) -> dict[str, Any]:
        vertices: list[list[float]] = []
        triangles: list[list[int]] = []
        groups = []
        colors = ("#477a68", "#b07543", "#436c91", "#86704f")
        for body_index, body in enumerate(bodies):
            if not isinstance(body, Mapping) or not isinstance(body.get("mesh"), Mapping):
                continue
            mesh = body["mesh"]
            positions = mesh.get("positions", [])
            indices = mesh.get("indices", [])
            offset = len(vertices)
            start = len(triangles)
            vertices.extend([list(map(float, positions[index:index + 3])) for index in range(0, len(positions), 3) if len(positions[index:index + 3]) == 3])
            triangles.extend([[int(indices[index]) + offset, int(indices[index + 1]) + offset, int(indices[index + 2]) + offset] for index in range(0, len(indices), 3) if len(indices[index:index + 3]) == 3])
            groups.append({"bodyId": str(body.get("body_id", f"body:{body_index}")), "startTriangle": start, "triangleCount": len(triangles) - start, "color": colors[body_index % len(colors)]})
        return {"revisionId": revision, "vertices": vertices, "triangles": triangles, "groups": groups}

    @staticmethod
    def _bounds_mesh(bounds: Any, body_id: str, revision: str) -> dict[str, Any]:
        if not isinstance(bounds, list) or len(bounds) != 6:
            raise CadAdapterError("CAD_RESPONSE_INVALID", "CAD import response omitted six-value bounds.", 502)
        x0, y0, z0, x1, y1, z1 = map(float, bounds)
        vertices = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
        triangles = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]]
        return {"revisionId": revision, "vertices": vertices, "triangles": triangles, "groups": [{"bodyId": body_id, "startTriangle": 0, "triangleCount": len(triangles), "color": "#477a68"}]}


def create_handler(
    runtime: CandidateRuntime | None = None,
    static_root: Path | None = None,
    candidate02_routes: Candidate02Routes | None = None,
) -> type[BaseHTTPRequestHandler]:
    """Bind the product runtime to one reusable local/Vercel HTTP handler."""

    active_runtime = runtime or CandidateRuntime()
    active_candidate02 = candidate02_routes or Candidate02Routes.from_runtime(active_runtime)
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
            if path in active_candidate02.post_paths:
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
            if len(content) > MAX_RESPONSE_BODY_BYTES:
                self._json(502, _candidate02_error("RESPONSE_BODY_TOO_LARGE", "The static response exceeds the provider body limit.", domain="transport"))
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
            if path != "/api/compliance-at-design-click" and path not in active_candidate02.post_paths:
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
            request_limit = MAX_CAD_REQUEST_BODY_BYTES if path.startswith("/api/cad/") else MAX_REQUEST_BODY_BYTES
            if length > request_limit:
                self._json(*CandidateRuntime._blocked(413, "REQUEST_BODY_TOO_LARGE", f"The JSON request exceeds {request_limit} bytes."))
                return
            try:
                body = self.rfile.read(length)
                if len(body) != length:
                    raise ValueError
                request = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
                self._json(*CandidateRuntime._blocked(400, "REQUEST_BODY_INVALID", "A bounded JSON request is required."))
                return
            if path == "/api/compliance-at-design-click":
                self._json(*active_runtime.evaluate_request(request))
            else:
                self._json(*active_candidate02.dispatch(path, request))

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
            if len(content) > MAX_RESPONSE_BODY_BYTES:
                status = 502
                content = json.dumps(
                    _candidate02_error("RESPONSE_BODY_TOO_LARGE", "The JSON response exceeds the provider body limit.", domain="transport"),
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
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
    parser = argparse.ArgumentParser(description="Serve local CADdyDaddy Candidate 0.2")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args(argv)
    server = create_server(args.host, args.port)
    print(f"CADdyDaddy Candidate 0.2 listening at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0
