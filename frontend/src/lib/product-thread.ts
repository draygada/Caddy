import { useSyncExternalStore } from 'react';

export const PRODUCT_ID = 'product:caddydaddy:qx-0';
export const PRODUCT_NAME = 'QX-0 hardened drone';
export const PRODUCT_THREAD_ID = 'thread:caddydaddy:qx-0-workflow';
export const PRODUCT_THREAD_DURABILITY = 'DEVICE_LOCAL_BROWSER_STORAGE_NOT_SHARED' as const;
export const PRODUCT_THREAD_STORAGE_SCHEMA = 'caddydaddy.product-thread-storage/1' as const;
export const PRODUCT_THREAD_STORAGE_KEY = 'caddydaddy.product-thread.qx-0.v1' as const;
export const PRODUCT_THREAD_DURABILITY_NOTICE = 'Device-local browser storage only. This is refresh durability for this browser profile, not multi-user or cloud persistence.' as const;
export const PRODUCT_THREAD_SIGNATURE = 'UNSIGNED_NO_ED25519' as const;
export const PRODUCT_THREAD_SEMANTIC_BOM_DIGEST = 'NOT_PROVIDED' as const;

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
  bomCsvArtifactSha256: string;
  semanticBomDigest: typeof PRODUCT_THREAD_SEMANTIC_BOM_DIGEST;
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
  schemaVersion: 'caddydaddy.product-thread-event/2';
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
  storageStatus: ProductThreadStorageStatus;
  storageDetail: string;
  mutationVersion: number;
}

export type ProductThreadStorageStatus = 'EMPTY_DEVICE_LOCAL' | 'RECOVERING_DEVICE_LOCAL' | 'RESTORED_DEVICE_LOCAL' | 'ACTIVE_DEVICE_LOCAL' | 'RECOVERED_EMPTY_INVALID' | 'UNAVAILABLE_MEMORY_FALLBACK' | 'WRITE_FAILED_MEMORY_FALLBACK';

export interface LaneProjection {
  count: number;
  headEventHash: string;
  lastSequence: number;
  lastEventType: string;
}

export interface ProductThreadVerification {
  status: 'VALID_DEVICE_LOCAL' | 'BROKEN' | 'INCOMPLETE_UNTRACKED';
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

export interface ClassificationProductContext {
  productId: typeof PRODUCT_ID;
  productName: typeof PRODUCT_NAME;
  revisionId: string;
  artifacts: ProductArtifactRef[];
}

interface StoredProductThread {
  schemaVersion: typeof PRODUCT_THREAD_STORAGE_SCHEMA;
  productId: typeof PRODUCT_ID;
  threadId: typeof PRODUCT_THREAD_ID;
  events: ProductThreadEvent[];
  currentCadRevision: ProductCadRevision | null;
  artifactBinding: ProductArtifactBinding | null;
  expectedProjection: Partial<Record<ProductLane, LaneProjection>>;
}

const HASH = /^[a-f0-9]{64}$/;
const HASH_URI = /^sha256:([a-f0-9]{64})$/;
const PRODUCT_LANES: readonly ProductLane[] = ['cad', 'sources', 'classification', 'sourcing', 'order', 'receipt'];
const ACTOR_ATTESTATIONS: readonly ActorAttestation[] = ['OPERATOR_ACTION_RECORDED', 'SERVICE_REPORTED', 'SYSTEM_OBSERVED', 'UNATTESTED'];
const listeners = new Set<() => void>();
let events: ProductThreadEvent[] = [];
let currentCadRevision: ProductCadRevision | null = null;
let artifactBinding: ProductArtifactBinding | null = null;
let mutationVersion = 0;
let expectedProjection: Partial<Record<ProductLane, LaneProjection>> = {};
let storageStatus: ProductThreadStorageStatus = 'UNAVAILABLE_MEMORY_FALLBACK';
let storageDetail: string = PRODUCT_THREAD_DURABILITY_NOTICE;
let restoreGeneration = 0;
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
      storageStatus,
      storageDetail,
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

function browserStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function artifactFromUnknown(value: unknown): ProductArtifactRef | null {
  if (!isRecord(value) || typeof value.artifactId !== 'string' || !value.artifactId.trim() || typeof value.kind !== 'string' || !value.kind.trim() || typeof value.sha256 !== 'string' || !HASH.test(value.sha256)) return null;
  return { artifactId: value.artifactId, kind: value.kind, sha256: value.sha256 };
}

function cadRevisionFromUnknown(value: unknown): ProductCadRevision | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)
    || typeof value.documentId !== 'string' || !value.documentId.trim()
    || typeof value.revisionId !== 'string' || !value.revisionId.trim()
    || typeof value.documentSha256 !== 'string' || !HASH.test(value.documentSha256)
    || typeof value.geometrySha256 !== 'string' || !HASH.test(value.geometrySha256)
    || typeof value.acceptedAt !== 'string' || !value.acceptedAt.trim()) return undefined;
  return {
    documentId: value.documentId,
    revisionId: value.revisionId,
    documentSha256: value.documentSha256,
    geometrySha256: value.geometrySha256,
    acceptedAt: value.acceptedAt,
  };
}

