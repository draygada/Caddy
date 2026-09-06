import { describe, expect, it, vi } from 'vitest';
import {
  ClassificationClientError,
  evaluateClassification,
  parseClassificationDetermination,
} from '../src/lib/classification-client';

const H = 'a'.repeat(64);

function validDetermination() {
  return {
    schema_version: 'forge-classification.determination/1',
    snapshot_sha256: H,
    pack_sha256: H,
    item: { part_revision_id: null, item_kind: 'commodity' },
    determination: {
      jurisdiction: 'EAR99', classification: ['EAR99'], usml_step: 'negative', ccl_step: 'all_knocked_out',
      basis: ['All surfaced USML and CCL candidates closed negative.'], open_candidates: [],
    },
    candidates: [{
      candidate_id: 'candidate:1', provision: 'USML XI(c)(2)', stage: 'usml_enumerated', status: 'knocked_out', origin: 'proposed',
      why_considered: 'Potential component.', why_rejected: 'A cited element was not met.',
      elements: [{
        element_id: 'element:1', unit_key: 'USML XI(c)(2)', disposition: 'not_met', basis: 'stated',
        facts_relied_on: ['declared.military_use'], citation: { unit_key: 'USML XI(c)(2)', unit_sha256: H, start: 3, end: 14, quote: 'components' },
      }],
      challenge: null, reference_notes: ['Dated public reference pack.'],
    }],
    provenance: {
      model: 'scripted',
      calls: [{ stage: 'judge', provision: 'USML XI(c)(2)', prompt_sha256: H, response_sha256: H, cost_microusd: 0 }],
      budget: { calls_cap: 12, calls_used: 1, cost_cap_microusd: 1000, cost_used_microusd: 0 },
      dropped_candidates: [{ provision: 'invalid', reason: 'Unknown provision.' }],
      reference_notes: ['Reference content date is disclosed by the pack.'],
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('classification client', () => {
  it('posts the trimmed live request and accepts every rendered contract family', async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => jsonResponse(validDetermination()));
    const result = await evaluateClassification({
      description: '  commercial flight controller  ', facts: { 'declared.military_use': 'false' }, item_kind: 'commodity',
    }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/classification/evaluate');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      description: 'commercial flight controller', facts: { 'declared.military_use': 'false' }, item_kind: 'commodity',
    });
    expect(result.schema_version).toBe('forge-classification.determination/1');
    expect(result.determination.jurisdiction).toBe('EAR99');
    expect(result.candidates[0].elements[0].citation).toMatchObject({ start: 3, end: 14, unit_sha256: H });
    expect(result.provenance).toMatchObject({ model: 'scripted', budget: { calls_used: 1 }, dropped_candidates: [{ provision: 'invalid' }] });
  });

  it('rejects a wrong response identity before it can become live evidence', () => {
    const payload = validDetermination();
    payload.schema_version = 'fixture/1';
    expect(() => parseClassificationDetermination(payload)).toThrowError(expect.objectContaining({ code: 'SCHEMA_INVALID' }));
  });

  it('rejects malformed hashes, citation spans, and EAR99 route invariants', () => {
    const badHash = validDetermination();
    badHash.snapshot_sha256 = 'not-a-hash';
    expect(() => parseClassificationDetermination(badHash)).toThrowError(ClassificationClientError);

    const badSpan = validDetermination();
    badSpan.candidates[0].elements[0].citation.end = 2;
    expect(() => parseClassificationDetermination(badSpan)).toThrowError(expect.objectContaining({ code: 'SCHEMA_INVALID' }));

    const badRoute = validDetermination();
    badRoute.determination.ccl_step = 'not_reached';
    expect(() => parseClassificationDetermination(badRoute)).toThrowError(expect.objectContaining({ code: 'SCHEMA_INVALID' }));
  });

  it('reports a policy block without manufacturing a determination', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: 'CLASSIFICATION_POLICY_BLOCKED', message: 'REAL_LLM_AUTHORIZED is unset.' } }, 403));
    await expect(evaluateClassification({ description: 'part', facts: {}, item_kind: 'commodity' }, { fetchImpl }))
      .rejects.toMatchObject({ code: 'POLICY_BLOCKED', message: 'REAL_LLM_AUTHORIZED is unset.' });
  });

  it('distinguishes schema failure, backend failure, and invalid local input', async () => {
    const invalidSchema = vi.fn(async () => jsonResponse({ schema_version: 'forge-classification.determination/1' }));
    await expect(evaluateClassification({ description: 'part', facts: {}, item_kind: 'commodity' }, { fetchImpl: invalidSchema }))
      .rejects.toMatchObject({ code: 'SCHEMA_INVALID' });

    const unavailable = vi.fn(async () => { throw new Error('connection refused'); });
    await expect(evaluateClassification({ description: 'part', facts: {}, item_kind: 'commodity' }, { fetchImpl: unavailable }))
      .rejects.toMatchObject({ code: 'BACKEND_UNAVAILABLE' });

    await expect(evaluateClassification({ description: '   ', facts: {}, item_kind: 'commodity' }))
      .rejects.toMatchObject({ code: 'REQUEST_INVALID' });
  });
});
