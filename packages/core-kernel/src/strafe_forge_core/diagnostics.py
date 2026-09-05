"""Stable diagnostics shared by validation and execution internals."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal


Severity = Literal["INFO", "WARNING", "ERROR"]


@dataclass(frozen=True, slots=True)
class Diagnostic:
    code: str
    severity: Severity
    message: str
    operation_id: str | None = None
    reference_id: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return asdict(self)


class KernelError(Exception):
    """Expected, stable failure at the validation or kernel boundary."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        operation_id: str | None = None,
        reference_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.diagnostic = Diagnostic(
            code=code,
            severity="ERROR",
            message=message,
            operation_id=operation_id,
            reference_id=reference_id,
        )

    @property
    def code(self) -> str:
        return self.diagnostic.code
