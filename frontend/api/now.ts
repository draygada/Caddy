import {
  buildIdentity,
  jsonHeaders,
  rejectNonGet,
  runtimeEnv,
  type ApiRequest,
  type ApiResponse,
  type RuntimeEnv,
} from './_machine-contracts.js';

export function nowObservation(env: RuntimeEnv = runtimeEnv()) {
  const identity = buildIdentity(env);
  const evidence = [
    identity.frontend.sha ? { kind: 'GIT_COMMIT', component: 'frontend', immutableId: identity.frontend.sha, state: 'MEASURED' } : null,
    identity.backend.sha ? { kind: 'GIT_COMMIT', component: 'backend', immutableId: identity.backend.sha, state: 'MEASURED' } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    schemaVersion: 'forge.now-observation.v1',
    projectionRole: 'READ_ONLY_SOURCE_NEUTRAL',
    mutationAuthority: 'NONE',
    sourceHealth: evidence.length > 0 ? 'PARTIAL' : 'UNKNOWN',
    asOf: null,
    freshness: { state: 'UNKNOWN', ageSeconds: null, thresholdSeconds: null },
    current: {
      objective: { state: 'UNKNOWN', value: null, reason: 'NO_CURRENT_DIRECTIVE_RECEIPT' },
      status: { state: 'UNKNOWN', value: null, reason: 'NO_CURRENT_EXECUTION_RECEIPT' },
      blockers: { state: 'UNKNOWN', items: [], reason: 'NO_CURRENT_BLOCKER_RECEIPT' },
      evidence: {
        state: evidence.length > 0 ? 'PARTIAL' : 'UNKNOWN',
        items: evidence,
        reason: evidence.length > 0 ? 'IMMUTABLE_BUILD_IDENTITIES_ONLY' : 'NO_CURRENT_EVIDENCE_RECEIPT',
      },
    },
    controls: {
      authority: 'NONE',
      lifecycle: ['REQUESTED', 'AUTHORIZED', 'APPLIED', 'VERIFIED'],
      available: [],
    },
    boundary: 'This projection cannot mutate Forge state, advance progress, clear a gate, or create authorization.',
  } as const;
}

export function createNowHandler(env?: RuntimeEnv) {
  return async function nowHandler(request: ApiRequest, response: ApiResponse): Promise<void> {
    if (rejectNonGet(request, response)) return;
    jsonHeaders(response);
    response.status(200).json(nowObservation(env));
  };
}

export default createNowHandler();
