import { describe, expect, it, vi } from 'vitest';
import { CLASSIFICATION_REQUEST_TIMEOUT_MS, createProductServiceProxy, MAX_PROXY_BODY_BYTES } from '../api/[...path]';
import vercelSource from '../vercel.json?raw';

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

function request(path: string | string[], body: unknown = { synthetic: true }) {
  const parts = Array.isArray(path) ? path : path.split('/');
  const capture = parts.join('/');
  return {
    method: 'POST',
    // Vercel rewrites api/[...path] to its function entrypoint and exposes the
    // framework-owned splat as request.query.path. This is the production shape,
    // not a public caller query string.
    url: `/api/[...path]?path=${encodeURIComponent(capture)}`,
    query: { path: capture },
    headers: {
      accept: 'application/json',
      'content-type': 'application/json; charset=utf-8',
      authorization: 'Bearer must-not-cross',
      cookie: 'session=must-not-cross',
      origin: 'https://browser.example',
      'x-forwarded-for': '127.0.0.1',
      'x-caddydaddy-live-token': 'demo-live-token',
    },
    body,
  };
}

const ENV = { CADDYDADDY_PRODUCT_SERVICE_URL: 'https://product-preview-abc-team.vercel.app' };
const CONSUMER_POST_ROUTES = [
  '/api/compliance-at-design-click',
  '/api/classification',
  '/api/sourcing/rounds',
  '/api/sourcing/adjudications',
  '/api/sourcing/selections',
  '/api/sourcing/packages',
  '/api/sourcing/dispatches',
  '/api/provenance/inspect',
  '/api/provenance/verify',
  '/api/provenance/accept',
  '/api/cad/recompute',
  '/api/cad/import',
  '/api/cad/export',
  '/api/cad/outputs/native/seal',
  '/api/cad/outputs/native/load',
  '/api/cad/outputs/generate',
  '/api/orders/packages/validate',
  '/api/orders/dispatches',
  '/api/orders/receipts/read',
  '/api/orders/receipts/acknowledge',
  '/api/orders/receipts/reconcile',
  '/api/orders/receipts/close',
  '/api/orders/audit/verify',
] as const;
const jsonResponse = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

