# CADdyDaddy Candidate 0.2 Dogfood Gap Audit

## Document control

| Field | Value |
|---|---|
| Candidate branch | `ship/diego-ui-takeover` |
| Audited candidate | `f340e55df03a8000a3a10589b1036925308e4ffc` |
| Required ancestry floor | `1ca58f8300f4536e4a1ae2d4095787c83dbb363b` |
| Exact preview receipt | `dpl_Fzcn...` as supplied in the measured dogfood record |
| Audit date | 2026-09-06 |
| Audit mode | Read-only traceability and measured dogfood reconciliation |
| Deployment effect | None |
| Push effect | None |
| Secret use | None |

This document consolidates the fine-grained requirements in all three pre-hackathon documents:

- `/Users/benjihuh/Downloads/dnhacks_design_spec_20260905.md`
- `/Users/benjihuh/Downloads/dnhacks_engineering_direction_20260905.md`
- `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md`

The design document marks decisions D1-D11 as reserved or unratified direction. This audit does not silently convert those decisions into authority. It treats primary-text corrections, explicit feature acceptance criteria, engineering invariants, and claim ceilings as the traceable requirements.

## Status vocabulary

| Status | Meaning |
|---|---|
| `demonstrated/live` | Measured against candidate `f340e55` or its exact preview for the exact behavior stated. |
| `local-only` | Implemented or integrated locally but not demonstrated in the exact preview. |
| `fixture` | Available only through explicit synthetic, offline, precomputed, or legacy-snapshot evidence. |
| `partial` | Some acceptance atoms exist, but an essential atom is missing, blocked, or unmeasured. |
| `absent` | No usable source-to-UI path exists. |
| `contradicted` | Measured behavior or source directly conflicts with the requirement or claim. |
| `hold` | A required owner or authorization gate is unresolved. |

## Evidence rules

- Measured facts are upgraded only to the exact scope observed.
- `193/193` tests prove the committed automated suite passed at `f340e55`; they do not prove an untested live path.
- HTTP 200 proves transport success only. It does not prove that artifact identity contracts were satisfied.
- A proxy or route fix is `pending` until the exact preview demonstrates the repaired path.
- Fixture-backed evidence never upgrades a current live-authored capability.
- Candidate 0.1 Tripwire evidence never upgrades live Candidate 0.2 CAD-to-Tripwire.
- A local commit is not a deployed capability.

# Executive verdict

| Gate | Verdict | Evidence |
|---|---|---|
| Candidate test suite | **PASS** | `193/193` tests passed at `f340e55`. |
| Production build | **PASS** | Build passed at `f340e55`. |
| Dependency audit | **PASS** | `npm audit` reported zero vulnerabilities at `f340e55`. |
| Exact preview machine boundary | **PASS** | Preview `dpl_Fzcn...` machine endpoints and health boundary passed. |
| Browser CAD authoring | **PASS within measured slice** | Two bodies and 200 triangles passed. |
| CAD navigation continuity | **PASS** | Current CAD state survived navigation away and back. |
| Parameter validation | **PASS** | Malformed parameter input was rejected. |
| Concrete snapshot sealing | **PASS** | Native snapshot seal completed for the measured document. |
| Drawing/BOM/STL generation | **FAIL** | HTTP 200 response lacked or adapted the exact manifest/BOM identities required by the client contract. |
| Classification through clean preview URL | **FAIL** | Proxy returned 404 and no backend call occurred. |
| Provenance poison handling | **PASS within bounded semantics** | Poison handling and unauthenticated acceptance semantics passed. Acceptance is not authority and does not mutate CAD by itself. |
| Live current-CAD Tripwire | **ABSENT** | Only immutable Candidate 0.1 legacy snapshot evidence is wired. |
| Native OCCT path | **HOLD** | Owner approval remains unresolved. |
| Mobile layout | **PASS** | All seven primary workspaces had no horizontal overflow at 390 px. |
| Overall dogfood | **PARTIAL PASS, P0 BLOCKED** | Core browser CAD is materially usable, but the product loop cannot reach canonical outputs, clean Classification, or current-CAD Tripwire. |
| Overall release | **HOLD** | Do not promote as the complete pre-hackathon idea-to-execution candidate. |

## Measured candidate evidence

| ID | Measurement | Result | Claim ceiling |
|---|---|---|---|
| `M-01` | Branch `f340e55` automated suite | `193/193 PASS` | Exact committed suite only. |
| `M-02` | Candidate production build | `PASS` | Buildability only. |
| `M-03` | Candidate npm dependency audit | `0 vulnerabilities` | npm dependency audit only. |
| `M-04` | Exact preview machine endpoints and health boundary | `PASS` | Does not prove every proxied product route. |
| `M-05` | Browser two-body authoring | `PASS`, 200 triangles | Browser-kernel authoring only. |
| `M-06` | Navigate away and back to CAD | `PASS` | Measured navigation continuity only. |
| `M-07` | Malformed parameter expression | `PASS`, rejected | Measured malformed case only. |
| `M-08` | Command palette `record` navigation | `PASS` | Exact `record` command only. |
| `M-09` | Provenance poison and unauthenticated acceptance semantics | `PASS` | Bounded byte verification and non-authoritative acceptance only. |
| `M-10` | Seven primary workspaces at 390 px | `PASS`, no horizontal overflow | Horizontal overflow only. |
| `M-11` | Concrete native snapshot seal | `PASS` | Snapshot sealing only, not output generation. |
| `M-12` | Drawing/BOM/STL generation | `FAIL` after HTTP 200 | Response identity adaptation/mismatch blocks acceptance. |
| `M-13` | Classification through clean preview URL | `FAIL`, proxy 404, no backend call | Route fix remains pending. |
| `M-14` | Current live CAD to Tripwire | `ABSENT` | Legacy Candidate 0.1 fixture is separate. |
| `M-15` | Native OCCT execution | `HOLD` | Requires explicit owner approval. |

# Executive priorities

## P0: release blockers

