import type { OperationsCandidateIdentity } from './operations-client';

export type RecordingOutcome = 'DISPATCHED' | 'ACKNOWLEDGED' | 'EXCEPTION' | 'UNKNOWN';
export type OrderState = 'DRAFT' | 'DISPATCH_PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'EXCEPTION' | 'UNKNOWN' | 'CLOSED';
export type SendEffect = 'NOT_SENT' | 'POSSIBLY_SENT' | 'SENT';

export interface OrderCandidateIdentity { candidate_id: string; revision: string; artifact_sha256: string }
export interface InlinePackageFile { path: string; byte_length: number; sha256: string; content_base64: string }
export interface OrderPackageEnvelope {
  schema_version: 'caddydaddy.order-package-envelope/1';
  manifest: Record<string, unknown>;
  files: InlinePackageFile[];
  seal: { algorithm: 'SHA-256'; envelope_sha256: string };
}
export interface OrderReceipt {
  schema_version?: 'strafe.order-dispatch-receipt/1';
  receipt_id: string;
  receipt_sha256: string;
  request_id: string;
  request_sha256: string;
  idempotency_key: string;
  state: OrderState;
  delivery_outcome: RecordingOutcome;
  send_effect: SendEffect;
  retry_disposition: 'SAFE_WITH_NEW_KEY' | 'RECONCILE_REQUIRED' | 'NOT_RETRYABLE';
  execution_mode: 'RECORDING_ONLY';
  external_effect: 'NONE';
  connector_reference: string | null;
  detail_code: string;
  created_at: string;
  supersedes_receipt_id: string | null;
}
export interface OrderRequestRecord {
  schema_version?: 'strafe.order-dispatch-request/1';
  request_id: string;
  request_sha256: string;
  idempotency_key: string;
  execution_mode: 'RECORDING_ONLY';
  route_ref?: string;
  actor_id: string;
  candidate?: OrderCandidateIdentity;
  package?: Record<string, unknown>;
  connector?: Record<string, unknown>;
  created_at?: string;
  retry_of_request_id?: string | null;
}
export interface OrderAuditEvent {
  event_id: string;
  event_sha256: string;
  sequence: number;
  event_type: string;
  state: OrderState;
  request_id: string;
  receipt_id: string | null;
  [key: string]: unknown;
}
export interface OrderStateToken {
  schema_version: 'caddydaddy.order-state-token/1';
  candidate: OrderCandidateIdentity;
  package_envelope: OrderPackageEnvelope;
  dispatch_input: Record<string, unknown>;
  dispatch_fingerprint_sha256: string;
  request: Record<string, unknown>;
  receipts: Record<string, unknown>[];
  latest_receipt_id: string;
  audit_events: Record<string, unknown>[];
  state_sequence: number;
  parent_state_sha256: string | null;
  seal: { algorithm: 'SHA-256'; state_sha256: string };
}
export interface OrderEnvelope {
  schema_version: 'caddydaddy.order-api/1';
  status: string;
  runtime_boundary: {
    persistence: 'PROCESS_LOCAL_DEMO_ONLY';
    connector: 'RECORDING_ONLY';
    external_effect: 'NONE';
    external_calls: 0;
  };
  claim_ceiling: string;
  limitations: string[];
  candidate: OrderCandidateIdentity;
  diagnostic?: { code: string; message: string; details?: Record<string, unknown> };
  package?: {
    package_id: string;
    manifest_sha256: string;
    selection_count: number;
    file_count: number;
    byte_reread_verified: true;
  };
  package_envelope?: OrderPackageEnvelope;
  state_token?: OrderStateToken;
  state_token_sha256?: string;
  replayed?: boolean;
  is_latest?: boolean;
  latest_receipt_id?: string;
  request?: OrderRequestRecord;
  receipt?: OrderReceipt;
  audit_events?: OrderAuditEvent[];
  event_count?: number;
  audit_head_sha256?: string | null;
  events?: OrderAuditEvent[];
}

