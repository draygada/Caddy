"""Real OCCT-backed operations registered behind the generic evaluator."""

from __future__ import annotations

import math
from typing import Any, Iterable, Mapping, Sequence

from OCP.BRepAlgoAPI import BRepAlgoAPI_Common, BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepBuilderAPI import (
    BRepBuilderAPI_MakeEdge,
    BRepBuilderAPI_MakeFace,
    BRepBuilderAPI_MakeWire,
    BRepBuilderAPI_Transform,
)
from OCP.BRepFilletAPI import BRepFilletAPI_MakeChamfer, BRepFilletAPI_MakeFillet
from OCP.BRepPrimAPI import (
    BRepPrimAPI_MakeBox,
    BRepPrimAPI_MakeCylinder,
    BRepPrimAPI_MakePrism,
    BRepPrimAPI_MakeRevol,
)
from OCP.BRepTools import BRepTools_WireExplorer
from OCP.gp import gp_Ax1, gp_Ax2, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

from .diagnostics import KernelError
from .registry import (
    OperationDescriptor,
    OperationExecutionContext,
    OperationOutput,
    OperationRegistry,
    ParameterSlot,
    PayloadField,
    object_schema,
)
from .topology import (
    Body,
    KernelShape,
    LineageEvent,
    ProducedEntity,
    cast_shape,
    contains_same_shape,
    edge_endpoints,
    exact_bounds,
    make_compound,
    shape_is_valid,
    unique_subshapes,
    vertex_point,
)


def _slot(
    name: str,
    label: str,
    value_type: str,
    order: int,
    *,
    default: str,
    minimum: str | None = None,
    maximum: str | None = None,
    step: str | None = None,
) -> ParameterSlot:
    return ParameterSlot(
        slot=name,
        label=label,
        value_type=value_type,
        required=True,
        default_literal=default,
        minimum_literal=minimum,
        maximum_literal=maximum,
        step_literal=step,
        order=order,
    )


def _descriptor(
    operation_type: str,
    label: str,
    category: str,
    description: str,
    *,
    slots: Sequence[ParameterSlot] = (),
    payload_schema: Mapping[str, Any] | None = None,
    payload_fields: Sequence[PayloadField] = (),
    input_kinds: Sequence[str] = (),
    output_roles: Sequence[str] = ("result",),
) -> OperationDescriptor:
    return OperationDescriptor(
        type=operation_type,
        type_version=1,
        display={
            "label": label,
            "category": category,
            "description": description,
        },
        payload_schema=payload_schema or object_schema(),
        payload_fields=tuple(payload_fields),
        parameter_slots=tuple(slots),
        input_kinds=tuple(input_kinds),
        output_roles=tuple(output_roles),
    )


def _value(context: OperationExecutionContext, name: str) -> float:
    try:
        return context.parameters[name].as_float()
    except KeyError as exc:
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            f"Missing parameter slot {name!r}",
            operation_id=context.operation_id,
        ) from exc


def _positive(context: OperationExecutionContext, name: str) -> float:
    result = _value(context, name)
    if result <= 0:
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            f"Parameter slot {name!r} must be positive",
            operation_id=context.operation_id,
        )
    return result


def _integer(context: OperationExecutionContext, name: str, minimum: int = 1) -> int:
    value = context.parameters[name]
    if value.value_type != "INTEGER" or value.rational.denominator != 1:
        raise KernelError(
            "PARAMETER_TYPE_MISMATCH",
            f"Parameter slot {name!r} must be an integer",
            operation_id=context.operation_id,
        )
    result = value.rational.numerator
    if result < minimum:
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            f"Parameter slot {name!r} must be at least {minimum}",
            operation_id=context.operation_id,
        )
    return result


def _kernel_input(context: OperationExecutionContext, index: int = 0) -> KernelShape:
    try:
        value = context.inputs[index].value
    except IndexError as exc:
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            "Operation dependency output is missing",
            operation_id=context.operation_id,
        ) from exc
    if not isinstance(value, KernelShape):
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            "Dependency is not an OCCT kernel shape",
            operation_id=context.operation_id,
        )
    return value


