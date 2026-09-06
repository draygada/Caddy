import { useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ClassificationClientError,
  evaluateClassification,
  type ClassificationCandidate,
  type ClassificationDetermination,
  type ClassificationItemKind,
} from '../lib/classification-client';
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
const card: CSSProperties = { border: '1px solid var(--line, #d8dde3)', borderRadius: 8, background: 'var(--surface, #fff)' };
const mono: CSSProperties = { fontFamily: 'Geist Mono, ui-monospace, monospace' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--line, #bcc4cc)', borderRadius: 6, background: 'var(--surface, #fff)', color: 'inherit', font: 'inherit' };

function label(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase();
}

export function ClassificationWorkspace() {
  const [description, setDescription] = useState('Commercial flight-control carrier for a small unmanned aircraft; no stated military integration.');
  const [factsText, setFactsText] = useState('{\n  "declared.military_use": "false",\n  "design.catalog_equivalent": "true"\n}');
  const [itemKind, setItemKind] = useState<ClassificationItemKind>('commodity');
  const [liveResult, setLiveResult] = useState<ClassificationDetermination | null>(null);
  const [liveState, setLiveState] = useState<'idle' | 'running' | 'valid' | 'error'>('idle');
  const [liveError, setLiveError] = useState<{ code: string; message: string } | null>(null);
  const requestSequence = useRef(0);

  const [scenarioId, setScenarioId] = useState(WORKSPACE_SCENARIOS[0].id);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'cand:1:USML-XI-c-2': true });
  const scenario = getWorkspaceScenario(scenarioId);
  const offline = useMemo(() => runClassificationWorkspace(scenario), [scenario]);

  async function runLive() {
    const sequence = ++requestSequence.current;
    setLiveState('running');
    setLiveError(null);
    let facts: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(factsText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Facts must be a JSON object.');
      facts = parsed as Record<string, unknown>;
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setLiveState('error');
      setLiveError({ code: 'REQUEST_INVALID', message: error instanceof Error ? error.message : 'Facts must be valid JSON.' });
      return;
    }

    try {
      const result = await evaluateClassification({ description, facts, item_kind: itemKind });
      if (sequence !== requestSequence.current) return;
      setLiveResult(result);
      setLiveState('valid');
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setLiveState('error');
      setLiveError(error instanceof ClassificationClientError
        ? { code: error.code, message: error.message }
        : { code: 'BACKEND_UNAVAILABLE', message: error instanceof Error ? error.message : 'Charlie engine request failed.' });
    }
  }

  return (
    <section aria-labelledby="classification-workspace-title" style={{ height: '100%', minHeight: 0, overflow: 'auto', background: 'var(--surface2, #f3f5f7)', color: 'var(--ink, #17202a)' }}>
      <header style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--line, #d8dde3)', background: 'linear-gradient(115deg, #f7f4ea 0%, #eef3f0 62%, #e8eef3 100%)' }}>
        <div style={{ ...mono, color: '#176b45', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Charlie engine · connected Candidate 0.2 service</div>
        <h2 id="classification-workspace-title" style={{ margin: '5px 0 4px', fontSize: 24 }}>Classification workspace</h2>
        <p style={{ margin: 0, maxWidth: 820, color: 'var(--muted, #5c6670)', fontSize: 13, lineHeight: 1.45 }}>
          Run the ordered USML → CCL → EAR99 jurisdiction engine and inspect its fact snapshot, reference pack, candidate board, schema- and byte-span-validated reference excerpts, and model-call provenance. Source authority and legal relevance are not verified.
        </p>
        <div role="note" style={{ marginTop: 12, padding: '9px 11px', borderLeft: '4px solid #a05a00', background: '#fff8e9', color: '#653c00', fontSize: 12, lineHeight: 1.4 }}>
          Jurisdiction-screening output only. Not legal advice, export authorization, transaction clearance, sanctions screening, or permission to ship.
        </div>
      </header>

      <div style={{ padding: 14, display: 'grid', gap: 16 }}>
        <section aria-labelledby="live-engine-title" style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--line, #d8dde3)', background: '#eef6f1', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, color: '#176b45', fontSize: 10, fontWeight: 850, letterSpacing: '.08em' }}>CONNECTED CANDIDATE 0.2 SERVICE · POST /api/classification</div>
              <h3 id="live-engine-title" style={{ margin: '4px 0 0', fontSize: 18 }}>Run Charlie engine</h3>
            </div>
            <Badge text={liveState === 'valid' ? 'contract valid' : liveState} color={liveState === 'valid' ? '#176b45' : liveState === 'error' ? '#a13b2a' : liveState === 'running' ? '#315e7c' : '#66717c'} />
          </div>
          <div style={{ padding: 14, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 750 }}>
              Product or part description
              <textarea aria-label="Product or part description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.45 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10, alignItems: 'start' }}>
              <label style={{ display: 'grid', gap: 5, minWidth: 0, fontSize: 11, fontWeight: 750 }}>
                Facts · JSON object
                <textarea aria-label="Classification facts JSON" value={factsText} onChange={(event) => setFactsText(event.target.value)} rows={5} spellCheck={false} style={{ ...input, ...mono, resize: 'vertical', lineHeight: 1.4, fontSize: 11 }} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 750 }}>
                Item kind
                <select aria-label="Classification item kind" value={itemKind} onChange={(event) => setItemKind(event.target.value as ClassificationItemKind)} style={input}>
                  <option value="commodity">Commodity</option>
                  <option value="software">Software</option>
                  <option value="technology">Technology</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={runLive} disabled={liveState === 'running'} style={{ border: 0, borderRadius: 6, padding: '10px 14px', background: '#176b45', color: '#fff', fontWeight: 850, cursor: liveState === 'running' ? 'wait' : 'pointer', opacity: liveState === 'running' ? .65 : 1 }}>
                {liveState === 'running' ? 'Running Charlie engine…' : 'Run Charlie engine'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--muted, #66717c)' }}>No synthetic fallback. Failed and stale requests never replace the last contract-valid result.</span>
            </div>
            {liveError && <div role="alert" style={{ padding: 10, border: '1px solid #dfaca3', borderRadius: 6, background: '#fff1ee', color: '#7b281b', fontSize: 11 }}><b style={mono}>{liveError.code}</b> · {liveError.message}{liveResult ? ' The last valid result remains below.' : ''}</div>}
          </div>
        </section>

        {liveResult
          ? <LiveDetermination result={liveResult} />
          : <section aria-label="No connected-service determination" style={{ ...card, padding: 14, color: 'var(--muted, #66717c)', fontSize: 12 }}>No connected-service determination has been accepted. The offline exercise below cannot populate this evidence area.</section>}

        <section aria-labelledby="offline-lab-title" style={{ borderTop: '4px solid #8b949d', paddingTop: 14 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 720 }}>
                <div style={{ ...mono, color: '#66717c', fontSize: 10, fontWeight: 850, letterSpacing: '.08em' }}>OFFLINE EXERCISE · NOT CONNECTED-SERVICE EVIDENCE</div>
                <h3 id="offline-lab-title" style={{ margin: '4px 0', fontSize: 18 }}>Synthetic ordered-route lab</h3>
                <p style={{ margin: 0, color: 'var(--muted, #66717c)', fontSize: 11, lineHeight: 1.45 }}>A deterministic teaching fixture for advocate, judge, reconciliation, and intentional EAR99 residual behavior. It never substitutes for a failed connected-service run.</p>
              </div>
              <label style={{ display: 'grid', gap: 5, minWidth: 260, fontSize: 10, fontWeight: 750 }}>
                Offline scenario
                <select aria-label="Offline synthetic scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} style={input}>
                  {WORKSPACE_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            <section aria-label="Offline route summary" style={{ ...card, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted, #66717c)', fontWeight: 750, textTransform: 'uppercase' }}>Synthetic route</div>
                <div style={{ ...mono, marginTop: 5, fontSize: 28, fontWeight: 800, color: offline.route === 'UNDETERMINED' ? '#a05a00' : '#176b45' }}>{offline.route}</div>
                <div style={{ fontSize: 11, color: 'var(--muted, #66717c)' }}>{offline.classification.join(', ') || `Open: ${offline.openCandidates.join(', ') || 'none'}`}</div>
              </div>
              <div style={{ display: 'grid', gap: 5 }}>{offline.routeBasis.map((basis) => <div key={basis} style={{ fontSize: 11 }}>• {basis}</div>)}<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge text={offline.claimCeiling} color="#a05a00" /><Badge text={offline.readiness} color="#315e7c" /></div></div>
            </section>

            <section aria-label="Offline ordered review route" style={{ ...card, padding: 12, overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(118px, 1fr))`, gap: 7, minWidth: 740 }}>
                {offline.stages.map((stage, index) => <div key={stage.stage} style={{ padding: 9, borderRadius: 6, border: `1px solid ${stage.state === 'active' ? '#a05a00' : 'var(--line, #d8dde3)'}`, background: stage.state === 'not_reached' ? '#f0f2f4' : stage.state === 'active' ? '#fff8e9' : '#eef6f1', opacity: stage.state === 'not_reached' ? .62 : 1 }}>
                  <div style={{ ...mono, fontSize: 9, color: 'var(--muted, #66717c)' }}>W{index + 1} · {label(stage.state)}</div>
                  <div style={{ marginTop: 4, fontSize: 10, fontWeight: 800 }}>{stageLabels[stage.stage]}</div>
                  <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted, #66717c)' }}>{stage.summary}</div>
                </div>)}
              </div>
            </section>

            <section aria-label="Offline candidate board" style={{ display: 'grid', gap: 8 }}>
              {offline.candidates.map((candidate) => {
                const open = Boolean(expanded[candidate.candidateId]);
                return <article key={candidate.candidateId} style={{ ...card, overflow: 'hidden', opacity: candidate.disposition === 'not_reached' ? .68 : 1 }}>
                  <button type="button" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [candidate.candidateId]: !open }))} style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', padding: 11, cursor: 'pointer', display: 'grid', gridTemplateColumns: 'minmax(120px, .5fr) minmax(180px, 1.4fr) auto', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <div><div style={{ ...mono, fontWeight: 800, fontSize: 11 }}>{candidate.provision}</div><div style={{ fontSize: 9, color: 'var(--muted, #66717c)' }}>{stageLabels[candidate.stage]}</div></div>
                    <div style={{ fontSize: 10, color: 'var(--muted, #66717c)' }}>{candidate.whyConsidered}</div>
                    <Badge text={candidate.disposition} color={dispositionColor[candidate.disposition]} />
                  </button>
                  {open && <div style={{ borderTop: '1px solid var(--line, #d8dde3)', padding: 11, fontSize: 10 }}>{candidate.reconciliationNotes.join(' ') || `Recorded fixture observations reconcile to ${candidate.disposition}.`}</div>}
                </article>;
              })}
            </section>

            <details style={{ ...card, padding: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 850 }}>Offline fixture facts, questions, and exclusions</summary>
              <p style={{ fontSize: 10 }}>{scenario.description}</p>
              <pre style={{ ...mono, overflowX: 'auto', fontSize: 9 }}>{JSON.stringify(scenario.facts, null, 2)}</pre>
              {offline.questions.map((question) => <div key={question.id} style={{ fontSize: 10, marginTop: 5 }}>#{question.rank} · {question.question}</div>)}
              <ul style={{ paddingLeft: 17, fontSize: 10, color: 'var(--muted, #66717c)' }}>{offline.exclusions.map((exclusion) => <li key={exclusion}>{exclusion}</li>)}</ul>
            </details>
          </div>
        </section>
      </div>
    </section>
  );
}

function LiveDetermination({ result }: { result: ClassificationDetermination }) {
  const decision = result.determination;
  return <section aria-labelledby="live-result-title" style={{ display: 'grid', gap: 10 }}>
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, color: '#176b45', fontSize: 10, fontWeight: 850 }}>{result.schema_version}</div>
          <h3 id="live-result-title" style={{ margin: '4px 0', fontSize: 20 }}>Last contract-valid result</h3>
          <div style={{ ...mono, fontSize: 28, fontWeight: 850, color: decision.jurisdiction === 'UNDETERMINED' ? '#a05a00' : '#176b45' }}>{decision.jurisdiction}</div>
          <div style={{ fontSize: 11 }}>{decision.classification.join(', ') || `Open: ${decision.open_candidates.join(', ') || 'no closed classification'}`}</div>
        </div>
        <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}><Badge text={`USML ${decision.usml_step}`} color="#315e7c" /><Badge text={`CCL ${decision.ccl_step}`} color="#315e7c" /><Badge text={result.item.item_kind} color="#66717c" /></div>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>{decision.basis.map((basis) => <div key={basis} style={{ fontSize: 11 }}>• {basis}</div>)}</div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 8 }}>
        <HashLine name="Snapshot" value={result.snapshot_sha256} /><HashLine name="Reference pack" value={result.pack_sha256} /><HashLine name="Part revision" value={result.item.part_revision_id ?? 'plain product description'} />
      </div>
    </div>
    <section aria-label="Connected-service candidate board" style={{ display: 'grid', gap: 8 }}>{result.candidates.map((candidate) => <LiveCandidate key={candidate.candidate_id} candidate={candidate} />)}</section>
    <section aria-labelledby="provenance-title" style={{ ...card, padding: 14 }}>
      <h4 id="provenance-title" style={{ margin: 0, fontSize: 14 }}>Execution provenance</h4>
      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 8 }}>
        <Metric name="Model" value={result.provenance.model || 'scripted / not reported'} /><Metric name="Calls" value={`${result.provenance.budget.calls_used} / ${result.provenance.budget.calls_cap}`} /><Metric name="Cost · micro-USD" value={`${result.provenance.budget.cost_used_microusd} / ${result.provenance.budget.cost_cap_microusd}`} /><Metric name="Dropped candidates" value={String(result.provenance.dropped_candidates.length)} />
      </div>
      <details style={{ marginTop: 10 }} open><summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 850 }}>Model calls · {result.provenance.calls.length}</summary><div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', marginTop: 7, fontSize: 9 }}><thead><tr><th>Stage</th><th>Provision</th><th>Prompt hash</th><th>Response hash</th><th>µUSD</th></tr></thead><tbody>{result.provenance.calls.map((call, index) => <tr key={`${call.prompt_sha256}:${index}`}><td>{call.stage}</td><td>{call.provision ?? 'proposal'}</td><td style={mono}>{call.prompt_sha256.slice(0, 16)}…</td><td style={mono}>{call.response_sha256 ? `${call.response_sha256.slice(0, 16)}…` : 'none'}</td><td>{call.cost_microusd}</td></tr>)}</tbody></table>
      </div></details>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
        <List title="Dropped candidates" empty="None" rows={result.provenance.dropped_candidates.map((row) => `${row.provision} · ${row.reason}`)} /><List title="Reference notes" empty="No reference notes" rows={result.provenance.reference_notes} />
      </div>
    </section>
  </section>;
}

function LiveCandidate({ candidate }: { candidate: ClassificationCandidate }) {
  return <details style={{ ...card, overflow: 'hidden' }} open={candidate.status === 'supported' || candidate.status === 'undetermined'}>
    <summary style={{ cursor: 'pointer', padding: 11, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
      <span><b style={{ ...mono, fontSize: 11 }}>{candidate.provision}</b><span style={{ marginLeft: 8, color: 'var(--muted, #66717c)', fontSize: 9 }}>{label(candidate.stage)} · {candidate.origin}</span></span><Badge text={candidate.status} color={dispositionColor[candidate.status]} />
    </summary>
    <div style={{ borderTop: '1px solid var(--line, #d8dde3)', padding: 11, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 10 }}>{candidate.why_considered || 'No consideration note supplied.'}</div>
      {candidate.why_rejected && <div style={{ padding: 8, background: '#f1f3f5', fontSize: 10 }}><b>Rejected:</b> {candidate.why_rejected}</div>}
      {candidate.elements.map((element) => <div key={element.element_id} style={{ padding: 9, border: '1px solid var(--line, #d8dde3)', borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 10 }}>{element.unit_key} · {element.element_id}</b><Badge text={`${element.disposition} · ${element.basis}`} color={element.disposition === 'met' ? '#176b45' : element.disposition === 'not_met' ? '#56616d' : '#a05a00'} /></div>
        <div style={{ ...mono, marginTop: 5, fontSize: 9 }}>Facts: {element.facts_relied_on.join(', ') || 'none recorded'}</div>
        {element.citation ? <div style={{ marginTop: 7, padding: 8, borderLeft: '3px solid #176b45', background: '#eef6f1' }}><div style={{ ...mono, color: '#176b45', fontSize: 9, fontWeight: 850 }}>SCHEMA- AND BYTE-SPAN VALIDATED · [{element.citation.start}, {element.citation.end}) · {element.citation.unit_sha256.slice(0, 16)}…</div><div style={{ marginTop: 4, fontSize: 10 }}>“{element.citation.quote}”</div><div style={{ marginTop: 5, color: '#56616d', fontSize: 9 }}>Source authority, currency, completeness, and legal relevance are not verified.</div></div> : <div style={{ marginTop: 6, color: '#a05a00', fontSize: 9 }}>No schema- and byte-span-validated reference excerpt carried.</div>}
      </div>)}
      {candidate.challenge && <div style={{ fontSize: 10 }}><b>Challenge:</b> {candidate.challenge.text} · {candidate.challenge.resolution}</div>}
      {candidate.reference_notes.map((note) => <div key={note} style={{ fontSize: 9, color: 'var(--muted, #66717c)' }}>Reference note · {note}</div>)}
    </div>
  </details>;
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ ...mono, display: 'inline-flex', width: 'fit-content', padding: '3px 6px', borderRadius: 99, background: `${color}14`, border: `1px solid ${color}55`, color, fontSize: 9, fontWeight: 850, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label(text)}</span>;
}
function HashLine({ name, value }: { name: string; value: string }) {
  return <div style={{ padding: 8, borderRadius: 5, background: 'var(--surface2, #f3f5f7)', minWidth: 0 }}><div style={{ fontSize: 9, fontWeight: 850 }}>{name}</div><div title={value} style={{ ...mono, marginTop: 3, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div></div>;
}
function Metric({ name, value }: { name: string; value: string }) {
  return <div style={{ padding: 9, border: '1px solid var(--line, #d8dde3)', borderRadius: 6 }}><div style={{ fontSize: 9, color: 'var(--muted, #66717c)', fontWeight: 800 }}>{name}</div><div style={{ ...mono, marginTop: 4, fontSize: 11, fontWeight: 800 }}>{value}</div></div>;
}
function List({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return <div><div style={{ fontSize: 10, fontWeight: 850 }}>{title}</div><div style={{ marginTop: 5, display: 'grid', gap: 4 }}>{rows.length ? rows.map((row, index) => <div key={`${row}:${index}`} style={{ fontSize: 9 }}>• {row}</div>) : <div style={{ fontSize: 9, color: 'var(--muted, #66717c)' }}>{empty}</div>}</div></div>;
}
