"""The order-of-review decision table. Code only; it reads candidate statuses and never a model.

USML first (22 CFR 120.11; the CCL's own steps in Supplement No. 4 to Part 774). The CCL is reached
only on a recorded USML negative; within the CCL, stages are walked in order and a later stage is
reached only when the earlier one closes negative. EAR99 is a floor candidate that is elected only
when every specific candidate is knocked out. Two supported candidates in one step is ambiguity,
not a ranking contest.
"""

from __future__ import annotations

from dataclasses import dataclass

USML_STAGES = ("usml_enumerated", "specially_designed_itar")
CCL_STAGES = ("six_hundred_series", "specially_designed_ear", "other_ccl")
RESIDUAL_STAGE = "residual"
STAGE_ORDER = (*USML_STAGES, *CCL_STAGES, RESIDUAL_STAGE)


@dataclass(frozen=True)
class StepDecision:
    outcome: str  # supported | ambiguous | blocked | negative | empty
    leading: str | None = None  # candidate_id
    askable: bool = False


def decide_step(candidates: list[dict]) -> StepDecision:
    """One step over analysed candidates carrying `ruling` (supported | knocked_out | blocked_on_facts)."""
    if not candidates:
        return StepDecision("empty")
    supported = [c for c in candidates if c["ruling"] == "supported"]
    if len(supported) == 1:
        return StepDecision("supported", supported[0]["candidate_id"])
    if len(supported) > 1:
        return StepDecision("ambiguous")
    blocked = [c for c in candidates if c["ruling"] == "blocked_on_facts"]
    if blocked:
        askable = any(e.get("missing_fact") for c in blocked for e in c["elements"])
        return StepDecision("blocked", askable=askable)
    return StepDecision("negative")


def stage_for(provision: str, *, via: str = "enumerated") -> str:
    if provision.startswith("USML") or provision.startswith("22 CFR 120.41"):
        return "specially_designed_itar" if via == "specially_designed" else "usml_enumerated"
    if provision in ("EAR99", "NOT_SUBJECT"):
        return RESIDUAL_STAGE
    code = provision[:5]
    military = len(code) == 5 and (code[2] == "6" or code[2:] == "515")
    if military:
        tail = provision[5:]
        if via == "specially_designed" or tail.startswith(".x") or tail.startswith(".y"):
            return "specially_designed_ear"
        return "six_hundred_series"
    return "other_ccl"


def assemble(usml: list[dict], ccl_by_stage: dict[str, list[dict]], residual: dict | None) -> dict:
    """Route over analysed candidates. Unanalysed candidates are absent from the inputs.
    Returns the envelope's `route` block plus `_decision` metadata the claim class reads."""
    trace: list[str] = []
    usml_decision = decide_step(usml)
    if usml_decision.outcome == "supported":
        trace.append(f"USML: supported — {usml_decision.leading} controls; the CCL is not reached by the order of review")
        return _route("supported", "not_reached", "ITAR", usml_decision.leading, trace, step="usml", decision=usml_decision)
    if usml_decision.outcome == "ambiguous":
        trace.append("USML: two or more paragraphs supported on the record — which applies is a jurisdiction question")
        return _route("ambiguous", "not_reached", "AMBIGUOUS", None, trace, step="usml", decision=usml_decision)
    if usml_decision.outcome == "blocked":
        trace.append("USML: open — a candidate is blocked on facts; the CCL is not reached")
        return _route("blocked_on_facts", "not_reached", "AMBIGUOUS", None, trace, step="usml", decision=usml_decision)
    if usml_decision.outcome == "empty":
        trace.append("USML: the step could not be demonstrated — no reference-valid candidate was walked")
        return _route("blocked_on_facts", "not_reached", "AMBIGUOUS", None, trace, step="usml", decision=usml_decision)
    trace.append("USML: negative — every candidate knocked out on a cited element")

    for stage in CCL_STAGES:
        decision = decide_step(ccl_by_stage.get(stage, []))
        if decision.outcome == "empty":
            trace.append(f"CCL {stage}: no candidate surfaced")
            continue
        if decision.outcome == "supported":
            trace.append(f"CCL {stage}: {decision.leading} supported; later stages and the residual are not reached")
            return _route("negative", "specific_supported", "EAR", decision.leading, trace, step=stage, decision=decision)
        if decision.outcome == "ambiguous":
            trace.append(f"CCL {stage}: two or more entries supported within one step — the entry is contested")
            return _route("negative", "ambiguous", "EAR", None, trace, step=stage, decision=decision)
        if decision.outcome == "blocked":
            trace.append(f"CCL {stage}: open — a candidate is blocked on facts; later stages are not reached")
            return _route("negative", "blocked_on_facts", "EAR", None, trace, step=stage, decision=decision)
        trace.append(f"CCL {stage}: negative — every candidate knocked out on a cited element")

    if residual is None:
        trace.append("EAR99: no residual seated — the walk could not close")
        return _route("negative", "ambiguous", "EAR", None, trace, step="residual", decision=StepDecision("empty"))
    trace.append("EAR99: elected as the residual after every specific candidate was knocked out; Part 744 end-use and end-user screening still apply")
    return _route("negative", "all_knocked_out", "EAR99", residual["candidate_id"], trace, step="residual",
                  decision=StepDecision("supported", residual["candidate_id"]))


def _route(usml_step: str, ccl_step: str, posture: str, leading: str | None, trace: list[str], *, step: str,
           decision: StepDecision) -> dict:
    return {
        "usml_step": usml_step,
        "ccl_step": ccl_step,
        "posture": posture,
        "leading_candidate_id": leading,
        "order_of_review_trace": trace,
        "_step": step,
        "_decision": decision,
    }
