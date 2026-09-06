import type { TripwireRequest } from './tripwire';

export type CoreCandidateSource = 'api' | 'packaged-fixture';

export interface CoreBody {
  bodyId: string;
  featureIds: string[];
  label: string;
  material: string;
}

export interface CoreParameter {
  description: string;
  expression: string | null;
  literal: string;
  name: string;
  parameterId: string;
  unit: string;
  valueType: string;
}

export interface CoreOperation {
  dependsOn: string[];
  enabled: boolean;
  label: string;
  operationId: string;
  parameterBindings: Record<string, string>;
  payload: Record<string, unknown>;
  type: string;
  typeVersion: number;
}

export interface CoreEntityRange {
  entityId: string;
  featureId: string;
  semanticReferenceId: string;
  startTriangle: number;
  triangleCount: number;
}

export interface CoreSceneNode {
  bodyId: string;
  kind: string;
  label: string;
  nodeId: string;
  visible: boolean;
  appearance: { color: string; opacity: number };
  transform: {
    rotationDegrees: number[];
    scale: number[];
    translation: number[];
  };
  mesh: { entityRanges: CoreEntityRange[] };
  metadata?: Record<string, unknown>;
}

export interface CoreComplianceBinding {
  coreEntityId: string;
  coreSemanticReferenceId: string;
  request: TripwireRequest;
}

export interface CoreCandidateContract {
  adapterLabel: string;
  candidate: {
    claim: string;
    machineClaimCeiling: string;
    observedAt: string;
    payloadHash: string;
    policyState: string;
    status: string;
    version: string;
  };
  capabilities: Record<string, boolean>;
  document: {
    bodies: CoreBody[];
    complianceBindings: Record<string, CoreComplianceBinding>;
    documentId: string;
    kind: string;
    label: string;
    operations: CoreOperation[];
    parameters: CoreParameter[];
    revisionId: string;
    scene: {
      documentId: string;
      documentKind: string;
      label: string;
      model: string;
      nodes: CoreSceneNode[];
      revisionId: string;
    };
    units: { angle: string; length: string };
  };
  evidenceCeiling: string;
  forgeRevision: {
    content_hash: string;
    geometry_artifact_hash: string;
    recompute_state: string;
    revision_id: string;
  };
  history: Array<{
    actor: string;
    disposition: string;
    label: string;
    revisionId: string;
    sequence: number;
    summary: string;
    time: string;
  }>;
  kernelProvenance: {
    assemblyResult: string;
    binding: string;
    engineManifestHash: string;
    geometryArtifactHash: string;
    geometryArtifactId: string;
    kernel: string;
    partResult: string;
    platformImage: string;
    toolchain: string;
    viewportPacket: string;
  };
  productThreadId: string;
  snapshotProvenance: {
    coreExecutedAtRuntime: boolean;
    mode: string;
    source: { commit: string; tree: string };
  };
  states: {
    current: {
      adapterOnline: boolean;
      diagnostics: unknown[];
      displayState: string;
      displayedRevisionId: string;
      editable: boolean;
      operationStatus: Record<string, string>;
      recomputeStatus: string;
      requestedRevisionId: string;
      sourceArtifactId: string;
    };
  };
}

export interface CoreEntityBinding extends CoreEntityRange {
  bodyId: string;
  bodyLabel: string;
  nodeId: string;
  ordinal: number;
  binding: CoreComplianceBinding;
}

export interface CoreCandidateLoad {
  cadRuntime: CoreCadRuntime;
  candidate: CoreCandidateContract;
  evidenceRole: 'IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY' | 'PACKAGED_RECOVERY_FIXTURE';
  loadedAt: string;
  releaseIdentity: CoreReleaseIdentity | null;
  source: CoreCandidateSource;
  warning: string | null;
}

