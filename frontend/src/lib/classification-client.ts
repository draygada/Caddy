export type ClassificationItemKind = 'commodity' | 'software' | 'technology';
export type ClassificationJurisdiction = 'ITAR' | 'EAR' | 'EAR99' | 'UNDETERMINED';
export type ClassificationStage = 'usml_enumerated' | 'specially_designed_itar' | 'six_hundred_series' | 'specially_designed_ear' | 'other_ccl' | 'residual';

export interface ClassificationRequest {
  description: string;
  facts: Record<string, unknown>;
  item_kind: ClassificationItemKind;
}

export interface ClassificationCitation {
  unit_key: string;
  unit_sha256: string;
  start: number;
  end: number;
  quote: string;
}

export interface ClassificationElement {
  element_id: string;
  unit_key: string;
  disposition: 'met' | 'not_met' | 'indeterminate';
  basis: 'stated' | 'inferred' | 'assumed';
  facts_relied_on: string[];
  citation: ClassificationCitation | null;
}

export interface ClassificationCandidate {
  candidate_id: string;
  provision: string;
  stage: ClassificationStage;
  status: 'supported' | 'knocked_out' | 'undetermined' | 'not_reached';
  origin: 'proposed' | 'floor';
  why_considered: string;
  why_rejected: string | null;
  elements: ClassificationElement[];
  challenge: { text: string; resolution: 'sustained' | 'rejected' } | null;
  reference_notes: string[];
}

export interface ClassificationDetermination {
  schema_version: 'forge-classification.determination/1';
  snapshot_sha256: string;
  pack_sha256: string;
  item: { part_revision_id: string | null; item_kind: ClassificationItemKind };
  determination: {
    jurisdiction: ClassificationJurisdiction;
    classification: string[];
    usml_step: 'supported' | 'negative' | 'undetermined' | 'undemonstrated';
    ccl_step: 'specific_supported' | 'all_knocked_out' | 'undetermined' | 'not_reached';
    basis: string[];
    open_candidates: string[];
  };
  candidates: ClassificationCandidate[];
  provenance: {
    model: string;
    calls: Array<{ stage: string; provision: string | null; prompt_sha256: string; response_sha256: string | null; cost_microusd: number }>;
    budget: { calls_cap: number; calls_used: number; cost_cap_microusd: number; cost_used_microusd: number };
    dropped_candidates: Array<{ provision: string; reason: string }>;
    reference_notes: string[];
  };
}

export type ClassificationClientErrorCode = 'REQUEST_INVALID' | 'POLICY_BLOCKED' | 'SCHEMA_INVALID' | 'BACKEND_UNAVAILABLE';

export class ClassificationClientError extends Error {
  constructor(readonly code: ClassificationClientErrorCode, message: string) {
    super(message);
    this.name = 'ClassificationClientError';
  }
}

const HEX64 = /^[0-9a-f]{64}$/;
const ITEM_KINDS = ['commodity', 'software', 'technology'] as const;
const JURISDICTIONS = ['ITAR', 'EAR', 'EAR99', 'UNDETERMINED'] as const;
const USML_STEPS = ['supported', 'negative', 'undetermined', 'undemonstrated'] as const;
const CCL_STEPS = ['specific_supported', 'all_knocked_out', 'undetermined', 'not_reached'] as const;
const STAGES = ['usml_enumerated', 'specially_designed_itar', 'six_hundred_series', 'specially_designed_ear', 'other_ccl', 'residual'] as const;
const STATUSES = ['supported', 'knocked_out', 'undetermined', 'not_reached'] as const;
const ORIGINS = ['proposed', 'floor'] as const;
const DISPOSITIONS = ['met', 'not_met', 'indeterminate'] as const;
const BASES = ['stated', 'inferred', 'assumed'] as const;
const CLASSIFICATION_ENDPOINT = '/api/classification';
const CLASSIFICATION_BUDGET = {
  calls_cap: 16,
  cost_cap_microusd: 8_000_000,
  estimated_cost_microusd: 250_000,
} as const;

