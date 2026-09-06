"""The model port: scripted, cached, budgeted; live abstains without a key; usage is recorded as integers."""
from __future__ import annotations

from pathlib import Path

import pytest


def test_scripted_model_answers_in_order_then_abstains():
    from forge_search.model import Abstain, ScriptedModel
    m = ScriptedModel({"extract": [{"specs": []}]})
    assert m.propose("extract", "p", {}) == {"specs": []}
    assert m.propose("extract", "p", {}) == Abstain("script exhausted")
    assert m.mode == "SCRIPTED" and m.calls[0].kind == "extract" and m.calls[0].prompt == "p"


def test_cache_model_misses_then_replays_with_usage(tmp_path: Path):
    from forge_search.model import Abstain, CacheModel, prompt_sha256
    m = CacheModel(tmp_path)
    assert m.propose("search", "prompt one", {}) == Abstain("cache miss")
    path = m.store("search", "prompt one", {"candidates": []}, usage={"input_tokens": 12, "output_tokens": 3, "model": "claude-opus-5"})
    assert path.name == f"{prompt_sha256('search', 'prompt one')}.json"
    assert m.propose("search", "prompt one", {}) == {"candidates": []}
    assert m.calls[-1].usage == {"input_tokens": 12, "output_tokens": 3, "model": "claude-opus-5"} and m.mode == "CACHED"


def test_budget_reserves_before_the_call_and_aborts_on_breach():
    from forge_search.model import Budget, BudgetExhausted, BudgetedModel, ESTIMATED_MICROUSD, ScriptedModel
    inner = ScriptedModel({"extract": [{"specs": []}, {"specs": []}]})
    b = Budget(calls_cap=5, cost_cap_microusd=150_000)
    m = BudgetedModel(inner, b)
    assert m.propose("extract", "p", {}) == {"specs": []} and b.cost_used_microusd == ESTIMATED_MICROUSD["extract"] and b.calls_used == 1
    with pytest.raises(BudgetExhausted):
        m.propose("extract", "p", {})
    assert len(inner.calls) == 1 and m.mode == "SCRIPTED"


def test_live_model_abstains_without_a_key_and_never_touches_the_network(monkeypatch):
    from forge_search.model import Abstain, LiveAnthropicModel
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    m = LiveAnthropicModel()
    out = m.propose("extract", "p", {})
    assert isinstance(out, Abstain) and out.reason in ("anthropic sdk not installed", "no api key in environment") and m.mode == "LIVE"


def test_recording_model_fills_the_cache_and_replays(tmp_path: Path):
    from forge_search.model import Abstain, CacheModel, RecordingModel, ScriptedModel
    inner = ScriptedModel({"search": [{"candidates": []}]})
    cache = CacheModel(tmp_path / "cache")
    rec = RecordingModel(inner, cache)
    assert rec.mode == "SCRIPTED" and rec.propose("search", "p", {}) == {"candidates": []}
    assert cache.propose("search", "p", {}) == {"candidates": []}
    assert rec.propose("search", "p", {}) == Abstain("script exhausted") and len(list((tmp_path / "cache").iterdir())) == 1
