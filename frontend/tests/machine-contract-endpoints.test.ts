import { describe, expect, it, vi } from 'vitest';
import { createCandidateHandler } from '../api/candidate';
import { createNowHandler, nowObservation } from '../api/now';
import vercelSource from '../vercel.json?raw';

type CapturedResponse = {
  body: unknown;
  headers: Record<string, string>;
  statusCode: number;
};

function responseCapture(): { capture: CapturedResponse; response: ReturnType<typeof responseObject> } {
  const capture: CapturedResponse = { body: null, headers: {}, statusCode: 0 };
  return { capture, response: responseObject(capture) };
}

function responseObject(capture: CapturedResponse) {
  return {
    setHeader(name: string, value: string) {
      capture.headers[name] = value;
    },
    status(code: number) {
      capture.statusCode = code;
      return this;
    },
    json(value: unknown) {
      capture.body = value;
    },
  };
}

const UPSTREAM = {
  candidate: {
    id: 'candidate:0.2',
    snapshotProvenance: { mode: 'LIVE', coreExecutedAtRuntime: true },
  },
  capabilities: { import: true, export: true },
  capabilityContracts: {
    liveKernelRecompute: { status: 'IMPLEMENTED_BOUNDED', kernel: 'OpenCascade 7.9.3' },
    cadExchange: { status: 'IMPLEMENTED_BOUNDED', formats: ['STEP', 'IGES', 'STL'] },
  },
};

