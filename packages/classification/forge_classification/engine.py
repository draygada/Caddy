"""The engine: `classify(snapshot, pack, model, budget) -> envelope`. Pure in the sense that matters.

The engine performs no I/O of its own, reads no clock and persists nothing; its two effects — model
calls and stage notifications — go through callables the caller injects. The model fills
per-provision records inside one wave at a time; code owns every conclusion.

Waves: USML proposal (recall-biased; retried once if empty) -> per-provision advocate -> verifier ->
per-provision judge -> USML route -> CCL proposal (only on a recorded USML negative) -> the CCL
stages walked in order, each analysed only when the earlier one closed negative -> concerns
(non-dispositive) -> route -> claim class -> questions -> envelope.
"""

from __future__ import annotations

import json
from typing import Callable

from . import claim as claim_module
from . import reconcile, route as route_module
from .model import Abstain, Budget, ModelClient
from .pack import ReferencePack, canonical_provision, resolve
from .questions import assess_readiness, derive_questions
from .records import sha256
from .snapshot import FactSnapshot
from .model import prompt_sha256

ENVELOPE_SCHEMA_VERSION = "forge-classification.envelope/1"
TOP_K = 8


class ModelUnavailable(Exception):
    """Both proposal calls abstained: there is no analysis to record, so nothing is recorded."""


class Insufficient(Exception):
    def __init__(self, band: str, missing_fields: list[str], blocking_fields: list[str]):
        super().__init__(f"readiness {band}: blocking={blocking_fields} missing={missing_fields}")
        self.band = band
        self.missing_fields = missing_fields
        self.blocking_fields = blocking_fields


# --- Wave tool schemas: no writable conclusion anywhere -----------------------------------------

def _obj(properties: dict, required: list[str]) -> dict:
    return {"type": "object", "properties": properties, "required": required, "additionalProperties": False}


_CITATION = {"type": ["object", "null"], "properties": {
    "unit_key": {"type": "string"}, "unit_sha256": {"type": "string"}, "quote": {"type": "string"},
    "start": {"type": "integer"}, "end": {"type": "integer"}},
    "required": ["unit_key", "unit_sha256", "quote", "start", "end"], "additionalProperties": False}
_MISSING = {"type": ["object", "null"], "properties": {"fact_path": {"type": "string"}, "question": {"type": "string"}},
            "required": ["fact_path", "question"], "additionalProperties": False}


def _element_schema(dispositions: tuple[str, ...]) -> dict:
    return _obj({
        "element_id": {"type": "string"},
        "unit_key": {"type": "string", "description": "The reference-pack unit this element reads; the provision itself or a parent paragraph."},
        "disposition": {"type": "string", "enum": list(dispositions)},
        "basis": {"type": "string", "enum": list(reconcile.BASES)},
        "facts_relied_on": {"type": "array", "items": {"type": "string"}, "description": "Fact paths from the snapshot."},
        "citation": _CITATION,
        "missing_fact": _MISSING,
    }, ["element_id", "unit_key", "disposition", "basis", "facts_relied_on", "citation", "missing_fact"])


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
    "ccl_propose": _obj({"candidates": _PROPOSAL_ITEMS}, ["candidates"]),
    "advocate": _obj({
        "provision": {"type": "string"},
        "elements": {"type": "array", "items": _element_schema(reconcile.ADVOCATE_DISPOSITIONS)},
        "case_for": {"type": "string"},
        "intended_use_rationale": {"type": ["string", "null"]},
        "intended_use_family": {"type": ["string", "null"], "enum": ["end_use_nature", "destination_and_parties", "capability_in_fact", None]},
    }, ["provision", "elements", "case_for", "intended_use_rationale", "intended_use_family"]),
    "judge": _obj({
        "provision": {"type": "string"},
        "ruling": {"type": "string", "enum": ["supported", "knocked_out", "blocked_on_facts"]},
        "elements": {"type": "array", "items": _element_schema(reconcile.JUDGE_DISPOSITIONS)},
        "reason": {"type": "string"},
        "challenge": {"type": ["object", "null"], "properties": {"text": {"type": "string"}, "resolution": {"type": "string", "enum": ["sustained", "rejected"]}},
                      "required": ["text", "resolution"], "additionalProperties": False},
    }, ["provision", "ruling", "elements", "reason", "challenge"]),
    "concerns": _obj({
        "concerns": {"type": "array", "items": _obj({
            "type": {"type": "string", "enum": ["alternate_use", "misuse_plausibility", "declared_use_inconsistency", "transaction_risk", "practitioner_scrutiny"]},
            "statement": {"type": "string"}, "basis": {"type": "string"}}, ["type", "statement", "basis"])},
        "legal_tensions": {"type": "array", "items": _obj({
            "type": {"type": "string", "enum": ["strictest_rule", "premature_regime_dismissal", "destination_as_classification", "use_as_dispositive", "other"]},
            "statement": {"type": "string"}}, ["type", "statement"])},
    }, ["concerns", "legal_tensions"]),
}


