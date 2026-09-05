# Kernel and component reuse evaluation

- Observation date: 2026-09-05
- Canonical denominator/claim ceiling: external path and SHA-256 in `docs/BASELINE.md`
- Repository-head receipts: `docs/research/repository-snapshots.v1.json`
- Decision: narrow server-authoritative OCCT/OCP spike; native product thread; browser renders derived artifacts; all other adoption remains gated

This is an architecture and license screen, not legal advice, a dependency lock, or evidence that any component is integrated. `BORROWED` below means selected responsibility/candidate direction; it does not mean code is present. Only passing exact-version build, SBOM, license, corpus, performance, determinism, security, and recovery gates can advance a component to `INTEGRATED`.

## Outcome

The lowest-risk first path is:

1. Forge owns the versioned product thread, operation/revision semantics, stable IDs, topology-reference policy, recompute/failure truth, semantic review, authorization, order send-off state, and provenance.
2. A network-disabled, resource-bounded server worker borrows OCCT for exact B-rep and STEP/STL. OCP `7.9.3.1`/OCCT `7.9.3` is the fastest initial binding spike; it is not yet an adopted lock. Native OCCT 8 remains the likely long-term performance path if bindings block required history APIs.
3. Constraint solving stays behind a Forge interface. Spike FreeCAD PlaneGCS and CadQuery's experimental solver on one corpus. SolveSpace is the strongest technical comparator but not the default because it is GPL-3.0-or-later.
4. Three.js `WebGLRenderer` renders a derived tessellation packet with stable semantic entity IDs. WebGPU, Replicad, and an OCCT-WASM fork remain non-authoritative experiments.
5. OCCT/XDE is the STEP boundary; XDE is a transient exchange document, never the product-thread source of truth. PMI/AP242, volume mesh, FEA, and CAM remain deferred adapters.

## Evaluation criteria

Every candidate was screened for license/commercial-product constraints, geometric or numerical robustness, durable topology/history support, browser/server fit, performance shape, deterministic replay, testability, maintenance evidence, and integration/failure radius. Unknown means unproven, not assumed false or true.

## Geometry and modeling

