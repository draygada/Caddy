"""Record envelope hashing must match the repository's normative vectors.

Source of truth: docs/contracts/platform-records.v1.test-vectors.json (integrator-owned).
"""
import json
from pathlib import Path

from forge_classification.records import canonical_bytes, content_hash, seal_record

REPO = Path(__file__).resolve().parents[2]
VECTORS = json.loads((REPO / "docs/contracts/platform-records.v1.test-vectors.json").read_text())


def test_canonical_bytes_match_rfc8785_vector():
    v = VECTORS["vectors"]["record_content_hash"]
    assert canonical_bytes(v["preimage"]).decode("utf-8") == v["canonical_utf8"]


def test_content_hash_and_revision_id_match_vector():
    v = VECTORS["vectors"]["record_content_hash"]
    assert content_hash(v["preimage"]) == v["sha256"]
    sealed = seal_record(v["preimage"])
    assert sealed["content_hash"] == v["sha256"]
    assert sealed["revision_id"] == v["revision_id"]


def test_seal_ignores_existing_hash_fields():
    v = VECTORS["vectors"]["record_content_hash"]
    dirty = dict(v["preimage"], revision_id="record-rev:junk", content_hash="junk")
    assert seal_record(dirty)["content_hash"] == v["sha256"]


def test_command_hash_matches_vector():
    v = VECTORS["vectors"]["command_hash"]
    from forge_classification.records import command_hash
    assert command_hash(v["preimage"]) == v["sha256"]
