# Strafe Forge

Strafe Forge is the provisional name for an experimental browser-native parametric mechanical CAD workflow. This repository is a standalone product boundary; Strafe Shipyard may observe its Git state and evidence, but is not its CAD database, geometry engine, or release authority.

There is no implemented CAD capability in this bootstrap commit. The strongest permitted description remains the claim ceiling in the canonical capability baseline.

## Canonical baseline

The current denominator and claim ceiling live outside this repository at:

`/Users/benjihuh/Programming/Strafe/CAD_CAPABILITY_ATLAS_2026.md`

The bootstrap observed SHA-256 is `1f231b57dd2cb7fbe1cb427725d00890b6c9454ee25dba90a55a767bdcc44cb2`. See [docs/BASELINE.md](docs/BASELINE.md) for the binding and drift rule. Do not copy the denominator into this repository.

Forge's unifying object is a versioned product thread from requirement/scenario through design, product structure, process/work order, assembly/inspection/test, and immutable release evidence. CAD is one governed module in that thread, not the whole product. Anduril ArsenalOS is a public-principles inspiration only; Forge claims no affiliation, compatibility, equivalence, or knowledge of proprietary internals.

The initial market is a small manufacturer, supplier, new program, or engineering team forming its operating institution before it has an integrated PLM/ERP/MES/simulation/compliance organization. The wedge is zero-to-first-controlled-release for low-volume/high-mix work, beginning with an RFQ, requirement packet, drawing, imported model, or rough concept. Integrations are incremental; neutral artifacts and explicit human gates remain first-class.

“We’re closing the loop from idea to execution for high-stakes industries” is approved positioning. It does not make any individual feature proven. The loop is `idea/need -> requirements -> engineering model -> product structure -> sourcing/process -> authorized order send-off -> build -> inspect/test -> authorized release -> operational feedback`. Forge owns its versioned product thread; Shipyard may visualize progress, blockers, authority, evidence, and verification without becoming a source of product truth.

The hackathon order proof is synthetic/local only: an RFQ, purchase order, or internal work order binds the exact approved design/BOM revision, recipient, quantity, hashed attachments, approvals, idempotency key, dispatch/acknowledgment/exception state, delivery/receiving, inspection, and closeout. Any real external send is a separately authorized communication.

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

The decision and reversal conditions are in [docs/adr/0001-kernel-reuse-and-runtime-boundary.md](docs/adr/0001-kernel-reuse-and-runtime-boundary.md). The sourced component ledger is in [docs/research/component-ledger.v1.json](docs/research/component-ledger.v1.json); the comparative evaluation and exact observed repository heads are in [docs/research/reuse-evaluation.md](docs/research/reuse-evaluation.md) and [docs/research/repository-snapshots.v1.json](docs/research/repository-snapshots.v1.json).

Forge emits evidence-linked lane observations for Shipyard's top-level **Now** (`LIVE NOW`) view under [docs/contracts/now-observation.md](docs/contracts/now-observation.md). Now is observed execution; the Build document is plan/design. Neither view is a second product-thread, progress, authorization, or release authority.

## Custodied lanes

| Lane | Branch | Worktree | Sole mutable product paths |
|---|---|---|---|
| Core kernel | `lane/core-kernel` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/core-kernel` | `packages/core-kernel/**`, `tests/core-kernel/**` |
| Browser workbench | `lane/browser-workbench` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/browser-workbench` | `apps/browser-workbench/**`, `tests/browser-workbench/**` |
| History/collaboration | `lane/history-collaboration` | `/Users/benjihuh/Programming/Strafe/strafe-forge-worktrees/history-collaboration` | `packages/history-collaboration/**`, `tests/history-collaboration/**` |

Each lane also owns only its exact receipt path. That receipt carries a browser-safe `now_observation` subset; its private `worktree` value must never enter a browser bundle. Root configuration, root dependency locks, shared contracts, architecture, deployment, and integration refs remain main-integrator custody. Run `python3 tools/check_custody.py --lane <lane> --base <bootstrap-sha>` before a handoff.
