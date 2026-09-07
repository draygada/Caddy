import { describe, expect, it, vi } from 'vitest';
import {
  OperationsClient,
  OperationsServiceError,
  utf8ByteSpan,
  type LiveSourcingOffer,
  type OperationsCandidateIdentity,
  type UserProvidedSource,
} from '../src/lib/operations-client';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const candidate: OperationsCandidateIdentity = {
  candidate_id: 'candidate:0.2',
  revision_id: 'revision:continuity',
  snapshot_sha256: HASH_A,
};

const envelope = (domain: 'sourcing' | 'provenance', body: Record<string, unknown>, seal = HASH_B) => ({
  schema_version: `caddydaddy.${domain}-service/1`,
  status: 'READY',
  candidate,
  source_hashes: { source: HASH_C },
  corpus: { corpus_sha256: HASH_B },
  claim_ceiling: 'BOUNDED_ONLY',
  limitations: ['No broad corpus, clearance, or external effect.'],
  state: {
    schema_version: `caddydaddy.${domain}-state/1`,
    candidate,
    seal_sha256: seal,
    opaque: body.stateTag ?? 'state',
  },
  ...body,
});

const offer = {
  offer_id: 'offer:user:one',
  part_key: 'flight-controller',
  seller: 'Local Supplier',
  manufacturer: 'Local Maker',
  origin: 'US',
  ship_from: 'US',
  unit_price_usd: '100.00',
  lead_days: 4,
  declared_hts: '8542.31',
  declared_eccn: 'not-independently-verified',
  screening_disposition: 'eligible-bounded',
  ownership_walk: {
    seller: { name: 'Local Supplier', pct: null, screening: { result: 'no-candidate-match' }, owners: [] },
    manufacturer: { name: 'Local Maker', pct: null, screening: { result: 'no-candidate-match' }, owners: [] },
  },
  landed_cost: {
    rows: [{ layer: 'goods', amount_usd: '100.00', source: 'user-provided offer' }],
    total_usd: '100.00',
    per_unit_usd: '100.00',
    assumptions: 'bounded',
  },
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('operations client-carried continuity', () => {
  it('carries sourcing state into a follow-up and starts a new round without stale state', async () => {
    const firstState = { schema_version: 'caddydaddy.sourcing-state/1', candidate, seal_sha256: HASH_B, opaque: 'round-1' };
    const requests: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) {
        return jsonResponse(envelope('sourcing', {
          state: firstState,
          round: { round_id: 'round:one', request: {}, offers: [offer], selected_offer_id: null, events: [{ event_type: 'ROUND_CREATED', event_sha256: HASH_A }] },
        }));
      }
      return jsonResponse(envelope('sourcing', {
        status: 'SELECTED',
        stateTag: 'round-2',
        round_id: 'round:one',
        selected_offer: offer,
        offers: [offer],
        audit_events: [{ event_type: 'OFFER_SELECTED', event_sha256: HASH_A }],
      }));
    });
    const client = new OperationsClient(candidate, fetchMock as typeof fetch);
    const evidence = {
      status: 'NO_CANDIDATE_MATCH' as const,
      source_name: 'operator export',
      source_text: 'bounded result',
      checked_at: '2026-09-05T18:00:00Z',
      attestor: 'operator:test',
      complete: true,
    };
    const liveOffer: LiveSourcingOffer = {
      offer_id: 'offer:user:one',
      part_key: 'flight-controller',
      seller: 'Local Supplier',
      manufacturer: 'Local Maker',
      origin: 'US',
      ship_from: 'US',
      unit_price_usd: '100.00',
      lead_days: 4,
      declared_hts: '8542.31',
      declared_eccn: 'not-independently-verified',
      screening_evidence: { seller: evidence, manufacturer: evidence, ownership_complete: true },
    };

    await client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air', input_mode: 'live-bounded', offers: [liveOffer] });
    await client.selectSourcingOffer('round:one', 'offer:user:one');

    expect(requests[0]).not.toHaveProperty('state');
    expect(requests[0]).toMatchObject({ input_mode: 'live-bounded', offers: [{ seller: 'Local Supplier' }] });
    expect(requests[1].state).toEqual(firstState);
    expect(client.getCarriedState('sourcing')).toMatchObject({ schema_version: 'caddydaddy.sourcing-state/1' });
  });

  it('carries exact user-source state into verification', async () => {
    const firstState = { schema_version: 'caddydaddy.provenance-state/1', candidate, seal_sha256: HASH_B, opaque: 'source-1' };
    const requests: Array<Record<string, unknown>> = [];
    const source: UserProvidedSource = {
      document_id: 'operator-source-1',
      title: 'Operator source',
      host: 'local-input',
      retrieved_at: '2026-09-05T18:00:00Z',
      provided_by: 'operator:test',
      text: 'Prefix µ measurement 4 hours.',
    };
    const sourceHash = HASH_C;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) {
        return jsonResponse(envelope('provenance', {
          state: firstState,
          source_hashes: { 'operator-source-1': sourceHash },
          document: {
            document_id: 'operator-source-1',
            title: source.title,
            host: source.host,
            retrieved_at: source.retrieved_at,
            sha256: sourceHash,
            bytes: 30,
            text_with_quarantine: source.text,
            quarantined_ranges: [],
            network: { performed: false, mode: 'user-provided-no-fetch' },
          },
        }));
      }
      return jsonResponse(envelope('provenance', {
        status: 'VERIFIED_USER_SOURCE_SPAN',
        source_hashes: { 'operator-source-1': sourceHash },
        verification: {
          candidate,
          document_id: 'operator-source-1',
          source_sha256: sourceHash,
          start: 22,
          end: 29,
          quote_sha256: HASH_A,
          field: 'endurance',
          value: 4,
          unit: 'hours',
          byte_reread_verified: true,
          poison_intersection: false,
          receipt_sha256: HASH_B,
        },
      }));
    });
    const client = new OperationsClient(candidate, fetchMock as typeof fetch);
    await client.inspectSource(source);
    const span = utf8ByteSpan(source.text, '4 hours');
    expect(span).toEqual({ start: 22, end: 29 });
    await client.verifySourceSpan({ document_id: source.document_id, source_sha256: sourceHash, ...span!, quote: '4 hours', field: 'endurance', value: 4, unit: 'hours' });

    expect(requests[0]).toMatchObject({ source: { document_id: 'operator-source-1', text: source.text } });
    expect(requests[1].state).toEqual(firstState);
  });

  it('rejects a malformed returned continuity seal without replacing evidence', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(envelope('sourcing', {
      state: { schema_version: 'caddydaddy.sourcing-state/1', candidate, seal_sha256: 'tampered' },
      round: { round_id: 'round:one', request: {}, offers: [offer], selected_offer_id: null, events: [] },
    })));
    const client = new OperationsClient(candidate, fetchMock as typeof fetch);
    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' })).rejects.toMatchObject<Partial<OperationsServiceError>>({ code: 'RESPONSE_STATE_INVALID' });
    expect(client.getLastValid('sourcing')).toBeNull();
  });

  it('carries a candidate-bound resealed state from a 409 rejection into the next request', async () => {
    const blockedState = { schema_version: 'caddydaddy.sourcing-state/1', candidate, seal_sha256: HASH_B, opaque: 'blocked-event-recorded' };
    const requests: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) return jsonResponse(envelope('sourcing', { state: blockedState, status: 'REJECTED', diagnostic: { code: 'OFFER_BLOCKED', message: 'The offer remains blocked.' } }), 409);
      return jsonResponse(envelope('sourcing', { status: 'SELECTED', round_id: 'round:one', selected_offer: offer, offers: [offer], audit_events: [{ event_type: 'OFFER_SELECTED', event_sha256: HASH_A }] }));
    });
    const client = new OperationsClient(candidate, fetchMock as typeof fetch);

    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' })).rejects.toMatchObject({ code: 'OFFER_BLOCKED', status: 409 });
    expect(client.getCarriedState('sourcing')).toEqual(blockedState);
    await client.selectSourcingOffer('round:one', 'offer:user:one');
    expect(requests[1].state).toEqual(blockedState);
  });

  it('rejects malformed state attached to a 409 instead of poisoning continuity', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(envelope('sourcing', {
      state: { schema_version: 'caddydaddy.sourcing-state/1', candidate, seal_sha256: 'tampered' },
      status: 'REJECTED',
      diagnostic: { code: 'OFFER_BLOCKED', message: 'The offer remains blocked.' },
    }), 409));
    const client = new OperationsClient(candidate, fetchMock as typeof fetch);

    await expect(client.createSourcingRound({ part_key: 'flight-controller', quantity: 1, mode: 'air' })).rejects.toMatchObject({ code: 'RESPONSE_STATE_INVALID' });
    expect(client.getCarriedState('sourcing')).toBeNull();
  });
});
