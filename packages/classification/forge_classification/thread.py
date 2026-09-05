"""The product-thread adapter for the lane: `forge.record/1` records in the proposed `compliance`
authority domain, appended as a chain of `forge.event/1` events.

The platform contract's registry does not yet carry a `compliance` domain or these record kinds;
this adapter emits the contract's exact shapes so admission is a registry decision, not a rewrite.
Actor discipline: an analysis is agent-written and authorises nothing; the adopted classification
record is human-only with an attestor role; a supersession exists only alongside the adoption that
causes it. Refusals are stable codes.
"""

from __future__ import annotations

import json
from typing import Iterable

from . import route as route_module
from .records import canonical_bytes, command_hash, record_ref, seal_event, seal_record, sha256, content_hash, event_hash

AUTHORITY_DOMAIN = "compliance"
CLAIM_CEILING = "SYNTHETIC_LOCAL_ONLY"
ADOPTABLE_CLAIM_CLASSES = ("conditional", "supported")
KIND_ACTORS: dict[str, frozenset[str]] = {
    "compliance.declared-facts.v1": frozenset({"HUMAN", "AGENT", "SYSTEM"}),
    "compliance.analysis.v1": frozenset({"AGENT", "SYSTEM"}),
    "compliance.analysis-round.v1": frozenset({"AGENT", "SYSTEM"}),
    "compliance.analysis-failure.v1": frozenset({"AGENT", "SYSTEM"}),
    "compliance.classification-record.v1": frozenset({"HUMAN"}),
    "compliance.classification-supersession.v1": frozenset({"SYSTEM"}),
    "compliance.impact.v1": frozenset({"AGENT", "SYSTEM"}),
}
_REQUIRED_ENVELOPE_KEYS = ("schema_version", "snapshot_sha256", "pack_sha256", "item", "readiness", "candidates", "route",
                           "claim_class", "recommended_instrument", "questions", "provenance")


