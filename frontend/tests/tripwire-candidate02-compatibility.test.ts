import { describe, expect, it, vi } from 'vitest';
import {
  getTripwireBinding,
  listCoreEntities,
  loadCachedCoreCandidate,
  loadCoreCandidate,
  parseCoreCandidateResponse,
} from '../src/lib/core-client';
import { getTripwireRevisionGate, runTripwire, type CandidatePayload } from '../src/lib/tripwire';

function envelope() {
  const publicSnapshot = loadCachedCoreCandidate().candidate;
  const snapshotSha256 = 'b'.repeat(64);
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
    runtimeGeometry: {
      authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
      browser: {
        availability: 'AVAILABLE',
        kernel: 'JSCAD',
        executionLocation: 'BROWSER',
        scope: 'BOUNDED_MESH_CSG_NOT_PRODUCTION_BREP',
      },
      native: {
        connection: 'DISCONNECTED',
        kernel: null,
        version: null,
        executedForThisResponse: false,
        evidence: 'PRODUCT_CORE_CAPABILITY_BLOCKED',
        reason: {
          code: 'CAD_RUNTIME_OWNER_APPROVAL_REQUIRED',
          message: 'Repository-owner approval is not recorded for the exact native runtime packet.',
        },
      },
      coreExecutedAtRuntime: false,
    },
    capabilities: { nativeOcctConnected: false },
    capabilityContracts: {
      cadAuthoring: { productionBrepKernel: false },
      liveKernelRecompute: { status: 'UNAVAILABLE_NATIVE_DISCONNECTED' },
    },
  };
}

describe('Tripwire Candidate 0.2 legacy-evidence compatibility', () => {
  it('reloads mapped FB-03 entities from independently validated legacy evidence', async () => {
    const payload = envelope();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;

    const first = await loadCoreCandidate(fetchImpl);
    const reloaded = await loadCoreCandidate(fetchImpl);
    const targets = listCoreEntities(reloaded.candidate);
    const selected = targets[0];
    const request = getTripwireBinding(reloaded.candidate, selected.entityId);

    expect(first.releaseIdentity).toEqual(reloaded.releaseIdentity);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(reloaded.releaseIdentity).toMatchObject({ candidateId: 'candidate:0.2', candidateVersion: '0.2' });
    expect(reloaded.evidenceRole).toBe('IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY');
    expect(new Set(targets.map((target) => target.bodyLabel))).toEqual(new Set(['Left bracket', 'Right bracket']));
    expect(request.entity_id).toBe(selected.entityId);
    expect(request.forge_revision_id).toBe('revision:caddydaddy-candidate-0.1');
  });

  it('validates Candidate 0.2 before nested evidence and fails closed on missing or invalid legacy authority', () => {
    const badRoot = envelope();
    badRoot.candidate.version = '0.1';
    expect(() => parseCoreCandidateResponse(badRoot)).toThrow(/Candidate 0\.2 root identity/);

    const missingEvidence = { ...envelope(), legacySnapshotEvidence: undefined };
    expect(() => parseCoreCandidateResponse(missingEvidence)).toThrow(/omitted legacySnapshotEvidence/);

    const falseAuthority = envelope();
    falseAuthority.legacySnapshotEvidence.currentCapabilityAuthority = true;
    expect(() => parseCoreCandidateResponse(falseAuthority)).toThrow(/mutable, authoritative, or detached/);

    const staleNestedRevision = envelope();
    staleNestedRevision.legacySnapshotEvidence.publicSnapshot.document.scene.revisionId = 'revision:stale';
    expect(() => parseCoreCandidateResponse(staleNestedRevision)).toThrow(/revision chain/);
  });

  it('never runs legacy Tripwire evidence against a different or unavailable active revision', async () => {
    const loaded = await loadCoreCandidate(vi.fn(async () => new Response(JSON.stringify(envelope()), { status: 200 })) as unknown as typeof fetch);
    const candidate = loaded.candidate as unknown as CandidatePayload;
    const target = listCoreEntities(loaded.candidate)[0];
    const activeRevision = loaded.releaseIdentity?.revisionId;
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    expect(getTripwireRevisionGate(candidate, activeRevision)).toMatchObject({ status: 'STALE', canCheck: false });
    expect(getTripwireRevisionGate(candidate, null)).toMatchObject({ status: 'UNAVAILABLE', canCheck: false });
    await expect(runTripwire(candidate, target.entityId, activeRevision, fetchImpl)).rejects.toMatchObject({ code: 'CURRENT_REVISION_STALE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
