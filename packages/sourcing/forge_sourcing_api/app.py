"""FastAPI adapter over the seam. Routes are the service verbs; the page computes nothing; every response carries the
candidate envelope (engineering direction §3.10); a lane refusal — and only a lane refusal — is a 409 with the refusal's
own words; a body this adapter cannot read is a 422 that says which key or what is malformed; anything else is a bug and
surfaces as a 500. GET /now is a read-only observation that defaults to UNKNOWN (F-25). Mount under /api so a Vite proxy
forwards it unchanged.
"""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse

from forge_search.model import Budget
from forge_search.propose import default_ports, propose_alternative, propose_escalation
from forge_sourcing.fixtures import design_state
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
REFUSALS = (RoundRefused, SelectionRefused, AdjudicationRefused, GateRefused, PackageRefused, OrderRefused, ThreadRefused)
FEATURES = {"F-07": "test_7_the_poisoned_page", "F-08": "test_propose_alternative_thermal", "F-13": "test_s1_", "F-14": "test_s2_", "F-15": "test_s3_",
            "F-16": "test_package_builds", "F-17": "test_propose_escalation", "F-25": "test_now_is_read_only"}

app = FastAPI(title="Strafe Forge sourcing lane")
router = APIRouter()
SVC = Service(DATA, csl_file=os.environ.get("FORGE_CSL_PATH") or None)
PORTS = default_ports(DATA, mode=MODE, offline=(MODE != "live"), budget=Budget(calls_cap=40, cost_cap_microusd=5_000_000) if MODE == "live" else None)   # the $5 per-process cap, as record_cache.py
STATES = json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))["states"]
try:
    GIT_SHA = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True).strip()
except Exception:  # noqa: BLE001 - no git is an observation, not an error
    GIT_SHA = "UNKNOWN"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _state(name: str) -> dict:
    if name not in STATES:
        raise HTTPException(status_code=422, detail={"error": "unknown state", "state": name, "states": sorted(STATES)})
    return design_state(STATES, name)                          # a copy: no round aliases the module-level fixture nodes


def _int(value, name: str) -> int:
    """A body integer. A bool, a float or a non-numeric string is the caller's mistake, said as a 422 — never truncated, never a 500."""
    if isinstance(value, bool) or isinstance(value, float):
        raise HTTPException(status_code=422, detail={"error": f"{name} must be an integer"})
    try:
        return int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail={"error": f"{name} must be an integer"}) from None


def _propose(rid: str, b: dict) -> dict:
    kind = b.get("kind", "alternative")
    if kind == "escalation":
        return propose_escalation(SVC, rid, b["line_id"], b["reason"], PORTS, proposed_at=_now())
    if kind == "alternative":
        return propose_alternative(SVC, rid, b["line_id"], PORTS, proposed_at=_now())
    raise HTTPException(status_code=422, detail={"error": "unknown kind", "kind": kind, "kinds": ["alternative", "escalation"]})


def candidate() -> dict:
    head = SVC.thread.head
    return {"git_sha": GIT_SHA, "design_hash": SVC.current_design_hash, "log_head_seq": head["seq"], "log_head_hash": head["hash"],
            "fixture_manifest_shas": SVC.store.shas(), "search": {"pool_sha256": PORTS.pool_sha256, "rules_sha256": PORTS.rules["sha256"]},
            "mode": {"llm": PORTS.model.mode.lower() if PORTS.model.mode != "CACHED" else "cache", "api": "cached"}}


class MissingKey(Exception):
    """A required key is absent from the request body: the caller's mistake, not the lane's refusal and not a bug."""

    def __init__(self, key: str):
        super().__init__(key)
        self.key = key


class Body(dict):
    """The request body. `b["x"]` on an absent key becomes a 422 naming the key, never a 409 and never a traceback."""

    def __missing__(self, key):
        raise MissingKey(key)


