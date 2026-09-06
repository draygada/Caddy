"""Structured failures shared by the transport and isolated OCCT worker."""

from __future__ import annotations

from .models import Diagnostic


class CadError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        feature_id: str | None = None,
        status_code: int = 422,
    ) -> None:
        super().__init__(message)
        self.diagnostic = Diagnostic(
            code=code,
            severity="ERROR",
            message=message,
            feature_id=feature_id,
        )
        self.status_code = status_code
