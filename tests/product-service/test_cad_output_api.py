from __future__ import annotations

import base64
import hashlib
import json

from caddydaddy_cad_output import canonical_json_bytes
from product_service.cad_output_api import (
    API_SCHEMA,
    CLAIM_CEILING,
    CadOutputRuntime,
    MESH_SOURCE_SCHEMA,
)


def authored_document() -> dict:
    return {
        "schemaVersion": "caddydaddy.cad-document/1",
        "id": "document:fixture",
        "name": "Fixture bracket",
        "revisionId": "revision:kernel-7",
        "units": {"length": "mm", "angle": "deg"},
        "parameters": [],
        "sketches": [],
        "operations": [],
        "bodies": [{"id": "body:plate", "name": "Plate", "featureIds": [], "material": "6061-T6", "visible": True, "state": "valid"}],
        "assembly": {"instances": [], "mates": []},
    }


def mesh_source() -> dict:
    source = {
        "schema_version": MESH_SOURCE_SCHEMA,
        "source_revision_id": "revision:kernel-7",
        "units": {"length": "mm"},
        "vertices": [[0, 0, 0], [20, 0, 0], [0, 10, 0], [0, 0, 4]],
        "triangles": [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
        "groups": [{"bodyId": "body:plate", "startTriangle": 0, "triangleCount": 4, "color": "#718f82"}],
    }
    return {**source, "content_sha256": hashlib.sha256(canonical_json_bytes(source)).hexdigest()}


def native_draft() -> dict:
    mesh = mesh_source()
    return {
        "schema_version": "caddydaddy.native-document/1",
        "document_id": "document:fixture",
        "parent_revision_id": "revision:kernel-7",
        "units": {"length": "mm", "angle": "deg"},
        "parts": [{
            "part_id": "part:plate",
            "part_number": "PLATE-001",
            "name": "Plate",
            "revision_id": "revision:kernel-7",
            "geometry_hash": mesh["content_sha256"],
            "material": "6061-T6",
            "unit": "EA",
            "authored_document": {"document_id": "part:plate", "cad_document": authored_document(), "kernel_mesh_source": mesh},
        }],
        "assembly": {
            "assembly_id": "assembly:fixture",
            "assembly_revision_id": "revision:kernel-7",
            "instances": [{
                "instance_id": "instance:plate",
                "part_id": "part:plate",
                "part_revision_id": "revision:kernel-7",
                "quantity": 1,
                "transform_row_major": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                "metadata": {"grounded": "true"},
            }],
            "mates": [],
        },
        "metadata": {"authoring_schema": "caddydaddy.cad-document/1"},
    }


def seal(runtime: CadOutputRuntime) -> dict:
    status, body = runtime.seal_native({"document": native_draft()})
    assert status == 200
    assert body["schema_version"] == API_SCHEMA
    assert body["claim_ceiling"] == CLAIM_CEILING
    return body


def test_native_seal_and_load_are_content_addressed_and_canonical():
    runtime = CadOutputRuntime()
    sealed = seal(runtime)
    artifact = sealed["artifact"]
    content = base64.b64decode(artifact["data_base64"], validate=True)
    assert hashlib.sha256(content).hexdigest() == artifact["sha256"]
    assert len(content) == artifact["size_bytes"]
    assert json.loads(content)["document_hash"] == sealed["document"]["document_hash"]
    status, loaded = runtime.load_native({"data_base64": artifact["data_base64"]})
    assert status == 200
    assert loaded["document"] == sealed["document"]
    assert loaded["artifact"] == artifact


def test_generation_returns_verified_native_drawings_bom_manifest_and_no_server_path():
    runtime = CadOutputRuntime()
    sealed = seal(runtime)
    status, body = runtime.generate({"document": sealed["document"], "mesh": mesh_source()})
    assert status == 200
    assert body["status"] == "VALID"
    assert "package_path" not in json.dumps(body)
    assert body["package"]["seal"]["algorithm"] == "SHA-256"
    paths = {artifact["path"] for artifact in body["artifacts"]}
    assert {
        "document/native.caddy.json", "bom/bom.csv",
        "drawings/top.svg", "drawings/top.dxf",
        "drawings/front.svg", "drawings/front.dxf",
        "drawings/right.svg", "drawings/right.dxf",
        "manifest.json", "manifest.sha256",
    } <= paths
    for artifact in body["artifacts"]:
        content = base64.b64decode(artifact["data_base64"], validate=True)
        assert len(content) == artifact["size_bytes"]
        assert hashlib.sha256(content).hexdigest() == artifact["sha256"]
        assert artifact["verification"] == "REREAD_SHA256_BEFORE_RESPONSE"


def test_kernel_exchange_bytes_are_bound_and_included_without_caller_paths():
    runtime = CadOutputRuntime()
    sealed = seal(runtime)
    step = b"ISO-10303-21;\nEND-ISO-10303-21;\n"
    artifact = {
        "format": "STEP",
        "data_base64": base64.b64encode(step).decode("ascii"),
        "content_sha256": hashlib.sha256(step).hexdigest(),
        "source_revision_id": "revision:kernel-7",
        "units": "mm",
    }
    status, body = runtime.generate({"document": sealed["document"], "mesh": mesh_source(), "kernel_artifacts": [artifact], "required_kernel_formats": ["STEP"]})
    assert status == 200
    included = next(row for row in body["artifacts"] if row["path"] == "kernel/model.step")
    assert base64.b64decode(included["data_base64"]) == step
    assert included["source"] == "KERNEL"


def test_stale_mesh_tampered_bytes_and_noncanonical_native_fail_closed():
    runtime = CadOutputRuntime()
    sealed = seal(runtime)
    stale = mesh_source()
    stale["source_revision_id"] = "revision:stale"
    status, body = runtime.generate({"document": sealed["document"], "mesh": stale})
    assert status == 409 and body["diagnostic"]["code"] == "STALE_IDENTITY"

    artifact = {
        "format": "STL",
        "data_base64": base64.b64encode(b"solid fixture\nendsolid\n").decode("ascii"),
        "content_sha256": "0" * 64,
        "source_revision_id": "revision:kernel-7",
        "units": "mm",
    }
    status, body = runtime.generate({"document": sealed["document"], "mesh": mesh_source(), "kernel_artifacts": [artifact], "required_kernel_formats": ["STL"]})
    assert status == 409 and body["diagnostic"]["code"] == "ARTIFACT_HASH_MISMATCH"

    canonical = base64.b64decode(sealed["artifact"]["data_base64"])
    noncanonical = base64.b64encode(b"\n" + canonical).decode("ascii")
    status, body = runtime.load_native({"data_base64": noncanonical})
    assert status == 400 and body["diagnostic"]["code"] == "DOCUMENT_NONCANONICAL"
