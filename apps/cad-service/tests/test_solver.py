from __future__ import annotations

import math

import pytest
from OCP.gp import gp_Trsf

from cad_service.models import AssemblyRequest, Sketch
from cad_service.solver import AssemblySolveError, SketchSolveError, solve_assembly_mates, solve_sketch


def test_bounded_solver_drives_horizontal_distance_and_reports_dof() -> None:
    sketch = Sketch.model_validate({
        "sketch_id": "sketch:line",
        "plane": "XY",
        "loops": [{"loop_id": "open:test", "entities": [{"kind": "LINE", "entity_id": "line:a", "start": {"x": 0, "y": 0}, "end": {"x": 8, "y": 3}}]}],
        "constraints": [
            {"constraint_id": "horizontal", "kind": "HORIZONTAL", "entity_ids": ["line:a"]},
            {"constraint_id": "length", "kind": "DISTANCE", "point_refs": ["line:a.start", "line:a.end"], "value": 10},
        ],
    })
    solved, report = solve_sketch(sketch)
    line = solved.loops[0].entities[0]
    assert line.start.y == pytest.approx(line.end.y, abs=1e-6)
    assert math.dist((line.start.x, line.start.y), (line.end.x, line.end.y)) == pytest.approx(10, abs=1e-6)
    assert report.status == "UNDER_CONSTRAINED"
    assert report.degrees_of_freedom > 0
    assert all(item.satisfied for item in report.residuals)


def test_parallel_perpendicular_equal_angle_and_radius_are_solved() -> None:
    sketch = Sketch.model_validate({
        "sketch_id": "sketch:mixed",
        "plane": "XY",
        "loops": [
            {"loop_id": "lines", "entities": [
                {"kind": "LINE", "entity_id": "line:a", "start": {"x": 0, "y": 0}, "end": {"x": 4, "y": 0}},
                {"kind": "LINE", "entity_id": "line:b", "start": {"x": 10, "y": 2}, "end": {"x": 13, "y": 3}},
                {"kind": "LINE", "entity_id": "line:c", "start": {"x": 20, "y": 0}, "end": {"x": 21, "y": 3}},
            ]},
            {"loop_id": "circle", "entities": [{"kind": "CIRCLE", "entity_id": "circle:a", "center": {"x": 30, "y": 0}, "radius": 2}]},
        ],
        "constraints": [
            {"constraint_id": "fixed-a", "kind": "FIXED", "entity_ids": ["line:a"]},
            {"constraint_id": "parallel", "kind": "PARALLEL", "entity_ids": ["line:a", "line:b"]},
            {"constraint_id": "equal", "kind": "EQUAL", "entity_ids": ["line:a", "line:b"]},
            {"constraint_id": "perpendicular", "kind": "PERPENDICULAR", "entity_ids": ["line:a", "line:c"]},
            {"constraint_id": "angle", "kind": "ANGLE", "entity_ids": ["line:a", "line:c"], "value": 90},
            {"constraint_id": "radius", "kind": "RADIUS", "entity_ids": ["circle:a"], "value": 5},
        ],
    })
    solved, report = solve_sketch(sketch)
    entities = {item.entity_id: item for loop in solved.loops for item in loop.entities}
    assert entities["circle:a"].radius == pytest.approx(5, abs=1e-6)
    assert math.hypot(entities["line:b"].end.x - entities["line:b"].start.x, entities["line:b"].end.y - entities["line:b"].start.y) == pytest.approx(4, abs=1e-6)
    assert all(item.satisfied for item in report.residuals)


def test_conflicting_constraints_fail_honestly() -> None:
    sketch = Sketch.model_validate({
        "sketch_id": "sketch:conflict",
        "plane": "XY",
        "loops": [{"loop_id": "circle", "entities": [{"kind": "CIRCLE", "entity_id": "circle:a", "center": {"x": 0, "y": 0}, "radius": 2}]}],
        "constraints": [
            {"constraint_id": "radius:five", "kind": "RADIUS", "entity_ids": ["circle:a"], "value": 5},
            {"constraint_id": "radius:eight", "kind": "RADIUS", "entity_ids": ["circle:a"], "value": 8},
        ],
    })
    with pytest.raises(SketchSolveError) as caught:
        solve_sketch(sketch)
    assert caught.value.report is not None
    assert caught.value.report.status == "OVER_CONSTRAINED"
    assert any(not item.satisfied for item in caught.value.report.residuals)


def _assembly(mates: list[dict]) -> AssemblyRequest:
    return AssemblyRequest.model_validate({
        "assembly_id": "assembly:solver",
        "instances": [
            {"instance_id": "fixed", "body_id": "body:a", "source_revision_id": "rev:a", "brep_base64": "eA=="},
            {"instance_id": "moving", "body_id": "body:b", "source_revision_id": "rev:b", "brep_base64": "eA==", "transform": {"translation": {"x": 10}}},
        ],
        "mates": mates,
    })


def test_rigid_axis_mate_rotates_and_translates_deterministically() -> None:
    request = _assembly([{"mate_id": "axis", "kind": "AXIS_CONCENTRIC", "moving_instance_id": "moving", "target_instance_id": "fixed", "moving_axis": {"x": 1}, "target_axis": {"z": 1}, "target_point": {"z": 4}}])
    transforms, reports, diagnostics = solve_assembly_mates(request, {"fixed": gp_Trsf(), "moving": gp_Trsf()})
    assert reports[0].satisfied
    assert reports[0].linear_residual_mm <= 1e-6
    assert reports[0].angular_residual_deg <= 1e-5
    assert transforms["moving"].Value(3, 4) == pytest.approx(4, abs=1e-6)
    assert any(item.code == "ASSEMBLY_UNDERCONSTRAINED" for item in diagnostics)


def test_conflicting_rigid_mates_report_structured_failure() -> None:
    request = _assembly([
        {"mate_id": "point:a", "kind": "POINT_COINCIDENT", "moving_instance_id": "moving", "target_instance_id": "fixed", "target_point": {"x": 1}},
        {"mate_id": "point:b", "kind": "POINT_COINCIDENT", "moving_instance_id": "moving", "target_instance_id": "fixed", "target_point": {"x": 2}},
    ])
    with pytest.raises(AssemblySolveError) as caught:
        solve_assembly_mates(request, {"fixed": gp_Trsf(), "moving": gp_Trsf()})
    assert caught.value.code == "MATE_CONFLICT"
    assert "point:a" in str(caught.value)