export class OrderServiceError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = 'OrderServiceError';
    this.code = code;
    this.status = status;
  }
}

const HASH = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new OrderServiceError(code, 'Order evidence is missing a required string.');
  return value;
}

function requireHash(value: unknown, code: string): string {
  const hash = requireString(value, code);
  if (!HASH.test(hash)) throw new OrderServiceError(code, 'Order evidence contains a malformed SHA-256 value.');
  return hash;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new OrderServiceError('ORDER_CANONICAL_INVALID', 'Order evidence is outside the canonical JSON model.');
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  return sha256Bytes(bytes);
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyRecord(
  value: Record<string, unknown>,
  hashField: string,
  idField: string,
  prefix: string,
  code: string,
): Promise<void> {
  const claimedHash = requireHash(value[hashField], code);
  const claimedId = requireString(value[idField], code);
  const preimage = { ...value };
  delete preimage[hashField];
  delete preimage[idField];
  const actual = await sha256(preimage);
  if (actual !== claimedHash || claimedId !== `${prefix}${actual}`) {
    throw new OrderServiceError(code, 'A content-addressed order record failed SHA-256 verification.');
  }
}

function decodeBase64(value: string): Uint8Array {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  } catch {
    throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'Inline package bytes are not valid base64.');
  }
}

async function validatePackageEnvelope(value: unknown, expected: OrderCandidateIdentity): Promise<OrderPackageEnvelope> {
  if (
    !isRecord(value)
    || value.schema_version !== 'caddydaddy.order-package-envelope/1'
    || !isRecord(value.manifest)
    || !Array.isArray(value.files)
    || !isRecord(value.seal)
    || value.seal.algorithm !== 'SHA-256'
  ) {
    throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'The portable package envelope is malformed.');
  }
  const envelopeHash = requireHash(value.seal.envelope_sha256, 'ORDER_PACKAGE_INVALID');
  const envelopePreimage = { schema_version: value.schema_version, manifest: value.manifest, files: value.files };
  if (await sha256(envelopePreimage) !== envelopeHash) {
    throw new OrderServiceError('ORDER_PACKAGE_TAMPERED', 'The portable package seal does not match its canonical content.');
  }
  if (
    !isRecord(value.manifest.candidate)
    || value.manifest.candidate.candidate_id !== expected.candidate_id
    || value.manifest.candidate.revision !== expected.revision
    || value.manifest.candidate.artifact_sha256 !== expected.artifact_sha256
  ) {
    throw new OrderServiceError('ORDER_CANDIDATE_STALE', 'The portable package belongs to a different candidate.');
  }
  if (!isRecord(value.manifest.seal) || value.manifest.seal.algorithm !== 'SHA-256') {
    throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'The sourcing manifest is not sealed.');
  }
  const manifestHash = requireHash(value.manifest.seal.manifest_sha256, 'ORDER_PACKAGE_INVALID');
  const manifestPreimage = { ...value.manifest };
  delete manifestPreimage.seal;
  if (await sha256(manifestPreimage) !== manifestHash) {
    throw new OrderServiceError('ORDER_PACKAGE_TAMPERED', 'The sourcing manifest seal is invalid.');
  }
  const declared = Array.isArray(value.manifest.files) ? value.manifest.files : [];
  if (declared.length !== value.files.length || declared.length === 0) {
    throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'Inline package files do not match the manifest.');
  }
  for (const item of value.files) {
    if (!isRecord(item)) throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'An inline package file is malformed.');
    const bytes = decodeBase64(requireString(item.content_base64, 'ORDER_PACKAGE_INVALID'));
    const fileHash = requireHash(item.sha256, 'ORDER_PACKAGE_INVALID');
    if (item.byte_length !== bytes.length || await sha256Bytes(bytes) !== fileHash) {
      throw new OrderServiceError('ORDER_PACKAGE_TAMPERED', 'Inline package bytes failed length or SHA-256 verification.');
    }
    const descriptor = declared.find((entry) => isRecord(entry) && entry.path === item.path);
    if (!isRecord(descriptor) || descriptor.byte_length !== item.byte_length || descriptor.sha256 !== item.sha256) {
      throw new OrderServiceError('ORDER_PACKAGE_TAMPERED', 'Inline package file metadata differs from the sealed manifest.');
    }
  }
  return value as unknown as OrderPackageEnvelope;
}

