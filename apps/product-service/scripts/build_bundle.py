#!/usr/bin/env python3
"""Build an allowlist-only local candidate bundle and emit its resolved manifest."""

from __future__ import annotations

import argparse
from fnmatch import fnmatch
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

REPO = Path(__file__).resolve().parents[3]
POLICY = REPO / "apps" / "product-service" / "bundle-manifest.v1.json"
RESOLVED_MANIFEST = "bundle-manifest.resolved.json"
SNAPSHOT_GENERATOR = REPO / "apps" / "product-service" / "scripts" / "generate_snapshot.py"
LIVE_LLM_ENV_NAMES = (
    "REAL_LLM_AUTHORIZED",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "CADDYDADDY_LIVE_LLM_ACCESS_TOKEN",
    "CADDYDADDY_LIVE_LLM_CALLS_CAP",
    "CADDYDADDY_LIVE_LLM_COST_CAP_MICROUSD",
    "CADDYDADDY_LIVE_LLM_ESTIMATED_CALL_COST_MICROUSD",
)


def _relative_path(value: str, label: str) -> Path:
    path = Path(value)
    if path.is_absolute() or path == Path(".") or ".." in path.parts:
        raise SystemExit(f"{label} must be a safe relative path: {value}")
    return path


def _write_archive(bundle: Path, archive: Path) -> None:
    archive.parent.mkdir(parents=True, exist_ok=True)
    with archive.open("xb") as raw_archive:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw_archive, mtime=0, compresslevel=9) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as tar:
                for source in sorted(path for path in bundle.rglob("*") if path.is_file()):
                    relative = source.relative_to(bundle).as_posix()
                    content = source.read_bytes()
                    info = tarfile.TarInfo(relative)
                    info.size = len(content)
                    info.mode = 0o644
                    info.mtime = 0
                    info.uid = 0
                    info.gid = 0
                    info.uname = ""
                    info.gname = ""
                    import io

                    tar.addfile(info, io.BytesIO(content))


def _git_output(*args: str) -> str:
    completed = subprocess.run(["git", *args], cwd=REPO, check=True, capture_output=True, text=True, timeout=10)
    return completed.stdout.strip()


def _source_identity() -> dict[str, str]:
    unstaged = subprocess.run(["git", "diff", "--quiet", "--"], cwd=REPO, check=False, timeout=10)
    untracked = _git_output("ls-files", "--others", "--exclude-standard")
    if unstaged.returncode != 0 or untracked:
        raise SystemExit("Source worktree must match the Git index before snapshot generation.")
    commit = _git_output("rev-parse", "--verify", "HEAD")
    commit_tree = _git_output("rev-parse", "--verify", "HEAD^{tree}")
    tree = _git_output("write-tree")
    tree_state = "COMMITTED" if tree == commit_tree else "STAGED_CANDIDATE"
    return {"commit": commit, "tree": tree, "commit_tree": commit_tree, "tree_state": tree_state}


