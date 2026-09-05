from __future__ import annotations

import sys
import tempfile
import threading
import unittest
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog
from strafe_history.idempotency import IdempotencyLedger


PROVENANCE = {"actor_id": "actor:service", "actor_kind": "SERVICE", "source_ref": "fixture:command"}


def _claim_in_process(path: str, gate, results) -> None:
    gate.wait()
    try:
        event = IdempotencyLedger(AppendOnlyEventLog(Path(path))).claim(
            "history",
            "fixture:key",
            "command:one",
            "a" * 64,
            PROVENANCE,
            "2026-09-05T16:00:00Z",
        )
        results.put(("OK", event.event_id))
    except Exception as exc:  # pragma: no cover - returned to the parent for assertion.
        results.put(("ERROR", str(exc)))


class IdempotencyLedgerTests(unittest.TestCase):
    def test_identical_claim_returns_original_event_without_append(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            log = AppendOnlyEventLog(Path(directory) / "events.jsonl")
            ledger = IdempotencyLedger(log)
            first = ledger.claim("history", "fixture:key", "command:one", "a" * 64, PROVENANCE, "2026-09-05T16:00:00Z")
            repeated = ledger.claim("history", "fixture:key", "command:one", "a" * 64, PROVENANCE, "2026-09-05T16:00:01Z")
            self.assertEqual(first.event_id, repeated.event_id)
            self.assertEqual(len(log.read_all()), 1)

    def test_same_key_with_different_command_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            ledger = IdempotencyLedger(AppendOnlyEventLog(Path(directory) / "events.jsonl"))
            ledger.claim("history", "fixture:key", "command:one", "a" * 64, PROVENANCE, "2026-09-05T16:00:00Z")
            with self.assertRaisesRegex(DiagnosticError, "IDEMPOTENCY_CONFLICT"):
                ledger.claim("history", "fixture:key", "command:two", "b" * 64, PROVENANCE, "2026-09-05T16:00:01Z")

    def test_concurrent_identical_claims_commit_exactly_one_event(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            barrier = threading.Barrier(16)

            def claim(_: int) -> str:
                barrier.wait()
                return IdempotencyLedger(AppendOnlyEventLog(path)).claim(
                    "history",
                    "fixture:key",
                    "command:one",
                    "a" * 64,
                    PROVENANCE,
                    "2026-09-05T16:00:00Z",
                ).event_id

            with ThreadPoolExecutor(max_workers=16) as executor:
                event_ids = list(executor.map(claim, range(16)))
            self.assertEqual(len(set(event_ids)), 1)
            self.assertEqual(len(AppendOnlyEventLog(path).read_all()), 1)

    def test_separate_processes_commit_exactly_one_claim(self) -> None:
        if "fork" not in multiprocessing.get_all_start_methods():
            self.skipTest("POSIX fork is required by the local event-store contract")
        context = multiprocessing.get_context("fork")
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "events.jsonl")
            gate = context.Event()
            results = context.Queue()
            processes = [
                context.Process(target=_claim_in_process, args=(path, gate, results))
                for _ in range(12)
            ]
            for process in processes:
                process.start()
            gate.set()
            for process in processes:
                process.join(10)
            outcomes = [results.get(timeout=2) for _ in processes]
            self.assertEqual([process.exitcode for process in processes], [0] * 12)
            self.assertFalse([outcome for outcome in outcomes if outcome[0] == "ERROR"])
            self.assertEqual(len({outcome[1] for outcome in outcomes}), 1)
            self.assertEqual(len(AppendOnlyEventLog(Path(path)).read_all()), 1)


if __name__ == "__main__":
    unittest.main()
