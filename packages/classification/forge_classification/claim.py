"""Claim class and instrument, computed from the route and the evidence grades. Ordinal; no number."""

from __future__ import annotations

from .snapshot import FactSnapshot

CLAIM_CLASSES = ("insufficient_facts", "conditional", "supported", "ambiguous")


def fit_quality(elements: list[dict]) -> str | None:
    if not elements:
        return None
    met = sum(1 for e in elements if e["disposition"] == "met")
    if met == len(elements):
        return "close"
    if met * 2 >= len(elements):
        return "partial"
    return "thin" if met else "none"


def _instrument_for(step: str) -> str:
    return "cj" if step == "usml" else "ccats"


def decide_claim(route: dict, candidates: list[dict], snapshot: FactSnapshot) -> dict:
    decision = route["_decision"]
    step = route["_step"]
    if decision.outcome == "ambiguous":
        return _claim("ambiguous", f"two or more provisions are supported within the {step} step; which applies is contested",
                      "conditional", "step_contested", _instrument_for(step))
    if decision.outcome == "empty" and step in ("usml", "residual"):
        return _claim("ambiguous", "the order of review could not be demonstrated against reference-valid candidates",
                      "conditional", "walk_not_demonstrated", _instrument_for(step))
    if decision.outcome == "blocked":
        if decision.askable:
            return _claim("insufficient_facts", "a candidate is blocked on facts a question can settle", "conditional",
                          "facts_missing", None)
        return _claim("ambiguous", "a candidate is indeterminate on full facts and no question would settle it",
                      "conditional", "structural_ambiguity", _instrument_for(step))

    leading = next(c for c in candidates if c["candidate_id"] == route["leading_candidate_id"])
    if leading["provision"] == "EAR99":
        return _claim("conditional", "EAR99 is a residual reached by knockouts; it is never a clearance",
                      "conditional", "residual_is_conditional: EAR99 is a conditional residual; Part 744 end-use and end-user screening still apply", None)

    decisive = [e for e in leading["elements"] if e["disposition"] == "met"]
    asserted: list[str] = []
    uncited = False
    for element in decisive:
        if element["citation"] is None:
            uncited = True
        for ref in element["facts_relied_on"]:
            if ref["evidence_grade"] == "asserted":
                asserted.append(ref["path"])
    if not decisive:
        return _claim("conditional", "the leading candidate has no met element on the record", "conditional",
                      "no_met_element", None)
    if asserted or uncited:
        reasons = []
        if asserted:
            reasons.append("facts_asserted_unverified: " + ", ".join(sorted(set(asserted))))
        if uncited:
            reasons.append("a decisive element carries no verified citation")
        return _claim("conditional", "the leading candidate rests on asserted facts or an uncited element", "conditional",
                      "; ".join(reasons), None)
    return _claim("supported", "every decisive fact is document-verified or human-attested and every decisive element is cited",
                  "supported", None, None)


def _claim(claim_class: str, reason: str, ceiling: str, ceiling_reason: str | None, instrument: str | None) -> dict:
    return {
        "claim_class": claim_class,
        "claim_class_reason": reason,
        "claim_class_ceiling": ceiling,
        "ceiling_reason": ceiling_reason,
        "recommended_instrument": instrument,
    }
