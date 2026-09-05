# Strafe Forge core-kernel spike

This package is a server-side, exact-geometry spike over OCP/OCCT. It owns geometry
execution and geometry evidence only. Its Python records are lane-internal; they are not
the integration-owned PartDocument/history wire contract.

## Demonstrated vertical spine

- RFC 8785 geometry and operation hashes over an ordered, typed dependency graph.
- Exact rational parameter literals/expressions with dimensional checks and stable
  cycle, missing-value, divide-by-zero, and type diagnostics.
- A `(type, type_version)` operation registry that accepts extensions without edits to
  the evaluator.
- Real OCCT B-rep handlers for box, cylinder, rectangle/circle profile, extrude,
  revolve, union/cut/intersection, fillet, chamfer, translate, rotate, uniform scale,
  and linear pattern.
- Multiple terminal solid bodies in one part artifact, each with a stable body ID,
  content hash, bounds, topology counts, mass facts, and semantic fingerprint.
- Semantic references based on feature/role/lineage; durable ordinal/index fields are
  rejected. Generated, modified, deleted, missing, and ambiguous paths are tested.
- Transactional recompute: failed operations block dependents; a separately
  revision-bound last-valid artifact survives a canonical checkpoint and fresh-process
  restore.
- Content-addressed binary B-rep artifacts and deterministic derived viewport packets
  with semantic triangle ranges.
- Real STEP AP203/AP214/AP242 write/read and geometry comparison; real binary/ASCII STL
  parsing, write/read, watertightness, outward-orientation, and bounds checks.

## Reproduce

From the repository worktree:

```bash
uv sync --project packages/core-kernel --group dev --locked
packages/core-kernel/.venv/bin/pytest tests/core-kernel -q
uvx --from ruff==0.12.11 ruff check packages/core-kernel/src tests/core-kernel
```

The lock is platform-complete. The measured packet uses CPython 3.12.13 on macOS
26.5.2 arm64 and the exact macOS arm64 OCP wheel recorded in
`evidence/runtime-manifest.v1.json`.

## Boundaries and honest limits

- No constraint solver is adopted. Rectangle/circle profiles are constructed, not a
  claim of PlaneGCS/CadQuery constraint-state coverage. UNDER_CONSTRAINED, REDUNDANT,
  CONTRADICTORY, DEGENERATE, DOF, drag, and solver-conflict diagnostics remain HOLD.
- Semantic roles plus OCCT `Generated`/`Modified`/`IsDeleted` history cover the bounded
  handlers. This does not solve general topological naming, and ambiguity fails closed.
- Boolean tolerance is fixed at 0.0000001 mm for the spike; no broad tolerance corpus or
  healing policy is claimed.
- STEP proves exact compound geometry and units, not XDE product hierarchy, colors,
  names, PMI, or assembly/BOM round-trip fidelity. STL import remains mesh-only and
  cannot feed exact operations.
- Execution is directly in the calling process. Tests launch clean processes for replay
  and recovery, but a resource-limited crash/timeout worker supervisor is not included.
- No container image is pinned. The manifest says `UNCONTAINERIZED` and evidence applies
  only to the measured runtime until another platform is independently replayed.
- The selected OCP wheel is reproducibly hashed, but omits embedded license metadata and
  license files. Evaluation can continue from pinned upstream sources; distribution
  remains HOLD until the notice/source/relink packet is independently approved.
- `PartProgram` is a lane-local geometry projection, not a shared `PartDocument` wire
  contract. Shared adapters remain intentionally absent until integration owns that
  seam.

See `evidence/known-failures.v1.json`, `evidence/golden-fixtures.v1.json`, and
`THIRD_PARTY_NOTICES.md` for the bounded evidence and gates.
