"""OCCT topology facts, lineage-aware semantic entities, and shape serialization."""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any, Iterable, Literal, Sequence

from OCP.BinTools import BinTools, BinTools_FormatVersion
from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Builder, BRep_Tool
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import (
    TopAbs_COMPOUND,
    TopAbs_EDGE,
    TopAbs_FACE,
    TopAbs_SHELL,
    TopAbs_SOLID,
    TopAbs_VERTEX,
    TopAbs_WIRE,
)
from OCP.TopExp import TopExp
from OCP.TopTools import TopTools_IndexedMapOfShape
from OCP.TopoDS import TopoDS, TopoDS_Compound, TopoDS_Shape

from .canonical import sha256_hex
from .diagnostics import KernelError
from .scalars import canonical_decimal


EntityKind = Literal[
    "VERTEX", "EDGE", "WIRE", "FACE", "SHELL", "SOLID", "COMPOUND", "MESH"
]
LineageKind = Literal["GENERATED", "MODIFIED", "PRESERVED"]

_TOPOLOGY_ENUMS = {
    "VERTEX": TopAbs_VERTEX,
    "EDGE": TopAbs_EDGE,
    "WIRE": TopAbs_WIRE,
    "FACE": TopAbs_FACE,
    "SHELL": TopAbs_SHELL,
    "SOLID": TopAbs_SOLID,
    "COMPOUND": TopAbs_COMPOUND,
}

_CASTERS = {
    "VERTEX": TopoDS.Vertex_s,
    "EDGE": TopoDS.Edge_s,
    "WIRE": TopoDS.Wire_s,
    "FACE": TopoDS.Face_s,
    "SHELL": TopoDS.Shell_s,
    "SOLID": TopoDS.Solid_s,
    "COMPOUND": TopoDS.Compound_s,
}


@dataclass(frozen=True, slots=True)
class LineageEvent:
    operation_id: str
    event: LineageKind
    source_reference_id: str | None


@dataclass(slots=True)
class ProducedEntity:
    producing_operation_id: str
    entity_kind: EntityKind
    semantic_role: str
    shape: TopoDS_Shape
    lineage: tuple[LineageEvent, ...] = ()

    @property
    def derived_reference_id(self) -> str:
        return f"ref:{self.producing_operation_id}:{self.semantic_role}"


@dataclass(slots=True)
class Body:
    body_id: str
    producing_operation_id: str
    shape: TopoDS_Shape
    entities: list[ProducedEntity] = field(default_factory=list)


@dataclass(slots=True)
class KernelShape:
    kind: str
    shape: TopoDS_Shape
    entities: list[ProducedEntity] = field(default_factory=list)
    bodies: list[Body] = field(default_factory=list)
    deleted_reference_ids: set[str] = field(default_factory=set)


@dataclass(frozen=True, slots=True)
class SemanticResolution:
    reference_id: str
    entity_id: str | None
    entity_kind: EntityKind
    producing_operation_id: str
    status: str
    matched_entity_count: int
    diagnostic_code: str | None
    lineage: tuple[LineageEvent, ...] = ()
    _shape: TopoDS_Shape | None = field(default=None, repr=False, compare=False)

    def as_dict(self) -> dict[str, object]:
        return {
            "reference_id": self.reference_id,
            "entity_id": self.entity_id,
            "entity_kind": self.entity_kind,
            "producing_operation_id": self.producing_operation_id,
            "status": self.status,
            "matched_entity_count": self.matched_entity_count,
            "diagnostic_code": self.diagnostic_code,
            "lineage": [
                {
                    "operation_id": event.operation_id,
                    "event": event.event,
                    "source_reference_id": event.source_reference_id,
                }
                for event in self.lineage
            ],
        }


def entity_id(document_id: str, reference_id: str, entity_kind: str) -> str:
    digest = sha256_hex(
        {
            "document_id": document_id,
            "semantic_reference_id": reference_id,
            "entity_kind": entity_kind,
        }
    )
    return f"entity:{digest}"


