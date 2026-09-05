# Handoff: core kernel lane

## Objective

Prove the smallest geometry-only, server-authoritative path from a normalized constrained sketch to a valid exact solid, a stable topology/entity table, deterministic recompute states, and verified STEP/STL artifacts. Product-thread/revision policy belongs to history/collaboration; UI belongs to browser-workbench.

## Custody

- Branch: `lane/core-kernel`
- Worktree: `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/core-kernel`
- Writable: `packages/core-kernel/**`, `tests/core-kernel/**`, and `governance/receipts/core-kernel.json`
- Everything else is read-only. Shared-schema changes return as proposals in the terminal handoff.

The receipt is deliberately `PREPARED_UNASSIGNED`. Before mutation, the integration owner must set one exact writer/task identity, acquisition time, renewal/expiry, and confirm no competing state-domain owner.

## Bounded first packet

1. Create a reproducible spike manifest for OCP `7.9.3.1` / OCCT `7.9.3`; do not float dependencies.
2. Define lane-local draft geometry request/result schemas for line/circle sketch geometry, core constraints, extrude, and fillet or chamfer; return any canonical product-thread schema need as an interface proposal.
3. Run a solver bake-off on the same fixtures. PlaneGCS and CadQuery's experimental solver are the minimum candidates; SolveSpace is comparator-only unless licensing authority changes.
4. Implement transactional clean-process recompute with explicit per-feature failures and a last-valid pointer that never changes the attempted revision's status.
5. Capture OCCT generated/modified/deleted history plus semantic reference validation; ambiguity must fail.
6. Produce STEP and normalized STL, then re-import/check validity, units, mass properties, topology counts, and tolerances.

## Stop/fail conditions

- Stop if a required third-party license/version is unclear, OCP omits a required history API, a solver cannot classify conflicts stably, or the fixture passes only by transient topology index.
- Do not silently fall back to mesh geometry, heal away a failed design intent, assert STEP byte determinism without normalization evidence, or add CAM/FEA.
- Do not modify root dependency locks from this lane.

## Required return

Candidate commit, exact dependency/source hashes, license/notice packet, focused test output, golden-fixture manifest, performance distribution, determinism comparison, known failure corpus, custody-check output, rollback, and shared-contract proposals.
