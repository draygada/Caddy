"""Prompt templates. Deterministic text: the cache key is sha256(kind + prompt), so a wording change is a PROMPT_VERSION bump."""
from __future__ import annotations

import json

from .documents import numbered

PROMPT_VERSION = "search-lane/2026-09-05.1"


def extract_prompt(text: str, doc_sha256: str, part_class: str, field_units: dict[str, str], rule_sentences: dict[str, str]) -> str:
    fields = "\n".join(f"- {name} (unit: {unit}): {rule_sentences.get(name, '')}".rstrip() for name, unit in sorted(field_units.items()))
    return (
        f"{PROMPT_VERSION} · CALL A · datasheet extraction\n"
        f"Document sha256: {doc_sha256}\n"
        f"Part class: {part_class}\n"
        "Report ONLY these fields, each with the unit named here:\n"
        f"{fields}\n"
        "Rules:\n"
        "1. Output JSON of the form {\"specs\": [{\"field\", \"value\", \"unit\", \"quote\", \"start\", \"end\", \"doc_sha256\"}]} and nothing else. "
        "There is no place for a jurisdiction, an ECCN, an origin or an owner; do not report them anywhere.\n"
        "2. quote = the shortest substring of ONE line of the DOCUMENT that contains the number and its unit, copied exactly. "
        "Never quote a whole row: a quote in which a second figure carries the same unit states two answers and is discarded.\n"
        "3. Every DOCUMENT line is printed as [start:end] text. start = that line's start + the quote's index within the line; end = start + the quote's length.\n"
        "4. value = the number as a decimal string. unit = the unit named above for the field.\n"
        "5. If a field is not stated in the DOCUMENT, do not report it. Never infer, never convert, never guess.\n"
        "DOCUMENT\n"
        f"{numbered(text)}\n"
    )


def search_prompt(line: dict, tripped_rows: list[dict], release_texts: list[str], comparator: dict, candidates: list[dict]) -> str:
    rows = "\n".join(f"- {r['entry']}: {r.get('text') or ''}".rstrip() for r in tripped_rows) or "- (none)"
    releases = "\n".join(f"- {t}" for t in release_texts) or "- (none)"
    pool = "\n".join(
        f"- mpn {c['mpn']} · {c['manufacturer']} · {'approved-manufacturer match' if c['aml'] else 'opportunistic find'}"
        f"{' · SYNTHETIC' if c['synthetic'] else ''} · declared {json.dumps(c['declared'], sort_keys=True)} · documents {[d['url'] for d in c['documents']]}"
        for c in candidates
    ) or "- (none)"
    return (
        f"{PROMPT_VERSION} · CALL B · alternative search\n"
        f"Slot: {line['slot']} · current part {line['mpn']} ({line.get('manufacturer')}) · part class {line.get('part_class')}\n"
        "Rows that fired on the current part:\n"
        f"{rows}\n"
        "Nearest release text:\n"
        f"{releases}\n"
        f"Fit comparator (function, performance, form, fit): {json.dumps(comparator, sort_keys=True)}\n"
        "Candidate pool (choose ONLY from these; url must be one of the candidate's listed documents):\n"
        f"{pool}\n"
        "Return JSON {\"candidates\": [{\"mpn\", \"url\"}]} with at most 5 entries, best first. "
        "You are proposing documents to read, not deciding anything: every number will be re-read from the document, "
        "and the rule rows, the ownership walk, the screening list and the cost function decide on a copy.\n"
    )


def escalation_prompt(line: dict, reason: str, candidates: list[dict]) -> str:
    docs = "\n".join(f"- mpn {c['mpn']} · documents {[d['url'] for d in c['documents']]}" for c in candidates) or "- (none)"
    return (
        f"{PROMPT_VERSION} · ESCALATION · {reason}\n"
        f"Line {line['line_id']} · part {line['mpn']} ({line.get('manufacturer')}) · declared origin {line.get('origin')} · note: {line.get('origin_note') or ''}\n"
        "Propose up to 5 documents (from the listed ones only) that would state the fact the escalation needs, best first.\n"
        f"{docs}\n"
        "Return JSON {\"candidates\": [{\"mpn\", \"url\"}]}. You propose sources; a human resolves the escalation.\n"
    )
