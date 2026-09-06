import { useMemo, useState, type CSSProperties } from 'react';
import {
  STAGE_ORDER,
  WORKSPACE_SCENARIOS,
  getWorkspaceScenario,
  runClassificationWorkspace,
  type CandidateDisposition,
  type Stage,
} from '../lib/classification-workspace';

const stageLabels: Record<Stage, string> = {
  usml_enumerated: 'USML enumerated',
  specially_designed_itar: 'ITAR specially designed',
  six_hundred_series: '600-series',
  specially_designed_ear: 'EAR specially designed',
  other_ccl: 'Other CCL',
  residual: 'Residual',
};

const dispositionColor: Record<CandidateDisposition, string> = {
  supported: '#176b45',
  knocked_out: '#56616d',
  undetermined: '#a05a00',
  not_reached: '#89919a',
};

const card: CSSProperties = {
  border: '1px solid var(--line, #d8dde3)',
  borderRadius: 8,
  background: 'var(--surface, #fff)',
};

const mono: CSSProperties = { fontFamily: 'Geist Mono, ui-monospace, monospace' };

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase();
}

export function ClassificationWorkspace() {
  const [scenarioId, setScenarioId] = useState(WORKSPACE_SCENARIOS[0].id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'cand:1:USML-XI-c-2': true });
  const scenario = getWorkspaceScenario(scenarioId);
  const result = useMemo(() => runClassificationWorkspace(scenario), [scenario]);

  return (
    <section aria-labelledby="classification-workspace-title" style={{ height: '100%', minHeight: 0, overflow: 'auto', background: 'var(--surface2, #f3f5f7)', color: 'var(--ink, #17202a)' }}>
      <header style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--line, #d8dde3)', background: 'linear-gradient(115deg, #f7f4ea 0%, #eef3f0 62%, #e8eef3 100%)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ ...mono, color: '#176b45', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Jurisdiction lab · deterministic fixture</div>
            <h2 id="classification-workspace-title" style={{ margin: '5px 0 4px', fontSize: 24, lineHeight: 1.1 }}>Classification workspace</h2>
            <p style={{ margin: 0, color: 'var(--muted, #5c6670)', fontSize: 13, lineHeight: 1.45 }}>
              Inspect the ordered advocate → judge → reconciliation route. Missing USML facts block the CCL; after a recorded USML negative, an empty or invalid specific CCL proposal intentionally falls through to EAR99.
            </p>
          </div>
          <label style={{ display: 'grid', gap: 5, minWidth: 260, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Synthetic evidence scenario
            <select aria-label="Synthetic evidence scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} style={{ padding: '9px 10px', border: '1px solid var(--line, #bcc4cc)', borderRadius: 6, background: 'var(--surface, #fff)', color: 'inherit', font: 'inherit', textTransform: 'none', letterSpacing: 0 }}>
              {WORKSPACE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <div role="note" style={{ marginTop: 12, padding: '9px 11px', borderLeft: '4px solid #a05a00', background: '#fff8e9', color: '#653c00', fontSize: 12, lineHeight: 1.4 }}>
          Draft jurisdiction-screening simulation only. Not a legal determination, export authorization, transaction clearance, or broad Parts 744/746 review.
        </div>
      </header>

      <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        <section aria-label="Route summary" style={{ ...card, padding: 14, display: 'grid', gridTemplateColumns: 'minmax(190px, .72fr) minmax(280px, 1.4fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted, #66717c)', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.08em' }}>Computed route</div>
            <div style={{ ...mono, marginTop: 5, fontSize: 30, fontWeight: 800, color: result.route === 'UNDETERMINED' ? '#a05a00' : '#176b45' }}>{result.route}</div>
            <div style={{ marginTop: 4, color: 'var(--muted, #66717c)', fontSize: 12 }}>{result.classification.length ? result.classification.join(', ') : result.openCandidates.length ? `Open: ${result.openCandidates.join(', ')}` : 'No specific classification closed'}</div>
          </div>
          <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            {result.routeBasis.map((basis) => <div key={basis} style={{ fontSize: 12, lineHeight: 1.4 }}>• {basis}</div>)}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <Badge label={result.claimClass} color="#315e7c" />
              <Badge label={result.claimCeiling} color={result.claimCeiling.startsWith('UNDETERMINED') ? '#a05a00' : '#315e7c'} />
              <Badge label={result.readiness} color={result.readiness.startsWith('HOLD') ? '#a05a00' : '#176b45'} />
            </div>
          </div>
        </section>

        <section aria-label="Ordered review route" style={{ ...card, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(118px, 1fr))`, gap: 7, overflowX: 'auto' }}>
            {result.stages.map((stage, index) => (
              <div key={stage.stage} style={{ minWidth: 118, padding: 9, borderRadius: 6, border: `1px solid ${stage.state === 'active' ? '#a05a00' : 'var(--line, #d8dde3)'}`, background: stage.state === 'not_reached' ? '#f0f2f4' : stage.state === 'active' ? '#fff8e9' : '#eef6f1', opacity: stage.state === 'not_reached' ? .62 : 1 }}>
                <div style={{ ...mono, fontSize: 10, color: 'var(--muted, #66717c)' }}>W{index + 1} · {statusLabel(stage.state)}</div>
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800 }}>{stageLabels[stage.stage]}</div>
                <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.35, color: 'var(--muted, #66717c)' }}>{stage.summary}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, .75fr)', gap: 12, alignItems: 'start' }}>
          <section aria-label="Candidate board" style={{ display: 'grid', gap: 8 }}>
            {result.candidates.map((candidate) => {
              const open = Boolean(expanded[candidate.candidateId]);
              return (
                <article key={candidate.candidateId} style={{ ...card, overflow: 'hidden', opacity: candidate.disposition === 'not_reached' ? .68 : 1 }}>
                  <button type="button" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [candidate.candidateId]: !open }))} style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', padding: 11, cursor: 'pointer', display: 'grid', gridTemplateColumns: 'minmax(130px, .55fr) minmax(180px, 1.4fr) auto', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <div>
                      <div style={{ ...mono, fontWeight: 800, fontSize: 12 }}>{candidate.provision}</div>
                      <div style={{ marginTop: 2, fontSize: 10, color: 'var(--muted, #66717c)' }}>{stageLabels[candidate.stage]}</div>
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--muted, #66717c)' }}>{candidate.whyConsidered}</div>
                    <Badge label={candidate.disposition} color={dispositionColor[candidate.disposition]} />
                  </button>
                  {open && (
                    <div style={{ borderTop: '1px solid var(--line, #d8dde3)', padding: 11, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        <ObservationColumn title="Advocate observations" rows={candidate.advocate} />
                        <ObservationColumn title="Judge observations" rows={candidate.judge} />
                      </div>
                      <div style={{ padding: 9, borderRadius: 5, background: 'var(--surface2, #f3f5f7)' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>Code reconciliation</div>
                        <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.4 }}>
                          {candidate.reconciliationNotes.length ? candidate.reconciliationNotes.join(' ') : `Recorded observations reconcile to ${candidate.disposition}.`}
                        </div>
                        {candidate.challenge && <div style={{ marginTop: 5, fontSize: 11 }}>Challenge: {candidate.challenge.text} <b>({candidate.challenge.resolution})</b></div>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <aside style={{ display: 'grid', gap: 10 }}>
            <section aria-labelledby="missing-evidence-title" style={{ ...card, padding: 12 }}>
              <div id="missing-evidence-title" style={{ fontSize: 12, fontWeight: 850 }}>Ranked missing evidence</div>
              <div style={{ marginTop: 3, fontSize: 11, color: 'var(--muted, #66717c)' }}>Questions are derived only from reached, indeterminate elements.</div>
              <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                {result.questions.length === 0 && <div style={{ padding: 9, borderRadius: 5, background: '#eef6f1', color: '#176b45', fontSize: 11 }}>No reached element is missing fixture evidence. Ready for counsel review, not cleared.</div>}
                {result.questions.map((question) => (
                  <div key={question.id} style={{ padding: 9, border: '1px solid #e8c687', borderRadius: 6, background: '#fffaf0' }}>
                    <div style={{ ...mono, fontSize: 10, color: '#a05a00', fontWeight: 800 }}>#{question.rank} · {question.impact} · {question.provision}</div>
                    <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.4 }}>{question.question}</div>
                    <div style={{ ...mono, marginTop: 5, fontSize: 9, color: 'var(--muted, #66717c)' }}>{question.factPath}</div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="fixture-facts-title" style={{ ...card, padding: 12 }}>
              <div id="fixture-facts-title" style={{ fontSize: 12, fontWeight: 850 }}>Fixture facts</div>
              <p style={{ margin: '4px 0 8px', color: 'var(--muted, #66717c)', fontSize: 11, lineHeight: 1.4 }}>{scenario.description}</p>
              {Object.entries(scenario.facts).map(([path, value]) => (
                <div key={path} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '5px 0', borderTop: '1px solid var(--line, #e3e7eb)', fontSize: 10 }}>
                  <span style={mono}>{path}</span><b style={{ color: value === 'unknown' ? '#a05a00' : '#176b45' }}>{String(value)}</b>
                </div>
              ))}
            </section>

            <details style={{ ...card, padding: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 850 }}>Coverage ceiling and exclusions</summary>
              <ul style={{ margin: '9px 0 0', paddingLeft: 17, display: 'grid', gap: 5, fontSize: 10, lineHeight: 1.4, color: 'var(--muted, #66717c)' }}>
                {result.exclusions.map((exclusion) => <li key={exclusion}>{exclusion}</li>)}
              </ul>
            </details>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', width: 'fit-content', padding: '3px 6px', borderRadius: 99, background: `${color}14`, border: `1px solid ${color}55`, color, fontSize: 9, fontWeight: 850, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{statusLabel(label)}</span>;
}

function ObservationColumn({ title, rows }: { title: string; rows: ReturnType<typeof runClassificationWorkspace>['candidates'][number]['advocate'] }) {
  return (
    <div style={{ border: '1px solid var(--line, #d8dde3)', borderRadius: 6, padding: 9 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
      {rows.length === 0 && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted, #66717c)' }}>Seated by code; no model observation.</div>}
      {rows.map((row) => (
        <div key={row.elementId} style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--line, #e3e7eb)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}><b style={{ fontSize: 10 }}>{row.label}</b><Badge label={row.disposition} color={row.disposition === 'met' ? '#176b45' : row.disposition === 'not_met' ? '#56616d' : '#a05a00'} /></div>
          <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.35, color: 'var(--muted, #66717c)' }}>{row.note}</div>
          <div style={{ ...mono, marginTop: 4, fontSize: 9 }}>{row.citation ? `${row.citation.unitKey} · verified excerpt` : 'no verified citation carried'}</div>
        </div>
      ))}
    </div>
  );
}