def _result(context: OperationExecutionContext, value: KernelShape) -> OperationOutput:
    if not shape_is_valid(value.shape):
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            "OCCT operation returned an invalid shape",
            operation_id=context.operation_id,
        )
    return OperationOutput(
        kind=value.kind,
        value=value,
        entities=list(value.entities),
        deleted_semantic_ids=set(value.deleted_reference_ids),
    )


def _single_solid(shape: Any) -> Any:
    solids = unique_subshapes(shape, "SOLID")
    return solids[0] if len(solids) == 1 else shape


def _entity(
    context: OperationExecutionContext,
    kind: str,
    role: str,
    shape: Any,
    *,
    event: str = "GENERATED",
    source_reference_id: str | None = None,
) -> ProducedEntity:
    return ProducedEntity(
        producing_operation_id=context.operation_id,
        entity_kind=kind,  # type: ignore[arg-type]
        semantic_role=role,
        shape=cast_shape(shape, kind),  # type: ignore[arg-type]
        lineage=(
            LineageEvent(
                operation_id=context.operation_id,
                event=event,  # type: ignore[arg-type]
                source_reference_id=source_reference_id,
            ),
        ),
    )


def _side(value: float, maximum: float, tolerance: float = 1e-9) -> str:
    if abs(value) <= tolerance:
        return "min"
    if abs(value - maximum) <= tolerance:
        return "max"
    return "mid"


def _box(context: OperationExecutionContext) -> OperationOutput:
    dx = _positive(context, "length")
    dy = _positive(context, "width")
    dz = _positive(context, "height")
    maker = BRepPrimAPI_MakeBox(dx, dy, dz)
    shape = maker.Shape()
    entities = [
        _entity(context, "SOLID", "result", shape),
        _entity(context, "FACE", "face:x:min", maker.LeftFace()),
        _entity(context, "FACE", "face:x:max", maker.RightFace()),
        _entity(context, "FACE", "face:y:min", maker.FrontFace()),
        _entity(context, "FACE", "face:y:max", maker.BackFace()),
        _entity(context, "FACE", "face:z:min", maker.BottomFace()),
        _entity(context, "FACE", "face:z:max", maker.TopFace()),
    ]
    for edge in unique_subshapes(shape, "EDGE"):
        start, end = edge_endpoints(edge)
        differing = [axis for axis in range(3) if abs(start[axis] - end[axis]) > 1e-9]
        if len(differing) != 1:
            continue
        span = "xyz"[differing[0]]
        fixed = [axis for axis in range(3) if axis != differing[0]]
        maxima = (dx, dy, dz)
        labels = [f"{'xyz'[axis]}:{_side(start[axis], maxima[axis])}" for axis in fixed]
        entities.append(_entity(context, "EDGE", f"edge:{span}:{'/'.join(labels)}", edge))
    for vertex in unique_subshapes(shape, "VERTEX"):
        point = vertex_point(vertex)
        role = "vertex:" + "/".join(
            f"{'xyz'[axis]}:{_side(point[axis], (dx, dy, dz)[axis])}"
            for axis in range(3)
        )
        entities.append(_entity(context, "VERTEX", role, vertex))
    kernel = KernelShape(kind="SOLID", shape=shape, entities=entities)
    kernel.bodies.append(Body(f"body:{context.operation_id}", context.operation_id, shape, entities))
    return _result(context, kernel)


def _cylinder(context: OperationExecutionContext) -> OperationOutput:
    radius = _positive(context, "radius")
    height = _positive(context, "height")
    maker = BRepPrimAPI_MakeCylinder(radius, height)
    shape = maker.Shape()
    entities = [_entity(context, "SOLID", "result", shape)]
    for face in unique_subshapes(shape, "FACE"):
        _, _, zmin, _, _, zmax = exact_bounds(face)
        if abs(zmax - zmin) < 1e-9:
            role = "face:cap:start" if abs(zmin) < 1e-9 else "face:cap:end"
        else:
            role = "face:side"
        entities.append(_entity(context, "FACE", role, face))
    for edge in unique_subshapes(shape, "EDGE"):
        _, _, zmin, _, _, zmax = exact_bounds(edge)
        if abs(zmax - zmin) < 1e-9:
            role = "edge:rim:start" if abs(zmin) < 1e-9 else "edge:rim:end"
        else:
            role = "edge:seam"
        entities.append(_entity(context, "EDGE", role, edge))
    kernel = KernelShape(kind="SOLID", shape=shape, entities=entities)
    kernel.bodies.append(Body(f"body:{context.operation_id}", context.operation_id, shape, entities))
    return _result(context, kernel)


