# QX-0 hardened drone CAD evidence

Status: **PASS** for the bounded local benchmark only.

## Reproduce

```sh
cd frontend && npx vite-node scripts/generate-hardened-drone-evidence.ts
npm test -- --run tests/hardened-drone-cad.test.ts
```

## Measured result

| Metric | Result |
|---|---:|
| BOM lines | 12 |
| Physical instances | 25 |
| CAD body definitions | 12 |
| Sketches | 14 |
| Features | 14 |
| Operations | 81 |
| Recorded mates | 24 |
| Mesh groups | 25 |
| Triangles | 1724 |
| Kernel errors | 0 |

## Acceptance checks

| ID | Result | Claim |
|---|---|---|
| CAD-01 | PASS | Twelve pinned CAD body definitions recomputed. |
| CAD-02 | PASS | Every physical part instance has evaluated geometry. |
| CAD-03 | PASS | The committed BOM has twelve named lines. |
| CAD-04 | PASS | Every non-grounded instance is connected by a recorded mate. |
| CAD-05 | PASS | Pinned input replays to identical document and mesh identities. |
| CAD-06 | PASS | The bounded 260-to-300 mm fixture span ablation changes document and mesh identities. |
| CAD-07 | PASS | Nominal fixture emits no kernel errors. |
| CAD-08 | PASS | Document, STL, and BOM artifacts have byte-level SHA-256 identities. |

## Pre-hackathon specification gap

| Capability | Status |
|---|---|
| multi-part drone CAD and twelve-line BOM | DEMONSTRATED_LOCAL_BOUNDED |
| fixture span drives geometry and invalidates hashes | DEMONSTRATED_FIXTURE_FACTORY_ONLY |
| generic editable driving dimensions | ABSENT |
| assembly instance transforms | DEMONSTRATED_LOCAL_BOUNDED |
| non-fixed mate solving and collision analysis | ABSENT |
| STL export | DEMONSTRATED_LOCAL_BOUNDED |
| STEP/IGES and production B-rep | ABSENT_NATIVE_DISCONNECTED |
| current-CAD Tripwire binding and edit invalidation | ABSENT |
| classification bound to current CAD revision | ABSENT |
| full-BOM sourcing and external ordering | ABSENT_ZERO_SEND_ONLY |
| durable signed multi-user product thread | ABSENT_MEMORY_ONLY_UNSIGNED |

## Boundaries

- Synthetic non-flight-capable geometry benchmark. Not a flightworthy design, manufacturing release, legal classification, or permission to build or operate an aircraft.
- The model uses inert solid envelopes and contains no flight-control logic, propulsion design, performance model, payload capability, or manufacturing release.
- Browser JSCAD mesh/CSG is not production B-rep authority. Dimensions and non-fixed mates are recorded but not solved.
- The fixture assumption that this data is non-controlled is not a legal classification.
