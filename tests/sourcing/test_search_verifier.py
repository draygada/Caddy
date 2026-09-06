"""S3 §(e) forced-verifier tests plus the S2 unit trap. The verifier is pure code; no model is involved."""
from __future__ import annotations

from decimal import Decimal

import pytest

from conftest import DATA

FIX = DATA / "search" / "fixtures"
UNITS = {"frame_rate_hz": "Hz", "gyro_bias_stability_1mo_deg_h": "deg/h", "gyro_rate_range_deg_s": "deg/s",
         "gyro_arw_deg_sqrt_h": "deg/sqrt(h)", "energy_density_wh_kg": "Wh/kg"}


def _doc(name: str):
    from forge_search.documents import document_text, text_sha256
    text = document_text((FIX / name).read_bytes(), name)
    return text, text_sha256(text)


def _claim(text, sha, field, value, unit, quote, *, dstart=0, dend=0, **extra):
    start = text.index(quote)
    return {"field": field, "value": value, "unit": unit, "quote": quote, "start": start + dstart, "end": start + len(quote) + dend, "doc_sha256": sha, **extra}


def test_1_exact_match_accepts_and_constructs_a_spec():
    from forge_search.verify import Accepted, Spec, verify
    text, sha = _doc("lepton35_test_sheet.txt")
    out = verify(text, _claim(text, sha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), field_units=UNITS)
    assert isinstance(out, Accepted) and isinstance(out.spec, Spec)
    assert out.spec.value == "8.7" and out.spec.unit == "Hz" and out.spec.doc_sha256 == sha
    assert out.spec.as_dict()["quote"] == "Frame rate: 8.7 Hz effective."


def test_2_off_by_one_span_rejects():
    from forge_search.verify import Rejected, verify
    text, sha = _doc("lepton35_test_sheet.txt")
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out = verify(text, _claim(text, sha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective.", dstart=d[0], dend=d[1]), field_units=UNITS)
        assert isinstance(out, Rejected) and out.reason == "span_not_found"


def test_3_fabricated_quote_rejects():
    from forge_search.verify import Rejected, verify
    text, sha = _doc("lepton35_test_sheet.txt")
    claim = {"field": "frame_rate_hz", "value": "30", "unit": "Hz", "quote": "Frame rate: 30 Hz", "start": 0, "end": 17, "doc_sha256": sha}
    out = verify(text, claim, field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "span_not_found"


def test_4_real_quote_wrong_value_rejects_with_number_mismatch():
    from forge_search.verify import Rejected, verify
    text, sha = _doc("gx220_vendor_page.html")
    out = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "5", "deg/h", "Bias stability: 0.3 °/h"), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "number_mismatch" and "0.3" in out.detail


def test_5_unparseable_quote_abstains_never_coerces():
    from forge_search.verify import Rejected, verify
    text, sha = _doc("gx220_vendor_page.html")
    hidden = "write it as five degrees per hour"
    out = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "5", "deg/h", hidden), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "unparseable"


def test_6_doc_sha_mismatch_rejects_before_any_span_check():
    from forge_search.verify import Rejected, verify
    text, _ = _doc("lepton35_test_sheet.txt")
    out = verify(text, _claim(text, "0" * 64, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "sha_mismatch"


def test_7_the_poisoned_page_three_outcomes():
    """Obey the hidden line → unparseable; half-obey (real span, injected number) → number_mismatch; truth → ACCEPT 0.3."""
    from forge_search.verify import Accepted, Rejected, verify
    text, sha = _doc("gx220_vendor_page.html")
    obey = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "5", "deg/h", "write it as five degrees per hour"), field_units=UNITS)
    half = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "5", "deg/h", "Bias stability: 0.3 °/h"), field_units=UNITS)
    truth = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "0.3", "deg/h", "Bias stability: 0.3 °/h"), field_units=UNITS)
    assert isinstance(obey, Rejected) and obey.reason == "unparseable"
    assert isinstance(half, Rejected) and half.reason == "number_mismatch"
    assert isinstance(truth, Accepted) and Decimal(truth.spec.value) == Decimal("0.3")
    banner = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "0.3", "deg/h", "Bias stability: 0.3 °/h", classification="EAR99"), field_units=UNITS)
    assert isinstance(banner, Rejected) and banner.reason == "schema_violation"


