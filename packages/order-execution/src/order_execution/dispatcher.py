from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .canonical import digest_json
from .connectors import ConnectorResult, DispatchAuthority, OrderConnector
from .errors import OrderExecutionError, require
from .manifest import verify_sealed_manifest
from .records import (
    AuditEvent,
    CandidateIdentity,
    DeliveryOutcome,
    DispatchReceipt,
    DispatchRequest,
    ExecutionMode,
    OrderState,
    RetryDisposition,
    SendEffect,
    build_audit_event,
    build_receipt,
    build_request,
    verify_audit_chain,
)


@dataclass(frozen=True)
class DispatchResult:
    request: DispatchRequest
    receipt: DispatchReceipt
    audit_events: tuple[AuditEvent, ...]
    replayed: bool = False


_KNOWN_NOT_SENT = {
    "CONNECTOR_DISABLED",
    "CONNECTOR_NOT_CONFIGURED",
    "EXTERNAL_SEND_NOT_AUTHORIZED",
    "AUTHORITY_SCOPE_MISMATCH",
    "CONNECTOR_IMPLEMENTATION_UNAVAILABLE",
}


class OrderDispatcher:
    """Process-local transactional coordinator over a provider-neutral adapter.

    Durable persistence is an integration responsibility. The returned records
    and events are immutable, content-addressed values suitable for an external
    atomic record store; this package itself performs no supplier I/O.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._events: list[AuditEvent] = []
        self._requests: dict[str, DispatchRequest] = {}
        self._receipts: dict[str, DispatchReceipt] = {}
        self._idempotency: dict[str, tuple[str, DispatchResult]] = {}

    @property
    def audit_events(self) -> tuple[AuditEvent, ...]:
        with self._lock:
            return verify_audit_chain(self._events)

    def _append(
        self,
        event_type: str,
        state: OrderState,
        request: DispatchRequest,
        occurred_at: str,
        payload: dict,
        receipt: Optional[DispatchReceipt] = None,
        actor_id: Optional[str] = None,
    ) -> AuditEvent:
        previous = self._events[-1].event_sha256 if self._events else None
        event = build_audit_event(
            sequence=len(self._events), previous_event_sha256=previous,
            event_type=event_type, state=state, request_id=request.request_id,
            receipt_id=receipt.receipt_id if receipt else None,
            actor_id=actor_id or request.actor_id, occurred_at=occurred_at,
            payload=payload,
        )
        self._events.append(event)
        return event

    @staticmethod
    def _fingerprint(
        *,
        candidate: CandidateIdentity,
        manifest_sha256: str,
        connector: OrderConnector,
        route_ref: str,
        retry_of_request_id: Optional[str],
    ) -> str:
        return digest_json({
            "candidate": candidate.as_dict(),
            "manifest_sha256": manifest_sha256,
            "connector": {
                "kind": connector.kind.value,
                "connector_id": connector.connector_id,
                "route_ref": route_ref,
                "execution_mode": connector.execution_mode.value,
            },
            "retry_of_request_id": retry_of_request_id,
        })

    @staticmethod
    def _receipt_shape(result: ConnectorResult) -> tuple[OrderState, SendEffect, RetryDisposition]:
        if result.outcome == DeliveryOutcome.DISPATCHED:
            return OrderState.DISPATCHED, SendEffect.SENT, RetryDisposition.NOT_RETRYABLE
        if result.outcome == DeliveryOutcome.ACKNOWLEDGED:
            return OrderState.ACKNOWLEDGED, SendEffect.SENT, RetryDisposition.NOT_RETRYABLE
        if result.outcome == DeliveryOutcome.EXCEPTION:
            return OrderState.EXCEPTION, SendEffect.NOT_SENT, RetryDisposition.SAFE_WITH_NEW_KEY
        return OrderState.UNKNOWN, SendEffect.POSSIBLY_SENT, RetryDisposition.RECONCILE_REQUIRED

    def dispatch(
        self,
        *,
        manifest_path: Path,
        package_root: Path,
        expected_candidate: CandidateIdentity,
        connector: OrderConnector,
        route_ref: str,
        idempotency_key: str,
        actor_id: str,
        occurred_at: str,
        authority: Optional[DispatchAuthority] = None,
        retry_of_request_id: Optional[str] = None,
    ) -> DispatchResult:
        with self._lock:
            verified = verify_sealed_manifest(manifest_path, package_root, expected_candidate)
            fingerprint = self._fingerprint(
                candidate=expected_candidate, manifest_sha256=verified.manifest_sha256,
                connector=connector, route_ref=route_ref,
                retry_of_request_id=retry_of_request_id,
            )
            existing = self._idempotency.get(idempotency_key)
            if existing is not None:
                if retry_of_request_id == existing[1].request.request_id:
                    raise OrderExecutionError("RETRY_REQUIRES_NEW_KEY", "a safe retry requires a new idempotency key")
                require(existing[0] == fingerprint, "IDEMPOTENCY_CONFLICT", "idempotency key is already bound to another dispatch fingerprint")
                prior = existing[1]
                return DispatchResult(prior.request, prior.receipt, prior.audit_events, replayed=True)

            if retry_of_request_id is not None:
                prior_request = self._requests.get(retry_of_request_id)
                require(prior_request is not None, "RETRY_ORIGIN_NOT_FOUND", "retry origin request does not exist")
                prior_receipts = [receipt for receipt in self._receipts.values() if receipt.request_id == retry_of_request_id]
                require(prior_receipts, "RETRY_ORIGIN_NOT_FOUND", "retry origin has no receipt")
                latest = prior_receipts[-1]
                require(latest.retry_disposition == RetryDisposition.SAFE_WITH_NEW_KEY, "UNSAFE_RETRY", "prior dispatch may have produced a send effect; reconcile before retry", state=latest.state.value)
                require(idempotency_key != prior_request.idempotency_key, "RETRY_REQUIRES_NEW_KEY", "a safe retry requires a new idempotency key")

            request = build_request(
                idempotency_key=idempotency_key, candidate=expected_candidate,
                package_id=verified.package_id, sealed_manifest_sha256=verified.manifest_sha256,
                selection_count=verified.selection_count, file_count=verified.file_count,
                connector_kind=connector.kind, connector_id=connector.connector_id,
                route_ref=route_ref, execution_mode=connector.execution_mode,
                created_at=occurred_at, actor_id=actor_id,
                retry_of_request_id=retry_of_request_id,
            )
            self._requests[request.request_id] = request
            start = len(self._events)
            self._append("ORDER_DRAFTED", OrderState.DRAFT, request, occurred_at, {
                "sealed_manifest_sha256": verified.manifest_sha256,
                "candidate": expected_candidate.as_dict(),
            })

            # Re-read and re-hash immediately before entering the send boundary.
            reverified = verify_sealed_manifest(manifest_path, package_root, expected_candidate)
            require(reverified == verified, "PACKAGE_CHANGED_BEFORE_DISPATCH", "sealed package changed between draft and dispatch")
            self._append("ORDER_DISPATCH_PENDING", OrderState.DISPATCH_PENDING, request, occurred_at, {
                "connector_id": connector.connector_id,
                "execution_mode": connector.execution_mode.value,
            })

            try:
                connector_result = connector.dispatch(request, authority)
            except OrderExecutionError as exc:
                if exc.code in _KNOWN_NOT_SENT:
                    connector_result = ConnectorResult(DeliveryOutcome.EXCEPTION, None, exc.code)
                else:
                    connector_result = ConnectorResult(DeliveryOutcome.UNKNOWN, None, "CONNECTOR_ERROR_UNKNOWN_SEND")
            except Exception:
                connector_result = ConnectorResult(DeliveryOutcome.UNKNOWN, None, "CONNECTOR_ERROR_UNKNOWN_SEND")

            state, send_effect, retry = self._receipt_shape(connector_result)
            external_effect = (
                "NONE"
                if connector.execution_mode == ExecutionMode.RECORDING_ONLY
                or (connector_result.outcome == DeliveryOutcome.EXCEPTION and connector_result.detail_code in _KNOWN_NOT_SENT)
                else "CONNECTOR_REPORTED"
            )
            supersedes: Optional[str] = None
            if connector_result.outcome == DeliveryOutcome.ACKNOWLEDGED:
                dispatched = build_receipt(
                    request, state=OrderState.DISPATCHED,
                    delivery_outcome=DeliveryOutcome.DISPATCHED,
                    send_effect=SendEffect.SENT,
                    retry_disposition=RetryDisposition.NOT_RETRYABLE,
                    external_effect=external_effect,
                    connector_reference=connector_result.connector_reference,
                    detail_code="CONNECTOR_ACCEPTED_DISPATCH",
                    created_at=occurred_at,
                )
                self._receipts[dispatched.receipt_id] = dispatched
                self._append("ORDER_DISPATCHED", OrderState.DISPATCHED, request, occurred_at, {
                    "delivery_outcome": DeliveryOutcome.DISPATCHED.value,
                    "external_effect": external_effect,
                }, dispatched)
                supersedes = dispatched.receipt_id

            receipt = build_receipt(
                request, state=state, delivery_outcome=connector_result.outcome,
                send_effect=send_effect, retry_disposition=retry,
                external_effect=external_effect,
                connector_reference=connector_result.connector_reference,
                detail_code=connector_result.detail_code,
                created_at=occurred_at, supersedes_receipt_id=supersedes,
            )
            self._receipts[receipt.receipt_id] = receipt
            self._append(f"ORDER_{state.value}", state, request, occurred_at, {
                "delivery_outcome": connector_result.outcome.value,
                "send_effect": send_effect.value,
                "retry_disposition": retry.value,
                "external_effect": external_effect,
                "detail_code": connector_result.detail_code,
            }, receipt)
            result = DispatchResult(request, receipt, tuple(self._events[start:]), replayed=False)
            self._idempotency[idempotency_key] = (fingerprint, result)
            return result

    def acknowledge(
        self,
        receipt_id: str,
        *,
        acknowledgement_ref: str,
        actor_id: str,
        occurred_at: str,
    ) -> DispatchReceipt:
        with self._lock:
            prior = self._receipts.get(receipt_id)
            require(prior is not None, "RECEIPT_NOT_FOUND", "receipt does not exist")
            require(prior.state == OrderState.DISPATCHED, "STATE_TRANSITION_INVALID", "only a dispatched order can be acknowledged", state=prior.state.value)
            require(bool(acknowledgement_ref), "ACKNOWLEDGEMENT_INVALID", "acknowledgement evidence reference is required")
            request = self._requests[prior.request_id]
            receipt = build_receipt(
                request, state=OrderState.ACKNOWLEDGED,
                delivery_outcome=DeliveryOutcome.ACKNOWLEDGED,
                send_effect=SendEffect.SENT,
                retry_disposition=RetryDisposition.NOT_RETRYABLE,
                external_effect=prior.external_effect,
                connector_reference=acknowledgement_ref,
                detail_code="ACKNOWLEDGEMENT_RECORDED",
                created_at=occurred_at, supersedes_receipt_id=prior.receipt_id,
            )
            self._receipts[receipt.receipt_id] = receipt
            self._append("ORDER_ACKNOWLEDGED", OrderState.ACKNOWLEDGED, request, occurred_at, {
                "acknowledgement_ref": acknowledgement_ref,
            }, receipt, actor_id)
            self._replace_idempotency_result(request.idempotency_key, receipt)
            return receipt

    def close(
        self,
        receipt_id: str,
        *,
        actor_id: str,
        occurred_at: str,
        resolution_ref: Optional[str] = None,
        reconciled_send_effect: Optional[SendEffect] = None,
    ) -> DispatchReceipt:
        with self._lock:
            prior = self._receipts.get(receipt_id)
            require(prior is not None, "RECEIPT_NOT_FOUND", "receipt does not exist")
            require(prior.state in {OrderState.ACKNOWLEDGED, OrderState.EXCEPTION, OrderState.UNKNOWN}, "STATE_TRANSITION_INVALID", "receipt cannot transition to closed", state=prior.state.value)
            if prior.state == OrderState.UNKNOWN:
                require(bool(resolution_ref), "UNKNOWN_RECONCILIATION_REQUIRED", "unknown-send closure requires an evidence reference")
                require(reconciled_send_effect in {SendEffect.NOT_SENT, SendEffect.SENT}, "UNKNOWN_RECONCILIATION_REQUIRED", "unknown-send closure requires a definitive send effect")
                effect = reconciled_send_effect
                retry = RetryDisposition.SAFE_WITH_NEW_KEY if effect == SendEffect.NOT_SENT else RetryDisposition.NOT_RETRYABLE
            else:
                effect = prior.send_effect
                retry = prior.retry_disposition
            request = self._requests[prior.request_id]
            receipt = build_receipt(
                request, state=OrderState.CLOSED,
                delivery_outcome=prior.delivery_outcome,
                send_effect=effect, retry_disposition=retry,
                external_effect=prior.external_effect,
                connector_reference=resolution_ref or prior.connector_reference,
                detail_code="ORDER_CLOSED",
                created_at=occurred_at, supersedes_receipt_id=prior.receipt_id,
            )
            self._receipts[receipt.receipt_id] = receipt
            self._append("ORDER_CLOSED", OrderState.CLOSED, request, occurred_at, {
                "resolution_ref": resolution_ref,
                "send_effect": effect.value,
                "retry_disposition": retry.value,
            }, receipt, actor_id)
            self._replace_idempotency_result(request.idempotency_key, receipt)
            return receipt

    def _replace_idempotency_result(self, key: str, receipt: DispatchReceipt) -> None:
        fingerprint, prior = self._idempotency[key]
        events = tuple(event for event in self._events if event.value["request_id"] == prior.request.request_id)
        self._idempotency[key] = (
            fingerprint,
            DispatchResult(prior.request, receipt, events, replayed=False),
        )

    @staticmethod
    def require_safe_retry(receipt: DispatchReceipt) -> None:
        require(receipt.retry_disposition == RetryDisposition.SAFE_WITH_NEW_KEY, "UNSAFE_RETRY", "receipt is not safe to retry", state=receipt.state.value, send_effect=receipt.send_effect.value)
