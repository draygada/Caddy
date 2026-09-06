"""Name screening against a dated Consolidated Screening List snapshot, and the per-offer roll-up.

Exact and suffix-normalized matching only. "not fuzzy" is printed. "Cleared" is not in the vocabulary.
"""
from __future__ import annotations

import re

LEGAL_SUFFIXES = {
    "co", "corp", "corporation", "inc", "incorporated", "ltd", "limited", "llc", "lp", "llp", "plc",
    "sa", "ag", "gmbh", "bv", "nv", "as", "ab", "oy", "kk", "pte", "pty", "srl", "spa", "sarl", "company",
}

MATCH_KINDS = ("exact", "normalized", "none", "abstained")
STATUS_SEVERITY = {"no_candidate_match": 0, "abstained": 1, "review_required": 2, "review_blocked": 3}
STATUS_WORD = {
    "no_candidate_match": "no candidate match",
    "abstained": "abstained",
    "review_required": "review required",
    "review_blocked": "review blocked",
}
CLAIM_CEILING = "Review-only screening aid over a name match and a committed ownership table, not a legal determination."


def normalize(name: str | None) -> str:
    if not name:
        return ""
    tokens = re.sub(r"[^a-z0-9]+", " ", name.lower()).split()
    while tokens and tokens[-1] in LEGAL_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def screen(name: str | None, csl_index: dict, snapshot_sha: str, retrieved_at: str) -> dict:
    """One name against one snapshot. Returns the run record (no decision, only the match)."""
    run = {"query": name, "normalized": normalize(name), "snapshot_sha": snapshot_sha, "retrieved_at": retrieved_at,
           "match_kind": "none", "entries": [], "fuzzy": False}
    if not name or not run["normalized"]:
        run["match_kind"] = "abstained"
        return run
    hits = csl_index["exact"].get(name)
    if hits:
        run["match_kind"] = "exact"
        run["entries"] = [_entry(r, "name") for r in hits]
        return run
    hits = csl_index["normalized"].get(run["normalized"])
    if hits:
        run["match_kind"] = "normalized"
        seen = set()
        for row, via in hits:
            key = (row["source"], row["name"])
            if key not in seen:
                seen.add(key)
                run["entries"].append(_entry(row, via))
    return run


def _entry(row: dict, matched_on: str) -> dict:
    return {
        "source_list": row["source"],
        "name": row["name"],
        "entity_number": row.get("entity_number") or None,
        "programs": row.get("programs") or None,
        "matched_on": matched_on,
        "source_list_url": row.get("source_list_url") or None,
    }


def node_status(node: dict, run: dict, adjudication: dict | None) -> str:
    """Effective status of one party node given its run and any adjudication bound to the same snapshot."""
    if run["match_kind"] in ("exact", "normalized"):
        if adjudication and adjudication["list_snapshot_sha"] == run["snapshot_sha"]:
            if adjudication["disposition"] == "escalate":
                return "review_blocked"
            if adjudication["disposition"] == "false_positive" and adjudication["role"] == "analyst":
                return "review_required"      # pending counsel
            if adjudication["disposition"] in ("false_positive", "resolved") and adjudication["role"] == "empowered_official":
                return "no_candidate_match" if node.get("ownership") != "unknown" else "review_required"
        return "review_blocked"
    if run["match_kind"] == "abstained":
        return "abstained"
    if node.get("ownership") == "unknown":
        return "review_required"
    return "no_candidate_match"


def rollup(nodes: list[dict]) -> dict:
    """Worst node wins. Each node carries `effective_status` already."""
    worst = max(nodes, key=lambda n: STATUS_SEVERITY[n["effective_status"]]) if nodes else None
    status = worst["effective_status"] if worst else "abstained"
    return {"status": status, "status_word": STATUS_WORD[status], "worst_node": worst["name"] if worst else None}
