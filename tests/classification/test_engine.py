"""The engine: one pure call, code concludes. Every test scripts the model and asserts on the envelope.

Route pins and reconciliation pins re-type the ideas pinned in proto-prod's wave engine; each
docstring names the rule it holds. Expected values are the design's stated rules, not the code's.
"""
import jsonschema
import pytest

from forge_classification.contracts import load_schema
from forge_classification.engine import (
    Insufficient, PROMPT_SCHEMAS, classify,
)
from forge_classification.model import Budget, BudgetExhausted, BudgetedModel, ScriptedModel
from forge_classification.snapshot import snapshot
from fixtures import (
    CIVIL_FACTS, PART_REVISION, advocate, cite, concerns, declared, element, judge, pack, propose,
)

SCHEMA = load_schema("envelope")


def snap(extra=(), item_kind="commodity"):
    return snapshot(PART_REVISION, [CIVIL_FACTS, *extra], item_kind=item_kind)


def run(model, snapshot_=None, **kw):
    budget = Budget(calls_cap=kw.pop("calls_cap", 16), cost_cap_microusd=kw.pop("cost_cap", 8_000_000))
    env = classify(snapshot_ or snap(), pack(), BudgetedModel(model, budget, estimated_cost_microusd=100_000), budget, **kw)
    jsonschema.validate(env, SCHEMA)
    return env


def by_id(env, provision):
    return next(c for c in env["candidates"] if c["provision"] == provision)


# --- Route pins -----------------------------------------------------------------------------

def test_supported_usml_routes_itar_and_never_reaches_ccl():
    """A USML candidate every element of which is met, with a cited element, controls; the CCL is not reached."""
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML VIII(h)(1)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "supported", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("advocate", "USML VIII(h)(1)"): [advocate("USML VIII(h)(1)", [element("USML VIII(h)(1)", "indeterminate")])],
        ("judge", "USML VIII(h)(1)"): [judge("USML VIII(h)(1)", "knocked_out", [element("USML VIII(h)(1)", "not_met", quote="specially designed for aircraft")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["posture"] == "ITAR"
    assert env["route"]["usml_step"] == "supported"
    assert env["route"]["ccl_step"] == "not_reached"
    assert env["route"]["leading_candidate_id"] == by_id(env, "USML XI(c)(2)")["candidate_id"]
    assert by_id(env, "USML XI(c)(2)")["status"] == "leading"
    assert by_id(env, "EAR99")["status"] == "not_reached"
    assert not any(c.kind == "ccl_propose" for c in m.calls)


def test_usml_blocked_on_an_askable_fact_is_insufficient_facts_with_a_question_and_no_ccl():
    """A blocked USML candidate that names its missing fact yields insufficient_facts, a ranked question,
    and no CCL analysis — the walk never advances toward the residual on insufficiency."""
    missing = {"fact_path": "declared.used_on_platform", "question": "Which platform is the board designed for use in or with (22 CFR 120.41(a)(2))?"}
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate", missing=missing)])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate", missing=missing)])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["usml_step"] == "blocked_on_facts"
    assert env["route"]["posture"] == "AMBIGUOUS"
    assert env["route"]["ccl_step"] == "not_reached"
    assert env["claim_class"] == "insufficient_facts"
    assert env["recommended_instrument"] is None
    assert env["questions"][0]["fact_path"] == "declared.used_on_platform"
    assert env["questions"][0]["unblocks"][0]["candidate_id"] == by_id(env, "USML XI(c)(2)")["candidate_id"]


def test_usml_indeterminate_with_no_askable_fact_is_ambiguous_and_recommends_a_cj():
    """Structural ambiguity — no fact would settle it — exits by CJ, never through the question loop (AMB-1)."""
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate")],
                                           reason="Design intent is genuinely contested on full facts.")],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["claim_class"] == "ambiguous"
    assert env["recommended_instrument"] == "cj"
    assert env["questions"] == []


def _usml_negative():
    return {
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
    }