function invalid(path: string): never {
  throw new ClassificationClientError('SCHEMA_INVALID', `Charlie engine returned an invalid forge-classification.determination/1 response at ${path}.`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const expected = new Set(allowed);
  if (Object.keys(value).some((key) => !expected.has(key))) invalid(path);
}

function text(value: unknown, path: string, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && value.length === 0)) invalid(path);
  return value;
}

function optionalText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}

function nonnegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) invalid(path);
  return value as number;
}

function choice<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(path);
  return value as T;
}

function texts(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(path);
  return value.map((item, index) => text(item, `${path}[${index}]`));
}

function digest(value: unknown, path: string): string {
  const result = text(value, path);
  if (!HEX64.test(result)) invalid(path);
  return result;
}

function citation(value: unknown, path: string): ClassificationCitation | null {
  if (value === null) return null;
  const row = object(value, path);
  exactKeys(row, ['unit_key', 'unit_sha256', 'start', 'end', 'quote'], path);
  const start = nonnegativeInteger(row.start, `${path}.start`);
  const end = nonnegativeInteger(row.end, `${path}.end`);
  if (end < start) invalid(`${path}.end`);
  return {
    unit_key: text(row.unit_key, `${path}.unit_key`, true),
    unit_sha256: digest(row.unit_sha256, `${path}.unit_sha256`),
    start,
    end,
    quote: text(row.quote, `${path}.quote`, true),
  };
}

function element(value: unknown, path: string): ClassificationElement {
  const row = object(value, path);
  exactKeys(row, ['element_id', 'unit_key', 'disposition', 'basis', 'facts_relied_on', 'citation'], path);
  return {
    element_id: text(row.element_id, `${path}.element_id`, true),
    unit_key: text(row.unit_key, `${path}.unit_key`, true),
    disposition: choice(row.disposition, DISPOSITIONS, `${path}.disposition`),
    basis: choice(row.basis, BASES, `${path}.basis`),
    facts_relied_on: texts(row.facts_relied_on, `${path}.facts_relied_on`),
    citation: citation(row.citation, `${path}.citation`),
  };
}

function candidate(value: unknown, path: string): ClassificationCandidate {
  const row = object(value, path);
  exactKeys(row, ['candidate_id', 'provision', 'stage', 'status', 'origin', 'why_considered', 'why_rejected', 'elements', 'challenge', 'reference_notes'], path);
  if (!Array.isArray(row.elements)) invalid(`${path}.elements`);
  let challenge: ClassificationCandidate['challenge'] = null;
  if (row.challenge !== null) {
    const raw = object(row.challenge, `${path}.challenge`);
    exactKeys(raw, ['text', 'resolution'], `${path}.challenge`);
    challenge = { text: text(raw.text, `${path}.challenge.text`), resolution: choice(raw.resolution, ['sustained', 'rejected'] as const, `${path}.challenge.resolution`) };
  }
  const result: ClassificationCandidate = {
    candidate_id: text(row.candidate_id, `${path}.candidate_id`, true),
    provision: text(row.provision, `${path}.provision`, true),
    stage: choice(row.stage, STAGES, `${path}.stage`),
    status: choice(row.status, STATUSES, `${path}.status`),
    origin: choice(row.origin, ORIGINS, `${path}.origin`),
    why_considered: text(row.why_considered, `${path}.why_considered`),
    why_rejected: optionalText(row.why_rejected, `${path}.why_rejected`),
    elements: row.elements.map((item, index) => element(item, `${path}.elements[${index}]`)),
    challenge,
    reference_notes: texts(row.reference_notes, `${path}.reference_notes`),
  };
  if (result.status === 'knocked_out' && !result.why_rejected) invalid(`${path}.why_rejected`);
  return result;
}

