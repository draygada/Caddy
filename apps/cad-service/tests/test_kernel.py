from __future__ import annotations

import copy

import pytest

from cad_service.kernel import CadError, assemble, exchange, recompute
from cad_service.models import AssemblyRequest, ExchangeRequest, RecomputeRequest


def rectangle(sketch_id: str, x: float, y: float, width: float, height: float) -> dict:
    points = [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    entities = []
    for index in range(4):
        start, end = points[index], points[(index + 1) % 4]
        entities.append({"entity_id": f"{sketch_id}:line:{index}", "kind": "LINE", "start": {"x": start[0], "y": start[1]}, "end": {"x": end[0], "y": end[1]}})
    return {
        "sketch_id": sketch_id,
        "plane": "XY",
        "loops": [{"loop_id": f"{sketch_id}:outer", "entities": entities}],
        "constraints": [
            {"constraint_id": f"{sketch_id}:horizontal", "kind": "HORIZONTAL", "entity_ids": [entities[0]["entity_id"]]},
            {"constraint_id": f"{sketch_id}:vertical", "kind": "VERTICAL", "entity_ids": [entities[1]["entity_id"]]},
            {"constraint_id": f"{sketch_id}:coincident", "kind": "COINCIDENT", "point_refs": [f"{entities[0]['entity_id']}.end", f"{entities[1]['entity_id']}.start"]},
        ],
    }


def base_document() -> dict:
    return {
        "document_id": "part:synthetic-bracket",
        "sketches": [rectangle("sketch:plate", 0, 0, 40, 25)],
        "features": [
            {"feature_id": "feature:sketch", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:plate"}},
            {"feature_id": "feature:extrude", "kind": "EXTRUDE", "depends_on": ["feature:sketch"], "output_body_id": "body:plate", "parameters": {"sketch_feature_id": "feature:sketch", "distance_mm": 8, "direction": {"z": 1}}},
            {"feature_id": "feature:hole", "kind": "HOLE", "depends_on": ["feature:extrude"], "output_body_id": "body:plate", "parameters": {"target_body_id": "body:plate", "center": {"x": 20, "y": 12.5, "z": 0}, "direction": {"z": 1}, "diameter_mm": 6, "depth_mm": 8}},
        ],
    }


def test_real_sketch_extrude_hole_and_live_recompute_with_stale_rejection() -> None:
    document = base_document()
    first = recompute(RecomputeRequest(candidate_document=document))
    assert first.status == "SUCCEEDED"
    assert first.kernel["name"] == "OpenCascade"
    assert first.bodies[0].valid
    assert first.bodies[0].topology["solids"] == 1
    assert first.bodies[0].mesh.triangle_count > 0
    edited = copy.deepcopy(document)
    edited["parent_revision_id"] = first.revision_id
    edited["features"][1]["parameters"]["distance_mm"] = 12
    second = recompute(RecomputeRequest(base_document=document, expected_base_revision_id=first.revision_id, candidate_document=edited))
    assert second.revision_id != first.revision_id
    assert second.geometry_hash != first.geometry_hash
    assert second.bodies[0].bounds_mm[5] == pytest.approx(12)
    with pytest.raises(CadError, match="Expected base") as caught:
        recompute(RecomputeRequest(base_document=document, expected_base_revision_id="cad-rev:" + "0" * 64, candidate_document=edited))
    assert caught.value.diagnostic.code == "STALE_BASE_REVISION"


def test_multibody_transform_boolean_fillet_and_chamfer_execute_in_occt() -> None:
    document = {
        "document_id": "part:multi-body",
        "sketches": [rectangle("sketch:a", 0, 0, 10, 10), rectangle("sketch:b", 5, 0, 10, 10)],
        "features": [
            {"feature_id": "sketch:a", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:a"}},
            {"feature_id": "extrude:a", "kind": "EXTRUDE", "depends_on": ["sketch:a"], "output_body_id": "body:a", "parameters": {"sketch_feature_id": "sketch:a", "distance_mm": 10}},
            {"feature_id": "fillet:a", "kind": "FILLET", "depends_on": ["extrude:a"], "output_body_id": "body:a-fillet", "parameters": {"target_body_id": "body:a", "radius_mm": 1, "edge_selector": "EDGE_INDICES", "edge_indices": [0]}},
            {"feature_id": "sketch:b", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:b"}},
            {"feature_id": "extrude:b", "kind": "EXTRUDE", "depends_on": ["sketch:b"], "output_body_id": "body:b", "parameters": {"sketch_feature_id": "sketch:b", "distance_mm": 10}},
            {"feature_id": "chamfer:b", "kind": "CHAMFER", "depends_on": ["extrude:b"], "output_body_id": "body:b-chamfer", "parameters": {"target_body_id": "body:b", "distance_mm": 1, "edge_selector": "EDGE_INDICES", "edge_indices": [0]}},
            {"feature_id": "union", "kind": "BOOLEAN", "depends_on": ["fillet:a", "chamfer:b"], "output_body_id": "body:union", "parameters": {"left_body_id": "body:a-fillet", "right_body_id": "body:b-chamfer", "mode": "UNION"}},
            {"feature_id": "move", "kind": "TRANSFORM", "depends_on": ["union"], "output_body_id": "body:moved", "parameters": {"target_body_id": "body:union", "transform": {"translation": {"x": 30}, "rotation_axis": {"z": 1}, "rotation_degrees": 15}}},
        ],
    }
    result = recompute(RecomputeRequest(candidate_document=document))
    assert {"body:a", "body:a-fillet", "body:b", "body:b-chamfer", "body:union", "body:moved"} <= {body.body_id for body in result.bodies}
    assert result.operation_status["move"] == "SUCCEEDED"


def test_revolve_and_unsupported_feature_are_explicit() -> None:
    document = {
        "document_id": "part:revolved",
        "sketches": [rectangle("sketch:section", 5, -2, 5, 4)],
        "features": [
            {"feature_id": "sketch", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:section"}},
            {"feature_id": "revolve", "kind": "REVOLVE", "depends_on": ["sketch"], "output_body_id": "body:ring", "parameters": {"sketch_feature_id": "sketch", "angle_degrees": 360, "axis_direction": {"y": 1}}},
        ],
    }
    result = recompute(RecomputeRequest(candidate_document=document))
    assert result.bodies[0].volume_mm3 > 0
    document["features"].append({"feature_id": "loft", "kind": "LOFT", "depends_on": ["revolve"], "output_body_id": "body:loft"})
    with pytest.raises(CadError) as caught:
        recompute(RecomputeRequest(candidate_document=document))
    assert caught.value.diagnostic.code == "FEATURE_KIND_UNSUPPORTED"


def test_real_step_iges_stl_roundtrips_and_assembly_mate() -> None:
    part = recompute(RecomputeRequest(candidate_document=base_document()))
    body = part.bodies[0]
    for format_name in ("STEP", "IGES", "STL"):
        exported = exchange(ExchangeRequest(request_id=f"export:{format_name}", direction="EXPORT", format=format_name, content_base64=body.brep_base64, source_revision_id=part.revision_id))
        assert exported.status == "SUCCEEDED"
        assert exported.content_sha256
        imported = exchange(ExchangeRequest(request_id=f"import:{format_name}", direction="IMPORT", format=format_name, content_base64=exported.content_base64))
        assert imported.bounds_mm == pytest.approx(body.bounds_mm, abs=0.25)
        assert imported.editable_brep is (format_name != "STL")
    assembly = assemble(AssemblyRequest(
        assembly_id="assembly:pair",
        instances=[
            {"instance_id": "instance:fixed", "body_id": body.body_id, "source_revision_id": part.revision_id, "brep_base64": body.brep_base64},
            {"instance_id": "instance:moving", "body_id": body.body_id, "source_revision_id": part.revision_id, "brep_base64": body.brep_base64, "transform": {"translation": {"x": 60}}},
        ],
        mates=[{"mate_id": "mate:point", "kind": "POINT_COINCIDENT", "moving_instance_id": "instance:moving", "target_instance_id": "instance:fixed", "moving_point": {"x": 0}, "target_point": {"x": 50}}],
    ))
    assert assembly.status == "SUCCEEDED"
    moving = next(item for item in assembly.instances if item.instance_id == "instance:moving")
    assert moving.world_matrix4x4_row_major[3] == pytest.approx(50)
    assert assembly.assembly_body.topology["solids"] == 2


def test_unsatisfied_constraint_and_native_exchange_fail_closed() -> None:
    document = base_document()
    document["sketches"][0]["constraints"][0]["kind"] = "VERTICAL"
    with pytest.raises(CadError) as caught:
        recompute(RecomputeRequest(candidate_document=document))
    assert caught.value.diagnostic.code == "CONSTRAINT_UNSATISFIED"
    with pytest.raises(CadError) as caught:
        exchange(ExchangeRequest(request_id="native", direction="IMPORT", format="SLDASM", content_base64="eA=="))
    assert caught.value.diagnostic.code == "EXCHANGE_FORMAT_UNSUPPORTED"
