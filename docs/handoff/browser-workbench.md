# Handoff: browser workbench lane

## Objective

Prove a focused interaction-only browser shell that edits a typed draft, renders derived tessellation, maps selection to stable kernel entity IDs, and communicates solve/recompute/stale/failure states honestly on desktop and review-only mobile. It owns neither geometry truth nor product-thread semantics.

## Custody

- Branch: `lane/browser-workbench`
- Worktree: `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/browser-workbench`
- Writable: `apps/browser-workbench/**`, `tests/browser-workbench/**`, and `governance/receipts/browser-workbench.json`
- Everything else is read-only. Shared-schema/dependency changes return as terminal proposals.

The receipt is deliberately `PREPARED_UNASSIGNED`. One exact writer/task identity and expiry must be assigned before mutation.

The same receipt's `now_observation` is the only lane-authored browser-safe status subset. Update it only with a material source observation, preserve `MEASURED | INFERRED | UNKNOWN`, and let it become stale when no evidence arrives. Do not project the absolute worktree path. This lane does not implement Shipyard's top-level Now tab.

## Bounded first packet

1. Use Three.js behind a small viewer adapter with WebGL fallback; WebGPU is an enhancement, not the compatibility floor.
2. Consume a lane-local synthetic fixture shaped like the kernel result: mesh buffers, artifact revision, stable entity-range table, feature IDs, and diagnostics.
3. Support orbit/pan/zoom, hover/select, entity/feature reveal, numeric parameter proposal, and explicit queued/running/succeeded/failed/stale/last-valid UI.
4. Provide keyboard navigation, non-color state cues, reduced-motion behavior, a recoverable network/worker failure, and mobile review of semantic diff/diagnostics.
5. If Replicad/OpenCascade.js is spiked, isolate it in a Web Worker and label it `PREVIEW_UNVERIFIED`; it cannot export or commit canonical geometry.

## Stop/fail conditions

- Stop if selection depends on triangle or face array order, a stale mesh is displayed as current, browser preview is treated as verified, or a root lockfile change is required without integrator action.
- Do not build broad modeling tools, deployment, collaboration transport, or a visual superiority demo.

## Required return

Candidate commit, screenshots/video for required states, browser/a11y/responsive test output, large-fixture timing/memory notes, compatibility matrix, custody-check output, rollback, and shared-contract/dependency proposals.
