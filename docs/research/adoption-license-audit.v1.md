# Dependency adoption and license gate audit v1

- Observed: `2026-09-05T16:51:57Z`
- Status: `SCREENING_ONLY / HOLD`
- Integrated dependencies: **none**
- Product distribution license: **not selected**
- Inputs: `reuse-evaluation.md`, `component-ledger.v1.json`, and
  `repository-snapshots.v1.json`
- Scope: architecture and technical license screening; not legal advice, a dependency lock,
  distribution approval, or implementation evidence

No component may advance an atomic capability merely because its package, binary, repository, or
README exists. Adoption requires one immutable version/source/artifact set, reproducible build,
SBOM and notices, exact runtime locus and egress posture, representative positive/negative/failure
corpus, resource/cancellation recovery, deterministic semantic comparison, rollback, and a
builder-distinct verification receipt. A process boundary is not presumed to cure copyleft or
other distribution obligations.

| Candidate | Proposed architecture mode | Screened license posture | Freeze verdict | Missing adoption proof |
|---|---|---|---|---|
| OCP `7.9.3.1` / OCCT `7.9.3` | Network-disabled, resource-bounded native worker behind `KernelAdapter/1`; first exact-kernel spike only | OCP Apache-2.0; OCCT LGPL-2.1 plus Open CASCADE exception 1.0; distribution mechanics unreviewed | HOLD | Exact wheel/source hashes, transitive SBOM/notices, required history/XDE binding inventory, clean build, crash/cancel limits, semantic corpus and independent comparison |
| Native OCCT 8.x | Isolated native-worker experiment only if the OCP binding blocks required APIs | LGPL-2.1 plus Open CASCADE exception 1.0; commercial terms possible; no selected terms | HOLD | Exact release/commit/compiler/build pin, replacement/source/notice plan, API delta and equivalence corpus |
| CadQuery / build123d | Comparator and fixture-authoring aid only; never canonical document semantics | Apache-2.0 plus OCP/OCCT transitive obligations | HOLD | Exact versions, transitive packet, stable topology/history limitations, deterministic comparison; no product-runtime need established |
| FreeCAD PlaneGCS | Preferred constraint-solver bake-off behind `ConstraintSolverAdapter/1`, not whole-FreeCAD embedding | Inspected sources LGPL-2.1-or-later; extraction and transitive scope unresolved | HOLD | Independently buildable exact extraction, license/notice packet, solved/under/redundant/conflict/scale/reorder corpus, stable ID diagnostics, crash/cancel limits |
| PlaneGCS WASM wrapper | Comparator only | License metadata conflict between bundled license and package metadata | HOLD | Reconciled upstream license/provenance, immutable build, memory-lifetime tests, native parity and real coverage |
| SolveSpace/libslvs | Technical comparator only; not a default embedded/runtime dependency | GPL-3.0-or-later | HOLD | Explicit approved licensing/distribution decision, exact build and benchmark corpus; subprocess/WASM separation is not treated as a legal conclusion |
| Replicad / taucad OpenCascade.js | Worker-isolated, visibly non-authoritative browser experiment | Replicad MIT plus OCCT-WASM obligations; taucad wrapper/OCCT LGPL posture | HOLD | Exact stable pin, SBOM/notices, browser CSP/isolation, cold-load/RSS/cancel, native parity and stable semantic mapping |
| Original OpenCascade.js | No new adoption | LGPL wrapper plus OCCT obligations; stale release lineage | REJECTED_FOR_NEW_PATH | A new maintenance case would be required before reconsideration |
| Three.js WebGLRenderer | Derived display adapter only; never geometry or selection identity authority | MIT screened; exact release unselected | HOLD | Exact package/lock/artifact hashes, browser/device matrix, semantic range mapping, context loss/RSS/performance and accessibility evidence |
| Three.js WebGPU | Deferred display experiment | MIT; implementation remains experimental | HOLD | Feature/fallback parity, tested browser floor, performance crossover and failure labels |
| Yjs | Presence/comments/offline metadata only; never geometry merge | MIT screened; provider/store unselected | HOLD | Exact version/provider, authorization/retention/privacy, causal/offline corpus and proof geometry commands remain serialized |
| OCCT STEP/XDE | Format-specific adapter worker; XDE remains transient exchange state | OCCT terms above; ISO schema/data redistribution posture unresolved | HOLD | Per AP203/AP214/AP242 direction/facet fixtures, exact build, header/profile/units/shape/assembly/PMI/loss receipts and independent parsing |
| STEPcode | Secondary syntax/schema comparator only | BSD-3-Clause; ISO schema redistribution rights unresolved | HOLD | Exact version/artifacts, permitted schema set, build and comparator disagreement policy |
| OpenCAMLib | Planning-only CAM experiment behind `ManufacturingAdapter/1`; never NC/machine/safety authority | LGPL-2.1 screened; exact release unselected | HOLD | Exact build/notice packet, bounded operation corpus, deviation/collision evidence and enforced zero-NC-output ceiling |
| Netgen | Future volume-mesh proof of concept | LGPL-2.1-only screen; exact release unselected | HOLD | Exact artifact/SBOM/notices, deterministic region mapping, mesh-quality corpus and resource recovery |
| Gmsh | Conditional comparator/adapter only | GPL-2.0-or-later with narrow linking exception, or commercial license | HOLD | Explicit approved licensing route, exact build/options and mesh equivalence/quality corpus |
| CalculiX | Future isolated solver baseline only | GPL-2.0-only screen | HOLD | Explicit approved licensing route, exact executable/deck parser, analytic benchmarks, convergence/resource/security and independent result verification |
| Elmer | Deferred multiphysics comparator | GPL-2.0-or-later; limited OCCT exception applies only to ElmerGUI | HOLD | Concrete requirement, explicit licensing route, exact build and per-study benchmark corpus |
| KiCad CLI/application | Allowlisted argv-only process/file boundary; source remains authoritative in KiCad | Application and bundled-library posture not screened for Forge distribution | HOLD | Exact application/build/library hashes, license/entitlement packet, supported syntax/profile fixtures, no-network execution, DRC/output comparison and crash recovery |
| Storage, identity, policy and external-system providers | Versioned replacement seams only; local synthetic path remains the only admitted path | Provider/store/IdP/PDP unselected | HOLD | Provider selection, data/region/egress/credential authority, exact licenses/contracts, fail-closed security corpus and reconciliation tests |

`BORROWED` in earlier research means a proposed responsibility boundary, not adoption. `DEFERRED`
means visible denominator scope that remains HOLD. Only a future immutable candidate receipt may
set `real_dependency_executed=true`; adopted/adapter leaves additionally require independent domain
verification before worst-child aggregation can treat them as implemented.
