# OCP/OCCT native adapter owner approval

Current status: **NO APPROVAL RECORDED - DO NOT UPLOAD OR DEPLOY THE NATIVE SERVICE**  
Legal determination: **NOT_PERFORMED**  
Browser fallback: may proceed through its normal release gates because it does not bundle the
native OCP/OCCT closure.

This is a narrow repository-governance approval form, not legal advice or a legal conclusion. It
does not transfer authority, approve spending, authorize production data, approve a domain change,
or authorize any artifact other than the exact native dependency closure identified below.

## Exact decision scope

- Repository evidence baseline: `0aa94defedff69ca71e15e1c1a4e5c03ea317a01`
- OCP wheel:
  `cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl`
- Wheel bytes: `67,439,751`
- Wheel SHA-256:
  `8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b`
- OCP commit: `d69b064a3a604ebf245b1f3b14fb54c835a3a571`
- OCP build-system commit: `648499040b66a769293edfa844ff170ff8046619`
- OCCT version/commit: `7.9.3` / `a016080bf6738d6aeae020badee4e888ad1540a5`
- Intended architecture: dedicated native adapter deployment behind a versioned HTTPS/JSON
  contract; no OCP/OCCT binary in the browser or general product-service bundle.
- Intended dependency state: unchanged upstream wheel. Any changed byte voids this form.

Required reading:

- `docs/OCP_OCCT_INTEGRATION_DECISION.md`
- `apps/cad-service/REDISTRIBUTION_EVIDENCE.md`
- `apps/cad-service/THIRD_PARTY_NOTICES.md`
- `apps/cad-service/licenses/README.md`
- [OCP pinned Apache-2.0 license](https://github.com/CadQuery/OCP/blob/d69b064a3a604ebf245b1f3b14fb54c835a3a571/LICENSE)
- [OCP build-system pinned Apache-2.0 license](https://github.com/CadQuery/ocp-build-system/blob/648499040b66a769293edfa844ff170ff8046619/LICENSE)
- [OCCT pinned LGPL-2.1 text](https://github.com/Open-Cascade-SAS/OCCT/blob/a016080bf6738d6aeae020badee4e888ad1540a5/LICENSE_LGPL_21.txt)
- [OCCT pinned exception](https://github.com/Open-Cascade-SAS/OCCT/blob/a016080bf6738d6aeae020badee4e888ad1540a5/OCCT_LGPL_EXCEPTION.txt)

## Smallest owner checklist

Every box must be checked, or the decision must remain HOLD.

- [ ] **Authority.** I am the repository owner or have written authority from the repository owner
  to accept this dependency and its release process. Authority evidence is linked below.
- [ ] **No legal shortcut.** I understand that artifact evidence is `PASS`, legal determination is
  `NOT_PERFORMED`, and this owner decision does not substitute for legal advice. I have decided
  whether qualified legal review is required before this specific upload.
- [ ] **Exact bytes.** I approve only the wheel name, byte count, SHA-256, commits, and unchanged
  dependency state listed above. Any rebuild, patch, version change, or transitive native-file
  change requires a new review and approval.
- [ ] **Complete release closure.** I require the deployed/downloadable release closure to include
  `apps/cad-service/licenses/**`, `apps/cad-service/THIRD_PARTY_NOTICES.md`, and
  `apps/cad-service/REDISTRIBUTION_EVIDENCE.md`; I will not approve the wheel alone.
- [ ] **Visible notice.** I approve a human-readable supporting-documentation or product notices
  location that prominently identifies Open CASCADE Technology use and links the applicable
  license, exception, notices, and source-access mechanism.
- [ ] **Durable source route.** I approve the exact durable location below for the verified OCP,
  OCP build-system, OCCT, and transitive corresponding-source/build-recipe sets. It includes any
  modifications used and the interface/build/install material required by the selected mechanism.
- [ ] **Replacement route.** I have reviewed the tested replacement/rebuild method using an exact
  `OCP_WHEEL_URL` and `OCP_WHEEL_SHA256`. The release does not prevent the approved replacement or
  debugging path selected for this artifact.
- [ ] **IP separation.** I confirm that the browser/product code is independently authored, the
  native adapter is isolated, and no OCP/OCCT implementation, generated binding implementation,
  or upstream modification is being relabeled as proprietary project IP.
- [ ] **Modification disposition.** I confirm the dependency is unchanged, or I have attached a
  complete patch/source/build record and upstream-or-isolate disposition below. No modification is
  hidden in the proprietary product tree.
- [ ] **Provider artifact.** Before promotion, the provider-built native artifact will be captured,
  hash-identified, scanned for the required closure, checked against payload/size limits, and
  smoke-tested. This approval does not waive those technical gates.
- [ ] **No scope creep.** I understand that this approval does not authorize supplier contact,
  production ordering, controlled data, production traffic, additional spend, a domain/alias
  change, or future native dependency hashes.

## Evidence fields

Repository-owner authority evidence: `NOT RECORDED`  
Qualified legal-review decision or reference: `NOT RECORDED`  
Durable corresponding-source URL/location: `NOT RECORDED`  
Open Source Notices URL/location: `NOT RECORDED`  
Modification/patch record, or `UNCHANGED`: `NOT RECORDED`  
Replacement/rebuild evidence: `apps/cad-service/README.md` and exact release receipt, not yet recorded  
Provider-built artifact ID and SHA-256: `NOT RECORDED`  
Redistribution verifier receipt: `NOT RECORDED FOR FINAL PROVIDER ARTIFACT`  
Technical smoke/readiness receipt: `NOT RECORDED`

## Owner decision

Select exactly one:

- [ ] **APPROVE** the exact native adapter closure above, subject to every checked condition and the
  normal deployment/readiness gates.
- [x] **HOLD** native upload. Ship the permissive browser fallback and return when the missing owner,
  source-publication, and provider-artifact evidence is recorded.
- [ ] **REJECT** this native dependency route; retain the fallback and select another kernel or a
  separately negotiated license.

Decision rationale: `Current controlling decision: no native upload without repository-owner approval.`

Approver name: `NOT RECORDED`  
Repository role/authority: `NOT RECORDED`  
Decision date/time and timezone: `NOT RECORDED`  
Approval evidence link or signed record: `NOT RECORDED`  
Approved deployment target: `NOT RECORDED`  
Expiration or mandatory re-review date: `NOT RECORDED`

## Approval effect and invalidation

An APPROVE selection becomes effective only when all checklist items and evidence fields are
complete and the signed record is committed by or linked to an authorized repository owner. It is
limited to the exact wheel hash and closure above. It is automatically invalidated by any changed
native byte, dependency, source commit, patch, build recipe, notice/source mechanism, deployment
packaging, or target with materially different distribution conditions.

Until that happens, the recorded decision remains: **browser fallback now; native adapter HOLD**.