function artifactBindingFromUnknown(value: unknown): ProductArtifactBinding | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)
    || typeof value.revisionId !== 'string' || !value.revisionId.trim()
    || typeof value.cadArtifactSha256 !== 'string' || !HASH.test(value.cadArtifactSha256)
    || typeof value.artifactManifestSha256 !== 'string' || !HASH.test(value.artifactManifestSha256)
    || typeof value.bomCsvArtifactSha256 !== 'string' || !HASH.test(value.bomCsvArtifactSha256)
    || value.semanticBomDigest !== PRODUCT_THREAD_SEMANTIC_BOM_DIGEST
    || typeof value.registeredAt !== 'string' || !value.registeredAt.trim()) return undefined;
  return {
    revisionId: value.revisionId,
    cadArtifactSha256: value.cadArtifactSha256,
    artifactManifestSha256: value.artifactManifestSha256,
    bomCsvArtifactSha256: value.bomCsvArtifactSha256,
    semanticBomDigest: PRODUCT_THREAD_SEMANTIC_BOM_DIGEST,
    registeredAt: value.registeredAt,
  };
}

function eventFromUnknown(value: unknown, index: number): ProductThreadEvent | null {
  if (!isRecord(value) || !Array.isArray(value.artifacts)) return null;
  const parsedArtifacts: ProductArtifactRef[] = [];
  for (const artifact of value.artifacts) {
    const parsed = artifactFromUnknown(artifact);
    if (!parsed) return null;
    parsedArtifacts.push(parsed);
  }
  const revisionId = value.revisionId === null ? null : typeof value.revisionId === 'string' && value.revisionId.trim() ? value.revisionId : undefined;
  if (revisionId === undefined
    || value.schemaVersion !== 'caddydaddy.product-thread-event/2'
    || value.productId !== PRODUCT_ID
    || value.threadId !== PRODUCT_THREAD_ID
    || value.sequence !== index + 1
    || !(value.previousHash === null || typeof value.previousHash === 'string' && HASH.test(value.previousHash))
    || typeof value.eventHash !== 'string' || !HASH.test(value.eventHash)
    || typeof value.actorId !== 'string' || !value.actorId.trim()
    || !ACTOR_ATTESTATIONS.includes(value.actorAttestation as ActorAttestation)
    || !PRODUCT_LANES.includes(value.sourceLane as ProductLane)
    || typeof value.eventType !== 'string' || !value.eventType.trim()
    || typeof value.summary !== 'string' || !value.summary.trim()
    || typeof value.timestamp !== 'string' || !value.timestamp.trim()
    || value.durabilityBoundary !== PRODUCT_THREAD_DURABILITY
    || value.signatureBoundary !== PRODUCT_THREAD_SIGNATURE
    || !isRecord(value.payload) || !isJsonValue(value.payload)) return null;
  if (value.sourceLane === 'classification' && (revisionId === null
    || !parsedArtifacts.some((artifact) => artifact.kind === 'cad-document')
    || !parsedArtifacts.some((artifact) => artifact.kind === 'cad-geometry')
    || !parsedArtifacts.some((artifact) => artifact.kind === 'classification-fact-snapshot')
    || !parsedArtifacts.some((artifact) => artifact.kind === 'classification-reference-pack'))) return null;
  return {
    schemaVersion: 'caddydaddy.product-thread-event/2',
    productId: PRODUCT_ID,
    threadId: PRODUCT_THREAD_ID,
    sequence: value.sequence,
    previousHash: value.previousHash,
    eventHash: value.eventHash,
    revisionId,
    artifacts: parsedArtifacts,
    actorId: value.actorId,
    actorAttestation: value.actorAttestation as ActorAttestation,
    sourceLane: value.sourceLane as ProductLane,
    eventType: value.eventType,
    summary: value.summary,
    timestamp: value.timestamp,
    durabilityBoundary: PRODUCT_THREAD_DURABILITY,
    signatureBoundary: PRODUCT_THREAD_SIGNATURE,
    payload: value.payload,
  };
}

