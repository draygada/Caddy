import { PROGRESS_ATLAS, calculateProgress, orderedNextSteps, type ProgressStatus } from '../data/progress-atlas';
import { PACKS } from '../lib/catalog';
import { FIXTURES } from '../lib/sourcing';
import { designHashOf, useStore } from '../store';

const STATUS: Record<ProgressStatus, { label: string; short: string; color: string; background: string }> = {
  usable_now: { label: 'Usable now', short: 'LIVE', color: 'var(--focus)', background: 'color-mix(in srgb, var(--focus) 11%, transparent)' },
  fixture_backed: { label: 'Fixture-backed', short: 'FIXTURE', color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  local_memory: { label: 'Local-memory only', short: 'LOCAL', color: '#1687a7', background: 'color-mix(in srgb, #1687a7 12%, transparent)' },
  unavailable: { label: 'Not implemented', short: 'ABSENT', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)' },
};

function CapabilityCard({ capability }: { capability: (typeof PROGRESS_ATLAS.capabilities)[number] }) {
  const state = STATUS[capability.status];
  return (
    <article className="panel overflow-hidden" style={{ borderTop: `3px solid ${state.color}` }}>
      <div className="p-4 grid gap-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted">{capability.lane} / {capability.id}</div>
            <h3 className="font-semibold text-[15px] mt-1">{capability.name}</h3>
          </div>
          <span className="chip ml-auto shrink-0 font-mono" style={{ color: state.color, background: state.background }}>{state.short}</span>
        </div>
        <p className="text-[13px] leading-relaxed m-0">{capability.summary}</p>
        <div className="rounded-r border border-line2 bg-surface2 px-3 py-2 text-[12px] leading-relaxed text-muted">
          <strong className="text-ink">Boundary:</strong> {capability.boundary}
        </div>
        <div className="grid gap-1.5">
          {capability.evidence.map((pointer) => (
            <div key={`${capability.id}-${pointer.path}-${pointer.test ?? ''}`} className="font-mono text-[10px] leading-relaxed break-words text-muted">
              <span style={{ color: state.color }}>EVIDENCE</span> {pointer.path}{pointer.test ? ` :: ${pointer.test}` : ''}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function Now() {
  const events = useStore((state) => state.events);
  const pack = useStore((state) => state.pack);
  const roundStatus = useStore((state) => state.round?.status ?? 'NO ROUND');
  const snapshotDesign = useStore((state) => state.snapshot);
  const snapshot = snapshotDesign();
  const progress = calculateProgress();
  const nextSteps = orderedNextSteps();
  const available = PROGRESS_ATLAS.capabilities.filter((capability) => capability.status !== 'unavailable');
  const unavailable = PROGRESS_ATLAS.capabilities.filter((capability) => capability.status === 'unavailable');
  const sourcingEvents = events.filter((event) => event.lane === 'sourcing' || event.lane === 'order').length;
  const fixtureCount = Object.keys(FIXTURES).length;
  const latest = events[0];
  const releaseSha = import.meta.env.VITE_GIT_SHA?.trim() || 'UNKNOWN';

  return (
    <main className="h-full overflow-auto bg-bg text-ink" style={{ backgroundImage: 'radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--focus) 10%, transparent), transparent 28%), linear-gradient(135deg, transparent 68%, color-mix(in srgb, var(--amber) 7%, transparent))' }}>
      <div className="max-w-[1500px] mx-auto p-3 sm:p-5 lg:p-7 grid gap-4">
        <header className="panel relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-focus" />
          <div className="p-5 sm:p-7 grid lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)] gap-6 items-end">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="chip font-mono">CADdyDaddy / {PROGRESS_ATLAS.version}</span>
                <span className="chip font-mono text-muted">GIT SHA {releaseSha === 'UNKNOWN' ? 'UNKNOWN' : releaseSha.slice(0, 12)}</span>
                <span className="chip font-mono text-muted">READ-ONLY PROJECTION</span>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted m-0">Now / Engineering Atlas</p>
              <h1 className="text-[clamp(2rem,5vw,4.8rem)] leading-[0.92] tracking-[-0.055em] font-semibold mt-3 mb-4">The whole candidate,<br /><span className="text-muted">without the mythology.</span></h1>
              <p className="text-[14px] sm:text-[16px] leading-relaxed text-muted max-w-[760px] m-0">A live inventory of what the browser can demonstrate, the boundary behind each surface, the evidence that earns its status, and the shortest dependency chain to a production system.</p>
            </div>
            <section aria-label="Candidate progress" className="rounded-r border border-line2 bg-surface2 p-5">
              <div className="flex items-end gap-3">
                <span className="text-[54px] sm:text-[68px] leading-none tracking-[-0.06em] font-semibold">{progress.percent}%</span>
                <span className="font-mono text-[11px] text-muted pb-2">{progress.numerator} / {progress.denominator}<br />{PROGRESS_ATLAS.metricLabel}</span>
              </div>
              <div className="h-2 bg-line2 mt-4 overflow-hidden" role="progressbar" aria-label={PROGRESS_ATLAS.metricLabel} aria-valuemin={0} aria-valuemax={progress.denominator} aria-valuenow={progress.numerator}>
                <div className="h-full bg-focus" style={{ width: `${progress.percent}%` }} />
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-muted mt-3 mb-0">NUMERATOR = non-ABSENT manifest rows. DENOMINATOR = all {progress.denominator} typed rows. This measures candidate surface availability, not production readiness.</p>
            </section>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2" aria-label="Progress status counts">
          {(Object.keys(STATUS) as ProgressStatus[]).map((status) => {
            const state = STATUS[status];
            return <div key={status} className="panel p-3 sm:p-4" style={{ borderLeft: `3px solid ${state.color}` }}><div className="text-[24px] sm:text-[30px] font-semibold leading-none">{progress.byStatus[status]}</div><div className="font-mono text-[10px] uppercase tracking-wider mt-2" style={{ color: state.color }}>{state.label}</div></div>;
          })}
        </section>

        <section className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <div className="grid gap-4">
            <div className="flex items-end gap-3 px-1">
              <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Delivered candidate slice</div><h2 className="text-[22px] font-semibold mt-1 mb-0">Operable surfaces</h2></div>
              <span className="chip ml-auto">{available.length} surfaces</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">{available.map((capability) => <CapabilityCard key={capability.id} capability={capability} />)}</div>

            <div className="flex items-end gap-3 px-1 pt-3">
              <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Hard boundary</div><h2 className="text-[22px] font-semibold mt-1 mb-0">Unavailable, explicitly</h2></div>
              <span className="chip ml-auto" style={{ color: 'var(--red)' }}>{unavailable.length} absent</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">{unavailable.map((capability) => <CapabilityCard key={capability.id} capability={capability} />)}</div>
          </div>

          <aside className="grid gap-3 xl:sticky xl:top-3">
            <section className="panel overflow-hidden">
              <div className="panel-head"><div className="panel-title">Runtime pulse <span className="sub">this browser</span></div></div>
              <div className="p-4 grid grid-cols-2 gap-px bg-line2">
                {[
                  ['EVENTS', String(events.length)],
                  ['SOURCING / ORDER', String(sourcingEvents)],
                  ['SOURCE FIXTURES', String(fixtureCount)],
                  ['ROUND', roundStatus],
                ].map(([label, value]) => <div key={label} className="bg-surface p-3"><div className="font-mono text-[9px] text-muted tracking-wider">{label}</div><div className="font-mono text-[15px] font-semibold mt-1 break-all">{value}</div></div>)}
              </div>
              <div className="p-4 grid gap-2 font-mono text-[10px] text-muted border-t border-line2">
                <div className="flex gap-3"><span className="w-24 shrink-0">DESIGN HASH</span><span className="text-ink break-all">{designHashOf(snapshot)}</span></div>
                <div className="flex gap-3"><span className="w-24 shrink-0">LOG HEAD</span><span className="text-ink break-all">{latest ? `#${latest.seq} ${latest.kind} / ${latest.hash}` : 'UNKNOWN'}</span></div>
                <div className="flex gap-3"><span className="w-24 shrink-0">EXPORT PACK</span><span className="text-ink break-all">{pack} / {PACKS[pack].sha}</span></div>
                <div className="flex gap-3"><span className="w-24 shrink-0">GIT SHA</span><span className="text-ink break-all">{releaseSha === 'UNKNOWN' ? 'UNKNOWN / not injected' : releaseSha}</span></div>
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="panel-head"><div className="panel-title">Critical path <span className="sub">finish -&gt; unlock</span></div></div>
              <div className="p-3 grid gap-2">
                {nextSteps.map((step) => (
                  <article key={step.id} className="rounded-r border border-line2 bg-surface2 p-3">
                    <div className="flex items-start gap-3"><span className="font-mono text-[24px] leading-none text-muted">{String(step.order).padStart(2, '0')}</span><div><h3 className="text-[13px] font-semibold m-0">{step.name}</h3><div className="font-mono text-[9px] text-muted mt-1">AFTER {step.prerequisites.length ? step.prerequisites.join(' + ') : 'CURRENT CANDIDATE'}</div></div></div>
                    <p className="text-[11px] leading-relaxed text-muted mt-3 mb-2"><strong className="text-ink">Finish:</strong> {step.finish}</p>
                    <p className="text-[11px] leading-relaxed m-0" style={{ color: 'var(--focus)' }}><strong>Unlocks:</strong> {step.unlocks}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-r border border-line2 p-4" style={{ borderLeft: '4px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 8%, var(--surface))' }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--amber)' }}>Operating constraint</div>
              <p className="text-[12px] leading-relaxed mt-2 mb-0">Use synthetic or public data only. Candidate 0.1 is not a GovCloud/CUI environment, does not execute production orders, does not perform full-list screening, and does not produce a legal determination.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
