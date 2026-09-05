"""The four shapes are frozen. These tests are the freeze."""
import json, pathlib, pytest
from jsonschema import Draft202012Validator

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / "schemas"

@pytest.mark.parametrize("name", ["design", "rules", "chart", "log"])
def test_schema_is_itself_valid(name):
    s = json.loads((SCHEMAS / f"{name}.schema.json").read_text())
    Draft202012Validator.check_schema(s)

def test_design_accepts_items_axis():
    """Charlie's Step 0: each part node carries its own items[]; the tree is the outer loop."""
    s = json.loads((SCHEMAS / "design.schema.json").read_text())
    doc = {"root": "kestrel", "nodes": [
        {"id": "kestrel", "kind": "product", "declared": {"bvlos": True}},
        {"id": "fc", "kind": "part", "parent": "kestrel", "part_class": "ic",
         "attrs": {"clock_mhz": {"value": 480, "unit": "MHz", "extracted_by": "human"}},
         "items": [
            {"id": "fc-hw", "item_kind": "commodity"},
            {"id": "fc-fw", "item_kind": "software",
             "attrs": {"symmetric_key_bits": {"value": 256, "unit": "bit"}}}]},
    ]}
    Draft202012Validator(s).validate(doc)

def test_design_rejects_unknown_node_field():
    s = json.loads((SCHEMAS / "design.schema.json").read_text())
    bad = {"root": "a", "nodes": [{"id": "a", "kind": "product", "nope": 1}]}
    with pytest.raises(Exception):
        Draft202012Validator(s).validate(bad)

def test_chart_requires_sixteen_columns_and_keeps_empties():
    """A country row has 17 <TD>s: name + 16 controls. Empties are meaningful."""
    s = json.loads((SCHEMAS / "chart.schema.json").read_text())
    chart = json.loads((ROOT / "data/chart/chart.json").read_text())
    Draft202012Validator(s).validate(chart)
    assert len(chart["column_headers"]) == 16
    for iso, c in chart["countries"].items():
        assert len(c["cells"]) == 16, iso
    ca = chart["countries"]["CA"]["cells"]
    assert ca == ["X","","","","","","","","","","X","","","","",""], "Canada spot check"
    assert chart["countries"]["DE"]["footnote"] == "3", "Germany footnote is a <sup>, not a glued digit"

def test_rules_draft_matches_schema():
    s = json.loads((SCHEMAS / "rules.schema.json").read_text())
    rules = json.loads((ROOT / "data/rules/rules.DRAFT.json").read_text())
    Draft202012Validator(s).validate(rules)
    assert len(rules) >= 14
    assert all(r["ecfr_date"] == "2026-09-01" for r in rules)