def _plane_axes(plane: str) -> tuple[gp_Dir, callable]:
    if plane == "XY":
        return gp_Dir(0, 0, 1), lambda u, v: gp_Pnt(u, v, 0)
    if plane == "XZ":
        return gp_Dir(0, -1, 0), lambda u, v: gp_Pnt(u, 0, v)
    if plane == "YZ":
        return gp_Dir(1, 0, 0), lambda u, v: gp_Pnt(0, u, v)
    raise KernelError("OPERATION_PAYLOAD_INVALID", f"Unsupported plane {plane!r}")


def _rectangle(context: OperationExecutionContext) -> OperationOutput:
    width = _positive(context, "width")
    height = _positive(context, "height")
    plane = str(context.payload["plane"])
    normal, point = _plane_axes(plane)
    centered = bool(context.payload["centered"])
    u0, v0 = (-width / 2, -height / 2) if centered else (0.0, 0.0)
    points = [
        point(u0, v0),
        point(u0 + width, v0),
        point(u0 + width, v0 + height),
        point(u0, v0 + height),
    ]
    wire_maker = BRepBuilderAPI_MakeWire()
    for index in range(4):
        wire_maker.Add(BRepBuilderAPI_MakeEdge(points[index], points[(index + 1) % 4]).Edge())
    wire = wire_maker.Wire()
    explorer = BRepTools_WireExplorer(wire)
    edges: list[Any] = []
    vertices: list[Any] = []
    while explorer.More():
        edges.append(explorer.Current())
        vertices.append(explorer.CurrentVertex())
        explorer.Next()
    edge_roles = ("segment:bottom", "segment:right", "segment:top", "segment:left")
    vertex_roles = (
        "corner:bottom-left",
        "corner:bottom-right",
        "corner:top-right",
        "corner:top-left",
    )
    entities = [_entity(context, "WIRE", "profile", wire)]
    entities.extend(
        _entity(context, "EDGE", role, edge) for role, edge in zip(edge_roles, edges)
    )
    entities.extend(
        _entity(context, "VERTEX", role, vertex)
        for role, vertex in zip(vertex_roles, vertices)
    )
    kernel = KernelShape(kind="WIRE", shape=wire, entities=entities)
    kernel_metadata = {"normal": (normal.X(), normal.Y(), normal.Z())}
    return OperationOutput(kind="WIRE", value=kernel, entities=entities, metadata=kernel_metadata)


def _circle(context: OperationExecutionContext) -> OperationOutput:
    from OCP.GC import GC_MakeCircle

    radius = _positive(context, "radius")
    plane = str(context.payload["plane"])
    normal, _ = _plane_axes(plane)
    circle = GC_MakeCircle(gp_Ax2(gp_Pnt(0, 0, 0), normal), radius).Value()
    edge = BRepBuilderAPI_MakeEdge(circle).Edge()
    wire = BRepBuilderAPI_MakeWire(edge).Wire()
    entities = [
        _entity(context, "WIRE", "profile", wire),
        _entity(context, "EDGE", "curve:circle", edge),
    ]
    kernel = KernelShape(kind="WIRE", shape=wire, entities=entities)
    return OperationOutput(
        kind="WIRE",
        value=kernel,
        entities=entities,
        metadata={"normal": (normal.X(), normal.Y(), normal.Z())},
    )


