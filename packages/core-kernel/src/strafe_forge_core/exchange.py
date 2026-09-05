"""Real OCCT STEP/STL exchange with geometry-level verification."""

from __future__ import annotations

import io
import math
import struct
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.STEPControl import STEPControl_AsIs, STEPControl_Reader, STEPControl_Writer
from OCP.StlAPI import StlAPI_Reader, StlAPI_Writer
from OCP.TColStd import TColStd_SequenceOfAsciiString
from OCP.TopoDS import TopoDS_Shape

from .artifacts import GeometryArtifact
from .diagnostics import Diagnostic, KernelError
from .engine import EngineManifest
from .scalars import canonical_decimal
from .topology import (
    KernelShape,
    deserialize_brep,
    exact_bounds,
    mass_properties,
    semantic_fingerprint,
    serialize_brep,
    shape_is_valid,
    topology_counts,
)


@dataclass(frozen=True, slots=True)
class VerificationCheck:
    code: str
    status: str
    observed: str | None
    expected: str | None
    tolerance: str | None

    def as_dict(self) -> dict[str, str | None]:
        return {
            "code": self.code,
            "status": self.status,
            "observed": self.observed,
            "expected": self.expected,
            "tolerance": self.tolerance,
        }


@dataclass(slots=True)
class ExchangeResult:
    request_id: str
    direction: str
    format: str
    status: str
    source_revision_id: str | None
    source_artifact_id: str | None
    engine_manifest_hash: str
    output_artifact: GeometryArtifact | None
    diagnostics: list[Diagnostic]
    checks: list[VerificationCheck]
    imported_shape: KernelShape | None = None

    @property
    def verification_status(self) -> str:
        if not self.checks:
            return "NOT_RUN"
        return "PASSED" if all(item.status == "PASSED" for item in self.checks) else "FAILED"

    def as_dict(self) -> dict[str, object]:
        return {
            "protocol_version": "forge.exchange-result/1",
            "request_id": self.request_id,
            "direction": self.direction,
            "format": self.format,
            "status": self.status,
            "source_revision_id": self.source_revision_id,
            "source_artifact_id": self.source_artifact_id,
            "engine_manifest_hash": self.engine_manifest_hash,
            "output_artifact": self.output_artifact.as_dict()
            if self.output_artifact
            else None,
            "diagnostics": [item.as_dict() for item in self.diagnostics],
            "verification": {
                "status": self.verification_status,
                "checks": [item.as_dict() for item in self.checks],
            },
        }


def _check(
    code: str,
    passed: bool,
    observed: object,
    expected: object,
    tolerance: str | None = None,
) -> VerificationCheck:
    return VerificationCheck(
        code,
        "PASSED" if passed else "FAILED",
        None if observed is None else str(observed),
        None if expected is None else str(expected),
        tolerance,
    )


def _close(left: float, right: float, tolerance: float) -> bool:
    return abs(left - right) <= max(tolerance, tolerance * max(abs(left), abs(right)))


def _geometry_checks(source: Any, imported: Any, tolerance: float) -> list[VerificationCheck]:
    source_bounds = exact_bounds(source)
    imported_bounds = exact_bounds(imported)
    source_area, source_volume = mass_properties(source)
    imported_area, imported_volume = mass_properties(imported)
    source_counts = topology_counts(source)
    imported_counts = topology_counts(imported)
    checks = [
        _check("SHAPE_VALID", shape_is_valid(imported), str(shape_is_valid(imported)).lower(), "true"),
        _check(
            "BOUNDS_MATCH",
            all(_close(a, b, tolerance) for a, b in zip(source_bounds, imported_bounds)),
            ",".join(canonical_decimal(value) for value in imported_bounds),
            ",".join(canonical_decimal(value) for value in source_bounds),
            canonical_decimal(tolerance),
        ),
        _check(
            "AREA_MATCH",
            _close(source_area, imported_area, tolerance),
            canonical_decimal(imported_area),
            canonical_decimal(source_area),
            canonical_decimal(tolerance),
        ),
        _check(
            "VOLUME_MATCH",
            _close(source_volume, imported_volume, tolerance),
            canonical_decimal(imported_volume),
            canonical_decimal(source_volume),
            canonical_decimal(tolerance),
        ),
        _check(
            "TOPOLOGY_COUNTS_MATCH",
            source_counts == imported_counts,
            str(imported_counts),
            str(source_counts),
        ),
    ]
    return checks


