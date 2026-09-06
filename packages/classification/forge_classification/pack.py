"""The reference pack: dated, content-addressed, subparagraph-grain regulatory text.

Built by a deterministic parse of the committed eCFR XML (22 CFR 121.1 — the USML; 15 CFR 774
Supp. No. 1 — the CCL; 22 CFR 120.41 — the ITAR "specially designed" definition). GPO's XML does
not nest paragraphs: enumerators such as `(a)(1)(i)` and `a.4.b.` are literal text in flat `<P>`
elements, so the tree is rebuilt from the enumerator ladder. `resolve` is the only lookup — a
dictionary read, never a search. A provision that does not resolve is unprintable everywhere.
"""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .hashing import canonical_bytes, sha256

ROMANS = (
    "I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI".split()
)
_LOWER_ROMANS = [r.lower() for r in ROMANS]
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")
_BLOCK = re.compile(r"<NOTE>.*?</NOTE>|<P>.*?</P>", re.S)
_USML_HEAD = re.compile(r"<HD1>\s*Category\s+([IVXLC]+)\s*(?:&#x2014;|—|-)\s*([^<]*?)\s*</HD1>", re.S)
_USML_ENUM = re.compile(r"^(\*)?\s*(\(([a-zA-Z0-9]+)\)(?:-\(([a-z0-9]+)\))?)\s*(.*)$", re.S)
_CCL_HEAD = re.compile(r"<FP-2>\s*<B>\s*(\d[A-E]\d{3})\b(.*?)</B>", re.S)
_CCL_ITEMS = re.compile(r"Items:\s*</I>")
_CCL_ENUM = re.compile(r"^((?:[a-z]|\d+)(?:\.(?:[a-z]|\d+))*)\.\s+(.*)$", re.S)
_SECTION_ENUM = _USML_ENUM
_ECCN = re.compile(r"^(\d[A-Ea-e]\d{3})((?:\.(?:[a-zA-Z]|\d+))*)\.?$")
_USML_KEY = re.compile(r"^(?:usml\s*)?(?:category\s*)?([ivxlc]+)\s*((?:\s*\([a-z0-9]+\)(?:-\([a-z0-9]+\))?)*)$", re.I)


def _text(fragment: str) -> str:
    return _WS.sub(" ", html.unescape(_TAG.sub("", fragment))).strip()


@dataclass(frozen=True)
class Unit:
    unit_key: str
    citation: str
    list_name: str  # USML | CCL | ITAR_DEF | RESIDUAL
    text: str | None
    sha256: str | None
    parent: str | None
    sme: bool = False
    notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ReferencePack:
    units: dict[str, Unit]
    categories: tuple[str, ...]
    eccns: tuple[str, ...]
    manifest: dict
    sha256: str


@dataclass(frozen=True)
class UnitDiff:
    changed: list[str]
    added: list[str]
    removed: list[str]


class ReferencePackIntegrityError(ValueError):
    """The default regulatory corpus no longer matches its pinned trust root."""


# --- provision strings ---------------------------------------------------------------------

def canonical_provision(raw: str) -> str | None:
    s = raw.strip()
    if not s:
        return None
    upper = s.upper().replace(" ", "")
    if upper in ("EAR99", "NOT_SUBJECT", "NOTSUBJECT"):
        return "EAR99" if upper == "EAR99" else "NOT_SUBJECT"
    m = _ECCN.match(re.sub(r"^(?i:eccn)\s*", "", s).replace(" ", ""))
    if m:
        return m.group(1).upper() + m.group(2).lower()
    m = _USML_KEY.match(s)
    if m and m.group(1).upper() in ROMANS:
        return f"USML {m.group(1).upper()}{m.group(2).replace(' ', '').lower()}"
    m = re.match(r"^(?:22\s*CFR\s*)?120\.41\s*((?:\([a-z0-9]+\))*)$", s, re.I)
    if m:
        return f"22 CFR 120.41{m.group(1).lower().replace(' ', '')}"
    m = re.match(r"^(?:15\s*CFR\s*)?772\.1\s*(?:SD|[\"“']?specially designed[\"”']?)\s*((?:\([a-z0-9]+\))*)$", s, re.I)
    if m:
        return f"15 CFR 772.1 SD{m.group(1).lower().replace(' ', '')}"
    return None


