from __future__ import annotations

import json
from pathlib import Path

import pytest

from helpers import CANDIDATE, write_manifest
from order_execution import (
    APIConnector,
    DeliveryOutcome,
    DispatchAuthority,
    EDIConnector,
    EmailLikeConnector,
    ExternalConnectorConfiguration,
    OrderDispatcher,
    OrderExecutionError,
    OrderState,
    RecordingConnector,
    RetryDisposition,
    SendEffect,
    verify_audit_chain,
    verify_record_hash,
)


NOW = "2026-09-05T18:00:00Z"


def dispatch(root: Path, connector: RecordingConnector, key: str = "dispatch-key-001", **kwargs):
    manifest = kwargs.pop("manifest", None)
    if manifest is None:
        manifest = write_manifest(root)
    dispatcher = kwargs.pop("dispatcher", None)
    if dispatcher is None:
        dispatcher = OrderDispatcher()
    return dispatcher.dispatch(
        manifest_path=manifest, package_root=root, expected_candidate=CANDIDATE,
        connector=connector, route_ref=kwargs.pop("route_ref", "supplier:fixture"),
        idempotency_key=key, actor_id="actor:operator", occurred_at=NOW,
        **kwargs,
    )


def test_acknowledged_recording_flow_is_hash_bound_and_explicitly_non_external(tmp_path: Path) -> None:
    connector = RecordingConnector(outcome=DeliveryOutcome.ACKNOWLEDGED)
    dispatcher = OrderDispatcher()
    result = dispatch(tmp_path, connector, dispatcher=dispatcher)

    assert result.receipt.state == OrderState.ACKNOWLEDGED
    assert result.receipt.execution_mode.value == "RECORDING_ONLY"
    assert result.receipt.external_effect == "NONE"
    assert [event.value["state"] for event in result.audit_events] == [
        "DRAFT", "DISPATCH_PENDING", "DISPATCHED", "ACKNOWLEDGED",
    ]
    assert len(connector.calls) == 1
    verify_record_hash(result.request.as_dict(), "request_sha256", "request_id", "order-request:")
    verify_record_hash(result.receipt.as_dict(), "receipt_sha256", "receipt_id", "order-receipt:")
    assert verify_audit_chain(dispatcher.audit_events) == dispatcher.audit_events


def test_identical_idempotency_replay_returns_original_without_second_connector_call(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path)
    connector = RecordingConnector(outcome=DeliveryOutcome.DISPATCHED)
    dispatcher = OrderDispatcher()
    first = dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    second = dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    assert second.replayed is True
    assert second.request == first.request
    assert second.receipt == first.receipt
    assert len(connector.calls) == 1
    assert len(dispatcher.audit_events) == 3


def test_duplicate_key_with_different_route_fails_closed(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path)
    connector = RecordingConnector(outcome=DeliveryOutcome.DISPATCHED)
    dispatcher = OrderDispatcher()
    dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    with pytest.raises(OrderExecutionError, match="IDEMPOTENCY_CONFLICT"):
        dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher, route_ref="supplier:other")
    assert len(connector.calls) == 1


def test_tampered_package_bytes_fail_before_connector_or_audit(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path)
    (tmp_path / "bom.csv").write_bytes(b"tampered")
    connector = RecordingConnector()
    dispatcher = OrderDispatcher()
    with pytest.raises(OrderExecutionError, match="PACKAGE_FILE_(SIZE|HASH)_MISMATCH"):
        dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    assert connector.calls == []
    assert dispatcher.audit_events == ()


def test_manifest_seal_tamper_fails_closed(tmp_path: Path) -> None:
    manifest_path = write_manifest(tmp_path)
    manifest = json.loads(manifest_path.read_text())
    manifest["package_id"] = "sourcing-package:substituted"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(OrderExecutionError, match="MANIFEST_SEAL_MISMATCH"):
        dispatch(tmp_path, RecordingConnector(), manifest=manifest_path)


def test_stale_candidate_fails_before_connector(tmp_path: Path) -> None:
    from order_execution import CandidateIdentity

    stale = CandidateIdentity("candidate:old", "revision:old", "b" * 64)
    manifest = write_manifest(tmp_path, candidate=stale)
    connector = RecordingConnector()
    with pytest.raises(OrderExecutionError, match="STALE_CANDIDATE"):
        dispatch(tmp_path, connector, manifest=manifest)
    assert connector.calls == []


@pytest.mark.parametrize(
    ("status", "gate", "code"),
    [("BLOCKED", "CLEARED", "OFFER_BLOCKED"), ("APPROVED", "HOLD", "ORDER_GATE_BLOCKED")],
)
def test_blocked_offer_or_gate_never_reaches_connector(tmp_path: Path, status: str, gate: str, code: str) -> None:
    manifest = write_manifest(tmp_path, selection_status=status, gate_state=gate)
    connector = RecordingConnector()
    with pytest.raises(OrderExecutionError, match=code):
        dispatch(tmp_path, connector, manifest=manifest)
    assert connector.calls == []


