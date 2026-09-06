from __future__ import annotations

import importlib.util
import json
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
