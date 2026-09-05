"""The engine: one pure call, code concludes, no human gate. Every test scripts the model and asserts
on the determination. Route pins and reconciliation pins re-type the ideas pinned in proto-prod."""
import jsonschema
import pytest

from forge_classification.contracts import load_schema
from forge_classification.engine import PROMPT_SCHEMAS, ModelUnavailable, determine
from forge_classification.model import Budget, BudgetExhausted, BudgetedModel, ScriptedModel
from forge_classification.snapshot import snapshot_from_part_revision
from fixtures import CIVIL_FACTS, PART_REVISION, advocate, cite, element, judge, pack, propose, usml_negative

SCHEMA = load_schema("determination")


def snap(item_kind="commodity"):
    return snapshot_from_part_revision(PART_REVISION, CIVIL_FACTS, item_kind=item_kind)


def run(model, snapshot_=None, calls_cap=16):
    budget = Budget(calls_cap=calls_cap, cost_cap_microusd=8_000_000)
    out = determine(snapshot_ or snap(), pack(), BudgetedModel(model, budget, estimated_cost_microusd=100_000), budget)
    jsonschema.validate(out, SCHEMA)
    return out


def cand(out, provision):
    return next(c for c in out["candidates"] if c["provision"] == provision)


# --- The determination -------------------------------------------------------------------------

def test_supported_usml_is_itar_and_the_ccl_is_never_reached():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML VIII(h)(1)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "supported", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("advocate", "USML VIII(h)(1)"): [advocate("USML VIII(h)(1)", [element("USML VIII(h)(1)", "indeterminate")])],
        ("judge", "USML VIII(h)(1)"): [judge("USML VIII(h)(1)", "knocked_out", [element("USML VIII(h)(1)", "not_met", quote="specially designed for aircraft")])],
    })
    out = run(m)
    d = out["determination"]
    assert d["jurisdiction"] == "ITAR" and d["classification"] == ["USML XI(c)(2)"]
    assert d["usml_step"] == "supported" and d["ccl_step"] == "not_reached"
    assert cand(out, "USML XI(c)(2)")["status"] == "supported"
    assert cand(out, "EAR99")["status"] == "not_reached"
    assert not any(c.kind == "ccl_propose" for c in m.calls)


def test_an_open_usml_candidate_is_undetermined_and_never_advances_to_the_ccl():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "undetermined", [element("USML XI(c)(2)", "indeterminate")])],
    })
    out = run(m)
    d = out["determination"]
    assert d["jurisdiction"] == "UNDETERMINED" and d["classification"] == []
    assert d["usml_step"] == "undetermined" and d["ccl_step"] == "not_reached"
    assert d["open_candidates"] == ["USML XI(c)(2)"]
    assert not any(c.kind == "ccl_propose" for c in m.calls)


def test_usml_negative_then_a_supported_entry_is_ear_with_that_entry():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("3A611.g", "9A991.d")],
        ("advocate", "3A611.g"): [advocate("3A611.g", [element("3A611.g", "indeterminate")])],
        ("judge", "3A611.g"): [judge("3A611.g", "knocked_out", [element("3A611.g", "not_met", quote="Printed circuit boards")])],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
    })
    out = run(m)
    d = out["determination"]
    assert d["jurisdiction"] == "EAR" and d["classification"] == ["9A991.d"]
    assert d["usml_step"] == "negative" and d["ccl_step"] == "specific_supported"
    assert cand(out, "3A611.g")["stage"] == "six_hundred_series" and cand(out, "9A991.d")["stage"] == "other_ccl"
    assert cand(out, "EAR99")["status"] == "not_reached"


def test_every_specific_candidate_knocked_out_is_ear99():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
    })
    out = run(m)
    d = out["determination"]
    assert d["jurisdiction"] == "EAR99" and d["classification"] == ["EAR99"] and d["ccl_step"] == "all_knocked_out"
    assert cand(out, "EAR99")["status"] == "supported" and cand(out, "EAR99")["origin"] == "floor"


def test_an_open_ccl_candidate_is_ear_with_the_entry_undetermined_and_ear99_not_reached():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("6A003.b.4")],
        ("advocate", "6A003.b.4"): [advocate("6A003.b.4", [element("6A003.b.4", "indeterminate")])],
        ("judge", "6A003.b.4"): [judge("6A003.b.4", "undetermined", [element("6A003.b.4", "indeterminate")])],
    })
    out = run(m)
    d = out["determination"]
    assert d["jurisdiction"] == "EAR" and d["classification"] == [] and d["ccl_step"] == "undetermined"
    assert d["open_candidates"] == ["6A003.b.4"]
    assert cand(out, "EAR99")["status"] == "not_reached"


