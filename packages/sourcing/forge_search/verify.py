"""The verifier: a number enters a rule only if it resolves to exact characters in the document the model was shown.

Checks, in order: schema (keys, types, known field) → sha_mismatch → span_not_found → unparseable → number_mismatch
(unit, ambiguity, then value). Only `verify` constructs a Spec, and the number it stores is the document's, not
the model's spelling of it. The unit check is what catches the S2 trap: a temperature coefficient labelled
"stability" carries the wrong unit for a bias-stability field. Everything here fails closed: a quote whose
numbers are ambiguous — a comma between digits, or two figures of the field's own unit — buys nothing.
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
_BY_LENGTH = sorted(UNIT_ALIASES, key=len, reverse=True)
_WORDY = "|".join(re.escape(k) for k in _BY_LENGTH if k[0].isalnum())
_SYMBOLIC = "|".join(re.escape(k) for k in _BY_LENGTH if not k[0].isalnum())
# A wordy unit needs a non-alphanumeric before it, or "h" matches inside "Wh"; a symbolic one (°/h, ℃, µg)
# may sit flush against its number, which is how vendors write it.
UNIT = re.compile(rf"((?<![A-Za-z0-9])(?:{_WORDY})|(?:{_SYMBOLIC}))(?![A-Za-z])", re.IGNORECASE)
NUMBER = re.compile(r"[-+±]?\d+(?:\.\d+)?")
# Used with fullmatch, never match: "$" also matches before a trailing newline, so "8.7\n" would pass.
_HEX64 = re.compile(r"[0-9a-f]{64}")
_DECIMAL = re.compile(r"[-+]?\d+(?:\.\d+)?")
# A comma between digits is a thousands separator only in a \d,\d{3} group. Anywhere else it is a European
# decimal point ("0,3" is 0.3, not 3) or a list ("1,2,3" is three figures, not 123), and stripping it would
# hand a rule a number the document never states — so the quote is refused instead.
_AMBIGUOUS_COMMA = re.compile(r"\d,(?!\d{3}(?!\d))\d")


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


def _binds(quote: str, number: re.Match, span: tuple[int, int]) -> bool:
    """A unit binds to a number only when nothing but separators sits between them — no letter, no digit."""
    start, end = span
    if start >= number.end():
        gap = quote[number.end():start]
    elif end <= number.start():
        gap = quote[end:number.start()]
    else:
        return False
    return not any(c.isalnum() for c in gap)


def _bound_pairs(quote: str) -> list[tuple[Decimal, str]] | None:
    """Every (number, canonical unit) pair the quote states, in document order — each number paired only with a
    unit adjacent to it. None when the quote's digits are not readable as written (an ambiguous comma)."""
    if _AMBIGUOUS_COMMA.search(quote):
        return None
    quote = quote.replace(",", "")
    # ponytail: O(numbers x units) over one quote — fine for a line, ~25s on a hostile whole-document
    # quote; cap the gap length if a caller ever quotes a whole page.
    units = [(m.span(), canonical_unit(m.group(1))) for m in UNIT.finditer(quote)]
    pairs = []
    for number in NUMBER.finditer(quote):
        for span, unit in units:
            if unit is not None and _binds(quote, number, span):
                try:
                    pairs.append((Decimal(number.group().lstrip("±+")), unit))
                except InvalidOperation:
                    return None
                break
    return pairs


def parse_number_unit(quote: str) -> tuple[Decimal, str] | None:
    """The first number with a recognised unit adjacent to it, following or preceding. A number never borrows
    the unit of another figure in the same quote, and a spelling that canonicalises to nothing is not a unit."""
    pairs = _bound_pairs(quote)
    return pairs[0] if pairs else None


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
    if not _DECIMAL.fullmatch(value):
        return Rejected("schema_violation", "value must be a decimal string")
    if not _HEX64.fullmatch(sha):
        return Rejected("schema_violation", "doc_sha256 must be 64 lowercase hex characters")
    if not (_is_int(start) and _is_int(end)) or start < 0 or end < start or end > len(text):
        return Rejected("schema_violation", "start and end must satisfy 0 <= start <= end <= len(text)")
    if text_sha256(text) != sha:
        return Rejected("sha_mismatch", "claim was made against a different document text")
    if not quote or text[start:end] != quote:
        return Rejected("span_not_found", f"text[{start}:{end}] != quote")
    pairs = _bound_pairs(quote)
    if not pairs:
        return Rejected("unparseable", "no number with a recognised unit in the quote")
    number, parsed_unit = pairs[0]
    expected = field_units[field]
    claimed_unit = canonical_unit(unit)
    if parsed_unit != expected or claimed_unit != expected:
        return Rejected("number_mismatch", f"unit in quote {parsed_unit!r}, claimed {claimed_unit!r}, field needs {expected!r}")
    # Two different figures of the field's own unit: the quote supports either, so it supports neither.
    stated = sorted({n for n, u in pairs if u == expected})
    if len(stated) > 1:
        return Rejected("number_mismatch", f"ambiguous: {len(stated)} figures bind {expected!r}: " + ", ".join(str(n) for n in stated))
    if Decimal(value) != number:
        return Rejected("number_mismatch", f"quote says {number} {parsed_unit}, claim says {value}")
    return Accepted(Spec(field, str(number), expected, quote, start, end, sha))
