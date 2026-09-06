# CAD authoring service candidate

This lane is a deterministic, stateless FastAPI adapter over OpenCascade. It executes real
B-rep operations; it does not return fixture geometry or claim that an immutable snapshot was
recomputed.

## Run

```bash
uv sync --project apps/cad-service
uv run --project apps/cad-service uvicorn cad_service.app:app --app-dir apps/cad-service
```

Endpoints:

- `GET /health`
- `GET /v1/capabilities`
- `POST /v1/recompute`
- `POST /v1/assemblies/solve`
- `POST /v1/exchange`

The recompute request carries both the exact base document and edited candidate. The service
recomputes the base revision hash, rejects a stale expected base, validates the candidate's
parent revision, validates its ordered dependency graph, then runs every enabled operation.
No server-side document state is implied.

## Executed candidate surface

- Arbitrary closed line/arc/circle sketch loops on XY, XZ, or YZ planes.
- Constraint validation for coincident, horizontal, vertical, distance, equal-length, radius,
  parallel, perpendicular, and angle constraints.
- Sketch, extrude, revolve, boolean union/cut/intersect, hole, fillet, chamfer, and rigid
  transform features in an ordered DAG.
- Multiple independent bodies.
- Assembly instances plus fixed, point-coincident, distance, and already-parallel concentric
  mates.
- OCCT-derived B-rep artifacts, bounds, topology, mass properties, triangle meshes, stable
  document/revision/geometry hashes, operation status, and diagnostics.
- STEP AP242, IGES 5.3, and STL import/export. STEP and IGES are re-imported as exact OCCT
  shapes; STL is explicitly mesh-only.

## Honest boundaries

- Constraints are checked against authored coordinates; this candidate does not solve an
  under-constrained sketch or move geometry to satisfy dimensions.
- Mate solving is deterministic and deliberately bounded. Concentric axes must already be
  parallel; general multi-mate nonlinear solving, kinematics, limits, and interference are not
  implemented.
- Fillet/chamfer edge selectors are revision-bound edge indices or `ALL`; persistent topological
  naming across arbitrary upstream topology changes is not implemented.
- The stateless stale-base check proves consistency of the documents supplied in one request;
  persistence, locks, merge/rebase, authorization, and multi-user history belong to another
  service.
- STEP/IGES exact geometry does not imply native assembly structure, PMI, colors, constraints,
  feature history, or drawing fidelity. STL import is not editable B-rep geometry.
- Native CAD files, native assemblies, drawings, CAM/toolpaths, G-code, and manufacturing
  release outputs fail explicitly as unsupported.
- This service is not connected to the shipped frontend in this lane.
