import { describe, expect, it, vi } from 'vitest';
import {
  CoreCandidateError,
  getTripwireBinding,
  listCoreEntities,
  loadCachedCoreCandidate,
  loadCoreCandidate,
  parseCoreCandidate,
} from '../src/lib/core-client';

describe('core Candidate client', () => {
  it('loads the real endpoint shape and preserves the immutable two-body graph', async () => {
    const fixture = loadCachedCoreCandidate().candidate;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(candidate02Envelope(fixture)), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    const result = await loadCoreCandidate(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith('/api/candidate', { headers: { Accept: 'application/json' } });
    expect(result.source).toBe('api');
    expect(result.warning).toBeNull();
    expect(result.releaseIdentity?.candidateId).toBe('candidate:0.2');
    expect(result.evidenceRole).toBe('IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY');
    expect(result.candidate.document.bodies.map((body) => body.label)).toEqual(['Left bracket', 'Right bracket']);
    expect(result.candidate.document.operations[0].parameterBindings).toEqual({ height: 'param:height', length: 'param:length', width: 'param:width' });
    expect(result.candidate.document.parameters.map((parameter) => `${parameter.name}=${parameter.literal}${parameter.unit}`)).toEqual(['length=24mm', 'width=12mm', 'height=4mm']);
  });

  it('returns selectable entities on both bodies and an exact, cloned Tripwire request', () => {
    const candidate = loadCachedCoreCandidate().candidate;
    const entities = listCoreEntities(candidate);
    expect(new Set(entities.map((entity) => entity.bodyLabel))).toEqual(new Set(['Left bracket', 'Right bracket']));

    const selected = entities[0];
    const request = getTripwireBinding(candidate, selected.entityId);
    expect(request).toEqual(selected.binding.request);
    expect(request).not.toBe(selected.binding.request);
    expect(Object.keys(request).sort()).toEqual([
      'entity_id',
      'forge_record_id',
      'forge_record_revision_id',
      'forge_revision_id',
      'node_id',
      'occurrence_path',
      'product_thread_id',
    ]);
    expect(request.entity_id).toBe(selected.entityId);
    expect(request.forge_revision_id).toBe(candidate.document.revisionId);
  });

  it('labels packaged recovery honestly and keeps live recompute unavailable', () => {
    const result = loadCachedCoreCandidate();
    expect(result.source).toBe('packaged-fixture');
    expect(result.warning).toContain('do not prove that /api/candidate is currently reachable');
    expect(result.candidate.snapshotProvenance.mode).toBe('PRECOMPUTED_IMMUTABLE');
    expect(result.candidate.snapshotProvenance.coreExecutedAtRuntime).toBe(false);
    expect(result.candidate.capabilities.recompute).toBe(false);
    expect(result.candidate.states.current.editable).toBe(false);
  });

  it('rejects stale revision chains and false live-recompute claims', () => {
    const stale = loadCachedCoreCandidate().candidate;
    stale.document.scene.revisionId = 'revision:stale';
    expect(() => parseCoreCandidate(stale)).toThrowError(CoreCandidateError);
    expect(() => parseCoreCandidate(stale)).toThrow(/revision chain/);

    const dishonest = loadCachedCoreCandidate().candidate;
    dishonest.capabilities.recompute = true;
    expect(() => parseCoreCandidate(dishonest)).toThrow(/falsely advertises live recompute/);
  });

  it('reports unreachable and malformed API responses without silently using the fixture', async () => {
    const unavailable = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    await expect(loadCoreCandidate(unavailable)).rejects.toMatchObject({ code: 'CORE_CANDIDATE_UNAVAILABLE' });

    const malformed = vi.fn(async () => new Response(JSON.stringify({ candidate: {} }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadCoreCandidate(malformed)).rejects.toMatchObject({ code: 'CORE_CANDIDATE_INVALID' });
  });
});

function candidate02Envelope(publicSnapshot: ReturnType<typeof loadCachedCoreCandidate>['candidate']) {
  const snapshotSha256 = 'a'.repeat(64);
  return {
    candidate: {
      id: 'candidate:0.2',
      version: '0.2',
      revisionId: 'revision:caddydaddy-candidate-0.2',
      status: 'CANDIDATE_0_2_RUNTIME',
    },
    releaseIdentity: {
      schemaVersion: 'caddydaddy.release-identity/1',
      candidateId: 'candidate:0.2',
      candidateVersion: '0.2',
      revisionId: 'revision:caddydaddy-candidate-0.2',
      snapshotSha256,
    },
    legacySnapshotEvidence: {
      role: 'IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY',
      candidateVersion: '0.1',
      revisionId: publicSnapshot.document.revisionId,
      snapshotSha256,
      immutable: true,
      currentCapabilityAuthority: false,
      publicSnapshot,
    },
  };
}
