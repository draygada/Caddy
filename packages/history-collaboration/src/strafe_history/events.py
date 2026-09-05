"""Append-only, hash-chained history events.

The log is deliberately generic.  Domain services choose event types and validate
their payloads; this module only guarantees canonical bytes, ordering, provenance
presence, and tamper-evident linkage.
"""

from __future__ import annotations

import copy
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from .canonical import canonical_bytes, digest_json, parse_json
from .errors import DiagnosticError, require
from .safety import validate_persistence_safety


_UTC_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$")
_EVENT_PROTOCOL = "forge.history-event/1"


@dataclass(frozen=True)
class HistoryEvent:
    value: Dict[str, Any]

    @property
    def event_id(self) -> str:
        return self.value["event_id"]

    @property
    def event_hash(self) -> str:
        return self.value["event_hash"]

    @property
    def sequence(self) -> int:
        return self.value["sequence"]


def _event_preimage(value: Dict[str, Any]) -> Dict[str, Any]:
    return {key: copy.deepcopy(item) for key, item in value.items() if key not in {"event_id", "event_hash"}}


def validate_event(value: Any, expected_sequence: Optional[int] = None, expected_previous: Optional[str] = None) -> HistoryEvent:
    require(isinstance(value, dict), "EVENT_INVALID", "event must be an object")
    required = {
        "protocol_version",
        "event_id",
        "event_hash",
        "sequence",
        "previous_event_hash",
        "event_type",
        "aggregate_type",
        "aggregate_id",
        "occurred_at",
        "provenance",
        "payload",
    }
    missing = sorted(required - set(value.keys()))
    require(not missing, "EVENT_FIELD_MISSING", "event is missing required fields", missing=missing)
    require(value["protocol_version"] == _EVENT_PROTOCOL, "SCHEMA_UNSUPPORTED", "unsupported event protocol")
    require(isinstance(value["sequence"], int) and value["sequence"] >= 0, "EVENT_SEQUENCE_INVALID", "sequence must be non-negative")
    require(
        expected_sequence is None or value["sequence"] == expected_sequence,
        "EVENT_SEQUENCE_INVALID",
        "event sequence is not contiguous",
        expected=expected_sequence,
        actual=value["sequence"],
    )
    require(
        value["previous_event_hash"] is None or isinstance(value["previous_event_hash"], str),
        "EVENT_CHAIN_INVALID",
        "previous event hash must be null or text",
    )
    if expected_sequence == 0:
        require(value["previous_event_hash"] is None, "EVENT_CHAIN_INVALID", "first event must not name a predecessor")
    if expected_sequence is not None and expected_sequence > 0:
        require(value["previous_event_hash"] == expected_previous, "EVENT_CHAIN_INVALID", "event predecessor does not match")
    for field in ("event_type", "aggregate_type", "aggregate_id"):
        require(isinstance(value[field], str) and bool(value[field]), "EVENT_FIELD_INVALID", "event identity fields must be non-empty", path="$.{0}".format(field))
    require(isinstance(value["occurred_at"], str) and _UTC_TIMESTAMP.match(value["occurred_at"]) is not None, "TIMESTAMP_INVALID", "occurred_at must be an explicit UTC timestamp")
    require(isinstance(value["provenance"], dict), "PROVENANCE_INVALID", "event provenance must be an object")
    require(isinstance(value["provenance"].get("actor_id"), str) and bool(value["provenance"]["actor_id"]), "PROVENANCE_INVALID", "event provenance requires actor_id")
    require(isinstance(value["provenance"].get("actor_kind"), str) and bool(value["provenance"]["actor_kind"]), "PROVENANCE_INVALID", "event provenance requires actor_kind")
    actual_hash = digest_json(_event_preimage(value))
    require(value["event_hash"] == actual_hash, "HASH_MISMATCH", "event hash does not match canonical preimage")
    require(value["event_id"] == "event:" + actual_hash, "HASH_MISMATCH", "event ID does not match event hash")
    return HistoryEvent(copy.deepcopy(value))


def build_event(
    sequence: int,
    previous_event_hash: Optional[str],
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    occurred_at: str,
    provenance: Dict[str, Any],
    payload: Any,
) -> HistoryEvent:
    value: Dict[str, Any] = {
        "protocol_version": _EVENT_PROTOCOL,
        "sequence": sequence,
        "previous_event_hash": previous_event_hash,
        "event_type": event_type,
        "aggregate_type": aggregate_type,
        "aggregate_id": aggregate_id,
        "occurred_at": occurred_at,
        "provenance": copy.deepcopy(provenance),
        "payload": copy.deepcopy(payload),
    }
    validate_persistence_safety(value)
    event_hash = digest_json(value)
    value["event_id"] = "event:" + event_hash
    value["event_hash"] = event_hash
    return validate_event(value, sequence, previous_event_hash)


class AppendOnlyEventLog:
    """Durable JSONL event log for a single custodied writer.

    Each append is one canonical line followed by fsync.  Readers reject a
    partial final line, non-canonical bytes, sequence gaps, and hash-chain
    tampering instead of guessing past corruption.
    """

    def __init__(self, path: Path, max_bytes: int = 16 * 1024 * 1024) -> None:
        self.path = Path(path)
        self.max_bytes = max_bytes
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def read_all(self) -> List[HistoryEvent]:
        with self._lock:
            if not self.path.exists():
                return []
            payload = self.path.read_bytes()
            if len(payload) > self.max_bytes:
                raise DiagnosticError("EVENT_LOG_TOO_LARGE", "event log exceeds configured read limit")
            if payload and not payload.endswith(b"\n"):
                raise DiagnosticError("EVENT_LOG_TRUNCATED", "event log has a partial final record")
            events: List[HistoryEvent] = []
            previous: Optional[str] = None
            for sequence, raw_line in enumerate(payload.splitlines()):
                if not raw_line:
                    raise DiagnosticError("EVENT_LOG_EMPTY_RECORD", "event log contains an empty record")
                value = parse_json(raw_line, require_canonical=True)
                event = validate_event(value, sequence, previous)
                events.append(event)
                previous = event.event_hash
            return events

    def append(
        self,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        occurred_at: str,
        provenance: Dict[str, Any],
        payload: Any,
    ) -> HistoryEvent:
        with self._lock:
            current = self.read_all()
            sequence = len(current)
            previous = current[-1].event_hash if current else None
            event = build_event(
                sequence=sequence,
                previous_event_hash=previous,
                event_type=event_type,
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                occurred_at=occurred_at,
                provenance=provenance,
                payload=payload,
            )
            line = canonical_bytes(event.value) + b"\n"
            descriptor = os.open(str(self.path), os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
            try:
                view = memoryview(line)
                written = 0
                while written < len(line):
                    count = os.write(descriptor, view[written:])
                    if count <= 0:
                        raise DiagnosticError("EVENT_APPEND_FAILED", "event append made no progress")
                    written += count
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            return event

    def iter_type(self, event_type: str) -> Iterable[HistoryEvent]:
        return (event for event in self.read_all() if event.value["event_type"] == event_type)
