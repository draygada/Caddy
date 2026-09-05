"""Canonical bytes and SHA-256. Floats are refused: a float has no place in a record we hash."""

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
