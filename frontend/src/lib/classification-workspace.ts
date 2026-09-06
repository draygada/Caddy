export const STAGE_ORDER = [
  'usml_enumerated',
  'specially_designed_itar',
  'six_hundred_series',
  'specially_designed_ear',
  'other_ccl',
  'residual',
] as const;

export type Stage = (typeof STAGE_ORDER)[number];
export type ObservationDisposition = 'met' | 'not_met' | 'indeterminate';
export type CandidateDisposition = 'supported' | 'knocked_out' | 'undetermined' | 'not_reached';
export type JurisdictionRoute = 'ITAR' | 'EAR' | 'EAR99' | 'UNDETERMINED';
export type FactValue = string | number | boolean | 'unknown';

export interface CitationObservation {
  unitKey: string;
  quote: string;
  verified: boolean;
  source: string;
}

export interface ElementObservation {
  elementId: string;
  label: string;
  disposition: ObservationDisposition;
  basis: 'stated' | 'inferred' | 'assumed';
  factPaths: string[];
  citation: CitationObservation | null;
  note: string;
}

export interface CandidateInput {
  candidateId: string;
  provision: string;
  stage: Stage;
  whyConsidered: string;
  advocate: ElementObservation[];
  judge: ElementObservation[];
  challenge: { text: string; resolution: 'sustained' | 'rejected' } | null;
}

export interface ReconciledCandidate extends CandidateInput {
  disposition: CandidateDisposition;
  observations: ElementObservation[];
  reconciliationNotes: string[];
}

export interface EvidenceQuestion {
  id: string;
  rank: number;
  impact: 'route-blocking' | 'classification-blocking' | 'supporting';
  candidateId: string;
  provision: string;
  factPath: string;
  question: string;
  resolves: string;
}

export interface StageResult {
  stage: Stage;
  state: 'complete' | 'active' | 'not_reached';
  summary: string;
}

export interface WorkspaceScenario {
  id: string;
  name: string;
  description: string;
  facts: Record<string, FactValue>;
  candidates: CandidateInput[];
  specificCclMode?: 'default' | 'no_valid_candidates';
}

export interface WorkspaceResult {
  scenarioId: string;
  route: JurisdictionRoute;
  classification: string[];
  routeDisposition: 'supported' | 'undetermined' | 'residual';
  routeBasis: string[];
  openCandidates: string[];
  candidates: ReconciledCandidate[];
  stages: StageResult[];
  questions: EvidenceQuestion[];
  claimClass: 'JURISDICTION_SCREENING_SIMULATION';
  claimCeiling: 'DRAFT_REVIEW_ONLY' | 'UNDETERMINED_NO_CLEARANCE';
  readiness: 'READY_FOR_COUNSEL_REVIEW' | 'HOLD_MISSING_EVIDENCE';
  coverage: readonly ['USML_ORDER_OF_REVIEW', 'CCL_JURISDICTION_ROUTE'];
  exclusions: readonly string[];
}

const citation = (unitKey: string, quote: string): CitationObservation => ({
  unitKey,
  quote,
  verified: true,
  source: 'Public eCFR reference-pack excerpt, synthetic demonstration fixture',
});

const observation = (
  elementId: string,
  label: string,
  disposition: ObservationDisposition,
  factPath: string,
  note: string,
  cite: CitationObservation | null,
): ElementObservation => ({
  elementId,
  label,
  disposition,
  basis: disposition === 'indeterminate' ? 'assumed' : 'stated',
  factPaths: [factPath],
  citation: cite,
  note,
});

const usmlCitation = citation('USML XI(c)(2)', 'parts, components, accessories, attachments, and associated equipment');
const itarSdCitation = citation('22 CFR 120.41(a)', 'specially designed means that the commodity');
const seriesCitation = citation('3A611.g', 'Electronic equipment and systems, not elsewhere specified');
const earSdCitation = citation('15 CFR 772.1 SD(b)(3)', 'Has the same function, performance capabilities');
const otherCclCitation = citation('9A991.d', 'propulsion aircraft engines and parts and components');

