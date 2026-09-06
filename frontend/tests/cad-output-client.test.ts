import { describe, expect, it, vi } from 'vitest';
import { applyCadIntent, createCadDocument, createFeatureOperation } from '../src/cad';
import {
  CAD_OUTPUT_LIMITATIONS,
  CadOutputClientError,
  createKernelMeshSource,
  createNativeDocumentDraft,
  downloadCadOutputArtifact,
  generateCadOutputs,
  loadNativeDocument,
  sealNativeDocument,
  validatedArtifactBytes,
  type CadOutputArtifact,
  type NativeCadDocument,
} from '../src/cad/output-client';
import type { CadMesh } from '../src/cad';

function mesh(revisionId = 'revision:kernel-1'): CadMesh {
  return {
    revisionId,
    vertices: [[0, 0, 0], [10, 0, 0], [0, 8, 0], [0, 0, 3]],
    triangles: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
    groups: [{ bodyId: 'body:feature:1', startTriangle: 0, triangleCount: 4, color: '#718f82' }],
  };
}

function document() {
  const base = createCadDocument('Fixture', 'document:fixture');
  return { ...applyCadIntent(base, createFeatureOperation({ id: 'feature:1', kind: 'feature.extrude', name: 'Extrude', inputIds: ['sketch:1'], outputBodyName: 'Plate', parameters: { distance: 3 } })), revisionId: 'revision:kernel-1', bodies: [{ id: 'body:feature:1', name: 'Plate', featureIds: ['feature:1'], material: '6061-T6', visible: true, state: 'valid' as const }] };
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

async function sha(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer))].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function artifact(path: string, content: string, kind = 'TEST'): Promise<CadOutputArtifact> {
  const bytes = new TextEncoder().encode(content);
  return { path, kind, source: 'DERIVED', media_type: path.endsWith('.json') ? 'application/json' : 'text/plain', size_bytes: bytes.length, sha256: await sha(bytes), data_base64: base64(bytes), verification: 'REREAD_SHA256_BEFORE_RESPONSE' };
}

async function sealedDocument(): Promise<NativeCadDocument & { revision_id: string; document_hash: string }> {
  const draft = await createNativeDocumentDraft(document(), mesh());
  const hash = await sha(new TextEncoder().encode(stable(draft)));
  return { ...draft, revision_id: `native-rev:${hash}`, document_hash: hash };
}

describe('native CAD output client', () => {
  it('builds a multi-body-capable native draft bound to the exact kernel mesh hash', async () => {
    const source = await createKernelMeshSource(mesh());
    const draft = await createNativeDocumentDraft(document(), mesh());
    expect(draft.parts[0].geometry_hash).toBe(source.content_sha256);
    expect(draft.parts[0].authored_document).toMatchObject({ document_id: 'part:body:feature:1' });
    expect(draft.assembly.instances[0].part_id).toBe('part:body:feature:1');
  });

  it('seals and loads canonical native bytes only after identity and artifact validation', async () => {
    const documentValue = await sealedDocument();
    const content = stable(documentValue);
    const nativeArtifact = await artifact('document/native.caddy.json', content, 'NATIVE_DOCUMENT');
    const envelope = { schema_version: 'caddydaddy.cad-output-api/1', status: 'VALID', document: documentValue, artifact: nativeArtifact, limitations: [...CAD_OUTPUT_LIMITATIONS], claim_ceiling: 'bounded' };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    expect((await sealNativeDocument(documentValue, fetchImpl)).document.document_hash).toBe(documentValue.document_hash);
    expect((await loadNativeDocument(nativeArtifact.data_base64, fetchImpl)).artifact.sha256).toBe(nativeArtifact.sha256);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/cad/outputs/native/seal', expect.objectContaining({ method: 'POST' }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/cad/outputs/native/load', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects altered artifact bytes and never calls the browser download sink', async () => {
    const valid = await artifact('bom/bom.csv', 'item,part\n1,PLATE\n');
    const tampered = { ...valid, data_base64: base64(new TextEncoder().encode('tampered')) };
    const click = vi.fn();
    await expect(downloadCadOutputArtifact(tampered, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn(), click })).rejects.toBeInstanceOf(CadOutputClientError);
    expect(click).not.toHaveBeenCalled();
    expect(await validatedArtifactBytes(valid)).toHaveLength(valid.size_bytes);
  });

  it('validates every package artifact and detached manifest before returning a bundle', async () => {
    const native = await sealedDocument();
    const packageId = `mfgpkg:${'a'.repeat(64)}`;
    const packageArtifacts = [];
    const downloads: CadOutputArtifact[] = [];
    for (let index = 0; index < 8; index += 1) {
      const row = await artifact(`drawings/item-${index}.svg`, `<svg>${index}</svg>`, 'ORTHOGRAPHIC_SVG');
      downloads.push(row);
      packageArtifacts.push({ path: row.path, kind: row.kind, source: row.source, media_type: row.media_type, size_bytes: row.size_bytes, sha256: row.sha256, verification: 'REREAD_SHA256_BEFORE_SEAL' });
    }
    const manifestValue = { schema_version: 'caddydaddy.manufacturing-package/1', package_id: packageId };
    const manifest = await artifact('manifest.json', JSON.stringify(manifestValue), 'SEALED_MANIFEST');
    const detached = await artifact('manifest.sha256', `${manifest.sha256}  manifest.json\n`, 'DETACHED_MANIFEST_HASH');
    downloads.push(manifest, detached);
    const response = {
      schema_version: 'caddydaddy.cad-output-api/1', status: 'VALID',
      document_identity: { document_id: native.document_id, revision_id: native.revision_id, document_hash: native.document_hash, source_authoring_revision_id: 'revision:kernel-1' },
      package: { schema_version: 'caddydaddy.manufacturing-package/1', package_id: packageId, revision_id: native.revision_id, document_hash: native.document_hash, artifacts: packageArtifacts, limitations: [...CAD_OUTPUT_LIMITATIONS], seal: { algorithm: 'SHA-256', payload_sha256: 'b'.repeat(64), artifact_verification: 'REREAD_BYTES_BEFORE_SEAL' }, manifest_file_sha256: manifest.sha256 },
      artifacts: downloads, limitations: [...CAD_OUTPUT_LIMITATIONS], claim_ceiling: 'bounded',
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 })) as unknown as typeof fetch;
    const result = await generateCadOutputs({ document: native, mesh: mesh() }, fetchImpl);
    expect(result.package.package_id).toBe(packageId);
    expect(result.artifacts).toHaveLength(10);
  });
});
