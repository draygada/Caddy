"""Parent-side controller for isolated native CAD operations."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from .kernel import CadError
from .models import (
    AssemblyRequest,
    AssemblyResponse,
    ExchangeRequest,
    ExchangeResponse,
    RecomputeRequest,
    RecomputeResponse,
)
from .settings import DeploymentSettings


ResponseT = TypeVar("ResponseT", bound=BaseModel)


class NativeExecutor:
    """Run each OCCT transaction in a subprocess that can be terminated on timeout."""

    def __init__(self, settings: DeploymentSettings) -> None:
        self.settings = settings
        self.service_root = Path(__file__).resolve().parents[1]
        self._probe: dict[str, str] | None = None
        self._probe_lock = threading.Lock()

    def _environment(self) -> dict[str, str]:
        environment = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "PYTHONPATH": str(self.service_root),
            "PYTHONUNBUFFERED": "1",
            "CAD_MAX_REQUEST_BYTES": str(self.settings.max_request_bytes),
            "CAD_MAX_RESPONSE_BYTES": str(self.settings.max_response_bytes),
            "CAD_NATIVE_CPU_SECONDS": str(self.settings.native_cpu_seconds),
            "CAD_NATIVE_MAX_ADDRESS_SPACE_MIB": str(self.settings.native_max_address_space_mib),
            "CAD_NATIVE_MAX_OPEN_FILES": str(self.settings.native_max_open_files),
        }
        for name in ("LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH", "SYSTEMROOT", "WINDIR"):
            if name in os.environ:
                environment[name] = os.environ[name]
        return environment

    def _invoke(
        self,
        operation: str,
        payload: dict[str, Any],
        response_type: type[ResponseT] | None = None,
    ) -> ResponseT | dict[str, str]:
        encoded = json.dumps(
            {"operation": operation, "payload": payload},
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        ).encode()
        if len(encoded) > self.settings.max_request_bytes:
            raise CadError("REQUEST_PAYLOAD_TOO_LARGE", "Native request exceeds the configured transport limit")
        with tempfile.TemporaryDirectory(prefix="caddydaddy-native-") as directory:
            output = Path(directory) / "result.json"
            try:
                completed = subprocess.run(
                    [sys.executable, "-m", "cad_service.worker", "--output", str(output)],
                    cwd=self.service_root,
                    env=self._environment(),
                    input=encoded,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    timeout=self.settings.native_timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise CadError(
                    "NATIVE_OPERATION_TIMEOUT",
                    f"Native operation exceeded {self.settings.native_timeout_seconds} seconds and was terminated",
                ) from exc
            if completed.returncode != 0 or not output.is_file():
                raise CadError("NATIVE_WORKER_EXIT", "Native worker exited without a valid result")
            if output.stat().st_size > self.settings.max_response_bytes:
                raise CadError("RESPONSE_PAYLOAD_TOO_LARGE", "Native result exceeds the configured response limit")
            try:
                envelope = json.loads(output.read_bytes())
            except (json.JSONDecodeError, OSError) as exc:
                raise CadError("NATIVE_WORKER_PROTOCOL", "Native worker returned an invalid envelope") from exc
        if envelope.get("status") != "SUCCEEDED":
            diagnostics = envelope.get("diagnostics") or []
            first = diagnostics[0] if diagnostics else {}
            raise CadError(
                str(first.get("code", "NATIVE_WORKER_FAILED")),
                str(first.get("message", "Native worker rejected the operation")),
            )
        result = envelope.get("result")
        if response_type is None:
            if not isinstance(result, dict):
                raise CadError("NATIVE_WORKER_PROTOCOL", "Native probe returned an invalid result")
            return {str(key): str(value) for key, value in result.items()}
        try:
            return response_type.model_validate(result)
        except Exception as exc:
            raise CadError("NATIVE_WORKER_PROTOCOL", "Native worker result violated the response contract") from exc

    def readiness(self) -> dict[str, str]:
        with self._probe_lock:
            if self._probe is None:
                self._probe = self._invoke("probe", {})  # type: ignore[assignment]
            return dict(self._probe)

    def recompute(self, request: RecomputeRequest) -> RecomputeResponse:
        return self._invoke("recompute", request.model_dump(mode="json"), RecomputeResponse)  # type: ignore[return-value]

    def assemble(self, request: AssemblyRequest) -> AssemblyResponse:
        return self._invoke("assemble", request.model_dump(mode="json"), AssemblyResponse)  # type: ignore[return-value]

    def exchange(self, request: ExchangeRequest) -> ExchangeResponse:
        return self._invoke("exchange", request.model_dump(mode="json"), ExchangeResponse)  # type: ignore[return-value]