def _extrude(context: OperationExecutionContext) -> OperationOutput:
    distance = _positive(context, "distance")
    source = _kernel_input(context)
    wire = source.shape
    try:
        face = BRepBuilderAPI_MakeFace(wire).Face()
        plane = str(context.payload["direction"])
        normal, _ = _plane_axes(plane)
        vector = gp_Vec(normal.X() * distance, normal.Y() * distance, normal.Z() * distance)
        maker = BRepPrimAPI_MakePrism(face, vector, True, True)
        shape = _single_solid(maker.Shape())
    except Exception as exc:
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            f"OCCT extrude failed: {exc}",
            operation_id=context.operation_id,
        ) from exc
    entities = [
        _entity(context, "SOLID", "result", shape),
        _entity(context, "FACE", "cap:start", maker.FirstShape()),
        _entity(context, "FACE", "cap:end", maker.LastShape()),
    ]
    for source_entity in source.entities:
        if source_entity.entity_kind not in {"EDGE", "VERTEX"}:
            continue
        generated = list(maker.Generated(source_entity.shape))
        if source_entity.entity_kind == "EDGE":
            role = f"side:{source_entity.semantic_role}"
            expected_kind = "FACE"
        else:
            role = f"rail:{source_entity.semantic_role}"
            expected_kind = "EDGE"
        for result_shape in generated:
            entities.append(
                _entity(
                    context,
                    expected_kind,
                    role,
                    result_shape,
                    source_reference_id=source_entity.derived_reference_id,
                )
            )
    kernel = KernelShape(kind="SOLID", shape=shape, entities=entities)
    kernel.bodies.append(Body(f"body:{context.operation_id}", context.operation_id, shape, entities))
    return _result(context, kernel)


def _revolve(context: OperationExecutionContext) -> OperationOutput:
    angle = _positive(context, "angle")
    if angle > 360:
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            "Revolve angle cannot exceed 360 degrees",
            operation_id=context.operation_id,
        )
    source = _kernel_input(context)
    face = BRepBuilderAPI_MakeFace(source.shape).Face()
    axis_name = str(context.payload["axis"])
    direction = {
        "X": gp_Dir(1, 0, 0),
        "Y": gp_Dir(0, 1, 0),
        "Z": gp_Dir(0, 0, 1),
    }[axis_name]
    maker = BRepPrimAPI_MakeRevol(
        face, gp_Ax1(gp_Pnt(0, 0, 0), direction), math.radians(angle), True
    )
    shape = _single_solid(maker.Shape())
    entities = [_entity(context, "SOLID", "result", shape)]
    for source_entity in source.entities:
        for result_shape in maker.Generated(source_entity.shape):
            kind = {
                4: "FACE",
                6: "EDGE",
            }.get(int(result_shape.ShapeType()))
            if kind:
                entities.append(
                    _entity(
                        context,
                        kind,
                        f"sweep:{source_entity.semantic_role}",
                        result_shape,
                        source_reference_id=source_entity.derived_reference_id,
                    )
                )
    kernel = KernelShape(kind="SOLID", shape=shape, entities=entities)
    kernel.bodies.append(Body(f"body:{context.operation_id}", context.operation_id, shape, entities))
    return _result(context, kernel)


def _mapped_entities(
    context: OperationExecutionContext,
    algorithm: Any,
    sources: Iterable[tuple[str | None, KernelShape]],
    result_shape: Any,
) -> tuple[list[ProducedEntity], set[str]]:
    entities: list[ProducedEntity] = []
    deleted: set[str] = set()
    for namespace, source in sources:
        for source_entity in source.entities:
            output_role = (
                f"{namespace}/{source_entity.semantic_role}"
                if namespace is not None
                else source_entity.semantic_role
            )
            candidates = [
                item
                for item in list(algorithm.Modified(source_entity.shape))
                if int(item.ShapeType()) == int(source_entity.shape.ShapeType())
            ]
            event = "MODIFIED"
            if not candidates and contains_same_shape(
                result_shape, source_entity.shape, source_entity.entity_kind
            ):
                candidates = [source_entity.shape]
                event = "PRESERVED"
            if candidates:
                for candidate in candidates:
                    entities.append(
                        _entity(
                            context,
                            source_entity.entity_kind,
                            output_role,
                            candidate,
                            event=event,
                            source_reference_id=source_entity.derived_reference_id,
                        )
                    )
            elif algorithm.IsDeleted(source_entity.shape):
                deleted.add(source_entity.derived_reference_id)
                deleted.add(f"ref:{context.operation_id}:{output_role}")
    return entities, deleted