def resolve_reference(
    document_id: str,
    reference: dict[str, Any],
    operation_outputs: dict[str, KernelShape],
) -> SemanticResolution:
    reference_id = reference.get("reference_id")
    producer = reference.get("producer_operation_id")
    entity_kind = reference.get("entity_kind")
    semantic_role = reference.get("semantic_role")
    if not all(isinstance(value, str) and value for value in (reference_id, producer, entity_kind, semantic_role)):
        raise KernelError(
            "OPERATION_INPUT_INVALID", "Semantic reference fields must be non-empty strings"
        )
    if entity_kind not in _TOPOLOGY_ENUMS and entity_kind != "MESH":
        raise KernelError(
            "OPERATION_INPUT_INVALID", f"Unknown entity kind {entity_kind!r}"
        )
    output = operation_outputs.get(producer)
    if output is None:
        return SemanticResolution(
            reference_id,
            None,
            entity_kind,
            producer,
            "MISSING",
            0,
            "SEMANTIC_REFERENCE_MISSING",
            (),
        )
    matches = [
        candidate
        for candidate in output.entities
        if candidate.entity_kind == entity_kind
        and candidate.semantic_role == semantic_role
    ]
    if not matches:
        derived = f"ref:{producer}:{semantic_role}"
        status = "DELETED" if derived in output.deleted_reference_ids else "MISSING"
        diagnostic = (
            "SEMANTIC_REFERENCE_DELETED"
            if status == "DELETED"
            else "SEMANTIC_REFERENCE_MISSING"
        )
        return SemanticResolution(
            reference_id, None, entity_kind, producer, status, 0, diagnostic, ()
        )
    expected = reference.get("expected_cardinality")
    exact = (expected == "ONE" and len(matches) == 1) or (
        expected == "MANY" and len(matches) >= 1
    )
    if not exact:
        return SemanticResolution(
            reference_id,
            None,
            entity_kind,
            producer,
            "AMBIGUOUS",
            len(matches),
            "SEMANTIC_REFERENCE_AMBIGUOUS",
            (),
        )
    if expected == "MANY":
        # V1 downstream operations intentionally accept one exact topological object only.
        return SemanticResolution(
            reference_id,
            None,
            entity_kind,
            producer,
            "AMBIGUOUS",
            len(matches),
            "SEMANTIC_REFERENCE_AMBIGUOUS",
            (),
        )
    return SemanticResolution(
        reference_id,
        entity_id(document_id, reference_id, entity_kind),
        entity_kind,
        producer,
        "EXACT",
        1,
        None,
        matches[0].lineage,
        matches[0].shape,
    )


def unique_subshapes(shape: TopoDS_Shape, kind: EntityKind) -> list[TopoDS_Shape]:
    if kind == "MESH":
        return []
    indexed = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, _TOPOLOGY_ENUMS[kind], indexed)
    caster = _CASTERS[kind]
    return [caster(indexed.FindKey(index)) for index in range(1, indexed.Extent() + 1)]


def cast_shape(shape: TopoDS_Shape, kind: EntityKind) -> TopoDS_Shape:
    if kind == "MESH":
        return shape
    return _CASTERS[kind](shape)


def topology_counts(shape: TopoDS_Shape) -> dict[str, int]:
    return {
        kind: len(unique_subshapes(shape, kind))
        for kind in ("VERTEX", "EDGE", "WIRE", "FACE", "SHELL", "SOLID", "COMPOUND")
        if kind != "COMPOUND" or shape.ShapeType() == TopAbs_COMPOUND
    }


def exact_bounds(shape: TopoDS_Shape) -> tuple[float, float, float, float, float, float]:
    bounds = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, bounds, False, False)
    if bounds.IsVoid():
        raise KernelError("OPERATION_HANDLER_FAILED", "Kernel shape has no finite bounds")
    return bounds.Get()


def mass_properties(shape: TopoDS_Shape) -> tuple[float, float]:
    surface = GProp_GProps()
    volume = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, surface)
    BRepGProp.VolumeProperties_s(shape, volume, True, True, False)
    return (surface.Mass(), volume.Mass())


