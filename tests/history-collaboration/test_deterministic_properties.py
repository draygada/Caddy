from __future__ import annotations

import itertools
import random
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.canonical import digest_json
from strafe_history.events import AppendOnlyEventLog


PROVENANCE = {"actor_id": "actor:property", "actor_kind": "SERVICE", "source_ref": "fixture:property"}


class DeterministicPropertyTests(unittest.TestCase):
    def test_all_mapping_insertion_orders_share_one_digest(self) -> None:
        entries = [("z", 1), ("a", 2), ("😀", 3), ("\ue000", 4), ("nested", {"b": 2, "a": 1})]
        digests = {digest_json(dict(order)) for order in itertools.permutations(entries)}
        self.assertEqual(len(digests), 1)

    def test_seeded_event_sequences_replay_exactly_across_restarts(self) -> None:
        generator = random.Random(20260905)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            expected_hashes = []
            for sequence in range(64):
                # Reopen for every append to exercise restart-based sequence and
                # predecessor reconstruction rather than an in-memory shortcut.
                log = AppendOnlyEventLog(path)
                event = log.append(
                    "PROPERTY_EVENT",
                    "PROPERTY",
                    "property:{0:03d}".format(sequence % 7),
                    "2026-09-05T16:{0:02d}:{1:02d}Z".format(sequence // 60, sequence % 60),
                    PROVENANCE,
                    {"sample": generator.randrange(0, 1_000_000), "ordinal": sequence},
                )
                expected_hashes.append(event.event_hash)

            first_replay = [event.event_hash for event in AppendOnlyEventLog(path).read_all()]
            second_replay = [event.event_hash for event in AppendOnlyEventLog(path).read_all()]
            self.assertEqual(first_replay, expected_hashes)
            self.assertEqual(second_replay, expected_hashes)
            self.assertEqual(len(set(expected_hashes)), 64)


if __name__ == "__main__":
    unittest.main()
