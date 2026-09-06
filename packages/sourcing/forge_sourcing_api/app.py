"""FastAPI adapter over the seam. Routes are the service verbs; the page computes nothing; every response carries the
candidate envelope (engineering direction §3.10); a refusal is a 409 with the refusal's own words; GET /now is a
read-only observation that defaults to UNKNOWN (F-25). Mount under /api so a Vite proxy forwards it unchanged.
"""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse

from forge_search.propose import default_ports, propose_alternative, propose_escalation
from forge_sourcing.gate import GateRefused
from forge_sourcing.order import OrderRefused
from forge_sourcing.package import PackageRefused
from forge_sourcing.round import RoundRefused
from forge_sourcing.select import AdjudicationRefused, SelectionRefused
from forge_sourcing.service import Service
from forge_sourcing.thread import ThreadRefused

ROOT = Path(os.environ.get("FORGE_SOURCING_ROOT") or Path(__file__).resolve().parents[1])
DATA = ROOT / "data"
MODE = os.environ.get("TRIPWIRE_LLM", "cache")
PREFIX = os.environ.get("FORGE_SOURCING_PREFIX", "/api/sourcing")
REFUSALS = (RoundRefused, SelectionRefused, AdjudicationRefused, GateRefused, PackageRefused, OrderRefused, ThreadRefused, KeyError, ValueError)
FEATURES = {"F-07": "test_7_the_poisoned_page", "F-08": "test_propose_alternative_thermal", "F-13": "test_s1_", "F-14": "test_s2_", "F-15": "test_s3_",
            "F-16": "test_package_builds", "F-17": "test_propose_escalation", "F-25": "test_now_is_read_only"}

app = FastAPI(title="Strafe Forge sourcing lane")
router = APIRouter()
SVC = Service(DATA, csl_file=os.environ.get("FORGE_CSL_PATH") or None)
PORTS = default_ports(DATA, mode=MODE, offline=(MODE != "live"))
STATES = json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))["states"]
try:
    GIT_SHA = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True).strip()
except Exception:  # noqa: BLE001 - no git is an observation, not an error
    GIT_SHA = "UNKNOWN"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _state(name: str) -> dict:
    base = STATES["baseline"]
    if name == "baseline":
        return base
    st = STATES[name]
    return {"design_hash": st["design_hash"], "design_seq": st["design_seq"], "product": st["product"], "nodes": [st["replace_nodes"].get(n["node_id"], n) for n in base["nodes"]]}


def candidate() -> dict:
    head = SVC.thread.head
    return {"git_sha": GIT_SHA, "design_hash": SVC.current_design_hash, "log_head_seq": head["seq"], "log_head_hash": head["hash"],
            "fixture_manifest_shas": SVC.store.shas(), "search": {"pool_sha256": PORTS.pool_sha256, "rules_sha256": PORTS.rules["sha256"]},
            "mode": {"llm": PORTS.model.mode.lower() if PORTS.model.mode != "CACHED" else "cache", "api": "cached"}}


def run(fn, *, view_of: str | None = None):
    try:
        result = fn()
    except REFUSALS as exc:
        raise HTTPException(status_code=409, detail={"refused": type(exc).__name__, "code": getattr(exc, "code", None), "detail": str(exc)}) from exc
    body = {"candidate": candidate(), "result": result}
    if view_of:
        body["view"] = SVC.round_view(view_of)
    return body


@router.get("/health")
def health():
    return run(lambda: {"ok": True})


@router.get("/states")
def states():
    return run(lambda: list(STATES))


@router.get("/now")
def now():
    tests_path = ROOT / ".cache" / "last_pytest.json"
    tests = json.loads(tests_path.read_text(encoding="utf-8")) if tests_path.is_file() else None
    passed = tests["passed"] if tests else []
    latest = max(SVC.rounds.values(), key=lambda r: r["opened_at"], default=None)
    last = SVC.thread.events[-1] if SVC.thread.events else None
    return {"as_of": _now(), "candidate": candidate(),
            "round_status": latest["status"] if latest else "UNKNOWN",
            "last_event": {"seq": last["seq"], "kind": last["kind"], "hash": last["hash"]} if last else "UNKNOWN",
            "tests": {"passed": tests["counts"]["passed"], "skipped": tests["counts"]["skipped"], "as_of": tests["as_of"]} if tests else {"passed": "UNKNOWN", "skipped": "UNKNOWN"},
            "features": [{"id": fid, "claim_class": ("demonstrated" if any(needle in t for t in passed) else "design-intent") if tests else "UNKNOWN"} for fid, needle in FEATURES.items()],
            "claim_ceiling": "Shipyard projects; the lane's Git objects, receipts and tests remain authoritative; UNKNOWN is the default"}


