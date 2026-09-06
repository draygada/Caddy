# Tripwire FB-00 + FB-03 integration-readiness receipt

Date: 2026-09-05

Target: canonical local `main` integration from `4ac523c101d6e9967e582a1c527e038f753aa6ff`

Verdict: **INTEGRATION HOLD**

Technical compatibility: **PASS**

Deployment, push, rule promotion, and legal/semantic approval: **not authorized and not performed**

## Outcome

The two candidate trees are mechanically compatible and pass the affected automated and rendered-product checks together. They are not eligible for canonical integration yet. The governing north star and feature bibles require FB-00 approval and a frozen FB-01 contract before an FB-03 candidate can integrate. FB-00 remains candidate-only mechanical prestage: D1-D3 and the qualified semantic review are still open, `data/rules/rules.P0.json` is absent, and no FB-01 freeze receipt exists.

This receipt preserves the technical result without converting candidate compatibility into authority.

## Immutable candidates

| Lane | Candidate | Tree | Governed base | Candidate verdict | Scope |
|---|---|---|---|---|---|
| FB-00 mechanical prestage | `ca358fa28d90c6c59c20eef92b7be5b05c523c09` | `37339802f7fadb5a0b7344645e0a78f92e13baef` | merge-base `4ac523c101d6e9967e582a1c527e038f753aa6ff` | fresh read-only `MECHANICAL ACCEPT`; no semantic, legal, promotion, or integration approval | 25 paths within `schemas/**`, `data/demo/**`, `data/rules/**`, `backend/tests/fixtures/**`, and `docs/api/**` |
| FB-03 visual shell | `05cb545e3fca7e0df0084e6f1e624e777d701457` | `987bda5616ca93b1039d2f01bb8d687e82446aa9` | parent `e11256a4318bda76b54aa0f03be8e76aadf0aacd`; merge-base `4ac523c101d6e9967e582a1c527e038f753aa6ff` | fresh transcript-blind read-only `FB-03 ACCEPT` for candidate compatibility only | seven paths, all within `frontend/src/**` |

Both detached verification checkouts were clean and pinned to the hashes above when this gate ran. `git diff --check` passed for both lineages. No candidate contains `.lane`, `rules.P0.json`, or a package/lockfile change.

Rejected FB-03 ancestors remain rejected evidence, not alternate integration candidates: `6b59a6d178e740a02341fda297c72960f1dbe13b`, `3bae1d03a95299982ffc47b27a807e0c0733decc`, and the interim `e11256a4318bda76b54aa0f03be8e76aadf0aacd`. Layout rescue `84fe6f1cd96d78619a2fa568b201837030499c0f` remains provenance only.

## Fresh gate evidence

### Exact FB-03 candidate

- Clean install: 83 packages; audit reported zero vulnerabilities. The existing `fsevents@2.3.3` install-script allowlist notice remained informational.
- `node --test frontend/src/contract.test.mjs`: 11 passed, 0 failed.
- `npm run build`: passed. Residual: one non-failing Vite large-chunk warning.
- `make test-all` after a fresh Python 3.12 environment: 10 passed, 8 explicitly skipped inherited flip placeholders.
- Chrome 152 rendered all five scenarios at 1280×720, 1920×1080, and 390×844. Every viewport/scenario reported `0.00 px²` maximum marker overlap.
- F3→F8 kept the same marker nodes while pending and confirmed, retained stale-visible state, and accepted a pending marker click.
- Mesh/raycast, slot, BOM, cause, marker, and inspector selections stayed synchronized.
- Every 1280×720 scenario displayed a rule ID, `eCFR` source identity, and `2026-09-01` date; keyboard activation retained focus and revealed the evidence block. The mobile evidence jump placed the block inside the 390×844 viewport.
- Browser console contained only the known Three.js `Clock` and `PCFSoftShadowMap` deprecation warning classes; no application, page, or request error was observed.

### Combined scratch rehearsal

The exact base-to-candidate binary diffs were applied, FB-00 first and FB-03 second, to a disposable clone detached at the governed base. Canonical refs and worktrees were not changed.

- Combined staged tree: `d5e4af7b1d17528a7d6120a8162266e3a18feef6`.
- Path intersection/conflicts: none.
- `git diff --cached --check`: passed before and after verification.
- Frontend fixture designs against the FB-00 candidate `schemas/design.schema.json`: 5/5 valid.
- Frontend contract: 11/11 passed.
- Backend: 10 passed, 8 inherited placeholders skipped.
- Production build: passed with the same non-failing chunk warning.
- Chrome 152 repeated the complete three-viewport matrix, zero-overlap checks, evidence reachability, interaction synchronization, and pending marker continuity successfully.

This is a technical compatibility proof only. It is not an integrated commit and does not freeze the contract.

## Claims ledger

