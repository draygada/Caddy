import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCadIntent, createCadDocument, createFeatureOperation, createInstanceOperation, createSketchOperation, exportCad, recomputeCad, type CadDocument, type CadSketch } from '../src/cad';
import { BrowserCadError, exportCadInBrowser, importCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';

function profile(id = 'sketch:plate', constrained = false): CadSketch {
  return {
    id,
    name: 'Plate profile',
    plane: { kind: 'origin', plane: 'XY' },
    entities: [{ id: `${id}:rect`, kind: 'rectangle', construction: false, origin: { x: 0, y: 0 }, width: 20, height: 10 }],
    dimensions: constrained ? [{ id: `${id}:dimension`, kind: 'distance', entityIds: [`${id}:rect`], value: 20, expression: null, unit: 'mm' }] : [],
    constraints: constrained ? [{ id: `${id}:fixed`, kind: 'fixed', entityIds: [`${id}:rect`] }] : [],
    solverState: constrained ? 'fully-constrained' : 'unresolved',
  };
}

async function extrudedDocument(id = 'document:browser'): Promise<{ document: CadDocument; response: Awaited<ReturnType<typeof recomputeCadInBrowser>> }> {
  const base = createCadDocument('Browser plate', id);
  const sketchOperation = createSketchOperation(profile(), 'operation:sketch');
  const withSketch = applyCadIntent(base, sketchOperation);
  const sketchResponse = await recomputeCadInBrowser({ document: withSketch, operation: sketchOperation, expectedRevisionId: base.revisionId });
  const extrude = createFeatureOperation({ id: 'operation:extrude', kind: 'feature.extrude', name: 'Extrude plate', inputIds: ['sketch:plate'], outputBodyName: 'Plate', parameters: { distance: 5 } });
  const document = applyCadIntent(sketchResponse.document, extrude);
  return { document, response: await recomputeCadInBrowser({ document, operation: extrude, expectedRevisionId: sketchResponse.revisionId }) };
}

afterEach(() => vi.unstubAllGlobals());

describe('BROWSER_JSCAD_BOUNDED', () => {
  it('deterministically extrudes authored profiles with revision, dependency, topology, bounds, and volume evidence', async () => {
    const first = await extrudedDocument();
    const operation = first.document.operations.find((item) => item.id === 'operation:extrude')!;
    const second = await recomputeCadInBrowser({ document: first.document, operation, expectedRevisionId: first.document.revisionId });
    expect(first.response.kernel).toMatchObject({ name: '@jscad/modeling', version: '2.13.0', engineMode: 'BROWSER_JSCAD_BOUNDED' });
    expect(first.response.revisionId).toBe(second.revisionId);
    expect(first.response.documentHash).toBe(second.documentHash);
    expect(first.response.dependencyGraphHash).toBe(second.dependencyGraphHash);
    expect(first.response.mesh.triangles.length).toBeGreaterThan(8);
    expect(first.response.geometry?.totalVolume).toBeCloseTo(1000, 4);
    expect(first.response.geometry?.bounds).toEqual({ min: [0, 0, 0], max: [20, 10, 5] });
    expect(first.response.geometry?.bodies[0].topology.faces).toBeGreaterThan(5);
  });

  it('applies multi-body boolean subtraction and authored assembly transforms', async () => {
    const first = await extrudedDocument('document:assembly');
    const secondSketch = profile('sketch:tool');
    secondSketch.entities = [{ id: 'tool:circle', kind: 'circle', construction: false, center: { x: 5, y: 5 }, radius: 2 }];
    const sketchOperation = createSketchOperation(secondSketch, 'operation:tool-sketch');
    let document = applyCadIntent(first.response.document, sketchOperation);
    let result = await recomputeCadInBrowser({ document, operation: sketchOperation, expectedRevisionId: first.response.revisionId });
    const tool = createFeatureOperation({ id: 'operation:tool', kind: 'feature.extrude', name: 'Tool', inputIds: ['sketch:tool'], outputBodyName: 'Tool', parameters: { distance: 5 } });
    document = applyCadIntent(result.document, tool);
    result = await recomputeCadInBrowser({ document, operation: tool, expectedRevisionId: result.revisionId });
    const plateId = result.document.bodies.find((body) => body.name === 'Plate')!.id;
    const toolId = result.document.bodies.find((body) => body.name === 'Tool')!.id;
    const subtract = createFeatureOperation({ id: 'operation:subtract', kind: 'feature.boolean.subtract', name: 'Subtract tool', inputIds: [toolId], targetBodyIds: [plateId], outputBodyName: 'Plate with hole', parameters: {} });
    document = applyCadIntent(result.document, subtract);
    result = await recomputeCadInBrowser({ document, operation: subtract, expectedRevisionId: result.revisionId });
    const resultBody = result.document.bodies.find((body) => body.name === 'Plate with hole')!.id;
    const instance = createInstanceOperation({ id: 'instance:plate', name: 'Moved plate', bodyId: resultBody, grounded: false, transform: { translation: [30, 0, 0], rotationDegrees: [0, 0, 0] } }, 'operation:instance');
    document = applyCadIntent(result.document, instance);
    result = await recomputeCadInBrowser({ document, operation: instance, expectedRevisionId: result.revisionId });
    const moved = result.geometry?.bodies.find((body) => body.instanceId === 'instance:plate');
    expect(moved?.bounds.min[0]).toBe(30);
    expect(moved?.volume).toBeLessThan(1000);
    expect(result.mesh.groups.some((group) => group.bodyId === 'instance:plate')).toBe(true);
  });

  it('rejects stale bases and unsupported fillet while retaining honest constraint diagnostics', async () => {
    const base = createCadDocument('Boundaries', 'document:boundaries');
    const sketchOperation = createSketchOperation(profile('sketch:bounded', true), 'operation:bounded');
    const document = applyCadIntent(base, sketchOperation);
    await expect(recomputeCadInBrowser({ document, operation: sketchOperation, expectedRevisionId: 'revision:stale' })).rejects.toMatchObject({ code: 'BROWSER_CAD_STALE' });
    const sketchResult = await recomputeCadInBrowser({ document, operation: sketchOperation, expectedRevisionId: base.revisionId });
    expect(sketchResult.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(['CONSTRAINTS_RECORDED_NOT_SOLVED', 'DIMENSIONS_RECORDED_NOT_DRIVING']));
    const fillet = createFeatureOperation({ id: 'operation:fillet', kind: 'feature.fillet', name: 'Fillet', inputIds: ['body:any'], targetBodyIds: ['body:any'], parameters: { radius: 2 } });
    await expect(recomputeCadInBrowser({ document: applyCadIntent(sketchResult.document, fillet), operation: fillet, expectedRevisionId: sketchResult.revisionId })).rejects.toMatchObject<Partial<BrowserCadError>>({ code: 'BROWSER_CAD_UNSUPPORTED' });
  });

  it('round-trips real STL locally and fails STEP/IGES closed without fabricated bytes', async () => {
    const { response } = await extrudedDocument('document:exchange');
    const exported = await exportCadInBrowser({ document: response.document, format: 'STL', revisionId: response.revisionId });
    expect(atob(exported.dataBase64)).toContain('facet normal');
    const imported = await importCadInBrowser({ format: 'STL', fileName: exported.fileName, dataBase64: exported.dataBase64, expectedRevisionId: 'revision:any' });
    expect(imported.mesh.triangles.length).toBe(response.mesh.triangles.length);
    expect(imported.document.importedMeshes?.[0].sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    await expect(exportCadInBrowser({ document: response.document, format: 'STEP', revisionId: response.revisionId })).rejects.toThrow(/owner approval/);
    await expect(importCadInBrowser({ format: 'IGES', fileName: 'fake.iges', dataBase64: 'ZmFrZQ==', expectedRevisionId: response.revisionId })).rejects.toThrow(/owner approval/);
  });

  it('preserves connected behavior but falls back automatically in a browser when the route is unconfigured', async () => {
    vi.stubGlobal('window', {});
    const base = createCadDocument('Fallback', 'document:fallback');
    const operation = createSketchOperation(profile('sketch:fallback'), 'operation:fallback');
    const document = applyCadIntent(base, operation);
    const unavailable = vi.fn(async () => new Response('not configured', { status: 404 })) as unknown as typeof fetch;
    const result = await recomputeCad({ document, operation, expectedRevisionId: base.revisionId }, unavailable);
    expect(result.kernel.engineMode).toBe('BROWSER_JSCAD_BOUNDED');
    const connected = vi.fn(async () => new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    await recomputeCad({ document, operation, expectedRevisionId: base.revisionId }, connected);
    expect(connected).toHaveBeenCalledOnce();
    await expect(exportCad({ document: result.document, format: 'STEP', revisionId: result.revisionId }, unavailable)).rejects.toThrow(/owner approval/);
  });
});