def _step_units(reader: STEPControl_Reader) -> list[str]:
    lengths = TColStd_SequenceOfAsciiString()
    angles = TColStd_SequenceOfAsciiString()
    solid_angles = TColStd_SequenceOfAsciiString()
    reader.FileUnits(lengths, angles, solid_angles)
    return [lengths.Value(index).ToCString().lower() for index in range(1, lengths.Length() + 1)]


def _read_step(payload: bytes) -> tuple[Any, list[str]]:
    reader = STEPControl_Reader()
    status = reader.ReadStream("inline.step", io.BytesIO(payload))
    if status != IFSelect_RetDone:
        raise KernelError("EXCHANGE_IMPORT_FAILED", f"OCCT STEP reader returned {status}")
    if reader.TransferRoots() < 1:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "STEP contains no transferable roots")
    shape = reader.OneShape()
    if shape.IsNull() or not shape_is_valid(shape):
        raise KernelError("EXCHANGE_IMPORT_FAILED", "STEP did not yield a valid exact shape")
    return shape, _step_units(reader)


def _write_step(shape: Any, schema: str) -> bytes:
    writer = STEPControl_Writer()
    schema_value = {"AP203": "AP203", "AP214": "AP214IS", "AP242": "AP242DIS"}.get(schema)
    if schema_value is None:
        raise KernelError("OPERATION_PAYLOAD_INVALID", f"Unsupported STEP schema {schema!r}")
    if not Interface_Static.SetCVal_s("write.step.schema", schema_value):
        raise KernelError("EXCHANGE_VERIFICATION_FAILED", "OCCT STEP schema setting unavailable")
    if not Interface_Static.SetCVal_s("write.step.unit", "MM"):
        raise KernelError("EXCHANGE_VERIFICATION_FAILED", "OCCT STEP unit setting unavailable")
    if writer.Transfer(shape, STEPControl_AsIs) != IFSelect_RetDone:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "OCCT STEP transfer failed")
    buffer = io.BytesIO()
    if writer.WriteStream(buffer) != IFSelect_RetDone:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "OCCT STEP writer failed")
    return buffer.getvalue()


Triangle = tuple[
    tuple[float, float, float],
    tuple[float, float, float],
    tuple[float, float, float],
]


def parse_stl(payload: bytes) -> list[Triangle]:
    if len(payload) >= 84:
        count = struct.unpack_from("<I", payload, 80)[0]
        if len(payload) == 84 + count * 50:
            triangles: list[Triangle] = []
            offset = 84
            for _ in range(count):
                values = struct.unpack_from("<12fH", payload, offset)
                triangles.append(
                    (
                        (float(values[3]), float(values[4]), float(values[5])),
                        (float(values[6]), float(values[7]), float(values[8])),
                        (float(values[9]), float(values[10]), float(values[11])),
                    )
                )
                offset += 50
            return triangles
    try:
        text = payload.decode("ascii")
    except UnicodeDecodeError as exc:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "STL is neither binary nor ASCII") from exc
    vertices: list[tuple[float, float, float]] = []
    for line in text.splitlines():
        parts = line.strip().split()
        if len(parts) == 4 and parts[0].lower() == "vertex":
            try:
                point = tuple(float(value) for value in parts[1:])
            except ValueError as exc:
                raise KernelError("EXCHANGE_IMPORT_FAILED", "Invalid ASCII STL vertex") from exc
            if not all(math.isfinite(value) for value in point):
                raise KernelError("EXCHANGE_IMPORT_FAILED", "Non-finite ASCII STL vertex")
            vertices.append(point)  # type: ignore[arg-type]
    if len(vertices) % 3:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "ASCII STL has an incomplete triangle")
    return [tuple(vertices[index : index + 3]) for index in range(0, len(vertices), 3)]  # type: ignore[list-item]


def _mesh_bounds(triangles: Sequence[Triangle]) -> tuple[float, float, float, float, float, float]:
    points = [point for triangle in triangles for point in triangle]
    if not points:
        raise KernelError("EXCHANGE_IMPORT_FAILED", "STL contains no triangles")
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        min(point[2] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
        max(point[2] for point in points),
    )


def _mesh_signed_volume(triangles: Sequence[Triangle]) -> float:
    volume = 0.0
    for (ax, ay, az), (bx, by, bz), (cx, cy, cz) in triangles:
        volume += (
            ax * (by * cz - bz * cy)
            - ay * (bx * cz - bz * cx)
            + az * (bx * cy - by * cx)
        ) / 6.0
    return volume


