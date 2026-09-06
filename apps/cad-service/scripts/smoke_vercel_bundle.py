"""Exercise the generated Vercel root through its actual ASGI entrypoint."""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from pathlib import Path


def rectangle(sketch_id: str, x: float, y: float, width: float, height: float) -> dict:
    points = [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    return {
        "sketch_id": sketch_id,
        "plane": "XY",
        "loops": [
            {
                "loop_id": f"{sketch_id}:outer",
                "entities": [
                    {
                        "entity_id": f"{sketch_id}:line:{index}",
                        "kind": "LINE",
                        "start": {"x": points[index][0], "y": points[index][1]},
                        "end": {"x": points[(index + 1) % 4][0], "y": points[(index + 1) % 4][1]},
                    }
                    for index in range(4)
                ],
            }
        ],
    }


def candidate_document() -> dict:
    return {
        "document_id": "proof:vercel-native-cad",
        "sketches": [rectangle("sketch:first", 0, 0, 12, 8), rectangle("sketch:second", 20, 0, 6, 6)],
        "features": [
            {"feature_id": "feature:sketch:first", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:first"}},
            {"feature_id": "feature:extrude:first", "kind": "EXTRUDE", "depends_on": ["feature:sketch:first"], "output_body_id": "body:first", "parameters": {"sketch_feature_id": "feature:sketch:first", "distance_mm": 4}},
            {"feature_id": "feature:sketch:second", "kind": "SKETCH", "parameters": {"sketch_id": "sketch:second"}},
            {"feature_id": "feature:extrude:second", "kind": "EXTRUDE", "depends_on": ["feature:sketch:second"], "output_body_id": "body:second", "parameters": {"sketch_feature_id": "feature:sketch:second", "distance_mm": 7}},
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", required=True, type=Path)
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    if not (bundle / "BUNDLE_MANIFEST.json").is_file():
        raise RuntimeError("bundle manifest is missing")
    os.environ["CAD_ALLOWED_HOSTS"] = "testserver"
    sys.path.insert(0, str(bundle))

    import cad_service
    from fastapi.testclient import TestClient
    from api.index import app

    if bundle not in Path(cad_service.__file__).resolve().parents:
        raise RuntimeError("cad_service was not imported from the sanitized bundle")

    client = TestClient(app)
    health = client.get("/health")
    ready = client.get("/ready")
    assert health.status_code == 200, health.text
    assert ready.status_code == 200, ready.text
    assert ready.json()["proof"]["primitive"] == "valid-1mm-box"

    original = candidate_document()
    first_response = client.post("/v1/recompute", json={"candidate_document": original})
    assert first_response.status_code == 200, first_response.text
    first = first_response.json()
    bodies = {body["body_id"]: body for body in first["bodies"]}
    assert set(bodies) == {"body:first", "body:second"}
    assert bodies["body:first"]["volume_mm3"] == 384
    assert bodies["body:second"]["volume_mm3"] == 252

    edited = copy.deepcopy(original)
    edited["parent_revision_id"] = first["revision_id"]
    edited["features"][3]["parameters"]["distance_mm"] = 9
    second_response = client.post(
        "/v1/recompute",
        json={
            "base_document": original,
            "expected_base_revision_id": first["revision_id"],
            "candidate_document": edited,
        },
    )
    assert second_response.status_code == 200, second_response.text
    second = second_response.json()
    assert second["geometry_hash"] != first["geometry_hash"]
    assert next(body for body in second["bodies"] if body["body_id"] == "body:second")["bounds_mm"][5] == 9

    formats: dict[str, dict[str, object]] = {}
    for format_name in ("STEP", "IGES", "STL"):
        exported_response = client.post(
            "/v1/exchange",
            json={
                "request_id": f"proof:export:{format_name}",
                "direction": "EXPORT",
                "format": format_name,
                "content_base64": bodies["body:first"]["brep_base64"],
                "source_revision_id": first["revision_id"],
            },
        )
        assert exported_response.status_code == 200, exported_response.text
        exported = exported_response.json()
        imported_response = client.post(
            "/v1/exchange",
            json={
                "request_id": f"proof:import:{format_name}",
                "direction": "IMPORT",
                "format": format_name,
                "content_base64": exported["content_base64"],
            },
        )
        assert imported_response.status_code == 200, imported_response.text
        imported = imported_response.json()
        assert all(abs(left - right) <= 0.25 for left, right in zip(imported["bounds_mm"], bodies["body:first"]["bounds_mm"]))
        formats[format_name] = {
            "export_content_sha256": exported["content_sha256"],
            "editable_brep_after_import": imported["editable_brep"],
        }

    assembly_response = client.post(
        "/v1/assemblies/solve",
        json={
            "assembly_id": "proof:vercel-assembly",
            "instances": [
                {"instance_id": "fixed", "body_id": "body:first", "source_revision_id": first["revision_id"], "brep_base64": bodies["body:first"]["brep_base64"]},
                {"instance_id": "moving", "body_id": "body:first", "source_revision_id": first["revision_id"], "brep_base64": bodies["body:first"]["brep_base64"], "transform": {"translation": {"x": 30}}},
            ],
            "mates": [
                {"mate_id": "point", "kind": "POINT_COINCIDENT", "moving_instance_id": "moving", "target_instance_id": "fixed", "moving_point": {"x": 0}, "target_point": {"x": 20}}
            ],
        },
    )
    assert assembly_response.status_code == 200, assembly_response.text
    assembly = assembly_response.json()
    assert assembly["assembly_body"]["topology"]["solids"] == 2
    moving = next(item for item in assembly["instances"] if item["instance_id"] == "moving")
    assert moving["world_matrix4x4_row_major"][3] == 20

    print(
        json.dumps(
            {
                "status": "PASS",
                "import_root": str(Path(cad_service.__file__).resolve()),
                "ready": ready.json()["proof"],
                "first_revision_id": first["revision_id"],
                "edited_revision_id": second["revision_id"],
                "body_count": len(bodies),
                "assembly_solids": assembly["assembly_body"]["topology"]["solids"],
                "formats": formats,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
