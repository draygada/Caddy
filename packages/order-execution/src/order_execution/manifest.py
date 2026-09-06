from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from .canonical import digest_json, parse_json
from .errors import OrderExecutionError, require
from .records import CandidateIdentity, SHA256_RE


@dataclass(frozen=True)
class VerifiedManifest:
    package_id: str
    candidate: CandidateIdentity
    manifest_sha256: str
    selection_count: int
    file_count: int


def _exact_keys(value: dict[str, Any], expected: set[str], code: str) -> None:
    require(set(value) == expected, code, "record fields do not match the contract", missing=sorted(expected - set(value)), extra=sorted(set(value) - expected))


def _object(value: Any, code: str) -> dict[str, Any]:
    require(isinstance(value, dict), code, "value must be an object")
    return value


def _text(value: Any, code: str) -> str:
    require(isinstance(value, str) and bool(value), code, "value must be non-empty text")
    return value


def _safe_file(root: Path, relative: str) -> Path:
    pure = PurePosixPath(relative)
    require(not pure.is_absolute() and relative == pure.as_posix(), "PACKAGE_PATH_INVALID", "package file path must be normalized and relative", path=relative)
    require(all(part not in {"", ".", ".."} for part in pure.parts), "PACKAGE_PATH_INVALID", "package file path contains traversal", path=relative)
    candidate = root.joinpath(*pure.parts)
    require(candidate.exists(), "PACKAGE_FILE_MISSING", "declared package file does not exist", path=relative)
    require(not candidate.is_symlink(), "PACKAGE_SYMLINK_FORBIDDEN", "package files cannot be symlinks", path=relative)
    resolved = candidate.resolve(strict=True)
    require(resolved.is_relative_to(root), "PACKAGE_PATH_ESCAPE", "package file escapes package root", path=relative)
    require(resolved.is_file(), "PACKAGE_FILE_INVALID", "declared package path is not a regular file", path=relative)
    return resolved