def test_two_supported_entries_in_one_step_are_both_listed_and_the_jurisdiction_is_determined():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("9A991.d", "3A991.a.2")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
        ("advocate", "3A991.a.2"): [advocate("3A991.a.2", [element("3A991.a.2", "met", quote="clock frequency rate")])],
        ("judge", "3A991.a.2"): [judge("3A991.a.2", "supported", [element("3A991.a.2", "met", quote="clock frequency rate")])],
    })
    d = run(m)["determination"]
    assert d["jurisdiction"] == "EAR" and sorted(d["classification"]) == ["3A991.a.2", "9A991.d"]


def test_a_later_stage_is_not_reached_when_an_earlier_stage_decides():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("9A991.d", "3A611.g")],
        ("advocate", "3A611.g"): [advocate("3A611.g", [element("3A611.g", "met", quote="Printed circuit boards")])],
        ("judge", "3A611.g"): [judge("3A611.g", "supported", [element("3A611.g", "met", quote="Printed circuit boards")])],
    })
    out = run(m)
    assert out["determination"]["classification"] == ["3A611.g"]
    later = cand(out, "9A991.d")
    assert later["status"] == "not_reached" and later["why_rejected"] is None
    assert not any(c.kind == "advocate" and "9A991.d" in c.prompt for c in m.calls)


# --- Reconciliation: records outrank summaries --------------------------------------------------

def test_a_knockout_without_a_cited_failed_element_is_undetermined_and_noted():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met")])],
    })
    out = run(m)
    c = cand(out, "USML XI(c)(2)")
    assert c["status"] == "undetermined" and out["determination"]["jurisdiction"] == "UNDETERMINED"
    assert any("without a verified citation" in n for n in c["reference_notes"])


def test_a_forged_citation_is_struck_and_cannot_support_a_knockout():
    bad = cite("USML XI(c)(2)", "Printed Circuit Boards")
    bad["start"] += 2
    forged = element("USML XI(c)(2)", "not_met")
    forged["citation"] = bad
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [forged])],
    })
    c = cand(run(m), "USML XI(c)(2)")
    assert c["status"] == "undetermined" and c["elements"][0]["citation"] is None
    assert any("span_not_found" in n for n in c["reference_notes"])


def test_a_sustained_challenge_defeats_a_supported_ruling():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "supported", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")],
                                           challenge={"text": "The board is not specially designed for a defense article.", "resolution": "sustained"})],
    })
    out = run(m)
    assert cand(out, "USML XI(c)(2)")["status"] == "undetermined"
    assert out["determination"]["jurisdiction"] == "UNDETERMINED"


def test_a_supported_ruling_with_an_open_element_is_undetermined():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards"),
                                                                     element("USML XI(c)(2)", "indeterminate", element_id="el:2")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "supported", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
    })
    c = cand(run(m), "USML XI(c)(2)")
    assert c["status"] == "undetermined"
    assert any("carried from the advocate" in n for n in c["reference_notes"])


def test_the_advocate_cannot_knock_out_its_own_provision():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "undetermined", [element("USML XI(c)(2)", "indeterminate")])],
    })
    out = run(m)
    c = cand(out, "USML XI(c)(2)")
    assert c["status"] != "knocked_out"
    assert any("advocate" in n and "not_met" in n for n in c["reference_notes"])
    judge_prompt = next(x.prompt for x in m.calls if x.kind == "judge")
    assert "not_met" not in judge_prompt.split("THE ADVOCATE'S CASE")[1].split("You are the judge")[0]


def test_unknown_provisions_are_dropped_and_never_become_candidates():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML XXII(a)", "2B094")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
    })
    out = run(m)
    assert {c["provision"] for c in out["candidates"]} == {"USML XI(c)(2)", "9A991.d", "EAR99"}
    assert {d["provision"] for d in out["provenance"]["dropped_candidates"]} == {"USML XXII(a)", "2B094"}


