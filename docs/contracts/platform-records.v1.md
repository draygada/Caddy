# Frozen cross-lane contract: product-thread records v1

- Contract ID: `FORGE-PLATFORM-RECORDS-001`
- Wire version: `forge.record/1`
- Freeze state: `FROZEN_FOR_6H_CANDIDATE`
- Authority: main integration owner
- Canonical encoding: UTF-8 JSON, RFC 8785 canonicalization, SHA-256 lowercase hex
- Geometry companion: `docs/contracts/part-document.v1.md`
- Normative vectors: `docs/contracts/platform-records.v1.test-vectors.json`

This contract freezes the smallest cross-lane identity, authorization, event, provenance, and
product-thread boundary needed to connect mission intent to a synthetic delivered product and a
new change proposal. It does not claim that every admitted record kind has executable behavior.
The 69-row parent denominator and generated atomic capability ledger are independent evidence
indexes; neither architecture intent nor a parent row can promote an implementation verdict.

All data in the six-hour fixture is synthetic or public. `external` is always `false`. No record,
authorization, local dispatch, generated artifact, or UI state permits a real supplier/customer
send, purchase, production-machine action, mission command, compliance conclusion, safety
conclusion, or controlled-data handling. Unsupported operations fail closed.

## Authority domains and lane ownership

| Authority domain | Sole writer lane | Canonical truth |
|---|---|---|
| `mission` | mission-requirements | scenario/need, outcomes, requirements, constraints, verification methods, trade inputs, assumptions, decisions, change impact |
| `geometry` | history-collaboration through core-kernel evidence | Part/Assembly revision intent, results, artifacts, proposals, semantic diffs |
| `assembly` | assemblies-configurations | configurations, definition/occurrence composition, variants, assembly analyses derived from exact geometry revisions |
| `drawing` | drawings-mbd | DrawingDocument, authored/preserved/display PMI distinctions |
| `analysis` | simulation-generative | AnalysisStudy inputs/results, solver provenance, benchmarks, bounded trade computations |
| `electronics` | ecad-routing | ElectronicsDocument, imported connectivity/routing and ECAD handoff records |
| `manufacturing` | manufacturing | ManufacturingPlan, ordered routing definitions, process intent, setup/stock/workholding, capability requirements, bounded CAM/additive/instruction evidence |
| `supply` | supply-erp | item/BOM planning, make/buy, synthetic sourcing, cost/lead/capacity, planning orders, routing demand, allocations and shortages |
| `execution` and `quality` | mes-quality | released execution snapshots, traveler, observed build/genealogy/WIP, inspection/test/NCR/disposition/acceptance/release gate |
| `operations` | operations-feedback | delivered asset, observation, maintenance/failure finding, triage, corrective-action/change-proposal trigger |
| `platform` | platform-security | actors, authorization receipts, idempotent local dispatch receipts, ProductThread graph audit, read-only Shipyard projection |

A lane can store an immutable `RecordRef` to another domain but cannot mirror or mutate that
domain's payload. Wrong-domain writes are rejected before a new revision or event is created.
The history lane is the append-only persistence mechanism; it does not acquire another domain's
semantic write authority.

Manufacturing owns routing definitions. Supply owns demand and capacity allocation derived from an
exact ManufacturingPlan revision. A supply planning work order is never MES execution.
Manufacturing owns intended instructions and release criteria; MES owns issued/acknowledged
instructions, observed execution and release-gate truth. CAM, simulation, or postprocessor output
can never stand in for an inspection result, MES completion, or release receipt.

## Scalar, time, and strictness rules

- Identifiers are stable, opaque, non-empty strings. Array positions are never identity.
- Hashes are 64 lowercase hexadecimal characters. Content-addressed IDs use the required prefix
  followed by the exact digest.
- Numeric domain values use the canonical decimal grammar and exact-rational rules in the geometry
  companion contract. Quantities always carry an explicit unit.
- Times are fixed-offset RFC 3339 strings with seconds (`YYYY-MM-DDTHH:MM:SSZ` in the fixture).
  Times are evidence, not freshness authority; consumer freshness is computed at read time.
