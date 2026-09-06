"""The product thread, sourcing side: append-only, hash-chained events.

Signing (Ed25519) belongs to the platform log module; this lane chains and re-derives, and says so.
"""
from __future__ import annotations

from copy import deepcopy

from .hashing import sha256

PROPOSAL_SUFFIX = "_proposed"
TERMINAL_KINDS = {
    "offer_selected", "match_adjudicated", "technical_data_declared", "escalation_resolved",
    "rule_pack_committed", "intent_memo_signed", "order_dispatched", "swap_confirmed",
}
GENESIS = "0" * 64


class ThreadRefused(ValueError):
    pass


class Thread:
    def __init__(self):
        self.events: list[dict] = []
        self.signing = "unsigned in this lane (hash chain only); Ed25519 signing belongs to the log module"

    @property
    def head(self) -> dict:
        if not self.events:
            return {"seq": 0, "hash": GENESIS}
        e = self.events[-1]
        return {"seq": e["seq"], "hash": e["hash"]}

    def append(self, kind: str, actor_kind: str, payload: dict, *, attestor: str | None = None) -> dict:
        if actor_kind not in ("human", "agent", "system"):
            raise ThreadRefused(f"unknown actor_kind {actor_kind}")
        if actor_kind == "agent" and not kind.endswith(PROPOSAL_SUFFIX):
            raise ThreadRefused(f"an agent may only write *{PROPOSAL_SUFFIX} events, not {kind}")
        if kind in TERMINAL_KINDS and (actor_kind != "human" or not attestor):
            raise ThreadRefused(f"{kind} is terminal: it needs actor_kind=human and an attestor")
        prev = self.head["hash"]
        event = {"seq": len(self.events) + 1, "kind": kind, "actor_kind": actor_kind, "attestor": attestor,
                 "prev_hash": prev, **deepcopy(payload)}
        event["hash"] = sha256({"prev": prev, "event": {k: v for k, v in event.items() if k != "hash"}})
        self.events.append(event)
        return {"seq": event["seq"], "hash": event["hash"]}

    def verify_chain(self) -> tuple[bool, int | None]:
        prev = GENESIS
        for e in self.events:
            expected = sha256({"prev": prev, "event": {k: v for k, v in e.items() if k != "hash"}})
            if e["prev_hash"] != prev or e["hash"] != expected:
                return False, e["seq"]
            prev = e["hash"]
        return True, None

    def tamper(self, seq: int, field: str, value) -> None:
        """Demo only: edit one stored field in place so re-derive can show the break."""
        event = self.events[seq - 1]
        target = event
        parts = field.split(".")
        for p in parts[:-1]:
            target = target[int(p)] if isinstance(target, list) else target[p]
        last = parts[-1]
        if isinstance(target, list):
            target[int(last)] = value
        else:
            target[last] = value

    def of_kind(self, kind: str, round_id: str | None = None) -> list[dict]:
        return [e for e in self.events if e["kind"] == kind and (round_id is None or e.get("round_id") == round_id)]
