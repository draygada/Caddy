"""Strafe Forge classification lane — a pure order-of-review engine that runs a product or part end
to end and returns its jurisdictional determination. No human gate, no memo, no filing recommendation."""

from __future__ import annotations

from pathlib import Path

from .engine import ModelUnavailable, determine
from .model import Budget, BudgetedModel, ModelClient
from .pack import ReferencePack, build_pack
from .snapshot import FactSnapshot, snapshot_from_part_revision, snapshot_from_product

DEFAULT_RAW = Path(__file__).resolve().parent.parent / "data" / "ecfr" / "raw"


def default_pack() -> ReferencePack:
    return build_pack(DEFAULT_RAW)


def run(product_or_part: dict | str, model: ModelClient, *, item_kind: str = "commodity", facts: dict | list | None = None,
        pack: ReferencePack | None = None, calls_cap: int = 16, cost_cap_microusd: int = 8_000_000,
        estimated_cost_microusd: int = 250_000, progress=None) -> dict:
    """One call, end to end: a part revision (`forge.part-revision/1` dict) or a product description
    (string) in; the determination out. Raises BudgetExhausted or ModelUnavailable; never a partial answer."""
    pack = pack or default_pack()
    if isinstance(product_or_part, str):
        snap = snapshot_from_product(product_or_part, facts, item_kind=item_kind)
    else:
        snap = snapshot_from_part_revision(product_or_part, facts, item_kind=item_kind)
    budget = Budget(calls_cap=calls_cap, cost_cap_microusd=cost_cap_microusd)
    return determine(snap, pack, BudgetedModel(model, budget, estimated_cost_microusd=estimated_cost_microusd), budget, progress=progress)


__all__ = ["run", "determine", "default_pack", "build_pack", "snapshot_from_product", "snapshot_from_part_revision",
           "FactSnapshot", "ReferencePack", "Budget", "BudgetedModel", "ModelUnavailable"]
