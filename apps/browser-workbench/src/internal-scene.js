/**
 * Lane-internal render model.
 *
 * This is deliberately not a shared wire contract. It is a private PartDocument presentation
 * shape for exercising the committed browser-workbench contract without claiming compatibility
 * with a core-kernel packet. Every body transform is explicit in the document frame.
 */

export const INTERNAL_RENDER_MODEL = "forge.browser-render-scene/internal-1";

export class RenderSceneError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RenderSceneError";
    this.code = code;
    this.details = details;
  }
}

export function validateRenderScene(scene) {
  assert(scene && typeof scene === "object", "SCENE_INVALID", "Render scene must be an object.");
  assert(
    scene.model === INTERNAL_RENDER_MODEL,
    "SCENE_VERSION_UNSUPPORTED",
    `Unsupported internal render model: ${String(scene.model)}`,
  );
  assert(scene.documentKind === "PART", "SCENE_KIND_INVALID", "Only PartDocument render scenes are admitted.");
  assertNonEmpty(scene.documentId, "documentId");
  assertNonEmpty(scene.revisionId, "revisionId");
  assert(Array.isArray(scene.nodes) && scene.nodes.length > 0, "SCENE_EMPTY", "Render scene must include at least one mesh node.");

  const nodeIds = new Set();
  const bodyIds = new Set();
  for (const node of scene.nodes) {
    validateNode(node, nodeIds);
    assert(!bodyIds.has(node.bodyId), "SCENE_BODY_DUPLICATE", `Duplicate PartDocument body ${node.bodyId}.`);
    nodeIds.add(node.nodeId);
    bodyIds.add(node.bodyId);
  }

  return scene;
}

function validateNode(node, existingIds) {
  assert(node && typeof node === "object", "SCENE_NODE_INVALID", "Scene node must be an object.");
  assertNonEmpty(node.nodeId, "nodeId");
  assert(!existingIds.has(node.nodeId), "SCENE_NODE_DUPLICATE", `Duplicate render node ${node.nodeId}.`);
  assert(node.kind === "BODY", "SCENE_NODE_KIND_INVALID", `PartDocument node ${node.nodeId} must be a BODY.`);
  assertNonEmpty(node.label, "label");
  assert(typeof node.visible === "boolean", "SCENE_VISIBILITY_INVALID", `Node ${node.nodeId} visibility must be boolean.`);
  assertNonEmpty(node.bodyId, "bodyId");
  assert(node.parentNodeId === null || node.parentNodeId === undefined, "SCENE_HIERARCHY_UNSUPPORTED", `PartDocument body ${node.nodeId} cannot declare component hierarchy.`);
  assert(node.componentId === null || node.componentId === undefined, "SCENE_IDENTITY_AMBIGUOUS", `Body ${node.nodeId} cannot also be a component instance.`);
  assert(node.partDefinitionId === null || node.partDefinitionId === undefined, "SCENE_IDENTITY_AMBIGUOUS", `Body ${node.nodeId} cannot declare an Assembly part definition.`);
  assert(node.metadata && typeof node.metadata === "object", "SCENE_PROVENANCE_MISSING", `Node ${node.nodeId} is missing source provenance.`);
  assertNonEmpty(node.metadata.sourceDocumentId, "sourceDocumentId");
  assertNonEmpty(node.metadata.sourceRevisionId, "sourceRevisionId");
  validateTransform(node.transform, node.nodeId);
  validateMesh(node.mesh, node.nodeId);
}

function validateTransform(transform, nodeId) {
  assert(transform && typeof transform === "object", "SCENE_TRANSFORM_INVALID", `Node ${nodeId} is missing a fixed transform.`);
  for (const key of ["translation", "rotationDegrees", "scale"]) {
    const value = transform[key];
    assert(Array.isArray(value) && value.length === 3, "SCENE_TRANSFORM_INVALID", `Node ${nodeId} ${key} must have three components.`);
    assert(value.every(Number.isFinite), "SCENE_TRANSFORM_INVALID", `Node ${nodeId} ${key} must be finite.`);
  }
  assert(transform.scale.every((value) => value !== 0), "SCENE_TRANSFORM_INVALID", `Node ${nodeId} scale cannot contain zero.`);
}

