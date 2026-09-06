export interface OperationsCandidateIdentity {
  candidate_id: string;
  revision_id: string;
  snapshot_sha256: string;
}

export type OperationsDomain = 'sourcing' | 'provenance';

export interface ClientCarriedState {
  schema_version: string;
  candidate: OperationsCandidateIdentity;
  seal_sha256: string;
  [key: string]: unknown;
}

export interface OperationsEnvelope {
  schema_version: string;
  status: string;
  candidate: OperationsCandidateIdentity;
  source_hashes: Record<string, string>;
  corpus: { corpus_sha256: string; [key: string]: unknown };
  claim_ceiling: string;
  limitations: string[];
  state?: ClientCarriedState;
  diagnostic?: { code: string; message: string };
}

export interface OwnershipNode {
  name: string;
  pct: string | null;
  screening: { result: string; listed_name?: string; program?: string };
  owners: OwnershipNode[];
  diagnostic?: string;
}

export interface ServiceOffer {
  offer_id: string;
  part_key: string;
  seller: string;
  manufacturer: string;
  origin: string;
  ship_from: string;
  unit_price_usd: string;
  lead_days: number;
  declared_hts: string;
  declared_eccn: string;
  screening_disposition: 'eligible-fixture' | 'eligible-bounded' | 'review-required' | 'review-blocked';
  ownership_walk: { seller: OwnershipNode; manufacturer: OwnershipNode | null };
  landed_cost: {
    rows: Array<{ layer: string; amount_usd: string; source: string }>;
    total_usd: string;
    per_unit_usd: string;
    assumptions: string;
  };
}

export interface ServiceSourcingRound {
  round_id: string;
  request: {
    candidate: OperationsCandidateIdentity;
    part_key: string;
    quantity: number;
    mode: 'air' | 'ocean';
    input_mode: 'offline-demo' | 'live-bounded';
    corpus_sha256: string;
  };
  offers: ServiceOffer[];
  selected_offer_id: string | null;
  events: Array<{ event_type: string; event_sha256: string }>;
}

export interface SourcingRoundEnvelope extends OperationsEnvelope {
  round: ServiceSourcingRound;
}

export interface SourcingSelectionEnvelope extends OperationsEnvelope {
  round_id: string;
  selected_offer: ServiceOffer;
  offers: ServiceOffer[];
  audit_events: Array<{ event_type: string; event_sha256: string }>;
}

export interface SourcingAdjudicationEnvelope extends OperationsEnvelope {
  round_id: string;
  offer: ServiceOffer;
  adjudication: {
    decision: 'HOLD' | 'REJECT' | 'ACCEPT_FOR_FIXTURE_REVIEW';
    attestor: string;
    rationale: string;
    does_not_change_screening: boolean;
  };
}

export interface StagedPackage {
  round_id: string;
  payload_file: string;
  payload_sha256: string;
  payload_bytes: number;
  manifest_file: string;
  manifest_sha256: string;
  corpus_sha256: string;
  dispatch_ceiling: 'STAGED_ONLY';
  byte_reread_verified: true;
}

export interface SourcingPackageEnvelope extends OperationsEnvelope {
  package: StagedPackage;
}

export interface SourcingDispatchEnvelope extends OperationsEnvelope {
  dispatch: {
    dispatch_id: string;
    idempotency_key: string;
    manifest_sha256: string;
    external_send: false;
    network_calls: 0;
  };
}

export interface ProvenanceDocument {
  document_id: string;
  title: string;
  host: string;
  retrieved_at: string;
  provided_by?: string;
  input_mode?: 'offline-demo' | 'live-bounded';
  sha256: string;
  bytes: number;
  text_with_quarantine: string;
  quarantined_ranges: Array<{ start: number; end: number }>;
  network: { performed: false; mode: string };
}

export interface ProvenanceInspectEnvelope extends OperationsEnvelope {
  document: ProvenanceDocument;
}

export interface SourceVerification {
  candidate: OperationsCandidateIdentity;
  document_id: string;
  source_sha256: string;
  start: number;
  end: number;
  quote_sha256: string;
  field: string;
  value: number;
  unit: string;
  byte_reread_verified: true;
  poison_intersection: false;
  receipt_sha256: string;
  input_mode?: 'offline-demo' | 'live-bounded';
  quote_hex?: string;
}

export interface LiveScreeningEvidence {
  status: 'NO_CANDIDATE_MATCH' | 'POTENTIAL_MATCH' | 'UNKNOWN';
  source_name: string;
  source_text: string;
  checked_at: string;
  attestor: string;
  complete: boolean;
}

