"""Selection with declined offers, and adjudication of screening matches. Both are human, attested, append-only."""
from __future__ import annotations

from .hashing import sha256

REASON_CODES = ("price", "lead_time", "quality", "owner_screened", "ownership_unknown", "origin", "export_gate", "other")
ROLES = {"analyst": ("false_positive",), "empowered_official": ("false_positive", "resolved", "escalate")}


class SelectionRefused(ValueError):
    pass


class AdjudicationRefused(ValueError):
    pass


def default_reason(card: dict) -> str:
    status = (card.get("screening") or {}).get("status")
    if status == "review_blocked":
        return "owner_screened"
    if status == "review_required":
        tree = card.get("party_tree") or {}
        if any(n.get("ownership") == "unknown" for n in tree.get("nodes", [])):
            return "ownership_unknown"
        return "owner_screened"
    return "price"


def build_selection(rnd: dict, line: dict, offer_hash: str, declined: list[dict], attestor: str, seq: int) -> dict:
    cards = {c["offer_hash"]: c for c in line["offers"]}
    card = cards.get(offer_hash)
    if card is None:
        raise SelectionRefused(f"offer {offer_hash[:8]} is not on line {line['line_id']}")
    status = (card.get("screening") or {}).get("status")
    if status == "review_blocked":
        raise SelectionRefused(f"offer {offer_hash[:8]} is review blocked: {card['screening'].get('worst_node')}; a blocked offer cannot be selected")
    est = card.get("estimate")
    if est is None:
        raise SelectionRefused("offer has no estimate; run cost first")
    if est["tariff_fixture_sha"] != rnd["fixture_shas"]["tariff"]:
        raise SelectionRefused("estimate rests on a stale tariff fixture; recompute before selecting")
    if sha256(card["offer"]) != offer_hash:
        raise SelectionRefused("bound offer failed hash re-verification")
    if not attestor:
        raise SelectionRefused("a selection needs a human attestor")
    ev = line["evaluation"]
    recorded = []
    for d in declined:
        other = cards.get(d.get("offer_hash"))
        if other is None or other is card:
            raise SelectionRefused("declined offers must be other offers shown on the same line")
        code = d.get("reason_code") or default_reason(other)
        if code not in REASON_CODES:
            raise SelectionRefused(f"unknown reason_code {code!r}; one of {REASON_CODES}")
        recorded.append({
            "offer_hash": other["offer_hash"], "seller": other["offer"]["seller"].get("display", other["offer"]["seller"]["name"]),
            "unit_price_usd": other["offer"].get("unit_price_usd"), "reason_code": code, "reason_text": d.get("reason_text"),
            "status_at_decline": (other.get("screening") or {}).get("status"),
            "classification_state_at_decline": {"jurisdiction": ev["jurisdiction"], "entries": list(ev["entries"])},
        })
    shown = {c["offer_hash"] for c in line["offers"]} - {offer_hash}
    missing = shown - {d["offer_hash"] for d in recorded}
    if missing:
        raise SelectionRefused("every shown-and-not-chosen offer must be declined with a reason: missing " + ", ".join(h[:8] for h in missing))
    previous = line.get("selection")
    body = {"line_id": line["line_id"], "offer_hash": offer_hash, "declined": recorded, "attestor": attestor,
            "predecessor": previous["selection_id"] if previous else None, "seq": seq,
            "status_at_selection": status, "classification_state_at_selection": {"jurisdiction": ev["jurisdiction"], "entries": list(ev["entries"])}}
    body["selection_id"] = "selection:" + sha256(body)
    return body


def build_adjudication(round_id: str, offer_hash: str, node: dict, *, role: str, disposition: str, reason_code: str,
                       rationale: str, attestor: str, seq: int) -> dict:
    if role not in ROLES:
        raise AdjudicationRefused(f"unknown role {role!r}; one of {tuple(ROLES)}")
    if disposition not in ROLES[role]:
        raise AdjudicationRefused(f"role {role} may not record {disposition!r}; allowed {ROLES[role]}")
    run = node.get("run") or {}
    if run.get("match_kind") not in ("exact", "normalized"):
        raise AdjudicationRefused(f"party {node['name']} has no match to adjudicate")
    if not (reason_code and rationale and attestor):
        raise AdjudicationRefused("reason_code, rationale and attestor are mandatory")
    body = {"round_id": round_id, "offer_hash": offer_hash, "party_id": node["party_id"], "party": node["name"], "role": role,
            "disposition": disposition, "reason_code": reason_code, "rationale": rationale, "attestor": attestor,
            "list_snapshot_sha": run["snapshot_sha"], "entries": run["entries"], "seq": seq}
    body["adjudication_id"] = "adjudication:" + sha256(body)
    return body
