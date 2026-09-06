"""Build the package (fail-closed, three hashed artefacts) and send the order (synthetic, exactly once)."""
from __future__ import annotations

import pytest

from conftest import run_s1
from test_sourcing_flips import _select_all, _line, run_tw


def _ready(service, baseline):
    rid = run_s1(service, baseline)
    _select_all(service, rid)
    service.resolve_escalation(rid, "line:io_mcu", "origin_depends_on_lot", attestor="charlie",
                               resolution={"origin": "MY", "basis": "lot code on the reel label; datasheet not read"})
    return rid


def test_package_refuses_while_an_origin_escalation_is_open(service, baseline):
    from forge_sourcing.package import PackageRefused
    rid = run_s1(service, baseline)
    _select_all(service, rid)
    with pytest.raises(PackageRefused) as exc:
        service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    assert exc.value.code == "ESCALATION_OPEN" and "origin_depends_on_lot" in str(exc.value)
    assert service.thread.of_kind("package_blocked", rid)[-1]["reason"] == "ESCALATION_OPEN"


def test_package_builds_three_hashed_artefacts(service, baseline):
    rid = _ready(service, baseline)
    pkg = service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    assert set(pkg["artefacts"]) == {"pre_entry_lines", "diligence_record", "export_references"}
    assert all(len(v) == 64 for v in pkg["artefacts"].values())
    view = service.round_view(rid)
    assert view["status"] == "package_ready" and view["status_label"] == "packaged"
    lines = pkg["documents"]["pre_entry_lines"]["lines"]
    imports = [l for l in lines if l.get("import_modelled")]
    domestic = [l for l in lines if l.get("note") == "domestic purchase; no entry"]
    assert len(imports) == 10 and len(domestic) == 3
    motor = next(l for l in imports if l["mpn"] == "MN5008")
    assert motor["overlays_in_cbp_order"][0]["program"] == "Section 301" and motor["overlays_in_cbp_order"][0]["heading_9903"] == "9903.88.03"
    assert motor["tariff_code"]["heading_level_only"] is True and motor["disclaimer"].startswith("Prepared from declared data")
    cells = next(l for l in imports if l["mpn"] == "INR-21700-P45B")
    assert any("UN3480" in f for f in cells["partner_agency_flags"])
    assert pkg["disclaimer"].startswith("Draft prepared for review by a licensed customs broker")
    assert len(pkg["first_run_checklist"]) == 6 and any("5291" in c for c in pkg["first_run_checklist"])
    assert pkg["warnings"][0].startswith("No de minimis since 29 August 2025")
    dr = pkg["documents"]["diligence_record"]
    assert dr["retention"]["longest_regime"] == "OFAC" and dr["retention"]["retain_until"] == "2036-09-06"
    assert any(s["declined"] for s in dr["selections_with_declined"])
    xr = pkg["documents"]["export_references"]
    assert xr["design_hash"] == baseline["design_hash"] and len(xr["lines"]) == len(view["lines"])


def test_package_refuses_on_a_tampered_bound_blob(service, baseline):
    from forge_sourcing.package import PackageRefused
    rid = _ready(service, baseline)
    rnd = service.rounds[rid]
    rnd["lines"][0]["offers"][0]["offer"]["unit_price_usd"] = "1.00"      # edit the stored blob under its hash
    with pytest.raises(PackageRefused) as exc:
        service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    assert exc.value.code == "BINDING_MISMATCH" and "failed re-verification" in str(exc.value)


def test_taiwan_package_needs_gate_and_declaration(service, f4_state):
    from forge_sourcing.package import PackageRefused
    rid = run_tw(service, f4_state)
    _select_all(service, rid)
    service.resolve_escalation(rid, "line:io_mcu", "origin_depends_on_lot", attestor="charlie", resolution={"origin": "MY"})
    with pytest.raises(PackageRefused) as exc:
        service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    assert exc.value.code == "ROUND_NOT_READY"
    service.gate(rid, references={"line:imu": {"reference": "D1234567 (placeholder)", "attestor": "charlie"}})
    with pytest.raises(PackageRefused) as exc:
        service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    assert exc.value.code == "DECLARATION_MISSING"
    service.declare(rid, party="Taiwan assembler (Nitro)", person_status="foreign_person", sharing="controlled_drawings", reference="ENC placeholder", attestor="charlie")
    pkg = service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    xr = pkg["documents"]["export_references"]
    imu = next(l for l in xr["lines"] if l["mpn"] == "68905700-CA01")
    assert imu["eei_required"] is True and imu["gate"] == "LIC"
    assert pkg["warnings"][2].startswith("EEI required: see export references")


def test_order_is_dispatched_exactly_once(service, baseline):
    rid = _ready(service, baseline)
    service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    packet = service.create_packet(rid, recipient_placeholder="[recipient placeholder]",
                                   approver={"identity": "charlie", "authority_basis": "founder; demo authority only"}, created_at="2026-09-06T03:10:00Z")
    assert packet["label"] == "SYNTHETIC" and packet["recipient"]["inferred"] is False and len(packet["attachments"]) == 3
    r1 = service.dispatch(packet["packet_id"], idempotency_key="key-1", attestor="charlie", dispatched_at="2026-09-06T03:11:00Z")
    r2 = service.dispatch(packet["packet_id"], idempotency_key="key-1", attestor="charlie", dispatched_at="2026-09-06T03:12:00Z")
    assert r1 == r2 and r1["state"] == "acknowledged" and r1["label"] == "SYNTHETIC"
    assert len(service.thread.of_kind("order_dispatched", rid)) == 1
    assert len(service.thread.of_kind("order_acknowledged", rid)) == 1
    assert "SYNTHETIC dispatch · acknowledged · idempotency key key-1" in r1["words"]


def test_order_exception_path_and_close(service, baseline):
    rid = _ready(service, baseline)
    service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    packet = service.create_packet(rid, recipient_placeholder="[EXCEPTION placeholder]",
                                   approver={"identity": "charlie", "authority_basis": "demo"}, created_at="2026-09-06T03:10:00Z")
    r = service.dispatch(packet["packet_id"], idempotency_key="key-x", attestor="charlie", dispatched_at="2026-09-06T03:11:00Z")
    assert r["state"] == "exception" and service.thread.of_kind("order_exception", rid)
    closed = service.close_order(packet["packet_id"], receiving=None, inspection=None, attestor="charlie", closed_at="2026-09-06T04:00:00Z")
    assert closed["closeout_state"] == "closed" and closed["exception_state"]


def test_packet_refused_from_an_unapproved_or_stale_round(service, baseline, f4_state):
    from forge_sourcing.order import OrderRefused
    rid = run_s1(service, baseline)
    with pytest.raises(OrderRefused) as exc:
        service.create_packet(rid, recipient_placeholder="[x]", approver={"identity": "c", "authority_basis": "d"}, created_at="t")
    assert exc.value.code == "UNAPPROVED_ROUND"
    rid = _ready(service, baseline)
    service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    service.open_round(f4_state, ship_to="US-bench", quantity=1, transport_mode="air", request_key="later", opened_at="2026-09-06T05:00:00Z")
    with pytest.raises(OrderRefused) as exc:
        service.create_packet(rid, recipient_placeholder="[x]", approver={"identity": "c", "authority_basis": "d"}, created_at="t")
    assert exc.value.code == "STALE_REVISION"
