"""Order send-off: a packet from the approved revision only, dispatched exactly once through a synthetic adapter."""
from __future__ import annotations

from .hashing import sha256

LABEL = "SYNTHETIC"


class OrderRefused(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code


def create_packet(rnd: dict, *, recipient_placeholder: str, approver: dict, current_design_hash: str, created_at: str) -> dict:
    if rnd["design_hash"] != current_design_hash or rnd["status"] == "superseded":
        raise OrderRefused("STALE_REVISION", "the round's design hash is not the log head's; open a new round")
    if rnd["status"] != "package_ready" or not rnd.get("package"):
        raise OrderRefused("UNAPPROVED_ROUND", "no packet from a round without a built package")
    if not recipient_placeholder:
        raise OrderRefused("NO_RECIPIENT", "no inferred recipient: a placeholder must be typed")
    if not approver or not approver.get("identity") or not approver.get("authority_basis"):
        raise OrderRefused("NO_APPROVER", "approver identity and authority basis are required")
    bom = []
    for line in rnd["lines"]:
        sel = line["selection"]
        card = next(c for c in line["offers"] if c["offer_hash"] == sel["offer_hash"])
        bom.append({"line_id": line["line_id"], "mpn": line["mpn"], "quantity": line["quantity"],
                    "seller": card["offer"]["seller"]["name"], "offer_hash": sel["offer_hash"], "selection_id": sel["selection_id"]})
    packet = {
        "order_type": "purchase_order (synthetic)", "label": LABEL,
        "source_project": rnd["product"].get("node_id"), "approved_revision": {"design_hash": rnd["design_hash"], "design_seq": rnd["design_seq"], "round_id": rnd["round_id"]},
        "bom_lines": bom, "recipient": {"placeholder": recipient_placeholder, "destination": rnd["destination_country"], "inferred": False},
        "attachments": [{"name": k, "sha256": v} for k, v in rnd["package"]["artefacts"].items()],
        "terms_or_process_notes": "synthetic demo packet; no real supplier communication under any authority available here",
        "approver": {"identity": approver["identity"], "authority_basis": approver["authority_basis"]},
        "idempotency_key": None, "adapter": {"identity": "synthetic", "environment": "demo"},
        "dispatch_timestamp": None, "provider_response_id": None, "acknowledgement_state": "not dispatched", "exception_state": None,
        "receiving_record": None, "inspection_result": None, "closeout_state": "open", "audit_evidence": [], "created_at": created_at,
    }
    packet["packet_id"] = "packet:" + sha256({k: v for k, v in packet.items() if k not in ("idempotency_key", "dispatch_timestamp", "provider_response_id", "acknowledgement_state", "exception_state", "receiving_record", "inspection_result", "closeout_state", "audit_evidence")})
    return packet


def synthetic_dispatch(packet: dict, idempotency_key: str, dispatched_at: str) -> dict:
    """The synthetic adapter: deterministic acknowledgement, or an exception when the placeholder asks for one."""
    if "EXCEPTION" in packet["recipient"]["placeholder"]:
        return {"adapter": "synthetic", "environment": "demo", "label": LABEL, "idempotency_key": idempotency_key,
                "provider_response_id": "synthetic-exc-" + sha256({"k": idempotency_key})[:12], "state": "exception",
                "exception": "synthetic adapter: recipient placeholder asked for the failure path", "dispatched_at": dispatched_at}
    return {"adapter": "synthetic", "environment": "demo", "label": LABEL, "idempotency_key": idempotency_key,
            "provider_response_id": "synthetic-ack-" + sha256({"k": idempotency_key, "p": packet["packet_id"]})[:12], "state": "acknowledged",
            "exception": None, "dispatched_at": dispatched_at}
