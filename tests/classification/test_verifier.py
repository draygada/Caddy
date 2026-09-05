"""The verifier's fourth document class: a regulatory citation is a byte range in a hashed unit."""
from pathlib import Path

import pytest

from forge_classification.pack import build_pack, resolve
from forge_classification.verifier import Accepted, Citation, Rejected, verify_citation

RAW = Path(__file__).resolve().parents[2] / "packages/classification/data/ecfr/raw"


@pytest.fixture(scope="module")
def pack():
    return build_pack(RAW)


def _claim(pack, key, quote, start=None, end=None, **extra):
    unit = resolve(pack, key)
    start = unit.text.find(quote) if start is None else start
    end = start + len(quote) if end is None else end
    return {"unit_key": unit.unit_key, "unit_sha256": unit.sha256, "quote": quote, "start": start, "end": end, **extra}


def test_true_span_is_accepted_and_constructs_a_citation(pack):
    out = verify_citation(pack, _claim(pack, "9A012.a.2", "1 hour or greater"))
    assert isinstance(out, Accepted)
    assert isinstance(out.citation, Citation)
    assert out.citation.unit_key == "9A012.a.2" and out.citation.quote == "1 hour or greater"


def test_wrong_bytes_are_span_not_found(pack):
    claim = _claim(pack, "9A012.a.2", "1 hour or greater")
    claim["start"] += 3
    out = verify_citation(pack, claim)
    assert isinstance(out, Rejected) and out.reason == "span_not_found"


def test_unit_hash_mismatch_is_rejected_before_the_span_is_read(pack):
    claim = _claim(pack, "9A012.a.2", "1 hour or greater")
    claim["unit_sha256"] = "f" * 64
    assert verify_citation(pack, claim).reason == "sha_mismatch"


def test_unknown_unit_is_rejected(pack):
    out = verify_citation(pack, {"unit_key": "2B094", "unit_sha256": "0" * 64, "quote": "x", "start": 0, "end": 1})
    assert isinstance(out, Rejected) and out.reason == "unit_unknown"


@pytest.mark.parametrize("bad", ["classification", "jurisdiction", "entry", "reasons", "origin",
                                 "ownership", "screening", "disposition", "status", "claim_class"])
def test_schema_forbids_every_conclusion_key(pack, bad):
    out = verify_citation(pack, _claim(pack, "9A012.a.2", "1 hour or greater", **{bad: "ITAR"}))
    assert isinstance(out, Rejected) and out.reason == "schema_violation"


def test_unquotable_unit_cannot_be_cited(pack):
    out = verify_citation(pack, {"unit_key": "NOT_SUBJECT", "unit_sha256": "0" * 64, "quote": "", "start": 0, "end": 0})
    assert isinstance(out, Rejected) and out.reason == "unit_unquotable"
