import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_ID,
  PRODUCT_THREAD_DURABILITY,
  PRODUCT_THREAD_ID,
  PRODUCT_THREAD_SIGNATURE,
  PRODUCT_THREAD_STORAGE_KEY,
  PRODUCT_THREAD_STORAGE_SCHEMA,
  appendProductEvent,
  getProductThreadSnapshot,
  productArtifactGate,
  rederiveProductThread,
  registerProductCadRevision,
  registerProductArtifacts,
  requireClassificationProductContext,
  resetProductThreadForTests,
  restoreProductThreadFromBrowserStorage,
  tamperProductThread,
} from '../src/lib/product-thread';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

function testStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('shared product revision thread', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', testStorage());
    resetProductThreadForTests();
  });

  it('creates stable, serialized, hash-linked envelopes with explicit device-local/signature boundaries', async () => {
    await registerProductCadRevision({ documentId: 'cad-document:test', revisionId: 'rev:1', documentSha256: A, geometrySha256: B, actorId: 'operator:test', acceptedAt: '2026-09-06T11:59:59.000Z' });
    const classificationContext = requireClassificationProductContext();
    await Promise.all([
      appendProductEvent({ sourceLane: 'sources', eventType: 'source.accepted', summary: 'accepted', actorId: 'operator:test', actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: 'rev:1', artifacts: [{ artifactId: 'source:1', kind: 'source-document', sha256: A }], timestamp: '2026-09-06T12:00:00.000Z' }),
      appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'undetermined', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', revisionId: 'rev:1', artifacts: [...classificationContext.artifacts, { artifactId: 'snapshot:1', kind: 'classification-fact-snapshot', sha256: A }, { artifactId: 'pack:1', kind: 'classification-reference-pack', sha256: B }], timestamp: '2026-09-06T12:00:01.000Z' }),
    ]);
    const current = getProductThreadSnapshot();
    expect(current.events).toHaveLength(3);
    expect(current.events[0]).toMatchObject({ productId: PRODUCT_ID, threadId: PRODUCT_THREAD_ID, sequence: 1, previousHash: null, durabilityBoundary: PRODUCT_THREAD_DURABILITY, signatureBoundary: PRODUCT_THREAD_SIGNATURE });
    expect(current.events[1].previousHash).toBe(current.events[0].eventHash);
    expect(current.events.every((event) => /^[a-f0-9]{64}$/.test(event.eventHash))).toBe(true);
    await expect(rederiveProductThread()).resolves.toMatchObject({ status: 'VALID_DEVICE_LOCAL', chainValid: true, projectionMatches: true, eventCount: 3, untrackedCount: 0 });
  });

  it('rejects classification events without the active revision and all relevant hashes', async () => {
    await expect(appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'blocked', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', artifacts: [] })).rejects.toThrow('active accepted CAD revision');
    await registerProductCadRevision({ documentId: 'cad-document:test', revisionId: 'rev:required', documentSha256: A, geometrySha256: B, actorId: 'operator:test' });
    await expect(appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'blocked', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', artifacts: [] })).rejects.toThrow('require the active CAD revision');
    await expect(appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'blocked', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', revisionId: 'rev:stale', artifacts: [] })).rejects.toThrow('does not match active CAD revision');
    const context = requireClassificationProductContext();
    await expect(appendProductEvent({ sourceLane: 'classification', eventType: 'classification.recorded', summary: 'blocked', actorId: 'service:test', actorAttestation: 'SERVICE_REPORTED', revisionId: context.revisionId, artifacts: context.artifacts })).rejects.toThrow('fact-snapshot hash');
  });

  it('requires exact CAD, artifact-manifest, and BOM hashes before package binding', async () => {
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });
    await registerProductCadRevision({ documentId: 'cad-document:test', revisionId: 'cad-rev:7', documentSha256: A, geometrySha256: A, actorId: 'operator:test' });
    await registerProductArtifacts({ revisionId: 'cad-rev:7', cadArtifactSha256: A, artifactManifestSha256: B, bomCsvArtifactSha256: C, actorId: 'operator:test', registeredAt: '2026-09-06T12:00:00.000Z' });
    const current = getProductThreadSnapshot();
    expect(productArtifactGate(current.artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
    expect(current.events[1].artifacts.map((artifact) => artifact.kind)).toEqual(['cad-geometry', 'cad-artifact-manifest', 'BOM_CSV_ARTIFACT_SHA256']);
    expect(current.artifactBinding).toMatchObject({ bomCsvArtifactSha256: C, semanticBomDigest: 'NOT_PROVIDED' });
  });

  it('restores only a schema-valid device-local envelope whose hash chain still verifies', async () => {
    await registerProductCadRevision({ documentId: 'cad-document:test', revisionId: 'rev:persisted', documentSha256: A, geometrySha256: B, actorId: 'operator:test' });
    const head = getProductThreadSnapshot().events.at(-1)?.eventHash;
    expect(JSON.parse(localStorage.getItem(PRODUCT_THREAD_STORAGE_KEY) ?? '{}')).toMatchObject({ schemaVersion: PRODUCT_THREAD_STORAGE_SCHEMA, productId: PRODUCT_ID, threadId: PRODUCT_THREAD_ID });
    resetProductThreadForTests({ preserveBrowserStorage: true });
    await restoreProductThreadFromBrowserStorage();
    expect(getProductThreadSnapshot()).toMatchObject({ storageStatus: 'RESTORED_DEVICE_LOCAL', currentCadRevision: { revisionId: 'rev:persisted' } });
    expect(getProductThreadSnapshot().events.at(-1)?.eventHash).toBe(head);

    const stored = JSON.parse(localStorage.getItem(PRODUCT_THREAD_STORAGE_KEY) ?? '{}');
    stored.events[0].summary = 'tampered in storage';
    localStorage.setItem(PRODUCT_THREAD_STORAGE_KEY, JSON.stringify(stored));
    resetProductThreadForTests({ preserveBrowserStorage: true });
    await restoreProductThreadFromBrowserStorage();
    expect(getProductThreadSnapshot()).toMatchObject({ storageStatus: 'RECOVERED_EMPTY_INVALID', events: [], currentCadRevision: null });
    expect(localStorage.getItem(PRODUCT_THREAD_STORAGE_KEY)).toBeNull();
  });

  it('replays every recorded lane, refuses completeness with untracked legacy events, and detects tampering', async () => {
    await registerProductCadRevision({ documentId: 'cad-document:test', revisionId: 'rev:lanes', documentSha256: A, geometrySha256: B, actorId: 'operator:test' });
    for (const lane of ['sources', 'classification', 'sourcing', 'order', 'receipt'] as const) {
      const classificationArtifacts = lane === 'classification' ? [...requireClassificationProductContext().artifacts, { artifactId: 'snapshot:lanes', kind: 'classification-fact-snapshot', sha256: A }, { artifactId: 'pack:lanes', kind: 'classification-reference-pack', sha256: B }] : undefined;
      await appendProductEvent({ sourceLane: lane, eventType: `${lane}.recorded`, summary: lane, actorId: 'actor:test', actorAttestation: 'SYSTEM_OBSERVED', revisionId: lane === 'classification' ? 'rev:lanes' : undefined, artifacts: classificationArtifacts, timestamp: `2026-09-06T12:00:0${getProductThreadSnapshot().events.length}.000Z` });
    }
    const incomplete = await rederiveProductThread(3);
    expect(incomplete.status).toBe('INCOMPLETE_UNTRACKED');
    expect(Object.keys(incomplete.lanes).sort()).toEqual(['cad', 'classification', 'order', 'receipt', 'sources', 'sourcing']);
    expect(tamperProductThread(3)).toBe(true);
    await expect(rederiveProductThread(3)).resolves.toMatchObject({ status: 'BROKEN', chainValid: false, firstBrokenSequence: 3 });
  });
});
