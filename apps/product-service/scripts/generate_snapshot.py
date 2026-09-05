#!/usr/bin/env python3
"""Run the admitted local core once and emit an immutable runtime snapshot."""

from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import platform
import re
import sys
from typing import Any, Mapping

REPO = Path(__file__).resolve().parents[3]
for source_root in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "compliance-bridge",
    REPO / "packages" / "core-kernel" / "src",
):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)

from compliance_bridge import canonical_sha256, compute_node_id  # noqa: E402
from strafe_forge_core.assembly import (  # noqa: E402
    AssemblyEngine,
    AssemblyProgram,
    Component,
    FixedTransform,
    PartDefinition,
)
from strafe_forge_core.engine import EngineManifest, RecomputeEngine  # noqa: E402
from strafe_forge_core.ocp_operations import ocp_registry  # noqa: E402
from strafe_forge_core.program import PartProgram, ProgramOperation  # noqa: E402
from strafe_forge_core.viewport import tessellate_part  # noqa: E402

CANDIDATE_TIME = "2026-09-05T20:00:00Z"
TRIPWIRE_SOURCE_COMMIT = "898f6167e4305a4f86f3ebe4a473278ffbd56530"
TRIPWIRE_SOURCE_TREE = "b8f32adddb0c9a894a41d15ead89b4cb1db91aed"
PRODUCT_THREAD_ID = "product-thread:caddydaddy-demo-01"
BOUNDED_CLAIM = "CADdyDaddy binds a selected CAD entity to its immutable product revision and runs a review-readiness guardrail through Tripwire; Candidate 0.1 returns insufficient evidence and requires human review, not a compliance determination."
POSITIONING = "We're closing the loop from idea to execution for high-stakes industries."
SNAPSHOT_SCHEMA = "caddydaddy.core-snapshot/1"
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
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


def _runtime_provenance() -> dict[str, str]:
    if _runtime_provenance_lock_sha256(_LOCKED_RUNTIME_PROVENANCE) != _LOCKED_RUNTIME_PROVENANCE_SHA256:
        raise RuntimeError("RUNTIME_PROVENANCE_LOCK_TAMPERED")
    implementation = platform.python_implementation()
    version = platform.python_version()
    parts = version.split(".")
    if implementation != "CPython" or len(parts) < 2 or not all(part.isdigit() for part in parts[:2]):
        raise RuntimeError("RUNTIME_PROVENANCE_UNSUPPORTED")
    python_tag = f"cp{parts[0]}{parts[1]}"
    matches = [record for record in _LOCKED_RUNTIME_PROVENANCE if (record["system"], record["machine"], record["python_tag"]) == (platform.system(), platform.machine(), python_tag)]
    if len(matches) != 1:
        raise RuntimeError(f"RUNTIME_PROVENANCE_UNSUPPORTED:{implementation}:{platform.system()}:{platform.machine()}:{version}")
    return {**matches[0], "python_version": version}


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
        platform_image=(f"{provenance['system']}@{provenance['machine']};python={provenance['python_tag']};wheel-platform={provenance['wheel_platform']}"),
        tolerances={"linear_mm": "0.000001", "angular_deg": "0.000001"},
        deterministic_settings={"parallel": False, "boolean_fuzzy_mm": "0.0000001", "brep_format": 4, "binary64_rounding": "nearest-ties-even"},
    )


