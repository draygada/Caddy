# Repository operating contract

This file governs the entire Strafe Forge repository.

## Authority and scope

- Current explicit human instructions outrank this file.
- This repository is a separate CAD product. Do not edit `strafe-atlas`, the canonical Strafe product repository, deployment providers, domains, credentials, production data, or customer data from a Forge lane.
- Local implementation and commits require exact lane custody. Push, merge to `main`, deployment, publication, spending, credential use, and promoted claims require separate explicit authority.
- Real RFQ, purchase-order, internal-work-order, supplier, customer, or other external communication requires separate exact send authority. A generated packet, `AUTHORIZED` local record, synthetic adapter receipt, or retry token is not external-send authority.
- The repository currently has no selected public license. Do not describe it as open source or copy third-party code into it. Dependency use requires an exact-version license and transitive-notice review.

## Truth and claims

- The capability denominator and claim ceiling are the external file bound in `docs/BASELINE.md`. Never fork or silently restate that denominator.
- Record new research as a dated, sourced delta. `NATIVE`, `BORROWED`, `INTEGRATED`, `DEFERRED`, and `REJECTED` are dispositions, not completion evidence.
- A dependency, adapter stub, passing unit test, rendered mesh, or imported file is not proof that a CAD workflow works.
- No global-superiority, incumbent-replacement, manufacturing-safety, simulation-accuracy, PMI-preservation, or deterministic-byte-output claim is permitted without its named gate evidence.
- Compliance support may organize evidence, citations, policy gates, review obligations, and claim ceilings. It must never emit or imply automatic legal, export-control, certification, or safety conclusions.

## Architecture invariants

- The canonical record is typed data: stable IDs, parameters, constraints, ordered features, explicit dependencies, schema version, actor/authorization provenance, and parent revision. Never persist arbitrary executable code as the model of record.
- The unifying record is a versioned product thread from source RFQ/requirements through design, BOM/make-buy, sourcing/process, authorized order send-off, build, inspection/test, human review, immutable release evidence, and operational feedback. Live external state must remain explicitly unintegrated until observed through an authorized adapter.
- Exact B-rep and exchange are server-authoritative for the first contract. Browser meshes and any future WASM kernel are derived previews and cannot commit geometry truth.
- Geometry commands are validated and serialized. Presence/comments may use a CRDT; noncommutative geometry operations may not be silently CRDT-merged.
- A topological reference must be semantic and lineage-aware. Transient face/edge indices are never durable IDs. Ambiguous or missing remaps fail visibly.
- Recompute is transactional. A failed run cannot overwrite canonical input or masquerade as success; any displayed last-valid artifact is labeled with the revision that produced it.
- Every result records the operation/document hash, exact dependency/kernel build, tolerances, platform image, diagnostics, and content/semantic artifact hashes.

## Lane custody

- `governance/custody.v1.json` is the path authority. A lane may write only its allowlist on its exact branch and exact worktree.
- Each builder must first fill its receipt with a unique writer/task identity, acquisition time, expiry/renewal time, and immutable base commit. An unassigned or expired receipt is blocking, not available custody.
- Shared root files, root lockfiles, shared schemas, generated clients, release refs, and deployment state are single-integrator paths. Propose shared-contract changes inside the lane handoff; do not edit them from a lane.
- Before handoff, run `python3 tools/check_custody.py --lane <lane> --base <receipt.base_commit>` and attach its output, Git status, candidate commit, tests, remaining unknowns, and rollback instructions.
- A worktree or branch name is not custody by itself. Never take over a stale receipt silently.
- Keep the receipt's `now_observation` browser-safe and evidence-linked under `docs/contracts/now-observation.md`. Update it only for a material source observation, not as a synthetic heartbeat. Preserve `MEASURED`, `INFERRED`, and `UNKNOWN`; do not put absolute paths, prompts, transcript bodies, secrets, or sensitive snippets in that object.
- Shipyard's Now view is a read-only projection of source receipts. Build is intended plan/design. Neither queued work nor a plan can be promoted to observed progress, and Now never becomes a second state or authorization authority.

## Verification expectations

- Geometry fixtures assert validity, units, bounding box, volume, area, topology counts, tolerances, and expected failure classifications. Byte hashes are asserted only after proving the format writer is canonicalized.
- Constraint fixtures cover solved, under-constrained, redundant, contradictory, degenerate, scale-extreme, and reorder cases with stable diagnostic codes.
- Replay starts from a clean process and pinned dependency image. Cross-process results compare semantic geometry fingerprints even where container metadata prevents byte identity.
- Browser tests use stable entity mappings from kernel artifacts and cover stale results, worker/service failure, keyboard access, responsive review, and WebGL fallback.
- History tests cover stale-base proposals, noncommutative conflicts, rejection, rollback, interrupted apply, and exact provenance.
