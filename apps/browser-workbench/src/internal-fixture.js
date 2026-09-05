import { createFixtureRenderScenes } from "./internal-scene.js";

/** Synthetic public-data fixture. It is browser evidence only and never geometry authority. */
export function createInternalWorkbenchFixture() {
  const scenes = createFixtureRenderScenes();
  const descriptors = operationDescriptors();
  const states = evidenceStates();

  return {
    fixtureId: "browser-target-fixture/2026-09-05",
    evidenceCeiling: "TARGET",
    adapterLabel: "Synthetic browser adapter",
    descriptors,
    document: {
      kind: "PART",
      label: "Motor mount · Part",
      documentId: scenes.part.documentId,
      revisionId: scenes.part.revisionId,
      units: { length: "mm", angle: "deg" },
      scene: scenes.part,
      parameters: [
        parameter("param:mount-width", "Mount width", "LENGTH", "64", "mm", "Overall base width"),
        parameter("param:base-depth", "Base depth", "LENGTH", "42", "mm", "Overall base depth"),
        parameter("param:upright-height", "Upright height", "LENGTH", "48", "mm", "Height above datum"),
        parameter("param:wall-thickness", "Wall thickness", "LENGTH", "8", "mm", "Nominal structural wall"),
        parameter("param:edge-radius", "Edge radius", "LENGTH", "2.5", "mm", "Outer edge treatment"),
      ],
      operations: [
        operation("op:sketch-base", "sketch.profile", "Base profile", [], { plane: "XY", closed: true, construction: false }),
        operation("op:extrude-base", "solid.extrude", "Base plate", ["op:sketch-base"], { extent: "ONE_SIDED", direction: "NORMAL", symmetric: false }),
        operation("op:sketch-upright", "sketch.profile", "Upright profile", ["op:extrude-base"], { plane: "XZ", closed: true, construction: false }),
        operation("op:extrude-upright", "solid.extrude", "Upright", ["op:sketch-upright"], { extent: "ONE_SIDED", direction: "NORMAL", symmetric: false }),
        operation("op:fillet", "solid.fillet", "Gusset edge treatment", ["op:extrude-upright"], { continuity: "G1", propagate: true }),
        operation("op:sketch-jaw", "sketch.profile", "Clamp jaw profile", ["op:fillet"], { plane: "XZ", closed: true, construction: false }),
        operation("op:extrude-jaw", "solid.extrude", "Clamp jaw body", ["op:sketch-jaw"], { extent: "TWO_SIDED", direction: "NORMAL", symmetric: true }),
        operation("op:chamfer", "solid.chamfer", "Jaw edge treatment", ["op:extrude-jaw"], { mode: "EQUAL_DISTANCE", flipDirection: false }),
      ],
      bodies: [
        { bodyId: "body:mount-primary", label: "Mount body", material: "6061-T6 aluminum", featureIds: ["op:extrude-base", "op:extrude-upright", "op:fillet"] },
        { bodyId: "body:clamp-jaw", label: "Clamp jaw", material: "A2 tool steel", featureIds: ["op:chamfer"] },
      ],
    },
    states,
    history: historyRecords(),
  };
}

function parameter(parameterId, name, valueType, literal, unit, description) {
  return { parameterId, name, valueType, literal, expression: null, unit, description };
}

function operation(operationId, type, label, dependsOn, payload) {
  return {
    operationId,
    type,
    typeVersion: 1,
    label,
    dependsOn,
    enabled: true,
    payload,
    parameterBindings: {},
  };
}

function operationDescriptors() {
  return [
    descriptor("sketch.profile", "Profile sketch", "Create a closed or construction profile on a datum plane.", {
      type: "object",
      required: ["plane", "closed"],
      properties: {
        plane: { type: "string", title: "Datum plane", enum: ["XY", "XZ", "YZ"], description: "Stable datum plane reference." },
        closed: { type: "boolean", title: "Closed profile", default: true },
        construction: { type: "boolean", title: "Construction geometry", default: false },
      },
    }),
    descriptor("solid.extrude", "Extrude", "Create solid geometry from a closed profile.", {
      type: "object",
      required: ["extent", "direction"],
      properties: {
        extent: { type: "string", title: "Extent", oneOf: [{ const: "ONE_SIDED", title: "One sided" }, { const: "TWO_SIDED", title: "Two sided" }, { const: "THROUGH_ALL", title: "Through all" }] },
        direction: { type: "string", title: "Direction", enum: ["NORMAL", "REVERSED"] },
        symmetric: { type: "boolean", title: "Symmetric", default: false },
      },
    }, { distance: "LENGTH" }),
    descriptor("solid.fillet", "Fillet", "Apply a radius to semantic edge references.", {
      type: "object",
      required: ["continuity"],
      properties: {
        continuity: { type: "string", title: "Continuity", enum: ["G1", "G2"], default: "G1" },
        propagate: { type: "boolean", title: "Tangent propagation", default: true },
      },
    }, { radius: "LENGTH" }),
    descriptor("solid.chamfer", "Chamfer", "Apply a distance or distance-angle edge treatment.", {
      type: "object",
      required: ["mode"],
      properties: {
        mode: { type: "string", title: "Definition", enum: ["EQUAL_DISTANCE", "DISTANCE_ANGLE"] },
        flipDirection: { type: "boolean", title: "Flip direction", default: false },
      },
    }, { distance: "LENGTH", angle: "ANGLE" }),
    descriptor("pattern.linear", "Linear pattern", "Repeat a feature along a semantic direction.", {
      type: "object",
      required: ["count", "distribution"],
      properties: {
        count: { type: "integer", title: "Instance count", minimum: 2, default: "2" },
        distribution: { type: "string", title: "Distribution", enum: ["SPACING", "EXTENT"] },
        secondaryDirection: {
          type: "object",
          title: "Secondary direction",
          properties: {
            enabled: { type: "boolean", title: "Enabled", default: false },
            count: { type: "integer", title: "Instance count", minimum: 1, default: "1" },
          },
        },
      },
    }, { distance: "LENGTH" }),
  ];
}

