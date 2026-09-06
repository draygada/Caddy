"""Write data/manifest.json: source, retrieval date, revision, sha256 and row count per fixture, plus the search files.

Also rewrites data/search/documents.json entries for the fixture:// documents (sha of the bytes and of the extracted text).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_sourcing.fixtures import FixtureStore  # noqa: E402
from forge_sourcing.hashing import sha256_bytes  # noqa: E402

DATA = PKG / "data"
SEARCH = DATA / "search"

if __name__ == "__main__":
    store = FixtureStore(DATA)
    manifest = dict(store.manifest)
    docs_path = SEARCH / "documents.json"
    docs = json.loads(docs_path.read_text(encoding="utf-8")) if docs_path.is_file() else {}
    try:
        from forge_search.documents import EXTRACTOR, document_text, text_sha256
        for f in sorted((SEARCH / "fixtures").iterdir()):
            raw = f.read_bytes()
            docs[f"fixture://{f.name}"] = {"sha256": sha256_bytes(raw), "bytes": len(raw), "retrieved_at": "2026-09-05T23:30:00Z", "status": "FIXTURE",
                                          "text_sha256": text_sha256(document_text(raw, f.name)), "extractor": EXTRACTOR}
        docs_path.write_text(json.dumps(docs, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    except ImportError:
        print("forge_search.documents not available yet; documents.json left as is")
    search = {}
    for f in sorted(SEARCH.rglob("*")):
        if f.is_file():
            rel = f.relative_to(DATA).as_posix()
            search[rel] = {"sha256": sha256_bytes(f.read_bytes()), "bytes": f.stat().st_size}
    manifest["search"] = search
    out = DATA / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(PKG)}")
    for name, m in store.manifest.items():
        print(f"  {name:10s} {m['sha256'][:12]}  rows={m['row_count']}  retrieved={m['retrieved_at']}")
    for rel, m in search.items():
        print(f"  {rel:48s} {m['sha256'][:12]}  bytes={m['bytes']}")
