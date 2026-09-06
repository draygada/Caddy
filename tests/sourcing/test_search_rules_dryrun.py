"""The draft rows as data; the single-node dry-run; the flip-gone decision."""
from __future__ import annotations

from conftest import DATA

RULES = DATA / "search" / "rules.DRAFT.json"


def _rules():
    from forge_search.rules import load_rules
    return load_rules(RULES)


def test_rules_load_with_decimal_string_thresholds_and_the_sha():
    from forge_search.rules import atoms, rows_by_entry
    rules = _rules()
    assert rules["sha256"] == "ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f" and len(rules["rows"]) == 40
    row = rows_by_entry(rules)["7A002.a.1.a"]
    thresholds = {a["attr"]: a["threshold"] for a in atoms(row["when"]) if "attr" in a}
    assert thresholds == {"gyro_rate_range_deg_s": "500", "gyro_bias_stability_1mo_deg_h": "0.5"}
    assert rules["status"].startswith("DRAFT")


def test_fields_for_a_slot_come_from_the_rows_that_apply():
    from forge_search.rules import fields_for, release_texts, rule_sentences
    rules = _rules()
    assert fields_for(rules, "thermal_imager", "sensor") == {"frame_rate_hz": "Hz", "elements": "elements", "resolution_w": "elements", "resolution_h": "elements"}
    nav = fields_for(rules, "sensor", "nav")
    assert {"gyro_rate_range_deg_s": "deg/s", "gyro_bias_stability_1mo_deg_h": "deg/h", "gyro_arw_deg_sqrt_h": "deg/sqrt(h)"}.items() <= nav.items()
    assert fields_for(rules, "cell", "power") == {"energy_density_wh_kg": "Wh/kg"}
    assert any("equal to or less than 9 Hz" in t for t in release_texts(rules, "thermal_imager", "sensor"))
    assert "focal plane arrays" in rule_sentences(rules, "thermal_imager", "sensor")["frame_rate_hz"]      # the first row naming the field


def _f(**kv):
    return {k: {"value": v[0], "unit": v[1]} for k, v in kv.items()}


def test_dry_run_lepton_after_boson_releases_and_does_not_fire():
    from forge_search.dryrun import dry_run, flip_gone
    rules = _rules()
    dr = dry_run(rules, part_class="thermal_imager", role="sensor", fields=_f(frame_rate_hz=("8.7", "Hz"), resolution_w=("160", "elements"), resolution_h=("120", "elements")), declared={"origin": "US"})
    assert [f["entry"] for f in dr["fired"]] == []
    assert [r["entry"] for r in dr["released"]] == ["6A993.a"]
    assert any(r["entry"] == "6A003.b.4.b (RS1)" for r in dr["not_fired"])              # elements derived: 19200, not > 111000
    assert all(not c["missing"] or all(m.startswith("declared.") for m in c["missing"]) for c in dr["cannot_fire"])
    gone = flip_gone(["6A003.b.4.b"], ["6A993.a"], dr, rules)
    assert gone["gone"] is True and gone["reasons"] == ["6A003.b.4.b: no fire"]


def test_dry_run_icm_cannot_fire_because_the_field_is_not_published():
    from forge_search.dryrun import dry_run, flip_gone
    rules = _rules()
    dr = dry_run(rules, part_class="sensor", role="nav", fields=_f(gyro_rate_range_deg_s=("2000", "deg/s")),
                 declared={"origin": "US", "adaptive_antenna": False, "pps_decryption": False, "civil_gnss_service": False, "spinning_mass": False})
    cannot = {c["entry"]: c["missing"] for c in dr["cannot_fire"]}
    assert cannot["7A002.a.1.a"] == ["gyro_bias_stability_1mo_deg_h"] and dr["fired"] == []
    gone = flip_gone(["7A002.a.1.a", "7A102.a", "7A003.d.1"], ["7A003.d.1"], dr, rules)
    assert gone["gone"] is False and "7A002.a.1.a" in gone["cannot"] and "7A102.a" in gone["unknown"]
    assert any("cannot fire" in r and "gyro_bias_stability_1mo_deg_h" in r for r in gone["reasons"])
    assert any(r.startswith("7A102.a: no draft row") for r in gone["reasons"])


def test_dry_run_gx220_truthful_fires_and_imu_ng_hits_the_usml_row():
    from forge_search.dryrun import dry_run, flip_gone
    rules = _rules()
    gx = dry_run(rules, part_class="sensor", role="nav", fields=_f(gyro_rate_range_deg_s=("300", "deg/s"), gyro_bias_stability_1mo_deg_h=("0.3", "deg/h"), gyro_arw_deg_sqrt_h=("0.02", "deg/sqrt(h)")),
                 declared={"origin": "US", "adaptive_antenna": False, "pps_decryption": False, "civil_gnss_service": False, "spinning_mass": False})
    assert {f["entry"] for f in gx["fired"]} >= {"7A002.a.1.a", "7A003.d.1"}
    assert flip_gone(["7A002.a.1.a", "7A003.d.1"], ["7A003.d.1"], gx, rules)["still"] == ["7A002.a.1.a", "7A003.d.1"]
    ng = dry_run(rules, part_class="sensor", role="nav", fields=_f(gyro_rate_range_deg_s=("400", "deg/s"), gyro_arw_deg_sqrt_h=("0.0008", "deg/sqrt(h)")),
                 declared={"origin": "NO", "adaptive_antenna": False, "pps_decryption": False, "civil_gnss_service": False, "spinning_mass": False})
    fired = {f["entry"]: f["jurisdiction"] for f in ng["fired"]}
    assert fired["XII(e)(12)(i)"] == "ITAR" and "7A002.a.1.b" in fired
    gone = flip_gone(["7A002.a.1.a", "7A003.d.1"], ["7A003.d.1"], ng, rules)
    assert "XII(e)(12)(i)" in gone["new"] and gone["gone"] is False


