import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  INTERNAL_RENDER_MODEL,
  createFixtureRenderScenes,
  resolveStableEntity,
  stableTargets,
  validateRenderScene,
} from "../../apps/browser-workbench/src/internal-scene.js";

const template = createFixtureRenderScenes().part;
const repeatCount = 1_280;
const nodes = [];

for (let occurrence = 0; occurrence < repeatCount; occurrence += 1) {
  for (const source of template.nodes) {
    const node = structuredClone(source);
    node.nodeId = `body:perf-${occurrence}:${source.bodyId}`;
    node.bodyId = node.nodeId;
    for (const range of node.mesh.entityRanges) {
      range.entityId = `${range.entityId}:perf-${occurrence}`;
      range.semanticReferenceId = `${range.semanticReferenceId}:perf-${occurrence}`;
    }
    node.transform.translation = [
      source.transform.translation[0] + (occurrence % 16) * 80,
      source.transform.translation[1] + Math.floor(occurrence / 16) * 80,
      source.transform.translation[2],
    ];
    nodes.push(node);
  }
}

const scene = {
  model: INTERNAL_RENDER_MODEL,
  documentKind: "PART",
  documentId: "part:synthetic-performance-target",
  revisionId: "part-rev:synthetic-performance-target",
  nodes,
};

const triangleCount = nodes.reduce((total, node) => total + node.mesh.indices.length / 3, 0);
assert.ok(triangleCount >= 95_000, `Expected at least 95k triangles, received ${triangleCount}`);

const validationStart = performance.now();
validateRenderScene(scene);
const validationMs = performance.now() - validationStart;

const traversalStart = performance.now();
const targets = stableTargets(scene);
const traversalMs = performance.now() - traversalStart;

const selectionStart = performance.now();
for (let index = 0; index < 5_000; index += 1) {
  const node = nodes[index % nodes.length];
  const range = node.mesh.entityRanges[index % node.mesh.entityRanges.length];
  const resolved = resolveStableEntity(node, range.startTriangle);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.target.nodeId, node.nodeId);
}
const selectionMs = performance.now() - selectionStart;

const budgets = {
  validationMs: 3_000,
  traversalMs: 1_500,
  selection5000Ms: 1_000,
};
assert.ok(validationMs < budgets.validationMs, `Scene validation exceeded ${budgets.validationMs} ms`);
assert.ok(traversalMs < budgets.traversalMs, `Stable-target traversal exceeded ${budgets.traversalMs} ms`);
assert.ok(selectionMs < budgets.selection5000Ms, `Stable selection exceeded ${budgets.selection5000Ms} ms`);

console.log(JSON.stringify({
  evidence: "synthetic PartDocument render-model performance target",
  nodeCount: nodes.length,
  triangleCount,
  stableTargetCount: targets.length,
  timingsMs: {
    validation: Number(validationMs.toFixed(2)),
    traversal: Number(traversalMs.toFixed(2)),
    selection5000: Number(selectionMs.toFixed(2)),
  },
  budgetsMs: budgets,
}, null, 2));
