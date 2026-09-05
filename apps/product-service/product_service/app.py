"""Core-kernel to browser to Tripwire integration for local Candidate 0.1."""

from __future__ import annotations

import argparse
from copy import deepcopy
from dataclasses import dataclass
from fractions import Fraction
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import platform
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
from strafe_forge_core.assembly import AssemblyEngine, AssemblyProgram, Component, FixedTransform, PartDefinition
from strafe_forge_core.engine import EngineManifest, RecomputeEngine
from strafe_forge_core.ocp_operations import ocp_registry
from strafe_forge_core.program import PartProgram, ProgramOperation
from strafe_forge_core.viewport import tessellate_part

from . import REPOSITORY_ROOT

CANDIDATE_TIME = "2026-09-05T20:00:00Z"
TRIPWIRE_SOURCE_COMMIT = "898f6167e4305a4f86f3ebe4a473278ffbd56530"
PRODUCT_THREAD_ID = "product-thread:caddydaddy-demo-01"
BOUNDED_CLAIM = "CADdyDaddy combines one bounded browser CAD workflow with a dated, review-only compliance-at-design-click evaluation on the same immutable product revision."
POSITIONING = "We're closing the loop from idea to execution for high-stakes industries."
REQUEST_KEYS = {"entity_id", "node_id", "product_thread_id", "forge_record_id", "occurrence_path", "forge_record_revision_id", "forge_revision_id"}
MAX_REQUEST_BODY_BYTES = 65536
_LOCKED_RUNTIME_PROVENANCE: tuple[dict[str, str], ...] = (
    {
        "system": "Darwin",
        "machine": "arm64",
        "python_tag": "cp312",
        "wheel_filename": "cadquery_ocp_novtk-7.9.3.1-cp312-cp312-macosx_11_0_arm64.whl",
        "wheel_platform": "macosx_11_0_arm64",
        "wheel_sha256": "a070f99039e877e9558759570fd379365e2d28de3850b62e33c9c48e5ac1f0e3",
    },
    {
        "system": "Linux",
        "machine": "x86_64",
        "python_tag": "cp312",
        "wheel_filename": "cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl",
        "wheel_platform": "manylinux_2_31_x86_64",
        "wheel_sha256": "8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b",
    },
)
_LOCKED_RUNTIME_PROVENANCE_SHA256 = "5913aa949b3979b6c93e3df4e0228acdb63633e0c5dbefdcb37f64242fcd44ff"


def _literal(parameter_id: str, value: str) -> dict[str, object]:
    return {"parameter_id": parameter_id, "name": parameter_id.removeprefix("param:"), "value_type": "LENGTH", "literal": value, "expression": None}


