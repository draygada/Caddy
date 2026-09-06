"""Call B and the escalation agent (F-08, F-17, THE BUILD §3.5, §3.12): one bounded search call, then code.

propose_alternative: the flipped line, its fired rows, the nearest release text and the fit comparator go to one
`search` call over the OWNED pool (the current part excluded); each returned {mpn, url} is fetched under the
allowlist, read, extracted (Call A), verified, dry-run, walked, screened and costed on copies; the result is an
agent `alternative_proposed` event. propose_escalation: the agent proposes SOURCES for an open escalation and is
never confident; a human resolves. Both abstain, never guess, on a cache miss, a budget breach or a schema-invalid
response. The model never sees the screening list or the rule table's thresholds.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from forge_sourcing.hashing import sha256, sha256_bytes

from .documents import document_text, hidden_spans, text_sha256
from .evaluate import CLAIM_CEILING, evaluate_candidate, rank
from .extract import extract
from .fetch import Fetcher
from .model import Abstain, Budget, BudgetedModel, BudgetExhausted, CacheModel, LiveAnthropicModel, ModelClient, prompt_sha256
from .prompts import escalation_prompt, search_prompt
from .rules import fields_for, load_rules, release_texts, rows_by_entry, rule_sentences
from .schemas import SEARCH_SCHEMA, validate


@dataclass
class Ports:
    fetcher: Fetcher
    model: ModelClient
    rules: dict
    pool: dict
    pool_sha256: str
    documents_sha256: str | None


def default_ports(data_dir: Path, *, mode: str = "cache", offline: bool = True, budget: Budget | None = None) -> Ports:
    data_dir = Path(data_dir)
    inner: ModelClient = LiveAnthropicModel() if mode == "live" else CacheModel(data_dir / "llm_cache")
    model = BudgetedModel(inner, budget) if budget else inner
    pool_raw = (data_dir / "search" / "pool.json").read_bytes()
    docs = data_dir / "search" / "documents.json"
    return Ports(fetcher=Fetcher(data_dir.parent / ".cache" / "fetch", docs, data_dir / "search" / "fixtures", offline=offline), model=model,
                 rules=load_rules(data_dir / "search" / "rules.DRAFT.json"), pool=json.loads(pool_raw.decode("utf-8")), pool_sha256=sha256_bytes(pool_raw),
                 documents_sha256=sha256_bytes(docs.read_bytes()) if docs.is_file() else None)


def _usage(model: ModelClient) -> dict | None:
    calls = getattr(model, "calls", [])
    return calls[-1].usage if calls else None


def _slot_for(pool: dict, node_id: str) -> dict | None:
    """Pool keys are the lane's node ids; `aliases` maps the engine fixture's and the frontend's ids onto them."""
    slots = pool["slots"]
    return slots.get(node_id) or slots.get((pool.get("aliases") or {}).get(node_id, ""))


def _pool_row(item: dict, by_mpn: dict, words: list[str]) -> dict | None:
    """A model row is a POINTER into the owned pool, never an address: the mpn must be a slot candidate and the url one
    of that candidate's own documents. Anything else is dropped in words and never fetched (S-1)."""
    cand = by_mpn.get(item["mpn"])
    if cand is None:
        words.append(f"{item['mpn']}: not in the pool; ignored")
        return None
    if item["url"] not in [d["url"] for d in cand["documents"]]:
        words.append(f"{item['mpn']}: url not among the candidate's documents; ignored")
        return None
    return cand