def test_usml_negative_then_a_supported_eccn_is_ear_and_the_residual_is_not_reached():
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("3A611.g", "9A991.d")],
        ("advocate", "3A611.g"): [advocate("3A611.g", [element("3A611.g", "indeterminate")])],
        ("judge", "3A611.g"): [judge("3A611.g", "knocked_out", [element("3A611.g", "not_met", quote="Printed circuit boards")])],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["usml_step"] == "negative"
    assert env["route"]["ccl_step"] == "specific_supported"
    assert env["route"]["posture"] == "EAR"
    assert by_id(env, "9A991.d")["status"] == "leading"
    assert by_id(env, "3A611.g")["stage"] == "six_hundred_series"
    assert by_id(env, "9A991.d")["stage"] == "other_ccl"
    assert by_id(env, "EAR99")["status"] == "not_reached"
    assert env["claim_class"] == "conditional"  # facts are attested, not verified — see the claim tests


def test_every_specific_candidate_knocked_out_elects_the_residual_conditionally():
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["ccl_step"] == "all_knocked_out"
    assert env["route"]["posture"] == "EAR99"
    ear99 = by_id(env, "EAR99")
    assert ear99["status"] == "leading" and ear99["origin"] == "floor"
    assert env["claim_class"] == "conditional"
    assert env["claim_class_ceiling"] == "conditional"
    assert "residual" in env["ceiling_reason"]


def test_ear99_is_never_elected_while_a_specific_candidate_is_open():
    """EAR99 cannot pass while any specific candidate is blocked; the model's summary cannot override the records."""
    missing = {"fact_path": "spec.frame_rate", "question": "What is the imager's frame rate in Hz (6A003.b.4)?"}
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("6A003.b.4")],
        ("advocate", "6A003.b.4"): [advocate("6A003.b.4", [element("6A003.b.4", "indeterminate", missing=missing)])],
        ("judge", "6A003.b.4"): [judge("6A003.b.4", "blocked_on_facts", [element("6A003.b.4", "indeterminate", missing=missing)])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["posture"] == "EAR"
    assert env["route"]["ccl_step"] == "blocked_on_facts"
    assert by_id(env, "EAR99")["status"] == "not_reached"
    assert env["claim_class"] == "insufficient_facts"
    assert env["questions"][0]["fact_path"] == "spec.frame_rate"


def test_two_supported_entries_in_one_stage_route_ambiguous_to_ccats():
    """Two competent readings within one CCL step is the margin rule: ambiguous, CCATS, never pick the top one."""
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("9A991.d", "3A991.a.2")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
        ("advocate", "3A991.a.2"): [advocate("3A991.a.2", [element("3A991.a.2", "met", quote="clock frequency rate")])],
        ("judge", "3A991.a.2"): [judge("3A991.a.2", "supported", [element("3A991.a.2", "met", quote="clock frequency rate")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert env["route"]["ccl_step"] == "ambiguous"
    assert env["claim_class"] == "ambiguous"
    assert env["recommended_instrument"] == "ccats"
    assert env["route"]["leading_candidate_id"] is None


def test_a_later_stage_is_not_reached_when_an_earlier_stage_decides():
    """A 600-series match forecloses generic ECCNs regardless of confidence; the generic entry is not analysed."""
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("9A991.d", "3A611.g")],
        ("advocate", "3A611.g"): [advocate("3A611.g", [element("3A611.g", "met", quote="Printed circuit boards")])],
        ("judge", "3A611.g"): [judge("3A611.g", "supported", [element("3A611.g", "met", quote="Printed circuit boards")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert by_id(env, "3A611.g")["status"] == "leading"
    later = by_id(env, "9A991.d")
    assert later["status"] == "not_reached" and later["pursuit"] == "explicitly_not" and later["why_rejected"] is None
    assert not any(c.kind == "advocate" and "9A991.d" in c.prompt for c in m.calls)


# --- Reconciliation pins: records outrank summaries ---------------------------------------------

def test_a_knockout_that_also_names_missing_facts_is_blocked_not_knocked_out():
    missing = {"fact_path": "declared.used_on_platform", "question": "Which platform?"}
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate", missing=missing)])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out",
                                           [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards"),
                                            element("USML XI(c)(2)", "indeterminate", missing=missing, element_id="el:2")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert by_id(env, "USML XI(c)(2)")["status"] == "blocked_on_facts"
    assert env["route"]["ccl_step"] == "not_reached"


def test_a_knockout_without_a_cited_failed_element_is_blocked_and_noted():
    """The judge may knock out only on an affirmatively cited element failure."""
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met")])],
        "concerns": [concerns()],
    })
    env = run(m)
    cand = by_id(env, "USML XI(c)(2)")
    assert cand["status"] == "blocked_on_facts"
    assert any("without a verified citation" in n for n in cand["reference_notes"])


def test_a_forged_citation_is_struck_before_the_judge_and_cannot_support_a_knockout():
    bad = cite("USML XI(c)(2)", "Printed Circuit Boards")
    bad["start"] += 2
    forged = element("USML XI(c)(2)", "not_met")
    forged["citation"] = bad
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [forged])],
        "concerns": [concerns()],
    })
    env = run(m)
    cand = by_id(env, "USML XI(c)(2)")
    assert cand["status"] == "blocked_on_facts"
    assert cand["elements"][0]["citation"] is None
    assert any("span_not_found" in n for n in cand["reference_notes"])


def test_a_sustained_challenge_defeats_a_supported_ruling():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "supported", [element("USML XI(c)(2)", "met", quote="Printed Circuit Boards")],
                                           challenge={"text": "The board is not specially designed for a defense article.", "resolution": "sustained"})],
        "concerns": [concerns()],
    })
    env = run(m)
    assert by_id(env, "USML XI(c)(2)")["status"] == "blocked_on_facts"
    assert env["route"]["posture"] == "AMBIGUOUS"


