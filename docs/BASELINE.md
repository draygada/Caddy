# Canonical capability baseline binding

Observed at `2026-09-05T14:47:00Z`.

| Field | Value |
|---|---|
| Canonical file | `/Users/benjihuh/Programming/Strafe/CAD_CAPABILITY_ATLAS_2026.md` |
| SHA-256 | `c84b2726040b1e09847dda853818c75958a007b3d82bee3d89f83440d24f2877` |
| Role | Capability denominator, first-vertical-slice scope, proof gates, and claim ceiling |
| Owner | Upstream Strafe/SHIP governance; this repository is a consumer |

Forge must ingest this file by reference. It must not copy the denominator, reclassify a capability as complete, or loosen the claim ceiling locally. If the path is absent or the hash changes, automated status projection must report `STALE_BASELINE` and stop claim promotion until a human-reviewed delta is recorded.

## Bootstrap delta D-001

The baseline identifies Replicad/OCCT-WebAssembly as the fastest browser modeling proof and CadQuery/OCP as a server fallback. This repository narrows the first authoritative path to a pinned server-side OCP/OCCT adapter, while retaining Replicad only as a deferred, non-authoritative preview experiment.

Reason: the first target requires one replay authority, exact export provenance, transactional failure handling, and comparable golden results. Making both WebAssembly and native kernels authoritative before cross-backend equivalence is proven would create kernel-version, tolerance, ordering, performance, and artifact drift. A browser worker can be promoted later only after it passes the same corpus and never creates two concurrent sources of geometry truth.

This is an implementation-order delta, not a denominator or claim-ceiling change.

## Bootstrap delta D-002

OCCT exposes OCAF naming/evolution machinery and many algorithms expose `Generated`, `Modified`, and `IsDeleted`, but this does not prove durable naming for every operation. A current upstream issue documents inconsistent history implementations across some `BRepBuilderAPI` classes. Forge therefore treats topology preservation as native policy plus kernel evidence, with an explicit ambiguous-reference failure state; it does not mark robust topological naming `INTEGRATED` at bootstrap.

This tightens the proof requirement and does not change the denominator.

## Bootstrap delta D-003

The updated baseline makes a versioned product thread the unifying object and assigns the initial cross-stage schema/provenance work to the history/collaboration lane. Forge therefore treats the CAD document and artifacts as governed nodes in a broader trace:

`requirement/scenario -> design feature/model -> BOM/supply state -> process/work order -> assembly/inspection/test -> immutable release evidence`

Core-kernel owns geometry computation and geometry evidence only. Browser-workbench owns interaction and presentation only. History/collaboration owns the initial product-thread schema, revision semantics, and cross-stage provenance. Public Anduril ArsenalOS material is inspiration for operating principles only; no affiliation, compatibility, equivalence, or proprietary implementation knowledge is asserted.
