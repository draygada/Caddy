import { describe, expect, it, vi } from 'vitest';
import { evaluateClassification } from '../src/lib/classification-client';

const H = 'b'.repeat(64);

function backendResponse(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'forge-classification.determination/1',
    snapshot_sha256: H,
    pack_sha256: H,
    item: { part_revision_id: null, item_kind: 'commodity' },
    determination: {
      jurisdiction: 'EAR99',
      classification: ['EAR99'],
      usml_step: 'negative',
      ccl_step: 'all_knocked_out',
      basis: ['USML reviewed first; all surfaced specific CCL candidates closed negative.'],
      open_candidates: [],
      ...overrides,
    },
    candidates: [],
    provenance: {
      model: 'scripted',
      calls: [],
      budget: { calls_cap: 16, calls_used: 2, cost_cap_microusd: 8_000_000, cost_used_microusd: 0 },
      dropped_candidates: [],
      reference_notes: [],
    },
  };
}

describe('live classification client/server contract', () => {
  it('sends the canonical backend path and byte-exact bounded request', async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(backendResponse()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await evaluateClassification({
      description: '  flight-control enclosure  ',
      facts: { material: '6061-T6', end_use: 'unknown' },
      item_kind: 'commodity',
    }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [path, init] = fetchImpl.mock.calls[0];
    expect(path).toBe('/api/classification');
    expect(init?.body).toBe('{"product_or_part":"flight-control enclosure","facts":{"material":"6061-T6","end_use":"unknown"},"item_kind":"commodity","budget":{"calls_cap":16,"cost_cap_microusd":8000000,"estimated_cost_microusd":250000}}');
    expect(result.determination).toMatchObject({
      jurisdiction: 'EAR99',
      usml_step: 'negative',
      ccl_step: 'all_knocked_out',
      classification: ['EAR99'],
    });
  });

  it('fails closed when a response claims EAR99 without completing ordered review', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(backendResponse({ usml_step: 'undemonstrated' })), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(evaluateClassification({
      description: 'flight-control enclosure',
      facts: {},
      item_kind: 'commodity',
    }, { fetchImpl })).rejects.toMatchObject({ code: 'SCHEMA_INVALID' });
  });

  it('surfaces the backend diagnostic while producing no determination', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      schema_version: 'caddydaddy.classification-error/1',
      status: 'BLOCKED',
      diagnostic: { code: 'CLASSIFICATION_INPUT_INVALID', message: 'classification input could not be normalized' },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));

    await expect(evaluateClassification({
      description: 'part',
      facts: {},
      item_kind: 'commodity',
    }, { fetchImpl })).rejects.toMatchObject({
      code: 'BACKEND_UNAVAILABLE',
      message: 'classification input could not be normalized',
    });
  });
});
