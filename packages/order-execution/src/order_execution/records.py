from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterable, Mapping, Optional

from .canonical import digest_json
from .errors import OrderExecutionError, require


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$")


class OrderState(str, Enum):
    DRAFT = "DRAFT"
    DISPATCH_PENDING = "DISPATCH_PENDING"
    DISPATCHED = "DISPATCHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EXCEPTION = "EXCEPTION"
    UNKNOWN = "UNKNOWN"
    CLOSED = "CLOSED"


class ConnectorKind(str, Enum):
    EDI = "EDI"
    API = "API"
    EMAIL_LIKE = "EMAIL_LIKE"
    RECORDING = "RECORDING"


class DeliveryOutcome(str, Enum):
    DISPATCHED = "DISPATCHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EXCEPTION = "EXCEPTION"
    UNKNOWN = "UNKNOWN"


class SendEffect(str, Enum):
    NOT_SENT = "NOT_SENT"
    POSSIBLY_SENT = "POSSIBLY_SENT"
    SENT = "SENT"


class RetryDisposition(str, Enum):
    SAFE_WITH_NEW_KEY = "SAFE_WITH_NEW_KEY"
    RECONCILE_REQUIRED = "RECONCILE_REQUIRED"
    NOT_RETRYABLE = "NOT_RETRYABLE"


class ExecutionMode(str, Enum):
    RECORDING_ONLY = "RECORDING_ONLY"
    EXTERNAL = "EXTERNAL"


@dataclass(frozen=True)
class CandidateIdentity:
    candidate_id: str
    revision: str
    artifact_sha256: str

    def __post_init__(self) -> None:
        require(bool(self.candidate_id), "CANDIDATE_ID_INVALID", "candidate ID is required")
        require(bool(self.revision), "CANDIDATE_REVISION_INVALID", "candidate revision is required")
        require(SHA256_RE.fullmatch(self.artifact_sha256) is not None, "CANDIDATE_HASH_INVALID", "candidate artifact hash must be lowercase SHA-256")

    def as_dict(self) -> dict[str, str]:
        return {
            "candidate_id": self.candidate_id,
            "revision": self.revision,
            "artifact_sha256": self.artifact_sha256,
        }


@dataclass(frozen=True)
class DispatchRequest:
    request_id: str
    request_sha256: str
    idempotency_key: str
    candidate: CandidateIdentity
    package_id: str
    sealed_manifest_sha256: str
    selection_count: int
    file_count: int
    connector_kind: ConnectorKind
    connector_id: str
    route_ref: str
    execution_mode: ExecutionMode
    created_at: str
    actor_id: str
    retry_of_request_id: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": "strafe.order-dispatch-request/1",
            "request_id": self.request_id,
            "request_sha256": self.request_sha256,
            "idempotency_key": self.idempotency_key,
            "candidate": self.candidate.as_dict(),
            "package": {
                "package_id": self.package_id,
                "sealed_manifest_sha256": self.sealed_manifest_sha256,
                "selection_count": self.selection_count,
                "file_count": self.file_count,
            },
            "connector": {
                "kind": self.connector_kind.value,
                "connector_id": self.connector_id,
                "route_ref": self.route_ref,
            },
            "execution_mode": self.execution_mode.value,
            "created_at": self.created_at,
            "actor_id": self.actor_id,
            "retry_of_request_id": self.retry_of_request_id,
        }


