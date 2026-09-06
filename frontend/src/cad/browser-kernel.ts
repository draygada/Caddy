import { booleans, extrusions, geometries, measurements, primitives, transforms } from '@jscad/modeling';
import type {
  CadBodyGeometrySummary,
  CadDependencyGraph,
  CadDiagnostic,
  CadDocument,
  CadExportRequest,
  CadExportResponse,
  CadImportRequest,
  CadImportedMesh,
  CadMesh,
  CadRecomputeRequest,
  CadRecomputeResponse,
  CadSketch,
  CadTransferFormat,
  FeatureOperation,
  SketchEntity,
} from './types';

type Geom2 = ReturnType<typeof primitives.rectangle>;
type Geom3 = ReturnType<typeof extrusions.extrudeLinear>;
type EvaluatedBody = { bodyId: string; instanceId: string | null; geometry: Geom3 };

export class BrowserCadError extends Error {
  code: 'BROWSER_CAD_STALE' | 'BROWSER_CAD_UNSUPPORTED' | 'BROWSER_CAD_INVALID';
  diagnostics: CadDiagnostic[];

  constructor(code: BrowserCadError['code'], message: string, diagnostics: CadDiagnostic[] = []) {
    super(message);
    this.name = 'BrowserCadError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

const EPSILON = 1e-7;
const VERSION = '2.13.0';

export async function recomputeCadInBrowser(request: CadRecomputeRequest): Promise<CadRecomputeResponse> {
  if (request.expectedRevisionId !== request.document.revisionId) {
    throw new BrowserCadError('BROWSER_CAD_STALE', `Browser kernel rejected stale base ${request.expectedRevisionId}; current document is ${request.document.revisionId}.`, [diagnostic('error', 'STALE_BASE_REVISION', 'The browser kernel will not recompute a stale revision.', request.operation.id)]);
  }
  const evaluated = evaluateDocument(request.document);
  const sourceHash = await hashCanonical({ ...request.document, revisionId: 'revision:pending' });
  const revisionId = `revision:${sourceHash.slice(7, 31)}`;
  const document: CadDocument = {
    ...request.document,
    revisionId,
    bodies: request.document.bodies.map((body) => ({ ...body, state: evaluated.bodyIds.has(body.id) ? 'valid' : 'failed' })),
  };
  const dependencyGraph = buildDependencyGraph(document);
  const dependencyGraphHash = await hashCanonical(dependencyGraph);
  const mesh = meshBodies(evaluated.bodies, revisionId);
  const artifactHash = await hashCanonical(mesh);
  return {
    document,
    revisionId,
    documentHash: await hashCanonical(document),
    dependencyGraph,
    dependencyGraphHash,
    mesh,
    geometry: geometrySummary(evaluated.bodies),
    diagnostics: [
      ...evaluated.diagnostics,
      diagnostic('info', 'BROWSER_GEOMETRY_PROVENANCE', `JSCAD generated ${mesh.triangles.length} mesh triangles from ${evaluated.bodies.length} evaluated body or instance geometries. Dependency ${dependencyGraphHash}.`, request.operation.id),
    ],
    kernel: {
      name: '@jscad/modeling',
      version: VERSION,
      mode: 'recovery-fixture',
      engineMode: 'BROWSER_JSCAD_BOUNDED',
      computedAt: new Date().toISOString(),
      artifactHash,
    },
  };
}

export async function importCadInBrowser(request: CadImportRequest): Promise<CadRecomputeResponse> {
  requireStl(request.format, 'import');
  const bytes = decodeBase64(request.dataBase64);
  const sourceHash = await sha256(bytes);
  const imported = parseStl(bytes, request.fileName, sourceHash);
  const revisionId = `revision:${sourceHash.slice(7, 31)}`;
  const bodyId = imported.bodyId;
  const document: CadDocument = {
    schemaVersion: 'caddydaddy.cad-document/1',
    id: `document:stl:${sourceHash.slice(7, 19)}`,
    name: request.fileName,
    revisionId,
    units: { length: 'mm', angle: 'deg' },
    parameters: [],
    sketches: [],
    operations: [],
    bodies: [{ id: bodyId, name: request.fileName, featureIds: [], material: null, visible: true, state: 'valid' }],
    assembly: { instances: [], mates: [] },
    importedMeshes: [imported],
  };
  const bodies: EvaluatedBody[] = [{ bodyId, instanceId: null, geometry: geometryFromImportedMesh(imported) }];
  const dependencyGraph = buildDependencyGraph(document);
  const dependencyGraphHash = await hashCanonical(dependencyGraph);
  const mesh = meshBodies(bodies, revisionId);
  const artifactHash = await hashCanonical(mesh);
  return {
    document,
    revisionId,
    documentHash: await hashCanonical(document),
    dependencyGraph,
    dependencyGraphHash,
    mesh,
    geometry: geometrySummary(bodies),
    diagnostics: [diagnostic('info', 'STL_MESH_IMPORTED', `Imported ${mesh.triangles.length} STL triangles. STL carries mesh geometry only, not sketches or editable feature history.`, null)],
    kernel: { name: '@jscad/modeling + CADdyDaddy STL parser', version: VERSION, mode: 'recovery-fixture', engineMode: 'BROWSER_JSCAD_BOUNDED', computedAt: new Date().toISOString(), artifactHash },
  };
}

export async function exportCadInBrowser(request: CadExportRequest): Promise<CadExportResponse> {
  requireStl(request.format, 'export');
  if (request.revisionId !== request.document.revisionId) {
    throw new BrowserCadError('BROWSER_CAD_STALE', `STL export rejected stale revision ${request.revisionId}; current document is ${request.document.revisionId}.`);
  }
  const evaluated = evaluateDocument(request.document);
  if (evaluated.bodies.length === 0) throw new BrowserCadError('BROWSER_CAD_INVALID', 'STL export requires at least one successfully evaluated body.');
  return {
    fileName: `${safeStem(request.document.name)}-${request.revisionId.replaceAll(':', '-')}.stl`,
    format: 'STL',
    mimeType: 'model/stl',
    dataBase64: encodeBase64(new TextEncoder().encode(serializeAsciiStl(evaluated.bodies))),
    revisionId: request.revisionId,
    documentHash: await hashCanonical(request.document),
  };
}

export async function exportCurrentCadInBrowser(document: CadDocument, format: CadTransferFormat = 'STL'): Promise<CadExportResponse> {
  return exportCadInBrowser({ document, format, revisionId: document.revisionId });
}

function evaluateDocument(document: CadDocument): { bodies: EvaluatedBody[]; bodyIds: Set<string>; diagnostics: CadDiagnostic[] } {
  const diagnostics: CadDiagnostic[] = [];
  const bodyGeometry = new Map<string, Geom3>();
  for (const imported of document.importedMeshes ?? []) bodyGeometry.set(imported.bodyId, geometryFromImportedMesh(imported));
  for (const sketch of document.sketches) recordSketchBoundaries(sketch, diagnostics);

  for (const operation of document.operations) {
    if (operation.suppressed || !operation.kind.startsWith('feature.')) continue;
    const feature = operation as FeatureOperation;
    if (feature.kind === 'feature.fillet' || feature.kind === 'feature.chamfer') {
      throw unsupported(feature, `${feature.kind === 'feature.fillet' ? 'Fillet' : 'Chamfer'} is not implemented by the bounded browser kernel. Connect the approved OCCT service for this operation.`);
    }
    try {
      const outputBody = document.bodies.find((body) => body.featureIds[0] === feature.id);
      let result: Geom3;
      if (feature.kind === 'feature.extrude' || feature.kind === 'feature.revolve') {
        const { profile, sketch } = profileForInputs(document, feature.inputIds, diagnostics, feature.id);
        if (feature.kind === 'feature.extrude') {
          result = orientFromSketch(extrusions.extrudeLinear({ height: positiveParameter(feature, ['distance', 'height', 'length']) }, profile), sketch);
        } else {
          result = orientFromSketch(extrusions.extrudeRotate({ angle: degrees(positiveParameter(feature, ['angle'], 360)), segments: 48, overflow: 'cap' }, profile), sketch);
        }
      } else if (feature.kind === 'feature.hole') {
        const target = requiredTargets(feature, bodyGeometry)[0];
        const bounds = measurements.measureBoundingBox(target.geometry) as [[number, number, number], [number, number, number]];
        const height = Math.max(1, bounds[1][2] - bounds[0][2] + 2);
        let tool: Geom3;
        const sketch = findSketch(document, feature.inputIds);
        if (sketch) {
          const profile = sketchToProfile(sketch, feature.inputIds, diagnostics, feature.id);
          tool = transforms.translate([0, 0, bounds[0][2] - 1], orientFromSketch(extrusions.extrudeLinear({ height }, profile), sketch));
        } else {
          const diameter = numericParameter(feature, ['diameter']);
          const radius = diameter !== null ? diameter / 2 : positiveParameter(feature, ['radius'], 1);
          const center: [number, number] = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
          tool = transforms.translate([0, 0, bounds[0][2] - 1], extrusions.extrudeLinear({ height }, primitives.circle({ center, radius, segments: 48 })));
        }
        result = booleans.subtract(target.geometry, tool);
      } else {
        const targets = requiredTargets(feature, bodyGeometry);
        const referenced = feature.inputIds.map((id) => bodyGeometry.get(id)).filter((item): item is Geom3 => Boolean(item));
        const operands = uniqueGeometries([...targets.map((item) => item.geometry), ...referenced]);
        if (operands.length < 2) throw new BrowserCadError('BROWSER_CAD_INVALID', `${feature.kind} requires at least two evaluated body references.`, [diagnostic('error', 'BOOLEAN_OPERANDS_REQUIRED', 'Choose a target body and at least one distinct input body.', feature.id)]);
        if (feature.kind === 'feature.boolean.union') result = booleans.union(...operands);
        else if (feature.kind === 'feature.boolean.subtract') result = booleans.subtract(operands[0], ...operands.slice(1));
        else result = booleans.intersect(...operands);
      }
      if (outputBody) bodyGeometry.set(outputBody.id, result);
      else for (const targetId of feature.targetBodyIds) bodyGeometry.set(targetId, result);
    } catch (error) {
      if (error instanceof BrowserCadError) throw error;
      throw new BrowserCadError('BROWSER_CAD_INVALID', `Browser geometry failed at ${feature.name}: ${error instanceof Error ? error.message : 'JSCAD operation failed'}.`, [diagnostic('error', 'JSCAD_OPERATION_FAILED', 'The failed operation did not replace last-valid geometry.', feature.id)]);
    }
  }

  for (const mate of document.assembly.mates) {
    if (mate.kind !== 'fixed') diagnostics.push(diagnostic('warning', 'MATE_RECORDED_NOT_SOLVED', `Mate ${mate.name} is recorded but not solved by the bounded browser kernel; authored instance transforms remain in force.`, mate.id));
  }
  const instanced = new Set(document.assembly.instances.map((instance) => instance.bodyId));
  const bodies: EvaluatedBody[] = [];
  for (const body of document.bodies) {
    const geometry = bodyGeometry.get(body.id);
    if (geometry && body.visible && !instanced.has(body.id)) bodies.push({ bodyId: body.id, instanceId: null, geometry });
  }
  for (const instance of document.assembly.instances) {
    const geometry = bodyGeometry.get(instance.bodyId);
    if (!geometry) {
      diagnostics.push(diagnostic('warning', 'INSTANCE_BODY_UNAVAILABLE', `Instance ${instance.name} references a body without evaluated geometry.`, instance.id));
      continue;
    }
    const rotated = transforms.rotate(instance.transform.rotationDegrees.map(degrees) as [number, number, number], geometry);
    bodies.push({ bodyId: instance.bodyId, instanceId: instance.id, geometry: transforms.translate(instance.transform.translation, rotated) });
  }
  return { bodies, bodyIds: new Set(bodyGeometry.keys()), diagnostics };
}

function profileForInputs(document: CadDocument, inputIds: string[], diagnostics: CadDiagnostic[], operationId: string): { profile: Geom2; sketch: CadSketch } {
  const sketch = findSketch(document, inputIds);
  if (!sketch) throw new BrowserCadError('BROWSER_CAD_INVALID', 'Extrude/revolve requires a sketch ID or sketch-entity ID.', [diagnostic('error', 'SKETCH_INPUT_REQUIRED', 'Select an authored sketch as the feature input.', operationId)]);
  return { profile: sketchToProfile(sketch, inputIds, diagnostics, operationId), sketch };
}

function findSketch(document: CadDocument, inputIds: string[]): CadSketch | undefined {
  return document.sketches.find((sketch) => inputIds.includes(sketch.id) || sketch.entities.some((entity) => inputIds.includes(entity.id)));
}

function sketchToProfile(sketch: CadSketch, inputIds: string[], diagnostics: CadDiagnostic[], operationId: string): Geom2 {
  if (sketch.plane.kind === 'face') throw new BrowserCadError('BROWSER_CAD_UNSUPPORTED', 'Face-attached sketches require the connected OCCT service; browser fallback supports origin XY/XZ/YZ planes.', [diagnostic('error', 'FACE_SKETCH_UNSUPPORTED', 'No face-reference topology is fabricated in the browser kernel.', operationId)]);
  const selected = inputIds.includes(sketch.id) ? sketch.entities : sketch.entities.filter((entity) => inputIds.includes(entity.id));
  const entities = selected.filter((entity) => !entity.construction);
  const profiles: Geom2[] = [];
  const lines = entities.filter((entity): entity is Extract<SketchEntity, { kind: 'line' }> => entity.kind === 'line');
  for (const entity of entities) {
    if (entity.kind === 'rectangle') {
      if (Math.abs(entity.width) <= EPSILON || Math.abs(entity.height) <= EPSILON) throw invalidEntity(entity.id, operationId, 'Rectangle width and height must be non-zero.');
      profiles.push(primitives.rectangle({ center: [entity.origin.x + entity.width / 2, entity.origin.y + entity.height / 2], size: [Math.abs(entity.width), Math.abs(entity.height)] }));
    } else if (entity.kind === 'circle') {
      if (entity.radius <= EPSILON) throw invalidEntity(entity.id, operationId, 'Circle radius must be positive.');
      profiles.push(primitives.circle({ center: [entity.center.x, entity.center.y], radius: entity.radius, segments: 48 }));
    } else if (entity.kind === 'spline' && entity.closed) {
      if (entity.points.length < 3) throw invalidEntity(entity.id, operationId, 'A closed polygon needs at least three points.');
      profiles.push(primitives.polygon({ points: entity.points.map((point) => [point.x, point.y]) }));
    } else if (entity.kind === 'arc') {
      diagnostics.push(diagnostic('warning', 'ARC_PROFILE_UNSUPPORTED', `Arc ${entity.id} is recorded but excluded from browser profile construction.`, operationId, [entity.id]));
    } else if (entity.kind === 'spline') {
      diagnostics.push(diagnostic('warning', 'OPEN_SPLINE_UNSUPPORTED', `Open spline ${entity.id} is recorded but cannot define a browser solid profile.`, operationId, [entity.id]));
    }
  }
  if (lines.length >= 3) {
    const points = stitchedLoop(lines);
    if (points) profiles.push(primitives.polygon({ points }));
    else diagnostics.push(diagnostic('warning', 'OPEN_LINE_CHAIN_UNSUPPORTED', 'Sketch lines do not form one ordered closed polygon and were excluded from browser profile construction.', operationId, lines.map((line) => line.id)));
  } else if (lines.length > 0) diagnostics.push(diagnostic('warning', 'OPEN_LINE_CHAIN_UNSUPPORTED', 'At least three ordered, closed line segments are required for a browser polygon.', operationId, lines.map((line) => line.id)));
  if (profiles.length === 0) throw new BrowserCadError('BROWSER_CAD_INVALID', `Sketch ${sketch.name} contains no supported closed browser profile.`, [diagnostic('error', 'CLOSED_PROFILE_REQUIRED', 'Use a rectangle, circle, closed polygon spline, or ordered closed line loop.', operationId)]);
  return profiles.length === 1 ? profiles[0] : booleans.union(...profiles);
}

function recordSketchBoundaries(sketch: CadSketch, diagnostics: CadDiagnostic[]): void {
  if (sketch.constraints.length > 0) diagnostics.push(diagnostic('warning', 'CONSTRAINTS_RECORDED_NOT_SOLVED', `${sketch.constraints.length} sketch constraints are retained as intent but not solved by BROWSER_JSCAD_BOUNDED.`, sketch.id, sketch.constraints.map((item) => item.id)));
  if (sketch.dimensions.length > 0) diagnostics.push(diagnostic('warning', 'DIMENSIONS_RECORDED_NOT_DRIVING', `${sketch.dimensions.length} dimensions are retained but expressions do not drive browser geometry.`, sketch.id, sketch.dimensions.map((item) => item.id)));
}

function orientFromSketch(geometry: Geom3, sketch: CadSketch): Geom3 {
  if (sketch.plane.kind !== 'origin' || sketch.plane.plane === 'XY') return geometry;
  if (sketch.plane.plane === 'XZ') return transforms.rotateX(-Math.PI / 2, geometry);
  return transforms.rotateY(Math.PI / 2, geometry);
}

function requiredTargets(feature: FeatureOperation, bodies: Map<string, Geom3>): Array<{ id: string; geometry: Geom3 }> {
  const targets = feature.targetBodyIds.map((id) => ({ id, geometry: bodies.get(id) })).filter((item): item is { id: string; geometry: Geom3 } => Boolean(item.geometry));
  if (targets.length === 0) throw new BrowserCadError('BROWSER_CAD_INVALID', `${feature.kind} requires an evaluated target body.`, [diagnostic('error', 'TARGET_BODY_REQUIRED', 'Select an existing body as the target.', feature.id)]);
  return targets;
}

function positiveParameter(feature: FeatureOperation, keys: string[], fallback?: number): number {
  const value = numericParameter(feature, keys) ?? fallback;
  if (value === undefined || !Number.isFinite(value) || value <= 0) throw new BrowserCadError('BROWSER_CAD_INVALID', `${feature.name} requires a positive ${keys.join('/')} parameter.`, [diagnostic('error', 'POSITIVE_PARAMETER_REQUIRED', `Expected one of: ${keys.join(', ')}.`, feature.id)]);
  return value;
}

function numericParameter(feature: FeatureOperation, keys: string[]): number | null {
  for (const key of keys) {
    const value = feature.parameters[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function buildDependencyGraph(document: CadDocument): CadDependencyGraph {
  const nodes: CadDependencyGraph['nodes'] = [];
  const edges: CadDependencyGraph['edges'] = [];
  for (const parameter of document.parameters) nodes.push({ id: parameter.id, label: parameter.name, kind: 'parameter', state: 'clean' });
  for (const sketch of document.sketches) nodes.push({ id: sketch.id, label: sketch.name, kind: 'sketch', state: 'clean' });
  for (const operation of document.operations) {
    if (operation.kind === 'sketch.create' || operation.kind === 'parameter.set' || operation.kind === 'assembly.instance.add' || operation.kind === 'assembly.mate.add') continue;
    nodes.push({ id: operation.id, label: operation.name, kind: 'feature', state: operation.suppressed ? 'suppressed' : 'clean' });
    for (const dependency of operation.dependsOn) edges.push({ from: dependency, to: operation.id, relation: 'depends-on' });
  }
  for (const body of document.bodies) {
    nodes.push({ id: body.id, label: body.name, kind: 'body', state: body.state === 'failed' ? 'failed' : 'clean' });
    for (const featureId of body.featureIds) edges.push({ from: featureId, to: body.id, relation: 'produces' });
  }
  for (const instance of document.assembly.instances) {
    nodes.push({ id: instance.id, label: instance.name, kind: 'instance', state: 'clean' });
    edges.push({ from: instance.bodyId, to: instance.id, relation: 'instances' });
  }
  for (const mate of document.assembly.mates) {
    nodes.push({ id: mate.id, label: mate.name, kind: 'mate', state: mate.kind === 'fixed' ? 'clean' : 'dirty' });
    edges.push({ from: mate.instanceAId, to: mate.id, relation: 'mates' }, { from: mate.instanceBId, to: mate.id, relation: 'mates' });
  }
  return { nodes, edges };
}

function meshBodies(bodies: EvaluatedBody[], revisionId: string): CadMesh {
  const vertices: CadMesh['vertices'] = [];
  const triangles: CadMesh['triangles'] = [];
  const groups: CadMesh['groups'] = [];
  const known = new Map<string, number>();
  for (const body of bodies) {
    const startTriangle = triangles.length;
    for (const polygon of geometries.geom3.toPolygons(body.geometry)) {
      const points = geometries.poly3.toPoints(polygon) as Array<[number, number, number]>;
      for (let index = 1; index < points.length - 1; index += 1) triangles.push([indexFor(points[0], vertices, known), indexFor(points[index], vertices, known), indexFor(points[index + 1], vertices, known)]);
    }
    groups.push({ bodyId: body.instanceId ?? body.bodyId, startTriangle, triangleCount: triangles.length - startTriangle, color: colorFor(body.instanceId ?? body.bodyId) });
  }
  return { revisionId, vertices, triangles, groups };
}

function geometrySummary(bodies: EvaluatedBody[]): { bodies: CadBodyGeometrySummary[]; bounds: { min: [number, number, number]; max: [number, number, number] } | null; totalVolume: number } {
  const summaries = bodies.map(summarizeBody);
  if (summaries.length === 0) return { bodies: [], bounds: null, totalVolume: 0 };
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const summary of summaries) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], summary.bounds.min[axis]);
    max[axis] = Math.max(max[axis], summary.bounds.max[axis]);
  }
  return { bodies: summaries, bounds: { min, max }, totalVolume: summaries.reduce((total, item) => total + item.volume, 0) };
}

function summarizeBody(body: EvaluatedBody): CadBodyGeometrySummary {
  const polygons = geometries.geom3.toPolygons(body.geometry);
  const vertexKeys = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const polygon of polygons) {
    const points = geometries.poly3.toPoints(polygon) as Array<[number, number, number]>;
    const keys = points.map(pointKey);
    keys.forEach((key) => vertexKeys.add(key));
    keys.forEach((key, index) => edgeKeys.add([key, keys[(index + 1) % keys.length]].sort().join('|')));
  }
  const bounds = measurements.measureBoundingBox(body.geometry) as [[number, number, number], [number, number, number]];
  return { bodyId: body.bodyId, instanceId: body.instanceId, bounds: { min: [...bounds[0]], max: [...bounds[1]] }, volume: Math.abs(measurements.measureVolume(body.geometry) as number), topology: { faces: polygons.length, edges: edgeKeys.size, vertices: vertexKeys.size } };
}

