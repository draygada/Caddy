"""Deterministic bounded sketch and rigid-mate solvers.

This is intentionally not a general nonlinear constraint solver. It uses a
bounded damped Gauss-Newton pass for the explicitly supported sketch equations
and a deterministic fixed-point pass for a bounded set of rigid mates.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

from OCP.gp import gp_Ax1, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

from .models import (
    ArcEntity,
    AssemblyRequest,
    CircleEntity,
    ConstraintResidual,
    Diagnostic,
    LineEntity,
    MateSolveReport,
    Sketch,
    SketchConstraint,
    SketchSolveReport,
    Vector3,
)


LINEAR_TOLERANCE = 1e-6
ANGULAR_TOLERANCE_RADIANS = 1e-7
RATIO_TOLERANCE = 1e-7
MAX_SKETCH_ITERATIONS = 64
MAX_MATE_ITERATIONS = 16


class SketchSolveError(Exception):
    def __init__(self, message: str, report: SketchSolveReport | None = None) -> None:
        super().__init__(message)
        self.report = report


class AssemblySolveError(Exception):
    def __init__(self, code: str, message: str, *, mate_id: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.mate_id = mate_id


@dataclass
class _Variable:
    entity: LineEntity | ArcEntity | CircleEntity
    field: str
    axis: str | None

    def get(self) -> float:
        value = getattr(self.entity, self.field)
        return float(getattr(value, self.axis)) if self.axis else float(value)

    def set(self, value: float) -> None:
        if self.axis:
            setattr(getattr(self.entity, self.field), self.axis, value)
        else:
            setattr(self.entity, self.field, max(value, 1e-9))


@dataclass
class _ResidualTerm:
    constraint_id: str
    kind: str
    unit: str
    tolerance: float
    solve_scale: float
    evaluate: Callable[[], float]
    implicit: bool = False


def _entities(sketch: Sketch) -> dict[str, LineEntity | ArcEntity | CircleEntity]:
    result: dict[str, LineEntity | ArcEntity | CircleEntity] = {}
    for loop in sketch.loops:
        for entity in loop.entities:
            if entity.entity_id in result:
                raise SketchSolveError(f"Duplicate sketch entity {entity.entity_id!r}")
            result[entity.entity_id] = entity
    return result


def _variables(entities: dict[str, LineEntity | ArcEntity | CircleEntity]) -> list[_Variable]:
    result: list[_Variable] = []
    for entity_id in sorted(entities):
        entity = entities[entity_id]
        if isinstance(entity, LineEntity):
            fields = ("start", "end")
        elif isinstance(entity, ArcEntity):
            fields = ("start", "mid", "end")
        else:
            fields = ("center",)
        for field in fields:
            result.extend((_Variable(entity, field, "x"), _Variable(entity, field, "y")))
        if isinstance(entity, CircleEntity):
            result.append(_Variable(entity, "radius", None))
    return result


def _point(entity: LineEntity | ArcEntity | CircleEntity, endpoint: str) -> tuple[float, float]:
    if endpoint == "center" and isinstance(entity, CircleEntity):
        return entity.center.x, entity.center.y
    if endpoint in {"start", "end", "mid"} and isinstance(entity, (LineEntity, ArcEntity)):
        value = getattr(entity, endpoint)
        return value.x, value.y
    raise SketchSolveError(f"Entity {entity.entity_id!r} has no point {endpoint!r}")


def _point_ref(reference: str, entities: dict[str, LineEntity | ArcEntity | CircleEntity]) -> Callable[[], tuple[float, float]]:
    try:
        entity_id, endpoint = reference.rsplit(".", 1)
        entity = entities[entity_id]
        _point(entity, endpoint)
    except (KeyError, ValueError) as exc:
        raise SketchSolveError(f"Invalid sketch point reference {reference!r}") from exc
    return lambda: _point(entity, endpoint)


def _line(entity: LineEntity | ArcEntity | CircleEntity, kind: str) -> LineEntity:
    if not isinstance(entity, LineEntity):
        raise SketchSolveError(f"{kind} requires line entities")
    return entity


def _vector(entity: LineEntity) -> tuple[float, float]:
    return entity.end.x - entity.start.x, entity.end.y - entity.start.y


def _length(entity: LineEntity) -> float:
    return math.hypot(*_vector(entity))


def _arc_radius(entity: ArcEntity) -> float:
    a = math.dist((entity.start.x, entity.start.y), (entity.mid.x, entity.mid.y))
    b = math.dist((entity.mid.x, entity.mid.y), (entity.end.x, entity.end.y))
    c = math.dist((entity.end.x, entity.end.y), (entity.start.x, entity.start.y))
    twice_area = abs(
        entity.start.x * (entity.mid.y - entity.end.y)
        + entity.mid.x * (entity.end.y - entity.start.y)
        + entity.end.x * (entity.start.y - entity.mid.y)
    )
    if twice_area <= 1e-12:
        return 1e12
    return a * b * c / (2.0 * twice_area)


def _entity_measure(entity: LineEntity | ArcEntity | CircleEntity, kind: str) -> float:
    if isinstance(entity, LineEntity):
        return _length(entity)
    if isinstance(entity, CircleEntity):
        return entity.radius
    if isinstance(entity, ArcEntity):
        return _arc_radius(entity)
    raise SketchSolveError(f"{kind} does not support entity {entity.entity_id!r}")


def _constraint_terms(
    constraint: SketchConstraint,
    entities: dict[str, LineEntity | ArcEntity | CircleEntity],
    original_values: dict[tuple[str, str, str | None], float],
) -> list[_ResidualTerm]:
    kind = constraint.kind.upper()

    def entity(index: int) -> LineEntity | ArcEntity | CircleEntity:
        try:
            return entities[constraint.entity_ids[index]]
        except (IndexError, KeyError) as exc:
            raise SketchSolveError(f"Constraint {constraint.constraint_id!r} references an unknown entity") from exc

    def value() -> float:
        if constraint.value is None or not math.isfinite(constraint.value):
            raise SketchSolveError(f"Constraint {constraint.constraint_id!r} requires a finite value")
        return constraint.value

    cid = constraint.constraint_id
    linear = lambda fn: _ResidualTerm(cid, kind, "mm", LINEAR_TOLERANCE, 1.0, fn)
    ratio = lambda fn: _ResidualTerm(cid, kind, "ratio", RATIO_TOLERANCE, 0.1, fn)
    angular = lambda fn: _ResidualTerm(cid, kind, "degrees", math.degrees(ANGULAR_TOLERANCE_RADIANS), 0.1, fn)

    if kind == "COINCIDENT":
        if len(constraint.point_refs) != 2:
            raise SketchSolveError(f"Constraint {cid!r} requires two point_refs")
        a, b = (_point_ref(item, entities) for item in constraint.point_refs)
        return [linear(lambda: a()[0] - b()[0]), linear(lambda: a()[1] - b()[1])]
    if kind in {"HORIZONTAL", "VERTICAL"}:
        item = _line(entity(0), kind)
        return [linear(lambda: _vector(item)[1 if kind == "HORIZONTAL" else 0])]
    if kind == "DISTANCE":
        if len(constraint.point_refs) != 2:
            raise SketchSolveError(f"Constraint {cid!r} requires two point_refs")
        a, b = (_point_ref(item, entities) for item in constraint.point_refs)
        target = value()
        if target < 0:
            raise SketchSolveError(f"Constraint {cid!r} requires a non-negative distance")
        return [linear(lambda: math.dist(a(), b()) - target)]
    if kind in {"EQUAL", "EQUAL_LENGTH"}:
        a, b = entity(0), entity(1)
        return [linear(lambda: _entity_measure(a, kind) - _entity_measure(b, kind))]
    if kind == "RADIUS":
        item = entity(0)
        if not isinstance(item, (CircleEntity, ArcEntity)):
            raise SketchSolveError(f"Constraint {cid!r} requires a circle or arc")
        target = value()
        if target <= 0:
            raise SketchSolveError(f"Constraint {cid!r} requires a positive radius")
        return [linear(lambda: _entity_measure(item, kind) - target)]
    if kind in {"PARALLEL", "PERPENDICULAR", "ANGLE"}:
        a, b = _line(entity(0), kind), _line(entity(1), kind)

        def normalized_dot() -> float:
            av, bv = _vector(a), _vector(b)
            denominator = math.hypot(*av) * math.hypot(*bv)
            if denominator <= 1e-12:
                return 1e6
            return (av[0] * bv[0] + av[1] * bv[1]) / denominator

        def normalized_cross() -> float:
            av, bv = _vector(a), _vector(b)
            denominator = math.hypot(*av) * math.hypot(*bv)
            if denominator <= 1e-12:
                return 1e6
            return (av[0] * bv[1] - av[1] * bv[0]) / denominator

        if kind == "PARALLEL":
            return [ratio(normalized_cross)]
        if kind == "PERPENDICULAR":
            return [ratio(normalized_dot)]
        target = math.radians(value())
        if target < 0 or target > math.pi:
            raise SketchSolveError(f"Constraint {cid!r} angle must be between 0 and 180 degrees")
        return [angular(lambda: math.atan2(abs(normalized_cross()), max(-1.0, min(1.0, normalized_dot()))) - target)]
    if kind == "FIXED":
        keys: list[tuple[str, str, str | None]] = []
        for entity_id in constraint.entity_ids:
            if entity_id not in entities:
                raise SketchSolveError(f"Constraint {cid!r} references unknown entity {entity_id!r}")
            item = entities[entity_id]
            fields = ("start", "end") if isinstance(item, LineEntity) else (("start", "mid", "end") if isinstance(item, ArcEntity) else ("center",))
            for field in fields:
                keys.extend(((entity_id, field, "x"), (entity_id, field, "y")))
            if isinstance(item, CircleEntity):
                keys.append((entity_id, "radius", None))
        for reference in constraint.point_refs:
            try:
                entity_id, endpoint = reference.rsplit(".", 1)
                _point(entities[entity_id], endpoint)
            except (KeyError, ValueError) as exc:
                raise SketchSolveError(f"Constraint {cid!r} has invalid fixed point {reference!r}") from exc
            keys.extend(((entity_id, endpoint, "x"), (entity_id, endpoint, "y")))
        if not keys:
            raise SketchSolveError(f"Constraint {cid!r} requires entity_ids or point_refs")
        terms: list[_ResidualTerm] = []
        for key in sorted(set(keys)):
            item = entities[key[0]]
            target = original_values[key]
            variable = _Variable(item, key[1], key[2])
            terms.append(linear(lambda variable=variable, target=target: variable.get() - target))
        return terms
    raise SketchSolveError(f"Unsupported sketch constraint {constraint.kind!r}")


def _implicit_loop_terms(sketch: Sketch) -> list[_ResidualTerm]:
    terms: list[_ResidualTerm] = []
    for loop in sketch.loops:
        if len(loop.entities) == 1:
            continue
        if any(isinstance(item, CircleEntity) for item in loop.entities):
            raise SketchSolveError(f"Loop {loop.loop_id!r} cannot mix circles with line or arc entities")
        authored_closed = all(
            math.dist(_point(item, "end"), _point(loop.entities[(index + 1) % len(loop.entities)], "start")) <= LINEAR_TOLERANCE
            for index, item in enumerate(loop.entities)
        )
        if not authored_closed:
            continue
        for index, item in enumerate(loop.entities):
            following = loop.entities[(index + 1) % len(loop.entities)]
            cid = f"$loop:{loop.loop_id}:{index}"
            terms.append(_ResidualTerm(cid, "LOOP_CLOSURE", "mm", LINEAR_TOLERANCE, 1.0, lambda item=item, following=following: _point(item, "end")[0] - _point(following, "start")[0], True))
            terms.append(_ResidualTerm(cid, "LOOP_CLOSURE", "mm", LINEAR_TOLERANCE, 1.0, lambda item=item, following=following: _point(item, "end")[1] - _point(following, "start")[1], True))
    return terms


def _solve_linear(matrix: list[list[float]], vector: list[float]) -> list[float]:
    n = len(vector)
    augmented = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    for column in range(n):
        pivot = max(range(column, n), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) <= 1e-18:
            return [0.0] * n
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(n):
            if row == column:
                continue
            factor = augmented[row][column]
            if factor:
                augmented[row] = [left - factor * right for left, right in zip(augmented[row], augmented[column])]
    return [augmented[index][-1] for index in range(n)]


def _rank(matrix: list[list[float]], tolerance: float = 1e-7) -> int:
    if not matrix:
        return 0
    work = [row[:] for row in matrix]
    rows, columns = len(work), len(work[0])
    rank = 0
    for column in range(columns):
        pivot = max(range(rank, rows), key=lambda row: abs(work[row][column]), default=rank)
        if rank >= rows or abs(work[pivot][column]) <= tolerance:
            continue
        work[rank], work[pivot] = work[pivot], work[rank]
        divisor = work[rank][column]
        work[rank] = [value / divisor for value in work[rank]]
        for row in range(rows):
            if row == rank:
                continue
            factor = work[row][column]
            if abs(factor) > tolerance:
                work[row] = [left - factor * right for left, right in zip(work[row], work[rank])]
        rank += 1
        if rank == rows:
            break
    return rank


def _jacobian(terms: list[_ResidualTerm], variables: list[_Variable]) -> tuple[list[float], list[list[float]]]:
    residuals = [term.evaluate() / term.solve_scale for term in terms]
    jacobian = [[0.0 for _ in variables] for _ in terms]
    for column, variable in enumerate(variables):
        original = variable.get()
        step = max(1e-6, abs(original) * 1e-7)
        variable.set(original + step)
        forward = [term.evaluate() / term.solve_scale for term in terms]
        variable.set(original)
        for row in range(len(terms)):
            jacobian[row][column] = (forward[row] - residuals[row]) / step
    return residuals, jacobian


def _constraint_reports(terms: list[_ResidualTerm]) -> list[ConstraintResidual]:
    grouped: dict[tuple[str, str, str, float], list[float]] = {}
    for term in terms:
        if term.implicit:
            continue
        value = term.evaluate()
        if term.unit == "degrees":
            value = math.degrees(value)
        grouped.setdefault((term.constraint_id, term.kind, term.unit, term.tolerance), []).append(abs(value))
    return [
        ConstraintResidual(
            constraint_id=key[0],
            kind=key[1],
            unit=key[2],
            tolerance=key[3],
            residual=max(values, default=0.0),
            satisfied=max(values, default=0.0) <= key[3],
        )
        for key, values in sorted(grouped.items())
    ]


def solve_sketch(sketch: Sketch) -> tuple[Sketch, SketchSolveReport]:
    solved = sketch.model_copy(deep=True)
    entities = _entities(solved)
    variables = _variables(entities)
    original_values = {(entity.entity_id, variable.field, variable.axis): variable.get() for entity in entities.values() for variable in _variables({entity.entity_id: entity})}
    terms = _implicit_loop_terms(solved)
    for constraint in solved.constraints:
        terms.extend(_constraint_terms(constraint, entities, original_values))

    damping = 1e-8
    iterations = 0
    for iterations in range(MAX_SKETCH_ITERATIONS + 1):
        residuals, jacobian = _jacobian(terms, variables)
        if all(abs(term.evaluate()) <= term.tolerance for term in terms):
            break
        if iterations == MAX_SKETCH_ITERATIONS:
            break
        size = len(variables)
        normal = [[sum(jacobian[row][left] * jacobian[row][right] for row in range(len(terms))) for right in range(size)] for left in range(size)]
        gradient = [-sum(jacobian[row][column] * residuals[row] for row in range(len(terms))) for column in range(size)]
        for index in range(size):
            normal[index][index] += damping
        delta = _solve_linear(normal, gradient)
        baseline = sum(value * value for value in residuals)
        originals = [variable.get() for variable in variables]
        accepted = False
        for scale in (1.0, 0.5, 0.25, 0.125, 0.0625):
            for variable, original, change in zip(variables, originals, delta):
                variable.set(original + max(-1000.0, min(1000.0, change * scale)))
            trial = sum((term.evaluate() / term.solve_scale) ** 2 for term in terms)
            if trial < baseline - 1e-18:
                accepted = True
                damping = max(1e-12, damping * 0.5)
                break
        if not accepted:
            for variable, original in zip(variables, originals):
                variable.set(original)
            damping = min(1e8, damping * 100.0)
            if max((abs(value) for value in delta), default=0.0) <= 1e-12:
                break

    residuals, jacobian = _jacobian(terms, variables)
    independent = _rank(jacobian)
    degrees_of_freedom = max(0, len(variables) - independent)
    max_normalized = max((abs(term.evaluate()) / term.tolerance for term in terms), default=0.0)
    explicit = _constraint_reports(terms)
    satisfied = max_normalized <= 1.0
    degenerate = False
    for entity in entities.values():
        if isinstance(entity, LineEntity) and _length(entity) <= LINEAR_TOLERANCE:
            degenerate = True
        if isinstance(entity, ArcEntity) and _arc_radius(entity) >= 1e11:
            degenerate = True
    status = "UNDER_CONSTRAINED" if satisfied and degrees_of_freedom else ("SOLVED" if satisfied else "OVER_CONSTRAINED")
    if degenerate:
        status = "OVER_CONSTRAINED"
        satisfied = False
        max_normalized = max(max_normalized, 1.0 + LINEAR_TOLERANCE)
    report = SketchSolveReport(
        sketch_id=sketch.sketch_id,
        status=status,
        iterations=iterations,
        variable_count=len(variables),
        independent_equation_count=independent,
        degrees_of_freedom=degrees_of_freedom,
        max_normalized_residual=max_normalized,
        residuals=explicit,
    )
    if not satisfied:
        failed = [item.constraint_id for item in explicit if not item.satisfied]
        suffix = f"; unsatisfied constraints: {failed}" if failed else "; solving would create degenerate geometry"
        raise SketchSolveError(f"Sketch {sketch.sketch_id!r} is over-constrained or could not converge{suffix}", report)
    return solved, report


def _world_point(transform: gp_Trsf, value: Vector3) -> gp_Pnt:
    return gp_Pnt(value.x, value.y, value.z).Transformed(transform)


def _world_dir(transform: gp_Trsf, value: Vector3, mate_id: str) -> gp_Dir:
    if math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z) <= 1e-12:
        raise AssemblySolveError("MATE_AXIS_INVALID", "Mate axis cannot be zero", mate_id=mate_id)
    return gp_Dir(value.x, value.y, value.z).Transformed(transform)


def _translation(dx: float, dy: float, dz: float) -> gp_Trsf:
    result = gp_Trsf()
    result.SetTranslation(gp_Vec(dx, dy, dz))
    return result


def _identity() -> gp_Trsf:
    return gp_Trsf()


def _align_axis(transform: gp_Trsf, moving_point: gp_Pnt, moving_axis: gp_Dir, target_axis: gp_Dir) -> gp_Trsf:
    dot = max(-1.0, min(1.0, moving_axis.Dot(target_axis)))
    angle = math.acos(dot)
    if angle <= ANGULAR_TOLERANCE_RADIANS:
        return transform
    cross_components = (
        moving_axis.Y() * target_axis.Z() - moving_axis.Z() * target_axis.Y(),
        moving_axis.Z() * target_axis.X() - moving_axis.X() * target_axis.Z(),
        moving_axis.X() * target_axis.Y() - moving_axis.Y() * target_axis.X(),
    )
    cross_magnitude = math.sqrt(sum(value * value for value in cross_components))
    if cross_magnitude <= 1e-12:
        reference = gp_Dir(1, 0, 0) if abs(moving_axis.X()) < 0.9 else gp_Dir(0, 1, 0)
        cross_components = (
            moving_axis.Y() * reference.Z() - moving_axis.Z() * reference.Y(),
            moving_axis.Z() * reference.X() - moving_axis.X() * reference.Z(),
            moving_axis.X() * reference.Y() - moving_axis.Y() * reference.X(),
        )
    rotation = gp_Trsf()
    rotation.SetRotation(gp_Ax1(moving_point, gp_Dir(*cross_components)), angle)
    return rotation.Multiplied(transform)


def _mate_residual(mate: object, transforms: dict[str, gp_Trsf]) -> tuple[float, float]:
    moving = transforms[mate.moving_instance_id]
    target = transforms[mate.target_instance_id] if mate.target_instance_id else _identity()
    if mate.kind.upper() == "FIXED":
        return 0.0, 0.0
    moving_point = _world_point(moving, mate.moving_point)
    target_point = _world_point(target, mate.target_point)
    kind = mate.kind.upper()
    if kind == "DISTANCE":
        axis = _world_dir(target, mate.target_axis, mate.mate_id)
        target_point = target_point.Translated(gp_Vec(axis.X() * mate.distance_mm, axis.Y() * mate.distance_mm, axis.Z() * mate.distance_mm))
    linear = moving_point.Distance(target_point)
    angular = 0.0
    if kind == "AXIS_CONCENTRIC":
        moving_axis = _world_dir(moving, mate.moving_axis, mate.mate_id)
        target_axis = _world_dir(target, mate.target_axis, mate.mate_id)
        angular = math.degrees(math.acos(max(-1.0, min(1.0, moving_axis.Dot(target_axis)))))
    return linear, angular


def solve_assembly_mates(request: AssemblyRequest, initial: dict[str, gp_Trsf]) -> tuple[dict[str, gp_Trsf], list[MateSolveReport], list[Diagnostic]]:
    instance_ids = set(initial)
    mate_ids = [mate.mate_id for mate in request.mates]
    if len(mate_ids) != len(set(mate_ids)):
        raise AssemblySolveError("DUPLICATE_ID", "Assembly mate IDs must be unique")
    for mate in request.mates:
        if mate.moving_instance_id not in instance_ids:
            raise AssemblySolveError("MATE_REFERENCE_MISSING", f"Unknown moving instance {mate.moving_instance_id!r}", mate_id=mate.mate_id)
        if mate.target_instance_id is not None and mate.target_instance_id not in instance_ids:
            raise AssemblySolveError("MATE_REFERENCE_MISSING", f"Unknown target instance {mate.target_instance_id!r}", mate_id=mate.mate_id)
        if mate.target_instance_id == mate.moving_instance_id:
            raise AssemblySolveError("MATE_SELF_REFERENCE", "A mate cannot target its moving instance", mate_id=mate.mate_id)

    transforms = dict(initial)
    authored = dict(initial)
    grounded = request.instances[0].instance_id
    if any(mate.moving_instance_id == grounded and mate.kind.upper() != "FIXED" for mate in request.mates):
        raise AssemblySolveError("MATE_GROUND_CONFLICT", f"Implicitly grounded instance {grounded!r} cannot be moved by a mate")

    iterations = 0
    for iterations in range(1, MAX_MATE_ITERATIONS + 1):
        for mate in request.mates:
            kind = mate.kind.upper()
            if kind == "FIXED":
                transforms[mate.moving_instance_id] = authored[mate.moving_instance_id]
                continue
            if kind not in {"POINT_COINCIDENT", "DISTANCE", "AXIS_CONCENTRIC"}:
                raise AssemblySolveError("MATE_KIND_UNSUPPORTED", f"Unsupported assembly mate {mate.kind!r}", mate_id=mate.mate_id)
            moving = transforms[mate.moving_instance_id]
            target = transforms[mate.target_instance_id] if mate.target_instance_id else _identity()
            moving_point = _world_point(moving, mate.moving_point)
            target_point = _world_point(target, mate.target_point)
            if kind == "AXIS_CONCENTRIC":
                moving_axis = _world_dir(moving, mate.moving_axis, mate.mate_id)
                target_axis = _world_dir(target, mate.target_axis, mate.mate_id)
                moving = _align_axis(moving, moving_point, moving_axis, target_axis)
                moving_point = _world_point(moving, mate.moving_point)
            if kind == "DISTANCE":
                target_axis = _world_dir(target, mate.target_axis, mate.mate_id)
                target_point = target_point.Translated(gp_Vec(target_axis.X() * mate.distance_mm, target_axis.Y() * mate.distance_mm, target_axis.Z() * mate.distance_mm))
            delta = _translation(target_point.X() - moving_point.X(), target_point.Y() - moving_point.Y(), target_point.Z() - moving_point.Z())
            transforms[mate.moving_instance_id] = delta.Multiplied(moving)
        if all(
            linear <= LINEAR_TOLERANCE and angular <= math.degrees(ANGULAR_TOLERANCE_RADIANS)
            for linear, angular in (_mate_residual(mate, transforms) for mate in request.mates)
        ):
            break

    reports: list[MateSolveReport] = []
    conflicts: list[str] = []
    for mate in request.mates:
        linear, angular = _mate_residual(mate, transforms)
        satisfied = linear <= LINEAR_TOLERANCE and angular <= math.degrees(ANGULAR_TOLERANCE_RADIANS)
        reports.append(MateSolveReport(mate_id=mate.mate_id, kind=mate.kind.upper(), status="SATISFIED" if satisfied else "CONFLICT", iterations=iterations, linear_residual_mm=linear, angular_residual_deg=angular, satisfied=satisfied))
        if not satisfied:
            conflicts.append(f"{mate.mate_id} (linear={linear:.9g} mm, angular={angular:.9g} deg)")
    if conflicts:
        raise AssemblySolveError("MATE_CONFLICT", "Rigid mate set did not converge without conflict: " + ", ".join(conflicts), mate_id=reports[0].mate_id if len(conflicts) == 1 else None)

    removed: dict[str, int] = {instance_id: (6 if instance_id == grounded else 0) for instance_id in instance_ids}
    for mate in request.mates:
        effect = {"FIXED": 6, "POINT_COINCIDENT": 3, "DISTANCE": 3, "AXIS_CONCENTRIC": 5}.get(mate.kind.upper(), 0)
        removed[mate.moving_instance_id] = min(6, removed[mate.moving_instance_id] + effect)
    diagnostics = [Diagnostic(code="ASSEMBLY_IMPLICIT_GROUND", severity="INFO", message=f"Instance {grounded!r} is the deterministic assembly ground")]
    diagnostics.extend(
        Diagnostic(code="ASSEMBLY_UNDERCONSTRAINED", severity="WARNING", message=f"Instance {instance_id!r} retains approximately {6 - removed[instance_id]} rigid degrees of freedom")
        for instance_id in sorted(instance_ids)
        if 6 - removed[instance_id] > 0
    )
    return transforms, reports, diagnostics
