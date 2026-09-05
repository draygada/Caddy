import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERNAL_RENDER_MODEL,
  RenderSceneError,
  createFixtureRenderScenes,
  rebindStableTarget,
  resolveStableEntity,
  stableTargets,
  validateRenderScene,
} from "../../apps/browser-workbench/src/internal-scene.js";
import { createInternalWorkbenchFixture } from "../../apps/browser-workbench/src/internal-fixture.js";

function expectSceneError(code) {
  return (error) => error instanceof RenderSceneError && error.code === code;
}

function reorderTriangleGroups(node) {
  const oldIndices = node.mesh.indices;
  const ranges = [...node.mesh.entityRanges].reverse();
  const indices = [];
  const entityRanges = [];
  for (const range of ranges) {
    const nextRange = structuredClone(range);
    nextRange.startTriangle = indices.length / 3;
    indices.push(...oldIndices.slice(range.startTriangle * 3, (range.startTriangle + range.triangleCount) * 3));
    entityRanges.push(nextRange);
  }
  node.mesh.indices = indices;
  node.mesh.entityRanges = entityRanges;
}

test("fixture contains a multi-body PartDocument scene with aligned source revision", () => {
  const { part } = createFixtureRenderScenes();
  const fixture = createInternalWorkbenchFixture();

  assert.equal(part.model, INTERNAL_RENDER_MODEL);
  assert.equal(part.documentKind, "PART");
  assert.equal(part.nodes.length, 2);
  assert.equal(fixture.document.scene.documentId, part.documentId);
  assert.equal(fixture.document.scene.revisionId, part.revisionId);
  assert.equal(fixture.document.revisionId, fixture.states.current.displayedRevisionId);
  assert.ok(part.nodes.every((node) => node.kind === "BODY" && node.bodyId && !node.componentId && !node.partDefinitionId));

  for (const node of part.nodes) {
    assert.ok(node.mesh.positions.length > 0);
    assert.ok(node.mesh.indices.length > 0);
    assert.deepEqual(Object.keys(node.transform).sort(), ["rotationDegrees", "scale", "translation"]);
    assert.ok(node.metadata.sourceDocumentId);
    assert.ok(node.metadata.sourceRevisionId);
    assert.equal(node.metadata.mass.evidence, "PLACEHOLDER");
  }
});

test("every displayed Part entity resolves to an operation present in the PartDocument", () => {
  const fixture = createInternalWorkbenchFixture();
  const operationIds = new Set(fixture.document.operations.map((operation) => operation.operationId));
  const featureIds = fixture.document.scene.nodes.flatMap((node) => node.mesh.entityRanges.map((range) => range.featureId));
  assert.ok(featureIds.length > 0);
  assert.ok(featureIds.every((featureId) => operationIds.has(featureId)));
});

test("PartDocument validation rejects node provenance outside the enclosing document and revision", () => {
  const wrongDocument = structuredClone(createFixtureRenderScenes().part);
  wrongDocument.nodes[0].metadata.sourceDocumentId = "part:other-document";
  assert.throws(() => validateRenderScene(wrongDocument), expectSceneError("SCENE_PROVENANCE_MISMATCH"));

  const wrongRevision = structuredClone(createFixtureRenderScenes().part);
  wrongRevision.nodes[1].metadata.sourceRevisionId = "part-rev:other-revision";
  assert.throws(() => validateRenderScene(wrongRevision), expectSceneError("SCENE_PROVENANCE_MISMATCH"));
});

test("PartDocument validation rejects duplicate stable identities across bodies", () => {
  const duplicateEntity = structuredClone(createFixtureRenderScenes().part);
  duplicateEntity.nodes[1].mesh.entityRanges[0].entityId = duplicateEntity.nodes[0].mesh.entityRanges[0].entityId;
  assert.throws(() => validateRenderScene(duplicateEntity), expectSceneError("SCENE_ENTITY_DUPLICATE"));

  const duplicateReference = structuredClone(createFixtureRenderScenes().part);
  duplicateReference.nodes[1].mesh.entityRanges[0].semanticReferenceId = duplicateReference.nodes[0].mesh.entityRanges[0].semanticReferenceId;
  assert.throws(() => validateRenderScene(duplicateReference), expectSceneError("SCENE_SEMANTIC_REFERENCE_DUPLICATE"));
});

