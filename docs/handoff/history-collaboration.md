# Handoff: history and collaboration lane

## Objective

Prove the native versioned product-thread plus revision/proposal/review/replay layer for typed CAD operations without pretending that text CRDT convergence makes geometry operations commutative.

## Custody

- Branch: `lane/history-collaboration`
- Worktree: `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/history-collaboration`
- Writable: `packages/history-collaboration/**`, `tests/history-collaboration/**`, and `governance/receipts/history-collaboration.json`
- Everything else is read-only. Shared-schema changes return as terminal proposals.

The receipt is deliberately `PREPARED_UNASSIGNED`. One exact writer/task identity and expiry must be assigned before mutation.

## Bounded first packet

1. Define the initial product-thread schema linking requirement/scenario, design feature/model, BOM/supply state, process/work order, assembly/inspection/test, and immutable release evidence. Every node and edge carries stable IDs, schema version, exact source/revision, provenance, and an honest notional/observed/verified disposition.
2. Define the canonical CAD document envelope and typed parameter/feature proposal format with exact base revision, preconditions, and actor intent. Geometry payloads remain owned by the core-kernel contract.
3. Implement content-addressed immutable revisions and deterministic replay over a fake kernel result interface.
4. Implement semantic diff, review, accept/reject, stale-base detection, conflict objects, rollback, and interrupted-apply recovery.
5. Keep `REQUESTED`, `AUTHORIZED`, `APPLIED`, `VERIFIED`, `REJECTED`, and `ROLLED_BACK` as separate append-only receipts.
6. Model comments/presence as a separate metadata stream. Yjs may be evaluated there only; geometry changes remain serialized proposals.
7. Prove two disjoint parameter proposals can merge only when dependency/precondition checks and replay agree; prove a noncommutative pair blocks.

## Stop/fail conditions

- Stop on last-writer-wins geometry, mutable revision history, authorization inferred from application, missing actor/engine/source binding, fabricated ERP/MES/supply/quality completion, or replay that depends on wall-clock/iteration order.
- Do not add authentication, tenant infrastructure, deployment, or enterprise PLM.

## Required return

Candidate commit, schema examples, replay/conflict/property-test output, recovery evidence, threat/abuse notes, custody-check output, rollback, and shared-contract proposals.
