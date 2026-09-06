"""Print candidate ownership rows for every seller and manufacturer from live public sources (S7): GLEIF (CC0;
LEI holders only). Companies House and SEC EDGAR are printed as manual pointers. Hong Kong and mainland-Chinese
parties print "ownership unknown by design". Never writes ownership.json: an ownership row is typed and attested
by Charlie with its evidence URL. Never on the request path."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
GLEIF = "https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]={}&page[size]=1"
RELS = "https://api.gleif.org/api/v1/lei-records/{}/direct-parent-relationship"
NOTE = "GLEIF relationship record; consolidation, not a shareholding percentage; typed by Charlie"
CONSOLIDATION = ("IS_ULTIMATELY_CONSOLIDATED_BY", "IS_DIRECTLY_CONSOLIDATED_BY")


def unknown_by_design(country: str | None) -> bool:
    return (country or "").upper() in ("HK", "CN")


def rows_from_gleif(record: dict, child_name: str) -> list[dict]:
    names = {inc["id"]: (((inc.get("attributes") or {}).get("entity") or {}).get("legalName") or {}).get("name") for inc in record.get("included") or []}
    rows = []
    for rel in record.get("data") or []:
        r = (rel.get("attributes") or {}).get("relationship") or {}
        if r.get("type") not in CONSOLIDATION:
            continue
        parent = names.get((r.get("endNode") or {}).get("id"))
        if parent:
            rows.append({"child": child_name, "parent": parent, "relation": "owns_ge_50", "percent": None,
                         "evidence_url": (rel.get("links") or {}).get("self"), "synthetic": False, "note": NOTE})
    return rows


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "StrafeForgeSourcing/0.1 (allowlisted fetcher)", "Accept": "application/vnd.api+json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


if __name__ == "__main__":
    offers = json.loads((PKG / "data" / "offers.json").read_text(encoding="utf-8"))["offers"]
    pool = json.loads((PKG / "data" / "search" / "pool.json").read_text(encoding="utf-8"))
    parties: dict[str, str | None] = {}
    for o in offers + [c["offer"] for s in pool["slots"].values() for c in s["candidates"]]:
        parties.setdefault(o["seller"]["name"], o["seller"].get("country"))
        parties.setdefault(o["manufacturer"]["name"], o["manufacturer"].get("country_of_origin"))
    for name, country in sorted(parties.items()):
        if unknown_by_design(country):
            print(f"{name}: ownership unknown by design ({country}: Hong Kong SCR not public; China SAMR has no API) — Sayari-class provider needed")
            continue
        found = _get(GLEIF.format(urllib.parse.quote(name)))
        if not found.get("data"):
            print(f"{name}: no LEI record; Companies House (UK) / SEC EDGAR Exhibit 21 (US) are manual pointers")
            continue
        lei = found["data"][0]["id"]
        rel = _get(RELS.format(lei))
        rows = rows_from_gleif(rel, name)
        print(f"{name}: LEI {lei}; {len(rows)} consolidation row(s):")
        for row in rows:
            print("  " + json.dumps(row, ensure_ascii=False))
        time.sleep(1.0)
