#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs" / "imports" / "tripwire-898f6167.json"
BASE = "92241b9ca7c9df37cc48e55b4ea388cb21686bb4"
SOURCE = "898f6167e4305a4f86f3ebe4a473278ffbd56530"
SOURCE_TREE = "b8f32adddb0c9a894a41d15ead89b4cb1db91aed"
IMPORT = "7a41388ffb49786495efd46b5821d402912c36da"
PREFIX = "features/tripwire"


def git_bytes(*args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def git_text(*args: str) -> str:
    return git_bytes(*args).decode("utf-8").strip()


def blobs() -> list[dict[str, object]]:
    result = []
    for record in git_bytes("ls-tree", "-rz", "--full-tree", SOURCE).split(b"\0"):
        if not record:
            continue
        metadata, path = record.split(b"\t", 1)
        mode, object_type, oid = metadata.decode("ascii").split(" ")
        if object_type != "blob":
            raise AssertionError("non-blob leaf in Tripwire source")
        content = git_bytes("cat-file", "blob", oid)
        result.append({
            "path": path.decode("utf-8"),
            "mode": mode,
            "git_blob_oid": oid,
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        })
    return result


class ProvenanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_unsquashed_exact_ancestry_and_prefix_tree(self) -> None:
        self.assertEqual(git_text("rev-parse", IMPORT + "^1"), BASE)
        self.assertEqual(git_text("rev-parse", IMPORT + "^2"), SOURCE)
        self.assertEqual(git_text("rev-parse", IMPORT + ":" + PREFIX), SOURCE_TREE)
        self.assertEqual(git_text("rev-parse", "HEAD:" + PREFIX), SOURCE_TREE)
        for ancestor in (BASE, SOURCE, IMPORT):
            completed = subprocess.run(
                ["git", "-C", str(ROOT), "merge-base", "--is-ancestor", ancestor, "HEAD"],
                check=False,
            )
            self.assertEqual(completed.returncode, 0)

    def test_manifest_has_every_full_blob_identity(self) -> None:
        expected = blobs()
        self.assertEqual(self.manifest["source"]["blobs"], expected)
        self.assertEqual(self.manifest["source"]["blob_count"], len(expected))
        self.assertEqual(self.manifest["source"]["total_blob_bytes"], sum(item["bytes"] for item in expected))
        self.assertTrue(all(len(item["sha256"]) == 64 for item in expected))

    def test_source_commit_tree_and_original_manifest_are_exact(self) -> None:
        self.assertEqual(self.manifest["source"]["commit"]["oid"], SOURCE)
        self.assertEqual(self.manifest["source"]["root_tree"]["oid"], SOURCE_TREE)
        for name, object_type, oid in (
            ("commit", "commit", SOURCE),
            ("root_tree", "tree", SOURCE_TREE),
        ):
            content = git_bytes("cat-file", object_type, oid)
            self.assertEqual(self.manifest["source"][name]["bytes"], len(content))
            self.assertEqual(self.manifest["source"][name]["content_sha256"], hashlib.sha256(content).hexdigest())

        record = self.manifest["original_truncated_manifest"]
        source = git_bytes("show", SOURCE + ":" + record["source_path"])
        imported = (ROOT / record["imported_path"]).read_bytes()
        self.assertEqual(imported, source)
        self.assertEqual(record["preservation"], "BYTE_IDENTICAL_UNCHANGED")
        self.assertEqual(record["sha256"], hashlib.sha256(source).hexdigest())
        self.assertEqual(record["git_blob_oid"], git_text("rev-parse", SOURCE + ":" + record["source_path"]))

    def test_import_prefix_has_no_adaptation(self) -> None:
        completed = subprocess.run(
            ["git", "-C", str(ROOT), "diff", "--quiet", IMPORT, "--", PREFIX],
            check=False,
        )
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(git_text("ls-files", "--others", "--exclude-standard", "--", PREFIX), "")
        self.assertEqual(self.manifest["import"]["method"], "git-subtree-unsquashed")
        self.assertEqual(self.manifest["import"]["commit"], IMPORT)
        self.assertEqual(self.manifest["import"]["prefix_tree"], SOURCE_TREE)


if __name__ == "__main__":
    unittest.main()
