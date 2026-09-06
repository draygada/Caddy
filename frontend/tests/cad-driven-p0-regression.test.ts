import { describe, expect, it } from 'vitest';
import {
  applyCadIntent,
  createCadDocument,
  createFeatureOperation,
  createSketchOperation,
  type CadDocument,
  type CadOperation,
  type CadRecomputeResponse,
  type CadSketch,
} from '../src/cad';
import { exportCadInBrowser, exportCurrentCadInBrowser, importCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';
import { createNativeDocumentDraft } from '../src/cad/output-client';
import { claimCadSubmission, createSketchDraft, featureFormForKind } from '../src/panels/AuthoringWorkspace';

async function commit(document: CadDocument, operation: CadOperation): Promise<CadRecomputeResponse> {
  const draft = applyCadIntent(document, operation);
  return recomputeCadInBrowser({ document: draft, operation, expectedRevisionId: document.revisionId });
}

function circleSketch(sequence: number): CadSketch {
  const sketch = createSketchDraft(sequence);
  return {
    ...sketch,
    entities: [{ id: `${sketch.id}:circle`, kind: 'circle', construction: false, center: { x: 0, y: 0 }, radius: 6 }],
  };
}

async function rectangleThenCircle(): Promise<CadRecomputeResponse> {
  let document = createCadDocument('Driven multi-body model', 'document:driven');
  const rectangle = createSketchDraft(1);
  let result = await commit(document, createSketchOperation(rectangle, 'operation:rectangle-sketch'));
  document = result.document;
  result = await commit(document, createFeatureOperation({ id: 'operation:rectangle-extrude', kind: 'feature.extrude', name: 'Rectangle extrusion', inputIds: [rectangle.id], outputBodyName: 'Rectangle body', parameters: { distance: 10 } }));
  document = result.document;

  const circle = circleSketch(2);
  result = await commit(document, createSketchOperation(circle, 'operation:circle-sketch'));
  document = result.document;
  return commit(document, createFeatureOperation({ id: 'operation:circle-extrude', kind: 'feature.extrude', name: 'Circle extrusion', inputIds: [circle.id], outputBodyName: 'Circle body', parameters: { distance: 7 } }));
}

describe('driven CAD P0 regressions', () => {
  it('gives every committed sketch and entity a unique identity and suppresses duplicate in-flight writes', () => {
    const first = createSketchDraft(1);
    const second = createSketchDraft(2);
    expect(second.id).not.toBe(first.id);
    expect(second.entities[0].id).not.toBe(first.entities[0].id);

    const inFlight = new Set<string>();
    const release = claimCadSubmission(inFlight, 'workspace-write');
    expect(release).toBeTypeOf('function');
    expect(claimCadSubmission(inFlight, 'workspace-write')).toBeNull();
    release?.();
    expect(claimCadSubmission(inFlight, 'workspace-write')).toBeTypeOf('function');
  });

  it('resets incompatible operation fields and uses selected sketch entities as the actual input', async () => {
    const result = await rectangleThenCircle();
    const rectangle = result.document.sketches[0];
    const circle = result.document.sketches[1];
    const rectangleBody = result.document.bodies.find((body) => body.name === 'Rectangle body')!;

    const intersection = featureFormForKind('feature.boolean.intersect', rectangleBody.id, result.document, rectangle.id);
    expect(intersection).toMatchObject({ inputReferences: '', targetReferences: rectangleBody.id, outputBodyName: 'Boolean intersect result' });
    const hole = featureFormForKind('feature.hole', rectangleBody.id, result.document, circle.id);
    expect(hole).toMatchObject({ inputReferences: circle.id, targetReferences: rectangleBody.id, outputBodyName: '' });
    const revolve = featureFormForKind('feature.revolve', circle.entities[0].id, result.document, rectangle.id);
    expect(revolve).toMatchObject({ inputReferences: circle.entities[0].id, targetReferences: '', outputBodyName: 'Revolve result', numericValue: 360 });

    const line = { id: 'entity:selected-line', kind: 'line' as const, construction: false, start: { x: 0, y: 0 }, end: { x: 5, y: 0 } };
    const withLine: CadDocument = { ...result.document, sketches: result.document.sketches.map((sketch, index) => index === 1 ? { ...sketch, entities: [...sketch.entities, line] } : sketch) };
    expect(featureFormForKind('feature.extrude', line.id, withLine, rectangle.id).inputReferences).toBe(line.id);
  });

  it('extrudes successive rectangle and circle sketches into geometrically distinct bodies', async () => {
    const result = await rectangleThenCircle();
    const sketches = result.document.sketches;
    const features = result.document.operations.filter((operation) => operation.kind === 'feature.extrude');
    expect(sketches.map((sketch) => sketch.id)).toHaveLength(new Set(sketches.map((sketch) => sketch.id)).size);
    expect(features.map((feature) => feature.kind === 'feature.extrude' ? feature.inputIds[0] : null)).toEqual([sketches[0].id, sketches[1].id]);
    expect(result.document.bodies.map((body) => body.name)).toEqual(['Rectangle body', 'Circle body']);

    const rectangleBody = result.geometry!.bodies.find((body) => body.bodyId === result.document.bodies[0].id)!;
    const circleBody = result.geometry!.bodies.find((body) => body.bodyId === result.document.bodies[1].id)!;
    expect(rectangleBody.volume).toBeCloseTo(9600, 4);
    expect(circleBody.volume).not.toBeCloseTo(rectangleBody.volume, 2);
    expect(circleBody.topology.faces).not.toBe(rectangleBody.topology.faces);
    expect(circleBody.bounds).not.toEqual(rectangleBody.bounds);
  });

  it('keeps multi-body boolean, native snapshot, and fresh/complex current-revision STL round trips coherent', async () => {
    let result = await rectangleThenCircle();
    const freshDocument = result.document;
    const freshExport = await exportCurrentCadInBrowser(freshDocument);
    expect(freshExport.revisionId).toBe(freshDocument.revisionId);
    expect(atob(freshExport.dataBase64)).toContain('facet normal');

    const rectangleBody = result.document.bodies.find((body) => body.name === 'Rectangle body')!;
    const circleBody = result.document.bodies.find((body) => body.name === 'Circle body')!;
    result = await commit(result.document, createFeatureOperation({
      id: 'operation:boolean-subtract',
      kind: 'feature.boolean.subtract',
      name: 'Subtract circle from rectangle',
      inputIds: [circleBody.id],
      targetBodyIds: [rectangleBody.id],
      outputBodyName: 'Boolean cut result',
      parameters: {},
    }));
    const booleanBody = result.document.bodies.find((body) => body.name === 'Boolean cut result')!;
    const booleanGeometry = result.geometry!.bodies.find((body) => body.bodyId === booleanBody.id)!;
    expect(result.geometry!.bodies).toHaveLength(3);
    expect(booleanGeometry.volume).toBeGreaterThan(0);
    expect(booleanGeometry.volume).toBeLessThan(9600);

    const complexExport = await exportCurrentCadInBrowser(result.document, 'STL');
    const imported = await importCadInBrowser({ format: 'STL', fileName: complexExport.fileName, dataBase64: complexExport.dataBase64, expectedRevisionId: result.revisionId });
    expect(complexExport.revisionId).toBe(result.revisionId);
    expect(imported.mesh.triangles).toHaveLength(result.mesh.triangles.length);
    expect(imported.document.importedMeshes?.[0].sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const nativeDraft = await createNativeDocumentDraft(result.document, result.mesh);
    const nativeBytes = JSON.stringify(nativeDraft);
    expect(nativeBytes).toContain(result.revisionId);
    expect(nativeBytes).toContain(rectangleBody.id);
    expect(nativeBytes).toContain(circleBody.id);
    expect(nativeBytes).toContain(booleanBody.id);
  });

  it('fails stale explicit exports and OCCT-only exchange paths closed without fabricated bytes', async () => {
    const result = await rectangleThenCircle();
    await expect(exportCadInBrowser({ document: result.document, format: 'STL', revisionId: 'revision:stale' })).rejects.toMatchObject({ code: 'BROWSER_CAD_STALE' });
    await expect(exportCurrentCadInBrowser(result.document, 'STEP')).rejects.toMatchObject({ code: 'BROWSER_CAD_UNSUPPORTED' });
    await expect(exportCurrentCadInBrowser(result.document, 'IGES')).rejects.toThrow(/connected OCCT service/);
  });
});