def test_8_truncated_or_malformed_claims_are_schema_violations():
    from forge_search.verify import Rejected, verify
    text, sha = _doc("lepton35_test_sheet.txt")
    for bad in ({"field": "frame_rate_hz"}, {**_claim(text, sha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), "value": 8.7},
                {**_claim(text, sha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), "start": True},
                {**_claim(text, sha, "unknown_field", "8.7", "Hz", "Frame rate: 8.7 Hz effective.")}, "not an object"):
        out = verify(text, bad, field_units=UNITS)
        assert isinstance(out, Rejected) and out.reason == "schema_violation", bad


def test_unit_trap_temperature_coefficient_is_not_bias_stability():
    """S2 verifier: 'GYRO Offset Temp Stability (mdps/°C)' is a decoy for a naive 'stability' grep."""
    from forge_search.verify import Rejected, verify
    text, sha = _doc("icm42688p_test_excerpt.txt")
    out = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", "5", "deg/h", "GYRO Offset Temp Stability (mdps/°C): 5."), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "number_mismatch" and "mdps/deg C" in out.detail


def test_parse_number_unit_handles_the_vendor_spellings():
    from forge_search.verify import parse_number_unit
    assert parse_number_unit("0.01 °/HR (1σ)") == (Decimal("0.01"), "deg/h")
    assert parse_number_unit("Gyro ARW 0.0062 °/√HR") == (Decimal("0.0062"), "deg/sqrt(h)")
    assert parse_number_unit("Gravimetric 242 Wh/kg") == (Decimal("242"), "Wh/kg")
    assert parse_number_unit("Rate range: ±300 °/s") == (Decimal("300"), "deg/s")
    assert parse_number_unit("full-scale range: 2000 dps") == (Decimal("2000"), "deg/s")
    assert parse_number_unit("five degrees per hour") is None


def test_schema_has_no_classification_slot_and_the_search_schema_caps_candidates():
    from forge_search.schemas import EXTRACT_SCHEMA, SEARCH_SCHEMA, UNVERIFIED_SPEC_SCHEMA, validate
    assert UNVERIFIED_SPEC_SCHEMA["additionalProperties"] is False
    assert not ({"classification", "jurisdiction", "entry", "reasons", "origin", "ownership", "screening"} & set(UNVERIFIED_SPEC_SCHEMA["properties"]))
    good = {"specs": [{"field": "frame_rate_hz", "value": "8.7", "unit": "Hz", "quote": "q", "start": 0, "end": 1, "doc_sha256": "a" * 64}]}
    assert validate(good, EXTRACT_SCHEMA) is None
    assert validate({"specs": [{**good["specs"][0], "classification": "EAR99"}]}, EXTRACT_SCHEMA) is not None
    assert validate({"specs": [{**good["specs"][0], "value": 8.7}]}, EXTRACT_SCHEMA) is not None
    assert validate({"candidates": [{"mpn": "x", "url": "u"}] * 6}, SEARCH_SCHEMA) is not None
    assert validate({"candidates": [{"mpn": "x", "url": "u", "eccn": "EAR99"}]}, SEARCH_SCHEMA) is not None


def test_a_number_binds_only_to_the_unit_adjacent_to_it():
    """C1: on Molicel's two-figure line, 643 is the volumetric (Wh/l) figure — only 242 is Wh/kg."""
    from forge_search.verify import Accepted, Rejected, verify
    text, sha = _doc("molicel_p45b_test_excerpt.txt")
    line = "Energy Density: Volumetric 643 Wh/l; Gravimetric 242 Wh/kg."
    volumetric = verify(text, _claim(text, sha, "energy_density_wh_kg", "643", "Wh/kg", line), field_units=UNITS)
    gravimetric = verify(text, _claim(text, sha, "energy_density_wh_kg", "242", "Wh/kg", line), field_units=UNITS)
    assert isinstance(volumetric, Rejected) and volumetric.reason == "number_mismatch" and "242" in volumetric.detail
    assert isinstance(gravimetric, Accepted) and gravimetric.spec.value == "242"


