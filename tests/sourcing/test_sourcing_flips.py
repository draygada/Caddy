"""S1–S4 and the three no-change sourcing edits, at the service seam.

Expected words come from THE BUILD §2.8 and feature cards F-13…F-15, corrected where the
typed fixture data says otherwise (the fixture is the source of truth for counts; the spec
says counts are read off the screen, never off a table).
"""
from __future__ import annotations

from conftest import run_s1


def _line(view, node_id):
    return next(l for l in view["lines"] if l["node_id"] == node_id)


def _card(view, node_id, seller_display):
    line = _line(view, node_id)
    return next(c for c in line["offers"] if c["seller"]["display"] == seller_display)


def _layer(card, name):
    return next(l for l in card["estimate"]["ladder"] if l["layer"] == name)


def says(card, phrase):
    """A phrase appears somewhere in the words on the card."""
    return any(phrase in w for w in card["words"])


# ---------------------------------------------------------------- S1

def test_s1_source_the_baseline_resolves_every_line(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    assert view["status"] == "costed"
    assert "screening review" in view["headline"]
    assert len(view["lines"]) == len(baseline["nodes"])
    assert all(len(l["offers"]) >= 1 for l in view["lines"])
    assert f"{len(baseline['nodes'])} lines resolved" in view["headline"]
    for sha_name in ("offers", "ownership", "tariff", "csl"):
        assert view["fixtures"][sha_name]["sha256"]
        assert f"{sha_name}@{view['fixtures'][sha_name]['sha256'][:8]}" in view["headline"]


def test_s1_round_binds_the_design_state(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    assert view["design_hash"] == baseline["design_hash"]
    assert view["design_seq"] == baseline["design_seq"]
    assert view["ship_to"] == "US-bench"
    assert view["destination_country"] == "US"


def test_s1_unknown_ownership_is_a_review_flag_not_a_block(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    groupgets = _card(view, "thermal_core", "GroupGets")
    tmotor = _card(view, "motor", "T-Motor store")
    for card in (groupgets, tmotor):
        assert card["status"] == "review_required"
        assert says(card, "review required: ownership unknown")
        assert says(card, "unknown is a review flag, not a match")
    # the honest set under the typed ownership table: every tree with a party that has no row
    required = sorted({l["node_id"] for l in view["lines"] for c in l["offers"] if c["status"] == "review_required"})
    assert required == ["board", "imu", "motor", "passives_connectors", "propeller", "thermal_core"]
    clean = {l["node_id"] for l in view["lines"] if all(c["status"] == "no_candidate_match" for c in l["offers"])}
    assert {"battery_cells", "fc_mcu", "io_mcu", "baro_mag", "gnss", "datalink", "esc"} == clean


def test_s1_depth_tier_is_printed_and_risk_tiered(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    esc = _card(view, "esc", "KDE Direct")          # domestic, EAR99, commodity
    cells = _card(view, "battery_cells", "Molicel direct")  # foreign origin
    assert esc["party_tree"]["depth_tier"] == "seller_and_manufacturer"
    assert cells["party_tree"]["depth_tier"] == "full_walk"
    assert says(esc, "depth: seller_and_manufacturer") and says(cells, "depth: full_walk")


def test_s1_motor_card_carries_301_and_the_848_amber(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    tmotor = _card(view, "motor", "T-Motor store")
    l301 = _layer(tmotor, "Section 301")
    assert l301["citation"] == "9903.88.03" and l301["rate"] == "25 %" and l301["amount"] == "15.00"
    assert says(tmotor, "Section 301, List 3, 25 %, 9903.88.03")
    assert any("§848" in w and "amber" in w for w in tmotor["words"])
    assert "8501.51-.53" in " ".join(tmotor["words"])   # the heading fork is printed


def test_s1_cells_card_shows_the_mpf_minimum(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    cells = _card(view, "battery_cells", "Molicel direct")
    mpf = _layer(cells, "Merchandise processing fee")
    assert mpf["amount"] == "33.58" and mpf["note"] == "minimum applied"
    assert says(cells, "MPF $33.58 (minimum applied)")
    assert cells["estimate"]["entered_value"] == "288.00"
    tw = _layer(cells, "Country action")
    assert tw["rate"] == "10 %" and tw["amount"] == "28.80"
    assert _layer(cells, "Harbor maintenance fee")["note"] == "not applicable, air"
    assert _layer(cells, "Section 232")["note"].startswith("not in scope")
    assert any(l["layer"] == "Section 122" and "check current status" in l["note"] for l in cells["estimate"]["ladder"])
    assert cells["estimate"]["de_minimis"].startswith("de minimis: suspended for all origins since 2025-08-29")


def test_s1_domestic_purchase_has_no_entry(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    esc = _card(view, "esc", "KDE Direct")
    assert esc["estimate"]["domestic"] is True
    assert all(l["note"] == "not applicable" for l in esc["estimate"]["ladder"] if l["layer"] not in ("Total",))
    assert esc["estimate"]["note"] == "no entry"
    assert esc["estimate"]["per_unit_landed_usd"] == "95.00"


def test_s1_every_card_prints_its_claim_ceiling(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    for line in view["lines"]:
        for card in line["offers"]:
            assert card["claim_ceiling"] == ("Distributor-declared availability, price, classification and tariff code "
                                              "as of the fixture date. Not a quote, not a classification determination.")
            assert card["estimate"]["claim_ceiling"] == ("Estimate from declared tariff code and origin against a dated "
                                                          "tariff table. Not a customs determination.")
            assert card["screening"]["claim_ceiling"] == ("Review-only screening aid over a name match and a committed "
                                                           "ownership table, not a legal determination.")
            assert "not fuzzy" in card["screening"]["words"]


def test_s1_events_are_appended_in_order(service, baseline):
    rid = run_s1(service, baseline)
    kinds = [e["kind"] for e in service.thread.events if e.get("round_id") == rid]
    assert kinds[0] == "round_opened"
    assert kinds[1] == "offers_resolved"
    assert kinds.count("party_extracted") >= len(baseline["nodes"])
    assert kinds.count("screening_run") == kinds.count("party_extracted")
    assert "screening_rolled_up" in kinds
    assert kinds.count("cost_estimated") == sum(len(l["offers"]) for l in service.round_view(rid)["lines"])
    for e in service.thread.events:
        if e.get("round_id") == rid:
            assert e["design_hash"] == baseline["design_hash"]
            assert e["design_seq"] == baseline["design_seq"]
            assert e["actor_kind"] in ("human", "system")


def test_s1_open_round_is_idempotent(service, baseline):
    r1 = service.open_round(baseline, ship_to="US-bench", quantity=1, transport_mode="air",
                            request_key="demo-1", opened_at="2026-09-06T01:00:00Z")
    r2 = service.open_round(baseline, ship_to="US-bench", quantity=1, transport_mode="air",
                            request_key="demo-1", opened_at="2026-09-06T01:05:00Z")
    assert r1["round_id"] == r2["round_id"]
    assert sum(1 for e in service.thread.events if e["kind"] == "round_opened") == 1


# ---------------------------------------------------------------- S2

def test_s2_cheaper_motor_is_second_and_blocked(service, baseline):
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    assert [c["seller"]["display"] for c in motor["offers"]] == ["T-Motor store", "Brightwing Components"]
    tm, bw = motor["offers"]
    assert float(bw["unit_price_usd"]) < float(tm["unit_price_usd"])
    assert bw["status"] == "review_blocked" and bw["synthetic"] and says(bw, "SYNTHETIC seller")
    assert says(bw, "review blocked: owner SZ DJI Technology Co.")
    assert says(bw, "matched on the Consolidated Screening List") and says(bw, "60 % owner") and says(bw, "ownership row SYNTHETIC")
    joined = " ".join(bw["words"])
    assert "Non-SDN Chinese Military-Industrial Complex" in joined and "Entity List" in joined
    assert "via alternate name" in joined
    assert "match kind normalized" in bw["screening"]["words"] and "not fuzzy" in bw["screening"]["words"]
    assert tm["status"] == "review_required"
    assert service.round_view(rid)["affiliates_rule"].endswith("returns 10 November 2026")


def test_s2_select_records_the_declined_offer_with_its_reason_and_state(service, baseline):
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    tm, bw = motor["offers"]
    sel = service.select(rid, motor["line_id"], tm["offer_hash"],
                         declined=[{"offer_hash": bw["offer_hash"], "reason_code": "owner_screened"}], attestor="benji")
    d = sel["declined"][0]
    assert d["reason_code"] == "owner_screened" and d["status_at_decline"] == "review_blocked"
    assert d["classification_state_at_decline"] == {"jurisdiction": "EAR", "entries": ["EAR99"]}
    assert sel["attestor"] == "benji" and sel["predecessor"] is None
    ev = service.thread.of_kind("offer_selected", rid)[-1]
    assert ev["actor_kind"] == "human" and ev["attestor"] == "benji" and ev["declined"][0]["reason_code"] == "owner_screened"
    view = service.round_view(rid)
    assert view["status"] == "costed"                       # unchanged until every line is selected
    assert "cheaper offer declined · owner screened" in view["timeline"][-1]["words"]
    assert _line(view, "motor")["selection"]["offer_hash"] == tm["offer_hash"]


def test_s2_declined_reason_defaults_from_the_offer_status(service, baseline):
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    tm, bw = motor["offers"]
    sel = service.select(rid, motor["line_id"], tm["offer_hash"], declined=[{"offer_hash": bw["offer_hash"]}], attestor="benji")
    assert sel["declined"][0]["reason_code"] == "owner_screened"


def test_s2_select_refuses_a_review_blocked_offer(service, baseline):
    import pytest
    from forge_sourcing.select import SelectionRefused
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    tm, bw = motor["offers"]
    with pytest.raises(SelectionRefused, match="review blocked"):
        service.select(rid, motor["line_id"], bw["offer_hash"], declined=[{"offer_hash": tm["offer_hash"], "reason_code": "price"}], attestor="benji")
    assert not service.thread.of_kind("offer_selected", rid)


def test_s2_select_refuses_an_unknown_reason_code_and_a_missing_attestor(service, baseline):
    import pytest
    from forge_sourcing.select import SelectionRefused
    from forge_sourcing.thread import ThreadRefused
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    tm, bw = motor["offers"]
    with pytest.raises(SelectionRefused, match="reason_code"):
        service.select(rid, motor["line_id"], tm["offer_hash"], declined=[{"offer_hash": bw["offer_hash"], "reason_code": "meh"}], attestor="benji")
    with pytest.raises((SelectionRefused, ThreadRefused)):
        service.select(rid, motor["line_id"], tm["offer_hash"], declined=[{"offer_hash": bw["offer_hash"], "reason_code": "price"}], attestor=None)


def test_s2_reselection_appends_a_successor(service, baseline):
    rid = run_s1(service, baseline)
    thermal = _line(service.round_view(rid), "thermal_core")
    gg = thermal["offers"][0]
    first = service.select(rid, thermal["line_id"], gg["offer_hash"], declined=[], attestor="benji")
    second = service.select(rid, thermal["line_id"], gg["offer_hash"], declined=[], attestor="charlie")
    assert second["predecessor"] == first["selection_id"] and second["selection_id"] != first["selection_id"]
    assert len(service.thread.of_kind("offer_selected", rid)) == 2


def test_s2_round_confirms_when_every_line_is_selected(service, baseline):
    rid = run_s1(service, baseline)
    view = service.round_view(rid)
    for line in view["lines"]:
        chosen = next(c for c in line["offers"] if c["status"] != "review_blocked")
        declined = [{"offer_hash": c["offer_hash"]} for c in line["offers"] if c is not chosen]
        service.select(rid, line["line_id"], chosen["offer_hash"], declined=declined, attestor="benji")
    view = service.round_view(rid)
    assert view["status"] == "selection_confirmed" and view["status_label"] == "selected"


def test_s2_adjudication_roles_and_snapshot_binding(service, baseline):
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    bw = motor["offers"][1]
    dji = next(n for n in bw["party_tree"]["nodes"] if n["name"] == "SZ DJI Technology Co.")
    # an analyst can only lower the node to review required, pending counsel
    a = service.adjudicate(rid, bw["offer_hash"], dji["party_id"], role="analyst", disposition="false_positive",
                           reason_code="distinct_legal_entity", rationale="demo: different registration", attestor="analyst-1")
    assert a["list_snapshot_sha"] == bw["screening"]["list_snapshot_sha"]
    bw2 = _card(service.round_view(rid), "motor", "Brightwing Components")
    assert bw2["status"] == "review_required" and says(bw2, "pending counsel")
    # the empowered official escalates: pinned review blocked
    service.adjudicate(rid, bw["offer_hash"], dji["party_id"], role="empowered_official", disposition="escalate",
                       reason_code="unresolved_match", rationale="demo: escalate", attestor="eo-1")
    bw3 = _card(service.round_view(rid), "motor", "Brightwing Components")
    assert bw3["status"] == "review_blocked"
    ev = service.thread.of_kind("match_adjudicated", rid)
    assert [e["role"] for e in ev] == ["analyst", "empowered_official"] and all(e["actor_kind"] == "human" for e in ev)


def test_s2_adjudication_refuses_an_analyst_escalation_and_an_unknown_role(service, baseline):
    import pytest
    from forge_sourcing.select import AdjudicationRefused
    rid = run_s1(service, baseline)
    bw = _card(service.round_view(rid), "motor", "Brightwing Components")
    dji = next(n for n in bw["party_tree"]["nodes"] if n["name"] == "SZ DJI Technology Co.")
    with pytest.raises(AdjudicationRefused):
        service.adjudicate(rid, bw["offer_hash"], dji["party_id"], role="analyst", disposition="escalate",
                           reason_code="x", rationale="x", attestor="a")
    with pytest.raises(AdjudicationRefused):
        service.adjudicate(rid, bw["offer_hash"], dji["party_id"], role="intern", disposition="false_positive",
                           reason_code="x", rationale="x", attestor="a")


# ---------------------------------------------------------------- S3 (the Taiwan kit)

def _select_all(service, rid, attestor="benji"):
    view = service.round_view(rid)
    for line in view["lines"]:
        chosen = next(c for c in line["offers"] if c["status"] != "review_blocked")
        declined = [{"offer_hash": c["offer_hash"]} for c in line["offers"] if c is not chosen]
        service.select(rid, line["line_id"], chosen["offer_hash"], declined=declined, attestor=attestor)


def run_tw(service, design, request_key="tw-1"):
    r = service.open_round(design, ship_to="TW-assembly", quantity=1, transport_mode="air", request_key=request_key, opened_at="2026-09-06T02:00:00Z")
    rid = r["round_id"]
    service.resolve(rid); service.screen(rid); service.cost(rid, entry_date="2026-09-06")
    return rid


def test_s3_new_design_state_supersedes_the_old_round(service, baseline, f4_state):
    r1 = run_tw(service, baseline)
    r2 = run_tw(service, f4_state, request_key="tw-2")
    v1, v2 = service.round_view(r1), service.round_view(r2)
    assert v1["status"] == "superseded" and v1["superseded_by"] == r2
    assert v1["headline"].startswith("superseded by round") and "design state changed at seq 18" in v1["headline"]
    assert v2["supersedes"] == r1 and v2["design_hash"] == f4_state["design_hash"]


def test_s3_export_gate_is_the_engine_cell_verbatim(service, f4_state):
    rid = run_tw(service, f4_state)
    _select_all(service, rid)
    result = service.gate(rid)
    view = service.round_view(rid)
    imu, gnss = _line(view, "imu"), _line(view, "gnss")
    assert imu["gate"]["state"] == "LIC" and imu["gate"]["passes"] is False
    w = " ".join(imu["gate"]["words"])
    assert "export gate: LIC" in w and "STA barred, 740.20(b)(2)(iii)" in w and "package blocked until a licence reference is entered" in w
    assert gnss["gate"]["state"] == "NLR" and gnss["gate"]["passes"] is True and "passes" in gnss["gate"]["words"][0]
    assert result["blocked"] == ["line:imu: LIC"]
    assert view["status"] == "selection_confirmed"     # not gated while a line blocks
    kinds = [e["kind"] for e in service.thread.events if e.get("round_id") == rid]
    assert kinds.count("export_gate_evaluated") == len(view["lines"]) and "package_blocked" in kinds
    # every line prints the destination side as not modelled
    for line in view["lines"]:
        for c in line["offers"]:
            if c["estimate"]["domestic"]:
                assert c["seller"]["country"] == "TW" and says(c, "domestic purchase (TW): no entry")
            else:
                assert says(c, "Taiwan customs: not modelled") and says(c, "SHTC export permit")


def test_s3_typed_attested_reference_lifts_the_block_but_is_never_validated(service, f4_state):
    rid = run_tw(service, f4_state)
    _select_all(service, rid)
    service.gate(rid, references={"line:imu": {"reference": "D1234567 (DSP-5 placeholder)", "attestor": "charlie"}})
    view = service.round_view(rid)
    imu = _line(view, "imu")
    assert imu["gate"]["passes"] is True and imu["gate"]["reference"]["validated"] is False
    assert "reference typed, not validated" in " ".join(imu["gate"]["words"])
    assert view["status"] == "gated"


def test_s3_technical_data_declaration_three_line_rule(service, f4_state):
    rid = run_tw(service, f4_state)
    d = service.declare(rid, party="Taiwan assembler (Nitro)", person_status="foreign_person", sharing="controlled_drawings", reference=None, attestor="charlie")
    assert d["required_reference_kind"] == "ear_licence_or_exception" and d["blocked"] is True
    assert any("734.13" in w and "deemed export" in w for w in d["words"])
    assert any("not a deemed-export determination" in w for w in d["words"])
    d2 = service.declare(rid, party="Taiwan assembler (Nitro)", person_status="foreign_person", sharing="controlled_drawings", reference="ENC/TSU placeholder", attestor="charlie")
    assert d2["blocked"] is False and d2["validated"] is False and any("reference typed, not validated" in w for w in d2["words"])
    d3 = service.declare(rid, party="US contractor", person_status="us_person", sharing="controlled_drawings", reference=None, attestor="charlie")
    assert d3["required_reference_kind"] == "none" and d3["blocked"] is False
    ev = service.thread.of_kind("technical_data_declared", rid)
    assert len(ev) == 3 and all(e["actor_kind"] == "human" for e in ev)


# ---------------------------------------------------------------- S4 (re-derive and tamper)

def test_s4_rederive_covers_both_lanes_and_tamper_breaks_the_chain(service, baseline):
    rid = run_s1(service, baseline)
    motor = _line(service.round_view(rid), "motor")
    tm, bw = motor["offers"]
    service.select(rid, motor["line_id"], tm["offer_hash"], declined=[{"offer_hash": bw["offer_hash"], "reason_code": "owner_screened"}], attestor="benji")
    rep = service.rederive()
    n_est = sum(len(l["offers"]) for l in service.round_view(rid)["lines"])
    assert rep["chain_intact"] and rep["estimates_recomputed"] == n_est == rep["estimates_equal"]
    assert rep["screenings_recomputed"] > 0 and rep["screenings_recomputed"] == rep["screenings_equal"]
    assert rep["line"].startswith(f"{rep['events']} events · chain intact")
    assert f"{n_est} estimates recomputed, {n_est} hashes equal" in rep["line"]
    sel_event = service.thread.of_kind("offer_selected", rid)[-1]
    service.tamper(sel_event["seq"], "declined.0.reason_code", "price")
    rep2 = service.rederive()
    assert rep2["chain_intact"] is False and rep2["break_at"] == sel_event["seq"]
    assert rep2["line"].startswith(f"BREAK at #{sel_event['seq']} (offer_selected)")


# ---------------------------------------------------------------- the three no-change sourcing edits

def test_nochange_quantity_1_to_2_recomputes_estimates_but_no_status(service, baseline):
    rid = run_s1(service, baseline)
    before = service.round_view(rid)
    rep = service.refine(rid, quantity=2)
    after = service.round_view(rid)
    n = sum(len(l["offers"]) for l in after["lines"])
    assert rep["estimates_recomputed"] == n and rep["status_changes"] == 0
    for lb, la in zip(before["lines"], after["lines"]):
        for cb, ca in zip(sorted(lb["offers"], key=lambda c: c["offer_hash"]), sorted(la["offers"], key=lambda c: c["offer_hash"])):
            assert cb["status"] == ca["status"]
    cells = _card(after, "battery_cells", "Molicel direct")
    assert cells["estimate"]["entered_value"] == "576.00"
    mpf = _layer(cells, "Merchandise processing fee")
    assert mpf["amount"] == "33.58" and mpf["note"] == "minimum applied"   # $576 × 0.3464 % = $2.00, still under the minimum
    assert _layer(cells, "Country action")["amount"] == "57.60"
    assert rep["words"].startswith(f"re-evaluated {n} estimates · 0 status changes")


def test_nochange_air_to_ocean_adds_only_the_hmf_layer(service, baseline):
    rid = run_s1(service, baseline)
    before = _card(service.round_view(rid), "battery_cells", "Molicel direct")["estimate"]
    service.refine(rid, transport_mode="ocean")
    after = _card(service.round_view(rid), "battery_cells", "Molicel direct")["estimate"]
    hmf_b = next(l for l in before["ladder"] if l["layer"] == "Harbor maintenance fee")
    hmf_a = next(l for l in after["ladder"] if l["layer"] == "Harbor maintenance fee")
    assert hmf_b["amount"] is None and hmf_a["amount"] == "0.36" and hmf_a["note"] == "ocean"
    for lb, la in zip(before["ladder"], after["ladder"]):
        if lb["layer"] not in ("Harbor maintenance fee", "Total"):
            assert lb["amount"] == la["amount"]


def test_nochange_rescreen_against_the_same_snapshot_changes_nothing(service, baseline):
    rid = run_s1(service, baseline)
    runs_before = len(service.thread.of_kind("screening_run", rid))
    rep = service.rescreen(rid)
    assert rep["changed"] == 0 and rep["runs"] == runs_before
    assert len(service.thread.of_kind("screening_run", rid)) == 2 * runs_before
    assert rep["snapshot_sha"] == service.round_view(rid)["fixtures"]["csl"]["sha256"]
