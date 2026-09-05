"""Lane-internal canonical restart checkpoint.

This is deliberately not a shared history/core wire adapter. It provides a strict,
content-addressed persistence contract for replay and last-valid recovery while the
integration-owned cross-lane contract remains independently versioned.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Mapping

import rfc8785

from .artifacts import ArtifactPointer, GeometryArtifact
from .canonical import sha256_hex
from .diagnostics import KernelError
from .engine import RecomputeResult
from .program import PartProgram


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise KernelError("SCHEMA_UNSUPPORTED", f"Duplicate JSON key {key!r}")
        result[key] = value
    return result


def _reject_constant(token: str) -> None:
    raise ValueError(f"Non-finite JSON number {token}")


def _decode_canonical(payload: bytes) -> Mapping[str, Any]:
    try:
        value = json.loads(
            payload,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_constant,
        )
    except KernelError:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint is not valid JSON") from exc
    if not isinstance(value, Mapping):
        raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint root must be an object")
    try:
        canonical = rfc8785.dumps(value)
    except (TypeError, ValueError) as exc:
        raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint cannot be canonicalized") from exc
    if canonical != payload:
        raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint bytes are not RFC 8785 canonical")
    return value


@dataclass(frozen=True, slots=True)
class RestoredCheckpoint:
    program: PartProgram
    result_payload: Mapping[str, Any]
    last_valid_artifact: GeometryArtifact | None
    checkpoint_hash: str


@dataclass(frozen=True, slots=True)
class RecomputeCheckpoint:
    program: PartProgram
    result_payload: Mapping[str, Any]
    last_valid_artifact: GeometryArtifact | None

    @classmethod
    def capture(
        cls,
        program: PartProgram,
        result: RecomputeResult,
        *,
        prior_last_valid: GeometryArtifact | None = None,
    ) -> "RecomputeCheckpoint":
        if result.document_id != program.document_id:
            raise KernelError("CHECKPOINT_MISMATCH", "Result document does not match program")
        if result.attempted_revision_id != program.source_revision_id:
            raise KernelError("CHECKPOINT_MISMATCH", "Result revision does not match program")
        if result.geometry_hash != program.geometry_hash:
            raise KernelError("CHECKPOINT_MISMATCH", "Result geometry hash does not match program")
        last_valid = result.current_artifact if result.status == "SUCCEEDED" else prior_last_valid
        expected = result.last_valid_artifact
        if result.status == "SUCCEEDED":
            if last_valid is None:
                raise KernelError("CHECKPOINT_MISMATCH", "Successful result has no artifact")
        elif result.status == "FAILED":
            if (expected is None) != (last_valid is None):
                raise KernelError("CHECKPOINT_MISMATCH", "Last-valid materialization is missing")
            if (
                expected is not None
                and last_valid is not None
                and expected != last_valid.pointer()
            ):
                raise KernelError("CHECKPOINT_MISMATCH", "Last-valid pointer/content disagree")
        else:
            raise KernelError(
                "CHECKPOINT_MISMATCH", f"Unsupported terminal status {result.status!r}"
            )
        return cls(program, result.as_dict(), last_valid)

    def _payload(self) -> dict[str, object]:
        return {
            "program": self.program.as_dict(),
            "result": dict(self.result_payload),
            "last_valid_artifact": self.last_valid_artifact.as_dict()
            if self.last_valid_artifact
            else None,
        }

    @property
    def checkpoint_hash(self) -> str:
        return sha256_hex(self._payload())

    def as_bytes(self) -> bytes:
        return rfc8785.dumps(
            {
                "protocol_version": "forge.core-recompute-checkpoint/1",
                "checkpoint_hash": self.checkpoint_hash,
                "payload": self._payload(),
            }
        )

    @classmethod
    def from_bytes(cls, encoded: bytes) -> RestoredCheckpoint:
        root = _decode_canonical(encoded)
        if set(root) != {"protocol_version", "checkpoint_hash", "payload"}:
            raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint envelope fields are not exact")
        if root.get("protocol_version") != "forge.core-recompute-checkpoint/1":
            raise KernelError("SCHEMA_UNSUPPORTED", "Unsupported checkpoint protocol")
        checkpoint_hash = root.get("checkpoint_hash")
        payload = root.get("payload")
        if not isinstance(checkpoint_hash, str) or not isinstance(payload, Mapping):
            raise KernelError("SCHEMA_UNSUPPORTED", "Malformed checkpoint envelope")
        if sha256_hex(payload) != checkpoint_hash:
            raise KernelError("CHECKPOINT_HASH_MISMATCH", "Checkpoint payload hash mismatch")
        if set(payload) != {"program", "result", "last_valid_artifact"}:
            raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint payload fields are not exact")
        program_value = payload.get("program")
        result = payload.get("result")
        artifact_value = payload.get("last_valid_artifact")
        if not isinstance(program_value, Mapping) or not isinstance(result, Mapping):
            raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint program/result is malformed")
        if artifact_value is not None and not isinstance(artifact_value, Mapping):
            raise KernelError("SCHEMA_UNSUPPORTED", "Checkpoint artifact is malformed")
        program = PartProgram.from_dict(program_value)
        artifact = (
            GeometryArtifact.from_dict(artifact_value)
            if isinstance(artifact_value, Mapping)
            else None
        )
        cls._validate_relationships(program, result, artifact)
        return RestoredCheckpoint(program, dict(result), artifact, checkpoint_hash)

    @staticmethod
    def _validate_relationships(
        program: PartProgram,
        result: Mapping[str, Any],
        artifact: GeometryArtifact | None,
    ) -> None:
        if result.get("protocol_version") != "forge.kernel-result/1":
            raise KernelError("SCHEMA_UNSUPPORTED", "Unsupported persisted result")
        if result.get("document_id") != program.document_id:
            raise KernelError("CHECKPOINT_MISMATCH", "Persisted document identity mismatch")
        if result.get("attempted_revision_id") != program.source_revision_id:
            raise KernelError("CHECKPOINT_MISMATCH", "Persisted revision identity mismatch")
        if result.get("geometry_hash") != program.geometry_hash:
            raise KernelError("CHECKPOINT_MISMATCH", "Persisted geometry hash mismatch")
        status = result.get("status")
        current = result.get("current_artifact")
        last = result.get("last_valid_artifact")
        if current is not None and not isinstance(current, Mapping):
            raise KernelError("SCHEMA_UNSUPPORTED", "Malformed current artifact pointer")
        if last is not None and not isinstance(last, Mapping):
            raise KernelError("SCHEMA_UNSUPPORTED", "Malformed last-valid artifact pointer")
        pointer = artifact.pointer() if artifact is not None else None
        if status == "SUCCEEDED":
            if current is None or pointer != ArtifactPointer.from_dict(current):
                raise KernelError("CHECKPOINT_MISMATCH", "Current artifact was not materialized")
        elif status == "FAILED":
            if current is not None:
                raise KernelError("CHECKPOINT_MISMATCH", "Failed result has a current artifact")
            expected = ArtifactPointer.from_dict(last) if last is not None else None
            if pointer != expected:
                raise KernelError("CHECKPOINT_MISMATCH", "Last-valid artifact was not materialized")
        else:
            raise KernelError(
                "CHECKPOINT_MISMATCH", f"Nonterminal persisted status {status!r}"
            )
