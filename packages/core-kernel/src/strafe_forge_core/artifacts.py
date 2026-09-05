"""Content-addressed exact geometry artifacts used by kernel internals."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Mapping

from .canonical import is_sha256_hex, sha256_bytes, sha256_hex
from .diagnostics import KernelError
from .topology import deserialize_brep


@dataclass(frozen=True, slots=True)
class ArtifactPointer:
    artifact_id: str
    producing_revision_id: str
    geometry_hash: str
    content_hash: str
    semantic_fingerprint: str

    def __post_init__(self) -> None:
        if (
            not isinstance(self.artifact_id, str)
            or not self.artifact_id.startswith("artifact:")
            or not is_sha256_hex(self.artifact_id.removeprefix("artifact:"))
            or not isinstance(self.producing_revision_id, str)
            or not self.producing_revision_id
            or not is_sha256_hex(self.geometry_hash)
            or not is_sha256_hex(self.content_hash)
            or not is_sha256_hex(self.semantic_fingerprint)
        ):
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Malformed artifact pointer")

    def as_dict(self) -> dict[str, str]:
        return {
            "artifact_id": self.artifact_id,
            "producing_revision_id": self.producing_revision_id,
            "geometry_hash": self.geometry_hash,
            "content_hash": self.content_hash,
            "semantic_fingerprint": self.semantic_fingerprint,
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ArtifactPointer":
        expected = {
            "artifact_id",
            "producing_revision_id",
            "geometry_hash",
            "content_hash",
            "semantic_fingerprint",
        }
        if set(value) != expected or not all(
            isinstance(value.get(key), str) and value.get(key) for key in expected
        ):
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Malformed artifact pointer")
        return cls(**{key: value[key] for key in expected})


@dataclass(frozen=True, slots=True)
class GeometryArtifact:
    artifact_kind: str
    source_revision_id: str
    geometry_hash: str
    producing_operation_id: str | None
    engine_manifest_hash: str
    media_type: str
    content: bytes
    semantic_fingerprint: str | None
    verification: Mapping[str, Any]

    def __post_init__(self) -> None:
        if (
            self.artifact_kind not in {"BREP", "MESH", "STEP", "STL", "VIEWPORT"}
            or not isinstance(self.source_revision_id, str)
            or not self.source_revision_id
            or not is_sha256_hex(self.geometry_hash)
            or (
                self.producing_operation_id is not None
                and (
                    not isinstance(self.producing_operation_id, str)
                    or not self.producing_operation_id
                )
            )
            or not is_sha256_hex(self.engine_manifest_hash)
            or not isinstance(self.media_type, str)
            or not self.media_type
            or not isinstance(self.content, bytes)
            or not self.content
            or (
                self.semantic_fingerprint is not None
                and not is_sha256_hex(self.semantic_fingerprint)
            )
            or not isinstance(self.verification, Mapping)
        ):
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Malformed geometry artifact")

    @property
    def content_hash(self) -> str:
        return sha256_bytes(self.content)

    def descriptor_preimage(self) -> dict[str, object]:
        return {
            "schema_version": "forge.artifact/1",
            "artifact_kind": self.artifact_kind,
            "source_revision_id": self.source_revision_id,
            "geometry_hash": self.geometry_hash,
            "producing_operation_id": self.producing_operation_id,
            "engine_manifest_hash": self.engine_manifest_hash,
            "media_type": self.media_type,
            "byte_length": len(self.content),
            "content_hash": self.content_hash,
            "semantic_fingerprint": self.semantic_fingerprint,
        }

    @property
    def artifact_id(self) -> str:
        return f"artifact:{sha256_hex(self.descriptor_preimage())}"

    def pointer(self) -> ArtifactPointer:
        if self.semantic_fingerprint is None:
            raise KernelError(
                "ARTIFACT_HASH_MISMATCH",
                "A current/last-valid pointer requires a semantic fingerprint",
            )
        return ArtifactPointer(
            artifact_id=self.artifact_id,
            producing_revision_id=self.source_revision_id,
            geometry_hash=self.geometry_hash,
            content_hash=self.content_hash,
            semantic_fingerprint=self.semantic_fingerprint,
        )

    def as_dict(self, *, include_payload: bool = True) -> dict[str, object]:
        return {
            "protocol_version": "forge.geometry-artifact/1",
            "descriptor": {
                "artifact_id": self.artifact_id,
                **{
                    key: value
                    for key, value in self.descriptor_preimage().items()
                    if key != "schema_version"
                },
            },
            "payload": {
                "encoding": "INLINE_BASE64" if include_payload else "OMITTED",
                "data": base64.b64encode(self.content).decode("ascii")
                if include_payload
                else None,
            },
            "verification": dict(self.verification),
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "GeometryArtifact":
        if value.get("protocol_version") != "forge.geometry-artifact/1":
            raise KernelError("SCHEMA_UNSUPPORTED", "Unsupported artifact protocol")
        descriptor = value.get("descriptor")
        payload = value.get("payload")
        verification = value.get("verification")
        if not isinstance(descriptor, Mapping) or not isinstance(payload, Mapping):
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Malformed artifact envelope")
        if payload.get("encoding") != "INLINE_BASE64" or not isinstance(payload.get("data"), str):
            raise KernelError(
                "ARTIFACT_HASH_MISMATCH", "Artifact payload is not available inline"
            )
        try:
            content = base64.b64decode(payload["data"], validate=True)
        except (ValueError, TypeError) as exc:
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Invalid artifact base64") from exc
        artifact = cls(
            artifact_kind=str(descriptor.get("artifact_kind")),
            source_revision_id=str(descriptor.get("source_revision_id")),
            geometry_hash=str(descriptor.get("geometry_hash")),
            producing_operation_id=descriptor.get("producing_operation_id"),
            engine_manifest_hash=str(descriptor.get("engine_manifest_hash")),
            media_type=str(descriptor.get("media_type")),
            content=content,
            semantic_fingerprint=descriptor.get("semantic_fingerprint"),
            verification=dict(verification) if isinstance(verification, Mapping) else {},
        )
        if descriptor.get("byte_length") != len(content):
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Artifact byte length mismatch")
        if descriptor.get("content_hash") != artifact.content_hash:
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Artifact content hash mismatch")
        if descriptor.get("artifact_id") != artifact.artifact_id:
            raise KernelError("ARTIFACT_HASH_MISMATCH", "Artifact identity mismatch")
        if artifact.artifact_kind == "BREP":
            deserialize_brep(content)
        return artifact
