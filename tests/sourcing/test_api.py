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


def _head(client):
    c = client.get("/api/sourcing/health").json()["candidate"]
    return c["log_head_seq"], c["log_head_hash"]


def test_now_is_read_only_and_defaults_to_unknown(client):
    before = _head(client)
    r = client.get("/api/sourcing/now")
    assert r.status_code == 200
    obs = r.json()
    assert set(obs) >= {"as_of", "candidate", "round_status", "last_event", "tests", "features"}
    assert all(f["claim_class"] in ("demonstrated", "design-intent", "UNKNOWN") for f in obs["features"])
    assert _head(client) == before                     # the observation appended nothing: same seq, same hash
    assert client.post("/api/sourcing/now", json={}).status_code == 405


def test_rederive_and_tamper(client):
    view = _open(client, key="api-4")["view"]
    assert "chain intact" in client.post("/api/sourcing/rederive").json()["result"]["line"]
    motor = next(l for l in view["lines"] if l["node_id"] == "motor")
    chosen = next(c for c in motor["offers"] if c["status"] != "review_blocked")
    blocked = next(c for c in motor["offers"] if c["status"] == "review_blocked")
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/select", json={"line_id": "line:motor", "offer_hash": chosen["offer_hash"],
                                                                            "declined": [{"offer_hash": blocked["offer_hash"]}], "attestor": "benji"})
    assert r.status_code == 200, r.text
    was = next(l for l in r.json()["view"]["lines"] if l["node_id"] == "motor")["selection"]["declined"][0]["reason_code"]
    sel = next(row for row in reversed(client.get(f"/api/sourcing/rounds/{view['round_id']}/timeline?last=50").json()["result"])
               if row["kind"] == "offer_selected")
    t = client.post("/api/sourcing/tamper", json={"seq": sel["seq"], "field": "declined.0.reason_code", "value": "price"})
    assert t.status_code == 200 and t.json()["result"]["tampered"] == {"seq": sel["seq"], "field": "declined.0.reason_code"}
    rep = client.post("/api/sourcing/rederive").json()["result"]
    assert rep["chain_intact"] is False and rep["break_at"] == sel["seq"] and "chain intact" not in rep["line"]
    assert rep["line"].startswith(f"BREAK at #{sel['seq']} (offer_selected)")
    client.post("/api/sourcing/tamper", json={"seq": sel["seq"], "field": "declined.0.reason_code", "value": was})
    assert "chain intact" in client.post("/api/sourcing/rederive").json()["result"]["line"]


def test_the_page_renders_from_the_response_and_says_nothing_forbidden(client):
    r = client.get("/")
    assert r.status_code == 200 and "Strafe Forge" in r.text and "round_view" in r.text
    assert "claim_ceiling" in r.text                                       # every proposal card prints its ceiling sentence
    assert not [pat for pat in NEVER if re.search(pat, r.text, re.I)]


def test_a_malformed_body_is_422_not_a_traceback(client):
    r = client.post("/api/sourcing/rounds", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "malformed json"}


def test_a_missing_body_key_is_422_naming_the_key(client):
    r = client.post("/api/sourcing/rounds/round:none/select", json={"line_id": "line:motor", "offer_hash": "0" * 64})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "missing key", "key": "attestor"}


def test_an_unknown_state_is_422_naming_the_states(client):
    r = client.post("/api/sourcing/rounds", json={"state": "f99_nonesuch", "ship_to": "US-bench", "quantity": 1,
                                                  "transport_mode": "air", "request_key": "api-5"})
    assert r.status_code == 422
    d = r.json()["detail"]
    assert d["error"] == "unknown state" and d["state"] == "f99_nonesuch" and {"baseline", "f3_boson"} <= set(d["states"])


def test_a_lane_refusal_is_still_409_with_the_shipped_body(client):
    view = _open(client, key="api-6")["view"]
    motor = next(l for l in view["lines"] if l["node_id"] == "motor")
    chosen = next(c for c in motor["offers"] if c["status"] != "review_blocked")
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/select",
                    json={"line_id": "line:motor", "offer_hash": chosen["offer_hash"], "declined": [], "attestor": ""})
    assert r.status_code == 409
    assert r.json()["detail"] == {"refused": "SelectionRefused", "code": None, "detail": "a selection needs a human attestor"}
    assert r.json()["candidate"]["git_sha"] and set(r.json()) == {"detail", "candidate"}        # P-F: the envelope rides beside the ruled body


def test_a_null_attestor_is_refused_before_the_escalation_moves(client):
    """C1 at the HTTP surface: the page's Cancel on the attestor prompt sends null."""
    view = _open(client, key="api-7")["view"]
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/resolve_escalation", json={"line_id": "line:io_mcu", "reason": "origin_depends_on_lot", "attestor": None})
    assert r.status_code == 409 and r.json()["detail"] == {"refused": "RoundRefused", "code": None, "detail": "an escalation resolution needs a human attestor"}
    after = client.get(f"/api/sourcing/rounds/{view['round_id']}").json()["result"]
    io = next(l for l in after["lines"] if l["node_id"] == "io_mcu")
    assert [e["state"] for e in io["escalations"] if e["reason"] == "origin_depends_on_lot"] == ["open"]
    assert "escalation_resolved" not in [row["kind"] for row in client.get(f"/api/sourcing/rounds/{view['round_id']}/timeline?last=500").json()["result"]]