export interface CoreCadRuntime {
  connection: 'CONNECTED' | 'DISCONNECTED';
  kernel: 'OpenCascade' | null;
  version: '7.9.3' | null;
  executedForThisResponse: false;
  evidence: string;
  reason: { code: string; message: string } | null;
}

export interface CoreReleaseIdentity {
  candidateId: 'candidate:0.2';
  candidateVersion: '0.2';
  revisionId: 'revision:caddydaddy-candidate-0.2';
  schemaVersion: string;
  snapshotSha256: string;
}

export class CoreCandidateError extends Error {
  code: 'CORE_CANDIDATE_UNAVAILABLE' | 'CORE_CANDIDATE_INVALID';

  constructor(code: CoreCandidateError['code'], message: string) {
    super(message);
    this.name = 'CoreCandidateError';
    this.code = code;
  }
}

const REQUEST_KEYS = [
  'entity_id',
  'forge_record_id',
  'forge_record_revision_id',
  'forge_revision_id',
  'node_id',
  'occurrence_path',
  'product_thread_id',
] as const;

const FIXTURE_REVISION = 'revision:caddydaddy-candidate-0.1';
const FIXTURE_DOCUMENT = 'assembly:caddydaddy-demo-01';
const FIXTURE_THREAD = 'product-thread:caddydaddy-demo-01';

