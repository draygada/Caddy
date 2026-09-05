"""The evaluator. Deliberately empty at the 10:00 freeze — Diego fills it.

Contract fixed here so the frontend can be built against it in parallel:
  evaluate(design, rules, chart) -> {node_id: Determination}
Order is hard-coded USML -> CCL -> EAR99 and never comes from rules.json.
No language model is on this path. tests/test_boundary.py asserts that.
"""
from typing import Any
ORDER = ("ITAR", "EAR", "EAR99")

def evaluate(design, rules: list[dict], chart: dict) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for nid in design.nodes:
        out[nid] = {
            "jurisdiction": None, "entries": [], "reasons": [], "fired": [],
            "contains_defense_article": [], "specially_designed_for": None,
            "destinations": {c: {"state": None, "because": None} for c in
                             (chart.get("countries") or {})},
            "evidence_level": None,
        }
    return out
