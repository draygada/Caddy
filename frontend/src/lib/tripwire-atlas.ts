import atlasFixture from '../data/tripwire-atlas.v1.json';

export type AtlasMode = 'confirmed' | 'pending' | 'unavailable' | 'contract_error';
export type TripwireKind = 'direct' | 'propagated' | 'unresolved';
export type TripwireState = 'flag' | 'watch' | 'cannot_evaluate';
export type AtlasValue = string | number | boolean | null | string[];

export interface AtlasFact {
  label: string;
  observed: AtlasValue;
  operator: string;
  threshold: AtlasValue;
  unit: string | null;
}

export interface EvidenceLocation {
  id: string;
  label: string;
  ruleId: string;
  repositoryPath: string;
  repositoryUrl: string;
  canonicalUrl: string;
  contentDate: string;
  documentSha256: string | null;
  span: number[] | null;
  spanSha256: string | null;
  approval: 'UNAPPROVED_CANDIDATE';
  legalRelevance: 'UNVERIFIED';
}

export interface GovernedTripwire {
  id: string;
  ruleId: string;
  entry: string;
  jurisdiction: string;
  kind: TripwireKind;
  state: TripwireState;
  targetNodeId: string;
  causeNodeId: string;
  path: string[];
  headline: string;
  missingFact?: string;
  ruleText: string;
  facts: AtlasFact[];
  evidenceLocationIds: string[];
}

export interface AtlasScenario {
  id: string;
  shortLabel: string;
  label: string;
  requestId: number;
  designRevision: string;
  headline: string;
  detail: string;
  focusNodeId: string;
  tripwireIds: string[];
  delta: { changedNodeIds: string[]; added: string[]; removed: string[] };
  humanReviewRequired: true;
  legalEffect: 'NONE';
}

export interface TripwireAtlas {
  schemaVersion: 'caddydaddy.tripwire-atlas/v1';
  immutable: true;
  generatedAt: string;
  provenance: {
    candidateCommit: string;
    tripwireTree: string;
    fb03SourceCommit: string;
    fb03SourceTree: string;
    sourceBundleSha256: string;
    hashAlgorithm: string;
    projectionMode: string;
    sourcePaths: string[];
  };
  posture: {
    artifactStatus: 'SYNTHETIC_DEMO';
    approvalStatus: 'STUBBED / UNAPPROVED';
    connectivity: 'OFFLINE FIXTURE';
    rulePackSha: string;
    rulePackDate: string;
    humanReviewRequirement: 'REQUIRED';
    destinationStatus: 'NOT_EVALUATED';
    legalEffect: 'NONE';
    claimCeiling: string;
  };
  continuityPolicy: {
    initialScenarioId: string;
    pendingBehavior: string;
    unavailableBehavior: string;
    lateResponseBehavior: string;
    contractErrorBehavior: string;
    noChangeBehavior: string;
  };
  evidenceLocations: EvidenceLocation[];
  tripwires: GovernedTripwire[];
  scenarios: AtlasScenario[];
}

export interface AtlasSession {
  mode: AtlasMode;
  lastConfirmedScenarioId: string;
  targetScenarioId: string;
  latestRequestId: number;
  ignoredRequestIds: number[];
  message: string | null;
}

export const TRIPWIRE_ATLAS = atlasFixture as unknown as TripwireAtlas;

const scenarioIndex = new Map(TRIPWIRE_ATLAS.scenarios.map((scenario) => [scenario.id, scenario]));
const tripwireIndex = new Map(TRIPWIRE_ATLAS.tripwires.map((tripwire) => [tripwire.id, tripwire]));
const evidenceIndex = new Map(TRIPWIRE_ATLAS.evidenceLocations.map((location) => [location.id, location]));

export function getAtlasScenario(id: string): AtlasScenario {
  const scenario = scenarioIndex.get(id);
  if (!scenario) throw new Error(`Unknown Tripwire Atlas scenario: ${id}`);
  return scenario;
}

export function getScenarioTripwires(scenario: AtlasScenario): GovernedTripwire[] {
  return scenario.tripwireIds.map((id) => {
    const tripwire = tripwireIndex.get(id);
    if (!tripwire) throw new Error(`Unknown governed tripwire: ${id}`);
    return tripwire;
  });
}

export function getTripwireEvidence(tripwire: GovernedTripwire): EvidenceLocation[] {
  return tripwire.evidenceLocationIds.map((id) => {
    const location = evidenceIndex.get(id);
    if (!location) throw new Error(`Unknown Tripwire evidence location: ${id}`);
    return location;
  });
}

