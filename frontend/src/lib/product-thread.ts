import { useSyncExternalStore } from 'react';

export const PRODUCT_ID = 'product:caddydaddy:kestrel';
export const PRODUCT_THREAD_ID = 'thread:caddydaddy:hackathon-candidate';
export const PRODUCT_THREAD_DURABILITY = 'MEMORY_ONLY_BROWSER_SESSION' as const;
export const PRODUCT_THREAD_SIGNATURE = 'UNSIGNED_NO_ED25519' as const;

export type ProductLane = 'cad' | 'sources' | 'classification' | 'sourcing' | 'order' | 'receipt';
export type ActorAttestation = 'OPERATOR_ACTION_RECORDED' | 'SERVICE_REPORTED' | 'SYSTEM_OBSERVED' | 'UNATTESTED';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ProductArtifactRef {
  artifactId: string;
  kind: string;
  sha256: string;
}

export interface ProductArtifactBinding {
  revisionId: string;
  cadArtifactSha256: string;
  artifactManifestSha256: string;
  bomSha256: string;
  registeredAt: string;
}

export interface ProductCadRevision {
  documentId: string;
  revisionId: string;
  documentSha256: string;
  geometrySha256: string;
  acceptedAt: string;
}

export interface ProductThreadEvent {
  schemaVersion: 'caddydaddy.product-thread-event/1';
  productId: typeof PRODUCT_ID;
  threadId: typeof PRODUCT_THREAD_ID;
  sequence: number;
  previousHash: string | null;
  eventHash: string;
  revisionId: string | null;
  artifacts: ProductArtifactRef[];
  actorId: string;
  actorAttestation: ActorAttestation;
  sourceLane: ProductLane;
  eventType: string;
  summary: string;
  timestamp: string;
  durabilityBoundary: typeof PRODUCT_THREAD_DURABILITY;
  signatureBoundary: typeof PRODUCT_THREAD_SIGNATURE;
  payload: { [key: string]: JsonValue };
}

export interface ProductThreadSnapshot {
  productId: typeof PRODUCT_ID;
  threadId: typeof PRODUCT_THREAD_ID;
  durabilityBoundary: typeof PRODUCT_THREAD_DURABILITY;
  signatureBoundary: typeof PRODUCT_THREAD_SIGNATURE;
  events: readonly ProductThreadEvent[];
  currentCadRevision: ProductCadRevision | null;
  artifactBinding: ProductArtifactBinding | null;
  mutationVersion: number;
}

export interface LaneProjection {
  count: number;
  headEventHash: string;
  lastSequence: number;
  lastEventType: string;
}

export interface ProductThreadVerification {
  status: 'VALID_MEMORY_ONLY' | 'BROKEN' | 'INCOMPLETE_UNTRACKED';
  chainValid: boolean;
  projectionMatches: boolean;
  firstBrokenSequence: number | null;
  untrackedCount: number;
  eventCount: number;
  headHash: string | null;
  lanes: Partial<Record<ProductLane, LaneProjection>>;
  detail: string;
}

export interface AppendProductEventInput {
  sourceLane: ProductLane;
  eventType: string;
  summary: string;
  actorId: string;
  actorAttestation: ActorAttestation;
  revisionId?: string | null;
  artifacts?: ProductArtifactRef[];
  timestamp?: string;
  payload?: { [key: string]: JsonValue };
}

const HASH = /^[a-f0-9]{64}$/;
const listeners = new Set<() => void>();
let events: ProductThreadEvent[] = [];
let currentCadRevision: ProductCadRevision | null = null;
let artifactBinding: ProductArtifactBinding | null = null;
let mutationVersion = 0;
let expectedProjection: Partial<Record<ProductLane, LaneProjection>> = {};
let appendQueue: Promise<unknown> = Promise.resolve();
let snapshot = makeSnapshot();

function makeSnapshot(): ProductThreadSnapshot {
  return {
    productId: PRODUCT_ID,
    threadId: PRODUCT_THREAD_ID,
    durabilityBoundary: PRODUCT_THREAD_DURABILITY,
    signatureBoundary: PRODUCT_THREAD_SIGNATURE,
    events,
    currentCadRevision,
    artifactBinding,
    mutationVersion,
  };
}

