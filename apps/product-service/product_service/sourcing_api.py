"""Deterministic, fixture-bounded sourcing service adapter.

The adapter deliberately stops at an idempotent STAGED dispatch.  It performs no
network calls, full-list screening, transaction clearance, or external ordering.
"""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Mapping


SCHEMA_VERSION = "caddydaddy.sourcing-service/1"
CORPUS_VERSION = "caddydaddy.sourcing-fixture/1"
CLAIM_CEILING = "FIXTURE_REVIEW_SUPPORT_ONLY_NO_CLEARANCE_OR_EXTERNAL_ORDER"
LIMITATIONS = [
    "Synthetic two-key screening corpus with one active fixture match; not a full restricted-party list.",
    "Seller, manufacturer, ownership, tariff, availability, price, and origin data are committed fixtures.",
    "Landed cost is a deterministic estimate over fixture rates, not customs, legal, or transaction advice.",
    "Dispatch stops at STAGED and never contacts a supplier, broker, carrier, or external system.",
]


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _section_hash(value: Any) -> str:
    return _sha256(_canonical_bytes(value))


_CSL = (
    {"name": "SZ DJI Technology Co", "program": "synthetic-active-fixture", "active": True},
    {"name": "Shenzhen LCSC Electronics Technology Co", "program": "synthetic-inactive-fixture", "active": False},
)

_OWNERSHIP = {
    "Aero Supply LLC": ({"name": "Northstar Employee Trust", "pct": "100.0"},),
    "Northstar Employee Trust": (),
    "Formosa Controls Ltd": ({"name": "Harbor Industrial Holdings", "pct": "55.0"},),
    "Harbor Industrial Holdings": (),
    "Skybridge Components Ltd": ({"name": "SZ DJI Technology Co Ltd", "pct": "60.0"},),
    "SZ DJI Technology Co Ltd": (),
}

_OFFERS = (
    {
        "offer_id": "offer:aero-us-001",
        "part_key": "flight-controller",
        "seller": "Aero Supply LLC",
        "manufacturer": "Aero Supply LLC",
        "origin": "US",
        "ship_from": "US",
        "unit_price_usd": "118.00",
        "lead_days": 4,
        "declared_hts": "8542.31",
        "declared_eccn": "EAR99",
    },
    {
        "offer_id": "offer:formosa-tw-001",
        "part_key": "flight-controller",
        "seller": "Formosa Controls Ltd",
        "manufacturer": "Formosa Controls Ltd",
        "origin": "TW",
        "ship_from": "TW",
        "unit_price_usd": "91.00",
        "lead_days": 11,
        "declared_hts": "8542.31",
        "declared_eccn": "not-yet-classified",
    },
    {
        "offer_id": "offer:skybridge-cn-001",
        "part_key": "flight-controller",
        "seller": "Skybridge Components Ltd",
        "manufacturer": "Skybridge Components Ltd",
        "origin": "CN",
        "ship_from": "CN",
        "unit_price_usd": "72.00",
        "lead_days": 8,
        "declared_hts": "8542.31",
        "declared_eccn": "seller-declared-EAR99",
    },
)

_TARIFFS = {
    "as_of": "2026-09-04",
    "base_rates": {"8542.31": "0.0000"},
    "fixture_origin_adders": {"CN": "0.2500"},
    "mpf_rate": "0.003464",
    "mpf_min_usd": "33.58",
    "mpf_max_usd": "651.50",
    "freight_per_unit_usd": {"air": "18.00", "ocean": "8.00"},
}

_SOURCE_HASHES = {
    "screening": _section_hash(_CSL),
    "ownership": _section_hash(_OWNERSHIP),
    "offers": _section_hash(_OFFERS),
    "tariffs": _section_hash(_TARIFFS),
}
_CORPUS_PREIMAGE = {
    "schema_version": CORPUS_VERSION,
    "screening_entries": len(_CSL),
    "active_screening_entries": sum(1 for entry in _CSL if entry["active"]),
    "ownership_rows": len(_OWNERSHIP),
    "offers": len(_OFFERS),
    "source_hashes": _SOURCE_HASHES,
}
CORPUS_MANIFEST = {**_CORPUS_PREIMAGE, "corpus_sha256": _section_hash(_CORPUS_PREIMAGE)}


