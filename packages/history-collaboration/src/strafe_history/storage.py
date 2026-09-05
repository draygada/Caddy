"""Immutable, content-addressed storage with canonical-byte verification."""

from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import Any

from .canonical import canonical_bytes, digest_json, parse_json
from .errors import DiagnosticError
from .safety import validate_persistence_safety


class ImmutableObjectStore:
    """Stores canonical JSON under a digest-derived path without overwriting.

    A temporary file is fsynced and hard-linked into place.  If another writer
    already placed the digest, bytes must be identical.  Object names never use
    user-provided IDs, preventing path traversal through opaque identifiers.
    """

    def __init__(self, root: Path, max_object_bytes: int = 8 * 1024 * 1024) -> None:
        self.root = Path(root)
        self.max_object_bytes = max_object_bytes
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _validate_namespace(namespace: str) -> None:
        if not namespace or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for char in namespace):
            raise DiagnosticError("OBJECT_NAMESPACE_INVALID", "namespace must be a lower-case storage token")

    def path_for(self, namespace: str, digest: str) -> Path:
        self._validate_namespace(namespace)
        if not isinstance(digest, str) or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise DiagnosticError("OBJECT_DIGEST_INVALID", "object digest must be lower-case SHA-256 hex")
        return self.root / namespace / digest[:2] / (digest + ".json")

    def put(self, namespace: str, value: Any) -> str:
        validate_persistence_safety(value)
        data = canonical_bytes(value)
        if len(data) > self.max_object_bytes:
            raise DiagnosticError("OBJECT_TOO_LARGE", "object exceeds configured storage limit")
        digest = digest_json(value)
        destination = self.path_for(namespace, digest)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if destination.read_bytes() != data:
                raise DiagnosticError("OBJECT_COLLISION", "existing digest path contains different bytes")
            return digest

        temporary = destination.parent / ("." + digest + ".pending-" + secrets.token_hex(8))
        descriptor = os.open(str(temporary), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            view = memoryview(data)
            written = 0
            while written < len(data):
                count = os.write(descriptor, view[written:])
                if count <= 0:
                    raise DiagnosticError("OBJECT_WRITE_FAILED", "object write made no progress")
                written += count
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        try:
            try:
                os.link(str(temporary), str(destination))
            except FileExistsError:
                if destination.read_bytes() != data:
                    raise DiagnosticError("OBJECT_COLLISION", "existing digest path contains different bytes")
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass
        return digest

    def get(self, namespace: str, digest: str) -> Any:
        path = self.path_for(namespace, digest)
        try:
            data = path.read_bytes()
        except FileNotFoundError as exc:
            raise DiagnosticError("OBJECT_NOT_FOUND", "content-addressed object does not exist") from exc
        if len(data) > self.max_object_bytes:
            raise DiagnosticError("OBJECT_TOO_LARGE", "object exceeds configured storage limit")
        value = parse_json(data, require_canonical=True)
        actual = digest_json(value)
        if actual != digest:
            raise DiagnosticError("HASH_MISMATCH", "object path does not match canonical contents")
        return value

    def contains(self, namespace: str, digest: str) -> bool:
        return self.path_for(namespace, digest).is_file()
