export interface TripwireRequest {
  entity_id: string;
  forge_record_id: string;
  forge_record_revision_id: string;
  forge_revision_id: string;
  node_id: string;
  occurrence_path: string[];
  product_thread_id: string;
}

export interface CandidateEntityRange {
  entityId: string;
  semanticReferenceId: string;
  featureId: string;
  startTriangle: number;
  triangleCount: number;
}

export interface CandidateSceneNode {
  label: string;
  nodeId: string;
  bodyId: string;
  mesh: { entityRanges: CandidateEntityRange[] };
}

export interface CandidatePayload {
  candidate: {
    version: string;
    status: string;
    policyState: string;
    claim: string;
    claimCeiling: string;
    machineClaimCeiling: string;
    observedAt: string;
  };
  capabilities: Record<string, boolean>;
  document: {
    documentId: string;
    revisionId: string;
    label: string;
    complianceBindings: Record<string, { request: TripwireRequest }>;
    scene: { revisionId: string; nodes: CandidateSceneNode[] };
  };
  forgeRevision: { revision_id: string; content_hash: string; geometry_artifact_hash: string; recompute_state: string };
  productThreadId: string;
  snapshotProvenance: { mode: string; coreExecutedAtRuntime: boolean; source: { commit: string; tree: string } };
}

export interface StableTripwireTarget extends CandidateEntityRange {
  bodyId: string;
  bodyLabel: string;
  nodeId: string;
  faceOrdinal: number;
  request: TripwireRequest;
}

export type TripwirePayload = Record<string, any>;

export interface ValidatedTripwireResult {
  displayState: 'BOUND' | 'BLOCKED';
  payload: TripwirePayload;
  request: TripwireRequest;
}

export class TripwireClientError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TripwireClientError';
    this.code = code;
  }
}

const REQUEST_KEYS = ['entity_id', 'forge_record_id', 'forge_record_revision_id', 'forge_revision_id', 'node_id', 'occurrence_path', 'product_thread_id'];

const PUBLIC_ERROR: Record<string, string> = {
  CANDIDATE_UNAVAILABLE: 'The immutable Candidate 0.1 snapshot is unavailable. Nothing was selected or reviewed; retry.',
  CANDIDATE_INVALID: 'The candidate response did not satisfy the revision-bound contract. No review result was accepted.',
  SELECTION_REQUIRED: 'Select one canonical mapped entity before running Tripwire.',
  SELECTION_BINDING_MISSING: 'That entity has no exact Candidate 0.1 request binding.',
  STALE_FORGE_REVISION: 'The candidate changed before Tripwire could bind the result. Reload the candidate and select again.',
  REVIEW_SERVICE_UNAVAILABLE: 'Tripwire is temporarily unavailable. The selected entity is unchanged; retry.',
  REVIEW_RESPONSE_UNREADABLE: 'Tripwire returned an unreadable response. No review result was accepted; retry.',
  REVIEW_RESPONSE_REJECTED: 'Tripwire could not safely bind this result. The selected entity is unchanged; retry.',
};

export function publicTripwireError(error: unknown): { code: string; message: string } {
  const code = error instanceof TripwireClientError ? error.code : 'REVIEW_RESPONSE_REJECTED';
  return { code, message: PUBLIC_ERROR[code] ?? PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED };
}

