# FB-05 — Audit timeline, replay, and tamper proof

Owner lane: audit. Priority: P1.

## Outcome

Every accepted design change and evaluation result becomes an append-only, hash-chained record that explains who changed what, what rule state changed, and which evidence/rule pack was used. A judge can replay the design or visibly break verification without changing the canonical log.

## Scope

- Canonical JSON serialization and SHA-256 chaining.
- Ed25519 signing using a local demo key generated for the run; no secrets committed.
- Events for accepted part/attribute changes and determination requests.
- Timeline UI synchronized with `node_id` and design revision.
- Read-only replay and a safe “tamper copy” demonstration.

## Acceptance

- Sequence, previous hash, canonical hash, and signature verify from genesis to head.
- Editing, deleting, reordering, or duplicating a line fails verification at a named sequence.
- Exact replay yields the final design digest and engine result digest recorded at the head.
- Clicking a timeline event focuses the same part and before/after tripwire change in the model.
- The tamper button mutates only an in-memory/copy fixture and cannot corrupt the canonical log.
- Logging failure blocks acceptance of a new design event; the UI shows the edit as uncommitted.

## Falsifier

Run four mutations: changed byte, deleted middle event, duplicated event, and wrong public key. Each must fail for the expected reason. Then replay the untouched log and compare the terminal design/evaluation digests.

## Cut line

If P0 is unstable, keep an in-memory deterministic event list and cut signing/tamper theatrics. Never claim a signed, append-only ledger unless the mutation tests pass.
