from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.branches import EventSourcedBranches
from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog


PROVENANCE = {"actor_id": "actor:history", "actor_kind": "SERVICE", "source_ref": "fixture:history"}


class BranchHistoryTests(unittest.TestCase):
    def make_branches(self, directory: str) -> EventSourcedBranches:
        return EventSourcedBranches(AppendOnlyEventLog(Path(directory) / "events.jsonl"))

    def test_branch_head_is_derived_from_append_only_events(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            branches = self.make_branches(directory)
            branches.create("main", "rev:one", PROVENANCE, "2026-09-05T16:00:00Z")
            branches.start_apply(
                "apply:one",
                "main",
                "rev:one",
                "rev:two",
                PROVENANCE,
                "2026-09-05T16:00:01Z",
                proposal_id="proposal:one",
                authorization_id="authorization:one",
            )
            self.assertEqual(branches.head("main"), "rev:one")
            branches.complete_apply("apply:one", PROVENANCE, "2026-09-05T16:00:02Z")
            self.assertEqual(self.make_branches(directory).head("main"), "rev:two")

    def test_interrupted_apply_completes_after_candidate_revalidation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            branches = self.make_branches(directory)
            branches.create("main", "rev:one", PROVENANCE, "2026-09-05T16:00:00Z")
            branches.start_apply("apply:one", "main", "rev:one", "rev:two", PROVENANCE, "2026-09-05T16:00:01Z")

            restarted = self.make_branches(directory)
            recovered = restarted.recover(lambda revision_id: revision_id == "rev:two", PROVENANCE, "2026-09-05T16:00:02Z")
            self.assertEqual(len(recovered), 1)
            self.assertTrue(recovered[0].value["payload"]["recovered"])
            self.assertEqual(restarted.head("main"), "rev:two")

    def test_invalid_interrupted_candidate_is_durably_aborted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            branches = self.make_branches(directory)
            branches.create("main", "rev:one", PROVENANCE, "2026-09-05T16:00:00Z")
            branches.start_apply("apply:one", "main", "rev:one", "rev:bad", PROVENANCE, "2026-09-05T16:00:01Z")
            events = branches.recover(lambda _revision_id: False, PROVENANCE, "2026-09-05T16:00:02Z")
            self.assertEqual(events[0].value["event_type"], "REVISION_APPLY_ABORTED")
            self.assertEqual(events[0].value["payload"]["reason_code"], "CANDIDATE_INVALID")
            self.assertEqual(branches.head("main"), "rev:one")
            self.assertFalse(branches.project().pending_applies)

    def test_stale_apply_never_overwrites_head(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            branches = self.make_branches(directory)
            branches.create("main", "rev:one", PROVENANCE, "2026-09-05T16:00:00Z")
            with self.assertRaisesRegex(DiagnosticError, "STALE_BASE"):
                branches.start_apply("apply:one", "main", "rev:stale", "rev:two", PROVENANCE, "2026-09-05T16:00:01Z")
            self.assertEqual(branches.head("main"), "rev:one")

    def test_concurrent_applies_cannot_stage_two_candidates_for_one_branch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.make_branches(directory).create("main", "rev:one", PROVENANCE, "2026-09-05T16:00:00Z")
            barrier = threading.Barrier(2)

            def stage(index: int) -> str:
                barrier.wait()
                try:
                    self.make_branches(directory).start_apply(
                        "apply:{0}".format(index),
                        "main",
                        "rev:one",
                        "rev:{0}".format(index + 2),
                        PROVENANCE,
                        "2026-09-05T16:00:01Z",
                    )
                    return "STAGED"
                except DiagnosticError as exc:
                    return exc.code

            with ThreadPoolExecutor(max_workers=2) as executor:
                outcomes = list(executor.map(stage, range(2)))
            self.assertEqual(outcomes.count("STAGED"), 1)
            self.assertIn("APPLY_ALREADY_PENDING", outcomes)
            self.assertEqual(len(self.make_branches(directory).project().pending_applies), 1)


if __name__ == "__main__":
    unittest.main()
