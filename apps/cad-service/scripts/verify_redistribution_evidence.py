#!/usr/bin/env python3
"""Verify objective native redistribution evidence without making a legal determination."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Iterable

SERVICE_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_MANIFEST = Path("licenses/native-runtime-manifest.v1.json")
SOURCE_MANIFEST = Path("licenses/native-source-artifacts.v1.json")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _check_file(root: Path, record: dict[str, Any], errors: list[str]) -> None:
    relative = record.get("path")
    if not isinstance(relative, str):
        errors.append("file record is missing path")
        return
    path = root / relative
    if not path.is_file():
        errors.append(f"missing evidence file: {relative}")
        return
    expected_size = record.get("bytes")
    actual_size = path.stat().st_size
    if actual_size != expected_size:
        errors.append(f"size mismatch: {relative}: {actual_size} != {expected_size}")
    expected_hash = record.get("sha256")
    actual_hash = sha256_file(path)
    if actual_hash != expected_hash:
        errors.append(f"sha256 mismatch: {relative}: {actual_hash} != {expected_hash}")


def _artifact_records(runtime: dict[str, Any], sources: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield runtime["artifact"]
    seen: set[tuple[str, str]] = set()
    for component in runtime["components"]:
        artifact = component.get("package_artifact")
        if artifact:
            key = (artifact["url"], artifact["sha256"])
            if key not in seen:
                seen.add(key)
                yield artifact
    for source_set in sources["source_sets"]:
        for artifact in source_set["artifacts"]:
            key = (artifact["url"], artifact["sha256"])
            if key not in seen:
                seen.add(key)
                yield artifact


def _fetch_artifact(record: dict[str, Any], cache: Path) -> tuple[Path, list[str]]:
    errors: list[str] = []
    cache.mkdir(parents=True, exist_ok=True)
    expected_hash = record["sha256"]
    destination = cache / expected_hash
    if not destination.is_file() or sha256_file(destination) != expected_hash:
        request = urllib.request.Request(
            record["url"],
            headers={"User-Agent": "CADdyDaddy-redistribution-evidence/1"},
        )
        with urllib.request.urlopen(request, timeout=240) as response:
            with destination.open("wb") as handle:
                shutil.copyfileobj(response, handle)
    actual_size = destination.stat().st_size
    actual_hash = sha256_file(destination)
    if actual_size != record["bytes"]:
        errors.append(
            f"download size mismatch: {record['url']}: "
            f"{actual_size} != {record['bytes']}"
        )
    if actual_hash != expected_hash:
        errors.append(
            f"download sha256 mismatch: {record['url']}: "
            f"{actual_hash} != {expected_hash}"
        )
    return destination, errors


def _fetch_and_verify(records: Iterable[dict[str, Any]], cache: Path) -> list[str]:
    errors: list[str] = []
    for record in records:
        _, artifact_errors = _fetch_artifact(record, cache)
        errors.extend(artifact_errors)
    return errors


def _verify_embedded_wheel_evidence(
    runtime: dict[str, Any],
    cache: Path,
) -> list[str]:
    errors: list[str] = []
    for component in runtime.get("components", []):
        records = component.get("wheel_evidence", [])
        if not records:
            continue
        artifact = component.get("package_artifact")
        if not artifact:
            errors.append(f"wheel evidence has no package artifact: {component.get('id')}")
            continue
        wheel, artifact_errors = _fetch_artifact(artifact, cache)
        errors.extend(artifact_errors)
        if artifact_errors:
            continue
        try:
            with zipfile.ZipFile(wheel) as archive:
                names = set(archive.namelist())
                for record in records:
                    wheel_path = record.get("wheel_path")
                    if wheel_path not in names:
                        errors.append(
                            f"missing wheel evidence member: {component.get('id')}: {wheel_path}"
                        )
                        continue
                    content = archive.read(wheel_path)
                    if len(content) != record.get("bytes"):
                        errors.append(
                            f"wheel evidence size mismatch: {wheel_path}: "
                            f"{len(content)} != {record.get('bytes')}"
                        )
                    actual_hash = sha256_bytes(content)
                    if actual_hash != record.get("sha256"):
                        errors.append(
                            f"wheel evidence sha256 mismatch: {wheel_path}: "
                            f"{actual_hash} != {record.get('sha256')}"
                        )
        except zipfile.BadZipFile:
            errors.append(f"invalid wheel archive: {component.get('id')}")
    return errors


def verify_evidence(
    service_root: Path = SERVICE_ROOT,
    site_packages: Path | None = None,
) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    runtime = _load_json(service_root / RUNTIME_MANIFEST)
    sources = _load_json(service_root / SOURCE_MANIFEST)

    if runtime.get("schema") != "caddydaddy.native-runtime/v1":
        errors.append("unexpected native-runtime manifest schema")
    if sources.get("schema") != "caddydaddy.native-source-artifacts/v1":
        errors.append("unexpected native-source manifest schema")

    source_ids = [item.get("id") for item in sources.get("source_sets", [])]
    if len(source_ids) != len(set(source_ids)):
        errors.append("duplicate source-set id")
    known_sources = set(source_ids)
    for source_set in sources.get("source_sets", []):
        if source_set.get("relationship") not in {"corresponding_source", "build_recipe"}:
            errors.append(f"invalid source relationship: {source_set.get('id')}")
        if not source_set.get("artifacts"):
            errors.append(f"source set has no artifact: {source_set.get('id')}")
        for artifact in source_set.get("artifacts", []):
            if not artifact.get("url", "").startswith("https://"):
                errors.append(f"non-HTTPS source URL: {source_set.get('id')}")
            if not isinstance(artifact.get("bytes"), int) or artifact["bytes"] <= 0:
                errors.append(f"invalid source size: {source_set.get('id')}")
            if len(artifact.get("sha256", "")) != 64:
                errors.append(f"invalid source sha256: {source_set.get('id')}")
            if not artifact.get("verified_on"):
                errors.append(f"source has no verification date: {source_set.get('id')}")

    components = runtime.get("components", [])
    component_ids = [item.get("id") for item in components]
    if len(component_ids) != len(set(component_ids)):
        errors.append("duplicate component id")
    known_components = set(component_ids)
    for component in components:
        component_id = component.get("id")
        if not component.get("declared_license"):
            errors.append(f"component has no objective license field: {component_id}")
        evidence = component.get("license_evidence", [])
        if not evidence:
            errors.append(f"component has no exact license evidence: {component_id}")
        for record in evidence:
            _check_file(service_root, record, errors)
        for record in component.get("package_metadata_evidence", []):
            _check_file(service_root, record, errors)
        for source_id in component.get("source_sets", []):
            if source_id not in known_sources:
                errors.append(f"unknown source set for {component_id}: {source_id}")

    auditwheel = runtime.get("auditwheel_sbom", {})
    _check_file(service_root, auditwheel, errors)
    auditwheel_path = service_root / auditwheel.get("path", "")
    if auditwheel_path.is_file():
        auditwheel_doc = _load_json(auditwheel_path)
        actual_count = len(auditwheel_doc.get("components", []))
        if actual_count != auditwheel.get("upstream_component_count"):
            errors.append(
                f"auditwheel component count mismatch: "
                f"{actual_count} != {auditwheel.get('upstream_component_count')}"
            )

    native_files = runtime.get("native_files", [])
    paths = [item.get("path") for item in native_files]
    if len(paths) != len(set(paths)):
        errors.append("duplicate native file path")
    if len(native_files) != runtime.get("expected_native_file_count"):
        errors.append("native file count does not match expected_native_file_count")
    used_components: set[str] = set()
    for item in native_files:
        component_id = item.get("component_id")
        if component_id not in known_components:
            errors.append(f"native file has unknown component: {item.get('path')}")
        else:
            used_components.add(component_id)
        if len(item.get("sha256", "")) != 64:
            errors.append(f"native file has invalid sha256: {item.get('path')}")
    unused = known_components - used_components
    if unused:
        errors.append(f"components without native files: {sorted(unused)}")

    if site_packages is not None:
        observed: dict[str, tuple[int, str]] = {}
        for path in site_packages.rglob("*"):
            if not path.is_file():
                continue
            with path.open("rb") as handle:
                if handle.read(4) != b"\x7fELF":
                    continue
            relative = str(path.relative_to(site_packages))
            observed[relative] = (path.stat().st_size, sha256_file(path))
        expected = {
            item["path"]: (item["bytes"], item["sha256"])
            for item in native_files
        }
        missing = sorted(set(expected) - set(observed))
        extra = sorted(set(observed) - set(expected))
        drift = sorted(
            path for path in set(expected) & set(observed)
            if expected[path] != observed[path]
        )
        if missing:
            errors.append(f"missing native files: {missing}")
        if extra:
            errors.append(f"unmapped native files: {extra}")
        if drift:
            errors.append(f"native file hash/size drift: {drift}")

    summary = {
        "factual_evidence": "PASS" if not errors else "HOLD",
        "legal_determination": "NOT_PERFORMED",
        "native_files": len(native_files),
        "components": len(components),
        "source_sets": len(source_ids),
        "errors": errors,
    }
    return errors, summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-packages", type=Path)
    parser.add_argument("--fetch-all-artifacts", action="store_true")
    parser.add_argument("--verify-wheel-artifacts", action="store_true")
    parser.add_argument("--cache-dir", type=Path)
    args = parser.parse_args()

    errors, summary = verify_evidence(site_packages=args.site_packages)
    if args.fetch_all_artifacts or args.verify_wheel_artifacts:
        runtime = _load_json(SERVICE_ROOT / RUNTIME_MANIFEST)
        sources = _load_json(SERVICE_ROOT / SOURCE_MANIFEST)
        def verify_downloads(cache: Path) -> None:
            if args.fetch_all_artifacts:
                errors.extend(
                    _fetch_and_verify(_artifact_records(runtime, sources), cache)
                )
            if args.verify_wheel_artifacts:
                errors.extend(_verify_embedded_wheel_evidence(runtime, cache))

        if args.cache_dir is None:
            with tempfile.TemporaryDirectory(prefix="caddydaddy-source-") as directory:
                verify_downloads(Path(directory))
        else:
            verify_downloads(args.cache_dir)
        if args.fetch_all_artifacts:
            summary["artifact_fetch"] = "PASS" if not errors else "HOLD"
        if args.verify_wheel_artifacts:
            summary["wheel_artifact_verification"] = "PASS" if not errors else "HOLD"
        summary["errors"] = errors
        summary["factual_evidence"] = "PASS" if not errors else "HOLD"

    print(json.dumps(summary, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
