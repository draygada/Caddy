import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { rebindStableTarget, resolveStableEntity, stableTargets, validateRenderScene } from "./internal-scene.js";

const DEG_TO_RAD = Math.PI / 180;

export class WorkbenchViewer {
  constructor(host, callbacks = {}, options = {}) {
    this.host = host;
    this.callbacks = {
      onHover: callbacks.onHover ?? (() => {}),
      onSelect: callbacks.onSelect ?? (() => {}),
      onSelectionFailure: callbacks.onSelectionFailure ?? (() => {}),
      onRendererChange: callbacks.onRendererChange ?? (() => {}),
    };
    this.forceFallback = options.forceFallback === true;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.sceneModel = null;
    this.nodeObjects = new Map();
    this.visibleNodeIds = new Set();
    this.selection = null;
    this.hover = null;
    this.keyboardIndex = -1;
    this.edgesVisible = true;
    this.animationFrame = null;
    this.resizeObserver = null;
    this.rendererMode = "pending";

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.animate = this.animate.bind(this);
  }

  mount(sceneModel) {
    this.dispose();
    this.sceneModel = validateRenderScene(sceneModel);
    if (this.forceFallback) {
      this.mountFallback("Forced fallback for compatibility evidence.");
      return;
    }
    try {
      this.mountWebGL();
    } catch (error) {
      this.mountFallback(error instanceof Error ? error.message : "WebGL initialization failed.");
    }
  }

  mountWebGL() {
    this.host.replaceChildren();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15191e);
    this.scene.fog = new THREE.FogExp2(0x15191e, 0.0027);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    this.camera.position.set(106, 92, 122);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.host.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 900;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.contentGroup = new THREE.Group();
    this.contentGroup.name = "derived-preview";
    this.scene.add(this.contentGroup);

    this.scene.add(new THREE.HemisphereLight(0xd7ebf2, 0x20252a, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffe4c8, 3.4);
    keyLight.position.set(85, 130, 95);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -110;
    keyLight.shadow.camera.right = 110;
    keyLight.shadow.camera.top = 110;
    keyLight.shadow.camera.bottom = -110;
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x79bad1, 1.5);
    rimLight.position.set(-110, 70, -90);
    this.scene.add(rimLight);

    const grid = new THREE.GridHelper(360, 36, 0x46525c, 0x2b333a);
    grid.position.y = -4.4;
    grid.material.opacity = 0.34;
    grid.material.transparent = true;
    this.scene.add(grid);