export function parseClassificationDetermination(value: unknown): ClassificationDetermination {
  const root = object(value, '$');
  exactKeys(root, ['schema_version', 'snapshot_sha256', 'pack_sha256', 'item', 'determination', 'candidates', 'provenance'], '$');
  if (root.schema_version !== 'forge-classification.determination/1') invalid('$.schema_version');
  const item = object(root.item, '$.item');
  const route = object(root.determination, '$.determination');
  const provenance = object(root.provenance, '$.provenance');
  const budget = object(provenance.budget, '$.provenance.budget');
  exactKeys(item, ['part_revision_id', 'item_kind'], '$.item');
  exactKeys(route, ['jurisdiction', 'classification', 'usml_step', 'ccl_step', 'basis', 'open_candidates'], '$.determination');
  exactKeys(provenance, ['model', 'calls', 'budget', 'dropped_candidates', 'reference_notes'], '$.provenance');
  exactKeys(budget, ['calls_cap', 'calls_used', 'cost_cap_microusd', 'cost_used_microusd'], '$.provenance.budget');
  if (!Array.isArray(root.candidates)) invalid('$.candidates');
  if (!Array.isArray(provenance.calls)) invalid('$.provenance.calls');
  if (!Array.isArray(provenance.dropped_candidates)) invalid('$.provenance.dropped_candidates');

  const result: ClassificationDetermination = {
    schema_version: 'forge-classification.determination/1',
    snapshot_sha256: digest(root.snapshot_sha256, '$.snapshot_sha256'),
    pack_sha256: digest(root.pack_sha256, '$.pack_sha256'),
    item: { part_revision_id: optionalText(item.part_revision_id, '$.item.part_revision_id'), item_kind: choice(item.item_kind, ITEM_KINDS, '$.item.item_kind') },
    determination: {
      jurisdiction: choice(route.jurisdiction, JURISDICTIONS, '$.determination.jurisdiction'),
      classification: texts(route.classification, '$.determination.classification'),
      usml_step: choice(route.usml_step, USML_STEPS, '$.determination.usml_step'),
      ccl_step: choice(route.ccl_step, CCL_STEPS, '$.determination.ccl_step'),
      basis: texts(route.basis, '$.determination.basis'),
      open_candidates: texts(route.open_candidates, '$.determination.open_candidates'),
    },
    candidates: root.candidates.map((item, index) => candidate(item, `$.candidates[${index}]`)),
    provenance: {
      model: text(provenance.model, '$.provenance.model'),
      calls: provenance.calls.map((item, index) => {
        const row = object(item, `$.provenance.calls[${index}]`);
        exactKeys(row, ['stage', 'provision', 'prompt_sha256', 'response_sha256', 'cost_microusd'], `$.provenance.calls[${index}]`);
        return {
          stage: text(row.stage, `$.provenance.calls[${index}].stage`),
          provision: optionalText(row.provision, `$.provenance.calls[${index}].provision`),
          prompt_sha256: digest(row.prompt_sha256, `$.provenance.calls[${index}].prompt_sha256`),
          response_sha256: row.response_sha256 === null ? null : digest(row.response_sha256, `$.provenance.calls[${index}].response_sha256`),
          cost_microusd: nonnegativeInteger(row.cost_microusd, `$.provenance.calls[${index}].cost_microusd`),
        };
      }),
      budget: {
        calls_cap: nonnegativeInteger(budget.calls_cap, '$.provenance.budget.calls_cap'),
        calls_used: nonnegativeInteger(budget.calls_used, '$.provenance.budget.calls_used'),
        cost_cap_microusd: nonnegativeInteger(budget.cost_cap_microusd, '$.provenance.budget.cost_cap_microusd'),
        cost_used_microusd: nonnegativeInteger(budget.cost_used_microusd, '$.provenance.budget.cost_used_microusd'),
      },
      dropped_candidates: provenance.dropped_candidates.map((item, index) => {
        const row = object(item, `$.provenance.dropped_candidates[${index}]`);
        exactKeys(row, ['provision', 'reason'], `$.provenance.dropped_candidates[${index}]`);
        return { provision: text(row.provision, `$.provenance.dropped_candidates[${index}].provision`), reason: text(row.reason, `$.provenance.dropped_candidates[${index}].reason`) };
      }),
      reference_notes: texts(provenance.reference_notes, '$.provenance.reference_notes'),
    },
  };

  const decision = result.determination;
  const spent = result.provenance.budget;
  if (spent.calls_used > spent.calls_cap || spent.cost_used_microusd > spent.cost_cap_microusd) invalid('$.provenance.budget');
  if (decision.jurisdiction === 'EAR99' && (decision.usml_step !== 'negative' || decision.ccl_step !== 'all_knocked_out' || decision.classification.join('|') !== 'EAR99')) invalid('$.determination');
  if (decision.jurisdiction === 'ITAR' && (decision.usml_step !== 'supported' || decision.ccl_step !== 'not_reached' || decision.classification.length === 0)) invalid('$.determination');
  if (decision.jurisdiction === 'EAR' && (decision.usml_step !== 'negative' || decision.ccl_step !== 'specific_supported' || decision.classification.length === 0)) invalid('$.determination');
  if (decision.jurisdiction === 'UNDETERMINED') {
    const stoppedAtUsml = ['undetermined', 'undemonstrated'].includes(decision.usml_step) && decision.ccl_step === 'not_reached';
    const stoppedAtCcl = decision.usml_step === 'negative' && decision.ccl_step === 'undetermined';
    if ((!stoppedAtUsml && !stoppedAtCcl) || decision.classification.length > 0) invalid('$.determination');
  }
  return result;
}

