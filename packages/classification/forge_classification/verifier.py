"""The verifier's fourth document class: a regulatory citation.

A claim is a byte range in a hashed reference-pack unit. It is accepted only if the unit resolves,
is quotable, has the claimed hash, and `unit.text[start:end] == quote`. The claim schema carries no
conclusion of any kind; a key such as `disposition` or `jurisdiction` is a schema violation. Only
`verify_citation` constructs a `Citation`, so an unverified quote has no type the engine will carry.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .pack import ReferencePack, resolve

REQUIRED_KEYS = frozenset({"unit_key", "unit_sha256", "quote", "start", "end"})
FORBIDDEN_KEYS = frozenset(
    {"classification", "jurisdiction", "entry", "reasons", "origin", "ownership", "screening",
     "disposition", "status", "claim_class", "instrument", "posture", "route"}
)
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class Citation:
    unit_key: str
    unit_sha256: str
    start: int
    end: int
    quote: str
    citation: str

    def as_dict(self) -> dict:
        return {"unit_key": self.unit_key, "unit_sha256": self.unit_sha256, "start": self.start,
                "end": self.end, "quote": self.quote}


@dataclass(frozen=True)
class Accepted:
    citation: Citation


@dataclass(frozen=True)
class Rejected:
    reason: str  # schema_violation | unit_unknown | unit_unquotable | sha_mismatch | span_not_found
    detail: str = ""


def verify_citation(pack: ReferencePack, claim: object) -> Accepted | Rejected:
    if not isinstance(claim, dict):
        return Rejected("schema_violation", "claim is not an object")
    keys = set(claim)
    if keys & FORBIDDEN_KEYS:
        return Rejected("schema_violation", f"forbidden keys: {sorted(keys & FORBIDDEN_KEYS)}")
    if keys != REQUIRED_KEYS:
        return Rejected("schema_violation", f"keys must be exactly {sorted(REQUIRED_KEYS)}")
    if not isinstance(claim["unit_key"], str) or not isinstance(claim["quote"], str):
        return Rejected("schema_violation", "unit_key and quote must be strings")
    if not isinstance(claim["unit_sha256"], str) or not _HEX64.match(claim["unit_sha256"]):
        return Rejected("schema_violation", "unit_sha256 must be 64 lowercase hex characters")
    start, end = claim["start"], claim["end"]
    if not (isinstance(start, int) and isinstance(end, int)) or isinstance(start, bool) or isinstance(end, bool):
        return Rejected("schema_violation", "start and end must be integers")
    if start < 0 or end < start:
        return Rejected("schema_violation", "start and end must satisfy 0 <= start <= end")

    unit = resolve(pack, claim["unit_key"])
    if unit is None:
        return Rejected("unit_unknown", claim["unit_key"])
    if unit.text is None or unit.sha256 is None:
        return Rejected("unit_unquotable", unit.unit_key)
    if unit.sha256 != claim["unit_sha256"]:
        return Rejected("sha_mismatch", unit.unit_key)
    if not claim["quote"] or unit.text[start:end] != claim["quote"]:
        return Rejected("span_not_found", f"{unit.unit_key}[{start}:{end}]")
    return Accepted(Citation(unit.unit_key, unit.sha256, start, end, claim["quote"], unit.citation))
