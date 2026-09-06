import { describe, expect, it, vi } from 'vitest';
import {
  OperationsClient,
  loadOperationsCandidateIdentity,
  type ClientCarriedState,
  type LiveSourcingOffer,
  type OperationsCandidateIdentity,
  type UserProvidedSource,
} from '../src/lib/operations-client';

const DISPLAY_HASH = 'b'.repeat(64);
const SNAPSHOT_HASH = '8'.repeat(64);
const SOURCE_HASH = 'f'.repeat(64);
const CORPUS_HASH = '2'.repeat(64);
const RECEIPT_HASH = 'c'.repeat(64);
const MANIFEST_HASH = 'd'.repeat(64);
const PAYLOAD_HASH = 'e'.repeat(64);
const CANDIDATE: OperationsCandidateIdentity = {
  candidate_id: 'candidate:0.2',
  revision_id: 'revision:caddydaddy-candidate-0.2',
  snapshot_sha256: SNAPSHOT_HASH,
};

function state(domain: 'provenance' | 'sourcing', seal: string, marker: string): ClientCarriedState {
  return {
    schema_version: `caddydaddy.${domain}-state/1`,
    candidate: CANDIDATE,
    seal_sha256: seal,
    marker,
  };
}

function envelope(domain: 'provenance' | 'sourcing', body: Record<string, unknown>) {
  return {
    schema_version: `caddydaddy.${domain}-service/1`,
    status: 'READY',
    candidate: CANDIDATE,
    source_hashes: domain === 'provenance' ? { 'operator-source-001': SOURCE_HASH } : { screening: SOURCE_HASH },
    corpus: { corpus_sha256: CORPUS_HASH },
    claim_ceiling: 'BOUNDED_ONLY_NO_AUTHORITY_OR_EXTERNAL_EFFECT',
    limitations: ['No broad corpus, clearance, source authority, supplier contact, or production order.'],
    ...body,
  };
}