function publish(): void {
  snapshot = makeSnapshot();
  listeners.forEach((listener) => listener());
}

function canonical(value: JsonValue): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Product-thread numbers must be finite.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

async function sha256(value: JsonValue): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function eventPreimage(event: Omit<ProductThreadEvent, 'eventHash'>): JsonValue {
  return event as unknown as JsonValue;
}

function projectionOf(values: readonly ProductThreadEvent[]): Partial<Record<ProductLane, LaneProjection>> {
  const projection: Partial<Record<ProductLane, LaneProjection>> = {};
  for (const event of values) {
    const previous = projection[event.sourceLane];
    projection[event.sourceLane] = {
      count: (previous?.count ?? 0) + 1,
      headEventHash: event.eventHash,
      lastSequence: event.sequence,
      lastEventType: event.eventType,
    };
  }
  return projection;
}

function sameProjection(left: Partial<Record<ProductLane, LaneProjection>>, right: Partial<Record<ProductLane, LaneProjection>>): boolean {
  return canonical(left as unknown as JsonValue) === canonical(right as unknown as JsonValue);
}

function validArtifact(artifact: ProductArtifactRef): void {
  if (!artifact.artifactId.trim() || !artifact.kind.trim() || !HASH.test(artifact.sha256)) throw new Error('Product-thread artifact identity is invalid.');
}

function enqueueProductMutation<T>(operation: () => Promise<T>): Promise<T> {
  const queued = appendQueue.then(operation);
  appendQueue = queued.catch(() => undefined);
  return queued;
}

async function appendProductEventNow(input: AppendProductEventInput): Promise<ProductThreadEvent> {
  const artifacts = input.artifacts ?? [];
  artifacts.forEach(validArtifact);
  const previousHash = events.at(-1)?.eventHash ?? null;
  const preimage: Omit<ProductThreadEvent, 'eventHash'> = {
    schemaVersion: 'caddydaddy.product-thread-event/1',
    productId: PRODUCT_ID,
    threadId: PRODUCT_THREAD_ID,
    sequence: events.length + 1,
    previousHash,
    revisionId: input.revisionId ?? null,
    artifacts,
    actorId: input.actorId,
    actorAttestation: input.actorAttestation,
    sourceLane: input.sourceLane,
    eventType: input.eventType,
    summary: input.summary,
    timestamp: input.timestamp ?? new Date().toISOString(),
    durabilityBoundary: PRODUCT_THREAD_DURABILITY,
    signatureBoundary: PRODUCT_THREAD_SIGNATURE,
    payload: input.payload ?? {},
  };
  const event: ProductThreadEvent = { ...preimage, eventHash: await sha256(eventPreimage(preimage)) };
  events = [...events, event];
  expectedProjection = projectionOf(events);
  mutationVersion += 1;
  publish();
  return event;
}

