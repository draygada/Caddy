from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from forge_classification import DEFAULT_PACK_SHA256, default_pack
from forge_classification.pack import ReferencePackIntegrityError, build_pack, build_trusted_pack
from forge_classification.snapshot import snapshot_from_part_revision, snapshot_from_product


LANE = Path(__file__).resolve().parents[2] / "packages/classification"
RAW = LANE / "data/ecfr/raw"
MANIFEST = LANE / "data/ecfr/manifest.json"


def test_duplicate_product_fact_paths_are_rejected() -> None:
    with pytest.raises(ValueError, match=r"duplicate fact path: 'declared\.military_use'"):
        snapshot_from_product(
            "synthetic component",
            [
                {"path": "declared.military_use", "value": "true"},
                {"path": "declared.military_use", "value": "false"},
            ],
        )


def test_extra_fact_cannot_overwrite_generated_part_fact() -> None:
    part_revision = {
        "part_document": {
            "revision": {"revision_id": "rev:test", "intent": "synthetic"},
            "units": {"length": "mm", "angle": "deg"},
            "parameters": {
                "width": {"name": "width", "literal": "10", "value_type": "LENGTH"},
            },
            "bodies": [],
        },
    }
    with pytest.raises(ValueError, match=r"duplicate fact path: 'param\.width'"):
        snapshot_from_part_revision(
            part_revision,
            [{"path": "param.width", "value": "20", "unit": "mm"}],
            item_kind="commodity",
        )


def test_default_pack_is_bound_to_pinned_manifest_and_pack_hash() -> None:
    pack = default_pack()
    assert pack.sha256 == DEFAULT_PACK_SHA256
    assert set(pack.manifest["sources"]) == {
        "title-22-part-121.xml",
        "title-15-part-774.xml",
        "title-22-section-120.41.xml",
        "title-15-section-772.1.xml",
    }


def test_trusted_pack_rejects_modified_source_but_custom_builder_remains_available(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    manifest = tmp_path / "manifest.json"
    shutil.copy2(MANIFEST, manifest)
    source = raw / "title-15-part-774.xml"
    source.write_bytes(source.read_bytes() + b"\n<!-- integrity ablation -->\n")

    with pytest.raises(ReferencePackIntegrityError, match="REFERENCE_PACK_SOURCE_SIZE_MISMATCH"):
        build_trusted_pack(raw, manifest, expected_pack_sha256=DEFAULT_PACK_SHA256)

    assert build_pack(raw).sha256 != DEFAULT_PACK_SHA256


def test_updating_manifest_to_match_poisoned_source_still_cannot_move_pinned_root(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    manifest_path = tmp_path / "manifest.json"
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    source = raw / "title-15-part-774.xml"
    content = source.read_text(encoding="utf-8").replace(
        "A maximum 'endurance' of 1 hour or greater",
        "A maximum 'endurance' of 3 hours or greater",
        1,
    )
    assert content != source.read_text(encoding="utf-8")
    source.write_text(content, encoding="utf-8")
    record = manifest["sources"][source.name]
    payload = source.read_bytes()
    import hashlib

    record["bytes"] = len(payload)
    record["sha256"] = hashlib.sha256(payload).hexdigest()
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ReferencePackIntegrityError, match="REFERENCE_PACK_HASH_MISMATCH"):
        build_trusted_pack(raw, manifest_path, expected_pack_sha256=DEFAULT_PACK_SHA256)
