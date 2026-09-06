from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
from unittest.mock import patch

import jsonschema


REPO = Path(__file__).resolve().parents[2]
for source_root in (REPO / "apps" / "product-service", REPO / "packages" / "classification"):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)

from forge_classification import default_pack  # noqa: E402
from forge_classification.contracts import load_schema  # noqa: E402
from forge_classification.model import ScriptedModel  # noqa: E402
from product_service.classification_api import ClassificationAdapter  # noqa: E402


REQUEST = {
    "product_or_part": "Commercial flight-controller board for a civil survey drone.",
    "facts": {"declared.civil_product": "true", "declared.military_use": "false"},
    "item_kind": "commodity",
}


def _citation(pack, unit_key: str, quote: str) -> dict:
    unit = pack.units[unit_key]
    start = unit.text.find(quote)
    assert start >= 0
    return {
        "unit_key": unit.unit_key,
        "unit_sha256": unit.sha256,
        "start": start,
        "end": start + len(quote),
        "quote": quote,
    }


def _ear99_model(pack) -> ScriptedModel:
    provision = "USML XI(c)(2)"
    cited_knockout = {
        "element_id": "el:pcb",
        "unit_key": provision,
        "disposition": "not_met",
        "basis": "stated",
        "facts_relied_on": ["declared.civil_product"],
        "citation": _citation(pack, provision, "Printed Circuit Boards"),
    }
    return ScriptedModel(
        {
            "usml_propose": [
                {
                    "candidates": [
                        {
                            "provision": provision,
                            "why_considered": "A flight-controller PCB requires an ordered USML review.",
                            "via": "enumerated",
                        }
                    ],
                    "specially_designed_read": "Civil-use facts are recorded but not treated as dispositive.",
                    "no_usml_reasoning": "",
                }
            ],
            ("advocate", provision): [
                {
                    "provision": provision,
                    "elements": [
                        {
                            **cited_knockout,
                            "disposition": "indeterminate",
                            "citation": None,
                        }
                    ],
                    "case_for": "The board is reviewed against the paragraph before the CCL is reached.",
                }
            ],
            ("judge", provision): [
                {
                    "provision": provision,
                    "ruling": "knocked_out",
                    "elements": [cited_knockout],
                    "reason": "The cited paragraph element is not met by the recorded civil board facts.",
                    "challenge": None,
                }
            ],
            # The preserved engine intentionally seats EAR99 after a demonstrated
            # USML negative when no valid specific CCL candidate surfaces.
            "ccl_propose": [{"candidates": []}],
        }
    )


def _assert_no_partial_determination(body: dict) -> None:
    assert body["status"] == "BLOCKED"
    assert set(body) == {"schema_version", "status", "diagnostic"}
    assert "determination" not in body and "candidates" not in body and "provenance" not in body


def test_default_adapter_is_scripted_local_and_conservatively_undetermined() -> None:
    status, body = ClassificationAdapter().classify(REQUEST)

    assert status == 200
    jsonschema.validate(body, load_schema("determination"))
    assert body["determination"]["jurisdiction"] == "UNDETERMINED"
    assert body["determination"]["usml_step"] == "undemonstrated"
    assert body["provenance"]["model"] == "ScriptedModel"
    assert body["provenance"]["budget"]["calls_used"] == 2
    assert len(body["snapshot_sha256"]) == 64 and len(body["pack_sha256"]) == 64


def test_adapter_preserves_empty_ccl_candidate_ear99_residual_and_full_provenance() -> None:
    pack = default_pack()
    adapter = ClassificationAdapter(model_factory=lambda: _ear99_model(pack), pack_factory=lambda: pack)

    status, body = adapter.classify(REQUEST)

    assert status == 200
    jsonschema.validate(body, load_schema("determination"))
    assert body["determination"] == {
        "jurisdiction": "EAR99",
        "classification": ["EAR99"],
        "usml_step": "negative",
        "ccl_step": "all_knocked_out",
        "basis": body["determination"]["basis"],
        "open_candidates": [],
    }
    assert any("no candidate surfaced" in line for line in body["determination"]["basis"])
    assert body["candidates"][-1]["provision"] == "EAR99"
    assert body["candidates"][-1]["status"] == "supported"
    citation = body["candidates"][0]["elements"][0]["citation"]
    assert citation["quote"] == "Printed Circuit Boards" and len(citation["unit_sha256"]) == 64
    assert [call["stage"] for call in body["provenance"]["calls"]] == [
        "usml_propose",
        "advocate",
        "judge",
        "ccl_propose",
    ]
    assert body["provenance"]["budget"]["calls_used"] == 4
    assert body["provenance"]["dropped_candidates"] == []
    assert isinstance(body["provenance"]["reference_notes"], list)


def test_budget_and_model_failures_return_no_partial_determination() -> None:
    budget_status, budget_body = ClassificationAdapter().classify(
        {**REQUEST, "budget": {"calls_cap": 0}}
    )
    model_status, model_body = ClassificationAdapter(model_factory=lambda: ScriptedModel({})).classify(REQUEST)

    assert budget_status == 429
    assert budget_body["diagnostic"]["code"] == "CLASSIFICATION_BUDGET_EXHAUSTED"
    _assert_no_partial_determination(budget_body)
    assert model_status == 503
    assert model_body["diagnostic"]["code"] == "CLASSIFICATION_MODEL_UNAVAILABLE"
    _assert_no_partial_determination(model_body)


def test_external_model_is_inert_without_explicit_adapter_configuration() -> None:
    class ExternalModel:
        called = False

        def propose(self, kind, prompt, schema):
            self.called = True
            raise AssertionError("must never be called")

    model = ExternalModel()
    status, body = ClassificationAdapter(model_factory=lambda: model).classify(REQUEST)

    assert status == 503 and model.called is False
    assert body["diagnostic"]["code"] == "CLASSIFICATION_EXTERNAL_MODEL_DISABLED"
    _assert_no_partial_determination(body)


def test_schema_and_citation_failures_are_blocked_without_leaking_engine_output() -> None:
    pack = default_pack()
    good_adapter = ClassificationAdapter(model_factory=lambda: _ear99_model(pack), pack_factory=lambda: pack)
    good_status, good = good_adapter.classify(REQUEST)
    assert good_status == 200

    malformed = deepcopy(good)
    malformed["schema_version"] = "wrong"
    with patch("product_service.classification_api.run", return_value=malformed):
        status, body = good_adapter.classify(REQUEST)
    assert status == 502 and body["diagnostic"]["code"] == "CLASSIFICATION_OUTPUT_INVALID"
    _assert_no_partial_determination(body)

    bad_citation = deepcopy(good)
    bad_citation["candidates"][0]["elements"][0]["citation"]["quote"] = "tampered"
    with patch("product_service.classification_api.run", return_value=bad_citation):
        status, body = good_adapter.classify(REQUEST)
    assert status == 502 and body["diagnostic"]["code"] == "CLASSIFICATION_OUTPUT_INVALID"
    _assert_no_partial_determination(body)


def test_malformed_requests_fail_before_model_construction() -> None:
    constructed = False

    def factory():
        nonlocal constructed
        constructed = True
        return ScriptedModel({})

    status, body = ClassificationAdapter(model_factory=factory).classify(
        {"product_or_part": "", "unexpected": True}
    )

    assert status == 400 and constructed is False
    assert body["diagnostic"]["code"] == "CLASSIFICATION_REQUEST_INVALID"
    _assert_no_partial_determination(body)