def test_the_advocate_cannot_knock_out_its_own_provision():
    """A not_met element from the advocate is a schema breach: dropped with a note, never a knockout."""
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate")])],
        "concerns": [concerns()],
    })
    env = run(m)
    cand = by_id(env, "USML XI(c)(2)")
    assert cand["status"] != "knocked_out"
    assert any("advocate" in n and "not_met" in n for n in cand["reference_notes"])
    judge_prompt = next(c.prompt for c in m.calls if c.kind == "judge")
    case_section = judge_prompt.split("THE ADVOCATE'S CASE")[1].split("You are the judge")[0]
    assert "not_met" not in case_section


def test_unknown_provisions_are_dropped_to_a_note_and_never_become_candidates():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML XXII(a)", "2B094")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
        "concerns": [concerns()],
    })
    env = run(m)
    assert {c["provision"] for c in env["candidates"]} == {"USML XI(c)(2)", "9A991.d", "EAR99"}
    dropped = {d["provision"] for d in env["provenance"]["dropped_candidates"]}
    assert dropped == {"USML XXII(a)", "2B094"}


def test_an_empty_proposal_retries_once_then_the_usml_step_is_ambiguous_to_cj():
    m = ScriptedModel({
        "usml_propose": [{"candidates": [], "specially_designed_read": "", "no_usml_reasoning": "nothing plausible"},
                         {"candidates": [], "specially_designed_read": "", "no_usml_reasoning": "still nothing"}],
        "concerns": [concerns()],
    })
    env = run(m)
    assert sum(1 for c in m.calls if c.kind == "usml_propose") == 2
    assert env["route"]["usml_step"] == "blocked_on_facts"
    assert env["claim_class"] == "ambiguous" and env["recommended_instrument"] == "cj"
    assert env["route"]["ccl_step"] == "not_reached"


def test_a_judge_abstention_blocks_and_never_knocks_out():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        # no judge script -> Abstain("script exhausted")
        "concerns": [concerns()],
    })
    env = run(m)
    cand = by_id(env, "USML XI(c)(2)")
    assert cand["status"] == "blocked_on_facts"
    assert any("judge unavailable" in n for n in cand["reference_notes"])


def test_stray_codes_in_prose_are_generalised_and_noted():
    m = ScriptedModel({
        "usml_propose": [{"candidates": [{"provision": "USML XI(c)(2)", "why_considered": "Boards like 4A001 or 2B094 devices."}],
                          "specially_designed_read": "", "no_usml_reasoning": ""}],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate")])],
        "concerns": [concerns()],
    })
    env = run(m)
    cand = by_id(env, "USML XI(c)(2)")
    assert "2B094" not in cand["why_considered"] and "4A001" in cand["why_considered"]  # 4A001 resolves; 2B094 does not
    assert any("2B094" in n for n in env["provenance"]["reference_notes"])


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
        "concerns": [concerns()],
    })
    run(m)
    for call in m.calls:
        if call.kind in ("advocate", "judge") and "PROVISION: USML XI(c)(2)" in call.prompt:
            assert "VIII(h)(1)" not in call.prompt and "9A991" not in call.prompt


