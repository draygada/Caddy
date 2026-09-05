"""Deterministic derived tessellation with semantic entity ranges."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopAbs import TopAbs_REVERSED
from OCP.TopLoc import TopLoc_Location

from .canonical import sha256_hex
from .diagnostics import Diagnostic, KernelError
from .engine import RecomputeResult
from .scalars import canonical_decimal
from .topology import ProducedEntity, same_shape, unique_subshapes


@dataclass(frozen=True, slots=True)
class EntityRange:
    start: int
    count: int
    entity_id: str
    semantic_reference_id: str
    feature_id: str
    component_id: str | None = None

    def as_dict(self) -> dict[str, object]:
        result: dict[str, object] = {
            "primitive": "INDEXED_TRIANGLE",
            "start": self.start,
            "count": self.count,
            "entity_id": self.entity_id,
            "semantic_reference_id": self.semantic_reference_id,
            "feature_id": self.feature_id,
        }
        if self.component_id is not None:
            result["component_id"] = self.component_id
        return result


@dataclass(slots=True)
class MeshData:
    source_artifact_id: str
    source_revision_id: str
    geometry_hash: str
    engine_manifest_hash: str
    linear_deflection_mm: str
    angular_deflection_deg: str
    positions: list[float] = field(default_factory=list)
    normals: list[float] = field(default_factory=list)
    indices: list[int] = field(default_factory=list)
    entity_ranges: list[EntityRange] = field(default_factory=list)
    diagnostics: list[Diagnostic] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "protocol_version": "forge.core-viewport-packet/1",
            "source_artifact_id": self.source_artifact_id,
            "source_revision_id": self.source_revision_id,
            "geometry_hash": self.geometry_hash,
            "engine_manifest_hash": self.engine_manifest_hash,
            "tessellation": {
                "linear_deflection_mm": self.linear_deflection_mm,
                "angular_deflection_deg": self.angular_deflection_deg,
            },
            "coordinate_system": {
                "handedness": "RIGHT",
                "up_axis": "+Z",
                "length_unit": "mm",
            },
            "topology": "TRIANGLES",
            "front_face": "CCW",
            "index_type": "UINT32",
            "positions": self.positions,
            "normals": self.normals,
            "indices": self.indices,
            "entity_ranges": [item.as_dict() for item in self.entity_ranges],
            "diagnostics": [item.as_dict() for item in self.diagnostics],
        }

    @property
    def packet_hash(self) -> str:
        return sha256_hex(self.as_dict())


def _normal(points: Sequence[tuple[float, float, float]]) -> tuple[float, float, float]:
    ax, ay, az = points[0]
    bx, by, bz = points[1]
    cx, cy, cz = points[2]
    ux, uy, uz = bx - ax, by - ay, bz - az
    vx, vy, vz = cx - ax, cy - ay, cz - az
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length <= 1e-18:
        raise KernelError("OPERATION_HANDLER_FAILED", "Tessellation contains a degenerate triangle")
    return (nx / length, ny / length, nz / length)


def _append_face(mesh: MeshData, face: Any) -> tuple[int, int]:
    location = TopLoc_Location()
    triangulation = BRep_Tool.Triangulation_s(face, location)
    if triangulation is None or triangulation.NbTriangles() == 0:
        raise KernelError("OPERATION_HANDLER_FAILED", "OCCT face has no triangulation")
    transform = location.Transformation()
    range_start = len(mesh.indices)
    reversed_face = face.Orientation() == TopAbs_REVERSED
    for triangle_index in range(1, triangulation.NbTriangles() + 1):
        node_indices = list(triangulation.Triangle(triangle_index).Get())
        if reversed_face:
            node_indices[1], node_indices[2] = node_indices[2], node_indices[1]
        points = []
        for node_index in node_indices:
            point = triangulation.Node(node_index).Transformed(transform)
            points.append((point.X(), point.Y(), point.Z()))
        normal = _normal(points)
        for point in points:
            mesh.positions.extend(point)
            mesh.normals.extend(normal)
            mesh.indices.append(len(mesh.indices))
    return range_start, len(mesh.indices) - range_start


def _mesh_shape(shape: Any, linear_deflection_mm: float, angular_deflection_deg: float) -> None:
    mesher = BRepMesh_IncrementalMesh(
        shape,
        linear_deflection_mm,
        False,
        math.radians(angular_deflection_deg),
        False,
    )
    mesher.Perform()
    if not mesher.IsDone():
        raise KernelError("OPERATION_HANDLER_FAILED", "OCCT tessellation failed")


def _face_entity(face: Any, entities: Iterable[ProducedEntity]) -> ProducedEntity | None:
    candidates = [
        entity
        for entity in entities
        if entity.entity_kind == "FACE" and same_shape(entity.shape, face)
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (item.semantic_role, item.producing_operation_id))[0]


def tessellate_part(
    result: RecomputeResult,
    *,
    linear_deflection_mm: float = 0.1,
    angular_deflection_deg: float = 15.0,
) -> MeshData:
    if result.status != "SUCCEEDED" or result.current_artifact is None:
        raise KernelError("ARTIFACT_STALE", "Part tessellation requires current geometry")
    terminal = [output for output in result.outputs.values() if output.bodies]
    all_entities = [entity for output in terminal for entity in output.entities]
    if not result.bodies:
        raise KernelError("ARTIFACT_STALE", "Part result has no retained body topology")
    from .topology import make_compound

    shape = (
        result.bodies[0].shape
        if len(result.bodies) == 1
        else make_compound(body.shape for body in result.bodies)
    )
    _mesh_shape(shape, linear_deflection_mm, angular_deflection_deg)
    mesh = MeshData(
        result.current_artifact.artifact_id,
        result.attempted_revision_id,
        result.geometry_hash,
        result.engine_manifest_hash,
        canonical_decimal(linear_deflection_mm),
        canonical_decimal(angular_deflection_deg),
    )
    for face in unique_subshapes(shape, "FACE"):
        start, count = _append_face(mesh, face)
        entity = _face_entity(face, all_entities)
        if entity is None:
            # Serialization can replace OCCT TShape handles.  A non-selectable range remains
            # visible and is marked explicitly; it never becomes a durable ordinal reference.
            reference_id = "ref:unmapped:" + sha256_hex(
                {
                    "document_id": result.document_id,
                    "source_artifact_id": result.current_artifact.artifact_id,
                    "range_bounds": [start, count],
                }
            )
            feature_id = "unmapped"
            mesh.diagnostics.append(
                Diagnostic(
                    "SEMANTIC_REFERENCE_MISSING",
                    "WARNING",
                    "A tessellated face has no exact semantic lineage and is not selectable",
                    None,
                    reference_id,
                )
            )
        else:
            reference_id = entity.derived_reference_id
            feature_id = entity.producing_operation_id
        stable_id = "entity:" + sha256_hex(
            {
                "document_id": result.document_id,
                "semantic_reference_id": reference_id,
                "entity_kind": "FACE",
            }
        )
        mesh.entity_ranges.append(
            EntityRange(start, count, stable_id, reference_id, feature_id)
        )
    return mesh