def candidate_pipeline(service, rnd: dict, line: dict, slot: dict, candidate: dict, url: str, ports: Ports, *, tripped: list[str]) -> dict:
    fr = ports.fetcher.fetch(url)
    document = {"url": url, "status": fr.status, "sha256": fr.sha256, "bytes": fr.bytes, "retrieved_at": fr.retrieved_at, "doc_sha256": None,
                "extract": None, "hidden_spans": []}
    specs: list = []
    if fr.ok():
        raw = ports.fetcher.read(fr)
        text = document_text(raw, url)
        document["doc_sha256"] = text_sha256(text)
        if url.lower().endswith((".html", ".htm")) or raw.lstrip().startswith(b"<"):
            document["hidden_spans"] = hidden_spans(raw)
        ex = extract(text, document["doc_sha256"], slot["part_class"], fields_for(ports.rules, slot["part_class"], slot["role"]),
                     rule_sentences(ports.rules, slot["part_class"], slot["role"]), ports.model)
        specs = ex.accepted
        document["extract"] = {"prompt_sha256": ex.prompt_sha256, "mode": ex.mode, "abstained": ex.abstained, "accepted": len(ex.accepted),
                               "rejected": [{"reason": r["reason"], "detail": r["detail"], "quote": r["claim"].get("quote")} for r in ex.rejected], "usage": ex.usage}
    ev = evaluate_candidate(service, rnd, line, slot, candidate, specs=specs, rules=ports.rules, tripped=tripped)
    ev["document"] = document
    if not fr.ok():
        ev["reasons"].insert(0, f"no document: {fr.status}")
    elif document["extract"]["abstained"]:
        ev["reasons"].insert(0, f"extraction abstained: {document['extract']['abstained']}")
    for h in document["hidden_spans"]:
        ev["words"].insert(1, f"hidden line in the page: '{h}' — no schema slot for a classification; the number in it was not parseable")
    ev["words"].insert(1, f"document: {url} · {fr.status}" + (f" · sha {fr.sha256[:8]}" if fr.sha256 else ""))
    return ev


def _finish(service, rnd: dict, proposal: dict) -> dict:
    proposal["claim_ceiling"] = CLAIM_CEILING
    if proposal["abstained"]:       # a proposal that abstained is never green and never confident, however far it got; the cards it read stay
        proposal["status"], proposal["confident"] = "grey", False
    body = {k: v for k, v in proposal.items() if k not in ("proposal_id", "seq")}
    proposal["proposal_id"] = "proposal:" + sha256(body)
    service.record_proposal(rnd["round_id"], proposal)
    return proposal


def _base(kind: str, rnd: dict, line: dict, ports: Ports, proposed_at: str, **extra) -> dict:
    return {"proposal_id": None, "kind": kind, "round_id": rnd["round_id"], "line_id": line["line_id"], "mpn_current": line["mpn"], "escalation_reason": None,
            "status": "grey", "confident": False, "abstained": None, "candidates": [], "ranked": [], "needs_input": [], "rejected": [],
            "mode": getattr(ports.model, "mode", "SCRIPTED"), "prompt_sha256": None, "pool_sha256": ports.pool_sha256, "rules_sha256": ports.rules["sha256"],
            "documents_sha256": ports.documents_sha256, "usage": None, "reasons": [], "words": [], "proposed_at": proposed_at, **extra}


def propose_alternative(service, round_id: str, line_id: str, ports: Ports, *, proposed_at: str) -> dict:
    rnd = service._round(round_id)
    line = service._line(rnd, line_id)
    tripped = list(line["evaluation"].get("fired") or [])
    proposal = _base("alternative", rnd, line, ports, proposed_at, tripped=tripped)
    slot = _slot_for(ports.pool, line["node_id"])
    if slot is None:
        proposal.update(abstained=f"no candidate pool for node {line['node_id']}", words=[f"abstained: no candidate pool for {line['node_id']}"])
        return _finish(service, rnd, proposal)
    if not tripped:
        proposal.update(abstained="no fired row on this line; nothing to search for", words=["abstained: no fired row on this line"])
        return _finish(service, rnd, proposal)
    by_entry = rows_by_entry(ports.rules)
    tripped_rows = [by_entry[e] for e in tripped if e in by_entry]
    candidates = [c for c in slot["candidates"] if c["mpn"] != line["mpn"]]
    prompt = search_prompt(line, tripped_rows, release_texts(ports.rules, slot["part_class"], slot["role"]), slot["comparator"], candidates)
    proposal["prompt_sha256"] = prompt_sha256("search", prompt)
    try:
        response = ports.model.propose("search", prompt, SEARCH_SCHEMA)
        proposal["usage"] = _usage(ports.model)
        if isinstance(response, Abstain):
            proposal.update(abstained=response.reason, words=[f"abstained: {response.reason}"])
            return _finish(service, rnd, proposal)
        error = validate(response, SEARCH_SCHEMA)
        if error:
            proposal.update(abstained=f"schema violation: {error}", words=[f"abstained: schema violation: {error}"])
            return _finish(service, rnd, proposal)
        by_mpn = {c["mpn"]: c for c in candidates}
        for item in response["candidates"]:
            cand = _pool_row(item, by_mpn, proposal["words"])
            if cand is None:
                continue
            proposal["candidates"].append(candidate_pipeline(service, rnd, line, slot, cand, item["url"], ports, tripped=tripped))
    except BudgetExhausted as error:
        proposal.update(abstained=f"budget: {error}")
        proposal["words"].append(f"abstained: budget: {error}")
    ranked = rank(proposal["candidates"])
    proposal.update(ranked=[e["mpn"] for e in ranked["ranked"]], needs_input=[e["mpn"] for e in ranked["needs_input"]], rejected=[e["mpn"] for e in ranked["rejected"]])
    if proposal["candidates"]:
        proposal["status"] = "green" if ranked["ranked"] else "grey" if ranked["needs_input"] else "red"
    proposal["confident"] = bool(ranked["ranked"]) and proposal["abstained"] is None
    proposal["words"].insert(0, f"proposal · {line['slot']} · {line['mpn']} fired {', '.join(tripped)} · {len(proposal['candidates'])} candidates read · "
                                f"{len(proposal['ranked'])} green · {len(proposal['needs_input'])} needs input · {len(proposal['rejected'])} rejected · "
                                f"{'confident' if proposal['confident'] else 'not confident'} · {proposal['mode']} · [Accept in the design lane] [Reject]")
    return _finish(service, rnd, proposal)


