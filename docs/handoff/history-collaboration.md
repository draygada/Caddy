# Handoff: history and collaboration lane

## Objective

Prove the native versioned product-thread plus revision/proposal/review/replay layer for a small team going from an RFQ/requirement packet to its first controlled release, without pretending that text CRDT convergence makes geometry operations commutative or that synthetic records are live enterprise state.

## Custody

- Branch: `lane/history-collaboration`
- Worktree: `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/history-collaboration`
- Writable: `packages/history-collaboration/**`, `tests/history-collaboration/**`, and `governance/receipts/history-collaboration.json`
- Everything else is read-only. Shared-schema changes return as terminal proposals.

The receipt is deliberately `PREPARED_UNASSIGNED`. One exact writer/task identity and expiry must be assigned before mutation.

## Bounded first packet

1. Define the initial product-thread schema for `idea/need -> requirements -> engineering model -> product structure -> sourcing/process -> authorized order send-off -> build -> inspect/test -> authorized release -> operational feedback`. Accept RFQ/requirement/scenario/drawing/imported-model sources; keep every node/edge bound to stable IDs, schema version, exact source/revision, provenance, and an honest notional/proposed/observed/reviewed/verified/rejected/superseded disposition.
2. Define the canonical CAD document envelope and typed parameter/feature proposal format with exact base revision, preconditions, and actor intent. Geometry payloads remain owned by the core-kernel contract.
3. Implement content-addressed immutable revisions and deterministic replay over a fake kernel result interface.
4. Implement semantic diff, review, accept/reject, stale-base detection, conflict objects, rollback, and interrupted-apply recovery.
5. Keep `REQUESTED`, `AUTHORIZED`, `APPLIED`, `VERIFIED`, `REJECTED`, and `ROLLED_BACK` as separate append-only receipts.
6. Model comments/presence as a separate metadata stream. Yjs may be evaluated there only; geometry changes remain serialized proposals.
7. Prove two disjoint parameter proposals can merge only when dependency/precondition checks and replay agree; prove a noncommutative pair blocks.
8. Prove a manufacturability/evidence gap blocks controlled release until the declared human role resolves or rejects it. Compliance nodes organize sources and gates; they never output automatic legal conclusions.
9. Bind operational feedback to the immutable released revision and open a new proposal without changing release history. Emit projection receipts that Shipyard can observe without granting it write authority.
10. Add RFQ/quote/supplier-selection and purchase/internal-work-order records bound to the exact approved design/BOM revision, recipient, quantity, hashed attachments, approvals, idempotency key, dispatch/acknowledgment/exception state, delivery/receiving, inspection, and closeout.
11. Implement only a local synthetic adapter proof: one observable send effect per idempotency key across duplicate, retry, crash, timeout, lost response, and exception/reconciliation cases. A real external send remains separately authorized and out of scope.

## Stop/fail conditions

- Stop on last-writer-wins geometry, mutable revision history, authorization inferred from application, missing actor/engine/source binding, fabricated ERP/MES/supply/quality completion, duplicate synthetic dispatch, blind retry of unknown dispatch, any real external send, or replay that depends on wall-clock/iteration order.
- Do not add authentication, tenant infrastructure, deployment, or enterprise PLM.

## Required return

Candidate commit, schema examples, replay/conflict/property-test output, recovery evidence, threat/abuse notes, custody-check output, rollback, and shared-contract proposals.
