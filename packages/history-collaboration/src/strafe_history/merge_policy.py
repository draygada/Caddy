"""Schema-neutral merge policy over explicit semantic change footprints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, Iterable, List, Optional, Sequence

from .canonical import digest_json


@dataclass(frozen=True)
class ChangeFootprint:
    """Resources read, written, or transitively affected by a change set.

    Resource tokens are produced by a schema adapter.  The policy engine never
    infers commutativity from JSON paths or last-writer-wins behavior.
    """

    reads: FrozenSet[str]
    writes: FrozenSet[str]
    impacts: FrozenSet[str]

    @classmethod
    def of(
        cls,
        reads: Iterable[str] = (),
        writes: Iterable[str] = (),
        impacts: Iterable[str] = (),
    ) -> "ChangeFootprint":
        return cls(frozenset(reads), frozenset(writes), frozenset(impacts))


@dataclass(frozen=True)
class MergeConflict:
    conflict_id: str
    code: str
    resources: Sequence[str]
    evidence: Dict[str, Any]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "code": self.code,
            "resources": list(self.resources),
            "evidence": dict(self.evidence),
        }


@dataclass(frozen=True)
class MergeAssessment:
    allowed: bool
    conflicts: Sequence[MergeConflict]
    requires_rebase: bool


def _conflict(code: str, resources: Iterable[str], evidence: Dict[str, Any]) -> MergeConflict:
    ordered = sorted(set(resources))
    preimage = {"code": code, "resources": ordered, "evidence": evidence}
    return MergeConflict(
        conflict_id="conflict:" + digest_json(preimage),
        code=code,
        resources=tuple(ordered),
        evidence=dict(evidence),
    )


def assess_merge(
    base_revision_id: str,
    head_revision_id: str,
    proposal: ChangeFootprint,
    upstream: Optional[ChangeFootprint] = None,
    failed_preconditions: Iterable[str] = (),
    replay_fingerprints: Optional[Sequence[str]] = None,
) -> MergeAssessment:
    """Return a deterministic, fail-closed merge assessment.

    A stale proposal may proceed only when the adapter supplies an upstream
    footprint, direct and read/write sets are disjoint, dependency impacts are
    disjoint, every precondition holds, and at least two replay fingerprints
    agree.  This establishes mechanics; whether a fingerprint represents real
    geometry remains the kernel authority's responsibility.
    """

    conflicts: List[MergeConflict] = []
    failed = sorted(set(failed_preconditions))
    if failed:
        conflicts.append(
            _conflict(
                "PRECONDITION_FAILED",
                failed,
                {"base_revision_id": base_revision_id, "head_revision_id": head_revision_id},
            )
        )

    stale = base_revision_id != head_revision_id
    if stale and upstream is None:
        conflicts.append(
            _conflict(
                "STALE_BASE_UNANALYZED",
                [base_revision_id, head_revision_id],
                {"base_revision_id": base_revision_id, "head_revision_id": head_revision_id},
            )
        )
    if stale and upstream is not None:
        write_write = proposal.writes & upstream.writes
        if write_write:
            conflicts.append(
                _conflict(
                    "WRITE_WRITE_CONFLICT",
                    write_write,
                    {"base_revision_id": base_revision_id, "head_revision_id": head_revision_id},
                )
            )
        proposal_read_upstream_write = proposal.reads & upstream.writes
        upstream_read_proposal_write = upstream.reads & proposal.writes
        read_write = proposal_read_upstream_write | upstream_read_proposal_write
        if read_write:
            conflicts.append(
                _conflict(
                    "READ_WRITE_CONFLICT",
                    read_write,
                    {"base_revision_id": base_revision_id, "head_revision_id": head_revision_id},
                )
            )
        shared_impacts = proposal.impacts & upstream.impacts
        if shared_impacts:
            conflicts.append(
                _conflict(
                    "NONCOMMUTATIVE_DEPENDENCY",
                    shared_impacts,
                    {"base_revision_id": base_revision_id, "head_revision_id": head_revision_id},
                )
            )

    fingerprints = list(replay_fingerprints or [])
    if len(fingerprints) < 2:
        conflicts.append(
            _conflict(
                "REPLAY_EVIDENCE_MISSING",
                [],
                {"observations": len(fingerprints)},
            )
        )
    elif len(set(fingerprints)) != 1:
        conflicts.append(
            _conflict(
                "REPLAY_DIVERGENCE",
                [],
                {"fingerprints": fingerprints},
            )
        )

    return MergeAssessment(allowed=not conflicts, conflicts=tuple(conflicts), requires_rebase=stale)

