"""Schema-neutral command idempotency claims."""

from __future__ import annotations

from typing import Any, Dict, Optional, Sequence

from .errors import DiagnosticError, require
from .events import AppendOnlyEventLog, EventTransaction, HistoryEvent


class IdempotencyLedger:
    EVENT_TYPE = "IDEMPOTENCY_KEY_CLAIMED"

    def __init__(self, log: AppendOnlyEventLog) -> None:
        self.log = log

    @classmethod
    def _lookup(
        cls,
        events: Sequence[HistoryEvent],
        scope: str,
        key: str,
    ) -> Optional[HistoryEvent]:
        found = [
            event
            for event in events
            if event.value["event_type"] == cls.EVENT_TYPE
            and event.value["payload"]["scope"] == scope
            and event.value["payload"]["idempotency_key"] == key
        ]
        if len(found) > 1:
            hashes = {event.value["payload"]["command_hash"] for event in found}
            if len(hashes) > 1:
                raise DiagnosticError("IDEMPOTENCY_CONFLICT", "event history contains conflicting key claims")
            raise DiagnosticError("IDEMPOTENCY_DUPLICATE_CLAIM", "event history contains duplicate key claims")
        return found[0] if found else None

    def lookup(self, scope: str, key: str) -> Optional[HistoryEvent]:
        return self._lookup(self.log.read_all(), scope, key)

    def claim(
        self,
        scope: str,
        key: str,
        command_id: str,
        command_hash: str,
        actor_provenance: Dict[str, Any],
        occurred_at: str,
    ) -> HistoryEvent:
        for value, code, name in (
            (scope, "IDEMPOTENCY_SCOPE_INVALID", "scope"),
            (key, "IDEMPOTENCY_KEY_INVALID", "idempotency key"),
            (command_id, "COMMAND_ID_INVALID", "command ID"),
            (command_hash, "COMMAND_HASH_INVALID", "command hash"),
        ):
            require(isinstance(value, str) and bool(value), code, "{0} is required".format(name))
        def claim_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            existing = self._lookup(transaction.events, scope, key)
            if existing is not None:
                payload = existing.value["payload"]
                if payload["command_hash"] != command_hash or payload["command_id"] != command_id:
                    raise DiagnosticError(
                        "IDEMPOTENCY_CONFLICT",
                        "idempotency key is already bound to a different command",
                        details={"scope": scope, "idempotency_key": key},
                    )
                return existing
            return transaction.append(
                self.EVENT_TYPE,
                "IDEMPOTENCY_KEY",
                scope + ":" + key,
                occurred_at,
                actor_provenance,
                {
                    "scope": scope,
                    "idempotency_key": key,
                    "command_id": command_id,
                    "command_hash": command_hash,
                },
            )

        return self.log.transact(claim_in_transaction)
