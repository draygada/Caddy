from __future__ import annotations

from copy import deepcopy
import http.client
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from threading import Thread
from unittest.mock import patch

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "apps" / "product-service"))

from compliance_bridge import evaluate_compliance, validate_binding_receipt  # noqa: E402
import product_service.app as product_service_app  # noqa: E402
from product_service.app import (  # noqa: E402
    BOUNDED_CLAIM,
    CandidateRuntime,
    create_server,
    review_readiness_guardrail,
)


def first_request(runtime: CandidateRuntime) -> dict:
    bindings = runtime.candidate()["document"]["complianceBindings"]
    return deepcopy(bindings[sorted(bindings)[0]]["request"])


class TestProductService:
    @classmethod
    def setup_class(cls) -> None:
        cls.runtime = CandidateRuntime()
        cls.assets = TemporaryDirectory()
        Path(cls.assets.name, "index.html").write_text("candidate", encoding="utf-8")
        cls.server = create_server("127.0.0.1", 0, cls.runtime, Path(cls.assets.name))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def teardown_class(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.assets.cleanup()

    def post(self, payload: dict) -> tuple[int, dict]:
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        connection.request("POST", "/api/compliance-at-design-click", json.dumps(payload), {"Content-Type": "application/json"})
        response = connection.getresponse()
        body = json.loads(response.read())
        connection.close()
        return response.status, body

    def test_core_partdocument_selection_tripwire_receipt_end_to_end(self) -> None:
        candidate = self.runtime.candidate()
        assert candidate["forgeRevision"]["recompute_state"] == "SUCCEEDED"
        assert candidate["candidate"]["claim"] == BOUNDED_CLAIM
        assert candidate["candidate"]["claimCeiling"] == BOUNDED_CLAIM
        assert candidate["candidate"]["positioningStatus"] == "DESIGN_INTENT_NOT_A_PRODUCT_CLAIM"
        assert candidate["snapshotProvenance"]["mode"] == "PRECOMPUTED_IMMUTABLE"
        assert candidate["snapshotProvenance"]["coreExecutedAtRuntime"] is False
        assert candidate["kernelProvenance"]["partResult"] == "forge.core-recompute-result/1"
        assert candidate["kernelProvenance"]["assemblyResult"] == "forge.core-assembly-result/1"
        assert "wheel-sha256=a070f99039e877e9558759570fd379365e2d28de3850b62e33c9c48e5ac1f0e3" in candidate["kernelProvenance"]["binding"]
        assert candidate["kernelProvenance"]["platformImage"] == "Darwin@arm64;python=cp312;wheel-platform=macosx_11_0_arm64"
        assert candidate["document"]["units"] == {"length": "mm", "angle": "deg"}
        assert all(node["mesh"]["entityRanges"] for node in candidate["document"]["scene"]["nodes"])
        status, body = self.post(first_request(self.runtime))
        assert status == 200
        assert body["status"] == "REVIEW_REQUIRED" and body["cleared"] is False
        assert body["evidence_status"] == "INSUFFICIENT_EVIDENCE"
        assert body["policy_state"] == "DRAFT_REVIEW_ONLY"
        assert body["human_review_requirement"] == "HUMAN_REVIEW_REQUIRED"
        assert body["observation"]["producer"]["source_commit"] == "898f6167e4305a4f86f3ebe4a473278ffbd56530"
        assert body["binding_receipt"]["binding_status"] == "BOUND"
        assert body["evidence"]["finding"]["outcome"] == "INSUFFICIENT_EVIDENCE"
        assert body["review_readiness_guardrail"]["can_clear"] is False
        assert body["review_readiness_guardrail"]["can_classify"] is False
        validate_binding_receipt(body["binding_receipt"])

    def test_snapshot_provenance_is_build_time_and_non_null(self) -> None:
        receipt = self.runtime.state.snapshot_receipt
        assert receipt["core"]["execution_boundary"] == "BUILD_TIME_ONLY"
        assert receipt["core"]["adapter"] == "strafe-ocp@0.1.0"
        assert len(receipt["source"]["commit"]) == 40
        assert len(receipt["source"]["tree"]) == 40
        assert len(receipt["document_sha256"]) == 64

    def test_review_readiness_reports_present_and_missing_without_classification(self) -> None:
        record = deepcopy(next(iter(self.runtime.state.records.values())))
        guardrail = review_readiness_guardrail(record)
        assert {item["field"] for item in guardrail["present"]} == {"material", "supplier"}
        assert {item["field"] for item in guardrail["missing"]} == {"origin", "end_use"}
        assert all(item["reason"] for item in guardrail["present"] + guardrail["missing"])
        assert guardrail["regulatory_determination"] == "NOT_PERFORMED"
        assert guardrail["can_clear"] is False and guardrail["can_classify"] is False

    def test_imported_tripwire_evaluator_is_actually_invoked(self) -> None:
        from compliance_bridge import bridge as bridge_module

        actual = bridge_module._load_tripwire_evaluator()
        calls = []

        def observed(*args, **kwargs):
            calls.append((args, kwargs))
            return actual(*args, **kwargs)

        with patch("compliance_bridge.bridge._load_tripwire_evaluator", return_value=observed):
            status, body = self.runtime.evaluate_request(first_request(self.runtime))
        assert status == 200 and calls
        assert body["evidence_status"] == "INSUFFICIENT_EVIDENCE"

    def test_stale_mismatch_and_request_tamper_fail_closed(self) -> None:
        cases = (("forge_revision_id", "revision:stale", "STALE_FORGE_REVISION"), ("forge_record_revision_id", "record-revision:stale", "STALE_RECORD_REVISION"), ("occurrence_path", ["assembly:wrong"], "WRONG_OCCURRENCE"))
        for field, value, code in cases:
            request = first_request(self.runtime)
            request[field] = value
            status, body = self.post(request)
            assert status == 409
            assert body["status"] == "BLOCKED" and body["cleared"] is False
            assert body["diagnostic"]["code"] == code
            assert body["binding_receipt"] is None

    def test_evaluator_error_returns_only_valid_blocked_receipt(self) -> None:
        def explode(*_args, **_kwargs):
            raise RuntimeError("boom")
        with patch("compliance_bridge.bridge._load_tripwire_evaluator", return_value=explode):
            status, body = self.runtime.evaluate_request(first_request(self.runtime))
        assert status == 502 and body["status"] == "BLOCKED" and body["cleared"] is False
        assert body["diagnostic"]["code"] == "TRIPWIRE_EVALUATOR_ERROR"
        assert body["binding_receipt"]["binding_status"] == "BLOCKED_TRIPWIRE_FAILURE"
        validate_binding_receipt(body["binding_receipt"])

    def test_tampered_bound_receipt_is_not_displayable(self) -> None:
        def tamper(*args, **kwargs):
            result = evaluate_compliance(*args, **kwargs)
            result["binding_receipt"]["receipt_hash"] = "0" * 64
            return result
        runtime = CandidateRuntime(self.runtime.state, tamper)
        status, body = runtime.evaluate_request(first_request(runtime))
        assert status == 502 and body["status"] == "BLOCKED" and body["cleared"] is False
        assert body["diagnostic"]["code"] == "RECEIPT_TAMPERED"
        assert body["binding_receipt"] is None

    def test_evaluator_tamper_fails_closed(self, tmp_path: Path) -> None:
        tampered = tmp_path / "evaluate.py"
        tampered.write_text("def evaluate(*args): return {}\n", encoding="utf-8")
        runtime = CandidateRuntime(self.runtime.state)
        runtime.evaluator_path = tampered
        status, body = runtime.evaluate_request(first_request(runtime))
        assert status == 503 and body["status"] == "BLOCKED" and body["cleared"] is False
        assert body["diagnostic"]["code"] == "EVALUATOR_TAMPERED"

    def test_public_payload_and_bundle_policy_are_sanitized(self) -> None:
        encoded = json.dumps(self.runtime.candidate())
        for forbidden in ("/Users/", "consolidated_screening_list", "PX4_PARTS_DATABASE", "governance/", "history-collaboration"):
            assert forbidden not in encoded
        policy = json.loads((REPO / "apps" / "product-service" / "bundle-manifest.v1.json").read_text())
        excluded = "\n".join(policy["excluded"])
        assert "features/tripwire/data/**" in excluded
        assert "packages/history-collaboration/**" in excluded
        assert "governance/**" in excluded
        admitted_sources = {
            mapping["source"]
            for collection in ("required_trees", "required_files")
            for mapping in policy[collection]
        }
        assert admitted_sources.isdisjoint(
            {
                "apps/product-service/README.md",
                "apps/product-service/bundle-manifest.v1.json",
                "packages/core-kernel",
            }
        )
