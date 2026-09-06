import { describe, expect, it, vi } from 'vitest';
import { OrderClient, OrderServiceError, type OrderAuditEvent, type OrderEnvelope, type OrderReceipt, type OrderStateToken } from '../src/lib/order-client';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const candidate = { candidate_id: 'candidate:0.2', revision_id: 'revision:02', snapshot_sha256: HASH_A };
const orderCandidate = { candidate_id: candidate.candidate_id, revision: candidate.revision_id, artifact_sha256: candidate.snapshot_sha256 };
const event: OrderAuditEvent = { event_id: `order-event:${HASH_C}`, event_sha256: HASH_C, sequence: 0, event_type: 'ORDER_DISPATCHED', state: 'DISPATCHED', request_id: `order-request:${HASH_B}`, receipt_id: `order-receipt:${HASH_C}` };
const receipt: OrderReceipt = { receipt_id: `order-receipt:${HASH_C}`, receipt_sha256: HASH_C, request_id: `order-request:${HASH_B}`, request_sha256: HASH_B, idempotency_key: 'demo-key', state: 'DISPATCHED', delivery_outcome: 'DISPATCHED', send_effect: 'SENT', retry_disposition: 'NOT_RETRYABLE', execution_mode: 'RECORDING_ONLY', external_effect: 'NONE', connector_reference: 'recording:demo-key', detail_code: 'RECORDED_DISPATCH_SIMULATION', created_at: '2026-09-05T18:00:00Z', supersedes_receipt_id: null };

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function portableState(): Promise<OrderStateToken> {
  const fileBytes = new TextEncoder().encode('fixture');
  const fileHash = await digestBytes(fileBytes);
  const manifestPreimage = {
    schema_version: 'strafe.sealed-sourcing-package/1',
    package_id: 'package:portable',
    package_status: 'SEALED',
    candidate: orderCandidate,
    selections: [{ line_id: 'line:1', offer_id: 'offer:1', selected: true, offer_status: 'APPROVED', gate_state: 'CLEARED' }],
    files: [{ path: 'bom.csv', byte_length: fileBytes.length, sha256: fileHash }],
  };
  const manifest = { ...manifestPreimage, seal: { algorithm: 'SHA-256', manifest_sha256: await digest(manifestPreimage) } };
  const packagePreimage = {
    schema_version: 'caddydaddy.order-package-envelope/1',
    manifest,
    files: [{ path: 'bom.csv', byte_length: fileBytes.length, sha256: fileHash, content_base64: btoa('fixture') }],
  };
  const packageEnvelope = { ...packagePreimage, seal: { algorithm: 'SHA-256', envelope_sha256: await digest(packagePreimage) } };
  const dispatchInput = {
    recording_outcome: 'DISPATCHED',
    idempotency_key: 'demo-key',
    route_ref: 'supplier:recording-demo',
    actor_id: 'operator:browser',
    occurred_at: '2026-09-05T18:00:00Z',
    retry_of_request_id: null,
  };
  const requestPreimage = {
    schema_version: 'strafe.order-dispatch-request/1',
    idempotency_key: 'demo-key',
    candidate: orderCandidate,
    package: { package_id: 'package:portable', sealed_manifest_sha256: manifest.seal.manifest_sha256, selection_count: 1, file_count: 1 },
    connector: { kind: 'RECORDING', connector_id: 'recording:v1', route_ref: 'supplier:recording-demo' },
    execution_mode: 'RECORDING_ONLY',
    created_at: '2026-09-05T18:00:00Z',
    actor_id: 'operator:browser',
    retry_of_request_id: null,
  };
  const requestHash = await digest(requestPreimage);
  const requestRecord = { ...requestPreimage, request_id: `order-request:${requestHash}`, request_sha256: requestHash };
  const receiptPreimage = {
    schema_version: 'strafe.order-dispatch-receipt/1',
    request_id: requestRecord.request_id,
    request_sha256: requestHash,
    idempotency_key: 'demo-key',
    state: 'DISPATCHED',
    delivery_outcome: 'DISPATCHED',
    send_effect: 'SENT',
    retry_disposition: 'NOT_RETRYABLE',
    execution_mode: 'RECORDING_ONLY',
    external_effect: 'NONE',
    connector_reference: 'recording:demo-key',
    detail_code: 'RECORDED_DISPATCH_SIMULATION',
    created_at: '2026-09-05T18:00:00Z',
    supersedes_receipt_id: null,
  };
  const receiptHash = await digest(receiptPreimage);
  const receiptRecord = { ...receiptPreimage, receipt_id: `order-receipt:${receiptHash}`, receipt_sha256: receiptHash };
  const eventPreimage = {
    schema_version: 'strafe.order-audit-event/1',
    sequence: 0,
    previous_event_sha256: null,
    event_type: 'ORDER_DISPATCHED',
    state: 'DISPATCHED',
    request_id: requestRecord.request_id,
    receipt_id: receiptRecord.receipt_id,
    actor_id: 'operator:browser',
    occurred_at: '2026-09-05T18:00:00Z',
    payload: { external_effect: 'NONE' },
  };
  const eventHash = await digest(eventPreimage);
  const auditEvent = { ...eventPreimage, event_id: `order-event:${eventHash}`, event_sha256: eventHash };
  const statePreimage = {
    schema_version: 'caddydaddy.order-state-token/1',
    candidate: orderCandidate,
    package_envelope: packageEnvelope,
    dispatch_input: dispatchInput,
    dispatch_fingerprint_sha256: await digest(dispatchInput),
    request: requestRecord,
    receipts: [receiptRecord],
    latest_receipt_id: receiptRecord.receipt_id,
    audit_events: [auditEvent],
    state_sequence: 0,
    parent_state_sha256: null,
  };
  return {
    ...statePreimage,
    seal: { algorithm: 'SHA-256', state_sha256: await digest(statePreimage) },
  } as OrderStateToken;
}