| Component | License screen | Robustness/history | Runtime/performance/determinism | Maintenance/testability | Classification and integration risk |
|---|---|---|---|---|---|
| [OCCT](https://github.com/Open-Cascade-SAS/OCCT) | LGPL-2.1 with [Open CASCADE exception 1.0](https://github.com/Open-Cascade-SAS/OCCT/blob/master/OCCT_LGPL_EXCEPTION.txt); commercial terms available. Distribution still needs notice, corresponding source/build instructions, and replace/relink analysis. | Mature exact B-rep, booleans, fillets, healing/validation, tessellation, exchange. [OCAF/TNaming](https://github.com/Open-Cascade-SAS/OCCT/wiki/ocaf) and `BRepTools_History` expose generated/modified/deleted evolution, but Forge must create semantic keys and supply history. A current [upstream issue](https://github.com/Open-Cascade-SAS/OCCT/issues/1036) reports inconsistent history methods across algorithms. | Best native/server candidate. No bitwise cross-platform/export guarantee found. Pin compiler, kernel, tolerances, thread settings, and compare semantic geometry. Isolate crashes/timeouts. | Active 8.0.x line, multi-platform CI, large DRAW regression system; continuing crash/modeling fixes mean industrial maturity is not infallibility. | `BORROWED`, not yet `INTEGRATED`. Medium-high adapter/build risk; best authoritative kernel. |
| [OCP](https://github.com/CadQuery/OCP) | Apache-2.0 wrapper; OCCT remains LGPL-2.1 plus exception. | Thin access to almost all OCCT; adds no feature graph, constraints, or persistent identity. Required history bindings must be proven. | Headless native geometry with Python orchestration. Current release `7.9.3.1` is based on OCCT `7.9.3`; native OCCT is already 8.x. Reproducible wheel/image and process overhead are open. | Active release/build system and downstream CadQuery/build123d exercise. | `BORROWED` first spike. Medium risk; fastest way to test exact contracts. |
| [CadQuery](https://github.com/CadQuery/cadquery) | Apache-2.0; OCP/OCCT transitive obligations. | Productive parametric server façade and STEP/STL export. Its [sketch constraints](https://cadquery.readthedocs.io/en/stable/sketch.html) and operation history are documented experimental; tags/selectors are not durable topology identity. | Good headless fit with Python overhead. Meshing can be parallel, so ordering is not assumed stable. | Active 2.x project with broad pytest coverage. | `DEFERRED` façade/oracle. Medium risk if used as canonical semantics; useful for fast comparison. |
| [build123d](https://github.com/gumyr/build123d) | Apache-2.0; OCP/OCCT transitive obligations. | Clear typed/algebraic construction and selectors, but no mature global sketch constraint system or durable editable feature DAG. Geometric selectors reduce index use without solving persistent naming. | Server/Python only. Source replay is testable; no byte/cross-platform determinism guarantee. | Active `v0.11.1`, still pre-1.0 with stability work tracked in its [roadmap](https://github.com/gumyr/build123d/wiki/Roadmap). | `DEFERRED` API inspiration/secondary adapter. Medium-high canonical-core risk. |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD) | LGPL-2.1-or-later at repository level; bundled modules/dependencies need separate audit. | Closest complete open behavioral reference: parametric documents, Sketcher, feature history, recompute/error states, exchange, CAM/FEM. Its own [topological-naming guide](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Topological_naming_problem.md) says the problem persists; 1.0+ heuristics reduce and help repair it. | `FreeCADCmd` is headless except GUI-dependent modules, but the C++/Python/Qt application is a large, stateful service boundary. | Active 1.1.x development and extensive application coverage. | `REJECTED` as whole embedded first architecture; `DEFERRED` oracle/adapters. High packaging/coupling/failure-radius risk. |
| [Replicad](https://github.com/sgenoud/replicad) | MIT core; its OCCT-WASM dependency retains LGPL/exception obligations. | Strong TypeScript/browser modeling convenience and STEP/STL helpers. Finders are geometry queries, not persistent evolution. No general constraint graph, durable feature DAG, last-valid transaction model, or branch review layer. | Official guidance uses a Web Worker. WASM cold start, memory, version parity, cancellation, and current canary dependency provenance require proof. | Active repo/Vitest, smaller maintainer surface and no selected stable release lock. | `DEFERRED` speculative preview only. Medium-high risk as authority. |
| [OpenCascade.js original](https://github.com/donalffons/opencascade.js) | LGPL-2.1 wrapper plus OCCT obligations. | Raw OCCT bindings only. | Large/custom WASM builds and startup cost; last listed release `v1.1.1` is from 2020. | Source remains visible, but release cadence is unsuitable for a new canonical dependency. | `REJECTED` original lineage for new work. High maintenance/supply risk. |
| [taucad/opencascade.js (libcascade)](https://github.com/taucad/opencascade.js) | LGPL-2.1 plus OCCT exception. | Newer trimmed OCCT bindings with provenance metadata; still no Forge semantics. | `v3.0.2` records OCCT `V8_0_1` and Emscripten `6.0.5`; published benchmarks show meaningful WASM/init cost and do not prove semantic determinism. Threads need cross-origin isolation. | More reproducible than the original, but young/small surface. | `DEFERRED` preferred browser-kernel experiment. Medium risk; never concurrent authority until parity passes. |
| [JSCAD](https://github.com/jscad/OpenJSCAD.org) | MIT. | Polygonal/BSP CSG and segmented curves; no exact B-rep, STEP, constraint solver, topology evolution, or editable feature history. | Excellent browser/Node portability for mesh utilities. | Active tests; a v3 breaking-change track remains. | `REJECTED` as geometry authority; optional utility/reference only. |

## Constraint solvers

| Candidate | License | Evidence | Determinism/performance/testability | Classification and gate |
|---|---|---|---|---|
| [FreeCAD PlaneGCS](https://github.com/FreeCAD/FreeCAD/tree/main/src/Mod/Sketcher/App/planegcs) | Inspected upstream files: LGPL-2.1-or-later. | Mature DogLeg/Levenberg-Marquardt/BFGS/SQP paths, sparse Eigen support, degrees-of-freedom and conflict behavior exercised by FreeCAD Sketcher. | Need standalone benchmarks for scale, insertion order, initial guesses, redundant/conflicting sets, repeatability, memory, and stable diagnostics. | `DEFERRED` preferred bake-off candidate. Adoption requires an independently buildable pinned extraction and notice set. |
| [PlaneGCS-WASM wrapper](https://github.com/Salusoft89/planegcs) | Metadata mismatch: bundled `LICENSE` says LGPL-2.1 while `package.json` reportedly says LGPL-2.0-or-later. | Browser/Node TypeScript bindings cover rich entities/constraints. Wrapper documents broken non-driving cases, manual WASM lifetime, WIP high-level model, and source-extraction maintenance. | No authoritative coverage, cross-runtime parity, 50/200/1000-DOF latency, or memory-safety evidence found. | `DEFERRED`; license/provenance ambiguity is a hard gate. |
| [SolveSpace/libslvs](https://github.com/solvespace/solvespace) | GPL-3.0-or-later. | Strong C API with lines/arcs/circles, rich constraints, DOF, failed constraints, and inconsistent/nonconvergent/redundant outcomes; official native and Emscripten builds. | Solutions can depend on initial guess. Build forces 64-bit IEEE behavior because intermediate rounding affects tests. Broad native suite; published npm/WASM test remains placeholder. | `REJECTED` default for potential closed distribution; comparator only absent approved licensing. A process boundary is not assumed to cure GPL obligations. |
| CadQuery solver | Apache-2.0 plus transitive dependencies. | Easy fit to chosen Python spike, but officially experimental and limited to line/arc constraint scenarios. | Must prove diagnostics, degenerate cases, scale/order behavior, and repeatability. | `DEFERRED` bake-off candidate, not trusted by documentation alone. |
| [Ceres Solver](https://github.com/ceres-solver/ceres-solver) | Primarily BSD-3-Clause with bundled notices. | Mature nonlinear least-squares substrate, not a CAD constraint system. | Production-grade native testing; no official browser path. Forge would still need equations, dragging, rank/DOF, decomposition, and conflict explanation. | `DEFERRED` last-resort substrate. High bespoke-program risk. |

Required bake-off corpus: solved/under/redundant/conflicting/degenerate systems; reordered entities and constraints; three numeric scales; multiple valid solutions with stored initial state; drag continuation; crash/timeout; repeated native/WASM runs; stable diagnostic codes and implicated constraint IDs.

## Viewer and browser split

| Candidate | License | Fit and limits | Classification |
|---|---|---|---|
| [Three.js](https://github.com/mrdoob/three.js) `WebGLRenderer` | MIT. | Mature scene/buffer/instancing/picking ecosystem. `Raycaster.faceIndex` is a transient triangle index, so Forge must ship a semantic face/edge range table. Explicit GPU disposal, context-loss recovery, and large-fixture budgets are required. | `BORROWED` renderer candidate behind an adapter; not geometry truth. |
| [Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer) | MIT. | Official manual still describes experimental limitations, async setup, feature incompatibilities, and fallback behavior. | `DEFERRED`; never the first-contract compatibility floor. |
| [three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer) | MIT. | Useful tessellated face/edge IDs, picking, clipping, measurement, and hierarchy. It remains a render/view state layer, with recent picking/state rewrites to test. | `DEFERRED` accelerator/reference behind Forge adapter. |
| [Babylon.js](https://github.com/BabylonJS/Babylon.js) | Apache-2.0. | Credible WebGL/WebGPU alternative but no stronger CAD/topology/exchange semantics. | `DEFERRED` benchmark alternative if Three blocks a requirement. |
| [vtk.js](https://github.com/Kitware/vtk-js) | BSD-3-Clause. | Better suited to later scalar/vector/volume analysis results; WebGPU parity is incomplete. | `DEFERRED` FEA visualization. |

Browser receives tessellated positions/indices/normals, exact edge polylines, stable semantic entity IDs, source revision, and artifact hash. It never persists triangle order, render object IDs, or screenshots as model history. A future WASM preview is worker-isolated and visibly `PREVIEW_UNVERIFIED` until server reconciliation.

## STEP, PMI, and mesh exchange

| Component | License | Capability and limitation | Classification |
|---|---|---|---|
| OCCT `STEPControl` / XDE | OCCT LGPL-2.1 plus exception. | [Official STEP guide](https://github.com/Open-Cascade-SAS/OCCT/blob/master/dox/user_guides/step/step.md) covers AP203, AP214, and only parts of AP242. XDE transports assemblies, names, colors, layers, validation properties, and parts of semantic/tessellated GD&T/PMI. Some tolerance zones, constructive references, presentation/style/text, and saved-view export are incomplete. AP242 must be selected explicitly; defaults must not define the contract. | `BORROWED` geometry/metadata exchange boundary; PMI preservation remains `DEFERRED` until corpus proof. |
| [STEPcode](https://github.com/stepcode/stepcode) | BSD-3-Clause. | EXPRESS/SDAI and Part 21 parser/schema tools; not a geometry kernel, healer, tessellator, or complete PMI renderer. | `DEFERRED` secondary syntax/schema validator. ISO schema redistribution rights remain a gate. |
| OCCT `BRepMesh_IncrementalMesh` + `StlAPI_Writer` | OCCT terms. | Sufficient for first surface STL. Pin units, linear/angular deflection, relative mode, parallelism, and binary/ASCII. Normalize before asserting byte equality. | `BORROWED` first STL path. |

XDE is an exchange document, not the canonical product model. Forge stores PMI intent and unresolved/unsupported entities as its own typed records with source references and warnings. STEP tests export, re-import, and compare units, validity, bounding box, mass properties, topology/assembly summaries, PMI counts/values/references, and expected losses. Use [MBx-IF recommended practices and resources](https://www.mbx-if.org/home/cax/recpractices/) as the future AP242 corpus. Do not use raw STEP byte equality as the principal correctness test.

## CAM, meshing, and FEA

| Component | License | Fit, determinism, and risk | Classification |
|---|---|---|---|
| [OpenCAMLib](https://github.com/aewallin/opencamlib) | LGPL-2.1 since August 2018. | Useful drop-cutter/waterline/cutter primitives with C++, Python, Node, and browser builds. Its own README says the JavaScript path is incomplete. It lacks full stock/workholding, feeds/speeds, posts, machine simulation, and safety logic. | `DEFERRED` bounded visual experiment only; never production CAM proof. |
| FreeCAD CAM | FreeCAD repository LGPL-2.1; audit every module/dependency/post. | Valuable controller-independent path then postprocessor reference, but large app/global state and controller-specific safety risk. | `DEFERRED` oracle/isolated CLI comparison. No NC reaches a machine without separate authorization and machine-specific evidence. |
| [Netgen](https://github.com/NGSolve/netgen) | LGPL-2.1-only in current package metadata. | Active tetrahedral mesher with OCCT integration, refinement/optimization, Python, and test-build options. Narrower algorithm/element scope than Gmsh; no bitwise guarantee found. | `DEFERRED` preferred first volume-mesh POC after CAD slice. |
| [Gmsh](https://gmsh.info/) | GPL-2.0-or-later with a narrow linking exception; commercial license for closed integration. | Rich surface/volume algorithms, physical groups, formats, APIs, seed/thread controls. Format/group options can change saved elements; pin every option. | `DEFERRED` benchmark/conditional adapter. License is a hard gate; subprocess separation is not presumed sufficient. |
| [CalculiX](https://github.com/Dhondtguido/CalculiX) | GPL-2.0-only in source/license. | Broad structural/thermal solver and substantial regression corpus. Solver backends, deck semantics, convergence, extrapolated visualization versus integration-point values, and validation dominate risk. | `DEFERRED` process-isolated later baseline, subject to license decision and analytic/NAFEMS-style tests. |
| [Elmer](https://github.com/ElmerCSC/elmerfem) | GPL-2.0-or-later; limited OCCT exception applies to ElmerGUI. | Active multiphysics suite with far larger configuration/verification surface than first need. | `DEFERRED`; no reason to admit before a concrete multiphysics requirement. |

No mesher or solver result is a validated engineering answer by existence or plausible visualization. Any future result records geometry/mesh/deck hashes, units, materials/contacts/loads, solver/backend/compiler, convergence warnings, residuals, threads/seeds, benchmark identity, reviewer, and claim ceiling.

## Collaboration

[Yjs](https://github.com/yjs/yjs) is MIT and technically suitable for presence, cursors, comments, and offline metadata. It is `DEFERRED`, not integrated. Geometry proposals remain exact-base, typed, authorized, and serially validated; a CRDT cannot silently merge noncommutative B-rep changes. Operational feedback and order-send records are append-only product-thread events with explicit source and authority.

## Native, borrowed, integrated, deferred, rejected

| Class | Bootstrap truth |
|---|---|
| `NATIVE` | Product-thread schema; CAD document/feature graph; stable IDs and reference policy; transactional recompute truth; semantic proposal/review; authorization and provenance; synthetic idempotent order lifecycle; claim/evidence gates. These are designs only until their lane evidence passes. |
| `BORROWED` | OCCT responsibilities, OCP first-spike binding, Three.js rendering responsibility, OCCT STEP/STL responsibility. No dependency is installed or integrated yet. |
| `INTEGRATED` | None at bootstrap. |
| `DEFERRED` | PlaneGCS/CadQuery solver selection, taucad/Replicad preview, WebGPU, Yjs metadata, PMI preservation/authoring, STEPcode, Netgen/Gmsh, CalculiX/Elmer, OpenCAMLib/FreeCAD CAM, three-cad-viewer, Babylon.js, vtk.js. |
| `REJECTED` | Whole FreeCAD as first internal architecture; original OpenCascade.js for new canonical work; JSCAD/mesh as exact authority; SolveSpace default under current licensing; silent CRDT geometry merge; dual authoritative browser/server kernels; broad CAM/FEA in first contract. |

## Hard unknowns before dependency adoption

- Exact OCCT/OCP pin and whether OCP exposes every required TNaming/BRepTools/XDE API.
- Semantic topology survival across a representative edit/fail/recover corpus; upstream history inconsistencies must be reproduced or ruled out per operation.
- Constraint solver license, standalone build, diagnostic stability, scale/order/initial-guess behavior, native/WASM parity, memory, and latency.
- Native/WASM equivalence for booleans, fillets, meshing, and exchange; browser cold load/RSS/cancellation/CSP/Safari/Firefox behavior.
- OCCT AP242 edition/conformance cases and every PMI/reference/presentation loss mode.
- LGPL replacement/source/notice mechanics for native and WASM distribution; GPL/commercial decisions for Gmsh/CalculiX/Elmer/SolveSpace.
- Cross-CPU/OS/compiler numeric reproducibility and which artifact writers can be canonicalized byte-for-byte.
- Large-model viewer memory, picking, GPU disposal/context loss, and fallback budgets.
- CAM postprocessor correctness, machine model, stock/workholding, collision, feeds/speeds, and independent simulation; these remain safety-gated.
- FEA analytic/benchmark validity, mesh convergence, materials/contacts/loads, units, solver backend, and qualified human review.

## Adoption gates

For every dependency: immutable source/tag plus artifact hashes; reproducible build; full license/SBOM/notice packet; no floating/canary dependency; focused security review; golden positive/negative/failure corpus; cold/warm latency and peak-memory budgets; deterministic semantic comparison; crash/timeout/cancellation recovery; upgrade/rollback plan; builder-distinct verification; and an explicit `INTEGRATED` receipt. Until then the status stays as listed above.