- Every object is strict. Fields shown below are required, including nullable fields. Unknown
  fields, versions, kinds, lifecycle values, and enum values fail closed.
- Maps use RFC 8785 key order. Arrays are ordered only when declared; set-like arrays are unique and
  lexicographically sorted by their declared identity key before hashing.
- No envelope or artifact contains credentials, secrets, prompts, transcripts, absolute paths, raw
  controlled data, or executable source.

## Exact immutable reference

Every cross-record edge uses exactly:

```json
{
  "record_kind": "mission.requirement.v1",
  "record_id": "requirement:mass",
  "revision_id": "record-rev:<sha256>",
  "content_hash": "<sha256>",
  "authority_domain": "mission"
}
```

All five fields participate in resolution. There is no `latest` lookup at execution time. Missing
records, changed payloads, mismatched revisions/hashes/kinds/domains, withdrawn effective inputs,
or unsupported versions return a stable diagnostic and create no mutation. A record may separately
describe the observed/effective lifecycle of a reference, but those observations are not part of
identity and cannot weaken exact resolution.

## Canonical record envelope and hashes

Every non-geometry product record uses this strict envelope:

```json
{
  "schema_version": "forge.record/1",
  "record_kind": "mission.requirement.v1",
  "record_id": "requirement:mass",
  "revision_id": "record-rev:<sha256>",
  "content_hash": "<sha256>",
  "parent_revision_ids": [],
  "lifecycle_state": "DRAFT",
  "authority_domain": "mission",
  "actor": {"actor_id": "actor:lead", "actor_type": "HUMAN", "alias": "program-lead"},
  "authorization_ref": null,
  "command_id": "command:create-mass-requirement",
  "idempotency_key": "fixture:create-mass-requirement:v1",
  "occurred_at": "2026-09-05T16:00:00Z",
  "recorded_at": "2026-09-05T16:00:00Z",
  "effective_window": {"from": null, "through": null},
  "source_confidence": {"level": "DECLARED", "basis": "synthetic fixture", "observed_at": "2026-09-05T16:00:00Z"},
  "source_refs": [],
  "provenance": {
    "adapter_id": "forge-native",
    "adapter_version": "1",
    "tool_identity": "forge@<commit>",
    "input_record_refs": [],
    "artifact_refs": [],
    "generated_at": "2026-09-05T16:00:00Z"
  },
  "units": {"system": "SI_MM", "overrides": {}},
  "tolerances": {"linear_mm": "0.000001", "angular_deg": "0.000001"},
  "claim_ceiling": "SYNTHETIC_LOCAL_ONLY",
  "payload": {}
}
```

`actor_type` is `HUMAN | AGENT | SYSTEM`. Confidence is `MEASURED | DECLARED | INFERRED |
UNKNOWN`; measured values require an evidence/artifact reference. `claim_ceiling` is always
`SYNTHETIC_LOCAL_ONLY` for the candidate.

`content_hash` is SHA-256 over the exact RFC 8785 envelope with `revision_id` and `content_hash`
omitted. `revision_id` is exactly `record-rev:<content_hash>`. Parent revisions are ordered.
Timestamps therefore participate in immutable identity, and deterministic replay uses the stored
times rather than reading the clock. `source_refs` sort by `(authority_domain, record_kind,
record_id, revision_id)`; provenance input refs use the same order. Artifact refs sort by
`artifact_id`. Payload array ordering is defined per record kind.

## Commands, authorization, events, and exactly-once effects

A mutation enters through this strict `CommandEnvelope`:

```json
{
  "protocol_version": "forge.command/1",
  "command_id": "command:<opaque>",
  "command_hash": "<sha256>",
  "command_kind": "CREATE_RECORD",
  "target_authority_domain": "mission",
  "target_record_kind": "mission.requirement.v1",
  "target_record_id": "requirement:mass",
  "base_revision_id": null,
  "base_content_hash": null,
  "actor": {"actor_id": "actor:lead", "actor_type": "HUMAN", "alias": "program-lead"},
  "intent": "Create measurable mass requirement",
  "authorization_ref": null,
  "idempotency_key": "fixture:create-mass-requirement:v1",
  "external": false,
  "payload": {}
}
```

