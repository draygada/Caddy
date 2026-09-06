# OCP/OCCT native Vercel preview owner approval request

Status: **REQUEST ONLY - NO APPROVAL GRANTED**  
Requested decision owner: **Diego, repository owner**  
Existing controlling record: `docs/OCP_OCCT_OWNER_APPROVAL.md` remains **HOLD** and is not modified
or superseded by this unsigned request.

This packet requests narrow operational approval to upload one exact native CAD service candidate
to an unpromoted Vercel preview. It is not legal advice, a legal determination, production-release
authority, or CUI/GovCloud authorization.

## Exact candidate and bundle

| Item | Exact identity |
|---|---|
| Native evidence commit | `33bce6b` |
| Request lineage commit | `cb0ee10441b59f319d0678eef84de0f8648f607b` |
| Builder | `apps/cad-service/scripts/build_vercel_bundle.py --require-clean` |
| Bundle payload SHA-256 | `25bde3b72ffa12155d0cf6541a30a3a54b1e9bf5ebe42f91bf088c8d05a35218` |
| Bundle tree SHA-256 | `59ba213fa2a67833723a2edd86f1afe041edb1f5f73419c3a8cd29c3883bd18c` |
| Resolved Linux closure | 266,442,532 bytes |
| Native wheel | `cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl` |
| Native wheel identity | 67,439,751 bytes; SHA-256 `8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b` |

Commit `33bce6b` is contained in the candidate lineage through `cb0ee10`. This request is bound to
that lineage and the exact bundle payload, bundle tree, and resolved closure above. Any source,
dependency, evidence, payload, manifest, or closure byte change invalidates this request and
requires a newly hashed packet.

The request commit is not itself a deployable approved candidate. Owner approval must be captured
in a subsequent signed and committed decision record that reconciles the existing HOLD. The exact
deployable commit will therefore necessarily be a descendant of this request lineage; that
descendant must reproduce the identities above and pass every gate before upload.

## Runtime identity

| Layer | Version or identity |
|---|---|
| Python | `3.12` |
| OCP package | `cadquery-ocp-novtk==7.9.3.1` |
| OCP source | commit `d69b064a3a604ebf245b1f3b14fb54c835a3a571` |
| OCCT | `7.9.3`; commit `a016080bf6738d6aeae020badee4e888ad1540a5` |
| FastAPI | `0.141.1` |
| Starlette | `1.6.0` |
| Uvicorn | `0.52.4` |
| Pydantic | `2.13.5`; `pydantic-core==2.46.5` |

## Included license, notice, and SBOM evidence

| Bundled evidence | SHA-256 |
|---|---|
| `THIRD_PARTY_NOTICES.md` | `45f6621001aaa8c9e085c64ec68c956d845e25a4e84e1a89b10ad5d5b863af18` |
| `REDISTRIBUTION_EVIDENCE.md` | `376638cac2716fbb829c9a9546b14ffb7a2c81d73c70ae7ebe9aafc6ca023110` |
| `licenses/native-runtime-manifest.v1.json` | `782bf9cb026199e8a8d639f6deaaaca8ed297cc780a08b47c48f44a242c4402d` |
| `licenses/native-source-artifacts.v1.json` | `65ee86d70029036a88bb5bde9767a8b375465ffe5a6c3c5187f90444eef60767` |
| `licenses/native/OCP-WHEEL-AUDITWHEEL-CDX-1.4.json` | `9acbb7d86c746873c40a970bd1afc89855986aa1e5b9ae85e6a53032f7201b10` |
| `licenses/OCP-APACHE-2.0.txt` | `a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd` |
| `licenses/OCCT-LGPL-2.1.txt` | `e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c` |
| `licenses/OCCT-LGPL-EXCEPTION-1.0.txt` | `04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b` |

The wheel SBOM lists 19 components but has undeclared license fields and is not sufficient alone.
The service supplement records 70 ELF files mapped to 22 components/source sets. The repository
records legal determination as `NOT_PERFORMED`; this request does not reinterpret those terms.

## Current technical gate

The prior `pydantic_core==2.46.5` native-evidence mismatch is resolved. The exact repaired
candidate evidence is **PASS**: the native test suite passed `41/41`, the dependency audit found
zero known advisories, and `verify_redistribution_evidence.py` validated the 266,442,532-byte
resolved Linux closure bound above.

This technical PASS does not grant approval or supersede the existing HOLD. Owner approval remains
necessary but not sufficient: before upload, the subsequent signed/committed approval descendant
must reproduce the bound bundle and closure identities and pass the exact closure check again.

## Preview boundary

| Boundary | Approved scope if selected below |
|---|---|
| Data | Synthetic or public data only; no customer, controlled, export-controlled, or CUI data |
| Access | Unauthenticated service; host/CORS validation is not authentication; no user RBAC or durable rate limiting |
| State | Stateless request processing; temporary files only; no durable CAD persistence |
| Transport | Request and response each capped at 4,000,000 bytes |
| Target | One unpromoted Vercel preview URL; no production domain, alias, or stable routing |
| Secrets | No API key or product secret is consumed by the native service |
| External effects | No supplier, order, customer, model-provider, or other production action |

## Expected upload action

Only after a signed and committed owner decision in a descendant of this request, reconciliation
of the existing HOLD, and a repeated passing exact closure check, the operator would reproduce and
verify the bundle, then perform only this preview upload:

```bash
BUNDLE_PARENT="$(mktemp -d)"
BUNDLE_ROOT="$BUNDLE_PARENT/caddydaddy-cad-vercel"
python3.12 apps/cad-service/scripts/build_vercel_bundle.py \
  --output "$BUNDLE_ROOT" \
  --require-clean
(cd "$BUNDLE_ROOT" && vercel deploy --yes)
```

Before accepting the preview, the operator must capture the provider deployment ID/artifact,
verify the bound payload and evidence closure, and smoke `/health`, `/ready`, bounded recompute,
and STEP/IGES/STL exchange with synthetic geometry. Product-service or frontend routing, aliases,
and production promotion are separate actions and are not approved here.

## Abandon and rollback

The preview must remain unpromoted. If build identity, evidence verification, readiness, smoke,
latency, or payload limits fail, stop routing to the preview and abandon/delete that preview
deployment. Do not change any stable alias. If a separate downstream preview was temporarily
pointed at it, abandon that downstream preview or restore its prior immutable service URL. The
browser fallback and current stable deployments remain the recovery path.

## Repository-owner decision

Select exactly one. An unsigned or multiply selected packet means `HOLD`.

- [ ] **APPROVE_PREVIEW_ONLY** - I have repository-owner authority and approve only the exact
  candidate, payload, manifest, dependency, evidence closure, target, and boundaries above,
  subject to every technical gate passing before upload. I do not approve production promotion,
  aliases, private/controlled data, additional dependency bytes, or broader deployment authority.
- [ ] **HOLD** - Do not upload the native OCP/OCCT service. Retain the browser fallback and return
  with the missing or corrected evidence and a newly bound request if needed.

Decision rationale: ________________________________________________

Approver full name: ________________________________________________

Repository role/authority: _________________________________________

Signature: _________________________________________________________

Decision date: ____________________  Timezone: ______________________

Approval evidence link or signed-record reference: __________________

This operational choice does not constitute legal advice, a license determination, CUI/GovCloud
authorization, security accreditation, spending authority, or approval to process non-public data.
