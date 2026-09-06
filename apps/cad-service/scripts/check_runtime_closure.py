"""Measure the deployable Python closure without treating it as distribution approval."""

from __future__ import annotations

import argparse
import email
import hashlib
import json
from pathlib import Path


VERCEL_STANDARD_PYTHON_BYTES = 500 * 1024 * 1024
VERCEL_DOCUMENTED_BODY_BYTES = 4_500_000
SERVICE_BODY_BYTES = 4_250_000
EXPECTED_PACKAGES = {
    "annotated-doc": "0.0.5",
    "annotated-types": "0.8.0",
    "anyio": "4.15.1",
    "cadquery-ocp-novtk": "7.9.3.1",
    "cadquery-ocp-proxy": "7.9.3.1",
    "click": "8.5.0",
    "fastapi": "0.141.1",
    "h11": "0.16.0",
    "idna": "3.19",
    "pydantic": "2.13.5",
    "pydantic-core": "2.46.5",
    "starlette": "1.6.0",
    "typing-extensions": "4.16.0",
    "typing-inspection": "0.4.4",
    "uvicorn": "0.52.4",
}
EXPECTED_LICENSE_HASHES = {
    "OCP-APACHE-2.0.txt": "a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd",
    "OCCT-LGPL-2.1.txt": "e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c",
    "OCCT-LGPL-EXCEPTION-1.0.txt": "04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b",
}
EXPECTED_WHEEL_SBOM_SHA256 = "9acbb7d86c746873c40a970bd1afc89855986aa1e5b9ae85e6a53032f7201b10"


def normalize(name: str) -> str:
    return name.lower().replace("_", "-")


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def package_inventory(site_packages: Path) -> dict[str, str]:
    inventory: dict[str, str] = {}
    for metadata_path in site_packages.glob("*.dist-info/METADATA"):
        metadata = email.message_from_bytes(metadata_path.read_bytes())
        if metadata.get("Name") and metadata.get("Version"):
            inventory[normalize(metadata["Name"])] = metadata["Version"]
    return inventory


def iter_unique_files(paths: list[Path]):
    seen: set[Path] = set()
    for root in paths:
        candidates = (root,) if root.is_file() else root.rglob("*")
        for candidate in candidates:
            if not candidate.is_file():
                continue
            resolved = candidate.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield candidate


def measure(paths: list[Path]) -> tuple[int, int, int]:
    logical = 0
    allocated = 0
    count = 0
    for path in iter_unique_files(paths):
        stat = path.stat()
        logical += stat.st_size
        allocated += getattr(stat, "st_blocks", 0) * 512
        count += 1
    return logical, allocated, count


def build_report(site_packages: Path, includes: list[Path]) -> dict[str, object]:
    license_dir = Path(__file__).resolve().parents[1] / "licenses"
    roots = [site_packages, *includes]
    logical, allocated, file_count = measure(roots)
    inventory = package_inventory(site_packages)
    package_mismatches = {
        name: {"expected": version, "observed": inventory.get(name)}
        for name, version in EXPECTED_PACKAGES.items()
        if inventory.get(name) != version
    }
    license_mismatches = {
        name: {"expected": expected, "observed": hash_file(license_dir / name) if (license_dir / name).exists() else None}
        for name, expected in EXPECTED_LICENSE_HASHES.items()
        if not (license_dir / name).exists() or hash_file(license_dir / name) != expected
    }
    sbom_matches = list(site_packages.glob("cadquery_ocp_novtk-7.9.3.1.dist-info/sboms/auditwheel.cdx.json"))
    sbom_hash = hash_file(sbom_matches[0]) if sbom_matches else None
    native_files = [
        path
        for path in iter_unique_files([site_packages])
        if path.name.endswith(".so") or ".so." in path.name or path.name.endswith(".dylib")
    ]
    size_pass = logical <= VERCEL_STANDARD_PYTHON_BYTES
    payload_pass = SERVICE_BODY_BYTES < VERCEL_DOCUMENTED_BODY_BYTES
    technical_pass = (
        size_pass
        and payload_pass
        and not package_mismatches
        and not license_mismatches
        and sbom_hash == EXPECTED_WHEEL_SBOM_SHA256
    )
    return {
        "measurement": {
            "roots": [str(path.resolve()) for path in roots],
            "logical_bytes": logical,
            "logical_mib": round(logical / 1024 / 1024, 3),
            "allocated_bytes": allocated,
            "file_count": file_count,
            "native_shared_object_count": len(native_files),
        },
        "vercel": {
            "standard_python_limit_bytes": VERCEL_STANDARD_PYTHON_BYTES,
            "headroom_bytes": VERCEL_STANDARD_PYTHON_BYTES - logical,
            "size_gate": "PASS" if size_pass else "HOLD",
            "documented_payload_limit_bytes": VERCEL_DOCUMENTED_BODY_BYTES,
            "service_payload_limit_bytes": SERVICE_BODY_BYTES,
            "payload_gate": "PASS" if payload_pass else "HOLD",
        },
        "packages": {"expected": EXPECTED_PACKAGES, "mismatches": package_mismatches},
        "licenses": {"expected_hashes": EXPECTED_LICENSE_HASHES, "mismatches": license_mismatches},
        "wheel_sbom": {
            "expected_sha256": EXPECTED_WHEEL_SBOM_SHA256,
            "observed_sha256": sbom_hash,
            "gate": "PASS" if sbom_hash == EXPECTED_WHEEL_SBOM_SHA256 else "HOLD",
        },
        "technical_preflight": "PASS" if technical_pass else "HOLD",
        "redistribution_gate": "HOLD",
        "redistribution_reasons": [
            "bundled native component licenses and notices are not fully mapped",
            "durable corresponding-source publication is not recorded",
            "replacement-wheel clean-room proof is not recorded",
            "repository license-authority approval is absent",
        ],
        "provider_build_gate": "NOT_RUN",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-packages", required=True, type=Path)
    parser.add_argument("--include", action="append", default=[], type=Path)
    args = parser.parse_args()
    report = build_report(args.site_packages, args.include)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["technical_preflight"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
