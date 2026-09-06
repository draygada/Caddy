from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from api.index import BoundedPayloadASGI
from cad_service.app import create_app
from cad_service.settings import DeploymentSettings, NATIVE_RUNTIME_OWNER_APPROVAL_VALUE


settings = DeploymentSettings(native_runtime_owner_approval=NATIVE_RUNTIME_OWNER_APPROVAL_VALUE)
client = TestClient(BoundedPayloadASGI(
    create_app(settings),
    max_request_bytes=settings.max_request_bytes,
    max_response_bytes=settings.max_response_bytes,
    request_timeout_seconds=settings.transport_timeout_seconds,
    max_concurrency=settings.max_concurrency,
))


def rectangle(sketch_id: str, x: float, y: float, width: float, height: float) -> dict:
    points = [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    entities = [
        {
            "entity_id": f"{sketch_id}:line:{index}",
            "kind": "LINE",
            "start": {"x": points[index][0], "y": points[index][1]},
            "end": {"x": points[(index + 1) % 4][0], "y": points[(index + 1) % 4][1]},
        }
        for index in range(4)
    ]
    return {"sketch_id": sketch_id, "plane": "XY", "loops": [{"loop_id": f"{sketch_id}:outer", "entities": entities}]}


def document() -> dict:
    return {
        "document_id": "proof:successive-multibody",
        "sketches": [rectangle("sketch:first", 0, 0, 12, 8), rectangle("sketch:second", 20, 0, 6, 6)],
        "features": [
            {"feature_id": "feature:sketch:first", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:first"}},
            {"feature_id": "feature:extrude:first", "kind": "EXTRUDE", "depends_on": ["feature:sketch:first"], "output_body_id": "body:first", "parameters": {"sketch_feature_id": "feature:sketch:first", "distance_mm": 4}},
            {"feature_id": "feature:sketch:second", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:second"}},
            {"feature_id": "feature:extrude:second", "kind": "EXTRUDE", "depends_on": ["feature:sketch:second"], "output_body_id": "body:second", "parameters": {"sketch_feature_id": "feature:sketch:second", "distance_mm": 7}},
        ],
    }


def test_actual_asgi_path_proves_recompute_successive_sketches_multibody_assembly_and_exchange() -> None:
    original = document()
    first_response = client.post("/v1/recompute", json={"candidate_document": original})
    assert first_response.status_code == 200, first_response.text
    first = first_response.json()
    assert first["kernel"]["name"] == "OpenCascade"
    bodies = {body["body_id"]: body for body in first["bodies"]}
    assert set(bodies) == {"body:first", "body:second"}
    assert bodies["body:first"]["bounds_mm"] != bodies["body:second"]["bounds_mm"]
    assert bodies["body:first"]["volume_mm3"] == pytest.approx(384)
    assert bodies["body:second"]["volume_mm3"] == pytest.approx(252)

    edited = copy.deepcopy(original)
    edited["parent_revision_id"] = first["revision_id"]
    edited["features"][3]["parameters"]["distance_mm"] = 9
    second_response = client.post(
        "/v1/recompute",
        json={
            "base_document": original,
            "expected_base_revision_id": first["revision_id"],
            "candidate_document": edited,
        },
    )
    assert second_response.status_code == 200, second_response.text
    second = second_response.json()
    assert second["geometry_hash"] != first["geometry_hash"]
    assert next(body for body in second["bodies"] if body["body_id"] == "body:second")["bounds_mm"][5] == pytest.approx(9)

    first_body = bodies["body:first"]
    for format_name in ("STEP", "IGES", "STL"):
        exported_response = client.post(
            "/v1/exchange",
            json={
                "request_id": f"proof:export:{format_name}",
                "direction": "EXPORT",
                "format": format_name,
                "content_base64": first_body["brep_base64"],
                "source_revision_id": first["revision_id"],
            },
        )
        assert exported_response.status_code == 200, exported_response.text
        exported = exported_response.json()
        imported_response = client.post(
            "/v1/exchange",
            json={
                "request_id": f"proof:import:{format_name}",
                "direction": "IMPORT",
                "format": format_name,
                "content_base64": exported["content_base64"],
            },
        )
        assert imported_response.status_code == 200, imported_response.text
        imported = imported_response.json()
        assert imported["bounds_mm"] == pytest.approx(first_body["bounds_mm"], abs=0.25)
        assert imported["editable_brep"] is (format_name != "STL")

    assembly_response = client.post(
        "/v1/assemblies/solve",
        json={
            "assembly_id": "proof:assembly",
            "instances": [
                {"instance_id": "fixed", "body_id": "body:first", "source_revision_id": first["revision_id"], "brep_base64": first_body["brep_base64"]},
                {"instance_id": "moving", "body_id": "body:first", "source_revision_id": first["revision_id"], "brep_base64": first_body["brep_base64"], "transform": {"translation": {"x": 30}}},
            ],
            "mates": [
                {"mate_id": "point", "kind": "POINT_COINCIDENT", "moving_instance_id": "moving", "target_instance_id": "fixed", "moving_point": {"x": 0}, "target_point": {"x": 20}}
            ],
        },
    )
    assert assembly_response.status_code == 200, assembly_response.text
    assembly = assembly_response.json()
    assert assembly["assembly_body"]["topology"]["solids"] == 2
    moving = next(instance for instance in assembly["instances"] if instance["instance_id"] == "moving")
    assert moving["world_matrix4x4_row_major"][3] == pytest.approx(20)


def test_cors_is_exact_and_deny_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CAD_CORS_ORIGINS", "https://operator.example")
    settings = DeploymentSettings.from_env()
    configured = TestClient(create_app(settings))
    accepted = configured.options(
        "/v1/capabilities",
        headers={
            "Origin": "https://operator.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert accepted.headers["access-control-allow-origin"] == "https://operator.example"
    rejected = configured.get("/health", headers={"Origin": "https://attacker.example"})
    assert "access-control-allow-origin" not in rejected.headers


def test_wildcard_cors_and_pathological_complexity_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CAD_CORS_ORIGINS", "*")
    with pytest.raises(ValueError, match="forbidden"):
        DeploymentSettings.from_env()
    excessive = document()
    excessive["features"] = [
        {"feature_id": f"feature:{index}", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:first"}}
        for index in range(129)
    ]
    response = client.post("/v1/recompute", json={"candidate_document": excessive})
    assert response.status_code == 422