def _watertight(triangles: Sequence[Triangle], tolerance: float) -> bool:
    scale = max(tolerance, 1e-9)

    def key(point: tuple[float, float, float]) -> tuple[int, int, int]:
        return tuple(round(value / scale) for value in point)  # type: ignore[return-value]

    edges: dict[tuple[tuple[int, int, int], tuple[int, int, int]], int] = {}
    for triangle in triangles:
        points = [key(point) for point in triangle]
        for index in range(3):
            edge = tuple(sorted((points[index], points[(index + 1) % 3])))
            edges[edge] = edges.get(edge, 0) + 1  # type: ignore[index]
    return bool(edges) and all(count == 2 for count in edges.values())


def _write_stl(
    shape: Any,
    *,
    linear_deflection_mm: float,
    angular_deflection_deg: float,
    binary: bool,
) -> bytes:
    mesher = BRepMesh_IncrementalMesh(
        shape,
        linear_deflection_mm,
        False,
        math.radians(angular_deflection_deg),
        False,
    )
    mesher.Perform()
    if not mesher.IsDone():
        raise KernelError("EXCHANGE_VERIFICATION_FAILED", "OCCT STL meshing failed")
    with tempfile.TemporaryDirectory(prefix="forge-stl-") as directory:
        path = Path(directory) / "artifact.stl"
        writer = StlAPI_Writer()
        writer.ASCIIMode = not binary
        if not writer.Write(shape, str(path)):
            raise KernelError("EXCHANGE_IMPORT_FAILED", "OCCT STL writer failed")
        return path.read_bytes()


def _read_stl_shape(payload: bytes) -> Any:
    with tempfile.TemporaryDirectory(prefix="forge-stl-import-") as directory:
        path = Path(directory) / "source.stl"
        path.write_bytes(payload)
        shape = TopoDS_Shape()
        if not StlAPI_Reader().Read(shape, str(path)) or shape.IsNull():
            raise KernelError("EXCHANGE_IMPORT_FAILED", "OCCT STL reader failed")
        return shape