def _runtime_provenance_lock_sha256(records: tuple[Mapping[str, str], ...]) -> str:
    encoded = json.dumps(records, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _runtime_provenance(
    *,
    system_name: str | None = None,
    machine: str | None = None,
    python_implementation: str | None = None,
    python_version: str | None = None,
) -> dict[str, str]:
    if _runtime_provenance_lock_sha256(_LOCKED_RUNTIME_PROVENANCE) != _LOCKED_RUNTIME_PROVENANCE_SHA256:
        raise RuntimeError("RUNTIME_PROVENANCE_LOCK_TAMPERED")
    active_system = platform.system() if system_name is None else system_name
    active_machine = platform.machine() if machine is None else machine
    active_implementation = platform.python_implementation() if python_implementation is None else python_implementation
    active_version = platform.python_version() if python_version is None else python_version
    version_parts = active_version.split(".")
    if active_implementation != "CPython" or len(version_parts) < 2 or not all(part.isdigit() for part in version_parts[:2]):
        raise RuntimeError(
            f"RUNTIME_PROVENANCE_UNSUPPORTED:{active_implementation}:{active_system}:{active_machine}:{active_version}"
        )
    python_tag = f"cp{version_parts[0]}{version_parts[1]}"
    matches = [
        record
        for record in _LOCKED_RUNTIME_PROVENANCE
        if (record["system"], record["machine"], record["python_tag"])
        == (active_system, active_machine, python_tag)
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"RUNTIME_PROVENANCE_UNSUPPORTED:{active_implementation}:{active_system}:{active_machine}:{active_version}"
        )
    return {**matches[0], "python_version": active_version}


def _manifest() -> EngineManifest:
    provenance = _runtime_provenance()
    return EngineManifest(
        adapter="strafe-ocp@0.1.0",
        binding=(
            "cadquery-ocp-novtk@7.9.3.1"
            f";wheel={provenance['wheel_filename']}"
            f";wheel-sha256={provenance['wheel_sha256']}"
            ";source=d69b064a3a604ebf245b1f3b14fb54c835a3a571"
            ";lock=packages/core-kernel/uv.lock"
        ),
        kernel="OCCT@7.9.3;source=a016080bf6738d6aeae020badee4e888ad1540a5",
        solver="NONE:not-adopted",
        toolchain=f"CPython@{provenance['python_version']};dependency-lock=uv@0.11.17",
        platform_image=(
            f"{provenance['system']}@{provenance['machine']}"
            f";python={provenance['python_tag']}"
            f";wheel-platform={provenance['wheel_platform']}"
        ),
        tolerances={"linear_mm": "0.000001", "angular_deg": "0.000001"},
        deterministic_settings={"parallel": False, "boolean_fuzzy_mm": "0.0000001", "brep_format": 4, "binary64_rounding": "nearest-ties-even"},
    )


@dataclass(slots=True)
class CandidateState:
    public: dict[str, Any]
    revision: dict[str, Any]
    bindings: dict[str, dict[str, Any]]
    records: dict[str, dict[str, Any]]
    integrity_hash: str

    def preimage(self) -> dict[str, Any]:
        return {"public": self.public, "revision": self.revision, "bindings": self.bindings, "records": self.records}


def build_candidate_state() -> CandidateState:
    parameters = {"param:length": _literal("param:length", "24"), "param:width": _literal("param:width", "12"), "param:height": _literal("param:height", "4")}
    operation = ProgramOperation("op:bracket-stock", "primitive.box", 1, (), {"length": "param:length", "width": "param:width", "height": "param:height"}, (), {}, True)
    program = PartProgram("part:public-demo-bracket", "revision:public-demo-bracket-01", {"length": "mm", "angle": "deg"}, parameters, (operation,), {})
    manifest = _manifest()
    part = RecomputeEngine(ocp_registry(), manifest).recompute(program)
    if part.status != "SUCCEEDED" or part.current_artifact is None:
        raise RuntimeError("CORE_RECOMPUTE_FAILED")
    definition = PartDefinition.from_recompute("definition:public-demo-bracket", part, metadata={"description": "synthetic public demo bracket"}, material_id="material:public-demo-aluminum")
    assembly_program = AssemblyProgram(
        "assembly:caddydaddy-demo-01",
        "revision:caddydaddy-candidate-0.1",
        {definition.definition_id: definition},
        (
            Component("component:bracket-left", definition.definition_id, None, FixedTransform(), True, "bom:public-demo-bracket", {"label": "Left bracket"}),
            Component("component:bracket-right", definition.definition_id, None, FixedTransform((Fraction(36), Fraction(0), Fraction(0))), True, "bom:public-demo-bracket", {"label": "Right bracket"}),
        ),
    )
    assembly = AssemblyEngine(manifest).evaluate(assembly_program)
    if assembly.status != "SUCCEEDED" or assembly.current_artifact is None:
        raise RuntimeError("CORE_ASSEMBLY_FAILED")
    viewport = tessellate_part(part).as_dict()
    revision = {"revision_id": assembly.attempted_revision_id, "content_hash": assembly.geometry_hash, "recompute_state": "SUCCEEDED", "geometry_artifact_hash": assembly.current_artifact.content_hash}
    bindings: dict[str, dict[str, Any]] = {}
    records: dict[str, dict[str, Any]] = {}
    nodes = []
    bodies = []
    colors = ("#7895a1", "#ad805c")
    for index, component in enumerate(assembly.components):
        scoped_ranges = []
        for core_range in viewport["entity_ranges"]:
            if core_range["count"] % 3 or core_range["start"] % 3:
                raise RuntimeError("CORE_VIEWPORT_RANGE_INVALID")
            entity_id = "entity:" + canonical_sha256({"component_id": component.component_id, "core_entity_id": core_range["entity_id"]})
            semantic_id = "ref:" + canonical_sha256({"component_id": component.component_id, "core_reference_id": core_range["semantic_reference_id"]})
            record_id = "forge-record:" + canonical_sha256({"component_id": component.component_id, "entity_id": entity_id})
            occurrence_path = [assembly.assembly_id, component.component_id, entity_id]
            record_revision_id = "record-revision:" + canonical_sha256({"forge_revision_id": assembly.attempted_revision_id, "forge_record_id": record_id, "occurrence_path": occurrence_path})
            request = {"entity_id": entity_id, "node_id": component.component_id, "product_thread_id": PRODUCT_THREAD_ID, "forge_record_id": record_id, "occurrence_path": occurrence_path, "forge_record_revision_id": record_revision_id, "forge_revision_id": assembly.attempted_revision_id}
            bindings[entity_id] = {"request": request, "coreEntityId": core_range["entity_id"], "coreSemanticReferenceId": core_range["semantic_reference_id"]}
            records[record_id] = {
                "forge_record_revision_id": record_revision_id,
                "occurrence_path": occurrence_path,
                "tripwire_node_id": compute_node_id(PRODUCT_THREAD_ID, record_id, occurrence_path),
                "business_fields": {"mpn": "PUBLIC-DEMO-BRACKET-01", "vendor": "Synthetic public demo", "display_name": component.component_metadata["label"]},
                "measurements": [{"name": "length", "source_mm": "24", "projected_m": "0.024", "exact_factor": "0.001"}],
                "tripwire_payload": {"kind": "part", "mpn": "PUBLIC-DEMO-BRACKET-01", "vendor": "Synthetic public demo"},
            }
            scoped_ranges.append({"startTriangle": core_range["start"] // 3, "triangleCount": core_range["count"] // 3, "entityId": entity_id, "semanticReferenceId": semantic_id, "featureId": core_range["feature_id"]})
        transform = component.local_transform
        translation = [float(Fraction(int(item["numerator"]), int(item["denominator"]))) for item in transform["translation_mm"]]
        angle = float(Fraction(int(transform["rotation_angle_deg"]["numerator"]), int(transform["rotation_angle_deg"]["denominator"])))
        rotation = {"X": [angle, 0, 0], "Y": [0, angle, 0], "Z": [0, 0, angle]}[transform["rotation_axis"]]
        body_id = "body:" + canonical_sha256({"assembly_id": assembly.assembly_id, "component_id": component.component_id, "part_artifact_id": component.part_artifact_id})
        label = component.component_metadata["label"]
        nodes.append({
            "nodeId": component.component_id,
            "kind": "BODY",
            "label": label,
            "bodyId": body_id,
            "visible": True,
            "transform": {"translation": translation, "rotationDegrees": rotation, "scale": [1, 1, 1]},
            "mesh": {"positions": viewport["positions"], "normals": viewport["normals"], "indices": viewport["indices"], "entityRanges": scoped_ranges},
            "appearance": {"color": colors[index], "opacity": 1},
            "metadata": {"material": "Public demo aluminum", "mass": {"value": None, "unit": "kg", "evidence": "NOT_PROVIDED"}, "sourceDocumentId": assembly.assembly_id, "sourceRevisionId": assembly.attempted_revision_id, "corePartDocumentId": component.part_document_id, "corePartRevisionId": component.part_revision_id, "corePartArtifactId": component.part_artifact_id, "assemblyArtifactId": assembly.current_artifact.artifact_id, "sourceRecordHash": definition.source_record_hash},
        })
        bodies.append({"bodyId": body_id, "label": label, "material": "Public demo aluminum", "featureIds": [operation.operation_id]})
    document = {
        "kind": "PART",
        "label": "Public demo bracket pair",
        "documentId": assembly.assembly_id,
        "revisionId": assembly.attempted_revision_id,
        "units": {"length": "mm", "angle": "deg"},
        "scene": {"model": "forge.browser-render-scene/internal-1", "documentKind": "PART", "documentId": assembly.assembly_id, "revisionId": assembly.attempted_revision_id, "label": "Public demo bracket pair", "nodes": nodes},
        "parameters": [{"parameterId": key, "name": value["name"], "valueType": "LENGTH", "literal": value["literal"], "expression": None, "unit": "mm", "description": "Core-kernel input"} for key, value in parameters.items()],
        "operations": [{"operationId": operation.operation_id, "type": operation.type, "typeVersion": operation.type_version, "label": "Bracket stock", "dependsOn": [], "enabled": True, "payload": {}, "parameterBindings": dict(operation.parameter_bindings)}],
        "bodies": bodies,
        "complianceBindings": bindings,
    }
    current = {"key": "current", "recomputeStatus": "SUCCEEDED", "displayState": "CURRENT", "requestedRevisionId": assembly.attempted_revision_id, "displayedRevisionId": assembly.attempted_revision_id, "sourceArtifactId": assembly.current_artifact.artifact_id, "diagnostics": [], "operationStatus": {operation.operation_id: "SUCCEEDED"}, "adapterOnline": True, "editable": False}
    public = {
        "candidate": {"version": "0.1", "status": "LOCAL_CANDIDATE", "observedAt": CANDIDATE_TIME, "policyState": "DRAFT_REVIEW_ONLY", "claimCeiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION", "claim": BOUNDED_CLAIM, "positioning": POSITIONING},
        "productThreadId": PRODUCT_THREAD_ID,
        "adapterLabel": "Core kernel + Tripwire bridge",
        "evidenceCeiling": "DEMONSTRATED_LOCAL",
        "capabilities": {"authoring": False, "recompute": False, "import": False, "export": False, "complianceAtDesignClick": True},
        "forgeRevision": revision,
        "kernelProvenance": {"partResult": "forge.core-recompute-result/1", "assemblyResult": "forge.core-assembly-result/1", "viewportPacket": viewport["protocol_version"], "engineManifestHash": assembly.engine_manifest_hash, "binding": manifest.binding, "toolchain": manifest.toolchain, "platformImage": manifest.platform_image, "geometryArtifactId": assembly.current_artifact.artifact_id, "geometryArtifactHash": assembly.current_artifact.content_hash},
        "descriptors": [],
        "document": document,
        "states": {"current": current},
        "history": [{"sequence": 1, "revisionId": assembly.attempted_revision_id, "label": "Core candidate execution", "actor": "core-kernel", "disposition": "DEMONSTRATED_LOCAL", "time": "2026-09-05", "summary": "Fixed-transform demo projected for browser review"}],
    }
    state = CandidateState(public, revision, bindings, records, "")
    state.public["candidate"]["payloadHash"] = canonical_sha256(state.public)
    state.integrity_hash = canonical_sha256(state.preimage())
    return state


class CandidateRuntime:
    def __init__(self, state: CandidateState | None = None, bridge_evaluate: Callable[..., dict[str, Any]] | None = None) -> None:
        self.state = state or build_candidate_state()
        self.bridge_evaluate = bridge_evaluate or evaluate_compliance

    def candidate(self) -> dict[str, Any]:
        return deepcopy(self.state.public)

    def health(self) -> dict[str, Any]:
        return {"ok": True, "service": "caddydaddy-product-service", "candidate": "0.1", "status": "LOCAL_CANDIDATE", "policy_state": "DRAFT_REVIEW_ONLY"}

    def evaluate_request(self, request: Any) -> tuple[int, dict[str, Any]]:
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
        rules: list[dict] = []
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
                or observation["legal_effect"] != "NONE"
            ):
                raise ComplianceBridgeError("BINDING_MISMATCH", "Bound evidence does not match selection")
        except (ComplianceBridgeError, KeyError, TypeError) as error:
            code = error.code if isinstance(error, ComplianceBridgeError) else "BRIDGE_RESPONSE_INVALID"
            return self._blocked(502, code, "The evaluator response failed receipt validation.")
        return 200, {
            "status": "REVIEW_REQUIRED",
            "cleared": False,
            "policy_state": "DRAFT_REVIEW_ONLY",
            "human_review_requirement": "HUMAN_REVIEW_REQUIRED",
            "claim_ceiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION",
            "legal_effect": "NONE",
            "binding": {"request": deepcopy(request), "tripwire_node_id": record["tripwire_node_id"], "projection_ref": {"projection_id": compliance_input["projection_id"], "projection_hash": compliance_input["projection_hash"]}},
            "evidence": {"finding": deepcopy(findings[0]), "determination": deepcopy(result["evaluator_output"][record["tripwire_node_id"]])},
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
