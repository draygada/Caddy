"""Parent-side controller for isolated native CAD operations."""

from __future__ import annotations

import json
import importlib.util
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from .errors import CadError
from .models import (
    AssemblyRequest,
    AssemblyResponse,
    ExchangeRequest,
    ExchangeResponse,
    RecomputeRequest,
    RecomputeResponse,
)
from .settings import (
    DeploymentSettings,
    NATIVE_RUNTIME_ARTIFACT_SHA256,
    NATIVE_RUNTIME_MANIFEST_SCHEMA,
    NATIVE_RUNTIME_OWNER_APPROVAL_ENV,
    NATIVE_RUNTIME_OWNER_APPROVAL_VALUE,
)


ResponseT = TypeVar("ResponseT", bound=BaseModel)


class NativeExecutor:
    """Run each OCCT transaction in a subprocess that can be terminated on timeout."""

    def __init__(self, settings: DeploymentSettings) -> None:
        self.settings = settings
        self.service_root = Path(__file__).resolve().parents[1]
        self._probe: dict[str, str] | None = None
        self._capabilities: dict[str, Any] | None = None
        self._evidence: dict[str, str] | None = None
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
    ) -> ResponseT | dict[str, Any]:
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
                    status_code=504,
                ) from exc
            except OSError as exc:
                raise CadError(
                    "OCCT_RUNTIME_UNAVAILABLE",
                    "The isolated OCCT worker could not start. Install the pinned CPython 3.12 cadquery-ocp-novtk==7.9.3.1 runtime and preserve its native shared-library closure.",
                    status_code=503,
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
            code = str(first.get("code", "NATIVE_WORKER_FAILED"))
            raise CadError(
                code,
                str(first.get("message", "Native worker rejected the operation")),
                status_code=503 if code.startswith("OCCT_RUNTIME_") else 422,
            )
        result = envelope.get("result")
        if response_type is None:
            if not isinstance(result, dict):
                raise CadError("NATIVE_WORKER_PROTOCOL", "Native probe returned an invalid result")
            return result
        try:
            return response_type.model_validate(result)
        except Exception as exc:
            raise CadError("NATIVE_WORKER_PROTOCOL", "Native worker result violated the response contract") from exc

    def _assert_owner_approval(self) -> None:
        if self.settings.native_runtime_owner_approval != NATIVE_RUNTIME_OWNER_APPROVAL_VALUE:
            raise CadError(
                "CAD_RUNTIME_OWNER_APPROVAL_REQUIRED",
                f"Repository-owner acceptance is not asserted for the pinned native closure. After the owner accepts the obligations recorded in REDISTRIBUTION_EVIDENCE.md, set {NATIVE_RUNTIME_OWNER_APPROVAL_ENV}={NATIVE_RUNTIME_OWNER_APPROVAL_VALUE} on the isolated CAD service.",
                status_code=503,
            )

    def _verify_evidence(self) -> dict[str, str]:
        required = (
            "licenses/native-runtime-manifest.v1.json",
            "licenses/native-source-artifacts.v1.json",
            "THIRD_PARTY_NOTICES.md",
            "REDISTRIBUTION_EVIDENCE.md",
            "scripts/verify_redistribution_evidence.py",
        )
        roots = (
            self.service_root,
            Path("/usr/share/licenses/caddydaddy-cad-service"),
        )
        evidence_root = next(
            (root for root in roots if all((root / relative).is_file() for relative in required)),
            None,
        )
        if evidence_root is None:
            raise CadError(
                "CAD_REDISTRIBUTION_EVIDENCE_MISSING",
                "The native release closure is incomplete. Include licenses/**, THIRD_PARTY_NOTICES.md, REDISTRIBUTION_EVIDENCE.md, and scripts/verify_redistribution_evidence.py in the isolated CAD-service artifact.",
                status_code=503,
            )
        try:
            script = evidence_root / "scripts" / "verify_redistribution_evidence.py"
            spec = importlib.util.spec_from_file_location("caddydaddy_runtime_evidence", script)
            if spec is None or spec.loader is None:
                raise RuntimeError("evidence verifier is not loadable")
            verifier = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(verifier)
            errors, summary = verifier.verify_evidence(evidence_root)
            runtime = json.loads((evidence_root / "licenses/native-runtime-manifest.v1.json").read_text(encoding="utf-8"))
            sources = json.loads((evidence_root / "licenses/native-source-artifacts.v1.json").read_text(encoding="utf-8"))
            exact = (
                runtime.get("schema") == NATIVE_RUNTIME_MANIFEST_SCHEMA
                and runtime.get("target") == "CPython 3.12 / x86_64-manylinux_2_31"
                and runtime.get("expected_native_file_count") == 70
                and runtime.get("artifact", {}).get("name") == "cadquery-ocp-novtk"
                and runtime.get("artifact", {}).get("version") == "7.9.3.1"
                and runtime.get("artifact", {}).get("sha256") == NATIVE_RUNTIME_ARTIFACT_SHA256
                and runtime.get("build_provenance", {}).get("occt_commit") == "a016080bf6738d6aeae020badee4e888ad1540a5"
                and runtime.get("build_provenance", {}).get("ocp_commit") == "d69b064a3a604ebf245b1f3b14fb54c835a3a571"
                and sources.get("schema") == "caddydaddy.native-source-artifacts/v1"
                and len(sources.get("source_sets", [])) == 22
                and not errors
                and summary.get("factual_evidence") == "PASS"
                and summary.get("legal_determination") == "NOT_PERFORMED"
            )
            if not exact:
                raise RuntimeError("evidence packet does not match the pinned closure")
        except Exception as exc:
            raise CadError(
                "CAD_REDISTRIBUTION_EVIDENCE_INVALID",
                "The bundled native evidence does not verify against the pinned caddydaddy.native-runtime/v1 closure. Rebuild the CAD-service artifact from the recorded wheel and rerun scripts/verify_redistribution_evidence.py.",
                status_code=503,
            ) from exc
        return {
            "factual_evidence": "PASS",
            "legal_determination": "NOT_PERFORMED",
            "runtime_manifest": NATIVE_RUNTIME_MANIFEST_SCHEMA,
            "artifact_sha256": NATIVE_RUNTIME_ARTIFACT_SHA256,
        }

    def readiness(self) -> dict[str, str]:
        with self._probe_lock:
            if self._probe is None:
                self._assert_owner_approval()
                self._evidence = self._verify_evidence()
                result = self._invoke("probe", {})
                proof = result.get("proof") if isinstance(result, dict) else None
                capabilities = result.get("capabilities") if isinstance(result, dict) else None
                if not isinstance(proof, dict) or not isinstance(capabilities, dict):
                    raise CadError(
                        "NATIVE_WORKER_PROTOCOL",
                        "The isolated OCCT runtime probe did not return its versioned capability contract.",
                        status_code=503,
                    )
                if (
                    proof.get("kernel") != "OpenCascade"
                    or proof.get("version") != "7.9.3"
                    or proof.get("binding") != "cadquery-ocp-novtk/7.9.3.1"
                    or capabilities.get("schema_version") != "caddydaddy.cad-capabilities/1"
                ):
                    raise CadError(
                        "OCCT_RUNTIME_INCOMPATIBLE",
                        "The isolated worker is not the pinned OpenCascade 7.9.3 / cadquery-ocp-novtk 7.9.3.1 runtime. Install that exact CPython 3.12 closure before enabling native CAD.",
                        status_code=503,
                    )
                self._probe = {str(key): str(value) for key, value in proof.items()}
                self._capabilities = capabilities
            return {**self._probe, **(self._evidence or {})}

    def capabilities(self) -> dict[str, Any]:
        proof = self.readiness()
        if self._capabilities is None:
            raise CadError("NATIVE_WORKER_PROTOCOL", "The OCCT capability contract is unavailable.", status_code=503)
        result = json.loads(json.dumps(self._capabilities))
        result["status"] = "AVAILABLE"
        result["runtime_gate"] = {
            "status": "APPROVED",
            "owner_approval": "ASSERTED_BY_DEPLOYMENT_CONFIGURATION",
            "approval_binding": NATIVE_RUNTIME_MANIFEST_SCHEMA,
            "factual_evidence": proof["factual_evidence"],
            "legal_determination": proof["legal_determination"],
            "artifact_sha256": proof["artifact_sha256"],
        }
        return result

    def recompute(self, request: RecomputeRequest) -> RecomputeResponse:
        self.readiness()
        return self._invoke("recompute", request.model_dump(mode="json"), RecomputeResponse)  # type: ignore[return-value]

    def assemble(self, request: AssemblyRequest) -> AssemblyResponse:
        self.readiness()
        return self._invoke("assemble", request.model_dump(mode="json"), AssemblyResponse)  # type: ignore[return-value]

    def exchange(self, request: ExchangeRequest) -> ExchangeResponse:
        self.readiness()
        return self._invoke("exchange", request.model_dump(mode="json"), ExchangeResponse)  # type: ignore[return-value]
