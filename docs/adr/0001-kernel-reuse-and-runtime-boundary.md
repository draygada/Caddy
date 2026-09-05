# ADR-0001: Kernel reuse and runtime boundary

- Status: accepted for bootstrap; dependency adoption remains gated
- Date: 2026-09-05
- Decision owner: repository bootstrap task
- Revisit after: first golden-corpus spikes for kernel, constraint solver, topology lineage, and exchange

## Context

The first contract combines exact solid modeling, constraints, feature replay, stable selection, failure recovery, exchange, and semantic collaboration. No reviewed component supplies that whole contract. The defensible product layer is the typed operation/history/provenance model; mature geometry, solving, rendering, and exchange should be reused behind narrow adapters.

The canonical capability denominator and claim ceiling are referenced in `docs/BASELINE.md` and are not reproduced here.

## Decision

Use one server-authoritative geometry path for the first vertical slice:

```text
Browser workbench
  | typed proposal / semantic selection
  v
Native Forge product-thread + revision service
  | immutable document snapshot + recompute request
  v
Isolated kernel worker (initial spike: Python OCP pinned to OCCT 7.9.3)
  | exact B-rep, topology lineage, diagnostics, tessellation, exports
  v
Content-addressed artifacts
  | derived mesh + stable entity table
  +-------------------------------> Browser viewer (Three.js)
```

The dependency version in the diagram is a spike target, not an adopted lock: OCP `7.9.3.1` is the current wrapper release based on OCCT `7.9.3`, while native OCCT `8.0.0` is newer. Promotion requires golden-corpus results and an exact dependency/notice lock.

### Native responsibilities

Forge owns:

- the versioned document and operation schemas;
- stable document, sketch, entity, parameter, constraint, feature, revision, proposal, and artifact IDs;
- ordered dependency evaluation and transactional recompute states;
- semantic topology references and ambiguity policy;
- human/agent authorization transitions and provenance;
- semantic diff, branch, review, merge/reject, rollback, and replay rules;
- evidence classification and the boundary between current, last-valid, stale, and failed results.

The history/collaboration lane owns the initial schema for these records and the cross-stage chain from requirement/scenario through design, BOM/supply, process/work order, assembly/inspection/test, and immutable release evidence. The core-kernel lane owns geometry execution and geometry evidence only. The browser-workbench lane owns interaction and presentation only.

### Borrowed responsibilities

- OCCT performs exact B-rep construction, validation/healing primitives, tessellation, mass properties, and STEP/STL exchange.
- OCP is the initial Python binding layer; it adds no geometry semantics and retains OCCT's transitive license obligations.
- A constraint solver is used only behind a Forge-owned request/result/diagnostic interface after the bake-off described below.
- Three.js renders derived geometry and supplies generic WebGL/WebGPU scene infrastructure. It never identifies canonical topology by array offset.
- Later, Yjs may carry presence, cursors, and comments. It cannot apply geometry operations.

### Constraint solver decision gate

No solver is adopted yet. The core-kernel lane must run the same bounded corpus against at least:

1. FreeCAD PlaneGCS, whose inspected source files are `LGPL-2.1-or-later`, assessing extraction/build coupling, diagnostics, rank/DOF behavior, scale sensitivity, repeatability, and packaging; and
2. CadQuery's current solver path, which is easy to call through the prospective Python stack but is explicitly documented as experimental and supports a narrower entity/constraint set.

SolveSpace is a useful behavioral comparator but its repository is `GPL-3.0-or-later`; it is not an embeddable default for a potentially closed distributed product without a separately approved licensing architecture. A network process is not assumed to erase GPL obligations. If neither permissive/LGPL candidate meets the corpus, stop and present build/license options rather than shipping a plausible-looking relaxation solver.

### Topological identity

Durable references are not `Face7` or tessellation indices. A reference contains:

- source feature and source semantic role;
- kernel-reported generated/modified/deleted lineage when available;
- geometry class and invariant signature (for example plane/cylinder, orientation, adjacency, and bounded measurements) as validation, not sole identity;
- the document revision and kernel build that produced it; and
- a resolution disposition: `EXACT`, `HEURISTIC_CONFIRMED`, `AMBIGUOUS`, `MISSING`, or `DELETED`.

Automatic recompute may proceed only for `EXACT` or for a separately user-confirmed heuristic mapping. Ambiguous mappings block the dependent feature and preserve the last-valid artifact. This uses OCCT history/OCAF primitives but does not claim the general topological naming problem is solved.

