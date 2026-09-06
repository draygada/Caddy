"""The search fixtures exist, are manifested, and the two new Kestrel states open as rounds."""
from __future__ import annotations

import json
from pathlib import Path

from conftest import DATA
from forge_sourcing.hashing import sha256_bytes

SEARCH = DATA / "search"
RULES_SHA = "ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f"


def test_rules_copy_is_byte_identical_to_the_tripwire_draft():
    assert sha256_bytes((SEARCH / "rules.DRAFT.json").read_bytes()) == RULES_SHA
    assert len(json.loads((SEARCH / "rules.DRAFT.json").read_text(encoding="utf-8"))) == 40


def test_search_fixtures_are_manifested():
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    for rel in ("search/pool.json", "search/rules.DRAFT.json", "search/gold_swaps.json", "search/documents.json",
                "search/fixtures/gx220_vendor_page.html", "search/fixtures/lepton35_test_sheet.txt"):
        assert manifest["search"][rel]["sha256"] == sha256_bytes((DATA / rel).read_bytes()), rel


def test_pool_shape_and_no_floats():
    from forge_sourcing.hashing import sha256
    pool = json.loads((SEARCH / "pool.json").read_text(encoding="utf-8"))
    sha256(pool)                                        # floats refused → this raises if any number is a float
    assert set(pool["slots"]) >= {"thermal_core", "imu", "battery_cells", "io_mcu"}
    assert pool["aliases"]["nose_thermal"] == "thermal_core" and pool["aliases"]["thermal"] == "thermal_core" and pool["aliases"]["cells"] == "battery_cells"
    assert all(v in pool["slots"] for v in pool["aliases"].values())
    for slot in pool["slots"].values():
        assert set(slot["comparator"]) == {"function", "performance", "form", "fit"}
        for c in slot["candidates"]:
            assert {"mpn", "manufacturer", "aml", "synthetic", "declared", "documents", "offer"} <= set(c)
            assert c["offer"]["mpn"] == c["mpn"]
            assert {"seller", "manufacturer", "declared_eccn", "declared_hts"} <= set(c["offer"])


def test_gold_set_rows_name_a_state_and_a_line():
    kestrel = json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))
    gold = json.loads((SEARCH / "gold_swaps.json").read_text(encoding="utf-8"))
    assert len(gold) == 6
    for row in gold:
        assert row["state"] in kestrel["states"] and row["line_id"].startswith("line:")
        assert row["expect"]["status"] in ("green", "grey", "red") and isinstance(row["real"], bool)


def test_f3_and_f11_states_open_and_resolve(service, f3_state, f11_state):
    r = service.open_round(f3_state, ship_to="TW-assembly", quantity=1, transport_mode="air", request_key="f3", opened_at="2026-09-06T02:00:00Z")
    service.resolve(r["round_id"])
    thermal = next(l for l in r["lines"] if l["node_id"] == "thermal_core")
    assert thermal["mpn"] == "20640A012-6PAAX" and thermal["evaluation"]["fired"] == ["6A003.b.4.b"] and len(thermal["offers"]) == 1
    r2 = service.open_round(f11_state, ship_to="US-bench", quantity=1, transport_mode="air", request_key="f11", opened_at="2026-09-06T02:00:00Z")
    service.resolve(r2["round_id"])
    cells = next(l for l in r2["lines"] if l["node_id"] == "battery_cells")
    assert cells["mpn"] == "SA102" and cells["evaluation"]["fired"] == ["3A001.e.1.b"]
    assert cells["offers"] == [] and cells["escalations"][0]["reason"] == "no_offer_match"


def test_ship_to_offers_the_frontends_four_destinations(service, baseline):
    from forge_sourcing.round import SHIP_TO
    assert {k: v["country"] for k, v in SHIP_TO.items()} == {"US-bench": "US", "TW-assembly": "TW", "DE-assembly": "DE", "CA-assembly": "CA"}
    r = service.open_round(baseline, ship_to="DE-assembly", quantity=1, transport_mode="air", request_key="de", opened_at="2026-09-06T02:00:00Z")
    service.resolve(r["round_id"]); service.screen(r["round_id"]); service.cost(r["round_id"], entry_date="2026-09-06")
    card = service.round_view(r["round_id"])["lines"][0]["offers"][0]
    assert r["destination_country"] == "DE" and any("DE customs: not modelled" in w for w in card["words"])


def test_fixture_documents_have_no_never_say_words():
    import re
    for path in (SEARCH / "fixtures").iterdir():
        text = path.read_text(encoding="utf-8").lower()
        assert not re.search(r"\bcompliant\b|\bcleared\b|\bcertif", text), path.name
