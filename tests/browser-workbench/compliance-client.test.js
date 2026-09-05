import assert from "node:assert/strict";
import test from "node:test";

import { canonicalSha256, createComplianceRequest, requestComplianceReview, toComplianceDiagnostic, validateComplianceResponse } from "../../apps/browser-workbench/src/compliance-client.js";

const request = { entity_id: "entity:one", node_id: "component:one", product_thread_id: "product-thread:one", forge_record_id: "forge-record:one", occurrence_path: ["assembly:one", "component:one", "entity:one"], forge_record_revision_id: "record-revision:one", forge_revision_id: "revision:one" };

async function stamp(value, idField, hashField, prefix) {
  const digest = await canonicalSha256(value);
  return { ...value, [hashField]: digest, [idField]: `${prefix}${digest}` };
}

async function responseFixture(outcome = "INSUFFICIENT_EVIDENCE") {
  const inputRef = { projection_id: `compliance-input:${"1".repeat(64)}`, projection_hash: "1".repeat(64) };
  const observation = await stamp({ schema_version: "caddydaddy.compliance-observation/1", observed_at: "2026-09-05T20:00:00Z", producer: { system: "TRIPWIRE", runtime: "SERVER", source_commit: "8".repeat(40) }, evaluation_state: "SUCCEEDED", input_ref: inputRef, forge_revision_ref: { revision_id: request.forge_revision_id, content_hash: "2".repeat(64) }, rule_pack: { state: "DRAFT_REVIEW_ONLY", content_hash: "3".repeat(64) }, findings: [{ finding_id: "finding:one", node_id: "tripwire-node:one", outcome, rule_ids: [], reason_codes: ["DRAFT_REVIEW_ONLY"] }], review_requirement: "HUMAN_REVIEW_REQUIRED", claim_ceiling: "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION", legal_effect: "NONE" }, "observation_id", "observation_hash", "compliance-observation:");
  const observationRef = { observation_id: observation.observation_id, observation_hash: observation.observation_hash };
  const receipt = await stamp({ schema_version: "caddydaddy.compliance-binding-receipt/1", recorded_at: "2026-09-05T20:00:00Z", product_thread_id: request.product_thread_id, forge_revision_id: request.forge_revision_id, binding_status: "BOUND", forge_recompute: { state: "SUCCEEDED", geometry_artifact_hash: "4".repeat(64), diagnostic_code: null }, tripwire: { state: "SUCCEEDED", input_ref: inputRef, observation_ref: observationRef, diagnostic_code: null }, current_observation_ref: observationRef, last_valid_observation_ref: observationRef, cad_mutation_effect: "NONE", compliance_claim_gate: "HUMAN_REVIEW_REQUIRED", rule_pack_state: "DRAFT_REVIEW_ONLY", browser_role: "DISPLAY_ONLY" }, "receipt_id", "receipt_hash", "compliance-binding-receipt:");
  return { status: "REVIEW_REQUIRED", cleared: false, policy_state: "DRAFT_REVIEW_ONLY", human_review_requirement: "HUMAN_REVIEW_REQUIRED", claim_ceiling: "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION", legal_effect: "NONE", binding: { request, tripwire_node_id: "tripwire-node:one", projection_ref: inputRef }, evidence: { finding: observation.findings[0], determination: {} }, observation, binding_receipt: receipt };
}

test("selection request binds exact entity and immutable revision", () => {
  const document = { revisionId: "revision:one", complianceBindings: { "entity:one": { request } } };
  assert.deepEqual(createComplianceRequest(document, { kind: "entity", entityId: "entity:one", nodeId: "component:one" }, "revision:one"), request);
  assert.throws(() => createComplianceRequest(document, { kind: "entity", entityId: "entity:one", nodeId: "component:one" }, "revision:stale"), /stale/i);
});

test("bound response is accepted only as human review required", async () => {
  const result = await validateComplianceResponse(await responseFixture(), request);
  assert.equal(result.displayState, "BOUND");
  assert.equal(result.payload.cleared, false);
  assert.equal(result.payload.evidence.finding.outcome, "INSUFFICIENT_EVIDENCE");
});

test("review request returns validated insufficient-evidence result", async () => {
  const result = await requestComplianceReview(request, async () => ({ ok: true, json: responseFixture }));
  assert.equal(result.validated.displayState, "BOUND");
  assert.equal(result.payload.human_review_requirement, "HUMAN_REVIEW_REQUIRED");
});

test("review transport and malformed payload errors are bounded for people", async () => {
  const networkError = await requestComplianceReview(request, async () => { throw new TypeError("socket internals"); }).catch((error) => error);
  assert.equal(networkError.code, "REVIEW_SERVICE_UNAVAILABLE");
  assert.doesNotMatch(toComplianceDiagnostic(networkError).message, /socket internals/i);

  const parseError = await requestComplianceReview(request, async () => ({ ok: true, json: async () => { throw new SyntaxError("Unexpected token < in JSON"); } })).catch((error) => error);
  const diagnostic = toComplianceDiagnostic(parseError);
  assert.equal(diagnostic.code, "REVIEW_RESPONSE_UNREADABLE");
  assert.match(diagnostic.message, /No review result was accepted; try again/);
  assert.doesNotMatch(diagnostic.message, /Unexpected token|JSON/i);
});

test("tampered and falsely cleared responses fail closed", async () => {
  const tampered = await responseFixture();
  tampered.binding_receipt.receipt_hash = "0".repeat(64);
  await assert.rejects(validateComplianceResponse(tampered, request), /hash does not match/i);
  await assert.rejects(validateComplianceResponse({ status: "BLOCKED", cleared: true, policy_state: "BLOCKED" }, request), /never be returned as cleared/i);
});

test("evaluator failure remains blocked", async () => {
  const result = await validateComplianceResponse({ status: "BLOCKED", cleared: false, policy_state: "BLOCKED", diagnostic: { code: "TRIPWIRE_EVALUATOR_ERROR", message: "failed closed" }, binding_receipt: null }, request);
  assert.equal(result.displayState, "BLOCKED");
});

test("a bound outcome other than insufficient evidence is rejected", async () => {
  await assert.rejects(validateComplianceResponse(await responseFixture("NO_ISSUES_FOUND"), request), /insufficient evidence/i);
});
