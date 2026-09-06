"""Exactly-once mechanics for a disposable local synthetic dispatch sink."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .actors import require_human, validate_actor
from .canonical import digest_json
from .errors import DiagnosticError, require
from .events import AppendOnlyEventLog, EventTransaction, HistoryEvent


ATTEMPTED = "LOCAL_DISPATCH_ATTEMPTED"
EFFECT_WRITTEN = "LOCAL_DISPATCH_EFFECT_WRITTEN"
OUTCOME_UNKNOWN = "LOCAL_DISPATCH_OUTCOME_UNKNOWN"
RECONCILED = "LOCAL_DISPATCH_RECONCILED"
EXCEPTION_RECORDED = "LOCAL_DISPATCH_EXCEPTION_RECORDED"


class SimulatedDispatchInterruption(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class DispatchOutcome:
    effect_id: str
    idempotency_key: str
    attempt_count: int
    duplicate: bool


class SyntheticDispatchJournal:
    """A local-only adapter that records one effect per idempotency key."""

    def __init__(self, log: AppendOnlyEventLog, adapter_id: str = "synthetic.local/1") -> None:
        self.log = log
        self.adapter_id = adapter_id

    @staticmethod
    def _events_from(events: Sequence[HistoryEvent], key: str) -> List[HistoryEvent]:
        return [
            event
            for event in events
            if event.value["event_type"]
            in {ATTEMPTED, EFFECT_WRITTEN, OUTCOME_UNKNOWN, RECONCILED, EXCEPTION_RECORDED}
            and event.value["payload"].get("idempotency_key") == key
        ]

    def _events(self, key: str) -> List[HistoryEvent]:
        return self._events_from(self.log.read_all(), key)

    def _validate_request(self, request: Dict[str, Any]) -> None:
        required = {
            "idempotency_key",
            "command_hash",
            "packet_ref",
            "recipient_id",
            "external",
            "authorization_id",
            "authorization_state",
            "authorizer",
        }
        missing = sorted(required - set(request.keys()))
        require(not missing, "DISPATCH_REQUEST_INVALID", "dispatch request is missing fields", missing=missing)
        require(request["external"] is False, "EXTERNAL_SEND_FORBIDDEN", "synthetic adapter cannot perform an external send")
        require(
            isinstance(request["recipient_id"], str) and request["recipient_id"].startswith("synthetic:"),
            "RECIPIENT_NOT_SYNTHETIC",
            "local proof requires a synthetic recipient",
        )
        require(request["authorization_state"] == "AUTHORIZED", "DISPATCH_NOT_AUTHORIZED", "dispatch requires an authorized receipt")
        require_human(request["authorizer"], "local synthetic dispatch authorization")
        for key in ("idempotency_key", "command_hash", "packet_ref", "authorization_id"):
            require(isinstance(request[key], str) and bool(request[key]), "DISPATCH_REQUEST_INVALID", "dispatch identity fields are required", path="$.{0}".format(key))

    @staticmethod
    def _effect_from(events: Sequence[HistoryEvent]) -> Optional[HistoryEvent]:
        effects = [event for event in events if event.value["event_type"] == EFFECT_WRITTEN]
        if len(effects) > 1:
            raise DiagnosticError("DUPLICATE_DISPATCH_EFFECT", "more than one effect exists for an idempotency key")
        return effects[0] if effects else None

    def _effect(self, key: str) -> Optional[HistoryEvent]:
        return self._effect_from(self._events(key))

    @staticmethod
    def _attempt_count_from(events: Sequence[HistoryEvent]) -> int:
        return sum(1 for event in events if event.value["event_type"] == ATTEMPTED)

    def _attempt_count(self, key: str) -> int:
        return self._attempt_count_from(self._events(key))

    @staticmethod
    def _assert_key_consistency(request: Dict[str, Any], events: Sequence[HistoryEvent]) -> None:
        command_hashes = {
            event.value["payload"]["command_hash"]
            for event in events
            if "command_hash" in event.value["payload"]
        }
        if command_hashes and command_hashes != {request["command_hash"]}:
            raise DiagnosticError("IDEMPOTENCY_CONFLICT", "idempotency key was reused for a different command")

    @staticmethod
    def _has_unreconciled_unknown(events: Sequence[HistoryEvent]) -> bool:
        unknown_sequences = [event.sequence for event in events if event.value["event_type"] == OUTCOME_UNKNOWN]
        if not unknown_sequences:
            return False
        reconciled_unknowns = {
            event.value["payload"]["unknown_event_id"]
            for event in events
            if event.value["event_type"] == RECONCILED
        }
        for event in events:
            if event.value["event_type"] == OUTCOME_UNKNOWN and event.event_id not in reconciled_unknowns:
                return True
        return False

    def dispatch(
        self,
        request: Dict[str, Any],
        actor: Dict[str, Any],
        occurred_at: str,
        fault: Optional[str] = None,
    ) -> DispatchOutcome:
        self._validate_request(request)
        checked_actor = validate_actor(actor)
        provenance = {
            "actor_id": checked_actor["actor_id"],
            "actor_kind": checked_actor["actor_kind"],
            "source_ref": "adapter:" + self.adapter_id,
        }

        def perform(transaction: EventTransaction) -> Tuple[Optional[DispatchOutcome], Optional[str]]:
            key_events = self._events_from(transaction.events, request["idempotency_key"])
            self._assert_key_consistency(request, key_events)
            existing = self._effect_from(key_events)
            if existing is not None:
                return (
                    DispatchOutcome(
                        effect_id=existing.value["payload"]["effect_id"],
                        idempotency_key=request["idempotency_key"],
                        attempt_count=self._attempt_count_from(key_events),
                        duplicate=True,
                    ),
                    None,
                )
            if self._has_unreconciled_unknown(key_events):
                raise DiagnosticError(
                    "DISPATCH_RECONCILIATION_REQUIRED",
                    "unknown dispatch outcome must be reconciled before retry",
                )

            attempt_number = self._attempt_count_from(key_events) + 1
            common = {
                "adapter_id": self.adapter_id,
                "idempotency_key": request["idempotency_key"],
                "command_hash": request["command_hash"],
                "packet_ref": request["packet_ref"],
                "recipient_id": request["recipient_id"],
                "authorization_id": request["authorization_id"],
                "attempt_number": attempt_number,
            }
            transaction.append(
                ATTEMPTED,
                "LOCAL_DISPATCH",
                request["idempotency_key"],
                occurred_at,
                provenance,
                dict(common),
            )
            if fault == "CRASH_BEFORE_EFFECT":
                return None, "CRASH_BEFORE_EFFECT"
            if fault == "TIMEOUT_BEFORE_EFFECT":
                unknown = transaction.append(
                    OUTCOME_UNKNOWN,
                    "LOCAL_DISPATCH",
                    request["idempotency_key"],
                    occurred_at,
                    provenance,
                    dict(common),
                )
                return None, "TIMEOUT_BEFORE_EFFECT:" + unknown.event_id

            effect_id = "effect:" + digest_json(
                {
                    "adapter_id": self.adapter_id,
                    "idempotency_key": request["idempotency_key"],
                    "command_hash": request["command_hash"],
                    "packet_ref": request["packet_ref"],
                    "recipient_id": request["recipient_id"],
                }
            )
            effect_payload = dict(common)
            effect_payload["effect_id"] = effect_id
            transaction.append(
                EFFECT_WRITTEN,
                "LOCAL_DISPATCH",
                request["idempotency_key"],
                occurred_at,
                provenance,
                effect_payload,
            )
            if fault == "LOST_RESPONSE_AFTER_EFFECT":
                return None, "LOST_RESPONSE_AFTER_EFFECT"
            if fault == "EXCEPTION_AFTER_EFFECT":
                exception_payload = dict(effect_payload)
                exception_payload["reason_code"] = "SYNTHETIC_EXCEPTION"
                transaction.append(
                    EXCEPTION_RECORDED,
                    "LOCAL_DISPATCH",
                    request["idempotency_key"],
                    occurred_at,
                    provenance,
                    exception_payload,
                )
                return None, "EXCEPTION_AFTER_EFFECT"
            return DispatchOutcome(effect_id, request["idempotency_key"], attempt_number, False), None

        outcome, interruption = self.log.transact(perform)
        if interruption is not None:
            raise SimulatedDispatchInterruption(interruption)
        require(outcome is not None, "DISPATCH_OUTCOME_INVALID", "dispatch transaction returned no outcome")
        return outcome

    def reconcile(
        self,
        idempotency_key: str,
        actor: Dict[str, Any],
        occurred_at: str,
    ) -> HistoryEvent:
        checked_actor = validate_actor(actor)

        def reconcile_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            key_events = self._events_from(transaction.events, idempotency_key)
            unknowns = [event for event in key_events if event.value["event_type"] == OUTCOME_UNKNOWN]
            require(bool(unknowns), "DISPATCH_UNKNOWN_NOT_FOUND", "no unknown dispatch outcome exists")
            reconciled = {
                event.value["payload"]["unknown_event_id"]
                for event in key_events
                if event.value["event_type"] == RECONCILED
            }
            unresolved = [event for event in unknowns if event.event_id not in reconciled]
            require(bool(unresolved), "DISPATCH_ALREADY_RECONCILED", "unknown outcome was already reconciled")
            effect = self._effect_from(key_events)
            return transaction.append(
                RECONCILED,
                "LOCAL_DISPATCH",
                idempotency_key,
                occurred_at,
                {
                    "actor_id": checked_actor["actor_id"],
                    "actor_kind": checked_actor["actor_kind"],
                    "source_ref": "adapter:" + self.adapter_id,
                },
                {
                    "adapter_id": self.adapter_id,
                    "idempotency_key": idempotency_key,
                    "unknown_event_id": unresolved[0].event_id,
                    "effect_observed": effect is not None,
                    "effect_id": effect.value["payload"]["effect_id"] if effect else None,
                },
            )

        return self.log.transact(reconcile_in_transaction)
