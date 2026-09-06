"""The screening list can be the full file; the fetcher is allowlisted, cached, logged and offline-safe."""
from __future__ import annotations

from pathlib import Path

from conftest import DATA

HEADER = (DATA / "csl_subset.csv").read_text(encoding="utf-8").splitlines()[0]


def test_fixture_store_takes_a_csl_path(tmp_path: Path):
    from forge_sourcing.fixtures import FixtureStore
    from forge_sourcing.screen import screen
    rows = (DATA / "csl_subset.csv").read_text(encoding="utf-8").splitlines()
    dji = next(r for r in rows if "SZ DJI Technology" in r)
    full = tmp_path / "consolidated_2026-09-04.csv"
    full.write_text(HEADER + "\n" + dji + "\n", encoding="utf-8")
    store = FixtureStore(DATA, csl_file=full)
    m = store.manifest["csl"]
    assert m["file"] == full.name and m["row_count"] == 1 and len(m["sha256"]) == 64
    assert "consolidated.csv" in m["source"]
    run = screen("SZ DJI Technology Co., Ltd.", store.csl_index, m["sha256"], m["retrieved_at"])
    assert run["match_kind"] == "exact"


def test_service_passes_the_csl_path_through(tmp_path: Path):
    from forge_sourcing.service import Service
    full = tmp_path / "x.csv"
    full.write_text(HEADER + "\n", encoding="utf-8")
    s = Service(DATA, csl_file=full)
    assert s.store.manifest["csl"]["row_count"] == 0
