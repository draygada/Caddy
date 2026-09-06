from __future__ import annotations

import itertools
import sys
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.merge_policy import ChangeFootprint, assess_merge


class MergePolicyTests(unittest.TestCase):
    def test_stale_but_disjoint_changes_require_and_accept_matching_replay(self) -> None:
        proposal = ChangeFootprint.of(
            reads={"parameter:param:width"},
            writes={"parameter:param:width"},
            impacts={"operation:op:left-feature"},
        )
        upstream = ChangeFootprint.of(
            reads={"parameter:param:height"},
            writes={"parameter:param:height"},
            impacts={"operation:op:right-feature"},
        )
        assessment = assess_merge("rev:base", "rev:head", proposal, upstream, replay_fingerprints=["fp:one", "fp:one"])
        self.assertTrue(assessment.allowed)
        self.assertTrue(assessment.requires_rebase)

    def test_same_parameter_blocks_as_write_write(self) -> None:
        proposal = ChangeFootprint.of(writes={"parameter:param:width"}, impacts={"operation:op:extrude"})
        upstream = ChangeFootprint.of(writes={"parameter:param:width"}, impacts={"operation:op:extrude"})
        assessment = assess_merge("rev:base", "rev:head", proposal, upstream, replay_fingerprints=["fp", "fp"])
        self.assertFalse(assessment.allowed)
        self.assertIn("WRITE_WRITE_CONFLICT", [conflict.code for conflict in assessment.conflicts])

    def test_disjoint_parameter_writes_with_shared_dependent_operation_block(self) -> None:
        proposal = ChangeFootprint.of(writes={"parameter:param:width"}, impacts={"operation:op:boolean"})
        upstream = ChangeFootprint.of(writes={"parameter:param:height"}, impacts={"operation:op:boolean"})
        assessment = assess_merge("rev:base", "rev:head", proposal, upstream, replay_fingerprints=["fp", "fp"])
        self.assertEqual([conflict.code for conflict in assessment.conflicts], ["NONCOMMUTATIVE_DEPENDENCY"])

    def test_read_write_precondition_and_replay_failures_are_explicit(self) -> None:
        proposal = ChangeFootprint.of(reads={"definition:part:A"}, writes={"component:instance:1"})
        upstream = ChangeFootprint.of(writes={"definition:part:A"})
        assessment = assess_merge(
            "assembly-rev:base",
            "assembly-rev:head",
            proposal,
            upstream,
            failed_preconditions=["definition-revision:part:A"],
            replay_fingerprints=["assembly-fp:one", "assembly-fp:two"],
        )
        self.assertEqual(
            [conflict.code for conflict in assessment.conflicts],
            ["PRECONDITION_FAILED", "READ_WRITE_CONFLICT", "REPLAY_DIVERGENCE"],
        )

    def test_missing_upstream_analysis_or_replay_fails_closed(self) -> None:
        assessment = assess_merge("rev:base", "rev:head", ChangeFootprint.of(writes={"x"}))
        self.assertEqual(
            [conflict.code for conflict in assessment.conflicts],
            ["STALE_BASE_UNANALYZED", "REPLAY_EVIDENCE_MISSING"],
        )

    def test_conflict_identity_is_independent_of_resource_input_order(self) -> None:
        identities = set()
        resources = ["operation:op:a", "operation:op:b", "operation:op:c"]
        for ordering in itertools.permutations(resources):
            proposal = ChangeFootprint.of(impacts=ordering)
            upstream = ChangeFootprint.of(impacts=reversed(ordering))
            assessment = assess_merge("rev:base", "rev:head", proposal, upstream, replay_fingerprints=["fp", "fp"])
            identities.add(assessment.conflicts[0].conflict_id)
        self.assertEqual(len(identities), 1)


if __name__ == "__main__":
    unittest.main()

