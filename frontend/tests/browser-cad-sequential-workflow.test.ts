import { describe, expect, it, vi } from 'vitest';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import {
  applyCadIntent,
  cadAuthoringReducer,
  createCadAuthoringState,
  createCadDocument,
  createFeatureOperation,
  createSketchOperation,
  recomputeCad,
  type CadSketch,
} from '../src/cad';

const sketch: CadSketch = {
  id: 'sketch:ui-chain',
  name: 'UI chain sketch',
  plane: { kind: 'origin', plane: 'XY' },
  entities: [{ id: 'entity:ui-chain', kind: 'rectangle', construction: false, origin: { x: 0, y: 0 }, width: 12, height: 8 }],
  dimensions: [],
  constraints: [],
  solverState: 'unresolved',
};

describe('rendered browser CAD revision chain', () => {
  it('wires sticky browser execution and preserves last-valid evidence when a competing stale base is rejected', async () => {
    vi.stubGlobal('window', {});
    const unavailable = vi.fn(async () => new Response('CAD service not configured', { status: 503 })) as unknown as typeof fetch;
    const base = createCadDocument('UI chain', 'document:ui-chain');
    const sketchOperation = createSketchOperation(sketch, 'operation:ui-chain-sketch');
    const sketchResult = await recomputeCad(
      { document: applyCadIntent(base, sketchOperation), operation: sketchOperation, expectedRevisionId: base.revisionId },
      unavailable,
    );
    const extrudeOperation = createFeatureOperation({
      id: 'operation:ui-chain-extrude',
      kind: 'feature.extrude',
      name: 'UI chain extrude',
      inputIds: [sketch.id],
      outputBodyName: 'UI chain body',
      parameters: { distance: 4 },
    });
    const extrudeDraft = applyCadIntent(sketchResult.document, extrudeOperation);
    const extrudeResult = await recomputeCad(
      { document: extrudeDraft, operation: extrudeOperation, expectedRevisionId: sketchResult.revisionId },
      unavailable,
      'BROWSER_JSCAD_BOUNDED',
    );
    expect(unavailable).toHaveBeenCalledOnce();
    expect(extrudeResult.mesh.triangles.length).toBeGreaterThan(0);

    let state = createCadAuthoringState(sketchResult.document);
    state = cadAuthoringReducer(state, { type: 'stage', operation: extrudeOperation, requestId: 'request:extrude' });
    state = cadAuthoringReducer(state, { type: 'started', requestId: 'request:extrude' });
    state = cadAuthoringReducer(state, { type: 'succeeded', requestId: 'request:extrude', response: extrudeResult });
    const acceptedDocument = state.lastValidDocument;
    const acceptedMesh = state.lastValidMesh;
    const competingOperation = createFeatureOperation({
      id: 'operation:competing',
      kind: 'feature.extrude',
      name: 'Competing stale extrude',
      inputIds: [sketch.id],
      outputBodyName: 'Competing body',
      parameters: { distance: 2 },
    });
    const competingDraft = applyCadIntent(state.document, competingOperation);
    state = cadAuthoringReducer(state, { type: 'stage', operation: competingOperation, requestId: 'request:competing' });
    state = cadAuthoringReducer(state, { type: 'started', requestId: 'request:competing' });

    let staleMessage = '';
    try {
      await recomputeCad(
        { document: competingDraft, operation: competingOperation, expectedRevisionId: sketchResult.revisionId },
        unavailable,
        'BROWSER_JSCAD_BOUNDED',
      );
    } catch (error) {
      staleMessage = error instanceof Error ? error.message : 'stale';
      state = cadAuthoringReducer(state, { type: 'failed', requestId: 'request:competing', error: staleMessage, stale: true });
    }

    expect(staleMessage).toMatch(/rejected stale base/);
    expect(state.status).toBe('stale');
    expect(state.lastValidDocument).toBe(acceptedDocument);
    expect(state.lastValidMesh).toBe(acceptedMesh);
    expect(state.lastValidMesh?.triangles.length).toBeGreaterThan(0);
    expect(authoringSource).toContain("state.kernel?.engineMode === 'BROWSER_JSCAD_BOUNDED'");
    expect(authoringSource).toContain('fetchImpl, executionPreference');
  });
});