function buildCandidates(facts: Record<string, FactValue>): CandidateInput[] {
  const militaryIntegration = facts['design.military_integration'];
  const predominantMilitary = facts['design.predominantly_military'];
  const catalogEquivalent = facts['design.catalog_equivalent'];
  const aircraftPropulsion = facts['item.aircraft_propulsion'];

  const usmlJudge: ObservationDisposition = militaryIntegration === true
    ? 'met'
    : militaryIntegration === false
      ? 'not_met'
      : 'indeterminate';
  const itarSdJudge: ObservationDisposition = predominantMilitary === true
    ? 'met'
    : predominantMilitary === false
      ? 'not_met'
      : 'indeterminate';
  const seriesJudge: ObservationDisposition = predominantMilitary === true
    ? 'met'
    : predominantMilitary === false
      ? 'not_met'
      : 'indeterminate';
  const releaseJudge: ObservationDisposition = catalogEquivalent === true
    ? 'not_met'
    : catalogEquivalent === false
      ? 'met'
      : 'indeterminate';
  const propulsionJudge: ObservationDisposition = aircraftPropulsion === true
    ? 'met'
    : aircraftPropulsion === false
      ? 'not_met'
      : 'indeterminate';

  return [
    {
      candidateId: 'cand:1:USML-XI-c-2',
      provision: 'USML XI(c)(2)',
      stage: 'usml_enumerated',
      whyConsidered: 'A flight-control carrier can be raised as a component candidate; the fixture does not assume military integration.',
      advocate: [observation('xi-component', 'Article is a covered military-electronics component', militaryIntegration === false ? 'indeterminate' : militaryIntegration === true ? 'met' : 'indeterminate', 'design.military_integration', 'Advocate preserves the candidate whenever integration evidence is absent.', usmlCitation)],
      judge: [observation('xi-component', 'Article is a covered military-electronics component', usmlJudge, 'design.military_integration', usmlJudge === 'not_met' ? 'The synthetic declaration says the carrier was not designed or integrated for a military article.' : 'The record does not safely close this element negative.', usmlJudge === 'indeterminate' ? null : usmlCitation)],
      challenge: usmlJudge === 'met' ? { text: 'A generic carrier may have a civil catalogue analogue.', resolution: catalogEquivalent === true ? 'sustained' : 'rejected' } : null,
    },
    {
      candidateId: 'cand:2:ITAR-SD',
      provision: '22 CFR 120.41',
      stage: 'specially_designed_itar',
      whyConsidered: 'A separately recorded specially-designed read prevents an enumerated near miss from silently clearing the USML step.',
      advocate: [observation('itar-purpose', 'Development history indicates a predominant military purpose', predominantMilitary === false ? 'indeterminate' : predominantMilitary === true ? 'met' : 'indeterminate', 'design.predominantly_military', 'Advocate cannot record not_met; an explicit negative remains open for the judge.', itarSdCitation)],
      judge: [observation('itar-purpose', 'Development history indicates a predominant military purpose', itarSdJudge, 'design.predominantly_military', itarSdJudge === 'not_met' ? 'Synthetic design history records no predominant military purpose.' : 'Purpose evidence remains open or affirmative.', itarSdJudge === 'indeterminate' ? null : itarSdCitation)],
      challenge: null,
    },
    {
      candidateId: 'cand:3:3A611-g',
      provision: '3A611.g',
      stage: 'six_hundred_series',
      whyConsidered: 'The nearest 600-series electronics candidate is walked only after the USML step closes negative.',
      advocate: [observation('series-purpose', 'Equipment is for a military item', predominantMilitary === false ? 'indeterminate' : predominantMilitary === true ? 'met' : 'indeterminate', 'design.predominantly_military', 'Advocate records the strongest plausible reading.', seriesCitation)],
      judge: [observation('series-purpose', 'Equipment is for a military item', seriesJudge, 'design.predominantly_military', seriesJudge === 'not_met' ? 'The synthetic design-history fact closes the military-purpose element negative.' : 'The military-purpose element is open or supported.', seriesJudge === 'indeterminate' ? null : seriesCitation)],
      challenge: null,
    },
    {
      candidateId: 'cand:4:EAR-SD',
      provision: '15 CFR 772.1 specially designed',
      stage: 'specially_designed_ear',
      whyConsidered: 'The release analysis is kept separate from the 600-series enumerated read.',
      advocate: [observation('ear-release', 'No qualifying catalogue-equivalent release is established', catalogEquivalent === true ? 'indeterminate' : catalogEquivalent === false ? 'met' : 'indeterminate', 'design.catalog_equivalent', 'Advocate preserves the specially-designed path unless release evidence is established.', earSdCitation)],
      judge: [observation('ear-release', 'No qualifying catalogue-equivalent release is established', releaseJudge, 'design.catalog_equivalent', releaseJudge === 'not_met' ? 'The fixture provides a synthetic catalogue-equivalence record for this demonstration.' : 'Release evidence is absent or does not establish equivalence.', releaseJudge === 'indeterminate' ? null : earSdCitation)],
      challenge: null,
    },
    {
      candidateId: 'cand:5:9A991-d',
      provision: '9A991.d',
      stage: 'other_ccl',
      whyConsidered: 'A deliberately broad civil-aircraft near miss demonstrates one possible specific CCL walk before residual handling.',
      advocate: [observation('propulsion', 'Item is an aircraft propulsion engine or related component', aircraftPropulsion === false ? 'indeterminate' : aircraftPropulsion === true ? 'met' : 'indeterminate', 'item.aircraft_propulsion', 'Advocate raises the closest civil-aircraft candidate.', otherCclCitation)],
      judge: [observation('propulsion', 'Item is an aircraft propulsion engine or related component', propulsionJudge, 'item.aircraft_propulsion', propulsionJudge === 'not_met' ? 'The fixture expressly identifies a non-propulsion electronics carrier.' : 'Propulsion identity is open or affirmative.', propulsionJudge === 'indeterminate' ? null : otherCclCitation)],
      challenge: null,
    },
    {
      candidateId: 'cand:6:EAR99',
      provision: 'EAR99',
      stage: 'residual',
      whyConsidered: 'Residual floor seated by code after USML closes negative and no valid specific CCL candidate remains supported or open.',
      advocate: [],
      judge: [],
      challenge: null,
    },
  ];
}