def _exact_name(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _suffix_name(value: str) -> str:
    words = _exact_name(value).split()
    suffixes = {"co", "company", "corp", "corporation", "inc", "incorporated", "llc", "ltd", "limited"}
    while words and words[-1] in suffixes:
        words.pop()
    return " ".join(words)


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class SourcingRuntime:
    """Stateful local adapter with immutable inputs and in-process audit state."""

    def __init__(self, candidate_identity: Mapping[str, str], artifact_root: Path | None = None) -> None:
        required = {"candidate_id", "revision_id", "snapshot_sha256"}
        if set(candidate_identity) != required or not all(isinstance(candidate_identity[key], str) and candidate_identity[key] for key in required):
            raise ValueError("CANDIDATE_IDENTITY_INVALID")
        self.candidate_identity = dict(candidate_identity)
        self.artifact_root = Path(artifact_root or tempfile.mkdtemp(prefix="caddydaddy-sourcing-")).resolve()
        self.artifact_root.mkdir(parents=True, exist_ok=True)
        self._rounds: dict[str, dict[str, Any]] = {}
        self._dispatches: dict[str, dict[str, Any]] = {}

    def _response(self, status: str, **payload: Any) -> dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "status": status,
            "candidate": deepcopy(self.candidate_identity),
            "source_hashes": deepcopy(_SOURCE_HASHES),
            "corpus": deepcopy(CORPUS_MANIFEST),
            "claim_ceiling": CLAIM_CEILING,
            "limitations": list(LIMITATIONS),
            **payload,
        }

    def _error(self, code: str, message: str, status_code: int = 400, **payload: Any) -> tuple[int, dict[str, Any]]:
        return status_code, self._response("BLOCKED", diagnostic={"code": code, "message": message}, **payload)

    def _candidate_is_current(self, request: Any) -> bool:
        return isinstance(request, Mapping) and request.get("candidate") == self.candidate_identity

    @staticmethod
    def _event(kind: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        preimage = {"event_type": kind, "sequence": payload["sequence"], "payload": dict(payload["payload"])}
        return {**preimage, "event_sha256": _section_hash(preimage)}

    def screen_name(self, name: str) -> dict[str, Any]:
        exact = _exact_name(name)
        suffix = _suffix_name(name)
        for entry in _CSL:
            if not entry["active"]:
                continue
            entry_exact = _exact_name(entry["name"])
            if exact == entry_exact:
                return {"result": "exact", "listed_name": entry["name"], "program": entry["program"]}
            if suffix == _suffix_name(entry["name"]):
                return {"result": "suffix-normalized", "listed_name": entry["name"], "program": entry["program"]}
        return {"result": "no-candidate-match"}

    def _ownership_walk(self, root_name: str) -> tuple[dict[str, Any], bool, bool]:
        active: set[str] = set()

        def visit(name: str, pct: str | None = None) -> tuple[dict[str, Any], bool, bool]:
            if name in active:
                return ({"name": name, "pct": pct, "screening": {"result": "abstained"}, "owners": [], "diagnostic": "OWNERSHIP_CYCLE"}, False, True)
            screening = self.screen_name(name)
            if name not in _OWNERSHIP:
                return ({"name": name, "pct": pct, "screening": screening, "owners": [], "diagnostic": "OWNERSHIP_UNKNOWN"}, screening["result"] != "no-candidate-match", True)
            active.add(name)
            children = []
            blocked = screening["result"] != "no-candidate-match"
            unknown = False
            for owner in _OWNERSHIP[name]:
                child, child_blocked, child_unknown = visit(owner["name"], owner["pct"])
                children.append(child)
                blocked = blocked or child_blocked
                unknown = unknown or child_unknown
            active.remove(name)
            return ({"name": name, "pct": pct, "screening": screening, "owners": children}, blocked, unknown)

        return visit(root_name)

    @staticmethod
    def _landed_cost(offer: Mapping[str, Any], quantity: int, mode: str) -> dict[str, Any]:
        unit = Decimal(offer["unit_price_usd"])
        goods = unit * quantity
        if offer["ship_from"] == "US" and offer["origin"] == "US":
            return {
                "rows": [{"layer": "goods", "amount_usd": _money(goods), "source": "fixture offer"}],
                "total_usd": _money(goods),
                "per_unit_usd": _money(unit),
                "assumptions": "domestic fixture; no import charges modeled",
            }
        base_rate = Decimal(_TARIFFS["base_rates"].get(offer["declared_hts"], "0"))
        origin_rate = Decimal(_TARIFFS["fixture_origin_adders"].get(offer["origin"], "0"))
        base = goods * base_rate
        origin = goods * origin_rate
        mpf_raw = goods * Decimal(_TARIFFS["mpf_rate"])
        mpf = min(Decimal(_TARIFFS["mpf_max_usd"]), max(Decimal(_TARIFFS["mpf_min_usd"]), mpf_raw))
        freight = Decimal(_TARIFFS["freight_per_unit_usd"][mode]) * quantity
        total = goods + base + origin + mpf + freight
        rows = [
            {"layer": "goods", "amount_usd": _money(goods), "source": "fixture offer"},
            {"layer": "base-rate estimate", "amount_usd": _money(base), "source": f"fixture tariff {_TARIFFS['as_of']}"},
            {"layer": "origin-adder estimate", "amount_usd": _money(origin), "source": f"fixture origin {offer['origin']}"},
            {"layer": "merchandise-processing estimate", "amount_usd": _money(mpf), "source": "fixture MPF band"},
            {"layer": "freight estimate", "amount_usd": _money(freight), "source": f"fixture {mode} rate"},
        ]
        return {"rows": rows, "total_usd": _money(total), "per_unit_usd": _money(total / quantity), "assumptions": "declared fixture values only; no clearance inferred"}

    def _resolve_offer(self, offer: Mapping[str, Any], quantity: int, mode: str) -> dict[str, Any]:
        seller_walk, seller_blocked, seller_unknown = self._ownership_walk(offer["seller"])
        manufacturer_walk = None
        manufacturer_blocked = False
        manufacturer_unknown = False
        if offer["manufacturer"] != offer["seller"]:
            manufacturer_walk, manufacturer_blocked, manufacturer_unknown = self._ownership_walk(offer["manufacturer"])
        blocked = seller_blocked or manufacturer_blocked
        unknown = seller_unknown or manufacturer_unknown
        disposition = "review-blocked" if blocked else "review-required" if unknown else "eligible-fixture"
        return {
            **dict(offer),
            "screening_disposition": disposition,
            "ownership_walk": {"seller": seller_walk, "manufacturer": manufacturer_walk},
            "landed_cost": self._landed_cost(offer, quantity, mode),
        }

    def create_round(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        try:
            part_key = request["part_key"]
            quantity = request["quantity"]
            mode = request["mode"]
            if not isinstance(part_key, str) or not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1 or quantity > 10000 or mode not in {"air", "ocean"}:
                raise ValueError
        except (KeyError, TypeError, ValueError):
            return self._error("ROUND_REQUEST_INVALID", "part_key, quantity, and mode must satisfy the bounded fixture schema.")
        matching = [offer for offer in _OFFERS if offer["part_key"] == part_key]
        offers = [self._resolve_offer(offer, quantity, mode) for offer in matching]
        request_preimage = {"candidate": self.candidate_identity, "part_key": part_key, "quantity": quantity, "mode": mode, "corpus_sha256": CORPUS_MANIFEST["corpus_sha256"]}
        round_id = "round:" + _section_hash(request_preimage)
        if round_id not in self._rounds:
            event = self._event("ROUND_CREATED", {"sequence": 1, "payload": {"round_id": round_id, "offer_ids": [offer["offer_id"] for offer in offers]}})
            self._rounds[round_id] = {"round_id": round_id, "request": request_preimage, "offers": offers, "events": [event], "selected_offer_id": None, "adjudications": {}, "package": None}
        state = self._rounds[round_id]
        return 200, self._response("READY", round=deepcopy(state))

    def adjudicate_offer(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state = self._rounds.get(request.get("round_id")) if isinstance(request, Mapping) else None
        if state is None:
            return self._error("ROUND_NOT_FOUND", "The sourcing round is not current.", 404)
        offer = next((item for item in state["offers"] if item["offer_id"] == request.get("offer_id")), None)
        if offer is None:
            return self._error("OFFER_NOT_FOUND", "The offer is not part of this immutable round.", 404)
        decision = request.get("decision")
        attestor = request.get("attestor")
        rationale = request.get("rationale")
        if decision not in {"HOLD", "REJECT", "ACCEPT_FOR_FIXTURE_REVIEW"} or not isinstance(attestor, str) or not attestor.strip() or not isinstance(rationale, str) or not rationale.strip():
            return self._error("ADJUDICATION_INVALID", "A bounded decision, attestor, and rationale are required.")
        adjudication = {"decision": decision, "attestor": attestor.strip(), "rationale": rationale.strip(), "does_not_change_screening": True}
        state["adjudications"][offer["offer_id"]] = adjudication
        state["events"].append(self._event("OFFER_ADJUDICATED", {"sequence": len(state["events"]) + 1, "payload": {"round_id": state["round_id"], "offer_id": offer["offer_id"], **adjudication}}))
        return 200, self._response("RECORDED", round_id=state["round_id"], offer=deepcopy(offer), adjudication=deepcopy(adjudication), audit_events=deepcopy(state["events"]))

    def select_offer(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state = self._rounds.get(request.get("round_id")) if isinstance(request, Mapping) else None
        if state is None:
            return self._error("ROUND_NOT_FOUND", "The sourcing round is not current.", 404)
        offer = next((item for item in state["offers"] if item["offer_id"] == request.get("offer_id")), None)
        if offer is None:
            return self._error("OFFER_NOT_FOUND", "The offer is not part of this immutable round.", 404)
        if offer["screening_disposition"] != "eligible-fixture":
            state["events"].append(self._event("OFFER_SELECTION_BLOCKED", {"sequence": len(state["events"]) + 1, "payload": {"round_id": state["round_id"], "offer_id": offer["offer_id"], "screening_disposition": offer["screening_disposition"]}}))
            return self._error("BLOCKED_OFFER_SELECTION", "Blocked or unresolved fixture offers remain visible but cannot be selected.", 409, offer=deepcopy(offer), audit_events=deepcopy(state["events"]))
        state["selected_offer_id"] = offer["offer_id"]
        state["events"].append(self._event("OFFER_SELECTED", {"sequence": len(state["events"]) + 1, "payload": {"round_id": state["round_id"], "offer_id": offer["offer_id"]}}))
        return 200, self._response("SELECTED", round_id=state["round_id"], selected_offer=deepcopy(offer), offers=deepcopy(state["offers"]), audit_events=deepcopy(state["events"]))

    def _artifact_path(self, filename: str) -> Path:
        candidate = (self.artifact_root / filename).resolve()
        if candidate.parent != self.artifact_root:
            raise RuntimeError("PACKAGE_PATH_INVALID")
        return candidate

    @staticmethod
    def _write_immutable(path: Path, content: bytes) -> None:
        if path.exists():
            return
        temporary = path.with_name(path.name + f".tmp-{os.getpid()}")
        with temporary.open("xb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)

    def _verify_package(self, package: Mapping[str, Any]) -> tuple[bool, str | None]:
        for key, hash_key in (("payload_file", "payload_sha256"), ("manifest_file", "manifest_sha256")):
            try:
                content = self._artifact_path(package[key]).read_bytes()
            except (OSError, KeyError, RuntimeError):
                return False, "PACKAGE_MISSING"
            if _sha256(content) != package[hash_key]:
                return False, "PACKAGE_TAMPERED"
        return True, None

    def build_package(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state = self._rounds.get(request.get("round_id")) if isinstance(request, Mapping) else None
        if state is None or not state["selected_offer_id"]:
            return self._error("SELECTION_REQUIRED", "A current eligible fixture offer must be selected before packaging.", 409)
        offer = next(item for item in state["offers"] if item["offer_id"] == state["selected_offer_id"])
        payload = {"schema_version": "caddydaddy.staged-order-payload/1", "candidate": self.candidate_identity, "round_id": state["round_id"], "selected_offer": offer, "corpus_sha256": CORPUS_MANIFEST["corpus_sha256"], "external_send_authorized": False}
        payload_bytes = _canonical_bytes(payload)
        payload_sha = _sha256(payload_bytes)
        payload_file = f"payload-{payload_sha}.json"
        self._write_immutable(self._artifact_path(payload_file), payload_bytes)
        reread_payload = self._artifact_path(payload_file).read_bytes()
        if reread_payload != payload_bytes or _sha256(reread_payload) != payload_sha:
            return self._error("PACKAGE_TAMPERED", "Payload bytes failed post-write reread verification.", 409)
        manifest_preimage = {"schema_version": "caddydaddy.staged-order-manifest/1", "candidate": self.candidate_identity, "round_id": state["round_id"], "payload_file": payload_file, "payload_sha256": payload_sha, "payload_bytes": len(payload_bytes), "corpus_sha256": CORPUS_MANIFEST["corpus_sha256"], "dispatch_ceiling": "STAGED_ONLY"}
        manifest_bytes = _canonical_bytes(manifest_preimage)
        manifest_sha = _sha256(manifest_bytes)
        manifest_file = f"manifest-{manifest_sha}.json"
        self._write_immutable(self._artifact_path(manifest_file), manifest_bytes)
        reread_manifest = self._artifact_path(manifest_file).read_bytes()
        if reread_manifest != manifest_bytes or _sha256(reread_manifest) != manifest_sha:
            return self._error("PACKAGE_TAMPERED", "Manifest bytes failed post-write reread verification.", 409)
        package = {**manifest_preimage, "manifest_file": manifest_file, "manifest_sha256": manifest_sha, "byte_reread_verified": True}
        if state["package"] is not None:
            ok, code = self._verify_package(state["package"])
            if not ok:
                return self._error(code or "PACKAGE_TAMPERED", "Existing immutable package failed reread verification.", 409)
        state["package"] = package
        state["events"].append(self._event("PACKAGE_MATERIALIZED", {"sequence": len(state["events"]) + 1, "payload": {"round_id": state["round_id"], "manifest_sha256": manifest_sha, "byte_reread_verified": True}}))
        return 200, self._response("PACKAGED", package=deepcopy(package), audit_events=deepcopy(state["events"]))

    def stage_dispatch(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state = self._rounds.get(request.get("round_id")) if isinstance(request, Mapping) else None
        key = request.get("idempotency_key") if isinstance(request, Mapping) else None
        if state is None or state["package"] is None or not isinstance(key, str) or not key.strip() or request.get("manifest_sha256") != state["package"]["manifest_sha256"]:
            return self._error("DISPATCH_REQUEST_INVALID", "A current package manifest and non-empty idempotency key are required.", 409)
        ok, code = self._verify_package(state["package"])
        if not ok:
            return self._error(code or "PACKAGE_TAMPERED", "Package bytes failed dispatch-time reread verification.", 409)
        fingerprint = _section_hash({"candidate": self.candidate_identity, "round_id": state["round_id"], "manifest_sha256": state["package"]["manifest_sha256"]})
        existing = self._dispatches.get(key)
        if existing is not None:
            if existing["fingerprint"] != fingerprint:
                return self._error("IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to another staged package.", 409)
            return 200, deepcopy(existing["response"])
        body = self._response("STAGED", dispatch={"dispatch_id": "staged:" + fingerprint, "idempotency_key": key, "manifest_sha256": state["package"]["manifest_sha256"], "external_send": False, "network_calls": 0})
        self._dispatches[key] = {"fingerprint": fingerprint, "response": deepcopy(body)}
        state["events"].append(self._event("ORDER_DISPATCH_STAGED", {"sequence": len(state["events"]) + 1, "payload": {"round_id": state["round_id"], "dispatch_id": body["dispatch"]["dispatch_id"], "external_send": False}}))
        return 200, body


def create_fastapi_router(runtime: SourcingRuntime) -> Any | None:
    """Return an APIRouter when FastAPI is installed; current service has no such dependency."""

    try:
        from fastapi import APIRouter
        from fastapi.responses import JSONResponse
    except ImportError:
        return None
    router = APIRouter(prefix="/api/sourcing", tags=["sourcing-fixture"])

    def bind(path: str, action: Any) -> None:
        async def endpoint(request: dict[str, Any]) -> JSONResponse:
            status, body = action(request)
            return JSONResponse(status_code=status, content=body)
        router.add_api_route(path, endpoint, methods=["POST"])

    bind("/rounds", runtime.create_round)
    bind("/adjudications", runtime.adjudicate_offer)
    bind("/selections", runtime.select_offer)
    bind("/packages", runtime.build_package)
    bind("/dispatches", runtime.stage_dispatch)
    return router

