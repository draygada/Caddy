# CAD service dependency and redistribution engineering record

Status: local execution **PASS**; technical Vercel size preflight **PASS**; redistribution
**HOLD**.

This record reports engineering facts and unresolved gates. It is not legal advice, a license
interpretation, or distribution approval.

## Geometry stack identity

| Layer | Exact identity | Upstream license evidence | Runtime disposition |
|---|---|---|---|
| OCP Python binding | `cadquery-ocp-novtk==7.9.3.1`; OCP commit `d69b064a3a604ebf245b1f3b14fb54c835a3a571` | Apache-2.0 file SHA-256 `a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd` | Shipped by wheel; installed wheel metadata has no license field and no license file |
| OCP wheel build system | commit `648499040b66a769293edfa844ff170ff8046619` | Apache-2.0 file SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` | Used to construct and repair the upstream wheel |
| Open CASCADE Technology | `7.9.3`; commit `a016080bf6738d6aeae020badee4e888ad1540a5` | LGPL-2.1 text SHA-256 `e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c`; OCCT exception 1.0 SHA-256 `04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b` | Bundled shared libraries execute B-rep, meshing, STEP, IGES, and STL operations |
| build123d | Not present in `pyproject.toml`, `uv.lock`, `requirements.txt`, or measured runtime | Upstream repository declares Apache-2.0 and includes a NOTICE | Not redistributed by this service; adding it requires a separately pinned version, license/NOTICE packet, closure measurement, and approval |

Primary upstream evidence:

- <https://github.com/CadQuery/OCP/tree/d69b064a3a604ebf245b1f3b14fb54c835a3a571>
- <https://github.com/CadQuery/ocp-build-system/tree/648499040b66a769293edfa844ff170ff8046619>
- <https://github.com/Open-Cascade-SAS/OCCT/tree/a016080bf6738d6aeae020badee4e888ad1540a5>
- <https://dev.opencascade.org/doc/overview/html/index.html>
- <https://github.com/gumyr/build123d>

The exact official license texts used by this packet are under `licenses/`.

## Corresponding source packet

The source-fetch tool verifies these observed 2026-09-05 archive identities:

| Archive | Bytes | SHA-256 |
|---|---:|---|
| OCP commit `d69b064...` | 3,728,128 | `a5153cef9f4a3a3dbbb1d498a971206a6c35dc4d829e7e011f96e0539c22e616` |
| OCP build system commit `6484990...` | 1,380,634 | `103558026783449a3d9cd442dc2b741992520a1c436f5cf017a1f3a98fa0107e` |
| OCCT commit `a016080...` | 48,610,707 | `c533f2667b59921bd6bd40ce82e7b9900b0289ccc731af5fdeeba097de80ef0f` |

The fetcher is a reproducibility aid. The project must preserve verified source copies through
an approved, durable source-access channel before redistributing the runtime.

## Runtime Python closure

`requirements.txt` and `requirements-runtime.txt` pin the deployment closure:

| Package | Version | Installed metadata / upstream license |
|---|---:|---|
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| cadquery-ocp-novtk | 7.9.3.1 | Undeclared in wheel metadata; Apache-2.0 upstream binding plus transitive native terms |
| cadquery-ocp-proxy | 7.9.3.1 | Undeclared in wheel metadata; Apache-2.0 upstream build system |
| click | 8.5.0 | BSD-3-Clause |
| fastapi | 0.116.1 | MIT upstream; wheel includes license file |
| h11 | 0.16.0 | MIT |
| idna | 3.19 | BSD-3-Clause |
| pydantic | 2.11.7 | MIT |
| pydantic-core | 2.33.2 | MIT |
| starlette | 0.47.3 | BSD-3-Clause |
| typing-extensions | 4.16.0 | PSF-2.0 |
| typing-inspection | 0.4.4 | MIT |
| uvicorn | 0.35.0 | BSD-3-Clause |

Test-only packages are not included in the deployment requirements.

## Measured Linux wheel and closure

- Wheel: `cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl`
- Wheel bytes: `67,439,751`
- Wheel SHA-256: `8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b`
- Installed runtime logical bytes: `265,146,169` (`252.863 MiB`)
- Installed runtime allocated bytes: `271,974,400` (`265,600 KiB`)
- Standard Vercel Python function limit: `524,288,000` bytes (`500 MiB`)
- Logical headroom before application files: `259,141,831` bytes (`247.137 MiB`)
- Official limit evidence: <https://vercel.com/docs/functions/limitations>

This is a local package-layout preflight, not a Vercel-produced function bundle. A provider build
must still demonstrate the traced function remains below the limit.

## Dynamic-link observations

The Linux closure contained 70 ELF shared objects: one OCP extension and 69 bundled native
libraries. `pyelftools` inspection recorded:

- `OCP/OCP.cpython-312-x86_64-linux-gnu.so` has `DT_RPATH` set to
  `$ORIGIN/../cadquery_ocp_novtk.libs`.
- That extension declares direct dependencies on the bundled OCCT `libTK*` libraries plus
  `libstdc++`, `libm`, `libgcc_s`, and `libc`.
- 68 bundled objects have `DT_RUNPATH`; the OCCT kernel libraries resolve through the wheel's
  hashed `cadquery_ocp_novtk.libs` names.
- Setting `LD_LIBRARY_PATH` alone is not accepted as a proven replacement mechanism because the
  extension uses `DT_RPATH` and hashed dependency names.
- The supported engineering replacement route is to rebuild/repair an OCP wheel against the
  desired ABI-compatible OCCT build, verify that wheel, and rebuild the image with the exact
  replacement URL and hash through `OCP_WHEEL_URL` and `OCP_WHEEL_SHA256`.

## Native SBOM gap

The wheel includes `auditwheel.cdx.json` with SHA-256
`9acbb7d86c746873c40a970bd1afc89855986aa1e5b9ae85e6a53032f7201b10`. It lists 19 components,
including FreeImage, OpenEXR/IlmBase, WebP, LibRaw, Little CMS, OpenJPEG, TIFF, JPEG Turbo, PNG,
JBIG, FreeType, Fontconfig, and JPEG XR packages. Every component's license field is undeclared.
The wheel also contains bundled `libgomp`, `liblzma`, `libuuid`, and `libzstd` objects that are
not represented as separately licensed components in that SBOM summary.

Therefore the native transitive notice/source map is incomplete. This is the controlling
redistribution blocker even though the OCP, OCP build-system, and OCCT primary license files are
now preserved.

## Required artifacts and gates

Redistribution remains HOLD until all items below are evidenced:

- PASS: exact runtime versions and Linux wheel hash are pinned.
- PASS: official OCP Apache-2.0, OCCT LGPL-2.1, and OCCT exception texts are bundled.
- PASS: exact OCP, OCP build-system, and OCCT source archives can be fetched and hash-verified.
- PASS: a replacement-wheel build input exists for the OCI path.
- PASS: Vercel size and 4.5 MB transport boundaries have local checks.
- HOLD: every bundled native library needs an exact source/version/license/notice mapping.
- HOLD: corresponding source copies need an approved durable publication or delivery location.
- HOLD: the rebuilt/relinked wheel path needs an executed clean-room proof and ABI smoke test.
- HOLD: repository license authority has not approved runtime redistribution.
- HOLD: no provider-produced Vercel bundle or OCI image has been captured and checked.

PASS may be recorded only when every HOLD above is replaced by an evidence pointer and the
repository license authority records approval. Deployment authority is a separate gate.
