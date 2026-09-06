"""The order-of-review decision table, ending in a jurisdictional determination. Code only.

USML first (22 CFR 120.11; the CCL's own steps in Supplement No. 4 to Part 774). The CCL is reached
only on a recorded USML negative; within the CCL, stages are walked in order and a later stage is
reached only when the earlier one closes negative. EAR99 is a floor candidate elected only when every
specific candidate is knocked out. When the USML step cannot close on the facts given, the
determination is UNDETERMINED and says which candidates are open; it never invents ITAR and never
clears to the EAR by silence.
"""

from __future__ import annotations

USML_STAGES = ("usml_enumerated", "specially_designed_itar")
CCL_STAGES = ("six_hundred_series", "specially_designed_ear", "other_ccl")
RESIDUAL_STAGE = "residual"
STAGE_ORDER = (*USML_STAGES, *CCL_STAGES, RESIDUAL_STAGE)


def reconcile_specially_designed(read: str | None, candidates: list[dict], *, scope: str,
                                 required: bool) -> tuple[str, str, list[str]]:
    """Reconcile a proposal read with routed candidates without making a legal conclusion.

    This is a consistency check over model records, not an implementation of or conclusion under
    22 CFR 120.41 or 15 CFR 772.1. An incomplete or contradictory read fails closed.
    """
    relevant_stage = "specially_designed_itar" if scope == "USML" else "specially_designed_ear"
    relevant = [c["provision"] for c in candidates if c["stage"] == relevant_stage]
    text = (read or "").strip().lower()
    without_negative = text.replace("not specially designed", "")
    released = text.startswith("released") or "released" in text.split() or text.startswith("not specially designed")
    caught = text.startswith("caught") or "caught" in text.split() or without_negative.startswith("specially designed")
    not_applicable = text.startswith("not_applicable") or text.startswith("not applicable")
    incomplete = (not text or text.startswith("undetermined") or text.startswith("unknown")
                  or text.startswith("incomplete"))

    states = sum(bool(value) for value in (released, caught, not_applicable))
    if incomplete or states != 1:
        if not required and not relevant and not text:
            return "closed", f"{scope} specially-designed read: not required; no such candidate surfaced", []
        return "blocked", (f"{scope} specially-designed read: incomplete or conflicting; "
                           "the ordered review cannot advance"), relevant
    if released and relevant:
        return "blocked", (f"{scope} specially-designed read: released conflicts with routed "
                           f"candidate(s) {', '.join(relevant)}"), relevant
    if (caught or not_applicable) and not relevant:
        if not_applicable:
            return "closed", f"{scope} specially-designed read: not applicable; no such candidate surfaced", []
        return "blocked", (f"{scope} specially-designed read: caught but no specially-designed "
                           "candidate was routed for a record walk"), []
    state = "caught" if caught else "released"
    return "closed", f"{scope} specially-designed read: {state}; proposal and routed candidates agree", relevant


def decide_step(candidates: list[dict]) -> tuple[str, list[dict]]:
    """('supported', supported) | ('undetermined', open) | ('negative', []) | ('empty', [])."""
    if not candidates:
        return "empty", []
    supported = [c for c in candidates if c["ruling"] == "supported"]
    if supported:
        return "supported", supported
    open_ = [c for c in candidates if c["ruling"] == "undetermined"]
    if open_:
        return "undetermined", open_
    return "negative", []


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


def assemble(usml: list[dict], ccl_by_stage: dict[str, list[dict]], residual: dict | None, *,
             usml_special: tuple[str, str, list[str]] = ("closed", "USML specially-designed read: not recorded", []),
             ccl_special: tuple[str, str, list[str]] = ("closed", "CCL specially-designed read: not recorded", []),
             ccl_review: tuple[str, str | None, bool] = ("valid", None, False)) -> dict:
    """The determination over analysed candidates. Unanalysed candidates are absent from the inputs."""
    basis: list[str] = []
    basis.append(usml_special[1])
    if usml_special[0] == "blocked":
        return _det("UNDETERMINED", [], "undetermined" if usml else "undemonstrated", "not_reached",
                    basis, usml_special[2])
    outcome, rows = decide_step(usml)
    if outcome == "supported":
        basis.append(f"USML: supported — {', '.join(c['provision'] for c in rows)}; the CCL is not reached by the order of review")
        return _det("ITAR", [c["provision"] for c in rows], "supported", "not_reached", basis, [])
    if outcome == "undetermined":
        basis.append("USML: open — a candidate could not be closed on the facts given; the CCL is not reached")
        return _det("UNDETERMINED", [], "undetermined", "not_reached", basis, [c["provision"] for c in rows])
    if outcome == "empty":
        basis.append("USML: the step could not be demonstrated — no reference-valid candidate was walked")
        return _det("UNDETERMINED", [], "undemonstrated", "not_reached", basis, [])
    basis.append("USML: negative — every candidate knocked out on a cited element; the item is subject to the EAR")

    ccl_status, ccl_reason, explicit_empty = ccl_review
    if ccl_status != "valid":
        basis.append(f"CCL proposal: blocked — {ccl_reason or ccl_status}; EAR99 is not reached")
        return _det("EAR", [], "negative", "undetermined", basis, [])
    basis.append("CCL proposal: valid explicit empty candidate set" if explicit_empty
                 else "CCL proposal: reference-valid candidate set admitted")
    basis.append(ccl_special[1])
    if ccl_special[0] == "blocked":
        basis.append("CCL specially-designed reconciliation blocked the remaining ordered review; EAR99 is not reached")
        return _det("EAR", [], "negative", "undetermined", basis, ccl_special[2])

    for stage in CCL_STAGES:
        outcome, rows = decide_step(ccl_by_stage.get(stage, []))
        if outcome == "empty":
            basis.append(f"CCL {stage}: no candidate surfaced")
            continue
        if outcome == "supported":
            basis.append(f"CCL {stage}: {', '.join(c['provision'] for c in rows)} supported; later stages and the residual are not reached")
            return _det("EAR", [c["provision"] for c in rows], "negative", "specific_supported", basis, [])
        if outcome == "undetermined":
            basis.append(f"CCL {stage}: open — the jurisdiction is the EAR; the entry could not be closed on the facts given")
            return _det("EAR", [], "negative", "undetermined", basis, [c["provision"] for c in rows])
        basis.append(f"CCL {stage}: negative — every candidate knocked out on a cited element")

    if residual is None:
        basis.append("EAR99: no residual seated — the walk could not close")
        return _det("EAR", [], "negative", "undetermined", basis, [])
    basis.append("EAR99: elected only after a valid CCL proposal and the completed ordered review left no specific candidate")
    return _det("EAR99", ["EAR99"], "negative", "all_knocked_out", basis, [])


def _det(jurisdiction: str, classification: list[str], usml_step: str, ccl_step: str, basis: list[str], open_: list[str]) -> dict:
    return {
        "jurisdiction": jurisdiction,
        "classification": classification,
        "usml_step": usml_step,
        "ccl_step": ccl_step,
        "basis": basis,
        "open_candidates": open_,
    }
