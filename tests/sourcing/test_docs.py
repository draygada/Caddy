"""The words are in the glossary, the decisions are written down, and every kind the thread emits is in the schema proposal."""
from __future__ import annotations

import json
from pathlib import Path

from conftest import DATA, make_ports, run_s1
from test_sourcing_flips import _select_all

PKG = DATA.parent


def test_context_names_the_search_terms():
    text = (PKG / "CONTEXT.md").read_text(encoding="utf-8")
    for term in ("**Candidate pool**", "**Document**", "**Span**", "**Verified spec**", "**Dry-run**", "**Fit comparator**", "**Green / grey / red**", "**Proposal**", "**Confident**", "**Hidden line**"):
        assert term in text, term


def test_adrs_and_readme_carry_the_decisions_and_the_claim_sentence():
    adr = PKG / "docs" / "adr"
    assert (adr / "0004-a-bounded-proposer-over-an-owned-pool.md").is_file() and (adr / "0005-pypdf-pinned-character-offsets-hidden-text-kept.md").is_file()
    readme = (PKG / "README.md").read_text(encoding="utf-8")
    assert "No part-search, BOM or component-intelligence tool we found computes or filters parts by export-control jurisdiction" in readme
    assert "make eval" in readme and "record-cache" in readme and "calls for" in readme and "high-impact" in readme
    assert "requires documented human-oversight" not in readme and "interface research finds" not in readme


def test_every_emitted_kind_is_in_the_schema_proposal(service, baseline, f3_state):
    from forge_search.model import ScriptedModel
    from forge_search.propose import propose_alternative, propose_escalation
    rid = run_s1(service, baseline)
    _select_all(service, rid)
    service.resolve_escalation(rid, "line:io_mcu", "origin_depends_on_lot", attestor="charlie", resolution={"origin": "MY"})
    service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    packet = service.create_packet(rid, recipient_placeholder="[SYNTHETIC]", approver={"identity": "charlie", "authority_basis": "demo"}, created_at="2026-09-06T03:01:00Z")
    service.dispatch(packet["packet_id"], idempotency_key="k1", attestor="charlie", dispatched_at="2026-09-06T03:02:00Z")
    service.close_order(packet["packet_id"], receiving=None, inspection=None, attestor="charlie", closed_at="2026-09-06T03:03:00Z")
    r = service.open_round(f3_state, ship_to="TW-assembly", quantity=1, transport_mode="air", request_key="tw", opened_at="2026-09-06T03:04:00Z")
    service.resolve(r["round_id"]); service.screen(r["round_id"]); service.cost(r["round_id"], entry_date="2026-09-06")
    service.gate(r["round_id"]); service.declare(r["round_id"], party="assembler", person_status="foreign_person", sharing="controlled_drawings", reference="LIC-000", attestor="charlie")
    service.rescreen(r["round_id"]); service.refine(r["round_id"], quantity=2)
    ports = make_ports(ScriptedModel({"search": [{"candidates": []}], "escalation": [{"candidates": []}]}))
    p = propose_alternative(service, r["round_id"], "line:thermal_core", ports, proposed_at="2026-09-06T03:05:00Z")
    service.reject_proposal(r["round_id"], p["proposal_id"], attestor="charlie", reason="demo")
    rid3 = run_s1(service, baseline, request_key="esc")
    propose_escalation(service, rid3, "line:io_mcu", "origin_depends_on_lot", ports, proposed_at="2026-09-06T03:06:00Z")
    emitted = {e["kind"] for e in service.thread.events}
    proposal = json.loads((PKG / "handoff" / "log-schema-kinds.proposed.json").read_text(encoding="utf-8"))
    assert emitted <= set(proposal["kind_enum_additions"]), emitted - set(proposal["kind_enum_additions"])
