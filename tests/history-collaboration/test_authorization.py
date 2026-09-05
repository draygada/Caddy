from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.authorization import AuthorizationLedger
from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog


HUMAN = {"actor_id": "actor:reviewer", "actor_kind": "HUMAN", "display_name": "Synthetic Reviewer"}
AGENT = {
    "actor_id": "actor:agent",
    "actor_kind": "AGENT",
    "display_name": "Synthetic Design Agent",
    "execution_identity": "agent-run:fixture-001",
    "model_identity": "fixture-model",
}
SERVICE = {"actor_id": "actor:history-service", "actor_kind": "SERVICE", "display_name": "History Service"}
SUBJECT = {"kind": "PROPOSAL", "id": "proposal:fixture"}


class AuthorizationLedgerTests(unittest.TestCase):
    def make_ledger(self, directory: str) -> AuthorizationLedger:
        return AuthorizationLedger(AppendOnlyEventLog(Path(directory) / "events.jsonl"))

    def test_agent_can_request_but_cannot_authorize(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = self.make_ledger(directory)
            ledger.append("authorization:1", "REQUESTED", AGENT, "2026-09-05T16:00:00Z", "fixture:request", SUBJECT)
            with self.assertRaisesRegex(DiagnosticError, "HUMAN_AUTHORIZATION_REQUIRED"):
                ledger.append("authorization:1", "AUTHORIZED", AGENT, "2026-09-05T16:00:01Z", "fixture:agent", SUBJECT)
            ledger.append("authorization:1", "AUTHORIZED", HUMAN, "2026-09-05T16:00:02Z", "fixture:human", SUBJECT)
            self.assertEqual(ledger.state("authorization:1"), "AUTHORIZED")

    def test_every_state_is_a_distinct_append_only_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = self.make_ledger(directory)
            ledger.append("authorization:1", "REQUESTED", AGENT, "2026-09-05T16:00:00Z", "fixture:request", SUBJECT)
            ledger.append("authorization:1", "AUTHORIZED", HUMAN, "2026-09-05T16:00:01Z", "fixture:approval", SUBJECT)
            ledger.append("authorization:1", "APPLIED", SERVICE, "2026-09-05T16:00:02Z", "fixture:apply", SUBJECT)
            ledger.append(
                "authorization:1",
                "VERIFIED",
                SERVICE,
                "2026-09-05T16:00:03Z",
                "fixture:verify",
                SUBJECT,
                ["evidence:test:1"],
            )
            receipts = ledger.receipts("authorization:1")
            self.assertEqual([event.value["payload"]["state"] for event in receipts], ["REQUESTED", "AUTHORIZED", "APPLIED", "VERIFIED"])
            self.assertEqual([event.sequence for event in receipts], [0, 1, 2, 3])

            restarted = self.make_ledger(directory)
            self.assertEqual(restarted.state("authorization:1"), "VERIFIED")

    def test_rejection_and_invalid_transition_remain_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = self.make_ledger(directory)
            ledger.append("authorization:1", "REQUESTED", AGENT, "2026-09-05T16:00:00Z", "fixture:request", SUBJECT)
            ledger.append("authorization:1", "REJECTED", HUMAN, "2026-09-05T16:00:01Z", "fixture:reject", SUBJECT)
            with self.assertRaisesRegex(DiagnosticError, "AUTHORIZATION_TRANSITION_INVALID"):
                ledger.append("authorization:1", "APPLIED", SERVICE, "2026-09-05T16:00:02Z", "fixture:apply", SUBJECT)

    def test_concurrent_terminal_decisions_cannot_both_commit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_ledger(directory).append(
                "authorization:1",
                "REQUESTED",
                AGENT,
                "2026-09-05T16:00:00Z",
                "fixture:request",
                SUBJECT,
            )
            barrier = threading.Barrier(2)

            def decide(state: str) -> str:
                barrier.wait()
                try:
                    self.make_ledger(directory).append(
                        "authorization:1",
                        state,
                        HUMAN,
                        "2026-09-05T16:00:01Z",
                        "fixture:decision",
                        SUBJECT,
                    )
                    return state
                except DiagnosticError as exc:
                    return exc.code

            with ThreadPoolExecutor(max_workers=2) as executor:
                outcomes = list(executor.map(decide, ["AUTHORIZED", "REJECTED"]))
            receipts = self.make_ledger(directory).receipts("authorization:1")
            self.assertEqual(len(receipts), 2)
            self.assertEqual(sum(value in {"AUTHORIZED", "REJECTED"} for value in outcomes), 1)
            self.assertIn("AUTHORIZATION_TRANSITION_INVALID", outcomes)


if __name__ == "__main__":
    unittest.main()
