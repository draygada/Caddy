"""The screening list can be the full file; the fetcher is allowlisted, cached, logged and offline-safe."""
from __future__ import annotations

from pathlib import Path

import pytest

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


def test_allowlist_and_the_blocked_demo_hosts():
    from forge_search.fetch import host_allowed
    assert host_allowed("https://content.u-blox.com/sites/default/files/NEO-M9N-00B_DataSheet_UBX-19014285.pdf")
    assert host_allowed("https://d17t6iyxenbwp1.cloudfront.net/s3fs-public/2026-06/DS-000347%20ICM-42688-P%20v1.9.pdf")
    assert not host_allowed("https://pastebin.com/raw/abc")
    assert not host_allowed("https://www.federalregister.gov/api/v1/documents/2026-16628.json")
    assert not host_allowed("https://evil.example.com/st.com/datasheet.pdf")
    assert not host_allowed("not a url")


def _fetcher(tmp_path: Path, offline: bool = True):
    from forge_search.fetch import Fetcher
    return Fetcher(tmp_path / "fetch", tmp_path / "documents.json", DATA / "search" / "fixtures", offline=offline)


def test_fixture_documents_fetch_without_the_network(tmp_path: Path):
    f = _fetcher(tmp_path)
    r = f.fetch("fixture://lepton35_test_sheet.txt")
    assert r.status == "FIXTURE" and r.ok() and r.bytes > 0 and len(r.sha256) == 64
    assert f.read(r) == (DATA / "search" / "fixtures" / "lepton35_test_sheet.txt").read_bytes()
    assert f.log[-1]["status"] == "FIXTURE"


def test_blocked_hosts_are_logged_and_never_requested(tmp_path: Path):
    f = _fetcher(tmp_path, offline=False)                       # online, and still no request is made
    r = f.fetch("https://pastebin.com/raw/abc")
    assert r.status == "BLOCKED" and not r.ok() and f.log[-1] == {"url": "https://pastebin.com/raw/abc", "status": "BLOCKED", "sha256": None, "bytes": 0, "retrieved_at": r.retrieved_at}


def test_offline_fetcher_reports_offline_and_serves_the_cache(tmp_path: Path):
    import json
    from forge_sourcing.hashing import sha256_bytes
    f = _fetcher(tmp_path)
    url = "https://www.molicel.com/wp-content/uploads/INR21700P45B_1.4_Product-Data-Sheet-of-INR-21700-P45B-80109.pdf"
    assert f.fetch(url).status == "OFFLINE"
    data = b"%PDF-1.4 cached bytes"
    (tmp_path / "fetch").mkdir(exist_ok=True)
    (tmp_path / "fetch" / f"{sha256_bytes(data)}.bin").write_bytes(data)
    (tmp_path / "documents.json").write_text(json.dumps({url: {"sha256": sha256_bytes(data), "bytes": len(data), "retrieved_at": "2026-09-05T23:40:00Z", "status": "200"}}), encoding="utf-8")
    f = _fetcher(tmp_path)
    r = f.fetch(url)
    assert r.status == "CACHED" and r.sha256 == sha256_bytes(data) and f.read(r) == data


def test_missing_fixture_is_an_error_not_an_exception(tmp_path: Path):
    r = _fetcher(tmp_path).fetch("fixture://nope.txt")
    assert r.status == "ERROR missing fixture" and not r.ok()


def test_a_fixture_url_cannot_escape_the_fixtures_directory(tmp_path: Path):
    f = _fetcher(tmp_path)
    escape = "fixture://../../kestrel_round_input.json"
    r = f.fetch(escape)
    assert r.status == "BLOCKED" and not r.ok() and r.bytes == 0
    assert f.log[-1] == {"url": escape, "status": "BLOCKED", "sha256": None, "bytes": 0, "retrieved_at": r.retrieved_at}
    assert (DATA / "kestrel_round_input.json").is_file()             # the file it aimed at is real; not one byte of it was read
    assert f.fetch("fixture://sub/lepton35_test_sheet.txt").status == "BLOCKED"      # a name with a separator is not a fixture name
    with pytest.raises(ValueError):
        f.read(r)
