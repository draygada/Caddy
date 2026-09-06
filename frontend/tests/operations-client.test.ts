import { describe, expect, it, vi } from 'vitest';
import { OperationsClient, OperationsServiceError, loadOperationsCandidateIdentity, type OperationsCandidateIdentity } from '../src/lib/operations-client';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const IDENTITY: OperationsCandidateIdentity = { candidate_id: 'candidate:0.1', revision_id: 'revision:fixture-01', snapshot_sha256: HASH_A };

const envelope = (domain: 'sourcing' | 'provenance', values: Record<string, unknown>) => ({
  schema_version: `caddydaddy.${domain}-service/1`,
  status: 'READY',
  candidate: IDENTITY,
  source_hashes: domain === 'sourcing' ? { screening: HASH_B, ownership: HASH_B, offers: HASH_B, tariffs: HASH_B } : { 'gx220-vendor-page': HASH_B },
  corpus: { corpus_sha256: HASH_C },
  claim_ceiling: domain === 'sourcing' ? 'FIXTURE_REVIEW_SUPPORT_ONLY_NO_CLEARANCE_OR_EXTERNAL_ORDER' : 'COMMITTED_FIXTURE_BYTE_VERIFICATION_ONLY',
  limitations: ['Fixture only.'],
  ...values,
});

const round = {
  round_id: 'round:fixture',
  request: { candidate: IDENTITY, part_key: 'flight-controller', quantity: 2, mode: 'air', corpus_sha256: HASH_C },
  selected_offer_id: null,
  events: [],
  offers: [{
    offer_id: 'offer:aero-us-001', part_key: 'flight-controller', seller: 'Aero Supply LLC', manufacturer: 'Aero Supply LLC', origin: 'US', ship_from: 'US', unit_price_usd: '118.00', lead_days: 4, declared_hts: '8542.31', declared_eccn: 'EAR99', screening_disposition: 'eligible-fixture',
    ownership_walk: { seller: { name: 'Aero Supply LLC', pct: null, screening: { result: 'no-candidate-match' }, owners: [] }, manufacturer: null },
    landed_cost: { rows: [{ layer: 'goods', amount_usd: '236.00', source: 'fixture offer' }], total_usd: '236.00', per_unit_usd: '118.00', assumptions: 'domestic fixture' },
  }],
};

