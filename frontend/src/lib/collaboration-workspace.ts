export type ActorKind = 'HUMAN' | 'AGENT' | 'SERVICE';
export type ReviewDecision = 'COMMENT' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
export type AuthorizationStatus =
  | 'REQUESTED'
  | 'AUTHORIZED'
  | 'APPLIED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export interface Actor {
  actorId: string;
  actorKind: ActorKind;
  executionIdentity?: string;
}

export interface ChangeFootprint {
  reads: string[];
  writes: string[];
  impacts: string[];
}

export interface MergeConflict {
  conflictId: string;
  code:
    | 'PRECONDITION_FAILED'
    | 'STALE_BASE_UNANALYZED'
    | 'WRITE_WRITE_CONFLICT'
    | 'READ_WRITE_CONFLICT'
    | 'NONCOMMUTATIVE_DEPENDENCY'
    | 'REPLAY_EVIDENCE_MISSING'
    | 'REPLAY_DIVERGENCE';
  resources: string[];
  evidence: Record<string, unknown>;
}

export interface MergeAssessment {
  allowed: boolean;
  requiresRebase: boolean;
  conflicts: MergeConflict[];
}

export interface CollaborationEvent {
  protocolVersion: 'caddydaddy.collaboration-event/1';
  eventId: string;
  eventHash: string;
  sequence: number;
  previousEventHash: string | null;
  eventType:
    | 'BRANCH_CREATED'
    | 'REVISION_COMMITTED'
    | 'REVIEW_REQUESTED'
    | 'PROPOSAL_REVIEW_RECORDED'
    | 'AUTHORIZATION_LIFECYCLE_RECORDED'
    | 'MERGE_APPLIED';
  aggregateType: 'BRANCH' | 'REVISION' | 'REVIEW' | 'AUTHORIZATION' | 'MERGE';
  aggregateId: string;
  occurredAt: string;
  provenance: {
    actorId: string;
    actorKind: ActorKind;
    executionIdentity?: string;
    sourceRef: string;
  };
  payload: Record<string, unknown>;
}

export interface BranchState {
  name: string;
  headRevisionId: string;
  fromBranch: string | null;
  baseRevisionId: string;
}

export interface RevisionState {
  revisionId: string;
  branch: string;
  parentRevisionId: string | null;
  summary: string;
  footprint: ChangeFootprint;
  replayFingerprint: string;
}

export interface ReviewEntry {
  eventId: string;
  decision: ReviewDecision;
  actorId: string;
  actorKind: ActorKind;
  bindingHumanDecision: boolean;
  comment: string;
  occurredAt: string;
}

export interface ReviewState {
  reviewId: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  reviewedRevisionId: string;
  expectedTargetRevisionId: string;
  assessment: MergeAssessment;
  entries: ReviewEntry[];
  bindingDecision: Exclude<ReviewDecision, 'COMMENT'> | null;
  mergedRevisionId: string | null;
}

export interface AuthorizationState {
  authorizationId: string;
  status: AuthorizationStatus;
  subject: { kind: string; id: string };
  evidenceRefs: string[];
}

export interface MergeState {
  mergeId: string;
  reviewId: string;
  sourceBranch: string;
  targetBranch: string;
  revisionId: string;
  authorizationId: string;
  evidenceRefs: string[];
}

export type MergeEligibility =
  | { state: 'ELIGIBLE'; eligible: true; reasons: []; mergedRevisionId: null }
  | { state: 'BLOCKED'; eligible: false; reasons: string[]; mergedRevisionId: null }
  | { state: 'MERGED'; eligible: false; reasons: []; mergedRevisionId: string };

export interface CollaborationProjection {
  branches: Record<string, BranchState>;
  revisions: Record<string, RevisionState>;
  reviews: Record<string, ReviewState>;
  authorizations: Record<string, AuthorizationState>;
  merges: Record<string, MergeState>;
}

export interface AuditEvidenceRow {
  sequence: number;
  eventId: string;
  eventHash: string;
  previousEventHash: string | null;
  eventType: CollaborationEvent['eventType'];
  aggregateId: string;
  actor: string;
  occurredAt: string;
  summary: string;
  evidenceRefs: string[];
}

export class CollaborationWorkspaceError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(`${code}: ${message}`);
    this.name = 'CollaborationWorkspaceError';
    this.code = code;
    this.details = details;
  }
}

type EventSpec = Omit<CollaborationEvent, 'protocolVersion' | 'eventId' | 'eventHash' | 'sequence' | 'previousEventHash'>;

