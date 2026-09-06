import { describe, expect, it, vi } from 'vitest';
import {
  applyCadIntent,
  cadAuthoringReducer,
  createCadAuthoringState,
  createCadDocument,
  createFeatureOperation,
  createInstanceOperation,
  createMateOperation,
  createParameterOperation,
  createSketchOperation,
  exportCad,
  importCad,
  recomputeCad,
  type CadDocument,
  type CadRecomputeResponse,
  type CadSketch,
} from '../src/cad';

function sketch(): CadSketch {
  return {
    id: 'sketch:mount',
    name: 'Mount profile',
    plane: { kind: 'origin', plane: 'XY' },
    entities: [
      { id: 'line:a', kind: 'line', construction: false, start: { x: 0, y: 0 }, end: { x: 30, y: 0 } },
      { id: 'line:b', kind: 'line', construction: false, start: { x: 30, y: 0 }, end: { x: 30, y: 20 } },
      { id: 'circle:a', kind: 'circle', construction: false, center: { x: 15, y: 10 }, radius: 3 },
    ],
    dimensions: [{ id: 'dim:width', kind: 'horizontal-distance', entityIds: ['line:a'], value: 30, expression: 'mount_width', unit: 'mm' }],
    constraints: [{ id: 'constraint:h', kind: 'horizontal', entityIds: ['line:a'] }, { id: 'constraint:c', kind: 'coincident', entityIds: ['line:a', 'line:b'] }],
    solverState: 'under-constrained',
  };
}

function response(document: CadDocument, revisionId = 'revision:2'): CadRecomputeResponse {
  const authoritative = { ...document, revisionId, bodies: document.bodies.map((body) => ({ ...body, state: 'valid' as const })) };
  return {
    document: authoritative,
    revisionId,
    documentHash: 'sha256:document',
    dependencyGraph: {
      nodes: authoritative.operations.map((operation) => ({ id: operation.id, label: operation.name, kind: operation.kind === 'sketch.create' ? 'sketch' as const : 'feature' as const, state: 'clean' as const })),
      edges: [],
    },
    mesh: { revisionId, vertices: [[0, 0, 0], [10, 0, 0], [0, 10, 0]], triangles: [[0, 1, 2]], groups: [{ bodyId: authoritative.bodies[0]?.id ?? 'body:none', startTriangle: 0, triangleCount: 1, color: '#779988' }] },
    diagnostics: [],
    kernel: { name: 'test-kernel', version: '1', mode: 'live', computedAt: '2026-09-05T00:00:00Z', artifactHash: 'sha256:kernel' },
  };
}

describe('general CAD authoring model', () => {
  it('preserves arbitrary named sketch geometry, dimensions, and geometric constraints as operation intent', () => {
    const operation = createSketchOperation(sketch(), 'operation:sketch');
    const document = applyCadIntent(createCadDocument('Assembly', 'document:1'), operation);

    expect(document.sketches[0]).toEqual(sketch());
    expect(document.operations[0].kind).toBe('sketch.create');
    expect(document.sketches[0].entities.map((entity) => entity.kind)).toEqual(['line', 'line', 'circle']);
    expect(document.sketches[0].constraints.map((constraint) => constraint.kind)).toEqual(['horizontal', 'coincident']);
  });

  it('stages the complete feature family, multi-body outputs, parameters, instances, and mates', () => {
    let document = applyCadIntent(createCadDocument('Assembly', 'document:1'), createSketchOperation(sketch(), 'operation:sketch'));
    const kinds = ['feature.extrude', 'feature.revolve', 'feature.boolean.union', 'feature.boolean.subtract', 'feature.boolean.intersect', 'feature.hole', 'feature.fillet', 'feature.chamfer'] as const;
    for (const [index, kind] of kinds.entries()) {
      document = applyCadIntent(document, createFeatureOperation({ id: `operation:${index}`, kind, name: kind, inputIds: ['sketch:mount'], outputBodyName: `Body ${index}`, parameters: { distance: index + 1 } }));
    }
    document = applyCadIntent(document, createParameterOperation({ id: 'parameter:thickness', name: 'thickness', expression: '4 mm', unit: 'mm', resolvedValue: null }, 'operation:param'));
    const firstBody = document.bodies[0].id;
    const secondBody = document.bodies[1].id;
    document = applyCadIntent(document, createInstanceOperation({ id: 'instance:a', name: 'A', bodyId: firstBody, grounded: true, transform: { translation: [0, 0, 0], rotationDegrees: [0, 0, 0] } }, 'operation:instance-a'));
    document = applyCadIntent(document, createInstanceOperation({ id: 'instance:b', name: 'B', bodyId: secondBody, grounded: false, transform: { translation: [10, 0, 0], rotationDegrees: [0, 0, 0] } }, 'operation:instance-b'));
    document = applyCadIntent(document, createMateOperation({ id: 'mate:a-b', name: 'A to B', kind: 'coincident', instanceAId: 'instance:a', instanceBId: 'instance:b', referenceA: 'face:a', referenceB: 'face:b', offset: 0, unit: 'mm' }, 'operation:mate'));

    expect(document.bodies).toHaveLength(8);
    expect(document.operations.filter((operation) => operation.kind.startsWith('feature.')).map((operation) => operation.kind)).toEqual(kinds);
    expect(document.parameters[0].expression).toBe('4 mm');
    expect(document.assembly.instances).toHaveLength(2);
    expect(document.assembly.mates[0].kind).toBe('coincident');
  });

  it('keeps last-valid geometry through stale and failed recomputes and can recover the draft', () => {
    const base = createCadDocument('Assembly', 'document:1');
    const operation = createSketchOperation(sketch(), 'operation:sketch');
    let state = createCadAuthoringState(base);
    state = cadAuthoringReducer(state, { type: 'stage', operation, requestId: 'request:1', occurredAt: '2026-09-05T00:00:00Z' });
    state = cadAuthoringReducer(state, { type: 'started', requestId: 'request:1', occurredAt: '2026-09-05T00:00:01Z' });
    state = cadAuthoringReducer(state, { type: 'failed', requestId: 'request:1', error: 'revision conflict', stale: true, occurredAt: '2026-09-05T00:00:02Z' });

    expect(state.status).toBe('stale');
    expect(state.document.sketches).toHaveLength(1);
    expect(state.lastValidDocument.sketches).toHaveLength(0);
    state = cadAuthoringReducer(state, { type: 'recover-last-valid', occurredAt: '2026-09-05T00:00:03Z' });
    expect(state.document).toEqual(base);
    expect(state.status).toBe('idle');
  });

  it('ignores an out-of-order response and accepts only the active authoritative revision', () => {
    const base = createCadDocument('Assembly', 'document:1');
    const operation = createSketchOperation(sketch(), 'operation:sketch');
    let state = cadAuthoringReducer(createCadAuthoringState(base), { type: 'stage', operation, requestId: 'request:current' });
    state = cadAuthoringReducer(state, { type: 'succeeded', requestId: 'request:old', response: response(base) });
    expect(state.status).toBe('queued');
    const authoritative = response(applyCadIntent(base, operation));
    state = cadAuthoringReducer(state, { type: 'succeeded', requestId: 'request:current', response: authoritative });
    expect(state.lastValidDocument.revisionId).toBe('revision:2');
    expect(state.lastValidMesh?.revisionId).toBe('revision:2');
  });
});