def resolve(pack: ReferencePack, provision: str) -> Unit | None:
    key = canonical_provision(provision)
    return pack.units.get(key) if key else None


# --- parsers --------------------------------------------------------------------------------

class _Ladder:
    """Tracks the open enumerator path for one category or section."""

    def __init__(self) -> None:
        self.path: list[str] = []

    def place(self, token: str) -> str:
        if token.isdigit():
            level = 2
        elif token.isupper():
            level = 4 if len(self.path) >= 3 else 1
        elif token in _LOWER_ROMANS and len(self.path) >= 2 and self._roman_follows(token):
            level = 3
        else:
            level = 1
        self.path = self.path[: level - 1] + [token]
        return "".join(f"({p})" for p in self.path)

    def _roman_follows(self, token: str) -> bool:
        if len(self.path) == 2:
            return token == "i"
        current = self.path[2] if len(self.path) >= 3 else None
        if current in _LOWER_ROMANS:
            return _LOWER_ROMANS.index(token) == _LOWER_ROMANS.index(current) + 1
        return token == "i"


def _walk_paragraphs(segment: str, root_key: str, citation_root: str, list_name: str, units: dict[str, Unit]) -> None:
    ladder = _Ladder()
    current = root_key
    for block in _BLOCK.finditer(segment):
        raw = block.group(0)
        if raw.startswith("<NOTE>"):
            _attach_note(units, current, _text(raw))
            continue
        body = _text(raw[3:-4])
        m = _USML_ENUM.match(body)
        if not m:
            _attach_note(units, current, body)
            continue
        sme, enum, token, range_end, rest = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        path = ladder.place(token)
        if range_end:
            path = path[: -len(f"({token})")] + f"({token})-({range_end})"
        key = f"{root_key}{path}"
        parent = f"{root_key}{path[: path.rfind('(')]}" if path.count("(") > 1 else root_key
        text = rest.strip()
        units[key] = Unit(
            unit_key=key,
            citation=f"{citation_root}{path}",
            list_name=list_name,
            text=text,
            sha256=sha256(text.encode("utf-8")),
            parent=parent,
            sme=bool(sme),
        )
        current = key


def _attach_note(units: dict[str, Unit], key: str, note: str) -> None:
    unit = units.get(key)
    if unit is None or not note:
        return
    units[key] = Unit(**{**unit.__dict__, "notes": unit.notes + (note,)})


def parse_usml(xml_text: str) -> dict[str, Unit]:
    units: dict[str, Unit] = {}
    heads = list(_USML_HEAD.finditer(xml_text))
    for i, head in enumerate(heads):
        roman, name = head.group(1), _text(head.group(2))
        if roman not in ROMANS:
            continue
        end = heads[i + 1].start() if i + 1 < len(heads) else len(xml_text)
        key = f"USML {roman}"
        units[key] = Unit(key, f"22 CFR 121.1 Category {roman}", "USML", name, sha256(name.encode()), None)
        _walk_paragraphs(xml_text[head.end():end], key, f"22 CFR 121.1 Category {roman}", "USML", units)
    return units