@router.post("/rounds")
async def open_round(request: Request):
    b = await request.json()

    def go():
        design = b["design"] if "design" in b else _state(b["state"])
        r = SVC.open_round(design, ship_to=b["ship_to"], quantity=int(b.get("quantity", 1)), transport_mode=b.get("transport_mode", "air"),
                           request_key=b["request_key"], opened_at=b.get("opened_at") or _now())
        if b.get("run"):
            SVC.resolve(r["round_id"]); SVC.screen(r["round_id"]); SVC.cost(r["round_id"], entry_date=b.get("entry_date") or _now()[:10])
        return {"round_id": r["round_id"]}
    body = run(go)
    body["view"] = SVC.round_view(body["result"]["round_id"])
    return body


@router.get("/rounds/{round_id}")
def round_view(round_id: str):
    return run(lambda: SVC.round_view(round_id))


@router.get("/rounds/{round_id}/timeline")
def timeline(round_id: str, last: int = 8):
    return run(lambda: SVC.timeline(round_id, last=last))


VERBS = {
    "resolve": lambda rid, b: SVC.resolve(rid) and {"ok": True},
    "screen": lambda rid, b: SVC.screen(rid) and {"ok": True},
    "rescreen": lambda rid, b: SVC.rescreen(rid),
    "cost": lambda rid, b: SVC.cost(rid, entry_date=b.get("entry_date") or _now()[:10]) and {"ok": True},
    "refine": lambda rid, b: SVC.refine(rid, quantity=b.get("quantity"), transport_mode=b.get("transport_mode"), attestor=b.get("attestor", "engineer")),
    "select": lambda rid, b: SVC.select(rid, b["line_id"], b["offer_hash"], declined=b.get("declined", []), attestor=b.get("attestor")),
    "adjudicate": lambda rid, b: SVC.adjudicate(rid, b["offer_hash"], b["party_id"], role=b["role"], disposition=b["disposition"], reason_code=b["reason_code"], rationale=b["rationale"], attestor=b["attestor"]),
    "resolve_escalation": lambda rid, b: SVC.resolve_escalation(rid, b["line_id"], b["reason"], attestor=b["attestor"], resolution=b.get("resolution", {})),
    "gate": lambda rid, b: SVC.gate(rid, b.get("references")),
    "declare": lambda rid, b: SVC.declare(rid, party=b["party"], person_status=b["person_status"], sharing=b["sharing"], reference=b.get("reference"), attestor=b["attestor"]),
    "package": lambda rid, b: SVC.build_package(rid, built_at=b.get("built_at") or _now()),
    "propose": lambda rid, b: (propose_escalation(SVC, rid, b["line_id"], b["reason"], PORTS, proposed_at=_now()) if b.get("kind") == "escalation"
                               else propose_alternative(SVC, rid, b["line_id"], PORTS, proposed_at=_now())),
    "accept_proposal": lambda rid, b: SVC.accept_proposal(rid, b["proposal_id"], attestor=b["attestor"]),
    "reject_proposal": lambda rid, b: SVC.reject_proposal(rid, b["proposal_id"], attestor=b["attestor"], reason=b.get("reason", "")),
}


@router.post("/rounds/{round_id}/{verb}")
async def round_verb(round_id: str, verb: str, request: Request):
    if verb not in VERBS:
        raise HTTPException(status_code=404, detail=f"unknown verb {verb}; one of {sorted(VERBS)}")
    b = await request.json() if int(request.headers.get("content-length") or 0) else {}
    return run(lambda: VERBS[verb](round_id, b), view_of=round_id)


@router.post("/packets")
async def create_packet(request: Request):
    b = await request.json()
    return run(lambda: SVC.create_packet(b["round_id"], recipient_placeholder=b["recipient_placeholder"], approver=b["approver"], created_at=b.get("created_at") or _now()), view_of=b["round_id"])


@router.post("/packets/{packet_id}/dispatch")
async def dispatch(packet_id: str, request: Request):
    b = await request.json()
    return run(lambda: SVC.dispatch(packet_id, idempotency_key=b["idempotency_key"], attestor=b["attestor"], dispatched_at=b.get("dispatched_at") or _now()))


@router.post("/packets/{packet_id}/close")
async def close_order(packet_id: str, request: Request):
    b = await request.json()
    return run(lambda: SVC.close_order(packet_id, receiving=b.get("receiving"), inspection=b.get("inspection"), attestor=b["attestor"], closed_at=b.get("closed_at") or _now()))


@router.post("/rederive")
def rederive():
    return run(SVC.rederive)


@router.post("/tamper")
async def tamper(request: Request):
    b = await request.json()
    return run(lambda: SVC.tamper(int(b["seq"]), b["field"], b["value"]) or {"tampered": {"seq": b["seq"], "field": b["field"]}})


@app.get("/", response_class=HTMLResponse)
def page():
    return (Path(__file__).resolve().parent / "static" / "round.html").read_text(encoding="utf-8")


app.include_router(router, prefix=PREFIX)