describe('stateless CAD API client', () => {
  it('posts the agreed recompute contract and rejects mismatched revision-bound geometry', async () => {
    const base = createCadDocument('Assembly', 'document:1');
    const operation = createSketchOperation(sketch(), 'operation:sketch');
    const draft = applyCadIntent(base, operation);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(response(draft)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const result = await recomputeCad({ document: draft, operation, expectedRevisionId: base.revisionId }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('/api/cad/recompute', expect.objectContaining({ method: 'POST' }));
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(request).toMatchObject({ expectedRevisionId: 'revision:new' });
    expect(result.kernel.mode).toBe('live');

    const invalid = response(draft);
    invalid.mesh.revisionId = 'revision:stale';
    const malformed = vi.fn(async () => new Response(JSON.stringify(invalid), { status: 200 })) as unknown as typeof fetch;
    await expect(recomputeCad({ document: draft, operation, expectedRevisionId: base.revisionId }, malformed)).rejects.toMatchObject({ code: 'CAD_RESPONSE_INVALID' });
  });

  it('reports unavailable and stale adapters without fabricating a successful document', async () => {
    const base = createCadDocument('Assembly', 'document:1');
    const operation = createSketchOperation(sketch(), 'operation:sketch');
    const unavailable = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    await expect(recomputeCad({ document: base, operation, expectedRevisionId: base.revisionId }, unavailable)).rejects.toMatchObject({ code: 'CAD_API_UNAVAILABLE' });
    const stale = vi.fn(async () => new Response('conflict', { status: 409 })) as unknown as typeof fetch;
    await expect(recomputeCad({ document: base, operation, expectedRevisionId: base.revisionId }, stale)).rejects.toMatchObject({ code: 'CAD_STALE', status: 409 });
  });

  it('uses dedicated STEP/IGES/STL import and export endpoints and validates artifacts', async () => {
    const base = createCadDocument('Imported', 'document:import');
    const imported = vi.fn(async () => new Response(JSON.stringify(response(base, 'revision:imported')), { status: 200 })) as unknown as typeof fetch;
    expect((await importCad({ format: 'STEP', fileName: 'mount.step', dataBase64: 'U1RFUA==', expectedRevisionId: 'revision:new' }, imported)).revisionId).toBe('revision:imported');
    expect(imported).toHaveBeenCalledWith('/api/cad/import', expect.objectContaining({ method: 'POST' }));

    const exported = vi.fn(async () => new Response(JSON.stringify({ fileName: 'mount.stl', format: 'STL', mimeType: 'model/stl', dataBase64: 'c29saWQ=', revisionId: 'revision:imported', documentHash: 'sha256:document' }), { status: 200 })) as unknown as typeof fetch;
    expect((await exportCad({ document: base, format: 'STL', revisionId: 'revision:imported' }, exported)).fileName).toBe('mount.stl');
    expect(exported).toHaveBeenCalledWith('/api/cad/export', expect.objectContaining({ method: 'POST' }));
  });
});
