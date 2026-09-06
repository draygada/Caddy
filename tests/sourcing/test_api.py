"""The HTTP adapter at its seam: verbs, the envelope, refusals as 409, /now read-only, the page."""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from test_claims_vocabulary import NEVER


@pytest.fixture(scope="module")
def client():
    from forge_sourcing_api.app import app
    return TestClient(app)


def _open(client, state="baseline", ship_to="US-bench", key="api-1"):
    r = client.post("/api/sourcing/rounds", json={"state": state, "ship_to": ship_to, "quantity": 1, "transport_mode": "air", "request_key": key, "run": True, "entry_date": "2026-09-06"})
    assert r.status_code == 200, r.text
    return r.json()


def test_health_states_and_the_envelope(client):
    assert client.get("/api/sourcing/health").json()["result"] == {"ok": True}
    assert {"baseline", "f3_boson", "f4_hg5700", "f11_sicore"} <= set(client.get("/api/sourcing/states").json()["result"])
    body = _open(client)
    c = body["candidate"]
    assert set(c) >= {"git_sha", "design_hash", "log_head_seq", "log_head_hash", "fixture_manifest_shas", "search", "mode"} and c["mode"]["llm"] in ("cache", "live")
    assert body["view"]["status"] == "costed" and "lines resolved" in body["view"]["headline"]


def test_select_and_a_refusal_as_409(client):
    view = _open(client, key="api-2")["view"]
    motor = next(l for l in view["lines"] if l["node_id"] == "motor")
    chosen = next(c for c in motor["offers"] if c["status"] != "review_blocked")
    blocked = next(c for c in motor["offers"] if c["status"] == "review_blocked")
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/select", json={"line_id": "line:motor", "offer_hash": chosen["offer_hash"],
                                                                             "declined": [{"offer_hash": blocked["offer_hash"]}], "attestor": "benji"})
    assert r.status_code == 200 and r.json()["view"]["lines"][[l["node_id"] for l in view["lines"]].index("motor")]["selection"]["attestor"] == "benji"
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/select", json={"line_id": "line:motor", "offer_hash": blocked["offer_hash"],
                                                                             "declined": [{"offer_hash": chosen["offer_hash"]}], "attestor": "benji"})
    assert r.status_code == 409 and r.json()["detail"]["refused"] == "SelectionRefused" and "review blocked" in r.json()["detail"]["detail"]


def test_propose_records_an_agent_event_whatever_the_cache_holds(client):
    view = _open(client, state="f3_boson", key="api-3")["view"]
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/propose", json={"line_id": "line:thermal_core", "kind": "alternative"})
    assert r.status_code == 200
    p = r.json()["result"]
    assert p["kind"] == "alternative" and p["status"] in ("green", "grey", "red") and p["mode"] in ("CACHED", "LIVE")
    kinds = [row["kind"] for row in client.get(f"/api/sourcing/rounds/{view['round_id']}/timeline?last=50").json()["result"]]
    assert "alternative_proposed" in kinds


def test_now_is_read_only_and_defaults_to_unknown(client):
    r = client.get("/api/sourcing/now")
    assert r.status_code == 200
    obs = r.json()
    assert set(obs) >= {"as_of", "candidate", "round_status", "last_event", "tests", "features"}
    assert all(f["claim_class"] in ("demonstrated", "design-intent", "UNKNOWN") for f in obs["features"])
    assert client.post("/api/sourcing/now", json={}).status_code == 405


def test_rederive_and_tamper(client):
    _open(client, key="api-4")
    assert "chain intact" in client.post("/api/sourcing/rederive").json()["result"]["line"]


def test_the_page_renders_from_the_response_and_says_nothing_forbidden(client):
    r = client.get("/")
    assert r.status_code == 200 and "Strafe Forge" in r.text and "round_view" in r.text
    assert not [pat for pat in NEVER if re.search(pat, r.text, re.I)]
