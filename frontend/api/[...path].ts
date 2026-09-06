import { jsonHeaders, runtimeEnv, type ApiResponse, type RuntimeDependencies } from './_machine-contracts.js';

type HeaderValue = string | string[] | undefined;

interface ProxyRequest {
  body?: unknown;
  headers?: Record<string, HeaderValue>;
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

type ProxyDependencies = Pick<RuntimeDependencies, 'env' | 'fetchImpl'>;

const PRODUCT_SERVICE_ENV = 'CADDYDADDY_PRODUCT_SERVICE_URL';
const LIVE_TOKEN_HEADER = 'X-CADdyDaddy-Live-Token';
const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_PROXY_BODY_BYTES = 4_000_000;

const ROUTES = new Map<string, ReadonlySet<string>>([
  ['/api/health', new Set(['GET'])],
  ['/api/compliance-at-design-click', new Set(['POST'])],
  ['/api/classification', new Set(['POST'])],
  ['/api/sourcing/rounds', new Set(['POST'])],
  ['/api/sourcing/adjudications', new Set(['POST'])],
  ['/api/sourcing/selections', new Set(['POST'])],
  ['/api/sourcing/packages', new Set(['POST'])],
  ['/api/sourcing/dispatches', new Set(['POST'])],
  ['/api/provenance/inspect', new Set(['POST'])],
  ['/api/provenance/verify', new Set(['POST'])],
  ['/api/provenance/accept', new Set(['POST'])],
  ['/api/cad/recompute', new Set(['POST'])],
  ['/api/cad/import', new Set(['POST'])],
  ['/api/cad/export', new Set(['POST'])],
  ['/api/cad/outputs/native/seal', new Set(['POST'])],
  ['/api/cad/outputs/native/load', new Set(['POST'])],
  ['/api/cad/outputs/generate', new Set(['POST'])],
  ['/api/orders/packages/validate', new Set(['POST'])],
  ['/api/orders/dispatches', new Set(['POST'])],
  ['/api/orders/receipts/read', new Set(['POST'])],
  ['/api/orders/receipts/acknowledge', new Set(['POST'])],
  ['/api/orders/receipts/reconcile', new Set(['POST'])],
  ['/api/orders/receipts/close', new Set(['POST'])],
  ['/api/orders/audit/verify', new Set(['POST'])],
]);

function header(request: ProxyRequest, name: string): string | undefined {
  const match = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = match?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function blocked(response: ApiResponse, status: number, code: string, message: string, allow?: string): void {
  jsonHeaders(response);
  if (allow) response.setHeader('Allow', allow);
  response.status(status).json({
    status: 'BLOCKED',
    diagnostic: { code, message },
    proxyAuthority: 'ENUMERATED_PRODUCT_SERVICE_ROUTES_ONLY',
  });
}

function targetOrigin(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const target = new URL(value.trim());
    const validHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*vercel\.app$/i.test(target.hostname);
    const rootOnly = target.pathname === '/' && target.search === '' && target.hash === '';
    if (target.protocol !== 'https:' || !validHost || !rootOnly || target.username || target.password || target.port) return null;
    return target;
  } catch {
    return null;
  }
}

function requestedPath(request: ProxyRequest): string | null {
  const query = request.query ?? {};
  if (Object.keys(query).some((key) => key !== 'path')) return null;
  const raw = query.path;
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('/') : [];
  if (parts.length === 0 || parts.some((part) => !part || part === '.' || part === '..')) return null;
  return `/api/${parts.join('/')}`;
}

function declaredLength(request: ProxyRequest): number | null {
  const raw = header(request, 'content-length');
  if (raw === undefined) return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}

function jsonBody(body: unknown): string | null {
  let value = body;
  if (typeof body === 'string') {
    try {
      value = JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function isJson(contentType: string | null): boolean {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

export function createProductServiceProxy(overrides: Partial<ProxyDependencies> = {}) {
  return async function productServiceProxy(request: ProxyRequest, response: ApiResponse): Promise<void> {
    const dependencies: ProxyDependencies = {
      env: overrides.env ?? runtimeEnv(),
      fetchImpl: overrides.fetchImpl ?? fetch,
    };
    const target = targetOrigin(dependencies.env[PRODUCT_SERVICE_ENV]);
    if (!target) {
      blocked(response, 503, 'PRODUCT_SERVICE_TARGET_UNAVAILABLE', `${PRODUCT_SERVICE_ENV} must name an approved HTTPS Vercel deployment origin.`);
      return;
    }

    const path = requestedPath(request);
    const methods = path ? ROUTES.get(path) : undefined;
    if (!path || !methods) {
      blocked(response, 404, 'PRODUCT_SERVICE_ROUTE_NOT_ALLOWED', 'The requested path is not an enumerated product-service route.');
      return;
    }

    const method = (request.method ?? 'GET').toUpperCase();
    if (!methods.has(method)) {
      const allow = [...methods].join(', ');
      blocked(response, 405, 'PRODUCT_SERVICE_METHOD_NOT_ALLOWED', `This route accepts only ${allow}.`, allow);
      return;
    }

    const upstreamHeaders: Record<string, string> = { Accept: 'application/json' };
    let body: string | undefined;
    if (method === 'POST') {
      if (!isJson(header(request, 'content-type') ?? null)) {
        blocked(response, 415, 'JSON_REQUIRED', 'Product-service writes require application/json.');
        return;
      }
      const length = declaredLength(request);
      if (length !== null && (!Number.isFinite(length) || length > MAX_PROXY_BODY_BYTES)) {
        blocked(response, 413, 'REQUEST_BODY_TOO_LARGE', `Request bodies are limited to ${MAX_PROXY_BODY_BYTES} bytes.`);
        return;
      }
      body = jsonBody(request.body) ?? undefined;
      if (body === undefined) {
        blocked(response, 400, 'INVALID_JSON_BODY', 'A JSON object body is required.');
        return;
      }
      if (new TextEncoder().encode(body).byteLength > MAX_PROXY_BODY_BYTES) {
        blocked(response, 413, 'REQUEST_BODY_TOO_LARGE', `Request bodies are limited to ${MAX_PROXY_BODY_BYTES} bytes.`);
        return;
      }
      upstreamHeaders['Content-Type'] = 'application/json';
    }

    if (path === '/api/classification') {
      const liveToken = header(request, LIVE_TOKEN_HEADER)?.trim();
      if (liveToken) upstreamHeaders[LIVE_TOKEN_HEADER] = liveToken;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const upstream = await dependencies.fetchImpl(new URL(path, target).toString(), {
        method,
        headers: upstreamHeaders,
        body,
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        blocked(response, 502, 'UPSTREAM_REDIRECT_BLOCKED', 'The configured product service attempted an untrusted redirect.');
        return;
      }
      const responseLength = upstream.headers.get('content-length');
      if (responseLength && (/^\d+$/.test(responseLength) ? Number(responseLength) : Number.POSITIVE_INFINITY) > MAX_PROXY_BODY_BYTES) {
        blocked(response, 502, 'UPSTREAM_RESPONSE_REJECTED', 'The product-service response exceeded the proxy limit.');
        return;
      }
      if (!isJson(upstream.headers.get('content-type'))) {
        blocked(response, 502, 'UPSTREAM_RESPONSE_REJECTED', 'The product service did not return JSON.');
        return;
      }
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength > MAX_PROXY_BODY_BYTES) {
        blocked(response, 502, 'UPSTREAM_RESPONSE_REJECTED', 'The product-service response exceeded the proxy limit.');
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      } catch {
        blocked(response, 502, 'UPSTREAM_RESPONSE_REJECTED', 'The product service returned malformed JSON.');
        return;
      }
      jsonHeaders(response);
      response.status(upstream.status).json(payload);
    } catch {
      blocked(response, 502, 'PRODUCT_SERVICE_UNAVAILABLE', 'The configured product service could not be reached.');
    } finally {
      clearTimeout(timeout);
    }
  };
}

export default createProductServiceProxy();
