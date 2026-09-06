import { describe, expect, it } from 'vitest';
import type { CadOutputArtifact, CadOutputBundle } from '../src/cad/output-client';
import { productOutputRegistration } from '../src/panels/AuthoringWorkspace';

const digest = (character: string) => character.repeat(64);

function download(path: string, kind: string, sha256: string): CadOutputArtifact {
  return {
    path,
    kind,
    source: path.startsWith('kernel/') ? 'KERNEL' : 'DERIVED',
    media_type: path.endsWith('.csv') ? 'text/csv' : 'application/octet-stream',
    size_bytes: 1,
    sha256,
    data_base64: 'eA==',
    verification: 'REREAD_SHA256_BEFORE_RESPONSE',
  };
}

function serviceBundle(bomPath: 'bom.csv' | 'bom/bom.csv' = 'bom/bom.csv'): CadOutputBundle {
  const packageArtifacts = [
    download(bomPath, 'BOM_CSV', digest('1')),
    download('document/native.caddy.json', 'NATIVE_DOCUMENT', digest('2')),
    download('drawings/top.svg', 'ORTHOGRAPHIC_SVG', digest('3')),
    download('drawings/top.dxf', 'ORTHOGRAPHIC_DXF', digest('4')),
    download('drawings/front.svg', 'ORTHOGRAPHIC_SVG', digest('5')),
    download('drawings/front.dxf', 'ORTHOGRAPHIC_DXF', digest('6')),
    download('drawings/right.svg', 'ORTHOGRAPHIC_SVG', digest('7')),
    download('drawings/right.dxf', 'ORTHOGRAPHIC_DXF', digest('8')),
    download('kernel/model.stl', 'KERNEL_STL', digest('9')),
  ];
  const manifest = download('manifest.json', 'SEALED_MANIFEST', digest('a'));
  const detached = download('manifest.sha256', 'DETACHED_MANIFEST_HASH', digest('b'));
  return {
    schema_version: 'caddydaddy.cad-output-api/1',
    status: 'VALID',
    document_identity: {
      document_id: 'document:live-two-body',
      revision_id: `native-rev:${digest('c')}`,
      document_hash: digest('c'),
      source_authoring_revision_id: 'revision:live-two-body',
    },
    package: {
      schema_version: 'caddydaddy.manufacturing-package/1',
      package_id: `mfgpkg:${digest('d')}`,
      revision_id: `native-rev:${digest('c')}`,
      document_hash: digest('c'),
      artifacts: packageArtifacts.map(({ path, kind, source, media_type, size_bytes, sha256 }) => ({
        path,
        kind,
        source,
        media_type,
        size_bytes,
        sha256,
        verification: 'REREAD_SHA256_BEFORE_SEAL',
      })),
      limitations: ['NO_CAM_TOOLPATHS_OR_GCODE'],
      seal: {
        algorithm: 'SHA-256',
        payload_sha256: digest('e'),
        artifact_verification: 'REREAD_BYTES_BEFORE_SEAL',
      },
      manifest_file_sha256: manifest.sha256,
    },
    artifacts: [...packageArtifacts, manifest, detached],
    limitations: ['NO_CAM_TOOLPATHS_OR_GCODE'],
    claim_ceiling: 'Reread-verified manufacturing bundle.',
  };
}

const acceptedCad = {
  documentId: 'document:live-two-body',
  revisionId: 'revision:live-two-body',
  documentSha256: digest('f'),
  geometrySha256: digest('0'),
  actorId: 'operator:browser',
  operationId: 'operation:extrude-circle',
  acceptedAt: '2026-09-06T00:00:00.000Z',
} as Parameters<typeof productOutputRegistration>[1];

describe('deployed CAD generate response contract', () => {
  it('derives exact manifest and nested BOM identities from the actual service schema', () => {
    const bundle = serviceBundle();
    const registration = productOutputRegistration(bundle, acceptedCad);

    expect(registration.artifactManifestSha256).toBe(bundle.package.manifest_file_sha256);
    expect(registration.bomSha256).toBe(digest('1'));
    expect(registration.artifacts).toContainEqual(expect.objectContaining({
      artifactId: `cad-output:${bundle.package.package_id}:bom/bom.csv`,
      sha256: digest('1'),
    }));
  });

  it('preserves compatibility with the canonical flat BOM fixture identity', () => {
    const bundle = serviceBundle('bom.csv');
    const registration = productOutputRegistration(bundle, acceptedCad);

    expect(registration.artifactManifestSha256).toBe(bundle.package.manifest_file_sha256);
    expect(registration.bomSha256).toBe(digest('1'));
    expect(registration.artifacts).toContainEqual(expect.objectContaining({
      artifactId: `cad-output:${bundle.package.package_id}:bom.csv`,
      sha256: digest('1'),
    }));
  });

  it('rejects simultaneous flat and nested BOM descriptors', () => {
    const bundle = serviceBundle();
    const nestedArtifact = bundle.artifacts.find((artifact) => artifact.path === 'bom/bom.csv')!;
    const nestedDescriptor = bundle.package.artifacts.find((artifact) => artifact.path === 'bom/bom.csv')!;
    bundle.artifacts = [{ ...nestedArtifact, path: 'bom.csv' }, ...bundle.artifacts];
    bundle.package.artifacts = [{ ...nestedDescriptor, path: 'bom.csv' }, ...bundle.package.artifacts];

    expect(() => productOutputRegistration(bundle, acceptedCad)).toThrow(
      'Generated outputs are missing exact manifest or BOM identities.',
    );
  });

  it('fails closed when the downloadable BOM identity differs from its package descriptor', () => {
    const bundle = serviceBundle();
    bundle.artifacts = bundle.artifacts.map((artifact) => artifact.path === 'bom/bom.csv'
      ? { ...artifact, sha256: digest('a') }
      : artifact);

    expect(() => productOutputRegistration(bundle, acceptedCad)).toThrow(
      'Generated outputs are missing exact manifest or BOM identities.',
    );
  });
});
