"""Non-authoritative collaboration metadata kept outside geometry history."""

from __future__ import annotations

from typing import Any, Dict, List

from .errors import require
from .events import AppendOnlyEventLog, HistoryEvent


METADATA_TYPES = {"PRESENCE_UPDATED", "COMMENT_ADDED", "COMMENT_RESOLVED"}


class MetadataStream:
    """Separate stream for presence and comments.

    Records always carry ``authoritative: false``.  They can point at an exact
    revision or semantic entity, but no branch/document service reads them as an
    operation, authorization, recompute result, or geometry precondition.
    """

    def __init__(self, log: AppendOnlyEventLog) -> None:
        self.log = log

    def append(
        self,
        metadata_type: str,
        document_id: str,
        revision_id: str,
        actor_provenance: Dict[str, Any],
        occurred_at: str,
        value: Dict[str, Any],
    ) -> HistoryEvent:
        require(metadata_type in METADATA_TYPES, "METADATA_TYPE_INVALID", "unsupported collaboration metadata type")
        require(isinstance(document_id, str) and bool(document_id), "DOCUMENT_ID_INVALID", "document ID is required")
        require(isinstance(revision_id, str) and bool(revision_id), "REVISION_ID_INVALID", "revision ID is required")
        require(isinstance(value, dict), "METADATA_VALUE_INVALID", "metadata value must be an object")
        forbidden = {"operations", "parameters", "authorization", "kernel_result", "geometry_artifact"}
        require(not (forbidden & set(value.keys())), "METADATA_AUTHORITY_VIOLATION", "metadata cannot carry authoritative model fields")
        return self.log.append(
            metadata_type,
            "COLLABORATION_METADATA",
            document_id,
            occurred_at,
            actor_provenance,
            {
                "authoritative": False,
                "document_id": document_id,
                "revision_id": revision_id,
                "value": dict(value),
            },
        )

    def latest_presence(self) -> Dict[str, Dict[str, Any]]:
        latest: Dict[str, Dict[str, Any]] = {}
        for event in self.log.read_all():
            if event.value["event_type"] != "PRESENCE_UPDATED":
                continue
            actor_id = event.value["provenance"]["actor_id"]
            latest[actor_id] = event.value["payload"]
        return latest

    def comments(self) -> List[HistoryEvent]:
        return [
            event
            for event in self.log.read_all()
            if event.value["event_type"] in {"COMMENT_ADDED", "COMMENT_RESOLVED"}
        ]
