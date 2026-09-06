import type {
  CadDocument,
  CadExportResponse,
  CadMesh,
  CadRecomputeResponse,
} from './types';

export const CAD_OUTPUT_LIMITATIONS = [
  'NO_CAM_TOOLPATHS_OR_GCODE',
  'NO_TOLERANCING_OR_GD_AND_T',
  'NO_MANUFACTURABILITY_CERTIFICATION',
  'NO_HIDDEN_LINE_OR_DIMENSIONED_DRAWING',
  'NO_ROUND_TRIP_BREP_FIDELITY_CLAIM',
  'STEP_IGES_STL_BYTES_ARE_KERNEL_OUTPUTS_NOT_NATIVE_HISTORY',
] as const;

const API_SCHEMA = 'caddydaddy.cad-output-api/1';
const HEX64 = /^[0-9a-f]{64}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/;

export class CadOutputClientError extends Error {
  constructor(
    readonly code: 'REQUEST_INVALID' | 'BACKEND_UNAVAILABLE' | 'SERVICE_REJECTED' | 'RESPONSE_INVALID' | 'ARTIFACT_INVALID',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CadOutputClientError';
  }
}

export interface KernelMeshSource {
  schema_version: 'caddydaddy.kernel-mesh-source/1';
  source_revision_id: string;
  units: { length: 'mm' };
  vertices: Array<[number, number, number]>;
  triangles: Array<[number, number, number]>;
  groups: CadMesh['groups'];
  content_sha256: string;
}

export interface NativeCadDocument {
  schema_version: 'caddydaddy.native-document/1';
  document_id: string;
  parent_revision_id: string | null;
  units: { length: 'mm'; angle: 'deg' };
  parts: Array<{
    part_id: string;
    part_number: string;
    name: string;
    revision_id: string;
    geometry_hash: string;
    material: string | null;
    unit: 'EA';
    authored_document: Record<string, unknown>;
  }>;
  assembly: {
    assembly_id: string;
    assembly_revision_id: string;
    instances: Array<{
      instance_id: string;
      part_id: string;
      part_revision_id: string;
      quantity: number;
      transform_row_major: number[];
      metadata: Record<string, string>;
    }>;
    mates: Array<{
      mate_id: string;
      kind: string;
      instance_ids: string[];
      parameters: Record<string, unknown>;
    }>;
  };
  metadata: Record<string, string>;
  revision_id?: string;
  document_hash?: string;
}

export interface CadOutputArtifact {
  path: string;
  kind: string;
  source: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  data_base64: string;
  verification: 'REREAD_SHA256_BEFORE_RESPONSE';
}

export interface CadNativeEnvelope {
  schema_version: typeof API_SCHEMA;
  status: 'VALID';
  document: NativeCadDocument & { revision_id: string; document_hash: string };
  artifact: CadOutputArtifact;
  limitations: string[];
  claim_ceiling: string;
}

export interface CadOutputBundle {
  schema_version: typeof API_SCHEMA;
  status: 'VALID';
  document_identity: {
    document_id: string;
    revision_id: string;
    document_hash: string;
    source_authoring_revision_id: string;
  };
  package: {
    schema_version: 'caddydaddy.manufacturing-package/1';
    package_id: string;
    revision_id: string;
    document_hash: string;
    artifacts: Array<{ path: string; kind: string; source: string; media_type: string; size_bytes: number; sha256: string; verification: string }>;
    limitations: string[];
    seal: { algorithm: 'SHA-256'; payload_sha256: string; artifact_verification: string };
    manifest_file_sha256: string;
  };
  artifacts: CadOutputArtifact[];
  limitations: string[];
  claim_ceiling: string;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value) invalid(path);
  return value;
}

function integer(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) invalid(path);
  return value as number;
}

function digest(value: unknown, path: string): string {
  const result = text(value, path);
  if (!HEX64.test(result)) invalid(path);
  return result;
}

