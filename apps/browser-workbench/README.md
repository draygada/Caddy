# Forge browser workbench

This lane provides a browser-side PartDocument authoring and review surface. The 3D scene, multiple
Part bodies, ordered operations, typed parameters, stable selection, and exact display-state truth
share one workbench.

## Evidence ceiling

The checked-in fixture and render model are **TARGET / SYNTHETIC browser evidence only**. They prove
interaction, presentation, stable-ID mapping, typed proposal handling, responsive behavior, and
failure recovery. They do not prove a core CAD kernel, B-rep authority, exchange correctness,
AssemblyDocument support, product-thread behavior, or compatibility with a shared wire contract.

The earlier cross-lane draft was superseded. Until the integration owner supplies an admitted
successor commit and exact receipt, this lane intentionally contains no final shared wire types or
adapter. `src/internal-scene.js` is a private presentation model, not a protocol proposal.

## Run and verify

Requires Node.js 22 or newer.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run test:perf
npm run serve
```

`npm run serve` binds to `127.0.0.1:4173` by default. Override the host or port with
`FORGE_WORKBENCH_HOST` and `FORGE_WORKBENCH_PORT`. The server sends a restrictive local CSP,
disables caching, and returns 404 for missing module assets instead of serving the HTML shell.

Useful synthetic review URLs:

- `/` — current multi-body PartDocument surface
- `/?scenario=queued` — queued attempt with the prior artifact marked stale
- `/?scenario=running` — running attempt with the prior artifact marked stale
- `/?scenario=failed` — failed attempt with separately identified last-valid geometry
- `/?scenario=stale` — stale artifact with authoring blocked
- `/?scenario=worker-crashed` — worker failure and explicit retry
- `/?renderer=fallback` — semantic 2D fallback without WebGL

## Browser architecture

- `internal-scene.js` validates PartDocument body identity, explicit document-frame transforms,
  triangle-to-entity mappings, source revisions, and renderable indexed meshes.
- `viewer.js` renders each body separately, maps ray hits to stable entity and semantic IDs, supports
  keyboard selection, and never mutates the source snapshot.
- `schema-form.js` renders payload editors from registry descriptors without operation-specific pages.
- `workbench-store.js` enforces CURRENT-only authoring, mobile review-only behavior, visibility,
  isolation, document scoping, and proposal-only mutations.
- `internal-fixture.js` supplies synthetic PartDocument, provenance, history, and diagnostic records.
  It is never treated as an authoritative core artifact.

When the successor contract is admitted, add a narrow boundary adapter that validates the exact
packet and projects it into the private render/store models. Do not weaken fail-closed identity
mapping, state-truth labeling, or the source-scene immutability invariant in that adapter.

## Known contract gaps

- No admitted core-kernel packet or shared boundary adapter exists in this lane.
- Recompute and worker transitions are browser simulations, not authoritative geometry execution.
- Mobile semantic-diff review and browser-driven accessibility/responsive automation remain unbuilt.
- Retired screenshots were removed because they depicted out-of-scope Assembly and product-thread UI.
