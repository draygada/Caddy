import assert from "node:assert/strict";
import test from "node:test";

import { createInternalWorkbenchFixture } from "../../apps/browser-workbench/src/internal-fixture.js";
import { resolveStableEntity } from "../../apps/browser-workbench/src/internal-scene.js";
import { WorkbenchStore } from "../../apps/browser-workbench/src/workbench-store.js";

function mediaQuery(matches = false) {
  const listeners = new Set();
  return {
    matches,
    addEventListener(_name, listener) { listeners.add(listener); },
    removeEventListener(_name, listener) { listeners.delete(listener); },
    set(next) {
      this.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

function reorderTriangleGroups(node) {
  const oldIndices = node.mesh.indices;
  const ranges = [...node.mesh.entityRanges].reverse();
  node.mesh.indices = [];
  node.mesh.entityRanges = ranges.map((range) => {
    const nextRange = structuredClone(range);
    nextRange.startTriangle = node.mesh.indices.length / 3;
    node.mesh.indices.push(...oldIndices.slice(range.startTriangle * 3, (range.startTriangle + range.triangleCount) * 3));
    return nextRange;
  });
}

test("CURRENT is editable while in-flight, LAST_VALID, and STALE states are explicitly locked", () => {
  const store = new WorkbenchStore(createInternalWorkbenchFixture(), { mobileQuery: mediaQuery() });
  assert.equal(store.evidenceState.displayState, "CURRENT");
  assert.equal(store.canEdit, true);
  store.stageOperation(store.fixture.descriptors.find((descriptor) => descriptor.type === "solid.fillet"));
  assert.equal(store.draftCount, 1);

  store.setEvidenceState("failed");
  assert.equal(store.evidenceState.displayState, "LAST_VALID");
  assert.equal(store.evidenceState.requestedRevisionId, "part-rev:fixture-bad-12d9");
  assert.equal(store.evidenceState.displayedRevisionId, "part-rev:fixture-8f2e7a1");
  assert.equal(store.canEdit, false);
  assert.throws(() => store.stagePayload("op:fillet", {}), /LAST_VALID/);

  store.setEvidenceState("stale");
  assert.equal(store.evidenceState.displayState, "STALE");
  assert.throws(() => store.stagePayload("op:fillet", {}), /STALE/);

  for (const key of ["queued", "running"]) {
    store.setEvidenceState(key);
    assert.equal(store.evidenceState.recomputeStatus, key.toUpperCase());
    assert.equal(store.evidenceState.displayState, "STALE");
    assert.equal(store.canEdit, false);
  }

});

test("mobile review-only follows media changes and blocks mutation", () => {
  const query = mediaQuery(true);
  const store = new WorkbenchStore(createInternalWorkbenchFixture(), { mobileQuery: query });
  assert.equal(store.state.mobileReviewOnly, true);
  assert.equal(store.canEdit, false);
  assert.throws(() => store.stageOperation(store.fixture.descriptors[0]), /review-only/);

  query.set(false);
  assert.equal(store.state.mobileReviewOnly, false);
  assert.equal(store.canEdit, true);
  store.dispose();
});

test("part sourcing opens through the shared bottom-panel state", () => {
  const store = new WorkbenchStore(createInternalWorkbenchFixture(), { mobileQuery: mediaQuery() });
  store.setBottomTab("sourcing");
  assert.equal(store.state.bottomTab, "sourcing");
  assert.equal(store.state.bottomCollapsed, false);
});

test("visibility and isolation preserve PartDocument-scoped state", () => {
  const fixture = createInternalWorkbenchFixture();
  const store = new WorkbenchStore(fixture, { mobileQuery: mediaQuery() });
  const selected = fixture.document.scene.nodes[0].nodeId;
  store.select({ kind: "node", id: selected, nodeId: selected });
  store.isolateNode(selected);
  assert.deepEqual([...store.state.visibleNodeIds], [selected]);
  assert.equal(store.state.isolatedNodeId, selected);

  store.setNodeVisibility(selected, false);
  assert.equal(store.state.selection, null);
  assert.equal(store.state.visibleNodeIds.has(selected), false);

  store.showAllNodes();
  assert.equal(store.state.visibleNodeIds.size, fixture.document.scene.nodes.length);
  assert.equal(store.document.kind, "PART");
});

test("persisted entity selection rebinds after body and triangle-range reordering", () => {
  const fixture = createInternalWorkbenchFixture();
  const sourceNode = fixture.document.scene.nodes[0];
  const sourceRange = sourceNode.mesh.entityRanges[0];
  const resolved = resolveStableEntity(sourceNode, sourceRange.startTriangle);
  assert.equal(resolved.ok, true);
  const persisted = { kind: "entity", id: resolved.target.entityId, ...resolved.target };

  fixture.document.scene.nodes.reverse();
  const reorderedNode = fixture.document.scene.nodes.find((node) => node.bodyId === persisted.bodyId);
  reorderTriangleGroups(reorderedNode);
  const relocated = reorderedNode.mesh.entityRanges.find((range) => range.entityId === persisted.entityId);
  assert.notEqual(relocated.startTriangle, persisted.startTriangle);
  const staleOffsetResolution = resolveStableEntity(reorderedNode, persisted.startTriangle);
  assert.equal(staleOffsetResolution.ok, true);
  assert.notEqual(staleOffsetResolution.target.entityId, persisted.entityId);

  const store = new WorkbenchStore(fixture, { mobileQuery: mediaQuery() });
  const rebound = store.select(persisted);
  assert.equal(rebound.entityId, persisted.entityId);
  assert.equal(rebound.semanticReferenceId, persisted.semanticReferenceId);
  assert.equal(rebound.startTriangle, relocated.startTriangle);
  assert.equal(rebound.triangleCount, relocated.triangleCount);
  assert.deepEqual(store.state.selection, rebound);
});

test("staged proposals leave the synthetic source snapshot immutable", () => {
  const fixture = createInternalWorkbenchFixture();
  const store = new WorkbenchStore(fixture, { mobileQuery: mediaQuery() });
  const originalLiteral = fixture.document.parameters[0].literal;
  const originalPayload = structuredClone(fixture.document.operations[4].payload);

  store.stageParameter("param:mount-width", "68");
  store.stagePayload("op:fillet", { continuity: "G2", propagate: false });

  assert.equal(fixture.document.parameters[0].literal, originalLiteral);
  assert.deepEqual(fixture.document.operations[4].payload, originalPayload);
  assert.equal(store.state.drafts.parameters["param:mount-width"], "68");
  assert.deepEqual(store.state.drafts.payloads["op:fillet"], { continuity: "G2", propagate: false });
});

test("operation proposals are generated from any compatible descriptor, not page-specific code", () => {
  const fixture = createInternalWorkbenchFixture();
  const store = new WorkbenchStore(fixture, { mobileQuery: mediaQuery() });
  const arbitrary = {
    type: "vendor.variable_shell",
    typeVersion: 7,
    title: "Variable shell",
    payloadSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["INSIDE", "OUTSIDE"] },
        thickness: { type: "number", default: "1.5" },
      },
    },
  };
  const operation = store.stageOperation(arbitrary);
  assert.equal(operation.type, "vendor.variable_shell");
  assert.equal(operation.typeVersion, 7);
  assert.deepEqual(operation.payload, { mode: "INSIDE", thickness: "1.5" });
  assert.equal(store.state.selection.id, operation.operationId);
});

test("store refuses undeclared identities and non-PartDocument operation descriptors", () => {
  const fixture = createInternalWorkbenchFixture();
  const store = new WorkbenchStore(fixture, { mobileQuery: mediaQuery() });
  assert.throws(() => store.stageParameter("param:missing", "3"), /Unknown parameter/);
  assert.throws(() => store.stagePayload("op:missing", {}), /Unknown operation/);
  const assemblyOnly = {
    type: "assembly.out-of-scope",
    typeVersion: 1,
    title: "Out of scope",
    payloadSchema: { type: "object", properties: {} },
    documentKinds: ["ASSEMBLY"],
  };
  assert.throws(() => store.stageOperation(assemblyOnly), /not registered for PART/);
  assert.throws(() => store.stageOperation({ type: "invalid", typeVersion: 1 }), /payload schema/);
});