const PACKAGED_FIXTURE: CoreCandidateContract = {
  adapterLabel: 'Immutable core snapshot + Tripwire review-readiness bridge',
  candidate: {
    claim: 'CADdyDaddy binds a selected CAD entity to its immutable product revision and runs a review-readiness guardrail through Tripwire; Candidate 0.1 returns insufficient evidence and requires human review, not a compliance determination.',
    machineClaimCeiling: 'REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION',
    observedAt: '2026-09-05T20:00:00Z',
    payloadHash: 'e01d33a8ae23cc749089bc793bd0951cb350ff3504793b9efaaa5ddd0067dc5d',
    policyState: 'DRAFT_REVIEW_ONLY',
    status: 'SNAPSHOT_CANDIDATE',
    version: '0.1',
  },
  capabilities: {
    authoring: false,
    complianceAtDesignClick: true,
    export: false,
    import: false,
    recompute: false,
    regulatoryClassification: false,
    reviewReadinessGuardrail: true,
  },
  document: {
    bodies: [
      {
        bodyId: 'body:05b34e14d7ee853e929c4bed6d79acb57dcfd0af6240fbce1ebbe379bf866085',
        featureIds: ['op:bracket-stock'],
        label: 'Left bracket',
        material: 'Public demo aluminum',
      },
      {
        bodyId: 'body:eb18d9e8db58c74faf1609298cace58602c4544fce24a3757edbd2519b110593',
        featureIds: ['op:bracket-stock'],
        label: 'Right bracket',
        material: 'Public demo aluminum',
      },
    ],
    complianceBindings: {
      'entity:1b0b10975038cc087bac67266940289e2db02dec370d6551fc5c4ade3907c05b': {
        coreEntityId: 'entity:9fdfe5247ac4878d3c5f60f71bf5ba4fa0320c24c69aef088c58ef6f28faaa98',
        coreSemanticReferenceId: 'ref:op:bracket-stock:face:y:max',
        request: {
          entity_id: 'entity:1b0b10975038cc087bac67266940289e2db02dec370d6551fc5c4ade3907c05b',
          forge_record_id: 'forge-record:4c1de5b3d09e06dc9774610e44487d148e5dddee31fd3c790a7d88a85505b628',
          forge_record_revision_id: 'record-revision:a9f0f17e5f99b7d324ea67c64e6ef1599b38613be5632d9e8c1e95a2e4b84624',
          forge_revision_id: FIXTURE_REVISION,
          node_id: 'component:bracket-left',
          occurrence_path: [FIXTURE_DOCUMENT, 'component:bracket-left', 'entity:1b0b10975038cc087bac67266940289e2db02dec370d6551fc5c4ade3907c05b'],
          product_thread_id: FIXTURE_THREAD,
        },
      },
      'entity:00cb57e96685c699cb3e1af02d22c86bce1a1bc328e7deddc22046f35990139d': {
        coreEntityId: 'entity:9fdfe5247ac4878d3c5f60f71bf5ba4fa0320c24c69aef088c58ef6f28faaa98',
        coreSemanticReferenceId: 'ref:op:bracket-stock:face:y:max',
        request: {
          entity_id: 'entity:00cb57e96685c699cb3e1af02d22c86bce1a1bc328e7deddc22046f35990139d',
          forge_record_id: 'forge-record:54fa9094811f1bff240d196f6e698380788a3cff29a62dcbaf67d055501e3251',
          forge_record_revision_id: 'record-revision:981e2d067722d1cbf1ff0f26b226a8f0dc022d481e6492d6febae9ea88498471',
          forge_revision_id: FIXTURE_REVISION,
          node_id: 'component:bracket-right',
          occurrence_path: [FIXTURE_DOCUMENT, 'component:bracket-right', 'entity:00cb57e96685c699cb3e1af02d22c86bce1a1bc328e7deddc22046f35990139d'],
          product_thread_id: FIXTURE_THREAD,
        },
      },
    },
    documentId: FIXTURE_DOCUMENT,
    kind: 'PART',
    label: 'Public demo bracket pair',
    operations: [
      {
        dependsOn: [],
        enabled: true,
        label: 'Bracket stock',
        operationId: 'op:bracket-stock',
        parameterBindings: { height: 'param:height', length: 'param:length', width: 'param:width' },
        payload: {},
        type: 'primitive.box',
        typeVersion: 1,
      },
    ],
    parameters: [
      { description: 'Build-time core input', expression: null, literal: '24', name: 'length', parameterId: 'param:length', unit: 'mm', valueType: 'LENGTH' },
      { description: 'Build-time core input', expression: null, literal: '12', name: 'width', parameterId: 'param:width', unit: 'mm', valueType: 'LENGTH' },
      { description: 'Build-time core input', expression: null, literal: '4', name: 'height', parameterId: 'param:height', unit: 'mm', valueType: 'LENGTH' },
    ],
    revisionId: FIXTURE_REVISION,
    scene: {
      documentId: FIXTURE_DOCUMENT,
      documentKind: 'PART',
      label: 'Public demo bracket pair',
      model: 'forge.browser-render-scene/internal-1',
      nodes: [
        {
          appearance: { color: '#7895a1', opacity: 1 },
          bodyId: 'body:05b34e14d7ee853e929c4bed6d79acb57dcfd0af6240fbce1ebbe379bf866085',
          kind: 'BODY',
          label: 'Left bracket',
          mesh: { entityRanges: [{ entityId: 'entity:1b0b10975038cc087bac67266940289e2db02dec370d6551fc5c4ade3907c05b', featureId: 'op:bracket-stock', semanticReferenceId: 'ref:33043d5adc864d6129558a209d76cb7267b179a2195dc2be252ffcfb544cba5b', startTriangle: 0, triangleCount: 2 }] },
          nodeId: 'component:bracket-left',
          transform: { rotationDegrees: [0, 0, 0], scale: [1, 1, 1], translation: [0, 0, 0] },
          visible: true,
        },
        {
          appearance: { color: '#ad805c', opacity: 1 },
          bodyId: 'body:eb18d9e8db58c74faf1609298cace58602c4544fce24a3757edbd2519b110593',
          kind: 'BODY',
          label: 'Right bracket',
          mesh: { entityRanges: [{ entityId: 'entity:00cb57e96685c699cb3e1af02d22c86bce1a1bc328e7deddc22046f35990139d', featureId: 'op:bracket-stock', semanticReferenceId: 'ref:85d2f32d4c6e94a10fccafb97463b06738fd2460852c97a1216b510f3102cb3d', startTriangle: 0, triangleCount: 2 }] },
          nodeId: 'component:bracket-right',
          transform: { rotationDegrees: [0, 0, 0], scale: [1, 1, 1], translation: [36, 0, 0] },
          visible: true,
        },
      ],
      revisionId: FIXTURE_REVISION,
    },
    units: { angle: 'deg', length: 'mm' },
  },
  evidenceCeiling: 'DEMONSTRATED_LOCAL_BUILD_SNAPSHOT',
  forgeRevision: {
    content_hash: '2ded37dc61ecd4b1e6124dce42ced2c34a86afae0e9fb9d650aee88d8c4ec917',
    geometry_artifact_hash: 'b068efc537e9cfc0572d38fbeb8ac82d5ca5f6e7a9cbae036a0935c7eecef470',
    recompute_state: 'SUCCEEDED',
    revision_id: FIXTURE_REVISION,
  },
  history: [{ actor: 'core-kernel', disposition: 'DEMONSTRATED_LOCAL', label: 'Build-time core snapshot', revisionId: FIXTURE_REVISION, sequence: 1, summary: 'Immutable geometry snapshot projected for review; no deployed recompute', time: '2026-09-05' }],
  kernelProvenance: {
    assemblyResult: 'forge.core-assembly-result/1',
    binding: 'cadquery-ocp-novtk@7.9.3.1;wheel=cadquery_ocp_novtk-7.9.3.1-cp312-cp312-macosx_11_0_arm64.whl;wheel-sha256=a070f99039e877e9558759570fd379365e2d28de3850b62e33c9c48e5ac1f0e3;source=d69b064a3a604ebf245b1f3b14fb54c835a3a571;lock=packages/core-kernel/uv.lock',
    engineManifestHash: 'a96ce62ddc527b15f28d09b5ba6dc3eb36bb50a66a72e431843338ed9e8edb4d',
    geometryArtifactHash: 'b068efc537e9cfc0572d38fbeb8ac82d5ca5f6e7a9cbae036a0935c7eecef470',
    geometryArtifactId: 'artifact:8cdf800d28d63c534481bd9e5ec07564f9b0fc4772bf993c0833161c73b8def6',
    kernel: 'OCCT@7.9.3;source=a016080bf6738d6aeae020badee4e888ad1540a5',
    partResult: 'forge.core-recompute-result/1',
    platformImage: 'Darwin@arm64;python=cp312;wheel-platform=macosx_11_0_arm64',
    toolchain: 'CPython@3.12.13;dependency-lock=uv@0.11.17',
    viewportPacket: 'forge.core-viewport-packet/1',
  },
  productThreadId: FIXTURE_THREAD,
  snapshotProvenance: {
    coreExecutedAtRuntime: false,
    mode: 'PRECOMPUTED_IMMUTABLE',
    source: { commit: 'cb041812633710b3f7ce74e5edb6bc0244800003', tree: 'b24a82688899c41c94db31cb387f185f0bacb20e' },
  },
  states: {
    current: {
      adapterOnline: true,
      diagnostics: [],
      displayState: 'CURRENT',
      displayedRevisionId: FIXTURE_REVISION,
      editable: false,
      operationStatus: { 'op:bracket-stock': 'SUCCEEDED' },
      recomputeStatus: 'SUCCEEDED',
      requestedRevisionId: FIXTURE_REVISION,
      sourceArtifactId: 'artifact:8cdf800d28d63c534481bd9e5ec07564f9b0fc4772bf993c0833161c73b8def6',
    },
  },
};

