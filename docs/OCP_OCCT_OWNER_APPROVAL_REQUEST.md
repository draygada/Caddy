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
| Repository candidate | `f31e57c5f528b3cd1dfb32de39b32c30b5982a4c` |
| Builder | `apps/cad-service/scripts/build_vercel_bundle.py --require-clean` |
| Payload | 69 files; 633,805 bytes |
| Payload SHA-256 | `7d2f033e513b22e9f5356ef7eeb26c9eae1dc8601bed484ed9f2325444ea57ad` |
| `BUNDLE_MANIFEST.json` SHA-256 | `21c19616db33dba3004c5cdc293e0cc970dcc3bd16cd3cda2bba02942f23724d` |
| Deployment root | 70 files including manifest; 653,140 bytes |
| Native wheel | `cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl` |
| Native wheel identity | 67,439,751 bytes; SHA-256 `8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b` |

Any source, dependency, evidence, payload, or manifest byte change invalidates this request and
requires a newly hashed packet.

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

Owner approval is necessary but not sufficient. The latest independent exact-candidate verifier
reported that resolved `pydantic_core==2.46.5` Linux bytes did not match the committed native
runtime manifest: expected 4,776,920 bytes and SHA-256 beginning `2711a346`; resolved 4,692,312
bytes and SHA-256 beginning `95f68ef2`. Therefore no upload may occur unless the exact resolved
closure passes `verify_redistribution_evidence.py`. Repairing the manifest would change this
packet's bound hashes and require a new request.

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

Only after a signed owner decision, reconciliation of the existing HOLD, and a passing exact
closure check, the operator would reproduce and verify the bundle, then perform only this preview
upload:

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
