import { describe, expect, it, vi } from 'vitest';
import { createProductServiceProxy, MAX_PROXY_BODY_BYTES } from '../api/[...path]';
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
  return {
    method: 'POST',
    query: { path },
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
const jsonResponse = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

describe('integrated preview routing', () => {
  it('keeps local machine contracts and removes every external API rewrite', () => {
    const vercel = JSON.parse(vercelSource) as { rewrites: Array<{ source: string; destination: string }> };
    expect(vercel.rewrites).toEqual([{ source: '/now', destination: '/api/now' }]);
    expect(vercel.rewrites.some(({ source, destination }) => source.startsWith('/api/') || /^https?:/i.test(destination))).toBe(false);
    expect(vercelSource).not.toContain('caddydaddy-product-service.vercel.app');
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
      { ...request('classification'), query: { path: 'classification', target: 'https://internal.example' } },
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