| Priority | Gap | Required next action | Exit evidence |
|---|---|---|---|
| `P0-01` | Output generation identity contract fails despite HTTP 200. | Fix response generation/adaptation so drawing, BOM, STL, detached manifest, source CAD revision, document hash, geometry hash, and BOM identity remain exact. Keep the fix pending until re-dogfooded. | Exact preview accepts all generated artifacts and opens the downstream product-thread gate for the same revision. |
| `P0-02` | Classification clean URL returns proxy 404 and never reaches backend. | Complete the pending route normalization/proxy fix and deploy only through a separately authorized release action. | Exact preview records one backend Classification call and returns the schema-valid response through the clean URL. |
| `P0-03` | Current live-authored CAD has no Tripwire path. | Build a request from the accepted current CAD revision, geometry identity, assembly state, and stable entity IDs. | Tripwire result references current CAD hashes, appears in Record, and is invalidated by a newer CAD revision. |
| `P0-04` | The canonical product thread is unsigned and browser-memory-only. | Implement durable signed events or formally lower every signed/durable claim. | One authoritative replay covers CAD, outputs, provenance, Classification, Tripwire, sourcing, package, and order without untracked legacy events. |
| `P0-05` | Verified source or Classification evidence does not complete the CAD re-derivation loop. | Require explicit human authorization, apply the accepted field to the current design/CAD revision, and rederive downstream outputs. | Exact evidence receipt leads to a new CAD/product revision and fresh outputs/review, with the prior artifacts invalidated. |
| `P0-06` | Native OCCT use lacks owner approval. | Leave native execution disabled and recorded as HOLD until exact approval is captured. | Approval receipt identifies scope, environment, and permitted native operations before execution. |

## P1: credibility and completeness

| Priority | Gap | Required next action | Exit evidence |
|---|---|---|---|
| `P1-01` | Connected sourcing is narrower than the complete BOM workflow. | Derive sourcing rounds from every current BOM line instead of one hardcoded part. | Every BOM line has offers, evidence status, selection/decline result, and audit event. |
| `P1-02` | Full analyst/empowered-official adjudication remains fixture-heavy. | Carry role constraints and reasoned decisions into the connected service contract. | Immutable role-authorized adjudication receipts exist for connected offers. |
| `P1-03` | Canonical 14-row evaluation remains browser-fixture-backed. | Move canonical rule execution behind the product-service seam. | Browser renders dated, content-addressed service output verbatim for the current design revision. |
| `P1-04` | Legacy swap confirmation mutates prior state. | Replace mutation with immutable proposal, authorization, and application events. | Re-derive proves prior proposal bytes never change. |
| `P1-05` | Timeline copy exceeds actual signature and replay evidence. | Label every event as signed, hash-only, fixture, local-memory, or untracked. | No UI text implies a key, signature, durability, or full replay that is not evidenced. |
| `P1-06` | Order replay is client-carried/recording-only. | Add durable idempotency authority or narrow the exactly-once claim. | Claim and implementation agree across cold starts and independent clients. |
| `P1-07` | Connected three-artifact review package is not demonstrated. | Generate exact pre-entry, diligence, and export-reference bytes after the CAD output fix. | Artifacts are downloadable, hash-bound, and carry the required claim ceilings. |
| `P1-08` | Only the `record` command has current measured navigation evidence. | Exercise all workspace commands after route fixes. | Each command reaches its intended workspace in the exact preview. |
| `P1-09` | Responsive pass must survive P0 changes. | Retest all seven workspaces at 390 px after output, Classification, and Tripwire changes. | No horizontal overflow and critical actions remain reachable. |

## P2: stretch, polish, or explicitly deferred

| Priority | Gap | Required next action | Exit evidence |
|---|---|---|---|
| `P2-01` | Visual Now workspace is not mounted. | Expose a truthful read-only UI or retire the dead visual path and keep `/api/now` API-only. | No inaccessible or stale Now claim remains. |
| `P2-02` | Board surface is a static fixture. | Keep it labeled fixture or ingest a real board artifact and deterministic DRC report. | Claim matches rendered artifact class. |
| `P2-03` | Door 3 is deterministic fixture logic. | Convert it to a typed revision-bound proposal flow if retained. | Every proposed slot cites its input and requires explicit acceptance. |
| `P2-04` | Connected STEP/IGES is not measured. | After owner authorization, dogfood exact-revision OCCT import/export. | Round-trip artifacts preserve documented identity and failure boundaries. |
| `P2-05` | Stable face naming and geometry diff remain deferred. | Keep them outside the claim ceiling or implement deterministic topology identity. | Supported edits preserve references and emit exact added/removed/changed entities. |
| `P2-06` | Collaboration is local page-session state. | Add durable authenticated collaboration only if a multi-user claim is desired. | Server-backed replay, conflict handling, identity, and authorization are demonstrated. |

# Fine-grained feature requirement ledger

## F-01 through F-05: design inputs and deterministic review