    this.populateScene();
    this.fit();
    this.bindInteraction();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.rendererMode = "webgl";
    this.callbacks.onRendererChange({ mode: "webgl", reason: null });
    this.animate();
  }

  populateScene() {
    for (const node of this.sceneModel.nodes) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(node.mesh.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(node.mesh.normals, 3));
      geometry.setIndex(node.mesh.indices);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const color = new THREE.Color(node.appearance?.color ?? "#71838c");
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.46,
        roughness: 0.42,
        side: THREE.DoubleSide,
        transparent: (node.appearance?.opacity ?? 1) < 1,
        opacity: node.appearance?.opacity ?? 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = node.nodeId;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.nodeId = node.nodeId;
      applyTransform(mesh, node.transform);

      const edgeGeometry = new THREE.EdgesGeometry(geometry, 24);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x26343a, transparent: true, opacity: 0.64 });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.renderOrder = 2;
      mesh.add(edges);

      mesh.visible = node.visible;
      this.contentGroup.add(mesh);
      this.nodeObjects.set(node.nodeId, {
        node,
        mesh,
        edges,
        displayTransform: structuredClone(node.transform),
      });
      if (node.visible) this.visibleNodeIds.add(node.nodeId);
    }
  }

  bindInteraction() {
    this.host.addEventListener("pointermove", this.handlePointerMove);
    this.host.addEventListener("pointerleave", this.handlePointerLeave);
    this.host.addEventListener("pointerdown", this.handlePointerDown);
    this.host.addEventListener("keydown", this.handleKeyDown);
  }

  unbindInteraction() {
    this.host.removeEventListener("pointermove", this.handlePointerMove);
    this.host.removeEventListener("pointerleave", this.handlePointerLeave);
    this.host.removeEventListener("pointerdown", this.handlePointerDown);
    this.host.removeEventListener("keydown", this.handleKeyDown);
  }

  handlePointerMove(event) {
    if (this.rendererMode !== "webgl") return;
    const hit = this.pick(event);
    const next = hit?.target ?? null;
    if (sameTarget(this.hover, next)) return;
    this.hover = next;
    this.updateHighlights();
    this.callbacks.onHover(next);
    this.renderer.domElement.style.cursor = next ? "pointer" : "grab";
  }

  handlePointerLeave() {
    if (!this.hover) return;
    this.hover = null;
    this.updateHighlights();
    this.callbacks.onHover(null);
  }

  handlePointerDown(event) {
    if (event.button !== 0 || this.rendererMode !== "webgl") return;
    const hit = this.pick(event);
    if (hit?.failure) {
      this.callbacks.onSelectionFailure(hit.failure);
      return;
    }
    if (!hit?.target) return;
    this.select(hit.target, "pointer");
  }

  handleKeyDown(event) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Enter", " ", "Escape", "Home", "End"].includes(event.key)) return;
    const targets = stableTargets(this.sceneModel, this.visibleNodeIds);
    if (targets.length === 0) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.clearSelection("keyboard");
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const target = targets[Math.max(0, this.keyboardIndex)] ?? targets[0];
      this.select(target, "keyboard");
      return;
    }

    event.preventDefault();
    if (event.key === "Home") this.keyboardIndex = 0;
    else if (event.key === "End") this.keyboardIndex = targets.length - 1;
    else {
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      this.keyboardIndex = (Math.max(this.keyboardIndex, 0) + direction + targets.length) % targets.length;
    }
    this.hover = targets[this.keyboardIndex];
    this.updateHighlights();
    this.callbacks.onHover(this.hover, { keyboard: true, index: this.keyboardIndex, count: targets.length });
  }

  pick(event) {
    const rect = this.host.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.nodeObjects.values()].filter(({ mesh }) => mesh.visible).map(({ mesh }) => mesh);
    const intersection = this.raycaster.intersectObjects(meshes, false)[0];
    if (!intersection || !Number.isInteger(intersection.faceIndex)) return null;
    const record = this.nodeObjects.get(intersection.object.userData.nodeId);
    if (!record) return null;
    const resolution = resolveStableEntity(record.node, intersection.faceIndex);
    if (!resolution.ok) {
      return {
        failure: {
          code: resolution.code,
          nodeId: record.node.nodeId,
          triangleIndex: intersection.faceIndex,
        },
      };
    }
    return { target: resolution.target };
  }

  select(target, source = "api") {
    const rebound = rebindStableTarget(this.sceneModel, target);
    if (!rebound.ok) {
      this.callbacks.onSelectionFailure({
        code: rebound.code,
        nodeId: target?.nodeId ?? null,
        entityId: target?.entityId ?? null,
      });
      return false;
    }
    this.selection = rebound.target;
    const targets = stableTargets(this.sceneModel, this.visibleNodeIds);
    this.keyboardIndex = Math.max(0, targets.findIndex((item) => sameTarget(item, this.selection)));
    this.updateHighlights();
    this.callbacks.onSelect(this.selection, { source });
    return true;
  }

  selectNode(nodeId, source = "tree") {
    const record = this.nodeObjects.get(nodeId);
    if (!record) return false;
    return this.select({
      nodeId: record.node.nodeId,
      nodeKind: record.node.kind,
      bodyId: record.node.bodyId ?? null,
      entityId: null,
      semanticReferenceId: null,
      featureId: null,
      startTriangle: 0,
      triangleCount: record.node.mesh.indices.length / 3,
    }, source);
  }

  clearSelection(source = "api") {
    this.selection = null;
    this.hover = null;
    this.keyboardIndex = -1;
    this.updateHighlights();
    this.callbacks.onSelect(null, { source });
  }

  updateHighlights() {
    if (this.rendererMode !== "webgl") {
      this.updateFallbackSelection();
      return;
    }
    this.removeOverlay("selection-overlay");
    this.removeOverlay("hover-overlay");
    for (const { mesh } of this.nodeObjects.values()) {
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
    if (this.selection) {
      this.addEntityOverlay(this.selection, 0xf6ad68, 0.58, "selection-overlay");
      const record = this.nodeObjects.get(this.selection.nodeId);
      if (record) {
        record.mesh.material.emissive.setHex(0x3c210d);
        record.mesh.material.emissiveIntensity = 0.18;
      }
    }
    if (this.hover && !sameTarget(this.hover, this.selection)) {
      this.addEntityOverlay(this.hover, 0x91d8df, 0.36, "hover-overlay");
    }
  }

  addEntityOverlay(target, color, opacity, name) {
    const rebound = rebindStableTarget(this.sceneModel, target);
    if (!rebound.ok) return;
    const currentTarget = rebound.target;
    const record = this.nodeObjects.get(currentTarget.nodeId);
    if (!record) return;
    const source = record.node.mesh;
    const start = currentTarget.startTriangle * 3;
    const count = currentTarget.triangleCount * 3;
    const selectedIndices = Array.from(source.indices).slice(start, start + count);
    if (selectedIndices.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(source.positions, 3));
    geometry.setIndex(selectedIndices);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const overlay = new THREE.Mesh(geometry, material);
    overlay.name = name;
    applyTransform(overlay, record.displayTransform);
    overlay.renderOrder = 8;
    this.contentGroup.add(overlay);
  }

  removeOverlay(name) {
    const existing = this.contentGroup?.getObjectByName(name);
    if (!existing) return;
    existing.removeFromParent();
    existing.geometry?.dispose();
    existing.material?.dispose();
  }

  setNodeVisibility(nodeId, visible) {
    const record = this.nodeObjects.get(nodeId);
    if (!record) return false;
    if (record.mesh) record.mesh.visible = Boolean(visible);
    if (visible) this.visibleNodeIds.add(nodeId);
    else this.visibleNodeIds.delete(nodeId);
    if (!visible && this.selection?.nodeId === nodeId) this.clearSelection("visibility");
    this.updateFallbackVisibility();
    return true;
  }

  isolate(nodeId) {
    if (!this.nodeObjects.has(nodeId)) return false;
    for (const [id] of this.nodeObjects) this.setNodeVisibility(id, id === nodeId);
    this.fit();
    return true;
  }

  showAll() {
    for (const [id] of this.nodeObjects) this.setNodeVisibility(id, true);
    this.fit();
  }

  setNodeTransform(nodeId, transform) {
    const record = this.nodeObjects.get(nodeId);
    if (!record) return false;
    record.displayTransform = {
      translation: [...transform.translation],
      rotationDegrees: [...transform.rotationDegrees],
      scale: [...transform.scale],
    };
    if (this.rendererMode === "webgl") applyTransform(record.mesh, transform);
    this.updateHighlights();
    return true;
  }

  toggleEdges(force) {
    this.edgesVisible = typeof force === "boolean" ? force : !this.edgesVisible;
    for (const { edges } of this.nodeObjects.values()) {
      if (edges) edges.visible = this.edgesVisible;
    }
    return this.edgesVisible;
  }

  setView(preset) {
    if (this.rendererMode !== "webgl") return;
    const center = this.computeVisibleBounds().getCenter(new THREE.Vector3());
    const distance = Math.max(80, this.camera.position.distanceTo(this.controls.target));
    const directions = {
      front: new THREE.Vector3(0, 0, 1),
      top: new THREE.Vector3(0, 1, 0.001),
      right: new THREE.Vector3(1, 0, 0),
      perspective: new THREE.Vector3(0.7, 0.58, 0.78),
    };
    if (preset === "fit") {
      this.fit();
      return;
    }
    const direction = directions[preset] ?? directions.perspective;
    this.camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
    this.controls.target.copy(center);
    this.controls.update();
  }

  fit() {
    if (this.rendererMode === "fallback") return;
    if (!this.camera || !this.controls) return;
    const bounds = this.computeVisibleBounds();
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const distance = (maxSize / (2 * Math.tan((this.camera.fov * DEG_TO_RAD) / 2))) * 1.48;
    const direction = new THREE.Vector3(0.78, 0.65, 0.9).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));
    this.camera.near = Math.max(0.1, distance / 1000);
    this.camera.far = Math.max(2000, distance * 12);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }

  computeVisibleBounds() {
    const bounds = new THREE.Box3();
    for (const { mesh } of this.nodeObjects.values()) {
      if (!mesh.visible) continue;
      mesh.updateMatrixWorld(true);
      bounds.expandByObject(mesh);
    }
    return bounds;
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    if (!this.renderer) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }

  mountFallback(reason) {
    this.host.replaceChildren();
    this.rendererMode = "fallback";
    this.visibleNodeIds = new Set(this.sceneModel.nodes.filter((node) => node.visible).map((node) => node.nodeId));
    for (const node of this.sceneModel.nodes) {
      this.nodeObjects.set(node.nodeId, {
        node,
        mesh: null,
        edges: null,
        displayTransform: structuredClone(node.transform),
      });
    }
    const container = document.createElement("div");
    container.className = "fallback-viewer";
    container.innerHTML = fallbackMarkup(this.sceneModel, reason);
    this.host.append(container);
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-fallback-node]");
      if (!button) return;
      this.selectNode(button.dataset.fallbackNode, "fallback");
    });
    this.host.addEventListener("keydown", this.handleKeyDown);
    this.callbacks.onRendererChange({ mode: "fallback", reason });
  }

  updateFallbackSelection() {
    for (const button of this.host.querySelectorAll("[data-fallback-node]")) {
      button.setAttribute("aria-pressed", String(button.dataset.fallbackNode === this.selection?.nodeId));
    }
  }

  updateFallbackVisibility() {
    for (const button of this.host.querySelectorAll("[data-fallback-node]")) {
      button.hidden = !this.visibleNodeIds.has(button.dataset.fallbackNode);
    }
  }

  dispose() {
    this.unbindInteraction();
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controls?.dispose();
    if (this.scene) {
      this.scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.contentGroup = null;
    this.nodeObjects.clear();
    this.visibleNodeIds.clear();
    this.rendererMode = "pending";
    this.host.replaceChildren();
  }
}

