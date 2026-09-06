import { useState } from 'react';
import { useStore } from '../store';
import { evaluateClassification, ClassificationClientError, type ClassificationDetermination } from '../lib/classification-client';

const STEP_WORD: Record<string, string> = { supported: 'supported', negative: 'negative', undetermined: 'undetermined', undemonstrated: 'undemonstrated', specific_supported: 'specific entry supported', all_knocked_out: 'all knocked out', not_reached: 'not reached' };

/**
 * One call to the product service's classification engine for a product or a part.
 * With a live token and the public/synthetic confirmation in Settings the service routes to Claude; without them it answers
 * with its deterministic scripted model, which never guesses a candidate. The result prints exactly what came back.
 */
export function EngineRun({ label, description, facts }: { label: string; description: string; facts: Record<string, unknown> }) {
  const liveAuth = useStore((s) => s.liveAuth);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassificationDetermination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = !!liveAuth.accessToken.trim() && liveAuth.publicSyntheticDataConfirmed;
  const run = async () => {
    setBusy(true); setError(null);
    try {
      setResult(await evaluateClassification({ description, facts, item_kind: 'commodity' }, live ? { liveAuthorization: liveAuth } : {}));
    } catch (e) {
      setResult(null);
      const denied = e instanceof ClassificationClientError && /access denied/i.test(e.message);
      setError(denied && !live ? 'The service runs in the live lane and needs the live access token. Open Settings, paste the token, tick the public-or-synthetic box, then run again.' : e instanceof ClassificationClientError ? e.code + ' · ' + e.message : e instanceof Error ? e.message : 'the engine request failed');
    } finally { setBusy(false); }
  };
  const d = result?.determination;
  const p = result?.provenance;
  return (
    <div className="grid gap-2 border border-line rounded-r p-3 bg-surface text-[13px]">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={run} disabled={busy} className={'btn ' + (live ? 'btn-primary' : '') + ' disabled:opacity-50'} aria-busy={busy}>{busy ? 'Asking the engine…' : (live ? 'Ask Claude' : 'Run the engine') + ' · ' + label}</button>
        <span className="text-[12px] text-muted">{live ? 'live lane · the service routes this call to Claude under the server caps' : 'no live token in Settings · a service in the live lane denies the call; one in the scripted lane answers with its deterministic model'}</span>
      </div>
      {error && <div role="alert" className="text-red font-semibold">{error}</div>}
      {result && d && p && (
        <div role="status" className="grid gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="status-word text-[15px]" style={{ color: d.jurisdiction === 'ITAR' ? 'var(--red)' : d.jurisdiction === 'EAR' ? 'var(--amber)' : d.jurisdiction === 'EAR99' ? 'var(--green)' : 'var(--muted)', background: 'var(--surface2)' }}>{d.jurisdiction}</span>
            <span className="font-mono">{d.classification.length ? d.classification.join(' · ') : 'no classification entry'}</span>
            <span className="text-muted">USML {STEP_WORD[d.usml_step] ?? d.usml_step} · CCL {STEP_WORD[d.ccl_step] ?? d.ccl_step}</span>
          </div>
          {d.basis.map((b, i) => <div key={i}>{b}</div>)}
          {d.open_candidates.length > 0 && <div className="text-amber">open: {d.open_candidates.join(', ')}</div>}
          {result.candidates.length > 0 && (
            <div className="grid gap-1">
              {result.candidates.map((c) => (
                <div key={c.candidate_id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-baseline">
                  <span className="font-mono font-semibold whitespace-nowrap">{c.provision}</span>
                  <span><span className="chip chip-sm">{c.status.replace('_', ' ')}</span> {c.why_considered}{c.why_rejected ? ' · rejected: ' + c.why_rejected : ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[12px] text-muted font-mono">model {p.model} · {p.budget.calls_used} of {p.budget.calls_cap} calls · {(p.budget.cost_used_microusd / 1_000_000).toFixed(3)} of {(p.budget.cost_cap_microusd / 1_000_000).toFixed(2)} USD · snapshot {result.snapshot_sha256.slice(0, 8)} · pack {result.pack_sha256.slice(0, 8)}</div>
          {p.reference_notes.map((n, i) => <div key={i} className="text-[12px] text-muted">{n}</div>)}
        </div>
      )}
    </div>
  );
}