function geometryFromImportedMesh(mesh: CadImportedMesh): Geom3 {
  return geometries.geom3.create(mesh.triangles.map((triangle) => geometries.poly3.create(triangle.map((index) => mesh.vertices[index]))));
}

function parseStl(bytes: Uint8Array, fileName: string, sourceHash: string): CadImportedMesh {
  const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
  const trianglePoints = prefix.startsWith('solid') && prefix.includes('facet') ? parseAsciiStl(new TextDecoder().decode(bytes)) : parseBinaryStl(bytes);
  if (trianglePoints.length === 0) throw new BrowserCadError('BROWSER_CAD_INVALID', 'STL contains no readable triangles.');
  const vertices: Array<[number, number, number]> = [];
  const triangles: Array<[number, number, number]> = [];
  const known = new Map<string, number>();
  for (const triangle of trianglePoints) triangles.push(triangle.map((point) => indexFor(point, vertices, known)) as [number, number, number]);
  return { bodyId: `body:stl:${sourceHash.slice(7, 19)}`, fileName, format: 'STL', sourceHash, vertices, triangles };
}

function parseAsciiStl(text: string): Array<Array<[number, number, number]>> {
  const values = [...text.matchAll(/\bvertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/gi)].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number]);
  if (values.some((point) => point.some((value) => !Number.isFinite(value))) || values.length % 3 !== 0) throw new BrowserCadError('BROWSER_CAD_INVALID', 'ASCII STL has malformed vertex records.');
  return Array.from({ length: values.length / 3 }, (_, index) => values.slice(index * 3, index * 3 + 3));
}

