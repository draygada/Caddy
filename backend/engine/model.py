"""design.json in memory. Mirrors schemas/design.schema.json, including the items[] axis."""
from dataclasses import dataclass, field
from typing import Any

@dataclass
class Attr:
    value: Any = None
    unit: str | None = None
    source_url: str | None = None
    quote: str | None = None
    span: tuple[int, int] | None = None
    doc_sha256: str | None = None
    extracted_by: str | None = None
    @property
    def empty(self) -> bool:
        """An empty field CANNOT fire a rule (THE_BUILD.md §3.3)."""
        return self.value is None

@dataclass
class Item:
    id: str
    item_kind: str                      # commodity | software | technology
    description: str | None = None
    attrs: dict[str, Attr] = field(default_factory=dict)

@dataclass
class Node:
    id: str
    kind: str                           # product | assembly | part
    parent: str | None = None
    role: str | None = None
    mpn: str | None = None
    vendor: str | None = None
    origin: str | None = None
    value_usd: float | None = None
    part_class: str | None = None
    attrs: dict[str, Attr] = field(default_factory=dict)
    items: list[Item] = field(default_factory=list)
    declared: dict[str, Any] = field(default_factory=dict)

@dataclass
class Design:
    root: str
    nodes: dict[str, Node]
    def children(self, nid: str) -> list[Node]:
        return [n for n in self.nodes.values() if n.parent == nid]
    def ancestors(self, nid: str):
        n = self.nodes.get(nid)
        while n and n.parent:
            n = self.nodes.get(n.parent)
            if n: yield n

def load(doc: dict) -> Design:
    nodes = {}
    for raw in doc.get("nodes", []):
        nodes[raw["id"]] = Node(
            id=raw["id"], kind=raw["kind"], parent=raw.get("parent"),
            role=raw.get("role"), mpn=raw.get("mpn"), vendor=raw.get("vendor"),
            origin=raw.get("origin"), value_usd=raw.get("value_usd"),
            part_class=raw.get("part_class"),
            attrs={k: Attr(**v) for k, v in (raw.get("attrs") or {}).items()},
            items=[Item(id=i["id"], item_kind=i["item_kind"],
                        description=i.get("description"),
                        attrs={k: Attr(**v) for k, v in (i.get("attrs") or {}).items()})
                   for i in (raw.get("items") or [])],
            declared=raw.get("declared") or {},
        )
    return Design(root=doc["root"], nodes=nodes)
