"""Adversarial pins for proposal failure, ordered-review closure, and wave admission."""

import jsonschema
import pytest

from forge_classification.contracts import load_schema
from forge_classification.engine import determine
from forge_classification.model import Abstain, Budget, BudgetExhausted, BudgetedModel, ScriptedModel
from forge_classification.snapshot import snapshot_from_part_revision
from fixtures import CIVIL_FACTS, PART_REVISION, advocate, element, judge, pack, propose, usml_negative


SCHEMA = load_schema("determination")


def snap(*, description_suffix=""):
    part = {**PART_REVISION, "part_document": {**PART_REVISION["part_document"]}}
    part["part_document"]["revision"] = {**PART_REVISION["part_document"]["revision"]}
    part["part_document"]["revision"]["intent"] += description_suffix
    return snapshot_from_part_revision(part, CIVIL_FACTS, item_kind="commodity")


def run(model, *, snapshot=None, calls_cap=16):
    budget = Budget(calls_cap=calls_cap, cost_cap_microusd=8_000_000)
    out = determine(snapshot or snap(), pack(), BudgetedModel(model, budget, estimated_cost_microusd=100_000), budget)
    jsonschema.validate(out, SCHEMA)
    return out


def ccl_response(*provisions, read=None):
    response = {
        "candidates": [
            {"provision": provision, "why_considered": "Adversarial route probe.", "via": "specially_designed"}
            for provision in provisions
        ]
    }
    if read is not None:
        response["specially_designed_read"] = read
    return response


def candidate(out, provision):
    return next(row for row in out["candidates"] if row["provision"] == provision)


@pytest.mark.parametrize(
    "response",
    [Abstain("provider timeout"), {"candidates": None}, {"candidates": [{"provision": "9A991.d"}]}, []],
)
def test_ccl_failure_or_malformed_output_never_becomes_ear99(response):
    out = run(ScriptedModel({**usml_negative(), "ccl_propose": [response]}))

    assert out["determination"]["jurisdiction"] == "EAR"
    assert out["determination"]["classification"] == []
    assert out["determination"]["ccl_step"] == "undetermined"
    assert candidate(out, "EAR99")["status"] == "not_reached"
    assert any("CCL proposal: blocked" in line for line in out["determination"]["basis"])


def test_a_valid_explicit_empty_ccl_proposal_can_reach_the_residual():
    out = run(ScriptedModel({**usml_negative(), "ccl_propose": [{"candidates": []}]}))

    assert out["determination"]["jurisdiction"] == "EAR99"
    assert out["determination"]["classification"] == ["EAR99"]
    assert any("valid explicit empty" in line for line in out["determination"]["basis"])


@pytest.mark.parametrize("read", [None, "undetermined: development evidence is incomplete", "caught and released"])
def test_incomplete_or_conflicting_ear_specially_designed_read_blocks_before_analysis(read):
    model = ScriptedModel({**usml_negative(), "ccl_propose": [ccl_response("3A611.g", read=read)]})
    out = run(model)

    assert out["determination"]["jurisdiction"] == "EAR"
    assert out["determination"]["ccl_step"] == "undetermined"
    assert candidate(out, "3A611.g")["status"] == "not_reached"
    assert not any(call.kind == "advocate" and call.prompt.startswith("PROVISION: 3A611.g\n") for call in model.calls)


def test_released_read_conflicting_with_a_special_candidate_blocks():
    model = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [ccl_response("3A611.g", read="released: general-purpose development record")],
    })
    out = run(model)

    assert out["determination"]["ccl_step"] == "undetermined"
    assert any("released conflicts" in line for line in out["determination"]["basis"])
    assert not any(call.kind == "advocate" and call.prompt.startswith("PROVISION: 3A611.g\n") for call in model.calls)


def test_caught_read_routes_the_special_candidate_through_a_record_walk():
    model = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [ccl_response("3A611.g", read="caught: development record requires the paragraph walk")],
        ("advocate", "3A611.g"): [advocate("3A611.g", [element("3A611.g", "indeterminate")])],
        ("judge", "3A611.g"): [judge("3A611.g", "knocked_out", [element("3A611.g", "not_met", quote="Printed circuit boards")])],
    })
    out = run(model)

    assert candidate(out, "3A611.g")["stage"] == "specially_designed_ear"
    assert candidate(out, "3A611.g")["status"] == "knocked_out"
    assert out["determination"]["jurisdiction"] == "EAR99"


def test_candidate_flood_is_rejected_before_the_first_ccl_advocate_call():
    ccl_units = [
        key for key in sorted(pack().units)
        if key[0:1].isdigit() and not key.startswith("15 CFR") and key not in ("EAR99", "NOT_SUBJECT")
    ][:8]
    assert len(ccl_units) == 8
    response = {"candidates": [
        {"provision": provision, "why_considered": "Budget flood probe."} for provision in ccl_units
    ]}
    model = ScriptedModel({**usml_negative(), "ccl_propose": [response]})

    with pytest.raises(BudgetExhausted, match="CCL candidate wave rejected before execution"):
        run(model, calls_cap=16)
    assert not any(call.kind == "advocate" and call.prompt.startswith("PROVISION: ")
                   and not call.prompt.startswith("PROVISION: USML") for call in model.calls)


def test_candidate_identity_is_bound_to_snapshot_and_pack_context():
    def classified(snapshot):
        return run(ScriptedModel({**usml_negative(), "ccl_propose": [{"candidates": []}]}), snapshot=snapshot)

    first = classified(snap())
    second = classified(snap(description_suffix=" with a distinct immutable context"))
    first_id = candidate(first, "USML XI(c)(2)")["candidate_id"]
    second_id = candidate(second, "USML XI(c)(2)")["candidate_id"]

    assert first["pack_sha256"] == second["pack_sha256"]
    assert first["snapshot_sha256"] != second["snapshot_sha256"]
    assert first_id != second_id
    assert first_id.startswith("cand:") and len(first_id) == len("cand:") + 64
