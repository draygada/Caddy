from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cad_service.app import create_app
from cad_service.settings import DeploymentSettings


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "scripts" / "build_vercel_bundle.py"
SMOKE = ROOT / "scripts" / "smoke_vercel_bundle.py"


def run_build(output: Path) -> dict:
    completed = subprocess.run(
        [sys.executable, str(BUILD), "--output", str(output)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def test_vercel_template_is_exact_and_bounded() -> None:
    assert (ROOT / "vercel/.python-version").read_text().strip() == "3.12"
    requirements = (ROOT / "vercel/requirements.txt").read_text().splitlines()
    for expected in (
        "fastapi==0.141.1",
        "starlette==1.6.0",
        "uvicorn==0.52.4",
        "pydantic==2.13.5",
        "pydantic-core==2.46.5",
        "cadquery-ocp-novtk==7.9.3.1",
        "cadquery-ocp-proxy==7.9.3.1",
    ):
        assert expected in requirements
    assert all("==" in line for line in requirements if line)
    config = json.loads((ROOT / "vercel/vercel.json").read_text())
    function = config["functions"]["api/index.py"]
    assert function["maxDuration"] == 60
    assert "licenses/**" in function["includeFiles"]
    assert config["rewrites"] == [{"source": "/(.*)", "destination": "/api/index.py"}]


def test_bundle_is_deterministic_sanitized_and_content_addressed(tmp_path: Path) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first_report = run_build(first)
    second_report = run_build(second)
    assert first_report["payload_sha256"] == second_report["payload_sha256"]
    assert first_report["manifest_sha256"] == second_report["manifest_sha256"]
    assert tree_hash(first) == tree_hash(second)
    manifest = json.loads((first / "BUNDLE_MANIFEST.json").read_text())
    assert manifest["contains_secrets"] is False
    assert manifest["limits"]["request_bytes"] == 4_000_000
    assert manifest["limits"]["response_bytes"] == 4_000_000
    assert manifest["source"]["payload_sha256"] == first_report["payload_sha256"]
    assert manifest["file_count"] + 1 == first_report["file_count"]
    paths = {path.relative_to(first).as_posix() for path in first.rglob("*") if path.is_file()}
    assert "api/index.py" in paths
    assert "cad_service/kernel.py" in paths
    assert "licenses/OCCT-LGPL-2.1.txt" in paths
    assert "THIRD_PARTY_NOTICES.md" in paths
    assert not any("__pycache__" in path or path.startswith("tests/") or path.startswith("scripts/") for path in paths)
    assert not any(Path(path).name == ".env" or Path(path).name.startswith(".env.") for path in paths)


def test_clean_bundle_import_and_actual_native_cad_smoke(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    run_build(bundle)
    completed = subprocess.run(
        [sys.executable, str(SMOKE), "--bundle", str(bundle)],
        check=True,
        capture_output=True,
        text=True,
        cwd=bundle,
        env={**os.environ, "PYTHONPATH": str(bundle), "CAD_ALLOWED_HOSTS": "testserver"},
    )
    report = json.loads(completed.stdout)
    assert report["status"] == "PASS"
    assert report["body_count"] == 2
    assert report["assembly_solids"] == 2
    assert set(report["formats"]) == {"STEP", "IGES", "STL"}
    assert Path(report["import_root"]).is_relative_to(bundle)


def test_validated_vercel_system_hosts_are_admitted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CAD_ALLOWED_HOSTS", "testserver")
    monkeypatch.setenv("VERCEL_URL", "native-preview.vercel.app")
    monkeypatch.setenv("VERCEL_BRANCH_URL", "native-git-cad.vercel.app")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "cad.example.com")
    settings = DeploymentSettings.from_env()
    assert settings.allowed_hosts == (
        "testserver",
        "native-preview.vercel.app",
        "native-git-cad.vercel.app",
        "cad.example.com",
    )
    response = TestClient(create_app(settings), base_url="https://native-preview.vercel.app").get("/health")
    assert response.status_code == 200


def test_malformed_vercel_system_host_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VERCEL_URL", "https://attacker.example/path")
    with pytest.raises(ValueError, match="VERCEL_URL"):
        DeploymentSettings.from_env()
