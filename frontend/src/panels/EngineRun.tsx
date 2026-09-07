import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  evaluateClassification,
  ClassificationClientError,
  parseClassificationDetermination,
  type ClassificationDetermination,
} from '../lib/classification-client';

const STEP_WORD: Record<string, string> = { supported: 'supported', negative: 'negative', undetermined: 'undetermined', undemonstrated: 'undemonstrated', specific_supported: 'specific entry supported', all_knocked_out: 'all knocked out', not_reached: 'not reached' };
const RUN_SESSION_PREFIX = 'caddy.classification-run.v1:';

interface StoredEngineRun {
  schemaVersion: 1;
  requestFingerprint: string;
  revisionId: string;
  result: ClassificationDetermination;
  recordedAt: string;
}

export function engineRunFingerprint(description: string, facts: Record<string, unknown>): string {
  const source = JSON.stringify({ description, facts });
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${source.length}:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

export function engineRunRecordIsCurrent(record: Pick<StoredEngineRun, 'requestFingerprint' | 'revisionId'> | null, requestFingerprint: string, revisionId: string): boolean {
  return record?.requestFingerprint === requestFingerprint && record.revisionId === revisionId;
}

export function engineRunTone(jurisdiction: string): string {
  if (jurisdiction === 'ITAR') return 'var(--red)';
  if (jurisdiction === 'EAR' || jurisdiction === 'EAR99') return 'var(--amber)';
  return 'var(--muted)';
}

function readStoredRun(key: string): StoredEngineRun | null {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredEngineRun>;
    if (value.schemaVersion !== 1 || typeof value.requestFingerprint !== 'string' || typeof value.revisionId !== 'string' || typeof value.recordedAt !== 'string') return null;
    return { ...value, result: parseClassificationDetermination(value.result) } as StoredEngineRun;
  } catch {
    return null;
  }
}

function writeStoredRun(key: string, value: StoredEngineRun | null): void {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    if (!storage) return;
    if (value) storage.setItem(key, JSON.stringify(value));
    else storage.removeItem(key);
  } catch {
    // Session evidence remains available in memory when storage is unavailable.
  }
}

