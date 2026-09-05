export class ComplianceClientError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ComplianceClientError";
    this.code = code;
  }
}

const REQUEST_KEYS = ["entity_id", "forge_record_id", "forge_record_revision_id", "forge_revision_id", "node_id", "occurrence_path", "product_thread_id"];

const PUBLIC_DIAGNOSTICS = new Map([
  ["REVIEW_SERVICE_UNAVAILABLE", "Tripwire is temporarily unavailable. Your selected entity is unchanged; try again."],
  ["REVIEW_RESPONSE_UNREADABLE", "Tripwire returned an unreadable response. No review result was accepted; try again."],
  ["SELECTION_REQUIRED", "Select a mapped CAD entity before checking review readiness."],
]);

export async function requestComplianceReview(request, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl("/api/compliance-at-design-click", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(request) });
  } catch {
    throw new ComplianceClientError("REVIEW_SERVICE_UNAVAILABLE", PUBLIC_DIAGNOSTICS.get("REVIEW_SERVICE_UNAVAILABLE"));
  }
  if (!response?.ok) throw new ComplianceClientError("REVIEW_SERVICE_UNAVAILABLE", PUBLIC_DIAGNOSTICS.get("REVIEW_SERVICE_UNAVAILABLE"));
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ComplianceClientError("REVIEW_RESPONSE_UNREADABLE", PUBLIC_DIAGNOSTICS.get("REVIEW_RESPONSE_UNREADABLE"));
  }
  const validated = await validateComplianceResponse(payload, request);
  return { payload, validated };
}

export function toComplianceDiagnostic(error) {
  const code = typeof error?.code === "string" ? error.code : "REVIEW_RESPONSE_REJECTED";
  return {
    code,
    message: PUBLIC_DIAGNOSTICS.get(code)
      ?? "Tripwire could not safely bind this review-readiness result. Your selected entity is unchanged; try again.",
  };
}

export function createComplianceRequest(document, selection, displayedRevisionId) {
  check(selection?.kind === "entity" && selection.entityId, "SELECTION_REQUIRED", "Select a mapped design entity.");
  const binding = document.complianceBindings?.[selection.entityId];
  check(binding?.request, "SELECTION_BINDING_MISSING", "The selected entity has no compliance binding.");
  const request = binding.request;
  exactKeys(request, REQUEST_KEYS, "SELECTION_BINDING_INVALID");
  check(request.entity_id === selection.entityId && request.node_id === selection.nodeId, "SELECTION_BINDING_MISMATCH", "Selection identity changed.");
  check(document.revisionId === displayedRevisionId && request.forge_revision_id === document.revisionId, "STALE_FORGE_REVISION", "The displayed product revision is stale.");
  return structuredClone(request);
}

