"""Canonical JSON and SHA-256. Floats are refused: money is a decimal string, never a float."""
from __future__ import annotations

import hashlib
import json
from typing import Any


class FloatRefused(TypeError):
    pass


def _refuse_floats(value: Any, path: str = "$") -> None:
    if isinstance(value, float):
        raise FloatRefused(f"float at {path}; use a decimal string")
    if isinstance(value, dict):
        for k, v in value.items():
            _refuse_floats(v, f"{path}.{k}")
    elif isinstance(value, (list, tuple)):
        for i, v in enumerate(value):
            _refuse_floats(v, f"{path}[{i}]")


def canonical_bytes(value: Any) -> bytes:
    _refuse_floats(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_id(prefix: str, value: dict, *drop: str) -> tuple[str, str]:
    """Hash a document without its own id/hash fields; return (id, hash)."""
    body = {k: v for k, v in value.items() if k not in drop}
    digest = sha256(body)
    return f"{prefix}:{digest}", digest