def test_unknown_send_requires_reconciliation_and_same_key_only_replays(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path)
    connector = RecordingConnector(outcome=DeliveryOutcome.UNKNOWN, detail_code="SIMULATED_TIMEOUT")
    dispatcher = OrderDispatcher()
    result = dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    assert result.receipt.state == OrderState.UNKNOWN
    assert result.receipt.send_effect == SendEffect.POSSIBLY_SENT
    assert result.receipt.retry_disposition == RetryDisposition.RECONCILE_REQUIRED
    with pytest.raises(OrderExecutionError, match="UNSAFE_RETRY"):
        dispatcher.require_safe_retry(result.receipt)
    replay = dispatch(tmp_path, connector, manifest=manifest, dispatcher=dispatcher)
    assert replay.replayed is True
    assert len(connector.calls) == 1
    with pytest.raises(OrderExecutionError, match="UNKNOWN_RECONCILIATION_REQUIRED"):
        dispatcher.close(result.receipt.receipt_id, actor_id="actor:reviewer", occurred_at=NOW)

    closed = dispatcher.close(
        result.receipt.receipt_id, actor_id="actor:reviewer", occurred_at=NOW,
        resolution_ref="evidence:supplier-confirmed-not-received",
        reconciled_send_effect=SendEffect.NOT_SENT,
    )
    assert closed.state == OrderState.CLOSED
    assert closed.retry_disposition == RetryDisposition.SAFE_WITH_NEW_KEY


def test_known_exception_can_retry_only_with_new_key_and_lineage(tmp_path: Path) -> None:
    manifest = write_manifest(tmp_path)
    first_connector = RecordingConnector(outcome=DeliveryOutcome.EXCEPTION, detail_code="KNOWN_NOT_SENT")
    dispatcher = OrderDispatcher()
    first = dispatch(tmp_path, first_connector, manifest=manifest, dispatcher=dispatcher)
    dispatcher.require_safe_retry(first.receipt)
    with pytest.raises(OrderExecutionError, match="RETRY_REQUIRES_NEW_KEY"):
        dispatch(
            tmp_path, first_connector, manifest=manifest, dispatcher=dispatcher,
            retry_of_request_id=first.request.request_id,
        )
    retry_connector = RecordingConnector(outcome=DeliveryOutcome.ACKNOWLEDGED)
    retried = dispatch(
        tmp_path, retry_connector, key="dispatch-key-002", manifest=manifest,
        dispatcher=dispatcher, retry_of_request_id=first.request.request_id,
    )
    assert retried.request.retry_of_request_id == first.request.request_id
    assert len(retry_connector.calls) == 1


@pytest.mark.parametrize("connector_type", [EDIConnector, APIConnector, EmailLikeConnector])
def test_real_connector_boundaries_never_perform_external_io(tmp_path: Path, connector_type) -> None:
    manifest = write_manifest(tmp_path)
    connector = connector_type("supplier:live")
    result = OrderDispatcher().dispatch(
        manifest_path=manifest, package_root=tmp_path, expected_candidate=CANDIDATE,
        connector=connector, route_ref="route:configured-later",
        idempotency_key="external-key-001", actor_id="actor:operator", occurred_at=NOW,
    )
    assert result.receipt.state == OrderState.EXCEPTION
    assert result.receipt.send_effect == SendEffect.NOT_SENT
    assert result.receipt.detail_code == "CONNECTOR_DISABLED"

    configured = connector_type(
        "supplier:live",
        ExternalConnectorConfiguration(enabled=True, endpoint_ref="secret-ref:not-a-secret"),
    )
    authorized = DispatchAuthority("grant:exact", CANDIDATE.candidate_id, configured.connector_id, True)
    result = OrderDispatcher().dispatch(
        manifest_path=manifest, package_root=tmp_path, expected_candidate=CANDIDATE,
        connector=configured, route_ref="route:configured",
        idempotency_key="external-key-002", actor_id="actor:operator", occurred_at=NOW,
        authority=authorized,
    )
    assert result.receipt.state == OrderState.EXCEPTION
    assert result.receipt.detail_code == "CONNECTOR_IMPLEMENTATION_UNAVAILABLE"
    assert result.receipt.external_effect == "NONE"


def test_audit_tamper_is_detected(tmp_path: Path) -> None:
    dispatcher = OrderDispatcher()
    dispatch(tmp_path, RecordingConnector(), dispatcher=dispatcher)
    copied = [event.as_dict() for event in dispatcher.audit_events]
    copied[1]["payload"]["connector_id"] = "attacker:substitution"
    with pytest.raises(OrderExecutionError, match="AUDIT_HASH_MISMATCH"):
        verify_audit_chain(copied)