export const WORKSPACE_SCENARIOS: readonly WorkspaceScenario[] = [
  {
    id: 'open-evidence',
    name: 'Open design history',
    description: 'The synthetic carrier is described, but military-design and catalogue-equivalence evidence is intentionally missing.',
    facts: {
      'item.description': 'Synthetic Kestrel flight-controller carrier assembly',
      'item.aircraft_propulsion': false,
      'design.military_integration': 'unknown',
      'design.predominantly_military': 'unknown',
      'design.catalog_equivalent': 'unknown',
    },
    candidates: [],
  },
  {
    id: 'commercial-record',
    name: 'Commercial design record',
    description: 'Synthetic records state civil development, no military integration, a catalogue equivalent, and no propulsion function.',
    facts: {
      'item.description': 'Synthetic Kestrel civil flight-controller carrier assembly',
      'item.aircraft_propulsion': false,
      'design.military_integration': false,
      'design.predominantly_military': false,
      'design.catalog_equivalent': true,
    },
    candidates: [],
  },
  {
    id: 'no-valid-ccl',
    name: 'No valid specific CCL candidates',
    description: 'Synthetic records close USML negative; the specific CCL proposal is empty or invalid, so the ordered route intentionally falls through to EAR99.',
    facts: {
      'item.description': 'Synthetic commercial electronics carrier with no valid specific CCL proposal',
      'item.aircraft_propulsion': false,
      'design.military_integration': false,
      'design.predominantly_military': false,
      'design.catalog_equivalent': true,
    },
    candidates: [],
    specificCclMode: 'no_valid_candidates',
  },
  {
    id: 'military-record',
    name: 'Military integration record',
    description: 'Synthetic design records affirm integration into a military electronics article; later CCL stages must remain unreachable.',
    facts: {
      'item.description': 'Synthetic Kestrel mission-computer carrier assembly',
      'item.aircraft_propulsion': false,
      'design.military_integration': true,
      'design.predominantly_military': true,
      'design.catalog_equivalent': false,
    },
    candidates: [],
  },
] as const;

function hasVerifiedCitation(row: ElementObservation): boolean {
  return Boolean(row.citation?.verified && row.citation.quote.trim() && row.citation.unitKey.trim());
}

