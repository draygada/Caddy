from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder

from cad_service.topology import catalog_topology, compare_topology, initial_topology_report


def test_semantic_ids_are_deterministic_and_provenance_bound() -> None:
    shape = BRepPrimAPI_MakeBox(10, 20, 30).Shape()
    first = catalog_topology(shape, "feature:box")
    second = catalog_topology(shape, "feature:box")
    other_feature = catalog_topology(shape, "feature:other")
    assert [item.semantic_id for item in first] == [item.semantic_id for item in second]
    assert not ({item.semantic_id for item in first} & {item.semantic_id for item in other_feature})
    assert {item.kind for item in first} == {"VERTEX", "EDGE", "FACE", "SOLID"}


def test_parameter_edit_reports_preserved_or_best_effort_remapped_ids() -> None:
    previous = catalog_topology(BRepPrimAPI_MakeBox(10, 20, 30).Shape(), "feature:box")
    current = catalog_topology(BRepPrimAPI_MakeBox(12, 20, 30).Shape(), "feature:box")
    report = compare_topology("body:box", previous, current)
    assert report.remapped
    assert all(item.confidence == "GEOMETRIC_BEST_EFFORT" for item in report.remapped)
    assert any(item.code == "TOPOLOGY_IDENTITY_BEST_EFFORT" for item in report.diagnostics)


def test_topology_change_exposes_lost_and_new_identity() -> None:
    previous = catalog_topology(BRepPrimAPI_MakeBox(10, 10, 10).Shape(), "feature:primitive")
    current = catalog_topology(BRepPrimAPI_MakeCylinder(5, 10).Shape(), "feature:primitive")
    report = compare_topology("body:changed", previous, current)
    assert report.lost_ids or report.new_ids
    assert any(item.code in {"TOPOLOGY_IDENTITY_LOST", "TOPOLOGY_IDENTITY_NEW"} for item in report.diagnostics)


def test_initial_revision_labels_every_identity_new() -> None:
    current = catalog_topology(BRepPrimAPI_MakeBox(1, 2, 3).Shape(), "feature:initial")
    report = initial_topology_report("body:initial", current)
    assert len(report.new_ids) == len(current)
    assert not report.preserved_ids
