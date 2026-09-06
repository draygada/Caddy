"""Event-sourced branch pointers and interrupted-apply recovery."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence

from .errors import DiagnosticError, require
from .events import AppendOnlyEventLog, EventTransaction, HistoryEvent


BRANCH_CREATED = "BRANCH_CREATED"
APPLY_STARTED = "REVISION_APPLY_STARTED"
REVISION_APPLIED = "REVISION_APPLIED"
APPLY_ABORTED = "REVISION_APPLY_ABORTED"
REVISION_ROLLED_BACK = "REVISION_ROLLED_BACK"


@dataclass(frozen=True)
class BranchProjection:
    heads: Dict[str, str]
    pending_applies: Dict[str, Dict[str, Any]]
    terminal_apply_ids: frozenset


class EventSourcedBranches:
    """Derives every branch head from immutable events.

    A candidate snapshot is stored before APPLY_STARTED.  A branch advances only
    at REVISION_APPLIED/REVISION_ROLLED_BACK.  Recovery therefore either appends
    the missing terminal event after revalidating the candidate or appends a
    durable abort; it never edits an earlier record.
    """

    def __init__(self, log: AppendOnlyEventLog) -> None:
        self.log = log

    @staticmethod
    def _project(events: Sequence[HistoryEvent]) -> BranchProjection:
        heads: Dict[str, str] = {}
        pending: Dict[str, Dict[str, Any]] = {}
        terminal = set()
        for event in events:
            event_type = event.value["event_type"]
            payload = event.value["payload"]
            if event_type == BRANCH_CREATED:
                branch = payload.get("branch")
                revision_id = payload.get("revision_id")
                require(isinstance(branch, str) and bool(branch), "BRANCH_EVENT_INVALID", "branch is required")
                require(isinstance(revision_id, str) and bool(revision_id), "BRANCH_EVENT_INVALID", "revision_id is required")
                require(branch not in heads, "BRANCH_ALREADY_EXISTS", "branch has more than one creation event", branch=branch)
                heads[branch] = revision_id
            elif event_type == APPLY_STARTED:
                apply_id = payload.get("apply_id")
                require(isinstance(apply_id, str) and bool(apply_id), "APPLY_EVENT_INVALID", "apply_id is required")
                require(apply_id not in pending and apply_id not in terminal, "APPLY_EVENT_INVALID", "apply ID was reused")
                pending[apply_id] = dict(payload)
            elif event_type in {REVISION_APPLIED, APPLY_ABORTED, REVISION_ROLLED_BACK}:
                apply_id = payload.get("apply_id")
                require(isinstance(apply_id, str) and apply_id in pending, "APPLY_EVENT_INVALID", "terminal apply event has no start")
                started = pending.pop(apply_id)
                terminal.add(apply_id)
                if event_type in {REVISION_APPLIED, REVISION_ROLLED_BACK}:
                    branch = started["branch"]
                    require(heads.get(branch) == started["expected_head_revision_id"], "BRANCH_HISTORY_CONFLICT", "recorded apply expected a different head")
                    require(payload.get("revision_id") == started["candidate_revision_id"], "APPLY_EVENT_INVALID", "terminal revision differs from staged candidate")
                    heads[branch] = payload["revision_id"]
        return BranchProjection(heads=dict(heads), pending_applies=dict(pending), terminal_apply_ids=frozenset(terminal))

    def project(self) -> BranchProjection:
        return self._project(self.log.read_all())

    def head(self, branch: str) -> str:
        projection = self.project()
        if branch not in projection.heads:
            raise DiagnosticError("BRANCH_NOT_FOUND", "branch does not exist", details={"branch": branch})
        return projection.heads[branch]

    def create(self, branch: str, revision_id: str, actor_provenance: Dict[str, Any], occurred_at: str) -> HistoryEvent:
        require(isinstance(branch, str) and bool(branch), "BRANCH_INVALID", "branch name must be non-empty")
        require(isinstance(revision_id, str) and bool(revision_id), "REVISION_ID_INVALID", "revision ID must be non-empty")

        def create_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            require(
                branch not in self._project(transaction.events).heads,
                "BRANCH_ALREADY_EXISTS",
                "branch already exists",
                branch=branch,
            )
            return transaction.append(
                BRANCH_CREATED,
                "BRANCH",
                "branch:" + branch,
                occurred_at,
                actor_provenance,
                {"branch": branch, "revision_id": revision_id},
            )

        return self.log.transact(create_in_transaction)

    def start_apply(
        self,
        apply_id: str,
        branch: str,
        expected_head_revision_id: str,
        candidate_revision_id: str,
        actor_provenance: Dict[str, Any],
        occurred_at: str,
        proposal_id: Optional[str] = None,
        authorization_id: Optional[str] = None,
        rollback_of_revision_id: Optional[str] = None,
    ) -> HistoryEvent:
        payload = {
            "apply_id": apply_id,
            "branch": branch,
            "expected_head_revision_id": expected_head_revision_id,
            "candidate_revision_id": candidate_revision_id,
            "proposal_id": proposal_id,
            "authorization_id": authorization_id,
            "rollback_of_revision_id": rollback_of_revision_id,
        }

        def start_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            projection = self._project(transaction.events)
            require(
                apply_id not in projection.pending_applies and apply_id not in projection.terminal_apply_ids,
                "APPLY_ID_REUSED",
                "apply ID already exists",
            )
            require(
                projection.heads.get(branch) == expected_head_revision_id,
                "STALE_BASE",
                "branch head does not match expected revision",
                branch=branch,
            )
            require(
                not any(item["branch"] == branch for item in projection.pending_applies.values()),
                "APPLY_ALREADY_PENDING",
                "branch already has an interrupted apply",
                branch=branch,
            )
            return transaction.append(
                APPLY_STARTED,
                "APPLY",
                apply_id,
                occurred_at,
                actor_provenance,
                payload,
            )

        return self.log.transact(start_in_transaction)

    def complete_apply(self, apply_id: str, actor_provenance: Dict[str, Any], occurred_at: str, recovered: bool = False) -> HistoryEvent:
        def complete_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            projection = self._project(transaction.events)
            started = projection.pending_applies.get(apply_id)
            require(started is not None, "APPLY_NOT_PENDING", "apply is not pending", apply_id=apply_id)
            require(
                projection.heads.get(started["branch"]) == started["expected_head_revision_id"],
                "STALE_BASE",
                "branch changed before apply completed",
            )
            event_type = REVISION_ROLLED_BACK if started.get("rollback_of_revision_id") else REVISION_APPLIED
            return transaction.append(
                event_type,
                "BRANCH",
                "branch:" + started["branch"],
                occurred_at,
                actor_provenance,
                {
                    "apply_id": apply_id,
                    "branch": started["branch"],
                    "revision_id": started["candidate_revision_id"],
                    "recovered": recovered,
                },
            )

        return self.log.transact(complete_in_transaction)

    def abort_apply(self, apply_id: str, reason_code: str, actor_provenance: Dict[str, Any], occurred_at: str) -> HistoryEvent:
        def abort_in_transaction(transaction: EventTransaction) -> HistoryEvent:
            started = self._project(transaction.events).pending_applies.get(apply_id)
            require(started is not None, "APPLY_NOT_PENDING", "apply is not pending", apply_id=apply_id)
            return transaction.append(
                APPLY_ABORTED,
                "APPLY",
                apply_id,
                occurred_at,
                actor_provenance,
                {"apply_id": apply_id, "reason_code": reason_code},
            )

        return self.log.transact(abort_in_transaction)

    def recover(
        self,
        candidate_validator: Callable[[str], bool],
        actor_provenance: Dict[str, Any],
        occurred_at: str,
    ) -> List[HistoryEvent]:
        def recover_in_transaction(transaction: EventTransaction) -> List[HistoryEvent]:
            recovered: List[HistoryEvent] = []
            snapshot = self._project(transaction.events)
            for apply_id in sorted(snapshot.pending_applies):
                started = self._project(transaction.events).pending_applies.get(apply_id)
                if started is None:
                    continue
                if self._project(transaction.events).heads.get(started["branch"]) != started["expected_head_revision_id"]:
                    recovered.append(
                        transaction.append(
                            APPLY_ABORTED,
                            "APPLY",
                            apply_id,
                            occurred_at,
                            actor_provenance,
                            {"apply_id": apply_id, "reason_code": "STALE_BASE"},
                        )
                    )
                    continue
                try:
                    valid = candidate_validator(started["candidate_revision_id"])
                except Exception as exc:
                    raise DiagnosticError(
                        "RECOVERY_VALIDATION_FAILED",
                        "candidate validator failed closed",
                        details={"apply_id": apply_id},
                    ) from exc
                if not valid:
                    recovered.append(
                        transaction.append(
                            APPLY_ABORTED,
                            "APPLY",
                            apply_id,
                            occurred_at,
                            actor_provenance,
                            {"apply_id": apply_id, "reason_code": "CANDIDATE_INVALID"},
                        )
                    )
                    continue
                event_type = REVISION_ROLLED_BACK if started.get("rollback_of_revision_id") else REVISION_APPLIED
                recovered.append(
                    transaction.append(
                        event_type,
                        "BRANCH",
                        "branch:" + started["branch"],
                        occurred_at,
                        actor_provenance,
                        {
                            "apply_id": apply_id,
                            "branch": started["branch"],
                            "revision_id": started["candidate_revision_id"],
                            "recovered": True,
                        },
                    )
                )
            return recovered

        return self.log.transact(recover_in_transaction)
