"""Build a deterministic, allowlist-only Vercel deployment root."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
TEMPLATE_ROOT = SERVICE_ROOT / "vercel"
MANIFEST_NAME = "BUNDLE_MANIFEST.json"
SCHEMA_VERSION = "caddydaddy.native-cad-vercel-bundle/1"
RUNTIME = {
    "python": "3.12",
    "fastapi": "0.141.1",
    "starlette": "1.6.0",
    "uvicorn": "0.52.4",
    "pydantic": "2.13.5",
    "cadquery-ocp-novtk": "7.9.3.1",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def selected_files() -> list[tuple[Path, Path]]:
    files: list[tuple[Path, Path]] = [
        (SERVICE_ROOT / "api" / "__init__.py", Path("api/__init__.py")),
        (SERVICE_ROOT / "api" / "index.py", Path("api/index.py")),
        (SERVICE_ROOT / "THIRD_PARTY_NOTICES.md", Path("THIRD_PARTY_NOTICES.md")),
        (SERVICE_ROOT / "REDISTRIBUTION_EVIDENCE.md", Path("REDISTRIBUTION_EVIDENCE.md")),
        (TEMPLATE_ROOT / ".python-version", Path(".python-version")),
        (TEMPLATE_ROOT / "requirements.txt", Path("requirements.txt")),
        (TEMPLATE_ROOT / "vercel.json", Path("vercel.json")),
    ]
    files.extend(
        (path, Path("cad_service") / path.name)
        for path in sorted((SERVICE_ROOT / "cad_service").glob("*.py"))
    )
    files.extend(
        (path, Path("licenses") / path.relative_to(SERVICE_ROOT / "licenses"))
        for path in sorted((SERVICE_ROOT / "licenses").rglob("*"))
        if path.is_file()
    )
    return sorted(files, key=lambda item: item[1].as_posix())


def aggregate_hash(records: list[dict[str, object]]) -> str:
    digest = hashlib.sha256()
    for record in records:
        digest.update(str(record["output_path"]).encode("utf-8"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(str(record["sha256"])))
        digest.update(b"\0")
    return digest.hexdigest()


def build(output: Path, *, require_clean: bool = False) -> dict[str, object]:
    output = output.resolve()
    if output == REPO_ROOT or output == SERVICE_ROOT or REPO_ROOT in output.parents:
        raise ValueError("output must be a new directory outside the repository")
    if output.exists():
        raise FileExistsError(f"output already exists: {output}")

    dirty = bool(git("status", "--porcelain", "--untracked-files=all", "--", "apps/cad-service"))
    if require_clean and dirty:
        raise RuntimeError("apps/cad-service must be clean for a release bundle")

    output.mkdir(parents=True, mode=0o755)
    records: list[dict[str, object]] = []
    for source, relative in selected_files():
        if source.is_symlink() or not source.is_file():
            raise RuntimeError(f"bundle source must be a regular file: {source}")
        if any(part in {"__pycache__", ".pytest_cache", ".venv", "tests", "scripts"} for part in relative.parts):
            raise RuntimeError(f"forbidden deployment path: {relative}")
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        content = source.read_bytes()
        destination.write_bytes(content)
        os.chmod(destination, 0o644)
        records.append(
            {
                "output_path": relative.as_posix(),
                "source_path": source.relative_to(REPO_ROOT).as_posix(),
                "bytes": len(content),
                "sha256": sha256_bytes(content),
            }
        )

    payload_bytes = sum(int(record["bytes"]) for record in records)
    manifest: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "source": {
            "commit": git("rev-parse", "HEAD"),
            "apps_cad_service_dirty": dirty,
            "payload_sha256": aggregate_hash(records),
        },
        "runtime": RUNTIME,
        "limits": {
            "request_bytes": 4_000_000,
            "response_bytes": 4_000_000,
            "vercel_standard_python_uncompressed_bytes": 500 * 1024 * 1024,
        },
        "payload_bytes": payload_bytes,
        "file_count": len(records),
        "files": records,
        "contains_secrets": False,
        "state": "STATELESS",
        "legal_determination": "NOT_PERFORMED",
    }
    encoded = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    manifest_path = output / MANIFEST_NAME
    manifest_path.write_bytes(encoded)
    os.chmod(manifest_path, 0o644)
    return {
        "output": str(output),
        "source_commit": manifest["source"]["commit"],
        "source_dirty": dirty,
        "payload_sha256": manifest["source"]["payload_sha256"],
        "manifest_sha256": sha256_bytes(encoded),
        "deployment_root_bytes": payload_bytes + len(encoded),
        "file_count": len(records) + 1,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--require-clean", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(args.output, require_clean=args.require_clean), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
