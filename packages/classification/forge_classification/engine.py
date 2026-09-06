"""The engine: `determine(snapshot, pack, model, budget) -> determination`. End to end, no human gate.

The engine performs no I/O of its own, reads no clock and persists nothing; its two effects — model
calls and stage notifications — go through callables the caller injects. The model fills
per-provision records inside one wave at a time; code owns every conclusion.

Waves: USML proposal (recall-biased; retried once if empty) -> per-provision advocate -> verifier ->
per-provision judge -> USML step -> CCL proposal (only on a recorded USML negative) -> the CCL stages
walked in order, each analysed only when the earlier one closed negative -> the determination.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable

from . import reconcile, route as route_module
from .hashing import sha256
from .model import Abstain, Budget, BudgetExhausted, ModelClient, prompt_sha256
from .pack import ReferencePack, canonical_provision
from .snapshot import FactSnapshot

SCHEMA_VERSION = "forge-classification.determination/1"
TOP_K = 8


class ModelUnavailable(Exception):
    """Both proposal calls abstained: there is no analysis, so nothing is returned."""


@dataclass(frozen=True)
class ProposalBatch:
    """A proposal response after local structural and reference-pack validation."""

    candidates: list[dict]
    status: str
    reason: str | None
    specially_designed_read: str | None
    explicit_empty: bool


# --- Wave tool schemas: no writable conclusion anywhere -----------------------------------------

def _obj(properties: dict, required: list[str]) -> dict:
    return {"type": "object", "properties": properties, "required": required, "additionalProperties": False}


_CITATION = {"type": ["object", "null"], "properties": {
    "unit_key": {"type": "string"}, "unit_sha256": {"type": "string"}, "quote": {"type": "string"},
    "start": {"type": "integer"}, "end": {"type": "integer"}},
    "required": ["unit_key", "unit_sha256", "quote", "start", "end"], "additionalProperties": False}


def _element_schema(dispositions: tuple[str, ...]) -> dict:
    return _obj({
        "element_id": {"type": "string"},
        "unit_key": {"type": "string", "description": "The reference-pack unit this element reads; the provision itself or a parent paragraph."},
        "disposition": {"type": "string", "enum": list(dispositions)},
        "basis": {"type": "string", "enum": list(reconcile.BASES)},
        "facts_relied_on": {"type": "array", "items": {"type": "string"}, "description": "Fact paths from the snapshot."},
        "citation": _CITATION,
    }, ["element_id", "unit_key", "disposition", "basis", "facts_relied_on", "citation"])


_PROPOSAL_ITEMS = {"type": "array", "items": _obj({
    "provision": {"type": "string"},
    "why_considered": {"type": "string"},
    "via": {"type": "string", "enum": ["enumerated", "specially_designed"]},
}, ["provision", "why_considered"])}

PROMPT_SCHEMAS: dict[str, dict] = {
    "usml_propose": _obj({
        "candidates": _PROPOSAL_ITEMS,
        "specially_designed_read": {"type": "string"},
        "no_usml_reasoning": {"type": "string"},
    }, ["candidates", "specially_designed_read", "no_usml_reasoning"]),
    "ccl_propose": _obj({
        "candidates": _PROPOSAL_ITEMS,
        "specially_designed_read": {"type": "string"},
        # Accepted for compatibility with shared proposal fixtures; it is never used in the CCL decision.
        "no_usml_reasoning": {"type": "string"},
    }, ["candidates"]),
    "advocate": _obj({
        "provision": {"type": "string"},
        "elements": {"type": "array", "items": _element_schema(reconcile.ADVOCATE_DISPOSITIONS)},
        "case_for": {"type": "string"},
    }, ["provision", "elements", "case_for"]),
    "judge": _obj({
        "provision": {"type": "string"},
        "ruling": {"type": "string", "enum": list(reconcile.RULINGS)},
        "elements": {"type": "array", "items": _element_schema(reconcile.JUDGE_DISPOSITIONS)},
        "reason": {"type": "string"},
        "challenge": {"type": ["object", "null"], "properties": {"text": {"type": "string"}, "resolution": {"type": "string", "enum": ["sustained", "rejected"]}},
                      "required": ["text", "resolution"], "additionalProperties": False},
    }, ["provision", "ruling", "elements", "reason", "challenge"]),
}


# --- Prompts -----------------------------------------------------------------------------------

def _facts_block(snapshot: FactSnapshot) -> str:
    lines = [f"ITEM: {snapshot.item_kind}" + (f" of part revision {snapshot.part_revision_id}" if snapshot.part_revision_id else ""),
             f"DESCRIPTION: {snapshot.description}", "FACTS:"]
    for path, fact in sorted(snapshot.facts.items()):
        unit = f" {fact.unit}" if fact.unit else ""
        lines.append(f"  {path} = {fact.value}{unit}{'  [recorded unknown]' if fact.recorded_unknown else ''}")
    return "\n".join(lines)


def _unit_block(pack: ReferencePack, provision: str) -> str:
    lines = []
    key = canonical_provision(provision)
    while key:
        unit = pack.units.get(key)
        if unit is None:
            break
        lines.append(f"[{unit.unit_key}] sha256={unit.sha256} :: {unit.text}")
        for note in unit.notes[:4]:
            lines.append(f"    note: {note[:600]}")
        key = unit.parent
    return "\n".join(lines)


def _usml_propose_prompt(snapshot: FactSnapshot, pack: ReferencePack, retry: bool) -> str:
    cats = "\n".join(f"  USML {r}: {pack.units[f'USML {r}'].text}" for r in pack.categories)
    ask = ("Wave 1 retry. The prior proposal recorded no usable candidates, but the USML step must be demonstrated "
           "against real paragraphs even when the answer is negative. Propose the one to four nearest-miss USML "
           "paragraphs a skeptical reviewer would raise so each can be walked to a cited disposition."
           if retry else
           "Wave 1: propose every USML paragraph (category and subparagraph, e.g. 'USML XI(c)(2)') whose text this item could "
           "plausibly trip, including a 22 CFR 120.41 specially-designed read. Recall over precision — the analysis knocks out. "
           "Never propose a provision absent from the list below. If nothing plausibly applies, still propose the nearest-miss paragraphs.")
    return "\n".join([_facts_block(snapshot), "", "USML CATEGORIES IN THIS REFERENCE PACK:", cats, "", ask])


def _ccl_propose_prompt(snapshot: FactSnapshot, usml_summary: str) -> str:
    return "\n".join([
        _facts_block(snapshot), "", "USML STEP (recorded, immutable):", usml_summary, "",
        "Wave 3: the USML step closed negative. Propose every CCL entry paragraph (e.g. '9A012.a.2', '3A611.g', '9A610.x') "
        "the item could plausibly meet, across 600-series and 9x515 entries, their specially-designed paragraphs, and other ECCNs. "
        "Recall over precision. Never propose a code absent from the CCL. EAR99 is seated by code; do not propose it.",
        "If any candidate uses via=specially_designed, set specially_designed_read to exactly one leading state: "
        "'caught: ...', 'released: ...', or 'undetermined: ...'. Do not turn that read into a legal conclusion.",
    ])


def _advocate_prompt(snapshot: FactSnapshot, pack: ReferencePack, provision: str) -> str:
    return "\n".join([
        f"PROVISION: {provision}", "", _facts_block(snapshot), "", "REFERENCE TEXT (the only text you may cite; quote byte-exact spans):",
        _unit_block(pack, provision), "",
        "You are the advocate for this provision and this provision only. Make the strongest honest case that it applies: "
        "walk every element of the paragraph; for each, record met or indeterminate (you may not record not_met), the basis, "
        "the fact paths relied on, and a byte-exact citation {unit_key, unit_sha256, quote, start, end} into the reference text.",
    ])


def _judge_prompt(snapshot: FactSnapshot, pack: ReferencePack, provision: str, case: list[dict], case_for: str) -> str:
    lines = [f"PROVISION: {provision}", "", _facts_block(snapshot), "", "REFERENCE TEXT:", _unit_block(pack, provision), "",
             "THE ADVOCATE'S CASE (citations already verified; unverified citations were struck):", f"  case_for: {case_for}"]
    for el in case:
        cite = f"quote={el['citation']['quote']!r} [{el['citation']['unit_key']}]" if el["citation"] else "no verified citation"
        lines.append(f"  {el['element_id']}: {el['disposition']} ({el['basis']}; facts={','.join(el['facts_relied_on'])}; {cite})")
    lines += ["", "You are the judge for this provision and this provision only. Rule supported, knocked_out or undetermined. "
              "You may rule knocked_out ONLY on an element you record as not_met with a byte-exact citation to the reference text. "
              "Rule supported only when every element is met on the facts given. Record the strongest challenge to your own ruling and whether it is sustained."]
    return "\n".join(lines)


# --- The engine ---------------------------------------------------------------------------------

def _response_hash(response: object) -> str | None:
    if isinstance(response, Abstain):
        return None
    return sha256(json.dumps(response, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8"))


class _Run:
    def __init__(self, snapshot: FactSnapshot, pack: ReferencePack, model: ModelClient, budget: Budget,
                 progress: Callable[[str], None] | None):
        self.snapshot, self.pack, self.model, self.budget, self.progress = snapshot, pack, model, budget, progress
        self.calls: list[dict] = []
        self.dropped: list[dict] = []
        self.reference_notes: list[str] = []
        self.candidate_seq = 0

    def call(self, kind: str, prompt: str, *, provision: str | None = None) -> dict | Abstain:
        if self.progress:
            self.progress(kind)
        before = self.budget.cost_used_microusd
        response = self.model.propose(kind, prompt, PROMPT_SCHEMAS[kind])
        self.calls.append({
            "stage": kind, "provision": provision, "prompt_sha256": prompt_sha256(kind, prompt),
            "response_sha256": _response_hash(response), "cost_microusd": self.budget.cost_used_microusd - before,
        })
        return response

    def proposals(self, response: object, *, list_name: str) -> ProposalBatch:
        kind = f"{list_name.lower()}_propose"
        if isinstance(response, Abstain):
            reason = f"{list_name} proposal unavailable: {response.reason}"
            self.reference_notes.append(reason)
            return ProposalBatch([], "unavailable", reason, None, False)
        if not isinstance(response, dict):
            reason = f"{list_name} proposal malformed: response is not an object"
            self.reference_notes.append(reason)
            return ProposalBatch([], "malformed", reason, None, False)

        schema = PROMPT_SCHEMAS[kind]
        allowed_keys = set(schema["properties"])
        missing_keys = set(schema["required"]) - set(response)
        extra_keys = set(response) - allowed_keys
        if missing_keys or extra_keys:
            details = []
            if missing_keys:
                details.append(f"missing {', '.join(sorted(missing_keys))}")
            if extra_keys:
                details.append(f"unexpected {', '.join(sorted(extra_keys))}")
            reason = f"{list_name} proposal malformed: {'; '.join(details)}"
            self.reference_notes.append(reason)
            return ProposalBatch([], "malformed", reason, None, False)

        raw_candidates = response.get("candidates")
        if not isinstance(raw_candidates, list):
            reason = f"{list_name} proposal malformed: candidates is not an array"
            self.reference_notes.append(reason)
            return ProposalBatch([], "malformed", reason, None, False)
        for index, raw in enumerate(raw_candidates):
            if not isinstance(raw, dict):
                reason = f"{list_name} proposal malformed: candidate {index} is not an object"
                self.reference_notes.append(reason)
                return ProposalBatch([], "malformed", reason, None, False)
            missing = {"provision", "why_considered"} - set(raw)
            extra = set(raw) - {"provision", "why_considered", "via"}
            if missing or extra or not isinstance(raw.get("provision"), str) or not isinstance(raw.get("why_considered"), str):
                reason = f"{list_name} proposal malformed: candidate {index} does not match the proposal schema"
                self.reference_notes.append(reason)
                return ProposalBatch([], "malformed", reason, None, False)
            if "via" in raw and raw["via"] not in ("enumerated", "specially_designed"):
                reason = f"{list_name} proposal malformed: candidate {index} has an invalid via value"
                self.reference_notes.append(reason)
                return ProposalBatch([], "malformed", reason, None, False)
        for field in ("specially_designed_read", "no_usml_reasoning"):
            if field in response and not isinstance(response[field], str):
                reason = f"{list_name} proposal malformed: {field} is not a string"
                self.reference_notes.append(reason)
                return ProposalBatch([], "malformed", reason, None, False)

        seen: set[str] = set()
        out: list[dict] = []
        for raw in raw_candidates:
            provision_raw = str(raw.get("provision") or "")
            key = canonical_provision(provision_raw)
            unit = self.pack.units.get(key) if key else None
            if unit is None:
                self.dropped.append({"provision": provision_raw, "reason": "does not resolve in the reference pack"})
                continue
            is_usml = key.startswith("USML") or key.startswith("22 CFR 120.41")
            if list_name == "USML" and not is_usml:
                self.dropped.append({"provision": key, "reason": "not a USML provision in the USML wave"})
                continue
            if list_name == "CCL" and (is_usml or key in ("EAR99", "NOT_SUBJECT")):
                self.dropped.append({"provision": key, "reason": "not a CCL entry in the CCL wave"})
                continue
            if key in seen:
                continue
            seen.add(key)
            why, hits = reconcile.generalise_stray_codes(str(raw.get("why_considered") or ""), self.pack)
            self.reference_notes.extend(f"stray code {h} in why_considered for {key} was generalised" for h in hits)
            out.append(self.new_candidate(key, "proposed", why, via=str(raw.get("via") or "enumerated")))
        if len(out) > TOP_K:
            reason = (f"{list_name} proposal rejected before execution: {len(out)} reference-valid candidates "
                      f"exceed the top-{TOP_K} admission cap")
            for candidate in out:
                self.dropped.append({"provision": candidate["provision"], "reason": reason})
            self.reference_notes.append(reason)
            return ProposalBatch([], "over_cap", reason, response.get("specially_designed_read"), False)
        explicit_empty = not raw_candidates
        if raw_candidates and not out:
            reason = f"{list_name} proposal unresolved: no proposed candidate resolves in the reference pack"
            self.reference_notes.append(reason)
            return ProposalBatch([], "unresolved", reason, response.get("specially_designed_read"), False)
        return ProposalBatch(out, "valid", None, response.get("specially_designed_read"), explicit_empty)

    def admit_wave(self, list_name: str, candidates: list[dict]) -> None:
        """Reject a whole wave before its first advocate call when it cannot finish."""
        required_calls = len(candidates) * 2
        remaining_calls = self.budget.calls_cap - self.budget.calls_used
        estimated_cost = getattr(self.model, "estimated_cost_microusd", None)
        remaining_cost = self.budget.cost_cap_microusd - self.budget.cost_used_microusd
        cost_shortfall = (isinstance(estimated_cost, int)
                          and remaining_cost < required_calls * estimated_cost)
        if remaining_calls < required_calls or cost_shortfall:
            estimate_text = (f", required_cost_microusd={required_calls * estimated_cost}, "
                             f"remaining_cost_microusd={remaining_cost}"
                             if isinstance(estimated_cost, int) else "")
            raise BudgetExhausted(
                f"{list_name} candidate wave rejected before execution: candidates={len(candidates)}, "
                f"required_calls={required_calls}, remaining_calls={remaining_calls}{estimate_text}"
            )

    def new_candidate(self, provision: str, origin: str, why: str, *, via: str = "enumerated") -> dict:
        self.candidate_seq += 1
        identity = sha256(
            f"{self.snapshot.sha256}:{self.pack.sha256}:{self.candidate_seq}:{provision}".encode("utf-8")
        )
        return {
            "candidate_id": f"cand:{identity}",
            "provision": provision,
            "stage": route_module.stage_for(provision, via=via),
            "status": "not_reached",
            "ruling": "not_reached",
            "origin": origin,
            "why_considered": why,
            "why_rejected": None,
            "elements": [],
            "challenge": None,
            "reference_notes": [],
        }

    def analyse(self, cand: dict) -> None:
        provision = cand["provision"]
        advocate_response = self.call("advocate", _advocate_prompt(self.snapshot, self.pack, provision), provision=provision)
        if isinstance(advocate_response, Abstain):
            cand["reference_notes"].append(f"advocate unavailable ({advocate_response.reason}); the candidate is undetermined, never knocked out")
            self.finish(cand, "undetermined", [], None, None)
            return
        case, notes = reconcile.normalise_elements(advocate_response.get("elements"), pack=self.pack,
                                                   allowed=reconcile.ADVOCATE_DISPOSITIONS, who="advocate", default_unit=provision)
        cand["reference_notes"].extend(notes)
        judge_response = self.call("judge", _judge_prompt(self.snapshot, self.pack, provision, case, str(advocate_response.get("case_for") or "")),
                                   provision=provision)
        if isinstance(judge_response, Abstain):
            cand["reference_notes"].append(f"judge unavailable ({judge_response.reason}); the candidate is undetermined, never knocked out")
            self.finish(cand, "undetermined", case, None, None)
            return
        elements, notes = reconcile.normalise_elements(judge_response.get("elements"), pack=self.pack,
                                                       allowed=reconcile.JUDGE_DISPOSITIONS, who="judge", default_unit=provision)
        cand["reference_notes"].extend(notes)
        # An element the advocate left open survives a judge that does not address it.
        judged_ids = {e["element_id"] for e in elements}
        for el in case:
            if el["disposition"] == "indeterminate" and el["element_id"] not in judged_ids:
                elements.append({**el, "citation": None})
                cand["reference_notes"].append(f"element {el['element_id']} carried from the advocate: the judge did not address it")
        challenge = judge_response.get("challenge")
        if isinstance(challenge, dict) and challenge.get("resolution") in ("sustained", "rejected"):
            challenge = {"text": str(challenge.get("text") or ""), "resolution": challenge["resolution"]}
        else:
            challenge = None
        status, notes = reconcile.reconcile_ruling(judge_response.get("ruling"), elements, challenge)
        cand["reference_notes"].extend(notes)
        reason, hits = reconcile.generalise_stray_codes(str(judge_response.get("reason") or ""), self.pack)
        self.reference_notes.extend(f"stray code {h} in the judge's reason for {provision} was generalised" for h in hits)
        self.finish(cand, status, elements, challenge, reason)

    def finish(self, cand: dict, status: str, elements: list[dict], challenge: dict | None, reason: str | None) -> None:
        cand["elements"] = elements
        cand["ruling"] = status
        cand["status"] = status
        cand["challenge"] = challenge
        cand["why_rejected"] = reason if status == "knocked_out" else None

    def not_reached(self, cand: dict) -> None:
        cand["ruling"] = "not_reached"
        cand["status"] = "not_reached"

    def usml_summary(self, usml: list[dict]) -> str:
        return "\n".join(f"  {c['provision']}: {c['ruling']} — {c['why_rejected'] or ''}" for c in usml) or "  (no candidates)"


def determine(snapshot: FactSnapshot, pack: ReferencePack, model: ModelClient, budget: Budget, *,
              progress: Callable[[str], None] | None = None) -> dict:
    run = _Run(snapshot, pack, model, budget, progress)

    first = run.call("usml_propose", _usml_propose_prompt(snapshot, pack, retry=False))
    usml_batch = run.proposals(first, list_name="USML")
    if not usml_batch.candidates:
        second = run.call("usml_propose", _usml_propose_prompt(snapshot, pack, retry=True))
        retry_batch = run.proposals(second, list_name="USML")
        if retry_batch.candidates or usml_batch.status != "valid":
            usml_batch = retry_batch
        if isinstance(first, Abstain) and isinstance(second, Abstain):
            raise ModelUnavailable(f"usml_propose: {first.reason}; retry: {second.reason}")
    usml = usml_batch.candidates
    usml_special = route_module.reconcile_specially_designed(
        usml_batch.specially_designed_read, usml, scope="USML", required=True
    )
    if usml_batch.status == "valid" and usml_special[0] != "blocked":
        run.admit_wave("USML", usml)
        for cand in usml:
            run.analyse(cand)

    residual = run.new_candidate("EAR99", "floor", "The residual is seated on every board; it is elected only when every specific candidate is knocked out.")
    ccl: list[dict] = []
    ccl_by_stage: dict[str, list[dict]] = {}
    residual_reached = None
    ccl_review = ("not_reached", None, False)
    ccl_special = ("closed", "CCL specially-designed read not reached", [])
    if usml_batch.status == "valid" and usml_special[0] != "blocked" and route_module.decide_step(usml)[0] == "negative":
        ccl_batch = run.proposals(
            run.call("ccl_propose", _ccl_propose_prompt(snapshot, run.usml_summary(usml))), list_name="CCL"
        )
        ccl = ccl_batch.candidates
        ccl_review = (ccl_batch.status, ccl_batch.reason, ccl_batch.explicit_empty)
        ccl_special = route_module.reconcile_specially_designed(
            ccl_batch.specially_designed_read, ccl, scope="CCL",
            required=any(c["stage"] == "specially_designed_ear" for c in ccl),
        )
        if ccl_batch.status == "valid" and ccl_special[0] != "blocked":
            run.admit_wave("CCL", ccl)
            for stage in route_module.CCL_STAGES:
                in_stage = [c for c in ccl if c["stage"] == stage]
                for cand in in_stage:
                    run.analyse(cand)
                ccl_by_stage[stage] = in_stage
                if route_module.decide_step(in_stage)[0] in ("supported", "undetermined"):
                    break
            else:
                residual_reached = residual
                residual["ruling"] = residual["status"] = "supported"
    for cand in [*ccl, residual]:
        if cand["ruling"] == "not_reached":
            run.not_reached(cand)

    determination = route_module.assemble(
        usml, ccl_by_stage, residual_reached,
        usml_special=usml_special, ccl_special=ccl_special, ccl_review=ccl_review,
    )
    candidates = sorted([*usml, *ccl, residual], key=lambda c: (route_module.STAGE_ORDER.index(c["stage"]), c["candidate_id"]))
    return {
        "schema_version": SCHEMA_VERSION,
        "snapshot_sha256": snapshot.sha256,
        "pack_sha256": pack.sha256,
        "item": {"part_revision_id": snapshot.part_revision_id, "item_kind": snapshot.item_kind},
        "determination": determination,
        "candidates": [{k: v for k, v in c.items() if k != "ruling"} for c in candidates],
        "provenance": {
            "model": type(model.inner).__name__ if hasattr(model, "inner") else type(model).__name__,
            "calls": run.calls,
            "budget": budget.as_dict(),
            "dropped_candidates": run.dropped,
            "reference_notes": run.reference_notes,
        },
    }