class ExchangeService:
    def __init__(self, manifest: EngineManifest) -> None:
        self.manifest = manifest

    def export_step(
        self,
        request_id: str,
        source: GeometryArtifact,
        *,
        schema: str = "AP242",
    ) -> ExchangeResult:
        return self._export_step(request_id, source, schema)

    def _export_step(
        self, request_id: str, source: GeometryArtifact, schema: str
    ) -> ExchangeResult:
        try:
            shape = self._exact_source(source)
            content = _write_step(shape, schema)
            imported, units = _read_step(content)
            checks = _geometry_checks(shape, imported, 1e-6)
            unit_ok = any("milli" in unit or unit == "mm" for unit in units)
            checks.append(_check("STEP_UNITS_MM", unit_ok, ",".join(units), "millimetre"))
            passed = all(item.status == "PASSED" for item in checks)
            artifact = GeometryArtifact(
                "STEP",
                source.source_revision_id,
                source.geometry_hash,
                source.producing_operation_id,
                self.manifest.manifest_hash,
                "model/step",
                content,
                source.semantic_fingerprint,
                {"status": "PASSED" if passed else "FAILED", "checks": [item.as_dict() for item in checks]},
            )
            if not passed:
                raise KernelError("EXCHANGE_VERIFICATION_FAILED", "STEP re-import checks failed")
            return ExchangeResult(request_id, "EXPORT", "STEP", "SUCCEEDED", source.source_revision_id, source.artifact_id, self.manifest.manifest_hash, artifact, [], checks)
        except KernelError as exc:
            return ExchangeResult(request_id, "EXPORT", "STEP", "FAILED", source.source_revision_id, source.artifact_id, self.manifest.manifest_hash, None, [exc.diagnostic], [])

    def export_stl(
        self,
        request_id: str,
        source: GeometryArtifact,
        *,
        linear_deflection_mm: float = 0.1,
        angular_deflection_deg: float = 15.0,
        binary: bool = True,
    ) -> ExchangeResult:
        try:
            shape = self._exact_source(source)
            content = _write_stl(
                shape,
                linear_deflection_mm=linear_deflection_mm,
                angular_deflection_deg=angular_deflection_deg,
                binary=binary,
            )
            triangles = parse_stl(content)
            mesh_bounds = _mesh_bounds(triangles)
            source_bounds = exact_bounds(shape)
            signed_volume = _mesh_signed_volume(triangles)
            checks = [
                _check("STL_TRIANGLES_NONEMPTY", bool(triangles), len(triangles), ">0"),
                _check("STL_WATERTIGHT", _watertight(triangles, 1e-7), str(_watertight(triangles, 1e-7)).lower(), "true"),
                _check("STL_OUTWARD_ORIENTATION", signed_volume > 0, canonical_decimal(signed_volume), ">0"),
                _check(
                    "STL_BOUNDS_MATCH",
                    all(_close(a, b, linear_deflection_mm) for a, b in zip(mesh_bounds, source_bounds)),
                    ",".join(canonical_decimal(value) for value in mesh_bounds),
                    ",".join(canonical_decimal(value) for value in source_bounds),
                    canonical_decimal(linear_deflection_mm),
                ),
            ]
            imported = _read_stl_shape(content)
            checks.append(_check("STL_OCCT_REIMPORT", not imported.IsNull(), "true", "true"))
            passed = all(item.status == "PASSED" for item in checks)
            artifact = GeometryArtifact(
                "STL",
                source.source_revision_id,
                source.geometry_hash,
                source.producing_operation_id,
                self.manifest.manifest_hash,
                "model/stl",
                content,
                source.semantic_fingerprint,
                {"status": "PASSED" if passed else "FAILED", "checks": [item.as_dict() for item in checks]},
            )
            if not passed:
                raise KernelError("EXCHANGE_VERIFICATION_FAILED", "STL verification checks failed")
            return ExchangeResult(request_id, "EXPORT", "STL", "SUCCEEDED", source.source_revision_id, source.artifact_id, self.manifest.manifest_hash, artifact, [], checks)
        except KernelError as exc:
            return ExchangeResult(request_id, "EXPORT", "STL", "FAILED", source.source_revision_id, source.artifact_id, self.manifest.manifest_hash, None, [exc.diagnostic], [])

    def import_step(
        self,
        request_id: str,
        payload: bytes,
        *,
        imported_revision_id: str,
        geometry_hash: str,
    ) -> ExchangeResult:
        try:
            shape, units = _read_step(payload)
            fingerprint, _ = semantic_fingerprint(shape, units={"length": "mm", "angle": "deg"}, exact_entities=[])
            brep = serialize_brep(shape)
            checks = [
                _check("SHAPE_VALID", shape_is_valid(shape), "true", "true"),
                _check("STEP_UNITS_PRESENT", bool(units), ",".join(units), "non-empty"),
            ]
            artifact = GeometryArtifact("BREP", imported_revision_id, geometry_hash, None, self.manifest.manifest_hash, "application/vnd.opencascade.brep", brep, fingerprint, {"status": "PASSED", "checks": [item.as_dict() for item in checks]})
            return ExchangeResult(request_id, "IMPORT", "STEP", "SUCCEEDED", None, None, self.manifest.manifest_hash, artifact, [], checks, KernelShape("COMPOUND", shape))
        except KernelError as exc:
            return ExchangeResult(request_id, "IMPORT", "STEP", "FAILED", None, None, self.manifest.manifest_hash, None, [exc.diagnostic], [])

    def import_stl(
        self,
        request_id: str,
        payload: bytes,
        *,
        imported_revision_id: str,
        geometry_hash: str,
    ) -> ExchangeResult:
        try:
            triangles = parse_stl(payload)
            shape = _read_stl_shape(payload)
            bounds = _mesh_bounds(triangles)
            checks = [
                _check("STL_TRIANGLES_NONEMPTY", bool(triangles), len(triangles), ">0"),
                _check("STL_BOUNDS_FINITE", all(math.isfinite(value) for value in bounds), "true", "true"),
            ]
            mesh_fingerprint, _ = semantic_fingerprint(shape, units={"length": "mm", "angle": "deg"}, exact_entities=[])
            artifact = GeometryArtifact("MESH", imported_revision_id, geometry_hash, None, self.manifest.manifest_hash, "model/stl", payload, mesh_fingerprint, {"status": "PASSED", "checks": [item.as_dict() for item in checks]})
            return ExchangeResult(request_id, "IMPORT", "STL", "SUCCEEDED", None, None, self.manifest.manifest_hash, artifact, [], checks, KernelShape("MESH", shape))
        except KernelError as exc:
            return ExchangeResult(request_id, "IMPORT", "STL", "FAILED", None, None, self.manifest.manifest_hash, None, [exc.diagnostic], [])

    @staticmethod
    def _exact_source(source: GeometryArtifact) -> Any:
        if source.artifact_kind != "BREP":
            raise KernelError("EXCHANGE_SOURCE_INVALID", "Export source must be an exact BREP")
        return deserialize_brep(source.content)
