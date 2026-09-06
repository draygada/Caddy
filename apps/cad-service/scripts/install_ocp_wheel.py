"""Install one hash-verified OCP wheel for the OCI build."""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path


def main() -> int:
    url = os.environ.get("OCP_WHEEL_URL", "")
    expected = os.environ.get("OCP_WHEEL_SHA256", "").lower()
    if not url or len(expected) != 64:
        raise SystemExit("OCP_WHEEL_URL and a 64-character OCP_WHEEL_SHA256 are required")

    destination = Path(tempfile.gettempdir()) / "cadquery_ocp_novtk.whl"
    digest = hashlib.sha256()
    with urllib.request.urlopen(url, timeout=120) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)
    observed = digest.hexdigest()
    if observed != expected:
        raise SystemExit(f"OCP wheel SHA-256 mismatch: expected {expected}, observed {observed}")

    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--no-deps", "--no-cache-dir", str(destination)],
        check=True,
    )
    print(f"installed hash-verified OCP wheel sha256={observed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
