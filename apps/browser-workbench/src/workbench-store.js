import { schemaDefault } from "./schema-form.js";
import { rebindStableTarget } from "./scene-contract.js";

export class WorkbenchStore {
  constructor(fixture, options = {}) {
    this.fixture = fixture;
    this.listeners = new Set();
    this.mobileQuery = options.mobileQuery
      ?? (typeof window !== "undefined" ? window.matchMedia?.("(max-width: 680px)") : null)
      ?? { matches: false, addEventListener() {}, removeEventListener() {} };
    const selectedDocument = fixture.document;
    this.state = {
      evidenceStateKey: options.evidenceStateKey && fixture.states[options.evidenceStateKey] ? options.evidenceStateKey : "current",
      selection: null,
      hover: null,
      bottomTab: "timeline",
      mobilePanel: "viewport",
      mobileReviewOnly: Boolean(this.mobileQuery.matches),
      leftOpen: false,
      rightOpen: false,
      bottomCollapsed: false,
      commandPaletteOpen: false,
      commandQuery: "",
      commandIndex: 0,
      exportOpen: false,
      exportFormat: "STEP",
      drafts: {
        parameters: {},
        payloads: {},
        operations: [],
      },
      visibleNodeIds: new Set(selectedDocument.scene.nodes.filter((node) => node.visible).map((node) => node.nodeId)),
      isolatedNodeId: null,
      busy: false,
    };
    this.handleMobileChange = (event) => {
      this.patch({ mobileReviewOnly: Boolean(event.matches) });
    };
    this.mobileQuery.addEventListener?.("change", this.handleMobileChange);
  }

  get document() {
    return this.fixture.document;
  }

  get evidenceState() {
    return this.fixture.states[this.state.evidenceStateKey];
  }

  get canEdit() {
    return this.evidenceState.editable && !this.state.mobileReviewOnly && !this.state.busy;
  }

  get draftCount() {
    return Object.keys(this.state.drafts.parameters).length
      + Object.keys(this.state.drafts.payloads).length
      + this.state.drafts.operations.length;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(reason = "state") {
    for (const listener of this.listeners) listener(this.state, reason);
  }

  patch(fields, reason = "state") {
    Object.assign(this.state, fields);
    this.emit(reason);
  }

  setEvidenceState(key) {
    if (!this.fixture.states[key]) return;
    this.state.evidenceStateKey = key;
    if (!this.evidenceState.editable) {
      this.state.hover = null;
    }
    this.emit("evidence-state");
  }

  select(selection, reason = "selection") {
    let nextSelection = selection;
    if (selection?.kind === "node" || selection?.kind === "entity") {
      const rebound = rebindStableTarget(this.document.scene, selection);
      nextSelection = rebound.ok
        ? {
            ...selection,
            ...rebound.target,
            id: selection.kind === "entity" ? rebound.target.entityId : rebound.target.nodeId,
          }
        : null;
    }
    this.state.selection = nextSelection;
    if (nextSelection) this.state.rightOpen = true;
    this.emit(reason);
    return nextSelection;
  }

  hover(selection) {
    this.state.hover = selection;
    this.emit("hover");
  }

  setNodeVisibility(nodeId, visible) {
    if (visible) this.state.visibleNodeIds.add(nodeId);
    else this.state.visibleNodeIds.delete(nodeId);
    if (!visible && this.state.selection?.nodeId === nodeId) this.state.selection = null;
    this.state.isolatedNodeId = null;
    this.emit("visibility");
  }

  isolateNode(nodeId) {
    if (!this.document.scene.nodes.some((node) => node.nodeId === nodeId)) return;
    this.state.visibleNodeIds = new Set([nodeId]);
    this.state.isolatedNodeId = nodeId;
    this.emit("visibility");
  }

  showAllNodes() {
    this.state.visibleNodeIds = new Set(this.document.scene.nodes.map((node) => node.nodeId));
    this.state.isolatedNodeId = null;
    this.emit("visibility");
  }

  stageParameter(parameterId, literal, { emit = true } = {}) {
    this.requireEditable();
    if (!this.parameterById(parameterId)) throw new Error(`Unknown parameter ${parameterId}.`);
    this.state.drafts.parameters[parameterId] = literal;
    if (emit) this.emit("draft");
  }

  stagePayload(operationId, payload, { emit = true } = {}) {
    this.requireEditable();
    if (!this.operationById(operationId)) throw new Error(`Unknown operation ${operationId}.`);
    this.state.drafts.payloads[operationId] = structuredClone(payload);
    if (emit) this.emit("draft");
  }

  stageOperation(descriptor) {
    this.requireEditable();
    if (!descriptor?.type || !Number.isInteger(descriptor.typeVersion) || !descriptor.payloadSchema) {
      throw new Error("A registered operation descriptor with an exact version and payload schema is required.");
    }
    if (descriptor.documentKinds && !descriptor.documentKinds.includes(this.document.kind)) {
      throw new Error(`${descriptor.type}@${descriptor.typeVersion} is not registered for ${this.document.kind}.`);
    }
    const ordinal = this.document.operations.length + this.state.drafts.operations.length + 1;
    const operation = {
      operationId: `proposal-op:${descriptor.type}:${ordinal}`,
      type: descriptor.type,
      typeVersion: descriptor.typeVersion,
      label: descriptor.title,
      dependsOn: this.document.operations.length > 0 ? [this.document.operations.at(-1).operationId] : [],
      enabled: true,
      payload: schemaDefault(descriptor.payloadSchema),
      parameterBindings: {},
      proposed: true,
    };
    this.state.drafts.operations.push(operation);
    this.state.selection = { kind: "operation", id: operation.operationId };
    this.emit("draft-operation");
    return operation;
  }

  clearDrafts() {
    this.state.drafts = { parameters: {}, payloads: {}, operations: [] };
    this.emit("draft");
  }

  setBusy(busy) {
    this.patch({ busy: Boolean(busy) }, "busy");
  }

  setBottomTab(tab) {
    if (!["timeline", "sourcing", "diagnostics", "selection"].includes(tab)) return;
    this.patch({ bottomTab: tab, bottomCollapsed: false }, "panel");
  }

  setMobilePanel(panel) {
    if (!["model", "viewport", "properties", "history"].includes(panel)) return;
    this.patch({ mobilePanel: panel }, "panel");
  }

  openPalette(query = "") {
    this.patch({ commandPaletteOpen: true, commandQuery: query, commandIndex: 0 }, "palette");
  }

  closePalette() {
    this.patch({ commandPaletteOpen: false, commandQuery: "", commandIndex: 0 }, "palette");
  }

  operationById(operationId) {
    return [...this.document.operations, ...this.state.drafts.operations].find((operation) => operation.operationId === operationId) ?? null;
  }

  descriptorFor(operation) {
    return this.fixture.descriptors.find((descriptor) => descriptor.type === operation.type && descriptor.typeVersion === operation.typeVersion) ?? null;
  }

  nodeById(nodeId) {
    return this.document.scene.nodes.find((node) => node.nodeId === nodeId) ?? null;
  }

  parameterById(parameterId) {
    return this.document.parameters?.find((parameter) => parameter.parameterId === parameterId) ?? null;
  }

  dispose() {
    this.mobileQuery.removeEventListener?.("change", this.handleMobileChange);
    this.listeners.clear();
  }

  requireEditable() {
    if (!this.canEdit) {
      const reason = this.state.mobileReviewOnly
        ? "Mobile layout is review-only. Open this document on a wider viewport to author changes."
        : `The ${this.evidenceState.displayState} display state cannot be edited as current.`;
      throw new Error(reason);
    }
  }
}