# --- Prompts -----------------------------------------------------------------------------------

def _facts_block(snapshot: FactSnapshot) -> str:
    lines = [f"ITEM: {snapshot.item_kind} of part revision {snapshot.part_revision_id}", f"INTRODUCTION: {snapshot.introduction}", "FACTS:"]
    for path, fact in sorted(snapshot.facts.items()):
        unit = f" {fact.unit}" if fact.unit else ""
        lines.append(f"  {path} = {fact.value}{unit}  [{fact.evidence_grade}{'; recorded unknown' if fact.recorded_unknown else ''}]")
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
    ])


def _advocate_prompt(snapshot: FactSnapshot, pack: ReferencePack, provision: str) -> str:
    return "\n".join([
        f"PROVISION: {provision}", "", _facts_block(snapshot), "", "REFERENCE TEXT (the only text you may cite; quote byte-exact spans):",
        _unit_block(pack, provision), "",
        "You are the advocate for this provision and this provision only. Make the strongest honest case that it applies: "
        "walk every element of the paragraph; for each, record met or indeterminate (you may not record not_met), the basis, "
        "the fact paths relied on, and a byte-exact citation {unit_key, unit_sha256, quote, start, end} into the reference text. "
        "For an indeterminate element name the missing fact as {fact_path, question} in the regulation's own words.",
    ])


def _judge_prompt(snapshot: FactSnapshot, pack: ReferencePack, provision: str, case: list[dict], case_for: str) -> str:
    lines = [f"PROVISION: {provision}", "", _facts_block(snapshot), "", "REFERENCE TEXT:", _unit_block(pack, provision), "",
             "THE ADVOCATE'S CASE (citations already verified; unverified citations were struck):", f"  case_for: {case_for}"]
    for el in case:
        cite = f"quote={el['citation']['quote']!r} [{el['citation']['unit_key']}]" if el["citation"] else "no verified citation"
        miss = f"; missing_fact={el['missing_fact']['fact_path']}" if el["missing_fact"] else ""
        lines.append(f"  {el['element_id']}: {el['disposition']} ({el['basis']}; facts={','.join(el['facts_relied_on'])}; {cite}{miss})")
    lines += ["", "You are the judge for this provision and this provision only. Rule supported, knocked_out or blocked_on_facts. "
              "You may rule knocked_out ONLY on an element you record as not_met with a byte-exact citation to the reference text. "
              "Name every missing fact. Record the strongest challenge to your own ruling and whether it is sustained."]
    return "\n".join(lines)


