from fastapi.testclient import TestClient

from cad_service.app import app


client = TestClient(app)


def test_health_and_capabilities_are_honest() -> None:
    assert client.get("/health").json() == {"status": "ok", "service": "cad-service", "execution": "real-occt"}
    capabilities = client.get("/v1/capabilities").json()
    assert capabilities["kernel"]["name"] == "OpenCascade"
    assert capabilities["constraints"]["mode"] == "VALIDATE_ONLY"
    assert "NATIVE_ASSEMBLY" in capabilities["exchange"]["unsupported"]


def test_kernel_diagnostic_is_structured_http_422() -> None:
    response = client.post("/v1/recompute", json={
        "candidate_document": {
            "document_id": "part:bad",
            "features": [{"feature_id": "feature:loft", "kind": "LOFT", "output_body_id": "body:bad"}],
        }
    })
    assert response.status_code == 422
    assert response.json()["diagnostics"][0]["code"] == "FEATURE_KIND_UNSUPPORTED"
