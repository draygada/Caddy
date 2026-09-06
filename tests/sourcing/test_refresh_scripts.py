"""The refresh scripts' pure parsers, on canned samples shaped like the S7 verifier's live responses."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "packages" / "sourcing" / "scripts"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def test_hts_base_rate_from_records_parses_free_and_percent():
    m = _load("refresh_hts")
    records = [{"htsno": "4011.30.00", "statisticalSuffix": "", "description": "Of a kind used on aircraft", "general": "Free", "other": "30%", "special": "",
                "footnotes": [{"columns": ["other"], "marker": "1", "value": "See 9903.90.08.", "type": "endnote"}]},
               {"htsno": "8507.60.00", "statisticalSuffix": "10", "description": "Lithium-ion batteries", "general": "3.4%", "other": "35%", "special": "Free (A,AU,B,...)"}]
    assert m.base_rate_from_records(records, "4011.30") == {"htsno": "4011.30.00", "description": "Of a kind used on aircraft", "general": "Free", "general_rate": "0", "footnotes": ["See 9903.90.08."]}
    assert m.base_rate_from_records(records, "8507.60")["general_rate"] == "0.034"
    assert m.base_rate_from_records(records, "9999.99") is None
    assert m.base_rate_from_records([{"htsno": "8507.60.00", "general": "3.4¢/kg"}], "8507.60") is None      # specific duty: not a percentage, not typed


def test_cross_summarise_rulings_keeps_number_subject_and_date():
    m = _load("refresh_cross")
    payload = {"rulings": [{"id": 0, "rulingNumber": "N303574", "subject": "The tariff classification of a drone kit from China", "categories": "Classification", "rulingDate": "2019-04-29T00:00:00"}], "totalHits": 20}
    assert m.summarise_rulings(payload) == [{"ruling_number": "N303574", "subject": "The tariff classification of a drone kit from China", "ruling_date": "2019-04-29"}]
    assert m.summarise_rulings({"rulings": []}) == []


def test_gleif_rows_are_ownership_rows_with_a_url_and_no_percentage():
    m = _load("refresh_ownership")
    record = {"data": [{"type": "rr-relationship-records", "id": "X-Y",
                        "attributes": {"relationship": {"startNode": {"id": "X"}, "endNode": {"id": "Y"}, "type": "IS_ULTIMATELY_CONSOLIDATED_BY", "status": "ACTIVE"}},
                        "links": {"self": "https://api.gleif.org/api/v1/rr-relationship-records/X-Y"}}],
              "included": [{"type": "lei-records", "id": "Y", "attributes": {"entity": {"legalName": {"name": "Teledyne Technologies Incorporated"}}}}]}
    rows = m.rows_from_gleif(record, "Teledyne FLIR LLC")
    assert rows == [{"child": "Teledyne FLIR LLC", "parent": "Teledyne Technologies Incorporated", "relation": "owns_ge_50", "percent": None,
                     "evidence_url": "https://api.gleif.org/api/v1/rr-relationship-records/X-Y", "synthetic": False,
                     "note": "GLEIF relationship record; consolidation, not a shareholding percentage; typed by Charlie"}]
    assert m.rows_from_gleif({"data": []}, "Nobody Ltd") == []
    assert m.unknown_by_design("HK") and m.unknown_by_design("CN") and not m.unknown_by_design("US")
