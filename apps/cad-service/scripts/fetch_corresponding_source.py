"""Fetch and verify the exact geometry-stack source archives."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import urllib.request
from pathlib import Path


SOURCES = (
    {
        "name": "OCP-d69b064a3a604ebf245b1f3b14fb54c835a3a571.tar.gz",
        "url": "https://github.com/CadQuery/OCP/archive/d69b064a3a604ebf245b1f3b14fb54c835a3a571.tar.gz",
        "sha256": "a5153cef9f4a3a3dbbb1d498a971206a6c35dc4d829e7e011f96e0539c22e616",
        "bytes": 3_728_128,
    },
    {
        "name": "ocp-build-system-648499040b66a769293edfa844ff170ff8046619.tar.gz",
        "url": "https://github.com/CadQuery/ocp-build-system/archive/648499040b66a769293edfa844ff170ff8046619.tar.gz",
        "sha256": "103558026783449a3d9cd442dc2b741992520a1c436f5cf017a1f3a98fa0107e",
        "bytes": 1_380_634,
    },
    {
        "name": "OCCT-a016080bf6738d6aeae020badee4e888ad1540a5.tar.gz",
        "url": "https://github.com/Open-Cascade-SAS/OCCT/archive/a016080bf6738d6aeae020badee4e888ad1540a5.tar.gz",
        "sha256": "c533f2667b59921bd6bd40ce82e7b9900b0289ccc731af5fdeeba097de80ef0f",
        "bytes": 48_610_707,
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(source: dict[str, object], destination: Path) -> dict[str, object]:
    target = destination / str(source["name"])
    if target.exists():
        observed = sha256(target)
        if observed != source["sha256"]:
            raise RuntimeError(f"existing source archive has wrong hash: {target}")
        return {**source, "path": str(target), "status": "REUSED"}

    partial = destination / f".{source['name']}.partial"
    with urllib.request.urlopen(str(source["url"]), timeout=180) as response, partial.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    observed = sha256(partial)
    if observed != source["sha256"]:
        raise RuntimeError(
            f"source archive hash mismatch for {source['name']}: expected {source['sha256']}, observed {observed}"
        )
    os.replace(partial, target)
    return {**source, "path": str(target), "status": "FETCHED"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args()
    if args.manifest_only:
        print(json.dumps({"sources": SOURCES}, indent=2))
        return 0
    if args.destination is None:
        parser.error("--destination is required unless --manifest-only is used")
    args.destination.mkdir(parents=True, exist_ok=True)
    results = [fetch(source, args.destination) for source in SOURCES]
    print(json.dumps({"sources": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
