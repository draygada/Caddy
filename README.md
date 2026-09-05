# Strafe Forge

Strafe Forge is the provisional name for an experimental browser-native parametric mechanical CAD workflow. This repository is a standalone product boundary; Strafe Shipyard may observe its Git state and evidence, but is not its CAD database, geometry engine, or release authority.

There is no implemented CAD capability in this bootstrap commit. The strongest permitted description remains the claim ceiling in the canonical capability baseline.

## Canonical baseline

The current denominator and claim ceiling live outside this repository at:

`/Users/benjihuh/Programming/Strafe/CAD_CAPABILITY_ATLAS_2026.md`

The bootstrap observed SHA-256 is `c84b2726040b1e09847dda853818c75958a007b3d82bee3d89f83440d24f2877`. See [docs/BASELINE.md](docs/BASELINE.md) for the binding and drift rule. Do not copy the denominator into this repository.

Forge's unifying object is a versioned product thread from requirement/scenario through design, product structure, process/work order, assembly/inspection/test, and immutable release evidence. CAD is one governed module in that thread, not the whole product. Anduril ArsenalOS is a public-principles inspiration only; Forge claims no affiliation, compatibility, equivalence, or knowledge of proprietary internals.

## First target contract

The first target is one editable parametric part that proves:

- a constrained sketch with useful solved, under-constrained, redundant, and contradictory diagnostics;
- an ordered feature history with stable feature/entity identifiers;
- deterministic replay and explicit recompute failure with a separately labeled last-valid result;
- server-authoritative exact geometry, browser selection against derived tessellation, and STEP/STL export;
- a semantic branch/change review flow with recoverable conflicts; and
- provenance from actor intent and authorization through kernel inputs, outputs, diagnostics, tests, and export hashes.

The exact acceptance contract is [docs/contracts/first-target.md](docs/contracts/first-target.md). Broad assemblies, drawings, PMI authoring, production CAM, validated FEA, deployment, and incumbent-replacement claims are outside this bootstrap.

## Provisional architecture

- `NATIVE`: versioned product-thread/document graph, stable IDs, recompute state machine, semantic changes, authorization/provenance receipts, and topology-reference policy.
- `BORROWED`: OCCT geometry/exchange through a pinned server adapter; Three.js for rendering; a constraint solver only after a bounded license and robustness bake-off.
- `DEFERRED`: browser-side OCCT/Replicad as a non-authoritative latency preview; Yjs for presence/comments; PMI, CAM, meshing, and FEA adapters.
- `REJECTED` for the first contract: mesh/CSG as exact-model authority, whole-FreeCAD embedding, silent CRDT merging of B-rep operations, and dual authoritative browser/server kernels.

The decision and reversal conditions are in [docs/adr/0001-kernel-reuse-and-runtime-boundary.md](docs/adr/0001-kernel-reuse-and-runtime-boundary.md). The sourced component ledger is in [docs/research/component-ledger.v1.json](docs/research/component-ledger.v1.json).

## Custodied lanes

| Lane | Branch | Worktree | Sole mutable product paths |
|---|---|---|---|
| Core kernel | `lane/core-kernel` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/core-kernel` | `packages/core-kernel/**`, `tests/core-kernel/**` |
| Browser workbench | `lane/browser-workbench` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/browser-workbench` | `apps/browser-workbench/**`, `tests/browser-workbench/**` |
| History/collaboration | `lane/history-collaboration` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/history-collaboration` | `packages/history-collaboration/**`, `tests/history-collaboration/**` |

Each lane also owns only its exact receipt path. Root configuration, root dependency locks, shared contracts, architecture, deployment, and integration refs remain main-integrator custody. Run `python3 tools/check_custody.py --lane <lane> --base <bootstrap-sha>` before a handoff.
