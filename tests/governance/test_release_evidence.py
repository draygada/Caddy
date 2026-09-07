#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "tools" / "generate_candidate_integration_release_receipt.py"
HYGIENE = ROOT / "tools" / "check_release_diff_hygiene.py"
SCHEMA = ROOT / "governance" / "schemas" / "candidate-integration-release-receipt.v1.schema.json"
TEMPLATE = ROOT / "governance" / "templates" / "candidate-integration-release-receipt.v1.template.json"


def run(*args: str, cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, check=check, capture_output=True, text=True)


def git(repo: Path, *args: str) -> str:
    return run("git", *args, cwd=repo).stdout.strip()


def write(path: Path, content: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class FixtureRepo:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        run("git", "init", "-b", "integration", cwd=self.root)
        git(self.root, "config", "user.name", "Release Evidence Test")
        git(self.root, "config", "user.email", "release-evidence@example.invalid")

        write(self.root / "legacy.txt", "source-owned trailing whitespace  \n")
        git(self.root, "add", "legacy.txt")
        git(self.root, "commit", "-m", "Create Tripwire source object")
        self.source = git(self.root, "rev-parse", "HEAD")
        self.source_tree = git(self.root, "rev-parse", "HEAD^{tree}")
        source_content = run("git", "cat-file", "commit", self.source, cwd=self.root).stdout.encode()
        tree_content = subprocess.run(
            ["git", "cat-file", "tree", self.source_tree],
            cwd=self.root,
            check=True,
            capture_output=True,
        ).stdout

        (self.root / "features" / "tripwire").mkdir(parents=True)
        git(self.root, "mv", "legacy.txt", "features/tripwire/legacy.txt")
        manifest = {
            "schema_version": "caddydaddy.import-provenance/1",
            "source": {
                "commit": {"oid": self.source, "content_sha256": sha256(source_content)},
                "root_tree": {"oid": self.source_tree, "content_sha256": sha256(tree_content)},
            },
            "import": {
                "commit": self.source,
                "prefix": "features/tripwire",
                "prefix_tree": self.source_tree,
            },
        }
        write(
            self.root / "docs" / "imports" / "tripwire-898f6167.json",
            json.dumps(manifest, indent=2) + "\n",
        )
        write(self.root / "governance" / "owned.txt", "base\n")
        write(self.root / ".gitignore", ".release-evidence/\n")
        git(self.root, "add", ".")
        git(self.root, "commit", "-m", "Record exact imported Tripwire tree")
        self.base = git(self.root, "rev-parse", "HEAD")

    def commit_owned(self, content: str) -> str:
        write(self.root / "governance" / "owned.txt", content)
        git(self.root, "add", "governance/owned.txt")
        git(self.root, "commit", "-m", "Update owned governance")
        return git(self.root, "rev-parse", "HEAD")

    def commit_unified_tripwire_delta(self) -> str:
        git(self.root, "switch", "-c", "external-tripwire", self.source)
        write(self.root / "external-source.txt", "external delta\n")
        git(self.root, "add", "external-source.txt")
        git(self.root, "commit", "-m", "Create external Tripwire delta")
        source_head = git(self.root, "rev-parse", "HEAD")

        git(self.root, "switch", "integration")
        write(self.root / "features" / "tripwire" / "delta.txt", "imported delta\n")
        git(self.root, "add", "features/tripwire/delta.txt")
        git(self.root, "commit", "-m", "Import Tripwire delta under prefix")
        content_commit = git(self.root, "rev-parse", "HEAD")
        current_prefix_tree = git(self.root, "rev-parse", "HEAD:features/tripwire")
        git(self.root, "merge", "--no-ff", "-s", "ours", "external-tripwire", "-m", "Preserve source ancestry")
        ancestry_merge = git(self.root, "rev-parse", "HEAD")

        unified = {
            "schema_version": "caddydaddy.import-provenance/2",
            "base_manifest": "docs/imports/tripwire-898f6167.json",
            "prefix": "features/tripwire",
            "original_import": {
                "source_commit": self.source,
                "source_tree": self.source_tree,
                "import_commit": self.source,
            },
            "current_prefix_tree": current_prefix_tree,
            "applied_deltas": [
                {
                    "source_head": source_head,
                    "commit": content_commit,
                }
            ],
            "ancestry_merges": [
                {
                    "source_head": source_head,
                    "merge_commit": ancestry_merge,
                }
            ],
        }
        write(
            self.root / "docs" / "imports" / "tripwire-unified-20260905.json",
            json.dumps(unified, indent=2) + "\n",
        )
        git(self.root, "add", "docs/imports/tripwire-unified-20260905.json")
        git(self.root, "commit", "-m", "Receipt unified Tripwire import")
        return git(self.root, "rev-parse", "HEAD")

    def close(self) -> None:
        self.temporary.cleanup()


class ReleaseEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = FixtureRepo()

    def tearDown(self) -> None:
        self.fixture.close()

    def generator_command(self, candidate: str, output: Path) -> list[str]:
        manifest = self.fixture.root / "bundle-manifest.json"
        archive = self.fixture.root / "bundle.tar.gz"
        write(manifest, '{"sanitized":true}\n')
        write(archive, b"sanitized archive fixture\n")
        return [
            sys.executable,
            str(GENERATOR),
            "--repo",
            str(self.fixture.root),
            "--branch",
            "integration",
            "--candidate",
            candidate,
            "--authorization-quote",
            "Generate local evidence only.",
            "--authorization-scope",
            "Exact candidate receipt generation; no deployment or spend.",
            "--bundle-manifest",
            str(manifest),
            "--bundle-archive",
            str(archive),
            "--target-project",
            "fixture-project",
            "--target-alias",
            "fixture-alias",
            "--claim-ceiling",
            "Synthetic local evidence only.",
            "--check",
            "release-diff-hygiene=test:release-diff-hygiene",
            "--rollback",
            "Invalidate this receipt and restore the previous immutable candidate.",
            "--exclusion",
            "No provider mutation.",
            "--generated-at",
            "2026-09-05T21:00:00Z",
            "--output",
            str(output),
        ]

    def test_receipt_is_complete_schema_valid_and_exactly_candidate_bound(self) -> None:
        candidate = self.fixture.commit_owned("candidate\n")
        output = self.fixture.root / ".release-evidence" / "receipt.json"
        completed = run(*self.generator_command(candidate, output), cwd=self.fixture.root)
        self.assertIn("RECEIPT_GENERATION_PASS", completed.stdout)

        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        template = json.loads(TEMPLATE.read_text(encoding="utf-8"))
        receipt = json.loads(output.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(receipt)
        self.assertEqual(set(receipt), set(schema["required"]))
        self.assertEqual(list(receipt), list(template))
        self.assertEqual(receipt["candidate"]["full_hash"], candidate)
        self.assertEqual(receipt["candidate"]["tree_hash"], git(self.fixture.root, "rev-parse", "HEAD^{tree}"))
        self.assertEqual(receipt["tripwire_import"]["candidate_prefix_tree"], self.fixture.source_tree)
        self.assertEqual(receipt["tripwire_import"]["byte_identity"], "PROVEN")
        self.assertEqual(receipt["boundaries"]["spend_authority"], "NOT_GRANTED")
        self.assertEqual(receipt["target"]["mutation_effect"], "NONE")
        self.assertEqual(Path(git(self.fixture.root, "check-ignore", output)).resolve(), output.resolve())

        preimage = copy.deepcopy(receipt)
        preimage.pop("receipt_id")
        preimage.pop("receipt_hash")
        digest = sha256(
            json.dumps(preimage, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode()
        )
        self.assertEqual(receipt["receipt_hash"], digest)
        self.assertEqual(receipt["receipt_id"], "candidate-integration-release-receipt:" + digest)

        incomplete = copy.deepcopy(receipt)
        incomplete.pop("authorization")
        with self.assertRaises(Exception):
            Draft202012Validator(schema).validate(incomplete)

    def test_generator_rejects_symbolic_candidate_and_branch_mismatch(self) -> None:
        candidate = self.fixture.commit_owned("candidate\n")
        output = self.fixture.root / ".release-evidence" / "receipt.json"
        symbolic = self.generator_command("HEAD", output)
        completed = run(*symbolic, cwd=self.fixture.root, check=False)
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("full sha1 object id", completed.stderr)

        wrong_branch = self.generator_command(candidate, output)
        wrong_branch[wrong_branch.index("integration")] = "not-the-candidate-branch"
        completed = run(*wrong_branch, cwd=self.fixture.root, check=False)
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("refs/heads/not-the-candidate-branch", completed.stderr)

    def test_generator_accepts_receipted_prefixed_deltas_and_source_ancestry(self) -> None:
        candidate = self.fixture.commit_unified_tripwire_delta()
        output = self.fixture.root / ".release-evidence" / "receipt.json"
        completed = run(*self.generator_command(candidate, output), cwd=self.fixture.root)
        self.assertIn("RECEIPT_GENERATION_PASS", completed.stdout)

        receipt = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(
            receipt["tripwire_import"]["provenance_manifest_path"],
            "docs/imports/tripwire-unified-20260905.json",
        )
        self.assertEqual(
            receipt["tripwire_import"]["candidate_prefix_tree"],
            git(self.fixture.root, "rev-parse", "HEAD:features/tripwire"),
        )

    def test_hygiene_accepts_clean_authored_diff_and_preserved_source_whitespace(self) -> None:
        candidate = self.fixture.commit_owned("candidate\n")
        completed = run(
            sys.executable,
            str(HYGIENE),
            "--repo",
            str(self.fixture.root),
            "--base",
            self.fixture.base,
            "--candidate",
            candidate,
            cwd=self.fixture.root,
        )
        self.assertIn("AUTHORED_DIFF_HYGIENE_PASS", completed.stdout)
        self.assertIn("TRIPWIRE_PROVENANCE_PASS", completed.stdout)
        self.assertEqual(
            (self.fixture.root / "features" / "tripwire" / "legacy.txt").read_text(encoding="utf-8"),
            "source-owned trailing whitespace  \n",
        )

    def test_hygiene_accepts_receipted_prefixed_deltas_and_source_ancestry(self) -> None:
        candidate = self.fixture.commit_unified_tripwire_delta()
        completed = run(
            sys.executable,
            str(HYGIENE),
            "--repo",
            str(self.fixture.root),
            "--base",
            self.fixture.base,
            "--candidate",
            candidate,
            cwd=self.fixture.root,
        )
        self.assertIn("AUTHORED_DIFF_HYGIENE_PASS", completed.stdout)
        self.assertIn("TRIPWIRE_PROVENANCE_PASS", completed.stdout)

    def test_hygiene_rejects_authored_whitespace(self) -> None:
        candidate = self.fixture.commit_owned("authored trailing whitespace  \n")
        completed = run(
            sys.executable,
            str(HYGIENE),
            "--repo",
            str(self.fixture.root),
            "--base",
            self.fixture.base,
            "--candidate",
            candidate,
            cwd=self.fixture.root,
            check=False,
        )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("authored diff whitespace", completed.stderr)
        self.assertIn("trailing whitespace", completed.stderr)

    def test_hygiene_rejects_imported_tree_drift(self) -> None:
        write(self.fixture.root / "features" / "tripwire" / "legacy.txt", "adapted source\n")
        git(self.fixture.root, "add", "features/tripwire/legacy.txt")
        git(self.fixture.root, "commit", "-m", "Illegally adapt imported source")
        candidate = git(self.fixture.root, "rev-parse", "HEAD")
        completed = run(
            sys.executable,
            str(HYGIENE),
            "--repo",
            str(self.fixture.root),
            "--base",
            self.fixture.base,
            "--candidate",
            candidate,
            cwd=self.fixture.root,
            check=False,
        )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("TRIPWIRE_TREE_DRIFT", completed.stderr)


if __name__ == "__main__":
    unittest.main()