def _boolean(context: OperationExecutionContext, kind: str) -> OperationOutput:
    left = _kernel_input(context, 0)
    right = _kernel_input(context, 1)
    algorithm_type = {
        "union": BRepAlgoAPI_Fuse,
        "cut": BRepAlgoAPI_Cut,
        "intersect": BRepAlgoAPI_Common,
    }[kind]
    algorithm = algorithm_type(left.shape, right.shape)
    algorithm.SetRunParallel(False)
    algorithm.SetFuzzyValue(1e-7)
    algorithm.SetNonDestructive(True)
    algorithm.Build()
    if not algorithm.IsDone():
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            f"OCCT boolean {kind} failed",
            operation_id=context.operation_id,
        )
    raw_shape = algorithm.Shape()
    solids = unique_subshapes(raw_shape, "SOLID")
    if not solids:
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            f"OCCT boolean {kind} produced no solid",
            operation_id=context.operation_id,
        )
    shape = solids[0] if len(solids) == 1 else raw_shape
    output_kind = "SOLID" if len(solids) == 1 else "COMPOUND"
    entities, deleted = _mapped_entities(
        context,
        algorithm,
        (("left", left), ("right", right)),
        shape,
    )
    entities.append(_entity(context, output_kind, "result", shape))
    kernel = KernelShape(
        kind=output_kind,
        shape=shape,
        entities=entities,
        deleted_reference_ids=deleted,
    )
    for index, solid in enumerate(solids):
        suffix = "" if len(solids) == 1 else f":{index}"
        kernel.bodies.append(
            Body(f"body:{context.operation_id}{suffix}", context.operation_id, solid, entities)
        )
    return _result(context, kernel)


def _selected_edges(context: OperationExecutionContext) -> list[Any]:
    resolutions = context.private.get("resolved_references", ())
    edges = [
        resolution._shape
        for resolution in resolutions
        if resolution.status == "EXACT" and resolution.entity_kind == "EDGE"
    ]
    if not edges or any(edge is None for edge in edges):
        raise KernelError(
            "OPERATION_INPUT_INVALID",
            "Edge treatment requires at least one exact EDGE reference",
            operation_id=context.operation_id,
        )
    return edges


def _fillet(context: OperationExecutionContext) -> OperationOutput:
    radius = _positive(context, "radius")
    source = _kernel_input(context)
    maker = BRepFilletAPI_MakeFillet(source.shape)
    for edge in _selected_edges(context):
        maker.Add(radius, edge)
    maker.Build()
    if not maker.IsDone():
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            "OCCT fillet failed for the selected radius/edges",
            operation_id=context.operation_id,
        )
    shape = _single_solid(maker.Shape())
    entities, deleted = _mapped_entities(context, maker, ((None, source),), shape)
    for resolution in context.private.get("resolved_references", ()):
        if resolution._shape is None:
            continue
        for generated in maker.Generated(resolution._shape):
            if int(generated.ShapeType()) == 4:
                entities.append(
                    _entity(
                        context,
                        "FACE",
                        f"fillet:{resolution.reference_id}",
                        generated,
                        source_reference_id=resolution.reference_id,
                    )
                )
    entities.append(_entity(context, "SOLID", "result", shape))
    kernel = KernelShape("SOLID", shape, entities, [Body(f"body:{context.operation_id}", context.operation_id, shape, entities)], deleted)
    return _result(context, kernel)


def _chamfer(context: OperationExecutionContext) -> OperationOutput:
    distance = _positive(context, "distance")
    source = _kernel_input(context)
    maker = BRepFilletAPI_MakeChamfer(source.shape)
    for edge in _selected_edges(context):
        maker.Add(distance, edge)
    maker.Build()
    if not maker.IsDone():
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            "OCCT chamfer failed for the selected distance/edges",
            operation_id=context.operation_id,
        )
    shape = _single_solid(maker.Shape())
    entities, deleted = _mapped_entities(context, maker, ((None, source),), shape)
    for resolution in context.private.get("resolved_references", ()):
        if resolution._shape is None:
            continue
        for generated in maker.Generated(resolution._shape):
            if int(generated.ShapeType()) == 4:
                entities.append(
                    _entity(
                        context,
                        "FACE",
                        f"chamfer:{resolution.reference_id}",
                        generated,
                        source_reference_id=resolution.reference_id,
                    )
                )
    entities.append(_entity(context, "SOLID", "result", shape))
    kernel = KernelShape("SOLID", shape, entities, [Body(f"body:{context.operation_id}", context.operation_id, shape, entities)], deleted)
    return _result(context, kernel)


