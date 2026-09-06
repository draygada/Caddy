"""The Wave-0 evaluate response (features/tripwire docs/api/evaluate.md, main @ 8bc2c01) → open_round input.

The lane reads the engine's per-node determination verbatim and adds no rule. The design hash is the engine's own
`design_revision`; P0 prints no per-country destination cell, so the export gate says "cannot gate" until it does.
An unresolved tripwire is carried as such: a missing fact never satisfies a rule and never renders clear.
"""
from __future__ import annotations

import re
from decimal import Decimal

from forge_sourcing.hashing import sha256

FLAG_848 = "USG-FY2020-NDAA-848-PRC-component"
FLAG_ENTRY = "NO_EXPORT_CONTROL_CHANGE"
FLAG_TEXT_848 = ("no export-control change; US Government buyer column: FY2020 NDAA §848 / DoD class deviation 2020-O0015 — flight controllers, "
                 "radios, cameras or gimbals manufactured in the PRC or by a PRC-domiciled entity; three questions: is packaging 'manufacture'? FASC list? "
                 "SMIC/YMTC/CXMT die (§5949 from 23 Dec 2027)")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _no_floats(value):
    if isinstance(value, float):
        return format(Decimal(repr(value)).normalize(), "f")
    if isinstance(value, dict):
        return {k: _no_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_no_floats(v) for v in value]
    return value


def _money(value) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    return format(Decimal(str(value)).normalize(), "f")


def _dedupe(items):
    out = []
    for x in items:
        if x not in out:
            out.append(x)
    return out


def _evaluation(det: dict | None) -> dict:
    if not det:
        return {"jurisdiction": None, "entries": [], "fired": [], "contains_defense_article": [], "flags": [], "flag_text": {},
                "destinations": {}, "destinations_note": "no determination in the response", "engine_state": "absent", "unresolved": [], "evidence_level": None}
    fired_rows = [t for t in list(det.get("direct_tripwires") or []) + list(det.get("propagated_tripwires") or []) if t.get("state") == "fired"]
    flag_rows = [t for t in fired_rows if t.get("rule_id") == FLAG_848 or t.get("entry") == FLAG_ENTRY]
    fired = _dedupe([t["entry"] for t in fired_rows if t not in flag_rows])
    dest = det.get("destinations") or {}
    if "status" in dest:
        destinations, note = {}, f"{dest.get('status')}: {dest.get('reason')}"
    else:
        destinations = {cc: {"state": c["state"], "because": list(c.get("because") or [])} for cc, c in dest.items() if c and c.get("state")}
        note = None
    unresolved = [{"rule_id": t.get("rule_id"), "entry": t.get("entry"), "problem": t.get("problem"),
                   "missing": [f["attribute"] for f in (t.get("facts") or []) if f.get("observed") is None]} for t in det.get("unresolved_tripwires") or []]
    return {"jurisdiction": det.get("jurisdiction"), "entries": list(det.get("entries") or []), "fired": fired, "contains_defense_article": [],
            "flags": ["848_amber"] if flag_rows else [], "flag_text": {"848_amber": FLAG_TEXT_848} if flag_rows else {},
            "destinations": destinations, "destinations_note": note, "engine_state": det.get("state"), "unresolved": unresolved,
            "evidence_level": det.get("evidence_level")}


def design_for_round(design_doc: dict, response: dict, *, design_seq: int, quantities: dict[str, int] | None = None) -> dict:
    revision = str(response.get("design_revision") or "")
    design_hash = revision[len("sha256:"):] if revision.startswith("sha256:") else revision
    if not _HEX64.match(design_hash):
        raise ValueError(f"design_revision is not sha256:<64 hex>: {revision!r}")
    doc = _no_floats(design_doc)
    root = next(n for n in doc["nodes"] if n["id"] == doc["root"])
    determinations = response.get("determinations") or {}
    quantities = quantities or {}
    nodes = []
    for n in doc["nodes"]:
        if n.get("kind") != "part":
            continue
        nodes.append({
            "node_id": n["id"], "slot": n.get("slot") or n["id"], "part_class": n.get("part_class"), "item_kind": "commodity",
            "mpn": n.get("mpn"), "manufacturer": n.get("vendor"), "origin": n.get("origin"), "origin_note": None,
            "quantity_per": int(quantities.get(n["id"], 1)), "value_usd": _money(n.get("value_usd")), "description": n.get("description"),
            "evaluation": _evaluation(determinations.get(n["id"])),
        })
    declared = root.get("declared") or {}
    return {"design_hash": design_hash, "design_seq": design_seq,
            "product": {"node_id": root["id"], "final_assembly_country": declared.get("final_assembly_country", "US"),
                        "declared": {"prime_flowdown": bool(declared.get("prime_flowdown", False))},
                        "engine": {"rule_pack_sha": response.get("rule_pack_sha"), "rule_pack_status": response.get("rule_pack_status"), "ecfr_date": response.get("ecfr_date"),
                                   "stub": response.get("stub"), "fixture_mode": response.get("fixture_mode"), "artifact_status": response.get("artifact_status"),
                                   "canonical_sha256_check": "matched" if sha256(doc) == design_hash else "differs"}},
            "nodes": nodes}
