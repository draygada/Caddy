# OCP/OCCT integration and IP-boundary decision

Status: **HOLD for native upload; GO for the permissive browser fallback**  
Recorded: 2026-09-05  
Evidence baseline: repository commit `0aa94defedff69ca71e15e1c1a4e5c03ea317a01`  
Decision owner: repository owner, not yet recorded  
Legal determination: **NOT_PERFORMED**

This is an engineering and repository-governance record. It is not legal advice, does not decide
whether any work is a derivative work, and does not authorize deployment. The repository owner
should use `docs/OCP_OCCT_OWNER_APPROVAL.md` to record the narrow decision after reviewing this
record and, if the owner considers it necessary, obtaining qualified legal advice.

## Decision

1. Do not upload or deploy the native OCP/OCCT service until a repository owner records approval
   for the exact artifact and source/notice mechanism.
2. Ship the independently authored, permissive browser fallback now. It must not contain OCP,
   OCCT, their generated bindings, native libraries, copied implementation code, or misleading
   claims that it is the native OCCT kernel.
3. Preserve the native implementation as a separately deployed adapter candidate. The proprietary
   product communicates with it only through a versioned HTTPS/JSON contract.
4. If approved later, deploy only a content-addressed adapter closure containing the complete
   notice and source-evidence packet. Keep the dependency replaceable and keep all upstream changes
   isolated or upstreamed.
5. Do not describe OCP or OCCT code, binaries, bindings, or modifications as CADdyDaddy proprietary
   IP. CADdyDaddy may own independently authored product code and product behavior around the
   dependency, subject to the applicable agreements and an owner/legal review.

This route gets the hackathon surface online without spending the repository owner's decision for
them and without blocking a later, evidence-backed native adapter.

## Exact stack and why the licenses do not collapse into one

| Layer | Pinned identity | Recorded terms | Engineering consequence |
|---|---|---|---|
| OCP Python wrapper | commit `d69b064a3a604ebf245b1f3b14fb54c835a3a571` | Apache-2.0 | OCP's wrapper source is under Apache-2.0. The license permits broad use and redistribution while requiring the license, retained notices, and prominent change notices for modified files. |
| OCP wheel build system | commit `648499040b66a769293edfa844ff170ff8046619` | Apache-2.0 | The build and wheel-repair code has the same Apache boundary; its license does not relicense payload libraries. |
| OCCT geometry library | version `7.9.3`, commit `a016080bf6738d6aeae020badee4e888ad1540a5` | LGPL-2.1 plus Open CASCADE exception 1.0 | The bundled `libTK*` shared libraries remain governed by the OCCT terms. The exception addresses header material in object code and requires prominent supporting-documentation notice; it is not a blanket relicense of OCCT. |
| CADdyDaddy browser/product layers | independently authored repository code | Project-selected terms, subject to ownership review | Keep these layers free of copied OCP/OCCT implementation and communicate with the native adapter through a project-owned data protocol. |

The deployed wheel is
`cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl`, exactly
`67,439,751` bytes, SHA-256
`8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b`. It is byte-for-byte
unmodified in the current packet. Its Apache-licensed OCP binding is not the whole payload: the
measured wheel closure includes OCCT and other shared libraries under their own recorded terms.
The wheel alone is therefore not the release closure.

Primary upstream evidence:

