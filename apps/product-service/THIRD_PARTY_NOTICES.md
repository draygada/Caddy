# Distributed runtime third-party notices

This notice covers only content and Python packages distributed by the sanitized
CADdyDaddy Candidate 0.1 runtime bundle. The deployed bundle does not contain or install
`cadquery-ocp`, OCP, Open CASCADE Technology native libraries, or `core-kernel` source.
Their separate local build-time redistribution review remains unresolved and is not
represented as cleared here.

| Package | Exact version | License | Runtime purpose |
|---|---:|---|---|
| `attrs` | `26.1.0` | MIT | Schema-validation dependency |
| `jsonschema` | `4.25.1` | MIT | Product-owned contract validation |
| `jsonschema-specifications` | `2025.9.1` | MIT | JSON Schema vocabulary support |
| `referencing` | `0.37.0` | MIT | JSON Schema reference resolution |
| `rfc8785` | `0.1.4` | Apache-2.0 | Canonical JSON hashing |
| `rpds-py` | `2026.6.3` | MIT | Immutable collections used by schema validation |
| `typing-extensions` | `4.16.0` | PSF-2.0 | Python 3.12 typing compatibility |

The bundle also carries the imported Tripwire `evaluate()` source identified by commit
`898f6167e4305a4f86f3ebe4a473278ffbd56530`, tree
`b8f32adddb0c9a894a41d15ead89b4cb1db91aed`, and its resolved file SHA-256 in
`bundle-manifest.resolved.json`. It carries no Tripwire rule corpus, CSL, PX4, or other
Tripwire datasets. This provenance statement does not add a public license or make a
legal conclusion about redistribution rights.

Browser assets and their applicable notice are recorded separately in
`apps/browser-workbench/THIRD_PARTY_NOTICES.md` inside the bundle.