async function digestBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function asciiJsonString(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function sourcingCanonical(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return asciiJsonString(value);
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(sourcingCanonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${asciiJsonString(key)}:${sourcingCanonical(record[key])}`).join(',')}}`;
}

async function stagedSourcingPackage(): Promise<Record<string, unknown>> {
  const sourceCandidate = { candidate_id: candidate.candidate_id, revision_id: candidate.revision_id, snapshot_sha256: candidate.snapshot_sha256 };
  const payload = {
    schema_version: 'caddydaddy.staged-order-payload/1',
    candidate: sourceCandidate,
    round_id: 'round:connected',
    selected_offer: { offer_id: 'offer:user:one', seller: 'München Supply', screening_disposition: 'eligible-bounded' },
    corpus_sha256: HASH_C,
    external_send_authorized: false,
  };
  const payloadBytes = new TextEncoder().encode(sourcingCanonical(payload));
  const payloadHash = await digestBytes(payloadBytes);
  const payloadFile = `payload-${payloadHash}.json`;
  const manifest = {
    schema_version: 'caddydaddy.staged-order-manifest/1',
    candidate: sourceCandidate,
    round_id: 'round:connected',
    payload_file: payloadFile,
    payload_sha256: payloadHash,
    payload_bytes: payloadBytes.length,
    corpus_sha256: HASH_C,
    dispatch_ceiling: 'STAGED_ONLY',
  };
  const manifestHash = await digestBytes(new TextEncoder().encode(sourcingCanonical(manifest)));
  return {
    ...manifest,
    manifest_file: `manifest-${manifestHash}.json`,
    manifest_sha256: manifestHash,
    byte_reread_verified: true,
    payload,
    manifest,
    continuity: 'CLIENT_CARRIED_CANONICAL_BYTES',
  };
}

function envelope(values: Partial<OrderEnvelope>): OrderEnvelope {
  return {
    schema_version: 'caddydaddy.order-api/1',
    status: 'READY',
    runtime_boundary: { persistence: 'PROCESS_LOCAL_DEMO_ONLY', connector: 'RECORDING_ONLY', external_effect: 'NONE', external_calls: 0 },
    claim_ceiling: 'No supplier was contacted.',
    limitations: ['Process-local demo only.'],
    candidate: orderCandidate,
    ...values,
  };
}

describe('recording-only order client', () => {
  it('validates sealed packages and translates the sourcing candidate identity', async () => {
    const fetchImpl = vi.fn(async (_path: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).candidate).toEqual(orderCandidate);
      return new Response(JSON.stringify(envelope({ package: { package_id: 'package:demo', manifest_sha256: HASH_B, selection_count: 1, file_count: 2, byte_reread_verified: true } })), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);
    await expect(client.validatePackage('manifest-demo.json')).resolves.toMatchObject({ package: { byte_reread_verified: true } });
  });

  it('invokes browser fetch without binding the OrderClient as its receiver', async () => {
    let receiver: unknown = 'not-called';
    const fetchImpl = function (this: unknown) {
      receiver = this;
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response(JSON.stringify(envelope({
        package: { package_id: 'package:demo', manifest_sha256: HASH_B, selection_count: 1, file_count: 2, byte_reread_verified: true },
      })), { status: 200 }));
    } as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);

    await expect(client.validatePackage('manifest-demo.json')).resolves.toMatchObject({ package: { byte_reread_verified: true } });
    expect(receiver).toBeUndefined();
  });

  it('revalidates a sealed sourcing response and carries its inline bytes into stateless dispatch', async () => {
    const sourcePackage = await stagedSourcingPackage();
    let validatedEnvelope: OrderEnvelope['package_envelope'];
    const fetchImpl = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (String(path).endsWith('/packages/validate')) {
        expect(body).not.toHaveProperty('manifest_relative_path');
        validatedEnvelope = body.package_envelope as OrderEnvelope['package_envelope'];
        const manifestHash = validatedEnvelope!.manifest.seal.manifest_sha256;
        return new Response(JSON.stringify(envelope({
          package: { package_id: validatedEnvelope!.manifest.package_id as string, manifest_sha256: manifestHash, selection_count: 1, file_count: 2, byte_reread_verified: true },
          package_envelope: validatedEnvelope,
        })), { status: 200 });
      }
      expect(body.package_envelope).toEqual(validatedEnvelope);
      expect(body.manifest_sha256).toBe(validatedEnvelope!.manifest.seal.manifest_sha256);
      return new Response(JSON.stringify(envelope({ receipt, audit_events: [event] })), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);

    const validated = await client.validateSourcingPackage(sourcePackage);
    await client.dispatchRecording({ manifest_sha256: validated.package!.manifest_sha256, recording_outcome: 'DISPATCHED', idempotency_key: 'demo-key', route_ref: 'supplier:recording-demo', actor_id: 'operator:browser', occurred_at: '2026-09-05T18:00:00Z' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects tampered sourcing bytes before calling the order service', async () => {
    const sourcePackage = await stagedSourcingPackage();
    (sourcePackage.payload as Record<string, unknown>).external_send_authorized = true;
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);

    await expect(client.validateSourcingPackage(sourcePackage)).rejects.toMatchObject({ code: 'ORDER_BOUNDARY_VIOLATION' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('dispatches, reads, acknowledges, reconciles, closes, and verifies through explicit routes', async () => {
    const paths: string[] = [];
    const fetchImpl = vi.fn(async (path: string | URL | Request) => {
      paths.push(String(path));
      if (String(path).endsWith('/read')) return new Response(JSON.stringify(envelope({ is_latest: true, latest_receipt_id: receipt.receipt_id, request: { request_id: receipt.request_id, request_sha256: HASH_B, idempotency_key: 'demo-key', execution_mode: 'RECORDING_ONLY', route_ref: 'supplier:recording-demo', actor_id: 'operator:browser' }, receipt, audit_events: [event] })), { status: 200 });
      if (String(path).endsWith('/verify')) return new Response(JSON.stringify(envelope({ event_count: 1, audit_head_sha256: HASH_C, events: [event] })), { status: 200 });
      return new Response(JSON.stringify(envelope({ receipt, audit_events: [event] })), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);
    await client.dispatchRecording({ manifest_relative_path: 'manifest.json', manifest_sha256: HASH_B, recording_outcome: 'DISPATCHED', idempotency_key: 'demo-key', route_ref: 'supplier:recording-demo', actor_id: 'operator:browser', occurred_at: '2026-09-05T18:00:00Z' });
    await client.readReceipt(receipt.receipt_id);
    await client.acknowledge(receipt.receipt_id, 'evidence:recorded', 'operator:browser', '2026-09-05T18:00:00Z');
    await client.reconcileUnknown(receipt.receipt_id, 'evidence:not-received', 'NOT_SENT', 'operator:browser', '2026-09-05T18:00:00Z');
    await client.close(receipt.receipt_id, 'operator:browser', '2026-09-05T18:00:00Z');
    await client.verifyAudit();
    expect(paths).toEqual(['/api/orders/dispatches', '/api/orders/receipts/read', '/api/orders/receipts/acknowledge', '/api/orders/receipts/reconcile', '/api/orders/receipts/close', '/api/orders/audit/verify']);
  });

  it('rejects a boundary violation without replacing last-valid evidence', async () => {
    let unsafe = false;
    const fetchImpl = vi.fn(async () => {
      const value = envelope({ package: { package_id: 'package:demo', manifest_sha256: HASH_B, selection_count: 1, file_count: 2, byte_reread_verified: true } });
      if (unsafe) value.runtime_boundary.external_effect = 'CONNECTOR_REPORTED' as 'NONE';
      return new Response(JSON.stringify(value), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);
    const valid = await client.validatePackage('manifest.json');
    unsafe = true;
    await expect(client.validatePackage('manifest.json')).rejects.toBeInstanceOf(OrderServiceError);
    expect(client.getLastValid()).toBe(valid);
  });

  it('surfaces fail-closed diagnostics while retaining the last valid receipt', async () => {
    let blocked = false;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(blocked
      ? envelope({ status: 'BLOCKED', diagnostic: { code: 'UNKNOWN_RECONCILIATION_REQUIRED', message: 'Evidence is required.' } })
      : envelope({ receipt, audit_events: [event] })), { status: blocked ? 409 : 200 })) as unknown as typeof fetch;
    const client = new OrderClient(candidate, fetchImpl);
    const valid = await client.dispatchRecording({ manifest_relative_path: 'manifest.json', manifest_sha256: HASH_B, recording_outcome: 'DISPATCHED', idempotency_key: 'demo-key', route_ref: 'supplier:recording-demo', actor_id: 'operator:browser', occurred_at: '2026-09-05T18:00:00Z' });
    blocked = true;
    await expect(client.close(receipt.receipt_id, 'operator:browser', '2026-09-05T18:00:00Z')).rejects.toMatchObject({ code: 'UNKNOWN_RECONCILIATION_REQUIRED' });
    expect(client.getLastValid()).toBe(valid);
  });

  it('revalidates, resumes, and carries portable state from a cold client', async () => {
    const token = await portableState();
    const calls: Record<string, unknown>[] = [];
    const tokenReceipt = token.receipts[0] as unknown as OrderReceipt;
    const tokenEvent = token.audit_events[0] as unknown as OrderAuditEvent;
    const fetchImpl = vi.fn(async (_path: string | URL | Request, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify(envelope({
        is_latest: true,
        latest_receipt_id: token.latest_receipt_id,
        request: token.request as unknown as OrderEnvelope['request'],
        receipt: tokenReceipt,
        audit_events: [tokenEvent],
        state_token: token,
        state_token_sha256: token.seal.state_sha256,
      })), { status: 200 });
    }) as unknown as typeof fetch;
    const cold = new OrderClient(candidate, fetchImpl);
    await cold.resume(token);
    await cold.readReceipt(token.latest_receipt_id);
    expect(calls[0].state_token).toEqual(token);
    expect(cold.getStateToken()).toEqual(token);
  });

  it('rejects a tampered resumed token before any network request', async () => {
    const token = await portableState();
    token.dispatch_input.route_ref = 'supplier:tampered';
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const cold = new OrderClient(candidate, fetchImpl);
    await expect(cold.resume(token)).rejects.toMatchObject({ code: 'ORDER_STATE_TAMPERED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