export async function loadCoreCandidate(fetchImpl: typeof fetch = fetch): Promise<CoreCandidateLoad> {
  let response: Response;
  try {
    response = await fetchImpl('/api/candidate', { headers: { Accept: 'application/json' } });
  } catch {
    throw new CoreCandidateError('CORE_CANDIDATE_UNAVAILABLE', 'The core Candidate API is unreachable. Retry it or deliberately open the packaged recovery fixture.');
  }
  if (!response.ok) {
    throw new CoreCandidateError('CORE_CANDIDATE_UNAVAILABLE', `The core Candidate API returned HTTP ${response.status}. Retry it or deliberately open the packaged recovery fixture.`);
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CoreCandidateError('CORE_CANDIDATE_INVALID', 'The core Candidate API returned unreadable JSON. No assembly snapshot was accepted.');
  }
  const parsed = parseCoreCandidateResponse(value);
  return { ...parsed, loadedAt: new Date().toISOString(), source: 'api', warning: null };
}

export function loadCachedCoreCandidate(): CoreCandidateLoad {
  return {
    cadRuntime: {
      connection: 'DISCONNECTED',
      kernel: null,
      version: null,
      executedForThisResponse: false,
      evidence: 'PACKAGED_RECOVERY_FIXTURE',
      reason: {
        code: 'CORE_CANDIDATE_NOT_LOADED',
        message: 'The packaged recovery fixture does not prove a connected or owner-approved OCCT runtime.',
      },
    },
    candidate: parseCoreCandidate(structuredClone(PACKAGED_FIXTURE)),
    evidenceRole: 'PACKAGED_RECOVERY_FIXTURE',
    loadedAt: new Date().toISOString(),
    releaseIdentity: null,
    source: 'packaged-fixture',
    warning: 'Recovery fixture in use. These values mirror the pinned Candidate 0.1 contract but do not prove that /api/candidate is currently reachable.',
  };
}

