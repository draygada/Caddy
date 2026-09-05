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
EVIDENCE_CLASSES = {"MEASURED", "INFERRED", "UNKNOWN"}


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


def validate_receipt(lane_name: str, lane: dict, base: str) -> list[str]:
    errors: list[str] = []
    receipt_path = REPO_ROOT / "governance" / "receipts" / f"{lane_name}.json"
    if not receipt_path.is_file():
        return [f"missing lane receipt: {receipt_path.relative_to(REPO_ROOT)}"]

    try:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"invalid lane receipt: {exc}"]

    expected = {
        "lane": lane_name,
        "branch": lane["branch"],
        "worktree": lane["worktree"],
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            errors.append(
                f"receipt {key} mismatch: expected {value!r}, got {receipt.get(key)!r}"
            )
    if receipt.get("exclusive_write_paths") != lane["write_allowlist"]:
        errors.append("receipt exclusive_write_paths do not match registry write_allowlist")
    if receipt.get("base_commit") != base:
        errors.append(
            f"receipt base_commit mismatch: expected {base!r}, "
            f"got {receipt.get('base_commit')!r}"
        )

    if receipt.get("status") == "PREPARED_UNASSIGNED":
        if receipt.get("mutation_admitted") is not False:
            errors.append("unassigned receipt must set mutation_admitted false")
        if receipt.get("writer") is not None:
            errors.append("unassigned receipt must not name a writer")
        for key in ("lease_acquired_at", "renew_by", "expires_at"):
            if receipt.get(key) is not None:
                errors.append(f"unassigned receipt must set {key} null")

    observation = receipt.get("now_observation")
    if not isinstance(observation, dict):
        return errors + ["receipt now_observation is missing or not an object"]
    if observation.get("schema_version") != "1.0.0":
        errors.append("now_observation schema_version must be 1.0.0")
    if observation.get("worktree_label") != lane["worktree_label"]:
        errors.append("now_observation worktree_label does not match registry")
    for key in (
        "task",
        "actor",
        "lane_state",
        "current_action",
        "last_evidenced_change",
        "blockers",
        "checks",
        "release",
    ):
        if key not in observation:
            errors.append(f"now_observation missing {key}")
    serialized = json.dumps(observation)
    if "/Users/" in serialized or "file://" in serialized:
        errors.append("now_observation contains a raw private path")

    for key in ("lane_state", "current_action"):
        value = observation.get(key)
        if (
            isinstance(value, dict)
            and value.get("evidence_class") not in EVIDENCE_CLASSES
        ):
            errors.append(f"now_observation {key} has invalid evidence_class")
    return errors


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
    receipt_errors = validate_receipt(args.lane, lane, args.base)

    print(f"lane={args.lane}")
    print(f"branch={branch}")
    print(f"base={args.base}")
    print(f"head={args.head}")
    print(f"changed_paths={len(paths)}")
    for path in paths:
        print(f"  {path}")

    if violations or receipt_errors:
        print("CUSTODY_FAIL", file=sys.stderr)
        for path in violations:
            print(f"  outside allowlist: {path}", file=sys.stderr)
        for error in receipt_errors:
            print(f"  {error}", file=sys.stderr)
        return 1

    print("CUSTODY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
