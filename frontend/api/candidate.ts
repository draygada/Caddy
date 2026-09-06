import {
  buildIdentity,
  isRecord,
  jsonHeaders,
  rejectNonGet,
  runtimeEnv,
  serviceUrl,
  type ApiRequest,
  type ApiResponse,
  type RuntimeDependencies,
} from './_machine-contracts';

const DEFAULT_PRODUCT_SERVICE = 'https://caddydaddy-product-service.vercel.app';
const NATIVE_PROBE_TIMEOUT_MS = 1_500;

type NativeRuntime = {
  connection: 'CONNECTED' | 'DISCONNECTED';
  kernel: 'OpenCascade' | null;
  version: string | null;
  executedForThisResponse: false;
  evidence: 'CAPABILITY_PROBE' | 'NO_CAPABILITY_PROBE' | 'PROBE_FAILED';
};

function disconnected(evidence: NativeRuntime['evidence']): NativeRuntime {
  return {
    connection: 'DISCONNECTED',
    kernel: null,
    version: null,
    executedForThisResponse: false,
    evidence,
  };
}

function kernelIdentity(value: unknown): { name: string; version: string | null } | null {
  if (!isRecord(value)) return null;
  const kernel = isRecord(value.kernel)
    ? value.kernel
    : isRecord(value.capabilities) && isRecord(value.capabilities.kernel)
      ? value.capabilities.kernel
      : null;
  if (!kernel) return null;
  const name = typeof kernel.name === 'string' ? kernel.name : '';
  if (!/^(OpenCascade|OCCT)$/i.test(name)) return null;
  return { name: 'OpenCascade', version: typeof kernel.version === 'string' ? kernel.version : null };
}

