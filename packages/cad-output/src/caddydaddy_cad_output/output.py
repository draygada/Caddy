"""Fail-closed, deterministic CAD output generation.

This module is intentionally downstream of a geometry kernel. Drawings are wire projections of a
validated triangle mesh, not engineering drawings with hidden-line removal, dimensions, or GD&T.
Exchange artifacts are packaged bytes, never regenerated or interpreted here.
"""

from __future__ import annotations

import copy
import csv
import hashlib
import html
import io
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence


NATIVE_SCHEMA = "caddydaddy.native-document/1"
MESH_SCHEMA = "caddydaddy.kernel-mesh/1"
PACKAGE_SCHEMA = "caddydaddy.manufacturing-package/1"
SUPPORTED_KERNEL_FORMATS = ("STEP", "IGES", "STL")
DEFAULT_LIMITATIONS = (
    "NO_CAM_TOOLPATHS_OR_GCODE",
    "NO_TOLERANCING_OR_GD_AND_T",
    "NO_MANUFACTURABILITY_CERTIFICATION",
    "NO_HIDDEN_LINE_OR_DIMENSIONED_DRAWING",
    "NO_ROUND_TRIP_BREP_FIDELITY_CLAIM",
    "STEP_IGES_STL_BYTES_ARE_KERNEL_OUTPUTS_NOT_NATIVE_HISTORY",
)


