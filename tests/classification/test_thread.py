"""The product thread adapter: forge.record/1 records in the proposed `compliance` domain, chained
forge.event/1 events, actor discipline, and the refusals the design names."""
import copy

import pytest

from forge_classification.contracts import example_envelope
from forge_classification.records import content_hash, event_hash
from forge_classification.thread import Thread, ThreadRefused

AGENT = {"actor_id": "actor:lane", "actor_type": "AGENT", "alias": "classification-lane"}
HUMAN = {"actor_id": "actor:charlie", "actor_type": "HUMAN", "alias": "founder"}
T0 = "2026-09-05T21:00:00Z"


def thread():
    return Thread("product-thread:kestrel", tool_identity="forge@test")


def analysis(t, env=None, key="k1", at=T0):
    return t.append_analysis(env or example_envelope(), actor=AGENT, occurred_at=at, idempotency_key=key)


def test_analysis_by_an_agent_is_a_conformant_record_and_a_chained_event():
    t = thread()
    record, event = analysis(t)
    assert record["schema_version"] == "forge.record/1"
    assert record["record_kind"] == "compliance.analysis.v1"
    assert record["authority_domain"] == "compliance"
    assert record["claim_ceiling"] == "SYNTHETIC_LOCAL_ONLY"
    assert record["content_hash"] == content_hash(record)
    assert record["revision_id"] == "record-rev:" + record["content_hash"]
    assert event["protocol_version"] == "forge.event/1" and event["state"] == "APPLIED"
    assert event["event_order"] == 1 and event["previous_event_hash"] is None
    assert event["event_id"] == "event:" + event_hash(event)
    assert event["after_ref"]["revision_id"] == record["revision_id"]


def test_a_human_may_not_write_an_analysis_and_an_agent_may_not_adopt():
    t = thread()
    with pytest.raises(ThreadRefused) as exc:
        t.append_analysis(example_envelope(), actor=HUMAN, occurred_at=T0, idempotency_key="k")
    assert exc.value.code == "WRONG_ACTOR"
    record, _ = analysis(t)
    with pytest.raises(ThreadRefused) as exc:
        t.adopt(record["revision_id"], actor=AGENT, role="empowered_official", occurred_at=T0, idempotency_key="a")
    assert exc.value.code == "WRONG_ACTOR"


def test_an_envelope_whose_route_contradicts_its_records_is_refused():
    env = example_envelope()
    env["route"]["posture"] = "EAR99"
    env["route"]["ccl_step"] = "all_knocked_out"
    with pytest.raises(ThreadRefused) as exc:
        analysis(thread(), env)
    assert exc.value.code == "ROUTE_CONTRADICTS_RECORDS"
    env2 = example_envelope()
    env2["route"]["usml_step"] = "blocked_on_facts"  # EAR posture with an open USML step
    with pytest.raises(ThreadRefused) as exc:
        analysis(thread(), env2)
    assert exc.value.code == "ROUTE_CONTRADICTS_RECORDS"


def test_adoption_needs_a_human_with_a_role_and_the_latest_analysis():
    t = thread()
    first, _ = analysis(t, key="k1")
    second, _ = analysis(t, key="k2", at="2026-09-05T21:05:00Z")
    with pytest.raises(ThreadRefused) as exc:
        t.adopt(first["revision_id"], actor=HUMAN, role="empowered_official", occurred_at=T0, idempotency_key="a1")
    assert exc.value.code == "STALE_BASE"
    with pytest.raises(ThreadRefused) as exc:
        t.adopt("record-rev:" + "9" * 64, actor=HUMAN, role="empowered_official", occurred_at=T0, idempotency_key="a2")
    assert exc.value.code == "REFERENCE_MISSING"
    adopted = t.adopt(second["revision_id"], actor=HUMAN, role="empowered_official", occurred_at="2026-09-05T21:10:00Z", idempotency_key="a3")
    record = adopted[0]
    assert record["record_kind"] == "compliance.classification-record.v1"
    assert record["payload"]["attestor"] == {"actor_id": "actor:charlie", "role": "empowered_official"}
    assert record["payload"]["claim_class"] == "conditional"
    assert "Conditional" in record["payload"]["adoption_sentence"]
    assert t.adopted("rev:" + "3" * 64, "commodity")["revision_id"] == record["revision_id"]


def test_a_later_adoption_supersedes_in_the_same_call_and_supersession_cannot_be_written_alone():
    t = thread()
    a1, _ = analysis(t, key="k1")
    t.adopt(a1["revision_id"], actor=HUMAN, role="empowered_official", occurred_at=T0, idempotency_key="a1")
    a2, _ = analysis(t, key="k2", at="2026-09-05T22:00:00Z")
    out = t.adopt(a2["revision_id"], actor=HUMAN, role="empowered_official", occurred_at="2026-09-05T22:01:00Z",
                  idempotency_key="a2", cause="reanalysis")
    kinds = [r["record_kind"] for r in out]
    assert kinds == ["compliance.classification-record.v1", "compliance.classification-supersession.v1"]
    assert out[1]["payload"]["cause"] == "reanalysis"
    assert out[1]["payload"]["successor_revision_id"] == out[0]["revision_id"]
    with pytest.raises(ThreadRefused) as exc:
        t.append_record("compliance.classification-supersession.v1", "sup:x", {"cause": "corrected"}, actor=HUMAN,
                        occurred_at=T0, idempotency_key="s1")
    assert exc.value.code == "SUPERSESSION_WITHOUT_ADOPTION"


def test_event_chain_is_contiguous_and_tamper_evident():
    t = thread()
    analysis(t, key="k1")
    analysis(t, key="k2", at="2026-09-05T21:05:00Z")
    orders = [e["event_order"] for e in t.events]
    assert orders == [1, 2]
    assert t.events[1]["previous_event_hash"] == t.events[0]["event_hash"]
    assert t.verify_chain() == []
    tampered = copy.deepcopy(t)
    tampered.records[tampered.events[0]["after_ref"]["revision_id"]]["payload"]["envelope"]["claim_class"] = "supported"
    assert any("HASH_MISMATCH" in d for d in tampered.verify_chain())


def test_idempotency_returns_the_original_and_refuses_a_different_payload_under_the_same_key():
    t = thread()
    r1, e1 = analysis(t, key="same")
    r2, e2 = analysis(t, key="same")
    assert r2 is r1 and e2 is e1 and len(t.events) == 1
    env = example_envelope()
    env["claim_class_reason"] = "different"
    with pytest.raises(ThreadRefused) as exc:
        analysis(t, env, key="same")
    assert exc.value.code == "IDEMPOTENCY_CONFLICT"


def test_jsonl_round_trip_preserves_every_hash():
    t = thread()
    a, _ = analysis(t, key="k1")
    t.adopt(a["revision_id"], actor=HUMAN, role="empowered_official", occurred_at=T0, idempotency_key="a1")
    text = t.to_jsonl()
    back = Thread.from_jsonl(text)
    assert [e["event_hash"] for e in back.events] == [e["event_hash"] for e in t.events]
    assert back.verify_chain() == []
    assert back.latest_analysis("rev:" + "3" * 64, "commodity")["revision_id"] == a["revision_id"]
