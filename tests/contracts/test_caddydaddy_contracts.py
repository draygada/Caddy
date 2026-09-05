#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from decimal import Decimal
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "packages" / "caddydaddy-contracts"
SCHEMAS = CONTRACTS / "schemas"
VECTORS = CONTRACTS / "test-vectors" / "compliance-contracts.v1.test-vectors.json"


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def canonicalize(value: object) -> str:
    def check(item: object) -> None:
        if isinstance(item, float):
            raise AssertionError("binary floats are forbidden in deterministic fixtures")
        if isinstance(item, dict):
            for key, child in item.items():
                if not isinstance(key, str) or not key.isascii():
                    raise AssertionError("fixture keys must be ASCII")
                check(child)
        elif isinstance(item, list):
            for child in item:
                check(child)

    check(value)
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))


class ContractsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schemas = {path.name: read_json(path) for path in SCHEMAS.glob("*.schema.json")}
        cls.validators = {name: Draft202012Validator(schema) for name, schema in cls.schemas.items()}
        cls.vectors = read_json(VECTORS)

    def valid(self, schema: str, document: object) -> None:
        self.validators[schema].validate(document)

    def invalid(self, schema: str, document: object) -> None:
        with self.assertRaises(Exception):
            self.validators[schema].validate(document)

    def test_schemas_and_positive_vectors(self) -> None:
        self.assertEqual(len(self.schemas), 3)
        for schema in self.schemas.values():
            Draft202012Validator.check_schema(schema)
        for vector in self.vectors["documents"].values():
            self.valid(vector["schema"], vector["document"])

    def test_rfc8785_sha256_vectors(self) -> None:
        self.assertEqual(self.vectors["canonicalization"], "RFC8785")
        self.assertEqual(self.vectors["hash_algorithm"], "SHA-256")
        for vector in self.vectors["identity_vectors"].values():
            encoded = canonicalize(vector["preimage"])
            digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
            self.assertEqual(encoded, vector["canonical_utf8"])
            self.assertEqual(digest, vector["sha256"])
            self.assertEqual(vector["node_id"], "tripwire-node:" + digest)
        for vector in self.vectors["documents"].values():
            encoded = canonicalize(vector["hash_preimage"])
            digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
            self.assertEqual(encoded, vector["canonical_utf8"])
            self.assertEqual(digest, vector["sha256"])
            self.assertEqual(vector["document"][vector["hash_field"]], digest)
            self.assertEqual(vector["document"][vector["id_field"]], vector["id_prefix"] + digest)

    def test_node_identity_excludes_unstable_fields(self) -> None:
        primary = self.vectors["identity_vectors"]["primary"]
        alternate = self.vectors["identity_vectors"]["alternate_occurrence"]
        self.assertEqual(set(primary["preimage"]), {"product_thread_id", "forge_record_id", "occurrence_path"})
        self.assertNotEqual(primary["node_id"], alternate["node_id"])

        document = copy.deepcopy(self.vectors["documents"]["input"]["document"])
        node_id = document["nodes"][0]["node_id"]
        document["nodes"][0]["business_fields"]["mpn"] = "CHANGED-MPN"
        document["nodes"].reverse()
        self.assertEqual(document["nodes"][0]["node_id"], node_id)

        for forbidden, value in (("mpn", "FORBIDDEN"), ("array_index", 0), ("mesh_face", 7)):
            bad = copy.deepcopy(self.vectors["documents"]["input"]["document"])
            bad["nodes"][0]["identity_preimage"][forbidden] = value
            self.invalid("compliance-input.v1.schema.json", bad)

    def test_mm_to_m_and_server_only_projection(self) -> None:
        document = self.vectors["documents"]["input"]["document"]
        self.assertEqual(document["unit_conversion"]["exact_factor"], "0.001")
        for measurement in document["nodes"][0]["measurements"]:
            self.assertEqual(
                Decimal(measurement["source_mm"]) * Decimal(measurement["exact_factor"]),
                Decimal(measurement["projected_m"]),
            )

        bad = copy.deepcopy(document)
        bad["forge_revision"]["recompute_state"] = "FAILED"
        self.invalid("compliance-input.v1.schema.json", bad)
        bad = copy.deepcopy(document)
        bad["producer"]["runtime"] = "BROWSER"
        self.invalid("compliance-input.v1.schema.json", bad)

    def test_observation_stays_successful_draft_review_support(self) -> None:
        document = self.vectors["documents"]["observation"]["document"]
        self.assertEqual(document["rule_pack"]["state"], "DRAFT_REVIEW_ONLY")
        self.assertEqual(document["review_requirement"], "HUMAN_REVIEW_REQUIRED")
        self.assertEqual(document["legal_effect"], "NONE")

        bad = copy.deepcopy(document)
        bad["evaluation_state"] = "FAILED"
        self.invalid("compliance-observation.v1.schema.json", bad)
        bad = copy.deepcopy(document)
        bad["rule_pack"]["state"] = "APPROVED"
        self.invalid("compliance-observation.v1.schema.json", bad)

    def test_failure_receipts_have_no_current_observation_and_preserve_cad(self) -> None:
        bound = self.vectors["documents"]["bound_receipt"]["document"]
        self.assertIsNotNone(bound["current_observation_ref"])
        self.assertEqual(bound["compliance_claim_gate"], "HUMAN_REVIEW_REQUIRED")

        for name in ("forge_failure_receipt", "tripwire_failure_receipt"):
            document = self.vectors["documents"][name]["document"]
            self.assertIsNone(document["current_observation_ref"])
            self.assertEqual(document["cad_mutation_effect"], "NONE")
            self.assertEqual(document["compliance_claim_gate"], "BLOCKED")
            self.assertEqual(document["rule_pack_state"], "DRAFT_REVIEW_ONLY")
            bad = copy.deepcopy(document)
            bad["current_observation_ref"] = document["last_valid_observation_ref"]
            self.invalid("compliance-binding-receipt.v1.schema.json", bad)


if __name__ == "__main__":
    unittest.main()
