import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCadIntent,
  createCadDocument,
  createFeatureOperation,
  createSketchOperation,
  type CadRecomputeResponse,
  type CadSketch,
} from '../src/cad';
import { exportCurrentCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';
import {
  CAD_OUTPUT_LIMITATIONS,
  createNativeDocumentDraft,
  generateCadOutputs,
  type CadOutputArtifact,
  type CadOutputBundle,
} from '../src/cad/output-client';
import { productCadRevisionRegistration, productOutputRegistration } from '../src/panels/AuthoringWorkspace';
import {
  canonicalProductSha256,
  getProductThreadSnapshot,
  productArtifactGate,
  registerProductCadRevision,
  registerProductOutputs,
  resetProductThreadForTests,
} from '../src/lib/product-thread';

function sketch(id: string, kind: 'rectangle' | 'circle'): CadSketch {
  return {
    id,
    name: kind === 'rectangle' ? 'Plate' : 'Boss',
    plane: { kind: 'origin', plane: 'XY' },
    entities: kind === 'rectangle'
      ? [{ id: `${id}:rectangle`, kind, construction: false, origin: { x: 0, y: 0 }, width: 20, height: 10 }]
      : [{ id: `${id}:circle`, kind, construction: false, center: { x: 30, y: 5 }, radius: 4 }],
    dimensions: [],
    constraints: [],
    solverState: 'unresolved',
  };
}

async function digest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const result = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function artifact(path: string, kind: string, bytes: Uint8Array): Promise<CadOutputArtifact> {
  return {
    path,
    kind,
    source: 'DERIVED',
    media_type: path.endsWith('.json') ? 'application/json' : path.endsWith('.stl') ? 'model/stl' : 'text/plain',
    size_bytes: bytes.byteLength,
    sha256: await digest(bytes),
    data_base64: base64(bytes),
    verification: 'REREAD_SHA256_BEFORE_RESPONSE',
  };
}

async function generatedPackage(response: CadRecomputeResponse, marker: string): Promise<CadOutputBundle> {
  const exportedStl = await exportCurrentCadInBrowser(response.document);
  const packageId = `mfgpkg:${marker.repeat(64)}`;
  const packageArtifacts = [
    await artifact('bom.csv', 'BOM_CSV', new TextEncoder().encode(`part,revision\nPlate,${response.revisionId}\n`)),
    await artifact('model.stl', 'STL', Uint8Array.from(atob(exportedStl.dataBase64), (value) => value.charCodeAt(0))),
  ];
  for (let index = 0; index < 6; index += 1) {
    packageArtifacts.push(await artifact(`drawings/view-${index}.svg`, 'ORTHOGRAPHIC_SVG', new TextEncoder().encode(`<svg data-view="${index}"/>`)));
  }
  const manifest = await artifact('manifest.json', 'SEALED_MANIFEST', new TextEncoder().encode(JSON.stringify({ schema_version: 'caddydaddy.manufacturing-package/1', package_id: packageId })));
  const detached = await artifact('manifest.sha256', 'DETACHED_MANIFEST_HASH', new TextEncoder().encode(`${manifest.sha256}  manifest.json\n`));
  const allArtifacts = [...packageArtifacts, manifest, detached];
  const nativeDraft = await createNativeDocumentDraft(response.document, response.mesh);
  const nativeHash = await digest(new TextEncoder().encode(JSON.stringify(nativeDraft)));
  const nativeDocument = { ...nativeDraft, revision_id: `native-revision:${nativeHash}`, document_hash: nativeHash };
  const payload = {
    schema_version: 'caddydaddy.cad-output-api/1',
    status: 'VALID',
    document_identity: {
      document_id: nativeDocument.document_id,
      revision_id: nativeDocument.revision_id,
      document_hash: nativeDocument.document_hash,
      source_authoring_revision_id: response.revisionId,
    },
    package: {
      schema_version: 'caddydaddy.manufacturing-package/1',
      package_id: packageId,
      revision_id: nativeDocument.revision_id,
      document_hash: nativeDocument.document_hash,
      artifacts: packageArtifacts.map(({ data_base64: _data, ...item }) => ({ ...item, verification: 'REREAD_SHA256_BEFORE_SEAL' })),
      limitations: [...CAD_OUTPUT_LIMITATIONS],
      seal: { algorithm: 'SHA-256', payload_sha256: marker.repeat(64), artifact_verification: 'REREAD_BYTES_BEFORE_SEAL' },
      manifest_file_sha256: manifest.sha256,
    },
    artifacts: allArtifacts,
    limitations: [...CAD_OUTPUT_LIMITATIONS],
    claim_ceiling: 'Synthetic package used to exercise the production browser registration shape.',
  };
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
  return generateCadOutputs({ document: nativeDocument, mesh: response.mesh, kernelArtifacts: [exportedStl] }, fetchImpl);
}

async function accept(response: CadRecomputeResponse, operationId: string) {
  await registerProductCadRevision(productCadRevisionRegistration(response, operationId));
  return getProductThreadSnapshot().currentCadRevision!;
}

describe('live browser CAD product-thread registration', () => {
  beforeEach(() => resetProductThreadForTests());

  it('canonicalizes real JSCAD identities, invalidates old outputs, and unlocks only an exact generated package', async () => {
    const base = createCadDocument('Live registration', 'document:live-registration');
    const rectangle = createSketchOperation(sketch('sketch:rectangle', 'rectangle'), 'operation:rectangle');
    const rectangleResponse = await recomputeCadInBrowser({ document: applyCadIntent(base, rectangle), operation: rectangle, expectedRevisionId: base.revisionId });

    expect(rectangleResponse.mesh.triangles).toHaveLength(0);
    expect(rectangleResponse.documentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    await accept(rectangleResponse, rectangle.id);
    expect(getProductThreadSnapshot().currentCadRevision).toMatchObject({
      documentSha256: rectangleResponse.documentHash.slice(7),
      geometrySha256: rectangleResponse.kernel.artifactHash.slice(7),
    });
    expect(getProductThreadSnapshot().events[0].artifacts.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);

    const extrude = createFeatureOperation({ id: 'operation:extrude-rectangle', kind: 'feature.extrude', name: 'Extrude plate', inputIds: ['sketch:rectangle'], outputBodyName: 'Plate', parameters: { distance: 5 } });
    const extrudeResponse = await recomputeCadInBrowser({ document: applyCadIntent(rectangleResponse.document, extrude), operation: extrude, expectedRevisionId: rectangleResponse.revisionId });
    const acceptedExtrusion = await accept(extrudeResponse, extrude.id);
    expect(extrudeResponse.document.bodies).toHaveLength(1);
    expect(extrudeResponse.mesh.triangles).toHaveLength(12);

    const firstPackage = await generatedPackage(extrudeResponse, 'a');
    await registerProductOutputs(productOutputRegistration(firstPackage, acceptedExtrusion));
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
    expect(getProductThreadSnapshot().events.at(-1)?.artifacts.some((item) => item.artifactId.endsWith(':model.stl'))).toBe(true);

    const circle = createSketchOperation(sketch('sketch:circle', 'circle'), 'operation:circle');
    const circleResponse = await recomputeCadInBrowser({ document: applyCadIntent(extrudeResponse.document, circle), operation: circle, expectedRevisionId: extrudeResponse.revisionId });
    await accept(circleResponse, circle.id);
    expect(circleResponse.document.sketches.map((item) => item.id)).toEqual(['sketch:rectangle', 'sketch:circle']);
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });
    await expect(registerProductOutputs(productOutputRegistration(firstPackage, acceptedExtrusion))).rejects.toThrow('stale or do not match');

    const circleExtrude = createFeatureOperation({ id: 'operation:extrude-circle', kind: 'feature.extrude', name: 'Extrude boss', inputIds: ['sketch:circle'], outputBodyName: 'Boss', parameters: { distance: 3 } });
    const circleExtrudeResponse = await recomputeCadInBrowser({ document: applyCadIntent(circleResponse.document, circleExtrude), operation: circleExtrude, expectedRevisionId: circleResponse.revisionId });
    const acceptedCircleExtrusion = await accept(circleExtrudeResponse, circleExtrude.id);
    expect(circleExtrudeResponse.document.bodies).toHaveLength(2);
    const currentPackage = await generatedPackage(circleExtrudeResponse, 'b');
    await registerProductOutputs(productOutputRegistration(currentPackage, acceptedCircleExtrusion));
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: true, code: 'READY' });
  });

  it('keeps malformed, noncanonical, and mismatched identities blocked', async () => {
    expect(() => canonicalProductSha256(`sha256:${'A'.repeat(64)}`)).toThrow('invalid');
    expect(() => canonicalProductSha256(`digest:${'a'.repeat(64)}`)).toThrow('invalid');

    const base = createCadDocument('Mismatch', 'document:mismatch');
    const operation = createSketchOperation(sketch('sketch:mismatch', 'rectangle'), 'operation:mismatch');
    const response = await recomputeCadInBrowser({ document: applyCadIntent(base, operation), operation, expectedRevisionId: base.revisionId });
    await accept(response, operation.id);
    const extrude = createFeatureOperation({ id: 'operation:mismatch-extrude', kind: 'feature.extrude', name: 'Extrude mismatch plate', inputIds: ['sketch:mismatch'], outputBodyName: 'Plate', parameters: { distance: 2 } });
    const extrudeResponse = await recomputeCadInBrowser({ document: applyCadIntent(response.document, extrude), operation: extrude, expectedRevisionId: response.revisionId });
    const accepted = await accept(extrudeResponse, extrude.id);
    const bundle = await generatedPackage(extrudeResponse, 'c');
    expect(() => productOutputRegistration({
      ...bundle,
      document_identity: { ...bundle.document_identity, source_authoring_revision_id: 'revision:fallback' },
    }, accepted)).toThrow('do not identify the current authoring revision');
    await expect(registerProductOutputs({
      ...productOutputRegistration(bundle, accepted),
      sourceGeometrySha256: 'd'.repeat(64),
    })).rejects.toThrow('stale or do not match');
    expect(productArtifactGate(getProductThreadSnapshot().artifactBinding)).toMatchObject({ ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS' });
  });
});
