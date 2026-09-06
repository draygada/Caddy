"""The verifier: a number enters a rule only if it resolves to exact characters in the document the model was shown.

Checks, in order: schema (keys, types, known field) → sha_mismatch → span_not_found → unparseable → number_mismatch
(unit, ambiguity, then value). Only `verify` constructs a Spec, and the number it stores is the document's, not
the model's spelling of it. The unit check is what catches the S2 trap: a temperature coefficient labelled
"stability" carries the wrong unit for a bias-stability field. Everything here fails closed: a quote whose
numbers are ambiguous — a comma between digits, or two separate groups of the field's own unit — buys
nothing. A dimension tuple ("160 x 120 pixels") is ONE group: the datasheet writes the unit once, after the
last component, and every component of it is a figure the document states.
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
    "ppm": "ppm", "°c": "deg C", "deg c": "deg C", "degc": "deg C", "℃": "deg C", "km": "km", "mm": "mm", "h": "h", "g": "g",
    "elements": "elements", "pixels": "elements",
    "mdps/°c": "mdps/deg C", "mdps/rthz": "mdps/sqrt(Hz)", "mdps/√hz": "mdps/sqrt(Hz)",
}
_BY_LENGTH = sorted(UNIT_ALIASES, key=len, reverse=True)
_WORDY = "|".join(re.escape(k) for k in _BY_LENGTH if k[0].isalnum())
_SYMBOLIC = "|".join(re.escape(k) for k in _BY_LENGTH if not k[0].isalnum())
# A wordy unit needs a non-alphanumeric before it, or "h" matches inside "Wh"; a symbolic one (°/h, ℃, µg)
# may sit flush against its number, which is how vendors write it.
UNIT = re.compile(rf"((?<![A-Za-z0-9])(?:{_WORDY})|(?:{_SYMBOLIC}))(?![A-Za-z])", re.IGNORECASE)
_NUMBER_SRC = r"[-+±]?\d+(?:\.\d+)?"
NUMBER = re.compile(_NUMBER_SRC)
# A dimension tuple — "160 x 120 pixels", "40 x 40 x 20 mm" — states several figures of ONE unit, written once
# after the last component. Every component binds that unit, and the tuple counts as a single group.
TUPLE = re.compile(rf"{_NUMBER_SRC}(?:\s*(?:[xX×]|by)\s*{_NUMBER_SRC})+")
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


def _clear(quote: str, lo: int, hi: int) -> bool:
    """Nothing but separators between two spans — no letter, no digit."""
    return not any(c.isalnum() for c in quote[lo:hi])


def _binds(quote: str, number: re.Match, span: tuple[int, int]) -> bool:
    """A unit binds to a number only when nothing but separators sits between them, on either side."""
    start, end = span
    if start >= number.end():
        return _clear(quote, number.end(), start)
    if end <= number.start():
        return _clear(quote, end, number.start())
    return False


def _figures(text: str) -> list[Decimal] | None:
    """The numbers in `text`, as written. None if one is not a decimal — unreachable through NUMBER, kept as
    the fail-closed guard on the trust boundary."""
    try:
        return [Decimal(m.group().lstrip("±+")) for m in NUMBER.finditer(text)]
    except InvalidOperation:
        return None


def _bound_groups(quote: str) -> list[tuple[list[Decimal], str]] | None:
    """Every group of figures the quote states with a recognised unit adjacent to it, in document order. A
    dimension tuple is one group whose components share the unit that follows it; every other bound number is
    a group of one. None when the quote's digits are not readable as written (an ambiguous comma)."""
    if _AMBIGUOUS_COMMA.search(quote):
        return None
    quote = quote.replace(",", "")
    # ponytail: O(numbers x units) over one quote — fine for a line, ~25s on a hostile whole-document
    # quote; cap the gap length if a caller ever quotes a whole page.
    units = [(m.span(), unit) for m in UNIT.finditer(quote) if (unit := canonical_unit(m.group(1)))]
    groups: list[tuple[int, list[Decimal], str]] = []
    tuples: list[tuple[int, int]] = []
    for tup in TUPLE.finditer(quote):
        # The unit of a tuple is written after its last component, never before it.
        unit = next((u for (start, _), u in units if start >= tup.end() and _clear(quote, tup.end(), start)), None)
        if unit is None:
            continue
        figures = _figures(tup.group())
        if figures is None:
            return None
        groups.append((tup.start(), figures, unit))
        tuples.append(tup.span())
    for number in NUMBER.finditer(quote):
        if any(lo <= number.start() < hi for lo, hi in tuples):
            continue
        unit = next((u for span, u in units if _binds(quote, number, span)), None)
        if unit is None:
            continue
        figures = _figures(number.group())
        if figures is None:
            return None
        groups.append((number.start(), figures, unit))
    groups.sort(key=lambda g: g[0])
    return [(figures, unit) for _, figures, unit in groups]


def parse_number_unit(quote: str) -> tuple[Decimal, str] | None:
    """The first bound number in document order with its unit — for a dimension tuple, its first component and
    the unit the whole tuple shares. A number never borrows the unit of another figure in the same quote, and
    a spelling that canonicalises to nothing is not a unit."""
    groups = _bound_groups(quote)
    return (groups[0][0][0], groups[0][1]) if groups else None


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
    groups = _bound_groups(quote)
    if not groups:
        return Rejected("unparseable", "no number with a recognised unit in the quote")
    expected = field_units[field]
    claimed_unit = canonical_unit(unit)
    first_unit = groups[0][1]
    if first_unit != expected or claimed_unit != expected:
        return Rejected("number_mismatch", f"unit in quote {first_unit!r}, claimed {claimed_unit!r}, field needs {expected!r}")
    # Ambiguity is counted in groups, not figures: a dimension tuple is one group and any of its components may
    # be the claim. Two groups of the field's own unit support either figure, so they support neither — unless
    # they are the same single figure written twice.
    stated = [figures for figures, u in groups if u == expected]
    if len(stated) > 1 and not all(len(f) == 1 and f[0] == stated[0][0] for f in stated):
        return Rejected("number_mismatch", f"ambiguous: {len(stated)} groups bind {expected!r}: "
                        + "; ".join(" x ".join(str(n) for n in f) for f in stated))
    number = next((n for n in stated[0] if n == Decimal(value)), None)
    if number is None:
        return Rejected("number_mismatch", f"quote says {' x '.join(str(n) for n in stated[0])} {expected}, claim says {value}")
    return Accepted(Spec(field, str(number), expected, quote, start, end, sha))