@app.exception_handler(MissingKey)
async def missing_key(request: Request, exc: MissingKey):
    return JSONResponse(status_code=422, content={"detail": {"error": "missing key", "key": exc.key}})


async def read_body(request: Request) -> Body:
    """Parse the body here, inside the boundary: an unreadable body is 422, an absent body is {}."""
    raw = await request.body()
    if not raw:
        return Body()
    try:
        parsed = json.loads(raw)
    except ValueError:
        parsed = None
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail={"error": "malformed json"})
    return Body(parsed)


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
    b = await read_body(request)

    def go():
        design = b["design"] if "design" in b else _state(b["state"])
        r = SVC.open_round(design, ship_to=b["ship_to"], quantity=_int(b.get("quantity", 1), "quantity"), transport_mode=b.get("transport_mode", "air"),
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
    "select": lambda rid, b: SVC.select(rid, b["line_id"], b["offer_hash"], declined=b.get("declined", []), attestor=b["attestor"]),
    "adjudicate": lambda rid, b: SVC.adjudicate(rid, b["offer_hash"], b["party_id"], role=b["role"], disposition=b["disposition"], reason_code=b["reason_code"], rationale=b["rationale"], attestor=b["attestor"]),
    "resolve_escalation": lambda rid, b: SVC.resolve_escalation(rid, b["line_id"], b["reason"], attestor=b["attestor"], resolution=b.get("resolution", {})),
    "gate": lambda rid, b: SVC.gate(rid, b.get("references")),
    "declare": lambda rid, b: SVC.declare(rid, party=b["party"], person_status=b["person_status"], sharing=b["sharing"], reference=b.get("reference"), attestor=b["attestor"]),
    "package": lambda rid, b: SVC.build_package(rid, built_at=b.get("built_at") or _now()),
    "propose": _propose,
    "accept_proposal": lambda rid, b: SVC.accept_proposal(rid, b["proposal_id"], attestor=b["attestor"]),
    "reject_proposal": lambda rid, b: SVC.reject_proposal(rid, b["proposal_id"], attestor=b["attestor"], reason=b.get("reason", "")),
}


@router.post("/rounds/{round_id}/{verb}")
async def round_verb(round_id: str, verb: str, request: Request):
    if verb not in VERBS:
        raise HTTPException(status_code=404, detail=f"unknown verb {verb}; one of {sorted(VERBS)}")
    b = await read_body(request)
    return run(lambda: VERBS[verb](round_id, b), view_of=round_id)


@router.post("/packets")
async def create_packet(request: Request):
    b = await read_body(request)
    return run(lambda: SVC.create_packet(b["round_id"], recipient_placeholder=b["recipient_placeholder"], approver=b["approver"], created_at=b.get("created_at") or _now()), view_of=b["round_id"])


@router.post("/packets/{packet_id}/dispatch")
async def dispatch(packet_id: str, request: Request):
    b = await read_body(request)
    return run(lambda: SVC.dispatch(packet_id, idempotency_key=b["idempotency_key"], attestor=b["attestor"], dispatched_at=b.get("dispatched_at") or _now()))


@router.post("/packets/{packet_id}/close")
async def close_order(packet_id: str, request: Request):
    b = await read_body(request)
    return run(lambda: SVC.close_order(packet_id, receiving=b.get("receiving"), inspection=b.get("inspection"), attestor=b["attestor"], closed_at=b.get("closed_at") or _now()))


@router.post("/rederive")
def rederive():
    return run(SVC.rederive)


@router.post("/tamper")
async def tamper(request: Request):
    b = await read_body(request)
    return run(lambda: SVC.tamper(_int(b["seq"], "seq"), b["field"], b["value"]) or {"tampered": {"seq": b["seq"], "field": b["field"]}})


@app.get("/", response_class=HTMLResponse)
def page():
    return (Path(__file__).resolve().parent / "static" / "round.html").read_text(encoding="utf-8")


app.include_router(router, prefix=PREFIX)