async function observeNativeRuntime(dependencies: RuntimeDependencies): Promise<NativeRuntime> {
  const probeUrl = dependencies.env.CADDYDADDY_CAD_CAPABILITIES_URL?.trim();
  if (!probeUrl) return disconnected('NO_CAPABILITY_PROBE');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NATIVE_PROBE_TIMEOUT_MS);
  try {
    const response = await dependencies.fetchImpl(probeUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return disconnected('PROBE_FAILED');
    const identity = kernelIdentity(await response.json());
    if (!identity) return disconnected('PROBE_FAILED');
    return {
      connection: 'CONNECTED',
      kernel: 'OpenCascade',
      version: identity.version,
      executedForThisResponse: false,
      evidence: 'CAPABILITY_PROBE',
    };
  } catch {
    return disconnected('PROBE_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

function browserExchange(native: NativeRuntime) {
  const nativeState = native.connection === 'CONNECTED' ? 'AVAILABLE_NATIVE_CONNECTED' : 'UNAVAILABLE_NATIVE_DISCONNECTED';
  return {
    import: {
      CADDYDADDY_SNAPSHOT: 'AVAILABLE_BROWSER_LOCAL',
      STL: 'IMPLEMENTED_NOT_RUNTIME_VERIFIED',
      STEP: nativeState,
      IGES: nativeState,
    },
    export: {
      CADDYDADDY_SNAPSHOT: 'AVAILABLE_BROWSER_LOCAL',
      STL: 'IMPLEMENTED_NOT_RUNTIME_VERIFIED',
      SVG: 'AVAILABLE_BROWSER_LOCAL',
      DXF: 'AVAILABLE_BROWSER_LOCAL',
      BOM_CSV: 'AVAILABLE_BROWSER_LOCAL',
      SEALED_MANUFACTURING_BUNDLE: 'AVAILABLE_BROWSER_LOCAL',
      STEP: nativeState,
      IGES: nativeState,
    },
  } as const;
}

export function runtimeTruthfulCandidate(upstream: unknown, native: NativeRuntime, env: RuntimeDependencies['env']): Record<string, unknown> {
  if (!isRecord(upstream) || !isRecord(upstream.candidate)) {
    throw new Error('UPSTREAM_CANDIDATE_INVALID');
  }
  const candidate = upstream.candidate;
  const snapshotProvenance = isRecord(candidate.snapshotProvenance) ? candidate.snapshotProvenance : {};
  const exchange = browserExchange(native);
  const nativeConnected = native.connection === 'CONNECTED';

  return {
    ...upstream,
    candidate: {
      ...candidate,
      snapshotProvenance: {
        ...snapshotProvenance,
        coreExecutedAtRuntime: false,
        mode: 'PRECOMPUTED_IMMUTABLE',
      },
    },
    buildIdentity: buildIdentity(env),
    runtimeGeometry: {
      authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
      browser: {
        availability: 'AVAILABLE',
        kernel: 'JSCAD',
        executionLocation: 'BROWSER',
        scope: 'BOUNDED_MESH_CSG_NOT_PRODUCTION_BREP',
      },
      native: native,
      coreExecutedAtRuntime: false,
    },
    capabilities: {
      ...(isRecord(upstream.capabilities) ? upstream.capabilities : {}),
      authoring: true,
      recompute: true,
      import: true,
      export: true,
      nativeOcctConnected: nativeConnected,
      coreExecutedAtRuntime: false,
    },
    capabilityContracts: {
      ...(isRecord(upstream.capabilityContracts) ? upstream.capabilityContracts : {}),
      cadAuthoring: {
        status: 'AVAILABLE_BROWSER_BOUNDED',
        kernel: 'JSCAD',
        executionLocation: 'BROWSER',
        productionBrepKernel: false,
      },
      liveKernelRecompute: nativeConnected
        ? {
            status: 'AVAILABLE_NATIVE_CONNECTED',
            kernel: native.kernel,
            version: native.version,
            coreExecutedAtRuntime: false,
            note: 'Connectivity was observed; this candidate response did not execute geometry.',
          }
        : {
            status: 'UNAVAILABLE_NATIVE_DISCONNECTED',
            kernel: null,
            version: null,
            coreExecutedAtRuntime: false,
          },
      cadExchange: {
        status: nativeConnected ? 'BROWSER_BOUNDED_AND_NATIVE_CONNECTED' : 'BROWSER_BOUNDED_NATIVE_DISCONNECTED',
        formats: exchange,
        editableExternalNativeHistoryRoundTrip: false,
      },
    },
    machineContract: {
      schemaVersion: 'caddydaddy.runtime-candidate.v1',
      observedAtRequestTime: true,
      claimCeiling: 'RUNTIME_AVAILABILITY_AND_BOUNDED_DEMO_EVIDENCE_ONLY',
    },
  };
}

export function createCandidateHandler(overrides: Partial<RuntimeDependencies> = {}) {
  return async function candidateHandler(request: ApiRequest, response: ApiResponse): Promise<void> {
    if (rejectNonGet(request, response)) return;
    jsonHeaders(response);

    const dependencies: RuntimeDependencies = {
      env: overrides.env ?? runtimeEnv(),
      fetchImpl: overrides.fetchImpl ?? fetch,
    };
    const productService = dependencies.env.CADDYDADDY_PRODUCT_SERVICE_URL?.trim() || DEFAULT_PRODUCT_SERVICE;

    try {
      const [upstreamResponse, native] = await Promise.all([
        dependencies.fetchImpl(serviceUrl(productService, '/api/candidate'), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        }),
        observeNativeRuntime(dependencies),
      ]);
      if (!upstreamResponse.ok) throw new Error('UPSTREAM_CANDIDATE_UNAVAILABLE');
      const contract = runtimeTruthfulCandidate(await upstreamResponse.json(), native, dependencies.env);
      response.status(200).json(contract);
    } catch {
      response.status(503).json({
        status: 'BLOCKED',
        diagnostic: {
          code: 'CANDIDATE_CONTRACT_UNAVAILABLE',
          message: 'The immutable candidate source could not be validated; no runtime capability claim was emitted.',
        },
        mutationAuthority: 'NONE',
      });
    }
  };
}

export default createCandidateHandler();
