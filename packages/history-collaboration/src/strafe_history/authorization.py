"""Append-only authorization lifecycle with human/agent separation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from .actors import require_human, validate_actor
from .errors import DiagnosticError, require
from .events import AppendOnlyEventLog, EventTransaction, HistoryEvent


AUTHORIZATION_STATES = {"REQUESTED", "AUTHORIZED", "APPLIED", "VERIFIED", "REJECTED", "ROLLED_BACK"}
_TRANSITIONS = {
    None: {"REQUESTED"},
    "REQUESTED": {"AUTHORIZED", "REJECTED"},
    "AUTHORIZED": {"APPLIED", "REJECTED"},
    "APPLIED": {"VERIFIED", "ROLLED_BACK"},
    "VERIFIED": {"ROLLED_BACK"},
    "REJECTED": set(),
    "ROLLED_BACK": set(),
}


class AuthorizationLedger:
    """Stores every lifecycle observation as its own immutable history event."""

    EVENT_TYPE = "AUTHORIZATION_LIFECYCLE_RECORDED"

    def __init__(self, log: AppendOnlyEventLog) -> None:
        self.log = log

    @classmethod
    def _receipts(cls, events: Sequence[HistoryEvent], authorization_id: str) -> List[HistoryEvent]:
        return [
            event
            for event in events
            if event.value["event_type"] == cls.EVENT_TYPE
            and event.value["aggregate_id"] == authorization_id
        ]

    def receipts(self, authorization_id: str) -> List[HistoryEvent]:
        return self._receipts(self.log.read_all(), authorization_id)

    def state(self, authorization_id: str) -> Optional[str]:
        found = self.receipts(authorization_id)
        return found[-1].value["payload"]["state"] if found else None

    def append(
        self,
        authorization_id: str,
        state: str,
        actor: Dict[str, Any],
        occurred_at: str,
        source_ref: str,
        subject: Dict[str, str],
        evidence_refs: Optional[List[str]] = None,
    ) -> HistoryEvent:
        checked_actor = validate_actor(actor)
        require(state in AUTHORIZATION_STATES, "AUTHORIZATION_STATE_INVALID", "unsupported authorization state")
        if state in {"AUTHORIZED", "REJECTED", "ROLLED_BACK"}:
            require_human(checked_actor, state.lower())
        require(isinstance(subject, dict), "AUTHORIZATION_SUBJECT_INVALID", "authorization subject must be an object")
        require(isinstance(subject.get("kind"), str) and bool(subject["kind"]), "AUTHORIZATION_SUBJECT_INVALID", "subject kind is required")
        require(isinstance(subject.get("id"), str) and bool(subject["id"]), "AUTHORIZATION_SUBJECT_INVALID", "subject id is required")
        if state == "VERIFIED":
            require(bool(evidence_refs), "VERIFICATION_EVIDENCE_MISSING", "verification requires evidence references")
        event_provenance: Dict[str, Any] = {
            "actor_id": checked_actor["actor_id"],
            "actor_kind": checked_actor["actor_kind"],
            "source_ref": source_ref,
        }
        if checked_actor["actor_kind"] == "AGENT":
            event_provenance["agent_execution_identity"] = checked_actor["execution_identity"]

        def append_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            receipts = self._receipts(transaction.events, authorization_id)
            current = receipts[-1].value["payload"]["state"] if receipts else None
            allowed = _TRANSITIONS[current]
            require(
                state in allowed,
                "AUTHORIZATION_TRANSITION_INVALID",
                "authorization lifecycle transition is not permitted",
                current=current,
                requested=state,
            )
            return transaction.append(
                event_type=self.EVENT_TYPE,
                aggregate_type="AUTHORIZATION",
                aggregate_id=authorization_id,
                occurred_at=occurred_at,
                provenance=event_provenance,
                payload={
                    "state": state,
                    "subject": dict(subject),
                    "evidence_refs": list(evidence_refs or []),
                },
            )

        return self.log.transact(append_in_transaction)
