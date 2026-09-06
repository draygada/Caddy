"""The round: one attempt to buy every part of one exact design state."""
from __future__ import annotations

from .hashing import sha256

STATUS_ORDER = ["opened", "offers_resolved", "screened", "costed", "selection_confirmed", "gated", "package_ready"]
STATUS_LABEL = {"opened": "opened", "offers_resolved": "offers", "screened": "screened", "costed": "costed",
                "selection_confirmed": "selected", "gated": "gated", "package_ready": "packaged", "superseded": "superseded"}
SHIP_TO = {
    "US-bench": {"country": "US", "label": "United States prototype bench"},
    "TW-assembly": {"country": "TW", "label": "Taiwan assembly site"},
    "DE-assembly": {"country": "DE", "label": "Germany assembly site"},
    "CA-assembly": {"country": "CA", "label": "Canada assembly site"},
}


class RoundRefused(ValueError):
    pass


def request_key_hash(design_hash: str, ship_to: str, quantity: int, request_key: str) -> str:
    return sha256({"design_hash": design_hash, "ship_to": ship_to, "quantity": quantity, "request_key": request_key})


def new_round(design: dict, *, ship_to: str, quantity: int, transport_mode: str, request_key: str,
              opened_at: str, fixture_shas: dict, assembly_country: str | None = None) -> dict:
    if ship_to not in SHIP_TO:
        raise RoundRefused(f"unknown ship-to {ship_to}")
    if transport_mode not in ("air", "ocean", "truck"):
        raise RoundRefused(f"unknown transport mode {transport_mode}")
    if quantity < 1:
        raise RoundRefused("quantity must be at least 1")
    key = request_key_hash(design["design_hash"], ship_to, quantity, request_key)
    lines = []
    for node in design["nodes"]:
        lines.append({
            "line_id": f"line:{node['node_id']}",
            "node_id": node["node_id"], "slot": node.get("slot"), "mpn": node["mpn"], "manufacturer": node.get("manufacturer"),
            "description": node.get("description"), "origin": node.get("origin"), "origin_note": node.get("origin_note"),
            "part_class": node.get("part_class"), "item_kind": node.get("item_kind", "commodity"),
            "quantity_per": node.get("quantity_per", 1), "quantity": node.get("quantity_per", 1) * quantity,
            "value_usd": node.get("value_usd"), "evaluation": node["evaluation"],
            "offers": [], "escalations": [], "selection": None, "gate": None,
        })
    return {
        "round_id": f"round:{key}", "request_key_hash": key,
        "design_hash": design["design_hash"], "design_seq": design["design_seq"],
        "product": design.get("product", {}),
        "ship_to": ship_to, "destination_country": SHIP_TO[ship_to]["country"], "ship_to_label": SHIP_TO[ship_to]["label"],
        "quantity": quantity, "transport_mode": transport_mode,
        "assembly_country": assembly_country or design.get("product", {}).get("final_assembly_country", "US"),
        "defaults_note": "ship-to, transport mode, quantity and assembly country are round defaults, refinable per offer and per shipment; a refinement re-runs screening and cost for the affected lines and records provenance and staleness",
        "opened_at": opened_at, "status": "opened", "supersedes": None, "superseded_by": None,
        "fixture_shas": dict(fixture_shas), "lines": lines, "refinements": [], "declarations": [], "package": None,
    }


def transition(rnd: dict, to: str) -> None:
    """Compare-and-swap on status: only the next state in order, or a re-run of the same stage."""
    cur = rnd["status"]
    if cur == "superseded":
        raise RoundRefused(f"round {rnd['round_id'][:20]} is superseded")
    if to == cur:
        return
    if to == "gated" and cur == "selection_confirmed":
        rnd["status"] = to
        return
    if to == "package_ready" and cur in ("gated", "selection_confirmed"):
        rnd["status"] = to
        return
    i, j = STATUS_ORDER.index(cur), STATUS_ORDER.index(to)
    if j == i + 1:
        rnd["status"] = to
        return
    if j < i and to in ("offers_resolved", "screened", "costed"):
        return  # a re-run of an earlier stage on a live round keeps the later status
    raise RoundRefused(f"cannot move round from {cur} to {to}")