function validateReceipt(value: unknown): asserts value is OrderReceipt {
  if (!isRecord(value)) throw new OrderServiceError('ORDER_RECEIPT_INVALID', 'The order response omitted its receipt.');
  requireHash(value.receipt_sha256, 'ORDER_RECEIPT_INVALID');
  requireHash(value.request_sha256, 'ORDER_RECEIPT_INVALID');
  requireString(value.receipt_id, 'ORDER_RECEIPT_INVALID');
  requireString(value.request_id, 'ORDER_RECEIPT_INVALID');
  if (value.execution_mode !== 'RECORDING_ONLY' || value.external_effect !== 'NONE') {
    throw new OrderServiceError('ORDER_BOUNDARY_VIOLATION', 'The receipt exceeded the recording-only, zero-external-effect boundary.');
  }
  if (!['DISPATCHED', 'ACKNOWLEDGED', 'EXCEPTION', 'UNKNOWN', 'CLOSED'].includes(String(value.state))) {
    throw new OrderServiceError('ORDER_RECEIPT_INVALID', 'The receipt contains an unsupported state.');
  }
}

function validateEvents(value: unknown): asserts value is OrderAuditEvent[] {
  if (!Array.isArray(value)) throw new OrderServiceError('ORDER_AUDIT_INVALID', 'The response omitted its audit events.');
  value.forEach((event) => {
    if (!isRecord(event) || !Number.isInteger(event.sequence)) throw new OrderServiceError('ORDER_AUDIT_INVALID', 'An audit event is malformed.');
    requireHash(event.event_sha256, 'ORDER_AUDIT_INVALID');
    requireString(event.event_id, 'ORDER_AUDIT_INVALID');
    requireString(event.event_type, 'ORDER_AUDIT_INVALID');
  });
}

function validateEnvelope(value: unknown, expected: OrderCandidateIdentity): asserts value is OrderEnvelope {
  if (!isRecord(value) || value.schema_version !== 'caddydaddy.order-api/1') {
    throw new OrderServiceError('ORDER_RESPONSE_SCHEMA_INVALID', 'The order service returned an unsupported response.');
  }
  if (
    !isRecord(value.runtime_boundary)
    || value.runtime_boundary.persistence !== 'PROCESS_LOCAL_DEMO_ONLY'
    || value.runtime_boundary.connector !== 'RECORDING_ONLY'
    || value.runtime_boundary.external_effect !== 'NONE'
    || value.runtime_boundary.external_calls !== 0
  ) {
    throw new OrderServiceError('ORDER_BOUNDARY_VIOLATION', 'The order service did not prove the process-local, recording-only boundary.');
  }
  if (!isRecord(value.candidate)) throw new OrderServiceError('ORDER_CANDIDATE_INVALID', 'The order response omitted candidate identity.');
  const candidate = {
    candidate_id: requireString(value.candidate.candidate_id, 'ORDER_CANDIDATE_INVALID'),
    revision: requireString(value.candidate.revision, 'ORDER_CANDIDATE_INVALID'),
    artifact_sha256: requireHash(value.candidate.artifact_sha256, 'ORDER_CANDIDATE_INVALID'),
  };
  if (
    candidate.candidate_id !== expected.candidate_id
    || candidate.revision !== expected.revision
    || candidate.artifact_sha256 !== expected.artifact_sha256
  ) {
    throw new OrderServiceError('ORDER_CANDIDATE_STALE', 'The order response belongs to a different candidate or revision.');
  }
  requireString(value.status, 'ORDER_RESPONSE_INVALID');
  requireString(value.claim_ceiling, 'ORDER_RESPONSE_INVALID');
  if (!Array.isArray(value.limitations) || !value.limitations.every((item) => typeof item === 'string' && item.length > 0)) {
    throw new OrderServiceError('ORDER_RESPONSE_INVALID', 'The order response omitted its limitations.');
  }
}

