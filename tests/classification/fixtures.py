"""Shared fixtures: the Kestrel flight-controller board and scripted wave outputs."""
from __future__ import annotations

from pathlib import Path

from forge_classification.pack import build_pack, resolve

RAW = Path(__file__).resolve().parents[2] / "packages/classification/data/ecfr/raw"
_PACK = None


def pack():
    global _PACK
    if _PACK is None:
        _PACK = build_pack(RAW)
    return _PACK


REV = "rev:" + "1" * 64

PART_REVISION = {
    "protocol_version": "forge.part-revision/1",
    "part_document": {
        "schema_version": "forge.part-document/1",
        "document_id": "part:fc-board",
        "geometry_hash": "0" * 64,
        "revision": {
            "revision_id": REV, "revision_hash": "1" * 64, "parent_revision_ids": [],
            "actor_id": "actor:diego",
            "intent": "Flight-controller board for the Kestrel civil survey drone",
            "authorization_ref": None,
        },
        "units": {"length": "mm", "angle": "deg"},
        "parameters": {
            "param:board_width": {"parameter_id": "param:board_width", "name": "board_width",
                                  "value_type": "LENGTH", "literal": "40", "expression": None},
        },
        "bodies": [{
            "body_id": "body:pcb", "name": "PCB", "root_operation_id": "op:x",
            "root_semantic_reference_id": "ref:x", "default_visibility": True,
            "metadata": {"layout_target": "civil_uav", "mcu": "STM32H743"},
            "material_mass": {"material_ref": None, "density_kg_per_mm3": None, "mass_override_kg": None},
            "bom_identity": {"part_number": "FC-001", "revision": "A",
                             "description": "Flight controller board, 4-layer FR-4, STM32H743, ICM-42688-P IMU", "unit": "EA"},
        }],
        "operations": [], "semantic_references": {},
    },
    "revision_hash": "1" * 64, "geometry_hash": "0" * 64, "kernel_result": None, "artifacts": [],
    "provenance": {"parent_revision_ids": [], "actor_id": "actor:diego", "authorization_ref": None,
                   "engine_manifest_hash": "2" * 64},
}


def declared(facts, *, actor_type="HUMAN", level="DECLARED", artifact_refs=(), record_id="declared:fc:1"):
    return {
        "schema_version": "forge.record/1", "record_kind": "compliance.declared-facts.v1",
        "record_id": record_id, "authority_domain": "compliance",
        "actor": {"actor_id": "actor:charlie", "actor_type": actor_type, "alias": "founder"},
        "source_confidence": {"level": level, "basis": "test", "observed_at": "2026-09-05T20:00:00Z"},
        "provenance": {"adapter_id": "forge-native", "adapter_version": "1", "tool_identity": "forge@test",
                       "input_record_refs": [], "artifact_refs": list(artifact_refs), "generated_at": "2026-09-05T20:00:00Z"},
        "payload": {"part_revision_id": REV, "facts": facts},
    }


CIVIL_FACTS = declared([
    {"path": "declared.military_use", "value": "false", "unit": None},
    {"path": "declared.used_on", "value": "Kestrel civil survey drone", "unit": None},
    {"path": "declared.civil_product", "value": "true", "unit": None},
    {"path": "declared.mass_market", "value": "false", "unit": None},
    {"path": "declared.designed_to_incorporate", "value": "none", "unit": None},
])


def cite(unit_key: str, quote: str) -> dict:
    """A true byte-range citation into the pack, built from the unit's own text."""
    unit = resolve(pack(), unit_key)
    start = unit.text.find(quote)
    assert start >= 0, f"{quote!r} not in {unit_key}: {unit.text!r}"
    return {"unit_key": unit.unit_key, "unit_sha256": unit.sha256, "quote": quote, "start": start, "end": start + len(quote)}


def element(unit_key, disposition, *, quote=None, facts=("body.pcb.layout_target",), basis="stated",
            missing=None, element_id=None):
    return {
        "element_id": element_id or f"el:{unit_key}:{disposition}",
        "unit_key": unit_key,
        "disposition": disposition,
        "basis": basis,
        "facts_relied_on": list(facts),
        "citation": cite(unit_key, quote) if quote else None,
        "missing_fact": missing,
    }


def propose(*provisions, sd_read="Not specially designed: civil layout target declared."):
    return {"candidates": [{"provision": p, "why_considered": f"{p} could reach this board."} for p in provisions],
            "specially_designed_read": sd_read, "no_usml_reasoning": ""}


def advocate(provision, elements, *, intended_use=("Civil survey drone.", "end_use_nature")):
    return {"provision": provision, "elements": elements, "case_for": f"The strongest honest case for {provision}.",
            "intended_use_rationale": intended_use[0] if intended_use else None,
            "intended_use_family": intended_use[1] if intended_use else None}


def judge(provision, ruling, elements, *, reason=None, challenge=None):
    return {"provision": provision, "ruling": ruling, "elements": elements,
            "reason": reason or f"{provision}: {ruling.replace('_', ' ')}.", "challenge": challenge}


def concerns(items=(), tensions=()):
    return {"concerns": list(items), "legal_tensions": list(tensions)}
