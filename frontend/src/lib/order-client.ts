import type { OperationsCandidateIdentity } from './operations-client';

export type RecordingOutcome = 'DISPATCHED' | 'ACKNOWLEDGED' | 'EXCEPTION' | 'UNKNOWN';
export type OrderState = 'DRAFT' | 'DISPATCH_PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'EXCEPTION' | 'UNKNOWN' | 'CLOSED';
export type SendEffect = 'NOT_SENT' | 'POSSIBLY_SENT' | 'SENT';

export interface OrderCandidateIdentity {
  candidate_id: string;
  revision: string;
  artifact_sha256: string;
}

export interface OrderReceipt {
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
  request_id: string;
  request_sha256: string;
  idempotency_key: string;
  execution_mode: 'RECORDING_ONLY';
  route_ref: string;
  actor_id: string;
}

export interface OrderAuditEvent {
  event_id: string;
  event_sha256: string;
  sequence: number;
  event_type: string;
  state: OrderState;
  request_id: string;
  receipt_id: string | null;
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
  if (!isRecord(value) || value.schema_version !== 'caddydaddy.order-api/1') throw new OrderServiceError('ORDER_RESPONSE_SCHEMA_INVALID', 'The order service returned an unsupported response.');
  if (!isRecord(value.runtime_boundary)
    || value.runtime_boundary.persistence !== 'PROCESS_LOCAL_DEMO_ONLY'
    || value.runtime_boundary.connector !== 'RECORDING_ONLY'
    || value.runtime_boundary.external_effect !== 'NONE'
    || value.runtime_boundary.external_calls !== 0) {
    throw new OrderServiceError('ORDER_BOUNDARY_VIOLATION', 'The order service did not prove the process-local, recording-only boundary.');
  }
  if (!isRecord(value.candidate)) throw new OrderServiceError('ORDER_CANDIDATE_INVALID', 'The order response omitted candidate identity.');
  const candidate = {
    candidate_id: requireString(value.candidate.candidate_id, 'ORDER_CANDIDATE_INVALID'),
    revision: requireString(value.candidate.revision, 'ORDER_CANDIDATE_INVALID'),
    artifact_sha256: requireHash(value.candidate.artifact_sha256, 'ORDER_CANDIDATE_INVALID'),
  };
  if (candidate.candidate_id !== expected.candidate_id || candidate.revision !== expected.revision || candidate.artifact_sha256 !== expected.artifact_sha256) {
    throw new OrderServiceError('ORDER_CANDIDATE_STALE', 'The order response belongs to a different candidate or revision.');
  }
  requireString(value.status, 'ORDER_RESPONSE_INVALID');
  requireString(value.claim_ceiling, 'ORDER_RESPONSE_INVALID');
  if (!Array.isArray(value.limitations) || !value.limitations.every((item) => typeof item === 'string' && item.length > 0)) {
    throw new OrderServiceError('ORDER_RESPONSE_INVALID', 'The order response omitted its limitations.');
  }
}

function validatePackage(value: OrderEnvelope): void {
  if (!isRecord(value.package) || value.package.byte_reread_verified !== true) throw new OrderServiceError('ORDER_PACKAGE_INVALID', 'Package validation did not prove a byte reread.');
  requireHash(value.package.manifest_sha256, 'ORDER_PACKAGE_INVALID');
  requireString(value.package.package_id, 'ORDER_PACKAGE_INVALID');
}

function validateLifecycle(value: OrderEnvelope): void {
  validateReceipt(value.receipt);
  validateEvents(value.audit_events);
}

function validateRead(value: OrderEnvelope): void {
  validateLifecycle(value);
  if (!isRecord(value.request) || value.request.execution_mode !== 'RECORDING_ONLY') throw new OrderServiceError('ORDER_REQUEST_INVALID', 'The read response omitted its recording-only request.');
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

  constructor(candidate: OperationsCandidateIdentity, private readonly fetchImpl: typeof fetch = fetch) {
    this.candidate = {
      candidate_id: requireString(candidate.candidate_id, 'ORDER_CANDIDATE_INVALID'),
      revision: requireString(candidate.revision_id, 'ORDER_CANDIDATE_INVALID'),
      artifact_sha256: requireHash(candidate.snapshot_sha256, 'ORDER_CANDIDATE_INVALID'),
    };
  }

  getLastValid(): OrderEnvelope | null {
    return this.lastValid;
  }

  private async post(path: string, payload: Record<string, unknown>, validate: (value: OrderEnvelope) => void): Promise<OrderEnvelope> {
    let response: Response;
    try {
      response = await this.fetchImpl(path, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: this.candidate, ...payload }),
      });
    } catch {
      throw new OrderServiceError('ORDER_SERVICE_UNREACHABLE', 'The process-local order service is unreachable.');
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new OrderServiceError('ORDER_RESPONSE_INVALID', 'The order service returned non-JSON data.', response.status);
    }
    validateEnvelope(value, this.candidate);
    if (!response.ok) throw new OrderServiceError(value.diagnostic?.code ?? 'ORDER_SERVICE_REJECTED', value.diagnostic?.message ?? 'The order service rejected the operation.', response.status);
    validate(value);
    this.lastValid = value;
    return value;
  }

  validatePackage(manifestRelativePath: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/packages/validate', { manifest_relative_path: manifestRelativePath }, validatePackage);
  }

  dispatchRecording(input: { manifest_relative_path: string; manifest_sha256: string; recording_outcome: RecordingOutcome; idempotency_key: string; route_ref: string; actor_id: string; occurred_at: string }): Promise<OrderEnvelope> {
    return this.post('/api/orders/dispatches', input, validateLifecycle);
  }

  readReceipt(receiptId: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/read', { receipt_id: receiptId }, validateRead);
  }

  acknowledge(receiptId: string, acknowledgementRef: string, actorId: string, occurredAt: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/acknowledge', { receipt_id: receiptId, acknowledgement_ref: acknowledgementRef, actor_id: actorId, occurred_at: occurredAt }, validateLifecycle);
  }

  reconcileUnknown(receiptId: string, resolutionRef: string, reconciledSendEffect: 'NOT_SENT' | 'SENT', actorId: string, occurredAt: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/reconcile', { receipt_id: receiptId, resolution_ref: resolutionRef, reconciled_send_effect: reconciledSendEffect, actor_id: actorId, occurred_at: occurredAt }, validateLifecycle);
  }

  close(receiptId: string, actorId: string, occurredAt: string, resolutionRef?: string): Promise<OrderEnvelope> {
    return this.post('/api/orders/receipts/close', { receipt_id: receiptId, actor_id: actorId, occurred_at: occurredAt, resolution_ref: resolutionRef }, validateLifecycle);
  }

  verifyAudit(): Promise<OrderEnvelope> {
    return this.post('/api/orders/audit/verify', {}, validateAudit);
  }
}
