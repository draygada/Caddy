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
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchImpl);
    const { capture, response } = responseCapture();

    await productServiceProxy({
      method: 'GET',
      query: { path: ['health'] },
      headers: {
        authorization: 'Bearer must-not-cross',
        cookie: 'session=must-not-cross',
        'x-caddydaddy-live-token': 'must-not-cross-on-health',
      },
    }, response);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://product-preview-runtime-team.vercel.app/api/health',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
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
});
