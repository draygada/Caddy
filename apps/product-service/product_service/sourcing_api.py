"""Stateless bounded sourcing with canonical client-carried continuity."""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Mapping


SCHEMA_VERSION = "caddydaddy.sourcing-service/1"
STATE_SCHEMA_VERSION = "caddydaddy.sourcing-state/1"
CORPUS_VERSION = "caddydaddy.sourcing-fixture/1"
CLAIM_CEILING = "BOUNDED_USER_INPUT_REVIEW_SUPPORT_ONLY_NO_CLEARANCE_OR_EXTERNAL_ORDER"
LIMITATIONS = [
    "User-provided offers and screening evidence are preserved and hashed but are not independently fetched or verified.",
    "Unknown, incomplete, or instruction-like screening evidence remains HOLD; no full restricted-party-list coverage is claimed.",
    "The two-key screening corpus and three offers are an explicitly labelled Offline demo only.",
    "Landed cost uses declared values and fixture rates; it is not customs, legal, or transaction advice.",
    "Dispatch stops at STAGED and never contacts a supplier, broker, carrier, or external system.",
]


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _hash(value: Any) -> str:
    return _sha256(_canonical_bytes(value))


_INSTRUCTION = re.compile(
    r"(?i)(assistant\s*:|system\s*:|developer\s*:|ignore\s+(?:all\s+)?(?:previous|prior)|"
    r"follow\s+these\s+instructions|report\s+this\s+as|classify\s+this\s+as)"
)
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
    {"offer_id": "offer:aero-us-001", "part_key": "flight-controller", "seller": "Aero Supply LLC", "manufacturer": "Aero Supply LLC", "origin": "US", "ship_from": "US", "unit_price_usd": "118.00", "lead_days": 4, "declared_hts": "8542.31", "declared_eccn": "EAR99"},
    {"offer_id": "offer:formosa-tw-001", "part_key": "flight-controller", "seller": "Formosa Controls Ltd", "manufacturer": "Formosa Controls Ltd", "origin": "TW", "ship_from": "TW", "unit_price_usd": "91.00", "lead_days": 11, "declared_hts": "8542.31", "declared_eccn": "not-yet-classified"},
    {"offer_id": "offer:skybridge-cn-001", "part_key": "flight-controller", "seller": "Skybridge Components Ltd", "manufacturer": "Skybridge Components Ltd", "origin": "CN", "ship_from": "CN", "unit_price_usd": "72.00", "lead_days": 8, "declared_hts": "8542.31", "declared_eccn": "seller-declared-EAR99"},
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
    "screening": _hash(_CSL),
    "ownership": _hash(_OWNERSHIP),
    "offers": _hash(_OFFERS),
    "tariffs": _hash(_TARIFFS),
}
_CORPUS_PREIMAGE = {
    "schema_version": CORPUS_VERSION,
    "mode": "OFFLINE_DEMO",
    "screening_entries": len(_CSL),
    "active_screening_entries": sum(1 for entry in _CSL if entry["active"]),
    "ownership_rows": len(_OWNERSHIP),
    "offers": len(_OFFERS),
    "source_hashes": _SOURCE_HASHES,
}
CORPUS_MANIFEST = {**_CORPUS_PREIMAGE, "corpus_sha256": _hash(_CORPUS_PREIMAGE)}


