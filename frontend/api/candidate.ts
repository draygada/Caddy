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
} from './_machine-contracts.js';

const NATIVE_PROBE_TIMEOUT_MS = 1_500;

type ProductServiceBinding =
  | { status: 'BOUND'; origin: string }
  | { status: 'UNKNOWN'; origin: null }
  | { status: 'UNAVAILABLE'; origin: null };

type NativeRuntime = {
  connection: 'CONNECTED' | 'DISCONNECTED';
  kernel: 'OpenCascade' | null;
  version: string | null;
  executedForThisResponse: false;
  evidence:
    | 'PRODUCT_CORE_CAPABILITY'
    | 'PRODUCT_CORE_CAPABILITY_BLOCKED'
    | 'PRODUCT_CORE_CAPABILITY_INVALID'
    | 'PRODUCT_CORE_CAPABILITY_UNREACHABLE'
    | 'NO_PRODUCT_SERVICE_BINDING';
  reason: { code: string; message: string } | null;
};

function disconnected(
  evidence: NativeRuntime['evidence'],
  code: string,
  message: string,
): NativeRuntime {
  return {
    connection: 'DISCONNECTED',
    kernel: null,
    version: null,
    executedForThisResponse: false,
    evidence,
    reason: { code, message },
  };
}

function productServiceBinding(value: string | undefined): ProductServiceBinding {
  const configured = value?.trim();
  if (!configured) return { status: 'UNKNOWN', origin: null };

  try {
    const url = new URL(configured);
    const valid =
      url.protocol === 'https:'
      && url.hostname.endsWith('.vercel.app')
      && !url.username
      && !url.password
      && !url.port
      && url.pathname === '/'
      && !url.search
      && !url.hash;
    return valid
      ? { status: 'BOUND', origin: url.origin }
      : { status: 'UNAVAILABLE', origin: null };
  } catch {
    return { status: 'UNAVAILABLE', origin: null };
  }
}

function kernelIdentity(value: unknown): { name: 'OpenCascade'; version: string } | null {
  if (
    !isRecord(value)
    || value.schema_version !== 'caddydaddy.cad-capabilities/1'
    || value.status !== 'AVAILABLE'
    || !isRecord(value.kernel)
    || value.kernel.name !== 'OpenCascade'
    || value.kernel.version !== '7.9.3'
    || value.kernel.binding !== 'cadquery-ocp-novtk/7.9.3.1'
    || !isRecord(value.runtime_gate)
    || value.runtime_gate.status !== 'APPROVED'
    || value.runtime_gate.owner_approval !== 'ASSERTED_BY_DEPLOYMENT_CONFIGURATION'
    || value.runtime_gate.approval_binding !== 'caddydaddy.native-runtime/v1'
    || value.runtime_gate.factual_evidence !== 'PASS'
    || value.runtime_gate.legal_determination !== 'NOT_PERFORMED'
    || value.runtime_gate.artifact_sha256 !== '8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b'
    || !Array.isArray(value.features)
    || !value.features.includes('FILLET')
    || !value.features.includes('CHAMFER')
    || !isRecord(value.exchange)
    || !Array.isArray(value.exchange.exact)
    || !value.exchange.exact.includes('STEP_AP242')
    || !value.exchange.exact.includes('IGES_5_3')
  ) return null;
  return { name: 'OpenCascade', version: '7.9.3' };
}

function blockedReason(value: unknown): { code: string; message: string } | null {
  if (!isRecord(value)) return null;
  const direct = isRecord(value.diagnostic) ? value.diagnostic : null;
  const first = Array.isArray(value.diagnostics) && isRecord(value.diagnostics[0]) ? value.diagnostics[0] : null;
  const diagnostic = direct ?? first;
  return diagnostic && typeof diagnostic.code === 'string' && typeof diagnostic.message === 'string'
    ? { code: diagnostic.code, message: diagnostic.message }
    : null;
}

