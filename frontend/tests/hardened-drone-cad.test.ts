import { describe, expect, it } from 'vitest';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import committedBom from '../public/fixtures/hardened-drone.bom.csv?raw';
import committedDocumentRaw from '../public/fixtures/hardened-drone.cad-document.json?raw';
import manifestRaw from '../public/fixtures/hardened-drone.manifest.json?raw';
import committedStl from '../public/fixtures/hardened-drone.stl?raw';
import evidenceRaw from '../../docs/evidence/hardened-drone-candidate-0.2.json?raw';
import {
  cadAuthoringReducer,
  createCadAuthoringState,
  createFeatureOperation,
  createHardenedDroneFixture,
  createMateOperation,
  HARDENED_DRONE_BENCHMARK,
  HARDENED_DRONE_PARTS,
} from '../src/cad';
import { exportCadInBrowser, exportCurrentCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';
import type { CadDocument, CadOperation } from '../src/cad';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function run(document?: CadDocument, operation?: CadOperation) {
  const fixture = createHardenedDroneFixture();
  const activeDocument = document ?? fixture.document;
  return recomputeCadInBrowser({ document: activeDocument, operation: operation ?? fixture.operation, expectedRevisionId: activeDocument.revisionId });
}

describe('QX-0 hardened drone CAD benchmark', () => {
  it('recomputes every one of the twelve part definitions and twenty-five physical instances', async () => {
    const fixture = createHardenedDroneFixture();
    const response = await run(fixture.document, fixture.operation);
    const instanceIds = new Set(response.geometry?.bodies.map((item) => item.instanceId));

    expect(HARDENED_DRONE_PARTS).toHaveLength(HARDENED_DRONE_BENCHMARK.bomLines);
    expect(HARDENED_DRONE_PARTS.reduce((sum, part) => sum + part.quantity, 0)).toBe(HARDENED_DRONE_BENCHMARK.physicalInstances);
    expect(response.document.bodies).toHaveLength(HARDENED_DRONE_BENCHMARK.bodyDefinitions);
    expect(response.document.bodies.every((item) => item.state === 'valid')).toBe(true);
    expect(response.document.assembly.instances).toHaveLength(HARDENED_DRONE_BENCHMARK.physicalInstances);
    expect(response.document.assembly.mates).toHaveLength(HARDENED_DRONE_BENCHMARK.mates);
    expect(response.mesh.groups).toHaveLength(HARDENED_DRONE_BENCHMARK.physicalInstances);
    expect(response.geometry?.bodies).toHaveLength(HARDENED_DRONE_BENCHMARK.physicalInstances);
    expect(instanceIds).toEqual(new Set(response.document.assembly.instances.map((item) => item.id)));
    expect(response.mesh.triangles.length).toBeGreaterThan(1_000);
    expect(response.dependencyGraph.nodes.length).toBeGreaterThan(80);
    expect(response.dependencyGraph.edges.length).toBeGreaterThan(80);
    expect(response.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(response.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(['CONSTRAINTS_RECORDED_NOT_SOLVED', 'DIMENSIONS_RECORDED_NOT_DRIVING', 'MATE_RECORDED_NOT_SOLVED', 'BROWSER_GEOMETRY_PROVENANCE']));
    expect(response.kernel).toMatchObject({ name: '@jscad/modeling', engineMode: 'BROWSER_JSCAD_BOUNDED' });
  });

  it('replays pinned input deterministically and drives the bounded span variant into new identities', async () => {
    const nominalFixture = createHardenedDroneFixture();
    const first = await run(nominalFixture.document, nominalFixture.operation);
    const second = await run(nominalFixture.document, nominalFixture.operation);
    const expandedFixture = createHardenedDroneFixture({ frameSpanMm: HARDENED_DRONE_BENCHMARK.expandedFrameSpanMm });
    const expanded = await run(expandedFixture.document, expandedFixture.operation);

    expect(second.revisionId).toBe(first.revisionId);
    expect(second.documentHash).toBe(first.documentHash);
    expect(second.dependencyGraphHash).toBe(first.dependencyGraphHash);
    expect(second.kernel.artifactHash).toBe(first.kernel.artifactHash);
    expect(second.mesh).toEqual(first.mesh);
    expect(expanded.revisionId).not.toBe(first.revisionId);
    expect(expanded.documentHash).not.toBe(first.documentHash);
    expect(expanded.kernel.artifactHash).not.toBe(first.kernel.artifactHash);
    expect(expanded.geometry?.bounds?.max[0]).toBeGreaterThan(first.geometry?.bounds?.max[0] ?? 0);
  });

  it('matches the committed CAD document, STL, BOM, manifest, and evidence hashes', async () => {
    const response = await run();
    const exported = await exportCurrentCadInBrowser(response.document, 'STL');
    const exportedStl = atob(exported.dataBase64);
    const committedDocument = JSON.parse(committedDocumentRaw) as CadDocument;
    const manifest = JSON.parse(manifestRaw) as { artifacts: Array<{ path: string; sha256: string; sizeBytes: number }> };
    const evidence = JSON.parse(evidenceRaw) as { status: string; identities: { revisionId: string; documentHash: string; meshArtifactHash: string }; counts: { triangles: number; physicalParts: number } };
    const artifactText: Record<string, string> = {
      'hardened-drone.cad-document.json': committedDocumentRaw,
      'hardened-drone.stl': committedStl,
      'hardened-drone.bom.csv': committedBom,
    };

    expect(committedDocument).toEqual(response.document);
    expect(committedStl).toBe(exportedStl);
    expect(committedBom.trim().split('\n')).toHaveLength(HARDENED_DRONE_BENCHMARK.bomLines + 1);
    expect(evidence).toMatchObject({ status: 'PASS', identities: { revisionId: response.revisionId, documentHash: response.documentHash, meshArtifactHash: response.kernel.artifactHash }, counts: { triangles: response.mesh.triangles.length, physicalParts: 25 } });
    for (const artifact of manifest.artifacts) {
      const text = artifactText[artifact.path];
      expect(text).toBeTypeOf('string');
      expect(new TextEncoder().encode(text).byteLength).toBe(artifact.sizeBytes);
      expect(await sha256(text)).toBe(artifact.sha256);
    }
  });

  it('fails closed on stale, malformed, unsupported, and unsafe assembly mutations', async () => {
    const fixture = createHardenedDroneFixture();
    const baseline = await run(fixture.document, fixture.operation);

    await expect(recomputeCadInBrowser({ document: fixture.document, operation: fixture.operation, expectedRevisionId: 'revision:stale' })).rejects.toMatchObject({ code: 'BROWSER_CAD_STALE' });

    const zeroRadius = clone(fixture.document);
    const mast = zeroRadius.sketches.find((item) => item.id === 'sketch:mast');
    if (!mast || mast.entities[0]?.kind !== 'circle') throw new Error('Pinned mast sketch is missing.');
    mast.entities[0].radius = 0;
    await expect(run(zeroRadius, fixture.operation)).rejects.toMatchObject({ code: 'BROWSER_CAD_INVALID' });

    const invalidParameter = clone(fixture.document);
    invalidParameter.parameters[0].expression = 'frame_span / 2';
    await expect(run(invalidParameter, fixture.operation)).rejects.toMatchObject({ code: 'BROWSER_CAD_INVALID' });

    const fillet = createFeatureOperation({ id: 'operation:ablation-fillet', kind: 'feature.fillet', name: 'Unsupported benchmark fillet', inputIds: ['body:frame'], targetBodyIds: ['body:frame'], outputBodyName: null, parameters: { radius: 2 } });
    const unsupported = clone(fixture.document);
    unsupported.operations.push(fillet);
    await expect(run(unsupported, fillet)).rejects.toMatchObject({ code: 'BROWSER_CAD_UNSUPPORTED' });

    await expect(exportCadInBrowser({ document: baseline.document, format: 'STEP', revisionId: baseline.revisionId })).rejects.toMatchObject({ code: 'BROWSER_CAD_UNSUPPORTED' });
    expect(() => createMateOperation({ id: 'mate:self', name: 'Self mate', kind: 'fixed', instanceAId: 'instance:frame', instanceBId: 'instance:frame', referenceA: 'origin', referenceB: 'origin', offset: 0, unit: 'mm' })).toThrow(/two different assembly instances/);
    expect(baseline.kernel.artifactHash).toMatch(/^(sha256:)?[a-f0-9]{64}$/);
  });

  it('preserves the accepted drone through a failed feature and exposes missing-body diagnostics', async () => {
    const fixture = createHardenedDroneFixture();
    const baseline = await run(fixture.document, fixture.operation);
    const fillet = createFeatureOperation({ id: 'operation:recovery-fillet', kind: 'feature.fillet', name: 'Recovery fillet', inputIds: ['body:frame'], targetBodyIds: ['body:frame'], outputBodyName: null, parameters: { radius: 1 } });
    let state = createCadAuthoringState(baseline.document);
    state = { ...state, lastValidMesh: baseline.mesh, dependencyGraph: baseline.dependencyGraph, diagnostics: baseline.diagnostics, kernel: baseline.kernel };
    state = cadAuthoringReducer(state, { type: 'stage', operation: fillet, requestId: 'request:fillet' });
    state = cadAuthoringReducer(state, { type: 'started', requestId: 'request:fillet' });
    state = cadAuthoringReducer(state, { type: 'failed', requestId: 'request:fillet', error: 'Connected OCCT required.', diagnostics: [{ id: 'diagnostic:fillet', severity: 'error', code: 'CONNECTED_OCCT_REQUIRED', message: 'Fillet unavailable.', operationId: fillet.id, entityIds: [] }] });
    expect(state.lastValidDocument).toBe(baseline.document);
    expect(state.lastValidMesh).toBe(baseline.mesh);
    state = cadAuthoringReducer(state, { type: 'recover-last-valid' });
    expect(state.document).toBe(baseline.document);

    const missingBody = clone(fixture.document);
    missingBody.assembly.instances[0].bodyId = 'body:missing';
    const missingResponse = await run(missingBody, fixture.operation);
    expect(missingResponse.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INSTANCE_BODY_UNAVAILABLE' })]));
  });

  it('makes the hardened benchmark directly operable in the CAD workspace without overstating its boundary', () => {
    expect(authoringSource).toContain('Load QX-0 · 260 mm');
    expect(authoringSource).toContain('Run span ablation · 300 mm');
    expect(authoringSource).toContain("'BROWSER_JSCAD_BOUNDED'");
    expect(authoringSource).toContain('Generic dimensions and all mates remain recorded, non-solving intent in browser mode.');
  });
});
