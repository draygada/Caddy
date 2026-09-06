"""Download the full Consolidated Screening List (public .gov data; Charlie's standing pull grant) into .cache/csl.

Never on the request path. Prints the sha256, the row count and the export line for the API and the demo.
OFAC FAQ 287: code reads the bulk files, never the interactive search tool.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv"
PKG = Path(__file__).resolve().parents[1]
OUT = PKG / ".cache" / "csl"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    req = urllib.request.Request(URL, headers={"User-Agent": "StrafeForgeSourcing/0.1 (allowlisted fetcher)"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        status = resp.status
    digest = hashlib.sha256(data).hexdigest()
    path = OUT / f"consolidated_{today}.csv"
    path.write_bytes(data)
    rows = sum(1 for _ in csv.DictReader(data.decode("utf-8").splitlines()))
    manifest = OUT / "manifest.json"
    entries = json.loads(manifest.read_text(encoding="utf-8")) if manifest.is_file() else []
    entries.append({"url": URL, "status": status, "bytes": len(data), "sha256": digest, "rows": rows, "file": path.name,
                    "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")})
    manifest.write_text(json.dumps(entries, indent=1) + "\n", encoding="utf-8")
    print(f"GET {URL} {status} {len(data)} bytes sha256 {digest} rows {rows}")
    print(f"export FORGE_CSL_PATH={path}")
    sys.exit(0)
