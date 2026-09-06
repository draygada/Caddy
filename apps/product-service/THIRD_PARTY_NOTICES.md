# Distributed runtime third-party notices

This notice covers only content and Python packages distributed by the sanitized
CADdyDaddy Candidate 0.2 runtime bundle. The deployed bundle does not contain or install
`cadquery-ocp`, OCP, Open CASCADE Technology native libraries, or `core-kernel` source.
Their separate local build-time redistribution review remains unresolved and is not
represented as cleared here.

| Package | Exact version | License | Runtime purpose |
|---|---:|---|---|
| `annotated-types` | `0.8.0` | MIT | Pydantic constraint metadata |
| `anthropic` | `1.4.0` | MIT | Explicitly authorized live-classification adapter |
| `anyio` | `4.15.1` | MIT | Anthropic transport concurrency abstraction |
| `attrs` | `26.1.0` | MIT | Schema-validation dependency |
| `docstring-parser` | `0.18.0` | MIT | Anthropic SDK runtime dependency |
| `h11` | `0.16.0` | MIT | HTTP/1.1 transport codec |
| `httpcore2` | `2.12.0` | BSD-3-Clause | Anthropic HTTP transport core |
| `httpx2` | `2.12.0` | BSD-3-Clause | Anthropic HTTP client transport |
| `idna` | `3.19` | BSD-3-Clause | Internationalized host-name handling |
| `jiter` | `0.16.0` | MIT | Anthropic JSON parsing dependency |
| `jsonschema` | `4.25.1` | MIT | Product-owned contract validation |
| `jsonschema-specifications` | `2025.9.1` | MIT | JSON Schema vocabulary support |
| `pydantic` | `2.13.5` | MIT | Anthropic request and response models |
| `pydantic-core` | `2.46.5` | MIT | Pydantic validation runtime |
| `referencing` | `0.37.0` | MIT | JSON Schema reference resolution |
| `rfc8785` | `0.1.4` | Apache-2.0 | Canonical JSON hashing |
| `rpds-py` | `2026.6.3` | MIT | Immutable collections used by schema validation |
| `sniffio` | `1.3.1` | MIT OR Apache-2.0 | Async-library detection |
| `truststore` | `0.10.4` | MIT | Platform trust-store access |
| `typing-extensions` | `4.16.0` | PSF-2.0 | Python 3.12 typing compatibility |
| `typing-inspection` | `0.4.4` | MIT | Pydantic annotation inspection |

The Anthropic dependency is inert by default. A live request is admitted only after the exact
server authorization flag, model allowlist, API key, access token, and server budget settings are
present and the request token matches. This notice records distribution; it does not authorize use
or provider spend.

The bundle also carries the imported Tripwire `evaluate()` source identified by commit
`898f6167e4305a4f86f3ebe4a473278ffbd56530`, tree
`b8f32adddb0c9a894a41d15ead89b4cb1db91aed`, and its resolved file SHA-256 in
`bundle-manifest.resolved.json`. It carries no Tripwire rule corpus, CSL, PX4, or other
Tripwire datasets. This provenance statement does not add a public license or make a
legal conclusion about redistribution rights.

Browser assets and their applicable notice are recorded separately in
`apps/browser-workbench/THIRD_PARTY_NOTICES.md` inside the bundle.