export function parseCoreCandidateResponse(value: unknown): Pick<CoreCandidateLoad, 'cadRuntime' | 'candidate' | 'evidenceRole' | 'releaseIdentity'> {
  if (!isRecord(value) || !isRecord(value.candidate) || !isRecord(value.releaseIdentity)) {
    throw invalid('Candidate 0.2 release identity is missing or malformed.');
  }
  const rootCandidate = value.candidate;
  const releaseIdentity = value.releaseIdentity;
  if (
    rootCandidate.id !== 'candidate:0.2'
    || rootCandidate.version !== '0.2'
    || rootCandidate.revisionId !== 'revision:caddydaddy-candidate-0.2'
    || rootCandidate.status !== 'CANDIDATE_0_2_RUNTIME'
  ) {
    throw invalid('Candidate 0.2 root identity is inconsistent.');
  }
  if (
    releaseIdentity.candidateId !== rootCandidate.id
    || releaseIdentity.candidateVersion !== rootCandidate.version
    || releaseIdentity.revisionId !== rootCandidate.revisionId
    || typeof releaseIdentity.schemaVersion !== 'string'
    || releaseIdentity.schemaVersion.length === 0
    || !isSha256(releaseIdentity.snapshotSha256)
  ) {
    throw invalid('Candidate 0.2 releaseIdentity does not bind the authoritative root identity and snapshot hash.');
  }
  if (!isRecord(value.legacySnapshotEvidence)) {
    throw invalid('Candidate 0.2 omitted legacySnapshotEvidence.');
  }
  const legacy = value.legacySnapshotEvidence;
  if (
    legacy.role !== 'IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY'
    || legacy.candidateVersion !== '0.1'
    || legacy.revisionId !== FIXTURE_REVISION
    || legacy.immutable !== true
    || legacy.currentCapabilityAuthority !== false
    || legacy.snapshotSha256 !== releaseIdentity.snapshotSha256
    || !isRecord(legacy.publicSnapshot)
  ) {
    throw invalid('Candidate 0.1 legacy snapshot evidence is missing, mutable, authoritative, or detached from the Candidate 0.2 release identity.');
  }
  const candidate = parseCoreCandidate(legacy.publicSnapshot);
  if (candidate.candidate.version !== legacy.candidateVersion || candidate.document.revisionId !== legacy.revisionId) {
    throw invalid('Candidate 0.1 legacy snapshot identity does not match its nested evidence descriptor.');
  }
  const cadRuntime = parseCoreCadRuntime(value);
  return {
    cadRuntime,
    candidate,
    evidenceRole: 'IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY',
    releaseIdentity: structuredClone(releaseIdentity) as unknown as CoreReleaseIdentity,
  };
}

