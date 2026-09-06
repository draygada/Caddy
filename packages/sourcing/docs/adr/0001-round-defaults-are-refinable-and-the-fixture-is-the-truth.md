# ADR-0001: Round defaults are refinable; the committed fixture is the truth

- Status: accepted (lane-local), 2026-09-06
- Source: Diego's 2026-09-05 validation (§2 "four things are modelled as design facts that are not"); engineering direction §3.6 invariants

## Context

The build spec froze ship-to, transport mode, quantity and assembly country at round open, and put ECCN and HTS on the offer. Practice at a small hardware buyer and at a prime decides ship-to and transport per purchase order and per shipment, and takes ECCN and HTS from the manufacturer's self-classification, not the seller.

## Decision

1. Ship-to, transport mode, quantity and assembly country are **round defaults**. `refine()` changes one after open, re-runs every estimate, leaves screening statuses untouched, records a `round_refined` event with provenance, and marks any existing selection stale. Earlier estimates are superseded by later events, never deleted.
2. Declared ECCN and HTS are **part-level manufacturer claims** on the offer record with `declared_by`, `date` and a `state` that includes "not yet classified". Origin stays per offer and per lot; an offer whose origin depends on the lot opens an `origin_depends_on_lot` escalation that blocks the package until a human resolves it.
3. Every number the lane reads comes from a **committed fixture with a manifest** (source, retrieved-at, sha256, row count, revision). Overlay rows are data; a rate change is a new fixture and old estimates keep pointing at the old one. Nothing on the request path is live.
4. A new design state opens a **new round that names the one it supersedes**; the superseded round stays readable and says which design state it was built for.

## Consequences

- The no-change edits (quantity 1→2, air→ocean, re-screen on the same snapshot) are tests: estimates recompute, zero statuses move, the diff says so.
- The MPF minimum is not crossed by any Kestrel line at quantity 2 (it needs about $9,694 of entered value); the spec's F-05 sentence about the cells crossing it was arithmetic, not law, and the test asserts the honest outcome.
- Charlie's data pass (base rates, Chapter 99 headings) changes fixtures, not code.