`command_kind` is `CREATE_RECORD | REVISE_RECORD | TRANSITION_RECORD | REQUEST_LOCAL_DISPATCH |
ROLLBACK_RECORD`. A create has null base fields; every other command pins both base fields.
`command_hash` is SHA-256 over the RFC 8785 command with `command_hash` omitted. The tuple
`(target_authority_domain, idempotency_key)` is unique: an identical command returns the original
receipt with no duplicate event/effect, while the same key and different hash fails
`IDEMPOTENCY_CONFLICT`.

Authorization is a strict record kind `platform.authorization-receipt.v1` whose payload is:

```json
{
  "authorization_id": "authorization:<opaque>",
  "state": "AUTHORIZED",
  "requested_command_hash": "<sha256>",
  "requester_actor_id": "actor:agent",
  "authorizer_actor_id": "actor:lead",
  "capability": "record:transition",
  "scope": {"authority_domain": "execution", "record_kind": "quality.deviation.v1", "record_id": "deviation:fixture"},
  "conditions": {"external": false, "expires_at": "2026-09-05T22:00:00Z"},
  "previous_authorization_revision_id": null,
  "reason_code": "SYNTHETIC_FIXTURE_APPROVED"
}
```

Authorization state is `REQUESTED | AUTHORIZED | DENIED | REVOKED | EXPIRED`. Authorization is
separate from application and verification. The authorizer must be a distinct human for local
synthetic order dispatch, NCR deviation/rework, product release, and the post-feedback change
proposal. A denied, stale, expired, out-of-scope, wrong-command-hash, or agent-self-authorized
receipt creates no target mutation.

Every accepted command appends this strict event:

```json
{
  "protocol_version": "forge.event/1",
  "event_id": "event:<sha256>",
  "event_hash": "<sha256>",
  "event_order": 1,
  "product_thread_id": "product-thread:fixture",
  "state": "APPLIED",
  "command_id": "command:<opaque>",
  "command_hash": "<sha256>",
  "authorization_ref": null,
  "before_ref": null,
  "after_ref": {},
  "effect_ref": null,
  "previous_event_hash": null,
  "occurred_at": "2026-09-05T16:00:00Z",
  "diagnostics": []
}
```

Event state is `REQUESTED | AUTHORIZED | APPLIED | VERIFIED | ROLLED_BACK | REJECTED`. An event
does not skip states where authorization is required. `event_hash` is SHA-256 over the full RFC
8785 event with `event_id` and `event_hash` omitted; `event_id` is `event:<event_hash>`. Event order
is contiguous per ProductThread, and `previous_event_hash` creates an append-only chain. The exact
`before_ref`, `after_ref`, and authorization/effect refs are null or complete immutable references.
Diagnostics are ordered strict `{code,severity,message,target_ref}` objects.

A local synthetic dispatch uses `platform.local-dispatch-receipt.v1`. It binds command hash,
authorization, exact order/configuration/BOM/recipient/quantity/attachment refs, a synthetic sink
ID, attempt count, and one stable effect ID. State is `REQUESTED | AUTHORIZED | APPLIED | VERIFIED |
ROLLED_BACK | FAILED`. The adapter writes only to a disposable local sink. Crash, timeout, and
lost-response recovery query by idempotency key/effect ID; replay can increase attempt count but
cannot create a second effect. `external:true`, a non-synthetic recipient, or missing independent
authorization fails before dispatch.

## Document boundary payloads

The envelope `payload` is strict for these canonical documents. Each ordered array names its sort
rule; every referenced object is the exact five-field `RecordRef`.

### PartDocument and AssemblyDocument

