#!/usr/bin/env python3
"""Candidate-adjudication ablation using public synthetic cases only.

Proposal selection is deterministic and explicitly recorded. Only the advocate and
judge stages are delegated to Anthropic. This isolates downstream disposition
behavior and is not an end-to-end live-classification claim.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from forge_classification import run
from forge_classification.model import LiveAnthropicModel


RUN_DIR = Path("/tmp/caddydaddy-anthropic-runs.mRmCOx")


class HybridAblationModel:
    def __init__(self, live: LiveAnthropicModel, scripted: dict[str, list[dict]]) -> None:
        self.live = live
        self.scripted = {kind: list(values) for kind, values in scripted.items()}
        self.provider_calls: list[str] = []
        self.scripted_calls: list[str] = []

    def propose(self, kind: str, prompt: str, schema: dict) -> dict:
        queue = self.scripted.get(kind)
        if queue:
            self.scripted_calls.append(kind)
            return queue.pop(0)
        if kind in {"advocate", "judge"}:
            self.provider_calls.append(kind)
            return self.live.propose(kind, prompt, schema)
        raise RuntimeError(f"Unexpected unscripted stage: {kind}")


def request(name: str) -> dict:
    return json.loads((RUN_DIR / f"{name}.request.json").read_text(encoding="utf-8"))


def execute(name: str, live: LiveAnthropicModel, scripted: dict[str, list[dict]], calls_cap: int) -> dict:
    payload = request(name)
    model = HybridAblationModel(live, scripted)
    result = run(
        payload["product_or_part"],
        model,
        item_kind=payload["item_kind"],
        facts=payload["facts"],
        calls_cap=calls_cap,
        cost_cap_microusd=calls_cap * 250_000,
        estimated_cost_microusd=250_000,
    )
    return {
        "schema_version": "caddydaddy.anthropic-outcome-ablation/1",
        "case": name,
        "method": {
            "proposal_stages": "deterministic_fixture",
            "stage_routing": "see scripted_engine_calls and provider_calls; only listed provider_calls reached Anthropic",
            "claim_ceiling": "diagnostic candidate-adjudication ablation; not end-to-end classification or legal determination",
        },
        "scripted_engine_calls": model.scripted_calls,
        "provider_calls": model.provider_calls,
        "result": result,
    }


def main() -> None:
    api_key = os.environ["ANTHROPIC_API_KEY"]
    live = LiveAnthropicModel(
        model="claude-sonnet-5",
        api_key=api_key,
        timeout_seconds=120.0,
        max_tokens=4096,
    )

    # The successful two-call ITAR result is retained from the preceding pass. This
    # continuation spends only the two unused calls on the CCL candidate.
    itar = json.loads((RUN_DIR / "itar.hybrid.response.json").read_text(encoding="utf-8"))

    ear = execute(
        "ear",
        live,
        {
            "usml_propose": [{
                "candidates": [{
                    "provision": "USML VIII(a)(5)",
                    "why_considered": "A complete UAV must be checked for special design to incorporate a defense article before the CCL is reached.",
                    "via": "enumerated",
                }],
                "specially_designed_read": "released: contemporaneous records establish general-purpose civil development and no defense article is incorporated",
                "no_usml_reasoning": "",
            }],
            "advocate": [{
                "provision": "USML VIII(a)(5)",
                "elements": [{
                    "element_id": "incorporates_defense_article",
                    "disposition": "indeterminate",
                    "basis": "stated",
                    "facts_relied_on": ["incorporates_defense_article", "military_design", "development_purpose"],
                "citation": None,
                }],
                "case_for": "Retain the nearest-miss for an adverse judge walk; the stated civil facts appear to defeat the required defense-article integration element.",
            }],
            "judge": [{
                "provision": "USML VIII(a)(5)",
                "ruling": "knocked_out",
                "elements": [{
                    "element_id": "incorporates_defense_article",
                    "disposition": "not_met",
                    "basis": "stated",
                    "facts_relied_on": ["incorporates_defense_article", "military_design", "development_purpose", "contemporaneous_civil_development_documents"],
                    "citation": {
                        "unit_key": "USML VIII(a)(5)",
                        "unit_sha256": "aae7912342129280098cf8950d46ad32502daa924a395b75dc2d299316c914d0",
                        "quote": "Unmanned aerial vehicles (UAVs) specially designed to incorporate a defense article;",
                        "start": 0,
                        "end": 84
                    }
                }],
                "reason": "The pinned paragraph requires the UAV to be specially designed to incorporate a defense article; the synthetic facts expressly state the opposite and identify contemporaneous civil development records.",
                "challenge": {
                    "text": "The civil-development assertion could be unreliable or incomplete.",
                    "resolution": "rejected"
                }
            }],
            "ccl_propose": [{
                "candidates": [{
                    "provision": "9A012.a.2",
                    "why_considered": "The complete civil UAV is designed for flight beyond direct natural vision and has 90-minute endurance.",
                    "via": "enumerated",
                }],
                "specially_designed_read": "",
            }],
        },
        calls_cap=6,
    )
    (RUN_DIR / "ear.hybrid.response.json").write_text(json.dumps(ear, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    summary = {
        "schema_version": "caddydaddy.anthropic-outcome-ablation-summary/1",
        "provider_call_count_current_artifacts": len(itar["provider_calls"]) + len(ear["provider_calls"]),
        "provider_call_count_continuation_pass": len(ear["provider_calls"]),
        "provider_call_count_cumulative": 5,
        "prior_ear_usml_judge_call_preserved_as": "ear.hybrid-usml-open.response.json",
        "itar_jurisdiction": itar["result"]["determination"]["jurisdiction"],
        "itar_classification": itar["result"]["determination"]["classification"],
        "ear_jurisdiction": ear["result"]["determination"]["jurisdiction"],
        "ear_classification": ear["result"]["determination"]["classification"],
        "claim_ceiling": "Hybrid diagnostic only; the earlier fully live ambiguous case remains the end-to-end ambiguity evidence.",
    }
    (RUN_DIR / "hybrid-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
