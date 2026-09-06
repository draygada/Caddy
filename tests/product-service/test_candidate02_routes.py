from __future__ import annotations

import hashlib
from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[2]
for source in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "compliance-bridge",
    REPO / "packages" / "caddydaddy-contracts",
    REPO / "packages" / "classification",
):
    sys.path.insert(0, str(source))

from product_service.app import CANDIDATE02_POST_ROUTES, Candidate02Routes


IDENTITY = {
    "candidate_id": "candidate:0.2-test",
    "revision_id": "revision:fixture",
    "snapshot_sha256": "a" * 64,
}


class StubSourcing:
    create_round = staticmethod(lambda payload: (200, {"route": "rounds", "payload": payload}))
    adjudicate_offer = staticmethod(lambda payload: (200, {"route": "adjudications", "payload": payload}))
    select_offer = staticmethod(lambda payload: (200, {"route": "selections", "payload": payload}))
    build_package = staticmethod(lambda payload: (200, {"route": "packages", "payload": payload}))
    stage_dispatch = staticmethod(lambda payload: (200, {"route": "dispatches", "payload": payload}))


class StubProvenance:
    inspect_source = staticmethod(lambda payload: (200, {"route": "inspect", "payload": payload}))
    verify_span = staticmethod(lambda payload: (200, {"route": "verify", "payload": payload}))
    accept_verified_change = staticmethod(lambda payload: (200, {"route": "accept", "payload": payload}))


def approved_cad_capabilities() -> tuple[int, dict]:
    return 200, {
        "schema_version": "caddydaddy.cad-capabilities/1",
        "status": "AVAILABLE",
        "kernel": {"name": "OpenCascade", "version": "7.9.3", "binding": "cadquery-ocp-novtk/7.9.3.1"},
        "features": ["SKETCH", "EXTRUDE", "FILLET", "CHAMFER"],
        "exchange": {"exact": ["STEP_AP242", "IGES_5_3"], "mesh_only": ["STL"]},
        "runtime_gate": {
            "status": "APPROVED",
            "owner_approval": "ASSERTED_BY_DEPLOYMENT_CONFIGURATION",
            "approval_binding": "caddydaddy.native-runtime/v1",
            "factual_evidence": "PASS",
            "legal_determination": "NOT_PERFORMED",
            "artifact_sha256": "8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b",
        },
    }


def routes(*, cad_transport=None, cad_capability_transport=None, cad_service_url="") -> Candidate02Routes:
    return Candidate02Routes(
        IDENTITY,
        classification_action=lambda payload: (200, {"route": "classification", "payload": payload}),
        sourcing_runtime=StubSourcing(),
        provenance_runtime=StubProvenance(),
        cad_transport=cad_transport,
        cad_capability_transport=cad_capability_transport,
        cad_service_url=cad_service_url,
    )


def test_exact_candidate02_route_map_and_committed_adapter_bindings() -> None:
    mounted = routes(cad_transport=lambda _path, _payload: (503, {}))
    assert mounted.post_paths == frozenset(CANDIDATE02_POST_ROUTES)
    expected = {
        "/api/classification": "classification",
        "/api/sourcing/rounds": "rounds",
        "/api/sourcing/adjudications": "adjudications",
        "/api/sourcing/selections": "selections",
        "/api/sourcing/packages": "packages",
        "/api/sourcing/dispatches": "dispatches",
        "/api/provenance/inspect": "inspect",
        "/api/provenance/verify": "verify",
        "/api/provenance/accept": "accept",
    }
    for path, name in expected.items():
        status, body = mounted.dispatch(path, {"sentinel": name})
        assert status == 200
        assert body == {"route": name, "payload": {"sentinel": name}}


def test_live_token_is_forwarded_only_to_the_classification_action() -> None:
    observed = []
    mounted = Candidate02Routes(
        IDENTITY,
        classification_action=lambda payload: (500, payload),
        classification_token_action=lambda payload, token: (
            observed.append((payload, token)) or (200, {"route": "classification"})
        ),
        sourcing_runtime=StubSourcing(),
        provenance_runtime=StubProvenance(),
        cad_transport=lambda _path, _payload: (503, {}),
        cad_service_url="",
    )

    status, body = mounted.dispatch(
        "/api/classification",
        {"sentinel": "classification"},
        live_token="private-token",
    )
    sourcing_status, sourcing_body = mounted.dispatch(
        "/api/sourcing/rounds",
        {"sentinel": "sourcing"},
        live_token="must-not-be-forwarded",
    )

    assert status == 200 and body == {"route": "classification"}
    assert observed == [({"sentinel": "classification"}, "private-token")]
    assert sourcing_status == 200
    assert sourcing_body == {"route": "rounds", "payload": {"sentinel": "sourcing"}}
    assert "must-not-be-forwarded" not in str(sourcing_body)


