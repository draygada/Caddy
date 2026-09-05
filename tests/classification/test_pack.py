"""The reference pack: dated, checksummed, subparagraph-grain USML and CCL text.

Expected values are literal paragraphs read from the committed eCFR XML, not recomputed.
"""
from pathlib import Path

import pytest

from forge_classification.pack import build_pack, build_pack_from_xml, diff, resolve

LANE = Path(__file__).resolve().parents[2] / "packages/classification"
RAW = LANE / "data/ecfr/raw"


@pytest.fixture(scope="module")
def pack():
    return build_pack(RAW)


def test_usml_paragraph_resolves_to_its_own_text(pack):
    assert resolve(pack, "USML VII(a)(1)").text == "Tanks; or"


def test_sme_asterisk_is_not_part_of_the_text(pack):
    unit = resolve(pack, "USML VII(a)")
    assert unit.text.startswith("Armored combat ground vehicles as follows:")
    assert unit.sme is True


def test_ccl_item_paragraphs_resolve(pack):
    assert resolve(pack, "3A611.y.1").text == "Electrical connectors;"
    assert resolve(pack, "9A012.a.2").text == "A maximum 'endurance' of 1 hour or greater;"
    assert resolve(pack, "5A002.a.1").text.startswith(
        "Items having “information security” as a primary function"
    )


def test_all_twenty_one_usml_categories_and_the_full_ccl_are_present(pack):
    romans = "I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI".split()
    for r in romans:
        assert resolve(pack, f"USML {r}") is not None, r
    assert len(pack.eccns) == 637


def test_unknown_provision_does_not_resolve(pack):
    assert resolve(pack, "2B094") is None
    assert resolve(pack, "USML XXII") is None
    assert resolve(pack, "9A012.q") is None


def test_residual_units_resolve_and_are_quotable_only_from_source(pack):
    ear99 = resolve(pack, "EAR99")
    assert ear99 is not None and "EAR99" in ear99.text
    not_subject = resolve(pack, "NOT_SUBJECT")
    assert not_subject is not None and not_subject.text is None


def test_provision_strings_are_normalised(pack):
    assert resolve(pack, "USML Category VII(a)(1)") is resolve(pack, "usml vii (a)(1)")
    assert resolve(pack, "ECCN 9A012.a.2") is resolve(pack, "9a012.a.2.")


def test_pack_hash_is_stable_and_binds_the_sources(pack):
    again = build_pack(RAW)
    assert again.sha256 == pack.sha256
    assert len(pack.sha256) == 64
    assert pack.manifest["sources"]["title-22-part-121.xml"]["sha256"] == (
        "3137d0b14c0f2e1878918cd1b29f11d5afa733696895d6fef59927f8c6d9fba5"
    )
    assert pack.manifest["retrieved_at"] == "2026-06-25"


def test_diff_names_exactly_the_changed_unit(pack):
    usml = (RAW / "title-22-part-121.xml").read_text(encoding="utf-8")
    ccl = (RAW / "title-15-part-774.xml").read_text(encoding="utf-8")
    edited = ccl.replace(
        "<P>a.2. A maximum 'endurance' of 1 hour or greater;</P>",
        "<P>a.2. A maximum 'endurance' of 3 hours or greater;</P>",
    )
    assert edited != ccl
    other = build_pack_from_xml(
        usml, edited, manifest=pack.manifest,
        itar_sd_xml=(RAW / "title-22-section-120.41.xml").read_text(encoding="utf-8"),
        ear_definitions_xml=(RAW / "title-15-section-772.1.xml").read_text(encoding="utf-8"),
    )
    d = diff(pack, other)
    assert d.changed == ["9A012.a.2"]
    assert d.added == [] and d.removed == []
    assert other.sha256 != pack.sha256


def test_itar_specially_designed_has_five_releases_and_ear_has_six(pack):
    itar_b2 = resolve(pack, "22 CFR 120.41(b)(2)")
    assert itar_b2.text.startswith("Is, regardless of form or fit, a fastener")
    assert resolve(pack, "22 CFR 120.41(b)(5)") is not None
    assert resolve(pack, "22 CFR 120.41(b)(6)") is None
    ear_b2 = resolve(pack, "15 CFR 772.1 SD(b)(2)")
    assert ear_b2.text.startswith("Is, regardless of ‘form’ or ‘fit,’ a fastener")
    assert resolve(pack, "15 CFR 772.1 SD(b)(6)") is not None
    assert resolve(pack, "15 CFR 772.1 SD(b)(7)") is None
    assert resolve(pack, "15 CFR 772.1 specially designed (b)(3)(ii)").text.startswith("Is either not ‘enumerated’")
