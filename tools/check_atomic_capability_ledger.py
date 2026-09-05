#!/usr/bin/env python3
"""Validate the atomic capability freeze, hashes, schema and aggregation gates."""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

import generate_atomic_capability_ledger as generator


ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "docs/research"
CONTRACTS = ROOT / "docs/contracts"
ATLAS = ROOT.parent / "CAD_CAPABILITY_ATLAS_2026.md"
ANNEX = ROOT.parent / "hackathon-dc-2026/research/cad-capability-ship-2026-09-05/gap-matrix.md"


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def candidate(record: dict[str, Any], verdict: str, implementation_class: str) -> dict[str, Any]:
    result = copy.deepcopy(record)
    result["verdict"] = verdict
    result["implementation"]["class"] = implementation_class
    result["candidate_evidence"] = {
        "candidate_hash": "a" * 40,
        "candidate_clean": True,
        "command": "synthetic-verification-command",
        "exit_status": 0,
        "artifact_hashes": ["b" * 64],
        "provenance": "synthetic aggregation-gate self-test",
        "real_dependency_executed": False,
        "independent_domain_verification": False,
    }
    result["lifecycle_status"] = "IMPLEMENTED"
    result["proof_status"] = "DEMONSTRATED"
    result["evidence_class"] = "IMMUTABLE_CANDIDATE"
    return result


def validate_aggregation(records: list[dict[str, Any]]) -> None:
    template = records[0]
    require(generator.effective_child(template) == "HOLD", "initial HOLD must remain HOLD")

    native = candidate(template, "NATIVE_IMPLEMENTED", "NATIVE")
    require(generator.effective_child(native) == "PASS", "complete native candidate must pass")

    dirty = copy.deepcopy(native)
    dirty["candidate_evidence"]["candidate_clean"] = False
    require(generator.effective_child(dirty) == "HOLD", "dirty candidate must hold")

    no_artifact = copy.deepcopy(native)
    no_artifact["candidate_evidence"]["artifact_hashes"] = []
    require(generator.effective_child(no_artifact) == "HOLD", "artifact-free evidence must hold")

    boundary = candidate(template, "BOUNDARY_IMPLEMENTED", "BOUNDARY")
    boundary["required_proof_tier"] = "BEHAVIOR"
    require(generator.effective_child(boundary) == "HOLD", "boundary cannot satisfy behavior")
    boundary["required_proof_tier"] = "BOUNDARY"
    require(generator.effective_child(boundary) == "PASS", "boundary may satisfy boundary-only leaf")

    adopted = candidate(template, "ADOPTED_IMPLEMENTED", "ADOPTED")
    require(generator.effective_child(adopted) == "HOLD", "unexecuted adopted dependency must hold")
    adopted["candidate_evidence"]["real_dependency_executed"] = True
    adopted["candidate_evidence"]["independent_domain_verification"] = True
    adopted["evidence_class"] = "INDEPENDENT_VERIFICATION"
    require(generator.effective_child(adopted) == "PASS", "verified adopted dependency must pass")

    failed = copy.deepcopy(template)
    failed["verdict"] = "FAILED"
    require(generator.aggregate_status([native, failed]) == "FAILED", "failed mandatory child must dominate")
    require(generator.aggregate_status([native, template]) == "HOLD", "held mandatory child must dominate")
    require(generator.aggregate_status([native, adopted]) == "PASS", "all proven mandatory children must pass")
    require(generator.aggregate_status([]) == "HOLD", "empty parent must hold")


