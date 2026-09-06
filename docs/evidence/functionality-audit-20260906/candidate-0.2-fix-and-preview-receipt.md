# Candidate 0.2 fix and preview receipt

Recorded at: `2026-09-06T11:19:05Z`

## Result

- Product service: `DEPLOYED_AND_VERIFIED`
- Frontend immutable preview: `DEPLOYED_AND_VERIFIED`
- Frontend stable alias: `HOLD_NO_PROMOTION`
- Native OCCT service: `HOLD_NO_DEPLOYMENT`

This receipt proves the bounded paths stated below. It does not establish production CAD parity, legal classification accuracy, GovCloud/CUI authorization, multi-user persistence, or external order execution.

## Authority

The deployment actions were bounded by the user's instructions: "the repository has been made private, we are good to deploy anytime" and "we need to deploy asap live on vercel for charlie and diego to see as well."

The authority was applied only to the existing CADdyDaddy Vercel projects, a product-service promotion with rollback, a frontend preview, public synthetic smoke data, and verification. It was not extended to repository-owner license acceptance, the native runtime approval variable, credentials, real Anthropic use, a frontend stable-alias change, or external order send-off.

## Source identity

- Repository: `https://github.com/draygada/CADdyDaddy.git`
- Branch: `ship/hardened-drone-candidate-0.2-20260906`
- Candidate commit: `1d21ec9b94b3368ab3173cd4b7f57972c8186557`
- Candidate tree: `63e574dfcd4939450556da1bae8ec40da97b48de`
- Worktree at deployment: clean

## Product-service artifact

- Bundle archive SHA-256: `b71a7f5ed6c6b138d42ac89bf421503b011b811f93bdcd7807982876d9f6307f`
- Bundle closure SHA-256: `2d8577b79d383db98c33f7c89c4dffa18c1ec8e973801d7f68fd739ee6f9ea88`
- Resolved manifest SHA-256: `ddf623324bb6cf0058e9797a4e164fa3bfa4da3f0d0aae1503499b10767bc9c8`
- Candidate snapshot SHA-256: `917880e823fb4a11b7adb87f78361b20c9512d0e0c1fd210a5980ac297f989b8`
- Payload files: `63`
- Bundle files: `64`
- Secrets admitted by bundle policy: `false`
- Product-service preview: `dpl_Dfmp451eHVv3YGwSubAGmmNLCZFc`
- Promoted production deployment: `dpl_8Wme1xTkE1kW2JRoqQezj49ogekm`
- Public product-service alias: `https://caddydaddy-product-service.vercel.app`

## Frontend artifact

- Deployment: `dpl_BMj2Upjw3mhBdCZWtGbEDzEuKvYa`
- Immutable preview: `https://caddydaddy-candidate-0-1-owzs2dc0b-strafe1.vercel.app`
- Runtime binding name: `CADDYDADDY_PRODUCT_SERVICE_URL`
- Runtime binding target: the public product-service alias above
- Existing stable frontend deployment left unchanged: `dpl_3mgRC99x1LAQHdwSy8j3AfRoEHRm`
- Existing stable frontend hostname left unchanged: `https://caddydaddy-candidate-0-1.vercel.app`

## Verification evidence

| Gate | Evidence | Verdict |
|---|---|---|
| Classification engine | `133` tests passed after canonical-ID and structured-question changes | PASS |
| Frontend | `44/44` test files and `225/225` tests passed | PASS |
| Frontend production build | TypeScript and Vite production build completed | PASS |
| CAD and product services | Full `apps/cad-service/tests` plus `tests/product-service` suite exited `0` | PASS |
| Native artifact | Deterministic sanitized bundle and actual local OCCT smoke passed | PASS_LOCAL_ARTIFACT_ONLY |
| Product-service public candidate | HTTP `200`, Candidate `0.2`, exact snapshot hash above | PASS |
| Product-service classification | HTTP `200`, service-reported `ScriptedModel`, `UNDETERMINED` | PASS_BOUNDED |
| Product-service native capability | HTTP `503`, `CAD_SERVICE_NOT_CONFIGURED` | PASS_FAIL_CLOSED |
| Frontend shell | HTTP `200` with CSP, permissions policy, frame denial, and MIME-sniff denial | PASS |
| Frontend candidate proxy | HTTP `200`, exact Candidate `0.2` snapshot identity | PASS |
| Frontend CAD capability route | Concrete provider route returned product-service `503 CAD_SERVICE_NOT_CONFIGURED`, not provider `404` | PASS_FAIL_CLOSED |
| Frontend valid-shape recompute | HTTP `503 CAD_SERVICE_NOT_CONFIGURED`; no false live-OCCT success | PASS_FAIL_CLOSED |
| Order package validation | HTTP `409`; `external_effect=NONE`, `external_calls=0`, `connector=RECORDING_ONLY` | PASS_NO_EFFECT |
| Mobile | Chrome at `390x844`; document width `390`, no horizontal overflow | PASS |
| Browser console | Zero error-level entries during the reviewed journey | PASS |

## Live QX-0 dogfood

- Declared data class: `SYNTHETIC`
- A `CUI` selection was visibly blocked before application access.
- Command palette opened and navigated to the active QX-0 CAD/Core workspace.
- Browser kernel: `@jscad/modeling 2.13.0`, explicitly labeled `BROWSER_JSCAD_BOUNDED`.
- Baseline: `260 mm` frame, `12` CAD definitions, `25` physical instances, `24` recorded-not-solved mates, `1,724` triangles.
- Ablation: `300 mm` frame produced a distinct revision with the same defined assembly counts and `1,724` triangles.
- Dependency projection: `93` nodes and `103` edges.
- Output package: `11` validated artifacts including BOM CSV, native CADdyDaddy JSON, three SVG drawings, three DXF drawings, STL, manifest, and detached manifest hash.
- Package ID: `mfgpkg:f085526181e5c866f7e99e3ea9b90e29f85d3a65145ec1d6517d863d6abd237c`.
- Package manifest SHA-256: `4f39777f625de723f04f908bec6484328a76912c093a0a79d97a4b7bc5fdf6dc`.
- Classification UI bound `UNDETERMINED` and structured `Q-001` to the exact active CAD revision and output hashes.
- Product Thread recorded four events, re-derived as `INCOMPLETE_UNTRACKED` because three legacy Kestrel events are deliberately outside the QX-0 chain, and restored the exact four-event state after browser reload.

## Rollback

The previous public product-service deployment was captured before promotion:

- Deployment: `dpl_6aTHpvKRbfcEAAtqZ1iGLtviaoL3`
- Immutable URL: `https://caddydaddy-product-service-m3ulacpq5-strafe1.vercel.app`
- Rollback action: promote that immutable deployment back to the product-service production alias, then repeat `/api/candidate` and frontend proxy smokes.

No frontend rollback is required because the stable frontend alias was never changed. The immutable preview can simply remain unpromoted.

## Deliberately un-crossed boundaries

- `CAD_NATIVE_RUNTIME_OWNER_APPROVAL` was not configured.
- The `caddydaddy-cad-service` Vercel project remains undeployed.
- No native OCCT execution occurred on the public deployment.
- No Anthropic key was configured and no real Anthropic call was made in this release transaction.
- No CUI, ITAR-controlled technical data, customer design, secret, or credential was entered.
- Product Thread persistence remains device-local, unsigned, unauthenticated, and unshared.
- Assembly mates in browser mode remain recorded intent, not solved constraints.
- STEP and IGES remain unavailable until the owner-approved native OCCT service is deployed and bound.
- No order, RFQ, supplier message, or other external transaction was sent.
- No merge to `main` was performed by this transaction.
