import { afterEach, describe, expect, it, vi } from 'vitest';
import productServiceProxy from '../api/[...path].js';
import proxySource from '../api/[...path].ts?raw';

type Capture = { body: unknown; headers: Record<string, string>; statusCode: number };

function responseCapture() {
  const capture: Capture = { body: null, headers: {}, statusCode: 0 };
  return {
    capture,
    response: {
      setHeader(name: string, value: string) { capture.headers[name] = value; },
      status(code: number) { capture.statusCode = code; return this; },
      json(value: unknown) { capture.body = value; },
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('product-service proxy production runtime', () => {
  it('uses a Node ESM-resolvable helper specifier in emitted Vercel output', () => {
    expect(proxySource).toContain("from './_machine-contracts.js'");
    expect(proxySource).not.toContain("from './_machine-contracts'");
  });

  it('invokes the default catch-all export with Vercel-shaped request and response objects', async () => {
    vi.stubEnv('CADDYDADDY_PRODUCT_SERVICE_URL', 'https://product-preview-runtime-team.vercel.app');
    const body = { part_number: 'SYNTHETIC-PUBLIC-001' };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchImpl);
    const { capture, response } = responseCapture();

    await productServiceProxy({
      method: 'POST',
      url: '/api/[...path]?path=sourcing%2Frounds',
      query: { path: 'sourcing/rounds' },
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer must-not-cross',
        cookie: 'session=must-not-cross',
        'x-caddydaddy-live-token': 'must-not-cross-on-sourcing',
      },
      body,
    }, response);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://product-preview-runtime-team.vercel.app/api/sourcing/rounds',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        redirect: 'manual',
      }),
    );
    expect(capture.statusCode).toBe(200);
    expect(capture.body).toEqual({ status: 'ok' });
    expect(capture.headers).toMatchObject({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  it('does not invoke upstream for health, unknown, or query-bearing paths', async () => {
    vi.stubEnv('CADDYDADDY_PRODUCT_SERVICE_URL', 'https://product-preview-runtime-team.vercel.app');
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchImpl);
    const denied = [
      { method: 'GET', url: '/api/[...path]?path=health', query: { path: 'health' }, headers: {} },
      { method: 'POST', url: '/api/[...path]?path=not-a-consumer', query: { path: 'not-a-consumer' }, headers: { 'content-type': 'application/json' }, body: {} },
      { method: 'POST', url: '/api/[...path]?path=sourcing%2Frounds&debug=true', query: { path: 'sourcing/rounds', debug: 'true' }, headers: { 'content-type': 'application/json' }, body: {} },
      { method: 'POST', url: '/api/classification', query: { debug: 'true' }, headers: { 'content-type': 'application/json' }, body: {} },
      { method: 'POST', url: '/api/[...path]?path=classification&path=orders%2Fdispatches', query: { path: ['classification', 'orders/dispatches'] }, headers: { 'content-type': 'application/json' }, body: {} },
    ];

    for (const request of denied) {
      const { capture, response } = responseCapture();
      await productServiceProxy(request, response);
      expect(capture.statusCode).toBe(404);
      expect(capture.body).toMatchObject({
        status: 'BLOCKED',
        diagnostic: { code: 'PRODUCT_SERVICE_ROUTE_NOT_ALLOWED' },
      });
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
