"""The evaluate step at its seam: specs in, a green/grey/red card out, the round untouched."""
from __future__ import annotations

import json

from conftest import DATA
from forge_sourcing.hashing import sha256

POOL = json.loads((DATA / "search" / "pool.json").read_text(encoding="utf-8"))


def _rules():
    from forge_search.rules import load_rules
    return load_rules(DATA / "search" / "rules.DRAFT.json")


def _spec(field, value, unit, quote="q", doc="a" * 64):
    from forge_search.verify import Spec
    return Spec(field, value, unit, quote, 0, len(quote), doc)


def _round(service, state, ship_to="US-bench"):
    r = service.open_round(state, ship_to=ship_to, quantity=1, transport_mode="air", request_key="ev", opened_at="2026-09-06T02:00:00Z")
    rid = r["round_id"]
    service.resolve(rid); service.screen(rid); service.cost(rid, entry_date="2026-09-06")
    return service.rounds[rid]


def _cand(slot, mpn):
    return next(c for c in POOL["slots"][slot]["candidates"] if c["mpn"] == mpn)


def test_lepton_after_boson_is_green_and_the_round_is_untouched(service, f3_state):
    from forge_search.evaluate import CLAIM_CEILING, HONESTY_NOTE, evaluate_candidate
    rnd = _round(service, f3_state)
    line = next(l for l in rnd["lines"] if l["node_id"] == "thermal_core")
    before = sha256({k: v for k, v in rnd.items() if k != "proposals"})
    ev = evaluate_candidate(service, rnd, line, POOL["slots"]["thermal_core"], _cand("thermal_core", "500-0771-01"),
                            specs=[_spec("frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), _spec("resolution_w", "160", "elements", "160 x 120 pixels"),
                                   _spec("resolution_h", "120", "elements", "120 pixels")], rules=_rules(), tripped=["6A003.b.4.b"])
    assert ev["status"] == "green" and ev["flip"]["gone"] is True
    assert ev["screening"]["status"] == "no_candidate_match" and ev["screening"]["depth_tier"] == "full_walk"
    assert ev["estimate"]["domestic"] is True and ev["estimate"]["per_unit_landed_usd"] == "239.00"
    assert any("6A003.b.4.b: no fire" in w for w in ev["words"]) and any("release: 6A993.a" in w for w in ev["words"])
    assert any("ACCEPTED" in w and "8.7 Hz" in w for w in ev["words"]) and ev["event_kind"] == "compared-and-confirmed"
    assert HONESTY_NOTE in ev["words"] and CLAIM_CEILING in ev["words"] and any("approved-manufacturer match" in w for w in ev["words"])
    assert sha256({k: v for k, v in rnd.items() if k != "proposals"}) == before


def test_icm_after_hg5700_is_grey_because_the_field_is_not_published(service, f4_state):
    from forge_search.evaluate import evaluate_candidate
    rnd = _round(service, f4_state)
    line = next(l for l in rnd["lines"] if l["node_id"] == "imu")
    ev = evaluate_candidate(service, rnd, line, POOL["slots"]["imu"], _cand("imu", "ICM-42688-P"),
                            specs=[_spec("gyro_rate_range_deg_s", "2000", "deg/s")], rules=_rules(), tripped=["7A002.a.1.a", "7A102.a", "7A003.d.1"])
    assert ev["status"] == "grey" and any("cannot fire" in r for r in ev["reasons"]) and ev["flip"]["gone"] is False
    assert ev["screening"]["status"] == "no_candidate_match"                        # TDK InvenSense → TDK Corporation → terminal


def test_imu_ng_is_red_on_the_usml_row_and_gx220_truth_is_red_on_the_tripped_row(service, f4_state):
    from forge_search.evaluate import evaluate_candidate
    rnd = _round(service, f4_state)
    line = next(l for l in rnd["lines"] if l["node_id"] == "imu")
    ng = evaluate_candidate(service, rnd, line, POOL["slots"]["imu"], _cand("imu", "IMU-NG"),
                            specs=[_spec("gyro_rate_range_deg_s", "400", "deg/s"), _spec("gyro_arw_deg_sqrt_h", "0.0008", "deg/sqrt(h)")], rules=_rules(), tripped=["7A002.a.1.a", "7A003.d.1"])
    assert ng["status"] == "red" and any("XII(e)(12)(i)" in r for r in ng["reasons"]) and ng["fit"]["failed"]
    gx = evaluate_candidate(service, rnd, line, POOL["slots"]["imu"], _cand("imu", "GX-220"),
                            specs=[_spec("gyro_rate_range_deg_s", "300", "deg/s"), _spec("gyro_bias_stability_1mo_deg_h", "0.3", "deg/h")], rules=_rules(), tripped=["7A002.a.1.a", "7A003.d.1"])
    assert gx["status"] == "red" and "7A002.a.1.a" in gx["flip"]["still"] and gx["screening"]["status"] == "review_required"
    assert any("SYNTHETIC" in w for w in gx["words"])


def test_molicel_after_sicore_is_grey_on_the_unverified_rate(service, f11_state):
    from forge_search.evaluate import evaluate_candidate
    rnd = _round(service, f11_state)
    line = next(l for l in rnd["lines"] if l["node_id"] == "battery_cells")
    ev = evaluate_candidate(service, rnd, line, POOL["slots"]["battery_cells"], _cand("battery_cells", "INR-21700-P45B"),
                            specs=[_spec("energy_density_wh_kg", "242", "Wh/kg")], rules=_rules(), tripped=["3A001.e.1.b"])
    assert ev["status"] == "grey" and ev["flip"]["gone"] is True and any("rate not verified" in r for r in ev["reasons"])
    assert ev["estimate"]["verified"] is False and ev["screening"]["status"] == "no_candidate_match"


def test_no_specs_is_grey_with_no_accepted_span(service, f3_state):
    from forge_search.evaluate import evaluate_candidate
    rnd = _round(service, f3_state)
    line = next(l for l in rnd["lines"] if l["node_id"] == "thermal_core")
    ev = evaluate_candidate(service, rnd, line, POOL["slots"]["thermal_core"], _cand("thermal_core", "500-0771-01"), specs=[], rules=_rules(), tripped=["6A003.b.4.b"])
    assert ev["status"] == "grey" and any("no accepted span" in r for r in ev["reasons"])


def test_rank_puts_green_first_by_screening_then_landed_cost():
    from forge_search.evaluate import rank
    evs = [
        {"mpn": "b", "status": "green", "screening": {"status": "no_candidate_match"}, "estimate": {"per_unit_landed_usd": "10.00"}},
        {"mpn": "a", "status": "green", "screening": {"status": "no_candidate_match"}, "estimate": {"per_unit_landed_usd": "9.00"}},
        {"mpn": "g", "status": "grey", "screening": {"status": "review_required"}, "estimate": {"per_unit_landed_usd": None}},
        {"mpn": "r", "status": "red", "screening": {"status": "review_blocked"}, "estimate": {"per_unit_landed_usd": "1.00"}},
    ]
    out = rank(evs)
    assert [e["mpn"] for e in out["ranked"]] == ["a", "b"] and [e["mpn"] for e in out["needs_input"]] == ["g"] and [e["mpn"] for e in out["rejected"]] == ["r"]
