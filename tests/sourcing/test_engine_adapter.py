"""The Wave-0 evaluate response (features/tripwire, main @ 8bc2c01) → the sourcing lane's open_round input, with no float anywhere."""
from __future__ import annotations

import json

import pytest

from conftest import DATA

ENGINE = DATA / "search" / "engine"


def _load(name):
    return json.loads((ENGINE / name).read_text(encoding="utf-8"))


def test_camera_flag_response_becomes_open_round_input(service):
    from forge_sourcing.hashing import sha256
    from forge_sourcing_api.engine_adapter import design_for_round
    design, resp = _load("kestrel-baseline.design.json"), _load("evaluate-camera-flag.json")
    d = design_for_round(design, resp, design_seq=3, quantities={"motor": 4})
    sha256(d)                                                                     # floats refused: raises if any slipped through
    assert d["design_hash"] == resp["design_revision"][len("sha256:"):] and len(d["design_hash"]) == 64 and d["design_seq"] == 3
    assert d["product"]["node_id"] == "kestrel" and d["product"]["engine"]["rule_pack_sha"] == "sha256:ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f"
    assert d["product"]["engine"]["rule_pack_status"] == "unapproved_input" and d["product"]["engine"]["canonical_sha256_check"] in ("matched", "differs")
    nodes = {n["node_id"]: n for n in d["nodes"]}
    assert set(nodes) == {"wing", "motor", "prop", "fc_board", "fc_mcu", "io_mcu", "imu", "baro", "mag", "gnss", "battery_pack", "nose_thermal", "datalink"}
    th = nodes["nose_thermal"]["evaluation"]
    assert th["entries"] == ["6A003.b.4.b"] and th["fired"] == ["6A003.b.4.b"] and th["engine_state"] == "flag" and th["jurisdiction"] == "EAR"
    assert th["destinations"] == {} and th["destinations_note"] == "not_evaluated: P0 has no approved destination policy" and th["unresolved"] == []
    motor = nodes["motor"]
    assert motor["quantity_per"] == 4 and motor["value_usd"] is None and motor["manufacturer"] == "Synthetic Fixture Works"
    assert motor["evaluation"]["engine_state"] == "absent" and motor["evaluation"]["fired"] == [] and motor["evaluation"]["entries"] == []
    r = service.open_round(d, ship_to="TW-assembly", quantity=1, transport_mode="air", request_key="engine", opened_at="2026-09-06T03:00:00Z")
    assert r["design_hash"] == d["design_hash"] and len(r["lines"]) == 13
    service.resolve(r["round_id"])
    assert all(e["reason"] == "no_offer_match" for l in r["lines"] for e in l["escalations"])   # synthetic MPNs: no offer in the fixture, honestly
    gate = service.gate(r["round_id"])
    assert gate["applies"] and len(gate["blocked"]) == 13 and all("cannot gate" in w for l in r["lines"] for w in l["gate"]["words"])


def test_unresolved_tripwires_are_carried_and_a_declaration_cannot_pass_on_them(service):
    from forge_sourcing_api.engine_adapter import design_for_round
    design, resp = _load("kestrel-baseline.design.json"), _load("evaluate-missing-evidence.json")
    d = design_for_round(design, resp, design_seq=4)
    th = next(n for n in d["nodes"] if n["node_id"] == "nose_thermal")["evaluation"]
    assert th["engine_state"] == "question" and th["entries"] == [] and th["fired"] == []
    assert th["unresolved"] == [{"rule_id": "CCL-6A003.b.4.b", "entry": "6A003.b.4.b", "problem": "missing_fact",
                                 "missing": ["fpa_entry", "note_3_b_exclusion_applies", "note_3_c_exclusion_applies"]}]
    r = service.open_round(d, ship_to="TW-assembly", quantity=1, transport_mode="air", request_key="engine-q", opened_at="2026-09-06T03:00:00Z")
    decl = service.declare(r["round_id"], party="assembler", person_status="foreign_person", sharing="controlled_drawings", reference="LIC-000", attestor="charlie")
    assert decl["required_reference_kind"] == "unknown_classification" and decl["blocked"] is True
    assert any("classification not established" in w for w in decl["words"])


def test_the_848_row_becomes_the_amber_flag_and_a_bad_revision_is_refused():
    from forge_sourcing_api.engine_adapter import FLAG_848, design_for_round
    design, resp = _load("kestrel-baseline.design.json"), _load("evaluate-camera-flag.json")
    resp = json.loads(json.dumps(resp))
    resp["determinations"]["motor"] = {"state": "watch", "jurisdiction": "EAR", "entries": ["EAR99"], "propagated_tripwires": [], "unresolved_tripwires": [],
                                       "destinations": {"status": "not_evaluated", "reason": "P0"}, "evidence_level": "declared",
                                       "direct_tripwires": [{"rule_id": FLAG_848, "state": "fired", "jurisdiction": "EAR", "entry": "NO_EXPORT_CONTROL_CHANGE", "reason_for_control": [],
                                                             "node_id": "motor", "cause_node_id": "motor", "facts": [], "text": None, "source_url": None, "ecfr_date": None, "rule_effective": None, "evidence": None}]}
    motor = next(n for n in design_for_round(design, resp, design_seq=5)["nodes"] if n["node_id"] == "motor")["evaluation"]
    assert motor["flags"] == ["848_amber"] and motor["fired"] == [] and "848_amber" in motor["flag_text"]
    with pytest.raises(ValueError):
        design_for_round(design, {**resp, "design_revision": "nope"}, design_seq=6)