def _packet(client, key):
    """A packet on a packaged round: every line selected, the origin escalation resolved, the package built."""
    view = _open(client, key=key)["view"]
    rid = view["round_id"]
    for line in view["lines"]:
        chosen = next(c for c in line["offers"] if c["status"] != "review_blocked")
        declined = [{"offer_hash": c["offer_hash"]} for c in line["offers"] if c is not chosen]
        r = client.post(f"/api/sourcing/rounds/{rid}/select", json={"line_id": line["line_id"], "offer_hash": chosen["offer_hash"], "declined": declined, "attestor": "benji"})
        assert r.status_code == 200, r.text
    r = client.post(f"/api/sourcing/rounds/{rid}/resolve_escalation", json={"line_id": "line:io_mcu", "reason": "origin_depends_on_lot", "attestor": "charlie", "resolution": {"origin": "MY"}})
    assert r.status_code == 200, r.text
    assert client.post(f"/api/sourcing/rounds/{rid}/package", json={}).status_code == 200
    r = client.post("/api/sourcing/packets", json={"round_id": rid, "recipient_placeholder": "[SYNTHETIC]", "approver": {"identity": "charlie", "authority_basis": "demo"}})
    assert r.status_code == 200, r.text
    return r.json()["result"]["packet_id"]


def test_close_needs_a_known_dispatched_packet_and_dispatch_needs_an_attestor(client):
    r = client.post("/api/sourcing/packets/nope/close", json={"attestor": "charlie"})
    assert r.status_code == 409 and r.json()["detail"]["refused"] == "OrderRefused" and r.json()["detail"]["code"] == "UNKNOWN_PACKET"
    pid = _packet(client, "api-8")
    r = client.post(f"/api/sourcing/packets/{pid}/close", json={"attestor": "charlie"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_DISPATCHED"
    r = client.post(f"/api/sourcing/packets/{pid}/dispatch", json={"idempotency_key": "api-8", "attestor": ""})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NO_ATTESTOR"
    assert client.post(f"/api/sourcing/packets/{pid}/dispatch", json={"idempotency_key": "api-8", "attestor": "charlie"}).status_code == 200
    assert client.post(f"/api/sourcing/packets/{pid}/close", json={"attestor": "charlie"}).status_code == 200


def test_a_non_integer_quantity_an_unknown_kind_and_a_non_integer_seq_are_422(client):
    r = client.post("/api/sourcing/rounds", json={"state": "baseline", "ship_to": "US-bench", "quantity": "abc", "transport_mode": "air", "request_key": "api-9"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "quantity must be an integer"}
    view = _open(client, key="api-10")["view"]
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/propose", json={"line_id": "line:thermal_core", "kind": "nonsense"})
    assert r.status_code == 422 and r.json()["detail"]["error"] == "unknown kind" and set(r.json()["detail"]["kinds"]) == {"alternative", "escalation"}
    r = client.post("/api/sourcing/tamper", json={"seq": "x", "field": "kind", "value": "v"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "seq must be an integer"}


def test_refine_with_a_non_integer_quantity_is_422(client):
    """R-1: `refine` guards `quantity` as `open_round` does — a string is the caller's mistake, said as a 422, never a 500."""
    view = _open(client, key="api-11")["view"]
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/refine", json={"quantity": "abc"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "quantity must be an integer"}
    r = client.post(f"/api/sourcing/rounds/{view['round_id']}/refine", json={"quantity": 2})
    assert r.status_code == 200 and r.json()["result"]["changes"] == [{"field": "quantity", "from": 1, "to": 2}]


def test_a_router_only_mount_keeps_the_409_and_the_body_422s():
    """P-F: every body is built on the path itself — the 409 in `run`, the missing key in `Body.__missing__`, the malformed body and
    the non-integer quantity in their own raises — so an integrator who mounts only `router` (HANDOFF, Wiring) gets the same bodies.
    An app-level exception handler would not travel with the router and the missing key would reach him as a 500."""
    from fastapi import FastAPI
    from forge_sourcing_api.app import router
    host = FastAPI()
    host.include_router(router, prefix="/api/sourcing-lane")
    mounted = TestClient(host)
    r = mounted.post("/api/sourcing-lane/packets/nope/close", json={"attestor": "charlie"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "UNKNOWN_PACKET" and r.json()["candidate"]["git_sha"]
    r = mounted.post("/api/sourcing-lane/rounds", json={"ship_to": "US-bench"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "missing key", "key": "state"}
    r = mounted.post("/api/sourcing-lane/rounds", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "malformed json"}
    r = mounted.post("/api/sourcing-lane/rounds", json={"state": "baseline", "ship_to": "US-bench", "quantity": "abc", "request_key": "router-1"})
    assert r.status_code == 422 and r.json()["detail"] == {"error": "quantity must be an integer"}


def test_the_suite_pins_cache_mode_and_a_live_mode_would_be_budgeted(client):
    from forge_sourcing_api import app as appmod
    assert appmod.MODE == "cache" and appmod.PORTS.model.mode == "CACHED"
    assert "budget=Budget(calls_cap=40, cost_cap_microusd=5_000_000) if MODE == \"live\" else None" in (appmod.ROOT / "forge_sourcing_api" / "app.py").read_text(encoding="utf-8")
