from __future__ import annotations

from strafe_forge_core.exchange import ExchangeService, parse_stl

from kernel_cases import box_program, engine, manifest


def test_step_export_reimports_and_verifies_exact_geometry() -> None:
    part = engine().recompute(box_program())
    assert part.current_artifact is not None
    service = ExchangeService(manifest())
    result = service.export_step("exchange:step", part.current_artifact, schema="AP242")
    assert result.status == "SUCCEEDED", result.diagnostics
    assert result.output_artifact is not None
    assert result.output_artifact.artifact_kind == "STEP"
    assert len(result.output_artifact.content) > 1_000
    assert result.verification_status == "PASSED"
    assert {item.code for item in result.checks} >= {
        "SHAPE_VALID",
        "BOUNDS_MATCH",
        "AREA_MATCH",
        "VOLUME_MATCH",
        "TOPOLOGY_COUNTS_MATCH",
        "STEP_UNITS_MM",
    }
    imported = service.import_step(
        "exchange:step-import",
        result.output_artifact.content,
        imported_revision_id="rev:imported-step",
        geometry_hash="a" * 64,
    )
    assert imported.status == "SUCCEEDED"
    assert imported.output_artifact is not None
    assert imported.output_artifact.artifact_kind == "BREP"


def test_stl_export_is_watertight_outward_and_mesh_only_on_import() -> None:
    part = engine().recompute(box_program())
    assert part.current_artifact is not None
    service = ExchangeService(manifest())
    result = service.export_stl(
        "exchange:stl",
        part.current_artifact,
        linear_deflection_mm=0.05,
        angular_deflection_deg=10,
        binary=True,
    )
    assert result.status == "SUCCEEDED", result.diagnostics
    assert result.output_artifact is not None
    triangles = parse_stl(result.output_artifact.content)
    assert len(triangles) == 12
    assert result.verification_status == "PASSED"
    imported = service.import_stl(
        "exchange:stl-import",
        result.output_artifact.content,
        imported_revision_id="rev:imported-stl",
        geometry_hash="b" * 64,
    )
    assert imported.status == "SUCCEEDED"
    assert imported.output_artifact is not None
    assert imported.output_artifact.artifact_kind == "MESH"
    assert imported.imported_shape is not None
    assert imported.imported_shape.kind == "MESH"


def test_malformed_exchange_fails_with_stable_diagnostics() -> None:
    service = ExchangeService(manifest())
    step = service.import_step(
        "exchange:bad-step",
        b"not step",
        imported_revision_id="rev:bad",
        geometry_hash="c" * 64,
    )
    assert step.status == "FAILED"
    assert step.diagnostics[0].code == "EXCHANGE_IMPORT_FAILED"
    stl = service.import_stl(
        "exchange:bad-stl",
        b"not stl",
        imported_revision_id="rev:bad",
        geometry_hash="d" * 64,
    )
    assert stl.status == "FAILED"
    assert stl.diagnostics[0].code == "EXCHANGE_IMPORT_FAILED"
