"""Canonical bytes and content hashes for `forge.record/1`, `forge.command/1`, `forge.event/1`.

The platform contract (docs/contracts/platform-records.v1.md) fixes RFC 8785 canonicalization
and SHA-256. Our payloads carry strings, integers, booleans, null, objects and arrays only, for
which RFC 8785 and Python's sorted compact JSON agree byte for byte. Floats are refused rather
than approximated: a float in a record is a contract violation here, not a formatting problem.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _refuse_floats(value: Any) -> None:
    if isinstance(value, float):
        raise TypeError("floats are not representable in a canonical record; use a decimal string or an integer")
    if isinstance(value, dict):
        for v in value.values():
            _refuse_floats(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _refuse_floats(v)


def canonical_bytes(value: Any) -> bytes:
    _refuse_floats(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _without(record: dict, *keys: str) -> dict:
    return {k: v for k, v in record.items() if k not in keys}


def content_hash(record: dict) -> str:
    """SHA-256 over the envelope with `revision_id` and `content_hash` omitted."""
    return sha256(canonical_bytes(_without(record, "revision_id", "content_hash")))


def seal_record(record: dict) -> dict:
    digest = content_hash(record)
    return {**record, "content_hash": digest, "revision_id": f"record-rev:{digest}"}


def command_hash(command: dict) -> str:
    return sha256(canonical_bytes(_without(command, "command_hash")))


def seal_command(command: dict) -> dict:
    return {**command, "command_hash": command_hash(command)}


def event_hash(event: dict) -> str:
    return sha256(canonical_bytes(_without(event, "event_id", "event_hash")))


def seal_event(event: dict) -> dict:
    digest = event_hash(event)
    return {**event, "event_hash": digest, "event_id": f"event:{digest}"}


def record_ref(record: dict) -> dict:
    """The exact five-field immutable reference every cross-record edge uses."""
    return {
        "record_kind": record["record_kind"],
        "record_id": record["record_id"],
        "revision_id": record["revision_id"],
        "content_hash": record["content_hash"],
        "authority_domain": record["authority_domain"],
    }
