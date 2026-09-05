from __future__ import annotations

from fractions import Fraction

from strafe_forge_core.assembly import (
    AssemblyEngine,
    AssemblyProgram,
    Component,
    FixedTransform,
    PartDefinition,
)
from strafe_forge_core.exchange import ExchangeService
from strafe_forge_core.program import PartProgram, ProgramOperation
from strafe_forge_core.topology import deserialize_brep, topology_counts

from kernel_cases import engine, literal, manifest


def multibody_part():
    parameters = {
        "length": literal("length", "LENGTH", "10"),
        "width": literal("width", "LENGTH", "5"),
        "height": literal("height", "LENGTH", "2"),
        "dx": literal("dx", "LENGTH", "20"),
        "zero": literal("zero", "LENGTH", "0"),
    }
    operations = (
        ProgramOperation("body:a", "primitive.box", 1, (), {"length": "length", "width": "width", "height": "height"}, (), {}, True),
        ProgramOperation("body:b", "primitive.box", 1, (), {"length": "length", "width": "width", "height": "height"}, (), {}, True),
        ProgramOperation("body:b:move", "transform.translate", 1, ("body:b",), {"dx": "dx", "dy": "zero", "dz": "zero"}, (), {}, True),
    )
    return engine().recompute(
        PartProgram(
            "part:multi",
            "rev:part-multi",
            {"length": "mm", "angle": "deg"},
            parameters,
            operations,
            {},
        )
    )


def test_part_document_preserves_multiple_real_solid_bodies() -> None:
    result = multibody_part()
    assert result.status == "SUCCEEDED"
    assert len(result.bodies) == 2
    assert result.current_artifact is not None
    restored = deserialize_brep(result.current_artifact.content)
    assert topology_counts(restored)["SOLID"] == 2
    body_records = result.as_dict()["bodies"]
    assert [item["body_id"] for item in body_records] == [
        "body:body:a",
        "body:body:b:move:0",
    ]
    assert len({item["semantic_fingerprint"] for item in body_records}) == 2


def test_reusable_part_fixed_transform_hierarchy_bom_and_component_selection() -> None:
    part = multibody_part()
    definition = PartDefinition.from_recompute(
        "definition:multi",
        part,
        material_id="material:aluminum-placeholder",
        mass_override_kg=None,
        metadata={"description": "synthetic two-body fixture"},
    )
    program = AssemblyProgram(
        "assembly:fixture",
        "rev:assembly-fixture",
        {definition.definition_id: definition},
        (
            Component("component:root", definition.definition_id, None, FixedTransform(), True, "bom:multi", {"label": "root"}),
            Component(
                "component:child",
                definition.definition_id,
                "component:root",
                FixedTransform((Fraction(50), Fraction(0), Fraction(0)), "Z", Fraction(90)),
                True,
                "bom:multi",
                {"label": "child"},
            ),
            Component(
                "component:hidden",
                definition.definition_id,
                None,
                FixedTransform((Fraction(100), Fraction(0), Fraction(0))),
                False,
                "bom:multi",
                {"label": "hidden but in BOM"},
            ),
        ),
    )
    first = AssemblyEngine(manifest()).evaluate(program)
    second = AssemblyEngine(manifest()).evaluate(program)
    assert first.status == second.status == "SUCCEEDED"
    assert first.geometry_hash == second.geometry_hash
    assert first.current_artifact is not None and second.current_artifact is not None
    assert first.current_artifact.semantic_fingerprint == second.current_artifact.semantic_fingerprint
    assert len({item.selection_entity_id for item in first.components}) == 3
    assert [item.quantity for item in first.bom] == [3]
    child = next(item for item in first.components if item.component_id == "component:child")
    hidden = next(item for item in first.components if item.component_id == "component:hidden")
    assert child.part_revision_id == "rev:part-multi"
    assert child.part_geometry_hash == part.geometry_hash
    assert child.part_artifact_id == part.current_artifact.artifact_id
    assert child.component_metadata == {"label": "child"}
    assert child.definition_metadata == {"description": "synthetic two-body fixture"}
    assert child.material_id == "material:aluminum-placeholder"
    assert child.local_transform["rotation_angle_deg"] == {
        "numerator": "90",
        "denominator": "1",
    }
    assert child.world_bounds_mm is not None
    assert child.world_bounds_mm["min"][0] == "45"
    assert hidden.effective_visible is False
    assert hidden.world_bounds_mm is None
    assert first.bom[0].part_geometry_hash == part.geometry_hash
    assert first.bom[0].part_artifact_id == part.current_artifact.artifact_id
    assert first.as_dict()["attempted_revision_id"] == "rev:assembly-fixture"

    restored = deserialize_brep(first.current_artifact.content)
    assert topology_counts(restored)["SOLID"] == 4
    # This is real compound geometry exchange.  It does not claim XDE assembly hierarchy/BOM
    # preservation, which remains a separately gated capability.
    step = ExchangeService(manifest()).export_step(
        "exchange:assembly-step", first.current_artifact, schema="AP242"
    )
    assert step.status == "SUCCEEDED", step.diagnostics


def test_parent_visibility_hides_child_geometry_without_changing_bom() -> None:
    part = multibody_part()
    definition = PartDefinition.from_recompute("definition:multi", part)
    program = AssemblyProgram(
        "assembly:hidden-tree",
        "rev:hidden-tree",
        {definition.definition_id: definition},
        (
            Component("parent", definition.definition_id, None, FixedTransform(), False, "bom:item"),
            Component("child", definition.definition_id, "parent", FixedTransform(), True, "bom:item"),
            Component("visible", definition.definition_id, None, FixedTransform(), True, "bom:item"),
        ),
    )
    result = AssemblyEngine(manifest()).evaluate(program)
    assert result.status == "SUCCEEDED"
    assert [item.effective_visible for item in result.components] == [False, False, True]
    assert result.bom[0].quantity == 3
    assert result.current_artifact is not None
    restored = deserialize_brep(result.current_artifact.content)
    assert topology_counts(restored)["SOLID"] == 2
