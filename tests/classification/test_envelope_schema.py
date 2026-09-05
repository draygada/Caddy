"""The envelope contract is a frozen JSON Schema; the engine's output must validate against it,
and the schema must refuse the two things the design forbids: any numeric confidence, and a
knockout without its written reason and cited failed element."""
import copy

import jsonschema
import pytest

from forge_classification.contracts import load_schema, example_envelope


@pytest.fixture(scope="module")
def schema():
    return load_schema("envelope")


def test_example_envelope_validates(schema):
    jsonschema.validate(example_envelope(), schema)


def test_numeric_confidence_is_unrepresentable(schema):
    env = example_envelope()
    env["confidence_percentage"] = 82
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(env, schema)
    env2 = example_envelope()
    env2["candidates"][0]["confidence"] = 0.8
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(env2, schema)


def test_knockout_requires_reason_and_a_cited_failed_element(schema):
    env = example_envelope()
    ko = next(c for c in env["candidates"] if c["status"] == "knocked_out")
    broken = copy.deepcopy(env)
    next(c for c in broken["candidates"] if c["candidate_id"] == ko["candidate_id"])["why_rejected"] = None
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(broken, schema)
    broken2 = copy.deepcopy(env)
    cand = next(c for c in broken2["candidates"] if c["candidate_id"] == ko["candidate_id"])
    for el in cand["elements"]:
        el["disposition"] = "met"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(broken2, schema)


def test_enums_are_closed(schema):
    env = example_envelope()
    env["claim_class"] = "high"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(env, schema)
    env = example_envelope()
    env["candidates"][0]["stage"] = "specially_designed"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(env, schema)


def test_supported_claim_requires_verified_or_attested_decisive_facts(schema):
    env = example_envelope()
    env["claim_class"] = "supported"
    env["claim_class_ceiling"] = "supported"
    lead = next(c for c in env["candidates"] if c["status"] == "leading")
    lead["elements"][0]["facts_relied_on"][0]["evidence_grade"] = "asserted"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(env, schema)
