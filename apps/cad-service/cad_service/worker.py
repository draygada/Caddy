"""One-shot native worker used to make OCCT calls killable and resource-bounded."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def _apply_resource_limits() -> None:
    try:
        import resource
    except ImportError:
        return
    cpu_seconds = int(os.environ["CAD_NATIVE_CPU_SECONDS"])
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
    open_files = int(os.environ["CAD_NATIVE_MAX_OPEN_FILES"])
    current_soft, current_hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    bounded_files = min(open_files, current_hard)
    resource.setrlimit(resource.RLIMIT_NOFILE, (bounded_files, current_hard))
    address_space_mib = int(os.environ["CAD_NATIVE_MAX_ADDRESS_SPACE_MIB"])
    if address_space_mib and hasattr(resource, "RLIMIT_AS"):
        limit = address_space_mib * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))


def _dispatch(operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    if operation == "probe":
        import OCP
        from OCP.BRepCheck import BRepCheck_Analyzer
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox

        shape = BRepPrimAPI_MakeBox(1.0, 1.0, 1.0).Shape()
        if shape.IsNull() or not BRepCheck_Analyzer(shape, True).IsValid():
            raise RuntimeError("OCCT readiness primitive was invalid")
        return {
            "kernel": "OpenCascade",
            "version": "7.9.3",
            "binding": f"cadquery-ocp-novtk/{OCP.__version__}",
            "primitive": "valid-1mm-box",
        }

    from .kernel import assemble, exchange, recompute
    from .models import AssemblyRequest, ExchangeRequest, RecomputeRequest

    routes = {
        "recompute": (RecomputeRequest, recompute),
        "assemble": (AssemblyRequest, assemble),
        "exchange": (ExchangeRequest, exchange),
    }
    if operation not in routes:
        raise ValueError("unsupported native worker operation")
    request_type, function = routes[operation]
    request = request_type.model_validate(payload)
    return function(request).model_dump(mode="json")


def _write(output: Path, envelope: dict[str, Any], max_bytes: int) -> None:
    encoded = json.dumps(envelope, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    if len(encoded) > max_bytes:
        encoded = json.dumps(
            {
                "status": "FAILED",
                "diagnostics": [
                    {
                        "code": "RESPONSE_PAYLOAD_TOO_LARGE",
                        "severity": "ERROR",
                        "message": "Native result exceeds the configured response limit",
                    }
                ],
            },
            separators=(",", ":"),
        ).encode()
    temporary = output.with_suffix(".tmp")
    temporary.write_bytes(encoded)
    temporary.replace(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    max_request = int(os.environ["CAD_MAX_REQUEST_BYTES"])
    max_response = int(os.environ["CAD_MAX_RESPONSE_BYTES"])
    try:
        _apply_resource_limits()
        raw = sys.stdin.buffer.read(max_request + 1)
        if len(raw) > max_request:
            raise ValueError("native worker request exceeds configured limit")
        envelope = json.loads(raw)
        result = _dispatch(str(envelope["operation"]), envelope.get("payload", {}))
        response = {"status": "SUCCEEDED", "result": result}
    except Exception as exc:
        from .kernel import CadError

        if isinstance(exc, CadError):
            diagnostic = exc.diagnostic.model_dump(mode="json", exclude_none=True)
        else:
            diagnostic = {
                "code": "NATIVE_WORKER_FAILED",
                "severity": "ERROR",
                "message": f"Native worker rejected the operation ({type(exc).__name__})",
            }
        response = {"status": "FAILED", "diagnostics": [diagnostic]}
    _write(arguments.output, response, max_response)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
