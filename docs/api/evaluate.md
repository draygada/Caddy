# Evaluate API candidate contract

Status: `candidate_unapproved` mechanical Wave-0 prestage from base `4ac523c101d6e9967e582a1c527e038f753aa6ff`. This document fixes candidate shapes and verification vectors only. It is not FB-00 acceptance, an approved rule pack, a legal classification, a destination authorization, a runtime implementation, or evidence that any real product meets a predicate.

All committed response fixtures have `stub: true`. Demo-facing fixtures have `fixture_mode: "SYNTHETIC_DEMO"`; the order-of-review collision pack has `fixture_mode: "NON_DEMO_SYNTHETIC"` and must never appear in the demo. `stub: false` remains unavailable until D1-D3 and the qualified semantic review are recorded.

## Endpoint and request

The browser calls same-origin `POST /api/evaluate`; a later integration lane may proxy that request to FastAPI `POST /evaluate`. Wave 0 implements neither endpoint.

The candidate request schema is `schemas/evaluate-request.candidate.schema.json`:

```json
{
  "request_id": 42,
  "changed_node_id": "nose_thermal",
  "design": {
    "artifact_status": "candidate_unapproved",
    "fixture_mode": "SYNTHETIC_DEMO",
    "root": "kestrel",
    "rule_pack_sha": null,
    "nodes": []
  }
}
```

`request_id` is an opaque non-negative integer allocated monotonically by the UI and echoed unchanged. `changed_node_id` is nullable for an initial load; when non-null, it must resolve to exactly one admitted design node. The complete design is posted. Rules, country-chart conclusions, and legal logic are not posted by the browser.

Before evaluation, the design must independently pass `schemas/design.schema.json` and semantic graph admission. Admission rejects before building an ID map:

- `duplicate_node_id`: more than one `nodes[].id` has the same value;
- `invalid_root`: `root` is missing, resolves to no node, resolves more than once, resolves to a non-product, or has a non-null parent;
- `dangling_parent`: a non-null parent resolves to no node;
- `cycle`: following parent links revisits a node or does not terminate at the root;
- `unsupported_input`: any `items[]` is nonempty in P0.

Wave-0 declarative falsifiers are in `backend/tests/fixtures/design-graph-invalid-vectors.json`. Runtime validation and test code belong to later owning lanes.

## Canonical JSON and revision

`design_revision` is `sha256:` followed by the lowercase SHA-256 of the UTF-8 bytes produced by RFC 8785 JSON Canonicalization Scheme (JCS) over the complete parsed design object exactly as received, before evaluation. Object member order is insignificant; array order is preserved. No whitespace, Unicode normalization, or application-specific field removal is performed beyond JCS.

`backend/tests/fixtures/canonical-json-vectors.json` pins reordered-object equality and array-order inequality. For the committed canonical synthetic Kestrel fixture, the expected revision is:

```text
sha256:fac39ef03be1ba8edbaa30b7cdcfab02e58ca14db00ade4c3c212049b23171dc
```

The browser treats a valid-looking response with a revision other than its current design revision as a contract error. It must not repaint from that response.

## Response

The complete candidate response schema is `schemas/evaluate-response.candidate.schema.json`. Required envelope fields are:

- echoed `request_id`;
- `stub`, fixed to `true` for every Wave-0 fixture;
- `fixture_mode` and `artifact_status`;
- canonical `design_revision`;
- `rule_pack_sha` plus `rule_pack_status` so the digest of `rules.DRAFT.json` is never disguised as an approved pack;
- nullable `destination_policy_sha`, fixed to null in P0;
- `ecfr_date`;
- `determinations`, `delta`, and `summary`.

Each determination contains `state`, `jurisdiction`, `entries`, all three tripwire arrays, one node-level `destinations` object, and `evidence_level`. P0 destinations are always exactly:

```json
{"status": "not_evaluated", "reason": "P0 has no approved destination policy"}
```

`direct_tripwires`, `propagated_tripwires`, and `unresolved_tripwires` use one complete object shape. Every object carries:

- `rule_id`, `state`, `jurisdiction`, `entry`, and `reason_for_control`;
- target `node_id` and originating `cause_node_id`;
- nonempty `facts[]`;
- display `text`, source URL, content date, nullable rule-effective date, and evidence;
- `path` for a propagated object;
- `problem` for an unresolved object, whose state is `cannot_evaluate`.