### Recompute and determinism

- Canonical numeric values carry units and serialize in a normalized decimal representation; no locale-sensitive parsing is allowed.
- Evaluation order is defined by dependency order plus stable feature order, never hash-map or UI order.
- Each recompute runs in an isolated, resource-bounded worker with a pinned kernel image and explicit tolerances.
- Every feature result records input fingerprint, kernel status, shape validity, topology map, diagnostics, timings, and semantic geometry fingerprint.
- A failed feature blocks its dependents. The attempted revision remains failed; the last-valid revision/artifact is immutable and distinctly labeled.
- Determinism means equal normalized inputs under the same engine manifest produce equal state transitions and semantic geometry fingerprints. STEP byte equality is not asserted until timestamps, entity numbering, headers, and writer ordering are controlled.

### Browser/server split

The browser owns interaction latency, sketch gestures, selection display, review, and local draft state. It receives a tessellated artifact whose vertex/primitive ranges map to stable kernel entity IDs. The server owns canonical constraint acceptance, B-rep, recompute, and export.

Replicad/OpenCascade.js may later run in a Web Worker for speculative preview. A preview is watermarked/stated as pending, cannot create an export or verified artifact, and is discarded or reconciled when the authoritative result arrives.

### Branch and collaboration model

A change is a typed proposal against an exact base revision with explicit preconditions. Geometry proposals serialize through validation. Disjoint parameter/metadata proposals may be automatically mergeable only when dependency analysis proves commutativity and replay succeeds. Conflicts are semantic objects, not last-writer-wins overwrites.

Presence and comments may converge independently. Every mutation moves through distinct `REQUESTED`, `AUTHORIZED`, `APPLIED`, `VERIFIED`, and optionally `ROLLED_BACK` records.

The product thread, rather than a CAD file, is the unifying record. CAD revisions and artifacts are typed nodes within it. The north star is informed only by Anduril's public ArsenalOS/Arsenal descriptions; this decision implies no affiliation, compatibility, equivalence, or knowledge of proprietary internals.

## Alternatives evaluated

| Option | Strength | Decisive risk | Disposition |
|---|---|---|---|
| Browser-authoritative Replicad/OpenCascade.js | Fast TypeScript prototype; zero kernel round trip | Large WASM/runtime complexity, weaker process isolation, version/tolerance drift with server export, no complete history/collaboration semantics | `DEFERRED` preview only |
| Server OCP/OCCT with native Forge model | One exact/replay authority; mature modeling and exchange; testable isolated workers | Python/native packaging, latency, OCCT failure modes, direct adapter work | `BORROWED` spike and provisional choice |
| CadQuery or build123d as canonical engine | Productive APIs, strong examples, active communities | Their script/state/selector abstractions are not Forge's stable operation graph; topology lineage may be obscured; CadQuery sketch solver is experimental | `DEFERRED` façade/reference |
| Whole FreeCAD headless/embedded | Mature application, sketcher, feature history, broad CAM/FEM | Very large application/runtime boundary, GUI/module coupling, difficult browser split and narrow deterministic service packaging | `REJECTED` for first contract; reference/adapters later |
| JSCAD/mesh or CSG kernel | Simple browser deployment and permissive license | Not an exact B-rep/STEP-authoritative professional part kernel | `REJECTED` as geometry authority |
| Bespoke geometry kernel or solver | Maximum control | Multi-year correctness/robustness burden and unacceptable first-contract risk | `REJECTED` absent failed bake-off |

## Consequences

- The first interaction may incur server latency; UI must expose queued/computing/stale/failed states rather than fake immediacy.
- Only one kernel/version produces verified artifacts, simplifying provenance and replay.
- OCP lets the first slice move quickly, but a native C++ service remains a reversible future optimization if Python overhead or binding gaps fail performance/coverage gates.
- LGPL compliance is a product requirement: visible notice, license/source availability, relink/replaceability analysis, exact source/build instructions, and commercial-license evaluation where distribution constraints require it.
- CAM, meshing, FEA, and PMI remain adapter contracts with no accuracy/completeness claims.

## Reversal conditions

Reconsider the server-authoritative choice if a pinned browser kernel passes the same golden corpus, topology-lineage tests, crash/recovery tests, and export semantics while materially improving end-to-end latency or offline usability. Reconsider OCP if bindings hide required history APIs, packaging cannot be reproduced, process cost violates the budget, or OCCT 8-only fixes are required. Reconsider the solver only on exact corpus, packaging, and license evidence.
