"""Stable, machine-readable failures used by the history layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class DiagnosticError(ValueError):
    """A fail-closed error whose code is stable and whose prose is supplemental."""

    code: str
    message: str
    path: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        location = " at {0}".format(self.path) if self.path else ""
        return "{0}{1}: {2}".format(self.code, location, self.message)

    def as_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"code": self.code, "message": self.message}
        if self.path is not None:
            result["path"] = self.path
        if self.details:
            result["details"] = self.details
        return result


def require(condition: bool, code: str, message: str, path: Optional[str] = None, **details: Any) -> None:
    if not condition:
        raise DiagnosticError(code=code, message=message, path=path, details=details)