function projectionFromUnknown(value: unknown): Partial<Record<ProductLane, LaneProjection>> | null {
  if (!isRecord(value)) return null;
  const parsed: Partial<Record<ProductLane, LaneProjection>> = {};
  for (const [lane, projection] of Object.entries(value)) {
    if (!PRODUCT_LANES.includes(lane as ProductLane) || !isRecord(projection)
      || typeof projection.count !== 'number' || !Number.isInteger(projection.count) || projection.count < 1
      || typeof projection.headEventHash !== 'string' || !HASH.test(projection.headEventHash)
      || typeof projection.lastSequence !== 'number' || !Number.isInteger(projection.lastSequence) || projection.lastSequence < 1
      || typeof projection.lastEventType !== 'string' || !projection.lastEventType.trim()) return null;
    parsed[lane as ProductLane] = {
      count: projection.count,
      headEventHash: projection.headEventHash,
      lastSequence: projection.lastSequence,
      lastEventType: projection.lastEventType,
    };
  }
  return parsed;
}

function storedThreadFromUnknown(value: unknown): StoredProductThread | null {
  if (!isRecord(value)
    || value.schemaVersion !== PRODUCT_THREAD_STORAGE_SCHEMA
    || value.productId !== PRODUCT_ID
    || value.threadId !== PRODUCT_THREAD_ID
    || !Array.isArray(value.events)) return null;
  const parsedEvents: ProductThreadEvent[] = [];
  for (let index = 0; index < value.events.length; index += 1) {
    const parsed = eventFromUnknown(value.events[index], index);
    if (!parsed || parsed.previousHash !== (parsedEvents.at(-1)?.eventHash ?? null)) return null;
    parsedEvents.push(parsed);
  }
  const parsedRevision = cadRevisionFromUnknown(value.currentCadRevision);
  const parsedBinding = artifactBindingFromUnknown(value.artifactBinding);
  const parsedProjection = projectionFromUnknown(value.expectedProjection);
  if (parsedRevision === undefined || parsedBinding === undefined || parsedProjection === null) return null;
  if (parsedBinding && (!parsedRevision || parsedBinding.revisionId !== parsedRevision.revisionId || parsedBinding.cadArtifactSha256 !== parsedRevision.geometrySha256)) return null;
  if ((parsedRevision || parsedBinding) && parsedEvents.length === 0) return null;
  return {
    schemaVersion: PRODUCT_THREAD_STORAGE_SCHEMA,
    productId: PRODUCT_ID,
    threadId: PRODUCT_THREAD_ID,
    events: parsedEvents,
    currentCadRevision: parsedRevision,
    artifactBinding: parsedBinding,
    expectedProjection: parsedProjection,
  };
}

async function verifyStoredThread(stored: StoredProductThread): Promise<boolean> {
  let expectedPrevious: string | null = null;
  for (const event of stored.events) {
    const { eventHash, ...preimage } = event;
    if (event.previousHash !== expectedPrevious || await sha256(eventPreimage(preimage)) !== eventHash) return false;
    expectedPrevious = eventHash;
  }
  return sameProjection(projectionOf(stored.events), stored.expectedProjection);
}

