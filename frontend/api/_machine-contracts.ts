export interface ApiRequest {
  method?: string;
}

export interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(value: unknown): void;
}

export type RuntimeEnv = Record<string, string | undefined>;

export interface RuntimeDependencies {
  env: RuntimeEnv;
  fetchImpl: typeof fetch;
}

export interface ImmutableCommitIdentity {
  status: 'INJECTED_IMMUTABLE' | 'UNKNOWN';
  sha: string | null;
}

const SHA_1 = /^[0-9a-f]{40}$/i;

export function runtimeEnv(): RuntimeEnv {
  const host = globalThis as typeof globalThis & {
    process?: { env?: RuntimeEnv };
  };
  return host.process?.env ?? {};
}

export function immutableCommit(value: string | undefined): ImmutableCommitIdentity {
  const candidate = value?.trim() ?? '';
  if (!SHA_1.test(candidate)) return { status: 'UNKNOWN', sha: null };
  return { status: 'INJECTED_IMMUTABLE', sha: candidate.toLowerCase() };
}

export function buildIdentity(env: RuntimeEnv) {
  return {
    frontend: immutableCommit(env.CADDYDADDY_FRONTEND_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA),
    backend: immutableCommit(env.CADDYDADDY_BACKEND_COMMIT_SHA),
  } as const;
}

export function jsonHeaders(response: ApiResponse): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

export function rejectNonGet(request: ApiRequest, response: ApiResponse): boolean {
  if ((request.method ?? 'GET').toUpperCase() === 'GET') return false;
  jsonHeaders(response);
  response.setHeader('Allow', 'GET');
  response.status(405).json({
    status: 'BLOCKED',
    diagnostic: { code: 'METHOD_NOT_ALLOWED', message: 'This machine contract is read-only; use GET.' },
    mutationAuthority: 'NONE',
  });
  return true;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serviceUrl(base: string, path: string): string {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), normalized).toString();
}