async function validateStateToken(
  value: unknown,
  expected: OrderCandidateIdentity,
  responseHash?: unknown,
): Promise<OrderStateToken> {
  if (
    !isRecord(value)
    || value.schema_version !== 'caddydaddy.order-state-token/1'
    || !isRecord(value.seal)
    || value.seal.algorithm !== 'SHA-256'
  ) {
    throw new OrderServiceError('ORDER_STATE_INVALID', 'The client-carried state token is malformed.');
  }
  const stateHash = requireHash(value.seal.state_sha256, 'ORDER_STATE_INVALID');
  if (responseHash !== undefined && requireHash(responseHash, 'ORDER_STATE_INVALID') !== stateHash) {
    throw new OrderServiceError('ORDER_STATE_TAMPERED', 'The response state hash disagrees with its token.');
  }
  const preimage = { ...value };
  delete preimage.seal;
  if (await sha256(preimage) !== stateHash) {
    throw new OrderServiceError('ORDER_STATE_TAMPERED', 'The client-carried state seal is invalid.');
  }
  if (
    !isRecord(value.candidate)
    || value.candidate.candidate_id !== expected.candidate_id
    || value.candidate.revision !== expected.revision
    || value.candidate.artifact_sha256 !== expected.artifact_sha256
  ) {
    throw new OrderServiceError('ORDER_CANDIDATE_STALE', 'The state token belongs to a different candidate.');
  }
  await validatePackageEnvelope(value.package_envelope, expected);
  if (
    !isRecord(value.dispatch_input)
    || await sha256(value.dispatch_input) !== requireHash(value.dispatch_fingerprint_sha256, 'ORDER_STATE_INVALID')
  ) {
    throw new OrderServiceError('ORDER_STATE_TAMPERED', 'The dispatch binding is invalid.');
  }
  if (!isRecord(value.request)) throw new OrderServiceError('ORDER_STATE_INVALID', 'The state token omitted its request.');
  await verifyRecord(value.request, 'request_sha256', 'request_id', 'order-request:', 'ORDER_REQUEST_INVALID');
  if (
    value.request.execution_mode !== 'RECORDING_ONLY'
    || !isRecord(value.request.connector)
    || value.request.connector.kind !== 'RECORDING'
    || value.request.connector.connector_id !== 'recording:v1'
  ) {
    throw new OrderServiceError('ORDER_BOUNDARY_VIOLATION', 'The state request is not recording-only.');
  }
  if (!Array.isArray(value.receipts) || value.receipts.length === 0) {
    throw new OrderServiceError('ORDER_STATE_INVALID', 'The state token omitted receipt history.');
  }
  let previous: string | null = null;
  for (const raw of value.receipts) {
    if (!isRecord(raw)) throw new OrderServiceError('ORDER_RECEIPT_INVALID', 'A state receipt is malformed.');
    validateReceipt(raw);
    await verifyRecord(raw, 'receipt_sha256', 'receipt_id', 'order-receipt:', 'ORDER_RECEIPT_INVALID');
    if (
      raw.request_id !== value.request.request_id
      || raw.request_sha256 !== value.request.request_sha256
      || raw.supersedes_receipt_id !== previous
    ) {
      throw new OrderServiceError('ORDER_STATE_STALE', 'Receipt history is not contiguous or request-bound.');
    }
    previous = raw.receipt_id as string;
  }
  if (value.latest_receipt_id !== previous) throw new OrderServiceError('ORDER_STATE_STALE', 'The latest receipt pointer is stale.');
  if (!Array.isArray(value.audit_events) || value.audit_events.length === 0) {
    throw new OrderServiceError('ORDER_AUDIT_INVALID', 'The state token omitted its audit chain.');
  }
  let priorHash: string | null = null;
  for (let index = 0; index < value.audit_events.length; index += 1) {
    const raw = value.audit_events[index];
    if (
      !isRecord(raw)
      || raw.sequence !== index
      || raw.previous_event_sha256 !== priorHash
      || raw.request_id !== value.request.request_id
    ) {
      throw new OrderServiceError('ORDER_AUDIT_INVALID', 'The state audit chain is discontinuous.');
    }
    await verifyRecord(raw, 'event_sha256', 'event_id', 'order-event:', 'ORDER_AUDIT_INVALID');
    priorHash = raw.event_sha256 as string;
  }
  const finalEvent = value.audit_events[value.audit_events.length - 1];
  if (!isRecord(finalEvent) || finalEvent.receipt_id !== value.latest_receipt_id) {
    throw new OrderServiceError('ORDER_STATE_STALE', 'The audit head does not describe the latest receipt.');
  }
  if (!Number.isInteger(value.state_sequence) || Number(value.state_sequence) < 0) {
    throw new OrderServiceError('ORDER_STATE_INVALID', 'The state sequence is invalid.');
  }
  return value as unknown as OrderStateToken;
}

