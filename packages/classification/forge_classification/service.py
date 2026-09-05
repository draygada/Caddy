"""The facade verbs for the classification lane. Every caller crosses this seam.

`declare` appends facts (a human's are attested); `request_analysis` builds the snapshot from the
thread, runs the pure engine and appends the proposal (or a failure record, never a partial board);
`adopt` is the human terminal act; `board` and `impact` are reads; `rederive` replays every
analysis from the thread's own facts and a replay model and compares envelope hashes.
"""

from __future__ import annotations

from .engine import Insufficient, ModelUnavailable, classify
from .impact import impact as impact_report
from .model import Budget, BudgetExhausted, BudgetedModel, ModelClient
from .pack import ReferencePack
from .snapshot import snapshot
from .thread import Thread, envelope_sha256

SYSTEM = {"actor_id": "actor:classification-lane", "actor_type": "SYSTEM", "alias": "classification-lane"}


class Service:
    def __init__(self, thread: Thread, pack: ReferencePack, model: ModelClient, *, calls_cap: int, cost_cap_microusd: int,
                 actor: dict, estimated_cost_microusd: int = 250_000):
        self.thread = thread
        self.pack = pack
        self.model = model
        self.calls_cap = calls_cap
        self.cost_cap_microusd = cost_cap_microusd
        self.actor = actor
        self.estimated_cost_microusd = estimated_cost_microusd

    # -- facts ----------------------------------------------------------------------------------
    def declare(self, part_revision: dict, facts: list[dict], *, actor: dict, occurred_at: str, idempotency_key: str,
                level: str = "DECLARED", artifact_refs: list[dict] | None = None) -> dict:
        revision_id = part_revision["part_document"]["revision"]["revision_id"]
        record, _ = self.thread.append_record(
            "compliance.declared-facts.v1", f"declared:{revision_id}:{idempotency_key}",
            {"part_revision_id": revision_id, "facts": facts},
            actor=actor, occurred_at=occurred_at, idempotency_key=idempotency_key,
            source_confidence={"level": level, "basis": "declared on the design surface", "observed_at": occurred_at},
            artifact_refs=artifact_refs or [],
        )
        return record

    # -- analysis -------------------------------------------------------------------------------
    def request_analysis(self, part_revision: dict, item_kind: str, *, occurred_at: str, idempotency_key: str,
                         progress=None) -> dict:
        revision_id = part_revision["part_document"]["revision"]["revision_id"]
        snap = snapshot(part_revision, self.thread.declared_facts(revision_id), item_kind=item_kind)
        budget = Budget(calls_cap=self.calls_cap, cost_cap_microusd=self.cost_cap_microusd)
        model = BudgetedModel(self.model, budget, estimated_cost_microusd=self.estimated_cost_microusd)
        try:
            envelope = classify(snap, self.pack, model, budget, progress=progress)
        except Insufficient as error:
            return self._failure(revision_id, item_kind, snap.sha256, occurred_at, idempotency_key, "insufficient",
                                 {"stage": "readiness", "missing_fields": error.missing_fields, "blocking_fields": error.blocking_fields})
        except BudgetExhausted as error:
            return self._failure(revision_id, item_kind, snap.sha256, occurred_at, idempotency_key, "budget_exhausted",
                                 {"stage": "analysis", "detail": str(error), "budget": budget.as_dict()})
        except ModelUnavailable as error:
            return self._failure(revision_id, item_kind, snap.sha256, occurred_at, idempotency_key, "model_unavailable",
                                 {"stage": "usml_propose", "detail": str(error)})
        record, event = self.thread.append_analysis(envelope, actor=self.actor, occurred_at=occurred_at, idempotency_key=idempotency_key)
        round_record = None
        if envelope["questions"]:
            round_record, _ = self.thread.append_record(
                "compliance.analysis-round.v1", f"round:{revision_id}:{item_kind}:{idempotency_key}",
                {"analysis_revision_id": record["revision_id"], "snapshot_sha256": envelope["snapshot_sha256"],
                 "questions": envelope["questions"]},
                actor=SYSTEM, occurred_at=occurred_at, idempotency_key=f"{idempotency_key}:round",
            )
        return {"record": record, "event": event, "envelope": envelope, "round": round_record}

    def _failure(self, revision_id: str, item_kind: str, snapshot_sha: str, occurred_at: str, idempotency_key: str,
                 reason: str, detail: dict) -> dict:
        record, event = self.thread.append_record(
            "compliance.analysis-failure.v1", f"analysis-failure:{revision_id}:{item_kind}:{idempotency_key}",
            {"item": {"part_revision_id": revision_id, "item_kind": item_kind}, "snapshot_sha256": snapshot_sha,
             "reason": reason, **detail},
            actor=self.actor, occurred_at=occurred_at, idempotency_key=idempotency_key,
        )
        return {"record": record, "event": event, "envelope": None, "round": None}

    # -- the human act --------------------------------------------------------------------------
    def adopt(self, analysis_revision_id: str, *, actor: dict, role: str, occurred_at: str, idempotency_key: str,
              cause: str = "reanalysis") -> list[dict]:
        return self.thread.adopt(analysis_revision_id, actor=actor, role=role, occurred_at=occurred_at,
                                 idempotency_key=idempotency_key, cause=cause)

    # -- reads ----------------------------------------------------------------------------------
    def board(self, part_revision_id: str, item_kind: str) -> dict | None:
        record = self.thread.latest_analysis(part_revision_id, item_kind)
        return record["payload"]["envelope"] if record else None

    def impact(self, pack_b: ReferencePack) -> dict:
        return impact_report(self.pack, pack_b, [r["payload"]["envelope"] for r in self.thread.analyses()])

    # -- replay ---------------------------------------------------------------------------------
    def rederive(self, part_revisions: dict[str, dict]) -> dict:
        diagnostics = self.thread.verify_chain()
        analyses = []
        for event in self.thread.events:
            record = self.thread.records[event["after_ref"]["revision_id"]]
            if record["record_kind"] != "compliance.analysis.v1":
                continue
            stored = record["payload"]["envelope"]
            item = stored["item"]
            part_revision = part_revisions.get(item["part_revision_id"])
            if part_revision is None:
                analyses.append({"revision_id": record["revision_id"], "replayed": False, "envelope_sha256_matches": None})
                continue
            declared = self.thread.declared_facts(item["part_revision_id"], before_event_order=event["event_order"])
            snap = snapshot(part_revision, declared, item_kind=item["item_kind"])
            caps = stored["provenance"]["budget"]
            budget = Budget(calls_cap=caps["calls_cap"], cost_cap_microusd=caps["cost_cap_microusd"])
            model = BudgetedModel(self.model, budget, estimated_cost_microusd=self.estimated_cost_microusd)
            try:
                replayed = classify(snap, self.pack, model, budget)
                matches = envelope_sha256(replayed) == record["payload"]["envelope_sha256"]
            except (Insufficient, BudgetExhausted, ModelUnavailable):
                matches = False
            analyses.append({"revision_id": record["revision_id"], "replayed": True, "envelope_sha256_matches": matches})
        return {"chain": "intact" if not diagnostics else "broken", "diagnostics": diagnostics, "analyses": analyses}