def _concerns_prompt(snapshot: FactSnapshot) -> str:
    return "\n".join([_facts_block(snapshot), "",
                      "Wave 4: the intended-use axis. Record concerns (an adversarial reading of the stated use — of all designs "
                      "that satisfy it, why this one?) and legal tensions (a shortcut the facts tempt: strictest regime, dismissing a "
                      "regime, destination as classification, use as dispositive). Nothing here changes any disposition."])


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
            "response_sha256": _response_hash(response), "input_tokens": 0, "output_tokens": 0,
            "cost_microusd": self.budget.cost_used_microusd - before,
        })
        return response

    # -- proposals --
    def proposals(self, response: object, *, list_name: str) -> list[dict]:
        if isinstance(response, Abstain) or not isinstance(response, dict):
            return []
        seen: set[str] = set()
        out: list[dict] = []
        for raw in response.get("candidates") or []:
            if not isinstance(raw, dict):
                continue
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
            for extra in out[TOP_K:]:
                self.dropped.append({"provision": extra["provision"], "reason": f"top-{TOP_K} cap"})
            out = out[:TOP_K]
        return out

    def new_candidate(self, provision: str, origin: str, why: str, *, via: str = "enumerated") -> dict:
        self.candidate_seq += 1
        return {
            "candidate_id": f"cand:{self.candidate_seq}:{provision}",
            "provision": provision,
            "stage": route_module.stage_for(provision, via=via),
            "status": "not_reached",
            "ruling": "not_reached",
            "pursuit": None,
            "origin": origin,
            "why_considered": why,
            "why_rejected": None,
            "why_over_alternative": None,
            "intended_use_rationale": None,
            "intended_use_family": None,
            "elements": [],
            "fit_quality": None,
            "challenge": None,
            "reference_notes": [],
        }

    # -- analysis --
    def analyse(self, cand: dict) -> None:
        provision = cand["provision"]
        advocate_response = self.call("advocate", _advocate_prompt(self.snapshot, self.pack, provision), provision=provision)
        if isinstance(advocate_response, Abstain):
            cand["reference_notes"].append(f"advocate unavailable ({advocate_response.reason}); the candidate is blocked, never knocked out")
            self.finish(cand, "blocked_on_facts", [], None, None)
            return
        case, notes = reconcile.normalise_elements(advocate_response.get("elements"), pack=self.pack,
                                                   allowed=reconcile.ADVOCATE_DISPOSITIONS, who="advocate", default_unit=provision)
        cand["reference_notes"].extend(notes)
        cand["intended_use_rationale"] = advocate_response.get("intended_use_rationale") or None
        family = advocate_response.get("intended_use_family")
        cand["intended_use_family"] = family if family in ("end_use_nature", "destination_and_parties", "capability_in_fact") else None

        judge_response = self.call("judge", _judge_prompt(self.snapshot, self.pack, provision, case, str(advocate_response.get("case_for") or "")),
                                   provision=provision)
        if isinstance(judge_response, Abstain):
            cand["reference_notes"].append(f"judge unavailable ({judge_response.reason}); the candidate is blocked, never knocked out")
            self.finish(cand, "blocked_on_facts", case, None, None)
            return
        elements, notes = reconcile.normalise_elements(judge_response.get("elements"), pack=self.pack,
                                                       allowed=reconcile.JUDGE_DISPOSITIONS, who="judge", default_unit=provision)
        cand["reference_notes"].extend(notes)
        # An open question the advocate named survives the judge: a ruling that drops it cannot make it disappear.
        judged_ids = {e["element_id"] for e in elements}
        for el in case:
            if el["missing_fact"] and el["element_id"] not in judged_ids:
                elements.append({**el, "disposition": "indeterminate", "citation": None})
                cand["reference_notes"].append(f"element {el['element_id']} carried from the advocate: the judge did not address its missing fact")
        challenge = judge_response.get("challenge")
        if not (isinstance(challenge, dict) and challenge.get("resolution") in ("sustained", "rejected")):
            challenge = None
        else:
            challenge = {"text": str(challenge.get("text") or ""), "resolution": challenge["resolution"]}
        status, notes = reconcile.reconcile_ruling(judge_response.get("ruling"), elements, challenge)
        cand["reference_notes"].extend(notes)
        reason, hits = reconcile.generalise_stray_codes(str(judge_response.get("reason") or ""), self.pack)
        self.reference_notes.extend(f"stray code {h} in the judge's reason for {provision} was generalised" for h in hits)
        self.finish(cand, status, elements, challenge, reason)

    def finish(self, cand: dict, status: str, elements: list[dict], challenge: dict | None, reason: str | None) -> None:
        grades = {p: f.evidence_grade for p, f in self.snapshot.facts.items()}
        for el in elements:
            el["facts_relied_on"] = [{"path": p, "evidence_grade": grades.get(p, "asserted")} for p in el["facts_relied_on"]]
        cand["elements"] = elements
        cand["ruling"] = status
        cand["challenge"] = challenge
        cand["fit_quality"] = claim_module.fit_quality(elements)
        cand["why_rejected"] = reason if status == "knocked_out" else None
        if status == "supported" and reason:
            cand["why_over_alternative"] = reason

    def not_reached(self, cand: dict) -> None:
        cand["ruling"] = "not_reached"
        cand["pursuit"] = "explicitly_not"

    def usml_summary(self, usml: list[dict]) -> str:
        return "\n".join(f"  {c['provision']}: {c['ruling']} — {c['why_rejected'] or ''}" for c in usml) or "  (no candidates)"