function validatePackage(value: OrderEnvelope): void {
  if (!isRecord(value.package) || value.package.byte_reread_verified !== true) {
    throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'Package validation did not prove a byte reread.');
  }
  requireHash(value.package.manifest_sha256, 'ORDER_PACKAGE_INVALID');
  requireString(value.package.package_id, 'ORDER_PACKAGE_INVALID');
}
function validateLifecycle(value: OrderEnvelope): void { validateReceipt(value.receipt); validateEvents(value.audit_events); }
function validateRead(value: OrderEnvelope): void {
  validateLifecycle(value);
  if (!isRecord(value.request) || value.request.execution_mode !== 'RECORDING_ONLY') {
    throw new OrderServiceError('ORDER_REQUEST_INVALID', 'The read response omitted its recording-only request.');
  }
  requireHash(value.request.request_sha256, 'ORDER_REQUEST_INVALID');
  if (value.is_latest !== true) throw new OrderServiceError('ORDER_RECEIPT_STALE', 'The service returned a superseded receipt.');
}
function validateAudit(value: OrderEnvelope): void {
  if (!Number.isInteger(value.event_count) || Number(value.event_count) < 1) throw new OrderServiceError('ORDER_AUDIT_INVALID', 'Audit verification returned no events.');
  requireHash(value.audit_head_sha256, 'ORDER_AUDIT_INVALID');
  validateEvents(value.events);
  if (value.events?.length !== value.event_count) throw new OrderServiceError('ORDER_AUDIT_INVALID', 'Audit count does not match the verified event set.');
}

export class OrderClient {
  readonly candidate: OrderCandidateIdentity;
  private lastValid: OrderEnvelope | null = null;
  private packageEnvelope: OrderPackageEnvelope | null = null;
  private stateToken: OrderStateToken | null = null;

  constructor(candidate: OperationsCandidateIdentity, private readonly fetchImpl: typeof fetch = fetch) {
    this.candidate = {
      candidate_id: requireString(candidate.candidate_id, 'ORDER_CANDIDATE_INVALID'),
      revision: requireString(candidate.revision_id, 'ORDER_CANDIDATE_INVALID'),
      artifact_sha256: requireHash(candidate.snapshot_sha256, 'ORDER_CANDIDATE_INVALID'),
    };
  }

  getLastValid(): OrderEnvelope | null { return this.lastValid; }
  getStateToken(): OrderStateToken | null { return this.stateToken; }