function descriptor(type, title, description, payloadSchema, parameterSlots = {}) {
  return {
    registryKey: `${type}@1`,
    type,
    typeVersion: 1,
    title,
    description,
    payloadSchema,
    parameterSlots,
    inputKinds: [],
    outputRoles: [],
    determinism: "REQUIRED",
    documentKinds: ["PART"],
  };
}

function evidenceStates() {
  const currentRevision = "part-rev:fixture-8f2e7a1";
  const attemptedRevision = "part-rev:fixture-bad-12d9";
  const proposedRevision = "part-rev:fixture-proposal-61ba";
  const artifactId = "artifact:fixture-derived-4e1c";
  return {
    current: {
      key: "current",
      recomputeStatus: "SUCCEEDED",
      displayState: "CURRENT",
      requestedRevisionId: currentRevision,
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [],
      operationStatus: {},
      adapterOnline: true,
      editable: true,
    },
    queued: {
      key: "queued",
      recomputeStatus: "QUEUED",
      displayState: "STALE",
      requestedRevisionId: proposedRevision,
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [],
      operationStatus: {},
      adapterOnline: true,
      editable: false,
    },
    running: {
      key: "running",
      recomputeStatus: "RUNNING",
      displayState: "STALE",
      requestedRevisionId: proposedRevision,
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [],
      operationStatus: {},
      adapterOnline: true,
      editable: false,
    },
    failed: {
      key: "failed",
      recomputeStatus: "FAILED",
      displayState: "LAST_VALID",
      requestedRevisionId: attemptedRevision,
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [
        diagnostic("PARAMETER_NEGATIVE_LENGTH", "ERROR", "Wall thickness must be greater than zero.", "op:extrude-upright", ["param:wall-thickness"]),
        diagnostic("DEPENDENCY_BLOCKED", "ERROR", "Gusset edge treatment was not executed because its dependency failed.", "op:fillet", ["op:extrude-upright"]),
      ],
      operationStatus: { "op:extrude-upright": "FAILED", "op:fillet": "BLOCKED" },
      adapterOnline: true,
      editable: false,
    },
    stale: {
      key: "stale",
      recomputeStatus: "STALE",
      displayState: "STALE",
      requestedRevisionId: "part-rev:fixture-newer-61ba",
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [
        diagnostic("ARTIFACT_STALE", "WARNING", "The displayed artifact predates the requested geometry revision. Refresh before proposing edits.", null, [currentRevision]),
      ],
      operationStatus: {},
      adapterOnline: true,
      editable: false,
    },
    "worker-crashed": {
      key: "worker-crashed",
      recomputeStatus: "WORKER_CRASHED",
      displayState: "LAST_VALID",
      requestedRevisionId: "part-rev:fixture-crash-d2af",
      displayedRevisionId: currentRevision,
      sourceArtifactId: artifactId,
      diagnostics: [
        diagnostic("WORKER_CRASHED", "ERROR", "The preview worker stopped before returning a result. The prior artifact remains separately identified.", null, []),
      ],
      operationStatus: {},
      adapterOnline: false,
      editable: false,
    },
  };
}

function diagnostic(code, severity, message, operationId, relatedIds) {
  return { diagnosticId: `diagnostic:${code.toLowerCase()}`, code, severity, message, operationId, relatedIds };
}

function historyRecords() {
  return [
    { sequence: 1, revisionId: "part-rev:fixture-64c10a2", label: "Initial base", actor: "Benji H.", disposition: "VERIFIED", time: "09:18", summary: "Created constrained base profile" },
    { sequence: 2, revisionId: "part-rev:fixture-7ae492c", label: "Add upright", actor: "Forge agent", disposition: "AUTHORIZED", time: "09:34", summary: "Extruded upright from stable datum" },
    { sequence: 3, revisionId: "part-rev:fixture-8f2e7a1", label: "Gusset treatment", actor: "Benji H.", disposition: "VERIFIED", time: "10:02", summary: "Added paired gussets and edge treatment" },
    { sequence: 4, revisionId: "part-rev:fixture-bad-12d9", label: "Thickness proposal", actor: "Forge agent", disposition: "REJECTED", time: "10:11", summary: "Invalid negative dimension retained as failed attempt" },
  ];
}
