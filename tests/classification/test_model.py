"""The model port: scripted for tests, cache for fixtures, budget reserved before any call."""
import json

import pytest

from forge_classification.model import (
    Abstain, Budget, BudgetExhausted, BudgetedModel, CacheModel, ScriptedModel,
)


def test_scripted_model_answers_in_order_per_kind_and_records_prompts():
    m = ScriptedModel({"advocate": [{"a": 1}, {"a": 2}], "judge": [{"j": 1}]})
    assert m.propose("advocate", "p1", {}) == {"a": 1}
    assert m.propose("judge", "pj", {}) == {"j": 1}
    assert m.propose("advocate", "p2", {}) == {"a": 2}
    assert [c.kind for c in m.calls] == ["advocate", "judge", "advocate"]
    assert m.calls[2].prompt == "p2"


def test_scripted_model_abstains_when_the_script_runs_out():
    m = ScriptedModel({"advocate": [{"a": 1}]})
    m.propose("advocate", "p1", {})
    out = m.propose("advocate", "p2", {})
    assert isinstance(out, Abstain) and out.reason == "script exhausted"


def test_cache_model_replays_by_prompt_hash_and_abstains_on_miss(tmp_path):
    cache = CacheModel(tmp_path)
    miss = cache.propose("advocate", "hello", {})
    assert isinstance(miss, Abstain) and miss.reason == "cache miss"
    cache.store("advocate", "hello", {"x": 1})
    assert cache.propose("advocate", "hello", {}) == {"x": 1}
    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1 and len(files[0].stem) == 64
    assert json.loads(files[0].read_text())["response"] == {"x": 1}


def test_budget_is_reserved_before_the_call_and_breach_never_reaches_the_model():
    inner = ScriptedModel({"advocate": [{"a": 1}, {"a": 2}]})
    budget = Budget(calls_cap=1, cost_cap_microusd=1_000_000)
    m = BudgetedModel(inner, budget, estimated_cost_microusd=10_000)
    assert m.propose("advocate", "p1", {}) == {"a": 1}
    with pytest.raises(BudgetExhausted):
        m.propose("advocate", "p2", {})
    assert len(inner.calls) == 1
    assert budget.calls_used == 1 and budget.cost_used_microusd == 10_000


def test_cost_cap_breach_is_a_hard_abort_too():
    inner = ScriptedModel({"advocate": [{"a": 1}]})
    m = BudgetedModel(inner, Budget(calls_cap=8, cost_cap_microusd=5_000), estimated_cost_microusd=10_000)
    with pytest.raises(BudgetExhausted):
        m.propose("advocate", "p1", {})
    assert inner.calls == []


def test_scripted_model_routes_per_provision_when_the_prompt_names_one():
    m = ScriptedModel({("advocate", "USML XI(c)(2)"): [{"p": "xi"}], ("advocate", "9A991.d"): [{"p": "9a"}], "advocate": [{"p": "generic"}]})
    assert m.propose("advocate", "PROVISION: 9A991.d\n...", {}) == {"p": "9a"}
    assert m.propose("advocate", "PROVISION: USML XI(c)(2)\n...", {}) == {"p": "xi"}
    assert m.propose("advocate", "no provision line", {}) == {"p": "generic"}
    assert isinstance(m.propose("advocate", "PROVISION: 9A991.d\n...", {}), Abstain)