def test_unconfigured_cad_service_fails_honestly_without_network() -> None:
    status, body = routes().dispatch("/api/cad/recompute", {
        "document": browser_document(),
        "operation": browser_document()["operations"][-1],
        "expectedRevisionId": "revision:new",
    })
    assert status == 503
    assert body["status"] == "BLOCKED"
    assert body["diagnostic"]["code"] == "CAD_SERVICE_NOT_CONFIGURED"

    capability_status, capability_body = routes().dispatch_get("/api/cad/capabilities")
    assert capability_status == 503
    assert capability_body["diagnostic"]["code"] == "CAD_SERVICE_NOT_CONFIGURED"


def test_owner_approval_block_from_native_capability_gate_is_preserved() -> None:
    reason = {
        "schema_version": "caddydaddy.cad-capabilities/1",
        "status": "BLOCKED",
        "diagnostic": {
            "code": "CAD_RUNTIME_OWNER_APPROVAL_REQUIRED",
            "message": "Set the exact manifest-bound owner approval only after acceptance is recorded.",
        },
    }
    mounted = routes(
        cad_transport=lambda _path, _payload: (_ for _ in ()).throw(AssertionError("native operation must not run")),
        cad_capability_transport=lambda: (503, reason),
    )
    document = browser_document()
    status, body = mounted.dispatch("/api/cad/recompute", {
        "document": document,
        "operation": document["operations"][-1],
        "expectedRevisionId": "revision:new",
    })
    assert status == 503
    assert body == reason


def test_browser_sketch_and_extrude_are_adapted_to_live_occt_contract() -> None:
    observed = {}

    def transport(path, payload):
        observed.update(path=path, payload=payload)
        return 200, {
            "schema_version": "caddydaddy.recompute-result/1",
            "status": "SUCCEEDED",
            "document_id": "document:test",
            "revision_id": "cad-rev:" + "b" * 64,
            "parent_revision_id": None,
            "document_hash": "c" * 64,
            "geometry_hash": "d" * 64,
            "kernel": {"name": "OpenCascade", "version": "7.9.3"},
            "constraint_mode": "VALIDATE_ONLY",
            "operation_status": {"operation:sketch": "SUCCEEDED", "operation:extrude": "SUCCEEDED"},
            "bodies": [{
                "body_id": "body:plate",
                "producing_feature_id": "operation:extrude",
                "brep_base64": "YnJlcA==",
                "brep_sha256": hashlib.sha256(b"brep").hexdigest(),
                "valid": True,
                "bounds_mm": [0, 0, 0, 20, 10, 8],
                "topology": {"solids": 1},
                "area_mm2": 1,
                "volume_mm3": 1,
                "mesh": {"positions": [0, 0, 0, 20, 0, 0, 20, 10, 8], "normals": [0, 0, 1] * 3, "indices": [0, 1, 2], "triangle_count": 1},
            }],
            "diagnostics": [],
        }

    document = browser_document()
    status, body = routes(cad_transport=transport, cad_capability_transport=approved_cad_capabilities).dispatch("/api/cad/recompute", {
        "document": document,
        "operation": document["operations"][-1],
        "expectedRevisionId": "revision:new",
    })
    assert status == 200
    assert observed["path"] == "/v1/recompute"
    candidate = observed["payload"]["candidate_document"]
    assert candidate["schema_version"] == "caddydaddy.cad-document/1"
    assert [feature["kind"] for feature in candidate["features"]] == ["SKETCH", "EXTRUDE"]
    assert candidate["features"][1]["parameters"]["distance_mm"] == 8
    assert body["document"]["revisionId"] == body["revisionId"]
    assert body["kernel"]["mode"] == "live"
    assert body["mesh"]["triangles"] == [[0, 1, 2]]
    assert body["document"]["bodies"][0]["state"] == "valid"


def browser_document() -> dict:
    sketch = {
        "id": "sketch:plate",
        "name": "Plate",
        "plane": {"kind": "origin", "plane": "XY"},
        "entities": [{"id": "rect:plate", "kind": "rectangle", "construction": False, "origin": {"x": 0, "y": 0}, "width": 20, "height": 10}],
        "dimensions": [],
        "constraints": [],
        "solverState": "under-constrained",
    }
    sketch_operation = {"id": "operation:sketch", "kind": "sketch.create", "name": "Create Plate", "dependsOn": [], "suppressed": False, "sketch": sketch}
    extrude_operation = {"id": "operation:extrude", "kind": "feature.extrude", "name": "Extrude Plate", "dependsOn": ["sketch:plate"], "suppressed": False, "inputIds": ["sketch:plate"], "targetBodyIds": [], "outputBodyName": "Plate", "parameters": {"distance": 8, "unit": "mm"}}
    return {
        "schemaVersion": "caddydaddy.cad-document/1",
        "id": "document:test",
        "name": "Test plate",
        "revisionId": "revision:new",
        "units": {"length": "mm", "angle": "deg"},
        "parameters": [],
        "sketches": [sketch],
        "operations": [sketch_operation, extrude_operation],
        "bodies": [{"id": "body:plate", "name": "Plate", "featureIds": ["operation:extrude"], "material": None, "visible": True, "state": "draft"}],
        "assembly": {"instances": [], "mates": []},
    }