def propose_escalation(service, round_id: str, line_id: str, reason: str, ports: Ports, *, proposed_at: str) -> dict:
    rnd = service._round(round_id)
    line = service._line(rnd, line_id)
    proposal = _base("escalation", rnd, line, ports, proposed_at, escalation_reason=reason, tripped=[])
    if not any(e["reason"] == reason and e["state"] == "open" for e in line["escalations"]):
        proposal.update(abstained=f"no open escalation {reason} on {line_id}", words=[f"abstained: no open escalation {reason}"])
        return _finish(service, rnd, proposal)
    slot = _slot_for(ports.pool, line["node_id"]) or {"candidates": []}
    candidates = [c for c in slot["candidates"] if c["mpn"] == line["mpn"]]
    prompt = escalation_prompt(line, reason, candidates)
    proposal["prompt_sha256"] = prompt_sha256("escalation", prompt)
    try:
        response = ports.model.propose("escalation", prompt, SEARCH_SCHEMA)
        proposal["usage"] = _usage(ports.model)
        if isinstance(response, Abstain):
            proposal.update(abstained=response.reason, words=[f"abstained: {response.reason}"])
            return _finish(service, rnd, proposal)
        error = validate(response, SEARCH_SCHEMA)
        if error:
            proposal.update(abstained=f"schema violation: {error}", words=[f"abstained: schema violation: {error}"])
            return _finish(service, rnd, proposal)
        by_mpn = {c["mpn"]: c for c in candidates}
        for item in response["candidates"]:
            if _pool_row(item, by_mpn, proposal["words"]) is None:
                continue
            fr = ports.fetcher.fetch(item["url"])
            entry = {"mpn": item["mpn"], "url": item["url"], "status": "grey", "document": {"url": item["url"], "status": fr.status, "sha256": fr.sha256, "bytes": fr.bytes, "retrieved_at": fr.retrieved_at},
                     "words": [f"source: {item['url']} · {fr.status}" + (" · a human reads it; origin is a declaration, not a datasheet number the verifier can bind" if fr.ok() else " · no source resolved")]}
            proposal["candidates"].append(entry)
    except BudgetExhausted as error:
        proposal.update(abstained=f"budget: {error}")
    resolved = [c for c in proposal["candidates"] if c["document"]["sha256"]]
    proposal["reasons"] = ["no source resolved" if not resolved else f"{len(resolved)} source(s) fetched; a human reads them and resolves"]
    proposal["status"], proposal["confident"] = "grey", False
    proposal["words"].insert(0, f"proposal · {reason} · {line['mpn']} · {', '.join(proposal['reasons'])} · not confident · {proposal['mode']} · [Accept] [Reject]")
    return _finish(service, rnd, proposal)
