import { hydrateIcons, icon } from "./icons.js";
import { createComplianceRequest, requestComplianceReview, toComplianceDiagnostic } from "./compliance-client.js";
import { BOUNDED_CLAIM, loadProductCandidate } from "./runtime-candidate.js";
import { escapeAttribute, escapeHtml, renderSchemaForm, updateSchemaValue } from "./schema-form.js";
import { WorkbenchViewer } from "./viewer.js";
import { WorkbenchStore } from "./workbench-store.js";

const root = document.querySelector("#workbench");
const viewportHost = document.querySelector("#viewport-canvas");
const query = new URLSearchParams(window.location.search);
const fixture = await loadProductCandidate();
const store = new WorkbenchStore(fixture, {
  evidenceStateKey: "current",
});

let treeSearch = "";
let toastCounter = 0;
let rendererDetails = { mode: "pending", reason: null };
let complianceReview = { phase: "IDLE", entityId: null, payload: null, diagnostic: null };

hydrateIcons(document);
store.state.selection = { kind: "document", id: store.document.documentId };

const viewer = new WorkbenchViewer(
  viewportHost,
  {
    onHover(target, metadata = {}) {
      renderHoverHud(target, metadata);
    },
    onSelect(target) {
      if (!target) {
        store.select({ kind: "document", id: store.document.documentId });
        return;
      }
      if (target.entityId) {
        store.select({ kind: "entity", id: target.entityId, ...target });
      } else {
        store.select({ kind: "node", id: target.nodeId, nodeId: target.nodeId, ...target });
      }
    },
    onSelectionFailure(failure) {
      showToast("Selection blocked", `${failure.code}: no unique stable mapping was available.`, "danger");
    },
    onRendererChange(details) {
      rendererDetails = details;
      renderViewportMeta();
    },
  },
  { forceFallback: query.get("renderer") === "fallback" },
);

viewer.mount(store.document.scene);
store.subscribe((_, reason) => render(reason));
bindEvents();
render("initial");
root.dataset.ready = "true";

function render(reason) {
  if (reason === "visibility") syncViewerVisibility();

  renderLayout();
  renderHeader();
  renderReviewPath();
  renderTree();
  renderProperties();
  renderBottomPanel();
  renderRevisionBanner();
  renderViewportMeta();
  renderStatusBar();
  renderPalette();
  renderExchangeModal();
  hydrateIcons(root);
}

