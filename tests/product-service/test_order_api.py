from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[2]
for source_root in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "order-execution" / "src",
):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)

from order_execution.canonical import digest_json  # noqa: E402
from product_service.order_api import (  # noqa: E402
    CLAIM_CEILING,
    LIMITATIONS,
    RUNTIME_BOUNDARY,
    OrderApiRuntime,
    create_fastapi_router,
)


CANDIDATE = {
    "candidate_id": "candidate:0.2",
    "revision": "revision:order-fixture-01",
    "artifact_sha256": "a" * 64,
}
NOW = "2026-09-05T20:00:00Z"


def write_package(root: Path) -> tuple[str, str]:
    payload = b"line_id,offer_id\nline:1,offer:approved\n"
    (root / "bom.csv").write_bytes(payload)
    preimage = {
        "schema_version": "strafe.sealed-sourcing-package/1",
        "package_id": "sourcing-package:fixture-01",
        "package_status": "SEALED",
        "candidate": dict(CANDIDATE),
        "selections": [
            {
                "line_id": "line:1",
                "offer_id": "offer:approved",
                "selected": True,
                "offer_status": "APPROVED",
                "gate_state": "CLEARED",
            }
        ],
        "files": [
            {
                "path": "bom.csv",
                "byte_length": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        ],
    }
    manifest_hash = digest_json(preimage)
    manifest = {**preimage, "seal": {"algorithm": "SHA-256", "manifest_sha256": manifest_hash}}
    relative = "sealed-sourcing-package.v1.json"
    (root / relative).write_text(json.dumps(manifest), encoding="utf-8")
    return relative, manifest_hash


def request(relative: str, manifest_hash: str, **values):
    return {
        "candidate": dict(CANDIDATE),
        "manifest_relative_path": relative,
        "manifest_sha256": manifest_hash,
        **values,
    }


def dispatch_request(relative: str, manifest_hash: str, **values):
    fields = {
        "recording_outcome": "ACKNOWLEDGED",
        "idempotency_key": "order-key-001",
        "route_ref": "supplier:recording-fixture",
        "actor_id": "actor:operator",
        "occurred_at": NOW,
        "retry_of_request_id": None,
    }
    fields.update(values)
    return request(relative, manifest_hash, **fields)


def assert_recording_boundary(body):
    assert body["runtime_boundary"] == RUNTIME_BOUNDARY
    assert body["runtime_boundary"]["external_effect"] == "NONE"
    assert body["runtime_boundary"]["external_calls"] == 0
    assert body["claim_ceiling"] == CLAIM_CEILING
    assert body["limitations"] == LIMITATIONS
    assert body["candidate"] == CANDIDATE


def test_package_validation_dispatch_readback_and_audit_are_hash_bound(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)

    status, validated = runtime.validate_package(request(relative, manifest_hash))
    assert status == 200
    assert validated["package"]["manifest_sha256"] == manifest_hash
    assert validated["package"]["byte_reread_verified"] is True
    assert_recording_boundary(validated)

    status, dispatched = runtime.dispatch_recording(dispatch_request(relative, manifest_hash))
    assert status == 200 and dispatched["replayed"] is False
    assert dispatched["receipt"]["state"] == "ACKNOWLEDGED"
    assert dispatched["receipt"]["execution_mode"] == "RECORDING_ONLY"
    assert dispatched["receipt"]["external_effect"] == "NONE"
    assert dispatched["request"]["package"]["sealed_manifest_sha256"] == manifest_hash
    assert_recording_boundary(dispatched)

    status, readback = runtime.read_receipt(
        {"candidate": CANDIDATE, "receipt_id": dispatched["receipt"]["receipt_id"]}
    )
    assert status == 200 and readback["is_latest"] is True
    assert readback["request"]["request_sha256"] == dispatched["request"]["request_sha256"]
    assert len(readback["audit_events"]) == 4
    assert_recording_boundary(readback)

    status, audit = runtime.verify_audit({"candidate": CANDIDATE})
    assert status == 200 and audit["event_count"] == 4
    assert len(audit["audit_head_sha256"]) == 64
    assert_recording_boundary(audit)


def test_idempotent_replay_and_conflicting_reuse_fail_closed(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)
    original = dispatch_request(relative, manifest_hash, recording_outcome="DISPATCHED")

    first_status, first = runtime.dispatch_recording(original)
    replay_status, replay = runtime.dispatch_recording(original)
    assert first_status == replay_status == 200
    assert replay["replayed"] is True
    assert replay["request"] == first["request"]
    assert replay["receipt"] == first["receipt"]

    conflicting = {**original, "route_ref": "supplier:other-recording-route"}
    status, blocked = runtime.dispatch_recording(conflicting)
    assert status == 409
    assert blocked["diagnostic"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert_recording_boundary(blocked)


def test_stale_candidate_manifest_hash_and_package_tamper_fail_closed(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)

    stale = dispatch_request(relative, manifest_hash)
    stale["candidate"] = {**CANDIDATE, "revision": "revision:stale"}
    status, body = runtime.dispatch_recording(stale)
    assert status == 409 and body["diagnostic"]["code"] == "STALE_CANDIDATE"
    assert_recording_boundary(body)

    wrong_hash = dispatch_request(relative, "b" * 64)
    status, body = runtime.dispatch_recording(wrong_hash)
    assert status == 409 and body["diagnostic"]["code"] == "MANIFEST_HASH_MISMATCH"

    (tmp_path / "bom.csv").write_bytes(b"tampered")
    status, body = runtime.dispatch_recording(dispatch_request(relative, manifest_hash))
    assert status == 409
    assert body["diagnostic"]["code"] in {"PACKAGE_FILE_SIZE_MISMATCH", "PACKAGE_FILE_HASH_MISMATCH"}
    assert_recording_boundary(body)


def test_unknown_send_requires_explicit_reconciliation_and_rejects_stale_transition(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)
    dispatch = dispatch_request(relative, manifest_hash, recording_outcome="UNKNOWN")
    status, unknown = runtime.dispatch_recording(dispatch)
    assert status == 200
    receipt = unknown["receipt"]
    assert receipt["state"] == "UNKNOWN"
    assert receipt["send_effect"] == "POSSIBLY_SENT"
    assert receipt["retry_disposition"] == "RECONCILE_REQUIRED"
    assert receipt["external_effect"] == "NONE"

    transition = {"candidate": CANDIDATE, "receipt_id": receipt["receipt_id"], "actor_id": "actor:reviewer", "occurred_at": NOW}
    status, blocked = runtime.close(transition)
    assert status == 409 and blocked["diagnostic"]["code"] == "UNKNOWN_RECONCILIATION_REQUIRED"

    status, reconciled = runtime.reconcile_unknown(
        {
            **transition,
            "resolution_ref": "evidence:fixture-confirmed-not-sent",
            "reconciled_send_effect": "NOT_SENT",
        }
    )
    assert status == 200
    assert reconciled["receipt"]["state"] == "CLOSED"
    assert reconciled["receipt"]["send_effect"] == "NOT_SENT"
    assert reconciled["receipt"]["retry_disposition"] == "SAFE_WITH_NEW_KEY"
    assert_recording_boundary(reconciled)

    status, stale = runtime.reconcile_unknown(
        {
            **transition,
            "resolution_ref": "evidence:duplicate",
            "reconciled_send_effect": "SENT",
        }
    )
    assert status == 409 and stale["diagnostic"]["code"] == "STALE_RECEIPT"


def test_acknowledgement_exception_close_and_audit_tamper_paths(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)

    status, dispatched = runtime.dispatch_recording(
        dispatch_request(relative, manifest_hash, recording_outcome="DISPATCHED")
    )
    assert status == 200 and dispatched["receipt"]["state"] == "DISPATCHED"
    status, acknowledged = runtime.acknowledge(
        {
            "candidate": CANDIDATE,
            "receipt_id": dispatched["receipt"]["receipt_id"],
            "acknowledgement_ref": "recording:evidence:ack-1",
            "actor_id": "actor:reviewer",
            "occurred_at": NOW,
        }
    )
    assert status == 200 and acknowledged["receipt"]["state"] == "ACKNOWLEDGED"
    status, closed = runtime.close(
        {
            "candidate": CANDIDATE,
            "receipt_id": acknowledged["receipt"]["receipt_id"],
            "actor_id": "actor:reviewer",
            "occurred_at": NOW,
            "resolution_ref": "recording:evidence:closed",
        }
    )
    assert status == 200 and closed["receipt"]["state"] == "CLOSED"

    status, exception = runtime.dispatch_recording(
        dispatch_request(
            relative,
            manifest_hash,
            recording_outcome="EXCEPTION",
            idempotency_key="order-key-002",
        )
    )
    assert status == 200 and exception["receipt"]["state"] == "EXCEPTION"
    assert exception["receipt"]["send_effect"] == "NOT_SENT"
    status, exception_closed = runtime.close(
        {
            "candidate": CANDIDATE,
            "receipt_id": exception["receipt"]["receipt_id"],
            "actor_id": "actor:reviewer",
            "occurred_at": NOW,
        }
    )
    assert status == 200 and exception_closed["receipt"]["state"] == "CLOSED"

    status, audit = runtime.verify_audit({"candidate": CANDIDATE})
    assert status == 200
    tampered = json.loads(json.dumps(audit["events"]))
    tampered[0]["payload"]["candidate"]["revision"] = "revision:tampered"
    status, blocked = runtime.verify_audit({"candidate": CANDIDATE, "events": tampered})
    assert status == 409 and blocked["diagnostic"]["code"] == "AUDIT_HASH_MISMATCH"
    assert_recording_boundary(blocked)


def test_fastapi_router_exposes_only_recording_state_routes(tmp_path: Path) -> None:
    write_package(tmp_path)
    router = create_fastapi_router(OrderApiRuntime(tmp_path, CANDIDATE))
    if router is None:
        return
    assert {route.path for route in router.routes} == {
        "/api/orders/packages/validate",
        "/api/orders/dispatches",
        "/api/orders/receipts/read",
        "/api/orders/receipts/acknowledge",
        "/api/orders/receipts/reconcile",
        "/api/orders/receipts/close",
        "/api/orders/audit/verify",
    }


def test_inline_package_and_state_token_survive_every_cold_instance(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    status, validated = OrderApiRuntime(tmp_path, CANDIDATE).validate_package(request(relative, manifest_hash))
    assert status == 200
    dispatch = dispatch_request(relative, manifest_hash, recording_outcome="DISPATCHED")
    dispatch.pop("manifest_relative_path")
    dispatch["package_envelope"] = validated["package_envelope"]

    status, dispatched = OrderApiRuntime(None, CANDIDATE).dispatch_recording(dispatch)
    assert status == 200
    assert dispatched["state_token"]["schema_version"] == "caddydaddy.order-state-token/1"
    assert dispatched["state_token_sha256"] == dispatched["state_token"]["seal"]["state_sha256"]
    receipt_id = dispatched["receipt"]["receipt_id"]

    status, readback = OrderApiRuntime(None, CANDIDATE).read_receipt({
        "candidate": CANDIDATE,
        "receipt_id": receipt_id,
        "state_token": dispatched["state_token"],
    })
    assert status == 200 and readback["is_latest"] is True

    status, acknowledged = OrderApiRuntime(None, CANDIDATE).acknowledge({
        "candidate": CANDIDATE,
        "receipt_id": receipt_id,
        "state_token": readback["state_token"],
        "acknowledgement_ref": "evidence:cold-ack",
        "actor_id": "actor:reviewer",
        "occurred_at": NOW,
    })
    assert status == 200 and acknowledged["receipt"]["state"] == "ACKNOWLEDGED"

    status, closed = OrderApiRuntime(None, CANDIDATE).close({
        "candidate": CANDIDATE,
        "receipt_id": acknowledged["receipt"]["receipt_id"],
        "state_token": acknowledged["state_token"],
        "actor_id": "actor:reviewer",
        "occurred_at": NOW,
        "resolution_ref": "evidence:cold-close",
    })
    assert status == 200 and closed["receipt"]["state"] == "CLOSED"
    assert closed["state_token"]["state_sequence"] == 2
    assert closed["runtime_boundary"]["external_effect"] == "NONE"


def test_state_token_tamper_collision_and_stale_receipt_fail_closed(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    runtime = OrderApiRuntime(tmp_path, CANDIDATE)
    _, dispatched = runtime.dispatch_recording(
        dispatch_request(relative, manifest_hash, recording_outcome="DISPATCHED")
    )
    token = dispatched["state_token"]

    tampered = json.loads(json.dumps(token))
    tampered["request"]["connector"]["route_ref"] = "supplier:tampered"
    status, blocked = OrderApiRuntime(None, CANDIDATE).read_receipt({
        "candidate": CANDIDATE,
        "receipt_id": dispatched["receipt"]["receipt_id"],
        "state_token": tampered,
    })
    assert status == 409 and blocked["diagnostic"]["code"] == "STATE_TOKEN_TAMPERED"

    collision = dispatch_request(relative, manifest_hash, recording_outcome="DISPATCHED")
    collision.update({"state_token": token, "route_ref": "supplier:collision"})
    status, blocked = OrderApiRuntime(None, CANDIDATE).dispatch_recording(collision)
    assert status == 409 and blocked["diagnostic"]["code"] == "IDEMPOTENCY_CONFLICT"

    _, acknowledged = runtime.acknowledge({
        "candidate": CANDIDATE,
        "receipt_id": dispatched["receipt"]["receipt_id"],
        "state_token": token,
        "acknowledgement_ref": "evidence:ack",
        "actor_id": "actor:reviewer",
        "occurred_at": NOW,
    })
    status, blocked = OrderApiRuntime(None, CANDIDATE).close({
        "candidate": CANDIDATE,
        "receipt_id": dispatched["receipt"]["receipt_id"],
        "state_token": acknowledged["state_token"],
        "actor_id": "actor:reviewer",
        "occurred_at": NOW,
    })
    assert status == 409 and blocked["diagnostic"]["code"] == "STALE_RECEIPT"


def test_unknown_reconciliation_uses_only_sealed_client_state(tmp_path: Path) -> None:
    relative, manifest_hash = write_package(tmp_path)
    _, validated = OrderApiRuntime(tmp_path, CANDIDATE).validate_package(request(relative, manifest_hash))
    dispatch = dispatch_request(relative, manifest_hash, recording_outcome="UNKNOWN")
    dispatch.pop("manifest_relative_path")
    dispatch["package_envelope"] = validated["package_envelope"]
    _, unknown = OrderApiRuntime(None, CANDIDATE).dispatch_recording(dispatch)
    transition = {
        "candidate": CANDIDATE,
        "receipt_id": unknown["receipt"]["receipt_id"],
        "state_token": unknown["state_token"],
        "actor_id": "actor:reviewer",
        "occurred_at": NOW,
    }
    status, blocked = OrderApiRuntime(None, CANDIDATE).close(transition)
    assert status == 409 and blocked["diagnostic"]["code"] == "UNKNOWN_RECONCILIATION_REQUIRED"
    status, reconciled = OrderApiRuntime(None, CANDIDATE).reconcile_unknown({
        **transition,
        "resolution_ref": "evidence:cold-confirmed-not-sent",
        "reconciled_send_effect": "NOT_SENT",
    })
    assert status == 200
    assert reconciled["receipt"]["state"] == "CLOSED"
    assert reconciled["receipt"]["retry_disposition"] == "SAFE_WITH_NEW_KEY"
    assert reconciled["runtime_boundary"] == RUNTIME_BOUNDARY