async function observeNativeRuntime(dependencies: RuntimeDependencies, productOrigin: string): Promise<NativeRuntime> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NATIVE_PROBE_TIMEOUT_MS);
  try {
    const response = await dependencies.fetchImpl(serviceUrl(productOrigin, '/api/cad/capabilities'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return disconnected(
        'PRODUCT_CORE_CAPABILITY_INVALID',
        'CAD_CAPABILITY_CONTRACT_INVALID',
        'The product/core CAD capability endpoint returned unreadable JSON; native CAD remains blocked.',
      );
    }
    if (!response.ok) {
      const reason = blockedReason(value) ?? {
        code: 'CAD_RUNTIME_BLOCKED',
        message: `The product/core CAD capability endpoint returned HTTP ${response.status}; native CAD remains blocked.`,
      };
      return disconnected('PRODUCT_CORE_CAPABILITY_BLOCKED', reason.code, reason.message);
    }
    const identity = kernelIdentity(value);
    if (!identity) {
      return disconnected(
        'PRODUCT_CORE_CAPABILITY_INVALID',
        'CAD_CAPABILITY_CONTRACT_INVALID',
        'The product/core API did not prove the approved caddydaddy.cad-capabilities/1 OCCT runtime contract.',
      );
    }
    return {
      connection: 'CONNECTED',
      kernel: 'OpenCascade',
      version: identity.version,
      executedForThisResponse: false,
      evidence: 'PRODUCT_CORE_CAPABILITY',
      reason: null,
    };
  } catch {
    return disconnected(
      'PRODUCT_CORE_CAPABILITY_UNREACHABLE',
      'CAD_CAPABILITY_ENDPOINT_UNREACHABLE',
      'The product/core CAD capability endpoint could not be reached; native CAD remains blocked.',
    );
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

function localRuntimeObservation(native: NativeRuntime, env: RuntimeDependencies['env']) {
  const exchange = browserExchange(native);
  const nativeConnected = native.connection === 'CONNECTED';
  return {
    buildIdentity: buildIdentity(env),
    runtimeGeometry: {
      authoritativeForThisBrowserSession: 'BROWSER_JSCAD_BOUNDED',
      browser: {
        availability: 'AVAILABLE',
        kernel: 'JSCAD',
        executionLocation: 'BROWSER',
        scope: 'BOUNDED_MESH_CSG_NOT_PRODUCTION_BREP',
      },
      native,
      coreExecutedAtRuntime: false,
    },
    capabilities: {
      authoring: true,
      recompute: true,
      import: true,
      export: true,
      nativeOcctConnected: nativeConnected,
      coreExecutedAtRuntime: false,
    },
    capabilityContracts: {
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
  } as const;
}

export function runtimeTruthfulCandidate(upstream: unknown, native: NativeRuntime, env: RuntimeDependencies['env']): Record<string, unknown> {
  if (!isRecord(upstream) || !isRecord(upstream.candidate)) {
    throw new Error('UPSTREAM_CANDIDATE_INVALID');
  }
  const candidate = upstream.candidate;
  const snapshotProvenance = isRecord(candidate.snapshotProvenance) ? candidate.snapshotProvenance : {};
  const local = localRuntimeObservation(native, env);

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
    buildIdentity: local.buildIdentity,
    runtimeGeometry: local.runtimeGeometry,
    capabilities: {
      ...(isRecord(upstream.capabilities) ? upstream.capabilities : {}),
      ...local.capabilities,
    },
    capabilityContracts: {
      ...(isRecord(upstream.capabilityContracts) ? upstream.capabilityContracts : {}),
      ...local.capabilityContracts,
    },
    machineContract: local.machineContract,
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
    const binding = productServiceBinding(dependencies.env.CADDYDADDY_PRODUCT_SERVICE_URL);

    if (binding.status !== 'BOUND') {
      const native = disconnected(
        'NO_PRODUCT_SERVICE_BINDING',
        'PRODUCT_SERVICE_BINDING_REQUIRED',
        'Bind CADDYDADDY_PRODUCT_SERVICE_URL before probing or invoking the isolated OCCT service through product/core.',
      );
      response.status(503).json({
        status: 'BLOCKED',
        serviceAvailability: {
          productService: {
            status: binding.status,
            binding: 'CADDYDADDY_PRODUCT_SERVICE_URL',
            origin: null,
          },
        },
        ...localRuntimeObservation(native, dependencies.env),
        diagnostic: {
          code: binding.status === 'UNKNOWN'
            ? 'PRODUCT_SERVICE_BINDING_UNKNOWN'
            : 'PRODUCT_SERVICE_BINDING_INVALID',
          message: 'An explicit valid product-service origin is required; no fallback service was contacted.',
        },
        mutationAuthority: 'NONE',
      });
      return;
    }

    try {
      const [upstreamResponse, native] = await Promise.all([
        dependencies.fetchImpl(serviceUrl(binding.origin, '/api/candidate'), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        }),
        observeNativeRuntime(dependencies, binding.origin),
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
