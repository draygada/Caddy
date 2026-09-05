from __future__ import annotations

from strafe_forge_core.engine import EngineManifest, RecomputeEngine
from strafe_forge_core.ocp_operations import ocp_registry
from strafe_forge_core.program import PartProgram, ProgramOperation


def literal(parameter_id: str, value_type: str, value: object) -> dict[str, object]:
    return {
        "parameter_id": parameter_id,
        "name": parameter_id.removeprefix("param:"),
        "value_type": value_type,
        "literal": value,
        "expression": None,
    }


def manifest() -> EngineManifest:
    return EngineManifest(
        adapter="strafe-ocp@0.1.0",
        binding=(
            "cadquery-ocp-novtk@7.9.3.1;"
            "wheel-sha256=a070f99039e877e9558759570fd379365e2d28de3850b62e33c9c48e5ac1f0e3;"
            "source=d69b064a3a604ebf245b1f3b14fb54c835a3a571"
        ),
        kernel="OCCT@7.9.3;source=a016080bf6738d6aeae020badee4e888ad1540a5",
        solver="NONE:not-adopted",
        toolchain="CPython@3.12.13;uv@0.11.17",
        platform_image="UNCONTAINERIZED:macOS@26.5.2(25F84):arm64",
        tolerances={"linear_mm": "0.000001", "angular_deg": "0.000001"},
        deterministic_settings={
            "parallel": False,
            "boolean_fuzzy_mm": "0.0000001",
            "brep_format": 4,
            "binary64_rounding": "nearest-ties-even",
        },
    )


def engine() -> RecomputeEngine:
    return RecomputeEngine(ocp_registry(), manifest())


def bracket_program(
    *,
    width: str = "40",
    height: str = "20",
    thickness: str = "5",
    fillet_radius: str = "1",
    reference_role: str = "rail:corner:bottom-left",
    include_dependent: bool = False,
    revision_id: str = "rev:bracket",
) -> PartProgram:
    parameters = {
        "param:width": literal("param:width", "LENGTH", width),
        "param:height": literal("param:height", "LENGTH", height),
        "param:thickness": literal("param:thickness", "LENGTH", thickness),
        "param:fillet": literal("param:fillet", "LENGTH", fillet_radius),
        "param:zero": literal("param:zero", "LENGTH", "0"),
    }
    operations = [
        ProgramOperation(
            "op:sketch",
            "sketch.rectangle",
            1,
            (),
            {"width": "param:width", "height": "param:height"},
            (),
            {"plane": "XY", "centered": False},
            True,
        ),
        ProgramOperation(
            "op:extrude",
            "solid.extrude",
            1,
            ("op:sketch",),
            {"distance": "param:thickness"},
            (),
            {"direction": "XY"},
            True,
        ),
        ProgramOperation(
            "op:fillet",
            "solid.fillet",
            1,
            ("op:extrude",),
            {"radius": "param:fillet"},
            ("ref:vertical-edge",),
            {},
            True,
        ),
    ]
    if include_dependent:
        operations.append(
            ProgramOperation(
                "op:dependent",
                "transform.translate",
                1,
                ("op:fillet",),
                {"dx": "param:zero", "dy": "param:zero", "dz": "param:zero"},
                (),
                {},
                True,
            )
        )
    references = {
        "ref:vertical-edge": {
            "reference_id": "ref:vertical-edge",
            "producer_operation_id": "op:extrude",
            "entity_kind": "EDGE",
            "semantic_role": reference_role,
            "lineage": [
                {
                    "operation_id": "op:sketch",
                    "event": "GENERATED",
                    "source_reference_id": "ref:profile-corner",
                },
                {
                    "operation_id": "op:extrude",
                    "event": "GENERATED",
                    "source_reference_id": "ref:profile-corner",
                },
            ],
            "expected_cardinality": "ONE",
        }
    }
    return PartProgram(
        "part:bracket",
        revision_id,
        {"length": "mm", "angle": "deg"},
        parameters,
        tuple(operations),
        references,
    )


def box_program(*, revision_id: str = "rev:box") -> PartProgram:
    parameters = {
        "param:length": literal("param:length", "LENGTH", "10"),
        "param:width": literal("param:width", "LENGTH", "5"),
        "param:height": literal("param:height", "LENGTH", "2"),
    }
    operation = ProgramOperation(
        "op:box",
        "primitive.box",
        1,
        (),
        {
            "length": "param:length",
            "width": "param:width",
            "height": "param:height",
        },
        (),
        {},
        True,
    )
    return PartProgram(
        "part:box",
        revision_id,
        {"length": "mm", "angle": "deg"},
        parameters,
        (operation,),
        {},
    )
