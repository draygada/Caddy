#!/usr/bin/env python3
"""Fail if a Forge lane touches paths outside its declared custody."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = REPO_ROOT / "governance" / "custody.v1.json"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(REPO_ROOT), *args])


def nul_paths(payload: bytes) -> set[str]:
    return {
        item.decode("utf-8", errors="strict")
        for item in payload.split(b"\0")
        if item
    }


def allowed(path: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if pattern.endswith("/**"):
            prefix = pattern[:-3].rstrip("/")
            if path == prefix or path.startswith(prefix + "/"):
                return True
        elif path == pattern:
            return True
    return False


def changed_paths(base: str, head: str) -> set[str]:
    committed = nul_paths(git("diff", "--name-only", "-z", f"{base}...{head}"))
    working = nul_paths(git("diff", "--name-only", "-z", "HEAD"))
    untracked = nul_paths(git("ls-files", "--others", "--exclude-standard", "-z"))
    return committed | working | untracked


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lane", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", default="HEAD")
    args = parser.parse_args()

    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    lane = registry["lanes"].get(args.lane)
    if lane is None:
        print(f"unknown lane: {args.lane}", file=sys.stderr)
        return 2

    actual_root = Path(git("rev-parse", "--show-toplevel").decode().strip()).resolve()
    expected_root = Path(lane["worktree"]).resolve()
    if actual_root != expected_root:
        print(f"worktree mismatch: expected {expected_root}, got {actual_root}", file=sys.stderr)
        return 2

    branch = git("branch", "--show-current").decode().strip()
    if branch != lane["branch"]:
        print(f"branch mismatch: expected {lane['branch']}, got {branch}", file=sys.stderr)
        return 2

    paths = sorted(changed_paths(args.base, args.head))
    violations = [path for path in paths if not allowed(path, lane["write_allowlist"])]

    print(f"lane={args.lane}")
    print(f"branch={branch}")
    print(f"base={args.base}")
    print(f"head={args.head}")
    print(f"changed_paths={len(paths)}")
    for path in paths:
        print(f"  {path}")

    if violations:
        print("CUSTODY_FAIL", file=sys.stderr)
        for path in violations:
            print(f"  outside allowlist: {path}", file=sys.stderr)
        return 1

    print("CUSTODY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