function validateMesh(mesh, nodeId) {
  assert(mesh && typeof mesh === "object", "SCENE_MESH_INVALID", `Node ${nodeId} is missing mesh data.`);
  const positions = asNumericArray(mesh.positions, `${nodeId}.positions`);
  const normals = asNumericArray(mesh.normals, `${nodeId}.normals`);
  const indices = asNumericArray(mesh.indices, `${nodeId}.indices`);
  assert(positions.length > 0 && positions.length % 3 === 0, "SCENE_MESH_INVALID", `Node ${nodeId} positions must be non-empty XYZ triples.`);
  assert(normals.length === positions.length, "SCENE_MESH_INVALID", `Node ${nodeId} normals must match positions.`);
  assert(indices.length > 0 && indices.length % 3 === 0, "SCENE_MESH_INVALID", `Node ${nodeId} indices must be non-empty triangles.`);
  const vertexCount = positions.length / 3;
  assert(indices.every((value) => Number.isInteger(value) && value >= 0 && value < vertexCount), "SCENE_MESH_INDEX_INVALID", `Node ${nodeId} has an out-of-range mesh index.`);
  assert(Array.isArray(mesh.entityRanges) && mesh.entityRanges.length > 0, "SCENE_ENTITY_MAP_MISSING", `Node ${nodeId} must include stable entity mappings.`);

  const triangleCount = indices.length / 3;
  const occupancy = new Uint8Array(triangleCount);
  for (const range of mesh.entityRanges) {
    assertNonEmpty(range.entityId, "entityId");
    assertNonEmpty(range.semanticReferenceId, "semanticReferenceId");
    assertNonEmpty(range.featureId, "featureId");
    assert(Number.isInteger(range.startTriangle) && range.startTriangle >= 0, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} has an invalid entity range start.`);
    assert(Number.isInteger(range.triangleCount) && range.triangleCount > 0, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} has an invalid entity range count.`);
    assert(range.startTriangle + range.triangleCount <= triangleCount, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} entity range exceeds the mesh.`);
    for (let index = range.startTriangle; index < range.startTriangle + range.triangleCount; index += 1) {
      occupancy[index] += 1;
      assert(occupancy[index] === 1, "SCENE_ENTITY_RANGE_AMBIGUOUS", `Node ${nodeId} maps triangle ${index} to multiple stable entities.`);
    }
  }
}

export function resolveStableEntity(node, triangleIndex) {
  if (!Number.isInteger(triangleIndex) || triangleIndex < 0) {
    return { ok: false, code: "SELECTION_TRIANGLE_INVALID", target: null };
  }
  const matches = node.mesh.entityRanges.filter(
    (range) => triangleIndex >= range.startTriangle && triangleIndex < range.startTriangle + range.triangleCount,
  );
  if (matches.length === 0) {
    return { ok: false, code: "SELECTION_MAPPING_MISSING", target: null };
  }
  if (matches.length !== 1) {
    return { ok: false, code: "SELECTION_MAPPING_AMBIGUOUS", target: null };
  }
  const range = matches[0];
  return {
    ok: true,
    code: null,
    target: {
      nodeId: node.nodeId,
      nodeKind: node.kind,
      bodyId: node.bodyId ?? null,
      entityId: range.entityId,
      semanticReferenceId: range.semanticReferenceId,
      featureId: range.featureId,
      startTriangle: range.startTriangle,
      triangleCount: range.triangleCount,
    },
  };
}

export function stableTargets(scene, visibleNodeIds = null) {
  const visible = visibleNodeIds ? new Set(visibleNodeIds) : null;
  return scene.nodes.flatMap((node) => {
    if (!node.visible || (visible && !visible.has(node.nodeId))) return [];
    return node.mesh.entityRanges.map((range) => ({
      nodeId: node.nodeId,
      nodeKind: node.kind,
      bodyId: node.bodyId ?? null,
      entityId: range.entityId,
      semanticReferenceId: range.semanticReferenceId,
      featureId: range.featureId,
      startTriangle: range.startTriangle,
      triangleCount: range.triangleCount,
    }));
  });
}

function asNumericArray(value, field) {
  assert(Array.isArray(value) || ArrayBuffer.isView(value), "SCENE_MESH_INVALID", `${field} must be a numeric array.`);
  assert(value.every(Number.isFinite), "SCENE_MESH_INVALID", `${field} must contain finite numbers.`);
  return value;
}

function assertNonEmpty(value, field) {
  assert(typeof value === "string" && value.trim() !== "", "SCENE_ID_INVALID", `${field} must be a non-empty string.`);
}

function assert(condition, code, message, details = {}) {
  if (!condition) throw new RenderSceneError(code, message, details);
}

export function createFixtureRenderScenes() {
  const bracket = createBracketMesh("op:fillet");
  const jaw = createJawMesh("op:chamfer");

  const part = {
    model: INTERNAL_RENDER_MODEL,
    documentKind: "PART",
    documentId: "part:fixture-motor-mount",
    revisionId: "part-rev:fixture-8f2e7a1",
    label: "Motor mount · Part",
    nodes: [
      renderNode({
        nodeId: "body:mount-primary",
        kind: "BODY",
        label: "Mount body",
        bodyId: "body:mount-primary",
        mesh: bracket,
        color: "#6f858f",
        material: "6061-T6 aluminum",
        sourceDocumentId: "part:fixture-motor-mount",
        sourceRevisionId: "part-rev:fixture-8f2e7a1",
      }),
      renderNode({
        nodeId: "body:clamp-jaw",
        kind: "BODY",
        label: "Clamp jaw",
        bodyId: "body:clamp-jaw",
        mesh: jaw,
        color: "#9b7352",
        material: "A2 tool steel",
        sourceDocumentId: "part:fixture-motor-mount",
        sourceRevisionId: "part-rev:fixture-8f2e7a1",
        transform: fixedTransform([0, 29, -8], [0, 0, 0]),
      }),
    ],
  };

  return {
    part: validateRenderScene(part),
  };
}

function renderNode({
  nodeId,
  kind,
  label,
  mesh,
  color,
  material,
  sourceDocumentId,
  sourceRevisionId,
  transform = fixedTransform(),
  bodyId,
}) {
  return {
    nodeId,
    kind: "BODY",
    label,
    bodyId,
    visible: true,
    transform,
    mesh,
    appearance: { color, opacity: 1 },
    metadata: {
      material,
      mass: { value: null, unit: "kg", evidence: "PLACEHOLDER" },
      sourceDocumentId,
      sourceRevisionId,
    },
  };
}

export function fixedTransform(translation = [0, 0, 0], rotationDegrees = [0, 0, 0], scale = [1, 1, 1]) {
  return { translation: [...translation], rotationDegrees: [...rotationDegrees], scale: [...scale] };
}

function meshBuilder() {
  return { positions: [], normals: [], indices: [], entityRanges: [] };
}

function appendFace(builder, points, metadata) {
  const startVertex = builder.positions.length / 3;
  const a = subtract(points[1], points[0]);
  const b = subtract(points[2], points[0]);
  const normal = normalize(cross(a, b));
  for (const point of points) {
    builder.positions.push(...point);
    builder.normals.push(...normal);
  }
  const startTriangle = builder.indices.length / 3;
  for (let index = 1; index < points.length - 1; index += 1) {
    builder.indices.push(startVertex, startVertex + index, startVertex + index + 1);
  }
  builder.entityRanges.push({
    startTriangle,
    triangleCount: points.length - 2,
    entityId: metadata.entityId,
    semanticReferenceId: metadata.semanticReferenceId,
    featureId: metadata.featureId,
  });
}

function appendBox(builder, min, max, namespace, featureId) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const faces = [
    ["front", [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    ["back", [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    ["left", [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
    ["right", [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
    ["top", [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
    ["bottom", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
  ];
  for (const [role, points] of faces) {
    appendFace(builder, points, {
      entityId: `entity:${namespace}:${role}`,
      semanticReferenceId: `ref:${namespace}:${role}`,
      featureId,
    });
  }
}

function appendTriangularPrism(builder, x0, x1, yz, namespace, featureId) {
  const a = [x0, yz[0][0], yz[0][1]];
  const b = [x0, yz[1][0], yz[1][1]];
  const c = [x0, yz[2][0], yz[2][1]];
  const d = [x1, yz[0][0], yz[0][1]];
  const e = [x1, yz[1][0], yz[1][1]];
  const f = [x1, yz[2][0], yz[2][1]];
  const faces = [
    ["end:left", [a, c, b]],
    ["end:right", [d, e, f]],
    ["side:base", [a, b, e, d]],
    ["side:upright", [b, c, f, e]],
    ["side:slope", [c, a, d, f]],
  ];
  for (const [role, points] of faces) {
    appendFace(builder, points, {
      entityId: `entity:${namespace}:${role}`,
      semanticReferenceId: `ref:${namespace}:${role}`,
      featureId,
    });
  }
}

function createBracketMesh(featureId) {
  const builder = meshBuilder();
  appendBox(builder, [-32, -4, -21], [32, 4, 21], "mount-base", "op:extrude-base");
  appendBox(builder, [-32, 4, 13], [32, 48, 21], "mount-upright", "op:extrude-upright");
  appendTriangularPrism(builder, -27, -20, [[4, -4], [4, 13], [29, 13]], "gusset-left", featureId);
  appendTriangularPrism(builder, 20, 27, [[4, -4], [4, 13], [29, 13]], "gusset-right", featureId);
  return builder;
}

function createJawMesh(featureId) {
  const builder = meshBuilder();
  appendBox(builder, [-27, -6, -6], [27, 6, 6], "jaw-main", "op:extrude-jaw");
  appendBox(builder, [-23, 6, -4], [-13, 12, 4], "jaw-lug-left", featureId);
  appendBox(builder, [13, 6, -4], [23, 12, 4], "jaw-lug-right", featureId);
  return builder;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}
