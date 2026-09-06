"""Dry-run the draft rows against verified fields on ONE node, on a copy.

Until Diego's evaluate() lands this is the first slice of the engine; when it lands, propose.py calls the engine
seam and this module goes. A row with any atom whose field is not published CANNOT fire, even if another atom is
already false: no green rests on a number nobody published. Tree atoms (any_descendant, ancestor) are not
evaluated here; the engine evaluates them.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from .rules import RULES_PART_CLASS, atoms, rows_by_entry, rows_for

OPS = {"<": lambda a, b: a < b, "<=": lambda a, b: a <= b, ">": lambda a, b: a > b, ">=": lambda a, b: a >= b}
FLAG_ENTRY = "NO_EXPORT_CONTROL_CHANGE"


def derive_fields(fields: dict[str, dict]) -> dict[str, dict]:
    out = dict(fields)
    w, h = fields.get("resolution_w"), fields.get("resolution_h")
    if w and h and "elements" not in out:
        try:
            out["elements"] = {"value": str(Decimal(w["value"]) * Decimal(h["value"])), "unit": "elements", "source": "derived: resolution_w × resolution_h"}
        except InvalidOperation:
            pass
    return out


def _atom(atom: dict, fields: dict, declared: dict, part_class: str | None) -> tuple[str, str]:
    """→ (state, detail) with state ∈ true | false | missing | needs_tree."""
    if "attr" in atom:
        f = fields.get(atom["attr"])
        if f is None:
            return "missing", atom["attr"]
        if f.get("unit") != atom["unit"]:
            return "missing", f"{atom['attr']} (unit {f.get('unit')!r} is not {atom['unit']!r})"
        ok = OPS[atom["op"]](Decimal(f["value"]), Decimal(atom["threshold"]))
        return ("true" if ok else "false"), f"{atom['attr']} {f['value']} {atom['op']} {atom['threshold']} {atom['unit']}"
    if "declared" in atom:
        name = atom["declared"]
        if name not in declared:
            return "missing", f"declared.{name}"
        return ("true" if declared[name] == atom["equals"] else "false"), f"declared.{name} = {declared[name]!r}"
    if "part_class_in" in atom:
        hit = part_class in atom["part_class_in"] or RULES_PART_CLASS.get(part_class or "") in atom["part_class_in"]
        return ("true" if hit else "false"), f"part_class {part_class}"
    return "needs_tree", next(iter(atom))


def dry_run(rules: dict, *, part_class: str | None, role: str | None, fields: dict[str, dict], declared: dict) -> dict:
    fields = derive_fields(fields)
    out = {"rules_sha256": rules["sha256"], "fired": [], "released": [], "flags": [], "cannot_fire": [], "not_evaluated": [], "not_fired": []}
    for row in rows_for(rules, part_class, role):
        when = row.get("when") or {}
        results = [_atom(a, fields, declared, part_class) for a in atoms(when)]
        states = [s for s, _ in results]
        record = {"rule_id": row["id"], "entry": row.get("entry"), "jurisdiction": row.get("jurisdiction"), "atoms": [d for _, d in results], "text": row.get("text")}
        if "needs_tree" in states:
            out["not_evaluated"].append({**record, "reason": "needs the tree (any_descendant/ancestor); the engine evaluates it"})
        elif "missing" in states:
            out["cannot_fire"].append({**record, "missing": [d for s, d in results if s == "missing"]})
        elif ("any" in when and any(s == "true" for s in states)) or ("any" not in when and states and all(s == "true" for s in states)):
            if row["id"].startswith("RELEASE-"):
                out["released"].append(record)
            elif row.get("entry") == FLAG_ENTRY:
                out["flags"].append(record)
            else:
                out["fired"].append(record)
        else:
            out["not_fired"].append(record)
    return out


def flip_gone(tripped: list[str], before_entries: list[str], after: dict, rules: dict) -> dict:
    known = rows_by_entry(rules)
    fired = [f["entry"] for f in after["fired"]]
    cannot_entries = [c["entry"] for c in after["cannot_fire"]]
    still = [e for e in tripped if e in fired]
    new = [e for e in fired if e not in before_entries and e not in tripped]
    cannot = [e for e in tripped if e in cannot_entries]
    unknown = [e for e in tripped if e not in known]
    reasons: list[str] = []
    for e in tripped:
        if e in still:
            reasons.append(f"{e}: still fires")
        elif e in cannot:
            missing = next(c["missing"] for c in after["cannot_fire"] if c["entry"] == e)
            reasons.append(f"{e}: cannot fire — {', '.join(missing)} not published")
        elif e in unknown:
            reasons.append(f"{e}: no draft row; cannot conclude (rule-table gap for Charlie)")
        else:
            reasons.append(f"{e}: no fire")
    for e in new:
        reasons.append(f"{e}: new row fires")
    return {"gone": not still and not new and not cannot and not unknown, "still": still, "new": new, "cannot": cannot, "unknown": unknown, "reasons": reasons}