function applyTransform(object, transform) {
  object.position.fromArray(transform.translation);
  object.rotation.set(...transform.rotationDegrees.map((value) => value * DEG_TO_RAD), "XYZ");
  object.scale.fromArray(transform.scale);
  object.updateMatrixWorld(true);
}

function sameTarget(a, b) {
  if (!a || !b) return a === b;
  return a.nodeId === b.nodeId && a.entityId === b.entityId && a.semanticReferenceId === b.semanticReferenceId;
}

function fallbackMarkup(sceneModel, reason) {
  const cards = sceneModel.nodes.map((node, index) => {
    const offset = index * 16;
    const hue = node.appearance?.color ?? "#728893";
    return `<g transform="translate(${offset} ${-offset * 0.35})">
      <path class="fallback-shape" style="fill:${escapeAttribute(hue)}22;stroke:${escapeAttribute(hue)}" d="M108 114 210 65l105 52-103 51Zm0 0v91l104 53v-90m103-51v89l-103 52"/>
    </g>`;
  }).join("");
  const nodeButtons = sceneModel.nodes.map((node) => `<button type="button" data-fallback-node="${escapeAttribute(node.nodeId)}" aria-pressed="false">${escapeHtml(node.label)}</button>`).join("");
  return `<svg viewBox="70 25 330 270" role="img" aria-label="Semantic fallback preview of ${escapeAttribute(sceneModel.label)}">${cards}</svg>
    <div class="fallback-note"><strong>Semantic 2D fallback</strong><span>WebGL unavailable · stable nodes and diagnostics remain accessible</span><span>${escapeHtml(reason)}</span></div>
    <div class="fallback-entities" aria-label="Fallback body selection">${nodeButtons}</div>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