function renderLayout() {
  root.dataset.leftOpen = String(store.state.leftOpen);
  root.dataset.rightOpen = String(store.state.rightOpen);
  root.dataset.mobileActive = store.state.mobilePanel;
  root.classList.toggle("bottom-collapsed", store.state.bottomCollapsed);
  for (const button of root.querySelectorAll("[data-mobile-panel]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mobilePanel === store.state.mobilePanel));
  }
}

function renderHeader() {
  document.querySelector("#document-name").textContent = store.document.label;
  document.querySelector("#document-kind-label").textContent = `${store.document.kind} DOCUMENT`;
  document.querySelector("#model-tree-content").setAttribute(
    "aria-label",
    "Part body, feature, and parameter tree",
  );
  document.querySelector("#viewport-canvas").setAttribute(
    "aria-label",
    "3D part viewport. Use arrow keys to move through semantic entities and Enter to select.",
  );
  const saveState = document.querySelector("#save-state");
  saveState.textContent = "Immutable core revision";
  saveState.classList.toggle("has-draft", store.draftCount > 0);

  const authorityChip = document.querySelector("#authority-chip");
  authorityChip.innerHTML = '<span class="truth-dot" aria-hidden="true"></span><span>DRAFT_REVIEW_ONLY</span>';
  authorityChip.title = `${fixture.adapterLabel}; local review support only`;

  for (const selector of ["[data-action='import']", "[data-action='open-export']"]) {
    const control = document.querySelector(selector);
    if (control) control.hidden = true;
  }

  const button = document.querySelector("#recompute-button");
  const recomputeAvailable = fixture.capabilities?.recompute === true;
  button.hidden = !recomputeAvailable;
  const inFlight = ["QUEUED", "RUNNING"].includes(store.evidenceState.recomputeStatus);
  button.disabled = !recomputeAvailable || store.state.mobileReviewOnly || store.state.busy || inFlight || (!store.evidenceState.editable && store.draftCount > 0);
  button.title = !recomputeAvailable
    ? "Candidate 0.1 is a revision-pinned review build; recompute is unavailable."
    : inFlight
    ? `Synthetic recompute is ${store.evidenceState.recomputeStatus.toLowerCase()}.`
    : button.disabled && store.draftCount > 0
      ? "Discard or roll back the failed proposal before recomputing."
      : "Request a recompute from the authoritative adapter.";
  button.classList.toggle("is-running", store.state.busy);
  const actionLabel = store.evidenceState.recomputeStatus === "QUEUED"
    ? "Queued…"
    : store.evidenceState.recomputeStatus === "RUNNING" || store.state.busy
      ? "Running…"
      : "Recompute";
  button.innerHTML = `${icon(inFlight || store.state.busy ? "refresh" : "play")}<span>${actionLabel}</span>`;
}

function renderTree() {
  const content = document.querySelector("#model-tree-content");
  content.setAttribute("aria-label", "Part body, feature, and parameter tree");
  content.innerHTML = designTree();
  const addButton = document.querySelector("[data-action='open-add-operation']");
  addButton.hidden = fixture.capabilities?.authoring !== true;
  addButton.disabled = !store.canEdit;
  addButton.title = store.canEdit ? "Add any compatible registered operation" : editBlockReason();
}

function designTree() {
  const documentRow = treeRow({
    kind: "document",
    id: store.document.documentId,
    label: store.document.label,
    iconName: "body",
    depth: 0,
    expanded: true,
    suffix: `<span class="document-kind-pill">${store.document.kind}</span>`,
  });

  const nodes = store.document.scene.nodes.filter((node) => matchesTreeSearch(node.label, node.nodeId, node.kind));
  const nodeRows = nodes.map((node) => nodeTreeRow(node)).join("");
  const operations = [...store.document.operations, ...store.state.drafts.operations]
    .filter((operation) => matchesTreeSearch(operation.label, operation.type, operation.operationId))
    .map((operation) => treeRow({
      kind: "operation",
      id: operation.operationId,
      label: operation.label,
      iconName: "cube",
      depth: 1,
      status: operation.proposed ? "PENDING" : operationStatus(operation.operationId),
      suffix: operation.proposed ? '<span class="draft-indicator">DRAFT</span>' : "",
      title: `${operation.type}@${operation.typeVersion}`,
    })).join("");

  const parameters = (store.document.parameters ?? [])
    .filter((parameter) => matchesTreeSearch(parameter.name, parameter.parameterId, parameter.valueType))
    .map((parameter) => treeRow({
      kind: "parameter",
      id: parameter.parameterId,
      label: parameter.name,
      iconName: "parameter",
      depth: 1,
      suffix: Object.hasOwn(store.state.drafts.parameters, parameter.parameterId)
        ? '<span class="draft-indicator">DRAFT</span>'
        : `<span class="tree-id">${escapeHtml(parameter.literal)} ${escapeHtml(parameter.unit)}</span>`,
    })).join("");

  return `${documentRow}
    <div class="tree-divider-label">Part bodies</div>
    ${nodeRows || emptyTreeMessage("No bodies match this filter.")}
    <div class="tree-divider-label">Ordered operations</div>
    ${operations || emptyTreeMessage("No operations match this filter.")}
    <div class="tree-divider-label">Parameters</div>
    ${parameters || emptyTreeMessage("No parameters match this filter.")}`;
}

function nodeTreeRow(node, depth = 1) {
  const visible = store.state.visibleNodeIds.has(node.nodeId);
  const row = treeRow({
    kind: "node",
    id: node.nodeId,
    label: node.label,
    iconName: "body",
    depth,
    title: `BODY · ${node.metadata.sourceRevisionId}`,
  });
  return `<div class="tree-row-wrap">${row}<button class="tree-inline-action" type="button" data-action="toggle-node-visibility" data-node-id="${escapeAttribute(node.nodeId)}" aria-label="${visible ? "Hide" : "Show"} ${escapeAttribute(node.label)}" aria-pressed="${visible}"><span data-icon="${visible ? "eye" : "eye-off"}" aria-hidden="true"></span></button></div>`;
}

function treeRow({ kind, id, label, iconName, depth, expanded = null, status = null, suffix = "", title = "" }) {
  const selected = selectionMatches(kind, id);
  const expandedAttribute = expanded === null ? "" : ` aria-expanded="${expanded}"`;
  const toggle = expanded === null ? '<span class="tree-toggle"></span>' : `<span class="tree-toggle">${icon("chevron-right")}</span>`;
  const statusMarkup = status ? `<span class="tree-status" data-status="${escapeAttribute(status)}" title="${escapeAttribute(status)}">${icon(status === "SUCCEEDED" ? "check" : status === "FAILED" ? "error" : status === "BLOCKED" ? "warning" : "info")}</span>` : "";
  return `<button type="button" role="treeitem" class="tree-row" data-depth="${depth}" data-select-kind="${escapeAttribute(kind)}" data-select-id="${escapeAttribute(id)}" aria-selected="${selected}"${expandedAttribute}${title ? ` title="${escapeAttribute(title)}"` : ""}>
    ${toggle}<span class="tree-icon"><span data-icon="${escapeAttribute(iconName)}" aria-hidden="true"></span></span><span class="tree-label">${escapeHtml(label)}</span>${suffix}${statusMarkup}
  </button>`;
}

function renderProperties() {
  const container = document.querySelector("#properties-content");
  const selection = store.state.selection ?? { kind: "document", id: store.document.documentId };
  if (selection.kind === "parameter") container.innerHTML = parameterProperties(selection.id);
  else if (selection.kind === "operation") container.innerHTML = operationProperties(selection.id);
  else if (selection.kind === "node") container.innerHTML = nodeProperties(selection.nodeId ?? selection.id);
  else if (selection.kind === "entity") container.innerHTML = entityProperties(selection);
  else container.innerHTML = documentProperties();
  renderPropertyFooter();
}

function documentProperties() {
  const counts = {
    nodes: store.document.scene.nodes.length,
    operations: store.document.operations.length,
    parameters: store.document.parameters?.length ?? 0,
  };
  return `${propertyHero("body", store.document.label, store.document.documentId)}
    <div class="candidate-claim"><span>LOCAL CANDIDATE 0.1</span><strong>${escapeHtml(BOUNDED_CLAIM)}</strong><p>${escapeHtml(fixture.candidate.positioning)}</p></div>
    ${editabilityNotice()}
    <section class="property-section">
      <div class="property-section-heading"><h4>Identity & contents</h4><span class="state-badge" data-state="${escapeAttribute(store.evidenceState.displayState)}">${escapeHtml(store.evidenceState.displayState)}</span></div>
      ${readoutList([
        ["Document", store.document.documentId],
        ["Revision", store.document.revisionId],
        ["Bodies", counts.nodes],
        ["Operations", counts.operations],
        ["Parameters", counts.parameters],
        ["Units", `${store.document.units.length} / ${store.document.units.angle}`],
      ])}
    </section>
    ${bodySummary()}
    <section class="property-section">
      <div class="property-section-heading"><h4>Provenance</h4></div>
      ${readoutList([
        ["Candidate", fixture.candidate.status],
        ["Adapter", fixture.adapterLabel],
        ["Policy", fixture.candidate.policyState],
        ["Claim ceiling", fixture.candidate.claimCeiling],
        ["Geometry authority", "Core-kernel artifact; browser is derived display"],
      ])}
    </section>`;
}

function parameterProperties(parameterId) {
  const parameter = store.parameterById(parameterId);
  if (!parameter) return missingSelection("Parameter unavailable", parameterId);
  const drafted = Object.hasOwn(store.state.drafts.parameters, parameterId);
  const value = drafted ? store.state.drafts.parameters[parameterId] : parameter.literal;
  return `${propertyHero("parameter", parameter.name, parameter.parameterId)}
    ${editabilityNotice()}
    <section class="property-section">
      <div class="property-section-heading"><h4>Driving value</h4>${drafted ? '<span class="draft-indicator">STAGED PROPOSAL</span>' : ""}</div>
      <div class="property-grid">
        <div class="property-field${drafted ? " has-draft" : ""}">
          <label for="parameter-literal"><span>Literal value <span class="field-required" aria-label="required">*</span></span><span>${escapeHtml(parameter.unit)}</span></label>
          <p class="field-description" id="parameter-description">${escapeHtml(parameter.description)}</p>
          <div class="input-with-unit"><input id="parameter-literal" type="text" inputmode="decimal" value="${escapeAttribute(value)}" data-parameter-id="${escapeAttribute(parameter.parameterId)}" aria-describedby="parameter-description"${store.canEdit ? "" : " disabled"}/><span class="input-unit">${escapeHtml(parameter.unit)}</span></div>
        </div>
      </div>
    </section>
    <section class="property-section"><div class="property-section-heading"><h4>Typed parameter</h4></div>${readoutList([
      ["Value type", parameter.valueType],
      ["Canonical", `${parameter.literal} ${parameter.unit}`],
      ["Expression", parameter.expression ?? "Literal"],
      ["Stable ID", parameter.parameterId],
    ])}</section>
    <div class="notice-card"><strong>Proposal semantics</strong><span>Editing stages typed intent. The browser never rewrites canonical geometry or revision identity.</span></div>`;
}

function operationProperties(operationId) {
  const operation = store.operationById(operationId);
  if (!operation) return missingSelection("Operation unavailable", operationId);
  const descriptor = store.descriptorFor(operation);
  if (!descriptor) {
    return `${propertyHero("cube", operation.label, `${operation.type}@${operation.typeVersion}`)}<div class="notice-card is-danger"><strong>Descriptor unavailable</strong><span>This operation remains visible but its payload cannot be edited without an exact registered schema.</span></div>`;
  }
  const payload = store.state.drafts.payloads[operationId] ?? operation.payload;
  const draftPaths = store.state.drafts.payloads[operationId] ? new Set(flattenObjectPaths(payload)) : new Set();
  const resultStatus = operation.proposed ? "PENDING" : operationStatus(operationId);
  return `${propertyHero("cube", operation.label, `${operation.type}@${operation.typeVersion}`)}
    ${editabilityNotice()}
    <section class="property-section"><div class="property-section-heading"><h4>Execution</h4><span class="status-badge" data-status="${escapeAttribute(resultStatus)}">${escapeHtml(resultStatus)}</span></div>${readoutList([
      ["Operation ID", operation.operationId],
      ["Registry key", descriptor.registryKey],
      ["Depends on", operation.dependsOn.join(", ") || "None"],
      ["Determinism", descriptor.determinism],
    ])}</section>
    ${Object.keys(descriptor.parameterSlots).length > 0 ? `<section class="property-section"><div class="property-section-heading"><h4>Parameter slots</h4></div>${parameterSlotFields(operation, descriptor)}</section>` : ""}
    <section class="property-section"><div class="property-section-heading"><h4>Registered payload</h4><span class="schema-label">SCHEMA</span></div>${renderSchemaForm(descriptor.payloadSchema, payload, { disabled: !store.canEdit, draftPaths, idPrefix: "operation-payload" })}</section>
    <div class="notice-card"><strong>Schema-driven editor</strong><span>This form is generated from the registered descriptor. No operation-specific page is loaded.</span></div>`;
}

function nodeProperties(nodeId) {
  const node = store.nodeById(nodeId);
  if (!node) return missingSelection("Body unavailable", nodeId);
  return `${propertyHero("body", node.label, node.bodyId ?? node.nodeId)}
    ${editabilityNotice()}
    <section class="property-section"><div class="property-section-heading"><h4>Part body</h4><span class="status-badge" data-status="SUCCEEDED">VISIBLE</span></div>${readoutList([
      ["Stable node", node.nodeId],
      ["Body ID", node.bodyId],
      ["Source document", node.metadata.sourceDocumentId],
      ["Source revision", node.metadata.sourceRevisionId],
    ])}
    <div class="node-action-row"><button class="secondary-action" type="button" data-action="isolate-node" data-node-id="${escapeAttribute(node.nodeId)}">${icon("isolate")}Isolate</button><button class="secondary-action" type="button" data-action="show-all-nodes">${icon("eye")}Show all</button></div></section>
    <section class="property-section"><div class="property-section-heading"><h4>Source properties</h4></div>${readoutList([
      ["Material", node.metadata.material],
      ["Mass", `${node.metadata.mass.value ?? "—"} ${node.metadata.mass.unit} · ${node.metadata.mass.evidence}`],
    ])}</section>
    <div class="notice-card"><strong>PartDocument body</strong><span>This body belongs to the current PartDocument and retains stable body and source-revision identity.</span></div>`;
}

function entityProperties(selection) {
  const node = store.nodeById(selection.nodeId);
  return `${propertyHero("cursor", "Semantic entity", selection.entityId)}
    <section class="property-section"><div class="property-section-heading"><h4>Stable selection</h4><span class="status-badge" data-status="VERIFIED">MAPPED</span></div>${readoutList([
      ["Entity ID", selection.entityId],
      ["Semantic reference", selection.semanticReferenceId],
      ["Feature", selection.featureId],
      ["Body", selection.bodyId ?? "—"],
      ["Node", node?.label ?? selection.nodeId],
    ])}</section>
    <section class="property-section"><div class="property-section-heading"><h4>Lineage context</h4></div>${readoutList([
      ["Displayed revision", store.evidenceState.displayedRevisionId],
      ["Source artifact", store.evidenceState.sourceArtifactId],
      ["Mapping source", "Derived triangle range → stable IDs"],
    ])}</section>
    <div class="notice-card"><strong>Display indices are not identity</strong><span>The hit triangle was used only to resolve this stable entity, semantic reference, feature, and body.</span></div>
    ${compliancePanel(selection)}`;
}

function renderReviewPath() {
  const container = document.querySelector("#review-path");
  if (!container) return;
  const selection = store.state.selection;
  const isEntity = selection?.kind === "entity";
  const review = isEntity && complianceReview.entityId === selection.entityId ? complianceReview : { phase: "IDLE" };
  let stateMarkup;
  let actionMarkup;
  if (!isEntity) {
    stateMarkup = '<strong>Next: select a CAD entity</strong><span>Tap geometry, or focus the viewport and use the arrow keys, then Enter.</span>';
    actionMarkup = '<button class="review-path-action" type="button" data-action="guide-review-selection">Select an entity</button>';
  } else if (review.phase === "RUNNING") {
    stateMarkup = `<strong>Checking review readiness</strong><span>Tripwire is binding ${escapeHtml(shortId(selection.entityId))} to ${escapeHtml(shortId(store.evidenceState.displayedRevisionId))}.</span>`;
    actionMarkup = '<button class="review-path-action" type="button" disabled>Tripwire check running</button>';
  } else if (review.phase === "BOUND") {
    stateMarkup = '<strong>Insufficient evidence · human review required</strong><span>The selected entity is bound to this immutable revision. Tripwire did not make a compliance determination.</span>';
    actionMarkup = '<button class="review-path-action is-secondary" type="button" data-action="open-review-details">Open bound evidence</button>';
  } else if (review.phase === "BLOCKED") {
    stateMarkup = `<strong>Review check unavailable</strong><span>${escapeHtml(review.diagnostic?.message ?? "Tripwire could not complete this check. Your selection is unchanged; try again.")}</span>`;
    actionMarkup = '<button class="review-path-action" type="button" data-action="run-compliance-check">Retry Tripwire</button>';
  } else {
    stateMarkup = `<strong>Entity selected · ready to check</strong><span>${escapeHtml(shortId(selection.entityId))} will be bound to ${escapeHtml(shortId(store.evidenceState.displayedRevisionId))}.</span>`;
    actionMarkup = '<button class="review-path-action" type="button" data-action="run-compliance-check">Check with Tripwire</button>';
  }
  container.dataset.phase = review.phase;
  container.innerHTML = `<span class="review-path-kicker">CANDIDATE 0.1 · REVISION-PINNED</span><h2 id="review-path-title">Review readiness with Tripwire</h2><p>Tripwire checks whether a selected CAD entity has enough evidence for human review. It does not make a compliance determination.</p><div class="review-path-state" role="status" aria-live="polite">${stateMarkup}</div>${actionMarkup}<small id="recompute-explanation">Recompute is unavailable in this revision-pinned review build.</small>`;
}

function compliancePanel(selection) {
  const binding = store.document.complianceBindings?.[selection.entityId];
  if (!binding) return '<div class="notice-card is-danger"><strong>Review-readiness check unavailable</strong><span>No exact revision binding exists for this entity.</span></div>';
  const review = complianceReview.entityId === selection.entityId ? complianceReview : { phase: "IDLE" };
  if (review.phase === "RUNNING") return '<section class="property-section compliance-card"><div class="property-section-heading"><h4>Tripwire review readiness</h4><span class="status-badge" data-status="RUNNING">CHECKING</span></div><p>Binding the selected CAD entity to the immutable revision for a review-readiness check.</p><button class="secondary-action" type="button" disabled>Tripwire check running</button></section>';
  if (review.phase === "BOUND") {
    const payload = review.payload;
    const finding = payload.evidence.finding;
    const receipt = payload.binding_receipt;
    return `<section class="property-section compliance-card"><div class="property-section-heading"><h4>Tripwire review readiness</h4><span class="status-badge" data-status="PENDING">HUMAN REVIEW</span></div><div class="review-only-banner"><strong>INSUFFICIENT EVIDENCE</strong><span>Candidate 0.1 requires human review and makes no compliance determination.</span></div>${readoutList([
      ["Evidence outcome", finding.outcome], ["Reason codes", finding.reason_codes.join(", ")], ["Policy state", payload.policy_state],
      ["Review gate", payload.human_review_requirement], ["Receipt", receipt.receipt_id], ["Receipt hash", receipt.receipt_hash], ["Observed", payload.observation.observed_at],
    ])}<div class="notice-card"><strong>Human review required</strong><span>Tripwire is a review-readiness guardrail only. This result is not a compliance determination.</span></div><button class="secondary-action" type="button" data-action="run-compliance-check">Run Tripwire again</button></section>`;
  }
  if (review.phase === "BLOCKED") {
    const diagnostic = review.diagnostic ?? { code: "COMPLIANCE_BLOCKED", message: "The response could not be safely bound." };
    const receipt = review.payload?.binding_receipt;
    return `<section class="property-section compliance-card"><div class="property-section-heading"><h4>Tripwire review readiness</h4><span class="status-badge" data-status="BLOCKED">UNAVAILABLE</span></div>${readoutList([["Diagnostic", diagnostic.code], ["Policy state", "BLOCKED"], ["Receipt", receipt?.receipt_id ?? "Not accepted"]])}<div class="notice-card is-danger"><strong>No review result was accepted</strong><span>${escapeHtml(diagnostic.message)}</span></div><button class="secondary-action" type="button" data-action="run-compliance-check">Retry Tripwire</button></section>`;
  }
  return `<section class="property-section compliance-card"><div class="property-section-heading"><h4>Tripwire review readiness</h4><span class="status-badge" data-status="PENDING">READY</span></div>${readoutList([
    ["Product thread", binding.request.product_thread_id], ["Forge record", binding.request.forge_record_id], ["Occurrence", binding.request.occurrence_path.join(" / ")], ["Revision", binding.request.forge_revision_id],
  ])}<div class="review-only-banner"><strong>REVIEW-READINESS GUARDRAIL</strong><span>Tripwire checks for sufficient evidence on this immutable revision. It does not determine compliance.</span></div><button class="compliance-action" type="button" data-action="run-compliance-check">Check review readiness with Tripwire</button></section>`;
}

function renderPropertyFooter() {
  const footer = document.querySelector("#property-footer");
  if (fixture.capabilities?.complianceAtDesignClick) {
    footer.innerHTML = '<div class="review-mode-footer"><span data-icon="cursor" aria-hidden="true"></span><span><strong>Review readiness</strong>Select a mapped CAD entity, then use Tripwire. Insufficient evidence requires human review.</span></div>';
    return;
  }
  if (store.state.mobileReviewOnly) {
    footer.innerHTML = '<div class="review-mode-footer"><span data-icon="lock" aria-hidden="true"></span><span><strong>Review-only viewport</strong>Authoring controls are locked on mobile.</span></div>';
    return;
  }
  if (["QUEUED", "RUNNING"].includes(store.evidenceState.recomputeStatus)) {
    footer.innerHTML = `<div class="review-mode-footer is-warning"><span data-icon="refresh" aria-hidden="true"></span><span><strong>Recompute ${escapeHtml(store.evidenceState.recomputeStatus.toLowerCase())}</strong>The displayed artifact is stale until this synthetic attempt resolves.</span></div>`;
    return;
  }
  if (!store.evidenceState.editable) {
    if (store.draftCount > 0) {
      footer.innerHTML = `<div class="footer-button-row"><button class="secondary-action" type="button" data-action="clear-drafts">Discard failed proposal</button><button class="secondary-action" type="button" data-action="open-diagnostics">Review diagnostics</button></div>`;
      return;
    }
    footer.innerHTML = `<div class="review-mode-footer is-warning"><span data-icon="warning" aria-hidden="true"></span><span><strong>${escapeHtml(store.evidenceState.displayState)}</strong>${escapeHtml(editBlockReason())}</span></div>`;
    return;
  }
  if (store.draftCount > 0) {
    footer.innerHTML = `<div class="footer-button-row"><button class="secondary-action" type="button" data-action="clear-drafts">Discard</button><button class="footer-primary-action" type="button" data-action="recompute"${store.state.busy ? " disabled" : ""}>${icon("play")}Submit & recompute</button></div>`;
    return;
  }
  footer.innerHTML = '<div class="review-mode-footer"><span data-icon="info" aria-hidden="true"></span><span><strong>No staged changes</strong>Select a typed parameter or registered operation.</span></div>';
}

function renderBottomPanel() {
  for (const button of root.querySelectorAll("[data-bottom-tab]")) {
    button.setAttribute("aria-selected", String(button.dataset.bottomTab === store.state.bottomTab));
  }
  for (const panel of root.querySelectorAll(".bottom-panel-body [data-panel]")) {
    panel.hidden = panel.dataset.panel !== store.state.bottomTab;
  }
  document.querySelector("#timeline-panel").innerHTML = timelineMarkup();
  document.querySelector("#diagnostics-panel").innerHTML = diagnosticsMarkup();
  document.querySelector("#selection-panel").innerHTML = selectionPanelMarkup();
  const count = document.querySelector("#diagnostic-count");
  count.textContent = String(store.evidenceState.diagnostics.length);
  count.classList.toggle("has-errors", store.evidenceState.diagnostics.some((item) => item.severity === "ERROR"));
  const scenario = document.querySelector("#fixture-scenario");
  if (scenario) scenario.value = store.state.evidenceStateKey;
}

function timelineMarkup() {
  const history = [...fixture.history];
  if (store.state.evidenceStateKey !== "current") {
    history.push({
      sequence: history.length + 1,
      revisionId: store.evidenceState.requestedRevisionId,
      label: `${humanize(store.evidenceState.recomputeStatus)} attempt`,
      actor: "Synthetic adapter",
      disposition: store.evidenceState.recomputeStatus === "FAILED" ? "REJECTED" : "PENDING",
      time: "Now",
      summary: `Displayed revision remains ${shortId(store.evidenceState.displayedRevisionId)}`,
    });
  }
  return `<div class="timeline-track">${history.map((item) => `<button class="timeline-item" type="button" data-timeline-revision="${escapeAttribute(item.revisionId)}" aria-current="${item.revisionId === store.evidenceState.displayedRevisionId || item.revisionId === store.document.revisionId}">
    <span class="timeline-topline"><span class="timeline-index">R${String(item.sequence).padStart(2, "0")}</span><span class="status-badge" data-status="${escapeAttribute(dispositionStatus(item.disposition))}">${escapeHtml(item.disposition)}</span></span>
    <span class="timeline-title">${escapeHtml(item.label)}</span><span class="timeline-meta">${escapeHtml(item.summary)}</span><span class="timeline-hash">${escapeHtml(shortId(item.revisionId))} · ${escapeHtml(item.actor)} · ${escapeHtml(item.time)}</span>
  </button>`).join("")}</div>`;
}

function diagnosticsMarkup() {
  if (store.evidenceState.diagnostics.length === 0) {
    return '<div class="empty-state"><span data-icon="check" aria-hidden="true"></span><strong>No core diagnostics in this result</strong><span>The admitted core-kernel execution succeeded for the displayed immutable revision.</span></div>';
  }
  return `<div class="diagnostic-list">${store.evidenceState.diagnostics.map((item) => `<button class="diagnostic-row" type="button" data-diagnostic-id="${escapeAttribute(item.diagnosticId)}">
    <span class="diagnostic-icon">${icon(item.severity === "ERROR" ? "error" : "warning")}</span><span class="diagnostic-body"><strong>${escapeHtml(humanize(item.code))}</strong><span>${escapeHtml(item.message)}</span></span><span class="diagnostic-target">${escapeHtml(item.operationId ?? item.relatedIds.join(", ") ?? "Document")}</span><code class="diagnostic-code">${escapeHtml(item.code)}</code>
  </button>`).join("")}</div>`;
}

function selectionPanelMarkup() {
  const selection = store.state.selection;
  if (!selection || selection.kind === "document") {
    return '<div class="empty-state"><span data-icon="cursor" aria-hidden="true"></span><strong>No semantic entity selected</strong><span>Pick geometry or use arrow keys in the viewport; display indices will resolve to stable IDs.</span></div>';
  }
  const fields = selection.kind === "entity"
    ? [["Entity", selection.entityId], ["Semantic reference", selection.semanticReferenceId], ["Feature", selection.featureId], ["Body", selection.bodyId]]
    : [["Selection kind", selection.kind], ["Stable identity", selection.id], ["Document", store.document.documentId]];
  return `<div class="selection-detail-grid">${fields.map(([label, value]) => `<div class="selection-detail-card"><span class="property-label">${escapeHtml(label)}</span><code title="${escapeAttribute(value ?? "—")}">${escapeHtml(value ?? "—")}</code></div>`).join("")}</div>`;
}

function renderRevisionBanner() {
  const banner = document.querySelector("#revision-banner");
  const state = store.evidenceState;
  const recomputeAction = (label) => fixture.capabilities?.recompute === true
    ? `<button type="button" data-action="recompute">${label}</button>`
    : '<span class="revision-pin-note">Candidate 0.1 is revision-pinned; recompute is unavailable.</span>';
  if (state.displayState === "CURRENT") {
    banner.hidden = true;
    banner.replaceChildren();
    delete banner.dataset.state;
    delete banner.dataset.requestedRevision;
    delete banner.dataset.displayedRevision;
    return;
  }
  const copy = state.recomputeStatus === "QUEUED"
    ? `<span class="banner-icon">${icon("info")}</span><span><strong>Recompute queued</strong> · requested <code title="${escapeAttribute(state.requestedRevisionId)}">${escapeHtml(state.requestedRevisionId)}</code>, displaying prior revision <code title="${escapeAttribute(state.displayedRevisionId)}">${escapeHtml(state.displayedRevisionId)}</code></span>`
    : state.recomputeStatus === "RUNNING"
      ? `<span class="banner-icon">${icon("refresh")}</span><span><strong>Recompute running</strong> · requested <code title="${escapeAttribute(state.requestedRevisionId)}">${escapeHtml(state.requestedRevisionId)}</code>, displaying prior revision <code title="${escapeAttribute(state.displayedRevisionId)}">${escapeHtml(state.displayedRevisionId)}</code></span>`
      : state.displayState === "LAST_VALID"
    ? `<span class="banner-icon">${icon("error")}</span><span><strong>Last-valid geometry</strong> · attempted <code title="${escapeAttribute(state.requestedRevisionId)}">${escapeHtml(state.requestedRevisionId)}</code>, displaying producing revision <code title="${escapeAttribute(state.displayedRevisionId)}">${escapeHtml(state.displayedRevisionId)}</code></span><button type="button" data-action="open-diagnostics">Review diagnostics</button>`
    : state.displayState === "STALE"
      ? `<span class="banner-icon">${icon("warning")}</span><span><strong>Stale derived preview</strong> · requested <code title="${escapeAttribute(state.requestedRevisionId)}">${escapeHtml(state.requestedRevisionId)}</code>, displaying <code title="${escapeAttribute(state.displayedRevisionId)}">${escapeHtml(state.displayedRevisionId)}</code>; editing is blocked</span>${recomputeAction("Refresh")}`
      : `<span class="banner-icon">${icon("info")}</span><span><strong>Geometry unavailable</strong> · semantic records and diagnostics remain reviewable</span>${recomputeAction("Retry")}`;
  banner.dataset.state = state.displayState;
  banner.dataset.requestedRevision = state.requestedRevisionId;
  banner.dataset.displayedRevision = state.displayedRevisionId;
  banner.innerHTML = copy;
  banner.hidden = false;
}

function renderViewportMeta() {
  const label = document.querySelector("#renderer-label");
  if (!label) return;
  label.textContent = rendererDetails.mode === "webgl" ? "WebGL · derived meshes" : rendererDetails.mode === "fallback" ? "2D semantic fallback" : "Renderer pending";
  label.closest(".render-indicator")?.classList.toggle("is-fallback", rendererDetails.mode === "fallback");
  const triangles = store.document.scene.nodes.reduce((total, node) => total + node.mesh.indices.length / 3, 0);
  document.querySelector("#mesh-stats").textContent = `${store.document.scene.nodes.length} bodies · ${triangles.toLocaleString()} tris`;
  document.querySelector("#viewport-loading")?.remove();
}

function renderStatusBar() {
  const adapter = document.querySelector("#adapter-status");
  adapter.innerHTML = `<i class="status-light ${store.evidenceState.adapterOnline ? "is-online" : "is-offline"}" aria-hidden="true"></i>${escapeHtml(store.evidenceState.adapterOnline ? fixture.adapterLabel : "Core adapter unavailable")}`;
  document.querySelector("#document-units").textContent = `${store.document.units.length} · ${store.document.units.angle}`;
  const selection = store.state.selection;
  document.querySelector("#selection-status").textContent = selection?.kind === "entity" ? shortId(selection.entityId) : selection?.kind === "node" ? shortId(selection.nodeId) : selection ? humanize(selection.kind) : "Nothing selected";
  document.querySelector("#revision-status").textContent = `${store.evidenceState.displayState} · ${shortId(store.evidenceState.displayedRevisionId)}`;
}

function renderHoverHud(target, metadata = {}) {
  const hud = document.querySelector("#selection-hud");
  if (!target) {
    hud.hidden = true;
    hud.replaceChildren();
    return;
  }
  hud.innerHTML = `${icon("cursor")}<span>${metadata.keyboard ? `Keyboard ${metadata.index + 1}/${metadata.count}` : "Mapped entity"}</span><code>${escapeHtml(target.entityId ?? target.nodeId)}</code><span>→</span><code>${escapeHtml(target.semanticReferenceId ?? target.bodyId ?? target.nodeId)}</code>`;
  hud.hidden = false;
}

function renderPalette() {
  const backdrop = document.querySelector("#command-palette");
  backdrop.hidden = !store.state.commandPaletteOpen;
  if (!store.state.commandPaletteOpen) return;
  const input = document.querySelector("#command-search");
  if (input.value !== store.state.commandQuery) input.value = store.state.commandQuery;
  const commands = filteredCommands();
  store.state.commandIndex = Math.min(Math.max(0, store.state.commandIndex), Math.max(0, commands.length - 1));
  const groups = new Map();
  for (const command of commands) {
    if (!groups.has(command.group)) groups.set(command.group, []);
    groups.get(command.group).push(command);
  }
  document.querySelector("#command-results").innerHTML = commands.length === 0
    ? '<div class="empty-state compact"><strong>No matching commands</strong><span>Try an operation type, view, or diagnostic.</span></div>'
    : [...groups.entries()].map(([group, items]) => `<div class="command-section-label">${escapeHtml(group)}</div>${items.map((command) => {
      const index = commands.indexOf(command);
      return `<button class="command-result" type="button" role="option" data-command-id="${escapeAttribute(command.id)}" aria-selected="${index === store.state.commandIndex}"${command.disabled ? " disabled" : ""}><span class="command-result-icon">${icon(command.icon)}</span><span class="command-copy"><span class="command-name">${escapeHtml(command.label)}</span><span class="command-description">${escapeHtml(command.description)}</span></span><span class="command-kind">${escapeHtml(command.kind ?? "")}</span></button>`;
    }).join("")}`).join("");
}

function renderExchangeModal() {
  const modal = document.querySelector("#exchange-modal");
  modal.hidden = !store.state.exportOpen;
  if (!store.state.exportOpen) return;
  const allowed = store.evidenceState.displayState === "CURRENT" && store.evidenceState.recomputeStatus === "SUCCEEDED" && !store.state.mobileReviewOnly;
  document.querySelector("#exchange-content").innerHTML = `<div class="exchange-options">
    ${["STEP", "STL"].map((format) => `<button class="exchange-option" type="button" data-export-format="${format}" aria-pressed="${store.state.exportFormat === format}"${allowed ? "" : " disabled"}><strong>${format}</strong><span>${format === "STEP" ? "Exact neutral B-rep request; server re-import verification required." : "Derived tessellation request; watertightness and bounds verification required."}</span><code>${format === "STEP" ? "ISO 10303" : "Binary mesh"} · ${escapeHtml(store.document.units.length)}</code></button>`).join("")}
  </div>
  <div class="exchange-summary">${[
    ["Document", store.document.documentId],
    ["Displayed revision", store.evidenceState.displayedRevisionId],
    ["Source artifact", store.evidenceState.sourceArtifactId],
    ["Browser authority", "Request only — no geometry export"],
  ].map(([label, value]) => `<div class="exchange-summary-row"><span>${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></div>`).join("")}</div>
  ${allowed ? '<div class="notice-card"><strong>Verification remains server-owned</strong><span>The browser stages an exact request. A file is not offered until the authoritative adapter reports a verified result.</span></div>' : `<div class="notice-card is-danger"><strong>Export blocked</strong><span>${escapeHtml(store.state.mobileReviewOnly ? "Mobile is review-only." : "Only matching CURRENT succeeded geometry may source an export request.")}</span></div>`}
  <div class="modal-actions"><button class="secondary-action" type="button" data-action="close-export">Cancel</button><button class="footer-primary-action" type="button" data-action="stage-export"${allowed ? "" : " disabled"}>${icon("download")}Stage ${escapeHtml(store.state.exportFormat)} request</button></div>`;
}

function bindEvents() {
  root.addEventListener("click", async (event) => {
    const target = event.target;
    const actionButton = target.closest("[data-action]");
    if (actionButton) {
      await handleAction(actionButton.dataset.action, actionButton);
      return;
    }
    const selectionButton = target.closest("[data-select-kind]");
    if (selectionButton) {
      selectFromTree(selectionButton.dataset.selectKind, selectionButton.dataset.selectId);
      return;
    }
    const tab = target.closest("[data-bottom-tab]");
    if (tab) {
      store.setBottomTab(tab.dataset.bottomTab);
      return;
    }
    const mobile = target.closest("[data-mobile-panel]");
    if (mobile) {
      store.setMobilePanel(mobile.dataset.mobilePanel);
      return;
    }
    const viewButton = target.closest("[data-view]");
    if (viewButton) {
      for (const button of root.querySelectorAll("[data-view]")) button.classList.toggle("is-active", button === viewButton && button.dataset.view === "perspective");
      viewer.setView(viewButton.dataset.view);
      return;
    }
    const commandButton = target.closest("[data-command-id]");
    if (commandButton) {
      executeCommand(commandButton.dataset.commandId);
      return;
    }
    const formatButton = target.closest("[data-export-format]");
    if (formatButton) {
      store.patch({ exportFormat: formatButton.dataset.exportFormat }, "export");
      return;
    }
    const timelineButton = target.closest("[data-timeline-revision]");
    if (timelineButton) showToast("Revision inspected", shortId(timelineButton.dataset.timelineRevision), "info");
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-parameter-id]")) {
      try {
        validateDecimal(target.value);
        store.stageParameter(target.dataset.parameterId, normalizeDecimal(target.value), { emit: false });
      } catch {
        // Partial numeric input remains local to the control until change validation.
      }
      return;
    }
    if (target.matches("[data-schema-path]") && target.tagName !== "SELECT" && target.type !== "checkbox") {
      const selection = store.state.selection;
      const operation = selection?.kind === "operation" ? store.operationById(selection.id) : null;
      const descriptor = operation && store.descriptorFor(operation);
      if (!operation || !descriptor) return;
      try {
        const payload = store.state.drafts.payloads[operation.operationId] ?? operation.payload;
        const next = updateSchemaValue(payload, descriptor.payloadSchema, target.dataset.schemaPath, target.value, { checked: target.checked });
        store.stagePayload(operation.operationId, next, { emit: false });
      } catch {
        // JSON and numeric fields can be transiently incomplete while the user types.
      }
      return;
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("#fixture-scenario")) {
      store.setEvidenceState(target.value);
      return;
    }
    if (target.matches("[data-parameter-id]")) {
      try {
        validateDecimal(target.value);
        store.stageParameter(target.dataset.parameterId, normalizeDecimal(target.value));
      } catch (error) {
        showToast("Parameter not staged", error.message, "danger");
        target.setAttribute("aria-invalid", "true");
      }
      return;
    }
    if (target.matches("[data-schema-path]")) {
      stageSchemaControl(target);
      return;
    }
    if (target.matches("#import-input")) handleImportFile(target.files?.[0]);
  });

  document.querySelector("#tree-search").addEventListener("input", (event) => {
    treeSearch = event.target.value.trim().toLowerCase();
    renderTree();
    hydrateIcons(document.querySelector("#model-panel"));
  });

  document.querySelector("#command-search").addEventListener("input", (event) => {
    store.state.commandQuery = event.target.value;
    store.state.commandIndex = 0;
    renderPalette();
    hydrateIcons(document.querySelector("#command-palette"));
  });

  document.querySelector("#command-search").addEventListener("keydown", (event) => {
    const commands = filteredCommands();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      store.state.commandIndex = (store.state.commandIndex + direction + commands.length) % commands.length;
      renderPalette();
      hydrateIcons(document.querySelector("#command-palette"));
    } else if (event.key === "Enter" && commands[store.state.commandIndex]) {
      event.preventDefault();
      executeCommand(commands[store.state.commandIndex].id);
    }
  });

  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      store.openPalette();
      queueMicrotask(() => document.querySelector("#command-search").focus());
    } else if (event.key === "/" && !typing) {
      event.preventDefault();
      document.querySelector("#tree-search").focus();
    } else if (event.key === "Escape") {
      if (store.state.commandPaletteOpen) store.closePalette();
      else if (store.state.exportOpen) store.patch({ exportOpen: false }, "export");
      else if (store.state.leftOpen || store.state.rightOpen) store.patch({ leftOpen: false, rightOpen: false }, "panel");
    }
  });
}

