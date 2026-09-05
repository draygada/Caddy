#!/usr/bin/env python3
"""Regenerate the strict PartDocument/AssemblyDocument v1 hash vectors.

The vector corpus contains only strings, integers, booleans, nulls, arrays and maps, so
Python's sorted compact JSON form is identical to RFC 8785 for these values.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "docs/contracts/part-document.v1.test-vectors.json"


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def vector(preimage: Any, **extra: str) -> dict[str, Any]:
    encoded = canonical(preimage)
    result: dict[str, Any] = {
        "preimage": preimage,
        "canonical_utf8": encoded,
        "sha256": hashlib.sha256(encoded.encode("utf-8")).hexdigest(),
    }
    result.update(extra)
    return result


def matrix(x: int) -> dict[str, list[str]]:
    return {
        "matrix4x4_row_major": [
            "1", "0", "0", str(x),
            "0", "1", "0", "0",
            "0", "0", "1", "0",
            "0", "0", "0", "1",
        ]
    }


def component(component_id: str, kind: str, definition_id: str, revision_id: str, x: int) -> dict[str, Any]:
    return {
        "component_id": component_id,
        "target_definition_kind": kind,
        "target_definition_id": definition_id,
        "target_definition_revision_id": revision_id,
        "multiplicity": 1,
        "nominal_transform": matrix(x),
        "default_composition_state": "INCLUDED",
        "default_visibility_state": "VISIBLE",
        "default_bom_state": "INCLUDED",
        "relation_ids": [],
        "metadata": {},
    }


def definition_vector(preimage: dict[str, Any], prefix: str) -> tuple[dict[str, Any], dict[str, Any]]:
    result = vector(preimage)
    revision_id = f"{prefix}:{result['sha256']}"
    result["definition_revision_id"] = revision_id
    full = deepcopy(preimage)
    full["definition_revision_id"] = revision_id
    full["definition_revision_hash"] = result["sha256"]
    return result, full


def occurrence(
    path: list[str], component_id: str, kind: str, definition_id: str,
    definition_revision_id: str, x: int,
) -> dict[str, Any]:
    return {
        "occurrence_path": path,
        "component_id": component_id,
        "target_definition_kind": kind,
        "target_definition_id": definition_id,
        "target_definition_revision_id": definition_revision_id,
        "instance_ordinal": 1,
        "world_transform": matrix(x),
    }


def build(existing: dict[str, Any]) -> dict[str, Any]:
    vectors = existing["vectors"]
    part_definition_vector = vectors["definition_revision_hash"]
    part_definition = deepcopy(part_definition_vector["preimage"])
    part_definition["definition_revision_id"] = part_definition_vector["definition_revision_id"]
    part_definition["definition_revision_hash"] = part_definition_vector["sha256"]

    sub_preimage = {
        "definition_id": "assemblydef:clamp",
        "components": [
            component("component:bracket-a", "PART", "partdef:test", part_definition_vector["definition_revision_id"], -2),
            component("component:bracket-b", "PART", "partdef:test", part_definition_vector["definition_revision_id"], 0),
            component("component:bracket-c", "PART", "partdef:test", part_definition_vector["definition_revision_id"], 2),
        ],
        "metadata": {},
        "bom_identity": None,
    }
    sub_vector, sub_definition = definition_vector(sub_preimage, "assemblydef-rev")

    root_preimage = {
        "definition_id": "assemblydef:root",
        "components": [
            component("component:clamp-left", "ASSEMBLY", "assemblydef:clamp", sub_vector["definition_revision_id"], -10),
            component("component:clamp-right", "ASSEMBLY", "assemblydef:clamp", sub_vector["definition_revision_id"], 10),
        ],
        "metadata": {},
        "bom_identity": None,
    }
    root_vector, root_definition = definition_vector(root_preimage, "assemblydef-rev")

    config_revision_preimage = {
        "schema_version": "forge.configuration-revision/1",
        "configuration_id": "configuration:default",
        "name": "Default",
        "base_assembly_definition_revision_id": root_vector["definition_revision_id"],
        "overrides": [],
        "parent_revision_ids": [],
        "actor_id": "actor:test",
        "intent": "resolve default configuration",
        "authorization_ref": None,
    }
    config_revision_vector = vector(config_revision_preimage)
    config_revision_vector["revision_id"] = f"configuration-rev:{config_revision_vector['sha256']}"

    resolved_preimage = {
        "schema_version": "forge.resolved-configuration/1",
        "base_assembly_definition_revision_id": root_vector["definition_revision_id"],
        "overrides": [],
    }
    resolved_vector = vector(resolved_preimage)
    resolved_vector["resolved_configuration_id"] = f"configuration-resolved:{resolved_vector['sha256']}"
    resolved_configuration = {
        "schema_version": "forge.resolved-configuration/1",
        "configuration_id": "configuration:default",
        "configuration_revision_id": config_revision_vector["revision_id"],
        "configuration_revision_hash": config_revision_vector["sha256"],
        "parent_revision_ids": [],
        "actor_id": "actor:test",
        "intent": "resolve default configuration",
        "authorization_ref": None,
        "name": "Default",
        "base_assembly_definition_revision_id": root_vector["definition_revision_id"],
        "overrides": [],
        "resolved_configuration_hash": resolved_vector["sha256"],
        "resolved_configuration_id": resolved_vector["resolved_configuration_id"],
    }

    content_preimage = {
        "schema_version": "forge.assembly-content/1",
        "assembly_id": "assembly:test",
        "part_definitions": {part_definition_vector["definition_revision_id"]: part_definition},
        "assembly_definitions": {
            root_vector["definition_revision_id"]: root_definition,
            sub_vector["definition_revision_id"]: sub_definition,
        },
        "root_assembly_definition_revision_id": root_vector["definition_revision_id"],
        "resolved_configuration": resolved_configuration,
        "metadata": {},
    }
    content_vector = vector(content_preimage)

    occurrences = [
        occurrence(["component:clamp-left"], "component:clamp-left", "ASSEMBLY", "assemblydef:clamp", sub_vector["definition_revision_id"], -10),
        occurrence(["component:clamp-left", "component:bracket-a"], "component:bracket-a", "PART", "partdef:test", part_definition_vector["definition_revision_id"], -12),
        occurrence(["component:clamp-left", "component:bracket-b"], "component:bracket-b", "PART", "partdef:test", part_definition_vector["definition_revision_id"], -10),
        occurrence(["component:clamp-left", "component:bracket-c"], "component:bracket-c", "PART", "partdef:test", part_definition_vector["definition_revision_id"], -8),
        occurrence(["component:clamp-right"], "component:clamp-right", "ASSEMBLY", "assemblydef:clamp", sub_vector["definition_revision_id"], 10),
        occurrence(["component:clamp-right", "component:bracket-a"], "component:bracket-a", "PART", "partdef:test", part_definition_vector["definition_revision_id"], 8),
        occurrence(["component:clamp-right", "component:bracket-b"], "component:bracket-b", "PART", "partdef:test", part_definition_vector["definition_revision_id"], 10),
        occurrence(["component:clamp-right", "component:bracket-c"], "component:bracket-c", "PART", "partdef:test", part_definition_vector["definition_revision_id"], 12),
    ]
    composition_preimage = {
        "schema_version": "forge.assembly-composition/1",
        "assembly_id": "assembly:test",
        "resolved_configuration_id": resolved_vector["resolved_configuration_id"],
        "occurrences": occurrences,
    }
    composition_vector = vector(composition_preimage)

    assembly_revision_preimage = {
        "schema_version": "forge.assembly-document/1",
        "assembly_id": "assembly:test",
        "assembly_content_hash": content_vector["sha256"],
        "assembly_geometry_hash": composition_vector["sha256"],
        "resolved_configuration_hash": resolved_vector["sha256"],
        "parent_revision_ids": [],
        "actor_id": "actor:test",
        "intent": "reuse one subassembly twice",
        "authorization_ref": None,
    }
    assembly_revision_vector = vector(assembly_revision_preimage)
    assembly_revision_vector["revision_id"] = f"assembly-rev:{assembly_revision_vector['sha256']}"

    source_paths = [item["occurrence_path"] for item in occurrences if item["target_definition_kind"] == "PART"]
    bom_line_preimage = {
        "definition_id": "partdef:test",
        "definition_revision_id": part_definition_vector["definition_revision_id"],
        "part_revision_id": part_definition["part_revision_id"],
        "part_geometry_hash": part_definition["part_geometry_hash"],
        "body_ids": ["body:test"],
        "part_number": "TEST-001",
        "revision": "A",
        "description": "Test part",
        "quantity": 6,
        "unit": "EA",
        "resolved_configuration_id": resolved_vector["resolved_configuration_id"],
        "effectivity": {"start": None, "end": None},
        "source_occurrence_paths": source_paths,
    }
    bom_line_vector = vector(bom_line_preimage)
    bom_line_vector["bom_line_id"] = f"bom:{bom_line_vector['sha256']}"
    bom_line = deepcopy(bom_line_preimage)
    bom_line["bom_line_id"] = bom_line_vector["bom_line_id"]
    bom_vector = vector([bom_line])

    new_vectors = {
        key: deepcopy(value)
        for key, value in vectors.items()
        if key not in {
            "assembly_definition_revision_hash_subassembly",
            "assembly_definition_revision_hash_root", "configuration_revision_hash",
            "resolved_configuration_hash", "assembly_content_hash", "assembly_geometry_hash",
            "assembly_revision_hash", "bom_line_hash", "bom_hash",
        }
    }
    new_vectors.update({
        "assembly_definition_revision_hash_subassembly": sub_vector,
        "assembly_definition_revision_hash_root": root_vector,
        "configuration_revision_hash": config_revision_vector,
        "resolved_configuration_hash": resolved_vector,
        "assembly_content_hash": content_vector,
        "assembly_geometry_hash": composition_vector,
        "assembly_revision_hash": assembly_revision_vector,
        "bom_line_hash": bom_line_vector,
        "bom_hash": bom_vector,
    })
    return {
        "schema_version": "forge.part-document-test-vectors/1",
        "canonicalization": "RFC8785",
        "hash": "SHA-256",
        "vectors": new_vectors,
    }


def serialized(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    existing = json.loads(TARGET.read_text(encoding="utf-8"))
    result = build(existing)
    expected = serialized(result)
    if args.write:
        TARGET.write_text(expected, encoding="utf-8")
    if args.check and TARGET.read_text(encoding="utf-8") != expected:
        print(f"GENERATED_MISMATCH {TARGET.relative_to(ROOT)}", file=sys.stderr)
        return 1
    print(f"vectors={len(result['vectors'])}")
    print(f"assembly_content_hash={result['vectors']['assembly_content_hash']['sha256']}")
    print(f"assembly_geometry_hash={result['vectors']['assembly_geometry_hash']['sha256']}")
    print("PART_CONTRACT_VECTORS_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
