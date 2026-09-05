# First target contract: editable parametric part

- Contract ID: `FORGE-VS-001`
- Version: `0.1.0-draft`
- State: design contract; no implementation claim
- Baseline: external file and SHA-256 in `docs/BASELINE.md`

## User outcome

A human can build a simple bracket-like part from a constrained sketch, make and review a parameter change, recover from an invalid edit, and export trustworthy geometry. An authorized agent can propose the same typed change, but cannot bypass review or authorization.

The resulting CAD revision is one governed node in a versioned product thread. The slice also traces one requirement through the affected design feature, a notional BOM line, a notional manufacturing step, an inspection result, and an immutable release-evidence record. These trace nodes prove schema/provenance behavior only; they do not claim live ERP, MES, supply, production, or quality integrations.

## Canonical minimum model

The versioned record must contain stable IDs and explicit dependencies for:

- document, units, parameters, sketches, sketch entities, constraints, features, and semantic topology references;
- revision, parent revision(s), proposal/change set, actor, intent, authorization, and timestamps;
- engine manifest (adapter, binding, OCCT/solver versions, image/toolchain identity, tolerances, deterministic settings);
- recompute attempt, per-feature results, diagnostic codes, current artifact, and separately identified last-valid artifact; and
- exports with requested format/options, units, source revision, content hash, semantic fingerprint, and verification result.
- product-thread links for requirement/scenario, design feature/model, BOM/supply state, process/work order, assembly/inspection/test, and immutable release evidence, each with source identity and disposition.

Arbitrary Python/JavaScript/C++ source is not a canonical document field.

## Required workflow

1. Create a sketch with lines and a circle on an explicit datum plane.
2. Apply dimensional and geometric constraints sufficient to exercise under-constrained, fully solved, redundant, and contradictory states.
3. Produce an exact closed profile and extrude it into a valid solid.
4. Apply one downstream edge treatment: fillet or chamfer.
5. Select the treated topology in the browser through a stable artifact-to-entity mapping.
6. Edit a driving dimension and recompute from a clean worker.
7. Submit a deliberately invalid dimension or reference; identify the failing feature and blocked dependents while retaining the separately labeled last-valid view.
8. Correct or roll back the change without losing prior history.
9. Export STEP and STL with explicit units and verify them against the source revision.
10. Branch from a revision, propose a parameter change, show the semantic diff and predicted dependents, accept or reject it, and replay the accepted history.
11. Record distinct authorization lifecycle states and a complete provenance chain.
12. Trace one requirement through the design feature, BOM line, manufacturing step, inspection result, and immutable release-evidence record without fabricating live external-system state.

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

This contract does not establish assemblies, production drawings, PMI/GD&T authoring or preservation, healing of arbitrary third-party STEP, large-model performance, production CAM/NC safety, engineering simulation accuracy, offline parity, simultaneous geometry editing, or superiority to an incumbent CAD suite.
