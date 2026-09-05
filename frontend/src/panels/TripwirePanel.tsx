import { useMemo } from 'react';
import { useTripwireStore } from '../tripwire-store';

const short = (value: string | undefined, keep = 12) => !value ? '—' : value.length <= keep * 2 + 1 ? value : value.slice(0, keep) + '…' + value.slice(-keep);

function Fact({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-[5px] border-b border-line2 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono break-all text-right">{value || '—'}</span>
    </div>
  );
}

export function TripwirePanel() {
  const s = useTripwireStore();
  const grouped = useMemo(() => {
    const out = new Map<string, typeof s.targets>();
    for (const target of s.targets) out.set(target.bodyLabel, [...(out.get(target.bodyLabel) ?? []), target]);
    return [...out.entries()];
  }, [s.targets]);
  if (!s.open) return null;
  const target = s.targets.find((item) => item.entityId === s.selectedEntityId) ?? null;
  const payload = s.result?.payload;
  const finding = payload?.observation?.findings?.[0];
  const receipt = payload?.binding_receipt;

  return (
    <div className="fixed inset-0 z-[50] bg-scrim flex justify-end" onMouseDown={s.closePanel}>
      <section role="dialog" aria-modal="true" aria-label="Tripwire review readiness" onMouseDown={(e) => e.stopPropagation()} className="h-full w-[min(900px,calc(100vw-16px))] bg-surface border-l border-line shadow-[-12px_0_32px_rgba(0,0,0,.2)] flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line2">
          <div className="min-w-0">
            <div className="font-semibold">Tripwire <span className="text-muted font-normal">· canonical Candidate 0.1 proof</span></div>
            <div className="text-[12px] text-muted">Separate from the synthetic Kestrel design preview</div>
          </div>
          <div className="flex gap-2 items-center">
            <span className="chip">Draft review only</span>
            <button onClick={s.closePanel} className="btn">Close · Esc</button>
          </div>
        </header>

        {s.candidate && (
          <div className="px-4 py-3 border-b border-line2 bg-surface2 grid gap-2">
            <div className="text-[13px] font-semibold">{s.candidate.candidate.claim}</div>
            <div className="flex flex-wrap gap-2">
              <span className="chip">{s.candidate.candidate.status}</span>
              <span className="chip">{s.candidate.snapshotProvenance.mode}</span>
              <span className="chip">revision {short(s.candidate.document.revisionId, 10)}</span>
              <span className="chip">commit {short(s.candidate.snapshotProvenance.source.commit, 7)}</span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-[minmax(250px,0.8fr)_minmax(340px,1.2fr)] gap-4 max-[720px]:grid-cols-1">
          <div className="panel self-start">
            <div className="panel-head">
              <div className="panel-title">Canonical entities <span className="sub">· choose one exact face</span></div>
              <span className="chip">{s.targets.length || '—'} mapped</span>
            </div>
            {s.phase === 'loading' && <div role="status" className="p-3 text-[13px] text-muted">Loading the immutable candidate and exact request bindings…</div>}
            {grouped.map(([body, targets]) => (
              <div key={body} className="border-b border-line2 last:border-b-0">
                <div className="px-3 pt-3 pb-1 text-[12px] text-muted uppercase tracking-[.06em]">{body}</div>
                <div className="px-2 pb-2 grid gap-1">
                  {targets.map((item) => (
                    <button key={item.entityId} onClick={() => s.selectEntity(item.entityId)} aria-pressed={s.selectedEntityId === item.entityId} className="row-hover min-h-10 rounded-r px-2 py-1 text-left grid grid-cols-[auto_minmax(0,1fr)] gap-2 bg-transparent border text-ink cursor-pointer" style={{ borderColor: s.selectedEntityId === item.entityId ? 'var(--focus)' : 'transparent', background: s.selectedEntityId === item.entityId ? 'var(--surface2)' : 'transparent' }}>
                      <span className="font-mono text-[12px] font-semibold">F{item.faceOrdinal}</span>
                      <span className="min-w-0"><span className="block text-[12px] font-mono truncate">{short(item.entityId, 9)}</span><span className="block text-[11px] text-muted truncate">{item.featureId}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {s.phase === 'error' && !s.candidate && <button onClick={() => void s.load()} className="btn m-3">Reload candidate</button>}
          </div>

          <div className="grid gap-3 content-start" aria-live="polite">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Review readiness <span className="sub">· immutable binding</span></div><span className="chip">{s.phase}</span></div>
              <div className="p-3 grid gap-2">
                {!target && s.phase !== 'loading' && <div className="text-[14px] text-muted">Select one API-supplied mapped entity. The Kestrel preview is intentionally not substituted for this candidate.</div>}
                {target && (
                  <>
                    <div className="font-semibold">{target.bodyLabel} · face {target.faceOrdinal}</div>
                    <Fact label="Entity" value={target.entityId} />
                    <Fact label="Semantic reference" value={target.semanticReferenceId} />
                    <Fact label="Feature" value={target.featureId} />
                    <Fact label="Revision" value={target.request.forge_revision_id} />
                    <Fact label="Forge record" value={target.request.forge_record_id} />
                  </>
                )}
                <button onClick={() => void s.review()} disabled={!target || s.phase === 'running' || s.phase === 'loading'} className="btn btn-primary btn-lg disabled:opacity-50">{s.phase === 'running' ? 'Checking exact binding…' : payload ? 'Run Tripwire again' : 'Check with Tripwire'}</button>
                <div className="text-[12px] text-muted">Tripwire checks evidence sufficiency for human review. It does not classify the design and cannot clear it.</div>
              </div>
            </div>

            {s.error && (
              <div role="alert" className="panel border-red">
                <div className="p-3 grid gap-2"><div className="font-mono text-red font-bold">{s.error.code}</div><div className="text-[14px]">{s.error.message}</div><button onClick={() => void (s.candidate ? s.review() : s.load())} className="btn justify-self-start">Retry safely</button></div>
              </div>
            )}

            {payload && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Bound evidence</div><span className="status-word" style={{ color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)' }}>! HUMAN REVIEW</span></div>
                <div className="p-3 grid gap-2">
                  <div className="border-l-2 pl-3 py-1" style={{ borderColor: 'var(--amber)' }}>
                    <div className="font-mono font-bold text-amber">{finding?.outcome ?? payload.status}</div>
                    <div className="text-[13px]">Insufficient evidence requires human review. No compliance determination was made.</div>
                  </div>
                  <Fact label="Policy state" value={payload.policy_state} />
                  <Fact label="Review gate" value={payload.human_review_requirement ?? receipt?.compliance_claim_gate} />
                  <Fact label="Legal effect" value={payload.legal_effect} />
                  <Fact label="Receipt" value={receipt?.receipt_id} />
                  <Fact label="Receipt hash" value={receipt?.receipt_hash} />
                  <Fact label="Observed" value={payload.observation?.observed_at ?? payload.observation?.observedAt} />
                  <details className="text-[13px]">
                    <summary className="cursor-pointer font-semibold py-1">Exact submitted binding</summary>
                    <pre className="mt-2 p-2 bg-surface2 border border-line2 rounded-r overflow-auto text-[11px] leading-[1.45]">{JSON.stringify(s.result?.request, null, 2)}</pre>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
