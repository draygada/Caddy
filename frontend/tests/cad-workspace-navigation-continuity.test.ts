import { afterEach, describe, expect, it } from 'vitest';
import {
  applyCadIntent,
  createCadAuthoringState,
  createCadDocument,
  createFeatureOperation,
  createSketchOperation,
  type CadSketch,
} from '../src/cad';
import { exportCurrentCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';
import type { CadNativeEnvelope, CadOutputBundle } from '../src/cad/output-client';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import {
  rememberAuthoringWorkspaceSession,
  resetAuthoringWorkspaceSessionForTests,
  restoreAuthoringWorkspaceSession,
} from '../src/panels/AuthoringWorkspace';

function sketch(id: string, kind: 'rectangle' | 'circle'): CadSketch {
  return {
    id,
    name: id,
    plane: { kind: 'origin', plane: 'XY' },
    entities: kind === 'rectangle'
      ? [{ id: `${id}:rectangle`, kind, construction: false, origin: { x: 0, y: 0 }, width: 20, height: 10 }]
      : [{ id: `${id}:circle`, kind, construction: false, center: { x: 30, y: 5 }, radius: 4 }],
    dimensions: [],
    constraints: [],
    solverState: 'unresolved',
  };
}

async function authoredTwoBodyState() {
  let document = createCadDocument('Navigation continuity', 'document:navigation-continuity');
  const rectangleSketch = createSketchOperation(sketch('sketch:rectangle', 'rectangle'), 'operation:sketch-rectangle');
  let response = await recomputeCadInBrowser({ document: applyCadIntent(document, rectangleSketch), operation: rectangleSketch, expectedRevisionId: document.revisionId });
  const rectangleExtrude = createFeatureOperation({ id: 'operation:extrude-rectangle', kind: 'feature.extrude', name: 'Rectangle', inputIds: ['sketch:rectangle'], outputBodyName: 'Rectangle', parameters: { distance: 5 } });
  response = await recomputeCadInBrowser({ document: applyCadIntent(response.document, rectangleExtrude), operation: rectangleExtrude, expectedRevisionId: response.revisionId });
  const circleSketch = createSketchOperation(sketch('sketch:circle', 'circle'), 'operation:sketch-circle');
  response = await recomputeCadInBrowser({ document: applyCadIntent(response.document, circleSketch), operation: circleSketch, expectedRevisionId: response.revisionId });
  const circleExtrude = createFeatureOperation({ id: 'operation:extrude-circle', kind: 'feature.extrude', name: 'Circle', inputIds: ['sketch:circle'], outputBodyName: 'Circle', parameters: { distance: 3 } });
  response = await recomputeCadInBrowser({ document: applyCadIntent(response.document, circleExtrude), operation: circleExtrude, expectedRevisionId: response.revisionId });
  const state = {
    ...createCadAuthoringState(response.document),
    lastValidDocument: response.document,
    lastValidMesh: response.mesh,
    dependencyGraph: response.dependencyGraph,
    diagnostics: response.diagnostics,
    kernel: response.kernel,
    selectedId: response.document.bodies[1].id,
  };
  return { response, state, stl: await exportCurrentCadInBrowser(response.document) };
}

afterEach(() => resetAuthoringWorkspaceSessionForTests());

describe('CAD workspace navigation continuity', () => {
  it('restores the accepted two-body revision, mesh, selection, and sealed identities after a simulated remount', async () => {
    const { response, state, stl } = await authoredTwoBodyState();
    const sealedArtifact = { path: 'document/native.caddy.json', kind: 'NATIVE_DOCUMENT', source: 'NATIVE', media_type: 'application/json', size_bytes: 2, sha256: 'a'.repeat(64), data_base64: 'e30=', verification: 'REREAD_SHA256_BEFORE_RESPONSE' as const };
    const nativeEnvelope = { document: { revision_id: `native-rev:${'b'.repeat(64)}`, document_hash: 'b'.repeat(64) }, artifact: sealedArtifact } as unknown as CadNativeEnvelope;
    const outputBundle = { document_identity: { source_authoring_revision_id: response.revisionId }, package: { manifest_file_sha256: 'c'.repeat(64) } } as unknown as CadOutputBundle;

    rememberAuthoringWorkspaceSession({
      state,
      nativeEnvelope,
      sealedSnapshotArtifact: sealedArtifact,
      outputBundle,
      outputMessage: 'Outputs sealed for this revision.',
      outputError: null,
      kernelArtifacts: [stl],
      preferredSketchId: 'sketch:circle',
    });

    const remounted = restoreAuthoringWorkspaceSession();
    expect(remounted?.state.lastValidDocument.revisionId).toBe(response.revisionId);
    expect(remounted?.state.lastValidDocument.bodies).toHaveLength(2);
    expect(remounted?.state.lastValidMesh?.triangles).toHaveLength(response.mesh.triangles.length);
    expect(remounted?.state.selectedId).toBe(response.document.bodies[1].id);
    expect(remounted?.nativeEnvelope).toBe(nativeEnvelope);
    expect(remounted?.sealedSnapshotArtifact).toBe(sealedArtifact);
    expect(remounted?.outputBundle).toBe(outputBundle);
    expect(remounted?.kernelArtifacts).toEqual([stl]);
    expect(remounted?.preferredSketchId).toBe('sketch:circle');
  });

  it('wires module-session restoration into remount while retaining an explicit test-document override', () => {
    expect(authoringSource).toContain('const restoredSession = useRef(initialDocument ? null : restoreAuthoringWorkspaceSession()).current');
    expect(authoringSource).toContain('if (initialDocument) return;');
    expect(authoringSource).toContain('rememberAuthoringWorkspaceSession({');
    expect(restoreAuthoringWorkspaceSession()).toBeNull();
  });
});