async function handleAction(action, button) {
  switch (action) {
    case "toggle-model": store.patch({ leftOpen: !store.state.leftOpen }, "panel"); break;
    case "toggle-properties": store.patch({ rightOpen: !store.state.rightOpen }, "panel"); break;
    case "collapse-tree": store.patch({ leftOpen: false }, "panel"); break;
    case "open-command-palette": store.openPalette(); queueMicrotask(() => document.querySelector("#command-search").focus()); break;
    case "open-add-operation": store.openPalette("add "); queueMicrotask(() => document.querySelector("#command-search").focus()); break;
    case "model-menu": showToast("Model controls", "Filter stable bodies, parameters, and ordered operations from this PartDocument.", "info"); break;
    case "properties-menu": showToast("Inspector", "Properties preserve stable IDs and source provenance in every selection mode.", "info"); break;
    case "pin-properties": button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true")); break;
    case "toggle-bottom-panel": store.patch({ bottomCollapsed: !store.state.bottomCollapsed }, "panel"); break;
    case "toggle-wireframe": {
      const visible = viewer.toggleEdges();
      button.setAttribute("aria-pressed", String(visible));
      showToast("Viewport edges", visible ? "Edge overlay enabled." : "Edge overlay hidden.", "info");
      break;
    }
    case "viewport-settings": store.openPalette("view "); queueMicrotask(() => document.querySelector("#command-search").focus()); break;
    case "import": document.querySelector("#import-input").click(); break;
    case "open-export": store.patch({ exportOpen: true }, "export"); break;
    case "close-export": store.patch({ exportOpen: false }, "export"); break;
    case "stage-export": stageExport(); break;
    case "recompute": await simulateRecompute(); break;
    case "run-compliance-check": await runComplianceCheck(); break;
    case "guide-review-selection":
      store.setMobilePanel("viewport");
      viewportHost.focus({ preventScroll: true });
      showToast("Select a CAD entity", "Tap a face, or use the viewport arrow keys and Enter. Stable selection will remain bound to this revision.", "info", 6500);
      break;
    case "open-review-details":
      store.setMobilePanel("properties");
      document.querySelector("#properties-content")?.focus({ preventScroll: true });
      break;
    case "open-diagnostics": store.setBottomTab("diagnostics"); if (store.state.mobileReviewOnly) store.setMobilePanel("history"); break;
    case "clear-drafts": {
      const restoreCurrent = !store.evidenceState.editable && store.draftCount > 0;
      store.clearDrafts();
      if (restoreCurrent) store.setEvidenceState("current");
      showToast(
        restoreCurrent ? "Failed proposal discarded" : "Draft cleared",
        restoreCurrent ? "The last valid synthetic source snapshot is current again; no canonical document was changed." : "No canonical document was changed.",
        "info",
      );
      break;
    }
    case "toggle-node-visibility": {
      const nodeId = button.dataset.nodeId;
      store.setNodeVisibility(nodeId, !store.state.visibleNodeIds.has(nodeId));
      break;
    }
    case "isolate-node": store.isolateNode(button.dataset.nodeId); break;
    case "show-all-nodes": store.showAllNodes(); break;
    case "keyboard-help": showToast("Keyboard navigation", "⌘K commands · / tree filter · viewport arrows browse stable entities · Enter selects · Esc clears.", "info", 6500); break;
    case "actor-menu": showToast("Candidate context", "Local Candidate 0.1. Review support only; no external action or legal approval.", "info"); break;
    default: break;
  }
}