function persistedEnvelope(): StoredProductThread {
  return {
    schemaVersion: PRODUCT_THREAD_STORAGE_SCHEMA,
    productId: PRODUCT_ID,
    threadId: PRODUCT_THREAD_ID,
    events,
    currentCadRevision,
    artifactBinding,
    expectedProjection,
  };
}

function persistProductThread(): void {
  const storage = browserStorage();
  if (!storage) {
    storageStatus = 'UNAVAILABLE_MEMORY_FALLBACK';
    storageDetail = `Browser storage is unavailable; the current state is memory-only. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    return;
  }
  try {
    storage.setItem(PRODUCT_THREAD_STORAGE_KEY, JSON.stringify(persistedEnvelope()));
    storageStatus = 'ACTIVE_DEVICE_LOCAL';
    storageDetail = PRODUCT_THREAD_DURABILITY_NOTICE;
  } catch {
    storageStatus = 'WRITE_FAILED_MEMORY_FALLBACK';
    storageDetail = `The device-local write failed; the current state remains memory-only. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
  }
}

function clearRuntimeThread(): void {
  events = [];
  currentCadRevision = null;
  artifactBinding = null;
  expectedProjection = {};
}

async function restoreProductThreadFromBrowserStorageNow(): Promise<void> {
  const generation = ++restoreGeneration;
  const storage = browserStorage();
  if (!storage) {
    storageStatus = 'UNAVAILABLE_MEMORY_FALLBACK';
    storageDetail = `Browser storage is unavailable; refresh durability is disabled. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    publish();
    return;
  }
  let raw: string | null;
  try {
    raw = storage.getItem(PRODUCT_THREAD_STORAGE_KEY);
  } catch {
    storageStatus = 'UNAVAILABLE_MEMORY_FALLBACK';
    storageDetail = `Browser storage could not be read; refresh durability is disabled. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    publish();
    return;
  }
  if (raw === null) {
    clearRuntimeThread();
    storageStatus = 'EMPTY_DEVICE_LOCAL';
    storageDetail = `No device-local Product Thread has been recorded yet. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    mutationVersion += 1;
    publish();
    return;
  }
  let stored: StoredProductThread | null = null;
  try {
    stored = storedThreadFromUnknown(JSON.parse(raw));
  } catch {
    stored = null;
  }
  if (!stored) {
    if (generation !== restoreGeneration) return;
    try { storage.removeItem(PRODUCT_THREAD_STORAGE_KEY); } catch { /* recovery remains empty even if removal is blocked */ }
    clearRuntimeThread();
    storageStatus = 'RECOVERED_EMPTY_INVALID';
    storageDetail = `Invalid or incompatible device-local data was rejected and the Product Thread recovered empty. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    mutationVersion += 1;
    publish();
    return;
  }
  storageStatus = 'RECOVERING_DEVICE_LOCAL';
  storageDetail = `Validating the stored hash chain before restore. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
  publish();
  const valid = await verifyStoredThread(stored).catch(() => false);
  if (generation !== restoreGeneration) return;
  if (!valid) {
    try { storage.removeItem(PRODUCT_THREAD_STORAGE_KEY); } catch { /* recovery remains empty even if removal is blocked */ }
    clearRuntimeThread();
    storageStatus = 'RECOVERED_EMPTY_INVALID';
    storageDetail = `Stored hash-chain or projection validation failed; the Product Thread recovered empty. ${PRODUCT_THREAD_DURABILITY_NOTICE}`;
    mutationVersion += 1;
    publish();
    return;
  }
  events = stored.events;
  currentCadRevision = stored.currentCadRevision;
  artifactBinding = stored.artifactBinding;
  expectedProjection = stored.expectedProjection;
  storageStatus = 'RESTORED_DEVICE_LOCAL';
  storageDetail = PRODUCT_THREAD_DURABILITY_NOTICE;
  mutationVersion += 1;
  publish();
}

function validArtifact(artifact: ProductArtifactRef): void {
  if (!artifact.artifactId.trim() || !artifact.kind.trim() || !HASH.test(artifact.sha256)) throw new Error('Product-thread artifact identity is invalid.');
}

export function canonicalProductSha256(value: string, label = 'Product-thread SHA-256'): string {
  if (HASH.test(value)) return value;
  const digestUri = HASH_URI.exec(value);
  if (digestUri) return digestUri[1];
  throw new Error(`${label} is invalid.`);
}

function enqueueProductMutation<T>(operation: () => Promise<T>): Promise<T> {
  const queued = appendQueue.then(operation);
  appendQueue = queued.catch(() => undefined);
  return queued;
}

async function appendProductEventNow(input: AppendProductEventInput): Promise<ProductThreadEvent> {
  const artifacts = input.artifacts ?? [];
  artifacts.forEach(validArtifact);
  if (input.sourceLane === 'classification') {
    const context = requireClassificationProductContext();
    if (!input.revisionId?.trim()) throw new Error('Classification events require the active CAD revision; no event was recorded.');
    if (input.revisionId !== context.revisionId) throw new Error(`Classification event revision ${input.revisionId} does not match active CAD revision ${context.revisionId}; no event was recorded.`);
    for (const required of context.artifacts) {
      if (!artifacts.some((artifact) => artifact.kind === required.kind && artifact.sha256 === required.sha256)) throw new Error(`Classification event is missing required ${required.kind} identity for active CAD revision ${context.revisionId}; no event was recorded.`);
    }
    if (!artifacts.some((artifact) => artifact.kind === 'classification-fact-snapshot')) throw new Error('Classification event is missing its fact-snapshot hash; no event was recorded.');
    if (!artifacts.some((artifact) => artifact.kind === 'classification-reference-pack')) throw new Error('Classification event is missing its reference-pack hash; no event was recorded.');
  }
  const previousHash = events.at(-1)?.eventHash ?? null;
  const preimage: Omit<ProductThreadEvent, 'eventHash'> = {
    schemaVersion: 'caddydaddy.product-thread-event/2',
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
  persistProductThread();
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

export function requireClassificationProductContext(thread: ProductThreadSnapshot = getProductThreadSnapshot()): ClassificationProductContext {
  const revision = thread.currentCadRevision;
  if (!revision) throw new Error('Classification recording requires an active accepted CAD revision in the QX-0 Product Thread.');
  const artifacts: ProductArtifactRef[] = [
    { artifactId: `cad-document:${revision.documentId}:${revision.revisionId}`, kind: 'cad-document', sha256: revision.documentSha256 },
    { artifactId: `cad-geometry:${revision.documentId}:${revision.revisionId}`, kind: 'cad-geometry', sha256: revision.geometrySha256 },
  ];
  const binding = thread.artifactBinding;
  if (binding?.revisionId === revision.revisionId) {
    artifacts.push(
      { artifactId: `cad-manifest:${revision.revisionId}`, kind: 'cad-artifact-manifest', sha256: binding.artifactManifestSha256 },
      { artifactId: `bom-csv:${revision.revisionId}`, kind: 'BOM_CSV_ARTIFACT_SHA256', sha256: binding.bomCsvArtifactSha256 },
    );
  }
  return { productId: PRODUCT_ID, productName: PRODUCT_NAME, revisionId: revision.revisionId, artifacts };
}

export function restoreProductThreadFromBrowserStorage(): Promise<void> {
  return enqueueProductMutation(() => restoreProductThreadFromBrowserStorageNow());
}

export function productArtifactGate(binding: ProductArtifactBinding | null): { ready: boolean; code: 'READY' | 'BLOCKED_MISSING_CAD_ARTIFACTS'; detail: string } {
  if (!binding) return { ready: false, code: 'BLOCKED_MISSING_CAD_ARTIFACTS', detail: 'Register an exact CAD revision, geometry artifact hash, artifact-manifest hash, and BOM CSV artifact byte hash before building a sourcing or order package. Semantic BOM digest is NOT_PROVIDED.' };
  return { ready: true, code: 'READY', detail: `Bound to CAD revision ${binding.revisionId}.` };
}

export async function registerProductCadRevision(input: Omit<ProductCadRevision, 'acceptedAt'> & { acceptedAt?: string; actorId: string; operationId?: string | null }): Promise<ProductThreadEvent> {
  const acceptedAt = input.acceptedAt ?? new Date().toISOString();
  const documentSha256 = canonicalProductSha256(input.documentSha256, 'Accepted CAD document SHA-256');
  const geometrySha256 = canonicalProductSha256(input.geometrySha256, 'Accepted CAD geometry SHA-256');
  const artifacts: ProductArtifactRef[] = [
    { artifactId: `cad-document:${input.documentId}:${input.revisionId}`, kind: 'cad-document', sha256: documentSha256 },
    { artifactId: `cad-geometry:${input.documentId}:${input.revisionId}`, kind: 'cad-geometry', sha256: geometrySha256 },
  ];
  if (!input.documentId.trim() || !input.revisionId.trim()) throw new Error('Accepted CAD identity is incomplete.');
  artifacts.forEach(validArtifact);
  return enqueueProductMutation(async () => {
    currentCadRevision = {
      documentId: input.documentId,
      revisionId: input.revisionId,
      documentSha256,
      geometrySha256,
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
          persistence: PRODUCT_THREAD_DURABILITY,
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
  bomCsvArtifactSha256: string;
  artifacts: ProductArtifactRef[];
  actorId: string;
  registeredAt?: string;
}

export async function registerProductOutputs(input: RegisterProductOutputsInput): Promise<ProductThreadEvent> {
  const registeredAt = input.registeredAt ?? new Date().toISOString();
  const sourceDocumentSha256 = canonicalProductSha256(input.sourceDocumentSha256, 'CAD output source-document SHA-256');
  const sourceGeometrySha256 = canonicalProductSha256(input.sourceGeometrySha256, 'CAD output source-geometry SHA-256');
  const outputDocumentSha256 = canonicalProductSha256(input.outputDocumentSha256, 'CAD output document SHA-256');
  const artifactManifestSha256 = canonicalProductSha256(input.artifactManifestSha256, 'CAD output manifest SHA-256');
  const bomCsvArtifactSha256 = canonicalProductSha256(input.bomCsvArtifactSha256, 'CAD output BOM CSV artifact SHA-256');
  if (!input.outputDocumentId.trim() || !input.outputRevisionId.trim()) throw new Error('CAD output identity is incomplete.');
  input.artifacts.forEach(validArtifact);
  if (!input.artifacts.some((artifact) => artifact.artifactId.endsWith(':manifest.json') && artifact.sha256 === artifactManifestSha256)) {
    throw new Error('CAD output manifest identity does not match the sealed artifact set.');
  }
  const bomCsvArtifacts = input.artifacts.filter((artifact) => artifact.artifactId.endsWith(':bom.csv') || artifact.artifactId.endsWith(':bom/bom.csv'));
  if (bomCsvArtifacts.length !== 1 || bomCsvArtifacts[0].kind !== 'BOM_CSV' || bomCsvArtifacts[0].sha256 !== bomCsvArtifactSha256) {
    throw new Error('CAD output BOM CSV artifact identity does not match the sealed artifact set.');
  }
  return enqueueProductMutation(async () => {
    const current = currentCadRevision;
    if (!current
      || current.documentId !== input.sourceDocumentId
      || current.revisionId !== input.sourceRevisionId
      || current.documentSha256 !== sourceDocumentSha256
      || current.geometrySha256 !== sourceGeometrySha256) {
      throw new Error('CAD outputs are stale or do not match the current accepted CAD revision.');
    }
    artifactBinding = {
      revisionId: current.revisionId,
      cadArtifactSha256: current.geometrySha256,
      artifactManifestSha256,
      bomCsvArtifactSha256,
      semanticBomDigest: PRODUCT_THREAD_SEMANTIC_BOM_DIGEST,
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
        outputDocumentSha256,
        binding: 'EXACT_CURRENT_REVISION_HASH_IDENTITIES_ONLY',
        bomIdentity: 'BOM_CSV_ARTIFACT_SHA256',
        semanticBomDigest: PRODUCT_THREAD_SEMANTIC_BOM_DIGEST,
          persistence: PRODUCT_THREAD_DURABILITY,
      },
    });
  });
}

export async function registerProductArtifacts(input: Omit<ProductArtifactBinding, 'registeredAt' | 'semanticBomDigest'> & { registeredAt?: string; actorId: string }): Promise<ProductThreadEvent> {
  const registeredAt = input.registeredAt ?? new Date().toISOString();
  const cadArtifactSha256 = canonicalProductSha256(input.cadArtifactSha256, 'CAD artifact SHA-256');
  const artifactManifestSha256 = canonicalProductSha256(input.artifactManifestSha256, 'CAD artifact manifest SHA-256');
  const bomCsvArtifactSha256 = canonicalProductSha256(input.bomCsvArtifactSha256, 'BOM CSV artifact SHA-256');
  const refs: ProductArtifactRef[] = [
    { artifactId: `cad:${input.revisionId}`, kind: 'cad-geometry', sha256: cadArtifactSha256 },
    { artifactId: `cad-manifest:${input.revisionId}`, kind: 'cad-artifact-manifest', sha256: artifactManifestSha256 },
    { artifactId: `bom-csv:${input.revisionId}`, kind: 'BOM_CSV_ARTIFACT_SHA256', sha256: bomCsvArtifactSha256 },
  ];
  refs.forEach(validArtifact);
  return enqueueProductMutation(async () => {
    const current = currentCadRevision;
    if (!current || current.revisionId !== input.revisionId || current.geometrySha256 !== cadArtifactSha256) throw new Error('CAD artifact registration requires the matching active accepted CAD revision.');
    artifactBinding = {
      revisionId: input.revisionId,
      cadArtifactSha256,
      artifactManifestSha256,
      bomCsvArtifactSha256,
      semanticBomDigest: PRODUCT_THREAD_SEMANTIC_BOM_DIGEST,
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
      payload: { binding: 'EXACT_HASH_IDENTITIES_ONLY', bomIdentity: 'BOM_CSV_ARTIFACT_SHA256', semanticBomDigest: PRODUCT_THREAD_SEMANTIC_BOM_DIGEST, persistence: PRODUCT_THREAD_DURABILITY },
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
  persistProductThread();
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
  const status = !chainValid || !projectionMatches ? 'BROKEN' : untrackedCount > 0 ? 'INCOMPLETE_UNTRACKED' : 'VALID_DEVICE_LOCAL';
  const detail = status === 'BROKEN'
    ? `Hash-chain or replay projection mismatch${firstBrokenSequence == null ? '' : ` at sequence ${firstBrokenSequence}`}.`
    : status === 'INCOMPLETE_UNTRACKED'
      ? `${untrackedCount} legacy event(s) remain outside this product thread; replay cannot claim complete product coverage.`
      : `Every recorded lane replayed to the stored projection. This verifies hash-chain continuity for this device-local browser record; it does not provide multi-user/cloud persistence, authenticated identity, or a digital signature.`;
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

export function resetProductThreadForTests(options: { preserveBrowserStorage?: boolean } = {}): void {
  restoreGeneration += 1;
  clearRuntimeThread();
  mutationVersion = 0;
  const storage = browserStorage();
  if (storage && !options.preserveBrowserStorage) {
    try { storage.removeItem(PRODUCT_THREAD_STORAGE_KEY); } catch { /* test reset still clears runtime state */ }
  }
  storageStatus = storage ? 'EMPTY_DEVICE_LOCAL' : 'UNAVAILABLE_MEMORY_FALLBACK';
  storageDetail = options.preserveBrowserStorage ? `Runtime state reset; the device-local envelope remains available for restore. ${PRODUCT_THREAD_DURABILITY_NOTICE}` : PRODUCT_THREAD_DURABILITY_NOTICE;
  appendQueue = Promise.resolve();
  publish();
}

appendQueue = restoreProductThreadFromBrowserStorageNow();