def classify(snapshot: FactSnapshot, pack: ReferencePack, model: ModelClient, budget: Budget, *,
             progress: Callable[[str], None] | None = None) -> dict:
    readiness = assess_readiness(snapshot)
    if readiness.band == "insufficient":
        raise Insufficient(readiness.band, list(readiness.missing_fields), list(readiness.blocking_fields))
    run = _Run(snapshot, pack, model, budget, progress)

    # W1 — USML proposal (retry once, then the step is undemonstrated)
    first = run.call("usml_propose", _usml_propose_prompt(snapshot, pack, retry=False))
    usml = run.proposals(first, list_name="USML")
    if not usml:
        second = run.call("usml_propose", _usml_propose_prompt(snapshot, pack, retry=True))
        usml = run.proposals(second, list_name="USML")
        if isinstance(first, Abstain) and isinstance(second, Abstain):
            raise ModelUnavailable(f"usml_propose: {first.reason}; retry: {second.reason}")
    for cand in usml:
        run.analyse(cand)

    residual = run.new_candidate("EAR99", "floor", "The residual is seated on every board; it is elected only when every specific candidate is knocked out.")
    ccl: list[dict] = []
    ccl_by_stage: dict[str, list[dict]] = {}
    usml_route = route_module.assemble(usml, {}, None)
    ccl_reached = usml_route["usml_step"] == "negative"
    residual_analysed = None
    if ccl_reached:
        ccl = run.proposals(run.call("ccl_propose", _ccl_propose_prompt(snapshot, run.usml_summary(usml))), list_name="CCL")
        for stage in route_module.CCL_STAGES:
            in_stage = [c for c in ccl if c["stage"] == stage]
            for cand in in_stage:
                run.analyse(cand)
            ccl_by_stage[stage] = in_stage
            decision = route_module.decide_step(in_stage)
            if decision.outcome in ("supported", "ambiguous", "blocked"):
                for later in ccl:
                    if later["ruling"] == "not_reached":
                        run.not_reached(later)
                break
        else:
            residual_analysed = residual
            residual["ruling"] = "supported"
            residual["elements"] = []
    if residual_analysed is None:
        run.not_reached(residual)
    for cand in usml:
        if cand["ruling"] == "not_reached":
            run.not_reached(cand)

    route = route_module.assemble(usml, ccl_by_stage, residual_analysed)
    candidates = [*usml, *ccl, residual]

    # W4 — concerns, non-dispositive by construction
    concerns_out: dict = {"concerns": [], "legal_tensions": []}
    concerns_response = run.call("concerns", _concerns_prompt(snapshot))
    if isinstance(concerns_response, dict):
        concerns_out = {
            "concerns": [c for c in concerns_response.get("concerns") or [] if isinstance(c, dict)
                         and c.get("type") in PROMPT_SCHEMAS["concerns"]["properties"]["concerns"]["items"]["properties"]["type"]["enum"]
                         and all(isinstance(c.get(k), str) for k in ("statement", "basis"))],
            "legal_tensions": [t for t in concerns_response.get("legal_tensions") or [] if isinstance(t, dict)
                               and t.get("type") in PROMPT_SCHEMAS["concerns"]["properties"]["legal_tensions"]["items"]["properties"]["type"]["enum"]
                               and isinstance(t.get("statement"), str)],
        }

    # Statuses on the record
    for cand in candidates:
        if cand["ruling"] == "supported":
            cand["status"] = "leading" if cand["candidate_id"] == route["leading_candidate_id"] else "blocked_on_facts"
            if cand["status"] == "blocked_on_facts":
                cand["reference_notes"].append("supported on the record but not leading: the step is contested")
        else:
            cand["status"] = cand["ruling"]

    def simulate(hypothetical: list[dict]) -> dict:
        h_usml = [c for c in hypothetical if c["stage"] in route_module.USML_STAGES and c["ruling"] != "not_reached"]
        h_ccl = {s: [c for c in hypothetical if c["stage"] == s and c["ruling"] != "not_reached"] for s in route_module.CCL_STAGES}
        h_res = next((c for c in hypothetical if c["stage"] == "residual" and c["ruling"] != "not_reached"), None)
        return route_module.assemble(h_usml, h_ccl, h_res)

    claim = claim_module.decide_claim(route, candidates, snapshot)
    questions = derive_questions(snapshot, readiness, candidates, simulate) if claim["claim_class"] == "insufficient_facts" or readiness.missing_fields else []
    if claim["claim_class"] != "insufficient_facts":
        questions = [q for q in questions if q["source"] != "element_missing_fact"]

    envelope = {
        "schema_version": ENVELOPE_SCHEMA_VERSION,
        "snapshot_sha256": snapshot.sha256,
        "pack_sha256": pack.sha256,
        "item": {"part_revision_id": snapshot.part_revision_id, "item_kind": snapshot.item_kind},
        "readiness": readiness.as_dict(),
        "candidates": [_public(c) for c in sorted(candidates, key=lambda c: (route_module.STAGE_ORDER.index(c["stage"]), c["candidate_id"]))],
        "route": {k: v for k, v in route.items() if not k.startswith("_")},
        **claim,
        "questions": questions,
        "concerns": concerns_out["concerns"],
        "legal_tensions": concerns_out["legal_tensions"],
        "provenance": {
            "model": type(model).__name__ if not hasattr(model, "inner") else type(model.inner).__name__,
            "calls": run.calls,
            "budget": budget.as_dict(),
            "dropped_candidates": run.dropped,
            "reference_notes": run.reference_notes,
        },
    }
    return envelope


def _public(cand: dict) -> dict:
    return {k: v for k, v in cand.items() if k != "ruling"}
