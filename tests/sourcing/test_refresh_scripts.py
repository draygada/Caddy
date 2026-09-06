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