`geometry.part-document.v1` carries payload
`{document_revision_ref, geometry_hash, result_artifact_refs, engine_manifest_hash}`.
`geometry.assembly-document.v1` carries payload `{document_revision_ref,
assembly_content_hash, assembly_geometry_hash, resolved_configuration_ref,
assembly_result_ref, core_composition_receipt_ref, engine_manifest_hash}`. The referenced
documents, B-rep bodies, reusable part/assembly definitions, full occurrence paths,
configuration state, fixed transforms, recursive BOM, selection, viewport, and STEP/STL rules
are exclusively defined by the geometry companion. Assembly intent/result authority and core
exact-B-rep execution authority remain separate; wrappers cannot fabricate either.

### DrawingDocument

`drawing.document.v1` payload has exactly `drawing_id`, `model_ref`, `configuration_ref`,
`sheet_standard_ref`, `sheets`, `authored_semantic_pmi`, `preserved_semantic_pmi`,
`graphical_pmi_presentations`, `inspection_characteristic_refs`, and `export_artifact_refs`. Sheets
sort by `sheet_id`; views within a sheet sort by `view_id`; every view pins model revision,
orientation, scale and projection type. The three PMI arrays remain distinct. An unexecuted schema
or a rendered placeholder cannot claim HLR, associative update, GD&T validation, AP242, PDF, DWG,
or DXF behavior.

### ManufacturingPlan

`manufacturing.plan.v1` payload has exactly `plan_id`, `product_configuration_ref`,
`source_geometry_refs`, `ordered_operations`, `setup_refs`, `stock_ref`, `workholding_refs`,
`capability_requirement_refs`, `tool_requirement_refs`, `work_instruction_refs`,
`inspection_characteristic_refs`, `simulation_evidence_refs`, `output_artifact_refs`, and
`release_criteria_refs`. Operation order is semantic and each operation has stable
`operation_id`, predecessor IDs, input/output refs, setup, capability/resource requirements,
declared units/tolerances, and claim ceiling. Production-safe NC and machine control are outside
the candidate.

### AnalysisStudy

`analysis.study.v1` payload has exactly `study_id`, `study_type`, `mission_need_refs`,
`requirement_refs`, `candidate_alternative_refs`, `selected_configuration_ref`, `geometry_refs`,
`material_refs`, `mesh_ref`, `load_refs`, `constraint_refs`, `solver_manifest_ref`,
`benchmark_refs`, `convergence_criteria`, `result_refs`, `verification_evidence_refs`,
`assumption_refs`, `limitations`, and `accuracy_ceiling`. A positive computation claim requires
real candidate inputs, pinned solver/tool identity, units, convergence/benchmark evidence, and a
recomputed result. A stored score or image is HOLD.

### ElectronicsDocument

`electronics.document.v1` payload has exactly `electronics_id`, `source_artifact_refs`,
`library_manifest_ref`, `schematic_ref`, `board_ref`, `net_refs`, `component_refs`,
`variant_refs`, `rule_check_refs`, `manufacturing_output_refs`, `enclosure_geometry_ref`,
`cooling_analysis_ref`, `sync_conflicts`, and `limitations`. Imported/preserved data, boundary
validation, routing, DRC, manufacturing output, SPICE, signal integrity, and cooling are separate
claims. No record implies native ECAD authoring.

### ProductThread

`platform.product-thread.v1` payload is:

```json
{
  "product_thread_id": "product-thread:fixture",
  "product_id": "product:fixture",
  "configuration_ref": {},
  "root_refs": [],
  "nodes": [],
  "edges": [],
  "ordered_event_refs": [],
  "release_refs": [],
  "delivery_refs": [],
  "feedback_refs": [],
  "change_proposal_refs": [],
  "graph_digest": "<sha256>"
}
```

Each node has exactly `record_ref`, `stage`, `owner_alias`, `completion_class`, `proof_class`,
`evidence_digests`, and `blockers`. `stage` is one of the ordered journey stages below.
`completion_class` is `NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE`; `proof_class` is `TARGET |
IMPLEMENTED | DEMONSTRATED`. `COMPLETE` is forbidden unless the canonical record and its required
evidence exist on the exact candidate. Evidence digests are sorted lowercase SHA-256 values.

