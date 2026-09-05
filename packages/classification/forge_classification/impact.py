"""Impact: which recorded candidates cited a unit that changed between two reference packs. A diff."""

from __future__ import annotations

from .pack import ReferencePack, canonical_provision, diff


def impact(pack_a: ReferencePack, pack_b: ReferencePack, analyses: list[dict]) -> dict:
    d = diff(pack_a, pack_b)
    changed = set(d.changed) | set(d.removed)
    affected: list[dict] = []
    for envelope in analyses:
        item = envelope["item"]
        for cand in envelope["candidates"]:
            cited = {el["citation"]["unit_key"] for el in cand["elements"] if el["citation"]}
            if cand["status"] == "leading":
                key = canonical_provision(cand["provision"])
                if key:
                    cited.add(key)
            for unit_key in sorted(cited & changed):
                affected.append({
                    "part_revision_id": item["part_revision_id"],
                    "item_kind": item["item_kind"],
                    "candidate_id": cand["candidate_id"],
                    "provision": cand["provision"],
                    "cited_unit": unit_key,
                    "status_before": cand["status"],
                })
    proposals = []
    seen: set[tuple[str, str]] = set()
    for row in affected:
        key = (row["part_revision_id"], row["item_kind"])
        if key in seen:
            continue
        seen.add(key)
        proposals.append({
            "action": "reanalyse",
            "part_revision_id": row["part_revision_id"],
            "item_kind": row["item_kind"],
            "cause": "lists_moved",
            "changed_units": sorted({r["cited_unit"] for r in affected if (r["part_revision_id"], r["item_kind"]) == key}),
        })
    return {
        "pack_a_sha256": pack_a.sha256,
        "pack_b_sha256": pack_b.sha256,
        "changed_units": sorted(changed),
        "added_units": list(d.added),
        "affected": affected,
        "proposals": proposals,
    }