def _transform_shape(context: OperationExecutionContext, transform: gp_Trsf) -> OperationOutput:
    source = _kernel_input(context)
    maker = BRepBuilderAPI_Transform(source.shape, transform, True)
    maker.Build()
    if not maker.IsDone():
        raise KernelError(
            "OPERATION_HANDLER_FAILED",
            "OCCT transform failed",
            operation_id=context.operation_id,
        )
    shape = maker.Shape()
    entities: list[ProducedEntity] = []
    for source_entity in source.entities:
        if source_entity.shape.IsSame(source.shape):
            mapped_candidates = [shape]
        else:
            mapped_candidates = list(maker.Modified(source_entity.shape))
        for mapped in mapped_candidates:
            entities.append(
                _entity(
                    context,
                    source_entity.entity_kind,
                    source_entity.semantic_role,
                    mapped,
                    event="MODIFIED",
                    source_reference_id=source_entity.derived_reference_id,
                )
            )
    entities.append(_entity(context, source.kind if source.kind in {"SOLID", "COMPOUND"} else "COMPOUND", "result", shape))
    bodies: list[Body] = []
    for index, body in enumerate(source.bodies):
        if body.shape.IsSame(source.shape):
            transformed_candidates = [shape]
        else:
            transformed_candidates = list(maker.Modified(body.shape))
        for transformed in transformed_candidates:
            bodies.append(Body(f"body:{context.operation_id}:{index}", context.operation_id, transformed, entities))
    kernel = KernelShape(source.kind, shape, entities, bodies)
    return _result(context, kernel)


def _translate(context: OperationExecutionContext) -> OperationOutput:
    transform = gp_Trsf()
    transform.SetTranslation(gp_Vec(_value(context, "dx"), _value(context, "dy"), _value(context, "dz")))
    return _transform_shape(context, transform)


def _rotate(context: OperationExecutionContext) -> OperationOutput:
    angle = _value(context, "angle")
    axis = {
        "X": gp_Dir(1, 0, 0),
        "Y": gp_Dir(0, 1, 0),
        "Z": gp_Dir(0, 0, 1),
    }[str(context.payload["axis"])]
    transform = gp_Trsf()
    transform.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), axis), math.radians(angle))
    return _transform_shape(context, transform)


def _scale(context: OperationExecutionContext) -> OperationOutput:
    factor = _positive(context, "factor")
    transform = gp_Trsf()
    transform.SetScale(gp_Pnt(0, 0, 0), factor)
    return _transform_shape(context, transform)


def _pattern_linear(context: OperationExecutionContext) -> OperationOutput:
    source = _kernel_input(context)
    count = _integer(context, "count")
    spacing = _positive(context, "spacing")
    axis = str(context.payload["axis"])
    direction = {
        "X": (1.0, 0.0, 0.0),
        "Y": (0.0, 1.0, 0.0),
        "Z": (0.0, 0.0, 1.0),
    }[axis]
    shapes = []
    entities: list[ProducedEntity] = []
    bodies: list[Body] = []
    for index in range(count):
        if index == 0:
            transformed = source.shape
            mapper = None
        else:
            transform = gp_Trsf()
            transform.SetTranslation(
                gp_Vec(*(component * spacing * index for component in direction))
            )
            mapper = BRepBuilderAPI_Transform(source.shape, transform, True)
            transformed = mapper.Shape()
        shapes.append(transformed)
        for source_entity in source.entities:
            result_entity = (
                source_entity.shape if mapper is None else mapper.ModifiedShape(source_entity.shape)
            )
            if not result_entity.IsNull():
                entities.append(
                    _entity(
                        context,
                        source_entity.entity_kind,
                        f"instance:{index}/{source_entity.semantic_role}",
                        result_entity,
                        event="PRESERVED" if index == 0 else "MODIFIED",
                        source_reference_id=source_entity.derived_reference_id,
                    )
                )
        bodies.append(Body(f"body:{context.operation_id}:{index}", context.operation_id, transformed, entities))
    if context.payload["fuse"]:
        shape = shapes[0]
        for addition in shapes[1:]:
            fuse = BRepAlgoAPI_Fuse(shape, addition)
            fuse.SetRunParallel(False)
            fuse.Build()
            if not fuse.IsDone():
                raise KernelError(
                    "OPERATION_HANDLER_FAILED",
                    "OCCT linear-pattern fuse failed",
                    operation_id=context.operation_id,
                )
            shape = fuse.Shape()
        solids = unique_subshapes(shape, "SOLID")
        if len(solids) == 1:
            shape = solids[0]
            bodies = [Body(f"body:{context.operation_id}", context.operation_id, shape, entities)]
            kind = "SOLID"
        else:
            bodies = [
                Body(f"body:{context.operation_id}:{index}", context.operation_id, solid, entities)
                for index, solid in enumerate(solids)
            ]
            kind = "COMPOUND"
    else:
        shape = make_compound(shapes)
        kind = "COMPOUND"
    entities.append(_entity(context, kind, "result", shape))
    return _result(context, KernelShape(kind, shape, entities, bodies))


