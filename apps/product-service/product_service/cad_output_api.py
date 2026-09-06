"""Fail-closed HTTP adapter for native CAD and manufacturing outputs.

The adapter never accepts caller-controlled output paths. It validates native identity, binds a
kernel mesh and optional exchange bytes to the embedded authoring revision, builds in a temporary
directory, verifies every written byte, and returns only relative artifact names plus base64 data.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Mapping, Sequence

from caddydaddy_cad_output import (
    CadOutputError,
    KernelArtifact,
    build_manufacturing_package,
    canonical_json_bytes,
    create_native_document,
    export_native_document,
    import_native_document,
    verify_manufacturing_package,
)
from caddydaddy_cad_output.output import DEFAULT_LIMITATIONS


API_SCHEMA = "caddydaddy.cad-output-api/1"
MESH_SOURCE_SCHEMA = "caddydaddy.kernel-mesh-source/1"
MAX_ARTIFACT_BYTES = 32 * 1024 * 1024
MAX_TOTAL_KERNEL_BYTES = 64 * 1024 * 1024
CLAIM_CEILING = (
    "Content-addressed native JSON, mesh-edge SVG/DXF views, BOM CSV, and a reread-verified "
    "manufacturing bundle. No CAM/G-code, GD&T, hidden-line engineering drawing, "
    "manufacturability certification, or B-rep history round-trip is provided."
)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _failure(code: str, message: str, status: int) -> tuple[int, dict[str, Any]]:
    return status, {
        "schema_version": API_SCHEMA,
        "status": "REJECTED",
        "diagnostic": {"code": code, "message": message},
        "limitations": list(DEFAULT_LIMITATIONS),
        "claim_ceiling": CLAIM_CEILING,
    }


def _status_for(error: CadOutputError) -> int:
    if error.code in {
        "STALE_IDENTITY",
        "ARTIFACT_HASH_MISMATCH",
        "ARTIFACT_TAMPERED",
        "MANIFEST_TAMPERED",
        "PACKAGE_UNSEALED",
    }:
        return 409
    if error.code in {"FORMAT_UNSUPPORTED", "UNIT_UNSUPPORTED", "SCHEMA_UNSUPPORTED"}:
        return 422
    return 400


def _safe_error(error: CadOutputError) -> str:
    messages = {
        "STALE_IDENTITY": "The document, mesh, or exchange artifact does not share one current revision identity.",
        "ARTIFACT_HASH_MISMATCH": "An exchange artifact differs from its declared SHA-256.",
        "ARTIFACT_TAMPERED": "A generated artifact changed after package sealing.",
        "MANIFEST_TAMPERED": "The manufacturing manifest failed seal verification.",
        "PACKAGE_UNSEALED": "The manufacturing package was not sealed successfully.",
        "PATH_TRAVERSAL": "An unsafe artifact name was rejected.",
        "FORMAT_UNSUPPORTED": "Only kernel-produced STEP, IGES, and STL exchange artifacts are supported.",
        "KERNEL_ARTIFACT_MISSING": "A requested kernel exchange artifact is missing.",
        "MESH_INVALID": "The kernel mesh is invalid or incomplete.",
        "NONFINITE_MESH": "The kernel mesh contains a non-finite coordinate.",
        "DOCUMENT_INVALID": "The native CAD document is invalid.",
        "DOCUMENT_NONCANONICAL": "The native CAD document is not canonical JSON.",
    }
    return messages.get(error.code, "CAD output validation failed closed.")


def _mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise CadOutputError("DOCUMENT_INVALID", f"{label} must be an object")
    return value


def _exact_keys(value: Mapping[str, Any], required: set[str], optional: set[str] = set()) -> None:
    keys = set(value)
    if not required <= keys or keys - required - optional:
        raise CadOutputError("DOCUMENT_INVALID", "Request fields differ from the output contract")


def _decode_base64(value: Any, label: str) -> bytes:
    if not isinstance(value, str) or not value or len(value) > (MAX_ARTIFACT_BYTES * 4 // 3 + 8):
        raise CadOutputError("DOCUMENT_INVALID", f"{label} is missing or exceeds the byte ceiling")
    try:
        content = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as error:
        raise CadOutputError("DOCUMENT_INVALID", f"{label} is not canonical base64") from error
    if not content or len(content) > MAX_ARTIFACT_BYTES:
        raise CadOutputError("DOCUMENT_INVALID", f"{label} is empty or exceeds the byte ceiling")
    return content


def _download(path: str, kind: str, source: str, media_type: str, content: bytes) -> dict[str, Any]:
    return {
        "path": path,
        "kind": kind,
        "source": source,
        "media_type": media_type,
        "size_bytes": len(content),
        "sha256": _sha256(content),
        "data_base64": base64.b64encode(content).decode("ascii"),
        "verification": "REREAD_SHA256_BEFORE_RESPONSE",
    }


def _native_response(document: Mapping[str, Any], content: bytes) -> dict[str, Any]:
    return {
        "schema_version": API_SCHEMA,
        "status": "VALID",
        "document": dict(document),
        "artifact": _download(
            "document/native.caddy.json",
            "NATIVE_DOCUMENT",
            "NATIVE",
            "application/json",
            content,
        ),
        "limitations": list(DEFAULT_LIMITATIONS),
        "claim_ceiling": CLAIM_CEILING,
    }


def _embedded_revision(document: Mapping[str, Any]) -> str:
    parts = document.get("parts")
    if not isinstance(parts, list) or not parts:
        raise CadOutputError("DOCUMENT_INVALID", "Native document has no authored part")
    authored = _mapping(_mapping(parts[0], "part").get("authored_document"), "authored document")
    cad_document = _mapping(authored.get("cad_document"), "embedded CAD document")
    revision = cad_document.get("revisionId")
    if not isinstance(revision, str) or not revision:
        raise CadOutputError("DOCUMENT_INVALID", "Embedded CAD revision is missing")
    return revision


def _adapt_mesh(document: Mapping[str, Any], value: Any) -> dict[str, Any]:
    source = _mapping(value, "kernel mesh")
    _exact_keys(
        source,
        {
            "schema_version",
            "source_revision_id",
            "units",
            "vertices",
            "triangles",
            "groups",
            "content_sha256",
        },
    )
    if source.get("schema_version") != MESH_SOURCE_SCHEMA or source.get("units") != {"length": "mm"}:
        raise CadOutputError("SCHEMA_UNSUPPORTED", f"Expected {MESH_SOURCE_SCHEMA} in millimetres")
    if source.get("source_revision_id") != _embedded_revision(document):
        raise CadOutputError("STALE_IDENTITY", "Kernel mesh revision differs from the authored revision")
    preimage = {key: source[key] for key in source if key != "content_sha256"}
    digest = _sha256(canonical_json_bytes(preimage))
    if source.get("content_sha256") != digest:
        raise CadOutputError("ARTIFACT_HASH_MISMATCH", "Kernel mesh hash differs")
    parts = document["parts"]
    if any(part.get("geometry_hash") != digest for part in parts):
        raise CadOutputError("STALE_IDENTITY", "Native part geometry hash differs from the kernel mesh")
    return {
        "schema_version": "caddydaddy.kernel-mesh/1",
        "source_revision_id": document["revision_id"],
        "document_hash": document["document_hash"],
        "units": {"length": "mm"},
        "vertices": source["vertices"],
        "triangles": source["triangles"],
    }


def _kernel_artifacts(
    document: Mapping[str, Any], values: Any
) -> tuple[list[KernelArtifact], list[str]]:
    if not isinstance(values, list):
        raise CadOutputError("DOCUMENT_INVALID", "kernel_artifacts must be an array")
    source_revision = _embedded_revision(document)
    artifacts: list[KernelArtifact] = []
    formats: list[str] = []
    total = 0
    for raw in values:
        row = _mapping(raw, "kernel artifact")
        _exact_keys(
            row,
            {"format", "data_base64", "content_sha256", "source_revision_id", "units"},
        )
        format_name = row.get("format")
        if not isinstance(format_name, str):
            raise CadOutputError("FORMAT_UNSUPPORTED", "Kernel artifact format is missing")
        format_name = format_name.upper()
        content = _decode_base64(row.get("data_base64"), f"{format_name} artifact")
        total += len(content)
        if total > MAX_TOTAL_KERNEL_BYTES:
            raise CadOutputError("DOCUMENT_INVALID", "Kernel artifacts exceed the aggregate byte ceiling")
        if row.get("source_revision_id") != source_revision:
            raise CadOutputError("STALE_IDENTITY", f"{format_name} revision differs")
        digest = _sha256(content)
        if row.get("content_sha256") != digest:
            raise CadOutputError("ARTIFACT_HASH_MISMATCH", f"{format_name} hash differs")
        artifacts.append(
            KernelArtifact(
                format=format_name,
                content=content,
                content_sha256=digest,
                source_revision_id=document["revision_id"],
                document_hash=document["document_hash"],
                units=str(row.get("units")),
            )
        )
        formats.append(format_name)
    return artifacts, formats


class CadOutputRuntime:
    """Stateless native/document-output service boundary."""

    def seal_native(self, request: Any) -> tuple[int, dict[str, Any]]:
        try:
            body = _mapping(request, "request")
            _exact_keys(body, {"document"})
            document = create_native_document(_mapping(body["document"], "document"))
            content = export_native_document(document)
            return 200, _native_response(document, content)
        except CadOutputError as error:
            return _failure(error.code, _safe_error(error), _status_for(error))

    def load_native(self, request: Any) -> tuple[int, dict[str, Any]]:
        try:
            body = _mapping(request, "request")
            _exact_keys(body, {"data_base64"})
            content = _decode_base64(body["data_base64"], "native document")
            document = import_native_document(content)
            return 200, _native_response(document, content)
        except CadOutputError as error:
            return _failure(error.code, _safe_error(error), _status_for(error))

    def generate(self, request: Any) -> tuple[int, dict[str, Any]]:
        try:
            body = _mapping(request, "request")
            _exact_keys(body, {"document", "mesh"}, {"kernel_artifacts", "required_kernel_formats"})
            document = _mapping(body["document"], "document")
            document = import_native_document(export_native_document(document))
            mesh = _adapt_mesh(document, body["mesh"])
            artifacts, received_formats = _kernel_artifacts(
                document, body.get("kernel_artifacts", [])
            )
            requested = body.get("required_kernel_formats", received_formats)
            if not isinstance(requested, list) or any(not isinstance(item, str) for item in requested):
                raise CadOutputError("DOCUMENT_INVALID", "required_kernel_formats must be strings")
            required = [item.upper() for item in requested]
            if set(required) != set(received_formats):
                raise CadOutputError(
                    "KERNEL_ARTIFACT_MISSING",
                    "Every supplied exchange artifact must be explicitly required and vice versa",
                )
            with TemporaryDirectory(prefix="caddydaddy-output-") as temporary:
                package = build_manufacturing_package(
                    Path(temporary),
                    f"package-{document['document_hash'][:20]}",
                    document,
                    mesh,
                    kernel_artifacts=artifacts,
                    required_kernel_formats=required,
                )
                root = Path(package["package_path"])
                manifest = verify_manufacturing_package(root)
                downloads: list[dict[str, Any]] = []
                for descriptor in manifest["artifacts"]:
                    content = root.joinpath(*descriptor["path"].split("/")).read_bytes()
                    downloads.append(
                        _download(
                            descriptor["path"],
                            descriptor["kind"],
                            descriptor["source"],
                            descriptor["media_type"],
                            content,
                        )
                    )
                manifest_content = (root / "manifest.json").read_bytes()
                detached_content = (root / "manifest.sha256").read_bytes()
                downloads.extend(
                    [
                        _download(
                            "manifest.json",
                            "SEALED_MANIFEST",
                            "SEAL",
                            "application/json",
                            manifest_content,
                        ),
                        _download(
                            "manifest.sha256",
                            "DETACHED_MANIFEST_HASH",
                            "SEAL",
                            "text/plain",
                            detached_content,
                        ),
                    ]
                )
                return 200, {
                    "schema_version": API_SCHEMA,
                    "status": "VALID",
                    "document_identity": {
                        "document_id": document["document_id"],
                        "revision_id": document["revision_id"],
                        "document_hash": document["document_hash"],
                        "source_authoring_revision_id": _embedded_revision(document),
                    },
                    "package": {
                        **manifest,
                        "manifest_file_sha256": _sha256(manifest_content),
                    },
                    "artifacts": downloads,
                    "limitations": list(DEFAULT_LIMITATIONS),
                    "claim_ceiling": CLAIM_CEILING,
                }
        except CadOutputError as error:
            return _failure(error.code, _safe_error(error), _status_for(error))
        except Exception:
            return _failure("OUTPUT_GENERATION_FAILED", "CAD output generation failed closed.", 500)


def create_fastapi_router(runtime: CadOutputRuntime | None = None) -> Any | None:
    """Create the three-route FastAPI adapter when FastAPI is installed."""

    try:
        from fastapi import APIRouter
        from fastapi.responses import JSONResponse
    except ImportError:
        return None
    service = runtime or CadOutputRuntime()
    router = APIRouter(prefix="/api/cad/outputs", tags=["cad-outputs"])

    def bind(path: str, action: Any) -> None:
        async def endpoint(request: dict[str, Any]) -> JSONResponse:
            status, body = action(request)
            return JSONResponse(status_code=status, content=body)

        router.add_api_route(path, endpoint, methods=["POST"])

    bind("/native/seal", service.seal_native)
    bind("/native/load", service.load_native)
    bind("/generate", service.generate)
    return router