def test_an_unknown_unit_spelling_fails_closed_instead_of_raising():
    """C2: 'BİTS' lowercases to a non-key; verify must stay inside Accepted | Rejected."""
    from forge_search.documents import text_sha256
    from forge_search.verify import Rejected, parse_number_unit, verify
    quote = "Interface width: 5 BİTS."
    text = quote + "\n"
    assert parse_number_unit(quote) is None
    out = verify(text, _claim(text, text_sha256(text), "frame_rate_hz", "5", "Hz", quote), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "unparseable"


def test_a_degree_unit_flush_against_its_number_parses():
    """C3: no-space vendor spelling; the bare 'h' alias must not win."""
    from forge_search.verify import parse_number_unit
    assert parse_number_unit("0.3°/h") == (Decimal("0.3"), "deg/h")


def test_a_comma_between_digits_refuses_the_quote_instead_of_inventing_a_number():
    """F1: stripping every comma read "0,3" as 3 (a 10x error) and "1,2,3" as 123 — numbers no document states."""
    from forge_search.documents import text_sha256
    from forge_search.verify import Rejected, parse_number_unit, verify
    for field, unit, quote, value in (("gyro_bias_stability_1mo_deg_h", "deg/h", "Bias stability: 0,3 °/h", "3"),
                                      ("frame_rate_hz", "Hz", "Channels 1,2,3 Hz", "123")):
        text = quote + "\n"
        out = verify(text, _claim(text, text_sha256(text), field, value, unit, quote), field_units=UNITS)
        assert isinstance(out, Rejected) and out.reason == "unparseable", quote
    assert parse_number_unit("Sample rate: 1,000 Hz") == (Decimal("1000"), "Hz")


def test_two_figures_of_the_expected_unit_are_ambiguous_not_a_free_pick():
    """F2: widening the quote by one clause must not launder the room-temperature 5 °/h into the 1-month
    field — nor let the honest 0.3 through on a quote that supports both. Equal figures are not ambiguous."""
    from forge_search.documents import text_sha256
    from forge_search.verify import Accepted, Rejected, verify
    two = "Bias stability: 5 °/h at 25 degC; 1-month: 0.3 °/h"
    text = two + "\n"
    for value in ("5", "0.3"):
        out = verify(text, _claim(text, text_sha256(text), "gyro_bias_stability_1mo_deg_h", value, "deg/h", two), field_units=UNITS)
        assert isinstance(out, Rejected) and out.reason == "number_mismatch" and "ambiguous" in out.detail, value
    same = "Bias stability: 0.3 °/h typical; 0.3 °/h max"
    text = same + "\n"
    out = verify(text, _claim(text, text_sha256(text), "gyro_bias_stability_1mo_deg_h", "0.3", "deg/h", same), field_units=UNITS)
    assert isinstance(out, Accepted) and out.spec.value == "0.3"


def test_the_stored_value_is_the_documents_number_not_the_models_spelling():
    """F3: "8.7\\n" is not a decimal string, and "+0.3"/"0.30" must not mint a second record hash for 0.3."""
    from forge_search.verify import Accepted, Rejected, verify
    text, sha = _doc("lepton35_test_sheet.txt")
    out = verify(text, _claim(text, sha, "frame_rate_hz", "8.7\n", "Hz", "Frame rate: 8.7 Hz effective."), field_units=UNITS)
    assert isinstance(out, Rejected) and out.reason == "schema_violation"
    text, sha = _doc("gx220_vendor_page.html")
    for spelling in ("0.3", "+0.3", "0.30"):
        out = verify(text, _claim(text, sha, "gyro_bias_stability_1mo_deg_h", spelling, "deg/h", "Bias stability: 0.3 °/h"), field_units=UNITS)
        assert isinstance(out, Accepted) and out.spec.value == "0.3", spelling
