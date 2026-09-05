#!/usr/bin/env python3
"""Parse five destinations from the committed eCFR EAR Country Chart XML."""

from __future__ import annotations

import copy
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent.parent
SOURCE_RELATIVE = Path("ecfr/title-15-part-738-appendix-suppl1-2026-09-01.xml")
SOURCE = DATA_DIR / SOURCE_RELATIVE
JSON_OUT = DATA_DIR / "chart/chart.json"
VERIFY_OUT = DATA_DIR / "chart/VERIFY_country_chart.md"

EXPECTED_HEADERS = [
    "CB 1",
    "CB 2",
    "CB 3",
    "NP 1",
    "NP 2",
    "NS 1",
    "NS 2",
    "MT 1",
    "RS 1",
    "RS 2",
    "FC 1",
    "CC 1",
    "CC 2",
    "CC 3",
    "AT 1",
    "AT 2",
]

DESTINATIONS = {
    "CA": "Canada",
    "DE": "Germany",
    "TW": "Taiwan",
    "VN": "Vietnam",
    "CN": "China",
}

CANADA_EXPECTED = [
    "X",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "X",
    "",
    "",
    "",
    "",
    "",
]


class ChartParseError(RuntimeError):
    """Raised when the source does not match the required chart structure."""


def local_name(tag: str) -> str:
    """Return a tag or attribute name without an XML namespace."""
    return tag.rsplit("}", 1)[-1]


def direct_children(element: ET.Element, tag_name: str) -> list[ET.Element]:
    """Return direct children whose local tag name matches tag_name."""
    wanted = tag_name.upper()
    return [child for child in element if local_name(child.tag).upper() == wanted]


def text_verbatim(element: ET.Element) -> str:
    """Return character data exactly as represented by ElementTree."""
    return "".join(element.itertext())


def country_name_parts(cell: ET.Element) -> tuple[str, str, list[str]]:
    """Return raw text, name with SUP children removed, and SUP texts."""
    raw = text_verbatim(cell).strip()
    clean_cell = copy.deepcopy(cell)
    superscripts = direct_children(clean_cell, "SUP")
    footnotes = [text_verbatim(sup).strip() for sup in superscripts]

    for sup in superscripts:
        children = list(clean_cell)
        position = children.index(sup)
        tail = sup.tail or ""
        if position == 0:
            clean_cell.text = (clean_cell.text or "") + tail
        else:
            previous = children[position - 1]
            previous.tail = (previous.tail or "") + tail
        clean_cell.remove(sup)

    clean = text_verbatim(clean_cell).strip()
    return raw, clean, footnotes


def cell_has_span(cell: ET.Element) -> bool:
    return any(
        local_name(attribute).lower() in {"colspan", "rowspan"}
        for attribute in cell.attrib
    )