Each edge has exactly `edge_id`, `edge_type`, `source_ref`, `target_ref`, `source_role`,
`target_role`, and `edge_hash`. Its hash is SHA-256 over the edge with ID/hash omitted; its ID is
`edge:<edge_hash>`. Edges sort by `(source revision, target revision, edge_type, edge_id)`. Nodes
sort by record reference. `graph_digest` hashes the exact RFC 8785 object containing
`product_thread_id`, `product_id`, configuration ref, sorted node refs, sorted full edges, ordered
event refs, release refs, delivery refs, feedback refs, and change-proposal refs. Graph audit rejects
orphan nodes, broken refs/hashes, mismatched product/configuration identity, duplicate terminal
effects, cycles outside explicit revision ancestry, missing ordered stages, and event-chain gaps.

## Frozen record-kind registry

These kind IDs are boundary identifiers, not evidence that their behavior exists.

Mission owns: `mission.scenario.v1`, `mission.need.v1`, `mission.threat-need.v1`, `mission.effect.v1`,
`mission.measure.v1`, `mission.requirement.v1`, `mission.constraint.v1`,
`mission.verification-method.v1`, `mission.trade-study.v1`, `mission.alternative.v1`,
`mission.assumption.v1`, `mission.unknown.v1`, `mission.decision.v1`, and
`mission.change-impact.v1`.

Mission payloads require a synthetic/public data classification, immutable source spans, owner,
uncertainty and approval state. Acceptance criteria have stable ID, metric, comparator, canonical
threshold/unit, exact verification-method ref and `PLANNED | EVIDENCED | SATISFIED | FAILED`
evidence state; planned or missing evidence cannot satisfy a criterion. Trace links are typed exact
refs to CAD parameter/feature, analysis result/artifact and product/BOM records. Requirement ranking
pins weights, components and stable-ID tie-break and is deterministic; it cannot claim operational
optimization. Operational feedback may initiate only a `PROPOSED`/`REVIEW_REQUIRED` impact and
change proposal against an exact released base. Mission cannot authorize, apply or verify it, copy
foreign domain payloads, mutate a release, admit controlled/classified inputs, or generate military
operational recommendations.

Supply owns: `supply.item.v1`, `supply.item-revision.v1`, `supply.bom.v1`,
`supply.bom-revision.v1`, `supply.make-buy-decision.v1`, `supply.approved-alternative.v1`,
`supply.supplier.v1`, `supply.quote.v1`, `supply.inventory-position.v1`,
`supply.purchase-order.v1`, `supply.work-order.v1`, `supply.resource.v1`,
`supply.resource-calendar.v1`, `supply.capacity-bucket.v1`, `supply.routing-demand.v1`,
`supply.allocation.v1`, `supply.shortage-risk.v1`, `supply.planning-scenario.v1`, and
`supply.reallocation-plan.v1`.

Supply payload minimums are exact revision bindings plus: item revision identity/unit/lifecycle;
ordered BOM lines with quantity/unit/scrap/effectivity/alternative group; authorized make/buy and
alternative scope/effectivity; explicitly synthetic suppliers and quotes with currency, unit cost,
MOQ, lead time, validity, confidence and observation provenance; inventory as-of state; synthetic
planning order state; resource/calendar capacity buckets; routing demand derived from an exact
ManufacturingPlan operation; allocations/unmet demand; and deterministic base-preserving planning
scenarios. Observed quotes/inventory never become effective or authorized merely by ingestion.

Execution/quality owns: `mes.production-order.v1`, `mes.traveler.v1`, `mes.station.v1`,
`mes.operation.v1`, `mes.operation-execution.v1`, `mes.work-instruction.v1`,
`mes.work-instruction-ack.v1`, `mes.resource.v1`, `mes.tool.v1`,
`mes.operator-authorization.v1`, `mes.serial-unit.v1`, `mes.material-lot.v1`,
`mes.consumption.v1`, `mes.genealogy-link.v1`, `mes.wip-state.v1`,
`mes.final-assembly.v1`, `quality.characteristic.v1`, `quality.inspection-result.v1`,
`quality.test-result.v1`, `quality.nonconformance.v1`, `quality.deviation.v1`,
`quality.rework.v1`, `quality.acceptance.v1`, and `quality.release-gate.v1`.

