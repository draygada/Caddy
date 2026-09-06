import { useMemo, useState } from 'react';
import {
  TRIPWIRE_ATLAS,
  confirmAtlasScenario,
  createAtlasSession,
  getAtlasScenario,
  getScenarioTripwires,
  getTripwireEvidence,
  markAtlasUnavailable,
  restoreAtlasConfirmation,
  startAtlasEvaluation,
  type AtlasValue,
  type GovernedTripwire,
} from '../lib/tripwire-atlas';

const tone = {
  direct: { color: 'var(--red)', label: 'DIRECT FLAG', icon: '!' },
  propagated: { color: 'var(--amber)', label: 'PROPAGATED', icon: 'P' },
  unresolved: { color: 'var(--amber)', label: 'CANNOT EVALUATE', icon: '?' },
} as const;

const shortHash = (value: string, keep = 8) => value.replace(/^sha256:/, '').slice(0, keep);
const displayValue = (value: AtlasValue) => value === null ? 'MISSING' : Array.isArray(value) ? value.join(', ') : String(value);

function TripwireCard({ tripwire, selected, onSelect }: { tripwire: GovernedTripwire; selected: boolean; onSelect: () => void }) {
  const state = tone[tripwire.kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full text-left rounded-r border bg-surface p-3 grid gap-2 cursor-pointer"
      style={{ borderColor: selected ? state.color : 'var(--line2)', boxShadow: selected ? `inset 3px 0 ${state.color}` : 'none' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-mono text-[11px] font-bold tracking-[.06em]" style={{ color: state.color }}>[{state.icon}] {state.label}</span>
        <span className="chip chip-sm">{tripwire.ruleId}</span>
      </div>
      <div className="font-semibold text-[13px]">{tripwire.headline}</div>
      <div className="font-mono text-[11px] text-muted">{tripwire.causeNodeId} -&gt; {tripwire.targetNodeId}</div>
    </button>
  );
}

export function TripwireAtlasWorkspace() {
  const [session, setSession] = useState(createAtlasSession);
  const scenario = getAtlasScenario(session.lastConfirmedScenarioId);
  const tripwires = useMemo(() => getScenarioTripwires(scenario), [scenario]);
  const [selectedTripwireId, setSelectedTripwireId] = useState(tripwires[0]?.id ?? '');
  const selected = tripwires.find((tripwire) => tripwire.id === selectedTripwireId) ?? tripwires[0];
  const evidence = selected ? getTripwireEvidence(selected) : [];

  const selectScenario = (scenarioId: string) => {
    const next = confirmAtlasScenario(session, scenarioId);
    const nextTripwires = getScenarioTripwires(getAtlasScenario(scenarioId));
    setSession(next);
    setSelectedTripwireId(nextTripwires[0]?.id ?? '');
  };

  const jumpToEvidence = (id: string) => {
    document.getElementById(`tripwire-evidence-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const modeCopy = session.mode === 'confirmed'
    ? `Confirmed request ${session.latestRequestId}`
    : session.mode === 'pending'
      ? `Checking request ${session.latestRequestId}; showing ${scenario.shortLabel} as stale-confirmed`
      : session.mode === 'unavailable'
        ? `Evaluation unavailable; retaining ${scenario.shortLabel} as stale-confirmed`
        : 'Contract error; the candidate response is blocked';

  return (
    <section aria-label="Tripwire Atlas workspace" className="absolute inset-0 z-[8] bg-bg text-ink flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-3 grid gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-mono font-bold tracking-[.12em] text-amber">TRIPWIRE ATLAS / GOVERNED INSPECTION</div>
            <h1 className="m-0 text-[20px] leading-tight font-semibold">Kestrel revision and evidence workspace</h1>
            <div className="text-[12px] text-muted mt-1">Source commit {shortHash(TRIPWIRE_ATLAS.provenance.fb03SourceCommit)} / tree {shortHash(TRIPWIRE_ATLAS.provenance.tripwireTree)} / bundle {shortHash(TRIPWIRE_ATLAS.provenance.sourceBundleSha256)}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="chip">{TRIPWIRE_ATLAS.posture.artifactStatus}</span>
            <span className="chip">{TRIPWIRE_ATLAS.posture.connectivity}</span>
            <span className="chip">PACK {TRIPWIRE_ATLAS.posture.rulePackDate}</span>
          </div>
        </div>
        <div role="note" className="rounded-r border px-3 py-2 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 9%, var(--surface))' }}>
          <div className="text-[12px]"><strong>HUMAN REVIEW REQUIRED / LEGAL EFFECT: NONE.</strong> {TRIPWIRE_ATLAS.posture.claimCeiling}</div>
          <span className="font-mono text-[11px]">DESTINATION {TRIPWIRE_ATLAS.posture.destinationStatus}</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-3 grid grid-cols-[220px_minmax(320px,0.95fr)_minmax(380px,1.25fr)] gap-3 max-[1100px]:grid-cols-[210px_minmax(0,1fr)] max-[760px]:grid-cols-1">
        <nav aria-label="Scenario revisions" className="panel self-start max-[760px]:order-1">
          <div className="panel-head"><div className="panel-title">Revision rail <span className="sub">5 fixtures</span></div></div>
          <div className="p-2 grid gap-1">
            {TRIPWIRE_ATLAS.scenarios.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => selectScenario(item.id)}
                aria-current={item.id === scenario.id ? 'step' : undefined}
                className="row-hover rounded-r border px-2 py-2 text-left bg-transparent text-ink cursor-pointer"
                style={{ borderColor: item.id === scenario.id ? 'var(--focus)' : 'transparent', background: item.id === scenario.id ? 'var(--surface2)' : 'transparent' }}
              >
                <span className="flex justify-between gap-2"><strong className="text-[12px]">{item.shortLabel} / {item.label}</strong><span className="font-mono text-[10px] text-muted">r{item.requestId}</span></span>
                <span className="block mt-1 font-mono text-[10px] text-muted">REV {shortHash(item.designRevision)}</span>
                <span className="block mt-1 text-[11px] text-muted">{item.delta.changedNodeIds.length} changed / {item.tripwireIds.length} active</span>
              </button>
            ))}
          </div>
          <div className="border-t border-line2 p-3 grid gap-2">
            <div className="text-[11px] font-mono font-bold">RESPONSE CONTINUITY</div>
            <div role="status" className="text-[11px] leading-[1.45] text-muted">{modeCopy}</div>
            <button type="button" onClick={() => setSession(startAtlasEvaluation(session, session.targetScenarioId))} className="btn">Simulate pending</button>
            <button type="button" onClick={() => setSession(markAtlasUnavailable(session))} className="btn">Simulate unavailable</button>
            {session.mode !== 'confirmed' && <button type="button" onClick={() => setSession(restoreAtlasConfirmation(session))} className="btn btn-primary">Restore confirmation</button>}
            <div className="text-[10px] text-muted">The last confirmed markers remain visible through pending and unavailable states. Older responses are ignored.</div>
          </div>
        </nav>

        <main className="grid gap-3 content-start max-[760px]:order-2">
          <div className="panel">
            <div className="panel-head"><div className="panel-title">{scenario.shortLabel} / {scenario.label}</div><span className="chip">REV {shortHash(scenario.designRevision)}</span></div>
            <div className="p-3 grid gap-3">
              <div>
                <div className="text-[16px] font-semibold">{scenario.headline}</div>
                <p className="m-0 mt-1 text-[12px] leading-[1.5] text-muted">{scenario.detail}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 max-[520px]:grid-cols-1">
                <div className="rounded-r border border-line2 p-2"><div className="text-[10px] text-muted">CHANGED</div><strong className="font-mono text-[15px]">{scenario.delta.changedNodeIds.length}</strong></div>
                <div className="rounded-r border border-line2 p-2"><div className="text-[10px] text-muted">ADDED</div><strong className="font-mono text-[15px]">{scenario.delta.added.length}</strong></div>
                <div className="rounded-r border border-line2 p-2"><div className="text-[10px] text-muted">REMOVED</div><strong className="font-mono text-[15px]">{scenario.delta.removed.length}</strong></div>
              </div>
              <div className="rounded-r border border-line2 bg-surface2 p-3">
                <div className="text-[10px] font-mono text-muted">CAUSAL FOCUS</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap font-mono text-[12px]">
                  <span className="chip">{selected?.causeNodeId ?? scenario.focusNodeId}</span><span>-&gt;</span><span className="chip">{selected?.targetNodeId ?? scenario.focusNodeId}</span>
                  {selected?.kind === 'propagated' && <span className="text-amber">propagation path: {selected.path.join(' -> ')}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Governed tripwires <span className="sub">direct / propagated / unresolved</span></div><span className="chip">{tripwires.length} ACTIVE</span></div>
            <div className="p-2 grid gap-2">
              {tripwires.map((tripwire) => <TripwireCard key={tripwire.id} tripwire={tripwire} selected={selected?.id === tripwire.id} onSelect={() => setSelectedTripwireId(tripwire.id)} />)}
            </div>
          </div>
        </main>

        <aside className="grid gap-3 content-start max-[1100px]:col-span-2 max-[760px]:col-span-1 max-[760px]:order-3">
          <div className="panel" aria-live="polite">
            <div className="panel-head">
              <div className="panel-title">Tripwire inspector</div>
              {selected && <span className="font-mono text-[11px] font-bold" style={{ color: tone[selected.kind].color }}>[{tone[selected.kind].icon}] {tone[selected.kind].label}</span>}
            </div>
            {selected && <div className="p-3 grid gap-3">
              <div>
                <div className="font-mono text-[12px] font-bold">{selected.ruleId} / {selected.entry}</div>
                <div className="text-[13px] mt-1">{selected.headline}</div>
                {selected.missingFact && <div className="mt-2 rounded-r border p-2 text-[12px]" style={{ borderColor: 'var(--amber)' }}><strong>Missing fact:</strong> <span className="font-mono">{selected.missingFact}</span></div>}
              </div>
              <div className="text-[12px] leading-[1.5] border-l-2 border-line pl-3">{selected.ruleText}</div>
              <div className="overflow-auto border border-line2 rounded-r">
                <table className="w-full border-collapse text-[11px]">
                  <thead><tr className="bg-surface2 text-muted"><th className="text-left p-2">Fact</th><th className="text-left p-2">Observed</th><th className="text-left p-2">Test</th><th className="text-left p-2">Threshold</th></tr></thead>
                  <tbody>{selected.facts.map((fact) => <tr key={fact.label} className="border-t border-line2"><td className="p-2">{fact.label}</td><td className="p-2 font-mono">{displayValue(fact.observed)}{fact.unit ? ` ${fact.unit}` : ''}</td><td className="p-2 font-mono">{fact.operator}</td><td className="p-2 font-mono">{displayValue(fact.threshold)}{fact.unit ? ` ${fact.unit}` : ''}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex gap-2 flex-wrap">
                {evidence.map((item) => <button type="button" key={item.id} onClick={() => jumpToEvidence(item.id)} className="btn">Jump to {item.label}</button>)}
              </div>
            </div>}
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Evidence locations <span className="sub">committed bytes + canonical source</span></div></div>
            <div className="p-2 grid gap-2">
              {evidence.map((item) => <article id={`tripwire-evidence-${item.id}`} key={item.id} className="rounded-r border border-line2 bg-surface2 p-3 grid gap-2 scroll-m-4">
                <div className="flex justify-between gap-2 flex-wrap"><strong className="text-[12px]">{item.label}</strong><span className="chip chip-sm">{item.approval}</span></div>
                <div className="font-mono text-[10px] break-all text-muted">{item.repositoryPath}</div>
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-1 text-[11px]"><span className="text-muted">Content date</span><span>{item.contentDate}</span><span className="text-muted">Legal relevance</span><span>{item.legalRelevance}</span><span className="text-muted">Byte span</span><span className="font-mono">{item.span ? `${item.span[0]}..${item.span[1]}` : 'not receipted'}</span><span className="text-muted">Span hash</span><span className="font-mono break-all">{item.spanSha256 ?? 'not available'}</span></div>
                <div className="flex gap-2 flex-wrap"><a className="btn" href={item.repositoryUrl} target="_blank" rel="noreferrer">Open committed evidence</a><a className="btn" href={item.canonicalUrl} target="_blank" rel="noreferrer">Open canonical source</a></div>
              </article>)}
            </div>
          </div>

          <div className="rounded-r border border-line2 p-3 text-[11px] leading-[1.5] text-muted">
            <strong className="text-ink">Immutable projection boundary.</strong> This frontend can select, sort, focus, and display copied candidate evidence. It cannot mutate rules, evaluate destinations, approve evidence, or produce legal effect. Source bundle SHA-256: <span className="font-mono break-all">{TRIPWIRE_ATLAS.provenance.sourceBundleSha256}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