@pytest.mark.parametrize("kind", ["usml_propose", "ccl_propose", "advocate", "judge", "concerns"])
@pytest.mark.parametrize("key", ["jurisdiction", "classification", "claim_class", "instrument", "stage", "posture", "route", "status"])
def test_no_wave_schema_carries_a_conclusion_key(kind, key):
    props = PROMPT_SCHEMAS[kind]["properties"]
    assert key not in props
    for nested in props.values():
        items = nested.get("items", {}) if isinstance(nested, dict) else {}
        assert key not in items.get("properties", {})


def test_advocate_schema_has_no_knockout_value():
    disp = PROMPT_SCHEMAS["advocate"]["properties"]["elements"]["items"]["properties"]["disposition"]["enum"]
    assert "not_met" not in disp and "met" in disp and "indeterminate" in disp


def test_concerns_failure_is_non_dispositive_and_tensions_are_recorded_never_applied():
    m = ScriptedModel({
        **_usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
        "concerns": [concerns(tensions=[{"type": "strictest_rule", "statement": "If in doubt treat as ITAR."}])],
    })
    env = run(m)
    assert env["route"]["posture"] == "EAR"
    assert env["legal_tensions"][0]["type"] == "strictest_rule"
    m2 = ScriptedModel({**_usml_negative(), "ccl_propose": [propose("9A991.d")],
                        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
                        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])]})
    env2 = run(m2)  # concerns abstain -> run still completes
    assert env2["route"]["posture"] == "EAR" and env2["concerns"] == []


# --- Claim class -----------------------------------------------------------------------------

def test_supported_requires_verified_or_attested_decisive_facts():
    civil_attested = CIVIL_FACTS
    measured = declared([{"path": "spec.layout_target_doc", "value": "civil_uav", "unit": None}], level="MEASURED",
                        artifact_refs=[{"artifact_id": "artifact:" + "a" * 64}], record_id="declared:fc:2")
    script = {
        **_usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.", facts=("declared.civil_product", "spec.layout_target_doc"))])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.", facts=("declared.civil_product", "spec.layout_target_doc"))])],
        "concerns": [concerns()],
    }
    env = run(ScriptedModel(script), snapshot(PART_REVISION, [civil_attested, measured], item_kind="commodity"))
    assert env["claim_class"] == "supported"
    assert env["claim_class_ceiling"] == "supported"
    # the same board with the decisive facts merely asserted caps at conditional
    asserted = declared([{"path": "declared.civil_product", "value": "true", "unit": None}], actor_type="AGENT", record_id="declared:fc:3")
    script2 = {**script}
    script2[("advocate", "9A991.d")] = [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.", facts=("declared.civil_product", "body.pcb.mcu"))])]
    script2[("judge", "9A991.d")] = [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.", facts=("declared.civil_product", "body.pcb.mcu"))])]
    env2 = run(ScriptedModel(script2), snapshot(PART_REVISION, [asserted], item_kind="commodity"))
    assert env2["claim_class"] == "conditional"
    assert env2["claim_class_ceiling"] == "conditional"
    assert "asserted" in env2["ceiling_reason"]


# --- Gates before and around the model ----------------------------------------------------------

def test_insufficient_snapshot_blocks_before_any_model_call():
    bare = dict(PART_REVISION)
    bare["part_document"] = {**PART_REVISION["part_document"], "bodies": [], "parameters": {},
                             "revision": {**PART_REVISION["part_document"]["revision"], "intent": ""}}
    m = ScriptedModel({})
    with pytest.raises(Insufficient) as exc:
        run(m, snapshot(bare, [], item_kind="commodity"))
    assert m.calls == []
    assert "introduction" in exc.value.blocking_fields


def test_budget_breach_aborts_without_a_partial_envelope():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)", "USML VIII(h)(1)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
    })
    with pytest.raises(BudgetExhausted):
        run(m, calls_cap=2)


def test_provenance_records_every_call_with_its_prompt_hash_and_the_budget():
    m = ScriptedModel({
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate")])],
        "concerns": [concerns()],
    })
    env = run(m)
    stages = [c["stage"] for c in env["provenance"]["calls"]]
    assert stages == ["usml_propose", "advocate", "judge", "concerns"]
    assert env["provenance"]["calls"][1]["provision"] == "USML XI(c)(2)"
    assert env["provenance"]["budget"]["calls_used"] == 4
    assert env["snapshot_sha256"] == snap().sha256 and env["pack_sha256"] == pack().sha256
