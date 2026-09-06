# ADR-0003: A hash chain in the lane, signing in the log, synthetic dispatch exactly once

- Status: accepted (lane-local), 2026-09-06
- Source: engineering direction §3.5 and §3.7; THE BUILD §3.11; thread 5 §10 (order send-off contract); AGENTS.md external-send rule

## Context

The product thread is the platform log's object (append-only, hash-chained, Ed25519-signed, ephemeral demo key). This lane has to emit its events into that thread and re-derive them, but the standard library has no Ed25519, and a second key in a second module would be a second signer.

## Decision

1. The lane keeps an **append-only, SHA-256 hash-chained** event list with the log's actor discipline: an agent may write only `*_proposed` kinds; terminal kinds (`offer_selected`, `match_adjudicated`, `technical_data_declared`, `escalation_resolved`, `order_dispatched`, …) require a human attestor. It does **not sign**. Every re-derive line says "unsigned in this lane (hash chain only); Ed25519 signing belongs to the log module". When the platform log lands, the lane's `Thread` is replaced by its `append`/`rederive`, and the events carry over unchanged.
2. Every sourcing event binds the **design hash, the design sequence and the fixture hashes it read**. Re-derive recomputes every estimate and every screening from those bound inputs and compares hashes; tamper edits one stored field and re-derive prints `BREAK at #k (kind)`.
3. The order packet is created **only from a round whose package is built and whose design hash is the log head's**; it names an approver with an authority basis, a typed recipient placeholder, exact BOM lines and the three artefact hashes. Dispatch goes through a **synthetic adapter**, labelled SYNTHETIC, under an **idempotency key**; a retry with the same key returns the first receipt and appends nothing. A placeholder containing "EXCEPTION" exercises the failure path. No real send exists in this lane under any authority available here.

## Consequences

- `test_order_idempotent`-style tests prove exactly-once and the two refusals (unapproved round, stale revision).
- The security boundary of the chain is key custody, which this lane does not hold; the label on screen says so.