| User-visible claim | Class | Evidence | Verdict |
|---|---|---|---|
| The screen is an assembled Kestrel with identifiable parts and five installed locations. | demonstrated locally | `05cb545:frontend/src/App.jsx:69-133`, `05cb545:frontend/src/App.jsx:200-247`; Chrome desktop/mobile review | supported as a synthetic schematic assembly |
| A selected component is synchronized across mesh, marker, slot, BOM, and inspector. | demonstrated locally | `05cb545:frontend/src/ui.verify.mjs`; fresh Chrome click/raycast matrix | supported |
| F3 shows direct camera tripwires separately from parent propagation. | demonstrated locally | `05cb545:frontend/src/fixtures.js:477-480`; contract and Chrome F3 checks | supported for the unapproved synthetic fixture only |
| F8 reports zero changed determinations without dropping or pulsing the existing F3 markers. | demonstrated locally | `05cb545:frontend/src/fixtures.js:482-485`; contract continuity test and Chrome F3→F8 check | supported for fixture replay |
| Missing IMU evidence remains `question` / `cannot_evaluate`, never clear. | demonstrated locally | `05cb545:frontend/src/fixtures.js:450-464,487-490`; desktop/mobile rendered review | supported |
| The rule/source panel identifies an entry, source pointer, date, facts, operators, thresholds, and evidence state. | demonstrated locally | `05cb545:frontend/src/App.jsx:258-278,281-320`; evidence-jump browser checks | supported as an **unapproved fixture display**; legal relevance is not verified here |
| No destination authorization or legal classification is produced. | demonstrated locally boundary | `05cb545:frontend/src/App.jsx:277-278,319-320,351` | supported; destination remains `not_evaluated` |
| Synthetic MPNs, engineering facts, rules, and results are not verified/live outputs. | demonstrated locally boundary | `05cb545:frontend/src/App.jsx:83-133,267-278,313-320,351`; `05cb545:frontend/src/fixtures.js:1-18` | supported and repeatedly visible |
| A live deterministic evaluator implements the north-star F1/F3/F8 loop. | design intent | no FB-02/FB-04 integrated candidate; eight backend flip placeholders remain skipped | must not be claimed yet |
| Approved export-control coverage or a final classification exists. | blocked claim | FB-00 approval packet remains open; no approved `rules.P0.json` | must not be claimed |

Visible FB-03 copy has zero unqualified classification, legal-clearance, destination-authorization, live-evaluator, or source-verification claims. The broader live-engine promises remain design intent until FB-02/FB-04 and FB-07 prove them.

## Human-side UX review

| Lens | Result | Evidence / residual |
|---|---|---|
| First-frame thesis | pass | Desktop first frame exposes assembled product, selected camera, direct and propagated markers, scenario delta, and inspector explanation without narration. |
| Information architecture | pass | Assembly tree, central model, scenario rail, and selected-node inspector form a coherent scan path. |
| Interaction and feedback | pass | Scenario, mesh, marker, slot, BOM, cause, and evidence controls return synchronized visible state. |
| Causality and trust | pass | Direct child and propagated parent treatments are textually and visually distinct; facts/operators/thresholds are inspectable. |
| Uncertainty and recovery | pass | Pending retains stale-confirmed state; missing facts produce a question; contract errors are designed to fail loudly. |
| Accessibility | pass for scoped acceptance | Keyboard evidence activation/focus, semantic buttons, text labels, and non-color state cues passed. A comprehensive assistive-technology audit is not claimed. |
| Responsive layout | pass | 1280×720, 1920×1080, and 390×844 passed without horizontal body overflow or marker overlap; mobile preserves the five-location rail and evidence reachability. |
| Truth boundary | pass | `SYNTHETIC_DEMO`, `STUBBED / UNAPPROVED`, `SCHEMATIC ASSEMBLY`, `not dimensional CAD`, and no-legal/no-destination copy are visible. |

The UX result is **GO for the scoped FB-03 fixture-shell experience**, not a release or integration verdict.

## Governing blockers

1. `docs/feature-bibles/FB-00_APPROVAL_PACKET.md` is explicitly `OPEN`. D1 fixture posture, D2 unit-complete endurance contract, D3 schema thaw/refreeze, and qualified item-by-item semantic review have not been recorded as approved.
2. `data/rules/rules.P0.json` does not exist. The mechanical candidate deliberately contains only candidate schemas, receipts, vectors, and synthetic fixtures.
3. No FB-01 freeze receipt establishes the exact canonical Kestrel fixture and evaluate contract. `docs/feature-bibles/FB-03_VISUAL_INSPECTION.md` says an FB-03 candidate cannot pass for integration until it validates against that exact frozen contract.
4. `docs/SHIP_EXECUTION_PLAN.md` keeps truth, engine, and integration mutation lanes on HOLD until FB-00 is approved and the relevant contract is frozen.
5. Demo/release readiness remains separately blocked: eight F1-F8 backend checks are inherited placeholders, FB-02/FB-04 are not implemented, and no fresh-clone FB-07 verdict exists.

These are governance/dependency blockers, not technical defects in the two candidate trees.

## Shortest clearing sequence

1. Record the product-owner D1 `SYNTHETIC_DEMO` posture and exact claim ceiling.
2. Record D2's worked synthetic F1 formula and D3's technical schema thaw/refreeze decision; obtain the required qualified semantic review without promoting unsupported rows.
3. Produce and independently verify the FB-01 freeze receipt for the candidate schemas, canonical fixtures, and evaluate request/response contract.
4. Re-run this exact combined rehearsal. If it remains green, integrate the verified FB-00 mechanical candidate first, run backend/schema checks, then integrate the verified FB-03 candidate and rerun contract/build/browser checks.
5. Continue to FB-02 and FB-04 only when their separate gates open. Overall demo/release remains HOLD until FB-07 passes from a fresh clone.

## Integration and rollback plan after the hold clears

- Integrate one verified candidate at a time; do not squash away the candidate hashes or include `.lane`/local verifier artifacts.
- Preserve candidate-only and synthetic/unapproved labels. Do not create or rename anything to `rules.P0.json` as part of integration.
- After FB-00, run schema validation and `make test-all`; after FB-03, run the 11-test frontend contract, schema-validation bridge, production build, and full Chrome viewport/interaction matrix.
- If either integration step introduces an attributable failure, revert that integration commit in reverse order and preserve the failed candidate/evidence. Do not reset canonical history.

## Fable status

The separately authorized Fable 5.1 GUI review remains `NOT RUN` under the append-only D-050 receipt and correction. No Fable advice was used in this adjudication.
