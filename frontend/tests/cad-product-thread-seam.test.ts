import { beforeEach, describe, expect, it } from 'vitest';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import {
  getProductThreadSnapshot,
  productArtifactGate,
  registerProductCadRevision,
  registerProductOutputs,
  resetProductThreadForTests,
} from '../src/lib/product-thread';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const D = 'd'.repeat(64);
const E = 'e'.repeat(64);
const F = 'f'.repeat(64);

function outputs(revisionId: string, documentSha256: string, geometrySha256: string) {
  return {
    sourceDocumentId: 'cad-document:demo',
    sourceRevisionId: revisionId,
    sourceDocumentSha256: documentSha256,
    sourceGeometrySha256: geometrySha256,
    outputDocumentId: 'native-document:demo',
    outputRevisionId: `native:${revisionId}`,
    outputDocumentSha256: F,
    artifactManifestSha256: C,
    bomSha256: D,
    artifacts: [
      { artifactId: `cad-output:package:${revisionId}:manifest.json`, kind: 'SEALED_MANIFEST', sha256: C },
      { artifactId: `cad-output:package:${revisionId}:bom.csv`, kind: 'BOM_CSV', sha256: D },
      { artifactId: `cad-output:package:${revisionId}:model.stl`, kind: 'STL', sha256: E },
    ],
    actorId: 'operator:test',
  };
}

describe('CAD to shared product-thread seam', () => {
  beforeEach(() => resetProductThreadForTests());

  it('admits only matching current outputs and re-blocks downstream progression after a newer CAD revision', async () => {
    await registerProductCadRevision({ documentId: 'cad-document:demo', revisionId: 'cad-rev:1', documentSha256: A, geometrySha256: B, actorId: 'operator:test' });
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });

    await expect(registerProductOutputs(outputs('cad-rev:stale', A, B))).rejects.toThrow('stale or do not match');
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding).ready).toBe(false);

    await registerProductOutputs(outputs('cad-rev:1', A, B));
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
    expect(getProductThreadSnapshot().events.map((event) => event.eventType)).toEqual(['cad.recompute_accepted', 'cad.outputs_registered']);

    await registerProductCadRevision({ documentId: 'cad-document:demo', revisionId: 'cad-rev:2', documentSha256: E, geometrySha256: F, actorId: 'operator:test' });
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });
    await expect(registerProductOutputs(outputs('cad-rev:1', A, B))).rejects.toThrow('stale or do not match');

    await registerProductOutputs(outputs('cad-rev:2', E, F));
    const finalSnapshot = getProductThreadSnapshot();
    expect(productArtifactGate(finalSnapshot.artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
    expect(finalSnapshot.artifactBinding).toMatchObject({ revisionId: 'cad-rev:2', cadArtifactSha256: F, artifactManifestSha256: C, bomSha256: D });
    expect(finalSnapshot.events.at(-1)?.artifacts.map((artifact) => artifact.artifactId)).toContain('cad-output:package:cad-rev:2:model.stl');
  });

  it('wires accepted recomputes and successful current-revision packages without stale fallback registration', () => {
    expect(authoringSource).toContain('await registerAcceptedCad(response, operation.id)');
    expect(authoringSource).toContain("state.status === 'failed' || state.status === 'stale'");
    expect(authoringSource).toContain('await registerProductOutputs({');
    expect(authoringSource.indexOf('const bundle = await generateCadOutputs')).toBeLessThan(authoringSource.indexOf('await registerProductOutputs({'));
    expect(authoringSource.indexOf('await registerProductOutputs({')).toBeLessThan(authoringSource.indexOf('setOutputBundle(bundle)'));
  });
});