export interface LiveSourcingOffer {
  offer_id: string;
  part_key: string;
  seller: string;
  manufacturer: string;
  origin: string;
  ship_from: string;
  unit_price_usd: string;
  lead_days: number;
  declared_hts: string;
  declared_eccn: string;
  screening_evidence: {
    seller: LiveScreeningEvidence;
    manufacturer: LiveScreeningEvidence;
    ownership_complete: boolean;
  };
}

export interface UserProvidedSource {
  document_id: string;
  title: string;
  host: string;
  retrieved_at: string;
  provided_by: string;
  text: string;
}

export interface ProvenanceVerifyEnvelope extends OperationsEnvelope {
  verification: SourceVerification;
}

export interface ProvenanceAcceptEnvelope extends OperationsEnvelope {
  change: {
    target: string;
    value: number;
    unit: string;
    receipt_sha256: string;
    mutated_cad: false;
  };
}

export class OperationsServiceError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = 'OperationsServiceError';
    this.code = code;
    this.status = status;
  }
}

const HASH = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new OperationsServiceError(code, 'The service response is missing a required string.');
  return value;
}

function requireHash(value: unknown, code: string): string {
  const hash = requireString(value, code);
  if (!HASH.test(hash)) throw new OperationsServiceError(code, 'The service response contains a malformed SHA-256 identity.');
  return hash;
}

function sameCandidate(left: OperationsCandidateIdentity, right: OperationsCandidateIdentity): boolean {
  return left.candidate_id === right.candidate_id && left.revision_id === right.revision_id && left.snapshot_sha256 === right.snapshot_sha256;
}

function validateEnvelope(value: unknown, expected: OperationsCandidateIdentity, domain: OperationsDomain): asserts value is OperationsEnvelope {
  if (!isRecord(value)) throw new OperationsServiceError('RESPONSE_INVALID', 'The service returned a non-object response.');
  const expectedSchema = `caddydaddy.${domain === 'sourcing' ? 'sourcing' : 'provenance'}-service/1`;
  if (value.schema_version !== expectedSchema) throw new OperationsServiceError('RESPONSE_SCHEMA_INVALID', `Expected ${expectedSchema}.`);
  if (!isRecord(value.candidate)) throw new OperationsServiceError('RESPONSE_CANDIDATE_INVALID', 'The service omitted candidate identity.');
  const candidate = {
    candidate_id: requireString(value.candidate.candidate_id, 'RESPONSE_CANDIDATE_INVALID'),
    revision_id: requireString(value.candidate.revision_id, 'RESPONSE_CANDIDATE_INVALID'),
    snapshot_sha256: requireHash(value.candidate.snapshot_sha256, 'RESPONSE_CANDIDATE_INVALID'),
  };
  if (!sameCandidate(candidate, expected)) throw new OperationsServiceError('RESPONSE_CANDIDATE_STALE', 'The response belongs to a different candidate or revision.');
  if (!isRecord(value.source_hashes) || Object.keys(value.source_hashes).length === 0) throw new OperationsServiceError('RESPONSE_HASHES_INVALID', 'The service omitted source hashes.');
  for (const hash of Object.values(value.source_hashes)) requireHash(hash, 'RESPONSE_HASHES_INVALID');
  if (!isRecord(value.corpus)) throw new OperationsServiceError('RESPONSE_CORPUS_INVALID', 'The service omitted its corpus manifest.');
  requireHash(value.corpus.corpus_sha256, 'RESPONSE_CORPUS_INVALID');
  requireString(value.status, 'RESPONSE_STATUS_INVALID');
  requireString(value.claim_ceiling, 'RESPONSE_CLAIM_CEILING_INVALID');
  if (!Array.isArray(value.limitations) || !value.limitations.every((item) => typeof item === 'string' && item.length > 0)) {
    throw new OperationsServiceError('RESPONSE_LIMITATIONS_INVALID', 'The service omitted its limitations.');
  }
}

