"""Proposals: an agent writes *_proposed only; a human accepts or rejects; the round view carries them."""
from __future__ import annotations

import pytest

from conftest import DATA, run_s1


def _proposal(kind="alternative", line_id="line:thermal_core", status="green", reason=None):
    return {"proposal_id": f"proposal:{kind}-1", "kind": kind, "line_id": line_id, "escalation_reason": reason, "status": status, "confident": status == "green",
            "candidates": [{"mpn": "500-0771-01", "status": status}], "mode": "SCRIPTED", "prompt_sha256": "p" * 64, "pool_sha256": "q" * 64, "rules_sha256": "r" * 64,
            "abstained": None, "proposed_at": "2026-09-06T02:30:00Z", "words": ["proposal words"]}


def test_record_proposal_appends_an_agent_event_and_the_view_carries_it(service, baseline):
    rid = run_s1(service, baseline)
    receipt = service.record_proposal(rid, _proposal())
    ev = service.thread.events[-1]
    assert ev["kind"] == "alternative_proposed" and ev["actor_kind"] == "agent" and ev["attestor"] is None and ev["seq"] == receipt["seq"]
    assert ev["pool_sha256"] == "q" * 64 and ev["candidates"] == [{"mpn": "500-0771-01", "status": "green"}]
    view = service.round_view(rid)
    assert view["proposals"][0]["proposal_id"] == "proposal:alternative-1" and view["proposals"][0]["seq"] == receipt["seq"]
    row = next(r for r in service.timeline(rid) if r["kind"] == "alternative_proposed")
    assert row["lane"] == "proposal" and "not confident" not in row["words"] and "confident" in row["words"]


def test_accepting_an_escalation_proposal_is_a_human_resolution(service, baseline):
    rid = run_s1(service, baseline)
    service.record_proposal(rid, _proposal("escalation", "line:io_mcu", "grey", "origin_depends_on_lot"))
    esc = service.accept_proposal(rid, "proposal:escalation-1", attestor="charlie")
    assert esc["state"] == "resolved" and esc["resolved_by"] == "charlie" and esc["tag"] == "human-resolved"
    assert esc["resolution"]["proposal_id"] == "proposal:escalation-1"
    ev = service.thread.events[-1]
    assert ev["kind"] == "escalation_resolved" and ev["actor_kind"] == "human" and ev["attestor"] == "charlie"


def test_accepting_an_alternative_is_refused_here_and_rejection_is_recorded(service, baseline):
    from forge_sourcing.round import RoundRefused
    rid = run_s1(service, baseline)
    service.record_proposal(rid, _proposal())
    with pytest.raises(RoundRefused, match="design lane"):
        service.accept_proposal(rid, "proposal:alternative-1", attestor="charlie")
    service.reject_proposal(rid, "proposal:alternative-1", attestor="charlie", reason="wrong socket")
    ev = service.thread.events[-1]
    assert ev["kind"] == "proposal_rejected" and ev["attestor"] == "charlie" and ev["reason"] == "wrong socket"
    assert service.round_view(rid)["proposals"][0]["rejected_by"] == "charlie"
    with pytest.raises(RoundRefused):
        service.accept_proposal(rid, "proposal:nope", attestor="charlie")