function invalid(path: string): never {
  throw new CadOutputClientError('RESPONSE_INVALID', `CAD output response failed validation at ${path}.`);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CadOutputClientError('REQUEST_INVALID', 'CAD output input contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  throw new CadOutputClientError('REQUEST_INVALID', 'CAD output input is not canonical JSON data.');
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digestBytes = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digestBytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function decodeBase64(value: string, path: string): Uint8Array {
  if (!value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new CadOutputClientError('ARTIFACT_INVALID', `Artifact base64 is invalid at ${path}.`);
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new CadOutputClientError('ARTIFACT_INVALID', `Artifact base64 is invalid at ${path}.`);
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function rotationMatrix(translation: [number, number, number], rotation: [number, number, number]): number[] {
  const [rx, ry, rz] = rotation.map((value) => value * Math.PI / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  return [
    cy * cz, cz * sx * sy - cx * sz, sx * sz + cx * cz * sy, translation[0],
    cy * sz, cx * cz + sx * sy * sz, cx * sy * sz - cz * sx, translation[1],
    -sy, cy * sx, cx * cy, translation[2],
    0, 0, 0, 1,
  ];
}

export async function createKernelMeshSource(mesh: CadMesh): Promise<KernelMeshSource> {
  if (!mesh.revisionId || mesh.vertices.length < 3 || mesh.triangles.length === 0) {
    throw new CadOutputClientError('REQUEST_INVALID', 'A current authoritative kernel mesh is required.');
  }
  const preimage = {
    schema_version: 'caddydaddy.kernel-mesh-source/1' as const,
    source_revision_id: mesh.revisionId,
    units: { length: 'mm' as const },
    vertices: mesh.vertices,
    triangles: mesh.triangles,
    groups: mesh.groups,
  };
  return { ...preimage, content_sha256: await sha256(utf8(stableJson(preimage))) };
}

export async function createNativeDocumentDraft(document: CadDocument, mesh: CadMesh): Promise<NativeCadDocument> {
  if (document.units.length !== 'mm' || document.units.angle !== 'deg' || mesh.revisionId !== document.revisionId) {
    throw new CadOutputClientError('REQUEST_INVALID', 'Document and kernel mesh must share one current mm/deg revision.');
  }
  if (document.bodies.length === 0) throw new CadOutputClientError('REQUEST_INVALID', 'Author at least one valid body before saving native output.');
  const meshSource = await createKernelMeshSource(mesh);
  const bodyIds = new Set(document.bodies.map((body) => body.id));
  const parts = document.bodies.map((body, index) => ({
    part_id: `part:${body.id}`,
    part_number: body.id,
    name: body.name,
    revision_id: document.revisionId,
    geometry_hash: meshSource.content_sha256,
    material: body.material,
    unit: 'EA' as const,
    authored_document: index === 0
      ? { document_id: `part:${body.id}`, cad_document: document, kernel_mesh_source: meshSource }
      : { document_id: `part:${body.id}`, body_id: body.id, source_document_id: document.id },
  }));
  const instances = document.assembly.instances.length > 0
    ? document.assembly.instances.map((instance) => {
      if (!bodyIds.has(instance.bodyId)) throw new CadOutputClientError('REQUEST_INVALID', `Assembly instance ${instance.id} references an unknown body.`);
      return {
        instance_id: instance.id,
        part_id: `part:${instance.bodyId}`,
        part_revision_id: document.revisionId,
        quantity: 1,
        transform_row_major: rotationMatrix(instance.transform.translation, instance.transform.rotationDegrees),
        metadata: { grounded: String(instance.grounded), name: instance.name },
      };
    })
    : document.bodies.map((body, index) => ({
      instance_id: `instance:auto:${body.id}`,
      part_id: `part:${body.id}`,
      part_revision_id: document.revisionId,
      quantity: 1,
      transform_row_major: rotationMatrix([index * 5, 0, 0], [0, 0, 0]),
      metadata: { grounded: String(index === 0), name: body.name },
    }));
  const instanceIds = new Set(instances.map((instance) => instance.instance_id));
  const mates = document.assembly.mates.map((mate) => {
    if (!instanceIds.has(mate.instanceAId) || !instanceIds.has(mate.instanceBId)) {
      throw new CadOutputClientError('REQUEST_INVALID', `Mate ${mate.id} references an unknown instance.`);
    }
    return {
      mate_id: mate.id,
      kind: mate.kind,
      instance_ids: [mate.instanceAId, mate.instanceBId],
      parameters: { reference_a: mate.referenceA, reference_b: mate.referenceB, offset: mate.offset, unit: mate.unit },
    };
  });
  return {
    schema_version: 'caddydaddy.native-document/1',
    document_id: document.id,
    parent_revision_id: document.revisionId === 'revision:new' ? null : document.revisionId,
    units: { length: 'mm', angle: 'deg' },
    parts,
    assembly: { assembly_id: `assembly:${document.id}`, assembly_revision_id: document.revisionId, instances, mates },
    metadata: { authoring_schema: document.schemaVersion, source_revision_id: document.revisionId },
  };
}

async function parseArtifact(value: unknown, path: string): Promise<CadOutputArtifact> {
  const row = record(value, path);
  const artifact: CadOutputArtifact = {
    path: text(row.path, `${path}.path`),
    kind: text(row.kind, `${path}.kind`),
    source: text(row.source, `${path}.source`),
    media_type: text(row.media_type, `${path}.media_type`),
    size_bytes: integer(row.size_bytes, `${path}.size_bytes`),
    sha256: digest(row.sha256, `${path}.sha256`),
    data_base64: text(row.data_base64, `${path}.data_base64`),
    verification: row.verification === 'REREAD_SHA256_BEFORE_RESPONSE' ? row.verification : invalid(`${path}.verification`),
  };
  if (!SAFE_PATH.test(artifact.path)) invalid(`${path}.path`);
  const bytes = decodeBase64(artifact.data_base64, `${path}.data_base64`);
  if (bytes.byteLength !== artifact.size_bytes || await sha256(bytes) !== artifact.sha256) {
    throw new CadOutputClientError('ARTIFACT_INVALID', `Artifact ${artifact.path} failed byte-length or SHA-256 validation.`);
  }
  return artifact;
}

function limitations(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length !== CAD_OUTPUT_LIMITATIONS.length || value.some((item, index) => item !== CAD_OUTPUT_LIMITATIONS[index])) invalid(path);
  return value as string[];
}

async function parseNativeDocument(value: unknown): Promise<CadNativeEnvelope['document']> {
  const document = record(value, '$.document') as unknown as CadNativeEnvelope['document'];
  if (document.schema_version !== 'caddydaddy.native-document/1' || !document.document_id || !Array.isArray(document.parts) || !document.parts.length || !document.assembly || !Array.isArray(document.assembly.instances) || !document.assembly.instances.length) invalid('$.document');
  const declared = digest(document.document_hash, '$.document.document_hash');
  if (document.revision_id !== `native-rev:${declared}`) invalid('$.document.revision_id');
  const preimage = Object.fromEntries(Object.entries(document).filter(([key]) => key !== 'revision_id' && key !== 'document_hash'));
  if (await sha256(utf8(stableJson(preimage))) !== declared) invalid('$.document.document_hash');
  return document;
}

async function parseNativeEnvelope(value: unknown): Promise<CadNativeEnvelope> {
  const root = record(value, '$');
  if (root.schema_version !== API_SCHEMA || root.status !== 'VALID') invalid('$.schema_version');
  const document = await parseNativeDocument(root.document);
  const artifact = await parseArtifact(root.artifact, '$.artifact');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(artifact.data_base64, '$.artifact'));
  if (stableJson(JSON.parse(decoded)) !== decoded || JSON.parse(decoded).document_hash !== document.document_hash) invalid('$.artifact');
  return { schema_version: API_SCHEMA, status: 'VALID', document, artifact, limitations: limitations(root.limitations, '$.limitations'), claim_ceiling: text(root.claim_ceiling, '$.claim_ceiling') };
}

async function post(path: string, body: unknown, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(path, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (error) {
    throw new CadOutputClientError('BACKEND_UNAVAILABLE', `CAD output service is unavailable: ${error instanceof Error ? error.message : 'network request failed'}`);
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new CadOutputClientError('RESPONSE_INVALID', 'CAD output service returned non-JSON data.', response.status); }
  if (!response.ok) {
    const root = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    const diagnostic = root.diagnostic && typeof root.diagnostic === 'object' ? root.diagnostic as Record<string, unknown> : {};
    throw new CadOutputClientError('SERVICE_REJECTED', typeof diagnostic.message === 'string' ? diagnostic.message : 'CAD output service rejected the request.', response.status);
  }
  return payload;
}

export async function sealNativeDocument(document: NativeCadDocument, fetchImpl: typeof fetch = fetch): Promise<CadNativeEnvelope> {
  return parseNativeEnvelope(await post('/api/cad/outputs/native/seal', { document }, fetchImpl));
}

export async function loadNativeDocument(dataBase64: string, fetchImpl: typeof fetch = fetch): Promise<CadNativeEnvelope> {
  if (!dataBase64) throw new CadOutputClientError('REQUEST_INVALID', 'Choose a native .caddy.json file first.');
  return parseNativeEnvelope(await post('/api/cad/outputs/native/load', { data_base64: dataBase64 }, fetchImpl));
}

export async function generateCadOutputs(input: {
  document: CadNativeEnvelope['document'];
  mesh: CadMesh;
  kernelArtifacts?: CadExportResponse[];
}, fetchImpl: typeof fetch = fetch): Promise<CadOutputBundle> {
  const mesh = await createKernelMeshSource(input.mesh);
  const kernelArtifacts = await Promise.all((input.kernelArtifacts ?? []).map(async (artifact) => {
    if (artifact.revisionId !== input.mesh.revisionId) throw new CadOutputClientError('REQUEST_INVALID', `${artifact.format} export is stale for the current mesh.`);
    const bytes = decodeBase64(artifact.dataBase64, `${artifact.format}.dataBase64`);
    return { format: artifact.format, data_base64: artifact.dataBase64, content_sha256: await sha256(bytes), source_revision_id: artifact.revisionId, units: 'mm' };
  }));
  const payload = await post('/api/cad/outputs/generate', { document: input.document, mesh, kernel_artifacts: kernelArtifacts, required_kernel_formats: kernelArtifacts.map((item) => item.format) }, fetchImpl);
  const root = record(payload, '$');
  if (root.schema_version !== API_SCHEMA || root.status !== 'VALID') invalid('$.schema_version');
  const identity = record(root.document_identity, '$.document_identity');
  const packageValue = record(root.package, '$.package');
  if (packageValue.schema_version !== 'caddydaddy.manufacturing-package/1') invalid('$.package.schema_version');
  const artifactsRaw = root.artifacts;
  if (!Array.isArray(artifactsRaw) || artifactsRaw.length < 10) invalid('$.artifacts');
  const artifacts = await Promise.all(artifactsRaw.map((artifact, index) => parseArtifact(artifact, `$.artifacts[${index}]`)));
  if (new Set(artifacts.map((artifact) => artifact.path)).size !== artifacts.length) invalid('$.artifacts');
  const manifestArtifact = artifacts.find((artifact) => artifact.path === 'manifest.json');
  const detachedArtifact = artifacts.find((artifact) => artifact.path === 'manifest.sha256');
  if (!manifestArtifact || !detachedArtifact) invalid('$.artifacts');
  const packageId = text(packageValue.package_id, '$.package.package_id');
  const manifestHash = digest(packageValue.manifest_file_sha256, '$.package.manifest_file_sha256');
  if (!/^mfgpkg:[0-9a-f]{64}$/.test(packageId) || manifestArtifact.sha256 !== manifestHash) invalid('$.package');
  const detached = new TextDecoder().decode(decodeBase64(detachedArtifact.data_base64, '$.artifacts.manifest.sha256'));
  if (detached !== `${manifestHash}  manifest.json\n`) invalid('$.artifacts.manifest.sha256');
  const manifest = JSON.parse(new TextDecoder().decode(decodeBase64(manifestArtifact.data_base64, '$.artifacts.manifest.json'))) as Record<string, unknown>;
  if (manifest.package_id !== packageId) invalid('$.artifacts.manifest.json');
  const packageArtifacts = packageValue.artifacts;
  if (!Array.isArray(packageArtifacts)) invalid('$.package.artifacts');
  for (const descriptorValue of packageArtifacts) {
    const descriptor = record(descriptorValue, '$.package.artifacts[]');
    const artifact = artifacts.find((item) => item.path === descriptor.path);
    if (!artifact || artifact.sha256 !== descriptor.sha256 || artifact.size_bytes !== descriptor.size_bytes) invalid('$.package.artifacts[]');
  }
  const result: CadOutputBundle = {
    schema_version: API_SCHEMA,
    status: 'VALID',
    document_identity: {
      document_id: text(identity.document_id, '$.document_identity.document_id'),
      revision_id: text(identity.revision_id, '$.document_identity.revision_id'),
      document_hash: digest(identity.document_hash, '$.document_identity.document_hash'),
      source_authoring_revision_id: text(identity.source_authoring_revision_id, '$.document_identity.source_authoring_revision_id'),
    },
    package: packageValue as unknown as CadOutputBundle['package'],
    artifacts,
    limitations: limitations(root.limitations, '$.limitations'),
    claim_ceiling: text(root.claim_ceiling, '$.claim_ceiling'),
  };
  if (result.package.revision_id !== result.document_identity.revision_id || result.package.document_hash !== result.document_identity.document_hash) invalid('$.package');
  return result;
}

export function restoreNativeAuthoring(document: CadNativeEnvelope['document']): CadRecomputeResponse {
  const first = document.parts[0]?.authored_document;
  const cadDocument = first?.cad_document as CadDocument | undefined;
  const meshSource = first?.kernel_mesh_source as KernelMeshSource | undefined;
  if (!cadDocument || cadDocument.schemaVersion !== 'caddydaddy.cad-document/1' || !meshSource || meshSource.schema_version !== 'caddydaddy.kernel-mesh-source/1' || meshSource.source_revision_id !== cadDocument.revisionId) {
    throw new CadOutputClientError('ARTIFACT_INVALID', 'Native document does not contain a restorable revision-bound authoring snapshot.');
  }
  const bodyIds = new Set(cadDocument.bodies.map((body) => body.id));
  if (!cadDocument.bodies.length || meshSource.groups.some((group) => !bodyIds.has(group.bodyId))) {
    throw new CadOutputClientError('ARTIFACT_INVALID', 'Native authoring snapshot has invalid body-to-mesh references.');
  }
  return {
    document: cadDocument,
    revisionId: cadDocument.revisionId,
    documentHash: document.document_hash,
    dependencyGraph: {
      nodes: cadDocument.operations.map((operation) => ({ id: operation.id, label: operation.name, kind: operation.kind === 'sketch.create' ? 'sketch' as const : operation.kind.startsWith('assembly.') ? 'instance' as const : operation.kind === 'parameter.set' ? 'parameter' as const : 'feature' as const, state: 'clean' as const })),
      edges: cadDocument.operations.flatMap((operation) => operation.dependsOn.map((dependency) => ({ from: dependency, to: operation.id, relation: 'depends-on' }))),
    },
    mesh: { revisionId: meshSource.source_revision_id, vertices: meshSource.vertices, triangles: meshSource.triangles, groups: meshSource.groups },
    diagnostics: [],
    kernel: { name: 'CADdyDaddy native snapshot', version: '1', mode: 'recovery-fixture', computedAt: new Date().toISOString(), artifactHash: document.document_hash },
  };
}

export async function validatedArtifactBytes(artifact: CadOutputArtifact): Promise<Uint8Array> {
  const parsed = await parseArtifact(artifact, '$.artifact');
  return decodeBase64(parsed.data_base64, '$.artifact.data_base64');
}

export async function downloadCadOutputArtifact(
  artifact: CadOutputArtifact,
  environment: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void; click: (url: string, fileName: string) => void } = {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    click: (url, fileName) => { const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName.split('/').at(-1) ?? 'artifact'; anchor.click(); },
  },
): Promise<void> {
  const bytes = await validatedArtifactBytes(artifact);
  const url = environment.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: artifact.media_type }));
  try { environment.click(url, artifact.path); } finally { environment.revokeObjectURL(url); }
}

export function bytesToBase64(bytes: Uint8Array): string { return encodeBase64(bytes); }