function requireOffer(value: unknown): asserts value is ServiceOffer {
  if (!isRecord(value)) throw new OperationsServiceError('SOURCING_OFFER_INVALID', 'An offer is malformed.');
  requireString(value.offer_id, 'SOURCING_OFFER_INVALID');
  requireString(value.seller, 'SOURCING_OFFER_INVALID');
  if (!['eligible-fixture', 'eligible-bounded', 'review-required', 'review-blocked'].includes(String(value.screening_disposition))) {
    throw new OperationsServiceError('SOURCING_OFFER_INVALID', 'An offer has an unknown screening disposition.');
  }
  if (!isRecord(value.ownership_walk) || !isRecord(value.landed_cost)) throw new OperationsServiceError('SOURCING_OFFER_INVALID', 'An offer omitted ownership or cost evidence.');
  requireString(value.landed_cost.total_usd, 'SOURCING_OFFER_INVALID');
  if (!Array.isArray(value.landed_cost.rows)) throw new OperationsServiceError('SOURCING_OFFER_INVALID', 'An offer omitted its landed-cost ladder.');
}

function validateCarriedState(value: OperationsEnvelope, expected: OperationsCandidateIdentity, domain: OperationsDomain): void {
  if (value.state === undefined) return;
  if (!isRecord(value.state) || value.state.schema_version !== `caddydaddy.${domain}-state/1` || !isRecord(value.state.candidate)) {
    throw new OperationsServiceError('RESPONSE_STATE_INVALID', 'The service returned an invalid client-carried state envelope.');
  }
  const candidate = {
    candidate_id: requireString(value.state.candidate.candidate_id, 'RESPONSE_STATE_INVALID'),
    revision_id: requireString(value.state.candidate.revision_id, 'RESPONSE_STATE_INVALID'),
    snapshot_sha256: requireHash(value.state.candidate.snapshot_sha256, 'RESPONSE_STATE_INVALID'),
  };
  if (!sameCandidate(candidate, expected)) throw new OperationsServiceError('RESPONSE_STATE_STALE', 'The carried state belongs to another candidate.');
  requireHash(value.state.seal_sha256, 'RESPONSE_STATE_INVALID');
}

export function utf8ByteSpan(text: string, quote: string): { start: number; end: number } | null {
  const characterStart = text.indexOf(quote);
  if (characterStart < 0) return null;
  const encoder = new TextEncoder();
  const start = encoder.encode(text.slice(0, characterStart)).byteLength;
  return { start, end: start + encoder.encode(quote).byteLength };
}

function validateRound(value: OperationsEnvelope): asserts value is SourcingRoundEnvelope {
  const candidate = value as Partial<SourcingRoundEnvelope>;
  if (!isRecord(candidate.round)) throw new OperationsServiceError('SOURCING_ROUND_INVALID', 'The service omitted the sourcing round.');
  requireString(candidate.round.round_id, 'SOURCING_ROUND_INVALID');
  if (!Array.isArray(candidate.round.offers)) throw new OperationsServiceError('SOURCING_ROUND_INVALID', 'The sourcing round omitted offers.');
  candidate.round.offers.forEach(requireOffer);
}

function validateSelection(value: OperationsEnvelope): asserts value is SourcingSelectionEnvelope {
  const candidate = value as Partial<SourcingSelectionEnvelope>;
  requireString(candidate.round_id, 'SOURCING_SELECTION_INVALID');
  requireOffer(candidate.selected_offer);
  if (!Array.isArray(candidate.offers)) throw new OperationsServiceError('SOURCING_SELECTION_INVALID', 'Selection evidence omitted the compared offers.');
  candidate.offers.forEach(requireOffer);
}

function validateAdjudication(value: OperationsEnvelope): asserts value is SourcingAdjudicationEnvelope {
  const candidate = value as Partial<SourcingAdjudicationEnvelope>;
  requireOffer(candidate.offer);
  if (!isRecord(candidate.adjudication) || candidate.adjudication.does_not_change_screening !== true) {
    throw new OperationsServiceError('SOURCING_ADJUDICATION_INVALID', 'Adjudication must preserve the original screening evidence.');
  }
}

function validatePackage(value: OperationsEnvelope): asserts value is SourcingPackageEnvelope {
  const candidate = value as Partial<SourcingPackageEnvelope>;
  if (!isRecord(candidate.package) || candidate.package.byte_reread_verified !== true || candidate.package.dispatch_ceiling !== 'STAGED_ONLY') {
    throw new OperationsServiceError('SOURCING_PACKAGE_INVALID', 'The package lacks a byte-reread seal or exceeds STAGED_ONLY.');
  }
  requireHash(candidate.package.payload_sha256, 'SOURCING_PACKAGE_INVALID');
  requireHash(candidate.package.manifest_sha256, 'SOURCING_PACKAGE_INVALID');
  requireHash(candidate.package.corpus_sha256, 'SOURCING_PACKAGE_INVALID');
  if (candidate.package.corpus_sha256 !== value.corpus.corpus_sha256) throw new OperationsServiceError('SOURCING_PACKAGE_STALE', 'The package references a different corpus manifest.');
}