export function createAtlasSession(initialScenarioId = TRIPWIRE_ATLAS.continuityPolicy.initialScenarioId): AtlasSession {
  const scenario = getAtlasScenario(initialScenarioId);
  return {
    mode: 'confirmed',
    lastConfirmedScenarioId: scenario.id,
    targetScenarioId: scenario.id,
    latestRequestId: scenario.requestId,
    ignoredRequestIds: [],
    message: null,
  };
}

export function startAtlasEvaluation(session: AtlasSession, targetScenarioId: string): AtlasSession {
  getAtlasScenario(targetScenarioId);
  return {
    ...session,
    mode: 'pending',
    targetScenarioId,
    latestRequestId: session.latestRequestId + 1,
    message: TRIPWIRE_ATLAS.continuityPolicy.pendingBehavior,
  };
}

export function receiveAtlasEvaluation(session: AtlasSession, scenarioId: string, requestId: number): AtlasSession {
  const scenario = getAtlasScenario(scenarioId);
  if (requestId < session.latestRequestId) {
    return { ...session, ignoredRequestIds: [...session.ignoredRequestIds, requestId].slice(-4) };
  }
  if (requestId !== session.latestRequestId || scenarioId !== session.targetScenarioId) {
    return { ...session, mode: 'contract_error', message: `Response binding mismatch for request ${requestId} and scenario ${scenarioId}.` };
  }
  return {
    ...session,
    mode: 'confirmed',
    lastConfirmedScenarioId: scenario.id,
    message: null,
  };
}

export function confirmAtlasScenario(session: AtlasSession, scenarioId: string): AtlasSession {
  const started = startAtlasEvaluation(session, scenarioId);
  return receiveAtlasEvaluation(started, scenarioId, started.latestRequestId);
}

export function markAtlasUnavailable(session: AtlasSession): AtlasSession {
  return {
    ...session,
    mode: 'unavailable',
    message: TRIPWIRE_ATLAS.continuityPolicy.unavailableBehavior,
  };
}

export function restoreAtlasConfirmation(session: AtlasSession): AtlasSession {
  return { ...session, mode: 'confirmed', targetScenarioId: session.lastConfirmedScenarioId, message: null };
}

export function assertTripwireAtlas(atlas: TripwireAtlas = TRIPWIRE_ATLAS): true {
  const sha256 = /^(?:sha256:)?[0-9a-f]{64}$/;
  if (!atlas.immutable || atlas.schemaVersion !== 'caddydaddy.tripwire-atlas/v1') throw new Error('Tripwire Atlas must be immutable v1 data.');
  for (const value of [atlas.provenance.candidateCommit, atlas.provenance.tripwireTree, atlas.provenance.fb03SourceCommit, atlas.provenance.fb03SourceTree]) {
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`Invalid source object identity: ${value}`);
  }
  if (!sha256.test(atlas.provenance.sourceBundleSha256) || !sha256.test(atlas.posture.rulePackSha)) throw new Error('Tripwire Atlas is missing a pinned source digest.');
  if (atlas.posture.legalEffect !== 'NONE' || atlas.posture.humanReviewRequirement !== 'REQUIRED' || atlas.posture.destinationStatus !== 'NOT_EVALUATED') {
    throw new Error('Tripwire Atlas claim ceiling was widened.');
  }
  const scenarioIds = new Set<string>();
  let previousRequestId = -1;
  for (const scenario of atlas.scenarios) {
    if (scenarioIds.has(scenario.id)) throw new Error(`Duplicate scenario: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (scenario.requestId <= previousRequestId) throw new Error(`Non-monotonic scenario request: ${scenario.id}`);
    previousRequestId = scenario.requestId;
    if (!sha256.test(scenario.designRevision)) throw new Error(`Invalid revision: ${scenario.id}`);
    if (!scenario.humanReviewRequired || scenario.legalEffect !== 'NONE') throw new Error(`Unsafe scenario posture: ${scenario.id}`);
    getScenarioTripwires(scenario).forEach((tripwire) => getTripwireEvidence(tripwire));
  }
  const missing = getAtlasScenario('missing');
  if (!getScenarioTripwires(missing).some((tripwire) => tripwire.state === 'cannot_evaluate' && tripwire.missingFact)) throw new Error('Cannot-evaluate state is missing.');
  const f3 = getAtlasScenario('f3');
  const f8 = getAtlasScenario('f8');
  if (f3.designRevision !== f8.designRevision || f8.delta.changedNodeIds.length || f8.delta.added.length || f8.delta.removed.length) throw new Error('F8 continuity contract is invalid.');
  return true;
}

assertTripwireAtlas();
