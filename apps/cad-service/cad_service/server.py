"""OCI server entrypoint with one bounded application worker."""

from __future__ import annotations

import uvicorn

from .settings import DeploymentSettings


def main() -> None:
    settings = DeploymentSettings.from_env()
    uvicorn.run(
        "api.index:app",
        host="0.0.0.0",
        port=settings.port,
        workers=1,
        limit_concurrency=settings.max_concurrency + 8,
        timeout_keep_alive=settings.keepalive_seconds,
        timeout_graceful_shutdown=10,
        access_log=False,
        server_header=False,
    )


if __name__ == "__main__":
    main()