function parseBinaryStl(bytes: Uint8Array): Array<Array<[number, number, number]>> {
  if (bytes.byteLength < 84) throw new BrowserCadError('BROWSER_CAD_INVALID', 'Binary STL is shorter than its 84-byte header.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (84 + count * 50 !== bytes.byteLength) throw new BrowserCadError('BROWSER_CAD_INVALID', 'Binary STL triangle count does not match the byte length.');
  return Array.from({ length: count }, (_, triangleIndex) => Array.from({ length: 3 }, (_, vertexIndex) => {
    const offset = 84 + triangleIndex * 50 + 12 + vertexIndex * 12;
    return [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)] as [number, number, number];
  }));
}

function serializeAsciiStl(bodies: EvaluatedBody[]): string {
  const lines = ['solid caddydaddy_browser_jscad_bounded'];
  for (const body of bodies) for (const polygon of geometries.geom3.toPolygons(body.geometry)) {
    const points = geometries.poly3.toPoints(polygon) as Array<[number, number, number]>;
    for (let index = 1; index < points.length - 1; index += 1) {
      const triangle = [points[0], points[index], points[index + 1]] as const;
      lines.push(`  facet normal ${vectorText(triangleNormal(triangle))}`, '    outer loop', ...triangle.map((point) => `      vertex ${vectorText(point)}`), '    endloop', '  endfacet');
    }
  }
  lines.push('endsolid caddydaddy_browser_jscad_bounded');
  return `${lines.join('\n')}\n`;
}