def test_an_empty_proposal_retries_once_then_the_usml_step_is_undemonstrated():
    m = ScriptedModel({"usml_propose": [{"candidates": [], "specially_designed_read": "", "no_usml_reasoning": "nothing"},
                                         {"candidates": [], "specially_designed_read": "", "no_usml_reasoning": "still nothing"}]})
    out = run(m)
    assert sum(1 for c in m.calls if c.kind == "usml_propose") == 2
    assert out["determination"]["jurisdiction"] == "UNDETERMINED" and out["determination"]["usml_step"] == "undemonstrated"


def test_a_judge_abstention_leaves_the_candidate_undetermined():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
    })
    c = cand(run(m), "USML XI(c)(2)")
    assert c["status"] == "undetermined" and any("judge unavailable" in n for n in c["reference_notes"])


def test_stray_codes_in_prose_are_generalised_and_noted():
    m = ScriptedModel({
        "usml_propose": [{"candidates": [{"provision": "USML XI(c)(2)", "why_considered": "Boards like 4A001 or 2B094 devices."}],
                          "specially_designed_read": "", "no_usml_reasoning": ""}],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "undetermined", [element("USML XI(c)(2)", "indeterminate")])],
    })
    out = run(m)
    c = cand(out, "USML XI(c)(2)")
    assert "2B094" not in c["why_considered"] and "4A001" in c["why_considered"]
    assert any("2B094" in n for n in out["provenance"]["reference_notes"])


# --- Containment ------------------------------------------------------------------------------

def test_advocate_and_judge_prompts_for_one_provision_see_no_other_provision():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML VIII(h)(1)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        ("advocate", "USML VIII(h)(1)"): [advocate("USML VIII(h)(1)", [element("USML VIII(h)(1)", "indeterminate")])],
        ("judge", "USML VIII(h)(1)"): [judge("USML VIII(h)(1)", "knocked_out", [element("USML VIII(h)(1)", "not_met", quote="specially designed for aircraft")])],
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
    })
    run(m)
    for call in m.calls:
        if call.kind in ("advocate", "judge") and "PROVISION: USML XI(c)(2)" in call.prompt:
            assert "VIII(h)(1)" not in call.prompt and "9A991" not in call.prompt


@pytest.mark.parametrize("kind", ["usml_propose", "ccl_propose", "advocate", "judge"])
@pytest.mark.parametrize("key", ["jurisdiction", "classification", "determination", "status", "posture", "route", "instrument", "claim_class"])
def test_no_wave_schema_carries_a_conclusion_key(kind, key):
    props = PROMPT_SCHEMAS[kind]["properties"]
    assert key not in props
    for nested in props.values():
        items = nested.get("items", {}) if isinstance(nested, dict) else {}
        assert key not in items.get("properties", {})


def test_advocate_schema_has_no_knockout_value():
    disp = PROMPT_SCHEMAS["advocate"]["properties"]["elements"]["items"]["properties"]["disposition"]["enum"]
    assert "not_met" not in disp and "met" in disp and "indeterminate" in disp


def test_the_output_has_no_human_gate_and_no_filing_recommendation():
    m = ScriptedModel({**usml_negative(), "ccl_propose": [propose("9A991.d")],
                       ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
                       ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])]})
    out = run(m)
    flat = str(out).lower()
    for forbidden in ("adopt", "attestor", "instrument", "ccats", "cj ", "memo", "question", "round", "claim_class", "confidence", "gate"):
        assert forbidden not in flat, forbidden


# --- Hard limits --------------------------------------------------------------------------------

def test_budget_breach_aborts_with_no_partial_determination():
    m = ScriptedModel({"usml_propose": [propose("USML XI(c)(2)", "USML VIII(h)(1)")],
                       ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])]})
    with pytest.raises(BudgetExhausted):
        run(m, calls_cap=2)


def test_model_unavailable_on_both_proposals_raises():
    with pytest.raises(ModelUnavailable):
        run(ScriptedModel({}))


def test_provenance_records_every_call_with_its_prompt_hash_and_the_budget():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "undetermined", [element("USML XI(c)(2)", "indeterminate")])],
    })
    out = run(m)
    assert [c["stage"] for c in out["provenance"]["calls"]] == ["usml_propose", "advocate", "judge"]
    assert out["provenance"]["calls"][1]["provision"] == "USML XI(c)(2)"
    assert out["provenance"]["budget"]["calls_used"] == 3
    assert out["snapshot_sha256"] == snap().sha256 and out["pack_sha256"] == pack().sha256
