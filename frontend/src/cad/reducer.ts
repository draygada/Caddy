import { applyCadIntent } from './model';
import type { CadDependencyGraph, CadDiagnostic, CadDocument, CadKernelReceipt, CadMesh, CadOperation, CadRecomputeResponse } from './types';

export type CadRunStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'stale';

export interface CadHistoryEntry {
  id: string;
  operationId: string | null;
  label: string;
  status: CadRunStatus;
  revisionId: string;
  occurredAt: string;
}

export interface CadAuthoringState {
  document: CadDocument;
  lastValidDocument: CadDocument;
  lastValidMesh: CadMesh | null;
  dependencyGraph: CadDependencyGraph;
  diagnostics: CadDiagnostic[];
  kernel: CadKernelReceipt | null;
  pendingOperation: CadOperation | null;
  activeRequestId: string | null;
  status: CadRunStatus;
  error: string | null;
  history: CadHistoryEntry[];
  selectedId: string | null;
}

export type CadAuthoringAction =
  | { type: 'stage'; operation: CadOperation; requestId: string; occurredAt?: string }
  | { type: 'started'; requestId: string; occurredAt?: string }
  | { type: 'succeeded'; requestId: string; response: CadRecomputeResponse; occurredAt?: string }
  | { type: 'failed'; requestId: string; error: string; stale?: boolean; diagnostics?: CadDiagnostic[]; occurredAt?: string }
  | { type: 'recover-last-valid'; occurredAt?: string }
  | { type: 'select'; id: string | null }
  | { type: 'replace-from-import'; response: CadRecomputeResponse; occurredAt?: string };

const emptyGraph: CadDependencyGraph = { nodes: [], edges: [] };

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

export function createCadAuthoringState(document: CadDocument): CadAuthoringState {
  return {
    document,
    lastValidDocument: document,
    lastValidMesh: null,
    dependencyGraph: emptyGraph,
    diagnostics: [],
    kernel: null,
    pendingOperation: null,
    activeRequestId: null,
    status: 'idle',
    error: null,
    history: [],
    selectedId: null,
  };
}

export function cadAuthoringReducer(state: CadAuthoringState, action: CadAuthoringAction): CadAuthoringState {
  if (action.type === 'select') return { ...state, selectedId: action.id };

  if (action.type === 'stage') {
    return {
      ...state,
      document: applyCadIntent(state.document, action.operation),
      pendingOperation: action.operation,
      activeRequestId: action.requestId,
      status: 'queued',
      error: null,
      history: [...state.history, {
        id: `${action.requestId}:queued`,
        operationId: action.operation.id,
        label: action.operation.name,
        status: 'queued',
        revisionId: state.lastValidDocument.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  if (action.type === 'started') {
    if (action.requestId !== state.activeRequestId) return state;
    return {
      ...state,
      status: 'running',
      history: [...state.history, {
        id: `${action.requestId}:running`,
        operationId: state.pendingOperation?.id ?? null,
        label: `Recompute ${state.pendingOperation?.name ?? 'document'}`,
        status: 'running',
        revisionId: state.lastValidDocument.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  if (action.type === 'succeeded') {
    if (action.requestId !== state.activeRequestId) return state;
    return {
      ...state,
      document: action.response.document,
      lastValidDocument: action.response.document,
      lastValidMesh: action.response.mesh,
      dependencyGraph: action.response.dependencyGraph,
      diagnostics: action.response.diagnostics,
      kernel: action.response.kernel,
      pendingOperation: null,
      activeRequestId: null,
      status: 'succeeded',
      error: null,
      history: [...state.history, {
        id: `${action.requestId}:succeeded`,
        operationId: state.pendingOperation?.id ?? null,
        label: `Accepted ${action.response.revisionId}`,
        status: 'succeeded',
        revisionId: action.response.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  if (action.type === 'failed') {
    if (action.requestId !== state.activeRequestId) return state;
    const status: CadRunStatus = action.stale ? 'stale' : 'failed';
    return {
      ...state,
      status,
      error: action.error,
      diagnostics: action.diagnostics ?? state.diagnostics,
      history: [...state.history, {
        id: `${action.requestId}:${status}`,
        operationId: state.pendingOperation?.id ?? null,
        label: action.error,
        status,
        revisionId: state.lastValidDocument.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  if (action.type === 'recover-last-valid') {
    return {
      ...state,
      document: state.lastValidDocument,
      pendingOperation: null,
      activeRequestId: null,
      status: 'idle',
      error: null,
      history: [...state.history, {
        id: `recovery:${state.history.length}`,
        operationId: null,
        label: `Restored last valid ${state.lastValidDocument.revisionId}`,
        status: 'idle',
        revisionId: state.lastValidDocument.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  if (action.type === 'replace-from-import') {
    return {
      ...state,
      document: action.response.document,
      lastValidDocument: action.response.document,
      lastValidMesh: action.response.mesh,
      dependencyGraph: action.response.dependencyGraph,
      diagnostics: action.response.diagnostics,
      kernel: action.response.kernel,
      pendingOperation: null,
      activeRequestId: null,
      status: 'succeeded',
      error: null,
      history: [...state.history, {
        id: `import:${action.response.revisionId}`,
        operationId: null,
        label: `Imported ${action.response.document.name}`,
        status: 'succeeded',
        revisionId: action.response.revisionId,
        occurredAt: now(action.occurredAt),
      }],
    };
  }

  return state;
}
