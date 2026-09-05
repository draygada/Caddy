#!/usr/bin/env python3
"""Build an allowlist-only local candidate bundle and emit its resolved manifest."""

from __future__ import annotations

import argparse
from fnmatch import fnmatch
import hashlib
import json
from pathlib import Path
import shutil

REPO = Path(__file__).resolve().parents[3]
POLICY = REPO / "apps" / "product-service" / "bundle-manifest.v1.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        raise SystemExit("Output already exists; refusing to overwrite it.")
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    excluded = tuple(policy["excluded"])

    def is_excluded(relative: str) -> bool:
        return any(fnmatch(relative, pattern) for pattern in excluded)

    paths: set[Path] = set()
    for tree in policy["required_trees"]:
        root = REPO / tree
        if not root.is_dir():
            raise SystemExit(f"Required runtime tree is missing: {tree}")
        paths.update(
            path
            for path in root.rglob("*")
            if path.is_file() and not is_excluded(path.relative_to(REPO).as_posix())
        )
    for name in policy["required_files"]:
        path = REPO / name
        if not path.is_file():
            raise SystemExit(f"Required runtime file is missing: {name}")
        if is_excluded(path.relative_to(REPO).as_posix()):
            raise SystemExit(f"Required runtime file is excluded by policy: {name}")
        paths.add(path)
    records = []
    for source in sorted(paths):
        if source.is_symlink():
            raise SystemExit(f"Symlinks are not admitted: {source.relative_to(REPO)}")
        relative = source.relative_to(REPO).as_posix()
        if is_excluded(relative):
            raise SystemExit(f"Excluded path entered bundle allowlist: {relative}")
        content = source.read_bytes()
        if str(REPO).encode() in content or b"/Users/" in content:
            raise SystemExit(f"Absolute workspace path found in runtime file: {relative}")
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        records.append({"path": relative, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    manifest = {"schema_version": policy["schema_version"], "candidate": policy["candidate"], "files": records, "excluded": policy["excluded"], "provider_state": "NOT_INCLUDED"}
    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    (output / "bundle-manifest.resolved.json").write_bytes(manifest_bytes)
    print(json.dumps({"output": output.name, "file_count": len(records), "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(), "excluded": policy["excluded"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