function validateDispatch(value: OperationsEnvelope): asserts value is SourcingDispatchEnvelope {
  const candidate = value as Partial<SourcingDispatchEnvelope>;
  if (!isRecord(candidate.dispatch) || candidate.dispatch.external_send !== false || candidate.dispatch.network_calls !== 0) {
    throw new OperationsServiceError('SOURCING_DISPATCH_INVALID', 'Dispatch evidence does not prove a zero-network STAGED action.');
  }
  requireHash(candidate.dispatch.manifest_sha256, 'SOURCING_DISPATCH_INVALID');
  requireString(candidate.dispatch.idempotency_key, 'SOURCING_DISPATCH_INVALID');
}

function validateInspect(value: OperationsEnvelope): asserts value is ProvenanceInspectEnvelope {
  const candidate = value as Partial<ProvenanceInspectEnvelope>;
  if (!isRecord(candidate.document) || !isRecord(candidate.document.network) || candidate.document.network.performed !== false) {
    throw new OperationsServiceError('PROVENANCE_DOCUMENT_INVALID', 'Source inspection must be committed-fixture-only with no network fetch.');
  }
  const documentId = requireString(candidate.document.document_id, 'PROVENANCE_DOCUMENT_INVALID');
  const sourceHash = requireHash(candidate.document.sha256, 'PROVENANCE_DOCUMENT_INVALID');
  if (value.source_hashes[documentId] !== sourceHash) throw new OperationsServiceError('PROVENANCE_DOCUMENT_STALE', 'The document hash does not match the returned manifest.');
  requireString(candidate.document.text_with_quarantine, 'PROVENANCE_DOCUMENT_INVALID');
  if (!Array.isArray(candidate.document.quarantined_ranges)) throw new OperationsServiceError('PROVENANCE_DOCUMENT_INVALID', 'The source omitted quarantine ranges.');
}

function validateVerification(value: OperationsEnvelope): asserts value is ProvenanceVerifyEnvelope {
  const candidate = value as Partial<ProvenanceVerifyEnvelope>;
  if (!isRecord(candidate.verification) || candidate.verification.byte_reread_verified !== true || candidate.verification.poison_intersection !== false) {
    throw new OperationsServiceError('PROVENANCE_VERIFICATION_INVALID', 'The response does not prove a safe byte reread.');
  }
  requireHash(candidate.verification.source_sha256, 'PROVENANCE_VERIFICATION_INVALID');
  requireHash(candidate.verification.quote_sha256, 'PROVENANCE_VERIFICATION_INVALID');
  requireHash(candidate.verification.receipt_sha256, 'PROVENANCE_VERIFICATION_INVALID');
  if (value.source_hashes[candidate.verification.document_id] !== candidate.verification.source_sha256) {
    throw new OperationsServiceError('PROVENANCE_VERIFICATION_STALE', 'The verification references a different source hash.');
  }
}

function validateAcceptance(value: OperationsEnvelope): asserts value is ProvenanceAcceptEnvelope {
  const candidate = value as Partial<ProvenanceAcceptEnvelope>;
  if (!isRecord(candidate.change) || candidate.change.mutated_cad !== false) {
    throw new OperationsServiceError('PROVENANCE_ACCEPTANCE_INVALID', 'The bounded provenance adapter must not mutate CAD.');
  }
  requireHash(candidate.change.receipt_sha256, 'PROVENANCE_ACCEPTANCE_INVALID');
}

export async function loadOperationsCandidateIdentity(fetchImpl: typeof fetch = fetch): Promise<OperationsCandidateIdentity> {
  let response: Response;
  try {
    response = await fetchImpl('/api/candidate', { headers: { Accept: 'application/json' } });
  } catch {
    throw new OperationsServiceError('CANDIDATE_UNAVAILABLE', 'The current candidate endpoint is unreachable.');
  }
  if (!response.ok) throw new OperationsServiceError('CANDIDATE_UNAVAILABLE', `The current candidate endpoint returned HTTP ${response.status}.`, response.status);
  const value: unknown = await response.json();
  if (!isRecord(value) || !isRecord(value.candidate) || !isRecord(value.document)) throw new OperationsServiceError('CANDIDATE_INVALID', 'The current candidate response is malformed.');
  const version = requireString(value.candidate.version, 'CANDIDATE_INVALID');
  return {
    candidate_id: `candidate:${version}`,
    revision_id: requireString(value.document.revisionId, 'CANDIDATE_INVALID'),
    snapshot_sha256: requireHash(value.candidate.payloadHash, 'CANDIDATE_INVALID'),
  };
}