def _verify_runtime(bundle: Path, runtime_imports: list[str]) -> dict[str, object]:
    probe = r'''
import importlib
import json
import os

from api.index import handler

for module in json.loads(os.environ["CADDYDADDY_BUNDLE_IMPORTS"]):
    importlib.import_module(module)

from product_service.app import (
    CANDIDATE02_POST_ROUTES,
    RELEASE_CANDIDATE_ID,
    RELEASE_CANDIDATE_VERSION,
    RELEASE_REVISION_ID,
    Candidate02Routes,
    CandidateRuntime,
)

runtime = CandidateRuntime()
routes = Candidate02Routes.from_runtime(runtime)
missing = sorted(set(CANDIDATE02_POST_ROUTES) - routes.post_paths)
if missing:
    raise RuntimeError(f"Candidate 0.2 routes failed to mount: {missing}")
health = runtime.health()
expected_identity = {
    "candidate_id": RELEASE_CANDIDATE_ID,
    "revision_id": RELEASE_REVISION_ID,
    "snapshot_sha256": runtime.state.snapshot_receipt["document_sha256"],
}
if health.get("candidate") != RELEASE_CANDIDATE_VERSION or routes.candidate_identity != expected_identity:
    raise RuntimeError("Candidate 0.2 release identity did not survive isolated bundle startup")

classification_status, classification_body = routes.dispatch("/api/classification", {
    "product_or_part": "Public synthetic fastener",
    "item_kind": "commodity",
    "facts": {"source": "isolated bundle smoke"},
    "budget": {"calls_cap": 4, "cost_cap_microusd": 1000000, "estimated_cost_microusd": 1000},
})
if classification_status != 200:
    raise RuntimeError(f"Bundled classification route failed: {classification_status} {classification_body.get('diagnostic', {})}")

order_status, order_body = routes.dispatch("/api/orders/packages/validate", {
    "candidate": {
        "candidate_id": expected_identity["candidate_id"],
        "revision": expected_identity["revision_id"],
        "artifact_sha256": expected_identity["snapshot_sha256"],
    }
})
order_boundary = order_body.get("runtime_boundary", {})
if order_status == 503 or order_boundary.get("connector") != "RECORDING_ONLY" or order_boundary.get("external_effect") != "NONE" or order_boundary.get("external_calls") != 0:
    raise RuntimeError(f"Bundled inline order route failed its no-effect startup smoke: {order_status}")

print(json.dumps({
    "handler": handler.__name__,
    "post_routes": sorted(routes.post_paths),
    "candidate_identity": routes.candidate_identity,
    "health_candidate": health["candidate"],
    "classification_status": classification_status,
    "classification_determination": classification_body.get("determination"),
    "classification_model": classification_body.get("provenance", {}).get("model"),
    "order_status": order_status,
    "order_boundary": order_boundary,
}))
'''
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("CADDYDADDY_SNAPSHOT_PATH", None)
    for name in LIVE_LLM_ENV_NAMES:
        environment.pop(name, None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment["CADDYDADDY_BUNDLE_IMPORTS"] = json.dumps(runtime_imports)
    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=bundle,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if completed.returncode != 0:
        raise SystemExit(f"Sanitized bundle runtime probe failed: {completed.stderr.strip()}")
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit("Sanitized bundle runtime probe returned invalid evidence.") from error
    if result.get("handler") != "handler":
        raise SystemExit("Sanitized bundle runtime probe did not load the Vercel handler.")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    archive = (args.archive or output.with_name(output.name + ".tar.gz")).resolve()
    if output.exists():
        raise SystemExit("Output already exists; refusing to overwrite it.")
    if archive.exists():
        raise SystemExit("Archive already exists; refusing to overwrite it.")
    if output == REPO or REPO in output.parents or archive == REPO or REPO in archive.parents:
        raise SystemExit("Bundle output and archive must be outside the source repository.")
    if output == archive or output in archive.parents:
        raise SystemExit("Archive must be outside the bundle directory.")
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    excluded = tuple(policy["excluded"])
    forbidden_content = tuple(item.encode("utf-8") for item in policy["forbidden_content"])

    def is_excluded(relative: str) -> bool:
        return any(fnmatch(relative, pattern) for pattern in excluded)

    payloads: dict[str, tuple[str, bytes]] = {}

    def admit_content(source_relative: str, target_relative: Path, content: bytes) -> None:
        target_name = target_relative.as_posix()
        if is_excluded(source_relative) or is_excluded(target_name):
            raise SystemExit(f"Excluded path entered bundle allowlist: {source_relative} -> {target_name}")
        if target_name in payloads:
            raise SystemExit(f"Multiple sources target the same bundle path: {target_name}")
        if str(REPO).encode() in content or b"/Users/" in content:
            raise SystemExit(f"Absolute workspace path found in runtime file: {source_relative}")
        for marker in forbidden_content:
            if marker in content:
                raise SystemExit(f"Forbidden content marker found in runtime file: {source_relative}")
        payloads[target_name] = (source_relative, content)

    def admit(source: Path, target_relative: Path) -> None:
        if source.is_symlink():
            raise SystemExit(f"Symlinks are not admitted: {source.relative_to(REPO)}")
        source_relative = source.relative_to(REPO).as_posix()
        content = source.read_bytes()
        admit_content(source_relative, target_relative, content)

    for mapping in policy["required_trees"]:
        source_root = _relative_path(mapping["source"], "tree source")
        target_root = _relative_path(mapping["target"], "tree target")
        root = REPO / source_root
        if not root.is_dir():
            raise SystemExit(f"Required runtime tree is missing: {source_root.as_posix()}")
        for source in sorted(path for path in root.rglob("*") if path.is_file()):
            source_relative = source.relative_to(REPO).as_posix()
            if is_excluded(source_relative):
                continue
            admit(source, target_root / source.relative_to(root))
    for mapping in policy["required_files"]:
        source_relative = _relative_path(mapping["source"], "file source")
        target_relative = _relative_path(mapping["target"], "file target")
        source = REPO / source_relative
        if not source.is_file():
            raise SystemExit(f"Required runtime file is missing: {source_relative.as_posix()}")
        admit(source, target_relative)

    source_identity = _source_identity()
    snapshot_policy = policy["generated_snapshot"]
    snapshot_target = _relative_path(snapshot_policy["target"], "snapshot target")
    with tempfile.TemporaryDirectory(prefix="caddydaddy-snapshot-") as temporary:
        snapshot_path = Path(temporary) / "candidate-snapshot.v1.json"
        command = [
            sys.executable,
            str(SNAPSHOT_GENERATOR),
            "--output", str(snapshot_path),
            "--source-commit", source_identity["commit"],
            "--source-tree", source_identity["tree"],
            "--source-commit-tree", source_identity["commit_tree"],
            "--source-tree-state", source_identity["tree_state"],
            "--build-command", policy["build_command"],
        ]
        try:
            subprocess.run(command, cwd=REPO, check=True, capture_output=True, text=True, timeout=90)
        except subprocess.CalledProcessError as error:
            raise SystemExit(f"Core snapshot generation failed: {error.stderr.strip()}") from error
        snapshot_bytes = snapshot_path.read_bytes()
        snapshot = json.loads(snapshot_bytes)
    if snapshot["schema_version"] != snapshot_policy["schema_version"] or snapshot["source"] != source_identity:
        raise SystemExit("Generated snapshot identity does not match the resolved source identity.")
    admit_content("generated/core-snapshot", snapshot_target, snapshot_bytes)

    records = []
    for target_name, (source_relative, content) in sorted(payloads.items()):
        target = output / target_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        target.chmod(0o644)
        records.append({"path": target_name, "source": source_relative, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    closure_bytes = json.dumps(records, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest = {
        "schema_version": policy["schema_version"],
        "candidate": policy["candidate"],
        "target": policy["target"],
        "python": policy["python"],
        "source": source_identity,
        "build_command": policy["build_command"],
        "runtime_dependency_closure": policy["runtime_dependency_closure"],
        "generated_snapshot": {
            "path": snapshot_target.as_posix(),
            "schema_version": snapshot["schema_version"],
            "file_sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
            "document_sha256": snapshot["snapshot_hash"],
            "provenance": snapshot["generation"],
            "core": snapshot["core"],
        },
        "tripwire": snapshot["tripwire"],
        "files": records,
        "payload_file_count": len(records),
        "payload_bytes": sum(record["bytes"] for record in records),
        "closure_sha256": hashlib.sha256(closure_bytes).hexdigest(),
        "excluded": policy["excluded"],
        "provider_state": "NOT_INCLUDED",
    }
    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    (output / RESOLVED_MANIFEST).write_bytes(manifest_bytes)
    (output / RESOLVED_MANIFEST).chmod(0o644)
    runtime_probe = _verify_runtime(output, list(policy.get("runtime_imports", [])))
    _write_archive(output, archive)
    bundle_files = [path for path in output.rglob("*") if path.is_file()]
    print(json.dumps({
        "output": output.name,
        "archive": archive.name,
        "payload_file_count": len(records),
        "bundle_file_count": len(bundle_files),
        "payload_bytes": manifest["payload_bytes"],
        "bundle_bytes": sum(path.stat().st_size for path in bundle_files),
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "closure_sha256": manifest["closure_sha256"],
        "snapshot_sha256": snapshot["snapshot_hash"],
        "source_commit": source_identity["commit"],
        "source_tree": source_identity["tree"],
        "runtime_probe": runtime_probe,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
