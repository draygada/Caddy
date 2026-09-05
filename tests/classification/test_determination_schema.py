"""The determination contract is a frozen JSON Schema: no numeric confidence, no filing
recommendation, a knockout needs a reason and a cited failed element, and the jurisdiction agrees
with the steps that produced it."""
import copy

import jsonschema
import pytest

from forge_classification.contracts import load_schema
from forge_classification.model import Budget, BudgetedModel, ScriptedModel
from forge_classification.engine import determine
from forge_classification.snapshot import snapshot_from_part_revision
from fixtures import CIVIL_FACTS, PART_REVISION, advocate, element, judge, pack, propose, usml_negative


@pytest.fixture(scope="module")
def schema():
    return load_schema("determination")


@pytest.fixture(scope="module")
def example():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "met", quote="n.e.s.")])],
        ("judge", "9A991.d"): [judge("9A991.d", "supported", [element("9A991.d", "met", quote="n.e.s.")])],
    })
    budget = Budget(calls_cap=16, cost_cap_microusd=8_000_000)
    return determine(snapshot_from_part_revision(PART_REVISION, CIVIL_FACTS, item_kind="commodity"), pack(),
                     BudgetedModel(m, budget), budget)


def test_engine_output_validates(schema, example):
    jsonschema.validate(example, schema)


def test_numeric_confidence_and_instruments_are_unrepresentable(schema, example):
    for extra in ({"confidence_percentage": 82}, {"recommended_instrument": "cj"}, {"claim_class": "supported"}):
        bad = {**copy.deepcopy(example), **extra}
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(bad, schema)
    bad = copy.deepcopy(example)
    bad["candidates"][0]["confidence"] = 0.9
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)


def test_knockout_requires_reason_and_a_cited_failed_element(schema, example):
    ko = next(c for c in example["candidates"] if c["status"] == "knocked_out")
    broken = copy.deepcopy(example)
    next(c for c in broken["candidates"] if c["candidate_id"] == ko["candidate_id"])["why_rejected"] = None
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(broken, schema)
    broken2 = copy.deepcopy(example)
    for el in next(c for c in broken2["candidates"] if c["candidate_id"] == ko["candidate_id"])["elements"]:
        el["citation"] = None
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(broken2, schema)


def test_jurisdiction_must_agree_with_the_steps(schema, example):
    bad = copy.deepcopy(example)
    bad["determination"]["jurisdiction"] = "ITAR"  # with usml_step negative
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
    bad = copy.deepcopy(example)
    bad["determination"]["jurisdiction"] = "EAR99"  # with ccl_step specific_supported
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
    bad = copy.deepcopy(example)
    bad["determination"]["jurisdiction"] = "UNDETERMINED"  # with a classification listed
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)


def test_enums_are_closed(schema, example):
    bad = copy.deepcopy(example)
    bad["determination"]["jurisdiction"] = "AMBIGUOUS"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
    bad = copy.deepcopy(example)
    bad["candidates"][0]["status"] = "leading"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