function selectFromTree(kind, id) {
  if (kind === "node") {
    viewer.selectNode(id, "tree");
    return;
  }
  store.select({ kind, id });
}

function syncViewerVisibility() {
  for (const node of store.document.scene.nodes) viewer.setNodeVisibility(node.nodeId, store.state.visibleNodeIds.has(node.nodeId));
}

function stageSchemaControl(control) {
  const selection = store.state.selection;
  if (selection?.kind !== "operation") return;
  const operation = store.operationById(selection.id);
  const descriptor = operation && store.descriptorFor(operation);
  if (!operation || !descriptor) return;
  const payload = store.state.drafts.payloads[operation.operationId] ?? operation.payload;
  try {
    const next = updateSchemaValue(payload, descriptor.payloadSchema, control.dataset.schemaPath, control.value, { checked: control.checked });
    store.stagePayload(operation.operationId, next);
  } catch (error) {
    control.setAttribute("aria-invalid", "true");
    showToast("Payload value not staged", error.message, "danger");
  }
}

async function simulateRecompute() {
  if (fixture.capabilities?.recompute !== true) {
    showToast("Revision-pinned review build", "Recompute is unavailable in Candidate 0.1. The displayed CAD revision is immutable.", "info", 6200);
    return;
  }
  if (store.state.busy || store.state.mobileReviewOnly) return;
  const invalid = Object.values(store.state.drafts.parameters).some((value) => Number(value) <= 0);
  store.setBusy(true);
  store.setEvidenceState("queued");
  showToast("Synthetic attempt queued", "Browser state transition only; no geometry authority is claimed.", "info");
  await delay(180);
  store.setEvidenceState("running");
  await delay(360);
  if (invalid) {
    store.setEvidenceState("failed");
    showToast("Attempt failed", "The attempted revision remains failed; prior geometry is labeled last-valid.", "danger", 6200);
  } else {
    store.setEvidenceState("current");
    store.clearDrafts();
    showToast("Synthetic current state restored", "The browser fixture recovered. Integration evidence still requires an authoritative core result.", "success", 6200);
  }
  store.setBusy(false);
}

