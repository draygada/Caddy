"""Canonical JSON and content-address helpers.

All computational hashes cross this module so their preimages are reviewable.  RFC 8785
is delegated to a small pinned implementation instead of approximating it with
``json.dumps(sort_keys=True)``.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

import rfc8785

from .diagnostics import KernelError


SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def canonical_bytes(value: Any) -> bytes:
    """Return RFC 8785 canonical JSON bytes, failing closed on invalid JSON data."""

    try:
        return rfc8785.dumps(value)
    except (TypeError, ValueError, rfc8785.CanonicalizationError) as exc:
        raise KernelError(
            "SCHEMA_UNSUPPORTED",
            f"Value cannot be represented as canonical JSON: {exc}",
        ) from exc


def canonical_text(value: Any) -> str:
    return canonical_bytes(value).decode("utf-8")


def sha256_hex(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def is_sha256_hex(value: object) -> bool:
    return isinstance(value, str) and SHA256_PATTERN.fullmatch(value) is not None
