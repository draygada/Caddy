from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

import pytest


REPO = Path(__file__).resolve().parents[2]
BUILDER = REPO / "apps" / "product-service" / "scripts" / "build_bundle.py"
POLICY = REPO / "apps" / "product-service" / "bundle-manifest.v1.json"
SOURCE_ONLY_INPUTS = {
    "apps/product-service/README.md",
    "apps/product-service/bundle-manifest.v1.json",
    "packages/core-kernel/pyproject.toml",
    "packages/core-kernel/uv.lock",
}


def _build(output: Path) -> tuple[dict, Path]:
    completed = subprocess.run(
        [sys.executable, str(BUILDER), "--output", str(output)],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return json.loads(completed.stdout), output.with_name(output.name + ".tar.gz")


@pytest.fixture(scope="module")
def vercel_bundle(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path, dict]:
    root = tmp_path_factory.mktemp("vercel-bundle") / "candidate"
    summary, archive = _build(root)
    return root, archive, summary


def test_entrypoint_and_handler_routes(vercel_bundle: tuple[Path, Path, dict]) -> None:
    bundle, _, _ = vercel_bundle
    probe = r'''
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import json
from pathlib import Path
from threading import Thread
from unittest.mock import patch

with patch("platform.system", return_value="Linux"), patch("platform.machine", return_value="x86_64"):
    from api.index import handler

assert issubclass(handler, BaseHTTPRequestHandler)
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()

def request(method, path, body=None, headers=None):
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=15)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    payload = response.read()
    result = (response.status, dict(response.getheaders()), payload)
    connection.close()
    return result

try:
    status, headers, payload = request("GET", "/api/health")
    assert status == 200 and json.loads(payload)["ok"] is True
    assert headers["X-Content-Type-Options"] == "nosniff"

    status, _, payload = request("GET", "/api/candidate")
    candidate = json.loads(payload)
    assert status == 200 and candidate["candidate"]["version"] == "0.1"
    assert len(payload) < 4_500_000
    provenance = candidate["kernelProvenance"]
    assert "wheel-sha256=8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b" in provenance["binding"]
    assert provenance["platformImage"] == "Linux@x86_64;python=cp312;wheel-platform=manylinux_2_31_x86_64"

    bindings = candidate["document"]["complianceBindings"]
    selected = bindings[sorted(bindings)[0]]["request"]
    body = json.dumps(selected).encode("utf-8")
    status, _, payload = request(
        "POST",
        "/api/compliance-at-design-click",
        body,
        {"Content-Type": "application/json", "Content-Length": str(len(body))},
    )
    compliance = json.loads(payload)
    assert status == 200 and compliance["status"] == "REVIEW_REQUIRED"
    assert compliance["legal_effect"] == "NONE"

    status, headers, payload = request("GET", "/src/main.js")
    assert status == 200 and "javascript" in headers["Content-Type"]
    assert payload == Path("public/src/main.js").read_bytes()

    status, headers, payload = request("GET", "/workspace/public-demo")
    assert status == 200 and headers["Content-Type"].startswith("text/html")
    assert b"<!doctype html>" in payload.lower()

    status, _, payload = request("GET", "/src/not-present.js")
    assert status == 404 and json.loads(payload)["diagnostic"]["code"] == "ASSET_NOT_FOUND"

    status, headers, payload = request("PUT", "/api/health")
    assert status == 405 and "GET" in headers["Allow"]
    assert json.loads(payload)["diagnostic"]["code"] == "METHOD_NOT_ALLOWED"

    status, _, payload = request("POST", "/api/candidate", b"{}", {"Content-Type": "application/json"})
    assert status == 405 and json.loads(payload)["diagnostic"]["code"] == "METHOD_NOT_ALLOWED"

    status, _, payload = request("POST", "/api/compliance-at-design-click", b"{}", {"Content-Type": "text/plain"})
    assert status == 415 and json.loads(payload)["diagnostic"]["code"] == "CONTENT_TYPE_UNSUPPORTED"

    status, _, payload = request(
        "POST",
        "/api/compliance-at-design-click",
        b"{}",
        {"Content-Type": "application/json", "Content-Length": "65537"},
    )
    assert status == 413 and json.loads(payload)["diagnostic"]["code"] == "REQUEST_BODY_TOO_LARGE"

    status, _, payload = request(
        "POST",
        "/api/compliance-at-design-click",
        b"{",
        {"Content-Type": "application/json", "Content-Length": "1"},
    )
    assert status == 400 and json.loads(payload)["diagnostic"]["code"] == "REQUEST_BODY_INVALID"
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)
'''
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=bundle,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr


def test_static_spa_routing_and_runtime_pins(vercel_bundle: tuple[Path, Path, dict]) -> None:
    bundle, _, _ = vercel_bundle
    config = json.loads((bundle / "vercel.json").read_text(encoding="utf-8"))
    assert config["framework"] is None
    assert config["rewrites"] == [
        {"source": "/api", "destination": "/api/index.py"},
        {"source": "/api/:path*", "destination": "/api/index.py"},
        {"source": "/:path*", "destination": "/index.html"},
    ]
    excluded = config["functions"]["api/index.py"]["excludeFiles"]
    for required in ("public/**", "tests/**", "governance/**", "docs/**", ".git/**", ".vercel/**", "features/tripwire/data/**"):
        assert required in excluded
    assert (bundle / ".python-version").read_text(encoding="utf-8") == "3.12\n"
    requirements = (bundle / "requirements.txt").read_text(encoding="utf-8").splitlines()
    assert requirements == [
        "--only-binary=:all:",
        "cadquery-ocp-novtk==7.9.3.1",
        "jsonschema==4.25.1",
        "rfc8785==0.1.4",
    ]
    assert (bundle / "public" / "index.html").is_file()
    assert (bundle / "public" / "build-manifest.json").is_file()
    assert all(not (bundle / path).exists() for path in SOURCE_ONLY_INPUTS)


def test_manifest_closure_hash_archive_and_determinism(
    vercel_bundle: tuple[Path, Path, dict], tmp_path: Path
) -> None:
    bundle, archive, summary = vercel_bundle
    manifest_path = bundle / "bundle-manifest.resolved.json"
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    records = manifest["files"]
    expected_paths = {record["path"] for record in records}
    assert expected_paths.isdisjoint(SOURCE_ONLY_INPUTS)
    actual_paths = {
        path.relative_to(bundle).as_posix()
        for path in bundle.rglob("*")
        if path.is_file() and path != manifest_path
    }
    assert actual_paths == expected_paths
    for record in records:
        content = (bundle / record["path"]).read_bytes()
        assert len(content) == record["bytes"]
        assert hashlib.sha256(content).hexdigest() == record["sha256"]
    closure = json.dumps(records, sort_keys=True, separators=(",", ":")).encode("utf-8")
    assert hashlib.sha256(closure).hexdigest() == manifest["closure_sha256"]
    assert hashlib.sha256(manifest_bytes).hexdigest() == summary["manifest_sha256"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == summary["archive_sha256"]
    with tarfile.open(archive, "r:gz") as packaged:
        members = packaged.getmembers()
        assert {member.name for member in members} == actual_paths | {manifest_path.name}
        assert all(member.isfile() and member.mtime == 0 and member.uid == 0 and member.gid == 0 for member in members)

    second = tmp_path / "second"
    second_summary, second_archive = _build(second)
    assert (second / manifest_path.name).read_bytes() == manifest_bytes
    assert second_summary["archive_sha256"] == summary["archive_sha256"]
    assert second_archive.read_bytes() == archive.read_bytes()


def test_forbidden_paths_content_and_sensitive_datasets_are_absent(
    vercel_bundle: tuple[Path, Path, dict]
) -> None:
    bundle, _, summary = vercel_bundle
    manifest = json.loads((bundle / "bundle-manifest.resolved.json").read_text(encoding="utf-8"))
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    excluded = set(policy["excluded"])
    for required in (
        "features/tripwire/data/**",
        "packages/history-collaboration/**",
        "packages/core-kernel/evidence/**",
        "governance/**",
        "docs/**",
        "tests/**",
        ".git/**",
        ".vercel/**",
        "**/__pycache__/**",
        "**/.env*",
        "**/*credential*",
        "**/*secret*",
        "**/*kestrel*",
        "**/bom/**",
    ):
        assert required in excluded

    forbidden_path_parts = (
        "/features/tripwire/data/",
        "/packages/history-collaboration/",
        "/packages/core-kernel/evidence/",
        "/governance/",
        "/docs/",
        "/tests/",
        "/.git/",
        "/.vercel/",
        "/__pycache__/",
    )
    for record in manifest["files"]:
        source = f"/{record['source'].lower()}/"
        target = f"/{record['path'].lower()}/"
        assert not any(part in source or part in target for part in forbidden_path_parts)
        content = (bundle / record["path"]).read_bytes()
        assert b"/Users/" not in content
        assert b"consolidated_screening_list.csv" not in content
        assert b"PX4_PARTS_DATABASE.csv" not in content
        assert b"Kestrel" not in content
    assert not any(path.is_symlink() for path in bundle.rglob("*"))
    assert not (bundle / ".vercel").exists()
    assert summary["bundle_bytes"] < 500 * 1024 * 1024


def test_builder_rejects_forbidden_absolute_path_content(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source_repo = tmp_path / "source"
    source_repo.mkdir()
    (source_repo / "runtime.py").write_text(
        'WORKSPACE = "/Users/example/private"\n', encoding="utf-8"
    )
    policy = source_repo / "policy.json"
    policy.write_text(
        json.dumps(
            {
                "schema_version": "test/1",
                "candidate": "test",
                "target": "test",
                "python": "3.12",
                "required_trees": [],
                "required_files": [
                    {"source": "runtime.py", "target": "runtime.py"}
                ],
                "excluded": [],
                "forbidden_content": ["/Users/", "file:///Users/"],
            }
        ),
        encoding="utf-8",
    )
    spec = importlib.util.spec_from_file_location("vercel_bundle_builder_test", BUILDER)
    assert spec is not None and spec.loader is not None
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    output = tmp_path / "output"
    monkeypatch.setattr(builder, "REPO", source_repo)
    monkeypatch.setattr(builder, "POLICY", policy)
    monkeypatch.setattr(sys, "argv", [str(BUILDER), "--output", str(output)])
    with pytest.raises(
        SystemExit,
        match="Absolute workspace path found in runtime file: runtime.py",
    ):
        builder.main()
    assert not output.exists()