async function runComplianceCheck() {
  const selection = store.state.selection;
  let request;
  try {
    request = createComplianceRequest(store.document, selection, store.evidenceState.displayedRevisionId);
  } catch (error) {
    complianceReview = { phase: "BLOCKED", entityId: selection?.entityId ?? null, payload: null, diagnostic: toComplianceDiagnostic(error) };
    renderReviewPath();
    renderProperties();
    hydrateIcons(document.querySelector("#properties-panel"));
    return;
  }
  complianceReview = { phase: "RUNNING", entityId: selection.entityId, payload: null, diagnostic: null };
  renderReviewPath();
  renderProperties();
  hydrateIcons(document.querySelector("#properties-panel"));
  try {
    const { payload, validated } = await requestComplianceReview(request);
    const blockedDiagnostic = validated.displayState === "BOUND" ? null : toComplianceDiagnostic(payload.diagnostic);
    complianceReview = validated.displayState === "BOUND"
      ? { phase: "BOUND", entityId: selection.entityId, payload, diagnostic: null }
      : { phase: "BLOCKED", entityId: selection.entityId, payload, diagnostic: blockedDiagnostic };
    showToast(validated.displayState === "BOUND" ? "Human review required" : "Review check unavailable", validated.displayState === "BOUND" ? "Tripwire returned insufficient evidence. No compliance determination was made." : blockedDiagnostic.message, validated.displayState === "BOUND" ? "info" : "danger");
  } catch (error) {
    const diagnostic = toComplianceDiagnostic(error);
    complianceReview = { phase: "BLOCKED", entityId: selection.entityId, payload: null, diagnostic };
    showToast("Review check unavailable", diagnostic.message, "danger");
  }
  renderReviewPath();
  renderProperties();
  hydrateIcons(document.querySelector("#properties-panel"));
}