@dataclass(frozen=True)
class DispatchReceipt:
    receipt_id: str
    receipt_sha256: str
    request_id: str
    request_sha256: str
    idempotency_key: str
    state: OrderState
    delivery_outcome: DeliveryOutcome
    send_effect: SendEffect
    retry_disposition: RetryDisposition
    execution_mode: ExecutionMode
    external_effect: str
    connector_reference: Optional[str]
    detail_code: str
    created_at: str
    supersedes_receipt_id: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "schema_version": "strafe.order-dispatch-receipt/1",
            "receipt_id": self.receipt_id,
            "receipt_sha256": self.receipt_sha256,
            "request_id": self.request_id,
            "request_sha256": self.request_sha256,
            "idempotency_key": self.idempotency_key,
            "state": self.state.value,
            "delivery_outcome": self.delivery_outcome.value,
            "send_effect": self.send_effect.value,
            "retry_disposition": self.retry_disposition.value,
            "execution_mode": self.execution_mode.value,
            "external_effect": self.external_effect,
            "connector_reference": self.connector_reference,
            "detail_code": self.detail_code,
            "created_at": self.created_at,
            "supersedes_receipt_id": self.supersedes_receipt_id,
        }


@dataclass(frozen=True)
class AuditEvent:
    value: Mapping[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return copy.deepcopy(dict(self.value))

    @property
    def event_sha256(self) -> str:
        return str(self.value["event_sha256"])


def _record(preimage: dict[str, Any], id_prefix: str, hash_field: str, id_field: str) -> dict[str, Any]:
    digest = digest_json(preimage)
    return {**preimage, id_field: id_prefix + digest, hash_field: digest}


def build_request(
    *,
    idempotency_key: str,
    candidate: CandidateIdentity,
    package_id: str,
    sealed_manifest_sha256: str,
    selection_count: int,
    file_count: int,
    connector_kind: ConnectorKind,
    connector_id: str,
    route_ref: str,
    execution_mode: ExecutionMode,
    created_at: str,
    actor_id: str,
    retry_of_request_id: Optional[str],
) -> DispatchRequest:
    require(len(idempotency_key) >= 8, "IDEMPOTENCY_KEY_INVALID", "idempotency key must contain at least eight characters")
    require(UTC_RE.fullmatch(created_at) is not None, "TIMESTAMP_INVALID", "created_at must be an explicit UTC timestamp")
    require(bool(actor_id), "ACTOR_INVALID", "actor ID is required")
    require(bool(connector_id) and bool(route_ref), "CONNECTOR_INVALID", "connector identity and route are required")
    preimage = {
        "schema_version": "strafe.order-dispatch-request/1",
        "idempotency_key": idempotency_key,
        "candidate": candidate.as_dict(),
        "package": {
            "package_id": package_id,
            "sealed_manifest_sha256": sealed_manifest_sha256,
            "selection_count": selection_count,
            "file_count": file_count,
        },
        "connector": {"kind": connector_kind.value, "connector_id": connector_id, "route_ref": route_ref},
        "execution_mode": execution_mode.value,
        "created_at": created_at,
        "actor_id": actor_id,
        "retry_of_request_id": retry_of_request_id,
    }
    value = _record(preimage, "order-request:", "request_sha256", "request_id")
    return DispatchRequest(
        request_id=value["request_id"], request_sha256=value["request_sha256"],
        idempotency_key=idempotency_key, candidate=candidate, package_id=package_id,
        sealed_manifest_sha256=sealed_manifest_sha256, selection_count=selection_count,
        file_count=file_count, connector_kind=connector_kind, connector_id=connector_id,
        route_ref=route_ref, execution_mode=execution_mode, created_at=created_at,
        actor_id=actor_id, retry_of_request_id=retry_of_request_id,
    )


def build_receipt(
    request: DispatchRequest,
    *,
    state: OrderState,
    delivery_outcome: DeliveryOutcome,
    send_effect: SendEffect,
    retry_disposition: RetryDisposition,
    external_effect: str,
    connector_reference: Optional[str],
    detail_code: str,
    created_at: str,
    supersedes_receipt_id: Optional[str] = None,
) -> DispatchReceipt:
    require(state not in {OrderState.DRAFT, OrderState.DISPATCH_PENDING}, "RECEIPT_STATE_INVALID", "pending states do not produce dispatch receipts")
    require(external_effect in {"NONE", "CONNECTOR_REPORTED"}, "EXTERNAL_EFFECT_INVALID", "external effect must be explicit")
    require(UTC_RE.fullmatch(created_at) is not None, "TIMESTAMP_INVALID", "receipt timestamp must be UTC")
    preimage = {
        "schema_version": "strafe.order-dispatch-receipt/1",
        "request_id": request.request_id,
        "request_sha256": request.request_sha256,
        "idempotency_key": request.idempotency_key,
        "state": state.value,
        "delivery_outcome": delivery_outcome.value,
        "send_effect": send_effect.value,
        "retry_disposition": retry_disposition.value,
        "execution_mode": request.execution_mode.value,
        "external_effect": external_effect,
        "connector_reference": connector_reference,
        "detail_code": detail_code,
        "created_at": created_at,
        "supersedes_receipt_id": supersedes_receipt_id,
    }
    value = _record(preimage, "order-receipt:", "receipt_sha256", "receipt_id")
    return DispatchReceipt(
        receipt_id=value["receipt_id"], receipt_sha256=value["receipt_sha256"],
        request_id=request.request_id, request_sha256=request.request_sha256,
        idempotency_key=request.idempotency_key, state=state,
        delivery_outcome=delivery_outcome, send_effect=send_effect,
        retry_disposition=retry_disposition, execution_mode=request.execution_mode,
        external_effect=external_effect, connector_reference=connector_reference,
        detail_code=detail_code, created_at=created_at,
        supersedes_receipt_id=supersedes_receipt_id,
    )


def build_audit_event(
    *,
    sequence: int,
    previous_event_sha256: Optional[str],
    event_type: str,
    state: OrderState,
    request_id: str,
    receipt_id: Optional[str],
    actor_id: str,
    occurred_at: str,
    payload: dict[str, Any],
) -> AuditEvent:
    require(UTC_RE.fullmatch(occurred_at) is not None, "TIMESTAMP_INVALID", "audit timestamp must be UTC")
    preimage = {
        "schema_version": "strafe.order-audit-event/1",
        "sequence": sequence,
        "previous_event_sha256": previous_event_sha256,
        "event_type": event_type,
        "state": state.value,
        "request_id": request_id,
        "receipt_id": receipt_id,
        "actor_id": actor_id,
        "occurred_at": occurred_at,
        "payload": copy.deepcopy(payload),
    }
    value = _record(preimage, "order-event:", "event_sha256", "event_id")
    return AuditEvent(copy.deepcopy(value))


def verify_audit_chain(events: Iterable[AuditEvent | Mapping[str, Any]]) -> tuple[AuditEvent, ...]:
    checked: list[AuditEvent] = []
    previous: Optional[str] = None
    for sequence, raw in enumerate(events):
        value = raw.as_dict() if isinstance(raw, AuditEvent) else copy.deepcopy(dict(raw))
        require(value.get("sequence") == sequence, "AUDIT_SEQUENCE_INVALID", "audit sequence is not contiguous")
        require(value.get("previous_event_sha256") == previous, "AUDIT_CHAIN_INVALID", "audit predecessor does not match")
        event_hash = value.pop("event_sha256", None)
        event_id = value.pop("event_id", None)
        actual = digest_json(value)
        require(event_hash == actual, "AUDIT_HASH_MISMATCH", "audit event hash does not match its canonical preimage")
        require(event_id == "order-event:" + actual, "AUDIT_HASH_MISMATCH", "audit event ID does not match its hash")
        value["event_id"] = event_id
        value["event_sha256"] = event_hash
        checked.append(AuditEvent(value))
        previous = actual
    return tuple(checked)


def verify_record_hash(value: Mapping[str, Any], hash_field: str, id_field: str, id_prefix: str) -> None:
    copied = copy.deepcopy(dict(value))
    claimed_hash = copied.pop(hash_field, None)
    claimed_id = copied.pop(id_field, None)
    actual = digest_json(copied)
    require(claimed_hash == actual, "RECORD_HASH_MISMATCH", "record hash does not match canonical bytes")
    require(claimed_id == id_prefix + actual, "RECORD_HASH_MISMATCH", "record ID does not match record hash")
