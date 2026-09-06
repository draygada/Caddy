from __future__ import annotations

import sys
import unittest
from pathlib import Path


PACKAGE_SRC = Path(__file__).resolve().parents[2] / "packages" / "history-collaboration" / "src"
sys.path.insert(0, str(PACKAGE_SRC))

from strafe_history.errors import DiagnosticError
from strafe_history.graph import validate_hierarchy, validate_ordered_dag


class OrderedGraphTests(unittest.TestCase):
    def test_impact_contains_changed_nodes_and_transitive_dependents(self) -> None:
        nodes = [
            {"id": "a", "deps": []},
            {"id": "b", "deps": ["a"]},
            {"id": "c", "deps": ["b"]},
            {"id": "d", "deps": ["a"]},
        ]
        graph = validate_ordered_dag(nodes, lambda node: node["id"], lambda node: node["deps"])
        self.assertEqual(graph.impact(["b"]), {"b", "c"})
        self.assertEqual(graph.impact(["a"]), {"a", "b", "c", "d"})

    def test_duplicate_missing_forward_and_cycle_fail_closed(self) -> None:
        cases = [
            ([{"id": "a", "deps": []}, {"id": "a", "deps": []}], "DUPLICATE_ID"),
            ([{"id": "a", "deps": ["missing"]}], "DEPENDENCY_MISSING"),
            ([{"id": "a", "deps": ["b"]}, {"id": "b", "deps": []}], "DEPENDENCY_FORWARD"),
            ([{"id": "a", "deps": ["b"]}, {"id": "b", "deps": ["a"]}], "DEPENDENCY_CYCLE"),
        ]
        for nodes, code in cases:
            with self.subTest(code=code):
                with self.assertRaisesRegex(DiagnosticError, code):
                    validate_ordered_dag(nodes, lambda node: node["id"], lambda node: node["deps"])


class HierarchyTests(unittest.TestCase):
    def test_hierarchy_preserves_stable_parent_chain(self) -> None:
        nodes = [
            {"id": "root", "parent": None},
            {"id": "a", "parent": "root"},
            {"id": "a-child", "parent": "a"},
            {"id": "b", "parent": "root"},
        ]
        hierarchy = validate_hierarchy(nodes, "root", lambda node: node["id"], lambda node: node["parent"])
        self.assertEqual(hierarchy.ancestors("a-child"), ("a", "root"))
        self.assertEqual(hierarchy.children["root"], ("a", "b"))

    def test_missing_forward_or_unsorted_hierarchy_fails_closed(self) -> None:
        cases = [
            ([{"id": "root", "parent": None}, {"id": "a", "parent": "missing"}], "HIERARCHY_PARENT_MISSING"),
            ([{"id": "root", "parent": None}, {"id": "child", "parent": "later"}, {"id": "later", "parent": "root"}], "HIERARCHY_FORWARD_PARENT"),
            ([{"id": "root", "parent": None}, {"id": "b", "parent": "root"}, {"id": "a", "parent": "root"}], "HIERARCHY_ORDER_INVALID"),
        ]
        for nodes, code in cases:
            with self.subTest(code=code):
                with self.assertRaisesRegex(DiagnosticError, code):
                    validate_hierarchy(nodes, "root", lambda node: node["id"], lambda node: node["parent"])


if __name__ == "__main__":
    unittest.main()
