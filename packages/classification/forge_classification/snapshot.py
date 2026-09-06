"""The fact snapshot: what one item asserts, hashed. Built from a Forge part revision or from a
plain product description. An explicit unknown ("unknown", "tbd", "?") is recorded as such and never
folded into a value; the engine sees it as an open fact, not as an answer."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .hashing import canonical_bytes, sha256

ITEM_KINDS = ("commodity", "software", "technology")
EXPLICIT_UNKNOWN_TOKENS = frozenset(
    {"unknown", "unsure", "not sure", "not known", "tbd", "to be determined", "not yet determined", "unclear", "?"}
)


@dataclass(frozen=True)
class Fact:
    path: str
    value: str
    unit: str | None
    recorded_unknown: bool = False


@dataclass(frozen=True)
class FactSnapshot:
    part_revision_id: str | None
    item_kind: str
    description: str
    facts: dict[str, Fact]
    sha256: str

    def known_paths(self) -> set[str]:
        return {p for p, f in self.facts.items() if not f.recorded_unknown}


def is_explicit_unknown(value: object) -> bool:
    return value is not None and str(value).strip().lower() in EXPLICIT_UNKNOWN_TOKENS


def _fact(path: str, raw: object, unit: str | None) -> Fact:
    unknown = is_explicit_unknown(raw)
    return Fact(path, "unknown" if unknown else ("" if raw is None else str(raw)), unit, unknown)


def _add_fact(facts: dict[str, Fact], path: str, raw: object, unit: str | None) -> None:
    if path in facts:
        raise ValueError(f"duplicate fact path: {path!r}")
    facts[path] = _fact(path, raw, unit)


def _finish(part_revision_id: str | None, item_kind: str, description: str, facts: dict[str, Fact]) -> FactSnapshot:
    if item_kind not in ITEM_KINDS:
        raise ValueError(f"item_kind must be one of {ITEM_KINDS}, got {item_kind!r}")
    fingerprint = {
        "part_revision_id": part_revision_id,
        "item_kind": item_kind,
        "description": description,
        "facts": {p: [f.value, f.unit, f.recorded_unknown] for p, f in sorted(facts.items())},
    }
    return FactSnapshot(part_revision_id, item_kind, description, facts, sha256(canonical_bytes(fingerprint)))


def _extra_facts(facts: dict[str, Fact], extra: Iterable[dict] | dict | None) -> None:
    if not extra:
        return
    items = extra.items() if isinstance(extra, dict) else ((f["path"], f) for f in extra)
    for path, spec in items:
        if isinstance(spec, dict) and "value" in spec:
            _add_fact(facts, path, spec.get("value"), spec.get("unit"))
        else:
            _add_fact(facts, path, spec, None)


def snapshot_from_product(description: str, facts: dict | list[dict] | None = None, *, item_kind: str = "commodity",
                          part_revision_id: str | None = None) -> FactSnapshot:
    """A plain product: a description and any facts as `{path: value}` or `{path: {value, unit}}`."""
    out: dict[str, Fact] = {}
    _extra_facts(out, facts)
    return _finish(part_revision_id, item_kind, (description or "").strip(), out)


def snapshot_from_part_revision(part_revision: dict, facts: dict | list[dict] | None = None, *, item_kind: str) -> FactSnapshot:
    """A Forge `forge.part-revision/1` envelope: typed parameters, body metadata and BOM identity become
    facts; expressions are derived values the kernel evaluates, so they are skipped."""
    doc = part_revision["part_document"]
    revision_id = doc["revision"]["revision_id"]
    units = doc.get("units", {})
    unit_by_type = {"LENGTH": units.get("length", "mm"), "ANGLE": units.get("angle", "deg")}
    out: dict[str, Fact] = {}
    for _, param in sorted(doc.get("parameters", {}).items()):
        if param.get("literal") is None:
            continue
        path = f"param.{param['name']}"
        _add_fact(out, path, param["literal"], unit_by_type.get(param["value_type"]))
    descriptions: list[str] = []
    bom_seen = False
    for body in doc.get("bodies", []):
        bid = body["body_id"].split(":", 1)[-1]
        for key, value in sorted((body.get("metadata") or {}).items()):
            path = f"body.{bid}.{key}"
            _add_fact(out, path, value, None)
        bom = body.get("bom_identity")
        if bom:
            prefix = "bom" if not bom_seen else f"bom.{bid}"
            bom_seen = True
            for key in ("part_number", "revision", "description"):
                if bom.get(key) is not None:
                    path = f"{prefix}.{key}"
                    _add_fact(out, path, bom[key], None)
            if bom.get("description"):
                descriptions.append(str(bom["description"]))
    _extra_facts(out, facts)
    intent = (doc["revision"].get("intent") or "").strip().rstrip(".")
    description = ". ".join(part for part in [intent, *descriptions] if part)
    return _finish(revision_id, item_kind, description, out)
