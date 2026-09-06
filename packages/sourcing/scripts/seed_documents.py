"""Fetch every http(s) document named in data/search/pool.json into .cache/fetch under the allowlist, record the
text sha and extractor in data/search/documents.json, and print one line per request. Bytes are never committed.
Known from S3: st.com resets non-browser connections; digikey.com and mouser.com return bot challenges. Those print
ERROR/BLOCKED and the candidate stays grey — that is the honest state, not a bug.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_search.documents import EXTRACTOR, document_text, text_sha256  # noqa: E402
from forge_search.fetch import Fetcher  # noqa: E402

DATA = PKG / "data"

if __name__ == "__main__":
    pool = json.loads((DATA / "search" / "pool.json").read_text(encoding="utf-8"))
    fetcher = Fetcher(PKG / ".cache" / "fetch", DATA / "search" / "documents.json", DATA / "search" / "fixtures", offline=False)
    for slot in pool["slots"].values():
        for cand in slot["candidates"]:
            for doc in cand["documents"]:
                url = doc["url"]
                if url.startswith("fixture://"):
                    continue
                r = fetcher.fetch(url, refresh="--refresh" in sys.argv)
                line = f"GET {url} {r.status} {r.bytes} bytes"
                if r.ok():
                    text = document_text(fetcher.read(r), url)
                    fetcher.manifest[url].update({"text_sha256": text_sha256(text), "extractor": EXTRACTOR, "chars": len(text)})
                    line += f" sha256 {r.sha256[:12]} text {len(text)} chars"
                print(line)
    fetcher.manifest_path.write_text(json.dumps(fetcher.manifest, indent=1, sort_keys=True) + "\n", encoding="utf-8")
