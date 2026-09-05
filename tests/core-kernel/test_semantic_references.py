from __future__ import annotations

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox

import pytest

from strafe_forge_core.diagnostics import KernelError
from strafe_forge_core.program import PartProgram, ProgramOperation
from strafe_forge_core.topology import KernelShape, ProducedEntity, resolve_reference

from kernel_cases import engine, literal


def reference() -> dict[str, object]:
    return {
        "reference_id": "edge-to-treat",
        "producer_operation_id": "box",
        "entity_kind": "EDGE",
        "semantic_role": "edge:z:x:min/y:min",
        "lineage": [],
        "expected_cardinality": "ONE",
    }


def test_semantic_resolution_exposes_missing_producer() -> None:
    resolution = resolve_reference("part:semantic", reference(), {})
    assert resolution.status == "MISSING"
    assert resolution.matched_entity_count == 0
    assert resolution.diagnostic_code == "SEMANTIC_REFERENCE_MISSING"


def test_semantic_resolution_exposes_deleted_entity() -> None:
    shape = BRepPrimAPI_MakeBox(1, 1, 1).Shape()
    output = KernelShape(
        "SOLID",
        shape,
        deleted_reference_ids={"ref:box:edge:z:x:min/y:min"},
    )
    resolution = resolve_reference("part:semantic", reference(), {"box": output})
    assert resolution.status == "DELETED"
    assert resolution.matched_entity_count == 0
    assert resolution.diagnostic_code == "SEMANTIC_REFERENCE_DELETED"


def test_semantic_resolution_exposes_ambiguous_entity() -> None:
    shape = BRepPrimAPI_MakeBox(1, 1, 1).Shape()
    entity = ProducedEntity(
        "box",
        "EDGE",
        "edge:z:x:min/y:min",
        shape,
    )
    output = KernelShape("SOLID", shape, entities=[entity, entity])
    resolution = resolve_reference("part:semantic", reference(), {"box": output})
    assert resolution.status == "AMBIGUOUS"
    assert resolution.entity_id is None
    assert resolution.matched_entity_count == 2
    assert resolution.diagnostic_code == "SEMANTIC_REFERENCE_AMBIGUOUS"


def test_persisted_semantic_reference_rejects_ordinal_or_index_identity() -> None:
    persisted = reference()
    persisted["edge_ordinal"] = 7
    program = PartProgram(
        "part:no-ordinal",
        "rev:no-ordinal",
        {"length": "mm", "angle": "deg"},
        {
            "size": literal("size", "LENGTH", "1"),
            "radius": literal("radius", "LENGTH", "0.1"),
        },
        (
            ProgramOperation(
                "box",
                "primitive.box",
                1,
                (),
                {"length": "size", "width": "size", "height": "size"},
                (),
                {},
                True,
            ),
            ProgramOperation(
                "fillet",
                "solid.fillet",
                1,
                ("box",),
                {"radius": "radius"},
                ("edge-to-treat",),
                {},
                True,
            ),
        ),
        {"edge-to-treat": persisted},
    )
    with pytest.raises(KernelError) as caught:
        program.validate_structure()
    assert caught.value.code == "OPERATION_INPUT_INVALID"


def test_real_occt_boolean_deleted_history_blocks_dependent_feature() -> None:
    parameters = {
        "outer": literal("outer", "LENGTH", "10"),
        "tool": literal("tool", "LENGTH", "3"),
        "offset": literal("offset", "LENGTH", "20"),
        "zero": literal("zero", "LENGTH", "0"),
        "radius": literal("radius", "LENGTH", "0.5"),
    }
    operations = (
        ProgramOperation(
            "outer-box",
            "primitive.box",
            1,
            (),
            {"length": "outer", "width": "outer", "height": "outer"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "tool-box",
            "primitive.box",
            1,
            (),
            {"length": "tool", "width": "tool", "height": "tool"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "tool-move",
            "transform.translate",
            1,
            ("tool-box",),
            {"dx": "offset", "dy": "zero", "dz": "zero"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "cut",
            "solid.boolean.cut",
            1,
            ("outer-box", "tool-move"),
            {},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "fillet-deleted",
            "solid.fillet",
            1,
            ("cut",),
            {"radius": "radius"},
            ("deleted-edge",),
            {},
            True,
        ),
        ProgramOperation(
            "dependent",
            "transform.translate",
            1,
            ("fillet-deleted",),
            {"dx": "zero", "dy": "zero", "dz": "zero"},
            (),
            {},
            True,
        ),
    )
    references = {
        "deleted-edge": {
            "reference_id": "deleted-edge",
            "producer_operation_id": "cut",
            "entity_kind": "EDGE",
            "semantic_role": "right/edge:z:x:min/y:min",
            "lineage": [
                {
                    "operation_id": "tool-move",
                    "event": "MODIFIED",
                    "source_reference_id": "ref:tool-box:edge:z:x:min/y:min",
                }
            ],
            "expected_cardinality": "ONE",
        }
    }
    result = engine().recompute(
        PartProgram(
            "part:real-deleted",
            "rev:real-deleted",
            {"length": "mm", "angle": "deg"},
            parameters,
            operations,
            references,
        )
    )
    by_id = {item.operation_id: item for item in result.operation_results}
    assert result.status == "FAILED"
    assert by_id["cut"].status == "SUCCEEDED"
    assert by_id["fillet-deleted"].diagnostics[0].code == "SEMANTIC_REFERENCE_DELETED"
    assert by_id["dependent"].diagnostics[0].code == "DEPENDENCY_BLOCKED"
    assert result.semantic_resolutions[0].status == "DELETED"


def test_real_occt_modified_history_preserves_semantic_selection() -> None:
    parameters = {
        "size": literal("size", "LENGTH", "10"),
        "shift": literal("shift", "LENGTH", "7"),
        "zero": literal("zero", "LENGTH", "0"),
        "radius": literal("radius", "LENGTH", "1"),
    }
    result = engine().recompute(
        PartProgram(
            "part:real-modified",
            "rev:real-modified",
            {"length": "mm", "angle": "deg"},
            parameters,
            (
                ProgramOperation(
                    "box",
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
                    ("box",),
                    {"dx": "shift", "dy": "zero", "dz": "zero"},
                    (),
                    {},
                    True,
                ),
                ProgramOperation(
                    "fillet",
                    "solid.fillet",
                    1,
                    ("move",),
                    {"radius": "radius"},
                    ("moved-edge",),
                    {},
                    True,
                ),
            ),
            {
                "moved-edge": {
                    "reference_id": "moved-edge",
                    "producer_operation_id": "move",
                    "entity_kind": "EDGE",
                    "semantic_role": "edge:z:x:min/y:min",
                    "lineage": [
                        {
                            "operation_id": "box",
                            "event": "GENERATED",
                            "source_reference_id": None,
                        }
                    ],
                    "expected_cardinality": "ONE",
                }
            },
        )
    )
    assert result.status == "SUCCEEDED", result.diagnostics
    resolution = result.semantic_resolutions[0]
    assert resolution.status == "EXACT"
    assert resolution.lineage[0].event == "MODIFIED"
    assert resolution.lineage[0].source_reference_id == "ref:box:edge:z:x:min/y:min"
