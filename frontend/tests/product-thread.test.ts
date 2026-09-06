import { beforeEach, describe, expect, it } from 'vitest';
import {
  PRODUCT_ID,
  PRODUCT_THREAD_DURABILITY,
  PRODUCT_THREAD_ID,
  PRODUCT_THREAD_SIGNATURE,
  appendProductEvent,
  getProductThreadSnapshot,
  productArtifactGate,
  rederiveProductThread,
  registerProductArtifacts,
  resetProductThreadForTests,
  tamperProductThread,
} from '../src/lib/product-thread';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

describe('shared product revision thread', () => {
  beforeEach(() => resetProductThreadForTests());

  it('creates stable, serialized, hash-linked envelopes with explicit memory/signature boundaries', async () => {
    await Promise.all([
      appendProductEvent({ sourceLane: 'sources', eventType: 'source.accepted', summary: 'accepted', actorId: 'operator:test', actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: 'rev:1', artifacts: [{ artifactId: 'source:1', kind: 'source-document', sha256: A }], timestamp: '2026-09-06T12:00:00.000Z' }),
      appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'undetermined', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', revisionId: 'rev:1', artifacts: [{ artifactId: 'pack:1', kind: 'classification-reference-pack', sha256: B }], timestamp: '2026-09-06T12:00:01.000Z' }),
    ]);
    const current = getProductThreadSnapshot();
    expect(current.events).toHaveLength(2);
    expect(current.events[0]).toMatchObject({ productId: PRODUCT_ID, threadId: PRODUCT_THREAD_ID, sequence: 1, previousHash: null, durabilityBoundary: PRODUCT_THREAD_DURABILITY, signatureBoundary: PRODUCT_THREAD_SIGNATURE });
    expect(current.events[1].previousHash).toBe(current.events[0].eventHash);
    expect(current.events.every((event) => /^[a-f0-9]{64}$/.test(event.eventHash))).toBe(true);
    await expect(rederiveProductThread()).resolves.toMatchObject({ status: 'VALID_MEMORY_ONLY', chainValid: true, projectionMatches: true, eventCount: 2, untrackedCount: 0 });
  });

  it('requires exact CAD, artifact-manifest, and BOM hashes before package binding', async () => {
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });
    await registerProductArtifacts({ revisionId: 'cad-rev:7', cadArtifactSha256: A, artifactManifestSha256: B, bomCsvArtifactSha256: C, actorId: 'operator:test', registeredAt: '2026-09-06T12:00:00.000Z' });
    const current = getProductThreadSnapshot();
    expect(productArtifactGate(current.artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
    expect(current.events[0].artifacts.map((artifact) => artifact.kind)).toEqual(['cad-geometry', 'cad-artifact-manifest', 'BOM_CSV_ARTIFACT_SHA256']);
    expect(current.artifactBinding).toMatchObject({ bomCsvArtifactSha256: C, semanticBomDigest: 'NOT_PROVIDED' });
  });

  it('replays every recorded lane, refuses completeness with untracked legacy events, and detects tampering', async () => {
    for (const lane of ['sources', 'classification', 'sourcing', 'order', 'receipt'] as const) {
      await appendProductEvent({ sourceLane: lane, eventType: `${lane}.recorded`, summary: lane, actorId: 'actor:test', actorAttestation: 'SYSTEM_OBSERVED', timestamp: `2026-09-06T12:00:0${getProductThreadSnapshot().events.length}.000Z` });
    }
    const incomplete = await rederiveProductThread(3);
    expect(incomplete.status).toBe('INCOMPLETE_UNTRACKED');
    expect(Object.keys(incomplete.lanes).sort()).toEqual(['classification', 'order', 'receipt', 'sources', 'sourcing']);
    expect(tamperProductThread(3)).toBe(true);
    await expect(rederiveProductThread(3)).resolves.toMatchObject({ status: 'BROKEN', chainValid: false, firstBrokenSequence: 3 });
  });
});