describe('integrated preview routing', () => {
  it('keeps local machine contracts and removes every external API rewrite', () => {
    const vercel = JSON.parse(vercelSource) as {
      functions: Record<string, { maxDuration: number }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    expect(vercel.rewrites).toEqual([{ source: '/now', destination: '/api/now' }]);
    expect(vercel.rewrites.some(({ source, destination }) => source.startsWith('/api/') || /^https?:/i.test(destination))).toBe(false);
    expect(vercelSource).not.toContain('caddydaddy-product-service.vercel.app');
    expect(vercel.functions['api/[...path].ts'].maxDuration).toBe(120);
  });

  it('fails closed without an exact approved Vercel origin', async () => {
    const invalidTargets = [
      undefined,
      'http://preview.vercel.app',
      'https://user:pass@preview.vercel.app',
      'https://preview.vercel.app:444',
      'https://preview.vercel.app/api',
      'https://preview.vercel.app?next=internal',
      'https://preview.vercel.app.evil.example',
      'https://127.0.0.1',
    ];

    for (const target of invalidTargets) {
      const fetchImpl = vi.fn<typeof fetch>();
      const handler = createProductServiceProxy({ env: { CADDYDADDY_PRODUCT_SERVICE_URL: target }, fetchImpl });
      const { capture, response } = responseCapture();
      await handler(request('classification'), response);
      expect(capture.statusCode).toBe(503);
      expect(capture.body).toMatchObject({ status: 'BLOCKED', diagnostic: { code: 'PRODUCT_SERVICE_TARGET_UNAVAILABLE' } });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('allows only enumerated paths, exact route verbs, and no caller query string', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createProductServiceProxy({ env: ENV, fetchImpl });

    for (const candidate of [
      request('../candidate'),
      request('arbitrary'),
      { ...request('classification'), url: '/api/[...path]?path=classification&target=https://internal.example', query: { path: 'classification', target: 'https://internal.example' } },
    ]) {
      const { capture, response } = responseCapture();
      await handler(candidate, response);
      expect(capture.statusCode).toBe(candidate.query && 'target' in candidate.query ? 404 : 404);
    }

    const { capture, response } = responseCapture();
    await handler({ ...request('classification'), method: 'PUT' }, response);
    expect(capture.statusCode).toBe(405);
    expect(capture.headers.Allow).toBe('POST');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards every current frontend product-service consumer and denies an unknown route', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ status: 'ok' }));
    const handler = createProductServiceProxy({ env: ENV, fetchImpl });

    for (const path of CONSUMER_POST_ROUTES) {
      const { capture, response } = responseCapture();
      await handler(request(path.slice('/api/'.length)), response);
      expect(capture.statusCode, path).toBe(200);
    }

    expect(fetchImpl).toHaveBeenCalledTimes(CONSUMER_POST_ROUTES.length);
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual(
      CONSUMER_POST_ROUTES.map((path) => [`https://product-preview-abc-team.vercel.app${path}`, 'POST']),
    );

    const { capture, response } = responseCapture();
    await handler(request('not-a-consumer'), response);
    expect(capture.statusCode).toBe(404);
    expect(capture.body).toMatchObject({
      status: 'BLOCKED',
      diagnostic: { code: 'PRODUCT_SERVICE_ROUTE_NOT_ALLOWED' },
      proxyAuthority: 'ENUMERATED_PRODUCT_SERVICE_ROUTES_ONLY',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(CONSUMER_POST_ROUTES.length);
  });

  it('rejects non-JSON, malformed, and oversized bodies before fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createProductServiceProxy({ env: ENV, fetchImpl });

    const cases = [
      { ...request('classification'), headers: { 'content-type': 'text/plain' } },
      { ...request('classification'), body: '[1,2,3]' },
      { ...request('classification'), headers: { 'content-type': 'application/json', 'content-length': String(MAX_PROXY_BODY_BYTES + 1) } },
      request('classification', { value: 'x'.repeat(MAX_PROXY_BODY_BYTES) }),
    ];

    const statuses: number[] = [];
    for (const candidate of cases) {
      const { capture, response } = responseCapture();
      await handler(candidate, response);
      statuses.push(capture.statusCode);
    }
    expect(statuses).toEqual([415, 400, 413, 413]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards an allowed classification request only to the configured origin with minimal headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ determination: 'UNDETERMINED' }, 422));
    const handler = createProductServiceProxy({ env: ENV, fetchImpl });
    const { capture, response } = responseCapture();

    await handler(request(['classification']), response);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://product-preview-abc-team.vercel.app/api/classification');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'manual' });
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CADdyDaddy-Live-Token': 'demo-live-token',
    });
    expect(capture.statusCode).toBe(422);
    expect(capture.body).toEqual({ determination: 'UNDETERMINED' });
    expect(capture.headers['Cache-Control']).toBe('no-store');
  });

  it('keeps a live classification request open beyond the ordinary 15 second route ceiling', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }));
      const handler = createProductServiceProxy({ env: ENV, fetchImpl });
      const { capture, response } = responseCapture();
      const pending = handler(request('classification'), response);

      await vi.advanceTimersByTimeAsync(15_001);
      expect(capture.statusCode).toBe(0);

      await vi.advanceTimersByTimeAsync(CLASSIFICATION_REQUEST_TIMEOUT_MS - 15_001);
      await pending;
      expect(capture.statusCode).toBe(502);
      expect(capture.body).toMatchObject({ diagnostic: { code: 'PRODUCT_SERVICE_UNAVAILABLE' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('never leaks the live token or ambient browser credentials to another route', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ status: 'ok' }));
    const handler = createProductServiceProxy({ env: ENV, fetchImpl });
    const { response } = responseCapture();

    await handler(request(['sourcing', 'rounds']), response);

    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
  });

  it('blocks redirects, malformed content, and oversized upstream responses', async () => {
    const upstreams = [
      new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1' } }),
      new Response('<html>not json</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
      jsonResponse({ ok: true }, 200, { 'Content-Length': String(MAX_PROXY_BODY_BYTES + 1) }),
      new Response('{broken', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ];

    for (const upstream of upstreams) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(upstream);
      const handler = createProductServiceProxy({ env: ENV, fetchImpl });
      const { capture, response } = responseCapture();
      await handler(request('classification'), response);
      expect(capture.statusCode).toBe(502);
      expect(capture.body).toMatchObject({ status: 'BLOCKED' });
    }
  });
});
