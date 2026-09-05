"""Schema-neutral immutable revision snapshot index."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from .canonical import digest_json
from .errors import DiagnosticError, require
from .events import AppendOnlyEventLog, HistoryEvent
from .safety import validate_persistence_safety
from .storage import ImmutableObjectStore


SNAPSHOT_STORED = "REVISION_SNAPSHOT_STORED"
REVISION_RELEASED = "REVISION_RELEASED"


@dataclass(frozen=True)
class RevisionPointer:
    revision_id: str
    record_kind: str
    object_digest: str
    parent_revision_ids: Sequence[str]


class RevisionSnapshotStore:
    """Indexes strict wire snapshots without defining their wire schema.

    A boundary adapter validates and computes the external revision identity.
    This store then preserves the supplied canonical snapshot immutably and
    records its graph edge in the append-only log.
    """

    def __init__(self, objects: ImmutableObjectStore, log: AppendOnlyEventLog) -> None:
        self.objects = objects
        self.log = log

    def pointers(self) -> Dict[str, RevisionPointer]:
        result: Dict[str, RevisionPointer] = {}
        for event in self.log.read_all():
            if event.value["event_type"] != SNAPSHOT_STORED:
                continue
            payload = event.value["payload"]
            pointer = RevisionPointer(
                revision_id=payload["revision_id"],
                record_kind=payload["record_kind"],
                object_digest=payload["object_digest"],
                parent_revision_ids=tuple(payload["parent_revision_ids"]),
            )
            existing = result.get(pointer.revision_id)
            if existing is not None and existing != pointer:
                raise DiagnosticError("REVISION_IMMUTABILITY_VIOLATION", "revision ID points to multiple snapshots")
            result[pointer.revision_id] = pointer
        return result

    def persist(
        self,
        revision_id: str,
        record_kind: str,
        snapshot: Any,
        parent_revision_ids: Iterable[str],
        actor_provenance: Dict[str, Any],
        occurred_at: str,
    ) -> RevisionPointer:
        require(isinstance(revision_id, str) and bool(revision_id), "REVISION_ID_INVALID", "revision ID is required")
        require(isinstance(record_kind, str) and bool(record_kind), "RECORD_KIND_INVALID", "record kind is required")
        parents = tuple(parent_revision_ids)
        require(len(parents) == len(set(parents)), "DUPLICATE_ID", "parent revision IDs must be unique")
        known = self.pointers()
        missing = [parent for parent in parents if parent not in known]
        require(not missing, "PARENT_REVISION_MISSING", "parent revision is not stored", missing=missing)
        validate_persistence_safety(snapshot)
        digest = digest_json(snapshot)
        proposed = RevisionPointer(revision_id, record_kind, digest, parents)
        existing = known.get(revision_id)
        if existing is not None:
            if existing != proposed:
                raise DiagnosticError(
                    "REVISION_IMMUTABILITY_VIOLATION",
                    "revision ID already names different immutable content",
                    details={"revision_id": revision_id},
                )
            return existing
        stored_digest = self.objects.put("revisions", snapshot)
        require(stored_digest == digest, "HASH_MISMATCH", "immutable store returned an unexpected digest")
        self.log.append(
            SNAPSHOT_STORED,
            "REVISION",
            revision_id,
            occurred_at,
            actor_provenance,
            {
                "revision_id": revision_id,
                "record_kind": record_kind,
                "object_digest": digest,
                "parent_revision_ids": list(parents),
            },
        )
        return proposed

    def load(self, revision_id: str) -> Any:
        pointer = self.pointers().get(revision_id)
        if pointer is None:
            raise DiagnosticError("REVISION_NOT_FOUND", "revision is not stored", details={"revision_id": revision_id})
        return self.objects.get("revisions", pointer.object_digest)

    def ancestors(self, revision_id: str) -> Set[str]:
        known = self.pointers()
        require(revision_id in known, "REVISION_NOT_FOUND", "revision is not stored")
        found: Set[str] = set()
        pending = list(known[revision_id].parent_revision_ids)
        while pending:
            current = pending.pop()
            if current in found:
                continue
            require(current in known, "PARENT_REVISION_MISSING", "revision graph contains a missing parent")
            found.add(current)
            pending.extend(known[current].parent_revision_ids)
        return found

    def mark_released(
        self,
        revision_id: str,
        release_id: str,
        actor_provenance: Dict[str, Any],
        occurred_at: str,
        evidence_refs: List[str],
    ) -> HistoryEvent:
        require(revision_id in self.pointers(), "REVISION_NOT_FOUND", "released revision is not stored")
        require(isinstance(release_id, str) and bool(release_id), "RELEASE_ID_INVALID", "release ID is required")
        require(bool(evidence_refs), "RELEASE_EVIDENCE_MISSING", "release requires evidence references")
        existing = [
            event
            for event in self.log.read_all()
            if event.value["event_type"] == REVISION_RELEASED
            and event.value["payload"]["release_id"] == release_id
        ]
        if existing:
            payload = existing[0].value["payload"]
            require(payload["revision_id"] == revision_id, "RELEASE_IMMUTABILITY_VIOLATION", "release ID already binds another revision")
            return existing[0]
        return self.log.append(
            REVISION_RELEASED,
            "REVISION",
            revision_id,
            occurred_at,
            actor_provenance,
            {"revision_id": revision_id, "release_id": release_id, "evidence_refs": list(evidence_refs)},
        )

    def releases(self, revision_id: Optional[str] = None) -> List[HistoryEvent]:
        return [
            event
            for event in self.log.read_all()
            if event.value["event_type"] == REVISION_RELEASED
            and (revision_id is None or event.value["payload"]["revision_id"] == revision_id)
        ]