const PREVIEW_PRODUCT_SERVICE = 'https://caddydaddy-product-preview-team.vercel.app';
const PRODUCTION_PRODUCT_SERVICE = 'https://caddydaddy-product-service.vercel.app';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('candidate machine contract endpoint', () => {
  it('fails closed on non-GET without contacting either service', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createCandidateHandler({ fetchImpl, env: {} });
    const { capture, response } = responseCapture();

    await handler({ method: 'POST' }, response);

    expect(capture.statusCode).toBe(405);
    expect(capture.headers.Allow).toBe('GET');
    expect(capture.body).toMatchObject({ status: 'BLOCKED', mutationAuthority: 'NONE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports an unknown product service without a binding and never fetches a fallback', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createCandidateHandler({ fetchImpl, env: {} });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(503);
    expect(capture.body).toMatchObject({
      status: 'BLOCKED',
      serviceAvailability: {
        productService: {
          status: 'UNKNOWN',
          binding: 'CADDYDADDY_PRODUCT_SERVICE_URL',
          origin: null,
        },
      },
      runtimeGeometry: {
        authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
        browser: { availability: 'AVAILABLE', kernel: 'JSCAD' },
        native: {
          connection: 'DISCONNECTED',
          evidence: 'NO_PRODUCT_SERVICE_BINDING',
          reason: { code: 'PRODUCT_SERVICE_BINDING_REQUIRED' },
        },
      },
      diagnostic: { code: 'PRODUCT_SERVICE_BINDING_UNKNOWN' },
      mutationAuthority: 'NONE',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects invalid product-service bindings without making a fetch', async () => {
    const invalidBindings = [
      'not-a-url',
      'http://preview.vercel.app',
      'https://user:pass@preview.vercel.app',
      'https://preview.vercel.app:444',
      'https://preview.vercel.app/api',
      'https://preview.vercel.app?candidate=mixed',
      'https://preview.vercel.app.evil.example',
    ];

    for (const configured of invalidBindings) {
      const fetchImpl = vi.fn<typeof fetch>();
      const handler = createCandidateHandler({
        fetchImpl,
        env: { CADDYDADDY_PRODUCT_SERVICE_URL: configured },
      });
      const { capture, response } = responseCapture();

      await handler({ method: 'GET' }, response);

      expect(capture.statusCode).toBe(503);
      expect(capture.body).toMatchObject({
        serviceAvailability: { productService: { status: 'UNAVAILABLE', origin: null } },
        diagnostic: { code: 'PRODUCT_SERVICE_BINDING_INVALID' },
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('replaces upstream OCCT overclaims with disconnected runtime truth', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(UPSTREAM));
    const handler = createCandidateHandler({
      fetchImpl,
      env: { CADDYDADDY_PRODUCT_SERVICE_URL: PREVIEW_PRODUCT_SERVICE },
    });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({
      candidate: { snapshotProvenance: { mode: 'PRECOMPUTED_IMMUTABLE', coreExecutedAtRuntime: false } },
      runtimeGeometry: {
        authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
        native: { connection: 'DISCONNECTED', kernel: null, evidence: 'PRODUCT_CORE_CAPABILITY_INVALID' },
        coreExecutedAtRuntime: false,
      },
      capabilities: { nativeOcctConnected: false, coreExecutedAtRuntime: false },
      capabilityContracts: {
        liveKernelRecompute: { status: 'UNAVAILABLE_NATIVE_DISCONNECTED', kernel: null, coreExecutedAtRuntime: false },
        cadExchange: {
          status: 'BROWSER_BOUNDED_NATIVE_DISCONNECTED',
          formats: {
            import: { STEP: 'UNAVAILABLE_NATIVE_DISCONNECTED', IGES: 'UNAVAILABLE_NATIVE_DISCONNECTED' },
            export: { STEP: 'UNAVAILABLE_NATIVE_DISCONNECTED', IGES: 'UNAVAILABLE_NATIVE_DISCONNECTED' },
          },
        },
      },
    });
    expect(JSON.stringify(capture.body)).not.toContain('OpenCascade 7.9.3');
    expect(fetchImpl).toHaveBeenCalledWith(`${PREVIEW_PRODUCT_SERVICE}/api/candidate`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    expect(fetchImpl).toHaveBeenCalledWith(`${PREVIEW_PRODUCT_SERVICE}/api/cad/capabilities`, expect.objectContaining({
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }));
  });

  it('uses the production service only when it is explicitly bound', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(UPSTREAM));
    const handler = createCandidateHandler({
      fetchImpl,
      env: { CADDYDADDY_PRODUCT_SERVICE_URL: PRODUCTION_PRODUCT_SERVICE },
    });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(`${PRODUCTION_PRODUCT_SERVICE}/api/candidate`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  });

  it('reports connected OCCT only after a valid capability probe and keeps execution false', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === `${PREVIEW_PRODUCT_SERVICE}/api/cad/capabilities`) {
        return jsonResponse({
          schema_version: 'caddydaddy.cad-capabilities/1',
          status: 'AVAILABLE',
          kernel: { name: 'OpenCascade', version: '7.9.3', binding: 'cadquery-ocp-novtk/7.9.3.1' },
          features: ['SKETCH', 'EXTRUDE', 'FILLET', 'CHAMFER'],
          exchange: { exact: ['STEP_AP242', 'IGES_5_3'], mesh_only: ['STL'] },
          runtime_gate: {
            status: 'APPROVED',
            owner_approval: 'ASSERTED_BY_DEPLOYMENT_CONFIGURATION',
            approval_binding: 'caddydaddy.native-runtime/v1',
            factual_evidence: 'PASS',
            legal_determination: 'NOT_PERFORMED',
            artifact_sha256: '8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b',
          },
        });
      }
      return jsonResponse(UPSTREAM);
    });
    const handler = createCandidateHandler({
      fetchImpl,
      env: {
        CADDYDADDY_PRODUCT_SERVICE_URL: PREVIEW_PRODUCT_SERVICE,
        CADDYDADDY_FRONTEND_COMMIT_SHA: 'a'.repeat(40),
        CADDYDADDY_BACKEND_COMMIT_SHA: 'b'.repeat(40),
      },
    });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.body).toMatchObject({
      buildIdentity: {
        frontend: { status: 'INJECTED_IMMUTABLE', sha: 'a'.repeat(40) },
        backend: { status: 'INJECTED_IMMUTABLE', sha: 'b'.repeat(40) },
      },
      runtimeGeometry: {
        native: {
          connection: 'CONNECTED',
          kernel: 'OpenCascade',
          version: '7.9.3',
          executedForThisResponse: false,
          evidence: 'PRODUCT_CORE_CAPABILITY',
          reason: null,
        },
      },
      capabilityContracts: {
        liveKernelRecompute: { status: 'AVAILABLE_NATIVE_CONNECTED', coreExecutedAtRuntime: false },
        cadExchange: {
          formats: {
            import: { STEP: 'AVAILABLE_NATIVE_CONNECTED', IGES: 'AVAILABLE_NATIVE_CONNECTED' },
            export: { STEP: 'AVAILABLE_NATIVE_CONNECTED', IGES: 'AVAILABLE_NATIVE_CONNECTED' },
          },
        },
      },
    });
  });

  it('preserves the exact product/core owner-approval block without probing native directly', async () => {
    const reason = {
      code: 'CAD_RUNTIME_OWNER_APPROVAL_REQUIRED',
      message: 'Repository-owner acceptance is unrecorded; set the manifest-bound approval only after acceptance.',
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === `${PREVIEW_PRODUCT_SERVICE}/api/cad/capabilities`) {
        return jsonResponse({
          schema_version: 'caddydaddy.cad-capabilities/1',
          status: 'BLOCKED',
          diagnostic: reason,
        }, 503);
      }
      return jsonResponse(UPSTREAM);
    });
    const handler = createCandidateHandler({
      fetchImpl,
      env: { CADDYDADDY_PRODUCT_SERVICE_URL: PREVIEW_PRODUCT_SERVICE },
    });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({
      runtimeGeometry: {
        native: {
          connection: 'DISCONNECTED',
          evidence: 'PRODUCT_CORE_CAPABILITY_BLOCKED',
          reason,
        },
      },
      capabilities: { nativeOcctConnected: false },
      capabilityContracts: {
        liveKernelRecompute: { status: 'UNAVAILABLE_NATIVE_DISCONNECTED' },
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails the whole contract closed when the immutable upstream is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 502));
    const handler = createCandidateHandler({
      fetchImpl,
      env: { CADDYDADDY_PRODUCT_SERVICE_URL: PREVIEW_PRODUCT_SERVICE },
    });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(503);
    expect(capture.body).toMatchObject({ status: 'BLOCKED', mutationAuthority: 'NONE' });
  });
});

