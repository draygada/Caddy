"""End to end in one call: a product or a part revision in, its jurisdictional determination out.
No declaration step, no round, no adoption, no memo — nothing waits on a person."""
import jsonschema

from forge_classification import run
from forge_classification.contracts import load_schema
from forge_classification.model import ScriptedModel
from fixtures import CIVIL_FACTS, PART_REVISION, advocate, element, judge, pack, propose, usml_negative

SCHEMA = load_schema("determination")


def test_a_part_revision_runs_end_to_end_to_ear99():
    m = ScriptedModel({
        **usml_negative(),
        "ccl_propose": [propose("9A991.d")],
        ("advocate", "9A991.d"): [advocate("9A991.d", [element("9A991.d", "indeterminate")])],
        ("judge", "9A991.d"): [judge("9A991.d", "knocked_out", [element("9A991.d", "not_met", quote="n.e.s.")])],
    })
    out = run(PART_REVISION, m, item_kind="commodity", facts=CIVIL_FACTS, pack=pack())
    jsonschema.validate(out, SCHEMA)
    assert out["determination"]["jurisdiction"] == "EAR99"
    assert out["item"]["part_revision_id"] == PART_REVISION["part_document"]["revision"]["revision_id"]
    assert [c.kind for c in m.calls] == ["usml_propose", "advocate", "judge", "ccl_propose", "advocate", "judge"]


def test_a_plain_product_description_runs_end_to_end_to_itar():
    m = ScriptedModel({
        "usml_propose": [propose("USML XII(c)")],
        ("advocate", "USML XII(c)"): [advocate("USML XII(c)", [element("USML XII(c)", "met", quote="Imaging systems", facts=("spec.tube_generation",))])],
        ("judge", "USML XII(c)"): [judge("USML XII(c)", "supported", [element("USML XII(c)", "met", quote="Imaging systems", facts=("spec.tube_generation",))])],
    })
    out = run("Helmet-mounted night-vision monocular with a Gen 3 auto-gated image intensifier tube, sold to military buyers.",
              m, facts={"spec.tube_generation": "3", "declared.military_use": "true"}, pack=pack())
    jsonschema.validate(out, SCHEMA)
    assert out["determination"]["jurisdiction"] == "ITAR" and out["determination"]["classification"] == ["USML XII(c)"]
    assert out["item"]["part_revision_id"] is None


def test_the_run_returns_a_determination_even_when_it_cannot_close_and_says_what_is_open():
    m = ScriptedModel({
        "usml_propose": [propose("USML XX(c)")],
        ("advocate", "USML XX(c)"): [advocate("USML XX(c)", [element("USML XX(c)", "indeterminate")])],
        ("judge", "USML XX(c)"): [judge("USML XX(c)", "knocked_out", [element("USML XX(c)", "not_met")])],
    })
    out = run("Hydraulic hose assembly, commercial catalogue family, Navy-spec traceability option.", m, pack=pack())
    d = out["determination"]
    assert d["jurisdiction"] == "UNDETERMINED" and d["open_candidates"] == ["USML XX(c)"]
    assert not any(c["status"] == "knocked_out" for c in out["candidates"])