Every fact object has `attribute`, `observed`, `unit`, `operator`, and `threshold`. A complete tripwire lists every positive condition, prerequisite, exclusion, and propagation fact used by that candidate predicate. Missing facts use `observed: null`, make the tripwire `cannot_evaluate`, and make the determination `question`; stale and unit-incompatible facts behave the same way. They never satisfy a rule and never render clear.

## Request races and contract errors

The UI tracks `latest_issued_request_id`. It applies a response only when all of these are true:

1. response `request_id` equals `latest_issued_request_id`;
2. `design_revision` equals the canonical revision of the current UI design;
3. `rule_pack_sha` and `rule_pack_status` match the currently displayed fixture/runtime mode;
4. every determination, tripwire target/cause, propagation path, and delta node resolves to the admitted design and current rendering map.

An older request ID is discarded as stale. A future/unissued ID, digest mismatch, or unknown node is a loud contract error. The last confirmed state remains visibly stale; none of these cases may paint the design clear. `backend/tests/fixtures/request-race-vectors.json` fixes the candidate outcomes without implementing browser behavior.

## Shape fixtures

All five files below are response-shape vectors, not golden legal outputs:

| Fixture | Mechanical purpose |
|---|---|
| `evaluate-baseline.json` | Complete direct-tripwire and envelope shape for the baseline scenario. |
| `evaluate-battery-flag.json` | Complete causal shape from a synthetic battery input to an unapproved product-level endurance candidate. D2 remains open. |
| `evaluate-camera-flag.json` | Complete synthetic camera predicate, separate RS reason branch, and parent-propagation shapes. |
| `evaluate-no-change.json` | Empty delta and zero changed determinations. |
| `evaluate-missing-evidence.json` | Child and parent questions with complete unresolved fact objects. |

The camera fixture does not establish camera semantics. It includes synthetic FPA qualification and every Note 3 exclusion placeholder so the 9 Hz comparison is never presented as a complete standalone finding. Its separate RS object requires the base entry and shows that exactly 60 Hz does not satisfy `> 60`; its synthetic 327,680-element fact is the only satisfied numeric branch over 111,000. These values are response-shape data only. Boundary tests are not admitted until the signed full predicate exists; Wave 0 adds no such test.

The five fixtures pin the exact unapproved draft input digest as:

```text
sha256:ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f
```

`rule_pack_status: "unapproved_input"`, `stub: true`, synthetic evidence, and the `[UNAPPROVED SHAPE VECTOR]` display prefix are mandatory together. No fixture may be relabeled live or verified.

## Fixture custody and duplication

`data/demo/kestrel-baseline.design.json` is the single editable canonical design fixture. `backend/tests/fixtures/kestrel-baseline.design.json` is its byte-identical test duplicate. `backend/tests/fixtures/fixture-duplication-checks.json` pins their raw SHA-256 and canonical design revision; a later contract test must compare the files mechanically rather than letting them drift.

The rendering-only coordinates in `data/demo/kestrel.scene.json` never enter the design digest or legal facts. The catalog in `data/demo/kestrel-catalog.json` uses synthetic MPNs and values only.

## Synthetic order-of-review pack

`backend/tests/fixtures/synthetic-collision.input.json` and `.output.json` are wholly fabricated, non-demo vectors. They fix only control flow:

```text
USML candidate -> CCL candidate -> EAR99 fallback
```

The pack proves by expected data that the synthetic USML match wins a collision, the synthetic CCL candidate is considered only after USML rejection, an unresolved specific CCL fact blocks EAR99, and EAR99 becomes available only after both named specific candidates are explicitly rejected. Its labels are deliberately impossible synthetic entries and support no real coverage or classification claim. Engine tests and implementation wait for FB-02.

## Remaining gates

This candidate cannot be promoted until the product owner records D1, the engineering/source owner records D2, the technical owner approves and refreezes D3, and a qualified export-controls reviewer resolves every item in FB-00 with exact source spans. Vendor/source gaps are enumerated without inferred classifications in `data/rules/vendor-evidence-gaps.WAVE0-CANDIDATE.json`.
