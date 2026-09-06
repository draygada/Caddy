from __future__ import annotations

import hashlib
import importlib.util
import json
import zipfile
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = SERVICE_ROOT / "scripts" / "verify_redistribution_evidence.py"


def load_verifier():
    spec = importlib.util.spec_from_file_location("verify_redistribution_evidence", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_exact_native_evidence_bundle_is_complete():
    verifier = load_verifier()
    errors, summary = verifier.verify_evidence(SERVICE_ROOT)
    assert errors == []
    assert summary == {
        "components": 22,
        "errors": [],
        "factual_evidence": "PASS",
        "legal_determination": "NOT_PERFORMED",
        "native_files": 70,
        "source_sets": 22,
    }


def test_every_native_file_maps_to_a_component_with_notice_and_source():
    runtime = json.loads(
        (SERVICE_ROOT / "licenses" / "native-runtime-manifest.v1.json").read_text()
    )
    components = {item["id"]: item for item in runtime["components"]}
    assert len(runtime["native_files"]) == runtime["expected_native_file_count"] == 70
    for native_file in runtime["native_files"]:
        component = components[native_file["component_id"]]
        assert component["license_evidence"]
        assert component["source_sets"]
        assert native_file["mapping_evidence"]["method"]


def test_wheel_sbom_is_preserved_and_explicitly_supplemented():
    runtime = json.loads(
        (SERVICE_ROOT / "licenses" / "native-runtime-manifest.v1.json").read_text()
    )
    record = runtime["auditwheel_sbom"]
    assert record["upstream_component_count"] == 19
    assert "UNDECLARED" in record["license_declarations"]
    assert record["path"].endswith("OCP-WHEEL-AUDITWHEEL-CDX-1.4.json")


def test_pydantic_core_runtime_evidence_matches_hardened_linux_wheel():
    runtime = json.loads(
        (SERVICE_ROOT / "licenses" / "native-runtime-manifest.v1.json").read_text()
    )
    sources = json.loads(
        (SERVICE_ROOT / "licenses" / "native-source-artifacts.v1.json").read_text()
    )
    component = next(item for item in runtime["components"] if item["id"] == "pypi:pydantic-core")
    native = next(item for item in runtime["native_files"] if item["component_id"] == component["id"])
    source = next(item for item in sources["source_sets"] if item["component"] == "pydantic-core")

    assert component["version"] == source["version"] == "2.46.5"
    assert component["source_sets"] == ["pypi-source:pydantic-core@2.46.5"]
    assert component["package_artifact"] == {
        "bytes": 2_066_284,
        "filename": "pydantic_core-2.46.5-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
        "sha256": "0fc5be0abd4a407e200d844b404e33639a554e7bd0d448e7b9ae181be4789ac2",
        "url": "https://files.pythonhosted.org/packages/c0/a4/eb9409ec0736e50aa70a412f16c204ed149516846912f7e6724d4c73ee53/pydantic_core-2.46.5-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl",
    }
    assert native["bytes"] == 4_692_312
    assert native["sha256"] == "95f68ef2535a5102a03442e073d4906c01211b208902f56e24ec23cea402b5a0"

    wheel_records = {item["kind"]: item for item in component["wheel_evidence"]}
    assert wheel_records["license"]["sha256"] == component["license_evidence"][0]["sha256"]
    assert wheel_records["cyclonedx-sbom"]["bytes"] == 125_376
    assert wheel_records["cyclonedx-sbom"]["sha256"] == "4f40c790f0cb384a793663331904117a914a50ef220b112c399d77f1463e3dd5"
    verifier = load_verifier()
    errors = []
    verifier._check_file(SERVICE_ROOT, component["package_metadata_evidence"][0], errors)
    assert errors == []


def test_embedded_wheel_evidence_is_content_verified(tmp_path):
    verifier = load_verifier()
    member = "package/native.so"
    payload = b"exact native bytes"
    wheel = tmp_path / "fixture.whl"
    with zipfile.ZipFile(wheel, "w") as archive:
        archive.writestr(member, payload)
    wheel_hash = hashlib.sha256(wheel.read_bytes()).hexdigest()
    cache = tmp_path / "cache"
    cache.mkdir()
    wheel.replace(cache / wheel_hash)
    runtime = {
        "components": [
            {
                "id": "pypi:fixture",
                "package_artifact": {
                    "bytes": (cache / wheel_hash).stat().st_size,
                    "sha256": wheel_hash,
                    "url": "https://invalid.example/fixture.whl",
                },
                "wheel_evidence": [
                    {
                        "bytes": len(payload),
                        "kind": "native-extension",
                        "sha256": hashlib.sha256(payload).hexdigest(),
                        "wheel_path": member,
                    }
                ],
            }
        ]
    }
    assert verifier._verify_embedded_wheel_evidence(runtime, cache) == []
    runtime["components"][0]["wheel_evidence"][0]["bytes"] += 1
    errors = verifier._verify_embedded_wheel_evidence(runtime, cache)
    assert errors == [f"wheel evidence size mismatch: {member}: {len(payload)} != {len(payload) + 1}"]


def test_notice_tampering_is_detected(tmp_path):
    verifier = load_verifier()
    runtime = json.loads(
        (SERVICE_ROOT / "licenses" / "native-runtime-manifest.v1.json").read_text()
    )
    record = runtime["components"][0]["license_evidence"][0]
    altered = tmp_path / record["path"]
    altered.parent.mkdir(parents=True)
    altered.write_text("altered", encoding="utf-8")
    errors = []
    verifier._check_file(tmp_path, record, errors)
    assert any("sha256 mismatch" in error or "size mismatch" in error for error in errors)
