"""The fact snapshot: what one part revision asserts about one item, and how strongly.

Facts come from the frozen PartDocument (typed parameters, body metadata, BOM identity) and from
`compliance.declared-facts.v1` records bound to that revision. The evidence grade is derived from
the platform's own `source_confidence` vocabulary, never from a new mechanism:

  MEASURED with an artifact reference           -> verified
  DECLARED by a HUMAN actor                       -> attested
  anything else (typed, inferred, agent-declared) -> asserted

An explicit unknown ("unknown", "tbd", "?") is recorded as such and never folded into a value.
"""

from __future__ import annotations

from dataclasses import dataclass

from .records import canonical_bytes, sha256

ITEM_KINDS = ("commodity", "software", "technology")
EXPLICIT_UNKNOWN_TOKENS = frozenset(
    {"unknown", "unsure", "not sure", "not known", "tbd", "to be determined", "not yet determined", "unclear", "?"}
)
GRADE_RANK = {"asserted": 0, "attested": 1, "verified": 2}


@dataclass(frozen=True)
class Fact:
    path: str
    value: str
    unit: str | None
    evidence_grade: str
    source: str
    recorded_unknown: bool = False


@dataclass(frozen=True)
class FactSnapshot:
    part_revision_id: str
    item_kind: str
    introduction: str
    facts: dict[str, Fact]
    sha256: str

    def known_paths(self) -> set[str]:
        return {p for p, f in self.facts.items() if not f.recorded_unknown}

    def value(self, path: str) -> str | None:
        fact = self.facts.get(path)
        return None if fact is None or fact.recorded_unknown else fact.value


def is_explicit_unknown(value: object) -> bool:
    return value is not None and str(value).strip().lower() in EXPLICIT_UNKNOWN_TOKENS


def _grade(record: dict) -> str:
    level = record.get("source_confidence", {}).get("level")
    actor_type = record.get("actor", {}).get("actor_type")
    artifacts = record.get("provenance", {}).get("artifact_refs") or []
    if level == "MEASURED":
        return "verified" if artifacts else "asserted"
    if level == "DECLARED" and actor_type == "HUMAN":
        return "attested"
    return "asserted"


def _put(facts: dict[str, Fact], fact: Fact) -> None:
    existing = facts.get(fact.path)
    if existing is None or GRADE_RANK[fact.evidence_grade] >= GRADE_RANK[existing.evidence_grade]:
        facts[fact.path] = fact


def snapshot(part_revision: dict, declared: list[dict], *, item_kind: str) -> FactSnapshot:
    if item_kind not in ITEM_KINDS:
        raise ValueError(f"item_kind must be one of {ITEM_KINDS}, got {item_kind!r}")
    doc = part_revision["part_document"]
    revision_id = doc["revision"]["revision_id"]
    units = doc.get("units", {})
    unit_by_type = {"LENGTH": units.get("length", "mm"), "ANGLE": units.get("angle", "deg")}
    facts: dict[str, Fact] = {}

    for pid, param in sorted(doc.get("parameters", {}).items()):
        if param.get("literal") is None:
            continue  # expressions are derived values; the kernel evaluates them, not this lane
        _put(facts, Fact(f"param.{param['name']}", str(param["literal"]), unit_by_type.get(param["value_type"]),
                         "asserted", f"part_document.parameters.{pid}"))

    descriptions: list[str] = []
    bom_seen = False
    for body in doc.get("bodies", []):
        bid = body["body_id"].split(":", 1)[-1]
        for key, value in sorted((body.get("metadata") or {}).items()):
            _put(facts, Fact(f"body.{bid}.{key}", str(value), None, "asserted", f"part_document.bodies.{body['body_id']}.metadata"))
        bom = body.get("bom_identity")
        if bom:
            prefix = "bom" if not bom_seen else f"bom.{bid}"
            bom_seen = True
            for key in ("part_number", "revision", "description"):
                if bom.get(key) is not None:
                    _put(facts, Fact(f"{prefix}.{key}", str(bom[key]), None, "asserted", f"part_document.bodies.{body['body_id']}.bom_identity"))
            if bom.get("description"):
                descriptions.append(str(bom["description"]))

    for record in declared:
        payload = record.get("payload", {})
        if payload.get("part_revision_id") not in (None, revision_id):
            continue  # a declaration for another revision is not this snapshot's fact
        grade = _grade(record)
        source = f"{record.get('record_kind', 'declared')}:{record.get('record_id', '?')}"
        for item in payload.get("facts", []):
            raw = item.get("value")
            unknown = is_explicit_unknown(raw)
            value = "unknown" if unknown else ("" if raw is None else str(raw))
            _put(facts, Fact(item["path"], value, item.get("unit"), grade, source, recorded_unknown=unknown))

    intent = doc["revision"].get("intent") or ""
    introduction = ". ".join(part for part in [intent.strip().rstrip("."), *descriptions] if part)
    fingerprint = {
        "part_revision_id": revision_id,
        "item_kind": item_kind,
        "introduction": introduction,
        "facts": {p: [f.value, f.unit, f.evidence_grade, f.recorded_unknown] for p, f in sorted(facts.items())},
    }
    return FactSnapshot(revision_id, item_kind, introduction, facts, sha256(canonical_bytes(fingerprint)))