function stageExport() {
  if (store.evidenceState.displayState !== "CURRENT" || store.evidenceState.recomputeStatus !== "SUCCEEDED") return;
  const format = store.state.exportFormat;
  store.patch({ exportOpen: false }, "export");
  showToast(`${format} request staged`, `Bound to ${shortId(store.evidenceState.displayedRevisionId)} and ${shortId(store.evidenceState.sourceArtifactId)}. No file was fabricated.`, "success", 7200);
}

function handleImportFile(file) {
  if (fixture.capabilities?.import !== true) return;
  if (!file) return;
  if (store.state.mobileReviewOnly) {
    showToast("Import blocked", "Mobile layout is review-only.", "danger");
    return;
  }
  const extension = file.name.split(".").at(-1)?.toUpperCase();
  if (!["STEP", "STP", "STL"].includes(extension)) {
    showToast("Unsupported neutral file", "Choose STEP, STP, or STL. The browser will stage a server import request only.", "danger");
    return;
  }
  showToast("Import proposal staged", `${file.name} · ${formatBytes(file.size)}. File contents were not treated as verified geometry.`, "success", 7000);
  document.querySelector("#import-input").value = "";
}

function filteredCommands() {
  const staticCommands = [
    command("view:fit", "View · Fit geometry", "Frame all visible PartDocument bodies.", "Viewport", "fit", "F"),
    command("view:front", "View · Front", "Align the camera to the front datum.", "Viewport", "view-front", "1"),
    command("view:top", "View · Top", "Align the camera to the top datum.", "Viewport", "view-top", "2"),
    command("view:show-all", "Visibility · Show all", "Restore every PartDocument body.", "Viewport", "eye", ""),
    command("panel:diagnostics", "Open diagnostics", "Review stable codes and blocked dependents.", "Review", "diagnostic", ""),
  ];
  const descriptorCommands = fixture.descriptors.map((descriptor) => ({
    id: `add:${descriptor.registryKey}`,
    label: `Add · ${descriptor.title}`,
    description: descriptor.description,
    group: "Registered operations",
    icon: "cube",
    kind: descriptor.registryKey,
    disabled: !store.canEdit || (descriptor.documentKinds && !descriptor.documentKinds.includes(store.document.kind)),
  }));
  const queryText = store.state.commandQuery.toLowerCase().trim();
  if (!queryText) return [...staticCommands, ...descriptorCommands];
  const terms = queryText.split(/\s+/).filter(Boolean);
  return [...staticCommands, ...descriptorCommands].filter((item) => {
    const haystack = `${item.label} ${item.description} ${item.group} ${item.kind}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function executeCommand(commandId) {
  if (commandId.startsWith("add:")) {
    const registryKey = commandId.slice(4);
    const descriptor = fixture.descriptors.find((candidate) => candidate.registryKey === registryKey);
    if (!descriptor) return;
    try {
      store.stageOperation(descriptor);
      store.closePalette();
      showToast("Operation proposal staged", `${descriptor.registryKey} was rendered from its descriptor schema.`, "success");
    } catch (error) {
      showToast("Operation not staged", error.message, "danger");
    }
    return;
  }
  const actions = {
    "view:fit": () => viewer.fit(),
    "view:front": () => viewer.setView("front"),
    "view:top": () => viewer.setView("top"),
    "view:show-all": () => store.showAllNodes(),
    "panel:diagnostics": () => store.setBottomTab("diagnostics"),
    "state:current": () => store.setEvidenceState("current"),
    "state:failed": () => store.setEvidenceState("failed"),
    "state:stale": () => store.setEvidenceState("stale"),
  };
  actions[commandId]?.();
  store.closePalette();
}

function operationStatus(operationId) {
  return store.evidenceState.operationStatus[operationId] ?? "SUCCEEDED";
}

function selectionMatches(kind, id) {
  const selection = store.state.selection;
  if (!selection) return false;
  if (kind === "node") return selection.nodeId === id || selection.id === id;
  return selection.kind === kind && selection.id === id;
}

function propertyHero(iconName, title, id) {
  return `<div class="property-hero"><span class="property-hero-icon"><span data-icon="${escapeAttribute(iconName)}" aria-hidden="true"></span></span><span class="property-hero-copy"><h3>${escapeHtml(title)}</h3><code title="${escapeAttribute(id)}">${escapeHtml(id)}</code></span></div>`;
}

function readoutList(rows) {
  return `<dl class="readout-list">${rows.map(([label, value]) => `<div class="readout-row"><dt>${escapeHtml(label)}</dt><dd title="${escapeAttribute(value ?? "—")}">${escapeHtml(value ?? "—")}</dd></div>`).join("")}</dl>`;
}

function parameterSlotFields(operation, descriptor) {
  const parameters = store.document.parameters ?? [];
  return `<div class="property-grid">${Object.entries(descriptor.parameterSlots).map(([slot, type]) => `<div class="property-field"><label for="slot-${escapeAttribute(slot)}"><span>${escapeHtml(humanize(slot))}</span><span>${escapeHtml(type)}</span></label><select id="slot-${escapeAttribute(slot)}" disabled><option>${escapeHtml(operation.parameterBindings[slot] ?? parameters.find((item) => item.valueType === type)?.parameterId ?? "Unbound")}</option></select></div>`).join("")}</div>`;
}

function bodySummary() {
  return `<section class="property-section"><div class="property-section-heading"><h4>Part bodies</h4></div>${store.document.bodies.map((body) => `<button class="summary-link" type="button" data-select-kind="node" data-select-id="${escapeAttribute(body.bodyId)}"><span data-icon="body" aria-hidden="true"></span><span><strong>${escapeHtml(body.label)}</strong><small>${escapeHtml(body.material)} · ${body.featureIds.length} linked feature${body.featureIds.length === 1 ? "" : "s"}</small></span><span data-icon="chevron-right" aria-hidden="true"></span></button>`).join("")}</section>`;
}

function editabilityNotice() {
  if (store.state.mobileReviewOnly) return '<div class="notice-card"><strong>Review-only mobile layout</strong><span>Part selection, operation payloads, and diagnostics remain inspectable. Authoring controls are disabled.</span></div>';
  if (!store.evidenceState.editable) return `<div class="notice-card is-danger"><strong>${escapeHtml(store.evidenceState.displayState)} cannot be edited as current</strong><span>${escapeHtml(editBlockReason())}</span></div>`;
  return "";
}

function missingSelection(title, id) {
  return `${propertyHero("warning", title, id)}<div class="notice-card is-danger"><strong>Stable identity not found</strong><span>The browser failed closed instead of guessing from array position.</span></div>`;
}

function emptyTreeMessage(message) {
  return `<div class="tree-empty">${escapeHtml(message)}</div>`;
}

function matchesTreeSearch(...values) {
  if (!treeSearch) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(treeSearch));
}

function editBlockReason() {
  if (store.state.mobileReviewOnly) return "Mobile layout is review-only.";
  if (store.evidenceState.displayState === "LAST_VALID") return "Correct or roll back the failed attempted revision before proposing another edit.";
  if (store.evidenceState.displayState === "STALE") return "Refresh the requested revision before proposing edits.";
  return "A matching CURRENT succeeded result is required for authoring.";
}

function dispositionStatus(disposition) {
  if (["VERIFIED", "AUTHORIZED", "REVIEWED"].includes(disposition)) return "VERIFIED";
  if (["REJECTED", "FAILED"].includes(disposition)) return "REJECTED";
  if (["AWAITING_REVIEW", "PROPOSED", "NOTIONAL", "PENDING"].includes(disposition)) return "PENDING";
  return "PENDING";
}

function command(id, label, description, group, iconName, kind) {
  return { id, label, description, group, icon: iconName, kind, disabled: false };
}

function flattenObjectPaths(value, path = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [path.map(encodeURIComponent).join("/")];
  return Object.entries(value).flatMap(([key, child]) => flattenObjectPaths(child, [...path, key]));
}

function validateDecimal(value) {
  if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value.trim()) || !Number.isFinite(Number(value))) {
    throw new Error("Enter a finite decimal value without a unit suffix.");
  }
}

function normalizeDecimal(value) {
  const text = value.trim();
  return Object.is(Number(text), -0) ? "0" : text;
}

function shortId(value) {
  const text = String(value ?? "—");
  const separator = text.indexOf(":");
  if (separator === -1 || text.length <= 21) return text;
  return `${text.slice(0, separator + 1)}…${text.slice(-8)}`;
}

function humanize(value) {
  return String(value).replaceAll(/[_:-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function showToast(title, message, tone = "success", duration = 4600) {
  const region = document.querySelector("#toast-region");
  const id = `toast-${++toastCounter}`;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.tone = tone;
  toast.id = id;
  toast.innerHTML = `<span class="toast-icon">${icon(tone === "danger" ? "error" : tone === "info" ? "info" : "check")}</span><span class="toast-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></span><button type="button" aria-label="Dismiss ${escapeAttribute(title)}">${icon("close")}</button>`;
  toast.querySelector("button").addEventListener("click", () => toast.remove());
  region.append(toast);
  setTimeout(() => toast.remove(), duration);
}
