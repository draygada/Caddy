"""Write data/manifest.json: source, retrieval date, revision, sha256 and row count per fixture."""
from __future__ import annotations

import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_sourcing.fixtures import FixtureStore  # noqa: E402

if __name__ == "__main__":
    store = FixtureStore(PKG / "data")
    out = PKG / "data" / "manifest.json"
    out.write_text(json.dumps(store.manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(PKG)}")
    for name, m in store.manifest.items():
        print(f"  {name:10s} {m['sha256'][:12]}  rows={m['row_count']}  retrieved={m['retrieved_at']}")