def center_of_mass(shape: TopoDS_Shape, kind: str) -> tuple[float, float, float]:
    props = GProp_GProps()
    if kind == "FACE":
        BRepGProp.SurfaceProperties_s(shape, props)
    elif kind == "EDGE":
        BRepGProp.LinearProperties_s(shape, props)
    else:
        BRepGProp.VolumeProperties_s(shape, props)
    point = props.CentreOfMass()
    return (point.X(), point.Y(), point.Z())


def shape_is_valid(shape: TopoDS_Shape) -> bool:
    return not shape.IsNull() and BRepCheck_Analyzer(shape, True).IsValid()


def serialize_brep(shape: TopoDS_Shape) -> bytes:
    buffer = io.BytesIO()
    BinTools.Write_s(
        shape,
        buffer,
        False,
        False,
        BinTools_FormatVersion.BinTools_FormatVersion_VERSION_4,
    )
    return buffer.getvalue()


def deserialize_brep(payload: bytes) -> TopoDS_Shape:
    shape = TopoDS_Shape()
    try:
        BinTools.Read_s(shape, io.BytesIO(payload))
    except Exception as exc:  # OCCT binding exceptions do not share one Python base.
        raise KernelError("ARTIFACT_HASH_MISMATCH", f"Invalid BREP payload: {exc}") from exc
    if shape.IsNull():
        raise KernelError("ARTIFACT_HASH_MISMATCH", "BREP payload produced a null shape")
    return shape


def make_compound(shapes: Iterable[TopoDS_Shape]) -> TopoDS_Compound:
    compound = TopoDS_Compound()
    builder = BRep_Builder()
    builder.MakeCompound(compound)
    count = 0
    for shape in shapes:
        builder.Add(compound, shape)
        count += 1
    if count == 0:
        raise KernelError("OPERATION_HANDLER_FAILED", "Cannot create an empty body compound")
    return compound


def semantic_fingerprint_preimage(
    shape: TopoDS_Shape,
    *,
    units: dict[str, str],
    exact_entities: Sequence[tuple[str, str]],
) -> dict[str, object]:
    xmin, ymin, zmin, xmax, ymax, zmax = exact_bounds(shape)
    area, volume = mass_properties(shape)
    counts = topology_counts(shape)
    return {
        "schema_version": "forge.semantic-fingerprint/1",
        "units": dict(units),
        "bounds_mm": {
            "min": [
                canonical_decimal(xmin),
                canonical_decimal(ymin),
                canonical_decimal(zmin),
            ],
            "max": [
                canonical_decimal(xmax),
                canonical_decimal(ymax),
                canonical_decimal(zmax),
            ],
        },
        "mass_properties": {
            "area_mm2": canonical_decimal(area),
            "volume_mm3": canonical_decimal(volume),
        },
        "topology_counts": counts,
        "entities": [
            {"semantic_reference_id": reference_id, "entity_kind": kind}
            for reference_id, kind in sorted(set(exact_entities))
        ],
    }


def semantic_fingerprint(
    shape: TopoDS_Shape,
    *,
    units: dict[str, str],
    exact_entities: Sequence[tuple[str, str]],
) -> tuple[str, dict[str, object]]:
    preimage = semantic_fingerprint_preimage(
        shape, units=units, exact_entities=exact_entities
    )
    return sha256_hex(preimage), preimage


def same_shape(left: TopoDS_Shape, right: TopoDS_Shape) -> bool:
    return left.IsSame(right)


def contains_same_shape(container: TopoDS_Shape, candidate: TopoDS_Shape, kind: EntityKind) -> bool:
    return any(same_shape(item, candidate) for item in unique_subshapes(container, kind))


def edge_endpoints(edge: TopoDS_Shape) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    cast = TopoDS.Edge_s(edge)
    first = TopExp.FirstVertex_s(cast, True)
    last = TopExp.LastVertex_s(cast, True)
    p1 = BRep_Tool.Pnt_s(first)
    p2 = BRep_Tool.Pnt_s(last)
    return ((p1.X(), p1.Y(), p1.Z()), (p2.X(), p2.Y(), p2.Z()))


def vertex_point(vertex: TopoDS_Shape) -> tuple[float, float, float]:
    point = BRep_Tool.Pnt_s(TopoDS.Vertex_s(vertex))
    return (point.X(), point.Y(), point.Z())