export function subscribeProductThread(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProductThreadSnapshot(): ProductThreadSnapshot {
  return snapshot;
}

export function useProductThread(): ProductThreadSnapshot {
  return useSyncExternalStore(subscribeProductThread, getProductThreadSnapshot, getProductThreadSnapshot);
}

export function productArtifactGate(binding: ProductArtifactBinding | null): { ready: boolean; code: 'READY' | 'BLOCKED_MISSING_CAD_ARTIFACTS'; detail: string } {
  if (!binding) return { ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS', detail: 'Register an exact CAD revision, geometry artifact hash, artifact-manifest hash, and BOM hash before building a sourcing or order package.' };
  return { ready: true, code: 'READY', detail: `Bound to CAD revision ${binding.revisionId}.` };
}

export async function registerProductCadRevision(input: Omit<ProductCadRevision, 'acceptedAt'> & { acceptedAt?: string; actorId: string; operationId?: string | null }): Promise<ProductThreadEvent> {
  const acceptedAt = input.acceptedAt ?? new Date().toISOString();
  const artifacts: ProductArtifactRef[] = [
    { artifactId: `cad-document:${input.documentId}:${input.revisionId}`, kind: 'cad-document', sha256: input.documentSha256 },
    { artifactId: `cad-geometry:${input.documentId}:${input.revisionId}`, kind: 'cad-geometry', sha256: input.geometrySha256 },
  ];
  if (!input.documentId.trim() || !input.revisionId.trim()) throw new Error('Accepted CAD identity is incomplete.');
  artifacts.forEach(validArtifact);
  return enqueueProductMutation(async () => {
    currentCadRevision = {
      documentId: input.documentId,
      revisionId: input.revisionId,
      documentSha256: input.documentSha256,
      geometrySha256: input.geometrySha256,
      acceptedAt,
    };
    artifactBinding = null;
    return appendProductEventNow({
      sourceLane: 'cad',
      eventType: 'cad.recompute_accepted',
      summary: `Accepted CAD revision ${input.revisionId}; prior output bindings are no longer current.`,
      actorId: input.actorId,
      actorAttestation: 'OPERATOR_ACTION_RECORDED',
      revisionId: input.revisionId,
      artifacts,
      timestamp: acceptedAt,
      payload: {
        documentId: input.documentId,
        operationId: input.operationId ?? null,
        outputBinding: 'INVALIDATED_UNTIL_CURRENT_REVISION_OUTPUTS_SEALED',
        persisted: false,
      },
    });
  });
}

export interface RegisterProductOutputsInput {
  sourceDocumentId: string;
  sourceRevisionId: string;
  sourceDocumentSha256: string;
  sourceGeometrySha256: string;
  outputDocumentId: string;
  outputRevisionId: string;
  outputDocumentSha256: string;
  artifactManifestSha256: string;
  bomSha256: string;
  artifacts: ProductArtifactRef[];
  actorId: string;
  registeredAt?: string;
}

export async function registerProductOutputs(input: RegisterProductOutputsInput): Promise<ProductThreadEvent> {
  const registeredAt = input.registeredAt ?? new Date().toISOString();
  if (!input.outputDocumentId.trim() || !input.outputRevisionId.trim()) throw new Error('CAD output identity is incomplete.');
  input.artifacts.forEach(validArtifact);
  if (!input.artifacts.some((artifact) => artifact.artifactId.endsWith(':manifest.json') && artifact.sha256 === input.artifactManifestSha256)) {
    throw new Error('CAD output manifest identity does not match the sealed artifact set.');
  }
  if (!input.artifacts.some((artifact) => artifact.artifactId.endsWith(':bom.csv') && artifact.sha256 === input.bomSha256)) {
    throw new Error('CAD output BOM identity does not match the sealed artifact set.');
  }
  return enqueueProductMutation(async () => {
    const current = currentCadRevision;
    if (!current
      || current.documentId !== input.sourceDocumentId
      || current.revisionId !== input.sourceRevisionId
      || current.documentSha256 !== input.sourceDocumentSha256
      || current.geometrySha256 !== input.sourceGeometrySha256) {
      throw new Error('CAD outputs are stale or do not match the current accepted CAD revision.');
    }
    artifactBinding = {
      revisionId: current.revisionId,
      cadArtifactSha256: current.geometrySha256,
      artifactManifestSha256: input.artifactManifestSha256,
      bomSha256: input.bomSha256,
      registeredAt,
    };
    return appendProductEventNow({
      sourceLane: 'cad',
      eventType: 'cad.outputs_registered',
      summary: `Registered ${input.artifacts.length} sealed output identities for current CAD revision ${current.revisionId}.`,
      actorId: input.actorId,
      actorAttestation: 'OPERATOR_ACTION_RECORDED',
      revisionId: current.revisionId,
      artifacts: input.artifacts,
      timestamp: registeredAt,
      payload: {
        sourceDocumentId: current.documentId,
        outputDocumentId: input.outputDocumentId,
        outputRevisionId: input.outputRevisionId,
        outputDocumentSha256: input.outputDocumentSha256,
        binding: 'EXACT_CURRENT_REVISION_HASH_IDENTITIES_ONLY',
        persisted: false,
      },
    });
  });
}

export async function registerProductArtifacts(input: Omit<ProductArtifactBinding, 'registeredAt'> & { registeredAt?: string; actorId: string }): Promise<ProductThreadEvent> {
  const registeredAt = input.registeredAt ?? new Date().toISOString();
  const refs: ProductArtifactRef[] = [
    { artifactId: `cad:${input.revisionId}`, kind: 'cad-geometry', sha256: input.cadArtifactSha256 },
    { artifactId: `cad-manifest:${input.revisionId}`, kind: 'cad-artifact-manifest', sha256: input.artifactManifestSha256 },
    { artifactId: `bom:${input.revisionId}`, kind: 'bom', sha256: input.bomSha256 },
  ];
  refs.forEach(validArtifact);
  return enqueueProductMutation(async () => {
    artifactBinding = {
      revisionId: input.revisionId,
      cadArtifactSha256: input.cadArtifactSha256,
      artifactManifestSha256: input.artifactManifestSha256,
      bomSha256: input.bomSha256,
      registeredAt,
    };
    return appendProductEventNow({
      sourceLane: 'cad',
      eventType: 'cad.artifacts_registered',
      summary: `Registered exact CAD output identities for ${input.revisionId}.`,
      actorId: input.actorId,
      actorAttestation: 'OPERATOR_ACTION_RECORDED',
      revisionId: input.revisionId,
      artifacts: refs,
      timestamp: registeredAt,
      payload: { binding: 'EXACT_HASH_IDENTITIES_ONLY', persisted: false },
    });
  });
}

export function appendProductEvent(input: AppendProductEventInput): Promise<ProductThreadEvent> {
  return enqueueProductMutation(() => appendProductEventNow(input));
}

export function tamperProductThread(sequence: number): boolean {
  const index = events.findIndex((event) => event.sequence === sequence);
  if (index < 0) return false;
  events = events.map((event, eventIndex) => eventIndex === index ? { ...event, summary: `${event.summary} [tampered after hashing]` } : event);
  mutationVersion += 1;
  publish();
  return true;
}

export async function rederiveProductThread(untrackedCount = 0): Promise<ProductThreadVerification> {
  let expectedPrevious: string | null = null;
  let firstBrokenSequence: number | null = null;
  for (const event of events) {
    const { eventHash, ...preimage } = event;
    const recomputed = await sha256(eventPreimage(preimage));
    if (firstBrokenSequence === null && (event.sequence < 1 || event.previousHash !== expectedPrevious || recomputed !== eventHash)) firstBrokenSequence = event.sequence;
    expectedPrevious = eventHash;
  }
  const lanes = projectionOf(events);
  const projectionMatches = sameProjection(lanes, expectedProjection);
  const chainValid = firstBrokenSequence === null;
  const status = !chainValid || !projectionMatches ? 'BROKEN' : untrackedCount > 0 ? 'INCOMPLETE_UNTRACKED' : 'VALID_MEMORY_ONLY';
  const detail = status === 'BROKEN'
    ? `Hash-chain or replay projection mismatch${firstBrokenSequence == null ? '' : ` at sequence ${firstBrokenSequence}`}.`
    : status === 'INCOMPLETE_UNTRACKED'
      ? `${untrackedCount} legacy event(s) remain outside this product thread; replay cannot claim complete product coverage.`
      : 'Every recorded lane replayed to the stored projection. This proves only in-session SHA-256 continuity, not durability, identity, or a digital signature.';
  return {
    status,
    chainValid,
    projectionMatches,
    firstBrokenSequence,
    untrackedCount,
    eventCount: events.length,
    headHash: events.at(-1)?.eventHash ?? null,
    lanes,
    detail,
  };
}

export function resetProductThreadForTests(): void {
  events = [];
  currentCadRevision = null;
  artifactBinding = null;
  mutationVersion = 0;
  expectedProjection = {};
  appendQueue = Promise.resolve();
  publish();
}
