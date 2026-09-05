"""The model port. The engine never constructs a client; it is handed one.

Adapters: `ScriptedModel` (tests script each wave's output), `CacheModel` (fixtures keyed by the
prompt's hash; the demo and the differential harness replay from it), `LiveAnthropicModel` (opt-in,
lazy import, no dependency pinned — an integrator decision). `BudgetedModel` reserves the request's
call and cost budget BEFORE any inner call; a breach is a hard abort, never a degraded answer.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from .records import sha256


@dataclass(frozen=True)
class Abstain:
    reason: str


@dataclass
class Call:
    kind: str
    prompt: str
    response: Any


class ModelClient(Protocol):
    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain: ...


def prompt_sha256(kind: str, prompt: str) -> str:
    return sha256(f"{kind}\n{prompt}".encode("utf-8"))


class ScriptedModel:
    """Answers each kind from a queue; abstains when the script runs out. Records every prompt so
    tests can assert what a call was and was not shown."""

    def __init__(self, responses: dict):
        self._queues = {k: list(v) for k, v in responses.items()}
        self.calls: list[Call] = []

    @staticmethod
    def _provision(prompt: str) -> str | None:
        for line in prompt.splitlines():
            if line.startswith("PROVISION: "):
                return line[len("PROVISION: "):].strip()
        return None

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        provision = self._provision(prompt)
        queue = self._queues.get((kind, provision)) if provision else None
        if queue is None or (not queue and (kind, provision) not in self._queues):
            queue = self._queues.get(kind, [])
        response: dict | Abstain = queue.pop(0) if queue else Abstain("script exhausted")
        self.calls.append(Call(kind, prompt, response))
        return response


class CacheModel:
    """Replays responses stored under `<dir>/<sha256(kind + prompt)>.json`."""

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
        response = json.loads(path.read_text(encoding="utf-8"))["response"]
        self.calls.append(Call(kind, prompt, response))
        return response

    def store(self, kind: str, prompt: str, response: dict) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self._path(kind, prompt)
        path.write_text(json.dumps({"kind": kind, "prompt_sha256": prompt_sha256(kind, prompt), "response": response},
                                   indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")
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
        return {"calls_cap": self.calls_cap, "calls_used": self.calls_used,
                "cost_cap_microusd": self.cost_cap_microusd, "cost_used_microusd": self.cost_used_microusd}


class BudgetedModel:
    def __init__(self, inner: ModelClient, budget: Budget, *, estimated_cost_microusd: int = 250_000):
        self.inner = inner
        self.budget = budget
        self.estimated_cost_microusd = estimated_cost_microusd

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        self.budget.reserve(self.estimated_cost_microusd, stage=kind)
        return self.inner.propose(kind, prompt, schema)


class LiveAnthropicModel:
    """Opt-in live adapter. Not exercised by the test suite; no spend is authorized by its existence.
    Any response that is not exactly one tool-use block of the requested kind is an abstain."""

    def __init__(self, *, model: str = "claude-opus-5", api_key_env: str = "ANTHROPIC_API_KEY",
                 timeout_seconds: float = 20.0, max_tokens: int = 4096):
        self.model = model
        self.api_key_env = api_key_env
        self.timeout_seconds = timeout_seconds
        self.max_tokens = max_tokens
        self.calls: list[Call] = []

    def propose(self, kind: str, prompt: str, schema: dict) -> dict | Abstain:
        try:
            import anthropic  # noqa: PLC0415 - deliberately lazy; the dependency is not pinned by this lane
        except ImportError:
            return Abstain("anthropic sdk not installed")
        if not os.environ.get(self.api_key_env):
            return Abstain("no api key in environment")
        try:
            client = anthropic.Anthropic(timeout=self.timeout_seconds, max_retries=0)
            message = client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}],
                tools=[{"name": kind, "description": f"Record the {kind} output.", "input_schema": schema}],
                tool_choice={"type": "tool", "name": kind},
            )
        except Exception as error:  # noqa: BLE001 - every provider failure is an abstain, never a guess
            return Abstain(f"provider error: {type(error).__name__}")
        blocks = [b for b in getattr(message, "content", []) if getattr(b, "type", None) == "tool_use"]
        if getattr(message, "stop_reason", None) != "tool_use" or len(blocks) != 1 or blocks[0].name != kind:
            return Abstain(f"unexpected response shape: stop_reason={getattr(message, 'stop_reason', None)!r}")
        response = dict(blocks[0].input)
        self.calls.append(Call(kind, prompt, response))
        return response