| ID and requirement | Status | Exact evidence | Accessible UI path | Concrete next action |
|---|---|---|---|---|
| `F-01.1`: Present the Kestrel slot assembly and allow part selection per slot. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:9`. Legacy slot UI exists in [Browser.tsx](../frontend/src/panels/Browser.tsx), backed by the legacy browser store rather than the canonical CAD document. | `Design` | Represent Kestrel slots as canonical CAD/BOM nodes and register accepted changes against the current revision. |
| `F-01.2`: Adjust one wingspan parameter. | `fixture` | Local mutation exists in [store.ts](../frontend/src/store.ts#L735), separate from the takeover CAD parameter model. | `Design` | Make span a typed canonical CAD parameter. |
| `F-01.3`: Recompute power, endurance, range, and review after span changes. | `fixture` | Formulas execute in [rules.ts](../frontend/src/lib/rules.ts#L44) and render in [SpecPanel.tsx](../frontend/src/panels/SpecPanel.tsx#L109). | `Design` | Bind derived output to accepted CAD revision and dated rule-pack hash. |
| `F-02.1`: Display editable values and units. | `partial` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:21`. Legacy fields and generic CAD parameters are separate schemas. | `Design`; `CAD / Core` | Define one shared parameter schema. |
| `F-02.2`: Display source, confidence, evidence state, and consuming thresholds. | `partial` | [SpecPanel.tsx](../frontend/src/panels/SpecPanel.tsx) exposes some source/value data but not uniform default/declared/verified state and all consuming rule IDs. | `Design` | Attach typed provenance and thresholds to every rule-read field. |
| `F-03.1`: Execute the specified 14 compliance rows. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:32`. [rules.ts](../frontend/src/lib/rules.ts#L1) calls itself a local synthetic stand-in. | `Design` | Move canonical evaluation behind product-service. |
| `F-03.2`: Missing inputs cannot fire rules. | `fixture` | Local rules emit `cannot fire` states for missing battery, thermal, IMU, GNSS, flight-controller, and datalink inputs in [rules.ts](../frontend/src/lib/rules.ts#L62). | `Design` | Preserve as schema-level service behavior. |
| `F-03.3`: Child controls propagate to parent through explicit paths. | `fixture` | Thermal and inertial propagation are encoded in [rules.ts](../frontend/src/lib/rules.ts#L75). | `Design` | Return structured propagation edges from the service. |
| `F-03.4`: Keep USML, CCL, EAR99, advisory, and cannot-fire states distinct. | `partial` | Local types distinguish rule and advisory classes; Classification is a separate workspace and currently proxy-blocked. | `Design`; `Classification` | Use one disposition schema across service and product thread. |
| `F-04`: Show destination outcomes without representing them as clearance. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:64`. [Reasoning.tsx](../frontend/src/panels/Reasoning.tsx#L69) includes limited-scan and no-clearance boundaries. | `Design` | Preserve wording and replace fixture calculations with service evidence. |
| `F-05`: Demonstrate a design change with no compliance change. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:75`. Available only in the legacy local change path. | `Design` | Compare two exact accepted CAD revisions through the service. |

## F-06 through F-11: Classification, provenance, proposals, and record

| ID and requirement | Status | Exact evidence | Accessible UI path | Concrete next action |
|---|---|---|---|---|
| `F-06.1`: Request company Classification once. | `contradicted` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:85`. Legacy Design returns a hardcoded cached memo in [store.ts](../frontend/src/store.ts#L329). M-13 shows clean preview URL proxy 404 with no backend call. | `Design`; `Classification` | Complete and demonstrate the pending route fix; remove or relabel the legacy simulated API action. |
| `F-06.2`: Follow ordered USML -> CCL -> EAR99 review. | `partial` | Connected UI describes the order in [ClassificationWorkspace.tsx](../frontend/src/panels/ClassificationWorkspace.tsx#L47), but M-13 prevents a live backend determination. | `Classification` | Dogfood ordered output and blocked EAR99 paths after route repair. |
| `F-06.3`: Reuse a determination only for its exact candidate and revision. | `partial` | Classification can append a browser product-thread event, but no live current-CAD reuse/invalidation proof exists. | `Classification`; `Record` | Bind result to document/geometry hashes and invalidate it after CAD changes. |
| `F-07.1`: Inspect exact source bytes. | `demonstrated/live` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:96`. M-09 passed bounded provenance poison and unauthenticated acceptance semantics. Service implementation: [provenance_api.py](../apps/product-service/product_service/provenance_api.py#L269). | `Sources` | Preserve exact byte and candidate identity in the next preview. |
| `F-07.2`: Verify a quoted span against the same bytes. | `demonstrated/live` | M-09 covers bounded verification semantics. Contract tests pin source and receipt hashes in [operations-connected-contract.test.ts](../frontend/tests/operations-connected-contract.test.ts#L101). | `Sources` | Retain byte reread and poison-intersection evidence. |
| `F-07.3`: Quarantine poisoned instructions. | `demonstrated/live` | M-09 explicitly passed poison semantics. Fixture and detector exist in [provenance_api.py](../apps/product-service/product_service/provenance_api.py). | `Sources` | Preserve both intersecting and non-intersecting poison cases. |
| `F-07.4`: Unauthenticated acceptance remains non-authoritative. | `demonstrated/live` | M-09 passed unauthenticated acceptance semantics. Service claim ceiling is bounded byte verification with no source authority or legal effect. | `Sources` | Keep acceptance labeled local review only. |
| `F-07.5`: Accepted evidence mutates the current CAD design. | `absent` | Connected contract reports `mutated_cad: false` in [operations-connected-contract.test.ts](../frontend/tests/operations-connected-contract.test.ts#L107). | None | Add explicit human authorization and a new canonical CAD revision. |
| `F-08`: Call B proposes an alternative but cannot commit it. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:107`. [store.ts](../frontend/src/store.ts#L361) provides deterministic local proposal behavior. | `Design`; `Sources` | Emit typed revision-bound proposals with separate acceptance. |
| `F-09.1`: One complete append-only product thread. | `contradicted` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:118`. [Record.tsx](../frontend/src/panels/Record.tsx#L7) combines canonical events with untracked legacy events. | `Record` | Migrate all meaningful actions into one event schema and stream. |
| `F-09.2`: Ed25519-sign every event. | `contradicted` | [product-thread.ts](../frontend/src/lib/product-thread.ts#L3) declares `UNSIGNED_NO_ED25519`; [Record.tsx](../frontend/src/panels/Record.tsx#L32) says `MEMORY ONLY - UNSIGNED`. | `Record` | Implement signatures or formally lower the requirement and claims. |
| `F-09.3`: Re-derive payload hashes, signatures, rules, and projection. | `contradicted` | [product-thread.ts](../frontend/src/lib/product-thread.ts#L376) proves only in-session SHA-256 continuity. Legacy [store.ts](../frontend/src/store.ts#L838) verifies neither signatures nor payload chain. | `Record` | Verify canonical bytes, previous hash, signature, actor, rule pack, and projection. |
| `F-09.4`: Detect tampering visibly. | `partial` | Tamper controls exist, but legacy [Timeline.tsx](../frontend/src/panels/Timeline.tsx#L62) checks a different break prefix than the store emits. | `Record` | Fix the state predicate and distinguish simulated from cryptographic failure. |
| `F-09.5`: Preserve CAD and event state across workspace navigation. | `demonstrated/live` | M-06 passed navigation continuity at `f340e55`. | `CAD / Core`; `Record` | Retain as P0 regression coverage and separately address full reload/durable replay. |
| `F-10.1`: Keep a swap proposed until human confirmation. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:129`. Legacy compare/confirm UI exists. | `Design` | Bind proposal to exact base revision. |
| `F-10.2`: Confirmation never mutates proposal history. | `contradicted` | [store.ts](../frontend/src/store.ts#L720) mutates a prior event before appending confirmation. | `Design` | Use immutable proposal, authorization, and application events. |
| `F-11.1`: Call C verifies exact rule-patch bytes. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:140`. Local pack comparison appears in [Reasoning.tsx](../frontend/src/panels/Reasoning.tsx#L175). | `Design` | Verify old/new bytes server-side and persist both hashes. |
| `F-11.2`: Re-evaluate the same design under old and new dated packs. | `fixture` | Local v1/v2 switching exists without current-CAD service binding. | `Design` | Re-run the exact accepted design under immutable pack identities. |

## F-12 through F-19: routing, sourcing, package, and execution

| ID and requirement | Status | Exact evidence | Accessible UI path | Concrete next action |
|---|---|---|---|---|
| `F-12.1`: Derive routing, de minimis, and duty rows. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:151`. Visible output comes from [Reasoning.tsx](../frontend/src/panels/Reasoning.tsx#L115) and the local evaluator. | `Design` | Return dated calculation rows from product-service. |
| `F-12.2`: Label costs and duties as estimates. | `partial` | [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L19) and UI use bounded estimate/no-advice language. Inputs remain fixture or user-provided. | `Design`; `Source` | Preserve claim ceiling in every exported artifact. |
| `F-13.1`: Open sourcing round S1 for the complete current BOM. | `partial` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:162`. Connected UI uses one hardcoded flight-controller part in [Sourcing.tsx](../frontend/src/panels/Sourcing.tsx#L123). | `Source` | Derive connected rounds from every current BOM line. |
| `F-13.2`: Accept bounded user-provided offers. | `local-only` | Stateless offer handling exists in [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L203). Current exact-preview sourcing success was not supplied. | `Source` | Dogfood exact user offer and client-carried continuation after route work. |
| `F-13.3`: Label offline offers and screening as synthetic. | `partial` | Service and UI disclose fixture corpus and no independent verification. | `Source` | Preserve disclosure in all views and artifacts. |
| `F-14.1`: Screen seller, manufacturer, and ownership. | `partial` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:173`. Bounded walks exist in [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L20), without authoritative full-list coverage. | `Source` | Bind each connected result to exact supplied evidence. |
| `F-14.2`: Human selection records decline reasons. | `fixture` | Rich selection/decline workflow exists in the offline lane. | `Source` offline demo | Port reasoned decisions to connected service state. |
| `F-14.3`: Analyst and empowered-official roles differ. | `fixture` | Both roles exist in offline sourcing UI. | `Source` offline demo | Enforce roles in connected durable events. |
| `F-15.1`: Gate technology sharing before package readiness. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:184`. Offline lane presents the declaration gate. | `Source` offline demo | Apply the gate to connected current-BOM artifacts. |
| `F-15.2`: Record but do not validate a typed authorization reference. | `fixture` | [Sourcing.tsx](../frontend/src/panels/Sourcing.tsx) labels the reference typed and not validated. | `Source` offline demo | Preserve wording and append an attested declaration event. |
| `F-16.1`: Generate drawing, BOM, STL, and detached manifest. | `contradicted` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:195`. M-12 failed because HTTP 200 response lacked/adapted exact manifest/BOM identities. | `CAD / Core` -> `Outputs` | Complete pending generate/adaptation fix and re-dogfood exact identities. |
| `F-16.2`: Seal a concrete native snapshot. | `demonstrated/live` | M-11 passed concrete snapshot sealing at `f340e55`. | `CAD / Core` -> `Outputs` | Preserve as a non-regression gate; do not equate seal success with package success. |
| `F-16.3`: Bind package to exact CAD, geometry, STL, and BOM identity. | `contradicted` | [product-thread.ts](../frontend/src/lib/product-thread.ts#L281) requires exact identity, and M-12 shows the response fails that contract. | `CAD / Core` -> `Outputs` -> `Source` | Preserve canonical identities without server/client adaptation drift. |
| `F-16.4`: Build pre-entry, diligence, and export-reference artifacts. | `fixture` | Full three-artifact package exists only in offline [Sourcing.tsx](../frontend/src/panels/Sourcing.tsx). | `Source` offline package | Generate exact connected bytes after F-16.1 passes. |
| `F-16.5`: Stage a synthetic order with no external contact. | `local-only` | [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L494) emits `external_send: false` and zero network calls. Current exact-preview route was not measured. | `Source` | Demonstrate a staged dispatch after exact package binding. |
| `F-16.6`: Exactly-once retry returns the original receipt. | `partial` | [order_api.py](../apps/product-service/product_service/order_api.py#L508) implements recording replay, but authority is client-carried and not globally durable. | `Source` | Add durable compare-and-swap authority or narrow the claim. |
| `F-16.7`: Receipt, inspect, reconcile, and close remain auditable. | `partial` | Order routes exist and are recording-only; no complete exact-preview flow after canonical package binding is demonstrated. | `Source` | Dogfood full lifecycle after output fix. |
| `F-17`: Agent proposes escalation when no offer is acceptable; human resolves. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:206`. [store.ts](../frontend/src/store.ts#L367) is local deterministic behavior. | `Source` offline demo | Tie a typed advisory proposal to a failed connected round. |
| `F-18`: Produce an intent memo citing only fired rules. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:217`. Draft/sign actions are local in [store.ts](../frontend/src/store.ts#L378). | `Design` | Generate from canonical service results and persist cited rule IDs. |
| `F-19`: Produce an unsent supplier clarification request. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:228`. Available in the offline sourcing interaction only. | `Source` offline demo | Generate a reviewable unsent artifact from connected missing fields. |

## F-20 through F-25: board, presentation, stretch paths, and now

| ID and requirement | Status | Exact evidence | Accessible UI path | Concrete next action |
|---|---|---|---|---|
| `F-20`: Render board target and identify DRC/review limitations. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:239`. [BoardView.tsx](../frontend/src/panels/BoardView.tsx) is a static fixture SVG. | Command palette -> `Board` | Retain fixture label or ingest a real board artifact and DRC report. |
| `F-21.1`: Timeline and provenance chips show truthful evidence classes. | `partial` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:250`. Product and legacy events render together, but legacy events are untracked and Timeline copy overstates verification. | `Record` | Badge every row with exact evidence class. |
| `F-21.2`: Failures fail closed and preserve last-valid CAD. | `demonstrated/live` | M-05 and prior measured fillet/zero-radius behavior preserve valid mesh; M-07 rejects malformed input. | `CAD / Core` | Retain as a regression gate and record rejected operations. |
| `F-21.3`: Command palette reaches Record. | `demonstrated/live` | M-08 passed exact command `record` navigation. | Command palette -> `record` | Exercise every remaining workspace command. |
| `F-21.4`: Seven primary workspaces avoid mobile horizontal overflow. | `demonstrated/live` | M-10 passed all seven at 390 px. | All seven primary workspaces | Retest after P0 UI changes. |
| `F-22`: Turn an idea description into a proposed slot list. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:261`. [store.ts](../frontend/src/store.ts#L387) implements deterministic local proposals. | Command palette -> Door 3 | Bind proposals to a base revision and require acceptance. |
| `F-23`: Search configurations against a target without price-only ranking. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:272`. [Reasoning.tsx](../frontend/src/panels/Reasoning.tsx#L190) uses local catalog/rules. | Command palette -> `Design target` | Run search through canonical service and persist rejection reasons. |
| `F-24.1`: Print broker-review, importer-responsibility, and non-advice boundaries. | `fixture` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:283`. Offline package carries the boundaries. | `Source` offline package | Include the same boundary contract in connected artifacts. |
| `F-24.2`: Provide first-run checklist and warnings. | `fixture` | Offline package UI displays checklist and warnings. | `Source` offline package | Make completion explicit and event-backed. |
| `F-25.1`: `/now` reports objective, status, blockers, evidence, and controls read-only. | `partial` | Requirement: `/Users/benjihuh/Downloads/dnhacks_feature_specs_20260905.md:294`. [now.ts](../frontend/api/now.ts) returns read-only machine state, mostly unknown. M-04 confirms machine boundary health, not populated operational state. | `/api/now` | Supply authoritative receipts or preserve UNKNOWN. |
| `F-25.2`: Now is reachable as an operator UI. | `absent` | [candidate02-shell.test.ts](../frontend/tests/candidate02-shell.test.ts#L19) intentionally does not mount Atlas/Now. | None | Expose truthful UI or declare API-only and remove dead UI paths. |

# CAD takeover and Tripwire ledger

| ID and requirement | Status | Exact evidence | Accessible UI path | Concrete next action |
|---|---|---|---|---|
| `CAD-01`: Author sketches and extrusions into multiple bodies. | `demonstrated/live` | M-05 passed two-body authoring with 200 triangles. Source flow: [AuthoringWorkspace.tsx](../frontend/src/panels/AuthoringWorkspace.tsx#L181). | `CAD / Core` | Preserve exact workflow as non-regression coverage. |
| `CAD-02`: Support assembly instances and coincident mates. | `demonstrated/live` | Measured dogfood passed two instances and one coincident mate. Controls are in [AuthoringWorkspace.tsx](../frontend/src/panels/AuthoringWorkspace.tsx). | `CAD / Core` | Include instance and mate state in output identity. |
| `CAD-03`: Reject unsupported geometry and preserve last-valid mesh. | `demonstrated/live` | Browser fillet and zero-radius extrusion failed closed in measured dogfood. Test intent: [browser-kernel.test.ts](../frontend/tests/browser-kernel.test.ts#L69). | `CAD / Core` | Keep fail-closed behavior and append rejection evidence. |
| `CAD-04`: Reject malformed parameter expressions. | `demonstrated/live` | M-07 passed at `f340e55`. | `CAD / Core` | Expand coverage to non-finite, unit mismatch, unknown reference, and trailing-token cases. |
| `CAD-05`: Preserve CAD state across workspace navigation. | `demonstrated/live` | M-06 passed at `f340e55`. | `CAD / Core` -> another workspace -> `CAD / Core` | Preserve as regression; separately prove reload/durable recovery. |
| `CAD-06`: Import/export real STL in browser fallback. | `local-only` | Transfer boundary in [AuthoringWorkspace.tsx](../frontend/src/panels/AuthoringWorkspace.tsx) allows real STL and fails STEP/IGES closed without OCCT. No new exact-preview transfer measurement was supplied. | `CAD / Core` -> `Transfer` | Dogfood exact-revision STL round trip. |
| `CAD-07`: Connected STEP/IGES and native B-rep use OCCT. | `hold` | M-15 records native OCCT owner approval HOLD. | Connected `CAD / Core` only after approval | Do not execute or upgrade status until approval exists. |
| `CAD-08`: Seal and load a concrete native snapshot. | `demonstrated/live` | M-11 passed concrete snapshot sealing. Source: [AuthoringWorkspace.tsx](../frontend/src/panels/AuthoringWorkspace.tsx#L268). | `CAD / Core` -> `Outputs` | Add exact seal/load round trip if not already in measured receipt. |
| `CAD-09`: Generate exact drawing/BOM/STL package. | `contradicted` | M-12 fails after HTTP 200 because returned/adapted manifest and BOM identities do not satisfy the exact client contract. | `CAD / Core` -> `Outputs` | Keep generate fix pending until exact identity acceptance passes. |
| `CAD-10`: Stable face naming and geometry diff. | `absent` | Current live workflow does not demonstrate stable face identity across revisions. Pre-hackathon design lists this as deferred. | None | Keep outside claim ceiling or implement deterministic topology identity. |
| `TW-01`: Bind Tripwire findings to exact face entities. | `fixture` | Live dogfood loaded 12 exact Candidate 0.1 face entities. [CoreAssemblyWorkspace.tsx](../frontend/src/panels/CoreAssemblyWorkspace.tsx#L147) labels the snapshot precomputed/read-only. | `CAD / Core` -> legacy snapshot | Preserve as legacy regression evidence only. |
| `TW-02`: Label legacy Tripwire evidence honestly. | `demonstrated/live` | UI measured label: `LEGACY SNAPSHOT EVIDENCE - NOT LIVE MODEL`. | `CAD / Core` -> legacy snapshot | Retain the boundary. |
| `TW-03`: Execute legacy Tripwire review in deployment. | `partial` | Earlier deployed dogfood returned `REVIEW_SERVICE_UNAVAILABLE`; M-04 proves general machine health but does not prove this route recovered. | Legacy snapshot -> `Check with Tripwire` | Keep route normalization fix pending and remeasure exact request. |
| `TW-04`: Submit current live-authored CAD to Tripwire. | `absent` | M-14 confirms no current-CAD Tripwire path. [TripwirePanel.tsx](../frontend/src/panels/TripwirePanel.tsx) consumes legacy snapshot evidence. | None | Build current-revision review request and exact entity mapping. |
| `TW-05`: Record current Tripwire result in canonical product thread. | `absent` | No current-CAD review event path exists in [product-thread.ts](../frontend/src/lib/product-thread.ts). | None | Append request/result events with current CAD and review hashes. |
| `TW-06`: Invalidate Tripwire result after CAD changes. | `absent` | Only immutable Candidate 0.1 fixture is bound. | None | Block package readiness when CAD revision exceeds review revision. |
| `TW-07`: Proxy repair alone completes CAD-to-Tripwire. | `contradicted` | Route repair can at most restore Candidate 0.1 legacy review; M-14 remains absent by architecture. | None | Maintain separate proxy and live-integration gates. |

# Engineering-direction contract ledger

| ID and requirement | Status | Evidence | UI path | Next action |
|---|---|---|---|---|
| `ENG-01`: Browser uses one product-service seam. | `contradicted` | Direction: `/Users/benjihuh/Downloads/dnhacks_engineering_direction_20260905.md:11`. [App.tsx](../frontend/src/App.tsx#L110) runs browser-local rule evaluation. | `Design` | Make product-service the sole canonical evaluator. |
| `ENG-02`: A deterministic model-free path remains usable. | `partial` | Broad local fixture path works but is disconnected from current CAD and canonical evidence. | `Design`; offline `Source` | Keep it explicitly fixture mode with production-equivalent schemas. |
| `ENG-03`: Rules are dated and content-addressed. | `partial` | Local packs include dates; canonical evaluation is not a verified immutable service artifact. | `Design` | Return rule-pack hash and both dates on every result. |
| `ENG-04`: Order adapter is synthetic and bounded. | `partial` | [order_api.py](../apps/product-service/product_service/order_api.py) is recording-only with no external effect. Global exactly-once durability is absent. | `Source` | Preserve boundary and narrow claim or add durable authority. |
| `ENG-05`: Exactly nine b(2) classes exclude connectors. | `fixture` | Encoded in local rule/catalog data only. | `Design` | Freeze in versioned service corpus and test exclusion. |
| `ENG-06`: Empty fields cannot fire. | `fixture` | Implemented in local [rules.ts](../frontend/src/lib/rules.ts). | `Design` | Enforce in service schema and evaluator. |
| `ENG-07`: Verifier rejects schema and classification-key injection. | `partial` | M-09 passes bounded poison/acceptance semantics. Test definitions exist in [agents.test.ts](../frontend/tests/agents.test.ts#L11). Broader three-schema live path is not separately measured. | `Sources` | Preserve schema rejection receipts across exact preview. |
| `ENG-08`: Signed log is the system of record. | `contradicted` | [product-thread.ts](../frontend/src/lib/product-thread.ts#L3) is unsigned memory-only. | `Record` | Implement signatures/durability or lower claims. |
| `ENG-09`: Swap remains compared until human confirmation. | `contradicted` | Legacy confirmation mutates existing event data in [store.ts](../frontend/src/store.ts#L720). | `Design` | Use immutable event transitions. |
| `ENG-10`: Design fields carry provenance-ready metadata. | `partial` | Legacy attributes and CAD parameters do not share complete source/confidence/evidence schema. | `Design`; `CAD / Core` | Unify field contract. |
| `ENG-11`: Sourcing preserves selection, decline, adjudication, and audit semantics. | `partial` | Full behavior is offline fixture; connected path is narrow. | `Source` | Port full semantics to connected state. |
| `ENG-12`: Tariff data remains explicitly fixture-backed. | `demonstrated/live` | UI/service claim ceilings consistently describe modeled or fixture inputs. | `Source` | Preserve in exports. |
| `ENG-13`: Package includes three review artifacts. | `fixture` | Offline package contains them; connected generation is blocked by M-12. | `Source` | Produce exact connected bytes after P0-01. |
| `ENG-14`: Order send-off has exactly-once semantics. | `partial` | Client-carried recording replay exists; durable global authority does not. | `Source` | Narrow or implement durable idempotency. |
| `ENG-15`: Browser computes nothing authoritative. | `contradicted` | Browser executes legacy rules and sourcing computations. | `Design`; offline `Source` | Label fixture computations and use service output canonically. |
| `ENG-16`: Model calls propose and humans authorize binding acts. | `partial` | UI generally separates proposals, but hardcoded/local outputs sometimes use API or agent framing. | Multiple | Standardize proposal, evidence, authorization, and applied event types. |
| `ENG-17`: Candidate identity remains canonical across services. | `partial` | CAD and thread code enforce hashes; M-12 shows output identity adaptation drift. | Multiple | Require exact candidate/document/geometry/BOM/pack/corpus hashes end to end. |
| `ENG-18`: `/now` is source-neutral and read-only. | `demonstrated/live` | M-04 passes machine endpoint/health boundary; [now.ts](../frontend/api/now.ts) has no mutation authority. | `/api/now` | Preserve UNKNOWN where no receipt exists. |
| `ENG-19`: Now provides useful current objective/status/blocker state. | `partial` | [now.ts](../frontend/api/now.ts) returns mostly UNKNOWN and no visual panel is mounted. | `/api/now` only | Supply receipts or keep the limitation explicit. |
| `ENG-20`: Vocabulary does not overstate clearance, authority, or legal effect. | `partial` | Connected claim ceilings are good; signed-log, API, replay, and current-Tripwire implications still need correction. | Multiple | Apply one vocabulary/claims test across panels and exports. |
| `ENG-21`: Offline mode remains available and distinguishable. | `partial` | Broad offline path exists but shares shell/navigation with narrower connected evidence. | `Design`; `Source`; `Sources` | Keep fixture and connected readiness states separate. |
| `ENG-22`: Retention and replay limitations are explicit. | `partial` | Record and Collaboration disclose memory-only behavior; other copy implies stronger immutability. | `Record`; `Collaboration` | Display storage class and lifetime on every stream. |
| `ENG-23`: Candidate navigation works through command registry. | `partial` | M-08 passes exact command `record`; all command targets are not newly measured. | Command palette | Exercise the complete registry in exact preview. |
| `ENG-24`: All seven primary workspaces remain mobile-safe. | `demonstrated/live` | M-10 passes no horizontal overflow at 390 px. | Seven primary workspaces | Retain after P0 fixes. |

# Primary-text factual correction ledger

| ID | Required correction | Status | Exact evidence | Next action |
|---|---|---|---|---|
| `COR-01` | FY26 MPF is 0.3464 percent, minimum $33.58, maximum $651.50; FY27 changes after October 1. | `partial` | FY26 values appear in [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L65). No evidenced FY27 effective-date switch. | Add dated bands and boundary-date tests. |
| `COR-02` | Use corrected de minimis dates. | `fixture` | Visible through local routing fixtures only. | Move dates into content-addressed service data. |
| `COR-03` | Section 122 is a banner, not an ordinary determined duty. | `fixture` | Local routing/duty presentation only. | Return a separately typed dated notice. |
| `COR-04` | Section 301 Taiwan treatment depends on heading, not country alone. | `fixture` | Local modeled duty rows only. | Add heading-specific dated service evidence. |
| `COR-05` | Section 232 UAS distinguishes 100 percent thermal and 25 percent nonthermal. | `fixture` | Synthetic duty stack only. | Encode applicability inputs and dated authority. |
| `COR-06` | Exactly nine b(2) classes; connectors excluded. | `fixture` | Local rule/catalog data only. | Freeze and test in service corpus. |
| `COR-07` | Origin and value live on individual nodes. | `partial` | Legacy attributes carry them; current CAD and connected sourcing do not share one canonical tree. | Put declared origin/value on BOM nodes. |
| `COR-08` | Items are nested beneath assemblies. | `partial` | Legacy slot tree supports hierarchy; connected sourcing consumes one standalone part. | Derive sourcing tree from CAD/BOM assembly. |
| `COR-09` | Swap is compared, then confirmed. | `contradicted` | [store.ts](../frontend/src/store.ts#L720) mutates prior event state. | Append immutable confirmation/application events. |
| `COR-10` | Country Chart parser covers all 17 TD reasons and Part 122. | `fixture` | No authoritative connected parser was demonstrated. | Implement typed service parser with corpus identity. |
| `COR-11` | The 600 m/s GNSS condition cites both applicable rule contexts. | `fixture` | [rules.ts](../frontend/src/lib/rules.ts#L109) carries EAR and USML context locally. | Preserve both in service output. |
| `COR-12` | Defaults are refinable, not verified facts. | `partial` | Editable local fields lack uniform default/declared/verified states. | Add explicit evidence states. |
| `COR-13` | Ownership review is risk-tiered. | `partial` | [sourcing_api.py](../apps/product-service/product_service/sourcing_api.py#L20) performs bounded walks with no independent authority. | Bind each tier to exact evidence. |
| `COR-14` | Analyst and empowered-official roles differ. | `fixture` | Roles exist in offline sourcing UI only. | Enforce roles in connected service. |
| `COR-15` | Affiliates Rule date is shown and row 14 remains amber. | `fixture` | Offline UI prints the November 10, 2026 return date and advisory treatment. | Bind date to source and retain non-clearance status. |
| `COR-16` | Motor HTS fork and LCSC codes are corrected. | `fixture` | Local catalog/sourcing corpus only. | Add source receipts before authoritative presentation. |
| `COR-17` | US assembly baseline with Taiwan toggle. | `fixture` | Local routing supports the toggle, disconnected from canonical CAD/BOM. | Bind assembly country to current product revision. |
| `COR-18` | Rule pack shows both eCFR and effective dates. | `fixture` | Local pack metadata carries dates. | Include both in immutable service responses. |

# Source capabilities inaccessible or ineffective in the exact preview

| Capability | Source state | Exact-preview/UI state | Classification |
|---|---|---|---|
| Classification | Workspace and service adapter exist. | M-13: clean URL proxy 404, no backend call. | `local-only`, route fix pending |
| Provenance | Inspect/verify/accept service exists. | M-09 passes bounded poison and unauthenticated acceptance semantics. | `demonstrated/live` within bounded ceiling |
| Connected sourcing | One-part bounded service exists. | No new exact-preview success measurement supplied. | `partial`, route status pending |
| Legacy Tripwire | Candidate 0.1 exact-face fixture exists. | General machine health passed, but exact legacy review recovery is not remeasured. | `fixture`, route status pending |
| Live CAD-to-Tripwire | Current CAD and Tripwire exist separately. | M-14: no joining path. | `absent` |
| Concrete snapshot seal | Native snapshot code exists. | M-11 passes. | `demonstrated/live` |
| Drawing/BOM/STL generation | Output generation and exact client admission exist. | M-12 fails identity admission after HTTP 200. | `contradicted`, generate fix pending |
| Command `record` | Command registry/navigation exists. | M-08 passes. | `demonstrated/live` |
| Other command targets | Registry exists. | Not newly measured. | `local-only` or unmeasured |
| Visual Now | Component and machine API exist. | Machine boundary passes; visual panel is not mounted. | `absent` from UI |
| Classification-to-CAD update | Classification can append an event. | Clean route fails and no CAD mutation path is demonstrated. | `absent` |
| Provenance-to-CAD update | Accept route returns bounded receipt. | Acceptance is deliberately unauthenticated/non-authoritative and reports no CAD mutation. | `absent` |
| Collaboration graph | Local event graph exists and is reachable. | Browser-memory-only and separate from canonical CAD thread. | `local-only` |
| Full multi-part sourcing | Rich UI exists. | Explicit offline/synthetic lane. | `fixture` |
| Durable signed history | Hash chain source exists. | Explicitly unsigned and memory-only. | `absent` |
| Native OCCT | Adapter and UI boundaries exist. | M-15 owner approval HOLD. | `hold` |

# Diego and Charlie capability disposition

| Capability lineage | Current disposition |
|---|---|
| Diego browser CAD authoring | Demonstrated: two bodies, 200 triangles, instances, coincident mate, malformed-input rejection, navigation continuity, and safe fail-closed geometry behavior. |
| Diego concrete snapshot path | Demonstrated: concrete snapshot seal passes. |
| Diego output package seam | Still paper-merged: HTTP succeeds, but exact manifest/BOM identity admission fails. |
| Diego native OCCT path | HOLD pending owner approval. |
| Diego-to-Tripwire seam | Absent for current live CAD. |
| Charlie 14-row compliance breadth | Survives mainly as browser fixture rather than canonical service evaluation. |
| Charlie provenance verifier | Demonstrated within bounded poison and unauthenticated acceptance semantics. It still does not mutate CAD or confer authority. |
| Charlie Classification route | Source exists, but clean exact-preview URL returns proxy 404 without backend call. |
| Charlie Call B and Call C | Survive as deterministic/fixture browser behavior. |
| Charlie signed product thread | Lost relative to the specification: current canonical thread is unsigned and volatile. |
| Charlie full sourcing flow | Survives as offline fixture; connected path remains narrower and not newly demonstrated. |
| Charlie package/order flow | Offline synthetic demo is broad; connected execution is recording-only and globally non-durable. |
| Candidate 0.1 Tripwire face binding | Preserved exactly and honestly labeled immutable legacy evidence. |
| Combined idea-to-execution loop | Still incomplete. CAD authoring health improved, but generation, Classification routing, current-CAD Tripwire, durable traceability, and connected full-BOM execution remain open. |

# Claims ledger

| Claim or implication | Verdict | Supportable evidence ceiling | Required correction |
|---|---|---|---|
| Candidate health is broadly broken. | `contradicted` | Tests, build, npm audit, machine health, core browser CAD, navigation, validation, provenance semantics, snapshot seal, command `record`, and mobile layout pass. | Describe the remaining failures precisely rather than generalizing. |
| Drawing/BOM/STL generation works because HTTP returned 200. | `contradicted` | Transport succeeded; exact manifest/BOM identity contract failed. | Keep generation FAIL/pending until client admission passes. |
| Classification is connected in the preview. | `contradicted` | Clean URL proxy 404; no backend call. | Keep route fix pending. |
| Proxy repair completes CAD-to-Tripwire. | `contradicted` | It can at most restore Candidate 0.1 legacy review. Current-CAD path remains absent. | Track route repair and live-CAD integration separately. |
| Tripwire reviews the current CAD model. | `contradicted` | It binds 12 exact Candidate 0.1 legacy faces only. | Say `legacy snapshot evidence`, as the UI currently does. |
| Provenance acceptance is authenticated authority. | `contradicted` | M-09 passes unauthenticated, non-authoritative acceptance semantics. | Say accepted for local review only. |
| Provenance acceptance updates CAD. | `contradicted` | Contract reports no CAD mutation. | Require explicit authorization and new CAD revision. |
| Signed product log. | `contradicted` | In-session unsigned SHA-256 continuity only. | Implement signatures or remove signed language. |
| Re-derive verifies the complete record. | `contradicted` | Canonical replay is memory-only; legacy events are untracked and signatures are not verified. | State exact checks performed. |
| Nothing is deletable. | `contradicted` | Browser-memory state is not durable and legacy confirmation mutates prior event state. | Use session-scoped append-only wording only where true. |
| Company API in the legacy Design flow. | `contradicted` | Hardcoded cached determination. | Relabel or remove. |
| Exactly-once order execution. | `partial` | Client-carried recording replay only; no external order or durable global authority. | Qualify scope or add durable idempotency. |
| Native OCCT is ready. | `contradicted` | Owner approval remains HOLD. | Keep disabled and unclaimed. |
| All command navigation is demonstrated. | `partial` | Exact command `record` passed; other targets were not newly measured. | Exercise remaining commands before broad claim. |
| Mobile is complete. | `partial` | No horizontal overflow across seven workspaces at 390 px passed; this does not prove every interaction or accessibility criterion. | Claim only the measured layout property. |

Zero-unbacked-claims assertion: **not achieved**. The ordered overclaims above must be corrected or their missing evidence demonstrated before release.

# Idea-to-execution blocker chain

| Stage | Current state | Blocking condition |
|---|---|---|
| Idea/requirements | `fixture` | Door 3 proposal is local deterministic behavior. |
| CAD authoring | `demonstrated/live` | Measured two-body authoring, navigation, and malformed-input handling pass. |
| CAD snapshot | `demonstrated/live` | Concrete snapshot seal passes. |
| CAD drawing/BOM/STL | `contradicted` | Exact manifest/BOM identity contract fails after HTTP 200. |
| Tripwire review | `absent` for current CAD | Only Candidate 0.1 legacy face fixture exists. |
| Classification | `contradicted` | Clean preview URL proxy 404 with no backend call. |
| Provenance | `demonstrated/live` within boundary | Poison and unauthenticated acceptance semantics pass; no CAD mutation or authority. |
| Rule re-evaluation | `fixture` | Canonical 14-row service evaluation is not demonstrated. |
| Full-BOM sourcing | `partial` | Connected path is narrower than full BOM and is not newly measured. |
| Package | `fixture` or blocked | Rich package is offline fixture; connected package depends on failed output identities. |
| Order | `partial` | Recording-only client-carried replay; no durable global execution authority. |
| Record/replay | `contradicted` | Unsigned, memory-only canonical thread plus untracked legacy events. |

# Exact release and dogfood verdict

## Dogfood verdict

**PARTIAL PASS, P0 BLOCKED.**

Candidate `f340e55` materially improves the browser CAD slice and candidate health. It has measured passing evidence for the complete automated suite, build, dependency audit, preview health boundary, two-body/200-triangle authoring, navigation continuity, malformed-parameter rejection, command `record`, bounded provenance poison/acceptance semantics, seven-workspace 390 px layout, and concrete snapshot sealing.

The dogfood journey still fails before a complete product loop because drawing/BOM/STL output identity admission fails, Classification never reaches its backend through the clean preview URL, current live CAD has no Tripwire route, source/Classification evidence does not produce a new CAD revision, the signed durable thread is absent, and native OCCT remains held for owner approval.

## Release verdict

**HOLD. Do not represent or promote this candidate as the complete pre-hackathon idea-to-execution workflow.**

The candidate may truthfully claim:

- `193/193` tests, build, and zero npm audit vulnerabilities at `f340e55`.
- Exact preview machine endpoints and health boundary passed for `dpl_Fzcn...`.
- Browser two-body authoring produced 200 triangles.
- Navigation continuity and malformed parameter rejection passed.
- Command `record` navigation passed.
- Bounded provenance poison and unauthenticated acceptance semantics passed.
- All seven primary workspaces had no horizontal overflow at 390 px.
- Concrete snapshot sealing passed.
- Candidate 0.1 Tripwire binds 12 exact legacy face entities and is explicitly not the live model.

The candidate may not yet claim:

- Successful drawing/BOM/STL generation accepted under exact artifact identities.
- Connected Classification through the clean preview URL.
- Current live-authored CAD-to-Tripwire review.
- A route fix that has not been remeasured in the exact preview.
- A generate fix that has not been remeasured against exact manifest/BOM identities.
- Durable or signed product history.
- Source or Classification evidence that updates and rederives current CAD.
- Full-BOM connected sourcing and packaging.
- Globally exactly-once order execution.
- Native OCCT readiness before owner approval.

## Next release decision rule

Reconsider release only after every P0 row has an exact candidate-bound receipt. Passing tests, build, dependency audit, health endpoints, snapshot sealing, and HTTP 200 responses must not substitute for the missing product identity, route, review, authorization, and durability evidence.
