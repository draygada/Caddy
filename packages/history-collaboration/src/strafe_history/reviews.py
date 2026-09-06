"""Append-only proposal review records with advisory-agent separation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .actors import validate_actor
from .errors import require
from .events import AppendOnlyEventLog, HistoryEvent


REVIEW_DECISIONS = {"APPROVE", "REJECT", "REQUEST_CHANGES", "COMMENT"}


class ReviewLedger:
    EVENT_TYPE = "PROPOSAL_REVIEW_RECORDED"

    def __init__(self, log: AppendOnlyEventLog) -> None:
        self.log = log

    def append(
        self,
        proposal_id: str,
        decision: str,
        actor: Dict[str, Any],
        occurred_at: str,
        source_ref: str,
        reviewed_revision_id: str,
        comment: Optional[str] = None,
    ) -> HistoryEvent:
        checked = validate_actor(actor)
        require(decision in REVIEW_DECISIONS, "REVIEW_DECISION_INVALID", "unsupported review decision")
        require(isinstance(proposal_id, str) and bool(proposal_id), "PROPOSAL_ID_INVALID", "proposal ID is required")
        require(isinstance(reviewed_revision_id, str) and bool(reviewed_revision_id), "REVISION_ID_INVALID", "reviewed revision ID is required")
        binding = checked["actor_kind"] == "HUMAN" and decision in {"APPROVE", "REJECT", "REQUEST_CHANGES"}
        provenance: Dict[str, Any] = {
            "actor_id": checked["actor_id"],
            "actor_kind": checked["actor_kind"],
            "source_ref": source_ref,
        }
        if checked["actor_kind"] == "AGENT":
            provenance["agent_execution_identity"] = checked["execution_identity"]
        return self.log.append(
            self.EVENT_TYPE,
            "PROPOSAL",
            proposal_id,
            occurred_at,
            provenance,
            {
                "proposal_id": proposal_id,
                "reviewed_revision_id": reviewed_revision_id,
                "decision": decision,
                "binding_human_decision": binding,
                "comment": comment,
            },
        )

    def reviews(self, proposal_id: str) -> List[HistoryEvent]:
        return [
            event
            for event in self.log.read_all()
            if event.value["event_type"] == self.EVENT_TYPE
            and event.value["aggregate_id"] == proposal_id
        ]

    def binding_decision(self, proposal_id: str, revision_id: str) -> Optional[str]:
        decision: Optional[str] = None
        for event in self.reviews(proposal_id):
            payload = event.value["payload"]
            if payload["reviewed_revision_id"] == revision_id and payload["binding_human_decision"]:
                decision = payload["decision"]
        return decision

    def is_human_approved(self, proposal_id: str, revision_id: str) -> bool:
        return self.binding_decision(proposal_id, revision_id) == "APPROVE"
