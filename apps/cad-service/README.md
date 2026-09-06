# CAD authoring service candidate

This is a deterministic, stateless FastAPI adapter over Open CASCADE Technology (OCCT). It
executes real B-rep operations. It does not return fixture geometry or claim that an immutable
snapshot was recomputed.

## Current gates

| Gate | Status | Evidence |
|---|---|---|
| Local service and kernel tests | PASS | `apps/cad-service/tests/` |
| Standard Vercel Python size preflight | PASS | 265,146,169 logical bytes (252.863 MiB) for the pinned Linux x86_64 runtime dependencies against a 500 MiB limit |
| Vercel request/response payload preflight | PASS WITH BOUND | `api/index.py` rejects either direction above 4,250,000 bytes, below Vercel's 4.5 MB limit |
| Vercel provider build | NOT RUN | This lane does not deploy or mutate provider state |
| OCI definition | PASS WITH UNVERIFIED BUILD | Digest-pinned Dockerfile exists; Docker is unavailable on the measurement host |
| Runtime redistribution | ARTIFACT EVIDENCE PASS; RELEASE HOLD | The native closure is mapped and hash-verified; legal determination is not performed and repository-owner acceptance is unrecorded |

Artifact evidence: **PASS**. Legal determination: **NOT_PERFORMED**. The overall release gate is
**HOLD** because a provider-produced bundle and the required human governance decisions remain
unrecorded. Technical packaging evidence is not distribution approval.

## Run locally

```bash
uv sync --project apps/cad-service
uv run --project apps/cad-service uvicorn api.index:app --app-dir apps/cad-service
```

Endpoints:

- `GET /health`
- `GET /v1/capabilities`
- `POST /v1/recompute`
- `POST /v1/assemblies/solve`
- `POST /v1/exchange`

The deployment adapter buffers and bounds request and response bodies. CAD exchange or mesh
payloads that cannot fit below 4,250,000 bytes fail explicitly. Large artifacts need direct
object-storage upload/download with signed references; that path is not implemented here.

## Vercel preflight

Use `apps/cad-service` as the Vercel project root. Python `3.12` is pinned in
`.python-version`; `api/index.py` is the ASGI entrypoint; `vercel.json` routes all paths to it.
The official limits used by this packet are:

- <https://vercel.com/docs/functions/limitations>
- <https://vercel.com/docs/functions/runtimes/python>

Measure a Linux x86_64 install before any candidate promotion:

```bash
target="$(mktemp -d)/site"
uv pip install --target "$target" --python-version 3.12 \
  --python-platform x86_64-manylinux_2_31 --only-binary :all: \
  -r apps/cad-service/requirements.txt
python apps/cad-service/scripts/check_runtime_closure.py \
  --site-packages "$target" \
  --include apps/cad-service/cad_service \
  --include apps/cad-service/api \
  --include apps/cad-service/licenses
```

The recorded 2026-09-05 measurement used `uv 0.11.17`, CPython 3.12 wheel selection, and
`cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl` with SHA-256
`8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b`.

Do not release a provider artifact unless its closure includes `licenses/**`,
`THIRD_PARTY_NOTICES.md`, and `REDISTRIBUTION_EVIDENCE.md`, and the native evidence verifier
passes against the installed runtime. Those engineering checks do not provide legal approval or
repository-owner acceptance.

## OCI fallback

The image is fixed to Linux amd64 and the official Python
`3.12.11-slim-bookworm` manifest digest. The default OCP wheel URL and SHA-256 are also pinned.

```bash
docker build -f apps/cad-service/Dockerfile -t caddydaddy-cad-service:0.1.0 apps/cad-service
docker run --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  -p 8000:8000 caddydaddy-cad-service:0.1.0
```

To test a user-rebuilt or relinked OCP wheel, publish the exact wheel to an access-controlled
URL and pass both `OCP_WHEEL_URL` and `OCP_WHEEL_SHA256` as Docker build arguments. This is an
engineering replacement path, not a conclusion that redistribution requirements are met.

## Corresponding source access

The source fetcher records and verifies the exact OCP binding, OCP build system, and OCCT source
archives used for the adoption packet:

```bash
python apps/cad-service/scripts/fetch_corresponding_source.py \
  --destination /path/to/corresponding-source
```

GitHub archive availability alone is not treated as a durable source offer. Preserve verified
copies with any distributed artifact under the repository's approved source-access process.

## Executed candidate surface

- Arbitrary closed line, arc, and circle sketch loops on XY, XZ, or YZ planes.
- Deterministic bounded sketch solving for coincident, horizontal, vertical, parallel,
  perpendicular, equal, distance, radius, angle, and fixed constraints. Results include residual,
  equation-rank, local degree-of-freedom, under-constraint, and over-constraint diagnostics.
- Sketch, extrude, revolve, boolean union/cut/intersect, hole, fillet, chamfer, and rigid
  transform features in an ordered DAG.
- Multiple independent bodies.
- Assembly instances plus deterministic bounded rigid placement for fixed, point-coincident,
  distance, and concentric mates, including axis alignment, local degree-of-freedom estimates,
  and conflict rejection.
- OCCT-derived B-rep artifacts, bounds, topology, mass properties, triangle meshes, stable
  document/revision/geometry hashes, operation status, and diagnostics. Provenance-derived
  semantic topology IDs report preserved, remapped, lost, and new entities across revisions.
- STEP AP242, IGES 5.3, and STL import/export. STEP and IGES are re-imported as OCCT shapes; STL
  is explicitly mesh-only.

## Honest boundaries

- Sketch solving uses bounded Gauss-Newton iteration, and degree of freedom is a local
  Jacobian-rank estimate. It is not a general production constraint solver, and solved coordinates
  affect recomputed B-reps without rewriting the submitted authoring document.
- Mate solving is deterministic and bounded rigid resolution. It is not a general nonlinear
  assembly solver; kinematics, limits, and interference are not implemented.
- Semantic topology continuity is provenance-derived and heuristic. It reports remaps and losses
  explicitly but does not claim perfect persistent naming across arbitrary OCCT enumeration or
  upstream topology changes; feature selectors remain revision-bound.
- The stateless stale-base check proves consistency only for documents supplied in one request.
- STEP/IGES geometry does not imply native assembly structure, PMI, colors, constraints, feature
  history, or drawing fidelity. STL import is not editable B-rep geometry.
- Native CAD files, native assemblies, drawings, CAM/toolpaths, G-code, and manufacturing
  release outputs fail explicitly as unsupported.
- Frontend contracts and local tests do not by themselves prove that this service is reachable in
  a deployed candidate.

## Lane J2 redistribution evidence

The pinned OCP wheel is unchanged. Its standalone metadata is not a complete notice/source bundle.
The service supplement maps the measured native closure to notices and source coordinates, and the
verifier records `factual_evidence: PASS` and `legal_determination: NOT_PERFORMED`. Run
`scripts/verify_redistribution_evidence.py` against the Linux site-packages tree. Every release
closure must carry `licenses/**`, `THIRD_PARTY_NOTICES.md`, and
`REDISTRIBUTION_EVIDENCE.md`. A passing result closes objective artifact mapping only; it does not
make a legal determination, record repository-owner acceptance, or grant deployment authority.
