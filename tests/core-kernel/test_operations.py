from __future__ import annotations

import math

from strafe_forge_core.program import PartProgram, ProgramOperation
from strafe_forge_core.topology import deserialize_brep, exact_bounds, mass_properties, topology_counts

from kernel_cases import engine, literal


def run_case(
    case_id: str,
    parameters: dict[str, dict[str, object]],
    operations: list[ProgramOperation],
    references: dict[str, dict[str, object]] | None = None,
):
    result = engine().recompute(
        PartProgram(
            f"part:{case_id}",
            f"rev:{case_id}",
            {"length": "mm", "angle": "deg"},
            parameters,
            tuple(operations),
            references or {},
        )
    )
    assert result.status == "SUCCEEDED", result.diagnostics
    assert result.current_artifact is not None
    return result, deserialize_brep(result.current_artifact.content)


def test_circle_profile_extrudes_to_real_cylinder() -> None:
    parameters = {
        "r": literal("r", "LENGTH", "5"),
        "d": literal("d", "LENGTH", "10"),
    }
    result, shape = run_case(
        "circle-extrude",
        parameters,
        [
            ProgramOperation("s", "sketch.circle", 1, (), {"radius": "r"}, (), {"plane": "XY", "centered": False}, True),
            ProgramOperation("e", "solid.extrude", 1, ("s",), {"distance": "d"}, (), {"direction": "XY"}, True),
        ],
    )
    assert topology_counts(shape)["SOLID"] == 1
    assert math.isclose(mass_properties(shape)[1], math.pi * 25 * 10, rel_tol=1e-9)


def test_cylinder_primitive_builds_real_exact_solid() -> None:
    parameters = {
        "r": literal("r", "LENGTH", "3"),
        "h": literal("h", "LENGTH", "7"),
    }
    _, shape = run_case(
        "cylinder",
        parameters,
        [
            ProgramOperation(
                "cylinder",
                "primitive.cylinder",
                1,
                (),
                {"radius": "r", "height": "h"},
                (),
                {},
                True,
            )
        ],
    )
    assert topology_counts(shape)["SOLID"] == 1
    assert math.isclose(mass_properties(shape)[1], math.pi * 9 * 7, rel_tol=1e-9)


def test_revolve_builds_exact_solid() -> None:
    parameters = {
        "length": literal("length", "LENGTH", "10"),
        "radius": literal("radius", "LENGTH", "5"),
        "angle": literal("angle", "ANGLE", "360"),
    }
    _, shape = run_case(
        "revolve",
        parameters,
        [
            ProgramOperation("s", "sketch.rectangle", 1, (), {"width": "length", "height": "radius"}, (), {"plane": "XZ", "centered": False}, True),
            ProgramOperation("r", "solid.revolve", 1, ("s",), {"angle": "angle"}, (), {"axis": "X"}, True),
        ],
    )
    assert math.isclose(mass_properties(shape)[1], math.pi * 25 * 10, rel_tol=1e-8)


def test_boolean_cut_and_transform_are_real_brep_operations() -> None:
    values = {
        "outer": ("LENGTH", "10"),
        "inner": ("LENGTH", "6"),
        "two": ("LENGTH", "2"),
        "zero": ("LENGTH", "0"),
    }
    parameters = {key: literal(key, *value) for key, value in values.items()}
    _, shape = run_case(
        "boolean-cut",
        parameters,
        [
            ProgramOperation("outer", "primitive.box", 1, (), {"length": "outer", "width": "outer", "height": "outer"}, (), {}, True),
            ProgramOperation("inner", "primitive.box", 1, (), {"length": "inner", "width": "inner", "height": "outer"}, (), {}, True),
            ProgramOperation("move", "transform.translate", 1, ("inner",), {"dx": "two", "dy": "two", "dz": "zero"}, (), {}, True),
            ProgramOperation("cut", "solid.boolean.cut", 1, ("outer", "move"), {}, (), {}, True),
        ],
    )
    assert math.isclose(mass_properties(shape)[1], 640, rel_tol=1e-9)
    assert topology_counts(shape)["FACE"] == 10


