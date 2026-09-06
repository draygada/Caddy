from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.canonical import digest_json
from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog
from strafe_history.metadata import MetadataStream


PROVENANCE = {"actor_id": "actor:reviewer", "actor_kind": "HUMAN", "source_ref": "fixture:presence"}


class MetadataStreamTests(unittest.TestCase):
    def test_presence_is_separate_and_does_not_change_model_hash(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            model = {"document_id": "part:fixture", "parameters": {"param:x": {"literal": "1"}}}
            before = digest_json(model)
            stream = MetadataStream(AppendOnlyEventLog(Path(directory) / "presence.jsonl"))
            event = stream.append(
                "PRESENCE_UPDATED",
                "part:fixture",
                "rev:one",
                PROVENANCE,
                "2026-09-05T16:00:00Z",
                {"selected_semantic_id": "ref:edge-top", "cursor": {"x": "10", "y": "20"}},
            )
            self.assertFalse(event.value["payload"]["authoritative"])
            self.assertEqual(before, digest_json(model))
            self.assertEqual(stream.latest_presence()["actor:reviewer"]["revision_id"], "rev:one")

    def test_metadata_rejects_authoritative_geometry_fields(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            stream = MetadataStream(AppendOnlyEventLog(Path(directory) / "presence.jsonl"))
            with self.assertRaisesRegex(DiagnosticError, "METADATA_AUTHORITY_VIOLATION"):
                stream.append(
                    "COMMENT_ADDED",
                    "part:fixture",
                    "rev:one",
                    PROVENANCE,
                    "2026-09-05T16:00:00Z",
                    {"operations": []},
                )


if __name__ == "__main__":
    unittest.main()

