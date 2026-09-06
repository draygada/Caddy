# Contract, kernel, and deployment adoption decision

## Decision

- Use direct `cadquery-ocp-novtk==7.9.3.1` / OCCT `7.9.3` execution.
- Keep the service deterministic and stateless with exact base/candidate revision binding.
- Use the bounded `api.index:app` adapter for every deployed runtime.
- Treat Vercel as a size-qualified preview path and the digest-pinned OCI image as the operational
  fallback.
- Do not add build123d to this runtime. It remains API inspiration/secondary-adapter research,
  not a dependency or geometry authority.

This avoids a second geometry authority and preserves the existing service contracts. It does
not make OCP/OCCT a fully admitted production dependency.

## Proven boundaries

- Interchange: STEP AP242, IGES 5.3, and STL only.
- Constraint behavior: deterministic bounded Gauss-Newton solving for the admitted constraint set,
  with residual, equation-rank, and local Jacobian-rank degree-of-freedom diagnostics. This is not a
  general production constraint solver, and solved coordinates are not returned as a rewritten
  authoring document.
- Assembly behavior: deterministic bounded rigid placement for fixed, point, distance, and
  concentric mates, with axis alignment, local degree-of-freedom estimates, and conflict rejection;
  no general nonlinear assembly solving, kinematics, limits, or interference.
- Topology behavior: provenance-derived semantic IDs report preserved, remapped, lost, and new
  entities. Remapping is heuristic and does not claim perfect persistent naming across arbitrary
  OCCT enumeration or upstream topology changes.
- Transport: request and response bodies are bounded to 4,250,000 bytes by the deployment ASGI
  adapter. Larger CAD artifacts require a future object-storage reference contract.
- Vercel: measured Linux dependency closure is 265,146,169 logical bytes against the standard
  524,288,000-byte Python-function limit. Provider bundle tracing is not yet proven.
- OCI: Python `3.12.11`, Linux amd64, base-image manifest digest, OCP wheel URL, and OCP wheel hash
  are pinned. Image construction was not run because Docker is unavailable on the host.
- Redistribution: artifact evidence is **PASS** for the measured 70-ELF/22-component closure when
  the verifier succeeds and the complete release closure is packaged. Legal determination is
  **NOT_PERFORMED**, and repository-owner acceptance remains unrecorded.

Artifact evidence: **PASS**. Legal determination: **NOT_PERFORMED**. These statuses do not make the
overall candidate releasable.

## Promotion criteria

Technical Vercel preflight is PASS only when:

- `scripts/check_runtime_closure.py` reports the exact package set and a bundle below 500 MiB;
- deployment tests pass against `api.index:app`;
- both request and response oversize paths fail before Vercel's 4.5 MB ceiling;
- a Vercel-produced bundle confirms the locally measured headroom; and
- health, recompute, assembly, and exchange smoke checks pass in an immutable preview.

OCI preflight is PASS only when:

- the digest-pinned image builds for Linux amd64;
- it imports OCP and serves the health endpoint as the non-root user;
- the filesystem can run read-only with only `/tmp` writable;
- the installed closure and image SBOM are captured; and
- the replacement-wheel build argument is exercised with a verified alternate wheel.

Objective redistribution artifact evidence is PASS only when:

- every bundled native object has exact version/source/license/notice evidence;
- the evidence verifier passes against the installed runtime; and
- every release closure includes `licenses/**`, `THIRD_PARTY_NOTICES.md`, and
  `REDISTRIBUTION_EVIDENCE.md`.

Release approval remains HOLD until durable corresponding-source delivery is accepted, the
provider-produced artifact is checked, and the required repository-owner governance decision is
recorded. No legal determination is performed by these engineering checks.

Overall candidate release remains **HOLD** while any criterion above is missing. A readiness PASS
does not grant deployment authority.

## Reversal condition

Replace the adapter when an admitted geometry service exposes durable revision storage,
persistent topological naming, a production sketch/mate solver, and verified native
assembly/drawing/manufacturing exchange, or when packaging/relink obligations cannot be met for
the current wheel.

## Lane J2 native evidence update

The exact unmodified wheel is paired with a 70-ELF/22-component manifest, verbatim package notices,
the original auditwheel SBOM, and hash-verified corresponding-source coordinates under
`apps/cad-service/licenses/`. This closes the factual unidentified-component and
missing-source-artifact HOLDs when the service packages the complete release closure and its
verifier passes. Repository-owner acceptance remains an explicit human governance gate, not an
ungranted technical deployment-authority claim or a legal conclusion.
