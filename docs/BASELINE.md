# Canonical capability baseline binding

Observed at `2026-09-05T14:58:49Z`.

| Field | Value |
|---|---|
| Canonical file | `/Users/benjihuh/Programming/Strafe/CAD_CAPABILITY_ATLAS_2026.md` |
| SHA-256 | `1f231b57dd2cb7fbe1cb427725d00890b6c9454ee25dba90a55a767bdcc44cb2` |
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

## Bootstrap delta D-004

The ground-zero market is small manufacturers, suppliers, new programs, and engineering teams before they have integrated PLM, ERP, MES, simulation, quality, or compliance organizations. Forge optimizes for institution formation and zero-to-first-controlled-release in low-volume/high-mix work, not hyperscale factory replacement.

The initial product thread begins with an RFQ, requirements, drawings, document bundle, imported model, or rough concept and carries explicit unknowns and review gates through editable design, revisioned BOM and make/buy state, preliminary process/work instructions, inspection/test, human review, and an immutable neutral release packet. External systems integrate incrementally. Notional/demo records cannot be presented as live supplier, inventory, cost, capacity, compliance, or quality facts. Compliance support is evidence organization and human-gated review, never an automatic legal conclusion.

This changes the target-user and acceptance framing only; it adds no geometry-kernel scope.

## Bootstrap delta D-005

The explicit architecture and demo loop is:

`idea/need -> requirements -> engineering model -> product structure -> sourcing/process -> authorized order send-off -> build -> inspect/test -> authorized release -> operational feedback`

Forge owns the versioned product thread across that loop. Shipyard is a read-only/evidence-driven projection of progress, blockers, authority, evidence, and verification; it cannot create Forge truth or imply a gate passed.

The sentence “We’re closing the loop from idea to execution for high-stakes industries” is approved positioning. Each concrete feature and demonstrated-loop claim remains evidence-bounded. It must not imply certification, regulatory approval, universal industry coverage, production safety, or validated solver accuracy.

## Bootstrap delta D-006

The loop includes authorized order send-off between sourcing/process and build. The product-thread schema must cover RFQ/quote/supplier selection plus purchase-order or internal-work-order generation tied to the exact approved design/BOM revision, recipient, quantity, content-addressed attachments, approvals, idempotency key, dispatch status, acknowledgment, exception, delivery/receiving, inspection, and closeout.

The hackathon gate uses a synthetic/local adapter and must prove one observable dispatch effect per idempotency key across retry, crash, timeout, and lost-response cases, plus explicit reconciliation for unknown/failed state. It cannot send externally. Any real RFQ/order/work-order communication remains a separately authorized action at send time.
