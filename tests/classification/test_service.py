"""The facade: request analysis, answer a round, adopt, read the board, re-derive. Plus the three
08-21 acceptance SHAPES (the gold rows themselves stay sequestered): a USML candidate whose decisive
fact is unresolved lands blocked and is never knocked out without a cited failure; EAR99 is seated and
electable when every specific candidate is knocked out."""
import jsonschema
import pytest

from forge_classification.contracts import load_schema
from forge_classification.model import ScriptedModel
from forge_classification.service import Service
from forge_classification.thread import Thread
from fixtures import CIVIL_FACTS, PART_REVISION, REV, advocate, concerns, element, judge, pack, propose

SCHEMA = load_schema("envelope")
AGENT = {"actor_id": "actor:lane", "actor_type": "AGENT", "alias": "classification-lane"}
HUMAN = {"actor_id": "actor:charlie", "actor_type": "HUMAN", "alias": "founder"}
MISSING = {"fact_path": "declared.used_on_platform", "question": "Which platform is the board designed for use in or with (22 CFR 120.41(a)(2))?"}


def blocked_then_negative_script():
    """Run 1: XI(c)(2) blocked on an askable fact. Run 2 (after the answer): XI(c)(2) knocked out, CCL reached, EAR99 elected."""
    return {
        "usml_propose": [propose("USML XI(c)(2)"), propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate", missing=MISSING)]),
                                        advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "blocked_on_facts", [element("USML XI(c)(2)", "indeterminate", missing=MISSING)]),
                                     judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
        "concerns": [concerns(), concerns()],
    }


def service(script):
    thread = Thread("product-thread:kestrel", tool_identity="forge@test")
    return Service(thread, pack(), ScriptedModel(script), calls_cap=16, cost_cap_microusd=8_000_000, actor=AGENT), thread


def test_round_trip_request_answer_request_adopt():
    svc, thread = service(blocked_then_negative_script())
    svc.declare(PART_REVISION, CIVIL_FACTS["payload"]["facts"], actor=HUMAN, occurred_at="2026-09-05T21:00:00Z", idempotency_key="d1")

    first = svc.request_analysis(PART_REVISION, "commodity", occurred_at="2026-09-05T21:01:00Z", idempotency_key="r1")
    assert first["record"]["record_kind"] == "compliance.analysis.v1"
    env1 = first["envelope"]
    jsonschema.validate(env1, SCHEMA)
    assert env1["claim_class"] == "insufficient_facts"
    assert env1["questions"][0]["fact_path"] == "declared.used_on_platform"
    assert first["round"]["record_kind"] == "compliance.analysis-round.v1"
    assert first["round"]["payload"]["questions"][0]["fact_path"] == "declared.used_on_platform"

    with pytest.raises(Exception) as exc:  # adopting an insufficient analysis is refused
        svc.adopt(first["record"]["revision_id"], actor=HUMAN, role="empowered_official", occurred_at="2026-09-05T21:02:00Z", idempotency_key="a0")
    assert getattr(exc.value, "code", None) == "CLAIM_CLASS_NOT_ADOPTABLE"

    svc.declare(PART_REVISION, [{"path": "declared.used_on_platform", "value": "Kestrel civil survey airframe", "unit": None}],
                actor=HUMAN, occurred_at="2026-09-05T21:03:00Z", idempotency_key="d2")
    second = svc.request_analysis(PART_REVISION, "commodity", occurred_at="2026-09-05T21:04:00Z", idempotency_key="r2")
    env2 = second["envelope"]
    assert env2["snapshot_sha256"] != env1["snapshot_sha256"]
    assert env2["route"]["posture"] == "EAR99" and env2["claim_class"] == "conditional"
    assert second["round"] is None  # no new questions: the loop closes (the fast path)
    assert svc.board(REV, "commodity")["snapshot_sha256"] == env2["snapshot_sha256"]

    adopted = svc.adopt(second["record"]["revision_id"], actor=HUMAN, role="empowered_official",
                        occurred_at="2026-09-05T21:05:00Z", idempotency_key="a1")
    assert adopted[0]["record_kind"] == "compliance.classification-record.v1"
    assert adopted[0]["payload"]["claim_class"] == "conditional"
    kinds = [thread.records[e["after_ref"]["revision_id"]]["record_kind"] for e in thread.events]
    assert kinds == ["compliance.declared-facts.v1", "compliance.analysis.v1", "compliance.analysis-round.v1",
                     "compliance.declared-facts.v1", "compliance.analysis.v1", "compliance.classification-record.v1"]


def test_insufficient_facts_write_a_failure_record_and_call_no_model():
    svc, thread = service({})
    bare = dict(PART_REVISION)
    bare["part_document"] = {**PART_REVISION["part_document"], "bodies": [], "parameters": {},
                             "revision": {**PART_REVISION["part_document"]["revision"], "intent": ""}}
    out = svc.request_analysis(bare, "commodity", occurred_at="2026-09-05T21:00:00Z", idempotency_key="r1")
    assert out["envelope"] is None
    assert out["record"]["record_kind"] == "compliance.analysis-failure.v1"
    assert out["record"]["payload"]["reason"] == "insufficient"
    assert "introduction" in out["record"]["payload"]["blocking_fields"]
    assert svc.model.calls == []
    assert svc.board(REV, "commodity") is None


