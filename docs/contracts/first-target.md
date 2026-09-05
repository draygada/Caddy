# First target contract: editable parametric part

- Contract ID: `FORGE-VS-001`
- Version: `0.1.0-draft`
- State: design contract; no implementation claim
- Baseline: external file and SHA-256 in `docs/BASELINE.md`

## User outcome

A small-team user can ingest a synthetic RFQ/requirement packet, build or import a simple bracket-like part, make and review a parameter change, recover from an invalid edit, and issue a first controlled neutral release packet. An authorized agent can propose the same typed change and product-thread records, but cannot bypass review or authorization.

The resulting CAD revision is one governed node in a versioned product thread. The slice traces one requirement through the affected design feature, a revisioned BOM/make-buy line, a preliminary process/work instruction, an inspection result, human review, and an immutable release-evidence record. Non-CAD records are synthetic/notional unless an authorized adapter supplies observed state; they prove schema/provenance behavior only and do not claim live ERP, MES, supply, production, quality, or compliance integrations.

The demo must traverse the full bounded loop: `idea/need -> requirements -> engineering model -> product structure -> sourcing/process -> authorized order send-off -> build -> inspect/test -> authorized release -> operational feedback`. Operational feedback is a sourced input to a new proposal; it cannot mutate an immutable released revision.

## Canonical minimum model

The versioned record must contain stable IDs and explicit dependencies for:

- document, units, parameters, sketches, sketch entities, constraints, features, and semantic topology references;
- revision, parent revision(s), proposal/change set, actor, intent, authorization, and timestamps;
- engine manifest (adapter, binding, OCCT/solver versions, image/toolchain identity, tolerances, deterministic settings);
- recompute attempt, per-feature results, diagnostic codes, current artifact, and separately identified last-valid artifact; and
- exports with requested format/options, units, source revision, content hash, semantic fingerprint, and verification result;
- source packet nodes for RFQ, requirement set, drawing/document, imported model, or concept, preserving assumptions, unknowns, gates, and acceptance criteria;
- product-thread links for requirement/scenario, design feature/model, revisioned BOM/make-buy/supply state, process/work order/instruction, assembly/inspection/test, human review, and immutable release evidence, each with source identity and `NOTIONAL | PROPOSED | OBSERVED | REVIEWED | VERIFIED | REJECTED | SUPERSEDED` disposition;
- operational-feedback nodes that identify the released revision, observation source, confidence, affected requirement/product-thread nodes, and resulting proposal or no-action disposition; and
- order nodes for `RFQ | PURCHASE_ORDER | INTERNAL_WORK_ORDER` with exact approved design/BOM revision, recipient, quantity/unit, content-addressed attachments, approvals, idempotency key, adapter identity, dispatch identity/status, acknowledgment, exception, delivery/receiving, inspection, and closeout.

Arbitrary Python/JavaScript/C++ source is not a canonical document field.

## Required workflow

1. Ingest a synthetic RFQ/requirement packet and preserve requirements, assumptions, unknowns, review gates, and acceptance criteria.
2. Create a sketch with lines and a circle on an explicit datum plane, or bind an imported neutral model to the same product-thread boundary.
3. Apply dimensional and geometric constraints sufficient to exercise under-constrained, fully solved, redundant, and contradictory states.
4. Produce an exact closed profile and extrude it into a valid solid.
5. Apply one downstream edge treatment: fillet or chamfer.
6. Select the treated topology in the browser through a stable artifact-to-entity mapping.
7. Edit a driving dimension and recompute from a clean worker.
8. Submit a deliberately invalid dimension or reference; identify the failing feature and blocked dependents while retaining the separately labeled last-valid view.
9. Correct or roll back the change without losing prior history.
10. Export STEP and STL with explicit units and verify them against the source revision.
11. Branch from a revision, propose a parameter change, show the semantic diff and predicted dependents, accept or reject it, and replay the accepted history.
12. Record distinct authorization lifecycle states and a complete provenance chain.
13. Trace one requirement through the design feature, revisioned BOM/make-buy line, and preliminary process/work instruction without fabricating live external-system state.
14. Surface one manufacturability or evidence gap, block release, route it to the declared human role, and show the authorized resolution or rejection.
15. Generate an RFQ, purchase order, or internal work order from the exact approved design/BOM revision; verify recipient, quantity, attachments, and approvals; and dispatch it through a local synthetic adapter exactly once.
16. Inject crash/timeout before dispatch and lost response after dispatch, retry with the same idempotency key, prove no duplicate observable send effect, and reconcile acknowledgment/exception, delivery/receiving, inspection, and closeout into the thread.
17. Authorize an immutable release packet only after its human/evidence gates pass.
18. Record synthetic operational feedback against the exact release, trace its impact to a new requirement/change proposal, and prove the released artifact remains immutable.

