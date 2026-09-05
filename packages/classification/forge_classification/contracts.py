"""Loaders for the lane's frozen JSON Schema contracts, and one worked example envelope."""

from __future__ import annotations

import copy
import json
from pathlib import Path

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"

_HEX = "0123456789abcdef"


def load_schema(name: str) -> dict:
    return json.loads((CONTRACTS_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def _hex(ch: str) -> str:
    return ch * 64


_EXAMPLE = {
    "schema_version": "forge-classification.envelope/1",
    "snapshot_sha256": _hex("1"),
    "pack_sha256": _hex("2"),
    "item": {"part_revision_id": "rev:" + _hex("3"), "item_kind": "commodity"},
    "readiness": {"band": "classifiable", "missing_fields": [], "blocking_fields": []},
    "candidates": [
        {
            "candidate_id": "cand:usml-xi-c-2", "provision": "USML XI(c)(2)", "stage": "usml_enumerated",
            "status": "knocked_out", "pursuit": None, "origin": "proposed",
            "why_considered": "A flight-controller board is a printed circuit board; XI(c)(2) reaches boards specially designed for defense articles.",
            "why_rejected": "The board's layout target is a civil UAV (attested); it is not designed for a defense article.",
            "why_over_alternative": None,
            "intended_use_rationale": "Declared end use is a civil survey drone.",
            "intended_use_family": "end_use_nature",
            "elements": [{
                "element_id": "el:xi-c-2:1", "unit_key": "USML XI(c)(2)", "disposition": "not_met", "basis": "stated",
                "facts_relied_on": [{"path": "body.pcb.layout_target", "evidence_grade": "attested"}],
                "citation": {"unit_key": "USML XI(c)(2)", "unit_sha256": _hex("4"), "start": 0, "end": 12, "quote": "Printed circ"},
                "missing_fact": None,
            }],
            "fit_quality": "none", "challenge": {"text": "Could the board be for use in a defense article by later integration?", "resolution": "rejected"},
            "reference_notes": [],
        },
        {
            "candidate_id": "cand:3a611-g", "provision": "3A611.g", "stage": "six_hundred_series",
            "status": "knocked_out", "pursuit": None, "origin": "proposed",
            "why_considered": "600-series boards specially designed for military electronics.",
            "why_rejected": "No 600-series parent; the layout target is civil (attested).",
            "why_over_alternative": None, "intended_use_rationale": None, "intended_use_family": None,
            "elements": [{
                "element_id": "el:3a611-g:1", "unit_key": "3A611.g", "disposition": "not_met", "basis": "stated",
                "facts_relied_on": [{"path": "body.pcb.layout_target", "evidence_grade": "attested"}],
                "citation": {"unit_key": "3A611.g", "unit_sha256": _hex("5"), "start": 0, "end": 7, "quote": "Printed"},
                "missing_fact": None,
            }],
            "fit_quality": "none", "challenge": None, "reference_notes": [],
        },
        {
            "candidate_id": "cand:9a991-d", "provision": "9A991.d", "stage": "other_ccl",
            "status": "leading", "pursuit": "worth_pursuing", "origin": "proposed",
            "why_considered": "Aircraft parts and components not elsewhere specified.",
            "why_rejected": None,
            "why_over_alternative": "Over 3A611.g because the board has no 600-series parent; flips if a defense-article parent is declared.",
            "intended_use_rationale": "Civil survey drone.", "intended_use_family": "end_use_nature",
            "elements": [{
                "element_id": "el:9a991-d:1", "unit_key": "9A991.d", "disposition": "met", "basis": "stated",
                "facts_relied_on": [{"path": "body.pcb.layout_target", "evidence_grade": "attested"},
                                    {"path": "bom.description", "evidence_grade": "verified"}],
                "citation": {"unit_key": "9A991.d", "unit_sha256": _hex("6"), "start": 0, "end": 5, "quote": "Other"},
                "missing_fact": None,
            }],
            "fit_quality": "partial", "challenge": None, "reference_notes": [],
        },
        {
            "candidate_id": "cand:ear99", "provision": "EAR99", "stage": "residual",
            "status": "not_reached", "pursuit": "explicitly_not", "origin": "floor",
            "why_considered": "The residual is seated on every board.",
            "why_rejected": None, "why_over_alternative": None, "intended_use_rationale": None, "intended_use_family": None,
            "elements": [], "fit_quality": None, "challenge": None, "reference_notes": [],
        },
    ],
    "route": {"usml_step": "negative", "ccl_step": "specific_supported", "posture": "EAR",
              "leading_candidate_id": "cand:9a991-d",
              "order_of_review_trace": ["USML: negative — every candidate knocked out on a cited element",
                                        "CCL: 9A991.d supported", "EAR99: not reached — a specific entry applies"]},
    "claim_class": "conditional",
    "claim_class_reason": "The leading entry's decisive facts are attested; the USML knockout relies on a declared, not document-verified, layout target.",
    "claim_class_ceiling": "supported",
    "ceiling_reason": None,
    "recommended_instrument": None,
    "questions": [],
    "concerns": [],
    "legal_tensions": [],
    "provenance": {
        "model": "scripted", "calls": [], "budget": {"calls_cap": 8, "calls_used": 0, "cost_cap_microusd": 6_000_000, "cost_used_microusd": 0},
        "dropped_candidates": [], "reference_notes": [],
    },
}


def example_envelope() -> dict:
    return copy.deepcopy(_EXAMPLE)