An issued traveler revision is immutable. Operation state is `NOT_STARTED | READY | IN_PROGRESS |
PASS | FAIL | UNDER_NC | REWORK_AUTHORIZED | DEVIATION_AUTHORIZED | REWORK_IN_PROGRESS |
REINSPECTION_REQUIRED`; there is no direct `FAIL` to `PASS`. The original failed result survives a
separately authorized disposition, execution and new verification. NCR state is `OPEN |
DISPOSITION_PENDING | AUTHORIZED_DISPOSITION | VERIFICATION_PENDING | CLOSED`. A release gate is
`BLOCKED | ELIGIBLE | RELEASED`; any missing/stale characteristic, incomplete operation, genealogy
gap, unresolved NCR, or unauthorized disposition blocks it. Every evaluation is a new immutable
revision.

Operations owns: `operations.delivered-asset.v1`, `operations.delivery-receipt.v1`,
`operations.configuration-baseline.v1`, `operations.observation.v1`,
`operations.maintenance-event.v1`, `operations.confidence-source.v1`,
`operations.failure-finding.v1`, `operations.affected-trace-links.v1`,
`operations.triage.v1`, `operations.corrective-action-proposal.v1`,
`operations.impact-analysis.v1`, `operations.no-action-closure.v1`, and
`operations.change-proposal-trigger.v1`.
Each finding binds the delivered asset/unit, immutable release/configuration baseline, source and
confidence, affected requirement/design/BOM/process refs, triage, impact analysis and a new exact-
base proposal. Feedback cannot revise the released packet, and a proposal is never equivalent to
an applied or verified change.

Platform owns: `platform.actor.v1`, `platform.authorization-receipt.v1`,
`platform.local-dispatch-receipt.v1`, `platform.release-packet.v1`,
`platform.product-thread.v1`, `platform.graph-audit.v1`, and
`platform.shipyard-projection.v1`.

## Closed-loop journey gate

The required stages, in exact order, are:

1. `MISSION_NEED`
2. `REQUIREMENTS`
3. `TRADE_ANALYSIS`
4. `CAD_CONFIGURATION_BOM`
5. `SOURCING_CAPACITY`
6. `AUTHORIZED_SYNTHETIC_ORDER`
7. `ROUTING_WORK_INSTRUCTIONS`
8. `WIP_FINAL_ASSEMBLY`
9. `INSPECTION_NONCONFORMANCE`
10. `AUTHORIZED_RELEASE`
11. `SYNTHETIC_DELIVERY`
12. `OPERATIONAL_FEEDBACK`
13. `CHANGE_PROPOSAL`

One `product_thread_id` and stable product/configuration identity connect every stage. The trade
has at least two alternatives and a bounded computation from declared inputs. CAD uses actual
server-kernel B-reps, fixed-transform assembly and tessellation. Cost, lead time, capacity,
inspection and test results are recomputable. The order pins approved geometry/configuration/BOM,
synthetic recipient, quantity, attachments, authorization and idempotency. Manufacturing and MES
use their supported commands/state machines. The injected evidence gap and unresolved NCR block
release; an independently authorized disposition preserves the original failure before rework and
reinspection. Release is content-addressed and immutable. Delivery and feedback cite that release;
the final proposal has a new authorization and exact base and remains unapplied.

Fresh-process serialization/replay must preserve the same record hashes, graph digest, event chain,
stable IDs, artifacts and fingerprints. Required adversarial cases are stale base, tampered ref,
duplicate order retry, idempotency-key payload collision, worker interruption/lost response,
capacity double-booking, out-of-effectivity alternative, unmet release gate, failed inspection,
authorization scope/expiry, NCR disposition and reinspection, post-release feedback, attempted
release mutation, shuffled set input, refresh/re-entry, and attempted projection write.

Human outcome and canonical integrity are scored separately. An API/ledger-only pass without a
usable rendered journey is `UNPROVABLE`; a rendered dashboard backed by a separate fixture store is
`FAILED`. Likewise a script that bypasses supported product entry points cannot pass.