function triangleNormal(points: readonly [[number, number, number], [number, number, number], [number, number, number]]): [number, number, number] {
  const [a, b, c] = points;
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: [number, number, number] = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const length = Math.hypot(...cross) || 1;
  return cross.map((value) => value / length) as [number, number, number];
}

function stitchedLoop(lines: Array<Extract<SketchEntity, { kind: 'line' }>>): Array<[number, number]> | null {
  const points: Array<[number, number]> = [[lines[0].start.x, lines[0].start.y]];
  let cursor = lines[0].end;
  points.push([cursor.x, cursor.y]);
  for (const line of lines.slice(1)) {
    if (!near(cursor.x, line.start.x) || !near(cursor.y, line.start.y)) return null;
    cursor = line.end;
    points.push([cursor.x, cursor.y]);
  }
  if (!near(points[0][0], cursor.x) || !near(points[0][1], cursor.y)) return null;
  points.pop();
  return points;
}

function uniqueGeometries(items: Geom3[]): Geom3[] { return [...new Set(items)]; }
function degrees(value: number): number { return value * Math.PI / 180; }
function near(a: number, b: number): boolean { return Math.abs(a - b) <= EPSILON; }
function pointKey(point: [number, number, number]): string { return point.map((value) => Math.round(value / EPSILON)).join(','); }
function vectorText(point: readonly number[]): string { return point.map((value) => Number(value.toFixed(9)).toString()).join(' '); }
function safeStem(value: string): string { return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'caddydaddy'; }