def _exact_name(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _suffix_name(value: str) -> str:
    words = _exact_name(value).split()
    while words and words[-1] in {"co", "company", "corp", "corporation", "inc", "incorporated", "llc", "ltd", "limited"}:
        words.pop()
    return " ".join(words)


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class SourcingRuntime:
    """Each follow-up is reconstructed from request state, never process memory."""

    def __init__(self, candidate_identity: Mapping[str, str], artifact_root: Path | None = None) -> None:
        required = {"candidate_id", "revision_id", "snapshot_sha256"}
        if set(candidate_identity) != required or not all(isinstance(candidate_identity[key], str) and candidate_identity[key] for key in required):
            raise ValueError("CANDIDATE_IDENTITY_INVALID")
        self.candidate_identity = dict(candidate_identity)
        self.artifact_root = Path(artifact_root or tempfile.mkdtemp(prefix="caddydaddy-sourcing-")).resolve()
        self.artifact_root.mkdir(parents=True, exist_ok=True)

    def _context(self, state: Mapping[str, Any] | None) -> tuple[dict[str, str], dict[str, Any]]:
        round_state = state.get("round") if isinstance(state, Mapping) else None
        if isinstance(round_state, Mapping) and isinstance(round_state.get("source_hashes"), Mapping) and isinstance(round_state.get("corpus"), Mapping):
            return deepcopy(dict(round_state["source_hashes"])), deepcopy(dict(round_state["corpus"]))
        return deepcopy(_SOURCE_HASHES), deepcopy(CORPUS_MANIFEST)

    def _response(self, status: str, *, state: Mapping[str, Any] | None = None, **payload: Any) -> dict[str, Any]:
        source_hashes, corpus = self._context(state)
        return {
            "schema_version": SCHEMA_VERSION,
            "status": status,
            "candidate": deepcopy(self.candidate_identity),
            "source_hashes": source_hashes,
            "corpus": corpus,
            "claim_ceiling": CLAIM_CEILING,
            "limitations": list(LIMITATIONS),
            **({"state": deepcopy(dict(state))} if state is not None else {}),
            **payload,
        }

    def _error(self, code: str, message: str, status_code: int = 400, *, state: Mapping[str, Any] | None = None, **payload: Any) -> tuple[int, dict[str, Any]]:
        return status_code, self._response("BLOCKED", state=state, diagnostic={"code": code, "message": message}, **payload)

    def _candidate_is_current(self, request: Any) -> bool:
        return isinstance(request, Mapping) and request.get("candidate") == self.candidate_identity

    @staticmethod
    def _event(kind: str, sequence: int, payload: Mapping[str, Any], previous: str | None) -> dict[str, Any]:
        preimage = {"event_type": kind, "sequence": sequence, "previous_sha256": previous, "payload": dict(payload)}
        return {**preimage, "event_sha256": _hash(preimage)}

    @staticmethod
    def _append_event(round_state: dict[str, Any], kind: str, payload: Mapping[str, Any]) -> None:
        events = round_state["events"]
        previous = events[-1]["event_sha256"] if events else None
        events.append(SourcingRuntime._event(kind, len(events) + 1, payload, previous))

    def screen_name(self, name: str) -> dict[str, Any]:
        exact, suffix = _exact_name(name), _suffix_name(name)
        for entry in _CSL:
            if not entry["active"]:
                continue
            if exact == _exact_name(entry["name"]):
                return {"result": "exact", "listed_name": entry["name"], "program": entry["program"]}
            if suffix == _suffix_name(entry["name"]):
                return {"result": "suffix-normalized", "listed_name": entry["name"], "program": entry["program"]}
        return {"result": "no-candidate-match"}

    def _ownership_walk(self, root_name: str) -> tuple[dict[str, Any], bool, bool]:
        active: set[str] = set()

        def visit(name: str, pct: str | None = None) -> tuple[dict[str, Any], bool, bool]:
            if name in active:
                return {"name": name, "pct": pct, "screening": {"result": "abstained"}, "owners": [], "diagnostic": "OWNERSHIP_CYCLE"}, False, True
            screening = self.screen_name(name)
            if name not in _OWNERSHIP:
                return {"name": name, "pct": pct, "screening": screening, "owners": [], "diagnostic": "OWNERSHIP_UNKNOWN"}, screening["result"] != "no-candidate-match", True
            active.add(name)
            children, blocked, unknown = [], screening["result"] != "no-candidate-match", False
            for owner in _OWNERSHIP[name]:
                child, child_blocked, child_unknown = visit(owner["name"], owner["pct"])
                children.append(child)
                blocked, unknown = blocked or child_blocked, unknown or child_unknown
            active.remove(name)
            return {"name": name, "pct": pct, "screening": screening, "owners": children}, blocked, unknown

        return visit(root_name)

    @staticmethod
    def _landed_cost(offer: Mapping[str, Any], quantity: int, mode: str, source_label: str) -> dict[str, Any]:
        unit = Decimal(str(offer["unit_price_usd"]))
        goods = unit * quantity
        if offer["ship_from"] == "US" and offer["origin"] == "US":
            return {"rows": [{"layer": "goods", "amount_usd": _money(goods), "source": source_label}], "total_usd": _money(goods), "per_unit_usd": _money(unit), "assumptions": "declared domestic input; no import charges modeled"}
        base = goods * Decimal(_TARIFFS["base_rates"].get(offer["declared_hts"], "0"))
        origin = goods * Decimal(_TARIFFS["fixture_origin_adders"].get(offer["origin"], "0"))
        mpf = min(Decimal(_TARIFFS["mpf_max_usd"]), max(Decimal(_TARIFFS["mpf_min_usd"]), goods * Decimal(_TARIFFS["mpf_rate"])))
        freight = Decimal(_TARIFFS["freight_per_unit_usd"][mode]) * quantity
        total = goods + base + origin + mpf + freight
        rows = [
            {"layer": "goods", "amount_usd": _money(goods), "source": source_label},
            {"layer": "base-rate estimate", "amount_usd": _money(base), "source": f"fixture tariff {_TARIFFS['as_of']}"},
            {"layer": "origin-adder estimate", "amount_usd": _money(origin), "source": f"fixture origin {offer['origin']}"},
            {"layer": "merchandise-processing estimate", "amount_usd": _money(mpf), "source": "fixture MPF band"},
            {"layer": "freight estimate", "amount_usd": _money(freight), "source": f"fixture {mode} rate"},
        ]
        return {"rows": rows, "total_usd": _money(total), "per_unit_usd": _money(total / quantity), "assumptions": "declared bounded inputs plus fixture rates; no clearance inferred"}

    def _resolve_fixture_offer(self, offer: Mapping[str, Any], quantity: int, mode: str) -> dict[str, Any]:
        seller, blocked, unknown = self._ownership_walk(offer["seller"])
        manufacturer, m_blocked, m_unknown = None, False, False
        if offer["manufacturer"] != offer["seller"]:
            manufacturer, m_blocked, m_unknown = self._ownership_walk(offer["manufacturer"])
        disposition = "review-blocked" if blocked or m_blocked else "review-required" if unknown or m_unknown else "eligible-fixture"
        return {**dict(offer), "input_mode": "offline-demo", "screening_disposition": disposition, "ownership_walk": {"seller": seller, "manufacturer": manufacturer}, "landed_cost": self._landed_cost(offer, quantity, mode, "Offline demo offer")}

    @staticmethod
    def _live_evidence(raw: Any, role: str) -> tuple[dict[str, Any], str, bool, bool]:
        data = raw if isinstance(raw, Mapping) else {}
        status = data.get("status") if data.get("status") in {"NO_CANDIDATE_MATCH", "POTENTIAL_MATCH", "UNKNOWN"} else "UNKNOWN"
        source_name = data.get("source_name") if isinstance(data.get("source_name"), str) else ""
        source_text = data.get("source_text") if isinstance(data.get("source_text"), str) else ""
        checked_at = data.get("checked_at") if isinstance(data.get("checked_at"), str) else ""
        attestor = data.get("attestor") if isinstance(data.get("attestor"), str) else ""
        complete = data.get("complete") is True
        quarantined = bool(_INSTRUCTION.search(source_text))
        preimage = {"schema_version": "caddydaddy.screening-evidence/1", "role": role, "status": status, "source_name": source_name, "source_text": source_text, "checked_at": checked_at, "attestor": attestor, "complete": complete, "quarantined": quarantined}
        evidence = {**preimage, "source_sha256": _hash(preimage)}
        resolved = complete and all(item.strip() for item in (source_name, source_text, checked_at, attestor)) and not quarantined
        blocked = status == "POTENTIAL_MATCH"
        unknown = status == "UNKNOWN" or not resolved
        return evidence, "candidate-match" if blocked else "unknown" if unknown else "no-candidate-match", blocked, unknown

    def _derive_live_offers(self, raw_offers: Any, part_key: str, quantity: int, mode: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
        if not isinstance(raw_offers, list) or not 1 <= len(raw_offers) <= 50:
            raise ValueError("LIVE_OFFERS_INVALID")
        offers: list[dict[str, Any]] = []
        source_hashes: dict[str, str] = {}
        seen: set[str] = set()
        for raw in raw_offers:
            if not isinstance(raw, Mapping):
                raise ValueError("LIVE_OFFER_INVALID")
            keys = ("offer_id", "part_key", "seller", "manufacturer", "origin", "ship_from", "unit_price_usd", "declared_hts", "declared_eccn")
            if any(not isinstance(raw.get(key), str) or not str(raw[key]).strip() for key in keys):
                raise ValueError("LIVE_OFFER_INVALID")
            offer_id = str(raw["offer_id"]).strip()
            if offer_id in seen:
                raise ValueError("LIVE_OFFER_DUPLICATE")
            seen.add(offer_id)
            lead_days = raw.get("lead_days")
            if not isinstance(lead_days, int) or isinstance(lead_days, bool) or not 0 <= lead_days <= 3650:
                raise ValueError("LIVE_OFFER_INVALID")
            try:
                price = Decimal(str(raw["unit_price_usd"]))
            except InvalidOperation as exc:
                raise ValueError("LIVE_OFFER_INVALID") from exc
            if not price.is_finite() or not Decimal("0") <= price <= Decimal("100000000"):
                raise ValueError("LIVE_OFFER_INVALID")
            screening = raw.get("screening_evidence") if isinstance(raw.get("screening_evidence"), Mapping) else {}
            seller_ev, seller_result, seller_blocked, seller_unknown = self._live_evidence(screening.get("seller"), "seller")
            maker_ev, maker_result, maker_blocked, maker_unknown = self._live_evidence(screening.get("manufacturer"), "manufacturer")
            ownership_complete = screening.get("ownership_complete") is True
            blocked = seller_blocked or maker_blocked
            unknown = seller_unknown or maker_unknown or not ownership_complete
            disposition = "review-blocked" if blocked else "review-required" if unknown else "eligible-bounded"
            source_hashes[f"{offer_id}:seller"] = seller_ev["source_sha256"]
            source_hashes[f"{offer_id}:manufacturer"] = maker_ev["source_sha256"]
            offer = {key: str(raw[key]).strip() for key in keys}
            offer["unit_price_usd"] = _money(price)
            offer["lead_days"] = lead_days
            if offer["part_key"] != part_key:
                continue
            diagnostic = {"diagnostic": "OWNERSHIP_OR_SCREENING_INCOMPLETE"} if unknown else {}
            offer.update({
                "input_mode": "live-bounded",
                "screening_disposition": disposition,
                "screening_evidence": {"seller": seller_ev, "manufacturer": maker_ev, "ownership_complete": ownership_complete},
                "ownership_walk": {
                    "seller": {"name": offer["seller"], "pct": None, "screening": {"result": seller_result}, "owners": [], **diagnostic},
                    "manufacturer": None if offer["manufacturer"] == offer["seller"] else {"name": offer["manufacturer"], "pct": None, "screening": {"result": maker_result}, "owners": [], **diagnostic},
                },
                "landed_cost": self._landed_cost(offer, quantity, mode, "user-provided offer"),
            })
            offers.append(offer)
        return offers, source_hashes or {"live-offer-input": _hash(raw_offers)}

    @staticmethod
    def _live_corpus(raw_offers: list[Any], source_hashes: Mapping[str, str]) -> dict[str, Any]:
        preimage = {"schema_version": "caddydaddy.sourcing-input/1", "mode": "LIVE_BOUNDED_USER_INPUT", "offer_count": len(raw_offers), "screening_evidence_count": len(source_hashes), "source_hashes": dict(source_hashes), "coverage": "USER_PROVIDED_ONLY_NO_FULL_LIST_CLAIM"}
        return {**preimage, "corpus_sha256": _hash(preimage)}

    @staticmethod
    def _seal_state(round_state: Mapping[str, Any], dispatches: Mapping[str, Any] | None = None) -> dict[str, Any]:
        preimage = {"schema_version": STATE_SCHEMA_VERSION, "candidate": deepcopy(round_state["request"]["candidate"]), "round": deepcopy(dict(round_state)), "dispatches": deepcopy(dict(dispatches or {}))}
        return {**preimage, "seal_sha256": _hash(preimage)}

    @staticmethod
    def _validate_events(events: Any) -> bool:
        if not isinstance(events, list) or not events:
            return False
        previous = None
        for sequence, event in enumerate(events, start=1):
            if not isinstance(event, Mapping) or event.get("sequence") != sequence or event.get("previous_sha256") != previous or not isinstance(event.get("payload"), Mapping):
                return False
            preimage = {"event_type": event.get("event_type"), "sequence": sequence, "previous_sha256": previous, "payload": dict(event["payload"])}
            if event.get("event_sha256") != _hash(preimage):
                return False
            previous = event["event_sha256"]
        return True

    @staticmethod
    def _verify_package(package: Any, candidate: Mapping[str, str], round_id: str) -> tuple[bool, str | None]:
        if not isinstance(package, Mapping) or not isinstance(package.get("payload"), Mapping) or not isinstance(package.get("manifest"), Mapping):
            return False, "PACKAGE_MISSING"
        payload, manifest = package["payload"], package["manifest"]
        if payload.get("candidate") != candidate or payload.get("round_id") != round_id or manifest.get("candidate") != candidate or manifest.get("round_id") != round_id:
            return False, "PACKAGE_TAMPERED"
        payload_bytes, manifest_bytes = _canonical_bytes(payload), _canonical_bytes(manifest)
        if package.get("payload_sha256") != _sha256(payload_bytes) or package.get("payload_bytes") != len(payload_bytes) or package.get("manifest_sha256") != _sha256(manifest_bytes):
            return False, "PACKAGE_TAMPERED"
        if manifest.get("payload_sha256") != package.get("payload_sha256") or manifest.get("payload_bytes") != package.get("payload_bytes") or manifest.get("dispatch_ceiling") != "STAGED_ONLY":
            return False, "PACKAGE_TAMPERED"
        return True, None

    def _restore_state(self, request: Any) -> tuple[dict[str, Any] | None, tuple[int, dict[str, Any]] | None]:
        if not isinstance(request, Mapping) or not isinstance(request.get("state"), Mapping):
            return None, self._error("STATE_REQUIRED", "A client-carried sourcing state envelope is required for this follow-up.", 409)
        state = deepcopy(dict(request["state"]))
        if set(state) != {"schema_version", "candidate", "round", "dispatches", "seal_sha256"} or state.get("schema_version") != STATE_SCHEMA_VERSION or state.get("candidate") != self.candidate_identity:
            return None, self._error("STATE_IDENTITY_INVALID", "The sourcing state schema or candidate identity is invalid.", 409)
        preimage = {key: state[key] for key in ("schema_version", "candidate", "round", "dispatches")}
        if state.get("seal_sha256") != _hash(preimage):
            return None, self._error("STATE_TAMPERED", "The client-carried sourcing state failed its canonical SHA-256 seal.", 409)
        round_state = state.get("round")
        if not isinstance(round_state, Mapping) or not isinstance(state.get("dispatches"), Mapping) or not self._validate_events(round_state.get("events")):
            return None, self._error("STATE_INVALID", "The sourcing state structure or audit chain is invalid.", 409)
        round_state = dict(round_state)
        request_state = round_state.get("request")
        try:
            if not isinstance(request_state, Mapping) or request_state.get("candidate") != self.candidate_identity:
                raise ValueError
            part_key, quantity, mode = request_state["part_key"], request_state["quantity"], request_state["mode"]
            input_mode, raw_offers = round_state["input_mode"], round_state["raw_offers"]
            if not isinstance(part_key, str) or not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 10000 or mode not in {"air", "ocean"}:
                raise ValueError
            if input_mode == "offline-demo":
                if raw_offers != list(_OFFERS):
                    raise ValueError
                derived = [self._resolve_fixture_offer(offer, quantity, mode) for offer in _OFFERS if offer["part_key"] == part_key]
                source_hashes, corpus = _SOURCE_HASHES, CORPUS_MANIFEST
            elif input_mode == "live-bounded":
                derived, source_hashes = self._derive_live_offers(raw_offers, part_key, quantity, mode)
                corpus = self._live_corpus(raw_offers, source_hashes)
            else:
                raise ValueError
        except (KeyError, TypeError, ValueError, InvalidOperation):
            return None, self._error("STATE_INPUT_INVALID", "The sourcing state inputs cannot be revalidated.", 409)
        expected_request = {"candidate": self.candidate_identity, "part_key": part_key, "quantity": quantity, "mode": mode, "input_mode": input_mode, "raw_offers_sha256": _hash(raw_offers), "corpus_sha256": corpus["corpus_sha256"]}
        if round_state.get("round_id") != "round:" + _hash(expected_request) or request_state != expected_request or round_state.get("offers") != derived or round_state.get("source_hashes") != source_hashes or round_state.get("corpus") != corpus:
            return None, self._error("STATE_DERIVATION_MISMATCH", "The sourcing state does not match re-derived inputs and evidence.", 409)
        selected = round_state.get("selected_offer_id")
        if selected is not None and not any(offer["offer_id"] == selected and offer["screening_disposition"] in {"eligible-fixture", "eligible-bounded"} for offer in derived):
            return None, self._error("STATE_SELECTION_INVALID", "The carried selection is not eligible for bounded review.", 409)
        package = round_state.get("package")
        if package is not None:
            ok, code = self._verify_package(package, self.candidate_identity, round_state["round_id"])
            if not ok or selected is None:
                return None, self._error(code or "PACKAGE_TAMPERED", "The carried package failed semantic and byte-hash validation.", 409)
        for key, dispatch in state["dispatches"].items():
            if not isinstance(key, str) or not isinstance(dispatch, Mapping) or package is None or dispatch.get("manifest_sha256") != package.get("manifest_sha256") or dispatch.get("external_send") is not False or dispatch.get("network_calls") != 0:
                return None, self._error("STATE_DISPATCH_INVALID", "A carried dispatch record failed revalidation.", 409)
        return state, None

    def create_round(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        try:
            part_key, quantity, mode = request["part_key"], request["quantity"], request["mode"]
            input_mode = request.get("input_mode", "offline-demo")
            if not isinstance(part_key, str) or not part_key.strip() or not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 10000 or mode not in {"air", "ocean"} or input_mode not in {"offline-demo", "live-bounded"}:
                raise ValueError
            if input_mode == "offline-demo":
                raw_offers = deepcopy(list(_OFFERS))
                offers = [self._resolve_fixture_offer(offer, quantity, mode) for offer in _OFFERS if offer["part_key"] == part_key]
                source_hashes, corpus = deepcopy(_SOURCE_HASHES), deepcopy(CORPUS_MANIFEST)
            else:
                raw_offers = deepcopy(request.get("offers"))
                offers, source_hashes = self._derive_live_offers(raw_offers, part_key, quantity, mode)
                corpus = self._live_corpus(raw_offers, source_hashes)
        except (KeyError, TypeError, ValueError, InvalidOperation):
            return self._error("ROUND_REQUEST_INVALID", "Provide bounded quantity/mode plus valid live offers, or select the explicit Offline demo.")
        request_state = {"candidate": self.candidate_identity, "part_key": part_key, "quantity": quantity, "mode": mode, "input_mode": input_mode, "raw_offers_sha256": _hash(raw_offers), "corpus_sha256": corpus["corpus_sha256"]}
        round_id = "round:" + _hash(request_state)
        round_state = {"round_id": round_id, "input_mode": input_mode, "request": request_state, "raw_offers": raw_offers, "offers": offers, "source_hashes": source_hashes, "corpus": corpus, "events": [], "selected_offer_id": None, "adjudications": {}, "package": None}
        self._append_event(round_state, "ROUND_CREATED", {"round_id": round_id, "offer_ids": [offer["offer_id"] for offer in offers], "input_mode": input_mode})
        state = self._seal_state(round_state)
        return 200, self._response("READY", state=state, round=deepcopy(round_state))

    def adjudicate_offer(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state, error = self._restore_state(request)
        if error:
            return error
        assert state is not None
        round_state = state["round"]
        if request.get("round_id") != round_state["round_id"]:
            return self._error("ROUND_NOT_FOUND", "The sourcing round is not current.", 404, state=state)
        offer = next((item for item in round_state["offers"] if item["offer_id"] == request.get("offer_id")), None)
        if offer is None:
            return self._error("OFFER_NOT_FOUND", "The offer is not part of this immutable round.", 404, state=state)
        decision, attestor, rationale = request.get("decision"), request.get("attestor"), request.get("rationale")
        if decision not in {"HOLD", "REJECT", "ACCEPT_FOR_FIXTURE_REVIEW"} or not isinstance(attestor, str) or not attestor.strip() or not isinstance(rationale, str) or not rationale.strip():
            return self._error("ADJUDICATION_INVALID", "A bounded decision, attestor, and rationale are required.", state=state)
        adjudication = {"decision": decision, "attestor": attestor.strip(), "rationale": rationale.strip(), "does_not_change_screening": True}
        round_state["adjudications"][offer["offer_id"]] = adjudication
        self._append_event(round_state, "OFFER_ADJUDICATED", {"round_id": round_state["round_id"], "offer_id": offer["offer_id"], **adjudication})
        next_state = self._seal_state(round_state, state["dispatches"])
        return 200, self._response("RECORDED", state=next_state, round_id=round_state["round_id"], offer=deepcopy(offer), adjudication=deepcopy(adjudication), audit_events=deepcopy(round_state["events"]))

    def select_offer(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state, error = self._restore_state(request)
        if error:
            return error
        assert state is not None
        round_state = state["round"]
        if request.get("round_id") != round_state["round_id"]:
            return self._error("ROUND_NOT_FOUND", "The sourcing round is not current.", 404, state=state)
        offer = next((item for item in round_state["offers"] if item["offer_id"] == request.get("offer_id")), None)
        if offer is None:
            return self._error("OFFER_NOT_FOUND", "The offer is not part of this immutable round.", 404, state=state)
        if offer["screening_disposition"] not in {"eligible-fixture", "eligible-bounded"}:
            self._append_event(round_state, "OFFER_SELECTION_BLOCKED", {"round_id": round_state["round_id"], "offer_id": offer["offer_id"], "screening_disposition": offer["screening_disposition"]})
            next_state = self._seal_state(round_state, state["dispatches"])
            return self._error("BLOCKED_OFFER_SELECTION", "Blocked or unresolved offers remain visible but cannot be selected.", 409, state=next_state, offer=deepcopy(offer), audit_events=deepcopy(round_state["events"]))
        round_state["selected_offer_id"] = offer["offer_id"]
        self._append_event(round_state, "OFFER_SELECTED", {"round_id": round_state["round_id"], "offer_id": offer["offer_id"]})
        next_state = self._seal_state(round_state, state["dispatches"])
        return 200, self._response("SELECTED", state=next_state, round_id=round_state["round_id"], selected_offer=deepcopy(offer), offers=deepcopy(round_state["offers"]), audit_events=deepcopy(round_state["events"]))

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

    def build_package(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state, error = self._restore_state(request)
        if error:
            return error
        assert state is not None
        round_state = state["round"]
        if request.get("round_id") != round_state["round_id"] or not round_state["selected_offer_id"]:
            return self._error("SELECTION_REQUIRED", "A current eligible offer must be selected before packaging.", 409, state=state)
        offer = next(item for item in round_state["offers"] if item["offer_id"] == round_state["selected_offer_id"])
        payload = {"schema_version": "caddydaddy.staged-order-payload/1", "candidate": self.candidate_identity, "round_id": round_state["round_id"], "selected_offer": offer, "corpus_sha256": round_state["corpus"]["corpus_sha256"], "external_send_authorized": False}
        payload_bytes = _canonical_bytes(payload)
        payload_sha = _sha256(payload_bytes)
        payload_file = f"payload-{payload_sha}.json"
        manifest = {"schema_version": "caddydaddy.staged-order-manifest/1", "candidate": self.candidate_identity, "round_id": round_state["round_id"], "payload_file": payload_file, "payload_sha256": payload_sha, "payload_bytes": len(payload_bytes), "corpus_sha256": round_state["corpus"]["corpus_sha256"], "dispatch_ceiling": "STAGED_ONLY"}
        manifest_bytes = _canonical_bytes(manifest)
        manifest_sha = _sha256(manifest_bytes)
        manifest_file = f"manifest-{manifest_sha}.json"
        try:
            self._write_immutable(self._artifact_path(payload_file), payload_bytes)
            self._write_immutable(self._artifact_path(manifest_file), manifest_bytes)
            if self._artifact_path(payload_file).read_bytes() != payload_bytes or self._artifact_path(manifest_file).read_bytes() != manifest_bytes:
                raise OSError("reread mismatch")
        except OSError:
            return self._error("PACKAGE_WRITE_FAILED", "Optional local package materialization failed; no package was issued.", 409, state=state)
        package = {**manifest, "manifest_file": manifest_file, "manifest_sha256": manifest_sha, "byte_reread_verified": True, "payload": payload, "manifest": manifest, "continuity": "CLIENT_CARRIED_CANONICAL_BYTES"}
        round_state["package"] = package
        self._append_event(round_state, "PACKAGE_MATERIALIZED", {"round_id": round_state["round_id"], "manifest_sha256": manifest_sha, "byte_reread_verified": True})
        next_state = self._seal_state(round_state, state["dispatches"])
        return 200, self._response("PACKAGED", state=next_state, package=deepcopy(package), audit_events=deepcopy(round_state["events"]))

    def stage_dispatch(self, request: Any) -> tuple[int, dict[str, Any]]:
        if not self._candidate_is_current(request):
            return self._error("STALE_CANDIDATE", "Request candidate identity does not match the active immutable candidate.", 409)
        state, error = self._restore_state(request)
        if error:
            return error
        assert state is not None
        round_state, package = state["round"], state["round"]["package"]
        key = request.get("idempotency_key")
        if request.get("round_id") != round_state["round_id"] or package is None or not isinstance(key, str) or not key.strip() or request.get("manifest_sha256") != package["manifest_sha256"]:
            return self._error("DISPATCH_REQUEST_INVALID", "A current package manifest and non-empty idempotency key are required.", 409, state=state)
        ok, code = self._verify_package(package, self.candidate_identity, round_state["round_id"])
        if not ok:
            return self._error(code or "PACKAGE_TAMPERED", "Package canonical bytes failed dispatch-time revalidation.", 409)
        fingerprint = _hash({"candidate": self.candidate_identity, "round_id": round_state["round_id"], "manifest_sha256": package["manifest_sha256"]})
        existing = state["dispatches"].get(key.strip())
        if existing is not None:
            if existing.get("dispatch_id") != "staged:" + fingerprint:
                return self._error("IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to another staged package.", 409, state=state)
            return 200, self._response("STAGED", state=state, dispatch=deepcopy(existing))
        dispatch = {"dispatch_id": "staged:" + fingerprint, "idempotency_key": key.strip(), "manifest_sha256": package["manifest_sha256"], "external_send": False, "network_calls": 0}
        state["dispatches"][key.strip()] = dispatch
        self._append_event(round_state, "ORDER_DISPATCH_STAGED", {"round_id": round_state["round_id"], "dispatch_id": dispatch["dispatch_id"], "external_send": False})
        next_state = self._seal_state(round_state, state["dispatches"])
        return 200, self._response("STAGED", state=next_state, dispatch=deepcopy(dispatch), audit_events=deepcopy(round_state["events"]))


def create_fastapi_router(runtime: SourcingRuntime) -> Any | None:
    try:
        from fastapi import APIRouter
        from fastapi.responses import JSONResponse
    except ImportError:
        return None
    router = APIRouter(prefix="/api/sourcing", tags=["sourcing-bounded"])

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
