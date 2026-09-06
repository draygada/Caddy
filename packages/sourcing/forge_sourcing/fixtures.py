"""Dated fixtures with manifests. Every fixture prints its retrieval date and content hash."""
from __future__ import annotations

import csv
import json
from pathlib import Path

from .hashing import sha256, sha256_bytes
from .screen import normalize

FILES = {
    "offers": "offers.json",
    "ownership": "ownership.json",
    "tariff": "tariff.json",
    "csl": "csl_subset.csv",
}


class FixtureStore:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.manifest: dict[str, dict] = {}
        self.offers = self._load_json("offers")
        self.ownership = self._load_json("ownership")
        self.tariff = self._load_json("tariff")
        self.csl_rows, self.csl_index = self._load_csl()
        self.offers_by_hash: dict[str, dict] = {}
        for offer in self.offers["offers"]:
            self.offers_by_hash[sha256(offer)] = offer
        self.ownership_by_child: dict[str, list[dict]] = {}
        for row in self.ownership["rows"]:
            self.ownership_by_child.setdefault(normalize(row["child"]), []).append(row)

    # ------------------------------------------------------------ loading
    def _load_json(self, name: str) -> dict:
        path = self.data_dir / FILES[name]
        raw = path.read_bytes()
        doc = json.loads(raw.decode("utf-8"))
        rows = doc.get("offers") or doc.get("rows") or doc.get("base_rows") or []
        self.manifest[name] = {
            "file": FILES[name],
            "source": doc.get("source"),
            "retrieved_at": doc.get("retrieved_at"),
            "revision": doc.get("revision"),
            "sha256": sha256_bytes(raw),
            "row_count": len(rows),
        }
        return doc

    def _load_csl(self):
        path = self.data_dir / FILES["csl"]
        raw = path.read_bytes()
        rows = list(csv.DictReader(raw.decode("utf-8").splitlines()))
        index: dict[str, list[tuple[dict, str]]] = {}
        exact: dict[str, list[dict]] = {}
        for row in rows:
            exact.setdefault(row["name"], []).append(row)
            index.setdefault(normalize(row["name"]), []).append((row, "name"))
            for alt in (row.get("alt_names") or "").split(";"):
                alt = alt.strip()
                if alt:
                    index.setdefault(normalize(alt), []).append((row, "alt_name"))
        self.manifest["csl"] = {
            "file": FILES["csl"],
            "source": "Consolidated Screening List, data.trade.gov consolidated.csv; committed subset of the 2026-09-04 snapshot (full file sha256 44f89e8fe741992455c03cf6516a70f20984a38bafe5b91327dad31599bfafec, 26,082 data rows); rows copied verbatim",
            "retrieved_at": "2026-09-04T00:00:00Z",
            "revision": "subset-2026-09-05",
            "sha256": sha256_bytes(raw),
            "row_count": len(rows),
        }
        return rows, {"exact": exact, "normalized": index}

    # ------------------------------------------------------------ access
    def shas(self) -> dict[str, str]:
        return {name: m["sha256"] for name, m in self.manifest.items()}

    def offers_for(self, mpn: str) -> list[tuple[str, dict]]:
        return [(h, o) for h, o in self.offers_by_hash.items() if o["mpn"] == mpn]

    def offer(self, offer_hash: str) -> dict | None:
        return self.offers_by_hash.get(offer_hash)

    def ownership_rows(self, name: str) -> list[dict]:
        return self.ownership_by_child.get(normalize(name), [])