describe('operations service client', () => {
  it('derives an exact candidate identity from the current candidate endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      candidate: { id: 'candidate:0.1', version: '0.1', payloadHash: HASH_C },
      document: { revisionId: 'revision:fixture-01' },
      releaseIdentity: { schemaVersion: 'caddydaddy.release-identity/1', candidateId: 'candidate:0.1', candidateVersion: '0.1', revisionId: 'revision:fixture-01', snapshotSha256: HASH_A },
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadOperationsCandidateIdentity(fetchImpl)).resolves.toEqual(IDENTITY);
    expect(fetchImpl).toHaveBeenCalledWith('/api/candidate', { headers: { Accept: 'application/json' } });
  });

  it('rejects a display document that conflicts with the canonical release identity', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      candidate: { id: 'candidate:0.2', version: '0.2', payloadHash: HASH_C },
      document: { revisionId: 'revision:fixture-02' },
      releaseIdentity: { schemaVersion: 'caddydaddy.release-identity/1', candidateId: 'candidate:0.1', candidateVersion: '0.1', revisionId: 'revision:fixture-01', snapshotSha256: HASH_A },
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadOperationsCandidateIdentity(fetchImpl)).rejects.toMatchObject({ code: 'CANDIDATE_IDENTITY_CONFLICT' });
  });

  it('posts candidate-bound sourcing requests and retains last-valid evidence after a stale response', async () => {
    let stale = false;
    const fetchImpl = vi.fn(async (_path: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.candidate).toEqual(IDENTITY);
      const candidate = stale ? { ...IDENTITY, revision_id: 'revision:stale' } : IDENTITY;
      return new Response(JSON.stringify({ ...envelope('sourcing', { round }), candidate }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    const first = await client.createSourcingRound({ part_key: 'flight-controller', quantity: 2, mode: 'air' });
    expect(first.round.offers[0].screening_disposition).toBe('eligible-fixture');
    stale = true;
    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 2, mode: 'air' })).rejects.toMatchObject({ code: 'RESPONSE_CANDIDATE_STALE' });
    expect(client.getLastValid('sourcing')).toBe(first);
  });

  it('invokes browser fetch without binding the OperationsClient as its receiver', async () => {
    let receiver: unknown = 'not-called';
    const fetchImpl = function (this: unknown) {
      receiver = this;
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response(JSON.stringify(envelope('sourcing', { round })), { status: 200 }));
    } as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);

    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' })).resolves.toMatchObject({ round });
    expect(receiver).toBeUndefined();
  });

  it('requires byte-reread package seals and a zero-network STAGED dispatch', async () => {
    const fetchImpl = vi.fn(async (path: string | URL | Request) => {
      if (String(path).endsWith('/packages')) return new Response(JSON.stringify(envelope('sourcing', { status: 'PACKAGED', package: { round_id: 'round:fixture', payload_file: `payload-${HASH_A}.json`, payload_sha256: HASH_A, payload_bytes: 10, manifest_file: `manifest-${HASH_B}.json`, manifest_sha256: HASH_B, corpus_sha256: HASH_C, dispatch_ceiling: 'STAGED_ONLY', byte_reread_verified: true } })), { status: 200 });
      return new Response(JSON.stringify(envelope('sourcing', { status: 'STAGED', dispatch: { dispatch_id: 'staged:fixture', idempotency_key: 'same-key', manifest_sha256: HASH_B, external_send: false, network_calls: 0 } })), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    const pkg = await client.buildSourcingPackage('round:fixture');
    expect(pkg.package.byte_reread_verified).toBe(true);
    const dispatch = await client.stageSourcingDispatch('round:fixture', pkg.package.manifest_sha256, 'same-key');
    expect(dispatch.status).toBe('STAGED');
    expect(dispatch.dispatch).toMatchObject({ external_send: false, network_calls: 0, idempotency_key: 'same-key' });
  });

  it('rejects dispatch-looking status even when zero-network fields are present', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope('sourcing', { status: 'DISPATCHED', dispatch: { dispatch_id: 'staged:fixture', idempotency_key: 'same-key', manifest_sha256: HASH_B, external_send: false, network_calls: 0 } })), { status: 200 })) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    await expect(client.stageSourcingDispatch('round:fixture', HASH_B, 'same-key')).rejects.toMatchObject({ code: 'SOURCING_DISPATCH_INVALID' });
  });

  it('validates provenance document hashes and exact-span receipts', async () => {
    const document = { document_id: 'gx220-vendor-page', title: 'GX fixture', host: 'example.test', retrieved_at: '2026-09-04T00:00:00Z', sha256: HASH_B, bytes: 9, text_with_quarantine: '0.3 deg/h', quarantined_ranges: [], network: { performed: false, mode: 'committed-fixture-only' } };
    const fetchImpl = vi.fn(async (path: string | URL | Request) => {
      if (String(path).endsWith('/inspect')) return new Response(JSON.stringify(envelope('provenance', { status: 'INSPECTABLE', document })), { status: 200 });
      return new Response(JSON.stringify(envelope('provenance', { status: 'VERIFIED_FIXTURE_SPAN', verification: { candidate: IDENTITY, document_id: 'gx220-vendor-page', source_sha256: HASH_B, start: 0, end: 9, quote_sha256: HASH_A, field: 'gyro_bias_stability', value: 0.3, unit: 'deg/h', byte_reread_verified: true, poison_intersection: false, receipt_sha256: HASH_C } })), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    await expect(client.inspectSource('gx220-vendor-page')).resolves.toMatchObject({ document: { sha256: HASH_B } });
    await expect(client.verifySourceSpan({ document_id: 'gx220-vendor-page', source_sha256: HASH_B, start: 0, end: 9, quote: '0.3 deg/h', field: 'gyro_bias_stability', value: 0.3, unit: 'deg/h' })).resolves.toMatchObject({ verification: { byte_reread_verified: true } });
  });

  it('rejects malformed service hashes without replacing last-valid data', async () => {
    let malformed = false;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope('sourcing', malformed ? { round, corpus: { corpus_sha256: 'not-a-hash' } } : { round })), { status: 200 })) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    const first = await client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' });
    malformed = true;
    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' })).rejects.toBeInstanceOf(OperationsServiceError);
    expect(client.getLastValid('sourcing')).toBe(first);
  });

  it('surfaces a structured service rejection instead of misclassifying it as unreachable', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope('provenance', {
      status: 'REJECTED',
      diagnostic: { code: 'STALE_CANDIDATE', message: 'Request candidate identity does not match the active immutable candidate.' },
    })), { status: 409 })) as unknown as typeof fetch;
    const client = new OperationsClient(IDENTITY, fetchImpl);
    await expect(client.inspectSource('gx220-vendor-page')).rejects.toMatchObject({
      code: 'STALE_CANDIDATE',
      status: 409,
    });
  });
});