def parse_ccl(xml_text: str) -> tuple[dict[str, Unit], tuple[str, ...]]:
    units: dict[str, Unit] = {}
    heads = list(_CCL_HEAD.finditer(xml_text))
    eccns: list[str] = []
    for i, head in enumerate(heads):
        code = head.group(1)
        title = _text(head.group(2))
        end = heads[i + 1].start() if i + 1 < len(heads) else len(xml_text)
        segment = xml_text[head.end():end]
        eccns.append(code)
        units[code] = Unit(code, f"15 CFR 774 Supp. No. 1 ECCN {code}", "CCL", title, sha256(title.encode()), None)
        items = _CCL_ITEMS.search(segment)
        if not items:
            continue
        current = code
        for block in _BLOCK.finditer(segment[items.end():]):
            raw = block.group(0)
            if raw.startswith("<NOTE>"):
                _attach_note(units, current, _text(raw))
                continue
            body = _text(raw[3:-4])
            m = _CCL_ENUM.match(body)
            if not m:
                _attach_note(units, current, body)
                continue
            path, rest = m.group(1), m.group(2).strip()
            key = f"{code}.{path}"
            parent = f"{code}.{path.rsplit('.', 1)[0]}" if "." in path else code
            units[key] = Unit(key, f"15 CFR 774 Supp. No. 1 ECCN {key}", "CCL", rest, sha256(rest.encode()), parent)
            current = key
    return units, tuple(eccns)


def parse_section(xml_text: str, root_key: str, citation_root: str, list_name: str) -> dict[str, Unit]:
    """A single CFR section with an (a)(1)(i) ladder, e.g. 22 CFR 120.41."""
    units: dict[str, Unit] = {}
    head = re.search(r"<HEAD>(.*?)</HEAD>", xml_text, re.S)
    title = _text(head.group(1)) if head else root_key
    units[root_key] = Unit(root_key, citation_root, list_name, title, sha256(title.encode()), None)
    body = xml_text[head.end():] if head else xml_text
    _walk_paragraphs(body, root_key, citation_root, list_name, units)
    return units


_DEF_TERM = re.compile(r"<P>\s*<I>\s*([A-Z][^<]*?)\.\s*</I>", re.S)


def parse_definition(xml_text: str, term: str, root_key: str, citation_root: str, list_name: str) -> dict[str, Unit]:
    """One defined term inside a definitions section (15 CFR 772.1), from its `<P><I>Term.</I>`
    paragraph to the next term paragraph; the ladder inside it is the section ladder."""
    units: dict[str, Unit] = {}
    terms = list(_DEF_TERM.finditer(xml_text))
    for i, t in enumerate(terms):
        if _text(t.group(1)).lower() != term.lower():
            continue
        end = terms[i + 1].start() if i + 1 < len(terms) else len(xml_text)
        segment = xml_text[t.start():end]
        first = _BLOCK.search(segment)
        lead = _text(first.group(0)) if first else term
        units[root_key] = Unit(root_key, citation_root, list_name, lead, sha256(lead.encode()), None)
        _walk_paragraphs(segment[first.end():] if first else segment, root_key, citation_root, list_name, units)
        break
    return units


def _residual_units(ccl_xml: str) -> dict[str, Unit]:
    stripped = _text(ccl_xml)
    m = re.search(r"[^.]*not elsewhere specified[^.]*EAR99[^.]*\.", stripped)
    ear99_text = m.group(0).strip() if m else None
    return {
        "EAR99": Unit(
            "EAR99", "15 CFR 774 Supp. No. 1 (EAR99 designation); 15 CFR 734.3(c)", "RESIDUAL",
            ear99_text, sha256(ear99_text.encode()) if ear99_text else None, None,
        ),
        "NOT_SUBJECT": Unit(
            "NOT_SUBJECT", "15 CFR 734.3(b)", "RESIDUAL", None, None, None,
            notes=("15 CFR 734.3(b) is not in this pack; the provision resolves but cannot be quoted.",),
        ),
    }


# --- building -------------------------------------------------------------------------------

def _pack_hash(units: dict[str, Unit], manifest: dict) -> str:
    fingerprint = {
        k: [u.sha256, u.parent, u.sme, sha256("\n".join(u.notes).encode())] for k, u in sorted(units.items())
    }
    return sha256(canonical_bytes({"units": fingerprint, "sources": manifest.get("sources", {})}))