  async resume(stateToken: OrderStateToken): Promise<void> {
    this.stateToken = await validateStateToken(stateToken, this.candidate);
    this.packageEnvelope = this.stateToken.package_envelope;
  }

  private continuity(): Record<string, unknown> {
    return this.stateToken ? { state_token: this.stateToken } : {};
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
    validate: (value: OrderEnvelope) => void,
  ): Promise<OrderEnvelope> {
    let response: Response;
    try {
      // Chromium's native fetch rejects when the OrderClient instance is used
      // as its Web API receiver (TypeError: Illegal invocation).
      const fetchRequest = this.fetchImpl;
      response = await fetchRequest(path, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: this.candidate, ...payload }),
      });
    } catch {
      throw new OrderServiceError('ORDER_SERVICE_UNREACHABLE', 'The recording-only order service is unreachable.');
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new OrderServiceError('ORDER_RESPONSE_INVALID', 'The order service returned non-JSON data.', response.status);
    }
    validateEnvelope(value, this.candidate);
    if (!response.ok) {
      throw new OrderServiceError(
        value.diagnostic?.code ?? 'ORDER_SERVICE_REJECTED',
        value.diagnostic?.message ?? 'The order service rejected the operation.',
        response.status,
      );
    }
    validate(value);
    if (value.package_envelope) this.packageEnvelope = await validatePackageEnvelope(value.package_envelope, this.candidate);
    if (value.state_token) {
      this.stateToken = await validateStateToken(value.state_token, this.candidate, value.state_token_sha256);
      this.packageEnvelope = this.stateToken.package_envelope;
    }
    this.lastValid = value;
    return value;
  }

  validatePackage(input: string | OrderPackageEnvelope): Promise<OrderEnvelope> {
    return this.post(
      '/api/orders/packages/validate',
      typeof input === 'string' ? { manifest_relative_path: input } : { package_envelope: input },
      validatePackage,
    );
  }

  dispatchRecording(input: {
    manifest_relative_path?: string;
    manifest_sha256: string;
    package_envelope?: OrderPackageEnvelope;
    recording_outcome: RecordingOutcome;
    idempotency_key: string;
    route_ref: string;
    actor_id: string;
    occurred_at: string;
    retry_of_request_id?: string | null;
  }): Promise<OrderEnvelope> {
    return this.post(
      '/api/orders/dispatches',
      {
        ...input,
        package_envelope: input.package_envelope ?? this.packageEnvelope ?? undefined,
        ...this.continuity(),
      },
      validateLifecycle,
    );
  }

  readReceipt(receiptId: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/read', { receipt_id: receiptId, ...this.continuity() }, validateRead);
  }

  acknowledge(receiptId: string, acknowledgementRef: string, actorId: string, occurredAt: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/acknowledge', {
      receipt_id: receiptId,
      acknowledgement_ref: acknowledgementRef,
      actor_id: actorId,
      occurred_at: occurredAt,
      ...this.continuity(),
    }, validateLifecycle);
  }

  reconcileUnknown(
    receiptId: string,
    resolutionRef: string,
    reconciledSendEffect: 'NOT_SENT' | 'SENT',
    actorId: string,
    occurredAt: string,
  ): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/reconcile', {
      receipt_id: receiptId,
      resolution_ref: resolutionRef,
      reconciled_send_effect: reconciledSendEffect,
      actor_id: actorId,
      occurred_at: occurredAt,
      ...this.continuity(),
    }, validateLifecycle);
  }

  close(receiptId: string, actorId: string, occurredAt: string, resolutionRef?: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/close', {
      receipt_id: receiptId,
      actor_id: actorId,
      occurred_at: occurredAt,
      resolution_ref: resolutionRef,
      ...this.continuity(),
    }, validateLifecycle);
  }

  verifyAudit(events?: OrderAuditEvent[]): Promise<OrderEnvelope> {
    return this.post('/api/orders/audit/verify', {
      ...this.continuity(),
      ...(events ? { events } : {}),
    }, validateAudit);
  }
}