def validate_contract_vectors() -> None:
    payload = load(CONTRACTS / "part-document.v1.test-vectors.json")
    platform_payload = load(CONTRACTS / "platform-records.v1.test-vectors.json")
    for namespace, vector_payload in (("part", payload), ("platform", platform_payload)):
        for name, item in vector_payload["vectors"].items():
            expected_text = generator.canonical(item["preimage"])
            require(item["canonical_utf8"] == expected_text, f"{namespace} contract vector canonical mismatch: {name}")
            require(item["sha256"] == sha256_bytes(expected_text.encode("utf-8")), f"{namespace} contract vector digest mismatch: {name}")

    vectors = payload["vectors"]
    require(vectors["bom_line_hash"]["preimage"]["quantity"] == 6, "recursive BOM 2x3 quantity vector missing")
    paths = vectors["bom_line_hash"]["preimage"]["source_occurrence_paths"]
    require(len(paths) == 6 and len({tuple(path) for path in paths}) == 6, "full occurrence paths are not unique")
    composition = vectors["assembly_geometry_hash"]["preimage"]["occurrences"]
    top = [item for item in composition if item["target_definition_kind"] == "ASSEMBLY"]
    require(len(top) == 2, "reused subassembly vector must have two top-level occurrences")
    require(top[0]["target_definition_revision_id"] == top[1]["target_definition_revision_id"], "subassembly revision was copied instead of reused")

    contract = (CONTRACTS / "part-document.v1.md").read_text(encoding="utf-8")
    for phrase in (
        "AssemblyDefinitionRevision", "resolved_configuration_hash", "SUPPRESSED", "HIDDEN",
        "EXCLUDED_FROM_BOM", "placement_source", "CoreCompositionReceipt",
    ):
        require(phrase in contract, f"part/assembly contract missing {phrase}")

    platform_contract = (CONTRACTS / "platform-records.v1.md").read_text(encoding="utf-8")
    for phrase in (
        '"record_kind"', '"record_id"', '"revision_id"', '"content_hash"',
        '"authority_domain"', "worst-mandatory-child",
    ):
        require(phrase in platform_contract, f"platform contract missing {phrase}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--freeze", action="store_true", help="also require pristine all-HOLD lineage state")
    args = parser.parse_args()

    try:
        denominator = load(RESEARCH / "capability-denominator.v1.json")
        decomposition = load(RESEARCH / "atomic-capability-decomposition.v1.json")
        schema = load(RESEARCH / "atomic-capability-ledger.v1.schema.json")
        ledger = load(RESEARCH / "atomic-capability-ledger.v1.json")
        aggregate = load(RESEARCH / "capability-aggregate-manifest.v1.json")
        integrity = load(RESEARCH / "atomic-capability-integrity.v1.json")

        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(ledger)

        require(ATLAS.is_file() and ANNEX.is_file(), "bound research source is unavailable")
        require(
            sha256_bytes(ATLAS.read_bytes()) == denominator["source_authority"]["canonical_atlas_sha256"],
            "canonical Atlas hash drift",
        )
        require(
            sha256_bytes(ANNEX.read_bytes()) == denominator["source_authority"]["research_annex_sha256"],
            "research annex hash drift",
        )

        parents = denominator["parents"]
        expected_parent_ids = [f"CAD-{index:03d}" for index in range(1, 70)]
        require(len(parents) == 69, "parent denominator must contain exactly 69 rows")
        require([item["parent_id"] for item in parents] == expected_parent_ids, "parent IDs must be contiguous CAD-001..CAD-069")
        require([item["source_row"] for item in parents] == list(range(1, 70)), "source rows must be contiguous 1..69")

        records = ledger["records"]
        ids = [item["atomic_id"] for item in records]
        require(len(records) == len(set(ids)), "atomic IDs are not unique")
        require(all(re.fullmatch(r"CAD-[0-9]{3}\.[A-Z0-9][A-Z0-9_.-]*", item) for item in ids), "invalid atomic ID")
        require(all(item["parent_id"] in expected_parent_ids for item in records), "unknown parent reference")
        require(set(expected_parent_ids) == {item["parent_id"] for item in records}, "one or more parents have no atomic children")

        id_set = set(ids)
        for record in records:
            for dependency in record["dependencies"]:
                require(dependency in id_set, f"unresolved dependency {dependency} on {record['atomic_id']}")

        by_parent = Counter(item["parent_id"] for item in records)
        require(by_parent["CAD-014"] == 56, "CAD-014 must split 14 feature kinds into four behaviors each")
        require(by_parent["CAD-034"] == 60, "CAD-034 must split profile/direction/scope/facet into 60 leaves")
        require(not any("RADIUS_DIAMETER" in item for item in ids), "radius/diameter leaf remains compound")
        require(not any("PLASTICS_FILL_PACK_WARP" in item for item in ids), "fill/pack/warp leaf remains compound")
        require(not any(re.search(r"\.FEATURE\.PATTERN\.", item) for item in ids), "linear/circular feature patterns remain compound")

        observation = next(item for item in records if item["atomic_id"] == "CAD-010.OPS.SYNTHETIC_OBSERVATION")
        require(observation["data_authority"] == "SYNTHETIC_NOTIONAL", "operations observation is not synthetic-notional")
        affected = next(item for item in records if item["atomic_id"] == "CAD-010.OPS.AFFECTED_TRACE_LINKS")
        require(affected["required_proof_tier"] == "BEHAVIOR" and affected["dependencies"], "operations trace links are not behavioral")

        all_flags = Counter(flag for item in records for flag in item["deceptive_equivalence_flags"])
        required_flags = {
            "NATIVE_ADDON", "BREP_MESH", "PMI_GRAPHICS", "BUILTIN_PARTNER", "LOCAL_CLOUD",
            "AUTHOR_VIEW", "PROD_PLAN", "LIVE_SYNTH", "IMPORT_EDITABLE", "ANIMATION_DYNAMICS",
            "FORMAT_FIDELITY", "APPLIED_VERIFIED", "CRDT_GEOMETRY",
        }
        require(required_flags <= set(all_flags), "one or more deceptive-equivalence classes are unrepresented")

        require(ledger["ledger_digest"] == generator.digest(records), "ledger records digest mismatch")
        aggregate_without_digest = {key: value for key, value in aggregate.items() if key != "manifest_digest"}
        require(aggregate["manifest_digest"] == generator.digest(aggregate_without_digest), "aggregate manifest digest mismatch")
        require(integrity["atomic_count"] == len(records), "integrity atomic count mismatch")
        require(integrity["parent_count"] == len(parents), "integrity parent count mismatch")
        require(integrity["atomic_ids_digest"] == generator.digest(ids), "atomic ID digest mismatch")
        require(integrity["decomposition_digest"] == generator.digest(decomposition), "decomposition digest mismatch")
        require(integrity["ledger_records_digest"] == ledger["ledger_digest"], "integrity ledger digest mismatch")
        require(integrity["aggregate_manifest_digest"] == aggregate["manifest_digest"], "integrity aggregate digest mismatch")

        require(len(aggregate["parents"]) == 69, "aggregate parent count mismatch")
        require(all("verdict" not in item for item in aggregate["parents"]), "parent must not be a verdict unit")
        require(all(item["mandatory_child_count"] == item["child_count"] for item in aggregate["parents"]), "nonmandatory source-derived leaf found")

        if args.freeze:
            require(all(item["mandatory"] for item in records), "freeze requires every current leaf mandatory")
            require(all(item["verdict"] == "HOLD" for item in records), "freeze requires every leaf initially HOLD")
            require(all(item["lifecycle_status"] == "TARGET" and item["proof_status"] == "TARGET" for item in records), "freeze evidence state is not TARGET")
            require(all(item["evidence_class"] == "PARENT_LINEAGE_RESEARCH_ONLY" for item in records), "freeze evidence class is not lineage-only")
            require(all(item["aggregate_status"] == "HOLD" for item in aggregate["parents"]), "freeze parent is not HOLD")

        generated_decomposition = generator.build_decomposition(denominator)
        generated_ledger = generator.build_ledger(denominator, generated_decomposition)
        generated_aggregate = generator.build_aggregate(denominator, generated_ledger)
        generated_integrity = generator.build_vectors(generated_decomposition, generated_ledger, generated_aggregate)
        require(decomposition == generated_decomposition, "decomposition differs from authoritative generator")
        require(ledger == generated_ledger, "ledger differs from authoritative generator")
        require(aggregate == generated_aggregate, "aggregate differs from authoritative generator")
        require(integrity == generated_integrity, "integrity receipt differs from authoritative generator")

        validate_aggregation(records)
        validate_contract_vectors()

        print(f"jsonschema={importlib.metadata.version('jsonschema')}")
        print(f"parents={len(parents)}")
        print(f"atomic_records={len(records)}")
        print(f"mandatory_records={sum(1 for item in records if item['mandatory'])}")
        print(f"ledger_digest={ledger['ledger_digest']}")
        print(f"aggregate_digest={aggregate['manifest_digest']}")
        print("deceptive_equivalence=" + ",".join(f"{key}:{all_flags[key]}" for key in sorted(all_flags)))
        print("ATOMIC_CAPABILITY_INTEGRITY_PASS")
        return 0
    except (AssertionError, json.JSONDecodeError, OSError) as exc:
        print(f"ATOMIC_CAPABILITY_INTEGRITY_FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