class CadOutputError(ValueError):
    """A stable fail-closed CAD output diagnostic."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class KernelArtifact:
    """One exact kernel-produced exchange artifact and its receipt identity."""

    format: str
    content: bytes
    content_sha256: str
    source_revision_id: str
    document_hash: str
    units: str = "mm"


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _reject_constant(value: str) -> None:
    raise CadOutputError("NONFINITE_NUMBER", f"JSON constant {value!r} is forbidden")


def _pairs_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise CadOutputError("DUPLICATE_JSON_KEY", f"Duplicate JSON key {key!r}")
        result[key] = value
    return result


def _validate_json_value(value: Any, *, path: str = "$") -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise CadOutputError("NONFINITE_NUMBER", f"Non-finite number at {path}")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_json_value(item, path=f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise CadOutputError("DOCUMENT_INVALID", f"Non-string key at {path}")
            _validate_json_value(item, path=f"{path}.{key}")
        return
    raise CadOutputError("DOCUMENT_INVALID", f"Unsupported JSON value at {path}")


def canonical_json_bytes(value: Any) -> bytes:
    """Encode strict finite JSON with stable key order and no insignificant whitespace."""

    _validate_json_value(value)
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _expect_exact_keys(value: Mapping[str, Any], keys: set[str], path: str) -> None:
    actual = set(value)
    if actual != keys:
        raise CadOutputError(
            "DOCUMENT_INVALID",
            f"{path} keys differ; missing={sorted(keys - actual)!r}, extra={sorted(actual - keys)!r}",
        )


def _text(value: Any, path: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value):
        raise CadOutputError("DOCUMENT_INVALID", f"{path} must be a non-empty string")
    if "\x00" in value or "\r" in value or "\n" in value:
        raise CadOutputError("DOCUMENT_INVALID", f"{path} contains a forbidden control character")
    return value


def _sha(value: Any, path: str) -> str:
    result = _text(value, path)
    if len(result) != 64 or any(character not in "0123456789abcdef" for character in result):
        raise CadOutputError("DOCUMENT_INVALID", f"{path} must be lowercase SHA-256")
    return result


def _string_map(value: Any, path: str) -> dict[str, str]:
    if not isinstance(value, dict):
        raise CadOutputError("DOCUMENT_INVALID", f"{path} must be an object")
    return {
        _text(key, f"{path}.key"): _text(item, f"{path}.{key}", allow_empty=True)
        for key, item in value.items()
    }


def _identity_preimage(document: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: copy.deepcopy(value)
        for key, value in document.items()
        if key not in {"revision_id", "document_hash"}
    }


def _validate_native_document(document: Any, *, require_identity: bool) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise CadOutputError("DOCUMENT_INVALID", "Native document must be an object")
    _validate_json_value(document)
    keys = {
        "schema_version",
        "document_id",
        "parent_revision_id",
        "units",
        "parts",
        "assembly",
        "metadata",
    }
    if require_identity:
        keys |= {"revision_id", "document_hash"}
    _expect_exact_keys(document, keys, "document")
    if document["schema_version"] != NATIVE_SCHEMA:
        raise CadOutputError("SCHEMA_UNSUPPORTED", f"Expected {NATIVE_SCHEMA}")
    _text(document["document_id"], "document.document_id")
    parent = document["parent_revision_id"]
    if parent is not None:
        _text(parent, "document.parent_revision_id")
    if document["units"] != {"length": "mm", "angle": "deg"}:
        raise CadOutputError("UNIT_UNSUPPORTED", "Native document requires mm and deg")
    _string_map(document["metadata"], "document.metadata")

    parts = document["parts"]
    if not isinstance(parts, list) or not parts:
        raise CadOutputError("DOCUMENT_INVALID", "Native document requires at least one part")
    part_index: dict[str, Mapping[str, Any]] = {}
    for index, part in enumerate(parts):
        path = f"document.parts[{index}]"
        if not isinstance(part, dict):
            raise CadOutputError("DOCUMENT_INVALID", f"{path} must be an object")
        _expect_exact_keys(
            part,
            {
                "part_id",
                "part_number",
                "name",
                "revision_id",
                "geometry_hash",
                "material",
                "unit",
                "authored_document",
            },
            path,
        )
        part_id = _text(part["part_id"], f"{path}.part_id")
        if part_id in part_index:
            raise CadOutputError("DUPLICATE_ID", f"Duplicate part {part_id!r}")
        _text(part["part_number"], f"{path}.part_number")
        _text(part["name"], f"{path}.name")
        _text(part["revision_id"], f"{path}.revision_id")
        _sha(part["geometry_hash"], f"{path}.geometry_hash")
        if part["material"] is not None:
            _text(part["material"], f"{path}.material", allow_empty=True)
        if part["unit"] != "EA":
            raise CadOutputError("UNIT_UNSUPPORTED", f"{path}.unit must be EA")
        authored = part["authored_document"]
        if not isinstance(authored, dict) or authored.get("document_id") != part_id:
            raise CadOutputError(
                "DOCUMENT_INVALID", f"{path}.authored_document must match part_id"
            )
        part_index[part_id] = part

    assembly = document["assembly"]
    if not isinstance(assembly, dict):
        raise CadOutputError("DOCUMENT_INVALID", "document.assembly must be an object")
    _expect_exact_keys(
        assembly,
        {"assembly_id", "assembly_revision_id", "instances", "mates"},
        "document.assembly",
    )
    _text(assembly["assembly_id"], "document.assembly.assembly_id")
    _text(assembly["assembly_revision_id"], "document.assembly.assembly_revision_id")
    instances = assembly["instances"]
    if not isinstance(instances, list) or not instances:
        raise CadOutputError("DOCUMENT_INVALID", "Assembly requires at least one instance")
    instance_ids: set[str] = set()
    for index, instance in enumerate(instances):
        path = f"document.assembly.instances[{index}]"
        if not isinstance(instance, dict):
            raise CadOutputError("DOCUMENT_INVALID", f"{path} must be an object")
        _expect_exact_keys(
            instance,
            {
                "instance_id",
                "part_id",
                "part_revision_id",
                "quantity",
                "transform_row_major",
                "metadata",
            },
            path,
        )
        instance_id = _text(instance["instance_id"], f"{path}.instance_id")
        if instance_id in instance_ids:
            raise CadOutputError("DUPLICATE_ID", f"Duplicate instance {instance_id!r}")
        instance_ids.add(instance_id)
        part_id = _text(instance["part_id"], f"{path}.part_id")
        if part_id not in part_index:
            raise CadOutputError("REFERENCE_MISSING", f"Unknown part {part_id!r}")
        revision = _text(instance["part_revision_id"], f"{path}.part_revision_id")
        if revision != part_index[part_id]["revision_id"]:
            raise CadOutputError("STALE_IDENTITY", f"Stale part revision on {instance_id!r}")
        quantity = instance["quantity"]
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
            raise CadOutputError("DOCUMENT_INVALID", f"{path}.quantity must be a positive integer")
        transform = instance["transform_row_major"]
        if not isinstance(transform, list) or len(transform) != 16:
            raise CadOutputError("DOCUMENT_INVALID", f"{path}.transform_row_major needs 16 values")
        for offset, value in enumerate(transform):
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise CadOutputError("NONFINITE_NUMBER", f"{path}.transform_row_major[{offset}]")
        _string_map(instance["metadata"], f"{path}.metadata")

    mates = assembly["mates"]
    if not isinstance(mates, list):
        raise CadOutputError("DOCUMENT_INVALID", "document.assembly.mates must be an array")
    mate_ids: set[str] = set()
    for index, mate in enumerate(mates):
        path = f"document.assembly.mates[{index}]"
        if not isinstance(mate, dict):
            raise CadOutputError("DOCUMENT_INVALID", f"{path} must be an object")
        _expect_exact_keys(mate, {"mate_id", "kind", "instance_ids", "parameters"}, path)
        mate_id = _text(mate["mate_id"], f"{path}.mate_id")
        if mate_id in mate_ids:
            raise CadOutputError("DUPLICATE_ID", f"Duplicate mate {mate_id!r}")
        mate_ids.add(mate_id)
        _text(mate["kind"], f"{path}.kind")
        references = mate["instance_ids"]
        if not isinstance(references, list) or not references:
            raise CadOutputError("DOCUMENT_INVALID", f"{path}.instance_ids must be non-empty")
        if any(reference not in instance_ids for reference in references):
            raise CadOutputError("REFERENCE_MISSING", f"{path} references an unknown instance")
        if not isinstance(mate["parameters"], dict):
            raise CadOutputError("DOCUMENT_INVALID", f"{path}.parameters must be an object")

    if require_identity:
        declared_hash = _sha(document["document_hash"], "document.document_hash")
        actual_hash = _sha256(canonical_json_bytes(_identity_preimage(document)))
        if declared_hash != actual_hash or document["revision_id"] != f"native-rev:{actual_hash}":
            raise CadOutputError("STALE_IDENTITY", "Native document identity does not match content")
    return copy.deepcopy(document)


def create_native_document(document: Mapping[str, Any]) -> dict[str, Any]:
    """Validate authored native state and stamp a content-addressed revision identity."""

    candidate = _validate_native_document(dict(document), require_identity=False)
    digest = _sha256(canonical_json_bytes(candidate))
    candidate["document_hash"] = digest
    candidate["revision_id"] = f"native-rev:{digest}"
    return _validate_native_document(candidate, require_identity=True)


def export_native_document(document: Mapping[str, Any]) -> bytes:
    """Export a sealed native document as canonical UTF-8 JSON."""

    return canonical_json_bytes(_validate_native_document(dict(document), require_identity=True))


def import_native_document(content: bytes) -> dict[str, Any]:
    """Import strict canonical native JSON and verify its embedded identity."""

    if not isinstance(content, bytes) or not content:
        raise CadOutputError("DOCUMENT_INVALID", "Native document bytes are required")
    try:
        value = json.loads(
            content.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CadOutputError("DOCUMENT_INVALID", "Native document is not strict UTF-8 JSON") from error
    result = _validate_native_document(value, require_identity=True)
    if content != canonical_json_bytes(result):
        raise CadOutputError("DOCUMENT_NONCANONICAL", "Native document is not canonical JSON")
    return result


def _normalise_mesh(
    packet: Mapping[str, Any], expected_revision_id: str, expected_document_hash: str
) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int]]]:
    if packet.get("schema_version") != MESH_SCHEMA:
        raise CadOutputError("SCHEMA_UNSUPPORTED", f"Expected {MESH_SCHEMA}")
    if packet.get("source_revision_id") != expected_revision_id:
        raise CadOutputError("STALE_IDENTITY", "Kernel mesh revision is stale")
    if packet.get("document_hash") != expected_document_hash:
        raise CadOutputError("STALE_IDENTITY", "Kernel mesh document hash is stale")
    if packet.get("units") != {"length": "mm"}:
        raise CadOutputError("UNIT_UNSUPPORTED", "Kernel mesh requires millimetres")
    raw_vertices = packet.get("vertices")
    raw_triangles = packet.get("triangles")
    if not isinstance(raw_vertices, list) or len(raw_vertices) < 3:
        raise CadOutputError("MESH_INVALID", "Kernel mesh requires at least three vertices")
    vertices: list[tuple[float, float, float]] = []
    for index, point in enumerate(raw_vertices):
        if not isinstance(point, list) or len(point) != 3:
            raise CadOutputError("MESH_INVALID", f"Vertex {index} must have three coordinates")
        values = tuple(point)
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in values):
            raise CadOutputError("NONFINITE_MESH", f"Vertex {index} is non-finite")
        vertices.append((float(values[0]), float(values[1]), float(values[2])))
    if not isinstance(raw_triangles, list) or not raw_triangles:
        raise CadOutputError("MESH_INVALID", "Kernel mesh requires triangles")
    triangles: list[tuple[int, int, int]] = []
    for index, triangle in enumerate(raw_triangles):
        if not isinstance(triangle, list) or len(triangle) != 3:
            raise CadOutputError("MESH_INVALID", f"Triangle {index} needs three indices")
        if any(isinstance(item, bool) or not isinstance(item, int) for item in triangle):
            raise CadOutputError("MESH_INVALID", f"Triangle {index} indices must be integers")
        a, b, c = triangle
        if len({a, b, c}) != 3 or min(a, b, c) < 0 or max(a, b, c) >= len(vertices):
            raise CadOutputError("MESH_INVALID", f"Triangle {index} has invalid indices")
        va, vb, vc = vertices[a], vertices[b], vertices[c]
        ab = tuple(vb[axis] - va[axis] for axis in range(3))
        ac = tuple(vc[axis] - va[axis] for axis in range(3))
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        if sum(component * component for component in cross) <= 1e-24:
            raise CadOutputError("MESH_INVALID", f"Triangle {index} is degenerate")
        triangles.append((a, b, c))
    return vertices, triangles


def _number(value: float) -> str:
    rounded = round(value, 9)
    if rounded == 0:
        rounded = 0
    return f"{rounded:.9f}".rstrip("0").rstrip(".")


def _projected_edges(
    vertices: Sequence[tuple[float, float, float]],
    triangles: Sequence[tuple[int, int, int]],
    axes: tuple[int, int],
) -> list[tuple[float, float, float, float]]:
    edge_ids = {
        tuple(sorted((triangle[offset], triangle[(offset + 1) % 3])))
        for triangle in triangles
        for offset in range(3)
    }
    projected = {
        (
            vertices[start][axes[0]],
            vertices[start][axes[1]],
            vertices[end][axes[0]],
            vertices[end][axes[1]],
        )
        for start, end in edge_ids
    }
    canonical = {
        segment if segment[:2] <= segment[2:] else (segment[2], segment[3], segment[0], segment[1])
        for segment in projected
        if segment[:2] != segment[2:]
    }
    return sorted(canonical)


def _render_svg(name: str, edges: Sequence[tuple[float, float, float, float]]) -> bytes:
    coordinates = [(x1, y1) for x1, y1, _, _ in edges] + [(x2, y2) for _, _, x2, y2 in edges]
    min_x = min(point[0] for point in coordinates)
    max_x = max(point[0] for point in coordinates)
    min_y = min(point[1] for point in coordinates)
    max_y = max(point[1] for point in coordinates)
    width = max(max_x - min_x, 1.0)
    height = max(max_y - min_y, 1.0)
    margin = max(width, height) * 0.05
    lines = "".join(
        f'<line x1="{_number(x1)}" y1="{_number(-y1)}" x2="{_number(x2)}" y2="{_number(-y2)}"/>'
        for x1, y1, x2, y2 in edges
    )
    title = html.escape(f"{name.title()} orthographic mesh-edge projection")
    view_y = -max_y - margin
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{_number(min_x - margin)} '
        f'{_number(view_y)} {_number(width + 2 * margin)} {_number(height + 2 * margin)}" '
        f'fill="none" stroke="#111" stroke-width="0.25" vector-effect="non-scaling-stroke">'
        f'<title>{title}</title><g>{lines}</g></svg>\n'
    ).encode("utf-8")


def _render_dxf(name: str, edges: Sequence[tuple[float, float, float, float]]) -> bytes:
    records = [
        "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
        "0", "SECTION", "2", "ENTITIES",
    ]
    layer = name.upper()
    for x1, y1, x2, y2 in edges:
        records.extend(
            [
                "0", "LINE", "8", layer,
                "10", _number(x1), "20", _number(y1), "30", "0",
                "11", _number(x2), "21", _number(y2), "31", "0",
            ]
        )
    records.extend(["0", "ENDSEC", "0", "EOF"])
    return ("\n".join(records) + "\n").encode("ascii")


def derive_orthographic_drawings(
    mesh_packet: Mapping[str, Any], *, expected_revision_id: str, expected_document_hash: str
) -> dict[str, bytes]:
    """Derive deterministic top/front/right mesh-edge projections."""

    vertices, triangles = _normalise_mesh(
        mesh_packet, expected_revision_id, expected_document_hash
    )
    projections = {"top": (0, 1), "front": (0, 2), "right": (1, 2)}
    result: dict[str, bytes] = {}
    for name, axes in projections.items():
        edges = _projected_edges(vertices, triangles, axes)
        if not edges:
            raise CadOutputError("MESH_INVALID", f"{name} projection has no visible edge")
        result[f"drawings/{name}.svg"] = _render_svg(name, edges)
        result[f"drawings/{name}.dxf"] = _render_dxf(name, edges)
    return result


def _csv_cell(value: str) -> str:
    # Quoting does not neutralize spreadsheet formulas. Preserve readable data with an explicit
    # text marker whenever common spreadsheet applications could execute the cell.
    return "'" + value if value.startswith(("=", "+", "-", "@")) else value


def render_bom_csv(document: Mapping[str, Any]) -> bytes:
    """Aggregate assembly instances into a stable, spreadsheet-safe BOM."""

    native = _validate_native_document(dict(document), require_identity=True)
    parts = {part["part_id"]: part for part in native["parts"]}
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for instance in native["assembly"]["instances"]:
        key = (instance["part_id"], instance["part_revision_id"])
        row = grouped.setdefault(key, {"quantity": 0, "instance_ids": []})
        row["quantity"] += instance["quantity"]
        row["instance_ids"].append(instance["instance_id"])
    ordered = sorted(
        grouped.items(),
        key=lambda item: (parts[item[0][0]]["part_number"], item[0][0], item[0][1]),
    )
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(
        ["item", "part_number", "name", "part_id", "revision_id", "quantity", "unit", "material", "instance_ids"]
    )
    for item_number, ((part_id, revision_id), aggregate) in enumerate(ordered, start=1):
        part = parts[part_id]
        writer.writerow(
            [
                item_number,
                _csv_cell(part["part_number"]),
                _csv_cell(part["name"]),
                _csv_cell(part_id),
                _csv_cell(revision_id),
                aggregate["quantity"],
                "EA",
                _csv_cell(part["material"] or ""),
                ";".join(sorted(aggregate["instance_ids"])),
            ]
        )
    return stream.getvalue().encode("utf-8")


def _safe_relative_path(value: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value:
        raise CadOutputError("PATH_TRAVERSAL", "Artifact path is invalid")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise CadOutputError("PATH_TRAVERSAL", f"Unsafe artifact path {value!r}")
    return path


def _safe_package_name(value: str) -> str:
    path = _safe_relative_path(value)
    if len(path.parts) != 1:
        raise CadOutputError("PATH_TRAVERSAL", "Package name must be one path segment")
    return path.name


def _artifact_descriptor(path: str, kind: str, source: str, content: bytes) -> dict[str, Any]:
    media_types = {
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".dxf": "image/vnd.dxf",
        ".csv": "text/csv",
        ".step": "model/step",
        ".iges": "model/iges",
        ".stl": "model/stl",
    }
    return {
        "path": path,
        "kind": kind,
        "source": source,
        "media_type": media_types[PurePosixPath(path).suffix],
        "size_bytes": len(content),
        "sha256": _sha256(content),
        "verification": "REREAD_SHA256_BEFORE_SEAL",
    }


def _kernel_content(
    artifact: KernelArtifact, expected_revision_id: str, expected_document_hash: str
) -> tuple[str, bytes]:
    format_name = artifact.format.upper()
    if format_name not in SUPPORTED_KERNEL_FORMATS:
        raise CadOutputError("FORMAT_UNSUPPORTED", f"Unsupported kernel format {artifact.format!r}")
    if artifact.source_revision_id != expected_revision_id or artifact.document_hash != expected_document_hash:
        raise CadOutputError("STALE_IDENTITY", f"Stale {format_name} kernel artifact")
    if artifact.units != "mm":
        raise CadOutputError("UNIT_UNSUPPORTED", f"{format_name} artifact must use mm")
    if not isinstance(artifact.content, bytes) or not artifact.content:
        raise CadOutputError("KERNEL_ARTIFACT_MISSING", f"{format_name} bytes are empty")
    if _sha256(artifact.content) != artifact.content_sha256:
        raise CadOutputError("ARTIFACT_HASH_MISMATCH", f"{format_name} kernel receipt hash differs")
    suffix = {"STEP": "step", "IGES": "iges", "STL": "stl"}[format_name]
    return f"kernel/model.{suffix}", artifact.content


def _write_and_reread(root: Path, relative: str, content: bytes) -> bytes:
    safe = _safe_relative_path(relative)
    target = root.joinpath(*safe.parts)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    reread = target.read_bytes()
    if reread != content:
        raise CadOutputError("ARTIFACT_REREAD_FAILED", f"Written artifact differs at {relative!r}")
    return reread


def build_manufacturing_package(
    output_directory: Path,
    package_name: str,
    document: Mapping[str, Any],
    mesh_packet: Mapping[str, Any],
    *,
    kernel_artifacts: Sequence[KernelArtifact] = (),
    required_kernel_formats: Sequence[str] = (),
) -> dict[str, Any]:
    """Write, reread, hash, and seal one deterministic manufacturing-output package."""

    native = _validate_native_document(dict(document), require_identity=True)
    name = _safe_package_name(package_name)
    root = Path(output_directory) / name
    if root.exists():
        raise CadOutputError("OUTPUT_EXISTS", f"Output package already exists: {root}")
    root.mkdir(parents=True, exist_ok=False)
    expected_revision = native["revision_id"]
    expected_hash = native["document_hash"]
    required = {item.upper() for item in required_kernel_formats}
    if not required <= set(SUPPORTED_KERNEL_FORMATS):
        raise CadOutputError("FORMAT_UNSUPPORTED", "Required kernel format is unsupported")
    by_format: dict[str, KernelArtifact] = {}
    for artifact in kernel_artifacts:
        format_name = artifact.format.upper()
        if format_name in by_format:
            raise CadOutputError("DUPLICATE_ID", f"Duplicate kernel artifact {format_name}")
        by_format[format_name] = artifact
    missing = sorted(required - set(by_format))
    if missing:
        raise CadOutputError("KERNEL_ARTIFACT_MISSING", f"Missing required kernel artifacts: {missing}")

    pending: dict[str, tuple[str, str, bytes]] = {
        "document/native.caddy.json": ("NATIVE_DOCUMENT", "NATIVE", export_native_document(native)),
        "bom/bom.csv": ("BOM_CSV", "DERIVED", render_bom_csv(native)),
    }
    for path, content in derive_orthographic_drawings(
        mesh_packet,
        expected_revision_id=expected_revision,
        expected_document_hash=expected_hash,
    ).items():
        pending[path] = (
            "ORTHOGRAPHIC_SVG" if path.endswith(".svg") else "ORTHOGRAPHIC_DXF",
            "DERIVED_MESH_EDGE_PROJECTION",
            content,
        )
    for format_name in sorted(by_format):
        path, content = _kernel_content(by_format[format_name], expected_revision, expected_hash)
        pending[path] = (f"KERNEL_{format_name}", "KERNEL", content)

    descriptors: list[dict[str, Any]] = []
    try:
        for relative in sorted(pending):
            kind, source, content = pending[relative]
            reread = _write_and_reread(root, relative, content)
            descriptors.append(_artifact_descriptor(relative, kind, source, reread))
        payload = {
            "schema_version": PACKAGE_SCHEMA,
            "document_id": native["document_id"],
            "revision_id": expected_revision,
            "document_hash": expected_hash,
            "units": native["units"],
            "artifacts": descriptors,
            "required_kernel_formats": sorted(required),
            "limitations": list(DEFAULT_LIMITATIONS),
        }
        payload_hash = _sha256(canonical_json_bytes(payload))
        manifest = {
            **payload,
            "package_id": f"mfgpkg:{payload_hash}",
            "seal": {
                "algorithm": "SHA-256",
                "payload_sha256": payload_hash,
                "artifact_verification": "REREAD_BYTES_BEFORE_SEAL",
            },
        }
        manifest_bytes = canonical_json_bytes(manifest)
        reread_manifest = _write_and_reread(root, "manifest.json", manifest_bytes)
        manifest_sha = _sha256(reread_manifest)
        detached = (manifest_sha + "  manifest.json\n").encode("ascii")
        _write_and_reread(root, "manifest.sha256", detached)
        return {**manifest, "manifest_file_sha256": manifest_sha, "package_path": str(root)}
    except Exception:
        # A failed build is never a sealed package. Preserve evidence while marking it unusable.
        try:
            (root / "UNSEALED").write_text("Package generation failed; do not use.\n", encoding="ascii")
        except OSError:
            pass
        raise


def verify_manufacturing_package(package_directory: Path) -> dict[str, Any]:
    """Reread and verify a sealed package, including traversal and tamper checks."""

    root = Path(package_directory)
    if (root / "UNSEALED").exists():
        raise CadOutputError("PACKAGE_UNSEALED", "Package contains an UNSEALED marker")
    try:
        manifest_bytes = (root / "manifest.json").read_bytes()
        detached = (root / "manifest.sha256").read_text(encoding="ascii")
    except (OSError, UnicodeError) as error:
        raise CadOutputError("PACKAGE_UNSEALED", "Manifest or detached seal is missing") from error
    expected_detached = f"{_sha256(manifest_bytes)}  manifest.json\n"
    if detached != expected_detached:
        raise CadOutputError("MANIFEST_TAMPERED", "Detached manifest hash differs")
    try:
        manifest = json.loads(
            manifest_bytes.decode("utf-8"),
            object_pairs_hook=_pairs_without_duplicates,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest is not strict JSON") from error
    if not isinstance(manifest, dict) or manifest.get("schema_version") != PACKAGE_SCHEMA:
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest schema is invalid")
    if manifest_bytes != canonical_json_bytes(manifest):
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest is not canonical")
    seal = manifest.get("seal")
    package_id = manifest.get("package_id")
    if not isinstance(seal, dict) or seal.get("algorithm") != "SHA-256":
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest seal is invalid")
    payload = {key: value for key, value in manifest.items() if key not in {"package_id", "seal"}}
    payload_hash = _sha256(canonical_json_bytes(payload))
    if seal.get("payload_sha256") != payload_hash or package_id != f"mfgpkg:{payload_hash}":
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest payload identity differs")
    if manifest.get("limitations") != list(DEFAULT_LIMITATIONS):
        raise CadOutputError("MANIFEST_TAMPERED", "Required limitations changed")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise CadOutputError("MANIFEST_TAMPERED", "Manifest artifacts are missing")
    seen: set[str] = set()
    resolved_root = root.resolve()
    for descriptor in artifacts:
        if not isinstance(descriptor, dict):
            raise CadOutputError("MANIFEST_TAMPERED", "Artifact descriptor is invalid")
        relative = str(descriptor.get("path", ""))
        safe = _safe_relative_path(relative)
        if relative in seen:
            raise CadOutputError("MANIFEST_TAMPERED", f"Duplicate artifact path {relative!r}")
        seen.add(relative)
        target = root.joinpath(*safe.parts)
        resolved = target.resolve()
        if resolved_root not in resolved.parents:
            raise CadOutputError("PATH_TRAVERSAL", f"Artifact escapes package: {relative!r}")
        try:
            content = target.read_bytes()
        except OSError as error:
            raise CadOutputError("ARTIFACT_MISSING", f"Artifact is missing: {relative!r}") from error
        if len(content) != descriptor.get("size_bytes") or _sha256(content) != descriptor.get("sha256"):
            raise CadOutputError("ARTIFACT_TAMPERED", f"Artifact differs: {relative!r}")
        if descriptor.get("verification") != "REREAD_SHA256_BEFORE_SEAL":
            raise CadOutputError("MANIFEST_TAMPERED", "Artifact reread evidence changed")
    return manifest