/** Context-bound engine execution. Scripted and live calls remain separate explicit actions. */
export function EngineRun({ scopeKey, label, description, facts }: { scopeKey: string; label: string; description: string; facts: Record<string, unknown> }) {
  const liveAuth = useStore((state) => state.liveAuth);
  const revisionId = useStore((state) => state.workflowIdentity.revisionId);
  const storageKey = RUN_SESSION_PREFIX + encodeURIComponent(scopeKey);
  const requestFingerprint = useMemo(() => engineRunFingerprint(description, facts), [description, facts]);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<'scripted' | 'live' | null>(null);
  const [record, setRecord] = useState<StoredEngineRun | null>(() => readStoredRun(storageKey));
  const [error, setError] = useState<string | null>(null);
  const liveAvailable = !!liveAuth.accessToken.trim() && liveAuth.publicSyntheticDataConfirmed;
  const current = engineRunRecordIsCurrent(record, requestFingerprint, revisionId);
  const result = current ? record?.result ?? null : null;

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(null);
    setError(null);
    setRecord(readStoredRun(storageKey));
  }, [requestFingerprint, revisionId, storageKey]);
  useEffect(() => () => request.current?.abort(), []);

  const run = async (mode: 'scripted' | 'live') => {
    if (mode === 'live' && !liveAvailable) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const startedFingerprint = requestFingerprint;
    const startedRevision = revisionId;
    setBusy(mode);
    setError(null);
    try {
      const nextResult = await evaluateClassification(
        { description, facts, item_kind: 'commodity' },
        mode === 'live' ? { signal: controller.signal, liveAuthorization: liveAuth } : { signal: controller.signal },
      );
      if (request.current !== controller) return;
      const next: StoredEngineRun = {
        schemaVersion: 1,
        requestFingerprint: startedFingerprint,
        revisionId: startedRevision,
        result: nextResult,
        recordedAt: new Date().toISOString(),
      };
      setRecord(next);
      writeStoredRun(storageKey, next);
    } catch (cause) {
      if (request.current !== controller) return;
      setError(cause instanceof ClassificationClientError ? `${cause.code} · ${cause.message}` : cause instanceof Error ? cause.message : 'The engine request failed.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  };
  const clear = () => {
    setRecord(null);
    setError(null);
    writeStoredRun(storageKey, null);
  };
  const determination = result?.determination;
  const provenance = result?.provenance;

  return (
    <div className="grid gap-2 border border-line rounded-r p-3 bg-surface text-[13px]">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => run('scripted')} disabled={busy !== null} className="btn disabled:opacity-50" aria-busy={busy === 'scripted'}>{busy === 'scripted' ? 'Running deterministic engine…' : 'Run deterministic · ' + label}</button>
        <button onClick={() => run('live')} disabled={busy !== null || !liveAvailable} className="btn btn-primary disabled:opacity-50" aria-busy={busy === 'live'}>{busy === 'live' ? 'Asking Claude…' : 'Ask Claude · ' + label}</button>
        <span className="text-[12px] text-muted">{liveAvailable ? 'live access available · only Ask Claude sends this public/synthetic request externally' : 'live access unavailable · configure the deployment token and attestation in Settings'}</span>
      </div>
      <div className="text-[11px] text-muted">Jurisdiction-screening support only · legal effect NONE · not advice, authorization, clearance, or permission to ship.</div>
      {error && <div role="alert" className="text-red font-semibold">{error}{result ? ' · the last valid result remains below' : ''}</div>}
      {record && !current && <div role="status" className="text-amber">The design revision or submitted facts changed after the retained run. Run again to produce current evidence.</div>}
      {result && determination && provenance && (
        <div role="status" className="grid gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="status-word text-[15px]" style={{ color: engineRunTone(determination.jurisdiction), background: 'var(--surface2)' }}>{determination.jurisdiction}</span>
            <span className="font-mono">{determination.classification.length ? determination.classification.join(' · ') : 'no classification entry'}</span>
            <span className="text-muted">USML {STEP_WORD[determination.usml_step] ?? determination.usml_step} · CCL {STEP_WORD[determination.ccl_step] ?? determination.ccl_step}</span>
          </div>
          {determination.basis.map((basis, index) => <div key={index}>{basis}</div>)}
          {determination.open_candidates.length > 0 && <div className="text-amber">open: {determination.open_candidates.join(', ')}</div>}
          {result.candidates.length > 0 && <div className="grid gap-1">{result.candidates.map((candidate) => <div key={candidate.candidate_id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-baseline"><span className="font-mono font-semibold whitespace-nowrap">{candidate.provision}</span><span><span className="chip chip-sm">{candidate.status.replace('_', ' ')}</span> {candidate.why_considered}{candidate.why_rejected ? ' · rejected: ' + candidate.why_rejected : ''}</span></div>)}</div>}
          <div className="text-[12px] text-muted font-mono">model {provenance.model} · {provenance.budget.calls_used} of {provenance.budget.calls_cap} calls · {(provenance.budget.cost_used_microusd / 1_000_000).toFixed(3)} of {(provenance.budget.cost_cap_microusd / 1_000_000).toFixed(2)} USD · snapshot {result.snapshot_sha256.slice(0, 8)} · pack {result.pack_sha256.slice(0, 8)}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted"><span>tab-session evidence · revision {record?.revisionId} · {record?.recordedAt}</span><button onClick={clear} className="btn btn-xs">Clear result</button></div>
          {provenance.reference_notes.map((note, index) => <div key={index} className="text-[12px] text-muted">{note}</div>)}
        </div>
      )}
    </div>
  );
}
