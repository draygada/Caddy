from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.events import AppendOnlyEventLog
from strafe_history.reviews import ReviewLedger


HUMAN = {"actor_id": "actor:human", "actor_kind": "HUMAN", "display_name": "Synthetic Reviewer"}
AGENT = {
    "actor_id": "actor:agent",
    "actor_kind": "AGENT",
    "display_name": "Synthetic Review Agent",
    "execution_identity": "agent-run:review-fixture",
}


class ReviewLedgerTests(unittest.TestCase):
    def test_agent_approval_is_advisory_and_human_approval_is_binding(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = ReviewLedger(AppendOnlyEventLog(Path(directory) / "events.jsonl"))
            advisory = ledger.append(
                "proposal:one",
                "APPROVE",
                AGENT,
                "2026-09-05T16:00:00Z",
                "fixture:agent-review",
                "rev:base",
            )
            self.assertFalse(advisory.value["payload"]["binding_human_decision"])
            self.assertFalse(ledger.is_human_approved("proposal:one", "rev:base"))

            binding = ledger.append(
                "proposal:one",
                "APPROVE",
                HUMAN,
                "2026-09-05T16:00:01Z",
                "fixture:human-review",
                "rev:base",
            )
            self.assertTrue(binding.value["payload"]["binding_human_decision"])
            self.assertTrue(ledger.is_human_approved("proposal:one", "rev:base"))

    def test_review_is_revision_specific_and_later_human_decision_wins(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = ReviewLedger(AppendOnlyEventLog(Path(directory) / "events.jsonl"))
            ledger.append("proposal:one", "APPROVE", HUMAN, "2026-09-05T16:00:00Z", "fixture:approve", "rev:one")
            ledger.append("proposal:one", "REQUEST_CHANGES", HUMAN, "2026-09-05T16:00:01Z", "fixture:changes", "rev:one")
            self.assertFalse(ledger.is_human_approved("proposal:one", "rev:one"))
            self.assertIsNone(ledger.binding_decision("proposal:one", "rev:two"))


if __name__ == "__main__":
    unittest.main()
