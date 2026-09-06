from __future__ import annotations

import contextlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

os.environ["TRIPWIRE_LLM"] = "cache"                   # the suite never builds a live model, whatever the shell says; before any app import

REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "packages" / "sourcing"
sys.path.insert(0, str(PKG))

DATA = PKG / "data"

_RESULTS: dict[str, list[str]] = {"passed": [], "skipped": [], "failed": []}


def pytest_runtest_logreport(report):
    if report.when == "call" or (report.when == "setup" and report.skipped):
        key = "passed" if report.passed else "skipped" if report.skipped else "failed"
        _RESULTS[key].append(report.nodeid)


def pytest_sessionfinish(session, exitstatus):
    out = PKG / ".cache" / "last_pytest.json"
    with contextlib.suppress(OSError):                 # /now observes this file; failing to write it must never fail the suite
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"as_of": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                                   "counts": {k: len(v) for k, v in _RESULTS.items()}, "passed": sorted(_RESULTS["passed"]), "skipped": sorted(_RESULTS["skipped"])}, indent=1), encoding="utf-8")


@pytest.fixture
def data_dir() -> Path:
    return DATA


@pytest.fixture
def kestrel() -> dict:
    return json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))


def _state(kestrel: dict, name: str) -> dict:
    from forge_sourcing.fixtures import design_state
    return design_state(kestrel["states"], name)              # a copy: a round never aliases the fixture's nodes


@pytest.fixture
def baseline(kestrel) -> dict:
    return _state(kestrel, "baseline")


@pytest.fixture
def f4_state(kestrel) -> dict:
    return _state(kestrel, "f4_hg5700")


@pytest.fixture
def f3_state(kestrel) -> dict:
    return _state(kestrel, "f3_boson")


@pytest.fixture
def f11_state(kestrel) -> dict:
    return _state(kestrel, "f11_sicore")


@pytest.fixture
def service(data_dir):
    from forge_sourcing.service import Service

    return Service(data_dir)


def make_ports(model, *, offline=True):
    """Ports over the committed fixtures with the given model; fetcher cache in a throwaway directory."""
    import tempfile
    from forge_search.propose import Ports
    from forge_search.fetch import Fetcher
    from forge_search.rules import load_rules
    from forge_sourcing.hashing import sha256_bytes
    tmp = Path(tempfile.mkdtemp(prefix="forge-search-"))
    pool_raw = (DATA / "search" / "pool.json").read_bytes()
    return Ports(fetcher=Fetcher(tmp / "fetch", tmp / "documents.json", DATA / "search" / "fixtures", offline=offline), model=model,
                 rules=load_rules(DATA / "search" / "rules.DRAFT.json"), pool=json.loads(pool_raw.decode("utf-8")),
                 pool_sha256=sha256_bytes(pool_raw), documents_sha256=None)


def run_s1(service, baseline, *, quantity=1, transport_mode="air", request_key="demo-1"):
    """S1: source the baseline to the US bench. Returns the round id."""
    r = service.open_round(baseline, ship_to="US-bench", quantity=quantity, transport_mode=transport_mode,
                           request_key=request_key, opened_at="2026-09-06T01:00:00Z")
    rid = r["round_id"]
    service.resolve(rid)
    service.screen(rid)
    service.cost(rid, entry_date="2026-09-06")
    return rid
