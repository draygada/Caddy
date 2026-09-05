"""Readiness and questions: deterministic derivation, ranked by what a question would move.

The field dictionary is one table: fact path -> the question in the regulation's own words and
whether its absence blocks analysis. Questions from blocked elements are ranked by simulating the
route with the element flipped both ways; a question that would change the posture outranks one
that would only refine an entry.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass

from .snapshot import FactSnapshot

QUESTIONS_PER_ROUND = 5

# path -> (question, blocking, item kinds it applies to or None for all)
FIELD_DICTIONARY: dict[str, tuple[str, bool, tuple[str, ...] | None]] = {
    "introduction": ("Describe the part: what it is, what it physically does, and what it is for.", True, None),
    "bom.description": ("What is the part's bill-of-materials description?", False, None),
    "declared.military_use": ("Was the part designed or modified for military use or for a defense article (22 CFR 120.41(a))?", False, None),
    "declared.used_on": ("What system or platform is the part designed for use in or with (22 CFR 120.41(a)(2))?", False, None),
    "declared.civil_product": ("Is the end product a civil product?", False, None),
    "declared.designed_to_incorporate": ("Is the part designed to incorporate a defense article?", False, None),
    "declared.mass_market": ("Is the software generally available to the public through retail channels (Note 3 to Category 5 Part 2)?", False, ("software",)),
}
STAGE_WEIGHT = {"usml_enumerated": 3, "specially_designed_itar": 3, "six_hundred_series": 2,
                "specially_designed_ear": 2, "other_ccl": 1, "residual": 1}


@dataclass(frozen=True)
class Readiness:
    band: str
    missing_fields: tuple[str, ...]
    blocking_fields: tuple[str, ...]

    def as_dict(self) -> dict:
        return {"band": self.band, "missing_fields": list(self.missing_fields), "blocking_fields": list(self.blocking_fields)}


def assess_readiness(snapshot: FactSnapshot) -> Readiness:
    known = snapshot.known_paths()
    missing: list[str] = []
    blocking: list[str] = []
    for path, (_, is_blocking, kinds) in FIELD_DICTIONARY.items():
        if kinds and snapshot.item_kind not in kinds:
            continue
        present = bool(snapshot.introduction.strip()) if path == "introduction" else path in known
        if not present:
            (blocking if is_blocking else missing).append(path)
    if blocking:
        band = "insufficient"
    elif len(missing) >= 3:
        band = "preliminary"
    else:
        band = "classifiable"
    return Readiness(band, tuple(missing), tuple(blocking))


def derive_questions(snapshot: FactSnapshot, readiness: Readiness, candidates: list[dict], simulate) -> list[dict]:
    """`simulate(candidates) -> route` is the pure route over hypothetical candidate records."""
    questions: list[dict] = []
    for path in readiness.blocking_fields:
        questions.append(_question(path, FIELD_DICTIONARY[path][0], [], 100, "readiness_blocking"))
    for path in readiness.missing_fields:
        questions.append(_question(path, FIELD_DICTIONARY[path][0], [], 50, "readiness_missing"))

    by_path: dict[str, list[tuple[dict, dict]]] = {}
    for cand in candidates:
        for el in cand["elements"]:
            if el["missing_fact"]:
                by_path.setdefault(el["missing_fact"]["fact_path"], []).append((cand, el))
    baseline = _posture_key(simulate(candidates))
    for path, pairs in by_path.items():
        text = pairs[0][1]["missing_fact"]["question"]
        unblocks = [{"candidate_id": c["candidate_id"], "element_id": e["element_id"]} for c, e in pairs]
        rank = sum(STAGE_WEIGHT.get(c["stage"], 1) for c, _ in pairs)
        outcomes = {baseline}
        for disposition in ("met", "not_met"):
            outcomes.add(_posture_key(simulate(_flipped(candidates, path, disposition))))
        if len(outcomes) > 1:
            rank += 10 * len(pairs)
        questions.append(_question(path, text, unblocks, rank, "element_missing_fact"))

    order = {"readiness_blocking": 0, "readiness_missing": 1, "element_missing_fact": 2}
    questions.sort(key=lambda q: (order[q["source"]], -q["rank"], q["fact_path"]))
    return questions[:QUESTIONS_PER_ROUND]


def _question(path: str, text: str, unblocks: list[dict], rank: int, source: str) -> dict:
    return {"question_id": f"q:{path}", "fact_path": path, "text": text, "unblocks": unblocks, "rank": rank, "source": source}


def _posture_key(route: dict) -> tuple:
    return (route["usml_step"], route["ccl_step"], route["posture"], route["leading_candidate_id"])


def _flipped(candidates: list[dict], path: str, disposition: str) -> list[dict]:
    from .reconcile import status_from_elements

    out = copy.deepcopy(candidates)
    for cand in out:
        touched = False
        for el in cand["elements"]:
            if el["missing_fact"] and el["missing_fact"]["fact_path"] == path:
                el["disposition"] = disposition
                el["missing_fact"] = None
                if disposition == "not_met" and el["citation"] is None:
                    el["citation"] = {"hypothetical": True}
                touched = True
        if touched and cand.get("ruling") != "not_reached":
            cand["ruling"] = status_from_elements(cand["elements"])
    return out
