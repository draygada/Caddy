"""Portable import boundary for the product-service integration suite."""

from pathlib import Path
import atexit
import os
import subprocess
import sys
import tempfile


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

for source_root in (
    REPOSITORY_ROOT / "apps" / "product-service",
    REPOSITORY_ROOT / "packages" / "compliance-bridge",
    REPOSITORY_ROOT / "packages" / "core-kernel" / "src",
):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)


_snapshot_directory = tempfile.TemporaryDirectory(prefix="caddydaddy-test-snapshot-")
atexit.register(_snapshot_directory.cleanup)
_snapshot_path = Path(_snapshot_directory.name) / "candidate-snapshot.v1.json"
_source_commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPOSITORY_ROOT, check=True, capture_output=True, text=True).stdout.strip()
_source_commit_tree = subprocess.run(["git", "rev-parse", "HEAD^{tree}"], cwd=REPOSITORY_ROOT, check=True, capture_output=True, text=True).stdout.strip()
_source_tree = subprocess.run(["git", "write-tree"], cwd=REPOSITORY_ROOT, check=True, capture_output=True, text=True).stdout.strip()
subprocess.run(
    [
        sys.executable,
        str(REPOSITORY_ROOT / "apps" / "product-service" / "scripts" / "generate_snapshot.py"),
        "--output", str(_snapshot_path),
        "--source-commit", _source_commit,
        "--source-tree", _source_tree,
        "--source-commit-tree", _source_commit_tree,
        "--source-tree-state", "COMMITTED" if _source_tree == _source_commit_tree else "STAGED_CANDIDATE",
        "--build-command", "test-core-snapshot-generation",
    ],
    cwd=REPOSITORY_ROOT,
    check=True,
    timeout=90,
)
os.environ["CADDYDADDY_SNAPSHOT_PATH"] = str(_snapshot_path)
