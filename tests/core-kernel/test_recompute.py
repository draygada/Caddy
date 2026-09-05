from __future__ import annotations

import json
from pathlib import Path

from strafe_forge_core.artifacts import ArtifactPointer, GeometryArtifact
from strafe_forge_core.scalars import canonical_decimal
from strafe_forge_core.topology import (
    deserialize_brep,
    exact_bounds,
    mass_properties,
    shape_is_valid,
    topology_counts,
)
from strafe_forge_core.viewport import tessellate_part

from kernel_cases import bracket_program, engine


def golden_fixture(fixture_id: str) -> tuple[dict[str, object], dict[str, object]]:
    path = (
        Path(__file__).parents[2]
        / "packages/core-kernel/evidence/golden-fixtures.v1.json"
    )
    packet = json.loads(path.read_text(encoding="utf-8"))
    fixture = next(
        item for item in packet["fixtures"] if item["fixture_id"] == fixture_id
    )
    return packet, fixture


def test_real_bracket_spine_and_semantic_selection() -> None:
    result = engine().recompute(bracket_program())
    packet, fixture = golden_fixture("synthetic-bracket-v1")
    assert result.status == "SUCCEEDED"
    assert result.engine_manifest_hash == packet["engine_manifest_hash"]
    assert result.geometry_hash == fixture["geometry_hash"]
    assert [item.state for item in result.transitions] == ["QUEUED", "RUNNING", "SUCCEEDED"]
    assert [item.status for item in result.operation_results] == [
        "SUCCEEDED",
        "SUCCEEDED",
        "SUCCEEDED",
    ]
    assert result.current_artifact is not None
    assert result.current_artifact.semantic_fingerprint == fixture["semantic_fingerprint"]
    assert [item.operation_hash for item in result.operation_results] == fixture[
        "operation_hashes"
    ]
    shape = deserialize_brep(result.current_artifact.content)
    assert shape_is_valid(shape)
    counts = topology_counts(shape)
    assert counts["SOLID"] == 1
    assert counts["FACE"] > 6
    area, volume = mass_properties(shape)
    assert area > 0
    assert 3900 < volume < 4000
    bounds = exact_bounds(shape)
    assert {
        "min": [canonical_decimal(value) for value in bounds[:3]],
        "max": [canonical_decimal(value) for value in bounds[3:]],
    } == fixture["bounds_mm"]
    assert {
        "area_mm2": canonical_decimal(area),
        "volume_mm3": canonical_decimal(volume),
    } == fixture["mass_properties"]
    assert counts == fixture["topology_counts"]
    resolution = result.semantic_resolutions[0]
    assert resolution.status == "EXACT"
    assert resolution.matched_entity_count == 1
    assert resolution.entity_id is not None
    assert resolution.lineage
    assert resolution.lineage[0].event == "GENERATED"
    assert resolution.lineage[0].source_reference_id is not None
    assert {
        "reference_id": resolution.reference_id,
        "entity_id": resolution.entity_id,
        "status": resolution.status,
        "lineage_event": resolution.lineage[0].event,
    } == fixture["semantic_selection"]
    mesh = tessellate_part(result)
    assert mesh.indices
    assert mesh.source_artifact_id == result.current_artifact.artifact_id
    assert mesh.source_revision_id == result.attempted_revision_id
    assert mesh.as_dict()["entity_ranges"]
    assert len(mesh.packet_hash) == 64
    assert mesh.packet_hash == fixture["viewport_packet_hash"]
    assert all(item.count % 3 == 0 for item in mesh.entity_ranges)
    assert not mesh.diagnostics


def test_parameter_edit_preserves_semantic_identity_but_changes_geometry() -> None:
    before = engine().recompute(bracket_program(width="40", revision_id="rev:before"))
    after = engine().recompute(bracket_program(width="48", revision_id="rev:after"))
    assert before.status == after.status == "SUCCEEDED"
    assert before.semantic_resolutions[0].entity_id == after.semantic_resolutions[0].entity_id
    assert before.current_artifact is not None and after.current_artifact is not None
    assert before.current_artifact.semantic_fingerprint != after.current_artifact.semantic_fingerprint
    assert before.geometry_hash != after.geometry_hash
    assert before.operation_results[1].operation_hash != after.operation_results[1].operation_hash


def test_failed_edit_blocks_dependent_and_preserves_revision_bound_last_valid() -> None:
    valid = engine().recompute(
        bracket_program(include_dependent=True, revision_id="rev:valid")
    )
    assert valid.status == "SUCCEEDED"
    assert valid.current_artifact is not None
    failed = engine().recompute(
        bracket_program(
            fillet_radius="100",
            include_dependent=True,
            revision_id="rev:invalid",
        ),
        last_valid=valid.current_artifact,
    )
    assert failed.status == "FAILED"
    assert failed.current_artifact is None
    assert failed.attempted_revision_id == "rev:invalid"
    statuses = {item.operation_id: item.status for item in failed.operation_results}
    assert statuses["op:fillet"] == "FAILED"
    assert statuses["op:dependent"] == "BLOCKED"
    assert failed.last_valid_artifact is not None
    assert failed.last_valid_artifact.producing_revision_id == "rev:valid"
    assert failed.last_valid_artifact.artifact_id == valid.current_artifact.artifact_id

    restarted = json.loads(json.dumps(failed.as_dict()))
    pointer = ArtifactPointer.from_dict(restarted["last_valid_artifact"])
    assert pointer == valid.current_artifact.pointer()
    restored = GeometryArtifact.from_dict(
        json.loads(json.dumps(valid.current_artifact.as_dict()))
    )
    assert restored.artifact_id == valid.current_artifact.artifact_id


def test_missing_reference_fails_consumer_and_blocks_downstream() -> None:
    result = engine().recompute(
        bracket_program(reference_role="rail:does-not-exist", include_dependent=True)
    )
    assert result.status == "FAILED"
    by_id = {item.operation_id: item for item in result.operation_results}
    assert by_id["op:fillet"].diagnostics[0].code == "SEMANTIC_REFERENCE_MISSING"
    assert by_id["op:dependent"].diagnostics[0].code == "DEPENDENCY_BLOCKED"
    assert result.semantic_resolutions[0].status == "MISSING"
