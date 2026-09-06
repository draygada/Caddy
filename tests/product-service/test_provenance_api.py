from __future__ import annotations

from product_service.provenance_api import (
    CLAIM_CEILING,
    CORPUS_MANIFEST,
    ProvenanceRuntime,
    SOURCE_DOCUMENTS,
    SOURCE_HASHES,
)


CANDIDATE = {"candidate_id": "candidate:0.1", "revision_id": "revision:fixture-01", "snapshot_sha256": "b" * 64}


def request(**values):
    return {"candidate": dict(CANDIDATE), **values}


def assert_envelope(body):
    assert body["candidate"] == CANDIDATE
    assert body["corpus"] == CORPUS_MANIFEST
    assert body["source_hashes"] == SOURCE_HASHES
    assert body["claim_ceiling"] == CLAIM_CEILING
    assert body["limitations"]


def valid_span_request(document_id="gx220-vendor-page"):
    content = SOURCE_DOCUMENTS[document_id]
    quote = b"0.3 deg/h"
    start = content.index(quote)
    return request(document_id=document_id, source_sha256=SOURCE_HASHES[document_id], start=start, end=start + len(quote), quote=quote.decode("ascii"), field="gyro_bias_stability", value=0.3, unit="deg/h")


def test_exact_byte_span_receipt_and_bounded_acceptance():
    runtime = ProvenanceRuntime(CANDIDATE)
    status, body = runtime.verify_span(valid_span_request())
    assert status == 200 and body["status"] == "VERIFIED_FIXTURE_SPAN"
    receipt = body["verification"]
    assert receipt["byte_reread_verified"] is True and receipt["poison_intersection"] is False
    assert_envelope(body)
    status, accepted = runtime.accept_verified_change(request(receipt_sha256=receipt["receipt_sha256"], target="gyro_bias_stability"))
    assert status == 200 and accepted["status"] == "ACCEPTED_FOR_LOCAL_REVIEW"
    assert accepted["change"]["mutated_cad"] is False
    assert accepted["audit_events"][-1]["event_type"] == "VERIFIED_FIXTURE_CHANGE_ACCEPTED"
    assert_envelope(accepted)


def test_poisoned_prompt_span_is_quarantined_and_rejected():
    runtime = ProvenanceRuntime(CANDIDATE)
    document_id = "gx220-vendor-page"
    status, inspected = runtime.inspect_source(request(document_id=document_id))
    assert status == 200
    assert inspected["document"]["quarantined_ranges"]
    assert "[QUARANTINED_PROMPT_CONTENT]" in inspected["document"]["text_with_quarantine"]
    content = SOURCE_DOCUMENTS[document_id]
    quote = b"5 deg/h"
    start = content.index(quote)
    status, body = runtime.verify_span(request(document_id=document_id, source_sha256=SOURCE_HASHES[document_id], start=start, end=start + len(quote), quote=quote.decode("ascii"), field="gyro_bias_stability", value=5, unit="deg/h"))
    assert status == 422 and body["diagnostic"]["code"] == "POISONED_CONTENT"
    assert_envelope(body)


def test_source_tamper_and_span_tamper_fail_closed():
    tampered = dict(SOURCE_DOCUMENTS)
    tampered["gx220-vendor-page"] += b"tamper"
    runtime = ProvenanceRuntime(CANDIDATE, tampered)
    status, body = runtime.verify_span(valid_span_request())
    assert status == 409 and body["diagnostic"]["code"] == "SOURCE_TAMPERED"
    assert_envelope(body)
    runtime = ProvenanceRuntime(CANDIDATE)
    claim = valid_span_request()
    claim["quote"] = "9.9 deg/h"
    status, body = runtime.verify_span(claim)
    assert status == 409 and body["diagnostic"]["code"] == "SPAN_MISMATCH"


def test_stale_candidate_and_forged_receipt_are_rejected():
    runtime = ProvenanceRuntime(CANDIDATE)
    stale = valid_span_request()
    stale["candidate"]["revision_id"] = "revision:stale"
    status, body = runtime.verify_span(stale)
    assert status == 409 and body["diagnostic"]["code"] == "STALE_CANDIDATE"
    assert_envelope(body)
    status, body = runtime.accept_verified_change(request(receipt_sha256="0" * 64, target="gyro_bias_stability"))
    assert status == 409 and body["diagnostic"]["code"] == "VERIFICATION_RECEIPT_NOT_FOUND"
    assert_envelope(body)

