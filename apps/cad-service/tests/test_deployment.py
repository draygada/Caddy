from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.testclient import TestClient

from api.index import BoundedPayloadASGI, SERVICE_BODY_LIMIT_BYTES, VERCEL_DOCUMENTED_BODY_LIMIT_BYTES, app


ROOT = Path(__file__).resolve().parents[1]


def test_deployment_entrypoint_smoke() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cad-service", "execution": "real-occt"}


def test_request_guard_rejects_before_provider_limit() -> None:
    inner = FastAPI()

    @inner.post("/")
    def accepted() -> dict[str, bool]:
        return {"accepted": True}

    guarded = BoundedPayloadASGI(inner, max_request_bytes=32, max_response_bytes=64)
    response = TestClient(guarded).post("/", content=b"x" * 33)
    assert response.status_code == 413
    assert response.json()["code"] == "REQUEST_PAYLOAD_TOO_LARGE"
    assert SERVICE_BODY_LIMIT_BYTES < VERCEL_DOCUMENTED_BODY_LIMIT_BYTES


def test_response_guard_rejects_before_provider_limit() -> None:
    inner = FastAPI()

    @inner.get("/")
    def large_response() -> PlainTextResponse:
        return PlainTextResponse("x" * 65)

    guarded = BoundedPayloadASGI(inner, max_request_bytes=32, max_response_bytes=64)
    response = TestClient(guarded).get("/")
    assert response.status_code == 413
    assert response.json()["code"] == "RESPONSE_PAYLOAD_TOO_LARGE"


def test_deployment_files_pin_runtime_and_route_to_asgi() -> None:
    assert (ROOT / ".python-version").read_text().strip() == "3.12"
    requirements = [
        line.strip()
        for path in (ROOT / "requirements-runtime.txt", ROOT / "requirements.txt")
        for line in path.read_text().splitlines()
        if line.strip() and not line.startswith("-r ")
    ]
    assert requirements
    assert all("==" in line for line in requirements)
    config = json.loads((ROOT / "vercel.json").read_text())
    assert config["rewrites"] == [{"source": "/(.*)", "destination": "/api/index.py"}]
    dockerfile = (ROOT / "Dockerfile").read_text()
    assert "python:3.12.11-slim-bookworm@sha256:" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert "api.index:app" in dockerfile


def test_primary_license_files_have_recorded_hashes() -> None:
    expected = {
        "OCP-APACHE-2.0.txt": "a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd",
        "OCCT-LGPL-2.1.txt": "e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c",
        "OCCT-LGPL-EXCEPTION-1.0.txt": "04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b",
    }
    for name, digest in expected.items():
        assert hashlib.sha256((ROOT / "licenses" / name).read_bytes()).hexdigest() == digest


def test_corresponding_source_manifest_is_exact_and_offline() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "fetch_corresponding_source.py"), "--manifest-only"],
        check=True,
        capture_output=True,
        text=True,
    )
    sources = json.loads(result.stdout)["sources"]
    assert [source["bytes"] for source in sources] == [3_728_128, 1_380_634, 48_610_707]
    assert all(len(source["sha256"]) == 64 for source in sources)


def test_closure_measurement_and_over_limit_gate() -> None:
    module_path = ROOT / "scripts" / "check_runtime_closure.py"
    spec = importlib.util.spec_from_file_location("closure_check", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    logical, allocated, count = module.measure([ROOT / "api"])
    assert logical > 0
    assert allocated >= 0
    assert count >= 2
    assert module.SERVICE_BODY_BYTES < module.VERCEL_DOCUMENTED_BODY_BYTES
