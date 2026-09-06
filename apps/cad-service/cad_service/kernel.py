"""Direct OpenCascade execution for the stateless authoring contract."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import math
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import OCP
from OCP.BinTools import BinTools, BinTools_FormatVersion
from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Builder, BRep_Tool
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common, BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepBuilderAPI import (
    BRepBuilderAPI_MakeEdge,
    BRepBuilderAPI_MakeFace,
    BRepBuilderAPI_MakeWire,
    BRepBuilderAPI_Transform,
)
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepFilletAPI import BRepFilletAPI_MakeChamfer, BRepFilletAPI_MakeFillet
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRepPrimAPI import BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakePrism, BRepPrimAPI_MakeRevol
from OCP.GC import GC_MakeArcOfCircle, GC_MakeCircle
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.IGESControl import IGESControl_Reader, IGESControl_Writer
from OCP.Interface import Interface_Static
from OCP.STEPControl import STEPControl_AsIs, STEPControl_Reader, STEPControl_Writer
from OCP.StlAPI import StlAPI_Reader, StlAPI_Writer
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_REVERSED, TopAbs_SOLID, TopAbs_VERTEX
from OCP.TopExp import TopExp
from OCP.TopLoc import TopLoc_Location
from OCP.TopTools import TopTools_IndexedMapOfShape
from OCP.TopoDS import TopoDS, TopoDS_Compound, TopoDS_Shape
from OCP.gp import gp_Ax1, gp_Ax2, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

from .errors import CadError
from .models import (
    ArcEntity,
    AssemblyRequest,
    AssemblyResponse,
    BodyResult,
    CadDocument,
    CircleEntity,
    Diagnostic,
    ExchangeRequest,
    ExchangeResponse,
    Feature,
    InstanceResult,
    LineEntity,
    Mesh,
    Point2,
    RecomputeRequest,
    RecomputeResponse,
    Sketch,
    TransformSpec,
    Vector3,
)
from .solver import AssemblySolveError, SketchSolveError, solve_assembly_mates, solve_sketch
from .topology import catalog_topology, compare_topology, initial_topology_report


@dataclass
class ShapeRecord:
    shape: TopoDS_Shape
    producing_feature_id: str


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode()


def _hash(value: Any) -> str:
    return hashlib.sha256(_canonical_bytes(value)).hexdigest()


def document_hash(document: CadDocument) -> str:
    return _hash(document.model_dump(mode="json"))


def revision_id(document: CadDocument) -> str:
    return "cad-rev:" + document_hash(document)


def _require_finite(*values: float) -> None:
    if not all(math.isfinite(value) for value in values):
        raise CadError("NUMERIC_NONFINITE", "CAD values must be finite")


def _shape_valid(shape: TopoDS_Shape) -> bool:
    return not shape.IsNull() and BRepCheck_Analyzer(shape, True).IsValid()


def _subshapes(shape: TopoDS_Shape, kind: int) -> list[TopoDS_Shape]:
    indexed = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, kind, indexed)
    caster = {TopAbs_EDGE: TopoDS.Edge_s, TopAbs_FACE: TopoDS.Face_s, TopAbs_SOLID: TopoDS.Solid_s, TopAbs_VERTEX: TopoDS.Vertex_s}[kind]
    return [caster(indexed.FindKey(index)) for index in range(1, indexed.Extent() + 1)]


def _bounds(shape: TopoDS_Shape) -> list[float]:
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, box, False, False)
    if box.IsVoid():
        raise CadError("GEOMETRY_EMPTY", "Kernel shape has no finite bounds")
    values = list(box.Get())
    _require_finite(*values)
    return values


def _topology(shape: TopoDS_Shape) -> dict[str, int]:
    return {
        "vertices": len(_subshapes(shape, TopAbs_VERTEX)),
        "edges": len(_subshapes(shape, TopAbs_EDGE)),
        "faces": len(_subshapes(shape, TopAbs_FACE)),
        "solids": len(_subshapes(shape, TopAbs_SOLID)),
    }


def _mass(shape: TopoDS_Shape) -> tuple[float, float]:
    surface = GProp_GProps()
    volume = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, surface)
    BRepGProp.VolumeProperties_s(shape, volume, True, True, False)
    return float(surface.Mass()), float(volume.Mass())


def _serialize_brep(shape: TopoDS_Shape) -> bytes:
    stream = io.BytesIO()
    BinTools.Write_s(shape, stream, False, False, BinTools_FormatVersion.BinTools_FormatVersion_VERSION_4)
    return stream.getvalue()


def _deserialize_brep(payload: bytes) -> TopoDS_Shape:
    shape = TopoDS_Shape()
    try:
        BinTools.Read_s(shape, io.BytesIO(payload))
    except Exception as exc:
        raise CadError("BREP_INVALID", f"Invalid OCCT B-rep payload: {exc}") from exc
    if shape.IsNull() or not _shape_valid(shape):
        raise CadError("BREP_INVALID", "Payload did not produce a valid OCCT B-rep")
    return shape


def _point3(sketch: Sketch, point: Point2) -> gp_Pnt:
    origin = sketch.origin
    if sketch.plane == "XY":
        return gp_Pnt(origin.x + point.x, origin.y + point.y, origin.z)
    if sketch.plane == "XZ":
        return gp_Pnt(origin.x + point.x, origin.y, origin.z + point.y)
    return gp_Pnt(origin.x, origin.y + point.x, origin.z + point.y)


def _normal(sketch: Sketch) -> gp_Dir:
    return {"XY": gp_Dir(0, 0, 1), "XZ": gp_Dir(0, -1, 0), "YZ": gp_Dir(1, 0, 0)}[sketch.plane]


def _point_tuple(entity: LineEntity | ArcEntity | CircleEntity, endpoint: str) -> tuple[float, float]:
    if endpoint == "center" and isinstance(entity, CircleEntity):
        return entity.center.x, entity.center.y
    if endpoint in {"start", "end", "mid"} and isinstance(entity, (LineEntity, ArcEntity)):
        point = getattr(entity, endpoint)
        return point.x, point.y
    raise CadError("CONSTRAINT_REFERENCE_INVALID", f"Entity {entity.entity_id!r} has no point {endpoint!r}")


def _wire(sketch: Sketch, loop: Any) -> TopoDS_Shape:
    if len(loop.entities) == 1 and isinstance(loop.entities[0], CircleEntity):
        circle = loop.entities[0]
        curve = GC_MakeCircle(gp_Ax2(_point3(sketch, circle.center), _normal(sketch)), circle.radius).Value()
        return BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(curve).Edge()).Wire()
    if any(isinstance(item, CircleEntity) for item in loop.entities):
        raise CadError("SKETCH_LOOP_INVALID", "A circle must be the only entity in its loop")
    maker = BRepBuilderAPI_MakeWire()
    for index, item in enumerate(loop.entities):
        following = loop.entities[(index + 1) % len(loop.entities)]
        if math.dist(_point_tuple(item, "end"), _point_tuple(following, "start")) > 1e-6:
            raise CadError("SKETCH_LOOP_OPEN", f"Loop {loop.loop_id!r} is not closed in authored order")
        if isinstance(item, LineEntity):
            edge = BRepBuilderAPI_MakeEdge(_point3(sketch, item.start), _point3(sketch, item.end)).Edge()
        else:
            edge = BRepBuilderAPI_MakeEdge(GC_MakeArcOfCircle(_point3(sketch, item.start), _point3(sketch, item.mid), _point3(sketch, item.end)).Value()).Edge()
        maker.Add(edge)
    if not maker.IsDone():
        raise CadError("SKETCH_LOOP_INVALID", f"OCCT could not construct loop {loop.loop_id!r}")
    return maker.Wire()


def _face(sketch: Sketch) -> TopoDS_Shape:
    entities: dict[str, Any] = {}
    for loop in sketch.loops:
        for entity in loop.entities:
            if entity.entity_id in entities:
                raise CadError("DUPLICATE_ID", f"Duplicate sketch entity {entity.entity_id!r}")
            entities[entity.entity_id] = entity
    wires = [_wire(sketch, loop) for loop in sketch.loops]
    maker = BRepBuilderAPI_MakeFace(wires[0], True)
    for inner in wires[1:]:
        maker.Add(inner)
    maker.Build()
    if not maker.IsDone():
        raise CadError("SKETCH_FACE_INVALID", f"Sketch {sketch.sketch_id!r} does not bound a valid face")
    return maker.Face()


def _positive(parameters: dict[str, Any], name: str, feature_id: str) -> float:
    try:
        value = float(parameters[name])
    except (KeyError, TypeError, ValueError) as exc:
        raise CadError("FEATURE_PARAMETER_INVALID", f"Feature requires numeric {name!r}", feature_id=feature_id) from exc
    if not math.isfinite(value) or value <= 0:
        raise CadError("FEATURE_PARAMETER_INVALID", f"Feature parameter {name!r} must be positive", feature_id=feature_id)
    return value


def _vector(value: Any, name: str, feature_id: str) -> Vector3:
    try:
        return Vector3.model_validate(value)
    except Exception as exc:
        raise CadError("FEATURE_PARAMETER_INVALID", f"Feature requires vector {name!r}", feature_id=feature_id) from exc


def _body(bodies: dict[str, ShapeRecord], body_id: Any, feature_id: str) -> ShapeRecord:
    if not isinstance(body_id, str) or body_id not in bodies:
        raise CadError("BODY_REFERENCE_MISSING", f"Feature references missing body {body_id!r}", feature_id=feature_id)
    return bodies[body_id]


def _selected_edges(record: ShapeRecord, parameters: dict[str, Any], feature_id: str) -> list[TopoDS_Shape]:
    edges = _subshapes(record.shape, TopAbs_EDGE)
    selector = parameters.get("edge_selector", "ALL")
    if selector == "ALL":
        return edges
    if selector == "SEMANTIC_IDS":
        requested = parameters.get("edge_ids")
        if not isinstance(requested, list) or not requested or not all(isinstance(item, str) for item in requested):
            raise CadError("EDGE_SELECTOR_INVALID", "edge_ids must be a non-empty string list", feature_id=feature_id)
        semantic = [item for item in catalog_topology(record.shape, record.producing_feature_id) if item.kind == "EDGE"]
        by_id = {item.semantic_id: edge for item, edge in zip(semantic, edges)}
        missing = sorted(set(requested) - set(by_id))
        if missing:
            raise CadError("EDGE_SELECTOR_STALE", f"Semantic edge IDs do not exist in the current revision: {missing}", feature_id=feature_id)
        return [by_id[item] for item in sorted(set(requested))]
    if selector != "EDGE_INDICES":
        raise CadError("EDGE_SELECTOR_UNSUPPORTED", f"Unsupported edge selector {selector!r}", feature_id=feature_id)
    indices = parameters.get("edge_indices")
    if not isinstance(indices, list) or not indices or not all(isinstance(index, int) and not isinstance(index, bool) for index in indices):
        raise CadError("EDGE_SELECTOR_INVALID", "edge_indices must be a non-empty integer list", feature_id=feature_id)
    if min(indices) < 0 or max(indices) >= len(edges):
        raise CadError("EDGE_SELECTOR_STALE", "Edge index does not exist in the current revision", feature_id=feature_id)
    return [edges[index] for index in sorted(set(indices))]


def _transform(spec: TransformSpec) -> gp_Trsf:
    axis = spec.rotation_axis
    _require_finite(axis.x, axis.y, axis.z, spec.rotation_degrees, spec.translation.x, spec.translation.y, spec.translation.z)
    if math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z) <= 1e-12:
        raise CadError("TRANSFORM_AXIS_INVALID", "Rotation axis cannot be zero")
    result = gp_Trsf()
    if abs(spec.rotation_degrees) > 1e-12:
        result.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(axis.x, axis.y, axis.z)), math.radians(spec.rotation_degrees))
    result.SetTranslationPart(gp_Vec(spec.translation.x, spec.translation.y, spec.translation.z))
    return result


def _validate_graph(features: list[Feature]) -> None:
    ids = [feature.feature_id for feature in features]
    if len(ids) != len(set(ids)):
        raise CadError("DUPLICATE_ID", "Feature IDs must be unique")
    all_ids = set(ids)
    seen: set[str] = set()
    for feature in features:
        if len(feature.depends_on) != len(set(feature.depends_on)):
            raise CadError("DUPLICATE_ID", f"Feature {feature.feature_id!r} repeats a dependency", feature_id=feature.feature_id)
        missing = set(feature.depends_on) - all_ids
        if missing:
            raise CadError("DEPENDENCY_MISSING", f"Feature {feature.feature_id!r} has missing dependencies {sorted(missing)!r}", feature_id=feature.feature_id)
        later = set(feature.depends_on) - seen
        if later:
            raise CadError("DEPENDENCY_ORDER_INVALID", f"Feature {feature.feature_id!r} depends on a later feature", feature_id=feature.feature_id)
        seen.add(feature.feature_id)


def _execute(feature: Feature, sketches: dict[str, Sketch], feature_shapes: dict[str, TopoDS_Shape], bodies: dict[str, ShapeRecord]) -> TopoDS_Shape | None:
    kind = feature.kind.upper()
    p = feature.parameters
    fid = feature.feature_id
    if kind == "SKETCH":
        sketch_id = p.get("sketch_id")
        if not isinstance(sketch_id, str) or sketch_id not in sketches:
            raise CadError("SKETCH_REFERENCE_MISSING", f"Feature references missing sketch {sketch_id!r}", feature_id=fid)
        return _face(sketches[sketch_id])
    if kind in {"EXTRUDE", "REVOLVE"}:
        source_id = p.get("sketch_feature_id")
        if not isinstance(source_id, str) or source_id not in feature_shapes:
            raise CadError("FEATURE_INPUT_MISSING", f"{kind} requires a prior sketch feature", feature_id=fid)
        face = feature_shapes[source_id]
        if kind == "EXTRUDE":
            distance = _positive(p, "distance_mm", fid)
            direction = _vector(p.get("direction", {"x": 0, "y": 0, "z": 1}), "direction", fid)
            if math.sqrt(direction.x**2 + direction.y**2 + direction.z**2) <= 1e-12:
                raise CadError("FEATURE_PARAMETER_INVALID", "Extrude direction cannot be zero", feature_id=fid)
            shape = BRepPrimAPI_MakePrism(face, gp_Vec(direction.x * distance, direction.y * distance, direction.z * distance), True, True).Shape()
        else:
            angle = _positive(p, "angle_degrees", fid)
            if angle > 360:
                raise CadError("FEATURE_PARAMETER_INVALID", "Revolve angle cannot exceed 360 degrees", feature_id=fid)
            origin = _vector(p.get("axis_origin", {}), "axis_origin", fid)
            direction = _vector(p.get("axis_direction", {"x": 0, "y": 1, "z": 0}), "axis_direction", fid)
            shape = BRepPrimAPI_MakeRevol(face, gp_Ax1(gp_Pnt(origin.x, origin.y, origin.z), gp_Dir(direction.x, direction.y, direction.z)), math.radians(angle), True).Shape()
    elif kind == "BOOLEAN":
        left = _body(bodies, p.get("left_body_id"), fid).shape
        right = _body(bodies, p.get("right_body_id"), fid).shape
        mode = str(p.get("mode", "")).upper()
        algorithm_type = {"UNION": BRepAlgoAPI_Fuse, "CUT": BRepAlgoAPI_Cut, "INTERSECT": BRepAlgoAPI_Common}.get(mode)
        if algorithm_type is None:
            raise CadError("BOOLEAN_MODE_UNSUPPORTED", f"Unsupported boolean mode {mode!r}", feature_id=fid)
        algorithm = algorithm_type(left, right)
        algorithm.SetRunParallel(False)
        algorithm.SetFuzzyValue(1e-7)
        algorithm.SetNonDestructive(True)
        algorithm.Build()
        if not algorithm.IsDone():
            raise CadError("KERNEL_OPERATION_FAILED", f"OCCT boolean {mode} failed", feature_id=fid)
        shape = algorithm.Shape()
    elif kind == "HOLE":
        target = _body(bodies, p.get("target_body_id"), fid).shape
        diameter = _positive(p, "diameter_mm", fid)
        depth = _positive(p, "depth_mm", fid)
        center = _vector(p.get("center", {}), "center", fid)
        direction = _vector(p.get("direction", {"z": 1}), "direction", fid)
        tool = BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(center.x, center.y, center.z), gp_Dir(direction.x, direction.y, direction.z)), diameter / 2.0, depth).Shape()
        algorithm = BRepAlgoAPI_Cut(target, tool)
        algorithm.SetRunParallel(False)
        algorithm.Build()
        if not algorithm.IsDone():
            raise CadError("KERNEL_OPERATION_FAILED", "OCCT hole cut failed", feature_id=fid)
        shape = algorithm.Shape()
    elif kind in {"FILLET", "CHAMFER"}:
        source_record = _body(bodies, p.get("target_body_id"), fid)
        source = source_record.shape
        edges = _selected_edges(source_record, p, fid)
        if kind == "FILLET":
            maker = BRepFilletAPI_MakeFillet(source)
            amount = _positive(p, "radius_mm", fid)
        else:
            maker = BRepFilletAPI_MakeChamfer(source)
            amount = _positive(p, "distance_mm", fid)
        for edge in edges:
            maker.Add(amount, edge)
        maker.Build()
        if not maker.IsDone():
            raise CadError("KERNEL_OPERATION_FAILED", f"OCCT {kind.lower()} failed for selected edges", feature_id=fid)
        shape = maker.Shape()
    elif kind == "TRANSFORM":
        source = _body(bodies, p.get("target_body_id"), fid).shape
        try:
            spec = TransformSpec.model_validate(p.get("transform", {}))
        except Exception as exc:
            raise CadError("FEATURE_PARAMETER_INVALID", "Invalid transform payload", feature_id=fid) from exc
        maker = BRepBuilderAPI_Transform(source, _transform(spec), True)
        maker.Build()
        if not maker.IsDone():
            raise CadError("KERNEL_OPERATION_FAILED", "OCCT transform failed", feature_id=fid)
        shape = maker.Shape()
    else:
        raise CadError("FEATURE_KIND_UNSUPPORTED", f"Unsupported CAD feature {feature.kind!r}", feature_id=fid)
    if shape.IsNull() or not _shape_valid(shape) or not _subshapes(shape, TopAbs_SOLID):
        raise CadError("KERNEL_RESULT_INVALID", f"Feature {fid!r} did not produce valid solid B-rep geometry", feature_id=fid)
    if not feature.output_body_id:
        raise CadError("OUTPUT_BODY_REQUIRED", f"Feature {fid!r} must name output_body_id", feature_id=fid)
    bodies[feature.output_body_id] = ShapeRecord(shape, fid)
    return shape


def _mesh(shape: TopoDS_Shape, linear: float, angular: float) -> Mesh:
    mesher = BRepMesh_IncrementalMesh(shape, linear, False, math.radians(angular), False)
    mesher.Perform()
    if not mesher.IsDone():
        raise CadError("MESH_FAILED", "OCCT tessellation failed")
    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    for face in _subshapes(shape, TopAbs_FACE):
        location = TopLoc_Location()
        triangulation = BRep_Tool.Triangulation_s(face, location)
        if triangulation is None:
            continue
        transform = location.Transformation()
        reversed_face = face.Orientation() == TopAbs_REVERSED
        for triangle_index in range(1, triangulation.NbTriangles() + 1):
            node_indices = list(triangulation.Triangle(triangle_index).Get())
            if reversed_face:
                node_indices[1], node_indices[2] = node_indices[2], node_indices[1]
            points = []
            for node_index in node_indices:
                point = triangulation.Node(node_index).Transformed(transform)
                points.append((point.X(), point.Y(), point.Z()))
            a, b, c = points
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            if length <= 1e-18:
                continue
            normal = (nx / length, ny / length, nz / length)
            for point in points:
                positions.extend(point)
                normals.extend(normal)
                indices.append(len(indices))
    return Mesh(positions=positions, normals=normals, indices=indices, triangle_count=len(indices) // 3)


def _body_result(body_id: str, record: ShapeRecord, linear: float, angular: float) -> BodyResult:
    brep = _serialize_brep(record.shape)
    area, volume = _mass(record.shape)
    return BodyResult(
        body_id=body_id,
        producing_feature_id=record.producing_feature_id,
        brep_base64=base64.b64encode(brep).decode(),
        brep_sha256=hashlib.sha256(brep).hexdigest(),
        valid=_shape_valid(record.shape),
        bounds_mm=_bounds(record.shape),
        topology=_topology(record.shape),
        area_mm2=area,
        volume_mm3=volume,
        mesh=_mesh(record.shape, linear, angular),
        semantic_topology=catalog_topology(record.shape, record.producing_feature_id),
    )


def _execute_document(document: CadDocument) -> tuple[dict[str, ShapeRecord], dict[str, str], list[Any], list[Diagnostic]]:
    _validate_graph(document.features)
    source_sketches = {sketch.sketch_id: sketch for sketch in document.sketches}
    if len(source_sketches) != len(document.sketches):
        raise CadError("DUPLICATE_ID", "Sketch IDs must be unique")
    sketches: dict[str, Sketch] = {}
    reports: list[Any] = []
    diagnostics: list[Diagnostic] = []
    for sketch_id in sorted(source_sketches):
        try:
            solved, report = solve_sketch(source_sketches[sketch_id])
        except SketchSolveError as exc:
            raise CadError("CONSTRAINT_UNSATISFIED", str(exc)) from exc
        sketches[sketch_id] = solved
        reports.append(report)
        if report.status == "UNDER_CONSTRAINED":
            diagnostics.append(Diagnostic(code="SKETCH_UNDERCONSTRAINED", severity="WARNING", message=f"Sketch {sketch_id!r} solved with approximately {report.degrees_of_freedom} remaining degrees of freedom"))
        else:
            diagnostics.append(Diagnostic(code="SKETCH_CONSTRAINTS_SOLVED", severity="INFO", message=f"Sketch {sketch_id!r} satisfied all supported constraints in {report.iterations} bounded iterations"))
    feature_shapes: dict[str, TopoDS_Shape] = {}
    bodies: dict[str, ShapeRecord] = {}
    statuses: dict[str, str] = {}
    for feature in document.features:
        if not feature.enabled:
            statuses[feature.feature_id] = "DISABLED"
            continue
        shape = _execute(feature, sketches, feature_shapes, bodies)
        if shape is not None:
            feature_shapes[feature.feature_id] = shape
        statuses[feature.feature_id] = "SUCCEEDED"
    if not bodies:
        raise CadError("GEOMETRY_EMPTY", "Document produced no bodies")
    return bodies, statuses, reports, diagnostics


def recompute(request: RecomputeRequest) -> RecomputeResponse:
    candidate = request.candidate_document
    if request.base_document is None:
        if candidate.parent_revision_id is not None:
            raise CadError("STALE_BASE_REVISION", "A root document cannot declare a parent revision")
    else:
        if request.base_document.document_id != candidate.document_id:
            raise CadError("DOCUMENT_ID_MISMATCH", "Base and candidate document IDs differ")
        computed_base = revision_id(request.base_document)
        if request.expected_base_revision_id != computed_base or candidate.parent_revision_id != computed_base:
            raise CadError("STALE_BASE_REVISION", "Expected base or candidate parent does not match the supplied base document")
    bodies, statuses, constraint_reports, diagnostics = _execute_document(candidate)
    body_results = [_body_result(body_id, bodies[body_id], request.linear_deflection_mm, request.angular_deflection_deg) for body_id in sorted(bodies)]
    doc_hash = document_hash(candidate)
    geometry_hash = _hash({"document_hash": doc_hash, "bodies": [{"body_id": body.body_id, "brep_sha256": body.brep_sha256} for body in body_results]})
    current_topology = {body.body_id: body.semantic_topology for body in body_results}
    if request.base_document is None:
        topology_identity = [initial_topology_report(body_id, current_topology[body_id]) for body_id in sorted(current_topology)]
    else:
        base_bodies, _base_statuses, _base_reports, _base_diagnostics = _execute_document(request.base_document)
        base_topology = {body_id: catalog_topology(record.shape, record.producing_feature_id) for body_id, record in base_bodies.items()}
        topology_identity = [compare_topology(body_id, base_topology.get(body_id, []), current_topology[body_id]) for body_id in sorted(current_topology)]
    for report in topology_identity:
        diagnostics.extend(report.diagnostics)
    return RecomputeResponse(
        document_id=candidate.document_id,
        revision_id="cad-rev:" + doc_hash,
        parent_revision_id=candidate.parent_revision_id,
        document_hash=doc_hash,
        geometry_hash=geometry_hash,
        kernel={"name": "OpenCascade", "version": "7.9.3", "binding": f"cadquery-ocp-novtk/{OCP.__version__}"},
        operation_status=statuses,
        bodies=body_results,
        diagnostics=diagnostics,
        constraint_reports=constraint_reports,
        topology_identity=topology_identity,
    )


def _matrix(transform: gp_Trsf) -> list[float]:
    return [transform.Value(row, column) if row <= 3 else (1.0 if column == 4 else 0.0) for row in range(1, 5) for column in range(1, 5)]


def _world_point(transform: gp_Trsf, value: Vector3) -> gp_Pnt:
    return gp_Pnt(value.x, value.y, value.z).Transformed(transform)


def _world_dir(transform: gp_Trsf, value: Vector3) -> gp_Dir:
    return gp_Dir(value.x, value.y, value.z).Transformed(transform)


def _translation_delta(dx: float, dy: float, dz: float) -> gp_Trsf:
    result = gp_Trsf()
    result.SetTranslation(gp_Vec(dx, dy, dz))
    return result


def _compound(shapes: Iterable[TopoDS_Shape]) -> TopoDS_Compound:
    result = TopoDS_Compound()
    builder = BRep_Builder()
    builder.MakeCompound(result)
    count = 0
    for shape in shapes:
        builder.Add(result, shape)
        count += 1
    if count == 0:
        raise CadError("ASSEMBLY_EMPTY", "Assembly has no shapes")
    return result


def assemble(request: AssemblyRequest) -> AssemblyResponse:
    instances = {item.instance_id: item for item in request.instances}
    if len(instances) != len(request.instances):
        raise CadError("DUPLICATE_ID", "Assembly instance IDs must be unique")
    shapes = {item.instance_id: _deserialize_brep(base64.b64decode(item.brep_base64, validate=True)) for item in request.instances}
    initial_transforms = {item.instance_id: _transform(item.transform) for item in request.instances}
    try:
        transforms, mate_reports, diagnostics = solve_assembly_mates(request, initial_transforms)
    except AssemblySolveError as exc:
        raise CadError(exc.code, str(exc)) from exc
    transformed: dict[str, TopoDS_Shape] = {}
    instance_results: list[InstanceResult] = []
    for instance_id in sorted(instances):
        maker = BRepBuilderAPI_Transform(shapes[instance_id], transforms[instance_id], True)
        maker.Build()
        if not maker.IsDone() or not _shape_valid(maker.Shape()):
            raise CadError("ASSEMBLY_TRANSFORM_FAILED", f"Transform failed for {instance_id!r}")
        transformed[instance_id] = maker.Shape()
        instance_results.append(InstanceResult(instance_id=instance_id, body_id=instances[instance_id].body_id, world_matrix4x4_row_major=_matrix(transforms[instance_id]), bounds_mm=_bounds(maker.Shape())))
    compound = _compound(transformed.values())
    assembly_hash = _hash({"request": request.model_dump(mode="json"), "matrices": {key: _matrix(transforms[key]) for key in sorted(transforms)}})
    record = ShapeRecord(compound, "assembly:compose")
    return AssemblyResponse(
        assembly_id=request.assembly_id,
        assembly_revision_id="assembly-rev:" + assembly_hash,
        geometry_hash=_hash({"assembly_hash": assembly_hash, "brep_sha256": hashlib.sha256(_serialize_brep(compound)).hexdigest()}),
        instances=instance_results,
        assembly_body=_body_result("assembly-body:" + request.assembly_id, record, request.linear_deflection_mm, request.angular_deflection_deg),
        diagnostics=diagnostics,
        mate_reports=mate_reports,
    )


def _write_step(shape: TopoDS_Shape) -> bytes:
    Interface_Static.SetCVal_s("write.step.schema", "AP242DIS")
    Interface_Static.SetCVal_s("write.step.unit", "MM")
    writer = STEPControl_Writer()
    if writer.Transfer(shape, STEPControl_AsIs) != IFSelect_RetDone:
        raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT STEP transfer failed")
    stream = io.BytesIO()
    if writer.WriteStream(stream) != IFSelect_RetDone:
        raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT STEP write failed")
    return stream.getvalue()


def _read_step(payload: bytes) -> TopoDS_Shape:
    reader = STEPControl_Reader()
    if reader.ReadStream("inline.step", io.BytesIO(payload)) != IFSelect_RetDone or reader.TransferRoots() < 1:
        raise CadError("EXCHANGE_IMPORT_FAILED", "OCCT STEP import failed")
    return reader.OneShape()


def _write_iges(shape: TopoDS_Shape) -> bytes:
    with tempfile.TemporaryDirectory(prefix="caddydaddy-iges-") as directory:
        path = Path(directory) / "artifact.iges"
        writer = IGESControl_Writer("MM", 0)
        if not writer.AddShape(shape):
            raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT IGES transfer failed")
        writer.ComputeModel()
        if not writer.Write(str(path)):
            raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT IGES write failed")
        return path.read_bytes()


def _read_iges(payload: bytes) -> TopoDS_Shape:
    with tempfile.TemporaryDirectory(prefix="caddydaddy-iges-") as directory:
        path = Path(directory) / "artifact.iges"
        path.write_bytes(payload)
        reader = IGESControl_Reader()
        if reader.ReadFile(str(path)) != IFSelect_RetDone or reader.TransferRoots() < 1:
            raise CadError("EXCHANGE_IMPORT_FAILED", "OCCT IGES import failed")
        return reader.OneShape()


def _write_stl(shape: TopoDS_Shape, request: ExchangeRequest) -> bytes:
    mesher = BRepMesh_IncrementalMesh(shape, request.linear_deflection_mm, False, math.radians(request.angular_deflection_deg), False)
    mesher.Perform()
    if not mesher.IsDone():
        raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT STL tessellation failed")
    with tempfile.TemporaryDirectory(prefix="caddydaddy-stl-") as directory:
        path = Path(directory) / "artifact.stl"
        writer = StlAPI_Writer()
        writer.ASCIIMode = not request.binary_stl
        if not writer.Write(shape, str(path)):
            raise CadError("EXCHANGE_EXPORT_FAILED", "OCCT STL write failed")
        return path.read_bytes()


def _read_stl(payload: bytes) -> TopoDS_Shape:
    with tempfile.TemporaryDirectory(prefix="caddydaddy-stl-") as directory:
        path = Path(directory) / "artifact.stl"
        path.write_bytes(payload)
        shape = TopoDS_Shape()
        if not StlAPI_Reader().Read(shape, str(path)) or shape.IsNull():
            raise CadError("EXCHANGE_IMPORT_FAILED", "OCCT STL import failed")
        return shape


def exchange(request: ExchangeRequest) -> ExchangeResponse:
    format_name = request.format.upper()
    if format_name not in {"STEP", "IGES", "STL"}:
        raise CadError("EXCHANGE_FORMAT_UNSUPPORTED", f"Unsupported exchange format {request.format!r}; native assemblies, drawings, and manufacturing outputs are not implemented")
    try:
        content = base64.b64decode(request.content_base64, validate=True)
    except Exception as exc:
        raise CadError("EXCHANGE_PAYLOAD_INVALID", "content_base64 is not valid base64") from exc
    if request.direction == "EXPORT":
        shape = _deserialize_brep(content)
        output = {"STEP": _write_step, "IGES": _write_iges}.get(format_name)
        exported = output(shape) if output else _write_stl(shape, request)
        imported = {"STEP": _read_step, "IGES": _read_iges, "STL": _read_stl}[format_name](exported)
        result_content = exported
    else:
        imported = {"STEP": _read_step, "IGES": _read_iges, "STL": _read_stl}[format_name](content)
        shape = imported
        result_content = content
    if imported.IsNull():
        raise CadError("EXCHANGE_VERIFICATION_FAILED", "Re-import produced a null OCCT shape")
    exact = format_name in {"STEP", "IGES"}
    source_bounds = _bounds(shape)
    imported_bounds = _bounds(imported)
    tolerance = request.linear_deflection_mm if format_name == "STL" else 1e-5
    bounds_match = all(abs(left - right) <= tolerance for left, right in zip(source_bounds, imported_bounds))
    if request.direction == "EXPORT" and not bounds_match:
        raise CadError("EXCHANGE_VERIFICATION_FAILED", f"{format_name} re-import bounds differ from source")
    brep = _serialize_brep(imported) if exact else None
    return ExchangeResponse(
        request_id=request.request_id,
        direction=request.direction,
        format=format_name,
        exact_geometry=exact,
        editable_brep=exact,
        content_base64=base64.b64encode(result_content).decode(),
        content_sha256=hashlib.sha256(result_content).hexdigest(),
        brep_base64=base64.b64encode(brep).decode() if brep else None,
        bounds_mm=imported_bounds,
        topology=_topology(imported),
        verification=[{"code": "OCCT_REIMPORT_NON_NULL", "status": "PASSED"}, {"code": "BOUNDS_MATCH", "status": "PASSED" if bounds_match else "NOT_APPLICABLE", "tolerance_mm": tolerance}],
        diagnostics=[Diagnostic(code="MESH_ONLY_IMPORT", severity="WARNING", message="STL is retained as non-editable mesh geometry") ] if format_name == "STL" else [],
    )


def capabilities() -> dict[str, Any]:
    return {
        "schema_version": "caddydaddy.cad-capabilities/1",
        "kernel": {"name": "OpenCascade", "version": "7.9.3", "binding": f"cadquery-ocp-novtk/{OCP.__version__}"},
        "features": ["SKETCH", "EXTRUDE", "REVOLVE", "BOOLEAN", "HOLE", "FILLET", "CHAMFER", "TRANSFORM"],
        "constraints": {"mode": "VALIDATE_ONLY", "authoring_mode": "DETERMINISTIC_BOUNDED_SOLVE", "reports": ["RESIDUALS", "RANK", "DEGREES_OF_FREEDOM", "UNDER_CONSTRAINED", "OVER_CONSTRAINED"], "types": ["COINCIDENT", "HORIZONTAL", "VERTICAL", "DISTANCE", "EQUAL", "EQUAL_LENGTH", "RADIUS", "PARALLEL", "PERPENDICULAR", "ANGLE", "FIXED"]},
        "topology_identity": {"mode": "SEMANTIC_BEST_EFFORT", "basis": ["FEATURE_PROVENANCE", "GEOMETRIC_SIGNATURE"], "diagnostics": ["PRESERVED", "REMAPPED", "LOST", "NEW"], "perfect_persistent_naming": False},
        "mates": {"solver": "DETERMINISTIC_BOUNDED_RIGID", "types": ["FIXED", "POINT_COINCIDENT", "DISTANCE", "AXIS_CONCENTRIC"], "general_nonlinear_solver": False},
        "exchange": {"exact": ["STEP_AP242", "IGES_5_3"], "mesh_only": ["STL"], "unsupported": ["NATIVE_ASSEMBLY", "DRAWING", "CAM", "GCODE"]},
        "state": "STATELESS",
    }
