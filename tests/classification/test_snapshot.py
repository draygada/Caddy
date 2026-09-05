"""The fact snapshot: what one item asserts, from a Forge part revision or a plain product."""
from forge_classification.snapshot import snapshot_from_part_revision, snapshot_from_product
from fixtures import PART_REVISION, REV


def test_part_revision_parameters_metadata_and_bom_become_facts_and_expressions_are_skipped():
    snap = snapshot_from_part_revision(PART_REVISION, item_kind="commodity")
    assert snap.facts["param.board_width"].value == "40" and snap.facts["param.board_width"].unit == "mm"
    assert "param.half" not in snap.facts
    assert snap.facts["body.pcb.layout_target"].value == "civil_uav"
    assert snap.facts["bom.part_number"].value == "FC-001"
    assert snap.part_revision_id == REV and snap.item_kind == "commodity"
    assert "Flight-controller board" in snap.description


def test_extra_facts_are_added_in_either_shape():
    snap = snapshot_from_part_revision(PART_REVISION, {"declared.military_use": "false", "spec.bias": {"value": "0.01", "unit": "deg/h"}},
                                       item_kind="commodity")
    assert snap.facts["declared.military_use"].value == "false"
    assert snap.facts["spec.bias"].unit == "deg/h"
    snap2 = snapshot_from_part_revision(PART_REVISION, [{"path": "declared.bvlos", "value": "true", "unit": None}], item_kind="commodity")
    assert snap2.facts["declared.bvlos"].value == "true"


def test_a_plain_product_description_is_enough():
    snap = snapshot_from_product("A helmet-mounted night-vision monocular with a Gen 3 image intensifier tube.",
                                 {"spec.tube_generation": "3"}, item_kind="commodity")
    assert snap.part_revision_id is None
    assert snap.facts["spec.tube_generation"].value == "3"
    assert snap.description.startswith("A helmet-mounted")


def test_explicit_unknown_is_recorded_never_folded():
    snap = snapshot_from_product("x", {"declared.used_on": "unknown"}, item_kind="commodity")
    assert snap.facts["declared.used_on"].recorded_unknown is True
    assert "declared.used_on" not in snap.known_paths()


def test_snapshot_hash_is_stable_and_changes_with_facts_or_item_kind():
    a = snapshot_from_part_revision(PART_REVISION, item_kind="commodity")
    b = snapshot_from_part_revision(PART_REVISION, item_kind="commodity")
    c = snapshot_from_part_revision(PART_REVISION, {"declared.bvlos": "true"}, item_kind="commodity")
    assert a.sha256 == b.sha256 and len(a.sha256) == 64
    assert a.sha256 != c.sha256
    assert snapshot_from_part_revision(PART_REVISION, item_kind="software").sha256 != a.sha256