export async function loadCandidate(fetchImpl: typeof fetch = fetch): Promise<CandidatePayload> {
  let response: Response;
  try {
    response = await fetchImpl('/api/candidate', { headers: { Accept: 'application/json' } });
  } catch {
    throw new TripwireClientError('CANDIDATE_UNAVAILABLE', PUBLIC_ERROR.CANDIDATE_UNAVAILABLE);
  }
  check(response.ok, 'CANDIDATE_UNAVAILABLE', PUBLIC_ERROR.CANDIDATE_UNAVAILABLE);
  let payload: CandidatePayload;
  try {
    payload = await response.json() as CandidatePayload;
  } catch {
    throw new TripwireClientError('CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  }
  check(payload?.candidate?.policyState === 'DRAFT_REVIEW_ONLY', 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(payload?.candidate?.machineClaimCeiling === 'REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION', 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(payload?.capabilities?.reviewReadinessGuardrail === true && payload?.capabilities?.regulatoryClassification === false, 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(payload?.document?.revisionId === payload?.document?.scene?.revisionId, 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(payload?.document?.revisionId === payload?.forgeRevision?.revision_id, 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(payload?.snapshotProvenance?.mode === 'PRECOMPUTED_IMMUTABLE' && payload?.snapshotProvenance?.coreExecutedAtRuntime === false, 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  check(listStableTargets(payload).length > 0, 'CANDIDATE_INVALID', PUBLIC_ERROR.CANDIDATE_INVALID);
  return payload;
}

export function listStableTargets(candidate: CandidatePayload): StableTripwireTarget[] {
  return (candidate?.document?.scene?.nodes ?? []).flatMap((node) =>
    (node.mesh?.entityRanges ?? []).flatMap((range, index) => {
      const request = candidate.document.complianceBindings?.[range.entityId]?.request;
      if (!request) return [];
      return [{ ...range, bodyId: node.bodyId, bodyLabel: node.label, nodeId: node.nodeId, faceOrdinal: index + 1, request }];
    }),
  );
}

export function createTripwireRequest(candidate: CandidatePayload, entityId: string | null): TripwireRequest {
  check(!!entityId, 'SELECTION_REQUIRED', PUBLIC_ERROR.SELECTION_REQUIRED);
  const target = listStableTargets(candidate).find((item) => item.entityId === entityId);
  check(!!target, 'SELECTION_BINDING_MISSING', PUBLIC_ERROR.SELECTION_BINDING_MISSING);
  const request = target.request;
  exactKeys(request, REQUEST_KEYS, 'SELECTION_BINDING_MISSING');
  check(request.entity_id === target.entityId && request.node_id === target.nodeId, 'SELECTION_BINDING_MISSING', PUBLIC_ERROR.SELECTION_BINDING_MISSING);
  check(request.forge_revision_id === candidate.document.revisionId, 'STALE_FORGE_REVISION', PUBLIC_ERROR.STALE_FORGE_REVISION);
  check(request.product_thread_id === candidate.productThreadId, 'SELECTION_BINDING_MISSING', PUBLIC_ERROR.SELECTION_BINDING_MISSING);
  return structuredClone(request);
}

export async function runTripwire(candidate: CandidatePayload, entityId: string | null, fetchImpl: typeof fetch = fetch): Promise<ValidatedTripwireResult> {
  const request = createTripwireRequest(candidate, entityId);
  let response: Response;
  try {
    response = await fetchImpl('/api/compliance-at-design-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new TripwireClientError('REVIEW_SERVICE_UNAVAILABLE', PUBLIC_ERROR.REVIEW_SERVICE_UNAVAILABLE);
  }
  if (!response.ok) {
    const code = response.status === 409 ? 'STALE_FORGE_REVISION' : 'REVIEW_SERVICE_UNAVAILABLE';
    throw new TripwireClientError(code, PUBLIC_ERROR[code]);
  }
  let payload: TripwirePayload;
  try {
    payload = await response.json() as TripwirePayload;
  } catch {
    throw new TripwireClientError('REVIEW_RESPONSE_UNREADABLE', PUBLIC_ERROR.REVIEW_RESPONSE_UNREADABLE);
  }
  return { ...(await validateTripwireResponse(payload, request)), request };
}

export async function validateTripwireResponse(payload: TripwirePayload, request: TripwireRequest): Promise<Omit<ValidatedTripwireResult, 'request'>> {
  check(payload && typeof payload === 'object', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(payload.cleared === false, 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  if (payload.status === 'BLOCKED') {
    check(payload.policy_state === 'BLOCKED', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
    if (payload.binding_receipt) await validateStamped(payload.binding_receipt, 'receipt_id', 'receipt_hash', 'compliance-binding-receipt:');
    return { displayState: 'BLOCKED', payload };
  }
  check(payload.status === 'REVIEW_REQUIRED', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(payload.policy_state === 'DRAFT_REVIEW_ONLY', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(payload.human_review_requirement === 'HUMAN_REVIEW_REQUIRED', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(payload.legal_effect === 'NONE', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(canonicalJson(payload.binding?.request) === canonicalJson(request), 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  const observation = payload.observation;
  const receipt = payload.binding_receipt;
  await validateStamped(observation, 'observation_id', 'observation_hash', 'compliance-observation:');
  await validateStamped(receipt, 'receipt_id', 'receipt_hash', 'compliance-binding-receipt:');
  check(observation.evaluation_state === 'SUCCEEDED' && observation.review_requirement === 'HUMAN_REVIEW_REQUIRED' && observation.claim_ceiling === 'REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION' && observation.legal_effect === 'NONE', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(receipt.binding_status === 'BOUND' && receipt.compliance_claim_gate === 'HUMAN_REVIEW_REQUIRED' && receipt.rule_pack_state === 'DRAFT_REVIEW_ONLY' && receipt.tripwire?.state === 'SUCCEEDED', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(receipt.product_thread_id === request.product_thread_id && receipt.forge_revision_id === request.forge_revision_id, 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(canonicalJson(receipt.tripwire.input_ref) === canonicalJson(observation.input_ref), 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(canonicalJson(receipt.current_observation_ref) === canonicalJson({ observation_id: observation.observation_id, observation_hash: observation.observation_hash }), 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(observation.findings?.length === 1 && observation.findings[0].node_id === payload.binding.tripwire_node_id, 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(observation.findings[0].outcome === 'INSUFFICIENT_EVIDENCE', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  check(canonicalJson(payload.evidence?.finding) === canonicalJson(observation.findings[0]), 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  return { displayState: 'BOUND', payload };
}

async function validateStamped(value: TripwirePayload, idField: string, hashField: string, prefix: string) {
  check(value && typeof value === 'object', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  const unsigned: TripwirePayload = {};
  for (const [key, child] of Object.entries(value)) if (key !== idField && key !== hashField) unsigned[key] = child;
  const digest = await canonicalSha256(unsigned);
  check(value[hashField] === digest && value[idField] === prefix + digest, 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
}

export async function canonicalSha256(value: unknown): Promise<string> {
  check(globalThis.crypto?.subtle, 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    check(Number.isFinite(value), 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  check(value && typeof value === 'object', 'REVIEW_RESPONSE_REJECTED', PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') + '}';
}

function exactKeys(value: object, expected: string[], code: string) {
  check(canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort()), code, PUBLIC_ERROR[code] ?? PUBLIC_ERROR.REVIEW_RESPONSE_REJECTED);
}

function check(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new TripwireClientError(code, message);
}
