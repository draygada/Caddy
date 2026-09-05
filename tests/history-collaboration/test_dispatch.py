from __future__ import annotations

import copy
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.dispatch import EFFECT_WRITTEN, SimulatedDispatchInterruption, SyntheticDispatchJournal
from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog


HUMAN = {"actor_id": "actor:human", "actor_kind": "HUMAN", "display_name": "Synthetic Approver"}
AGENT = {
    "actor_id": "actor:agent",
    "actor_kind": "AGENT",
    "display_name": "Synthetic Agent",
    "execution_identity": "agent-run:dispatch-fixture",
}
SERVICE = {"actor_id": "actor:adapter", "actor_kind": "ADAPTER", "display_name": "Local Adapter"}
REQUEST = {
    "idempotency_key": "synthetic:order:001:v1",
    "command_hash": "a" * 64,
    "packet_ref": "order-rev:fixture",
    "recipient_id": "synthetic:supplier-001",
    "external": False,
    "authorization_id": "authorization:dispatch-001",
    "authorization_state": "AUTHORIZED",
    "authorizer": HUMAN,
}


class SyntheticDispatchTests(unittest.TestCase):
    def make_adapter(self, directory: str) -> SyntheticDispatchJournal:
        return SyntheticDispatchJournal(AppendOnlyEventLog(Path(directory) / "dispatch.jsonl"))

    def effect_count(self, adapter: SyntheticDispatchJournal) -> int:
        return sum(1 for event in adapter.log.read_all() if event.value["event_type"] == EFFECT_WRITTEN)

    def test_duplicate_and_lost_response_return_same_single_effect(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            adapter = self.make_adapter(directory)
            with self.assertRaisesRegex(SimulatedDispatchInterruption, "LOST_RESPONSE_AFTER_EFFECT"):
                adapter.dispatch(REQUEST, SERVICE, "2026-09-05T16:00:00Z", fault="LOST_RESPONSE_AFTER_EFFECT")
            retried = self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:01Z")
            duplicate = self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:02Z")
            self.assertTrue(retried.duplicate)
            self.assertEqual(retried.effect_id, duplicate.effect_id)
            self.assertEqual(self.effect_count(adapter), 1)

    def test_crash_before_effect_can_retry_without_duplication(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            adapter = self.make_adapter(directory)
            with self.assertRaisesRegex(SimulatedDispatchInterruption, "CRASH_BEFORE_EFFECT"):
                adapter.dispatch(REQUEST, SERVICE, "2026-09-05T16:00:00Z", fault="CRASH_BEFORE_EFFECT")
            outcome = self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:01Z")
            self.assertFalse(outcome.duplicate)
            self.assertEqual(outcome.attempt_count, 2)
            self.assertEqual(self.effect_count(adapter), 1)

    def test_timeout_requires_reconciliation_before_retry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            adapter = self.make_adapter(directory)
            with self.assertRaisesRegex(SimulatedDispatchInterruption, "TIMEOUT_BEFORE_EFFECT"):
                adapter.dispatch(REQUEST, SERVICE, "2026-09-05T16:00:00Z", fault="TIMEOUT_BEFORE_EFFECT")
            with self.assertRaisesRegex(DiagnosticError, "DISPATCH_RECONCILIATION_REQUIRED"):
                self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:01Z")
            receipt = self.make_adapter(directory).reconcile(REQUEST["idempotency_key"], SERVICE, "2026-09-05T16:00:02Z")
            self.assertFalse(receipt.value["payload"]["effect_observed"])
            outcome = self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:03Z")
            self.assertFalse(outcome.duplicate)
            self.assertEqual(self.effect_count(adapter), 1)

    def test_exception_after_effect_reconciles_to_original_effect(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            adapter = self.make_adapter(directory)
            with self.assertRaisesRegex(SimulatedDispatchInterruption, "EXCEPTION_AFTER_EFFECT"):
                adapter.dispatch(REQUEST, SERVICE, "2026-09-05T16:00:00Z", fault="EXCEPTION_AFTER_EFFECT")
            replayed = self.make_adapter(directory).dispatch(REQUEST, SERVICE, "2026-09-05T16:00:01Z")
            self.assertTrue(replayed.duplicate)
            self.assertEqual(self.effect_count(adapter), 1)

    def test_idempotency_conflict_external_recipient_and_agent_authorizer_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            adapter = self.make_adapter(directory)
            adapter.dispatch(REQUEST, SERVICE, "2026-09-05T16:00:00Z")
            changed = copy.deepcopy(REQUEST)
            changed["command_hash"] = "b" * 64
            with self.assertRaisesRegex(DiagnosticError, "IDEMPOTENCY_CONFLICT"):
                adapter.dispatch(changed, SERVICE, "2026-09-05T16:00:01Z")

        invalid_cases = [
            {"external": True},
            {"recipient_id": "real:supplier"},
            {"authorizer": AGENT},
            {"authorization_state": "REQUESTED"},
        ]
        for override in invalid_cases:
            with self.subTest(override=override), tempfile.TemporaryDirectory() as directory:
                request = copy.deepcopy(REQUEST)
                request.update(override)
                with self.assertRaises(DiagnosticError):
                    self.make_adapter(directory).dispatch(request, SERVICE, "2026-09-05T16:00:00Z")


if __name__ == "__main__":
    unittest.main()