test("stable selection survives body, triangle-group, and entity-range reordering", () => {
  const source = createFixtureRenderScenes().part;
  const sourceNode = source.nodes.find((node) => node.nodeId === "body:mount-primary");
  const wanted = sourceNode.mesh.entityRanges.find((range) => range.entityId === "entity:mount-upright:top");
  const before = resolveStableEntity(sourceNode, wanted.startTriangle);
  assert.equal(before.ok, true);

  const reordered = structuredClone(source);
  reordered.nodes.reverse();
  const reorderedNode = reordered.nodes.find((node) => node.nodeId === sourceNode.nodeId);
  reorderTriangleGroups(reorderedNode);
  validateRenderScene(reordered);

  const relocated = reorderedNode.mesh.entityRanges.find((range) => range.entityId === wanted.entityId);
  assert.notEqual(relocated.startTriangle, before.target.startTriangle);
  const rebound = rebindStableTarget(reordered, before.target);
  assert.equal(rebound.ok, true);
  assert.equal(rebound.target.startTriangle, relocated.startTriangle);
  assert.equal(rebound.target.triangleCount, relocated.triangleCount);
  const after = resolveStableEntity(reorderedNode, rebound.target.startTriangle);
  assert.equal(after.ok, true);
  assert.deepEqual(
    {
      nodeId: after.target.nodeId,
      componentId: after.target.componentId,
      partDefinitionId: after.target.partDefinitionId,
      entityId: after.target.entityId,
      semanticReferenceId: after.target.semanticReferenceId,
      featureId: after.target.featureId,
    },
    {
      nodeId: before.target.nodeId,
      componentId: before.target.componentId,
      partDefinitionId: before.target.partDefinitionId,
      entityId: before.target.entityId,
      semanticReferenceId: before.target.semanticReferenceId,
      featureId: before.target.featureId,
    },
  );
});

test("selection fails closed when a triangle mapping is missing or ambiguous", () => {
  const node = structuredClone(createFixtureRenderScenes().part.nodes[0]);
  const removed = node.mesh.entityRanges.shift();
  validateRenderScene({
    model: INTERNAL_RENDER_MODEL,
    documentKind: "PART",
    documentId: node.metadata.sourceDocumentId,
    revisionId: node.metadata.sourceRevisionId,
    nodes: [node],
  });

  assert.deepEqual(resolveStableEntity(node, removed.startTriangle), {
    ok: false,
    code: "SELECTION_MAPPING_MISSING",
    target: null,
  });

  const mapped = node.mesh.entityRanges[0];
  node.mesh.entityRanges.push({
    ...mapped,
    entityId: "entity:ambiguous",
    semanticReferenceId: "ref:ambiguous",
  });
  assert.deepEqual(resolveStableEntity(node, mapped.startTriangle), {
    ok: false,
    code: "SELECTION_MAPPING_AMBIGUOUS",
    target: null,
  });
});

test("scene validation rejects missing maps, overlapping ranges, and non-PartDocument identity", () => {
  const base = createFixtureRenderScenes();

  const missing = structuredClone(base.part);
  missing.nodes[0].mesh.entityRanges = [];
  assert.throws(() => validateRenderScene(missing), expectSceneError("SCENE_ENTITY_MAP_MISSING"));

  const overlap = structuredClone(base.part);
  const first = overlap.nodes[0].mesh.entityRanges[0];
  overlap.nodes[0].mesh.entityRanges.push({ ...first, entityId: "entity:duplicate" });
  assert.throws(() => validateRenderScene(overlap), expectSceneError("SCENE_ENTITY_RANGE_AMBIGUOUS"));

  const duplicateBody = structuredClone(base.part);
  duplicateBody.nodes[1].bodyId = duplicateBody.nodes[0].bodyId;
  assert.throws(() => validateRenderScene(duplicateBody), expectSceneError("SCENE_BODY_DUPLICATE"));

  const confused = structuredClone(base.part);
  confused.nodes[0].kind = "COMPONENT";
  confused.nodes[0].componentId = "component:not-a-body";
  confused.nodes[0].partDefinitionId = "part-definition:not-a-body";
  confused.nodes[0].bodyId = null;
  assert.throws(() => validateRenderScene(confused), expectSceneError("SCENE_NODE_KIND_INVALID"));

  const assembly = structuredClone(base.part);
  assembly.documentKind = "ASSEMBLY";
  assert.throws(() => validateRenderScene(assembly), expectSceneError("SCENE_KIND_INVALID"));

  const hierarchical = structuredClone(base.part);
  hierarchical.nodes[0].parentNodeId = hierarchical.nodes[1].nodeId;
  assert.throws(() => validateRenderScene(hierarchical), expectSceneError("SCENE_HIERARCHY_UNSUPPORTED"));
});

test("stable target traversal honors both source visibility and isolate masks", () => {
  const scene = structuredClone(createFixtureRenderScenes().part);
  scene.nodes[0].visible = false;
  const targets = stableTargets(scene, ["body:clamp-jaw"]);
  assert.ok(targets.length > 0);
  assert.ok(targets.every((target) => target.nodeId === "body:clamp-jaw"));
  assert.ok(targets.every((target) => target.entityId && target.semanticReferenceId && target.featureId));
});
