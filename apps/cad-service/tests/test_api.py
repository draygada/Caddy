from fastapi.testclient import TestClient

from cad_service.app import app, create_app
from cad_service.settings import DeploymentSettings, NATIVE_RUNTIME_OWNER_APPROVAL_VALUE


client = TestClient(app)
approved_client = TestClient(create_app(DeploymentSettings(
    native_runtime_owner_approval=NATIVE_RUNTIME_OWNER_APPROVAL_VALUE,
)))


def test_health_and_capabilities_are_honest() -> None:
    assert client.get("/health").json() == {"status": "ok", "service": "cad-service", "execution": "native-runtime-gated"}
    blocked = client.get("/ready")
    assert blocked.status_code == 503
    assert blocked.json()["diagnostic"]["code"] == "CAD_RUNTIME_OWNER_APPROVAL_REQUIRED"
    assert "CAD_NATIVE_RUNTIME_OWNER_APPROVAL=" in blocked.json()["diagnostic"]["message"]
    ready = approved_client.get("/ready")
    assert ready.status_code == 200
    assert ready.json()["proof"]["primitive"] == "valid-1mm-box"
    assert ready.json()["execution"] == "isolated-real-occt"
    capabilities = approved_client.get("/v1/capabilities").json()
    assert capabilities["kernel"]["name"] == "OpenCascade"
    assert capabilities["constraints"]["mode"] == "VALIDATE_ONLY"
    assert "NATIVE_ASSEMBLY" in capabilities["exchange"]["unsupported"]
    assert capabilities["deployment"]["execution"] == "SUBPROCESS_ISOLATED"
    assert capabilities["runtime_gate"]["owner_approval"] == "ASSERTED_BY_DEPLOYMENT_CONFIGURATION"
    assert capabilities["runtime_gate"]["factual_evidence"] == "PASS"


def test_kernel_diagnostic_is_structured_http_422() -> None:
    response = approved_client.post("/v1/recompute", json={
        "candidate_document": {
            "document_id": "part:bad",
            "features": [{"feature_id": "feature:loft", "kind": "LOFT", "output_body_id": "body:bad"}],
        }
    })
    assert response.status_code == 422
    assert response.json()["diagnostics"][0]["code"] == "FEATURE_KIND_UNSUPPORTED"