## Shipyard read-only projection and browser-safe receipt

Shipyard consumes only `platform.shipyard-projection.v1` derived from the exact ProductThread and
event chain. It exposes stable aliases, record/revision/hash tuples, stage/proof/completion states,
blockers, evidence digests and observed freshness. It cannot create commands, authorization,
records, events, evidence, or status promotion. Projection write attempts fail
`PROJECTION_READ_ONLY`; refresh and re-entry must reproduce canonical source state.

The main integration owner may commit a source-derived receipt under
`docs/evidence/closed-loop-receipt.v1.json`. It contains exactly `schema_version`,
`candidate_commit`, `candidate_tree`, `observed_at`, `source_state`, `product_thread_id`,
`product_id`, `configuration_ref`, `synthetic_only`, `external`, `ordered_stages`,
`ordered_lineage`, `ordered_authorization_states`, `atomic_capabilities`, `parent_rollups`,
`blockers`, `graph_digest`, `evidence_digests`, `focused_verifier_results`, and `content_digest`.

`source_state` carries only public-safe source/contract/ledger digests and exact state labels.
Each atomic-capability entry carries `atomic_id`, `parent_id`, `mandatory`, `implementation_class`,
`delivery_class`, `execution_locus`, `authority_owner`, `executor_owner`, `fidelity`, `entitlement`,
`platforms`, `security_zone`, evidence refs/digests, stable failure/recovery, dependency IDs,
`lifecycle_status`, `proof_status`, `verdict`, and `claim_ceiling`. Each parent rollup carries its
parent ID, child counts/digest, worst-mandatory-child status and implemented-mode set; it never
becomes a row-level implementation verdict or percentage. Every lineage entry carries only record
kind/id/revision/hash, edge type, source/target refs, owner and actor aliases, completion/proof class
and evidence digests.

The receipt excludes raw content/geometry, BOM/supplier/customer/recipient data, native task IDs,
private or absolute paths, prompts and transcripts. `content_digest` hashes the receipt with that
field omitted. Contract/planning presence is recorded as TARGET/HOLD, never implemented evidence.
A later receipt is implementation evidence only after the same clean candidate passes both the
canonical graph audit and rendered human journey.

## Stable diagnostics

At minimum: `SCHEMA_UNSUPPORTED`, `RECORD_KIND_UNKNOWN`, `FIELD_UNKNOWN`, `HASH_MISMATCH`,
`REFERENCE_MISSING`, `REFERENCE_STALE`, `REFERENCE_AUTHORITY_MISMATCH`, `WRONG_AUTHORITY`,
`STALE_BASE`, `LIFECYCLE_INVALID`, `AUTHORIZATION_REQUIRED`, `AUTHORIZATION_INVALID`,
`AUTHORIZATION_EXPIRED`, `SEPARATION_OF_DUTIES_REQUIRED`, `IDEMPOTENCY_CONFLICT`,
`DUPLICATE_EFFECT`, `DISPATCH_EXTERNAL_FORBIDDEN`, `CAPACITY_EXCEEDED`,
`ALTERNATIVE_OUT_OF_EFFECTIVITY`, `TRAVELER_IMMUTABLE`, `EXECUTION_PRECONDITION_MISSING`,
`GENEALOGY_MISMATCH`, `NONCONFORMANCE_UNRESOLVED`, `RELEASE_BLOCKED`, `RELEASE_IMMUTABLE`,
`GRAPH_ORPHAN`, `GRAPH_BROKEN_EDGE`, `EVENT_CHAIN_INVALID`, and `PROJECTION_READ_ONLY`.

## Claim ceiling

Contract conformance is at most boundary mechanics. A schema, ledger row, fixture, mock, queue,
branch, rendered card, or successful import cannot establish the underlying CAD/CAM/CAE/ECAD,
manufacturing, ERP, MES, security, or product-lifecycle capability. Only exact clean-candidate
execution that survives the relevant falsifier can receive a positive evidence verdict. Product
GO remains separately gated on the real integrated geometry/history/browser/exchange/assembly
spine and the connected rendered closed loop.