const serviceOffer = {
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
    rows: [{ layer: 'goods', amount_usd: '200.00', source: 'user-provided offer' }],
    total_usd: '200.00',
    per_unit_usd: '100.00',
    assumptions: 'modeled bounded inputs',
  },
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('deployed Candidate 0.2 operations contract', () => {
  it('pins canonical identity and byte-exact provenance and sourcing continuations', async () => {
    const provenanceStates = [state('provenance', '1'.repeat(64), 'inspected'), state('provenance', '2'.repeat(64), 'verified'), state('provenance', '3'.repeat(64), 'accepted')];
    const sourcingStates = [state('sourcing', '4'.repeat(64), 'round'), state('sourcing', '5'.repeat(64), 'selected'), state('sourcing', '6'.repeat(64), 'packaged'), state('sourcing', '7'.repeat(64), 'staged')];
    const bodies: Array<{ route: string; body: string }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const route = String(input);
      if (route === '/api/candidate') {
        return response({
          candidate: { id: 'candidate:0.2', version: '0.2', payloadHash: DISPLAY_HASH },
          document: { revisionId: CANDIDATE.revision_id },
          releaseIdentity: {
            schemaVersion: 'caddydaddy.release-identity/1',
            candidateId: CANDIDATE.candidate_id,
            candidateVersion: '0.2',
            revisionId: CANDIDATE.revision_id,
            snapshotSha256: CANDIDATE.snapshot_sha256,
          },
        });
      }
      bodies.push({ route, body: String(init?.body) });
      if (route === '/api/provenance/inspect') return response(envelope('provenance', {
        status: 'INSPECTABLE', state: provenanceStates[0], document: {
          document_id: 'operator-source-001', title: 'Operator-provided source', host: 'local-input', retrieved_at: '2026-09-06T04:00:00Z', provided_by: 'operator:browser-demo', input_mode: 'live-bounded', sha256: SOURCE_HASH, bytes: 57,
          text_with_quarantine: 'Rated endurance 4 hours under the stated test conditions.', quarantined_ranges: [], network: { performed: false, mode: 'user-provided-no-fetch' },
        },
      }));
      if (route === '/api/provenance/verify') return response(envelope('provenance', {
        status: 'VERIFIED_USER_SOURCE_SPAN', state: provenanceStates[1], verification: {
          candidate: CANDIDATE, document_id: 'operator-source-001', source_sha256: SOURCE_HASH, start: 16, end: 23, quote_sha256: PAYLOAD_HASH,
          field: 'endurance', value: 4, unit: 'hours', byte_reread_verified: true, poison_intersection: false, receipt_sha256: RECEIPT_HASH,
        },
      }));
      if (route === '/api/provenance/accept') return response(envelope('provenance', {
        status: 'ACCEPTED_FOR_LOCAL_REVIEW', state: provenanceStates[2], change: { target: 'endurance', value: 4, unit: 'hours', receipt_sha256: RECEIPT_HASH, mutated_cad: false },
      }));
      if (route === '/api/sourcing/rounds') return response(envelope('sourcing', {
        state: sourcingStates[0], round: { round_id: 'round:connected', request: {}, offers: [serviceOffer], selected_offer_id: null, events: [] },
      }));
      if (route === '/api/sourcing/selections') return response(envelope('sourcing', {
        status: 'SELECTED', state: sourcingStates[1], round_id: 'round:connected', selected_offer: serviceOffer, offers: [serviceOffer], audit_events: [],
      }));
      if (route === '/api/sourcing/packages') return response(envelope('sourcing', {
        status: 'PACKAGED', state: sourcingStates[2], package: { round_id: 'round:connected', payload_file: `payload-${PAYLOAD_HASH}.json`, payload_sha256: PAYLOAD_HASH, payload_bytes: 512, manifest_file: `manifest-${MANIFEST_HASH}.json`, manifest_sha256: MANIFEST_HASH, corpus_sha256: CORPUS_HASH, dispatch_ceiling: 'STAGED_ONLY', byte_reread_verified: true },
      }));
      if (route === '/api/sourcing/dispatches') return response(envelope('sourcing', {
        status: 'STAGED', state: sourcingStates[3], dispatch: { dispatch_id: 'staged:connected', idempotency_key: `browser-${MANIFEST_HASH}`, manifest_sha256: MANIFEST_HASH, external_send: false, network_calls: 0 },
      }));
      throw new Error(`Unexpected route ${route}`);
    }) as typeof fetch;

    const identity = await loadOperationsCandidateIdentity(fetchMock);
    expect(identity).toEqual(CANDIDATE);
    expect(identity.snapshot_sha256).not.toBe(DISPLAY_HASH);
    const client = new OperationsClient(identity, fetchMock);
    const source: UserProvidedSource = {
      document_id: 'operator-source-001', title: 'Operator-provided source', host: 'local-input', retrieved_at: '2026-09-06T04:00:00Z', provided_by: 'operator:browser-demo', text: 'Rated endurance 4 hours under the stated test conditions.',
    };
    await client.inspectSource(source);
    await client.verifySourceSpan({ document_id: source.document_id, source_sha256: SOURCE_HASH, start: 16, end: 23, quote: '4 hours', field: 'endurance', value: 4, unit: 'hours' });
    await client.acceptVerifiedChange(RECEIPT_HASH, 'endurance');

    const screening = { status: 'NO_CANDIDATE_MATCH' as const, source_name: 'operator export', source_text: 'bounded exact-name result for declared party only', checked_at: '2026-09-06T04:00:00Z', attestor: 'operator:browser-demo', complete: true };
    const liveOffer: LiveSourcingOffer = {
      offer_id: serviceOffer.offer_id, part_key: serviceOffer.part_key, seller: serviceOffer.seller, manufacturer: serviceOffer.manufacturer, origin: serviceOffer.origin, ship_from: serviceOffer.ship_from,
      unit_price_usd: serviceOffer.unit_price_usd, lead_days: serviceOffer.lead_days, declared_hts: serviceOffer.declared_hts, declared_eccn: serviceOffer.declared_eccn,
      screening_evidence: { seller: screening, manufacturer: screening, ownership_complete: true },
    };
    await client.createSourcingRound({ part_key: 'flight-controller', quantity: 2, mode: 'air', input_mode: 'live-bounded', offers: [liveOffer] });
    await client.selectSourcingOffer('round:connected', 'offer:user:one');
    await client.buildSourcingPackage('round:connected');
    await client.stageSourcingDispatch('round:connected', MANIFEST_HASH, `browser-${MANIFEST_HASH}`);

    expect(bodies).toEqual([
      { route: '/api/provenance/inspect', body: JSON.stringify({ candidate: CANDIDATE, source }) },
      { route: '/api/provenance/verify', body: JSON.stringify({ candidate: CANDIDATE, state: provenanceStates[0], document_id: source.document_id, source_sha256: SOURCE_HASH, start: 16, end: 23, quote: '4 hours', field: 'endurance', value: 4, unit: 'hours' }) },
      { route: '/api/provenance/accept', body: JSON.stringify({ candidate: CANDIDATE, state: provenanceStates[1], receipt_sha256: RECEIPT_HASH, target: 'endurance' }) },
      { route: '/api/sourcing/rounds', body: JSON.stringify({ candidate: CANDIDATE, part_key: 'flight-controller', quantity: 2, mode: 'air', input_mode: 'live-bounded', offers: [liveOffer] }) },
      { route: '/api/sourcing/selections', body: JSON.stringify({ candidate: CANDIDATE, state: sourcingStates[0], round_id: 'round:connected', offer_id: 'offer:user:one' }) },
      { route: '/api/sourcing/packages', body: JSON.stringify({ candidate: CANDIDATE, state: sourcingStates[1], round_id: 'round:connected' }) },
      { route: '/api/sourcing/dispatches', body: JSON.stringify({ candidate: CANDIDATE, state: sourcingStates[2], round_id: 'round:connected', manifest_sha256: MANIFEST_HASH, idempotency_key: `browser-${MANIFEST_HASH}` }) },
    ]);
    expect(client.getLastValid('provenance')).toMatchObject({ status: 'ACCEPTED_FOR_LOCAL_REVIEW', change: { mutated_cad: false } });
    expect(client.getLastValid('sourcing')).toMatchObject({ status: 'STAGED', dispatch: { external_send: false, network_calls: 0 } });
  });
});
