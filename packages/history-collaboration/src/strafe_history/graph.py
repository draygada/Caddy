"""Schema-neutral validation for ordered DAGs and stable-ID hierarchies."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Set

from .errors import DiagnosticError, require


IdGetter = Callable[[Any], str]
DependencyGetter = Callable[[Any], Iterable[str]]


@dataclass(frozen=True)
class OrderedGraph:
    order: Sequence[str]
    dependencies: Dict[str, frozenset]
    dependents: Dict[str, frozenset]

    def descendants(self, node_ids: Iterable[str]) -> Set[str]:
        pending = list(node_ids)
        found: Set[str] = set()
        while pending:
            current = pending.pop()
            for dependent in self.dependents.get(current, frozenset()):
                if dependent not in found:
                    found.add(dependent)
                    pending.append(dependent)
        return found

    def impact(self, node_ids: Iterable[str]) -> Set[str]:
        roots = set(node_ids)
        return roots | self.descendants(roots)


def validate_ordered_dag(nodes: Sequence[Any], id_of: IdGetter, dependencies_of: DependencyGetter) -> OrderedGraph:
    order: List[str] = []
    node_by_id: Dict[str, Any] = {}
    for node in nodes:
        node_id = id_of(node)
        require(isinstance(node_id, str) and bool(node_id), "NODE_ID_INVALID", "graph node ID must be non-empty")
        require(node_id not in node_by_id, "DUPLICATE_ID", "graph node ID is duplicated", node_id=node_id)
        node_by_id[node_id] = node
        order.append(node_id)

    dependencies: Dict[str, frozenset] = {}
    dependents_work: Dict[str, Set[str]] = {node_id: set() for node_id in order}
    position = {node_id: index for index, node_id in enumerate(order)}
    for node_id in order:
        dependency_list = list(dependencies_of(node_by_id[node_id]))
        require(len(dependency_list) == len(set(dependency_list)), "DUPLICATE_ID", "dependency IDs must be unique", node_id=node_id)
        missing = sorted(dependency for dependency in dependency_list if dependency not in node_by_id)
        require(not missing, "DEPENDENCY_MISSING", "graph dependency is missing", node_id=node_id, missing=missing)
        dependencies[node_id] = frozenset(dependency_list)
        for dependency in dependency_list:
            dependents_work[dependency].add(node_id)

    visiting: Set[str] = set()
    visited: Set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            raise DiagnosticError("DEPENDENCY_CYCLE", "graph dependency cycle detected", details={"node_id": node_id})
        if node_id in visited:
            return
        visiting.add(node_id)
        for dependency in dependencies[node_id]:
            visit(dependency)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in order:
        visit(node_id)
    forward = [
        {"node_id": node_id, "dependency_id": dependency}
        for node_id in order
        for dependency in dependencies[node_id]
        if position[dependency] >= position[node_id]
    ]
    require(not forward, "DEPENDENCY_FORWARD", "ordered graph contains a forward dependency", forward=forward)
    return OrderedGraph(
        order=tuple(order),
        dependencies=dict(dependencies),
        dependents={node_id: frozenset(values) for node_id, values in dependents_work.items()},
    )


@dataclass(frozen=True)
class Hierarchy:
    root_id: str
    parents: Dict[str, Optional[str]]
    children: Dict[str, Sequence[str]]

    def ancestors(self, node_id: str) -> Sequence[str]:
        require(node_id in self.parents, "NODE_NOT_FOUND", "hierarchy node does not exist")
        result: List[str] = []
        current = self.parents[node_id]
        while current is not None:
            result.append(current)
            current = self.parents[current]
        return tuple(result)


def validate_hierarchy(
    nodes: Sequence[Any],
    root_id: str,
    id_of: IdGetter,
    parent_of: Callable[[Any], Optional[str]],
    require_lexical_siblings: bool = True,
) -> Hierarchy:
    ids = [id_of(node) for node in nodes]
    require(len(ids) == len(set(ids)), "DUPLICATE_ID", "hierarchy node ID is duplicated")
    require(ids and ids[0] == root_id, "HIERARCHY_ROOT_INVALID", "root must be the first hierarchy node")
    known = set(ids)
    parents: Dict[str, Optional[str]] = {}
    children_work: Dict[str, List[str]] = {node_id: [] for node_id in ids}
    for index, node in enumerate(nodes):
        node_id = id_of(node)
        parent = parent_of(node)
        if node_id == root_id:
            require(parent is None, "HIERARCHY_ROOT_INVALID", "root parent must be null")
        else:
            require(isinstance(parent, str) and parent in known, "HIERARCHY_PARENT_MISSING", "hierarchy parent is missing", node_id=node_id)
            require(ids.index(parent) < index, "HIERARCHY_FORWARD_PARENT", "parent must precede child", node_id=node_id)
            children_work[parent].append(node_id)
        parents[node_id] = parent
    if require_lexical_siblings:
        for parent, children in children_work.items():
            require(children == sorted(children), "HIERARCHY_ORDER_INVALID", "siblings must be lexicographically ordered", parent_id=parent)
    return Hierarchy(root_id, parents, {node_id: tuple(children) for node_id, children in children_work.items()})