## Required state vocabulary

### Constraint result

`UNDER_CONSTRAINED | SOLVED | REDUNDANT | CONTRADICTORY | DEGENERATE | SOLVER_FAILED`

The result includes degrees of freedom where the chosen solver can establish them, a stable diagnostic code, implicated entity/constraint IDs, and human-readable guidance. A generic exception string is not a diagnostic contract.

### Recompute attempt

`QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED | TIMED_OUT | WORKER_CRASHED | STALE`

The document revision is never relabeled successful because a last-valid artifact exists.

### Topology resolution

`EXACT | HEURISTIC_CONFIRMED | AMBIGUOUS | MISSING | DELETED`

Only `EXACT` and explicitly confirmed heuristic mappings can feed an automatic downstream operation.

### Authorization lifecycle

`REQUESTED | AUTHORIZED | APPLIED | VERIFIED | REJECTED | ROLLED_BACK`

These are separate append-only observations. A requested or applied change is not inferred to be authorized or verified.

### Order lifecycle

`DRAFT | AWAITING_AUTHORIZATION | AUTHORIZED | DISPATCH_PENDING | DISPATCHING | DISPATCHED | ACKNOWLEDGED | EXCEPTION | DISPATCH_UNKNOWN | DELIVERED | RECEIVED | INSPECTED | CLOSED | CANCELLED`

The order packet is immutable after authorization except through an explicit superseding revision. Dispatch uses a durable idempotency key scoped to adapter, recipient, order type, and exact packet revision. Duplicate/retry calls must resolve to the original dispatch identity. A timeout or lost response becomes `DISPATCH_UNKNOWN` and requires adapter reconciliation; it must not trigger an unqualified second send.

## Proof gates

| Gate | Passing evidence |
|---|---|
| Geometry | Golden bracket remains valid; expected units, bounding box, volume, surface area, topology counts, and tolerance envelope match |
| Constraints | Fixtures cover every required state, reorder inputs, degenerate geometry, and at least three numeric scales with stable codes |
| Recompute | Clean-process replay matches semantic fingerprints; failing edit blocks dependents and preserves an honestly labeled last-valid result |
| Topology | Parameter edits preserve intended selections or produce explicit ambiguity/missing failure; no transient index is persisted |
| Exchange | STEP re-import passes OCCT shape validity and declared-unit checks; STL has expected watertightness/orientation and tessellation tolerances |
| History | Every result binds exact operations, parents, parameters, actor, authorization, engine manifest, and artifacts |
| Product thread | Every cross-stage edge identifies exact source and revision; unknown/notional/external states remain explicit and the CAD module cannot invent downstream completion |
| Controlled release | Neutral geometry, BOM, process/work instruction, inspection criteria, evidence, and approvals bind one immutable revision; an unmet human/compliance/evidence gate blocks release |
| Closed-loop trace | One idea/need reaches authorized release and sourced operational feedback; the feedback opens a new reviewable proposal without rewriting released history |
| Order send-off | Synthetic/local adapter produces exactly one observable dispatch per idempotency key; retry/lost-response/exception paths reconcile without duplicate send; exact approved revision, recipient, quantity, attachments, and approvals remain bound |
| Collaboration | Stale-base and noncommutative proposals cannot overwrite silently; rejection and rollback are replayable |
| Reliability | Timeout, worker crash, disconnect, malformed command, and stale client each produce tested recovery state |
| UX | Cold desktop user completes the workflow; mobile reviewer can inspect diff/diagnostics without authoring |
| Claim | Only the exact measured workflow advantage, if any, is stated after blind comparison |

## Determinism boundary

Mandatory equality under the same engine manifest:

- normalized canonical document/operation hash;
- ordered state transitions and diagnostic codes;
- validity, units, mass properties within declared tolerance, topology counts, and semantic topology mapping;
- canonical tessellation/geometry fingerprint after a defined normalization pass.

Byte-for-byte STEP equality is optional until its writer metadata and entity ordering are normalized and tested. If bytes differ but semantics match, both hashes and the reason are recorded.

## Explicit non-claims

This contract does not establish assemblies, production drawings, PMI/GD&T authoring or preservation, healing of arbitrary third-party STEP, large-model performance, production CAM/NC safety, engineering simulation accuracy, offline parity, simultaneous geometry editing, live supplier/ERP/MES/PLM state, automatic compliance/legal conclusions, hyperscale production, or superiority to an incumbent CAD suite.

The north-star sentence is valid positioning. Evidence supports only concrete features and the exact demonstrated loop, not certification, regulatory approval, universal coverage, production safety, or independently validated solver accuracy.
