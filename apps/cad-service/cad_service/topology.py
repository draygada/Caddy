"""Best-effort semantic topology identity for OCCT subshapes.

Identifiers combine feature provenance with a geometric signature. Exact
signature preservation is strong evidence of identity; remaps are explicitly
reported as heuristic and topology loss is never hidden.
"""

from __future__ import annotations

import hashlib
import json
import math

from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Tool
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SOLID, TopAbs_VERTEX
from OCP.TopExp import TopExp
from OCP.TopTools import TopTools_IndexedMapOfShape
from OCP.TopoDS import TopoDS, TopoDS_Shape

from .models import Diagnostic, SemanticTopologyEntity, TopologyIdentityReport, TopologyRemap


_KINDS = (("VERTEX", TopAbs_VERTEX), ("EDGE", TopAbs_EDGE), ("FACE", TopAbs_FACE), ("SOLID", TopAbs_SOLID))


def _subshapes(shape: TopoDS_Shape, kind: int) -> list[TopoDS_Shape]:
    indexed = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, kind, indexed)
    caster = {TopAbs_VERTEX: TopoDS.Vertex_s, TopAbs_EDGE: TopoDS.Edge_s, TopAbs_FACE: TopoDS.Face_s, TopAbs_SOLID: TopoDS.Solid_s}[kind]
    return [caster(indexed.FindKey(index)) for index in range(1, indexed.Extent() + 1)]


def _rounded(values: list[float]) -> list[float]:
    return [round(float(value), 7) for value in values]


def _bounds(shape: TopoDS_Shape) -> list[float]:
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, box, False, False)
    return _rounded(list(box.Get()))


def _properties(shape: TopoDS_Shape, kind: str) -> tuple[list[float], float]:
    if kind == "VERTEX":
        point = BRep_Tool.Pnt_s(TopoDS.Vertex_s(shape))
        return _rounded([point.X(), point.Y(), point.Z()]), 0.0
    props = GProp_GProps()
    if kind == "EDGE":
        BRepGProp.LinearProperties_s(shape, props)
    elif kind == "FACE":
        BRepGProp.SurfaceProperties_s(shape, props)
    else:
        BRepGProp.VolumeProperties_s(shape, props, True, True, False)
    center = props.CentreOfMass()
    return _rounded([center.X(), center.Y(), center.Z()]), round(float(props.Mass()), 7)


def catalog_topology(shape: TopoDS_Shape, producing_feature_id: str) -> list[SemanticTopologyEntity]:
    pending: list[tuple[str, str, list[float], list[float], float]] = []
    for kind, occt_kind in _KINDS:
        for subshape in _subshapes(shape, occt_kind):
            centroid, measure = _properties(subshape, kind)
            bounds = _bounds(subshape)
            signature = hashlib.sha256(json.dumps({"kind": kind, "centroid_mm": centroid, "bounds_mm": bounds, "measure": measure}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            pending.append((kind, signature, centroid, bounds, measure))
    pending.sort(key=lambda item: (item[0], item[1], item[2], item[3]))
    counts: dict[tuple[str, str], int] = {}
    result: list[SemanticTopologyEntity] = []
    for kind, signature, centroid, bounds, measure in pending:
        key = kind, signature
        counts[key] = counts.get(key, 0) + 1
        suffix = f":{counts[key]}" if counts[key] > 1 else ""
        result.append(SemanticTopologyEntity(
            semantic_id=f"topo:{producing_feature_id}:{kind.lower()}:{signature[:16]}{suffix}",
            kind=kind,
            producing_feature_id=producing_feature_id,
            geometric_signature_sha256=signature,
            centroid_mm=centroid,
            bounds_mm=bounds,
            measure=measure,
        ))
    return result


def _distance(previous: SemanticTopologyEntity, current: SemanticTopologyEntity) -> float:
    if previous.kind != current.kind or previous.producing_feature_id != current.producing_feature_id:
        return math.inf
    values = list(zip(previous.centroid_mm + previous.bounds_mm, current.centroid_mm + current.bounds_mm))
    coordinate = sum(abs(left - right) / max(1.0, abs(left), abs(right)) for left, right in values) / max(1, len(values))
    measure = abs(previous.measure - current.measure) / max(1.0, abs(previous.measure), abs(current.measure))
    return coordinate + measure


def compare_topology(body_id: str, previous: list[SemanticTopologyEntity], current: list[SemanticTopologyEntity]) -> TopologyIdentityReport:
    previous_by_id = {item.semantic_id: item for item in previous}
    current_by_id = {item.semantic_id: item for item in current}
    preserved = sorted(set(previous_by_id) & set(current_by_id))
    old_remaining = [item for key, item in previous_by_id.items() if key not in preserved]
    new_remaining = [item for key, item in current_by_id.items() if key not in preserved]
    candidates = sorted(
        (_distance(old, new), old.semantic_id, new.semantic_id, old, new)
        for old in old_remaining
        for new in new_remaining
        if _distance(old, new) <= 0.75
    )
    used_old: set[str] = set()
    used_new: set[str] = set()
    remapped: list[TopologyRemap] = []
    for distance, old_id, new_id, _old, _new in candidates:
        if old_id in used_old or new_id in used_new:
            continue
        used_old.add(old_id)
        used_new.add(new_id)
        remapped.append(TopologyRemap(previous_semantic_id=old_id, current_semantic_id=new_id, confidence="GEOMETRIC_BEST_EFFORT", normalized_distance=distance))
    lost = sorted(item.semantic_id for item in old_remaining if item.semantic_id not in used_old)
    new = sorted(item.semantic_id for item in new_remaining if item.semantic_id not in used_new)
    diagnostics = [Diagnostic(code="TOPOLOGY_IDENTITY_BEST_EFFORT", severity="INFO", body_id=body_id, message="Semantic topology IDs combine feature provenance and geometric signatures; remaps are heuristic, not perfect persistent naming")]
    if remapped:
        diagnostics.append(Diagnostic(code="TOPOLOGY_IDENTITY_REMAPPED", severity="WARNING", body_id=body_id, message=f"{len(remapped)} topology entities changed signature and were remapped by bounded geometric similarity"))
    if lost:
        diagnostics.append(Diagnostic(code="TOPOLOGY_IDENTITY_LOST", severity="WARNING", body_id=body_id, message=f"{len(lost)} prior topology identities could not be mapped"))
    if new:
        diagnostics.append(Diagnostic(code="TOPOLOGY_IDENTITY_NEW", severity="INFO", body_id=body_id, message=f"{len(new)} topology identities are new in this revision"))
    return TopologyIdentityReport(body_id=body_id, preserved_ids=preserved, remapped=remapped, lost_ids=lost, new_ids=new, diagnostics=diagnostics)


def initial_topology_report(body_id: str, current: list[SemanticTopologyEntity]) -> TopologyIdentityReport:
    return TopologyIdentityReport(
        body_id=body_id,
        preserved_ids=[],
        remapped=[],
        lost_ids=[],
        new_ids=sorted(item.semantic_id for item in current),
        diagnostics=[Diagnostic(code="TOPOLOGY_IDENTITY_INITIAL", severity="INFO", body_id=body_id, message="Initial revision has no predecessor; all semantic topology identities are new and best-effort")],
    )
