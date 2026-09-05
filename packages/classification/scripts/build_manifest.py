#!/usr/bin/env python3
"""Write data/ecfr/manifest.json from the committed raw XML: source hashes, retrieval dates, pack hash."""
from __future__ import annotations

import sys
from pathlib import Path

LANE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LANE))

from forge_classification.pack import build_pack, dump_manifest, pack_summary  # noqa: E402

if __name__ == "__main__":
    pack = build_pack(LANE / "data/ecfr/raw")
    (LANE / "data/ecfr/manifest.json").write_text(dump_manifest(pack) + "\n", encoding="utf-8")
    summary = pack_summary(pack)
    print(f"pack sha256={summary['sha256']} units={summary['unit_count']} usml_categories={summary['usml_categories']} eccns={summary['eccn_count']}")
