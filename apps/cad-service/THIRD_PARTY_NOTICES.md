# CAD service dependency adoption record

Status: engineering adoption for local candidate execution; redistribution remains **HOLD**.

| Dependency | Exact version | License evidence | Use |
|---|---:|---|---|
| `cadquery-ocp-novtk` | 7.9.3.1 | CadQuery/OCP tag `7.9.3.1`, Apache-2.0 | Python bindings and bundled native libraries |
| Open CASCADE Technology | 7.9.3 | LGPL-2.1 with OCCT exception 1.0 | B-rep kernel, meshing, STEP, IGES, and STL |
| `fastapi` | 0.116.1 | MIT | HTTP/ASGI adapter |
| `pydantic` | 2.11.7 | MIT | Strict request and response validation |
| `uvicorn` | 0.35.0 | BSD-3-Clause | Development server only |
| `pytest` | 8.4.2 | MIT | Test only |
| `httpx` | 0.28.1 | BSD-3-Clause | Test only |

The OCCT/OCP identity and source hashes were already inspected in
`packages/core-kernel/THIRD_PARTY_NOTICES.md`; this lane adopts that exact kernel version rather
than introducing a second geometry runtime. No third-party source or license text is copied
here. `uv.lock` pins resolved artifacts and hashes.

Before binary/runtime redistribution, preserve the required notices and license access, provide
the corresponding OCCT source as required, establish an approved relink/replaceability path,
and obtain repository license-authority approval. This is engineering evidence, not legal advice
or distribution approval.
