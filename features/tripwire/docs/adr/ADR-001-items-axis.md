# ADR-001 — `items[]` nests under the part node

**Date:** 2026-09-05 · **Status:** accepted at the 10:00 schema freeze · **Deciders:** Benji (Charlie's Step 0 answer still outstanding)

## Context

Charlie's parts handoff of 2026-09-03 opens with an explicit STOP:

> Engine v2 walks `items[]` (commodity | software | technology *within* one product). The parts tree
> is a physical decomposition. Decide with Charlie how they compose — recommended: each part node
> carries its own `items[]`, and the tree is the outer loop. If the memo-project code in flight has
> already fixed an `items[]` shape that cannot nest under a part, STOP and report before building either.

THE_BUILD.md §3.2 has no `items[]` field at all. Charlie also intends to port this weekend's node
schema into the platform — *"port the data shape, not the engine"* — which makes the shape frozen
here the platform's future BOM shape, not a weekend-only decision.

## Decision

Adopt Charlie's recommendation. `items[]` is an optional array on every node in
`schemas/design.schema.json`; the physical tree is the outer loop and each node's items are the
inner one. Empty is valid and is the baseline for every part in Kestrel, so nothing in the weekend
build has to populate it.

Two consequences carried through the other schemas:
- `rules.schema.json` gains `applies_to.item_kind` (null = the row applies to the part node itself)
  and an `any_item` atom.
- `log.schema.json` gains `item_added` / `item_changed` event kinds and an `item` field.

## Why

An optional empty field costs nothing now. Retrofitting an axis into a shipped platform schema is
the expensive path, and the handoff names that retrofit as the likely failure. Nesting also matches
how the regulation reads: a part with firmware is one physical thing carrying a commodity and a
software item, both evaluated under the same node, rather than two parallel trees to reconcile.

## Status of the STOP

**Not cleared.** Charlie has not answered Step 0. This ADR takes the option he recommended, which is
the reversible direction: if he prefers a parallel axis, the field is empty everywhere and can be
dropped without touching data. If the memo-project code has already fixed an incompatible `items[]`
shape, that is the condition his STOP names, and this decision is reopened.

## Reversal

Delete `items` from the node schema, `applies_to.item_kind` and `any_item` from the rules schema,
and the two event kinds from the log schema. No Kestrel data populates them at the freeze.
