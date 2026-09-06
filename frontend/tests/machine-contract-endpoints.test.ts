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

  it('replaces upstream OCCT overclaims with disconnected runtime truth', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(UPSTREAM));
    const handler = createCandidateHandler({ fetchImpl, env: {} });
    const { capture, response } = responseCapture();

    await handler({ method: 'GET' }, response);

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({
      candidate: { snapshotProvenance: { mode: 'PRECOMPUTED_IMMUTABLE', coreExecutedAtRuntime: false } },
      runtimeGeometry: {
        authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
        native: { connection: 'DISCONNECTED', kernel: null, evidence: 'NO_CAPABILITY_PROBE' },
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
  });

  it('reports connected OCCT only after a valid capability probe and keeps execution false', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === 'https://native.example/api/capabilities') {
        return jsonResponse({ kernel: { name: 'OpenCascade', version: '7.9.3' } });
      }
      return jsonResponse(UPSTREAM);
    });
    const handler = createCandidateHandler({
      fetchImpl,
      env: {
        CADDYDADDY_CAD_CAPABILITIES_URL: 'https://native.example/api/capabilities',
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
        native: { connection: 'CONNECTED', kernel: 'OpenCascade', version: '7.9.3', executedForThisResponse: false },
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

  it('fails the whole contract closed when the immutable upstream is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 502));
    const handler = createCandidateHandler({ fetchImpl, env: {} });
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
