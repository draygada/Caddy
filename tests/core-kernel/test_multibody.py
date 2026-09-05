from __future__ import annotations

import json
from pathlib import Path

from strafe_forge_core.program import PartProgram, ProgramOperation
from strafe_forge_core.topology import deserialize_brep, topology_counts

from kernel_cases import engine, literal


def multibody_part():
    parameters = {
        "length": literal("length", "LENGTH", "10"),
        "width": literal("width", "LENGTH", "5"),
        "height": literal("height", "LENGTH", "2"),
        "dx": literal("dx", "LENGTH", "20"),
        "zero": literal("zero", "LENGTH", "0"),
    }
    operations = (
        ProgramOperation(
            "body:a",
            "primitive.box",
            1,
            (),
            {"length": "length", "width": "width", "height": "height"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "body:b",
            "primitive.box",
            1,
            (),
            {"length": "length", "width": "width", "height": "height"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "body:b:move",
            "transform.translate",
            1,
            ("body:b",),
            {"dx": "dx", "dy": "zero", "dz": "zero"},
            (),
            {},
            True,
        ),
    )
    return engine().recompute(
        PartProgram(
            "part:multi",
            "rev:part-multi",
            {"length": "mm", "angle": "deg"},
            parameters,
            operations,
            {},
        )
    )


def test_part_document_preserves_multiple_real_solid_bodies() -> None:
    result = multibody_part()
    assert result.status == "SUCCEEDED"
    assert len(result.bodies) == 2
    assert result.current_artifact is not None
    restored = deserialize_brep(result.current_artifact.content)
    assert topology_counts(restored)["SOLID"] == 2

    evidence_path = (
        Path(__file__).parents[2]
        / "packages/core-kernel/evidence/golden-fixtures.v1.json"
    )
    packet = json.loads(evidence_path.read_text(encoding="utf-8"))
    fixture = next(
        item
        for item in packet["fixtures"]
        if item["fixture_id"] == "synthetic-two-body-part-v1"
    )
    body_records = result.as_dict()["bodies"]
    assert result.geometry_hash == fixture["geometry_hash"]
    assert result.current_artifact.semantic_fingerprint == fixture[
        "semantic_fingerprint"
    ]
    assert len(body_records) == fixture["body_count"]
    assert [item["body_id"] for item in body_records] == fixture["body_ids"]
    assert [item["semantic_fingerprint"] for item in body_records] == fixture[
        "body_semantic_fingerprints"
    ]