def _build_candidate_state(source_commit: str, source_tree: str) -> tuple[dict[str, Any], dict[str, Any]]:
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
    nodes: list[dict[str, Any]] = []
    bodies: list[dict[str, Any]] = []
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
                "tripwire_payload": {"kind": "part", "mpn": "PUBLIC-DEMO-BRACKET-01", "vendor": "Synthetic public demo", "material": "Public demo aluminum"},
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
        "parameters": [{"parameterId": key, "name": value["name"], "valueType": "LENGTH", "literal": value["literal"], "expression": None, "unit": "mm", "description": "Build-time core input"} for key, value in parameters.items()],
        "operations": [{"operationId": operation.operation_id, "type": operation.type, "typeVersion": operation.type_version, "label": "Bracket stock", "dependsOn": [], "enabled": True, "payload": {}, "parameterBindings": dict(operation.parameter_bindings)}],
        "bodies": bodies,
        "complianceBindings": bindings,
    }
    current = {"key": "current", "recomputeStatus": "SUCCEEDED", "displayState": "CURRENT", "requestedRevisionId": assembly.attempted_revision_id, "displayedRevisionId": assembly.attempted_revision_id, "sourceArtifactId": assembly.current_artifact.artifact_id, "diagnostics": [], "operationStatus": {operation.operation_id: "SUCCEEDED"}, "adapterOnline": True, "editable": False}
    public = {
        "candidate": {"version": "0.1", "status": "SNAPSHOT_CANDIDATE", "observedAt": CANDIDATE_TIME, "policyState": "DRAFT_REVIEW_ONLY", "claimCeiling": BOUNDED_CLAIM, "machineClaimCeiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION", "claim": BOUNDED_CLAIM, "positioning": POSITIONING, "positioningStatus": "DESIGN_INTENT_NOT_A_PRODUCT_CLAIM"},
        "productThreadId": PRODUCT_THREAD_ID,
        "adapterLabel": "Immutable core snapshot + Tripwire review-readiness bridge",
        "evidenceCeiling": "DEMONSTRATED_LOCAL_BUILD_SNAPSHOT",
        "capabilities": {"authoring": False, "recompute": False, "import": False, "export": False, "complianceAtDesignClick": True, "reviewReadinessGuardrail": True, "regulatoryClassification": False},
        "forgeRevision": revision,
        "snapshotProvenance": {"mode": "PRECOMPUTED_IMMUTABLE", "source": {"commit": source_commit, "tree": source_tree}, "coreExecutedAtRuntime": False},
        "kernelProvenance": {"partResult": "forge.core-recompute-result/1", "assemblyResult": "forge.core-assembly-result/1", "viewportPacket": viewport["protocol_version"], "engineManifestHash": assembly.engine_manifest_hash, "binding": manifest.binding, "kernel": manifest.kernel, "toolchain": manifest.toolchain, "platformImage": manifest.platform_image, "geometryArtifactId": assembly.current_artifact.artifact_id, "geometryArtifactHash": assembly.current_artifact.content_hash},
        "descriptors": [],
        "document": document,
        "states": {"current": current},
        "history": [{"sequence": 1, "revisionId": assembly.attempted_revision_id, "label": "Build-time core snapshot", "actor": "core-kernel", "disposition": "DEMONSTRATED_LOCAL", "time": "2026-09-05", "summary": "Immutable geometry snapshot projected for review; no deployed recompute"}],
    }
    public["candidate"]["payloadHash"] = canonical_sha256(public)
    preimage = {"public": public, "revision": revision, "bindings": bindings, "records": records}
    state = {**preimage, "integrity_hash": canonical_sha256(preimage)}
    core = {
        "execution_boundary": "BUILD_TIME_ONLY",
        "adapter": manifest.adapter,
        "binding": manifest.binding,
        "kernel": manifest.kernel,
        "solver": manifest.solver,
        "toolchain": manifest.toolchain,
        "platform_image": manifest.platform_image,
        "tolerances": dict(manifest.tolerances),
        "deterministic_settings": dict(manifest.deterministic_settings),
        "engine_manifest_sha256": assembly.engine_manifest_hash,
        "geometry_artifact_sha256": assembly.current_artifact.content_hash,
    }
    return state, core


def generate_snapshot(*, source_commit: str, source_tree: str, source_commit_tree: str, source_tree_state: str, build_command: str) -> dict[str, Any]:
    for value in (source_commit, source_tree, source_commit_tree):
        if _HEX40.fullmatch(value) is None:
            raise RuntimeError("SOURCE_IDENTITY_INVALID")
    if source_tree_state not in {"COMMITTED", "STAGED_CANDIDATE"} or not build_command:
        raise RuntimeError("SOURCE_IDENTITY_INVALID")
    state, core = _build_candidate_state(source_commit, source_tree)
    evaluator_path = REPO / "features" / "tripwire" / "backend" / "engine" / "evaluate.py"
    evaluator_sha256 = hashlib.sha256(evaluator_path.read_bytes()).hexdigest()
    rulepack_sha256 = canonical_sha256([])
    snapshot: dict[str, Any] = {
        "schema_version": SNAPSHOT_SCHEMA,
        "snapshot_hash": "",
        "source": {"commit": source_commit, "tree": source_tree, "commit_tree": source_commit_tree, "tree_state": source_tree_state},
        "generation": {"mode": "LOCAL_CORE_RECOMPUTE", "generator": "apps/product-service/scripts/generate_snapshot.py", "build_command": build_command},
        "core": core,
        "tripwire": {
            "evaluator": {"name": "Tripwire", "function": "evaluate", "path": "features/tripwire/backend/engine/evaluate.py", "source_commit": TRIPWIRE_SOURCE_COMMIT, "source_tree": TRIPWIRE_SOURCE_TREE, "sha256": evaluator_sha256},
            "rulepack": {"identity": "rules:synthetic-empty-draft-0.1", "state": "DRAFT_REVIEW_ONLY", "sha256": rulepack_sha256, "rule_count": 0},
        },
        "candidate_state": state,
    }
    snapshot["snapshot_hash"] = canonical_sha256({key: value for key, value in snapshot.items() if key != "snapshot_hash"})
    return snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--source-tree", required=True)
    parser.add_argument("--source-commit-tree", required=True)
    parser.add_argument("--source-tree-state", required=True)
    parser.add_argument("--build-command", required=True)
    args = parser.parse_args(argv)
    output = args.output.resolve()
    if output.exists():
        raise SystemExit("Snapshot output already exists; refusing to overwrite it.")
    output.parent.mkdir(parents=True, exist_ok=True)
    snapshot = generate_snapshot(
        source_commit=args.source_commit,
        source_tree=args.source_tree,
        source_commit_tree=args.source_commit_tree,
        source_tree_state=args.source_tree_state,
        build_command=args.build_command,
    )
    output.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"snapshot_hash": snapshot["snapshot_hash"], "file_sha256": hashlib.sha256(output.read_bytes()).hexdigest()}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