def build_pack_from_xml(
    usml_xml: str,
    ccl_xml: str,
    *,
    manifest: dict,
    itar_sd_xml: str | None = None,
    ear_definitions_xml: str | None = None,
) -> ReferencePack:
    units = parse_usml(usml_xml)
    ccl_units, eccns = parse_ccl(ccl_xml)
    units.update(ccl_units)
    if itar_sd_xml:
        units.update(parse_section(itar_sd_xml, "22 CFR 120.41", "22 CFR 120.41", "ITAR_DEF"))
    if ear_definitions_xml:
        units.update(parse_definition(
            ear_definitions_xml, "Specially designed", "15 CFR 772.1 SD",
            '15 CFR 772.1 ("specially designed")', "EAR_DEF",
        ))
    units.update(_residual_units(ccl_xml))
    categories = tuple(r for r in ROMANS if f"USML {r}" in units)
    return ReferencePack(units, categories, eccns, manifest, _pack_hash(units, manifest))


_SOURCE_FILES = {
    "title-22-part-121.xml": ("22 CFR Part 121 (the USML)", "2026-06-25", None),
    "title-15-part-774.xml": ("15 CFR Part 774 (the CCL)", "2026-06-25", None),
    "title-22-section-120.41.xml": ("22 CFR 120.41 (ITAR 'specially designed')", "2026-09-05", "2026-09-01"),
    "title-15-section-772.1.xml": ("15 CFR 772.1 (EAR definitions, incl. 'specially designed')", "2026-09-05", "2026-09-01"),
}


def build_manifest(raw_dir: Path) -> dict:
    sources: dict[str, dict] = {}
    for name, (citation, retrieved, content_date) in _SOURCE_FILES.items():
        path = raw_dir / name
        if not path.is_file():
            continue
        data = path.read_bytes()
        sources[name] = {
            "citation": citation,
            "sha256": sha256(data),
            "bytes": len(data),
            "retrieved_at": retrieved,
            "content_date": content_date,
        }
    return {
        "schema": "forge-classification.reference-pack/1",
        "retrieved_at": "2026-06-25",
        "content_date": None,
        "content_date_note": (
            "The part-121 and part-774 XML exports carry no 'current as of' date; they were retrieved "
            "2026-06-25 (strafe-prototype corpus commit 6704c19). The two section files were pulled "
            "from the eCFR versioner at content date 2026-09-01."
        ),
        "sources": sources,
    }


def build_pack(raw_dir: Path) -> ReferencePack:
    raw_dir = Path(raw_dir)
    manifest = build_manifest(raw_dir)
    sd = raw_dir / "title-22-section-120.41.xml"
    defs = raw_dir / "title-15-section-772.1.xml"
    return build_pack_from_xml(
        (raw_dir / "title-22-part-121.xml").read_text(encoding="utf-8"),
        (raw_dir / "title-15-part-774.xml").read_text(encoding="utf-8"),
        manifest=manifest,
        itar_sd_xml=sd.read_text(encoding="utf-8") if sd.is_file() else None,
        ear_definitions_xml=defs.read_text(encoding="utf-8") if defs.is_file() else None,
    )


