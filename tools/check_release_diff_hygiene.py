#!/usr/bin/env python3
"""Check authored diff whitespace and imported Tripwire tree identity separately."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PROVENANCE_PATH = "docs/imports/tripwire-898f6167.json"
TRIPWIRE_PREFIX = "features/tripwire"


class HygieneError(RuntimeError):
    pass


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        capture_output=True,
    )
    if check and completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise HygieneError(f"git {' '.join(args)} failed: {detail}")
    return completed


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def load_manifest(repo: Path, revision: str) -> dict[str, object]:
    payload = git(repo, "show", f"{revision}:{PROVENANCE_PATH}").stdout
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HygieneError(f"invalid provenance manifest at {revision}: {exc}") from exc


def path_matches(path: str, patterns: list[str]) -> bool:
    if not patterns:
        return not (path == TRIPWIRE_PREFIX or path.startswith(TRIPWIRE_PREFIX + "/"))
    for pattern in patterns:
        if pattern.endswith("/**"):
            prefix = pattern[:-3].rstrip("/")
            if path == prefix or path.startswith(prefix + "/"):
                return True
        elif path == pattern:
            return True
    return False


def changed_paths(repo: Path, base: str, candidate: str) -> list[str]:
    payload = git(repo, "diff", "--name-only", "-z", base, candidate).stdout
    return sorted(item.decode("utf-8", errors="strict") for item in payload.split(b"\0") if item)


def check_authored_whitespace(
    repo: Path, base: str, candidate: str, patterns: list[str]
) -> tuple[list[str], str | None]:
    authored = [path for path in changed_paths(repo, base, candidate) if path_matches(path, patterns)]
    if not authored:
        return authored, None
    completed = git(repo, "diff", "--check", base, candidate, "--", *authored, check=False)
    if completed.returncode == 0:
        return authored, None
    detail = (completed.stdout + completed.stderr).decode("utf-8", errors="replace").strip()
    return authored, detail or "git diff --check failed without diagnostics"


def check_tripwire_identity(repo: Path, provenance_ref: str, candidate: str) -> tuple[str, str]:
    recorded = load_manifest(repo, provenance_ref)
    candidate_manifest = load_manifest(repo, candidate)
    try:
        expected_tree = recorded["source"]["root_tree"]["oid"]
        source_commit = recorded["source"]["commit"]["oid"]
        candidate_recorded_tree = candidate_manifest["source"]["root_tree"]["oid"]
        candidate_import = candidate_manifest["import"]
    except (KeyError, TypeError) as exc:
        raise HygieneError(f"incomplete Tripwire provenance manifest: {exc}") from exc

    actual_tree = git_text(repo, "rev-parse", f"{candidate}:{TRIPWIRE_PREFIX}")
    source_tree = git_text(repo, "rev-parse", f"{source_commit}^{{tree}}")
    if candidate_recorded_tree != expected_tree:
        raise HygieneError(
            f"TRIPWIRE_PROVENANCE_DRIFT candidate manifest={candidate_recorded_tree} base={expected_tree}"
        )
    if candidate_import.get("prefix") != TRIPWIRE_PREFIX or candidate_import.get("prefix_tree") != expected_tree:
        raise HygieneError("TRIPWIRE_PROVENANCE_DRIFT candidate import binding changed")
    if source_tree != expected_tree:
        raise HygieneError(f"TRIPWIRE_SOURCE_DRIFT source={source_tree} recorded={expected_tree}")
    if actual_tree != expected_tree:
        raise HygieneError(f"TRIPWIRE_TREE_DRIFT candidate={actual_tree} recorded={expected_tree}")
    return actual_tree, expected_tree


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--base", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument(
        "--provenance-ref",
        help="revision containing the accepted provenance record; defaults to --base",
    )
    parser.add_argument(
        "--authored-path",
        action="append",
        default=[],
        help="exact path or prefix/**; defaults to every changed path outside features/tripwire",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        repo = Path(git_text(args.repo, "rev-parse", "--show-toplevel")).resolve()
        base = git_text(repo, "rev-parse", "--verify", f"{args.base}^{{commit}}")
        candidate = git_text(repo, "rev-parse", "--verify", f"{args.candidate}^{{commit}}")
        authored, whitespace_error = check_authored_whitespace(
            repo, base, candidate, args.authored_path
        )
        actual_tree, expected_tree = check_tripwire_identity(
            repo, args.provenance_ref or base, candidate
        )
    except HygieneError as exc:
        print(f"RELEASE_DIFF_HYGIENE_FAIL: {exc}", file=sys.stderr)
        return 1

    if whitespace_error is not None:
        print("RELEASE_DIFF_HYGIENE_FAIL: authored diff whitespace", file=sys.stderr)
        print(whitespace_error, file=sys.stderr)
        return 1
    print(f"AUTHORED_DIFF_HYGIENE_PASS paths={len(authored)}")
    print(f"TRIPWIRE_PROVENANCE_PASS candidate_tree={actual_tree} recorded_tree={expected_tree}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