function indexFor(point: [number, number, number], vertices: Array<[number, number, number]>, known: Map<string, number>): number {
  const key = pointKey(point);
  const current = known.get(key);
  if (current !== undefined) return current;
  const index = vertices.length;
  vertices.push([Number(point[0]), Number(point[1]), Number(point[2])]);
  known.set(key, index);
  return index;
}

function colorFor(id: string): string {
  let seed = 0;
  for (const character of id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return ['#6b9f8a', '#d08b54', '#6689a8', '#b07878', '#8b8f5a', '#756f9d'][seed % 6];
}

function diagnostic(severity: CadDiagnostic['severity'], code: string, message: string, operationId: string | null, entityIds: string[] = []): CadDiagnostic {
  return { id: `browser:${code}:${operationId ?? 'document'}:${entityIds.join(',')}`, severity, code, message, operationId, entityIds };
}

function unsupported(feature: FeatureOperation, message: string): BrowserCadError {
  return new BrowserCadError('BROWSER_CAD_UNSUPPORTED', message, [diagnostic('error', 'CONNECTED_OCCT_REQUIRED', message, feature.id)]);
}

function invalidEntity(entityId: string, operationId: string, message: string): BrowserCadError {
  return new BrowserCadError('BROWSER_CAD_INVALID', message, [diagnostic('error', 'INVALID_SKETCH_ENTITY', message, operationId, [entityId])]);
}

function requireStl(format: CadImportRequest['format'], action: 'import' | 'export'): void {
  if (format === 'STL') return;
  throw new BrowserCadError('BROWSER_CAD_UNSUPPORTED', `${format} ${action} requires the connected OCCT service and repository-owner approval for its native runtime. BROWSER_JSCAD_BOUNDED supports real STL mesh ${action} only.`, [diagnostic('error', 'CONNECTED_OCCT_EXCHANGE_REQUIRED', `No ${format} bytes were fabricated.`, null)]);
}

function decodeBase64(value: string): Uint8Array {
  try { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
  catch { throw new BrowserCadError('BROWSER_CAD_INVALID', 'CAD import payload is not valid base64.'); }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function hashCanonical(value: unknown): Promise<string> { return sha256(new TextEncoder().encode(canonical(value))); }
async function sha256(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', input.buffer);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}
