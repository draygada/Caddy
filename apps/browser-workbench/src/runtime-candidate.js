import { validateRenderScene } from "./scene-contract.js";

export const BOUNDED_CLAIM = "CADdyDaddy binds a selected CAD entity to its immutable product revision and runs a review-readiness guardrail through Tripwire; Candidate 0.1 returns insufficient evidence and requires human review, not a compliance determination.";

export async function loadProductCandidate(fetchImpl = fetch) {
  const response = await fetchImpl("/api/candidate", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Candidate service unavailable (${response.status}).`);
  return validateProductCandidate(await response.json());
}

export function validateProductCandidate(candidate) {
  requireValue(candidate?.candidate?.version === "0.1", "CANDIDATE_VERSION_INVALID");
  requireValue(candidate.candidate.claim === BOUNDED_CLAIM, "CANDIDATE_CLAIM_INVALID");
  requireValue(candidate.candidate.policyState === "DRAFT_REVIEW_ONLY", "CANDIDATE_POLICY_INVALID");
  requireValue(candidate.document?.kind === "PART", "DOCUMENT_KIND_INVALID");
  requireValue(candidate.document.revisionId === candidate.forgeRevision?.revision_id, "DOCUMENT_REVISION_MISMATCH");
  requireValue(candidate.document.units?.length === "mm" && candidate.document.units?.angle === "deg", "DOCUMENT_UNITS_INVALID");
  validateRenderScene(candidate.document.scene);
  const mapped = new Map();
  for (const node of candidate.document.scene.nodes) for (const range of node.mesh.entityRanges) mapped.set(range.entityId, node.nodeId);
  const bindings = candidate.document.complianceBindings;
  requireValue(bindings && Object.keys(bindings).length === mapped.size, "COMPLIANCE_BINDINGS_INCOMPLETE");
  for (const [entityId, nodeId] of mapped) {
    const request = bindings[entityId]?.request;
    requireValue(request?.entity_id === entityId && request?.node_id === nodeId, "COMPLIANCE_ENTITY_MISMATCH");
    requireValue(request.forge_revision_id === candidate.document.revisionId, "COMPLIANCE_REVISION_MISMATCH");
    requireValue(request.product_thread_id === candidate.productThreadId, "COMPLIANCE_THREAD_MISMATCH");
  }
  requireValue(candidate.states?.current?.displayState === "CURRENT", "DISPLAY_STATE_INVALID");
  return candidate;
}

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}