export function reconcileCandidate(input: CandidateInput): ReconciledCandidate {
  if (input.stage === 'residual') {
    return { ...input, disposition: 'not_reached', observations: [], reconciliationNotes: [] };
  }

  const notes: string[] = [];
  const judgeById = new Map(input.judge.map((row) => [row.elementId, row]));
  const observations = [...input.judge];

  for (const advocated of input.advocate) {
    if (advocated.disposition === 'not_met') {
      notes.push(`Advocate observation ${advocated.elementId} could not record not_met; treated as indeterminate.`);
    }
    if (advocated.disposition === 'indeterminate' && !judgeById.has(advocated.elementId)) {
      observations.push({ ...advocated, citation: null });
      notes.push(`Open advocate observation ${advocated.elementId} was not answered by the judge and remains indeterminate.`);
    }
  }

  const citedFailure = observations.some((row) => row.disposition === 'not_met' && hasVerifiedCitation(row));
  const uncitedFailure = observations.some((row) => row.disposition === 'not_met' && !hasVerifiedCitation(row));
  const allMet = observations.length > 0 && observations.every((row) => row.disposition === 'met');
  const sustained = input.challenge?.resolution === 'sustained';

  if (uncitedFailure) notes.push('An uncited failed element cannot knock out a candidate.');
  if (sustained) notes.push('A sustained challenge prevents a supported disposition.');

  const disposition: CandidateDisposition = citedFailure
    ? 'knocked_out'
    : allMet && !sustained
      ? 'supported'
      : 'undetermined';

  return { ...input, disposition, observations, reconciliationNotes: notes };
}

function stageCandidates(candidates: ReconciledCandidate[], stage: Stage): ReconciledCandidate[] {
  return candidates.filter((candidate) => candidate.stage === stage);
}

function decide(candidates: ReconciledCandidate[]): { state: 'supported' | 'undetermined' | 'negative' | 'empty'; rows: ReconciledCandidate[] } {
  if (!candidates.length) return { state: 'empty', rows: [] };
  const supported = candidates.filter((candidate) => candidate.disposition === 'supported');
  if (supported.length) return { state: 'supported', rows: supported };
  const open = candidates.filter((candidate) => candidate.disposition === 'undetermined');
  if (open.length) return { state: 'undetermined', rows: open };
  return { state: 'negative', rows: [] };
}

function rankQuestions(candidates: ReconciledCandidate[], reached: Set<Stage>): EvidenceQuestion[] {
  const questions: EvidenceQuestion[] = [];
  for (const candidate of candidates) {
    if (!reached.has(candidate.stage) || candidate.disposition !== 'undetermined') continue;
    for (const row of candidate.observations) {
      if (row.disposition !== 'indeterminate') continue;
      const factPath = row.factPaths[0] ?? 'unmapped.fact';
      questions.push({
        id: `${candidate.candidateId}:${row.elementId}`,
        rank: 0,
        impact: candidate.stage.startsWith('usml') || candidate.stage === 'specially_designed_itar' ? 'route-blocking' : 'classification-blocking',
        candidateId: candidate.candidateId,
        provision: candidate.provision,
        factPath,
        question: questionForFact(factPath),
        resolves: `Closes ${candidate.provision} element “${row.label}” as met or not met with reviewable evidence.`,
      });
    }
  }
  return questions
    .sort((a, b) => (a.impact === b.impact ? a.provision.localeCompare(b.provision) : a.impact === 'route-blocking' ? -1 : 1))
    .map((question, index) => ({ ...question, rank: index + 1 }));
}

function questionForFact(path: string): string {
  const questions: Record<string, string> = {
    'design.military_integration': 'What article or platform was this item designed or modified to integrate with, and where is that requirement recorded?',
    'design.predominantly_military': 'What does the dated development record show about the item’s original and predominant design purpose?',
    'design.catalog_equivalent': 'Is there a contemporaneous civil catalogue item with the same function and performance, supported by revision-matched records?',
    'item.aircraft_propulsion': 'Does the item perform aircraft propulsion or serve as a propulsion-engine part or component?',
  };
  return questions[path] ?? `What reviewable evidence establishes ${path}?`;
}

