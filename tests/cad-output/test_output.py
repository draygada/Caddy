from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest

from caddydaddy_cad_output import (
    CadOutputError,
    KernelArtifact,
    build_manufacturing_package,
    create_native_document,
    derive_orthographic_drawings,
    export_native_document,
    import_native_document,
    render_bom_csv,
    verify_manufacturing_package,
)


IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def authored_native() -> dict:
    return {
        "schema_version": "caddydaddy.native-document/1",
        "document_id": "product:flight-controller",
        "parent_revision_id": None,
        "units": {"length": "mm", "angle": "deg"},
        "parts": [
            {
                "part_id": "part:bracket",
                "part_number": "BRKT-001",
                "name": "Controller bracket",
                "revision_id": "cad-rev:bracket-v4",
                "geometry_hash": "1" * 64,
                "material": "6061-T6 aluminum",
                "unit": "EA",
                "authored_document": {
                    "schema_version": "caddydaddy.cad-document/1",
                    "document_id": "part:bracket",
                    "sketches": [{"id": "sketch:base"}],
                    "features": [{"id": "feature:extrude", "distance_mm": 8}],
                },
            },
            {
                "part_id": "part:cover",
                "part_number": "COVER-002",
                "name": "Controller cover",
                "revision_id": "cad-rev:cover-v2",
                "geometry_hash": "2" * 64,
                "material": None,
                "unit": "EA",
                "authored_document": {
                    "schema_version": "caddydaddy.cad-document/1",
                    "document_id": "part:cover",
                    "sketches": [],
                    "features": [{"id": "feature:shell"}],
                },
            },
        ],
        "assembly": {
            "assembly_id": "assembly:controller",
            "assembly_revision_id": "assembly-rev:7",
            "instances": [
                {
                    "instance_id": "instance:bracket-a",
                    "part_id": "part:bracket",
                    "part_revision_id": "cad-rev:bracket-v4",
                    "quantity": 1,
                    "transform_row_major": IDENTITY,
                    "metadata": {"station": "A"},
                },
                {
                    "instance_id": "instance:bracket-b",
                    "part_id": "part:bracket",
                    "part_revision_id": "cad-rev:bracket-v4",
                    "quantity": 2,
                    "transform_row_major": [1, 0, 0, 40, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    "metadata": {"station": "B"},
                },
                {
                    "instance_id": "instance:cover",
                    "part_id": "part:cover",
                    "part_revision_id": "cad-rev:cover-v2",
                    "quantity": 1,
                    "transform_row_major": IDENTITY,
                    "metadata": {},
                },
            ],
            "mates": [
                {
                    "mate_id": "mate:cover",
                    "kind": "FIXED",
                    "instance_ids": ["instance:bracket-a", "instance:cover"],
                    "parameters": {"offset_mm": 0},
                }
            ],
        },
        "metadata": {"owner": "CADdyDaddy"},
    }


def mesh_for(document: dict) -> dict:
    return {
        "schema_version": "caddydaddy.kernel-mesh/1",
        "source_revision_id": document["revision_id"],
        "document_hash": document["document_hash"],
        "units": {"length": "mm"},
        "vertices": [[0, 0, 0], [20, 0, 0], [0, 10, 0], [0, 0, 5]],
        "triangles": [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
    }


def kernel_artifact(format_name: str, document: dict) -> KernelArtifact:
    content = {
        "STEP": b"ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n",
        "IGES": b"CADdyDaddy IGES fixture bytes\n",
        "STL": b"solid caddy\nendsolid caddy\n",
    }[format_name]
    return KernelArtifact(
        format_name,
        content,
        hashlib.sha256(content).hexdigest(),
        document["revision_id"],
        document["document_hash"],
    )


def test_native_document_is_deterministic_versioned_and_round_trips() -> None:
    first = create_native_document(authored_native())
    second = create_native_document(copy.deepcopy(authored_native()))
    assert first == second
    assert first["revision_id"] == "native-rev:" + first["document_hash"]
    content = export_native_document(first)
    assert content == export_native_document(second)
    assert import_native_document(content) == first
    assert content == json.dumps(first, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def test_native_import_rejects_tamper_duplicates_noncanonical_and_stale_references() -> None:
    document = create_native_document(authored_native())
    content = export_native_document(document)
    tampered = content.replace(b"BRKT-001", b"BRKT-999")
    with pytest.raises(CadOutputError, match="STALE_IDENTITY"):
        import_native_document(tampered)
    duplicate = content[:-1] + b',"schema_version":"caddydaddy.native-document/1"}'
    with pytest.raises(CadOutputError, match="DUPLICATE_JSON_KEY"):
        import_native_document(duplicate)
    with pytest.raises(CadOutputError, match="DOCUMENT_NONCANONICAL"):
        import_native_document(json.dumps(document, indent=2).encode())
    stale = authored_native()
    stale["assembly"]["instances"][0]["part_revision_id"] = "cad-rev:stale"
    with pytest.raises(CadOutputError, match="STALE_IDENTITY"):
        create_native_document(stale)


def test_mesh_produces_all_orthographic_svg_and_ascii_dxf_outputs() -> None:
    document = create_native_document(authored_native())
    drawings = derive_orthographic_drawings(
        mesh_for(document),
        expected_revision_id=document["revision_id"],
        expected_document_hash=document["document_hash"],
    )
    assert sorted(drawings) == [
        "drawings/front.dxf", "drawings/front.svg",
        "drawings/right.dxf", "drawings/right.svg",
        "drawings/top.dxf", "drawings/top.svg",
    ]
    assert b"<line" in drawings["drawings/top.svg"]
    assert b"$INSUNITS\n70\n4" in drawings["drawings/front.dxf"]
    assert drawings == derive_orthographic_drawings(
        copy.deepcopy(mesh_for(document)),
        expected_revision_id=document["revision_id"],
        expected_document_hash=document["document_hash"],
    )


@pytest.mark.parametrize(
    ("mutation", "code"),
    [
        (lambda mesh: mesh.update(source_revision_id="native-rev:stale"), "STALE_IDENTITY"),
        (lambda mesh: mesh["vertices"][0].__setitem__(0, float("nan")), "NONFINITE_MESH"),
        (lambda mesh: mesh["triangles"][0].__setitem__(2, 999), "MESH_INVALID"),
        (lambda mesh: mesh["triangles"].__setitem__(0, [0, 1, 1]), "MESH_INVALID"),
    ],
)
def test_mesh_rejects_stale_nonfinite_and_malformed_geometry(mutation, code: str) -> None:
    document = create_native_document(authored_native())
    mesh = mesh_for(document)
    mutation(mesh)
    with pytest.raises(CadOutputError, match=code):
        derive_orthographic_drawings(
            mesh,
            expected_revision_id=document["revision_id"],
            expected_document_hash=document["document_hash"],
        )


def test_bom_aggregates_instances_and_neutralises_spreadsheet_formulas() -> None:
    authored = authored_native()
    authored["parts"][1]["part_number"] = "=DANGEROUS()"
    document = create_native_document(authored)
    rows = render_bom_csv(document).decode().splitlines()
    assert rows[0].startswith("item,part_number,name")
    assert any("BRKT-001" in row and ",3,EA," in row for row in rows)
    assert any("'=DANGEROUS()" in row for row in rows)
    assert render_bom_csv(document) == render_bom_csv(copy.deepcopy(document))


def test_package_seals_reread_artifacts_and_verifies_every_hash(tmp_path: Path) -> None:
    document = create_native_document(authored_native())
    artifacts = [kernel_artifact(name, document) for name in ("STEP", "IGES", "STL")]
    result = build_manufacturing_package(
        tmp_path,
        "controller-r7",
        document,
        mesh_for(document),
        kernel_artifacts=artifacts,
        required_kernel_formats=("STEP", "STL"),
    )
    package = Path(result["package_path"])
    manifest = verify_manufacturing_package(package)
    assert manifest["document_hash"] == document["document_hash"]
    assert manifest["revision_id"] == document["revision_id"]
    assert manifest["required_kernel_formats"] == ["STEP", "STL"]
    assert len(manifest["artifacts"]) == 11
    assert all(item["verification"] == "REREAD_SHA256_BEFORE_SEAL" for item in manifest["artifacts"])
    assert manifest["limitations"] == [
        "NO_CAM_TOOLPATHS_OR_GCODE",
        "NO_TOLERANCING_OR_GD_AND_T",
        "NO_MANUFACTURABILITY_CERTIFICATION",
        "NO_HIDDEN_LINE_OR_DIMENSIONED_DRAWING",
        "NO_ROUND_TRIP_BREP_FIDELITY_CLAIM",
        "STEP_IGES_STL_BYTES_ARE_KERNEL_OUTPUTS_NOT_NATIVE_HISTORY",
    ]


def test_package_rejects_missing_stale_or_hash_mismatched_kernel_artifacts(tmp_path: Path) -> None:
    document = create_native_document(authored_native())
    with pytest.raises(CadOutputError, match="KERNEL_ARTIFACT_MISSING"):
        build_manufacturing_package(
            tmp_path, "missing", document, mesh_for(document), required_kernel_formats=("STEP",)
        )
    stale = kernel_artifact("STEP", document)
    stale = KernelArtifact(stale.format, stale.content, stale.content_sha256, "native-rev:stale", stale.document_hash)
    with pytest.raises(CadOutputError, match="STALE_IDENTITY"):
        build_manufacturing_package(tmp_path, "stale", document, mesh_for(document), kernel_artifacts=(stale,))
    bad_hash = kernel_artifact("STL", document)
    bad_hash = KernelArtifact(bad_hash.format, bad_hash.content, "0" * 64, bad_hash.source_revision_id, bad_hash.document_hash)
    with pytest.raises(CadOutputError, match="ARTIFACT_HASH_MISMATCH"):
        build_manufacturing_package(tmp_path, "bad-hash", document, mesh_for(document), kernel_artifacts=(bad_hash,))


@pytest.mark.parametrize("name", ["../escape", "/absolute", "nested/package", "..\\escape"])
def test_package_name_rejects_path_traversal(tmp_path: Path, name: str) -> None:
    document = create_native_document(authored_native())
    with pytest.raises(CadOutputError, match="PATH_TRAVERSAL"):
        build_manufacturing_package(tmp_path, name, document, mesh_for(document))


def test_package_verifier_rejects_artifact_and_manifest_tamper(tmp_path: Path) -> None:
    document = create_native_document(authored_native())
    result = build_manufacturing_package(tmp_path, "artifact-tamper", document, mesh_for(document))
    package = Path(result["package_path"])
    (package / "bom" / "bom.csv").write_bytes(b"tampered\n")
    with pytest.raises(CadOutputError, match="ARTIFACT_TAMPERED"):
        verify_manufacturing_package(package)

    result = build_manufacturing_package(tmp_path, "manifest-tamper", document, mesh_for(document))
    package = Path(result["package_path"])
    manifest = json.loads((package / "manifest.json").read_text())
    manifest["artifacts"][0]["path"] = "../outside"
    payload = {key: value for key, value in manifest.items() if key not in {"package_id", "seal"}}
    payload_content = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload_hash = hashlib.sha256(payload_content).hexdigest()
    manifest["package_id"] = "mfgpkg:" + payload_hash
    manifest["seal"]["payload_sha256"] = payload_hash
    content = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    (package / "manifest.json").write_bytes(content)
    (package / "manifest.sha256").write_text(
        hashlib.sha256(content).hexdigest() + "  manifest.json\n", encoding="ascii"
    )
    with pytest.raises(CadOutputError, match="PATH_TRAVERSAL"):
        verify_manufacturing_package(package)
