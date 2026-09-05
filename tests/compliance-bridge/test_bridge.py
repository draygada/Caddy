from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "packages" / "compliance-bridge"))

from compliance_bridge import (  # noqa: E402
    ComplianceBridgeError,
    canonical_sha256,
    compute_node_id,
    compute_projection_hash,
    evaluate_compliance,
    validate_binding_receipt,
    validate_observation,
)


SOURCE_COMMIT = "480f47e9a754d92294bfced67e52394f0043ab58"
FIXED_TIME = "2026-09-05T12:00:00Z"


class ComplianceBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.rules: list[dict] = []
        self.chart = {"countries": {}}
        self.input = self._input_fixture()
        self.current_revision = deepcopy(self.input["forge_revision"])
        identity = self.input["nodes"][0]["identity_preimage"]
        self.current_records = {
            identity["forge_record_id"]: {
                "forge_record_revision_id": self.input["nodes"][0][
                    "forge_record_revision_id"
                ],
                "occurrence_path": deepcopy(identity["occurrence_path"]),
            }
        }

    def _input_fixture(self) -> dict:
        product_thread_id = "thread:alpha"
        record_id = "record:part-1"
        occurrence_path = ["assembly:root", "part:one"]
        node_id = compute_node_id(product_thread_id, record_id, occurrence_path)
        compliance_input = {
            "schema_version": "caddydaddy.compliance-input/1",
            "projection_id": "compliance-input:" + "0" * 64,
            "projection_hash": "0" * 64,
            "product_thread_id": product_thread_id,
            "created_at": FIXED_TIME,
            "producer": {"system": "FORGE", "runtime": "SERVER"},
            "forge_revision": {
                "revision_id": "revision:r1",
                "content_hash": "a" * 64,
                "recompute_state": "SUCCEEDED",
                "geometry_artifact_hash": "b" * 64,
            },
            "unit_conversion": {
                "source_length_unit": "mm",
                "target_length_unit": "m",
                "exact_factor": "0.001",
            },
            "rule_pack": {
                "state": "DRAFT_REVIEW_ONLY",
                "content_hash": canonical_sha256(self.rules),
                "source_ref": "rules:DRAFT",
            },
            "nodes": [
                {
                    "node_id": node_id,
                    "identity_preimage": {
                        "product_thread_id": product_thread_id,
                        "forge_record_id": record_id,
                        "occurrence_path": occurrence_path,
                    },
                    "forge_record_revision_id": "record-revision:r1",
                    "kind": "part",
                    "parent_node_id": None,
                    "business_fields": {
                        "mpn": "PX4-001",
                        "vendor": "Example",
                        "display_name": "Bracket",
                    },
                    "measurements": [
                        {
                            "name": "length",
                            "source_mm": "1250",
                            "projected_m": "1.250",
                            "exact_factor": "0.001",
                        }
                    ],
                    "tripwire_payload": {"kind": "part", "mpn": "PX4-001"},
                }
            ],
        }
        self._restamp(compliance_input)
        return compliance_input

    @staticmethod
    def _restamp(compliance_input: dict) -> None:
        digest = compute_projection_hash(compliance_input)
        compliance_input["projection_hash"] = digest
        compliance_input["projection_id"] = f"compliance-input:{digest}"

    def _evaluate(self, compliance_input: dict | None = None) -> dict:
        return evaluate_compliance(
            self.input if compliance_input is None else compliance_input,
            current_forge_revision=self.current_revision,
            current_records=self.current_records,
            rules=self.rules,
            chart=self.chart,
            observed_at=FIXED_TIME,
            recorded_at=FIXED_TIME,
            source_commit=SOURCE_COMMIT,
        )

    def _assert_rejected(self, code: str, compliance_input: dict | None = None) -> None:
        with self.assertRaises(ComplianceBridgeError) as raised:
            self._evaluate(compliance_input)
        self.assertEqual(code, raised.exception.code)

    def test_deterministic_replay_uses_imported_tripwire_and_binds_receipt(self) -> None:
        first = self._evaluate()
        second = self._evaluate()
        self.assertEqual(first, second)

        identity_json = (
            '{"forge_record_id":"record:part-1","occurrence_path":'
            '["assembly:root","part:one"],"product_thread_id":"thread:alpha"}'
        )
        expected_node = "tripwire-node:" + hashlib.sha256(identity_json.encode()).hexdigest()
        self.assertEqual(expected_node, self.input["nodes"][0]["node_id"])
        self.assertEqual({expected_node}, set(first["evaluator_output"]))
        self.assertIsNone(first["evaluator_output"][expected_node]["jurisdiction"])
        self.assertEqual(
            "INSUFFICIENT_EVIDENCE", first["observation"]["findings"][0]["outcome"]
        )
        self.assertEqual(
            "HUMAN_REVIEW_REQUIRED", first["observation"]["review_requirement"]
        )
        self.assertEqual("DRAFT_REVIEW_ONLY", first["observation"]["rule_pack"]["state"])
        self.assertEqual("BOUND", first["binding_receipt"]["binding_status"])
        self.assertEqual(
            first["observation"]["observation_id"],
            first["binding_receipt"]["current_observation_ref"]["observation_id"],
        )

    def test_rejects_absent_units(self) -> None:
        candidate = deepcopy(self.input)
        del candidate["unit_conversion"]
        self._assert_rejected("INPUT_SCHEMA_INVALID", candidate)

    def test_rejects_unknown_units(self) -> None:
        candidate = deepcopy(self.input)
        candidate["unit_conversion"] = {
            "source_length_unit": "cm",
            "target_length_unit": "m",
            "exact_factor": "0.01",
        }
        self._restamp(candidate)
        self._assert_rejected("INPUT_SCHEMA_INVALID", candidate)

    def test_rejects_mismatched_unit_value(self) -> None:
        candidate = deepcopy(self.input)
        candidate["nodes"][0]["measurements"][0]["projected_m"] = "1.251"
        self._restamp(candidate)
        self._assert_rejected("UNIT_VALUE_MISMATCH", candidate)

    def test_rejects_stale_forge_revision(self) -> None:
        self.current_revision["revision_id"] = "revision:r2"
        self._assert_rejected("STALE_FORGE_REVISION")

    def test_rejects_stale_record_revision(self) -> None:
        self.current_records["record:part-1"]["forge_record_revision_id"] = (
            "record-revision:r2"
        )
        self._assert_rejected("STALE_RECORD_REVISION")

    def test_rejects_wrong_occurrence(self) -> None:
        candidate = deepcopy(self.input)
        identity = candidate["nodes"][0]["identity_preimage"]
        identity["occurrence_path"] = ["assembly:root", "part:other"]
        candidate["nodes"][0]["node_id"] = compute_node_id(
            identity["product_thread_id"],
            identity["forge_record_id"],
            identity["occurrence_path"],
        )
        self._restamp(candidate)
        self._assert_rejected("WRONG_OCCURRENCE", candidate)

    def test_rejects_wrong_node_id(self) -> None:
        candidate = deepcopy(self.input)
        candidate["nodes"][0]["node_id"] = "tripwire-node:" + "f" * 64
        self._restamp(candidate)
        self._assert_rejected("WRONG_NODE_ID", candidate)

    def test_rejects_input_tampering(self) -> None:
        candidate = deepcopy(self.input)
        candidate["nodes"][0]["business_fields"]["display_name"] = "Tampered"
        self._assert_rejected("INPUT_TAMPERED", candidate)

    def test_rejects_evaluator_exception_with_valid_blocked_receipt(self) -> None:
        def explode(design: object, rules: list[dict], chart: dict) -> dict:
            raise RuntimeError("boom")

        with patch(
            "compliance_bridge.bridge._load_tripwire_evaluator", return_value=explode
        ):
            with self.assertRaises(ComplianceBridgeError) as raised:
                self._evaluate()
        self.assertEqual("TRIPWIRE_EVALUATOR_ERROR", raised.exception.code)
        receipt = raised.exception.binding_receipt
        self.assertIsNotNone(receipt)
        self.assertEqual("BLOCKED_TRIPWIRE_FAILURE", receipt["binding_status"])
        self.assertEqual("BLOCKED", receipt["compliance_claim_gate"])
        self.assertIsNone(receipt["current_observation_ref"])
        validate_binding_receipt(receipt)

    def test_rejects_evaluator_policy_block_with_valid_blocked_receipt(self) -> None:
        def policy_block(design: object, rules: list[dict], chart: dict) -> dict:
            return {node_id: {"policy_blocked": True} for node_id in design.nodes}

        with patch(
            "compliance_bridge.bridge._load_tripwire_evaluator",
            return_value=policy_block,
        ):
            with self.assertRaises(ComplianceBridgeError) as raised:
                self._evaluate()
        self.assertEqual("TRIPWIRE_POLICY_BLOCKED", raised.exception.code)
        validate_binding_receipt(raised.exception.binding_receipt)

    def test_rejects_evaluator_wrong_node(self) -> None:
        def wrong_node(design: object, rules: list[dict], chart: dict) -> dict:
            return {"tripwire-node:" + "e" * 64: {}}

        with patch(
            "compliance_bridge.bridge._load_tripwire_evaluator", return_value=wrong_node
        ):
            with self.assertRaises(ComplianceBridgeError) as raised:
                self._evaluate()
        self.assertEqual("TRIPWIRE_NODE_SET_MISMATCH", raised.exception.code)
        validate_binding_receipt(raised.exception.binding_receipt)

    def test_rejects_observation_and_receipt_tampering(self) -> None:
        result = self._evaluate()
        observation = deepcopy(result["observation"])
        observation["findings"][0]["reason_codes"].append("TAMPERED")
        with self.assertRaises(ComplianceBridgeError) as observation_error:
            validate_observation(observation)
        self.assertEqual("OBSERVATION_TAMPERED", observation_error.exception.code)

        receipt = deepcopy(result["binding_receipt"])
        receipt["compliance_claim_gate"] = "BLOCKED"
        with self.assertRaises(ComplianceBridgeError) as receipt_error:
            validate_binding_receipt(receipt)
        self.assertEqual("RECEIPT_SCHEMA_INVALID", receipt_error.exception.code)


if __name__ == "__main__":
    unittest.main()