def test_boolean_union_and_intersection_are_real_brep_operations() -> None:
    values = {
        "size": ("LENGTH", "10"),
        "shift": ("LENGTH", "5"),
        "zero": ("LENGTH", "0"),
    }
    parameters = {key: literal(key, *value) for key, value in values.items()}
    prefix = [
        ProgramOperation(
            "left",
            "primitive.box",
            1,
            (),
            {"length": "size", "width": "size", "height": "size"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "right",
            "primitive.box",
            1,
            (),
            {"length": "size", "width": "size", "height": "size"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "move",
            "transform.translate",
            1,
            ("right",),
            {"dx": "shift", "dy": "zero", "dz": "zero"},
            (),
            {},
            True,
        ),
    ]
    _, union = run_case(
        "boolean-union",
        parameters,
        [
            *prefix,
            ProgramOperation(
                "boolean",
                "solid.boolean.union",
                1,
                ("left", "move"),
                {},
                (),
                {},
                True,
            ),
        ],
    )
    _, intersection = run_case(
        "boolean-intersection",
        parameters,
        [
            *prefix,
            ProgramOperation(
                "boolean",
                "solid.boolean.intersect",
                1,
                ("left", "move"),
                {},
                (),
                {},
                True,
            ),
        ],
    )
    assert math.isclose(mass_properties(union)[1], 1500, rel_tol=1e-9)
    assert math.isclose(mass_properties(intersection)[1], 500, rel_tol=1e-9)


def test_chamfer_and_fillet_are_distinct_real_operations() -> None:
    parameters = {
        "size": literal("size", "LENGTH", "10"),
        "treatment": literal("treatment", "LENGTH", "1"),
    }
    reference = {
        "edge": {
            "reference_id": "edge",
            "producer_operation_id": "box",
            "entity_kind": "EDGE",
            "semantic_role": "edge:z:x:min/y:min",
            "lineage": [],
            "expected_cardinality": "ONE",
        }
    }
    base = ProgramOperation("box", "primitive.box", 1, (), {"length": "size", "width": "size", "height": "size"}, (), {}, True)
    _, chamfer = run_case(
        "chamfer",
        parameters,
        [base, ProgramOperation("finish", "solid.chamfer", 1, ("box",), {"distance": "treatment"}, ("edge",), {}, True)],
        reference,
    )
    _, fillet = run_case(
        "fillet",
        parameters,
        [base, ProgramOperation("finish", "solid.fillet", 1, ("box",), {"radius": "treatment"}, ("edge",), {}, True)],
        reference,
    )
    assert 0 < mass_properties(chamfer)[1] < 1000
    assert 0 < mass_properties(fillet)[1] < 1000
    assert not math.isclose(mass_properties(chamfer)[1], mass_properties(fillet)[1])


def test_rotate_scale_and_linear_pattern() -> None:
    parameters = {
        "x": literal("x", "LENGTH", "2"),
        "y": literal("y", "LENGTH", "3"),
        "z": literal("z", "LENGTH", "4"),
        "angle": literal("angle", "ANGLE", "90"),
        "factor": literal("factor", "SCALAR", "2"),
        "count": literal("count", "INTEGER", "3"),
        "spacing": literal("spacing", "LENGTH", "10"),
    }
    result, shape = run_case(
        "pattern",
        parameters,
        [
            ProgramOperation("box", "primitive.box", 1, (), {"length": "x", "width": "y", "height": "z"}, (), {}, True),
            ProgramOperation("rotate", "transform.rotate", 1, ("box",), {"angle": "angle"}, (), {"axis": "Z"}, True),
            ProgramOperation("scale", "transform.scale", 1, ("rotate",), {"factor": "factor"}, (), {}, True),
            ProgramOperation("pattern", "pattern.linear", 1, ("scale",), {"count": "count", "spacing": "spacing"}, (), {"axis": "X", "fuse": False}, True),
        ],
    )
    assert len(result.bodies) == 3
    assert topology_counts(shape)["SOLID"] == 3
    assert math.isclose(mass_properties(shape)[1], 3 * (2 * 3 * 4) * 8, rel_tol=1e-8)
    bounds = exact_bounds(shape)
    assert math.isclose(bounds[0], -6, abs_tol=1e-9)
    assert math.isclose(bounds[3], 20, abs_tol=1e-9)