def test_dry_run_molicel_does_not_trip_the_cell_row_and_tree_rows_are_not_evaluated():
    from forge_search.dryrun import dry_run
    rules = _rules()
    dr = dry_run(rules, part_class="cell", role="power", fields=_f(energy_density_wh_kg=("242", "Wh/kg")), declared={"origin": "TW"})
    assert dr["fired"] == [] and any(r["entry"] == "3A001.e.1.b" for r in dr["not_fired"])
    assert any(n["entry"] == "120.41(a)(2)" for n in dr["not_evaluated"])


def test_a_true_not_guard_suppresses_the_row_and_a_false_or_missing_guard_never_does():
    """P-C: 7A002.a.1.b carries `not: [declared spinning_mass == true]`. Declared true → suppressed, and the Note releases; declared
    false, or not declared at all → the row proceeds exactly as before (fail-closed: a missing guard fact never suppresses). A held
    guard beats a tree atom too: the 120.41(a)(2) catch-all on a fastener is suppressed, not deferred."""
    from forge_search.dryrun import dry_run, flip_gone
    rules = _rules()
    fields = _f(gyro_rate_range_deg_s=("400", "deg/s"), gyro_arw_deg_sqrt_h=("0.0008", "deg/sqrt(h)"))
    base = {"origin": "NO", "adaptive_antenna": False, "pps_decryption": False, "civil_gnss_service": False}
    held = dry_run(rules, part_class="sensor", role="nav", fields=fields, declared={**base, "spinning_mass": True})
    row = next(r for r in held["not_fired"] if r["rule_id"] == "CCL-7A002.a.1.b")
    assert row["detail"] == "suppressed by declared.spinning_mass = True" and "7A002.a.1.b" not in [f["entry"] for f in held["fired"]]
    assert "RELEASE-7A002.a.1.b-spinning-mass" in [r["rule_id"] for r in held["released"]]
    gone = flip_gone(["7A002.a.1.b"], ["7A002.a.1.b", "XII(e)(12)(i)"], held, rules)
    assert gone["gone"] is True and gone["reasons"] == ["7A002.a.1.b: no fire"]                     # a suppressed row is gone, not a cannot
    for declared in ({**base, "spinning_mass": False}, base):
        dr = dry_run(rules, part_class="sensor", role="nav", fields=fields, declared=declared)
        assert "7A002.a.1.b" in [f["entry"] for f in dr["fired"]] and not any("detail" in r for r in dr["not_fired"]), declared
    catch = dry_run(rules, part_class="fastener", role=None, fields={}, declared={})
    assert next(r for r in catch["not_fired"] if r["rule_id"] == "USML-120.41(a)(2)-catch")["detail"] == "suppressed by part_class fastener"
    deferred = [n["rule_id"] for n in catch["not_evaluated"]]
    assert "USML-120.41(a)(2)-catch" not in deferred and "RELEASE-120.41(b)(2)-commodity-list" in deferred


A = {"declared": "spinning_mass", "equals": True}
B = {"declared": "civil_automobile_or_railway", "equals": True}


def _synthetic(guard: dict | list) -> dict:
    """One synthetic row that fires on frame_rate_hz > 9, carrying the given `not` clause. The DRAFT pack's six guards are all bare
    lists of single atoms, so the conjunctive reading has no row to pin yet — and the pack is DRAFT."""
    return {"sha256": "synthetic", "rows": [{"id": "CCL-SYNTH", "entry": "SYNTH.a", "text": "a synthetic row",
                                             "when": {"all": [{"attr": "frame_rate_hz", "op": ">", "threshold": "9", "unit": "Hz"}], "not": guard}}]}


def test_a_conjunctive_not_guard_suppresses_only_when_every_one_of_its_atoms_holds():
    """A `not` operand keyed `all` reads as ONE guard — the DSL says suppress when BOTH hold — never as two independent guards,
    which would suppress on either and be fail-open. An operand keyed `any` still suppresses on any one; an atom nobody declared
    never lets a conjunctive guard hold (fail-closed, as for a single atom)."""
    from forge_search.dryrun import dry_run
    fields = _f(frame_rate_hz=("60", "Hz"))

    def run(guard, declared):
        return dry_run(_synthetic(guard), part_class="thermal_imager", role="sensor", fields=fields, declared=declared)

    both = run({"all": [A, B]}, {"spinning_mass": True, "civil_automobile_or_railway": True})
    assert both["fired"] == [] and both["not_fired"][0]["detail"] == "suppressed by declared.spinning_mass = True and declared.civil_automobile_or_railway = True"
    for declared in ({"spinning_mass": True, "civil_automobile_or_railway": False}, {"spinning_mass": True}):
        one = run({"all": [A, B]}, declared)                             # only A holds — the row fires; B false or never declared alike
        assert [r["entry"] for r in one["fired"]] == ["SYNTH.a"] and one["not_fired"] == [], declared
    either = run({"any": [A, B]}, {"spinning_mass": True})
    assert either["fired"] == [] and either["not_fired"][0]["detail"] == "suppressed by declared.spinning_mass = True"
