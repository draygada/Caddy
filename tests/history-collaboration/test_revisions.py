from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog
from strafe_history.revisions import RevisionSnapshotStore
from strafe_history.storage import ImmutableObjectStore


PROVENANCE = {"actor_id": "actor:history", "actor_kind": "SERVICE", "source_ref": "fixture:revision"}


class RevisionSnapshotTests(unittest.TestCase):
    def make_store(self, directory: str) -> RevisionSnapshotStore:
        root = Path(directory)
        return RevisionSnapshotStore(ImmutableObjectStore(root / "objects"), AppendOnlyEventLog(root / "events.jsonl"))

    def test_snapshot_graph_round_trips_across_restart(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = self.make_store(directory)
            first = {"schema_version": "fixture/1", "record_id": "part:one", "value": "1"}
            second = {"schema_version": "fixture/1", "record_id": "part:one", "value": "2"}
            store.persist("rev:one", "FIXTURE", first, [], PROVENANCE, "2026-09-05T16:00:00Z")
            store.persist("rev:two", "FIXTURE", second, ["rev:one"], PROVENANCE, "2026-09-05T16:00:01Z")
            restarted = self.make_store(directory)
            self.assertEqual(restarted.load("rev:two"), second)
            self.assertEqual(restarted.ancestors("rev:two"), {"rev:one"})

    def test_same_revision_is_idempotent_but_different_content_is_forbidden(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = self.make_store(directory)
            value = {"record_id": "part:one", "value": "1"}
            first = store.persist("rev:one", "FIXTURE", value, [], PROVENANCE, "2026-09-05T16:00:00Z")
            repeated = store.persist("rev:one", "FIXTURE", value, [], PROVENANCE, "2026-09-05T16:00:01Z")
            self.assertEqual(first, repeated)
            with self.assertRaisesRegex(DiagnosticError, "REVISION_IMMUTABILITY_VIOLATION"):
                store.persist("rev:one", "FIXTURE", {"record_id": "part:one", "value": "changed"}, [], PROVENANCE, "2026-09-05T16:00:02Z")
            object_files = list((Path(directory) / "objects" / "revisions").glob("*/*.json"))
            self.assertEqual(len(object_files), 1)

    def test_missing_parent_fails_before_storage_event(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = self.make_store(directory)
            with self.assertRaisesRegex(DiagnosticError, "PARENT_REVISION_MISSING"):
                store.persist("rev:two", "FIXTURE", {"value": "2"}, ["rev:missing"], PROVENANCE, "2026-09-05T16:00:00Z")
            self.assertFalse(store.pointers())

    def test_release_binds_one_existing_revision_and_survives_restart(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = self.make_store(directory)
            store.persist("rev:one", "FIXTURE", {"value": "1"}, [], PROVENANCE, "2026-09-05T16:00:00Z")
            store.persist("rev:two", "FIXTURE", {"value": "2"}, ["rev:one"], PROVENANCE, "2026-09-05T16:00:01Z")
            store.mark_released("rev:one", "release:one", PROVENANCE, "2026-09-05T16:00:02Z", ["evidence:fixture"])
            restarted = self.make_store(directory)
            self.assertEqual(restarted.releases("rev:one")[0].value["payload"]["release_id"], "release:one")
            with self.assertRaisesRegex(DiagnosticError, "RELEASE_IMMUTABILITY_VIOLATION"):
                restarted.mark_released("rev:two", "release:one", PROVENANCE, "2026-09-05T16:00:03Z", ["evidence:fixture"])


if __name__ == "__main__":
    unittest.main()
