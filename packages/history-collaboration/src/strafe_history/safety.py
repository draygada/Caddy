"""Persistence-boundary checks for executable or sensitive material."""

from __future__ import annotations

import re
from typing import Any, Iterable, Set

from .errors import DiagnosticError


_FORBIDDEN_KEYS: Set[str] = {
    "password",
    "secret",
    "credential",
    "api_key",
    "access_token",
    "refresh_token",
    "prompt",
    "prompt_body",
    "transcript",
    "transcript_body",
    "source_code",
    "executable_code",
    "javascript",
    "python_code",
    "callback",
    "worktree",
    "absolute_path",
}
_PRIVATE_PATH = re.compile(r"^(?:/Users/|/home/|[A-Za-z]:\\Users\\)")


def validate_persistence_safety(value: Any, allowed_sensitive_keys: Iterable[str] = ()) -> None:
    """Reject known secret/transcript/code/path material recursively.

    This is defense in depth, not a secret detector.  Callers may extend the
    forbidden policy, but should not weaken it for a shared record merely to make
    a fixture pass.
    """

    allowed = {item.casefold() for item in allowed_sensitive_keys}

    def visit(item: Any, path: str) -> None:
        if isinstance(item, str):
            if item.startswith("file://") or _PRIVATE_PATH.match(item):
                raise DiagnosticError("PRIVATE_PATH_FORBIDDEN", "absolute private path cannot be persisted", path=path)
            return
        if isinstance(item, list):
            for index, child in enumerate(item):
                visit(child, "{0}[{1}]".format(path, index))
            return
        if isinstance(item, dict):
            for key, child in item.items():
                normalized = key.casefold() if isinstance(key, str) else ""
                if normalized in _FORBIDDEN_KEYS and normalized not in allowed:
                    raise DiagnosticError("PERSISTED_FIELD_FORBIDDEN", "sensitive or executable field cannot be persisted", path="{0}.{1}".format(path, key))
                visit(child, "{0}.{1}".format(path, key))

    visit(value, "$")

