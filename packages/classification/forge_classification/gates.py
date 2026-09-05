"""The gate rail: eight stages, attributable state, never a boolean. `pass` is unreachable until a
criteria set exists; a human may waive a gate, and a waiver is recorded as a waiver, never as a pass."""

from __future__ import annotations

from dataclasses import dataclass, replace

STAGES = ("intake", "spec_section", "introduction", "candidate_surfacing", "per_candidate_analysis",
          "post_analysis_review", "consolidation", "decision")
STATUSES = ("hold", "fail", "waived")


@dataclass(frozen=True)
class GateState:
    stage: str
    status: str = "hold"
    actor_id: str | None = None
    reason: str | None = None
    at: str | None = None

    def __post_init__(self) -> None:
        if self.stage not in STAGES:
            raise ValueError(f"unknown gate stage {self.stage!r}")
        if self.status not in STATUSES:
            raise ValueError(f"gate status {self.status!r} is not reachable: no criteria set exists, so 'pass' cannot be recorded")


def waive(state: GateState, *, actor_id: str, reason: str, at: str) -> GateState:
    return replace(state, status="waived", actor_id=actor_id, reason=reason, at=at)


def fail(state: GateState, *, reason: str, at: str) -> GateState:
    return replace(state, status="fail", reason=reason, at=at)


def stale_after(stage: str) -> tuple[str, ...]:
    return STAGES[STAGES.index(stage) + 1:]
