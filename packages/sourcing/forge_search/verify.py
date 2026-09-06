"""The verifier: a number enters a rule only if it resolves to exact characters in the document the model was shown.

Checks, in order: schema (keys, types, known field) → sha_mismatch → span_not_found → unparseable → number_mismatch
(value or unit). Only `verify` constructs a Spec. The unit check is what catches the S2 trap: a temperature
coefficient labelled "stability" carries the wrong unit for a bias-stability field.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .documents import text_sha256

REQUIRED_KEYS = frozenset({"field", "value", "unit", "quote", "start", "end", "doc_sha256"})
FORBIDDEN_KEYS = frozenset({"classification", "jurisdiction", "entry", "entries", "reasons", "origin", "ownership", "screening",
                            "eccn", "itar", "ear", "ear99", "usml", "status", "disposition", "cleared", "compliant"})
UNIT_ALIASES = {
    "hz": "Hz",
    "°/h": "deg/h", "°/hr": "deg/h", "°/hour": "deg/h", "deg/h": "deg/h", "deg/hr": "deg/h",
    "°/s": "deg/s", "deg/s": "deg/s", "dps": "deg/s",
    "°/√h": "deg/sqrt(h)", "°/√hr": "deg/sqrt(h)", "deg/√h": "deg/sqrt(h)", "deg/sqrt(h)": "deg/sqrt(h)", "°/rthr": "deg/sqrt(h)", "deg/rt h": "deg/sqrt(h)",
    "wh/kg": "Wh/kg", "m/s": "m/s", "bits": "bits", "bit": "bits", "-bit": "bits",
    "µg": "micro g", "μg": "micro g", "ug": "micro g", "micro g": "micro g", "micro-g": "micro g",
    "ppm": "ppm", "°c": "deg C", "deg c": "deg C", "degc": "deg C", "℃": "deg C", "km": "km", "h": "h", "g": "g",
    "elements": "elements", "pixels": "elements",
    "mdps/°c": "mdps/deg C", "mdps/rthz": "mdps/sqrt(Hz)", "mdps/√hz": "mdps/sqrt(Hz)",
}
_UNIT_ALTERNATION = "|".join(re.escape(k) for k in sorted(UNIT_ALIASES, key=len, reverse=True))
UNIT = re.compile(rf"(?<![A-Za-z0-9])({_UNIT_ALTERNATION})(?![A-Za-z])", re.IGNORECASE)
NUMBER = re.compile(r"[-+±]?\d+(?:\.\d+)?")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_DECIMAL = re.compile(r"^[-+]?\d+(?:\.\d+)?$")


@dataclass(frozen=True)
class Spec:
    field: str
    value: str
    unit: str
    quote: str
    start: int
    end: int
    doc_sha256: str

    def as_dict(self) -> dict:
        return {"field": self.field, "value": self.value, "unit": self.unit, "quote": self.quote, "start": self.start, "end": self.end, "doc_sha256": self.doc_sha256}


@dataclass(frozen=True)
class Accepted:
    spec: Spec


@dataclass(frozen=True)
class Rejected:
    reason: str
    detail: str = ""


def canonical_unit(s: str) -> str | None:
    return UNIT_ALIASES.get(s.strip().lower())


def parse_number_unit(quote: str) -> tuple[Decimal, str] | None:
    number = NUMBER.search(quote.replace(",", ""))
    unit = UNIT.search(quote)
    if not number or not unit:
        return None
    try:
        return Decimal(number.group().lstrip("±+")), UNIT_ALIASES[unit.group(1).lower()]
    except InvalidOperation:
        return None


def _is_int(x) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def verify(text: str, claim: object, *, field_units: dict[str, str]) -> Accepted | Rejected:
    if not isinstance(claim, dict):
        return Rejected("schema_violation", "claim is not an object")
    keys = set(claim)
    if keys & FORBIDDEN_KEYS:
        return Rejected("schema_violation", f"forbidden keys: {sorted(keys & FORBIDDEN_KEYS)}")
    if keys != REQUIRED_KEYS:
        return Rejected("schema_violation", f"keys must be exactly {sorted(REQUIRED_KEYS)}")
    field, value, unit, quote, start, end, sha = (claim[k] for k in ("field", "value", "unit", "quote", "start", "end", "doc_sha256"))
    if not all(isinstance(x, str) for x in (field, value, unit, quote, sha)):
        return Rejected("schema_violation", "field, value, unit, quote and doc_sha256 must be strings")
    if field not in field_units:
        return Rejected("schema_violation", f"unknown field {field!r}")
    if not _DECIMAL.match(value):
        return Rejected("schema_violation", "value must be a decimal string")
    if not _HEX64.match(sha):
        return Rejected("schema_violation", "doc_sha256 must be 64 lowercase hex characters")
    if not (_is_int(start) and _is_int(end)) or start < 0 or end < start or end > len(text):
        return Rejected("schema_violation", "start and end must satisfy 0 <= start <= end <= len(text)")
    if text_sha256(text) != sha:
        return Rejected("sha_mismatch", "claim was made against a different document text")
    if not quote or text[start:end] != quote:
        return Rejected("span_not_found", f"text[{start}:{end}] != quote")
    parsed = parse_number_unit(quote)
    if parsed is None:
        return Rejected("unparseable", "no number with a recognised unit in the quote")
    number, parsed_unit = parsed
    expected = field_units[field]
    claimed_unit = canonical_unit(unit)
    if parsed_unit != expected or claimed_unit != expected:
        return Rejected("number_mismatch", f"unit in quote {parsed_unit!r}, claimed {claimed_unit!r}, field needs {expected!r}")
    if Decimal(value) != number:
        return Rejected("number_mismatch", f"quote says {number} {parsed_unit}, claim says {value}")
    return Accepted(Spec(field, value, expected, quote, start, end, sha))