def build_trusted_pack(
    raw_dir: Path,
    manifest_path: Path,
    *,
    expected_pack_sha256: str,
) -> ReferencePack:
    """Build the default pack only after authenticating every committed source.

    Explicit callers that intentionally construct test or custom packs should use
    ``build_pack`` or ``build_pack_from_xml`` instead. This path is deliberately
    strict because its result is the runtime's default regulatory trust root.
    """
    raw_dir = Path(raw_dir)
    manifest_path = Path(manifest_path)
    try:
        manifest_bytes = manifest_path.read_bytes()
    except OSError as exc:
        raise ReferencePackIntegrityError(
            f"REFERENCE_PACK_MANIFEST_UNAVAILABLE: cannot read {manifest_path}: {exc}"
        ) from exc
    try:
        manifest = json.loads(manifest_bytes)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReferencePackIntegrityError(
            f"REFERENCE_PACK_MANIFEST_INVALID: {manifest_path} is not valid UTF-8 JSON: {exc}"
        ) from exc
    if not isinstance(manifest, dict) or manifest.get("schema") != "forge-classification.reference-pack/1":
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_MANIFEST_INVALID: expected schema "
            "'forge-classification.reference-pack/1'"
        )
    sources = manifest.get("sources")
    if not isinstance(sources, dict):
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_MANIFEST_INVALID: 'sources' must be an object"
        )
    expected_names = set(_SOURCE_FILES)
    actual_names = set(sources)
    if actual_names != expected_names:
        missing = sorted(expected_names - actual_names)
        unexpected = sorted(actual_names - expected_names)
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_SOURCE_SET_MISMATCH: "
            f"missing={missing}, unexpected={unexpected}"
        )
    if not re.fullmatch(r"[0-9a-f]{64}", expected_pack_sha256):
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_EXPECTATION_INVALID: expected pack SHA-256 must be 64 lowercase hex characters"
        )
    manifest_pack_sha256 = manifest.get("pack_sha256")
    if manifest_pack_sha256 is not None and manifest_pack_sha256 != expected_pack_sha256:
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_MANIFEST_HASH_MISMATCH: committed manifest pack SHA-256 "
            f"{manifest_pack_sha256!r} does not match pinned {expected_pack_sha256}"
        )

    payloads: dict[str, bytes] = {}
    for name in sorted(expected_names):
        record = sources[name]
        if not isinstance(record, dict):
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_MANIFEST_INVALID: source record {name!r} must be an object"
            )
        expected_source_sha256 = record.get("sha256")
        expected_bytes = record.get("bytes")
        if not isinstance(expected_source_sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_source_sha256):
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_MANIFEST_INVALID: source {name!r} has no valid SHA-256"
            )
        if not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool) or expected_bytes < 0:
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_MANIFEST_INVALID: source {name!r} has no valid byte count"
            )
        source_path = raw_dir / name
        try:
            payload = source_path.read_bytes()
        except OSError as exc:
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_SOURCE_UNAVAILABLE: cannot read {source_path}: {exc}"
            ) from exc
        if len(payload) != expected_bytes:
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_SOURCE_SIZE_MISMATCH: {name} expected {expected_bytes} bytes, "
                f"found {len(payload)}"
            )
        actual_source_sha256 = sha256(payload)
        if actual_source_sha256 != expected_source_sha256:
            raise ReferencePackIntegrityError(
                f"REFERENCE_PACK_SOURCE_HASH_MISMATCH: {name} expected {expected_source_sha256}, "
                f"found {actual_source_sha256}"
            )
        payloads[name] = payload

    try:
        pack = build_pack_from_xml(
            payloads["title-22-part-121.xml"].decode("utf-8"),
            payloads["title-15-part-774.xml"].decode("utf-8"),
            manifest=manifest,
            itar_sd_xml=payloads["title-22-section-120.41.xml"].decode("utf-8"),
            ear_definitions_xml=payloads["title-15-section-772.1.xml"].decode("utf-8"),
        )
    except UnicodeDecodeError as exc:
        raise ReferencePackIntegrityError(
            f"REFERENCE_PACK_SOURCE_ENCODING_INVALID: committed source is not UTF-8: {exc}"
        ) from exc
    if pack.sha256 != expected_pack_sha256:
        raise ReferencePackIntegrityError(
            "REFERENCE_PACK_HASH_MISMATCH: authenticated sources produced "
            f"{pack.sha256}, expected pinned {expected_pack_sha256}"
        )
    return pack


def diff(a: ReferencePack, b: ReferencePack) -> UnitDiff:
    changed = sorted(k for k in a.units if k in b.units and a.units[k].sha256 != b.units[k].sha256)
    return UnitDiff(changed, sorted(set(b.units) - set(a.units)), sorted(set(a.units) - set(b.units)))


def pack_summary(pack: ReferencePack) -> dict:
    return {
        "sha256": pack.sha256,
        "unit_count": len(pack.units),
        "usml_categories": len(pack.categories),
        "eccn_count": len(pack.eccns),
        "manifest": pack.manifest,
    }


def dump_manifest(pack: ReferencePack) -> str:
    return json.dumps({**pack.manifest, "pack_sha256": pack.sha256}, indent=2, ensure_ascii=False)
