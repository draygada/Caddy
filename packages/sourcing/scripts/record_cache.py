"""Record the demo cache with ONE live run over the gold set. Human-run only; needs ANTHROPIC_API_KEY and
TRIPWIRE_LLM=live; capped at $5 per run by Budget (the demo key cap is $50). Seed the documents first
(make seed) so the prompts hash over the real document text. Afterwards `make eval` must report zero cache misses.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_search.model import Budget, BudgetedModel, CacheModel, LiveAnthropicModel, RecordingModel  # noqa: E402
from forge_search.propose import Ports, default_ports  # noqa: E402

DATA = PKG / "data"

if __name__ == "__main__":
    if os.environ.get("TRIPWIRE_LLM") != "live" or not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("set TRIPWIRE_LLM=live and ANTHROPIC_API_KEY (Charlie's key, $50 cap); nothing was called")
    sys.path.insert(0, str(PKG / "scripts"))
    from eval_search import run_gold  # noqa: E402
    from forge_sourcing.service import Service
    budget = Budget(calls_cap=40, cost_cap_microusd=5_000_000)
    base = default_ports(DATA, mode="cache", offline=True)
    model = BudgetedModel(RecordingModel(LiveAnthropicModel(), CacheModel(DATA / "llm_cache")), budget)
    ports = Ports(base.fetcher, model, base.rules, base.pool, base.pool_sha256, base.documents_sha256)
    gold = json.loads((DATA / "search" / "gold_swaps.json").read_text(encoding="utf-8"))
    states = json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))["states"]
    out = run_gold(gold, lambda: Service(DATA), lambda row: ports, states=states)
    print(json.dumps(out["measurements"], indent=1))
    print(f"budget used: {budget.calls_used} calls · {budget.cost_used_microusd} µ$ reserved (≈ ${budget.cost_used_microusd / 1_000_000:.2f})")
    print("now run: make eval  (must print cache_misses 0) and commit data/llm_cache/")
