"""Print the top CBP CROSS rulings for each Kestrel line's description (rulings.cbp.gov/api/search; confirmed live
2026-09-05, S7; no published terms). Writes nothing: a ruling is a broker's reading and the pre-entry line only
points at it. Never on the request path."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
URL = "https://rulings.cbp.gov/api/search?term={}&pageSize=5"


def summarise_rulings(payload: dict) -> list[dict]:
    return [{"ruling_number": r.get("rulingNumber"), "subject": r.get("subject"), "ruling_date": (r.get("rulingDate") or "")[:10]} for r in payload.get("rulings") or []]


if __name__ == "__main__":
    kestrel = json.loads((PKG / "data" / "kestrel_round_input.json").read_text(encoding="utf-8"))
    for node in kestrel["states"]["baseline"]["nodes"]:
        term = node["description"].split(",")[0]
        req = urllib.request.Request(URL.format(urllib.parse.quote(term)), headers={"User-Agent": "StrafeForgeSourcing/0.1 (allowlisted fetcher)"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        print(f"{node['node_id']:20s} {term!r}: {payload.get('totalHits')} hits")
        for r in summarise_rulings(payload):
            print(f"    {r['ruling_number']}  {r['ruling_date']}  {r['subject']}")
        time.sleep(1.0)