class ThreadRefused(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


def route_consistent(envelope: dict) -> list[str]:
    """Violations between the route and the records it claims to summarise."""
    problems: list[str] = []
    route = envelope["route"]
    cands = envelope["candidates"]
    by_id = {c["candidate_id"]: c for c in cands}
    leading = by_id.get(route["leading_candidate_id"]) if route["leading_candidate_id"] else None
    if route["leading_candidate_id"] and leading is None:
        problems.append("leading candidate is not on the board")
    if leading is not None and leading["status"] != "leading":
        problems.append("the leading candidate's status is not leading")
    if sum(1 for c in cands if c["status"] == "leading") > 1:
        problems.append("more than one leading candidate")
    if route["posture"] in ("EAR", "EAR99") and route["usml_step"] != "negative":
        problems.append("an EAR-family posture requires a recorded USML negative")
    if route["posture"] == "ITAR":
        if route["usml_step"] != "supported" or leading is None or leading["stage"] not in route_module.USML_STAGES:
            problems.append("an ITAR posture requires a supported, leading USML candidate")
    if route["posture"] == "EAR99":
        if leading is None or leading["provision"] != "EAR99":
            problems.append("an EAR99 posture requires the residual to be leading")
        for c in cands:
            if c["stage"] in route_module.CCL_STAGES and c["status"] in ("leading", "blocked_on_facts"):
                problems.append(f"EAR99 cannot be elected while {c['provision']} is {c['status']}")
    if route["posture"] == "EAR" and route["ccl_step"] == "specific_supported":
        if leading is None or leading["stage"] not in route_module.CCL_STAGES:
            problems.append("a supported CCL step requires a leading CCL candidate")
    for c in cands:
        if c["status"] == "knocked_out":
            if not c["why_rejected"]:
                problems.append(f"{c['provision']} is knocked out without a written reason")
            if not any(e["disposition"] == "not_met" and e["citation"] for e in c["elements"]):
                problems.append(f"{c['provision']} is knocked out without a cited failed element")
    if (envelope["claim_class"] == "ambiguous") != (envelope["recommended_instrument"] is not None):
        problems.append("an instrument is recommended iff the claim class is ambiguous")
    return problems


class Thread:
    def __init__(self, product_thread_id: str, *, tool_identity: str = "forge@unknown"):
        self.product_thread_id = product_thread_id
        self.tool_identity = tool_identity
        self.events: list[dict] = []
        self.records: dict[str, dict] = {}
        self._idempotency: dict[tuple[str, str], tuple[str, str]] = {}  # (domain, key) -> (command_hash, revision_id)

    # -- generic append ------------------------------------------------------------------------
    def append_record(self, kind: str, record_id: str, payload: dict, *, actor: dict, occurred_at: str,
                      idempotency_key: str, authorization_ref: str | None = None,
                      parent_revision_ids: Iterable[str] = (), lifecycle_state: str = "DRAFT",
                      source_confidence: dict | None = None, artifact_refs: Iterable[dict] = (),
                      input_record_refs: Iterable[dict] = (), _internal: bool = False) -> tuple[dict, dict]:
        allowed = KIND_ACTORS.get(kind)
        if allowed is None:
            raise ThreadRefused("RECORD_KIND_UNKNOWN", kind)
        if kind == "compliance.classification-supersession.v1" and not _internal:
            raise ThreadRefused("SUPERSESSION_WITHOUT_ADOPTION", "a supersession is written only alongside the adoption that causes it")
        if actor.get("actor_type") not in allowed:
            raise ThreadRefused("WRONG_ACTOR", f"{kind} may be written by {sorted(allowed)}, not {actor.get('actor_type')!r}")

        command = {
            "protocol_version": "forge.command/1",
            "command_id": f"command:{kind}:{idempotency_key}",
            "command_kind": "CREATE_RECORD",
            "target_authority_domain": AUTHORITY_DOMAIN,
            "target_record_kind": kind,
            "target_record_id": record_id,
            "base_revision_id": None,
            "base_content_hash": None,
            "actor": actor,
            "intent": f"append {kind}",
            "authorization_ref": authorization_ref,
            "idempotency_key": idempotency_key,
            "external": False,
            "payload": payload,
        }
        digest = command_hash(command)
        seen = self._idempotency.get((AUTHORITY_DOMAIN, idempotency_key))
        if seen is not None:
            if seen[0] == digest:
                record = self.records[seen[1]]
                return record, next(e for e in self.events if e["after_ref"]["revision_id"] == seen[1])
            raise ThreadRefused("IDEMPOTENCY_CONFLICT", idempotency_key)

        record = seal_record({
            "schema_version": "forge.record/1",
            "record_kind": kind,
            "record_id": record_id,
            "parent_revision_ids": list(parent_revision_ids),
            "lifecycle_state": lifecycle_state,
            "authority_domain": AUTHORITY_DOMAIN,
            "actor": actor,
            "authorization_ref": authorization_ref,
            "command_id": command["command_id"],
            "idempotency_key": idempotency_key,
            "occurred_at": occurred_at,
            "recorded_at": occurred_at,
            "effective_window": {"from": None, "through": None},
            "source_confidence": source_confidence or {"level": "DECLARED", "basis": "classification lane record", "observed_at": occurred_at},
            "source_refs": [],
            "provenance": {
                "adapter_id": "forge-classification",
                "adapter_version": "1",
                "tool_identity": self.tool_identity,
                "input_record_refs": list(input_record_refs),
                "artifact_refs": list(artifact_refs),
                "generated_at": occurred_at,
            },
            "units": {"system": "SI_MM", "overrides": {}},
            "tolerances": {"linear_mm": "0.000001", "angular_deg": "0.000001"},
            "claim_ceiling": CLAIM_CEILING,
            "payload": payload,
        })
        event = seal_event({
            "protocol_version": "forge.event/1",
            "event_order": len(self.events) + 1,
            "product_thread_id": self.product_thread_id,
            "state": "APPLIED",
            "command_id": command["command_id"],
            "command_hash": digest,
            "authorization_ref": authorization_ref,
            "before_ref": None,
            "after_ref": record_ref(record),
            "effect_ref": None,
            "previous_event_hash": self.events[-1]["event_hash"] if self.events else None,
            "occurred_at": occurred_at,
            "diagnostics": [],
        })
        self.records[record["revision_id"]] = record
        self.events.append(event)
        self._idempotency[(AUTHORITY_DOMAIN, idempotency_key)] = (digest, record["revision_id"])
        return record, event

    # -- lane records -------------------------------------------------------------------------
    def append_analysis(self, envelope: dict, *, actor: dict, occurred_at: str, idempotency_key: str) -> tuple[dict, dict]:
        missing = [k for k in _REQUIRED_ENVELOPE_KEYS if k not in envelope]
        if missing:
            raise ThreadRefused("SCHEMA_INVALID", f"envelope lacks {missing}")
        problems = route_consistent(envelope)
        if problems:
            raise ThreadRefused("ROUTE_CONTRADICTS_RECORDS", "; ".join(problems))
        item = envelope["item"]
        prior = self.latest_analysis(item["part_revision_id"], item["item_kind"])
        payload = {"envelope": envelope, "envelope_sha256": envelope_sha256(envelope)}
        return self.append_record(
            "compliance.analysis.v1", f"analysis:{item['part_revision_id']}:{item['item_kind']}", payload,
            actor=actor, occurred_at=occurred_at, idempotency_key=idempotency_key,
            parent_revision_ids=[prior["revision_id"]] if prior else [],
            source_confidence={"level": "INFERRED", "basis": "model-filled records, code-concluded route", "observed_at": occurred_at},
        )

    def adopt(self, analysis_revision_id: str, *, actor: dict, role: str, occurred_at: str, idempotency_key: str,
              cause: str = "reanalysis") -> list[dict]:
        if actor.get("actor_type") != "HUMAN":
            raise ThreadRefused("WRONG_ACTOR", "only a human may adopt a classification record")
        if not role:
            raise ThreadRefused("AUTHORIZATION_REQUIRED", "an attestor role is required")
        analysis = self.records.get(analysis_revision_id)
        if analysis is None or analysis["record_kind"] != "compliance.analysis.v1":
            raise ThreadRefused("REFERENCE_MISSING", analysis_revision_id)
        envelope = analysis["payload"]["envelope"]
        item = envelope["item"]
        latest = self.latest_analysis(item["part_revision_id"], item["item_kind"])
        if latest is None or latest["revision_id"] != analysis_revision_id:
            raise ThreadRefused("STALE_BASE", "a newer analysis exists for this item")
        if envelope["claim_class"] not in ADOPTABLE_CLAIM_CLASSES:
            raise ThreadRefused("CLAIM_CLASS_NOT_ADOPTABLE", f"{envelope['claim_class']} routes to a round or an instrument, not to adoption")
        if cause not in ("facts_moved", "lists_moved", "reanalysis", "corrected"):
            raise ThreadRefused("LIFECYCLE_INVALID", f"unknown supersession cause {cause!r}")

        leading = next((c for c in envelope["candidates"] if c["candidate_id"] == envelope["route"]["leading_candidate_id"]), None)
        label = envelope["claim_class"].replace("_", " ").capitalize()
        payload = {
            "analysis_revision_id": analysis_revision_id,
            "item": item,
            "attestor": {"actor_id": actor["actor_id"], "role": role},
            "claim_class": envelope["claim_class"],
            "posture": envelope["route"]["posture"],
            "leading_provision": leading["provision"] if leading else None,
            "adoption_sentence": f"Adopting your {label} finding makes this your company's internal classification record, dated {occurred_at[:10]}.",
        }
        prior = self.adopted(item["part_revision_id"], item["item_kind"])
        record, _ = self.append_record(
            "compliance.classification-record.v1", f"classification:{item['part_revision_id']}:{item['item_kind']}", payload,
            actor=actor, occurred_at=occurred_at, idempotency_key=idempotency_key, lifecycle_state="ADOPTED",
            parent_revision_ids=[prior["revision_id"]] if prior else [],
            input_record_refs=[record_ref(analysis)],
        )
        out = [record]
        if prior is not None:
            supersession, _ = self.append_record(
                "compliance.classification-supersession.v1", f"supersession:{prior['revision_id']}",
                {"predecessor_revision_id": prior["revision_id"], "successor_revision_id": record["revision_id"], "cause": cause,
                 "item": item},
                actor={"actor_id": "actor:classification-lane", "actor_type": "SYSTEM", "alias": "classification-lane"},
                occurred_at=occurred_at, idempotency_key=f"{idempotency_key}:supersession", lifecycle_state="SUPERSEDED",
                input_record_refs=[record_ref(prior), record_ref(record)], _internal=True,
            )
            out.append(supersession)
        return out

    # -- reads --------------------------------------------------------------------------------
    def _records_in_order(self) -> list[dict]:
        return [self.records[e["after_ref"]["revision_id"]] for e in self.events]

    def latest_analysis(self, part_revision_id: str, item_kind: str) -> dict | None:
        found = None
        for record in self._records_in_order():
            if record["record_kind"] == "compliance.analysis.v1":
                item = record["payload"]["envelope"]["item"]
                if item["part_revision_id"] == part_revision_id and item["item_kind"] == item_kind:
                    found = record
        return found

    def adopted(self, part_revision_id: str, item_kind: str) -> dict | None:
        found = None
        for record in self._records_in_order():
            if record["record_kind"] == "compliance.classification-record.v1":
                item = record["payload"]["item"]
                if item["part_revision_id"] == part_revision_id and item["item_kind"] == item_kind:
                    found = record
        return found

    def analyses(self) -> list[dict]:
        return [r for r in self._records_in_order() if r["record_kind"] == "compliance.analysis.v1"]

    def declared_facts(self, part_revision_id: str, *, before_event_order: int | None = None) -> list[dict]:
        out = []
        for event in self.events:
            if before_event_order is not None and event["event_order"] >= before_event_order:
                break
            record = self.records[event["after_ref"]["revision_id"]]
            if record["record_kind"] == "compliance.declared-facts.v1" and record["payload"].get("part_revision_id") == part_revision_id:
                out.append(record)
        return out

    # -- integrity ----------------------------------------------------------------------------
    def verify_chain(self) -> list[str]:
        diagnostics: list[str] = []
        previous = None
        for index, event in enumerate(self.events, start=1):
            if event["event_order"] != index:
                diagnostics.append(f"EVENT_CHAIN_INVALID: order {event['event_order']} at position {index}")
            if event["previous_event_hash"] != previous:
                diagnostics.append(f"EVENT_CHAIN_INVALID: broken link at {index}")
            if event_hash(event) != event["event_hash"]:
                diagnostics.append(f"EVENT_CHAIN_INVALID: event hash mismatch at {index}")
            record = self.records.get(event["after_ref"]["revision_id"])
            if record is None:
                diagnostics.append(f"REFERENCE_MISSING: {event['after_ref']['revision_id']}")
            else:
                if content_hash(record) != record["content_hash"]:
                    diagnostics.append(f"HASH_MISMATCH: {record['revision_id']}")
                if record["revision_id"] != f"record-rev:{record['content_hash']}":
                    diagnostics.append(f"HASH_MISMATCH: revision id {record['revision_id']}")
            previous = event["event_hash"]
        return diagnostics

    # -- persistence adapter ------------------------------------------------------------------
    def to_jsonl(self) -> str:
        lines = [json.dumps({"kind": "thread", "product_thread_id": self.product_thread_id, "tool_identity": self.tool_identity}, sort_keys=True)]
        for event in self.events:
            record = self.records[event["after_ref"]["revision_id"]]
            lines.append(json.dumps({"kind": "record", "record": record}, sort_keys=True, ensure_ascii=False))
            lines.append(json.dumps({"kind": "event", "event": event}, sort_keys=True, ensure_ascii=False))
        return "\n".join(lines) + "\n"

    @classmethod
    def from_jsonl(cls, text: str) -> "Thread":
        thread: Thread | None = None
        for line in text.splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row["kind"] == "thread":
                thread = cls(row["product_thread_id"], tool_identity=row["tool_identity"])
            elif row["kind"] == "record":
                assert thread is not None
                thread.records[row["record"]["revision_id"]] = row["record"]
            elif row["kind"] == "event":
                assert thread is not None
                event = row["event"]
                thread.events.append(event)
                record = thread.records[event["after_ref"]["revision_id"]]
                thread._idempotency[(AUTHORITY_DOMAIN, record["idempotency_key"])] = (event["command_hash"], record["revision_id"])
        if thread is None:
            raise ValueError("no thread header line")
        return thread


def envelope_sha256(envelope: dict) -> str:
    return sha256(canonical_bytes(envelope))
