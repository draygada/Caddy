"""Deterministic fixed-transform assembly composition over real OCCT geometry.

This module intentionally does not solve mates. It composes reusable exact part
definitions through explicit rigid transforms while preserving component and source-part
identity. All records here are lane-local geometry execution/evidence types, not the
integration-owned PartDocument, product-thread, revision, or BOM wire contracts;
``bom_item_id`` only verifies deterministic occurrence grouping in this bounded adapter.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any, Mapping

from OCP.BRepBuilderAPI import BRepBuilderAPI_Transform
from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

from .artifacts import GeometryArtifact
from .canonical import is_sha256_hex, sha256_bytes, sha256_hex
from .diagnostics import Diagnostic, KernelError
from .engine import EngineManifest, RecomputeResult
from .scalars import canonical_decimal, parse_decimal
from .topology import (
    deserialize_brep,
    exact_bounds,
    make_compound,
    semantic_fingerprint,
    serialize_brep,
    shape_is_valid,
    topology_counts,
)


def _part_source_record_hash(document_id: str, artifact: GeometryArtifact) -> str:
    """Bind lane-local document identity to the admitted artifact descriptor/BREP."""

    return sha256_hex(
        {
            "schema_version": "forge.admitted-part-source/1",
            "document_id": document_id,
            "artifact_id": artifact.artifact_id,
            "artifact_descriptor": artifact.descriptor_preimage(),
        }
    )


def _evidence_check(
    code: str,
    passed: bool,
    observed: object,
    expected: object,
) -> dict[str, object]:
    return {
        "code": code,
        "status": "PASSED" if passed else "FAILED",
        "observed": observed,
        "expected": expected,
        "tolerance": None,
    }


@dataclass(frozen=True, slots=True)
class FixedTransform:
    translation_mm: tuple[Fraction, Fraction, Fraction] = (
        Fraction(0),
        Fraction(0),
        Fraction(0),
    )
    rotation_axis: str = "Z"
    rotation_angle_deg: Fraction = Fraction(0)

    def __post_init__(self) -> None:
        if self.rotation_axis not in {"X", "Y", "Z"}:
            raise KernelError("OPERATION_INPUT_INVALID", "Fixed transform axis must be X/Y/Z")
        if len(self.translation_mm) != 3 or not all(
            isinstance(value, Fraction) for value in self.translation_mm
        ):
            raise KernelError(
                "OPERATION_INPUT_INVALID", "Fixed transform translation must have three rationals"
            )
        if not isinstance(self.rotation_angle_deg, Fraction):
            raise KernelError(
                "OPERATION_INPUT_INVALID", "Fixed transform rotation must be rational"
            )

    def as_dict(self) -> dict[str, object]:
        return {
            "translation_mm": [
                {"numerator": str(value.numerator), "denominator": str(value.denominator)}
                for value in self.translation_mm
            ],
            "rotation_axis": self.rotation_axis,
            "rotation_angle_deg": {
                "numerator": str(self.rotation_angle_deg.numerator),
                "denominator": str(self.rotation_angle_deg.denominator),
            },
        }

    def to_occt(self) -> gp_Trsf:
        result = gp_Trsf()
        if self.rotation_angle_deg:
            direction = {
                "X": gp_Dir(1, 0, 0),
                "Y": gp_Dir(0, 1, 0),
                "Z": gp_Dir(0, 0, 1),
            }[self.rotation_axis]
            result.SetRotation(
                gp_Ax1(gp_Pnt(0, 0, 0), direction),
                math.radians(float(self.rotation_angle_deg)),
            )
        result.SetTranslationPart(gp_Vec(*(float(value) for value in self.translation_mm)))
        return result


@dataclass(frozen=True, slots=True)
class PartDefinition:
    definition_id: str
    part_document_id: str
    part_revision_id: str
    geometry_hash: str
    artifact_id: str
    artifact_content_hash: str
    brep_bytes: bytes = field(repr=False, compare=False)
    source_artifact: GeometryArtifact = field(repr=False, compare=False)
    source_record_hash: str
    metadata: Mapping[str, str] = field(default_factory=dict)
    material_id: str | None = None
    mass_override_kg: str | None = None

    @classmethod
    def from_recompute(
        cls,
        definition_id: str,
        result: RecomputeResult,
        *,
        metadata: Mapping[str, str] | None = None,
        material_id: str | None = None,
        mass_override_kg: str | None = None,
    ) -> "PartDefinition":
        artifact = result.current_artifact
        if result.status != "SUCCEEDED" or artifact is None:
            raise KernelError(
                "ARTIFACT_STALE", "Part definition requires a current successful BREP artifact"
            )
        if (
            artifact.artifact_kind != "BREP"
            or artifact.source_revision_id != result.attempted_revision_id
            or artifact.geometry_hash != result.geometry_hash
            or artifact.engine_manifest_hash != result.engine_manifest_hash
            or artifact.semantic_fingerprint is None
            or not shape_is_valid(deserialize_brep(artifact.content))
        ):
            raise KernelError(
                "PART_PROVENANCE_MISMATCH",
                "Part definition source result and admitted BREP artifact disagree",
            )
        return cls(
            definition_id=definition_id,
            part_document_id=result.document_id,
            part_revision_id=result.attempted_revision_id,
            geometry_hash=result.geometry_hash,
            artifact_id=artifact.artifact_id,
            artifact_content_hash=artifact.content_hash,
            brep_bytes=artifact.content,
            source_artifact=artifact,
            source_record_hash=_part_source_record_hash(result.document_id, artifact),
            metadata=dict(metadata or {}),
            material_id=material_id,
            mass_override_kg=mass_override_kg,
        )

    def identity_dict(self) -> dict[str, object]:
        return {
            "definition_id": self.definition_id,
            "part_document_id": self.part_document_id,
            "part_revision_id": self.part_revision_id,
            "geometry_hash": self.geometry_hash,
            "artifact_id": self.artifact_id,
            "artifact_content_hash": self.artifact_content_hash,
            "source_record_hash": self.source_record_hash,
            "metadata": dict(self.metadata),
            "material_id": self.material_id,
            "mass_override_kg": self.mass_override_kg,
        }


@dataclass(frozen=True, slots=True)
class Component:
    component_id: str
    definition_id: str
    parent_component_id: str | None
    transform: FixedTransform
    visible: bool
    bom_item_id: str
    metadata: Mapping[str, str] = field(default_factory=dict)

    def as_dict(self) -> dict[str, object]:
        return {
            "component_id": self.component_id,
            "definition_id": self.definition_id,
            "parent_component_id": self.parent_component_id,
            "transform": self.transform.as_dict(),
            "visible": self.visible,
            "bom_item_id": self.bom_item_id,
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True, slots=True)
class AssemblyProgram:
    assembly_id: str
    assembly_revision_id: str
    definitions: Mapping[str, PartDefinition]
    components: tuple[Component, ...]
    units: Mapping[str, str] = field(
        default_factory=lambda: {"length": "mm", "angle": "deg"}
    )

    def geometry_preimage(self) -> dict[str, object]:
        return {
            "schema_version": "forge.assembly-geometry/1",
            "assembly_id": self.assembly_id,
            "units": dict(self.units),
            "definitions": {
                key: definition.identity_dict()
                for key, definition in sorted(self.definitions.items())
            },
            "components": [component.as_dict() for component in self.components],
        }

    @property
    def geometry_hash(self) -> str:
        return sha256_hex(self.geometry_preimage())

    def validate(self) -> None:
        if not self.assembly_id or not self.assembly_revision_id:
            raise KernelError("SCHEMA_UNSUPPORTED", "Assembly identities must be non-empty")
        if dict(self.units) != {"length": "mm", "angle": "deg"}:
            raise KernelError("SCHEMA_UNSUPPORTED", "Assembly boundary requires mm and deg")
        for key, definition in self.definitions.items():
            if key != definition.definition_id:
                raise KernelError("DUPLICATE_ID", f"Definition key mismatch {key!r}")
            if (
                not definition.definition_id
                or not definition.part_document_id
                or not definition.part_revision_id
                or not is_sha256_hex(definition.geometry_hash)
                or not definition.artifact_id.startswith("artifact:")
                or not is_sha256_hex(
                    definition.artifact_id.removeprefix("artifact:")
                )
                or not is_sha256_hex(definition.artifact_content_hash)
                or not isinstance(definition.source_artifact, GeometryArtifact)
                or not is_sha256_hex(definition.source_record_hash)
                or not isinstance(definition.metadata, Mapping)
                or not all(
                    isinstance(item_key, str) and isinstance(item_value, str)
                    for item_key, item_value in definition.metadata.items()
                )
                or (
                    definition.material_id is not None
                    and not isinstance(definition.material_id, str)
                )
            ):
                raise KernelError(
                    "OPERATION_INPUT_INVALID",
                    f"Malformed part definition {definition.definition_id!r}",
                )
            if definition.mass_override_kg is not None:
                if parse_decimal(definition.mass_override_kg) < 0:
                    raise KernelError(
                        "OPERATION_INPUT_INVALID", "Mass override cannot be negative"
                    )
            source = definition.source_artifact
            expected_source_record_hash = _part_source_record_hash(
                definition.part_document_id,
                source,
            )
            if (
                source.artifact_kind != "BREP"
                or source.semantic_fingerprint is None
                or definition.source_record_hash != expected_source_record_hash
                or definition.part_revision_id != source.source_revision_id
                or definition.geometry_hash != source.geometry_hash
                or definition.artifact_id != source.artifact_id
                or definition.artifact_content_hash != source.content_hash
                or definition.brep_bytes != source.content
            ):
                raise KernelError(
                    "PART_PROVENANCE_MISMATCH",
                    f"Part source provenance mismatch {definition.definition_id!r}",
                )
            if sha256_bytes(definition.brep_bytes) != definition.artifact_content_hash:
                raise KernelError(
                    "ARTIFACT_HASH_MISMATCH",
                    f"Part content hash mismatch {definition.definition_id!r}",
                )
            if not shape_is_valid(deserialize_brep(definition.brep_bytes)):
                raise KernelError(
                    "ARTIFACT_HASH_MISMATCH", f"Invalid part BREP {definition.definition_id!r}"
                )
        by_id: dict[str, Component] = {}
        for component in self.components:
            if (
                not component.component_id
                or not component.definition_id
                or (
                    component.parent_component_id is not None
                    and not isinstance(component.parent_component_id, str)
                )
                or not isinstance(component.visible, bool)
                or not component.bom_item_id
                or not isinstance(component.metadata, Mapping)
                or not all(
                    isinstance(item_key, str) and isinstance(item_value, str)
                    for item_key, item_value in component.metadata.items()
                )
            ):
                raise KernelError("OPERATION_INPUT_INVALID", "Malformed component")
            if component.component_id in by_id:
                raise KernelError("DUPLICATE_ID", f"Duplicate component {component.component_id!r}")
            if component.definition_id not in self.definitions:
                raise KernelError(
                    "DEPENDENCY_MISSING",
                    f"Component {component.component_id!r} has no part definition",
                )
            by_id[component.component_id] = component
        for component in self.components:
            if component.parent_component_id is not None and component.parent_component_id not in by_id:
                raise KernelError(
                    "DEPENDENCY_MISSING",
                    f"Component {component.component_id!r} has missing parent",
                )
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(component_id: str) -> None:
            if component_id in visiting:
                raise KernelError("DEPENDENCY_CYCLE", "Assembly component hierarchy is cyclic")
            if component_id in visited:
                return
            visiting.add(component_id)
            parent = by_id[component_id].parent_component_id
            if parent is not None:
                visit(parent)
            visiting.remove(component_id)
            visited.add(component_id)

        for component_id in sorted(by_id):
            visit(component_id)
        bom_definitions: dict[str, str] = {}
        for component in self.components:
            existing = bom_definitions.setdefault(component.bom_item_id, component.definition_id)
            if existing != component.definition_id:
                raise KernelError(
                    "DUPLICATE_ID",
                    f"BOM item {component.bom_item_id!r} aliases different definitions",
                )


@dataclass(frozen=True, slots=True)
class EvaluatedComponent:
    component_id: str
    definition_id: str
    part_document_id: str
    part_revision_id: str
    part_geometry_hash: str
    part_artifact_id: str
    part_artifact_content_hash: str
    parent_component_id: str | None
    visible: bool
    effective_visible: bool
    bom_item_id: str
    component_metadata: Mapping[str, str]
    definition_metadata: Mapping[str, str]
    material_id: str | None
    mass_override_kg: str | None
    selection_entity_id: str
    local_transform: Mapping[str, object]
    world_transform: tuple[tuple[str, str, str, str], ...]
    world_bounds_mm: Mapping[str, tuple[str, str, str]] | None
    shape: Any = field(repr=False, compare=False)

    def as_dict(self) -> dict[str, object]:
        return {
            "component_id": self.component_id,
            "definition_id": self.definition_id,
            "part_document_id": self.part_document_id,
            "part_revision_id": self.part_revision_id,
            "part_geometry_hash": self.part_geometry_hash,
            "part_artifact_id": self.part_artifact_id,
            "part_artifact_content_hash": self.part_artifact_content_hash,
            "parent_component_id": self.parent_component_id,
            "visible": self.visible,
            "effective_visible": self.effective_visible,
            "bom_item_id": self.bom_item_id,
            "component_metadata": dict(self.component_metadata),
            "definition_metadata": dict(self.definition_metadata),
            "material_id": self.material_id,
            "mass_override_kg": self.mass_override_kg,
            "selection_entity_id": self.selection_entity_id,
            "local_transform": dict(self.local_transform),
            "world_transform": [list(row) for row in self.world_transform],
            "world_bounds_mm": dict(self.world_bounds_mm)
            if self.world_bounds_mm
            else None,
        }


@dataclass(frozen=True, slots=True)
class BomEntry:
    bom_item_id: str
    definition_id: str
    part_document_id: str
    part_revision_id: str
    part_geometry_hash: str
    part_artifact_id: str
    quantity: int
    material_id: str | None
    mass_override_kg: str | None

    def as_dict(self) -> dict[str, object]:
        return {
            "bom_item_id": self.bom_item_id,
            "definition_id": self.definition_id,
            "part_document_id": self.part_document_id,
            "part_revision_id": self.part_revision_id,
            "part_geometry_hash": self.part_geometry_hash,
            "part_artifact_id": self.part_artifact_id,
            "quantity": self.quantity,
            "material_id": self.material_id,
            "mass_override_kg": self.mass_override_kg,
        }


@dataclass(slots=True)
class AssemblyResult:
    assembly_id: str
    attempted_revision_id: str
    geometry_hash: str
    engine_manifest_hash: str
    status: str
    components: list[EvaluatedComponent]
    bom: list[BomEntry]
    current_artifact: GeometryArtifact | None
    diagnostics: list[Diagnostic]

    def as_dict(self) -> dict[str, object]:
        return {
            "protocol_version": "forge.core-assembly-result/1",
            "assembly_id": self.assembly_id,
            "attempted_revision_id": self.attempted_revision_id,
            "geometry_hash": self.geometry_hash,
            "engine_manifest_hash": self.engine_manifest_hash,
            "status": self.status,
            "components": [component.as_dict() for component in self.components],
            "bom": [entry.as_dict() for entry in self.bom],
            "current_artifact": self.current_artifact.pointer().as_dict()
            if self.current_artifact
            else None,
            "diagnostics": [diagnostic.as_dict() for diagnostic in self.diagnostics],
        }


class AssemblyEngine:
    def __init__(self, manifest: EngineManifest) -> None:
        self.manifest = manifest

    def evaluate(self, program: AssemblyProgram) -> AssemblyResult:
        try:
            program.validate()
            result = self._evaluate(program)
            return result
        except KernelError as exc:
            return AssemblyResult(
                program.assembly_id,
                program.assembly_revision_id,
                program.geometry_hash,
                self.manifest.manifest_hash,
                "FAILED",
                [],
                [],
                None,
                [exc.diagnostic],
            )

    def _evaluate(self, program: AssemblyProgram) -> AssemblyResult:
        by_id = {component.component_id: component for component in program.components}
        world: dict[str, gp_Trsf] = {}
        effective_visibility: dict[str, bool] = {}

        def world_for(component_id: str) -> gp_Trsf:
            if component_id in world:
                return world[component_id]
            component = by_id[component_id]
            local = component.transform.to_occt()
            if component.parent_component_id is None:
                composed = local
                parent_visible = True
            else:
                composed = world_for(component.parent_component_id).Multiplied(local)
                parent_visible = effective_visibility[component.parent_component_id]
            world[component_id] = composed
            effective_visibility[component_id] = parent_visible and component.visible
            return composed

        evaluated: list[EvaluatedComponent] = []
        visible_shapes = []
        for component in program.components:
            definition = program.definitions[component.definition_id]
            source_shape = deserialize_brep(definition.brep_bytes)
            transform = world_for(component.component_id)
            transformed = BRepBuilderAPI_Transform(source_shape, transform, True).Shape()
            if not shape_is_valid(transformed):
                raise KernelError(
                    "OPERATION_HANDLER_FAILED",
                    f"Component transform invalidated {component.component_id!r}",
                )
            is_visible = effective_visibility[component.component_id]
            bounds_value = None
            if is_visible:
                visible_shapes.append(transformed)
                xmin, ymin, zmin, xmax, ymax, zmax = exact_bounds(transformed)
                bounds_value = {
                    "min": (
                        canonical_decimal(xmin),
                        canonical_decimal(ymin),
                        canonical_decimal(zmin),
                    ),
                    "max": (
                        canonical_decimal(xmax),
                        canonical_decimal(ymax),
                        canonical_decimal(zmax),
                    ),
                }
            matrix = tuple(
                tuple(canonical_decimal(transform.Value(row, column)) for column in range(1, 5))
                for row in range(1, 4)
            )
            selection_id = "entity:" + sha256_hex(
                {
                    "assembly_id": program.assembly_id,
                    "component_id": component.component_id,
                    "part_revision_id": definition.part_revision_id,
                    "entity_kind": "COMPONENT",
                }
            )
            evaluated.append(
                EvaluatedComponent(
                    component.component_id,
                    component.definition_id,
                    definition.part_document_id,
                    definition.part_revision_id,
                    definition.geometry_hash,
                    definition.artifact_id,
                    definition.artifact_content_hash,
                    component.parent_component_id,
                    component.visible,
                    is_visible,
                    component.bom_item_id,
                    dict(component.metadata),
                    dict(definition.metadata),
                    definition.material_id,
                    definition.mass_override_kg,
                    selection_id,
                    component.transform.as_dict(),
                    matrix,
                    bounds_value,
                    transformed,
                )
            )
        if not visible_shapes:
            raise KernelError("OPERATION_HANDLER_FAILED", "Assembly has no visible geometry")
        composed_shape = make_compound(visible_shapes)
        exact_entities = [
            (f"component:{component.component_id}", "COMPOUND")
            for component in evaluated
            if component.effective_visible
        ]
        fingerprint, _ = semantic_fingerprint(
            composed_shape, units=dict(program.units), exact_entities=exact_entities
        )
        brep_content = serialize_brep(composed_shape)
        reimported_shape = deserialize_brep(brep_content)
        reimported_fingerprint, _ = semantic_fingerprint(
            reimported_shape,
            units=dict(program.units),
            exact_entities=exact_entities,
        )
        source_bounds = [canonical_decimal(value) for value in exact_bounds(composed_shape)]
        reimported_bounds = [
            canonical_decimal(value) for value in exact_bounds(reimported_shape)
        ]
        source_topology = topology_counts(composed_shape)
        reimported_topology = topology_counts(reimported_shape)
        checks = [
            _evidence_check(
                "ASSEMBLY_SOURCE_SHAPE_VALID",
                shape_is_valid(composed_shape),
                str(shape_is_valid(composed_shape)).lower(),
                "true",
            ),
            _evidence_check(
                "ASSEMBLY_BREP_REIMPORT_VALID",
                shape_is_valid(reimported_shape),
                str(shape_is_valid(reimported_shape)).lower(),
                "true",
            ),
            _evidence_check(
                "ASSEMBLY_BREP_ROUNDTRIP_BOUNDS_MATCH",
                source_bounds == reimported_bounds,
                reimported_bounds,
                source_bounds,
            ),
            _evidence_check(
                "ASSEMBLY_BREP_ROUNDTRIP_TOPOLOGY_MATCH",
                source_topology == reimported_topology,
                reimported_topology,
                source_topology,
            ),
            _evidence_check(
                "ASSEMBLY_BREP_ROUNDTRIP_FINGERPRINT_MATCH",
                fingerprint == reimported_fingerprint,
                reimported_fingerprint,
                fingerprint,
            ),
        ]
        verification_status = (
            "PASSED" if all(check["status"] == "PASSED" for check in checks) else "FAILED"
        )
        if verification_status != "PASSED":
            raise KernelError(
                "ASSEMBLY_ARTIFACT_VERIFICATION_FAILED",
                "Assembly BREP failed serialized/reimported geometry checks",
            )
        artifact = GeometryArtifact(
            artifact_kind="BREP",
            source_revision_id=program.assembly_revision_id,
            geometry_hash=program.geometry_hash,
            producing_operation_id=None,
            engine_manifest_hash=self.manifest.manifest_hash,
            media_type="application/vnd.opencascade.brep",
            content=brep_content,
            semantic_fingerprint=fingerprint,
            verification={"status": verification_status, "checks": checks},
        )
        grouped: dict[str, list[Component]] = {}
        for component in program.components:
            grouped.setdefault(component.bom_item_id, []).append(component)
        bom = []
        for bom_item_id in sorted(grouped):
            components = grouped[bom_item_id]
            definition = program.definitions[components[0].definition_id]
            bom.append(
                BomEntry(
                    bom_item_id,
                    definition.definition_id,
                    definition.part_document_id,
                    definition.part_revision_id,
                    definition.geometry_hash,
                    definition.artifact_id,
                    len(components),
                    definition.material_id,
                    definition.mass_override_kg,
                )
            )
        return AssemblyResult(
            program.assembly_id,
            program.assembly_revision_id,
            program.geometry_hash,
            self.manifest.manifest_hash,
            "SUCCEEDED",
            evaluated,
            bom,
            artifact,
            [],
        )
