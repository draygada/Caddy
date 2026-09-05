/** Runtime-only PartDocument presentation contract. No fixture geometry lives here. */
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
  assert(scene.model === INTERNAL_RENDER_MODEL, "SCENE_VERSION_UNSUPPORTED", `Unsupported internal render model: ${String(scene.model)}`);
  assert(scene.documentKind === "PART", "SCENE_KIND_INVALID", "Only PartDocument render scenes are admitted.");
  assertNonEmpty(scene.documentId, "documentId");
  assertNonEmpty(scene.revisionId, "revisionId");
  assert(Array.isArray(scene.nodes) && scene.nodes.length > 0, "SCENE_EMPTY", "Render scene must include at least one mesh node.");
  const nodeIds = new Set();
  const bodyIds = new Set();
  const entityIds = new Set();
  const referenceIds = new Set();
  for (const node of scene.nodes) {
    validateNode(node, scene, nodeIds, entityIds, referenceIds);
    assert(!bodyIds.has(node.bodyId), "SCENE_BODY_DUPLICATE", `Duplicate PartDocument body ${node.bodyId}.`);
    nodeIds.add(node.nodeId);
    bodyIds.add(node.bodyId);
  }
  return scene;
}

function validateNode(node, scene, nodeIds, entityIds, referenceIds) {
  assert(node && typeof node === "object", "SCENE_NODE_INVALID", "Scene node must be an object.");
  assertNonEmpty(node.nodeId, "nodeId");
  assert(!nodeIds.has(node.nodeId), "SCENE_NODE_DUPLICATE", `Duplicate render node ${node.nodeId}.`);
  assert(node.kind === "BODY", "SCENE_NODE_KIND_INVALID", `PartDocument node ${node.nodeId} must be a BODY.`);
  assertNonEmpty(node.label, "label");
  assert(typeof node.visible === "boolean", "SCENE_VISIBILITY_INVALID", `Node ${node.nodeId} visibility must be boolean.`);
  assertNonEmpty(node.bodyId, "bodyId");
  assert(node.parentNodeId == null, "SCENE_HIERARCHY_UNSUPPORTED", `PartDocument body ${node.nodeId} cannot declare component hierarchy.`);
  assert(node.componentId == null, "SCENE_IDENTITY_AMBIGUOUS", `Body ${node.nodeId} cannot also be a component instance.`);
  assert(node.partDefinitionId == null, "SCENE_IDENTITY_AMBIGUOUS", `Body ${node.nodeId} cannot declare an Assembly part definition.`);
  assert(node.metadata && typeof node.metadata === "object", "SCENE_PROVENANCE_MISSING", `Node ${node.nodeId} is missing source provenance.`);
  assert(node.metadata.sourceDocumentId === scene.documentId, "SCENE_PROVENANCE_MISMATCH", `Node ${node.nodeId} source document does not match.`);
  assert(node.metadata.sourceRevisionId === scene.revisionId, "SCENE_PROVENANCE_MISMATCH", `Node ${node.nodeId} source revision does not match.`);
  validateTransform(node.transform, node.nodeId);
  validateMesh(node.mesh, node.nodeId, entityIds, referenceIds);
}

function validateTransform(transform, nodeId) {
  assert(transform && typeof transform === "object", "SCENE_TRANSFORM_INVALID", `Node ${nodeId} is missing a fixed transform.`);
  for (const key of ["translation", "rotationDegrees", "scale"]) {
    const value = transform[key];
    assert(Array.isArray(value) && value.length === 3 && value.every(Number.isFinite), "SCENE_TRANSFORM_INVALID", `Node ${nodeId} ${key} must have three finite components.`);
  }
  assert(transform.scale.every((value) => value !== 0), "SCENE_TRANSFORM_INVALID", `Node ${nodeId} scale cannot contain zero.`);
}

