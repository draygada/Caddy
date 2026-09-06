"""The model port (same shape as lane/classification forge_classification/model.py @ c59a7ea; dedupe on merge).

Adapters: ScriptedModel (tests script each kind's output), CacheModel (fixtures keyed by the prompt hash; the demo
replays from it), LiveAnthropicModel (opt-in, lazy import, never exercised by tests). BudgetedModel reserves the
call and cost budget BEFORE any inner call; a breach is a hard abort, never a degraded answer.
Settings per THE BUILD §3.5: timeout 20 s, no retries, JSON-schema output, effort low, max_tokens 4096, no
temperature; any stop_reason other than end_turn abstains. Model split per the brief's S-2.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from forge_sourcing.hashing import sha256_bytes

MODEL_FOR_KIND = {"extract": "claude-sonnet-5", "search": "claude-opus-5", "escalation": "claude-opus-5"}
ESTIMATED_MICROUSD = {"extract": 106_000, "search": 27_500, "escalation": 27_500}   # S3 §(d), S5 verifier: 20 pages × 2,250 tok


@dataclass(frozen=True)
class Abstain:
    reason: str


@dataclass
class Call:
    kind: str
    prompt: str
    response: Any
    usage: dict | None = None


class ModelClient(Protocol):
    mode: str

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain: ...


def prompt_sha256(kind: str, prompt: str) -> str:
    return sha256_bytes(f"{kind}\n{prompt}".encode("utf-8"))


class ScriptedModel:
    mode = "SCRIPTED"

    def __init__(self, responses: dict[str, list]):
        self._queues = {k: list(v) for k, v in responses.items()}
        self.calls: list[Call] = []

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        queue = self._queues.get(kind, [])
        response: dict | Abstain = queue.pop(0) if queue else Abstain("script exhausted")
        self.calls.append(Call(kind, prompt, response))
        return response


class CacheModel:
    """Replays responses stored under `<dir>/<sha256(kind + "\\n" + prompt)>.json`."""
    mode = "CACHED"

    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.calls: list[Call] = []

    def _path(self, kind: str, prompt: str) -> Path:
        return self.directory / f"{prompt_sha256(kind, prompt)}.json"

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        path = self._path(kind, prompt)
        if not path.is_file():
            self.calls.append(Call(kind, prompt, Abstain("cache miss")))
            return Abstain("cache miss")
        doc = json.loads(path.read_text(encoding="utf-8"))
        self.calls.append(Call(kind, prompt, doc["response"], doc.get("usage")))
        return doc["response"]

    def store(self, kind: str, prompt: str, response: dict, usage: dict | None = None) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self._path(kind, prompt)
        path.write_text(json.dumps({"kind": kind, "prompt_sha256": prompt_sha256(kind, prompt), "model": MODEL_FOR_KIND.get(kind),
                                    "response": response, "usage": usage}, indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        return path


class BudgetExhausted(RuntimeError):
    pass


@dataclass
class Budget:
    """Request-scoped. Costs are integer micro-dollars so the record never carries a float."""
    calls_cap: int
    cost_cap_microusd: int
    calls_used: int = 0
    cost_used_microusd: int = 0

    def reserve(self, estimated_cost_microusd: int, *, stage: str = "") -> None:
        if self.calls_used + 1 > self.calls_cap:
            raise BudgetExhausted(f"call cap {self.calls_cap} reached at stage {stage!r}")
        if self.cost_used_microusd + estimated_cost_microusd > self.cost_cap_microusd:
            raise BudgetExhausted(f"cost cap {self.cost_cap_microusd} µ$ would be exceeded at stage {stage!r}")
        self.calls_used += 1
        self.cost_used_microusd += estimated_cost_microusd

    def as_dict(self) -> dict:
        return {"calls_cap": self.calls_cap, "calls_used": self.calls_used, "cost_cap_microusd": self.cost_cap_microusd, "cost_used_microusd": self.cost_used_microusd}


class BudgetedModel:
    def __init__(self, inner: ModelClient, budget: Budget):
        self.inner, self.budget = inner, budget

    @property
    def mode(self) -> str:
        return self.inner.mode

    @property
    def calls(self) -> list[Call]:
        return self.inner.calls

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        self.budget.reserve(ESTIMATED_MICROUSD.get(kind, 250_000), stage=kind)
        return self.inner.propose(kind, prompt, schema)


class LiveAnthropicModel:
    """Opt-in live adapter. Not exercised by the test suite; no spend is authorized by its existence."""
    mode = "LIVE"

    def __init__(self, *, api_key_env: str = "ANTHROPIC_API_KEY", timeout_seconds: float = 20.0, max_tokens: int = 4096):
        self.api_key_env, self.timeout_seconds, self.max_tokens = api_key_env, timeout_seconds, max_tokens
        self.calls: list[Call] = []

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        try:
            import anthropic  # noqa: PLC0415 - deliberately lazy; pinned only in the `live` extra
        except ImportError:
            return Abstain("anthropic sdk not installed")
        if not os.environ.get(self.api_key_env):
            return Abstain("no api key in environment")
        model = MODEL_FOR_KIND.get(kind, "claude-opus-5")
        try:
            client = anthropic.Anthropic(timeout=self.timeout_seconds, max_retries=0)
            message = client.messages.create(model=model, max_tokens=self.max_tokens, messages=[{"role": "user", "content": prompt}],
                                             output_config={"format": {"type": "json_schema", "schema": schema}, "effort": "low"})
        except Exception as error:  # noqa: BLE001 - every provider failure is an abstain, never a guess
            return Abstain(f"provider error: {type(error).__name__}")
        if getattr(message, "stop_reason", None) != "end_turn":
            return Abstain(f"stop_reason {getattr(message, 'stop_reason', None)!r}")
        text = "".join(getattr(b, "text", "") for b in getattr(message, "content", []) if getattr(b, "type", None) == "text")
        try:
            response = json.loads(text)
        except ValueError:
            return Abstain("response is not JSON")
        u = getattr(message, "usage", None)
        usage = {"input_tokens": int(getattr(u, "input_tokens", 0) or 0), "output_tokens": int(getattr(u, "output_tokens", 0) or 0), "model": model}
        self.calls.append(Call(kind, prompt, response, usage))
        return response


class RecordingModel:
    """Live once, replay forever: every non-abstain response is stored in the cache under its prompt hash."""

    def __init__(self, inner: ModelClient, cache: CacheModel):
        self.inner, self.cache = inner, cache

    @property
    def mode(self) -> str:
        return self.inner.mode

    @property
    def calls(self) -> list[Call]:
        return self.inner.calls

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        response = self.inner.propose(kind, prompt, schema)
        if not isinstance(response, Abstain):
            self.cache.store(kind, prompt, response, usage=self.inner.calls[-1].usage if self.inner.calls else None)
        return response