function failureDetail(payload: unknown): { code: string; message: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { code: '', message: '' };
  const root = payload as Record<string, unknown>;
  const nested = root.error && typeof root.error === 'object' && !Array.isArray(root.error)
    ? root.error as Record<string, unknown>
    : root.diagnostic && typeof root.diagnostic === 'object' && !Array.isArray(root.diagnostic)
      ? root.diagnostic as Record<string, unknown>
      : root;
  return {
    code: typeof nested.code === 'string' ? nested.code : '',
    message: typeof nested.message === 'string' ? nested.message : typeof root.detail === 'string' ? root.detail : '',
  };
}

export async function evaluateClassification(request: ClassificationRequest, options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<ClassificationDetermination> {
  const description = request.description.trim();
  if (!description) throw new ClassificationClientError('REQUEST_INVALID', 'Enter a product or part description before running Charlie engine.');
  if (!request.facts || typeof request.facts !== 'object' || Array.isArray(request.facts)) throw new ClassificationClientError('REQUEST_INVALID', 'Facts must be a JSON object.');
  if (!ITEM_KINDS.includes(request.item_kind)) throw new ClassificationClientError('REQUEST_INVALID', 'Item kind must be commodity, software, or technology.');

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(CLASSIFICATION_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        product_or_part: description,
        facts: request.facts,
        item_kind: request.item_kind,
        budget: CLASSIFICATION_BUDGET,
      }),
      signal: options.signal,
    });
  } catch (error) {
    throw new ClassificationClientError('BACKEND_UNAVAILABLE', `Charlie engine is unavailable: ${error instanceof Error ? error.message : 'network request failed'}`);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new ClassificationClientError('SCHEMA_INVALID', 'Charlie engine returned a non-JSON response. The last valid result was retained.');
  }
  if (!response.ok) {
    const detail = failureDetail(payload);
    if ([403, 423, 451].includes(response.status) || /POLICY|BLOCK/i.test(detail.code)) {
      throw new ClassificationClientError('POLICY_BLOCKED', detail.message || 'Charlie engine blocked this request under the active policy. No determination was produced.');
    }
    throw new ClassificationClientError('BACKEND_UNAVAILABLE', detail.message || `Charlie engine request failed with HTTP ${response.status}.`);
  }
  return parseClassificationDetermination(payload);
}