function parseCoreCadRuntime(value: Record<string, unknown>): CoreCadRuntime {
  const runtimeGeometry = isRecord(value.runtimeGeometry) ? value.runtimeGeometry : null;
  const browser = runtimeGeometry && isRecord(runtimeGeometry.browser) ? runtimeGeometry.browser : null;
  const native = runtimeGeometry && isRecord(runtimeGeometry.native) ? runtimeGeometry.native : null;
  const capabilities = isRecord(value.capabilities) ? value.capabilities : null;
  const contracts = isRecord(value.capabilityContracts) ? value.capabilityContracts : null;
  const authoring = contracts && isRecord(contracts.cadAuthoring) ? contracts.cadAuthoring : null;
  const recompute = contracts && isRecord(contracts.liveKernelRecompute) ? contracts.liveKernelRecompute : null;
  if (
    !runtimeGeometry
    || runtimeGeometry.authoritativeForThisBrowserSession !== 'BROWSER_JSCAD_BOUNDED'
    || !browser
    || browser.kernel !== 'JSCAD'
    || browser.scope !== 'BOUNDED_MESH_CSG_NOT_PRODUCTION_BREP'
    || !authoring
    || authoring.productionBrepKernel !== false
    || !native
    || native.executedForThisResponse !== false
    || !capabilities
    || typeof capabilities.nativeOcctConnected !== 'boolean'
    || !recompute
  ) {
    throw invalid('Candidate runtime geometry contract is missing or could relabel browser JSCAD as production B-rep.');
  }
  const connected = native.connection === 'CONNECTED';
  const disconnected = native.connection === 'DISCONNECTED';
  const reason = isRecord(native.reason)
    && typeof native.reason.code === 'string'
    && typeof native.reason.message === 'string'
    ? { code: native.reason.code, message: native.reason.message }
    : null;
  if (
    (!connected && !disconnected)
    || capabilities.nativeOcctConnected !== connected
    || (connected && (
      native.kernel !== 'OpenCascade'
      || native.version !== '7.9.3'
      || native.evidence !== 'PRODUCT_CORE_CAPABILITY'
      || reason !== null
      || recompute.status !== 'AVAILABLE_NATIVE_CONNECTED'
    ))
    || (disconnected && (
      native.kernel !== null
      || native.version !== null
      || reason === null
      || recompute.status !== 'UNAVAILABLE_NATIVE_DISCONNECTED'
    ))
  ) {
    throw invalid('Candidate native runtime claim is internally inconsistent or lacks product/core capability evidence.');
  }
  return structuredClone(native) as unknown as CoreCadRuntime;
}

export function listCoreEntities(candidate: CoreCandidateContract): CoreEntityBinding[] {
  return candidate.document.scene.nodes.flatMap((node) =>
    node.mesh.entityRanges.map((entity, index) => ({
      ...entity,
      bodyId: node.bodyId,
      bodyLabel: node.label,
      nodeId: node.nodeId,
      ordinal: index + 1,
      binding: candidate.document.complianceBindings[entity.entityId],
    })),
  );
}

export function getTripwireBinding(candidate: CoreCandidateContract, entityId: string): TripwireRequest {
  const entity = listCoreEntities(candidate).find((item) => item.entityId === entityId);
  if (!entity) throw invalid('The selected entity is not bound by this immutable candidate.');
  return structuredClone(entity.binding.request);
}

