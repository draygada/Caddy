import { afterEach, describe, expect, it, vi } from 'vitest';
import sealRoute from '../api/cad/outputs/native/seal';
import {
  applyCadIntent,
  createCadDocument,
  createFeatureOperation,
  createSketchOperation,
  type CadDocument,
  type CadOperation,
  type CadRecomputeResponse,
  type CadSketch,
} from '../src/cad';
import { recomputeCadInBrowser } from '../src/cad/browser-kernel';
import {
  CAD_OUTPUT_LIMITATIONS,
  createNativeDocumentDraft,
  sealNativeDocument,
  type NativeCadDocument,
} from '../src/cad/output-client';

function sketch(id: string, kind: 'rectangle' | 'circle'): CadSketch {
  return {
    id,
    name: kind === 'rectangle' ? 'Rectangle' : 'Circle',
    plane: { kind: 'origin', plane: 'XY' },
    entities: kind === 'rectangle'
      ? [{ id: `${id}:rectangle`, kind: 'rectangle', construction: false, origin: { x: 0, y: 0 }, width: 20, height: 10 }]
      : [{ id: `${id}:circle`, kind: 'circle', construction: false, center: { x: 30, y: 0 }, radius: 6 }],
    dimensions: [],
    constraints: [],
    solverState: 'unresolved',
  };
}

async function commit(document: CadDocument, operation: CadOperation): Promise<CadRecomputeResponse> {
  return recomputeCadInBrowser({
    document: applyCadIntent(document, operation),
    operation,
    expectedRevisionId: document.revisionId,
  });
}

async function authoredTwoBodyModel(): Promise<CadRecomputeResponse> {
  const base = createCadDocument('Live two-body seal', 'document:live-two-body-seal');
  const rectangleSketch = createSketchOperation(sketch('sketch:rectangle', 'rectangle'), 'operation:sketch-rectangle');
  const rectangle = await commit(base, rectangleSketch);
  const rectangleExtrude = createFeatureOperation({
    id: 'operation:extrude-rectangle',
    kind: 'feature.extrude',
    name: 'Extrude rectangle',
    inputIds: ['sketch:rectangle'],
    outputBodyName: 'Body 1',
    parameters: { distance: 5 },
  });
  const firstBody = await commit(rectangle.document, rectangleExtrude);
  const circleSketch = createSketchOperation(sketch('sketch:circle', 'circle'), 'operation:sketch-circle');
  const circle = await commit(firstBody.document, circleSketch);
  const circleExtrude = createFeatureOperation({
    id: 'operation:extrude-circle',
    kind: 'feature.extrude',
    name: 'Extrude circle',
    inputIds: ['sketch:circle'],
    outputBodyName: 'Circle body',
    parameters: { distance: 3 },
  });
  return commit(circle.document, circleExtrude);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copied.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function validSealEnvelope(draft: NativeCadDocument) {
  const documentHash = await sha256(new TextEncoder().encode(canonicalJson(draft)));
  const document = {
    ...draft,
    revision_id: `native-rev:${documentHash}`,
    document_hash: documentHash,
  };
  const bytes = new TextEncoder().encode(canonicalJson(document));
  return {
    schema_version: 'caddydaddy.cad-output-api/1',
    status: 'VALID',
    document,
    artifact: {
      path: 'document/native.caddy.json',
      kind: 'NATIVE_DOCUMENT',
      source: 'DERIVED',
      media_type: 'application/json',
      size_bytes: bytes.byteLength,
      sha256: await sha256(bytes),
      data_base64: base64(bytes),
      verification: 'REREAD_SHA256_BEFORE_RESPONSE',
    },
    limitations: [...CAD_OUTPUT_LIMITATIONS],
    claim_ceiling: 'Bounded browser-authored CAD snapshot; not a production geometry-kernel result.',
  };
}

function vercelResponse() {
  let body: unknown;
  const response = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader: vi.fn(),
    json(value: unknown) {
      body = value;
      return this;
    },
    send(value: unknown) {
      body = value;
      return this;
    },
    end(value?: unknown) {
      if (value !== undefined) body = value;
      return this;
    },
  };
  return { response, read: () => ({ status: response.statusCode, body }) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('live two-body CAD output route', () => {
  it('seals the UI-authored rectangle and circle through the concrete Vercel function', async () => {
    const authored = await authoredTwoBodyModel();
    expect(authored.document.bodies.map((body) => body.name)).toEqual(['Body 1', 'Circle body']);
    expect(authored.mesh.triangles).toHaveLength(200);

    const draft = await createNativeDocumentDraft(authored.document, authored.mesh);
    expect(draft.parts).toHaveLength(2);

    let forwardedDocument: unknown;
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { document: NativeCadDocument };
      forwardedDocument = request.document;
      return new Response(JSON.stringify(await validSealEnvelope(request.document)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', upstreamFetch);
    vi.stubEnv('CADDYDADDY_PRODUCT_SERVICE_URL', 'https://caddydaddy-product-service.vercel.app');

    const routedFetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const harness = vercelResponse();
      await sealRoute({
        method: init?.method ?? 'GET',
        url: '/api/cad/outputs/native/seal',
        query: {},
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: JSON.parse(String(init?.body)),
      } as never, harness.response as never);
      const result = harness.read();
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/json' },
      });
    };

    const sealed = await sealNativeDocument(draft, routedFetch as typeof fetch);

    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe('https://caddydaddy-product-service.vercel.app/api/cad/outputs/native/seal');
    expect(forwardedDocument).toEqual(JSON.parse(JSON.stringify(draft)));
    expect(sealed.status).toBe('VALID');
    expect(sealed.document.parts).toHaveLength(2);
    expect(sealed.document.document_id).toBe(draft.document_id);
    expect(canonicalJson(sealed.document)).toContain(authored.revisionId);
    expect(sealed.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
