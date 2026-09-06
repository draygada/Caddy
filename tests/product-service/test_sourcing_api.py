from __future__ import annotations

import json

from product_service.sourcing_api import CLAIM_CEILING, CORPUS_MANIFEST, SourcingRuntime


CANDIDATE = {"candidate_id": "candidate:0.1", "revision_id": "revision:fixture-01", "snapshot_sha256": "a" * 64}


def request(**values):
    return {"candidate": dict(CANDIDATE), **values}


def assert_envelope(body):
    assert body["candidate"] == CANDIDATE
    assert body["corpus"] == CORPUS_MANIFEST
    assert body["claim_ceiling"] == CLAIM_CEILING
    assert set(body["source_hashes"]) == {"screening", "ownership", "offers", "tariffs"}
    assert body["limitations"]


def create_round(runtime: SourcingRuntime):
    status, body = runtime.create_round(request(part_key="flight-controller", quantity=2, mode="air"))
    assert status == 200
    assert_envelope(body)
    return body["round"]


def test_round_preserves_blocked_offer_and_exact_or_suffix_screening(tmp_path):
    runtime = SourcingRuntime(CANDIDATE, tmp_path)
    round_state = create_round(runtime)
    assert CORPUS_MANIFEST["screening_entries"] == 2
    assert CORPUS_MANIFEST["active_screening_entries"] == 1
    assert runtime.screen_name("SZ DJI Technology Co")["result"] == "exact"
    assert runtime.screen_name("SZ DJI Technology Co., Ltd.")["result"] == "suffix-normalized"
    blocked = next(offer for offer in round_state["offers"] if offer["screening_disposition"] == "review-blocked")
    assert blocked["offer_id"] == "offer:skybridge-cn-001"
    assert len(round_state["offers"]) == 3
    assert all(offer["landed_cost"]["rows"] for offer in round_state["offers"])


def test_stale_candidate_and_blocked_selection_fail_closed_with_audit(tmp_path):
    runtime = SourcingRuntime(CANDIDATE, tmp_path)
    round_state = create_round(runtime)
    stale = request(part_key="flight-controller", quantity=1, mode="air")
    stale["candidate"]["revision_id"] = "revision:stale"
    status, body = runtime.create_round(stale)
    assert status == 409 and body["diagnostic"]["code"] == "STALE_CANDIDATE"
    assert_envelope(body)
    status, body = runtime.select_offer(request(round_id=round_state["round_id"], offer_id="offer:skybridge-cn-001"))
    assert status == 409 and body["diagnostic"]["code"] == "BLOCKED_OFFER_SELECTION"
    assert body["offer"]["screening_disposition"] == "review-blocked"
    assert body["audit_events"][-1]["event_type"] == "OFFER_SELECTION_BLOCKED"
    assert_envelope(body)


def test_adjudication_never_erases_screening_and_selection_preserves_all_offers(tmp_path):
    runtime = SourcingRuntime(CANDIDATE, tmp_path)
    round_state = create_round(runtime)
    status, body = runtime.adjudicate_offer(request(round_id=round_state["round_id"], offer_id="offer:skybridge-cn-001", decision="HOLD", attestor="reviewer:fixture", rationale="Retain for comparison; do not select."))
    assert status == 200
    assert body["adjudication"]["does_not_change_screening"] is True
    assert body["offer"]["screening_disposition"] == "review-blocked"
    status, body = runtime.select_offer(request(round_id=round_state["round_id"], offer_id="offer:aero-us-001"))
    assert status == 200 and body["status"] == "SELECTED"
    assert len(body["offers"]) == 3
    assert any(offer["screening_disposition"] == "review-blocked" for offer in body["offers"])
    assert body["audit_events"][-1]["event_type"] == "OFFER_SELECTED"


def test_package_reread_tamper_and_idempotent_staged_dispatch(tmp_path):
    runtime = SourcingRuntime(CANDIDATE, tmp_path)
    round_state = create_round(runtime)
    runtime.select_offer(request(round_id=round_state["round_id"], offer_id="offer:aero-us-001"))
    status, packaged = runtime.build_package(request(round_id=round_state["round_id"]))
    assert status == 200
    package = packaged["package"]
    assert package["byte_reread_verified"] is True
    manifest = json.loads((tmp_path / package["manifest_file"]).read_bytes())
    assert manifest["dispatch_ceiling"] == "STAGED_ONLY"
    dispatch_request = request(round_id=round_state["round_id"], manifest_sha256=package["manifest_sha256"], idempotency_key="demo-order-001")
    first_status, first = runtime.stage_dispatch(dispatch_request)
    second_status, second = runtime.stage_dispatch(dispatch_request)
    assert first_status == second_status == 200 and first == second
    assert first["status"] == "STAGED"
    assert first["dispatch"]["external_send"] is False and first["dispatch"]["network_calls"] == 0
    (tmp_path / package["payload_file"]).write_bytes(b"tampered")
    status, body = runtime.stage_dispatch(dispatch_request)
    assert status == 409 and body["diagnostic"]["code"] == "PACKAGE_TAMPERED"
    assert_envelope(body)