export class OperationsClient {
  private readonly lastValid: Partial<Record<OperationsDomain, OperationsEnvelope>> = {};
  private readonly carriedState: Partial<Record<OperationsDomain, ClientCarriedState>> = {};

  constructor(readonly candidate: OperationsCandidateIdentity, private readonly fetchImpl: typeof fetch = fetch) {
    requireString(candidate.candidate_id, 'CANDIDATE_INVALID');
    requireString(candidate.revision_id, 'CANDIDATE_INVALID');
    requireHash(candidate.snapshot_sha256, 'CANDIDATE_INVALID');
  }

  getLastValid(domain: OperationsDomain): OperationsEnvelope | null {
    return this.lastValid[domain] ?? null;
  }

  getCarriedState(domain: OperationsDomain): ClientCarriedState | null {
    return this.carriedState[domain] ?? null;
  }

  private async post<T extends OperationsEnvelope>(domain: OperationsDomain, path: string, payload: Record<string, unknown>, validate: (value: OperationsEnvelope) => asserts value is T, continueState = true): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(path, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: this.candidate, ...(continueState && this.carriedState[domain] ? { state: this.carriedState[domain] } : {}), ...payload }),
      });
    } catch {
      throw new OperationsServiceError('SERVICE_UNREACHABLE', `${domain} service is unreachable.`);
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new OperationsServiceError('RESPONSE_INVALID', `${domain} service returned non-JSON data.`, response.status);
    }
    validateEnvelope(value, this.candidate, domain);
    if (!response.ok) {
      const code = value.diagnostic?.code ?? 'SERVICE_REJECTED';
      const message = value.diagnostic?.message ?? `${domain} service rejected the request.`;
      throw new OperationsServiceError(code, message, response.status);
    }
    validate(value);
    validateCarriedState(value, this.candidate, domain);
    if (value.state) this.carriedState[domain] = value.state;
    else if (!continueState) delete this.carriedState[domain];
    this.lastValid[domain] = value;
    return value;
  }

  createSourcingRound(input: { part_key: string; quantity: number; mode: 'air' | 'ocean'; input_mode?: 'offline-demo' | 'live-bounded'; offers?: LiveSourcingOffer[] }): Promise<SourcingRoundEnvelope> {
    return this.post('sourcing', '/api/sourcing/rounds', input, validateRound, false);
  }

  selectSourcingOffer(roundId: string, offerId: string): Promise<SourcingSelectionEnvelope> {
    return this.post('sourcing', '/api/sourcing/selections', { round_id: roundId, offer_id: offerId }, validateSelection);
  }

  adjudicateSourcingOffer(input: { round_id: string; offer_id: string; decision: 'HOLD' | 'REJECT' | 'ACCEPT_FOR_FIXTURE_REVIEW'; attestor: string; rationale: string }): Promise<SourcingAdjudicationEnvelope> {
    return this.post('sourcing', '/api/sourcing/adjudications', input, validateAdjudication);
  }

  buildSourcingPackage(roundId: string): Promise<SourcingPackageEnvelope> {
    return this.post('sourcing', '/api/sourcing/packages', { round_id: roundId }, validatePackage);
  }

  stageSourcingDispatch(roundId: string, manifestSha256: string, idempotencyKey: string): Promise<SourcingDispatchEnvelope> {
    return this.post('sourcing', '/api/sourcing/dispatches', { round_id: roundId, manifest_sha256: manifestSha256, idempotency_key: idempotencyKey }, validateDispatch);
  }

  inspectSource(input: string | UserProvidedSource): Promise<ProvenanceInspectEnvelope> {
    const payload = typeof input === 'string' ? { document_id: input } : { source: input };
    return this.post('provenance', '/api/provenance/inspect', payload, validateInspect, false);
  }

  verifySourceSpan(input: { document_id: string; source_sha256: string; start: number; end: number; quote: string; field: string; value: number; unit: string }): Promise<ProvenanceVerifyEnvelope> {
    return this.post('provenance', '/api/provenance/verify', input, validateVerification);
  }

  acceptVerifiedChange(receiptSha256: string, target: string): Promise<ProvenanceAcceptEnvelope> {
    return this.post('provenance', '/api/provenance/accept', { receipt_sha256: receiptSha256, target }, validateAcceptance);
  }
}