const EMPTY_FOOTPRINT: ChangeFootprint = { reads: [], writes: [], impacts: [] };
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const TERMINAL_REVIEW_DECISIONS = new Set<ReviewDecision>(['APPROVE', 'REJECT', 'REQUEST_CHANGES']);
const AUTHORIZATION_TRANSITIONS: Record<string, AuthorizationStatus[]> = {
  NONE: ['REQUESTED'],
  REQUESTED: ['AUTHORIZED', 'REJECTED'],
  AUTHORIZED: ['APPLIED', 'REJECTED'],
  APPLIED: ['VERIFIED', 'ROLLED_BACK'],
  VERIFIED: ['ROLLED_BACK'],
  REJECTED: [],
  ROLLED_BACK: [],
};

function invariant(condition: unknown, code: string, message: string, details: Record<string, unknown> = {}): asserts condition {
  if (!condition) throw new CollaborationWorkspaceError(code, message, details);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'CANONICAL_VALUE_INVALID', 'event values must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  invariant(typeof value === 'object' && value !== undefined, 'CANONICAL_VALUE_INVALID', 'event value is not JSON-safe');
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(text: string): string {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = ((bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }
  return state.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeFootprint(value: ChangeFootprint): ChangeFootprint {
  return {
    reads: sortedUnique(value.reads),
    writes: sortedUnique(value.writes),
    impacts: sortedUnique(value.impacts),
  };
}

function makeConflict(code: MergeConflict['code'], resources: string[], evidence: Record<string, unknown>): MergeConflict {
  const orderedResources = sortedUnique(resources);
  return {
    conflictId: `conflict:${sha256(canonicalJson({ code, evidence, resources: orderedResources }))}`,
    code,
    resources: orderedResources,
    evidence: clone(evidence),
  };
}

export function assessChangeFootprints(input: {
  baseRevisionId: string;
  headRevisionId: string;
  proposal: ChangeFootprint;
  upstream?: ChangeFootprint;
  failedPreconditions?: string[];
  replayFingerprints?: string[];
}): MergeAssessment {
  const conflicts: MergeConflict[] = [];
  const proposal = normalizeFootprint(input.proposal);
  const upstream = input.upstream ? normalizeFootprint(input.upstream) : undefined;
  const failed = sortedUnique(input.failedPreconditions ?? []);
  const stale = input.baseRevisionId !== input.headRevisionId;
  const revisionEvidence = { baseRevisionId: input.baseRevisionId, headRevisionId: input.headRevisionId };
  if (failed.length) conflicts.push(makeConflict('PRECONDITION_FAILED', failed, revisionEvidence));
  if (stale && !upstream) {
    conflicts.push(makeConflict('STALE_BASE_UNANALYZED', [input.baseRevisionId, input.headRevisionId], revisionEvidence));
  }
  if (stale && upstream) {
    const proposalWrites = new Set(proposal.writes);
    const proposalReads = new Set(proposal.reads);
    const proposalImpacts = new Set(proposal.impacts);
    const writeWrite = upstream.writes.filter((resource) => proposalWrites.has(resource));
    if (writeWrite.length) conflicts.push(makeConflict('WRITE_WRITE_CONFLICT', writeWrite, revisionEvidence));
    const readWrite = [
      ...upstream.writes.filter((resource) => proposalReads.has(resource)),
      ...upstream.reads.filter((resource) => proposalWrites.has(resource)),
    ];
    if (readWrite.length) conflicts.push(makeConflict('READ_WRITE_CONFLICT', readWrite, revisionEvidence));
    const impacts = upstream.impacts.filter((resource) => proposalImpacts.has(resource));
    if (impacts.length) conflicts.push(makeConflict('NONCOMMUTATIVE_DEPENDENCY', impacts, revisionEvidence));
  }
  const fingerprints = input.replayFingerprints ?? [];
  if (fingerprints.length < 2) {
    conflicts.push(makeConflict('REPLAY_EVIDENCE_MISSING', [], { observations: fingerprints.length }));
  } else if (new Set(fingerprints).size !== 1) {
    conflicts.push(makeConflict('REPLAY_DIVERGENCE', [], { fingerprints: [...fingerprints] }));
  }
  return { allowed: conflicts.length === 0, conflicts, requiresRebase: stale };
}

function asRecord(value: unknown, code = 'EVENT_PAYLOAD_INVALID'): Record<string, unknown> {
  invariant(typeof value === 'object' && value !== null && !Array.isArray(value), code, 'event payload must be an object');
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  invariant(typeof value === 'string' && value.length > 0, 'EVENT_PAYLOAD_INVALID', `${field} must be non-empty text`, { field });
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  invariant(Array.isArray(value) && value.every((item) => typeof item === 'string'), 'EVENT_PAYLOAD_INVALID', `${field} must be text[]`, { field });
  return [...value] as string[];
}

function actorProvenance(actor: Actor, sourceRef: string): CollaborationEvent['provenance'] {
  invariant(actor.actorId.trim().length > 0, 'ACTOR_INVALID', 'actor ID is required');
  invariant(['HUMAN', 'AGENT', 'SERVICE'].includes(actor.actorKind), 'ACTOR_INVALID', 'actor kind is unsupported');
  if (actor.actorKind === 'AGENT') invariant(Boolean(actor.executionIdentity), 'AGENT_IDENTITY_REQUIRED', 'agent execution identity is required');
  return {
    actorId: actor.actorId,
    actorKind: actor.actorKind,
    ...(actor.executionIdentity ? { executionIdentity: actor.executionIdentity } : {}),
    sourceRef,
  };
}

function eventPreimage(event: CollaborationEvent): Omit<CollaborationEvent, 'eventId' | 'eventHash'> {
  const { eventId: _eventId, eventHash: _eventHash, ...preimage } = event;
  return preimage;
}

function validateEvent(event: CollaborationEvent, sequence: number, previousEventHash: string | null): void {
  invariant(event.protocolVersion === 'caddydaddy.collaboration-event/1', 'SCHEMA_UNSUPPORTED', 'event protocol is unsupported');
  invariant(event.sequence === sequence, 'EVENT_SEQUENCE_INVALID', 'event sequence is not contiguous');
  invariant(event.previousEventHash === previousEventHash, 'EVENT_CHAIN_INVALID', 'event predecessor does not match');
  invariant(UTC_TIMESTAMP.test(event.occurredAt), 'TIMESTAMP_INVALID', 'occurredAt must be an explicit UTC timestamp');
  const expectedHash = sha256(canonicalJson(eventPreimage(event)));
  invariant(event.eventHash === expectedHash, 'HASH_MISMATCH', 'event hash does not match its canonical preimage');
  invariant(event.eventId === `event:${expectedHash}`, 'HASH_MISMATCH', 'event ID does not match its hash');
}

function emptyProjection(): CollaborationProjection {
  return { branches: {}, revisions: {}, reviews: {}, authorizations: {}, merges: {} };
}

function applyEvent(projection: CollaborationProjection, event: CollaborationEvent): void {
  const payload = asRecord(event.payload);
  if (event.eventType === 'BRANCH_CREATED') {
    const name = asString(payload.branch, 'branch');
    const revisionId = asString(payload.revisionId, 'revisionId');
    const fromBranch = payload.fromBranch === null ? null : asString(payload.fromBranch, 'fromBranch');
    invariant(!projection.branches[name], 'BRANCH_ALREADY_EXISTS', 'branch already exists', { branch: name });
    if (fromBranch) {
      const parent = projection.branches[fromBranch];
      invariant(parent, 'BRANCH_NOT_FOUND', 'source branch does not exist', { branch: fromBranch });
      invariant(parent.headRevisionId === revisionId, 'STALE_BASE', 'new branch does not match source head');
    } else {
      invariant(!projection.revisions[revisionId], 'REVISION_ALREADY_EXISTS', 'initial revision already exists');
      projection.revisions[revisionId] = {
        revisionId,
        branch: name,
        parentRevisionId: null,
        summary: asString(payload.summary, 'summary'),
        footprint: clone(EMPTY_FOOTPRINT),
        replayFingerprint: asString(payload.replayFingerprint, 'replayFingerprint'),
      };
    }
    projection.branches[name] = { name, headRevisionId: revisionId, fromBranch, baseRevisionId: revisionId };
    return;
  }

  if (event.eventType === 'REVISION_COMMITTED') {
    const branchName = asString(payload.branch, 'branch');
    const branch = projection.branches[branchName];
    const expectedHeadRevisionId = asString(payload.expectedHeadRevisionId, 'expectedHeadRevisionId');
    const revisionId = asString(payload.revisionId, 'revisionId');
    invariant(branch, 'BRANCH_NOT_FOUND', 'branch does not exist', { branch: branchName });
    invariant(branch.headRevisionId === expectedHeadRevisionId, 'STALE_BASE', 'branch head moved before revision commit');
    invariant(!projection.revisions[revisionId], 'REVISION_ALREADY_EXISTS', 'revision ID already exists');
    projection.revisions[revisionId] = {
      revisionId,
      branch: branchName,
      parentRevisionId: expectedHeadRevisionId,
      summary: asString(payload.summary, 'summary'),
      footprint: normalizeFootprint(asRecord(payload.footprint) as unknown as ChangeFootprint),
      replayFingerprint: asString(payload.replayFingerprint, 'replayFingerprint'),
    };
    branch.headRevisionId = revisionId;
    return;
  }

  if (event.eventType === 'REVIEW_REQUESTED') {
    const reviewId = asString(payload.reviewId, 'reviewId');
    const sourceBranch = asString(payload.sourceBranch, 'sourceBranch');
    const targetBranch = asString(payload.targetBranch, 'targetBranch');
    const reviewedRevisionId = asString(payload.reviewedRevisionId, 'reviewedRevisionId');
    const expectedTargetRevisionId = asString(payload.expectedTargetRevisionId, 'expectedTargetRevisionId');
    invariant(!projection.reviews[reviewId], 'REVIEW_ALREADY_EXISTS', 'review already exists');
    invariant(projection.branches[sourceBranch]?.headRevisionId === reviewedRevisionId, 'STALE_SOURCE', 'review source head moved');
    invariant(projection.branches[targetBranch]?.headRevisionId === expectedTargetRevisionId, 'STALE_TARGET', 'review target head moved');
    projection.reviews[reviewId] = {
      reviewId,
      title: asString(payload.title, 'title'),
      sourceBranch,
      targetBranch,
      reviewedRevisionId,
      expectedTargetRevisionId,
      assessment: clone(asRecord(payload.assessment) as unknown as MergeAssessment),
      entries: [],
      bindingDecision: null,
      mergedRevisionId: null,
    };
    return;
  }

  if (event.eventType === 'PROPOSAL_REVIEW_RECORDED') {
    const reviewId = asString(payload.reviewId, 'reviewId');
    const review = projection.reviews[reviewId];
    const decision = asString(payload.decision, 'decision') as ReviewDecision;
    invariant(review, 'REVIEW_NOT_FOUND', 'review does not exist');
    invariant(['COMMENT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(decision), 'REVIEW_DECISION_INVALID', 'review decision is unsupported');
    const binding = event.provenance.actorKind === 'HUMAN' && TERMINAL_REVIEW_DECISIONS.has(decision);
    invariant(payload.bindingHumanDecision === binding, 'REVIEW_BINDING_INVALID', 'review binding marker does not match actor and decision');
    if (binding) invariant(review.bindingDecision === null, 'REVIEW_TERMINAL', 'a binding review decision is already recorded');
    const entry: ReviewEntry = {
      eventId: event.eventId,
      decision,
      actorId: event.provenance.actorId,
      actorKind: event.provenance.actorKind,
      bindingHumanDecision: binding,
      comment: typeof payload.comment === 'string' ? payload.comment : '',
      occurredAt: event.occurredAt,
    };
    review.entries.push(entry);
    if (binding) review.bindingDecision = decision as Exclude<ReviewDecision, 'COMMENT'>;
    return;
  }

  if (event.eventType === 'AUTHORIZATION_LIFECYCLE_RECORDED') {
    const authorizationId = asString(payload.authorizationId, 'authorizationId');
    const status = asString(payload.status, 'status') as AuthorizationStatus;
    const subjectPayload = asRecord(payload.subject);
    const subject = { kind: asString(subjectPayload.kind, 'subject.kind'), id: asString(subjectPayload.id, 'subject.id') };
    const current = projection.authorizations[authorizationId];
    const allowed = AUTHORIZATION_TRANSITIONS[current?.status ?? 'NONE'] ?? [];
    invariant(allowed.includes(status), 'AUTHORIZATION_TRANSITION_INVALID', 'authorization lifecycle transition is not permitted', {
      current: current?.status ?? null,
      requested: status,
    });
    if (['AUTHORIZED', 'REJECTED', 'ROLLED_BACK'].includes(status)) {
      invariant(event.provenance.actorKind === 'HUMAN', 'HUMAN_AUTHORIZATION_REQUIRED', `${status.toLowerCase()} requires a human actor`);
    }
    if (current) invariant(current.subject.kind === subject.kind && current.subject.id === subject.id, 'AUTHORIZATION_SUBJECT_CHANGED', 'authorization subject cannot change');
    const evidenceRefs = asStringArray(payload.evidenceRefs, 'evidenceRefs');
    if (status === 'VERIFIED') invariant(evidenceRefs.length > 0, 'VERIFICATION_EVIDENCE_MISSING', 'verification requires evidence references');
    projection.authorizations[authorizationId] = { authorizationId, status, subject, evidenceRefs };
    return;
  }

  if (event.eventType === 'MERGE_APPLIED') {
    const mergeId = asString(payload.mergeId, 'mergeId');
    const reviewId = asString(payload.reviewId, 'reviewId');
    const authorizationId = asString(payload.authorizationId, 'authorizationId');
    const review = projection.reviews[reviewId];
    const authorization = projection.authorizations[authorizationId];
    invariant(!projection.merges[mergeId], 'MERGE_ALREADY_EXISTS', 'merge ID already exists');
    invariant(review?.bindingDecision === 'APPROVE', 'REVIEW_NOT_APPROVED', 'merge requires a binding human approval');
    invariant(review.assessment.allowed, 'MERGE_CONFLICT', 'review carries unresolved merge conflicts');
    invariant(authorization?.status === 'AUTHORIZED', 'AUTHORIZATION_NOT_GRANTED', 'merge authorization is not active');
    invariant(authorization.subject.kind === 'MERGE' && authorization.subject.id === reviewId, 'AUTHORIZATION_SUBJECT_MISMATCH', 'authorization does not cover this review');
    invariant(projection.branches[review.sourceBranch]?.headRevisionId === review.reviewedRevisionId, 'STALE_SOURCE', 'source branch moved after review');
    invariant(projection.branches[review.targetBranch]?.headRevisionId === review.expectedTargetRevisionId, 'STALE_TARGET', 'target branch moved after review');
    const revisionId = asString(payload.revisionId, 'revisionId');
    const evidenceRefs = asStringArray(payload.evidenceRefs, 'evidenceRefs');
    projection.revisions[revisionId] = {
      revisionId,
      branch: review.targetBranch,
      parentRevisionId: review.expectedTargetRevisionId,
      summary: `Merge ${review.sourceBranch}: ${review.title}`,
      footprint: clone(projection.revisions[review.reviewedRevisionId]?.footprint ?? EMPTY_FOOTPRINT),
      replayFingerprint: asString(payload.replayFingerprint, 'replayFingerprint'),
    };
    projection.branches[review.targetBranch].headRevisionId = revisionId;
    review.mergedRevisionId = revisionId;
    projection.merges[mergeId] = {
      mergeId,
      reviewId,
      sourceBranch: review.sourceBranch,
      targetBranch: review.targetBranch,
      revisionId,
      authorizationId,
      evidenceRefs,
    };
  }
}

export function replayCollaboration(events: readonly CollaborationEvent[]): CollaborationProjection {
  const projection = emptyProjection();
  let previous: string | null = null;
  events.forEach((sourceEvent, sequence) => {
    const event = clone(sourceEvent);
    validateEvent(event, sequence, previous);
    applyEvent(projection, event);
    previous = event.eventHash;
  });
  return projection;
}

export class CollaborationWorkspaceModel {
  private eventLog: CollaborationEvent[];
  private readonly now: () => string;

  constructor(events: readonly CollaborationEvent[] = [], now: () => string = () => new Date().toISOString()) {
    replayCollaboration(events);
    this.eventLog = clone([...events]);
    this.now = now;
  }

  get events(): CollaborationEvent[] {
    return clone(this.eventLog);
  }

  project(): CollaborationProjection {
    return replayCollaboration(this.eventLog);
  }

  private appendMany(specs: EventSpec[]): CollaborationEvent[] {
    const staged = clone(this.eventLog);
    const appended: CollaborationEvent[] = [];
    for (const spec of specs) {
      const sequence = staged.length;
      const previousEventHash = staged.at(-1)?.eventHash ?? null;
      const preimage = {
        protocolVersion: 'caddydaddy.collaboration-event/1' as const,
        sequence,
        previousEventHash,
        ...clone(spec),
      };
      const eventHash = sha256(canonicalJson(preimage));
      const event: CollaborationEvent = { ...preimage, eventId: `event:${eventHash}`, eventHash };
      staged.push(event);
      appended.push(event);
    }
    replayCollaboration(staged);
    this.eventLog = staged;
    return clone(appended);
  }

  createBranch(input: {
    branch: string;
    revisionId: string;
    actor: Actor;
    fromBranch?: string;
    summary?: string;
    replayFingerprint?: string;
    occurredAt?: string;
  }): CollaborationEvent {
    const projection = this.project();
    invariant(input.branch.trim().length > 0, 'BRANCH_INVALID', 'branch name is required');
    invariant(!projection.branches[input.branch], 'BRANCH_ALREADY_EXISTS', 'branch already exists');
    if (input.fromBranch) {
      invariant(projection.branches[input.fromBranch], 'BRANCH_NOT_FOUND', 'source branch does not exist');
      invariant(projection.branches[input.fromBranch].headRevisionId === input.revisionId, 'STALE_BASE', 'new branch revision must equal source head');
    }
    return this.appendMany([{
      eventType: 'BRANCH_CREATED',
      aggregateType: 'BRANCH',
      aggregateId: `branch:${input.branch}`,
      occurredAt: input.occurredAt ?? this.now(),
      provenance: actorProvenance(input.actor, 'browser:collaboration-workspace'),
      payload: {
        branch: input.branch,
        revisionId: input.revisionId,
        fromBranch: input.fromBranch ?? null,
        summary: input.summary ?? `Create ${input.branch}`,
        replayFingerprint: input.replayFingerprint ?? `replay:${input.revisionId}`,
      },
    }])[0];
  }

  commitRevision(input: {
    branch: string;
    expectedHeadRevisionId: string;
    revisionId: string;
    summary: string;
    footprint: ChangeFootprint;
    replayFingerprint: string;
    actor: Actor;
    occurredAt?: string;
  }): CollaborationEvent {
    return this.appendMany([{
      eventType: 'REVISION_COMMITTED',
      aggregateType: 'REVISION',
      aggregateId: input.revisionId,
      occurredAt: input.occurredAt ?? this.now(),
      provenance: actorProvenance(input.actor, 'browser:revision-commit'),
      payload: {
        branch: input.branch,
        expectedHeadRevisionId: input.expectedHeadRevisionId,
        revisionId: input.revisionId,
        summary: input.summary,
        footprint: normalizeFootprint(input.footprint),
        replayFingerprint: input.replayFingerprint,
      },
    }])[0];
  }

  requestReview(input: {
    reviewId: string;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    actor: Actor;
    upstream?: ChangeFootprint;
    failedPreconditions?: string[];
    replayFingerprints: string[];
    occurredAt?: string;
  }): CollaborationEvent {
    const projection = this.project();
    const source = projection.branches[input.sourceBranch];
    const target = projection.branches[input.targetBranch];
    invariant(source && target, 'BRANCH_NOT_FOUND', 'review source and target branches must exist');
    invariant(input.sourceBranch !== input.targetBranch, 'REVIEW_BRANCH_INVALID', 'source and target branches must differ');
    const revision = projection.revisions[source.headRevisionId];
    const assessment = assessChangeFootprints({
      baseRevisionId: source.baseRevisionId,
      headRevisionId: target.headRevisionId,
      proposal: revision?.footprint ?? EMPTY_FOOTPRINT,
      ...(input.upstream ? { upstream: input.upstream } : {}),
      failedPreconditions: input.failedPreconditions,
      replayFingerprints: input.replayFingerprints,
    });
    return this.appendMany([{
      eventType: 'REVIEW_REQUESTED',
      aggregateType: 'REVIEW',
      aggregateId: input.reviewId,
      occurredAt: input.occurredAt ?? this.now(),
      provenance: actorProvenance(input.actor, 'browser:review-request'),
      payload: {
        reviewId: input.reviewId,
        title: input.title,
        sourceBranch: input.sourceBranch,
        targetBranch: input.targetBranch,
        reviewedRevisionId: source.headRevisionId,
        expectedTargetRevisionId: target.headRevisionId,
        assessment,
      },
    }])[0];
  }

  recordReview(input: {
    reviewId: string;
    decision: ReviewDecision;
    actor: Actor;
    comment?: string;
    occurredAt?: string;
  }): CollaborationEvent {
    const projection = this.project();
    const review = projection.reviews[input.reviewId];
    invariant(review, 'REVIEW_NOT_FOUND', 'review does not exist');
    const binding = input.actor.actorKind === 'HUMAN' && TERMINAL_REVIEW_DECISIONS.has(input.decision);
    if (binding) invariant(review.bindingDecision === null, 'REVIEW_TERMINAL', 'a binding decision is already recorded');
    if (input.decision === 'COMMENT') invariant(Boolean(input.comment?.trim()), 'REVIEW_COMMENT_REQUIRED', 'comment text is required');
    return this.appendMany([{
      eventType: 'PROPOSAL_REVIEW_RECORDED',
      aggregateType: 'REVIEW',
      aggregateId: input.reviewId,
      occurredAt: input.occurredAt ?? this.now(),
      provenance: actorProvenance(input.actor, 'browser:review-ledger'),
      payload: {
        reviewId: input.reviewId,
        reviewedRevisionId: review.reviewedRevisionId,
        decision: input.decision,
        bindingHumanDecision: binding,
        comment: input.comment ?? '',
      },
    }])[0];
  }

  requestAuthorization(input: {
    authorizationId: string;
    reviewId: string;
    actor: Actor;
    occurredAt?: string;
  }): CollaborationEvent {
    invariant(this.project().reviews[input.reviewId], 'REVIEW_NOT_FOUND', 'review does not exist');
    return this.authorizationEvent(input.authorizationId, 'REQUESTED', { kind: 'MERGE', id: input.reviewId }, input.actor, [], input.occurredAt);
  }

  transitionAuthorization(input: {
    authorizationId: string;
    status: Exclude<AuthorizationStatus, 'REQUESTED' | 'APPLIED'>;
    actor: Actor;
    evidenceRefs?: string[];
    occurredAt?: string;
  }): CollaborationEvent {
    const current = this.project().authorizations[input.authorizationId];
    invariant(current, 'AUTHORIZATION_NOT_FOUND', 'authorization does not exist');
    return this.authorizationEvent(input.authorizationId, input.status, current.subject, input.actor, input.evidenceRefs ?? [], input.occurredAt);
  }

  private authorizationSpec(
    authorizationId: string,
    status: AuthorizationStatus,
    subject: { kind: string; id: string },
    actor: Actor,
    evidenceRefs: string[],
    occurredAt?: string,
  ): EventSpec {
    return {
      eventType: 'AUTHORIZATION_LIFECYCLE_RECORDED',
      aggregateType: 'AUTHORIZATION',
      aggregateId: authorizationId,
      occurredAt: occurredAt ?? this.now(),
      provenance: actorProvenance(actor, 'browser:authorization-ledger'),
      payload: { authorizationId, status, subject, evidenceRefs },
    };
  }

  private authorizationEvent(
    authorizationId: string,
    status: AuthorizationStatus,
    subject: { kind: string; id: string },
    actor: Actor,
    evidenceRefs: string[],
    occurredAt?: string,
  ): CollaborationEvent {
    return this.appendMany([this.authorizationSpec(authorizationId, status, subject, actor, evidenceRefs, occurredAt)])[0];
  }

  mergeEligibility(reviewId: string, authorizationId: string): MergeEligibility {
    const projection = this.project();
    const review = projection.reviews[reviewId];
    if (!review) return { state: 'BLOCKED', eligible: false, reasons: ['REVIEW_NOT_FOUND'], mergedRevisionId: null };
    if (review.mergedRevisionId) {
      return { state: 'MERGED', eligible: false, reasons: [], mergedRevisionId: review.mergedRevisionId };
    }

    const authorization = projection.authorizations[authorizationId];
    const reasons: string[] = [];
    if (review.bindingDecision !== 'APPROVE') reasons.push('REVIEW_NOT_APPROVED');
    if (!review.assessment.allowed) reasons.push(...review.assessment.conflicts.map((conflict) => conflict.code));
    if (projection.branches[review.sourceBranch]?.headRevisionId !== review.reviewedRevisionId) reasons.push('STALE_SOURCE');
    if (projection.branches[review.targetBranch]?.headRevisionId !== review.expectedTargetRevisionId) reasons.push('STALE_TARGET');
    if (authorization?.status !== 'AUTHORIZED') reasons.push('AUTHORIZATION_NOT_GRANTED');
    if (authorization && (authorization.subject.kind !== 'MERGE' || authorization.subject.id !== reviewId)) reasons.push('AUTHORIZATION_SUBJECT_MISMATCH');
    if (reasons.length > 0) return { state: 'BLOCKED', eligible: false, reasons: sortedUnique(reasons), mergedRevisionId: null };
    return { state: 'ELIGIBLE', eligible: true, reasons: [], mergedRevisionId: null };
  }

  merge(input: {
    mergeId: string;
    reviewId: string;
    authorizationId: string;
    actor: Actor;
    evidenceRefs: string[];
    occurredAt?: string;
  }): CollaborationEvent {
    const projection = this.project();
    const review = projection.reviews[input.reviewId];
    const authorization = projection.authorizations[input.authorizationId];
    const eligibility = this.mergeEligibility(input.reviewId, input.authorizationId);
    invariant(eligibility.state !== 'MERGED', 'MERGE_ALREADY_APPLIED', 'review already has a terminal merge record', {
      mergedRevisionId: eligibility.mergedRevisionId,
    });
    invariant(eligibility.state === 'ELIGIBLE' && review && authorization, 'MERGE_INELIGIBLE', 'merge eligibility failed', {
      reasons: eligibility.reasons,
    });
    invariant(input.evidenceRefs.length > 0, 'MERGE_EVIDENCE_MISSING', 'merge requires visible evidence references');
    const replayFingerprint = projection.revisions[review.reviewedRevisionId]?.replayFingerprint ?? `replay:${review.reviewedRevisionId}`;
    const revisionId = `rev:merge:${sha256(canonicalJson({
      reviewId: input.reviewId,
      source: review.reviewedRevisionId,
      target: review.expectedTargetRevisionId,
      replayFingerprint,
    })).slice(0, 16)}`;
    const occurredAt = input.occurredAt ?? this.now();
    const [mergeEvent] = this.appendMany([
      {
        eventType: 'MERGE_APPLIED',
        aggregateType: 'MERGE',
        aggregateId: input.mergeId,
        occurredAt,
        provenance: actorProvenance(input.actor, 'browser:atomic-merge'),
        payload: {
          mergeId: input.mergeId,
          reviewId: input.reviewId,
          authorizationId: input.authorizationId,
          revisionId,
          replayFingerprint,
          evidenceRefs: input.evidenceRefs,
        },
      },
      this.authorizationSpec(input.authorizationId, 'APPLIED', authorization.subject, input.actor, input.evidenceRefs, occurredAt),
    ]);
    return mergeEvent;
  }

  auditEvidence(): AuditEvidenceRow[] {
    return this.events.map((event) => {
      const payload = event.payload;
      const evidenceRefs = Array.isArray(payload.evidenceRefs)
        ? payload.evidenceRefs.filter((item): item is string => typeof item === 'string')
        : [];
      const summaryByType: Record<CollaborationEvent['eventType'], string> = {
        BRANCH_CREATED: `${String(payload.branch)} at ${String(payload.revisionId)}`,
        REVISION_COMMITTED: `${String(payload.branch)} -> ${String(payload.revisionId)} · ${String(payload.summary)}`,
        REVIEW_REQUESTED: `${String(payload.sourceBranch)} -> ${String(payload.targetBranch)} · ${String(payload.title)}`,
        PROPOSAL_REVIEW_RECORDED: `${String(payload.decision)} · ${String(payload.comment || 'no comment')}`,
        AUTHORIZATION_LIFECYCLE_RECORDED: `${String(payload.authorizationId)} · ${String(payload.status)}`,
        MERGE_APPLIED: `${String(payload.reviewId)} -> ${String(payload.revisionId)}`,
      };
      return {
        sequence: event.sequence,
        eventId: event.eventId,
        eventHash: event.eventHash,
        previousEventHash: event.previousEventHash,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        actor: `${event.provenance.actorKind}:${event.provenance.actorId}`,
        occurredAt: event.occurredAt,
        summary: summaryByType[event.eventType],
        evidenceRefs,
      };
    });
  }
}

export const HUMAN_OPERATOR: Actor = { actorId: 'operator:local-human', actorKind: 'HUMAN' };
export const BROWSER_AGENT: Actor = {
  actorId: 'agent:browser-copilot',
  actorKind: 'AGENT',
  executionIdentity: 'local-session:collaboration-workspace',
};
export const MERGE_SERVICE: Actor = { actorId: 'service:local-merge', actorKind: 'SERVICE' };

let pageSessionWorkspace: CollaborationWorkspaceModel | null = null;

export function getPageSessionCollaborationWorkspace(): CollaborationWorkspaceModel {
  if (!pageSessionWorkspace) pageSessionWorkspace = createDemoCollaborationWorkspace();
  return pageSessionWorkspace;
}

export function createDemoCollaborationWorkspace(): CollaborationWorkspaceModel {
  const workspace = new CollaborationWorkspaceModel();
  workspace.createBranch({
    branch: 'main',
    revisionId: 'rev:main-001',
    actor: HUMAN_OPERATOR,
    summary: 'Hackathon candidate baseline',
    replayFingerprint: 'geometry:kestrel:baseline-001',
    occurredAt: '2026-09-05T16:00:00Z',
  });
  workspace.createBranch({
    branch: 'feature/assembly',
    fromBranch: 'main',
    revisionId: 'rev:main-001',
    actor: HUMAN_OPERATOR,
    occurredAt: '2026-09-05T16:01:00Z',
  });
  workspace.commitRevision({
    branch: 'feature/assembly',
    expectedHeadRevisionId: 'rev:main-001',
    revisionId: 'rev:assembly-004',
    summary: 'Constrain motor mount and expose source trace',
    footprint: {
      reads: ['definition:airframe', 'parameter:motor-spacing'],
      writes: ['component:motor-mount'],
      impacts: ['operation:assembly-solve'],
    },
    replayFingerprint: 'geometry:kestrel:assembly-004',
    actor: BROWSER_AGENT,
    occurredAt: '2026-09-05T16:02:00Z',
  });
  workspace.requestReview({
    reviewId: 'review:assembly-004',
    title: 'Motor mount constraint and sourcing trace',
    sourceBranch: 'feature/assembly',
    targetBranch: 'main',
    actor: BROWSER_AGENT,
    replayFingerprints: ['geometry:kestrel:assembly-004', 'geometry:kestrel:assembly-004'],
    occurredAt: '2026-09-05T16:03:00Z',
  });
  workspace.recordReview({
    reviewId: 'review:assembly-004',
    decision: 'COMMENT',
    actor: BROWSER_AGENT,
    comment: 'Replay fingerprints agree. Human review and explicit merge authorization remain required.',
    occurredAt: '2026-09-05T16:04:00Z',
  });
  workspace.requestAuthorization({
    authorizationId: 'authorization:assembly-004',
    reviewId: 'review:assembly-004',
    actor: BROWSER_AGENT,
    occurredAt: '2026-09-05T16:05:00Z',
  });
  return workspace;
}
