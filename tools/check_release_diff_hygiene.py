#!/usr/bin/env python3
"""Check authored diff whitespace and imported Tripwire tree identity separately."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PROVENANCE_PATH = "docs/imports/tripwire-898f6167.json"
UNIFIED_PROVENANCE_PATH = "docs/imports/tripwire-unified-20260905.json"
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


def load_json_path(repo: Path, revision: str, path: str) -> dict[str, object]:
    payload = git(repo, "show", f"{revision}:{path}").stdout
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HygieneError(f"invalid provenance manifest {path} at {revision}: {exc}") from exc
    if not isinstance(value, dict):
        raise HygieneError(f"invalid provenance manifest {path} at {revision}: expected object")
    return value


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

    if not isinstance(candidate_import, dict):
        raise HygieneError("TRIPWIRE_PROVENANCE_DRIFT candidate import binding is malformed")
    source_tree = git_text(repo, "rev-parse", f"{source_commit}^{{tree}}")
    if candidate_recorded_tree != expected_tree:
        raise HygieneError(
            f"TRIPWIRE_PROVENANCE_DRIFT candidate manifest={candidate_recorded_tree} base={expected_tree}"
        )
    if candidate_import.get("prefix") != TRIPWIRE_PREFIX or candidate_import.get("prefix_tree") != expected_tree:
        raise HygieneError("TRIPWIRE_PROVENANCE_DRIFT candidate import binding changed")
    if source_tree != expected_tree:
        raise HygieneError(f"TRIPWIRE_SOURCE_DRIFT source={source_tree} recorded={expected_tree}")
    composed_tree = expected_tree
    unified_exists = git(
        repo,
        "cat-file",
        "-e",
        f"{candidate}:{UNIFIED_PROVENANCE_PATH}",
        check=False,
    ).returncode == 0
    if unified_exists:
        unified = load_json_path(repo, candidate, UNIFIED_PROVENANCE_PATH)
        original = unified.get("original_import")
        deltas = unified.get("applied_deltas")
        ancestry_merges = unified.get("ancestry_merges")
        if (
            unified.get("schema_version") != "caddydaddy.import-provenance/2"
            or unified.get("base_manifest") != PROVENANCE_PATH
            or unified.get("prefix") != TRIPWIRE_PREFIX
            or not isinstance(original, dict)
            or not isinstance(deltas, list)
            or not isinstance(ancestry_merges, list)
        ):
            raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID receipt header is malformed")
        if (
            original.get("source_commit") != source_commit
            or original.get("source_tree") != expected_tree
            or original.get("import_commit") != candidate_import.get("commit")
        ):
            raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID original import binding changed")
        composed_tree = unified.get("current_prefix_tree")
        if not isinstance(composed_tree, str) or not composed_tree:
            raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID current prefix tree is missing")

        ancestry_heads: set[str] = set()
        for entry in ancestry_merges:
            if not isinstance(entry, dict):
                raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID ancestry entry is malformed")
            source_head = entry.get("source_head")
            merge_commit = entry.get("merge_commit")
            if not isinstance(source_head, str) or not isinstance(merge_commit, str):
                raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID ancestry identity is missing")
            if git(repo, "merge-base", "--is-ancestor", merge_commit, candidate, check=False).returncode != 0:
                raise HygieneError(f"TRIPWIRE_UNIFIED_PROVENANCE_INVALID merge {merge_commit} is not in candidate ancestry")
            parents = git_text(repo, "rev-list", "--parents", "-n", "1", merge_commit).split()[1:]
            if source_head not in parents:
                raise HygieneError(f"TRIPWIRE_UNIFIED_PROVENANCE_INVALID source {source_head} is not a direct merge parent")
            ancestry_heads.add(source_head)

        for entry in deltas:
            if not isinstance(entry, dict):
                raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID delta entry is malformed")
            source_head = entry.get("source_head")
            delta_commit = entry.get("commit")
            if not isinstance(source_head, str) or not isinstance(delta_commit, str):
                raise HygieneError("TRIPWIRE_UNIFIED_PROVENANCE_INVALID delta identity is missing")
            if source_head not in ancestry_heads:
                raise HygieneError(f"TRIPWIRE_UNIFIED_PROVENANCE_INVALID source {source_head} has no ancestry merge")
            if git(repo, "merge-base", "--is-ancestor", delta_commit, candidate, check=False).returncode != 0:
                raise HygieneError(f"TRIPWIRE_UNIFIED_PROVENANCE_INVALID delta {delta_commit} is not in candidate ancestry")
            delta_paths = git_text(
                repo,
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-only",
                "-r",
                delta_commit,
            ).splitlines()
            if any(path != TRIPWIRE_PREFIX and not path.startswith(TRIPWIRE_PREFIX + "/") for path in delta_paths):
                raise HygieneError(f"TRIPWIRE_UNIFIED_PROVENANCE_INVALID delta {delta_commit} escapes {TRIPWIRE_PREFIX}")

    actual_tree = git_text(repo, "rev-parse", f"{candidate}:{TRIPWIRE_PREFIX}")
    if actual_tree != composed_tree:
        raise HygieneError(f"TRIPWIRE_TREE_DRIFT candidate={actual_tree} recorded={composed_tree}")
    return actual_tree, composed_tree


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
