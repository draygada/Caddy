"""The draft rule rows as data. Thresholds become decimal strings at load so no record ever carries a float.

RULES_PART_CLASS maps the lane's part classes onto the draft's coarser applies_to.part_class until the engine
lands and owns the mapping. rules.DRAFT.json is DRAFT pending Charlie's sign-off (design spec D-6).
"""
from __future__ import annotations

import json
from pathlib import Path

from forge_sourcing.hashing import sha256_bytes

RULES_PART_CLASS = {
    "thermal_imager": "sensor", "sensor": "sensor", "gnss": "sensor", "imu": "sensor",
    "ic": "ic", "cell": "cell", "pack": "battery", "battery": "battery", "radio": "radio",
    "board": "pcb", "pcb": "pcb", "connector": "connector", "heat_sink": "heat_sink",
    "sensor_pod": "sensor_pod", "airframe": "airframe",
}


def atoms(when) -> list[dict]:
    out: list[dict] = []
    if not isinstance(when, dict):
        return out
    if "all" in when or "any" in when:
        for a in list(when.get("all") or []) + list(when.get("any") or []):
            out.extend(atoms(a))
    elif "not" in when:
        out.extend(atoms(when["not"]))
    else:
        out.append(when)
    return out


def load_rules(path: Path) -> dict:
    raw = Path(path).read_bytes()
    rows = json.loads(raw.decode("utf-8"))
    for row in rows:
        for atom in atoms(row.get("when") or {}):
            if "threshold" in atom:
                atom["threshold"] = str(atom["threshold"])
    return {"sha256": sha256_bytes(raw), "source": Path(path).name, "status": "DRAFT pending Charlie (design spec D-6)", "rows": rows}


def rows_for(rules: dict, part_class: str | None, role: str | None) -> list[dict]:
    mapped = RULES_PART_CLASS.get(part_class or "", part_class)
    out = []
    for row in rules["rows"]:
        ap = row.get("applies_to") or {}
        if ap.get("part_class") not in (None, mapped):
            continue
        if ap.get("role") not in (None, role):
            continue
        out.append(row)
    return out


DERIVED_INPUTS = {"elements": {"resolution_w": "elements", "resolution_h": "elements"}}   # a derived attr's inputs are extracted, never typed


def fields_for(rules: dict, part_class: str | None, role: str | None) -> dict[str, str]:
    units: dict[str, str] = {}
    for row in rows_for(rules, part_class, role):
        for atom in atoms(row.get("when") or {}):
            if "attr" in atom:
                units.setdefault(atom["attr"], atom["unit"])
                for name, unit in DERIVED_INPUTS.get(atom["attr"], {}).items():
                    units.setdefault(name, unit)
    return units


def rule_sentences(rules: dict, part_class: str | None, role: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in rows_for(rules, part_class, role):
        for atom in atoms(row.get("when") or {}):
            if "attr" in atom and row.get("text"):
                out.setdefault(atom["attr"], row["text"])
                for name in DERIVED_INPUTS.get(atom["attr"], {}):
                    out.setdefault(name, row["text"])
    return out


def release_texts(rules: dict, part_class: str | None, role: str | None) -> list[str]:
    return [row["text"] for row in rows_for(rules, part_class, role) if row["id"].startswith("RELEASE-") and row.get("text")]


def rows_by_entry(rules: dict) -> dict[str, dict]:
    return {row["entry"]: row for row in rules["rows"] if row.get("entry")}
