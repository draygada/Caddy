#!/usr/bin/env python3
"""Generate an external receipt bound to an already-integrated exact candidate."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = (
    SCRIPT_ROOT
    / "governance"
    / "templates"
    / "candidate-integration-release-receipt.v1.template.json"
)
PROVENANCE_PATH = "docs/imports/tripwire-898f6167.json"
UNIFIED_PROVENANCE_PATH = "docs/imports/tripwire-unified-20260905.json"
TRIPWIRE_PREFIX = "features/tripwire"
OID_PATTERNS = {"sha1": re.compile(r"^[0-9a-f]{40}$"), "sha256": re.compile(r"^[0-9a-f]{64}$")}


class ReceiptError(RuntimeError):
    pass


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        capture_output=True,
    )
    if check and completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ReceiptError(f"git {' '.join(args)} failed: {detail}")
    return completed


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="strict").strip()


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def file_evidence(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise ReceiptError(f"evidence file does not exist: {path}")
    payload = path.read_bytes()
    return {"name": path.name, "bytes": len(payload), "sha256": sha256_bytes(payload)}


def parse_check(value: str) -> dict[str, str]:
    name, separator, evidence = value.partition("=")
    if not separator or not name.strip() or not evidence.strip():
        raise argparse.ArgumentTypeError("checks must use NAME=EVIDENCE with both values non-empty")
    return {"name": name.strip(), "status": "PASS", "evidence": evidence.strip()}


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def resolve_repo(path: Path) -> Path:
    root = git_text(path, "rev-parse", "--show-toplevel")
    return Path(root).resolve()


def require_ignored_output(repo: Path, output: Path) -> None:
    try:
        relative = output.relative_to(repo).as_posix()
    except ValueError:
        return
    if git(repo, "ls-files", "--error-unmatch", "--", relative, check=False).returncode == 0:
        raise ReceiptError(f"receipt output must not be tracked: {relative}")
    if git(repo, "check-ignore", "-q", "--no-index", "--", relative, check=False).returncode != 0:
        raise ReceiptError(f"receipt output inside the repository must be ignored: {relative}")


def verify_git_binding(repo: Path, candidate: str, branch: str) -> tuple[str, str, str, str]:
    object_format = git_text(repo, "rev-parse", "--show-object-format")
    pattern = OID_PATTERNS.get(object_format)
    if pattern is None or pattern.fullmatch(candidate) is None:
        raise ReceiptError(f"candidate must be a full {object_format} object id, not a symbolic ref")

    resolved_candidate = git_text(repo, "rev-parse", "--verify", f"{candidate}^{{commit}}")
    if resolved_candidate != candidate:
        raise ReceiptError("candidate did not resolve to the supplied full commit hash")
    if git(repo, "check-ref-format", "--branch", branch, check=False).returncode != 0:
        raise ReceiptError(f"invalid branch name: {branch}")
    branch_candidate = git_text(repo, "rev-parse", "--verify", f"refs/heads/{branch}^{{commit}}")
    if branch_candidate != candidate:
        raise ReceiptError(f"branch {branch} does not point to candidate {candidate}")
    if git_text(repo, "branch", "--show-current") != branch:
        raise ReceiptError(f"checked-out branch is not {branch}")
    if git_text(repo, "rev-parse", "HEAD") != candidate:
        raise ReceiptError("HEAD does not equal the candidate hash")
    if git(repo, "status", "--porcelain", "--untracked-files=no").stdout:
        raise ReceiptError("tracked worktree or index is dirty")

    candidate_tree = git_text(repo, "rev-parse", f"{candidate}^{{tree}}")
    common_dir_value = git_text(repo, "rev-parse", "--git-common-dir")
    common_dir = Path(common_dir_value)
    if not common_dir.is_absolute():
        common_dir = repo / common_dir
    return candidate_tree, str(common_dir.resolve()), object_format, resolved_candidate


def verify_tripwire(repo: Path, candidate: str) -> dict[str, object]:
    manifest_bytes = git(repo, "show", f"{candidate}:{PROVENANCE_PATH}").stdout
    try:
        manifest = json.loads(manifest_bytes)
        source_commit = manifest["source"]["commit"]
        source_root_tree = manifest["source"]["root_tree"]
        imported = manifest["import"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ReceiptError(f"invalid Tripwire provenance manifest: {exc}") from exc

    source_tree_oid = source_root_tree["oid"]
    expected_tree = source_tree_oid
    provenance_path = PROVENANCE_PATH
    provenance_bytes = manifest_bytes
    unified_result = git(repo, "show", f"{candidate}:{UNIFIED_PROVENANCE_PATH}", check=False)
    if unified_result.returncode == 0:
        provenance_bytes = unified_result.stdout
        provenance_path = UNIFIED_PROVENANCE_PATH
        try:
            unified = json.loads(provenance_bytes)
            if unified["schema_version"] != "caddydaddy.import-provenance/2":
                raise ReceiptError("unexpected unified Tripwire provenance schema")
            if unified["base_manifest"] != PROVENANCE_PATH:
                raise ReceiptError("unified Tripwire provenance does not bind the base manifest")
            if unified["prefix"] != TRIPWIRE_PREFIX:
                raise ReceiptError(f"unexpected unified Tripwire import prefix: {unified['prefix']}")
            original = unified["original_import"]
            if original != {
                "source_commit": source_commit["oid"],
                "source_tree": source_root_tree["oid"],
                "import_commit": imported["commit"],
            }:
                raise ReceiptError("unified Tripwire provenance does not bind the original import")
            expected_tree = unified["current_prefix_tree"]
            deltas = unified["applied_deltas"]
            ancestry_merges = unified["ancestry_merges"]
            if not isinstance(deltas, list) or not isinstance(ancestry_merges, list):
                raise ReceiptError("unified Tripwire provenance lists are invalid")
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise ReceiptError(f"invalid unified Tripwire provenance manifest: {exc}") from exc

        merged_sources: set[str] = set()
        for entry in ancestry_merges:
            try:
                source_head = entry["source_head"]
                merge_commit = entry["merge_commit"]
            except (KeyError, TypeError) as exc:
                raise ReceiptError(f"invalid Tripwire ancestry merge record: {exc}") from exc
            parents = git_text(repo, "rev-list", "--parents", "-n", "1", merge_commit).split()[1:]
            if source_head not in parents:
                raise ReceiptError(
                    f"Tripwire source {source_head} is not a parent of recorded merge {merge_commit}"
                )
            if git(repo, "merge-base", "--is-ancestor", merge_commit, candidate, check=False).returncode != 0:
                raise ReceiptError(f"recorded Tripwire ancestry merge is not in candidate: {merge_commit}")
            merged_sources.add(source_head)

        for entry in deltas:
            try:
                source_head = entry["source_head"]
                content_commit = entry["commit"]
            except (KeyError, TypeError) as exc:
                raise ReceiptError(f"invalid Tripwire content delta record: {exc}") from exc
            if source_head not in merged_sources:
                raise ReceiptError(f"Tripwire delta source lacks an ancestry merge: {source_head}")
            if git(repo, "merge-base", "--is-ancestor", content_commit, candidate, check=False).returncode != 0:
                raise ReceiptError(f"recorded Tripwire content commit is not in candidate: {content_commit}")
            changed_paths = git_text(
                repo, "diff-tree", "--no-commit-id", "--name-only", "-r", content_commit
            ).splitlines()
            if not changed_paths or any(
                path != TRIPWIRE_PREFIX and not path.startswith(f"{TRIPWIRE_PREFIX}/")
                for path in changed_paths
            ):
                raise ReceiptError(f"Tripwire content commit escaped its prefix: {content_commit}")

    candidate_tree = git_text(repo, "rev-parse", f"{candidate}:{TRIPWIRE_PREFIX}")
    if candidate_tree != expected_tree:
        raise ReceiptError(
            f"Tripwire prefix drift: candidate={candidate_tree}, recorded_prefix_tree={expected_tree}"
        )
    if provenance_path == PROVENANCE_PATH and imported["prefix_tree"] != expected_tree:
        raise ReceiptError("original Tripwire import tree does not match its source tree")
    if imported["prefix"] != TRIPWIRE_PREFIX:
        raise ReceiptError(f"unexpected Tripwire import prefix: {imported['prefix']}")

    source_oid = source_commit["oid"]
    if git_text(repo, "rev-parse", f"{source_oid}^{{tree}}") != source_tree_oid:
        raise ReceiptError("recorded Tripwire source commit does not own the recorded root tree")
    source_content = git(repo, "cat-file", "commit", source_oid).stdout
    tree_content = git(repo, "cat-file", "tree", source_tree_oid).stdout
    if sha256_bytes(source_content) != source_commit["content_sha256"]:
        raise ReceiptError("Tripwire source commit content SHA-256 mismatch")
    if sha256_bytes(tree_content) != source_root_tree["content_sha256"]:
        raise ReceiptError("Tripwire root-tree content SHA-256 mismatch")
    if git(repo, "merge-base", "--is-ancestor", imported["commit"], candidate, check=False).returncode != 0:
        raise ReceiptError("recorded Tripwire import commit is not an ancestor of candidate")

    return {
        "provenance_manifest_path": provenance_path,
        "provenance_manifest_sha256": sha256_bytes(provenance_bytes),
        "source_commit": {
            "oid": source_oid,
            "content_sha256": source_commit["content_sha256"],
        },
        "source_root_tree": {
            "oid": source_tree_oid,
            "content_sha256": source_root_tree["content_sha256"],
        },
        "import_commit": imported["commit"],
        "import_prefix": TRIPWIRE_PREFIX,
        "candidate_prefix_tree": candidate_tree,
        "byte_identity": "PROVEN",
    }


def build_receipt(args: argparse.Namespace) -> tuple[dict[str, object], Path]:
    repo = resolve_repo(args.repo)
    candidate_tree, common_dir, object_format, candidate = verify_git_binding(
        repo, args.candidate, args.branch
    )
    output = args.output
    if output is None:
        output = repo / ".release-evidence" / f"candidate-integration-release-receipt.{candidate}.json"
    elif not output.is_absolute():
        output = repo / output
    output = output.resolve()
    require_ignored_output(repo, output)

    checks = args.check
    names = [item["name"] for item in checks]
    if len(names) != len(set(names)):
        raise ReceiptError("check names must be unique")
    exclusions = list(dict.fromkeys(args.exclusion))

    template = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
    receipt = copy.deepcopy(template)
    receipt.update(
        {
            "schema_version": "forge.candidate-integration-release-receipt/1",
            "generated_at": args.generated_at
            or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "repository": {
                "name": args.repository_name or repo.name,
                "root": str(repo),
                "git_common_dir": common_dir,
                "object_format": object_format,
            },
            "candidate": {
                "branch": args.branch,
                "full_hash": candidate,
                "tree_hash": candidate_tree,
                "clean_tracked_worktree": True,
            },
            "tripwire_import": verify_tripwire(repo, candidate),
            "authorization": {"quote": args.authorization_quote, "scope": args.authorization_scope},
            "sanitized_bundle": {
                "declaration": "SANITIZED",
                "manifest": file_evidence(args.bundle_manifest.resolve()),
                "archive": file_evidence(args.bundle_archive.resolve()),
            },
            "target": {"project": args.target_project, "alias": args.target_alias, "mutation_effect": "NONE"},
            "claim_ceiling": args.claim_ceiling,
            "boundaries": {
                "spend_authority": "NOT_GRANTED",
                "real_data": "PROHIBITED",
                "public_git": "PROHIBITED",
                "deployment": "PROHIBITED",
                "provider_mutation": "PROHIBITED",
                "credential_use": "PROHIBITED",
            },
            "checks": checks,
            "rollback": {"instruction": args.rollback},
            "exclusions": exclusions,
        }
    )

    receipt.pop("receipt_id", None)
    receipt.pop("receipt_hash", None)
    digest = sha256_bytes(canonical_bytes(receipt))
    receipt["receipt_id"] = f"candidate-integration-release-receipt:{digest}"
    receipt["receipt_hash"] = digest
    ordered = {key: receipt[key] for key in template}
    return ordered, output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--repository-name")
    parser.add_argument("--branch", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--authorization-quote", required=True)
    parser.add_argument("--authorization-scope", required=True)
    parser.add_argument("--bundle-manifest", type=Path, required=True)
    parser.add_argument("--bundle-archive", type=Path, required=True)
    parser.add_argument("--target-project", required=True)
    parser.add_argument("--target-alias", required=True)
    parser.add_argument("--claim-ceiling", required=True)
    parser.add_argument("--check", action="append", required=True, type=parse_check, metavar="NAME=EVIDENCE")
    parser.add_argument("--rollback", required=True)
    parser.add_argument("--exclusion", action="append", required=True)
    parser.add_argument("--generated-at", help="RFC 3339 timestamp override for reproducible test fixtures")
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    try:
        receipt, output = build_receipt(parse_args())
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, delete=False) as handle:
            json.dump(receipt, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            temporary = Path(handle.name)
        os.replace(temporary, output)
    except (OSError, ReceiptError, json.JSONDecodeError) as exc:
        print(f"RECEIPT_GENERATION_FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"RECEIPT_GENERATION_PASS output={output}")
    print(f"candidate={receipt['candidate']['full_hash']}")
    print(f"receipt_hash={receipt['receipt_hash']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
