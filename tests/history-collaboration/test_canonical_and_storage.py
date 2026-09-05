from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.canonical import canonical_text, digest_json, parse_json
from strafe_history.errors import DiagnosticError
from strafe_history.events import AppendOnlyEventLog
from strafe_history.storage import ImmutableObjectStore


class CanonicalJsonTests(unittest.TestCase):
    def test_rfc_8785_property_order_and_number_forms(self) -> None:
        value = {
            "numbers": [333333333.33333329, 1e30, 4.50, 2e-3, 1e-27, -0.0, 1e-6, 1e-7],
            "string": "€$\u000f\nA'B\"\\\"/",
            "literals": [None, True, False],
        }
        self.assertEqual(
            canonical_text(value),
            "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27,0,0.000001,1e-7],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\"/\"}",
        )

    def test_utf16_key_order_matches_jcs(self) -> None:
        # U+1F600 sorts before U+E000 as UTF-16 code units, unlike code-point order.
        value = {"\ue000": 1, "😀": 2}
        self.assertEqual(canonical_text(value), "{\"😀\":2,\"\ue000\":1}")

    def test_parse_rejects_duplicate_keys_and_noncanonical_persistence(self) -> None:
        with self.assertRaisesRegex(DiagnosticError, "JSON_DUPLICATE_KEY"):
            parse_json('{"a":1,"a":2}')
        with self.assertRaisesRegex(DiagnosticError, "JSON_NOT_CANONICAL"):
            parse_json('{"b":2, "a":1}', require_canonical=True)

    def test_digest_is_independent_of_mapping_insertion_order(self) -> None:
        self.assertEqual(digest_json({"b": 2, "a": 1}), digest_json({"a": 1, "b": 2}))


class ImmutableStorageTests(unittest.TestCase):
    def test_round_trip_is_content_addressed_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = ImmutableObjectStore(Path(directory))
            value = {"kind": "fixture", "items": [1, 2, 3]}
            digest = store.put("fixtures", value)
            self.assertEqual(store.put("fixtures", value), digest)
            self.assertEqual(store.get("fixtures", digest), value)
            self.assertTrue(store.contains("fixtures", digest))

    def test_tampered_object_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = ImmutableObjectStore(Path(directory))
            digest = store.put("fixtures", {"value": 1})
            store.path_for("fixtures", digest).write_text('{"value":2}', encoding="utf-8")
            with self.assertRaisesRegex(DiagnosticError, "HASH_MISMATCH"):
                store.get("fixtures", digest)

    def test_identifier_cannot_be_used_as_storage_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = ImmutableObjectStore(Path(directory))
            with self.assertRaisesRegex(DiagnosticError, "OBJECT_NAMESPACE_INVALID"):
                store.put("../escape", {"value": 1})


class AppendOnlyEventLogTests(unittest.TestCase):
    PROVENANCE = {"actor_id": "actor:test", "actor_kind": "HUMAN", "source_ref": "fixture:test"}

    def test_append_and_restart_preserve_chain(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "history.jsonl"
            log = AppendOnlyEventLog(path)
            first = log.append(
                "THING_CREATED",
                "THING",
                "thing:1",
                "2026-09-05T16:00:00Z",
                self.PROVENANCE,
                {"value": 1},
            )
            second = log.append(
                "THING_CHANGED",
                "THING",
                "thing:1",
                "2026-09-05T16:00:01Z",
                self.PROVENANCE,
                {"value": 2},
            )
            restarted = AppendOnlyEventLog(path).read_all()
            self.assertEqual([event.sequence for event in restarted], [0, 1])
            self.assertEqual(second.value["previous_event_hash"], first.event_hash)
            self.assertEqual(restarted[-1].event_hash, second.event_hash)

    def test_tampering_and_partial_tail_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "history.jsonl"
            log = AppendOnlyEventLog(path)
            log.append(
                "THING_CREATED",
                "THING",
                "thing:1",
                "2026-09-05T16:00:00Z",
                self.PROVENANCE,
                {"value": 1},
            )
            decoded = json.loads(path.read_text(encoding="utf-8"))
            decoded["payload"]["value"] = 2
            path.write_text(canonical_text(decoded) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(DiagnosticError, "HASH_MISMATCH"):
                log.read_all()

            path.write_text(path.read_text(encoding="utf-8").rstrip("\n"), encoding="utf-8")
            with self.assertRaisesRegex(DiagnosticError, "EVENT_LOG_TRUNCATED"):
                log.read_all()


if __name__ == "__main__":
    unittest.main()

