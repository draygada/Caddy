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
    assert len(m.calls) == 1 and m.calls[-1].response == out and m.calls[-1].usage is None      # an abstain is a call too


def test_live_model_records_every_abstain_so_usage_is_never_the_previous_calls(monkeypatch):
    """I7: `calls[-1].usage` after an abstain used to be the PREVIOUS call's tokens, because only successes were appended."""
    from forge_search.documents import text_sha256
    from forge_search.extract import extract
    from forge_search.model import Abstain, LiveAnthropicModel
    m = LiveAnthropicModel()
    spent = {"input_tokens": 9, "output_tokens": 1, "model": "claude-sonnet-5"}
    answers = [({"specs": []}, spent), (Abstain("stubbed: stop_reason 'max_tokens'"), None), (Abstain("stubbed again"), None)]
    monkeypatch.setattr(m, "_complete", lambda kind, prompt, schema: answers.pop(0))
    assert m.propose("extract", "p", {}) == {"specs": []} and m.calls[-1].usage == spent
    out = m.propose("extract", "p", {})
    assert isinstance(out, Abstain) and m.calls[-1].response is out and m.calls[-1].usage is None and len(m.calls) == 2
    text = "Frame rate: 8.7 Hz\n"
    res = extract(text, text_sha256(text), "thermal_imager", {"frame_rate_hz": "Hz"}, {}, m)
    assert res.abstained == "stubbed again" and res.usage is None and answers == []


def test_live_model_sends_the_api_subset_of_the_schema(monkeypatch):
    """req_011CenFs4NW6pJWRQvGJfRQs 400'd on `maxItems`: the request carries `api_schema(...)`, nothing else changes."""
    import sys
    from types import SimpleNamespace
    from forge_search.model import LiveAnthropicModel
    from forge_search.schemas import EXTRACT_SCHEMA, api_schema
    seen: dict = {}

    def _create(**kw):
        seen["create"] = kw
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text='{"specs": []}')],
                               usage=SimpleNamespace(input_tokens=11, output_tokens=2))

    def _anthropic(**kw):
        seen["client"] = kw
        return SimpleNamespace(messages=SimpleNamespace(create=_create))

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=_anthropic))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "not-a-real-key")
    m = LiveAnthropicModel()
    assert m.propose("extract", "p", EXTRACT_SCHEMA) == {"specs": []}
    sent = seen["create"]["output_config"]
    assert sent == {"format": {"type": "json_schema", "schema": api_schema(EXTRACT_SCHEMA)}, "effort": "low"}
    assert "maxItems" not in sent["format"]["schema"]["properties"]["specs"] and "maxItems" in EXTRACT_SCHEMA["properties"]["specs"]
    assert seen["create"]["model"] == "claude-sonnet-5" and seen["create"]["max_tokens"] == 4096
    assert seen["create"]["messages"] == [{"role": "user", "content": "p"}] and seen["client"] == {"timeout": 20.0, "max_retries": 0}
    assert m.calls[-1].usage == {"input_tokens": 11, "output_tokens": 2, "model": "claude-sonnet-5"}


def test_recording_model_fills_the_cache_and_replays(tmp_path: Path):
    from forge_search.model import Abstain, CacheModel, RecordingModel, ScriptedModel
    inner = ScriptedModel({"search": [{"candidates": []}]})
    cache = CacheModel(tmp_path / "cache")
    rec = RecordingModel(inner, cache)
    assert rec.mode == "SCRIPTED" and rec.propose("search", "p", {}) == {"candidates": []}
    assert cache.propose("search", "p", {}) == {"candidates": []}
    assert rec.propose("search", "p", {}) == Abstain("script exhausted") and len(list((tmp_path / "cache").iterdir())) == 1