def verify_sealed_manifest(
    manifest_path: Path,
    package_root: Path,
    expected_candidate: CandidateIdentity,
    *,
    max_manifest_bytes: int = 1024 * 1024,
    max_file_bytes: int = 64 * 1024 * 1024,
) -> VerifiedManifest:
    root = Path(package_root).resolve(strict=True)
    require(root.is_dir(), "PACKAGE_ROOT_INVALID", "package root must be a directory")
    source = Path(manifest_path)
    require(source.exists() and not source.is_symlink(), "MANIFEST_INVALID", "manifest must be a non-symlink file")
    source = source.resolve(strict=True)
    require(source.is_relative_to(root), "MANIFEST_PATH_ESCAPE", "manifest must be inside package root")
    raw = source.read_bytes()
    require(len(raw) <= max_manifest_bytes, "MANIFEST_TOO_LARGE", "manifest exceeds the read limit")
    manifest = _object(parse_json(raw), "MANIFEST_INVALID")
    _exact_keys(manifest, {"schema_version", "package_id", "package_status", "candidate", "selections", "files", "seal"}, "MANIFEST_FIELDS_INVALID")
    require(manifest["schema_version"] == "strafe.sealed-sourcing-package/1", "MANIFEST_SCHEMA_UNSUPPORTED", "unsupported manifest schema")
    require(manifest["package_status"] == "SEALED", "PACKAGE_NOT_SEALED", "sourcing package must be sealed")
    package_id = _text(manifest["package_id"], "PACKAGE_ID_INVALID")

    candidate = _object(manifest["candidate"], "CANDIDATE_INVALID")
    _exact_keys(candidate, {"candidate_id", "revision", "artifact_sha256"}, "CANDIDATE_FIELDS_INVALID")
    actual_candidate = CandidateIdentity(
        _text(candidate["candidate_id"], "CANDIDATE_ID_INVALID"),
        _text(candidate["revision"], "CANDIDATE_REVISION_INVALID"),
        _text(candidate["artifact_sha256"], "CANDIDATE_HASH_INVALID"),
    )
    require(actual_candidate == expected_candidate, "STALE_CANDIDATE", "sealed package candidate does not match the dispatch candidate", expected=expected_candidate.as_dict(), actual=actual_candidate.as_dict())

    selections = manifest["selections"]
    require(isinstance(selections, list) and selections, "SELECTIONS_INVALID", "at least one selected offer is required")
    line_ids: set[str] = set()
    for index, raw_selection in enumerate(selections):
        selection = _object(raw_selection, "SELECTION_INVALID")
        _exact_keys(selection, {"line_id", "offer_id", "selected", "offer_status", "gate_state"}, "SELECTION_FIELDS_INVALID")
        line_id = _text(selection["line_id"], "LINE_ID_INVALID")
        _text(selection["offer_id"], "OFFER_ID_INVALID")
        require(line_id not in line_ids, "DUPLICATE_LINE_SELECTION", "a sourcing line may have only one selected offer", index=index, line_id=line_id)
        line_ids.add(line_id)
        require(selection["selected"] is True, "OFFER_NOT_SELECTED", "offer must be explicitly selected", line_id=line_id)
        require(selection["offer_status"] == "APPROVED", "OFFER_BLOCKED", "selected offer is not approved", line_id=line_id, status=selection["offer_status"])
        require(selection["gate_state"] == "CLEARED", "ORDER_GATE_BLOCKED", "selected offer has not cleared its order gate", line_id=line_id, gate_state=selection["gate_state"])

    files = manifest["files"]
    require(isinstance(files, list) and files, "PACKAGE_FILES_INVALID", "sealed package must declare at least one file")
    paths: set[str] = set()
    for raw_file in files:
        declared = _object(raw_file, "PACKAGE_FILE_INVALID")
        _exact_keys(declared, {"path", "byte_length", "sha256"}, "PACKAGE_FILE_FIELDS_INVALID")
        relative = _text(declared["path"], "PACKAGE_PATH_INVALID")
        require(relative not in paths, "PACKAGE_FILE_DUPLICATE", "package file path is declared more than once", path=relative)
        paths.add(relative)
        byte_length = declared["byte_length"]
        require(isinstance(byte_length, int) and not isinstance(byte_length, bool) and 0 <= byte_length <= max_file_bytes, "PACKAGE_FILE_SIZE_INVALID", "declared byte length is invalid", path=relative)
        expected_hash = declared["sha256"]
        require(isinstance(expected_hash, str) and SHA256_RE.fullmatch(expected_hash) is not None, "PACKAGE_FILE_HASH_INVALID", "declared file hash must be lowercase SHA-256", path=relative)
        actual_bytes = _safe_file(root, relative).read_bytes()
        require(len(actual_bytes) <= max_file_bytes, "PACKAGE_FILE_TOO_LARGE", "package file exceeds the read limit", path=relative)
        require(len(actual_bytes) == byte_length, "PACKAGE_FILE_SIZE_MISMATCH", "package byte length does not match manifest", path=relative, expected=byte_length, actual=len(actual_bytes))
        actual_hash = hashlib.sha256(actual_bytes).hexdigest()
        require(actual_hash == expected_hash, "PACKAGE_FILE_HASH_MISMATCH", "package bytes do not match manifest SHA-256", path=relative, expected=expected_hash, actual=actual_hash)

    seal = _object(manifest["seal"], "MANIFEST_SEAL_INVALID")
    _exact_keys(seal, {"algorithm", "manifest_sha256"}, "MANIFEST_SEAL_FIELDS_INVALID")
    require(seal["algorithm"] == "SHA-256", "MANIFEST_SEAL_ALGORITHM_INVALID", "only SHA-256 manifest seals are supported")
    claimed = seal["manifest_sha256"]
    require(isinstance(claimed, str) and SHA256_RE.fullmatch(claimed) is not None, "MANIFEST_SEAL_INVALID", "manifest seal must be lowercase SHA-256")
    preimage = {key: value for key, value in manifest.items() if key != "seal"}
    actual = digest_json(preimage)
    require(actual == claimed, "MANIFEST_SEAL_MISMATCH", "manifest seal does not match canonical content", expected=claimed, actual=actual)
    return VerifiedManifest(package_id, actual_candidate, actual, len(selections), len(files))