function validateMesh(mesh, nodeId, entityIds, referenceIds) {
  assert(mesh && typeof mesh === "object", "SCENE_MESH_INVALID", `Node ${nodeId} is missing mesh data.`);
  const positions = numericArray(mesh.positions, `${nodeId}.positions`);
  const normals = numericArray(mesh.normals, `${nodeId}.normals`);
  const indices = numericArray(mesh.indices, `${nodeId}.indices`);
  assert(positions.length > 0 && positions.length % 3 === 0, "SCENE_MESH_INVALID", `Node ${nodeId} positions are invalid.`);
  assert(normals.length === positions.length, "SCENE_MESH_INVALID", `Node ${nodeId} normals must match positions.`);
  assert(indices.length > 0 && indices.length % 3 === 0, "SCENE_MESH_INVALID", `Node ${nodeId} indices are invalid.`);
  const vertexCount = positions.length / 3;
  assert(indices.every((value) => Number.isInteger(value) && value >= 0 && value < vertexCount), "SCENE_MESH_INDEX_INVALID", `Node ${nodeId} has an invalid mesh index.`);
  assert(Array.isArray(mesh.entityRanges) && mesh.entityRanges.length > 0, "SCENE_ENTITY_MAP_MISSING", `Node ${nodeId} must include stable entity mappings.`);
  const occupancy = new Uint8Array(indices.length / 3);
  for (const range of mesh.entityRanges) {
    assertNonEmpty(range.entityId, "entityId");
    assertNonEmpty(range.semanticReferenceId, "semanticReferenceId");
    assertNonEmpty(range.featureId, "featureId");
    assert(Number.isInteger(range.startTriangle) && range.startTriangle >= 0, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} has an invalid range start.`);
    assert(Number.isInteger(range.triangleCount) && range.triangleCount > 0, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} has an invalid range count.`);
    assert(range.startTriangle + range.triangleCount <= occupancy.length, "SCENE_ENTITY_RANGE_INVALID", `Node ${nodeId} range exceeds the mesh.`);
    for (let index = range.startTriangle; index < range.startTriangle + range.triangleCount; index += 1) {
      occupancy[index] += 1;
      assert(occupancy[index] === 1, "SCENE_ENTITY_RANGE_AMBIGUOUS", `Node ${nodeId} maps one triangle twice.`);
    }
    assert(!entityIds.has(range.entityId), "SCENE_ENTITY_DUPLICATE", `Duplicate stable entity ${range.entityId}.`);
    assert(!referenceIds.has(range.semanticReferenceId), "SCENE_SEMANTIC_REFERENCE_DUPLICATE", `Duplicate semantic reference ${range.semanticReferenceId}.`);
    entityIds.add(range.entityId);
    referenceIds.add(range.semanticReferenceId);
  }
}

export function resolveStableEntity(node, triangleIndex) {
  if (!Number.isInteger(triangleIndex) || triangleIndex < 0) return { ok: false, code: "SELECTION_TRIANGLE_INVALID", target: null };
  const matches = node.mesh.entityRanges.filter((range) => triangleIndex >= range.startTriangle && triangleIndex < range.startTriangle + range.triangleCount);
  if (matches.length === 0) return { ok: false, code: "SELECTION_MAPPING_MISSING", target: null };
  if (matches.length !== 1) return { ok: false, code: "SELECTION_MAPPING_AMBIGUOUS", target: null };
  return { ok: true, code: null, target: stableTarget(node, matches[0]) };
}

export function rebindStableTarget(scene, target) {
  if (!scene || !Array.isArray(scene.nodes) || !target || typeof target !== "object") return { ok: false, code: "SELECTION_TARGET_INVALID", target: null };
  const nodeId = typeof target.nodeId === "string" && target.nodeId ? target.nodeId : null;
  const bodyId = typeof target.bodyId === "string" && target.bodyId ? target.bodyId : null;
  if (!nodeId && !bodyId) return { ok: false, code: "SELECTION_TARGET_INVALID", target: null };
  const nodes = scene.nodes.filter((node) => (!nodeId || node.nodeId === nodeId) && (!bodyId || node.bodyId === bodyId));
  if (nodes.length === 0) return { ok: false, code: "SELECTION_NODE_MISSING", target: null };
  if (nodes.length !== 1) return { ok: false, code: "SELECTION_NODE_AMBIGUOUS", target: null };
  const node = nodes[0];
  if (target.entityId == null && target.semanticReferenceId == null) return { ok: true, code: null, target: stableTarget(node) };
  if (!target.entityId || !target.semanticReferenceId) return { ok: false, code: "SELECTION_IDENTITY_INVALID", target: null };
  const ranges = node.mesh.entityRanges.filter((range) => range.entityId === target.entityId && range.semanticReferenceId === target.semanticReferenceId);
  if (ranges.length === 0) return { ok: false, code: "SELECTION_MAPPING_MISSING", target: null };
  if (ranges.length !== 1) return { ok: false, code: "SELECTION_MAPPING_AMBIGUOUS", target: null };
  return { ok: true, code: null, target: stableTarget(node, ranges[0]) };
}

export function stableTargets(scene, visibleNodeIds = null) {
  const visible = visibleNodeIds ? new Set(visibleNodeIds) : null;
  return scene.nodes.flatMap((node) => !node.visible || (visible && !visible.has(node.nodeId)) ? [] : node.mesh.entityRanges.map((range) => stableTarget(node, range)));
}

function stableTarget(node, range = null) {
  return { nodeId: node.nodeId, nodeKind: node.kind, bodyId: node.bodyId ?? null, entityId: range?.entityId ?? null, semanticReferenceId: range?.semanticReferenceId ?? null, featureId: range?.featureId ?? null, startTriangle: range?.startTriangle ?? 0, triangleCount: range?.triangleCount ?? node.mesh.indices.length / 3 };
}

function numericArray(value, field) {
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
