from __future__ import annotations

from typing import Any


class OrderExecutionError(ValueError):
    """A stable, fail-closed boundary diagnostic."""

    def __init__(self, code: str, message: str, **details: Any) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
        self.details = details


def require(condition: bool, code: str, message: str, **details: Any) -> None:
    if not condition:
        raise OrderExecutionError(code, message, **details)
