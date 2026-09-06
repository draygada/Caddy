# CAD service dependency and redistribution engineering record

Status: local execution **PASS**; technical Vercel size preflight **PASS**; artifact evidence
**PASS**; legal determination **NOT_PERFORMED**; release approval **HOLD**.

Artifact evidence: **PASS**. Legal determination: **NOT_PERFORMED**.

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

The exact license and notice evidence used by this packet is under `licenses/`. Any release closure
must include `licenses/**`, this `THIRD_PARTY_NOTICES.md`, and
`REDISTRIBUTION_EVIDENCE.md`; omitting any of the three makes the artifact evidence incomplete.

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
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| cadquery-ocp-novtk | 7.9.3.1 | Undeclared in wheel metadata; Apache-2.0 upstream binding plus transitive native terms |
| cadquery-ocp-proxy | 7.9.3.1 | Undeclared in wheel metadata; Apache-2.0 upstream build system |
| click | 8.5.0 | BSD-3-Clause |
| fastapi | 0.141.1 | MIT upstream; wheel includes license file |
| h11 | 0.16.0 | MIT |
| idna | 3.19 | BSD-3-Clause |
| pydantic | 2.13.5 | MIT |
| pydantic-core | 2.46.5 | MIT |
| starlette | 1.6.0 | BSD-3-Clause |
| typing-extensions | 4.16.0 | PSF-2.0 |
| typing-inspection | 0.4.4 | MIT |
| uvicorn | 0.52.4 | BSD-3-Clause |

Test-only packages are not included in the deployment requirements.

Security observation (2026-09-06): `pip-audit==2.10.0` reports no known vulnerabilities in
this exact runtime requirements closure. The prior `starlette==0.47.3` closure produced eight
records, including `GHSA-86qp-5c8j-p5mr` / `PYSEC-2026-161`; GitHub records `1.0.1` as the first
patched Starlette release for that advisory. This is a time-bounded engineering observation, not
a legal determination or a guarantee against undisclosed vulnerabilities.

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

## Wheel-alone SBOM gap and service supplement

The wheel includes `auditwheel.cdx.json` with SHA-256
`9acbb7d86c746873c40a970bd1afc89855986aa1e5b9ae85e6a53032f7201b10`. It lists 19 components,
including FreeImage, OpenEXR/IlmBase, WebP, LibRaw, Little CMS, OpenJPEG, TIFF, JPEG Turbo, PNG,
JBIG, FreeType, Fontconfig, and JPEG XR packages. Every component's license field is undeclared.
The wheel also contains bundled `libgomp`, `liblzma`, `libuuid`, and `libzstd` objects that are
not represented as separately licensed components in that SBOM summary.

The wheel alone therefore has an incomplete native transitive notice/source map. The service
supplement under `licenses/` maps all 70 measured ELF files to 22 components and source sets. The
repository verifier checks that supplement and reports artifact evidence **PASS** while reporting
legal determination **NOT_PERFORMED**. This factual closure does not itself authorize
redistribution.

## Required artifacts and gates

Artifact evidence is **PASS** for the measured closure when the verifier succeeds and the complete
release closure is present. Release approval remains **HOLD** until the separate provider and human
governance gates below are resolved:

- PASS: exact runtime versions and Linux wheel hash are pinned.
- PASS: official OCP Apache-2.0, OCCT LGPL-2.1, and OCCT exception texts are bundled.
- PASS: exact OCP, OCP build-system, and OCCT source archives can be fetched and hash-verified.
- PASS: a replacement-wheel build input exists for the OCI path.
- PASS: Vercel size and 4.5 MB transport boundaries have local checks.
- PASS: all 70 measured native files have exact component, source, license/notice, and hash records
  in the service supplement.
- PASS: the verifier reports `factual_evidence: PASS` and
  `legal_determination: NOT_PERFORMED` for the measured closure.
- REQUIRED IN EVERY RELEASE CLOSURE: `licenses/**`, `THIRD_PARTY_NOTICES.md`, and
  `REDISTRIBUTION_EVIDENCE.md`.
- HOLD: an approved durable publication or delivery location for corresponding source is
  unrecorded.
- HOLD: repository-owner acceptance of the applicable obligations is unrecorded; no legal
  determination has been performed.
- HOLD: no provider-produced Vercel bundle or OCI image has been captured and checked.

Release approval may be recorded only when every release HOLD above is replaced by an evidence
pointer and the required human decision is recorded. Artifact evidence PASS is not legal approval,
repository-owner acceptance, or deployment authority.

## Lane J2 objective evidence supplement (2026-09-05)

The exact per-ELF component and notice index is
licenses/native-runtime-manifest.v1.json; corresponding-source coordinates and
verified hashes are in licenses/native-source-artifacts.v1.json. Verbatim
Ubuntu, conda, OCP, OCCT, and pydantic-core license evidence is under licenses/.
These records supersede the earlier factual HOLD for unidentified native
components or missing source coordinates. They do not make a legal
determination or record repository-owner acceptance.
