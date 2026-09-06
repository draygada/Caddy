"""Same inputs, same hash — on a fresh instance too."""
from __future__ import annotations

from conftest import run_s1


def round_digest(service, rid):
    from forge_sourcing.hashing import sha256
    view = service.round_view(rid)
    return sha256({"estimates": sorted(c["estimate"]["hash"] for l in view["lines"] for c in l["offers"]),
                   "screenings": sorted(c["screening"]["status"] for l in view["lines"] for c in l["offers"])})


def test_estimate_hash_is_deterministic_across_instances(data_dir, baseline):
    from forge_sourcing.service import Service
    a, b = Service(data_dir), Service(data_dir)
    ra, rb = run_s1(a, baseline), run_s1(b, baseline)
    assert round_digest(a, ra) == round_digest(b, rb)
    assert a.rederive()["line"] == b.rederive()["line"]


def test_entry_date_changes_the_hash_and_the_fiscal_year(data_dir, baseline):
    from forge_sourcing.service import Service
    from forge_sourcing.cost import estimate
    s = Service(data_dir)
    offer_hash, offer = s.store.offers_for("INR-21700-P45B")[0]
    a = estimate(offer, offer_hash, 48, s.store.tariff, "t", entry_date="2026-09-06", transport_mode="air", destination_country="US")
    b = estimate(offer, offer_hash, 48, s.store.tariff, "t", entry_date="2026-10-02", transport_mode="air", destination_country="US")
    assert a["hash"] != b["hash"] and a["fiscal_year"] == "FY2026" and b["fiscal_year"] == "FY2027"
    assert next(l for l in b["ladder"] if l["layer"] == "Merchandise processing fee")["amount"] == "34.58"


def test_floats_are_refused_in_hashing():
    import pytest
    from forge_sourcing.hashing import FloatRefused, sha256
    with pytest.raises(FloatRefused):
        sha256({"amount": 1.5})
