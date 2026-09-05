"""Records outrank summaries. Every rule here is a pure function over recorded per-provision rows.

Re-typed from the rules proto-prod's wave engine learned live: a knockout that also names missing
facts is blocked; a knockout without a verified citation on a failed element is blocked; a supported
ruling with an open element or a sustained challenge is blocked; an advocate cannot knock out its
own provision; a model's silence is never a finding; a code the pack cannot resolve is generalised in
prose and refused in structure.
"""

from __future__ import annotations

import re

from .pack import ReferencePack, resolve
from .verifier import Accepted, verify_citation

_ECCN_TOKEN = re.compile(r"\b\d[A-E]\d{3}\b")
ADVOCATE_DISPOSITIONS = ("met", "indeterminate")
JUDGE_DISPOSITIONS = ("met", "not_met", "indeterminate")
BASES = ("stated", "inferred", "assumed")


def normalise_elements(raw_elements: object, *, pack: ReferencePack, allowed: tuple[str, ...], who: str,
                       default_unit: str) -> tuple[list[dict], list[str]]:
    """Validate a wave's element rows: drop disallowed dispositions, strike unverified citations,
    coerce shapes. Returns (elements, notes). Never invents a disposition."""
    notes: list[str] = []
    out: list[dict] = []
    if not isinstance(raw_elements, list):
        return out, [f"{who} returned no element list"]
    for index, raw in enumerate(raw_elements):
        if not isinstance(raw, dict):
            notes.append(f"{who} element {index} was not an object; dropped")
            continue
        disposition = raw.get("disposition")
        if disposition not in allowed:
            notes.append(f"{who} returned {disposition!r} for element {raw.get('element_id', index)} — dropped "
                         f"(the {who} may only record {'/'.join(allowed)})")
            continue
        basis = raw.get("basis") if raw.get("basis") in BASES else "assumed"
        unit_key = str(raw.get("unit_key") or default_unit)
        citation = None
        if raw.get("citation") is not None:
            verdict = verify_citation(pack, raw.get("citation"))
            if isinstance(verdict, Accepted):
                citation = verdict.citation.as_dict()
            else:
                notes.append(f"citation struck on element {raw.get('element_id', index)}: {verdict.reason}")
        missing = raw.get("missing_fact")
        if isinstance(missing, dict) and missing.get("fact_path") and missing.get("question"):
            missing = {"fact_path": str(missing["fact_path"]), "question": str(missing["question"])}
        else:
            missing = None
        facts = [str(p) for p in (raw.get("facts_relied_on") or []) if isinstance(p, str)]
        out.append({
            "element_id": str(raw.get("element_id") or f"el:{unit_key}:{index}"),
            "unit_key": unit_key,
            "disposition": disposition,
            "basis": basis,
            "facts_relied_on": facts,
            "citation": citation,
            "missing_fact": missing,
        })
    return out, notes


def status_from_elements(elements: list[dict]) -> str:
    """The status the elements alone support: a cited failure knocks out, any open element blocks,
    all met supports. Used for hypotheticals; the judge's ruling is reconciled against it below."""
    if any(e["disposition"] == "not_met" and e["citation"] for e in elements):
        return "knocked_out"
    if not elements or any(e["disposition"] != "met" or e["missing_fact"] for e in elements):
        return "blocked_on_facts"
    return "supported"


def reconcile_ruling(ruling: object, elements: list[dict], challenge: dict | None) -> tuple[str, list[str]]:
    """Return (status, notes) where status is supported | knocked_out | blocked_on_facts."""
    notes: list[str] = []
    open_facts = any(e["missing_fact"] for e in elements)
    open_elements = any(e["disposition"] == "indeterminate" for e in elements)
    cited_failure = any(e["disposition"] == "not_met" and e["citation"] for e in elements)
    sustained = bool(challenge and challenge.get("resolution") == "sustained")

    if ruling == "knocked_out":
        if not cited_failure:
            notes.append("judge ruled knocked_out without a verified citation on a failed element; reconciled to blocked_on_facts")
            return "blocked_on_facts", notes
        if open_facts:
            notes.append("judge ruled knocked_out while naming missing facts; reconciled to blocked_on_facts")
            return "blocked_on_facts", notes
        return "knocked_out", notes
    if ruling == "supported":
        if not elements:
            notes.append("judge ruled supported with no element walk; reconciled to blocked_on_facts")
            return "blocked_on_facts", notes
        if open_facts or open_elements or any(e["disposition"] == "not_met" for e in elements):
            notes.append("judge ruled supported with an element not met or open; reconciled to blocked_on_facts")
            return "blocked_on_facts", notes
        if sustained:
            notes.append("a sustained challenge defeats the supported ruling; reconciled to blocked_on_facts")
            return "blocked_on_facts", notes
        return "supported", notes
    if ruling != "blocked_on_facts":
        notes.append(f"judge ruling {ruling!r} is not in the vocabulary; reconciled to blocked_on_facts")
    return "blocked_on_facts", notes


def generalise_stray_codes(text: str, pack: ReferencePack) -> tuple[str, list[str]]:
    """Prose is generalised: an ECCN-shaped token the pack cannot resolve is replaced, never re-spelled."""
    hits: list[str] = []

    def _replace(match: re.Match[str]) -> str:
        code = match.group(0)
        if resolve(pack, code) is not None:
            return code
        hits.append(code)
        return f"a Category {code[0]} CCL entry outside this run's reference set"

    return _ECCN_TOKEN.sub(_replace, text or ""), hits
