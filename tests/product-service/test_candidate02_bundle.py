from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


REPO = Path(__file__).resolve().parents[2]
for source in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "compliance-bridge",
):
    sys.path.insert(0, str(source))

from product_service.app import (  # noqa: E402
    CAD_CLIENT_STATE_SCHEMA,
    CANDIDATE02_POST_ROUTES,
    MAX_CAD_REQUEST_BODY_BYTES,
    MAX_CAD_RESPONSE_BODY_BYTES,
    MAX_RESPONSE_BODY_BYTES,
    Candidate02Routes,
)


IDENTITY = {
    "candidate_id": "candidate:0.2-bundle-test",
    "revision_id": "revision:fixture",
    "snapshot_sha256": "a" * 64,
}


def _document() -> dict:
    sketch = {
        "id": "sketch:plate",
        "name": "Plate",
        "plane": {"kind": "origin", "plane": "XY"},
        "entities": [{"id": "rect:plate", "kind": "rectangle", "origin": {"x": 0, "y": 0}, "width": 20, "height": 10}],
        "dimensions": [],
        "constraints": [],
    }
    return {
        "schemaVersion": "caddydaddy.cad-document/1",
        "id": "document:cold",
        "name": "Cold-start plate",
        "revisionId": "revision:new",
        "units": {"length": "mm", "angle": "deg"},
        "parameters": [],
        "sketches": [sketch],
        "operations": [
            {"id": "feature:sketch", "kind": "sketch.create", "name": "Sketch", "dependsOn": [], "suppressed": False, "sketch": sketch},
            {"id": "feature:extrude", "kind": "feature.extrude", "name": "Extrude", "dependsOn": ["sketch:plate"], "suppressed": False, "inputIds": ["sketch:plate"], "targetBodyIds": [], "parameters": {"distance": 8}},
        ],
        "bodies": [{"id": "body:plate", "name": "Plate", "featureIds": ["feature:extrude"], "material": None, "visible": True, "state": "draft"}],
        "assembly": {"instances": [], "mates": []},
    }


def _kernel_response(revision: str) -> dict:
    return {
        "revision_id": revision,
        "document_hash": "c" * 64,
        "geometry_hash": "d" * 64,
        "kernel": {"name": "OpenCascade", "version": "7.9.3"},
        "bodies": [{
            "body_id": "body:plate",
            "producing_feature_id": "feature:extrude",
            "brep_base64": "YnJlcC1ieXRlcw==",
            "mesh": {"positions": [0, 0, 0, 1, 0, 0, 0, 1, 1], "indices": [0, 1, 2]},
        }],
        "diagnostics": [],
    }


def test_cold_invocation_uses_hash_sealed_client_carried_cad_state() -> None:
    calls: list[tuple[str, dict]] = []

    def first_transport(path: str, payload: dict):
        calls.append((path, payload))
        return 200, _kernel_response("cad-rev:" + "1" * 64)

    first = Candidate02Routes(IDENTITY, classification_action=lambda _: (200, {}), cad_transport=first_transport)
    document = _document()
    status, created = first.dispatch("/api/cad/recompute", {
        "document": document,
        "operation": document["operations"][-1],
        "expectedRevisionId": "revision:new",
    })
    assert status == 200
    continuation = created["document"]["kernelState"]
    assert continuation["schema_version"] == CAD_CLIENT_STATE_SCHEMA
    assert continuation["revision_id"] == created["revisionId"]
    assert len(continuation["state_sha256"]) == 64

    def cold_transport(path: str, payload: dict):
        calls.append((path, payload))
        assert payload["expected_base_revision_id"] == created["revisionId"]
        assert payload["base_document"] == continuation["base_document"]
        return 200, _kernel_response("cad-rev:" + "2" * 64)

    cold = Candidate02Routes(IDENTITY, classification_action=lambda _: (200, {}), cad_transport=cold_transport)
    status, updated = cold.dispatch("/api/cad/recompute", {
        "document": created["document"],
        "operation": created["document"]["operations"][-1],
        "expectedRevisionId": created["revisionId"],
    })
    assert status == 200
    assert updated["revisionId"] == "cad-rev:" + "2" * 64

    exported_request = created["document"]

    def export_transport(path: str, payload: dict):
        assert path == "/v1/exchange"
        assert payload["content_base64"] == "YnJlcC1ieXRlcw=="
        return 200, {"content_base64": "c3RlcA==", "content_sha256": "e" * 64}

    another_cold = Candidate02Routes(IDENTITY, classification_action=lambda _: (200, {}), cad_transport=export_transport)
    status, exported = another_cold.dispatch("/api/cad/export", {
        "document": exported_request,
        "revisionId": exported_request["revisionId"],
        "format": "STEP",
    })
    assert status == 200 and exported["dataBase64"] == "c3RlcA=="

    tampered = json.loads(json.dumps(exported_request))
    tampered["kernelState"]["body_artifacts"]["body:plate"] = "dGFtcGVyZWQ="
    status, blocked = another_cold.dispatch("/api/cad/export", {
        "document": tampered,
        "revisionId": tampered["revisionId"],
        "format": "STEP",
    })
    assert status == 409 and blocked["diagnostic"]["code"] == "CAD_STATE_TAMPERED"


def test_provider_body_ceiling_is_uniform() -> None:
    assert MAX_CAD_REQUEST_BODY_BYTES == 4_250_000
    assert MAX_CAD_RESPONSE_BODY_BYTES == 4_250_000
    assert MAX_RESPONSE_BODY_BYTES == 4_250_000


def test_sanitized_bundle_loads_all_runtime_packages_and_candidate_routes(tmp_path: Path) -> None:
    bundle = tmp_path / "candidate"
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [sys.executable, str(REPO / "apps" / "product-service" / "scripts" / "build_bundle.py"), "--output", str(bundle)],
        cwd=REPO,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    summary = json.loads(completed.stdout)
    assert set(summary["runtime_probe"]["post_routes"]) == set(CANDIDATE02_POST_ROUTES)
    for path in (
        "packages/classification/forge_classification/__init__.py",
        "packages/cad-output/caddydaddy_cad_output/__init__.py",
        "packages/order-execution/order_execution/__init__.py",
    ):
        assert (bundle / path).is_file()