export async function validateComplianceResponse(payload, request) {
  check(payload && typeof payload === "object", "RESPONSE_INVALID", "Compliance response is not an object.");
  check(payload.cleared === false, "UNSAFE_CLEARED_STATE", "Review-only compliance can never be returned as cleared.");
  if (payload.status === "BLOCKED") {
    check(payload.policy_state === "BLOCKED", "BLOCKED_POLICY_MISMATCH", "Blocked response has an invalid policy state.");
    if (payload.binding_receipt) await validateBlockedReceipt(payload.binding_receipt, request);
    return { displayState: "BLOCKED", payload };
  }
  check(payload.status === "REVIEW_REQUIRED", "RESPONSE_STATE_INVALID", "Only a bound review-required result may be displayed.");
  check(payload.policy_state === "DRAFT_REVIEW_ONLY", "POLICY_STATE_INVALID", "Rule pack is not draft review-only.");
  check(payload.human_review_requirement === "HUMAN_REVIEW_REQUIRED", "REVIEW_GATE_INVALID", "Human review is not required.");
  check(payload.legal_effect === "NONE", "LEGAL_EFFECT_INVALID", "Review support cannot have legal effect.");
  check(canonicalJson(payload.binding?.request) === canonicalJson(request), "REQUEST_BINDING_MISMATCH", "Response is not bound to the submitted selection.");
  const observation = payload.observation;
  const receipt = payload.binding_receipt;
  await validateStamped(observation, "observation_id", "observation_hash", "compliance-observation:", "OBSERVATION_TAMPERED");
  await validateStamped(receipt, "receipt_id", "receipt_hash", "compliance-binding-receipt:", "RECEIPT_TAMPERED");
  check(observation.evaluation_state === "SUCCEEDED" && observation.review_requirement === "HUMAN_REVIEW_REQUIRED" && observation.claim_ceiling === "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION" && observation.legal_effect === "NONE", "OBSERVATION_UNSAFE", "Observation exceeds the review-only ceiling.");
  check(receipt.binding_status === "BOUND" && receipt.compliance_claim_gate === "HUMAN_REVIEW_REQUIRED" && receipt.rule_pack_state === "DRAFT_REVIEW_ONLY" && receipt.tripwire?.state === "SUCCEEDED", "RECEIPT_NOT_BOUND", "Receipt is not a bound review-only receipt.");
  check(receipt.product_thread_id === request.product_thread_id && receipt.forge_revision_id === request.forge_revision_id, "RECEIPT_SCOPE_MISMATCH", "Receipt scope changed.");
  check(canonicalJson(receipt.tripwire.input_ref) === canonicalJson(observation.input_ref), "RECEIPT_INPUT_MISMATCH", "Receipt input reference changed.");
  check(canonicalJson(receipt.current_observation_ref) === canonicalJson({ observation_id: observation.observation_id, observation_hash: observation.observation_hash }), "RECEIPT_OBSERVATION_MISMATCH", "Receipt observation reference changed.");
  check(observation.findings?.length === 1 && observation.findings[0].node_id === payload.binding.tripwire_node_id, "FINDING_SCOPE_MISMATCH", "Finding is not bound to the selected entity.");
  check(observation.findings[0].outcome === "INSUFFICIENT_EVIDENCE", "FINDING_OUTCOME_INVALID", "Candidate 0.1 may display only insufficient evidence.");
  check(canonicalJson(payload.evidence?.finding) === canonicalJson(observation.findings[0]), "FINDING_EVIDENCE_MISMATCH", "Displayed finding is not the stamped finding.");
  return { displayState: "BOUND", payload };
}

async function validateBlockedReceipt(receipt, request) {
  await validateStamped(receipt, "receipt_id", "receipt_hash", "compliance-binding-receipt:", "RECEIPT_TAMPERED");
  check(receipt.binding_status !== "BOUND" && receipt.compliance_claim_gate === "BLOCKED" && receipt.tripwire?.state !== "SUCCEEDED", "BLOCKED_RECEIPT_UNSAFE", "Blocked receipt implies success.");
  check(receipt.product_thread_id === request.product_thread_id && receipt.forge_revision_id === request.forge_revision_id, "RECEIPT_SCOPE_MISMATCH", "Blocked receipt scope changed.");
}

async function validateStamped(value, idField, hashField, prefix, code) {
  check(value && typeof value === "object", code, "Stamped evidence is missing.");
  const unsigned = {};
  for (const [key, child] of Object.entries(value)) if (key !== idField && key !== hashField) unsigned[key] = child;
  const digest = await canonicalSha256(unsigned);
  check(value[hashField] === digest && value[idField] === `${prefix}${digest}`, code, "Stamped evidence hash does not match its content.");
}

export async function canonicalSha256(value) {
  check(globalThis.crypto?.subtle, "HASH_RUNTIME_UNAVAILABLE", "SHA-256 is unavailable.");
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    check(Number.isFinite(value), "NON_CANONICAL_JSON", "Non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  check(value && typeof value === "object", "NON_CANONICAL_JSON", "Unsupported JSON value.");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function exactKeys(value, expected, code) {
  check(value && typeof value === "object" && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort()), code, "Unexpected binding fields.");
}

function check(condition, code, message) {
  if (!condition) throw new ComplianceClientError(code, message);
}