def test_budget_exhaustion_writes_a_failure_record_and_no_envelope():
    script = blocked_then_negative_script()
    thread = Thread("product-thread:kestrel", tool_identity="forge@test")
    svc = Service(thread, pack(), ScriptedModel(script), calls_cap=1, cost_cap_microusd=8_000_000, actor=AGENT)
    svc.declare(PART_REVISION, CIVIL_FACTS["payload"]["facts"], actor=HUMAN, occurred_at="2026-09-05T21:00:00Z", idempotency_key="d1")
    out = svc.request_analysis(PART_REVISION, "commodity", occurred_at="2026-09-05T21:01:00Z", idempotency_key="r1")
    assert out["envelope"] is None and out["record"]["payload"]["reason"] == "budget_exhausted"


def test_rederive_replays_the_analysis_to_the_same_envelope_hash():
    script = blocked_then_negative_script()
    svc, thread = service(script)
    svc.declare(PART_REVISION, CIVIL_FACTS["payload"]["facts"], actor=HUMAN, occurred_at="2026-09-05T21:00:00Z", idempotency_key="d1")
    first = svc.request_analysis(PART_REVISION, "commodity", occurred_at="2026-09-05T21:01:00Z", idempotency_key="r1")
    replay = Service(thread, pack(), ScriptedModel(blocked_then_negative_script()), calls_cap=16, cost_cap_microusd=8_000_000, actor=AGENT)
    report = replay.rederive({REV: PART_REVISION})
    assert report["chain"] == "intact"
    assert report["analyses"] == [{"revision_id": first["record"]["revision_id"], "replayed": True, "envelope_sha256_matches": True}]


# --- 08-21 acceptance shapes -------------------------------------------------------------------

def test_shape_5793_4574_an_unresolved_usml_candidate_is_blocked_never_knocked_out_without_a_cited_failure():
    """The judge tries to knock out USML XX-shaped candidate on an uncited element while the decisive fact is open."""
    script = {
        "usml_propose": [propose("USML XX(c)")],
        ("advocate", "USML XX(c)"): [advocate("USML XX(c)", [element("USML XX(c)", "indeterminate", missing={"fact_path": "declared.designed_for_platform", "question": "Was the assembly specially designed for a submersible or naval platform (22 CFR 120.41(a))?"})])],
        ("judge", "USML XX(c)"): [judge("USML XX(c)", "knocked_out", [element("USML XX(c)", "not_met")])],
        "concerns": [concerns()],
    }
    svc, _ = service(script)
    svc.declare(PART_REVISION, CIVIL_FACTS["payload"]["facts"], actor=HUMAN, occurred_at="2026-09-05T21:00:00Z", idempotency_key="d1")
    out = svc.request_analysis(PART_REVISION, "commodity", occurred_at="2026-09-05T21:01:00Z", idempotency_key="r1")
    env = out["envelope"]
    cand = next(c for c in env["candidates"] if c["provision"] == "USML XX(c)")
    assert cand["status"] == "blocked_on_facts"
    assert env["route"]["posture"] == "AMBIGUOUS" and env["route"]["ccl_step"] == "not_reached"
    assert env["claim_class"] == "insufficient_facts"
    assert env["questions"][0]["fact_path"] == "declared.designed_for_platform"
    assert not any(c["status"] == "knocked_out" for c in env["candidates"])


def test_shape_5161_ear99_holds_a_board_seat_and_is_electable():
    script = {
        "usml_propose": [propose("USML XI(c)(2)")],
        ("advocate", "USML XI(c)(2)"): [advocate("USML XI(c)(2)", [element("USML XI(c)(2)", "indeterminate")])],
        ("judge", "USML XI(c)(2)"): [judge("USML XI(c)(2)", "knocked_out", [element("USML XI(c)(2)", "not_met", quote="Printed Circuit Boards")])],
        "ccl_propose": [propose("5D002.c.1", "9A991.d")],
        ("advocate", "5D002.c.1"): [advocate("5D002.c.1", [element("5D002.c.1", "indeterminate")])],
        ("judge", "5D002.c.1"): [judge("5D002.c.1", "knocked_out", [element("5D002.c.1", "not_met", quote="Equipment specified by 5A002.a")])],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
        "concerns": [concerns()],
    }
    svc, _ = service(script)
    svc.declare(PART_REVISION, CIVIL_FACTS["payload"]["facts"], actor=HUMAN, occurred_at="2026-09-05T21:00:00Z", idempotency_key="d1")
    env = svc.request_analysis(PART_REVISION, "software", occurred_at="2026-09-05T21:01:00Z", idempotency_key="r1")["envelope"]
    ear99 = next(c for c in env["candidates"] if c["provision"] == "EAR99")
    assert ear99["origin"] == "floor" and ear99["status"] == "leading"
    assert env["route"]["posture"] == "EAR99" and env["claim_class"] == "conditional"
    assert env["route"]["leading_candidate_id"] == ear99["candidate_id"]