- [OCP Apache-2.0 license at the pinned commit](https://github.com/CadQuery/OCP/blob/d69b064a3a604ebf245b1f3b14fb54c835a3a571/LICENSE)
- [OCP build-system Apache-2.0 license at the pinned commit](https://github.com/CadQuery/ocp-build-system/blob/648499040b66a769293edfa844ff170ff8046619/LICENSE)
- [Apache License 2.0, including redistribution conditions](https://www.apache.org/licenses/LICENSE-2.0)
- [OCCT LGPL-2.1 text at the pinned commit](https://github.com/Open-Cascade-SAS/OCCT/blob/a016080bf6738d6aeae020badee4e888ad1540a5/LICENSE_LGPL_21.txt)
- [OCCT exception 1.0 at the pinned commit](https://github.com/Open-Cascade-SAS/OCCT/blob/a016080bf6738d6aeae020badee4e888ad1540a5/OCCT_LGPL_EXCEPTION.txt)
- [OCCT's own license and packaging description](https://github.com/Open-Cascade-SAS/OCCT/tree/a016080bf6738d6aeae020badee4e888ad1540a5)

## What project IP can remain separate

The engineering boundary is strongest for code that is independently authored, remains in a
separate module or deployment, and neither copies nor incorporates OCP/OCCT implementation:

- Product UI, workflow orchestration, sourcing, classification, provenance, collaboration, and
  order-recording logic.
- Product-specific document schemas, feature graphs, audit records, policy gates, and API
  contracts created by this project.
- Browser rendering and permissive fallback geometry written without OCP/OCCT source or generated
  binding code.
- The HTTP client, authentication, tenancy, persistence, observability, and deployment control
  plane around the adapter.
- Independently authored tests and test fixtures that assert the public adapter contract rather
  than reproduce upstream algorithms or implementation details.
- Product names, designs, datasets, and domain logic owned or validly licensed by the project.

The Apache-2.0 definition expressly excludes works that remain separable from, or merely link or
bind by name to, Apache work from its definition of derivative works. LGPL-2.1 section 5 similarly
describes a program that contains no derivative portion of the library and is designed to work
with it as a "work that uses the Library" when considered in isolation. Those texts support the
architecture, but only the repository owner or qualified counsel should decide how they apply to a
specific deliverable.

Treat the native adapter itself more conservatively. It imports OCP and loads OCCT shared
libraries, so every distributed adapter artifact must go through the native closure review even
when all adapter source was written by this project.

## Unchanged and modified dependency paths

| Case | Engineering handling before any distribution | Current state |
|---|---|---|
| Unchanged OCP wrapper/build source | Preserve the Apache license and upstream notices. Do not claim upstream authorship. Preserve a reproducible exact source coordinate. | OCP and build-system commits and source archives are pinned. |
| Modified OCP wrapper/build source | Keep each change in an explicit patch or fork; mark modified files prominently; retain applicable copyright, patent, trademark, and attribution notices; carry the Apache license and any applicable NOTICE material. | No project modification is recorded. |
| Unchanged OCCT shared libraries | Carry prominent OCCT-use notice, LGPL-2.1 text, OCCT exception, exact corresponding-source access selected by the owner, and a practical replacement/relink route approved for the deliverable. | The wheel is recorded as unmodified; artifact evidence passes; owner approval does not. |
| Modified OCCT library | Isolate every change with author/date/purpose; preserve notices; make the complete modified library source, interface definitions, and build/install scripts available under the applicable OCCT terms through the approved mechanism. | No OCCT modification is recorded. |
| Rebuilt OCP wheel against unchanged or modified OCCT | Pin source commits, toolchain, patches, build recipe, wheel bytes, and SHA-256. Re-run native mapping and replacement tests. Never silently replace the approved wheel. | An `OCP_WHEEL_URL` plus `OCP_WHEEL_SHA256` replacement seam exists; no replacement wheel is approved. |
| Independently authored adapter-only change | Keep it in the adapter, not in upstream trees. Re-run closure review because the deliverable still uses the native stack. | Allowed as project work, but not independently authorized for native upload. |

LGPL-2.1 defines complete library source to include the associated interface definition files and
scripts controlling compilation and installation. Its distribution sections describe source,
notice, and replacement/relink mechanisms for library object code and linked executables. The
owner checklist intentionally does not choose among those mechanisms as a legal conclusion; it
requires the owner to approve a specific, durable mechanism for this artifact.

## Why a separate adapter and replaceable dependency help

The architecture is useful for concrete engineering reasons:

- The browser and product service neither bundle nor directly load the native libraries.
- The license-bearing closure is limited to one adapter artifact and can carry one complete notice,
  manifest, source, and replacement packet.
- A versioned protocol allows the native adapter to be replaced by the browser fallback, another
  approved open-source kernel, a commercial OCCT build, or an independently implemented kernel
  without rewriting product workflows.
- An immutable wheel hash makes the exact reviewed dependency testable.
- An explicit wheel URL and hash make a rebuilt dependency observable rather than silently fused
  into the product.
- Operational rollback can disable the native route without removing access to the broader product.

This separation is not a loophole and does not erase obligations. Uploading the native image to a
provider is conservatively treated as an owner-reviewed event. Network access, process separation,
or server-side execution should not be assumed to settle whether a particular act is distribution.

## What must accompany or be visible in an approved native release

The current engineering packet requires every native release closure to include all of:

- `apps/cad-service/licenses/**`
- `apps/cad-service/THIRD_PARTY_NOTICES.md`
- `apps/cad-service/REDISTRIBUTION_EVIDENCE.md`

The release should also expose a human-readable Open Source Notices link from supporting
documentation or the product's normal notices surface. It must identify use of Open CASCADE
Technology, provide the LGPL-2.1 and OCCT exception texts, preserve Apache and transitive notices,
and point to the exact durable corresponding-source/rebuild mechanism approved by the owner.

For this candidate, that durable mechanism must identify the exact OCP, OCP build-system, OCCT,
and transitive source sets, their hashes, all project patches if any, and the scripts or recipes
needed to reconstruct the approved dependency closure. A transient upstream URL alone is not the
recorded durable publication decision.

## What must not be absorbed into proprietary IP

- Do not copy OCCT source, generated binding implementation, or upstream algorithms into
  proprietary product modules and then remove their notices.
- Do not move modifications to OCP/OCCT files into an unlabeled private product tree.
- Do not strip license, copyright, attribution, warranty, source-access, or change notices.
- Do not describe upstream code, shared libraries, or project patches to them as solely proprietary.
- Do not use upstream trade names as if they endorse the product; use them only to identify origin
  and dependency status.
- Do not use upstream implementation as a hidden specification for a claimed clean-room rewrite.
  If an independently implemented kernel becomes a product goal, establish separate specification,
  implementer, provenance, and review records before work begins.
- Do not assume that generated CAD output transfers ownership of upstream code or that owning the
  surrounding application changes the dependency's terms.

## Modification policy: upstream first, isolate when necessary

1. Prefer adapter-level fixes that use documented public interfaces and leave OCP/OCCT unchanged.
2. If the defect is upstream, prepare a minimal patch in a dedicated upstream fork or patch series,
   with provenance, author, date, purpose, tests, and the original license intact.
3. Prefer contributing generally useful fixes upstream under the upstream contribution process.
   Do not submit confidential product logic, customer data, controlled technical data, or code the
   contributor lacks authority to license.
4. If a patch cannot be upstreamed, keep it isolated from proprietary modules and publish/deliver
   its corresponding source through the owner-approved mechanism whenever the patched artifact is
   distributed.
5. Every patched or rebuilt wheel gets a new immutable hash, native manifest, source ledger,
   closure check, owner decision, and release record. Approval for one hash never rolls forward.

## Evidence ledger

| Evidence | Repository path | Exact recorded identity |
|---|---|---|
| Engineering redistribution result | `apps/cad-service/REDISTRIBUTION_EVIDENCE.md` | Artifact evidence `PASS`; legal determination `NOT_PERFORMED`; release `HOLD` |
| Consolidated dependency record | `apps/cad-service/THIRD_PARTY_NOTICES.md` | Required in every native release closure |
| OCP Apache text | `apps/cad-service/licenses/OCP-APACHE-2.0.txt` | SHA-256 `a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd` |
| OCP build-system Apache text | pinned upstream commit and `THIRD_PARTY_NOTICES.md` | SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |
| OCCT LGPL-2.1 text | `apps/cad-service/licenses/OCCT-LGPL-2.1.txt` | SHA-256 `e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c` |
| OCCT exception 1.0 | `apps/cad-service/licenses/OCCT-LGPL-EXCEPTION-1.0.txt` | SHA-256 `04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b` |
| Exact native-file map | `apps/cad-service/licenses/native-runtime-manifest.v1.json` | SHA-256 `782bf9cb026199e8a8d639f6deaaaca8ed297cc780a08b47c48f44a242c4402d`; 70 ELF files mapped to 22 components |
| Corresponding-source ledger | `apps/cad-service/licenses/native-source-artifacts.v1.json` | SHA-256 `65ee86d70029036a88b5bde9767a8b375465ffe5a6c3c5187f90444eef60767`; 22 source/build-recipe sets |
| Wheel SBOM evidence | `apps/cad-service/licenses/native/OCP-WHEEL-AUDITWHEEL-CDX-1.4.json` | SHA-256 `9acbb7d86c746873c40a970bd1afc89855986aa1e5b9ae85e6a53032f7201b10`; not sufficient alone |
| OCP source archive | source ledger and verifier cache | 3,728,128 bytes; SHA-256 `a5153cef9f4a3a3dbbb1d498a971206a6c35dc4d829e7e011f96e0539c22e616` |
| OCP build-system source archive | source ledger and verifier cache | 1,380,634 bytes; SHA-256 `103558026783449a3d9cd442dc2b741992520a1c436f5cf017a1f3a98fa0107e` |
| OCCT source archive | source ledger and verifier cache | 48,610,707 bytes; SHA-256 `c533f2667b59921bd6bd40ce82e7b9900b0289ccc731af5fdeeba097de80ef0f` |

The committed verifier is `apps/cad-service/scripts/verify_redistribution_evidence.py`. A passing
run proves consistency of the measured artifact packet; by design it prints
`legal_determination: NOT_PERFORMED` and cannot grant owner or deployment authority.

## Reversal conditions

This decision may change only when one of these is recorded:

- A repository owner completes `docs/OCP_OCCT_OWNER_APPROVAL.md` for the exact wheel and release
  closure.
- The native dependency or any source/build input changes, which requires a new decision packet.
- The project adopts an OCCT commercial license or other written agreement and records its scope.
- The native route is replaced with an independently authored or separately approved kernel.
- Qualified legal review changes the required release mechanism.

Until then: browser fallback may ship; native OCP/OCCT upload remains **HOLD**.
