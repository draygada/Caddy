"""The fact snapshot: what one part revision asserts, and how strongly."""
from forge_classification.snapshot import snapshot

PART_REVISION = {
    "protocol_version": "forge.part-revision/1",
    "part_document": {
        "schema_version": "forge.part-document/1",
        "document_id": "part:fc-board",
        "geometry_hash": "0" * 64,
        "revision": {
            "revision_id": "rev:" + "1" * 64, "revision_hash": "1" * 64, "parent_revision_ids": [],
            "actor_id": "actor:diego", "intent": "Flight-controller board for the Kestrel survey drone",
            "authorization_ref": None,
        },
        "units": {"length": "mm", "angle": "deg"},
        "parameters": {
            "param:board_width": {"parameter_id": "param:board_width", "name": "board_width",
                                  "value_type": "LENGTH", "literal": "40", "expression": None},
            "param:half": {"parameter_id": "param:half", "name": "half", "value_type": "LENGTH",
                           "literal": None, "expression": {"kind": "PARAMETER", "parameter_id": "param:board_width"}},
        },
        "bodies": [{
            "body_id": "body:pcb", "name": "PCB", "root_operation_id": "op:x",
            "root_semantic_reference_id": "ref:x", "default_visibility": True,
            "metadata": {"layout_target": "civil_uav"},
            "material_mass": {"material_ref": None, "density_kg_per_mm3": None, "mass_override_kg": None},
            "bom_identity": {"part_number": "FC-001", "revision": "A", "description": "Flight controller", "unit": "EA"},
        }],
        "operations": [], "semantic_references": {},
    },
    "revision_hash": "1" * 64, "geometry_hash": "0" * 64, "kernel_result": None, "artifacts": [],
    "provenance": {"parent_revision_ids": [], "actor_id": "actor:diego", "authorization_ref": None,
                   "engine_manifest_hash": "2" * 64},
}


def _declared(actor_type, level, facts, artifact_refs=()):
    return {
        "schema_version": "forge.record/1", "record_kind": "compliance.declared-facts.v1",
        "record_id": "declared:fc-board:1", "authority_domain": "compliance",
        "actor": {"actor_id": "actor:charlie", "actor_type": actor_type, "alias": "founder"},
        "source_confidence": {"level": level, "basis": "test", "observed_at": "2026-09-05T20:00:00Z"},
        "provenance": {"adapter_id": "forge-native", "adapter_version": "1", "tool_identity": "forge@test",
                       "input_record_refs": [], "artifact_refs": list(artifact_refs), "generated_at": "2026-09-05T20:00:00Z"},
        "payload": {"part_revision_id": "rev:" + "1" * 64, "facts": facts},
    }


def test_parameters_and_metadata_become_asserted_facts_and_expressions_are_skipped():
    snap = snapshot(PART_REVISION, [], item_kind="commodity")
    assert snap.facts["param.board_width"].value == "40"
    assert snap.facts["param.board_width"].unit == "mm"
    assert snap.facts["param.board_width"].evidence_grade == "asserted"
    assert "param.half" not in snap.facts
    assert snap.facts["body.pcb.layout_target"].value == "civil_uav"
    assert snap.facts["bom.part_number"].value == "FC-001"
    assert snap.item_kind == "commodity"
    assert snap.part_revision_id == "rev:" + "1" * 64
    assert "Flight-controller board" in snap.introduction


def test_human_declared_facts_are_attested_and_measured_facts_are_verified():
    human = _declared("HUMAN", "DECLARED", [{"path": "declared.military_use", "value": "false", "unit": None}])
    measured = _declared("HUMAN", "MEASURED",
                         [{"path": "spec.gyro_bias_stability_1mo", "value": "0.01", "unit": "deg/h"}],
                         artifact_refs=[{"artifact_id": "artifact:" + "a" * 64}])
    snap = snapshot(PART_REVISION, [human, measured], item_kind="commodity")
    assert snap.facts["declared.military_use"].evidence_grade == "attested"
    assert snap.facts["spec.gyro_bias_stability_1mo"].evidence_grade == "verified"


def test_measured_without_an_artifact_reference_is_only_asserted():
    bare = _declared("HUMAN", "MEASURED", [{"path": "spec.frame_rate", "value": "60", "unit": "Hz"}])
    snap = snapshot(PART_REVISION, [bare], item_kind="commodity")
    assert snap.facts["spec.frame_rate"].evidence_grade == "asserted"


def test_agent_declared_facts_are_asserted_not_attested():
    agent = _declared("AGENT", "DECLARED", [{"path": "declared.mass_market", "value": "true", "unit": None}])
    snap = snapshot(PART_REVISION, [agent], item_kind="software")
    assert snap.facts["declared.mass_market"].evidence_grade == "asserted"


def test_explicit_unknown_is_recorded_never_folded():
    human = _declared("HUMAN", "DECLARED", [{"path": "declared.used_on", "value": "unknown", "unit": None}])
    snap = snapshot(PART_REVISION, [human], item_kind="commodity")
    fact = snap.facts["declared.used_on"]
    assert fact.recorded_unknown is True
    assert fact.value == "unknown"
    assert "declared.used_on" not in snap.known_paths()


def test_stronger_evidence_wins_when_the_same_path_is_declared_twice():
    asserted = _declared("AGENT", "DECLARED", [{"path": "spec.frame_rate", "value": "9", "unit": "Hz"}])
    attested = _declared("HUMAN", "DECLARED", [{"path": "spec.frame_rate", "value": "60", "unit": "Hz"}])
    snap = snapshot(PART_REVISION, [attested, asserted], item_kind="commodity")
    assert snap.facts["spec.frame_rate"].value == "60"
    assert snap.facts["spec.frame_rate"].evidence_grade == "attested"


def test_snapshot_hash_is_stable_and_changes_with_facts():
    a = snapshot(PART_REVISION, [], item_kind="commodity")
    b = snapshot(PART_REVISION, [], item_kind="commodity")
    c = snapshot(PART_REVISION, [_declared("HUMAN", "DECLARED", [{"path": "declared.bvlos", "value": "true", "unit": None}])],
                 item_kind="commodity")
    assert a.sha256 == b.sha256 and len(a.sha256) == 64
    assert a.sha256 != c.sha256
    assert snapshot(PART_REVISION, [], item_kind="software").sha256 != a.sha256