export function parseCoreCandidate(value: unknown): CoreCandidateContract {
  if (!isRecord(value)) throw invalid('Candidate root must be an object.');
  const candidate = value as unknown as CoreCandidateContract;
  const document = candidate.document;
  const scene = document?.scene;
  const current = candidate.states?.current;
  if (!candidate.candidate || !document || !scene || !current || !candidate.forgeRevision || !candidate.kernelProvenance || !candidate.snapshotProvenance) {
    throw invalid('Candidate is missing a required core contract section.');
  }
  if (!Array.isArray(document.bodies) || document.bodies.length !== 2 || !Array.isArray(scene.nodes) || scene.nodes.length !== 2) {
    throw invalid('Candidate must expose the pinned two-body assembly and two corresponding scene nodes.');
  }
  if (!Array.isArray(document.operations) || document.operations.length === 0 || !Array.isArray(document.parameters) || document.parameters.length === 0) {
    throw invalid('Candidate operation and parameter graphs are required.');
  }
  const revisions = [document.revisionId, scene.revisionId, candidate.forgeRevision.revision_id, current.displayedRevisionId, current.requestedRevisionId];
  if (!revisions[0] || revisions.some((revision) => revision !== revisions[0])) throw invalid('Candidate revision chain is stale or internally inconsistent.');
  if (scene.documentId !== document.documentId || candidate.productThreadId.length === 0) throw invalid('Candidate document or product-thread binding is invalid.');
  if (candidate.snapshotProvenance.mode !== 'PRECOMPUTED_IMMUTABLE' || candidate.snapshotProvenance.coreExecutedAtRuntime !== false) {
    throw invalid('Only an honestly labeled precomputed immutable snapshot is accepted.');
  }
  if (candidate.capabilities?.recompute !== false || current.editable !== false) throw invalid('Candidate falsely advertises live recompute or editing.');
  if (!candidate.kernelProvenance.kernel || !candidate.kernelProvenance.engineManifestHash || !candidate.kernelProvenance.geometryArtifactHash) {
    throw invalid('Kernel and geometry provenance are required.');
  }

  const bodyIds = new Set(document.bodies.map((body) => body.bodyId));
  if (bodyIds.size !== 2 || scene.nodes.some((node) => !bodyIds.has(node.bodyId))) throw invalid('Scene nodes must map one-to-one to the two assembly bodies.');
  const operationIds = new Set(document.operations.map((operation) => operation.operationId));
  const parameterIds = new Set(document.parameters.map((parameter) => parameter.parameterId));
  for (const operation of document.operations) {
    if (!operation.operationId || operation.dependsOn.some((dependency) => !operationIds.has(dependency))) throw invalid('Operation graph contains a missing dependency.');
    if (Object.values(operation.parameterBindings).some((parameterId) => !parameterIds.has(parameterId))) throw invalid('Operation graph contains a missing parameter binding.');
  }

  const entities = listCoreEntities(candidate);
  if (entities.length < 2) throw invalid('Candidate must expose selectable entities on both bodies.');
  for (const entity of entities) {
    if (!entity.binding || !isRecord(entity.binding.request)) throw invalid(`Entity ${entity.entityId} has no Tripwire request binding.`);
    const request = entity.binding.request;
    if (!hasExactKeys(request, REQUEST_KEYS) || !Array.isArray(request.occurrence_path)) throw invalid(`Entity ${entity.entityId} has a malformed Tripwire request.`);
    if (request.entity_id !== entity.entityId || request.node_id !== entity.nodeId || request.forge_revision_id !== document.revisionId || request.product_thread_id !== candidate.productThreadId) {
      throw invalid(`Entity ${entity.entityId} has a stale Tripwire request binding.`);
    }
  }
  if (new Set(entities.map((entity) => entity.bodyId)).size !== 2) throw invalid('Selectable entities must cover both bodies.');
  return structuredClone(candidate);
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function invalid(detail: string): CoreCandidateError {
  return new CoreCandidateError('CORE_CANDIDATE_INVALID', `${detail} No core snapshot was accepted.`);
}
