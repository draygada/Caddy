from __future__ import annotations

import sys
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.errors import DiagnosticError
from strafe_history.safety import validate_persistence_safety


class PersistenceSafetyTests(unittest.TestCase):
    def test_rejects_secrets_prompts_code_and_private_paths(self) -> None:
        fixtures = [
            {"api_key": "synthetic"},
            {"nested": {"prompt_body": "do a thing"}},
            {"payload": {"source_code": "print('x')"}},
            {"source_ref": "/Users/example/private/file.step"},
            {"uri": "file:///tmp/private"},
        ]
        for fixture in fixtures:
            with self.subTest(fixture=fixture):
                with self.assertRaises(DiagnosticError):
                    validate_persistence_safety(fixture)

    def test_allows_opaque_ids_and_public_or_synthetic_refs(self) -> None:
        validate_persistence_safety(
            {
                "record_id": "part:fixture",
                "source_ref": "synthetic:rfq-001",
                "public_uri": "https://example.invalid/public-fixture",
            }
        )


if __name__ == "__main__":
    unittest.main()