def parse_chart() -> tuple[list[str], dict[str, dict[str, object]]]:
    if not SOURCE.is_file():
        raise ChartParseError(f"source XML not found: {SOURCE}")

    try:
        root = ET.parse(SOURCE).getroot()
    except ET.ParseError as exc:
        raise ChartParseError(f"invalid XML in {SOURCE}: {exc}") from exc

    rows = [node for node in root.iter() if local_name(node.tag).upper() == "TR"]
    if len(rows) < 2:
        raise ChartParseError(f"expected at least two TR elements; found {len(rows)}")

    header_cells = [
        child
        for child in rows[1]
        if local_name(child.tag).upper() in {"TH", "TD"}
    ]
    headers = [text_verbatim(cell).strip() for cell in header_cells]
    if headers != EXPECTED_HEADERS:
        raise ChartParseError(
            "header mismatch:\n"
            f"  expected: {EXPECTED_HEADERS!r}\n"
            f"  parsed:   {headers!r}"
        )

    wanted_names = set(DESTINATIONS.values())
    matches: dict[str, tuple[list[ET.Element], str, str, str | None]] = {}

    for row_number, row in enumerate(rows[2:], start=3):
        tds = direct_children(row, "TD")
        if not tds:
            continue

        raw_name, clean_name, footnotes = country_name_parts(tds[0])
        if clean_name not in wanted_names:
            continue
        if len(footnotes) > 1:
            raise ChartParseError(
                f"ambiguous country footnote in {raw_name!r}: "
                f"found {len(footnotes)} SUP elements"
            )
        if footnotes and not footnotes[0]:
            raise ChartParseError(f"empty SUP footnote in country cell {raw_name!r}")
        footnote = footnotes[0] if footnotes else None
        if clean_name in matches:
            raise ChartParseError(
                f"duplicate country row for {clean_name!r} at XML TR {row_number}"
            )
        if len(tds) != 17:
            raise ChartParseError(
                f"country row {clean_name!r} at XML TR {row_number} has "
                f"{len(tds)} TD children; expected 17"
            )
        spanned = [index for index, cell in enumerate(tds) if cell_has_span(cell)]
        if spanned:
            raise ChartParseError(
                f"country row {clean_name!r} at XML TR {row_number} has "
                f"colspan/rowspan on TD indices {spanned}; spans are forbidden"
            )
        matches[clean_name] = (tds, raw_name, clean_name, footnote)

    missing = wanted_names - matches.keys()
    if missing:
        raise ChartParseError(f"missing requested country row(s): {sorted(missing)!r}")

    records: dict[str, dict[str, object]] = {}
    for code, expected_name in DESTINATIONS.items():
        tds, raw_name, clean_name, footnote = matches[expected_name]
        cells = [text_verbatim(cell) for cell in tds[1:]]
        if len(cells) != 16:
            raise ChartParseError(
                f"country row {expected_name!r} produced {len(cells)} control cells; expected 16"
            )
        records[code] = {
            "country_name_raw": raw_name,
            "country_name_clean": clean_name,
            "footnote": footnote,
            "cells": cells,
            "columns": dict(zip(headers, cells)),
        }

    if records["CA"]["cells"] != CANADA_EXPECTED:
        raise ChartParseError(
            "Canada spot check failed:\n"
            f"  expected: {CANADA_EXPECTED!r}\n"
            f"  parsed:   {records['CA']['cells']!r}"
        )

    return headers, records


def markdown_cell(value: str) -> str:
    """Escape Markdown table delimiters without changing the source value in JSON."""
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def build_verify(
    headers: list[str], records: dict[str, dict[str, object]], ecfr_date: str
) -> str:
    lines = [
        "# EAR Country Chart verification",
        "",
        f"Source: `{SOURCE_RELATIVE.as_posix()}`  ",
        f"eCFR content date: `{ecfr_date}`",
        "",
        "Parsed column headers: " + ", ".join(f"`{header}`" for header in headers),
        "",
    ]

    for code, expected_name in DESTINATIONS.items():
        record = records[code]
        raw_name = record["country_name_raw"]
        footnote = record["footnote"]
        lines.extend(
            [
                f"## {code} — {expected_name}",
                "",
                f"Raw country text: `{raw_name}`  ",
                f"Footnote: `{footnote}`" if footnote is not None else "Footnote: —",
                "",
                "| Column header | Cell value | Applies |",
                "|---|---|---|",
            ]
        )
        columns = record["columns"]
        assert isinstance(columns, dict)
        for header in headers:
            value = columns[header]
            assert isinstance(value, str)
            applies = "applies" if value else "—"
            lines.append(f"| {header} | {markdown_cell(value)} | {applies} |")
        lines.append("")

    lines.extend(["## UNRESOLVED", "", "None.", ""])
    return "\n".join(lines)


def main() -> int:
    try:
        headers, records = parse_chart()
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", SOURCE.name)
        if date_match is None:
            raise ChartParseError(f"could not derive eCFR date from {SOURCE.name!r}")

        ecfr_date = date_match.group(1)
        output: dict[str, object] = {
            "source_file": SOURCE_RELATIVE.as_posix(),
            "ecfr_date": ecfr_date,
            "column_headers": headers,
        }
        output.update(records)

        JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
        JSON_OUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
        VERIFY_OUT.write_text(build_verify(headers, records, ecfr_date))
    except (ChartParseError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"wrote {JSON_OUT.relative_to(DATA_DIR)}")
    print(f"wrote {VERIFY_OUT.relative_to(DATA_DIR)}")
    print("headers: " + ", ".join(headers))
    for code, name in DESTINATIONS.items():
        columns = records[code]["columns"]
        assert isinstance(columns, dict)
        marked = [header for header in headers if columns[header] == "X"]
        print(f"{code} {name}: {', '.join(marked) if marked else '(none)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