export function runClassificationWorkspace(scenario: WorkspaceScenario): WorkspaceResult {
  const proposedInputs = scenario.candidates.length ? scenario.candidates : buildCandidates(scenario.facts);
  const inputs = scenario.specificCclMode === 'no_valid_candidates'
    ? proposedInputs.filter((candidate) => candidate.stage === 'usml_enumerated' || candidate.stage === 'specially_designed_itar' || candidate.stage === 'residual')
    : proposedInputs;
  const reconciled = inputs.map(reconcileCandidate);
  const reached = new Set<Stage>();
  const routeBasis: string[] = [];
  let route: JurisdictionRoute = 'UNDETERMINED';
  let classification: string[] = [];
  let routeDisposition: WorkspaceResult['routeDisposition'] = 'undetermined';
  let openCandidates: string[] = [];

  reached.add('usml_enumerated');
  reached.add('specially_designed_itar');
  const usml = reconciled.filter((candidate) => candidate.stage === 'usml_enumerated' || candidate.stage === 'specially_designed_itar');
  const usmlDecision = decide(usml);

  if (usmlDecision.state === 'supported') {
    route = 'ITAR';
    classification = usmlDecision.rows.map((candidate) => candidate.provision);
    routeDisposition = 'supported';
    routeBasis.push(`USML supported in the synthetic record: ${classification.join(', ')}. CCL stages are not reached.`);
  } else if (usmlDecision.state === 'undetermined' || usmlDecision.state === 'empty') {
    openCandidates = usmlDecision.rows.map((candidate) => candidate.provision);
    routeBasis.push('USML remains open on the recorded evidence. The route cannot clear into the CCL by silence.');
  } else {
    routeBasis.push('Every surfaced USML candidate is knocked out on a cited failed element; the CCL route is reached.');
    for (const stage of ['six_hundred_series', 'specially_designed_ear', 'other_ccl'] as const) {
      reached.add(stage);
      const stageDecision = decide(stageCandidates(reconciled, stage));
      if (stageDecision.state === 'supported') {
        route = 'EAR';
        classification = stageDecision.rows.map((candidate) => candidate.provision);
        routeDisposition = 'supported';
        routeBasis.push(`${stage}: ${classification.join(', ')} is supported in the synthetic record; later stages are not reached.`);
        break;
      }
      if (stageDecision.state === 'undetermined') {
        route = 'EAR';
        openCandidates = stageDecision.rows.map((candidate) => candidate.provision);
        routeBasis.push(`${stage}: EAR jurisdiction is reached, but the specific entry remains open.`);
        break;
      }
      if (stageDecision.state === 'empty') {
        routeBasis.push(`${stage}: no valid specific candidate surfaced; ordered review continues to the next stage.`);
        continue;
      }
      routeBasis.push(`${stage}: every surfaced candidate is knocked out on a cited failed element.`);
    }
    if (!classification.length && !openCandidates.length) {
      reached.add('residual');
      route = 'EAR99';
      classification = ['EAR99'];
      routeDisposition = 'residual';
      routeBasis.push('EAR99 is the intentional residual after USML closes negative and the ordered CCL stages end with no supported or open valid candidate, including when no valid specific candidate surfaced.');
    }
  }

  const candidates = reconciled.map((candidate) => {
    if (!reached.has(candidate.stage)) return { ...candidate, disposition: 'not_reached' as const };
    if (candidate.stage === 'residual' && reached.has('residual')) return { ...candidate, disposition: 'supported' as const };
    return candidate;
  });
  const questions = rankQuestions(candidates, reached);
  const stages: StageResult[] = STAGE_ORDER.map((stage) => {
    if (!reached.has(stage)) return { stage, state: 'not_reached', summary: 'Blocked by the ordered route; no conclusion is computed here.' };
    const rows = stageCandidates(candidates, stage);
    const active = rows.some((candidate) => candidate.disposition === 'supported' || candidate.disposition === 'undetermined')
      || (stage === 'residual' && route === 'EAR99');
    return {
      stage,
      state: active ? 'active' : 'complete',
      summary: rows.length ? rows.map((candidate) => `${candidate.provision}: ${candidate.disposition}`).join(' · ') : 'No surfaced candidate in this stage.',
    };
  });

  return {
    scenarioId: scenario.id,
    route,
    classification,
    routeDisposition,
    routeBasis,
    openCandidates,
    candidates,
    stages,
    questions,
    claimClass: 'JURISDICTION_SCREENING_SIMULATION',
    claimCeiling: questions.length || route === 'UNDETERMINED' ? 'UNDETERMINED_NO_CLEARANCE' : 'DRAFT_REVIEW_ONLY',
    readiness: questions.length ? 'HOLD_MISSING_EVIDENCE' : 'READY_FOR_COUNSEL_REVIEW',
    coverage: ['USML_ORDER_OF_REVIEW', 'CCL_JURISDICTION_ROUTE'],
    exclusions: [
      'No legal determination, authorization, license decision, or transaction clearance.',
      'No denied-party, end-use, end-user, destination, ownership, de minimis, or foreign-direct-product analysis.',
      'No broad Parts 744 or 746 coverage; those controls are outside this jurisdiction-only fixture.',
      'Synthetic/public demonstration facts only. A qualified reviewer must evaluate real evidence and current law.',
    ],
  };
}

export function getWorkspaceScenario(id: string): WorkspaceScenario {
  return WORKSPACE_SCENARIOS.find((scenario) => scenario.id === id) ?? WORKSPACE_SCENARIOS[0];
}