describe('Shipyard Now machine contract endpoint', () => {
  it('is source-neutral, read-only, and UNKNOWN by default', () => {
    expect(nowObservation({})).toEqual(expect.objectContaining({
      schemaVersion: 'forge.now-observation.v1',
      projectionRole: 'READ_ONLY_SOURCE_NEUTRAL',
      mutationAuthority: 'NONE',
      sourceHealth: 'UNKNOWN',
      asOf: null,
      current: {
        objective: expect.objectContaining({ state: 'UNKNOWN', value: null }),
        status: expect.objectContaining({ state: 'UNKNOWN', value: null }),
        blockers: expect.objectContaining({ state: 'UNKNOWN', items: [] }),
        evidence: expect.objectContaining({ state: 'UNKNOWN', items: [] }),
      },
      controls: expect.objectContaining({ authority: 'NONE', available: [] }),
    }));
  });

  it('projects only validated immutable commit evidence and does not infer progress', () => {
    const observation = nowObservation({
      VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40),
      CADDYDADDY_BACKEND_COMMIT_SHA: 'not-an-immutable-sha',
    });

    expect(observation.sourceHealth).toBe('PARTIAL');
    expect(observation.current.objective.state).toBe('UNKNOWN');
    expect(observation.current.status.state).toBe('UNKNOWN');
    expect(observation.current.evidence.items).toEqual([
      { kind: 'GIT_COMMIT', component: 'frontend', immutableId: 'c'.repeat(40), state: 'MEASURED' },
    ]);
  });

  it('fails closed on mutation methods', async () => {
    const handler = createNowHandler({});
    const { capture, response } = responseCapture();

    await handler({ method: 'PATCH' }, response);

    expect(capture.statusCode).toBe(405);
    expect(capture.headers.Allow).toBe('GET');
    expect(capture.body).toMatchObject({ mutationAuthority: 'NONE' });
  });

  it('maps the supported /now path to the read-only endpoint', () => {
    const vercel = JSON.parse(vercelSource) as { rewrites: Array<{ source: string; destination: string }> };
    expect(vercel.rewrites).toContainEqual({ source: '/now', destination: '/api/now' });
  });
});
