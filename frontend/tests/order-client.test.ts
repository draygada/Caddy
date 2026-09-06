import { describe, expect, it, vi } from 'vitest';
import { OrderClient, OrderServiceError, type OrderAuditEvent, type OrderEnvelope, type OrderReceipt } from '../src/lib/order-client';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const candidate = { candidate_id: 'candidate:0.2', revision_id: 'revision:02', snapshot_sha256: HASH_A };
const orderCandidate = { candidate_id: candidate.candidate_id, revision: candidate.revision_id, artifact_sha256: candidate.snapshot_sha256 };
const event: OrderAuditEvent = { event_id: `order-event:${HASH_C}`, event_sha256: HASH_C, sequence: 0, event_type: 'ORDER_DISPATCHED', state: 'DISPATCHED', request_id: `order-request:${HASH_B}`, receipt_id: `order-receipt:${HASH_C}` };
const receipt: OrderReceipt = { receipt_id: `order-receipt:${HASH_C}`, receipt_sha256: HASH_C, request_id: `order-request:${HASH_B}`, request_sha256: HASH_B, idempotency_key: 'demo-key', state: 'DISPATCHED', delivery_outcome: 'DISPATCHED', send_effect: 'SENT', retry_disposition: 'NOT_RETRYABLE', execution_mode: 'RECORDING_ONLY', external_effect: 'NONE', connector_reference: 'recording:demo-key', detail_code: 'RECORDED_DISPATCH_SIMULATION', created_at: '2026-09-05T18:00:00Z', supersedes_receipt_id: null };

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
});
