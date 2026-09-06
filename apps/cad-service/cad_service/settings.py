"""Fail-closed deployment settings for the native CAD service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


VERCEL_DOCUMENTED_BODY_LIMIT_BYTES = 4_500_000


def _integer(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    try:
        value = default if raw is None else int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _origins(raw: str) -> tuple[str, ...]:
    result: list[str] = []
    for candidate in (item.strip().rstrip("/") for item in raw.split(",")):
        if not candidate:
            continue
        parsed = urlsplit(candidate)
        if candidate == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("CAD_CORS_ORIGINS accepts exact http(s) origins only; '*' is forbidden")
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
            raise ValueError("CAD_CORS_ORIGINS entries must be origins without credentials, paths, queries, or fragments")
        if candidate not in result:
            result.append(candidate)
    return tuple(result)


def _hosts(raw: str) -> tuple[str, ...]:
    hosts = tuple(dict.fromkeys(item.strip() for item in raw.split(",") if item.strip()))
    if not hosts or "*" in hosts or any("/" in item or "://" in item for item in hosts):
        raise ValueError("CAD_ALLOWED_HOSTS requires explicit hostnames; '*' and URLs are forbidden")
    return hosts


@dataclass(frozen=True)
class DeploymentSettings:
    port: int = 8000
    max_request_bytes: int = 4_250_000
    max_response_bytes: int = 4_250_000
    transport_timeout_seconds: int = 40
    native_timeout_seconds: int = 30
    max_concurrency: int = 1
    keepalive_seconds: int = 5
    native_cpu_seconds: int = 25
    native_max_address_space_mib: int = 0
    native_max_open_files: int = 256
    cors_origins: tuple[str, ...] = ()
    allowed_hosts: tuple[str, ...] = ("localhost", "127.0.0.1", "testserver")

    def __post_init__(self) -> None:
        if self.max_request_bytes >= VERCEL_DOCUMENTED_BODY_LIMIT_BYTES:
            raise ValueError("request limit must preserve headroom below Vercel's 4.5 MB limit")
        if self.max_response_bytes >= VERCEL_DOCUMENTED_BODY_LIMIT_BYTES:
            raise ValueError("response limit must preserve headroom below Vercel's 4.5 MB limit")
        if self.native_timeout_seconds >= self.transport_timeout_seconds:
            raise ValueError("CAD_NATIVE_TIMEOUT_SECONDS must be lower than CAD_TRANSPORT_TIMEOUT_SECONDS")

    @classmethod
    def from_env(cls) -> "DeploymentSettings":
        return cls(
            port=_integer("PORT", 8000, minimum=1, maximum=65_535),
            max_request_bytes=_integer(
                "CAD_MAX_REQUEST_BYTES", 4_250_000, minimum=1_024, maximum=4_499_999
            ),
            max_response_bytes=_integer(
                "CAD_MAX_RESPONSE_BYTES", 4_250_000, minimum=1_024, maximum=4_499_999
            ),
            transport_timeout_seconds=_integer(
                "CAD_TRANSPORT_TIMEOUT_SECONDS", 40, minimum=2, maximum=120
            ),
            native_timeout_seconds=_integer(
                "CAD_NATIVE_TIMEOUT_SECONDS", 30, minimum=1, maximum=110
            ),
            max_concurrency=_integer("CAD_MAX_CONCURRENCY", 1, minimum=1, maximum=8),
            keepalive_seconds=_integer("CAD_KEEPALIVE_SECONDS", 5, minimum=1, maximum=30),
            native_cpu_seconds=_integer("CAD_NATIVE_CPU_SECONDS", 25, minimum=1, maximum=105),
            native_max_address_space_mib=_integer(
                "CAD_NATIVE_MAX_ADDRESS_SPACE_MIB", 0, minimum=0, maximum=32_768
            ),
            native_max_open_files=_integer(
                "CAD_NATIVE_MAX_OPEN_FILES", 256, minimum=64, maximum=4_096
            ),
            cors_origins=_origins(os.getenv("CAD_CORS_ORIGINS", "")),
            allowed_hosts=_hosts(
                os.getenv("CAD_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
            ),
        )

    def public_limits(self) -> dict[str, int | str]:
        return {
            "request_bytes": self.max_request_bytes,
            "response_bytes": self.max_response_bytes,
            "transport_timeout_seconds": self.transport_timeout_seconds,
            "native_timeout_seconds": self.native_timeout_seconds,
            "max_concurrency_per_instance": self.max_concurrency,
            "native_cpu_seconds": self.native_cpu_seconds,
            "native_max_address_space_mib": self.native_max_address_space_mib,
            "native_max_open_files": self.native_max_open_files,
            "cors": "exact-origin-allowlist" if self.cors_origins else "browser-cross-origin-denied",
        }
