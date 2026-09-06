"""Read the base rate for each heading in data/tariff.json from the USITC HTS REST API (confirmed live 2026-09-05, S7).

Never on the request path. Prints heading · expected · live · verdict. With --write, sets general_rate,
verified=true, verified_at and source on the matching base rows; Charlie reviews the git diff. The API publishes no
terms and no rate limit (S7): this script pauses one second between calls and stops on the first non-200.
The ten-digit line is a licensed broker's; the heading is all this lane prints (H350722).
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
TARIFF = PKG / "data" / "tariff.json"
URL = "https://hts.usitc.gov/reststop/search?keyword={}"
PCT = re.compile(r"^(\d+(?:\.\d+)?)%$")


def base_rate_from_records(records: list[dict], heading: str) -> dict | None:
    for r in records:
        if not str(r.get("htsno", "")).startswith(heading):
            continue
        general = (r.get("general") or "").strip()
        if general.lower() == "free":
            rate = "0"
        elif PCT.match(general):
            rate = str(Decimal(PCT.match(general).group(1)) / 100)
        else:
            continue
        return {"htsno": r["htsno"], "description": r.get("description"), "general": general, "general_rate": rate,
                "footnotes": [f.get("value") for f in (r.get("footnotes") or []) if f.get("value")]}
    return None


def fetch_records(heading: str) -> list[dict]:
    req = urllib.request.Request(URL.format(urllib.parse.quote(heading)), headers={"User-Agent": "StrafeForgeSourcing/0.1 (allowlisted fetcher)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            raise SystemExit(f"{heading}: HTTP {resp.status}; stopping")
        return json.loads(resp.read().decode("utf-8"))


if __name__ == "__main__":
    write = "--write" in sys.argv
    doc = json.loads(TARIFF.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    changed = 0
    for row in doc["base_rows"]:
        live = base_rate_from_records(fetch_records(row["heading"]), row["heading"])
        if live is None:
            print(f"{row['heading']:9s} expected {row['general_rate']:>7s}  live —        no percentage general rate found; leave unverified")
        else:
            same = Decimal(live["general_rate"]) == Decimal(row["general_rate"])
            print(f"{row['heading']:9s} expected {row['general_rate']:>7s}  live {live['general_rate']:>7s}  {'same' if same else 'DIFFERS'}  {live['htsno']} {live['description']!r}")
            if write:
                row.update(general_rate=live["general_rate"], verified=True, verified_at=now, source=f"USITC HTS REST search, {live['htsno']}, read {now}",
                           note=(row.get("note") or "").replace("read live before the demo", "read live") + ("; footnotes: " + "; ".join(live["footnotes"]) if live["footnotes"] else ""))
                changed += 1
        time.sleep(1.0)
    if write:
        TARIFF.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {changed} base rows to {TARIFF.name}; rerun scripts/build_manifest.py and review the diff")