def register_ocp_operations(registry: OperationRegistry) -> None:
    plane_schema = object_schema(
        {
            "plane": {"type": "string", "enum": ["XY", "XZ", "YZ"]},
            "centered": {"type": "boolean"},
        },
        required=("plane", "centered"),
    )
    plane_fields = (
        PayloadField("/plane", "Plane", "SELECT", True, 0, ({"value": "XY", "label": "XY"}, {"value": "XZ", "label": "XZ"}, {"value": "YZ", "label": "YZ"})),
        PayloadField("/centered", "Centered", "BOOLEAN", True, 1),
    )
    axis_schema = object_schema(
        {"axis": {"type": "string", "enum": ["X", "Y", "Z"]}},
        required=("axis",),
    )
    axis_fields = (
        PayloadField("/axis", "Axis", "SELECT", True, 0, ({"value": "X", "label": "X"}, {"value": "Y", "label": "Y"}, {"value": "Z", "label": "Z"})),
    )
    registrations = [
        (
            _descriptor(
                "primitive.box", "Box", "Primitive", "Create an axis-aligned box",
                slots=(
                    _slot("length", "Length", "LENGTH", 0, default="10", minimum="0.000001", step="1"),
                    _slot("width", "Width", "LENGTH", 1, default="10", minimum="0.000001", step="1"),
                    _slot("height", "Height", "LENGTH", 2, default="10", minimum="0.000001", step="1"),
                ),
                output_roles=("result", "face:*", "edge:*", "vertex:*"),
            ),
            _box,
        ),
        (
            _descriptor(
                "primitive.cylinder", "Cylinder", "Primitive", "Create a +Z cylinder",
                slots=(
                    _slot("radius", "Radius", "LENGTH", 0, default="5", minimum="0.000001", step="1"),
                    _slot("height", "Height", "LENGTH", 1, default="10", minimum="0.000001", step="1"),
                ),
                output_roles=("result", "face:*", "edge:*"),
            ),
            _cylinder,
        ),
        (
            _descriptor(
                "sketch.rectangle", "Rectangle", "Sketch", "Create a closed four-line profile",
                slots=(
                    _slot("width", "Width", "LENGTH", 0, default="40", minimum="0.000001", step="1"),
                    _slot("height", "Height", "LENGTH", 1, default="20", minimum="0.000001", step="1"),
                ),
                payload_schema=plane_schema,
                payload_fields=plane_fields,
                output_roles=("profile", "segment:*", "corner:*"),
            ),
            _rectangle,
        ),
        (
            _descriptor(
                "sketch.circle", "Circle", "Sketch", "Create a closed circular profile",
                slots=(_slot("radius", "Radius", "LENGTH", 0, default="5", minimum="0.000001", step="1"),),
                payload_schema=plane_schema,
                payload_fields=plane_fields,
                output_roles=("profile", "curve:circle"),
            ),
            _circle,
        ),
        (
            _descriptor(
                "solid.extrude", "Extrude", "Solid", "Extrude a closed profile",
                slots=(_slot("distance", "Distance", "LENGTH", 0, default="10", minimum="0.000001", step="1"),),
                payload_schema=object_schema({"direction": {"type": "string", "enum": ["XY", "XZ", "YZ"]}}, required=("direction",)),
                payload_fields=(PayloadField("/direction", "Profile plane", "SELECT", True, 0, ()),),
                input_kinds=("WIRE",),
                output_roles=("result", "cap:start", "cap:end", "side:*", "rail:*"),
            ),
            _extrude,
        ),
        (
            _descriptor(
                "solid.revolve", "Revolve", "Solid", "Revolve a closed profile around a datum axis",
                slots=(_slot("angle", "Angle", "ANGLE", 0, default="360", minimum="0.000001", maximum="360", step="1"),),
                payload_schema=axis_schema,
                payload_fields=axis_fields,
                input_kinds=("WIRE",),
                output_roles=("result", "sweep:*"),
            ),
            _revolve,
        ),
        (_descriptor("solid.boolean.union", "Union", "Boolean", "Fuse two solids", input_kinds=("SOLID", "SOLID")), lambda ctx: _boolean(ctx, "union")),
        (_descriptor("solid.boolean.cut", "Cut", "Boolean", "Subtract the second solid", input_kinds=("SOLID", "SOLID")), lambda ctx: _boolean(ctx, "cut")),
        (_descriptor("solid.boolean.intersect", "Intersect", "Boolean", "Intersect two solids", input_kinds=("SOLID", "SOLID")), lambda ctx: _boolean(ctx, "intersect")),
        (
            _descriptor(
                "solid.fillet", "Fillet", "Solid", "Round exactly referenced edges",
                slots=(_slot("radius", "Radius", "LENGTH", 0, default="1", minimum="0.000001", step="0.1"),),
                input_kinds=("SOLID",),
                output_roles=("result", "*"),
            ),
            _fillet,
        ),
        (
            _descriptor(
                "solid.chamfer", "Chamfer", "Solid", "Chamfer exactly referenced edges",
                slots=(_slot("distance", "Distance", "LENGTH", 0, default="1", minimum="0.000001", step="0.1"),),
                input_kinds=("SOLID",),
                output_roles=("result", "*"),
            ),
            _chamfer,
        ),
        (
            _descriptor(
                "transform.translate", "Translate", "Transform", "Translate exact geometry",
                slots=(
                    _slot("dx", "X", "LENGTH", 0, default="0", step="1"),
                    _slot("dy", "Y", "LENGTH", 1, default="0", step="1"),
                    _slot("dz", "Z", "LENGTH", 2, default="0", step="1"),
                ),
                input_kinds=("*",),
            ),
            _translate,
        ),
        (
            _descriptor(
                "transform.rotate", "Rotate", "Transform", "Rotate exact geometry about a datum axis",
                slots=(_slot("angle", "Angle", "ANGLE", 0, default="90", step="1"),),
                payload_schema=axis_schema,
                payload_fields=axis_fields,
                input_kinds=("*",),
            ),
            _rotate,
        ),
        (
            _descriptor(
                "transform.scale", "Scale", "Transform", "Uniformly scale exact geometry",
                slots=(_slot("factor", "Factor", "SCALAR", 0, default="1", minimum="0.000001", step="0.1"),),
                input_kinds=("*",),
            ),
            _scale,
        ),
        (
            _descriptor(
                "pattern.linear", "Linear pattern", "Pattern", "Copy a solid along a datum axis",
                slots=(
                    _slot("count", "Count", "INTEGER", 0, default="2", minimum="1", step="1"),
                    _slot("spacing", "Spacing", "LENGTH", 1, default="20", minimum="0.000001", step="1"),
                ),
                payload_schema=object_schema(
                    {"axis": {"type": "string", "enum": ["X", "Y", "Z"]}, "fuse": {"type": "boolean"}},
                    required=("axis", "fuse"),
                ),
                payload_fields=(
                    PayloadField("/axis", "Axis", "SELECT", True, 0, ()),
                    PayloadField("/fuse", "Fuse", "BOOLEAN", True, 1, ()),
                ),
                input_kinds=("SOLID",),
                output_roles=("result", "instance:*"),
            ),
            _pattern_linear,
        ),
    ]
    for descriptor, handler in registrations:
        registry.register(descriptor, handler)


def ocp_registry() -> OperationRegistry:
    registry = OperationRegistry()
    register_ocp_operations(registry)
    return registry
