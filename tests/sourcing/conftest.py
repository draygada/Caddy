from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "packages" / "sourcing"
sys.path.insert(0, str(PKG))

DATA = PKG / "data"


@pytest.fixture
def data_dir() -> Path:
    return DATA


@pytest.fixture
def kestrel() -> dict:
    return json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))


@pytest.fixture
def baseline(kestrel) -> dict:
    return kestrel["states"]["baseline"]


@pytest.fixture
def f4_state(kestrel) -> dict:
    base = kestrel["states"]["baseline"]
    f4 = kestrel["states"]["f4_hg5700"]
    nodes = [f4["replace_nodes"].get(n["node_id"], n) for n in base["nodes"]]
    return {"design_hash": f4["design_hash"], "design_seq": f4["design_seq"], "product": f4["product"], "nodes": nodes}


@pytest.fixture
def service(data_dir):
    from forge_sourcing.service import Service

    return Service(data_dir)


def run_s1(service, baseline, *, quantity=1, transport_mode="air", request_key="demo-1"):
    """S1: source the baseline to the US bench. Returns the round id."""
    r = service.open_round(baseline, ship_to="US-bench", quantity=quantity, transport_mode=transport_mode,
                           request_key=request_key, opened_at="2026-09-06T01:00:00Z")
    rid = r["round_id"]
    service.resolve(rid)
    service.screen(rid)
    service.cost(rid, entry_date="2026-09-06")
    return rid
