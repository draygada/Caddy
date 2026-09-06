import { useState } from 'react';
import { useStore } from '../store';
import { DOCS, type SourceDocId } from '../lib/sources';
import { SLOT_LABEL, type Slot } from '../lib/catalog';
import { OperationsClient, OperationsServiceError, loadOperationsCandidateIdentity, utf8ByteSpan, type OperationsEnvelope, type ProvenanceAcceptEnvelope, type ProvenanceInspectEnvelope, type ProvenanceVerifyEnvelope, type UserProvidedSource } from '../lib/operations-client';
import { appendProductEvent } from '../lib/product-thread';

const DOC_IDS: SourceDocId[] = ['gx220-vendor-page', 'hg5700-brochure', 'lepton-datasheet'];

const SERVICE_PRESETS = {
  'gx220-vendor-page': { quote: '0.3 deg/h', field: 'gyro_bias_stability', value: 0.3, unit: 'deg/h' },
  'hg5700-brochure': { quote: '0.01 deg/h', field: 'gyro_bias_stability', value: 0.01, unit: 'deg/h' },
  'lepton-datasheet': { quote: '19,200 active pixels', field: 'active_pixels', value: 19200, unit: 'active pixels' },
  'fr-2026-16628': { quote: '3 hours', field: 'endurance_threshold', value: 3, unit: 'hours' },
} as const;

type ServiceDocumentId = keyof typeof SERVICE_PRESETS;

function sourceServiceError(error: unknown): string {
  return error instanceof OperationsServiceError ? `${error.code} · ${error.message}` : error instanceof Error ? error.message : 'Unknown service error';
}

function ServiceProvenance() {
  const [inputMode, setInputMode] = useState<'live-bounded' | 'offline-demo'>('live-bounded');
  const [documentId, setDocumentId] = useState<ServiceDocumentId>('gx220-vendor-page');
  const [liveId, setLiveId] = useState('operator-source-001');
  const [liveTitle, setLiveTitle] = useState('Operator-provided source');
  const [liveHost, setLiveHost] = useState('local-input');
  const [liveText, setLiveText] = useState('Rated endurance 4 hours under the stated test conditions.');
  const [liveQuote, setLiveQuote] = useState('4 hours');
  const [liveField, setLiveField] = useState('endurance');
  const [liveValue, setLiveValue] = useState(4);
  const [liveUnit, setLiveUnit] = useState('hours');
  const [client, setClient] = useState<OperationsClient | null>(null);
  const [inspected, setInspected] = useState<ProvenanceInspectEnvelope | null>(null);
  const [verified, setVerified] = useState<ProvenanceVerifyEnvelope | null>(null);
  const [accepted, setAccepted] = useState<ProvenanceAcceptEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const preset = SERVICE_PRESETS[documentId];
  const expectedDocumentId = inputMode === 'offline-demo' ? documentId : liveId;
  const claim = inputMode === 'offline-demo' ? preset : { quote: liveQuote, field: liveField, value: liveValue, unit: liveUnit };

  const currentClient = async () => {
    if (client) return client;
    const identity = await loadOperationsCandidateIdentity();
    const next = new OperationsClient(identity);
    setClient(next);
    return next;
  };
  const run = async (label: string, action: (value: OperationsClient) => Promise<void>) => {
    setBusy(label);
    setError(null);
    try { await action(await currentClient()); } catch (caught) { setError(sourceServiceError(caught)); } finally { setBusy(null); }
  };
  const evidence: OperationsEnvelope | null = accepted ?? verified ?? inspected ?? client?.getLastValid('provenance') ?? null;
  const inspect = () => run('inspect', async (api) => {
    const source: UserProvidedSource = { document_id: liveId, title: liveTitle, host: liveHost, retrieved_at: new Date().toISOString(), provided_by: 'operator:browser-demo', text: liveText };
    const value = await api.inspectSource(inputMode === 'offline-demo' ? documentId : source);
    setInspected(value);
    setVerified(null);
    setAccepted(null);
  });
  const verify = () => run('verify', async (api) => {
    if (!inspected || inspected.document.document_id !== expectedDocumentId) throw new OperationsServiceError('INSPECTION_REQUIRED', 'Inspect this exact document before verifying a span.');
    const span = utf8ByteSpan(inspected.document.text_with_quarantine, claim.quote);
    if (!span) throw new OperationsServiceError('QUOTE_NOT_FOUND', 'The exact quote is absent or quarantined in the inspected bytes.');
    const value = await api.verifySourceSpan({ document_id: expectedDocumentId, source_sha256: inspected.document.sha256, start: span.start, end: span.end, quote: claim.quote, field: claim.field, value: claim.value, unit: claim.unit });
    setVerified(value);
    setAccepted(null);
  });

  return (
    <section className="panel min-w-0 lg:col-span-2" aria-label="Service-backed source provenance">
      <div className="panel-head flex-wrap gap-2"><div className="panel-title">Source provenance <span className="sub">· exact client-carried bytes</span></div><span className="chip">{evidence ? evidence.status : 'not run'}</span></div>
      <div className="p-3 grid gap-3 text-[13px]">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-muted">source lane<select value={inputMode} onChange={(event) => { setInputMode(event.target.value as typeof inputMode); setInspected(null); setVerified(null); setAccepted(null); }} className="field text-ink"><option value="live-bounded">Candidate 0.2 service input, available when connected</option><option value="offline-demo">Offline demo fixtures</option></select></label>
          {inputMode === 'offline-demo' && <label className="grid gap-1 text-muted">Offline demo document<select value={documentId} onChange={(event) => { setDocumentId(event.target.value as ServiceDocumentId); setInspected(null); setVerified(null); setAccepted(null); }} className="field text-ink">{Object.keys(SERVICE_PRESETS).map((id) => <option key={id}>{id}</option>)}</select></label>}
          <button className="btn btn-primary" disabled={busy !== null} onClick={inspect}>{busy === 'inspect' ? 'Inspecting…' : 'Inspect + verify source hash'}</button>
          <button className="btn disabled:opacity-40" disabled={!inspected || busy !== null} onClick={verify}>{busy === 'verify' ? 'Rereading…' : `Verify exact span · ${claim.quote}`}</button>
          <button className="btn disabled:opacity-40" disabled={!verified || busy !== null} onClick={() => run('accept', async (api) => {
            const value = await api.acceptVerifiedChange(verified!.verification.receipt_sha256, verified!.verification.field);
            setAccepted(value);
            await appendProductEvent({
              sourceLane: 'sources',
              eventType: 'sources.change_accepted_for_local_review',
              summary: `${value.change.target} = ${value.change.value} ${value.change.unit}; CAD mutation ${String(value.change.mutated_cad)}.`,
              actorId: 'operator:browser-demo',
              actorAttestation: 'OPERATOR_ACTION_RECORDED',
              revisionId: value.candidate.revision_id,
              artifacts: [
                { artifactId: `source:${verified!.verification.document_id}`, kind: 'source-document', sha256: verified!.verification.source_sha256 },
                { artifactId: `verification:${verified!.verification.document_id}`, kind: 'source-verification-receipt', sha256: value.change.receipt_sha256 },
              ],
              payload: { field: value.change.target, value: value.change.value, unit: value.change.unit, mutatedCad: value.change.mutated_cad, claimCeiling: value.claim_ceiling },
            });
          })}>Accept for local review</button>
        </div>
        {inputMode === 'live-bounded' && (
          <div className="border border-line2 rounded-r p-3 grid gap-2" aria-label="Candidate 0.2 source service input, available when connected">
            <div className="flex flex-wrap justify-between gap-2"><b>User-provided source bytes</b><span className="text-[12px] text-muted">no fetch · no authority/freshness claim · instruction-like content quarantines</span></div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
              <label className="grid gap-1 text-muted">document ID<input value={liveId} onChange={(event) => setLiveId(event.target.value)} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">title<input value={liveTitle} onChange={(event) => setLiveTitle(event.target.value)} className="field text-ink" /></label>
              <label className="grid gap-1 text-muted">source locator<input value={liveHost} onChange={(event) => setLiveHost(event.target.value)} className="field text-ink" /></label>
            </div>
            <label className="grid gap-1 text-muted">source text<textarea value={liveText} onChange={(event) => setLiveText(event.target.value)} rows={4} className="field text-ink resize-y" /></label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
              <label className="grid gap-1 text-muted">exact numeric quote<input value={liveQuote} onChange={(event) => setLiveQuote(event.target.value)} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">target field<input value={liveField} onChange={(event) => setLiveField(event.target.value)} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">numeric value<input type="number" value={liveValue} onChange={(event) => setLiveValue(Number(event.target.value))} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">unit<input value={liveUnit} onChange={(event) => setLiveUnit(event.target.value)} className="field font-mono text-ink" /></label>
            </div>
          </div>
        )}
        {inputMode === 'offline-demo' && <div className="border border-amber rounded-r p-2 text-[12px] text-amber"><b>Offline demo.</b> These four committed fixtures demonstrate byte checking and quarantine only; they are not a broad or current source corpus.</div>}
        {client && <div className="font-mono text-[12px] break-all text-muted">candidate {client.candidate.candidate_id} · {client.candidate.revision_id} · snapshot {client.candidate.snapshot_sha256}</div>}
        {error && <div role="alert" className="border border-red rounded-r p-2 text-red"><b>Service evidence not replaced.</b> {error}{evidence ? ' · Last valid result remains below.' : ''}</div>}
        {inspected && (
          <div className="grid gap-2">
            <div className="font-mono text-[12px] break-all">{inspected.document.document_id} · {inspected.document.bytes} bytes · {inspected.document.sha256} · network performed {String(inspected.document.network.performed)}</div>
            <pre className="font-mono text-[12px] whitespace-pre-wrap break-words leading-[1.5] p-2 rounded-r border border-line2 bg-surface2 m-0">{inspected.document.text_with_quarantine}</pre>
            {inspected.document.quarantined_ranges.length > 0 && <div className="text-amber">{inspected.document.quarantined_ranges.length} prompt-like byte range quarantined and ineligible for verification.</div>}
          </div>
        )}
        {verified && <div className="border border-line rounded-r p-2 font-mono text-[12px] break-all">BYTE REREAD VERIFIED · {verified.verification.start}–{verified.verification.end} · receipt {verified.verification.receipt_sha256}</div>}
        {accepted && <div className="border border-line rounded-r p-2 text-[12px]"><b>{accepted.status}</b> · {accepted.change.target} = {accepted.change.value} {accepted.change.unit} · mutated CAD: {String(accepted.change.mutated_cad)}</div>}
        {evidence && <div className="border-t border-line2 pt-2 grid gap-1 text-[12px] text-muted"><div><b className="text-ink">Claim ceiling:</b> {evidence.claim_ceiling}</div><div className="font-mono break-all">corpus {evidence.corpus.corpus_sha256} · {Object.keys(evidence.source_hashes).length} committed source hashes</div>{evidence.limitations.map((item) => <div key={item}>· {item}</div>)}</div>}
        {!evidence && <div className="text-[12px] text-muted">Requires the mounted provenance adapter. No cached extractor result below is substituted for service evidence.</div>}
      </div>
    </section>
  );
}

/** Sources panel: inspect cached extractor proposals, their fixture-span checks, and Call B catalog candidates with an engine dry-run. */
export function Sources() {
  const s = useStore();
  const src = s.sources;
  const doc = src.doc ? DOCS[src.doc] : null;
  const [slot, setSlot] = useState<Slot>('imu');
  const accepted = src.proposals.filter((p) => p.verdict.ok);
  const rejected = src.proposals.filter((p) => !p.verdict.ok);
  return (
    <div role="dialog" aria-label="Sources" className="absolute inset-0 bg-bg z-[8] flex flex-col overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface flex-wrap">
        <div className="flex min-w-0 items-baseline gap-3 flex-wrap">
          <span className="min-w-0 break-words text-[13px] font-semibold">Sources <span className="text-muted font-normal">· service provenance + offline extractor lab</span></span>
          <span className="chip">{src.llmNote ? 'CACHED' : 'idle'}</span>
          {s.apiNote && <span className="min-w-0 break-words text-[12px] text-amber">{s.apiNote}</span>}
        </div>
        <button onClick={() => s.patch({ sourcesOpen: false })} className="btn">Back to model · Esc</button>
      </div>
      <div className="grid flex-1 min-h-0 min-w-0 grid-cols-1 content-start gap-4 overflow-y-auto overflow-x-hidden p-4 [overflow-wrap:anywhere] lg:grid-cols-2">
        <ServiceProvenance />
        <div className="grid min-w-0 gap-3 content-start">
          <div className="panel min-w-0">
            <div className="panel-head flex-wrap gap-2"><div className="panel-title min-w-0">Offline lab · drop a datasheet or vendor page</div><span className="min-w-0 text-[12px] text-muted">cached fixtures · never service evidence</span></div>
            <div className="p-3 grid gap-2 text-[13px]">
              <label className="grid min-w-0 gap-1 text-muted">onto which part?<select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} className="field min-w-0 w-full text-ink">{(['imu', 'thermal'] as Slot[]).map((x) => <option key={x} value={x}>{SLOT_LABEL[x]}</option>)}</select></label>
              <div className="flex gap-2 flex-wrap">
                {DOC_IDS.map((id) => <button key={id} onClick={() => s.dropDocument(id, DOCS[id].slot ?? slot)} className={'btn whitespace-normal text-left ' + (src.doc === id ? 'btn-primary' : '')}>{DOCS[id].title}{DOCS[id].poisoned ? ' ☠' : ''}</button>)}
              </div>
              <div className="text-[12px] text-muted">Call A returns unverified claims (field, value, unit, quote, fixture string start/end, synthetic fixture marker). No classification field exists in the schema. The checker compares the selected cached string, parse and value in that order; its accept constructs a typed Spec but does not establish human review.</div>
            </div>
          </div>
          {doc && (
            <div className="panel min-w-0">
              <div className="panel-head flex-wrap gap-2"><div className="panel-title min-w-0">{doc.title}</div><span className="min-w-0 break-all font-mono text-[12px] text-muted">synthetic fixture marker {doc.sha}{doc.poisoned ? ' · POISONED FIXTURE' : ''}</span></div>
              <div className="p-3 grid gap-2 text-[13px]">
                <pre className="min-w-0 font-mono text-[12px] whitespace-pre-wrap break-words leading-[1.5] p-2 rounded-r border border-line2 bg-surface2 m-0">
                  {doc.hidden ? (<>{doc.text.slice(0, doc.hidden[0])}<mark style={{ background: src.showHidden ? 'var(--amber)' : 'transparent', color: src.showHidden ? 'var(--black)' : 'var(--surface2)', transition: 'background .3s' }}>{doc.text.slice(doc.hidden[0], doc.hidden[1])}</mark>{doc.text.slice(doc.hidden[1])}</>) : doc.text}
                </pre>
                {doc.poisoned && <button onClick={() => s.patch({ sources: { ...src, showHidden: !src.showHidden } })} className="btn justify-self-start">{src.showHidden ? 'Hide hidden text' : 'Show hidden text'}</button>}
                {doc.poisoned && <div className="text-[12px] text-muted">The page carries an “EAR99” banner and a hidden line instructing the model to report 5 °/h. The banner has no path into a rule: the schema has no classification field. All three cached outcomes end at 7A002.a.1.a or at a REJECT.</div>}
              </div>
            </div>
          )}
          <div className="panel min-w-0">
            <div className="panel-head flex-wrap gap-2"><div className="panel-title min-w-0">Network strip</div><span className="min-w-0 break-words text-[12px] text-muted">allowlist: flir.com · aerospace.honeywell.com · invensense.tdk.com · u-blox.com · molicel.com</span></div>
            <div className="grid min-w-0 gap-1 break-words p-3 font-mono text-[12px]">
              {src.network.length === 0 && <div className="text-muted">no requests yet</div>}
              {src.network.map((n, i) => <div key={i} style={{ color: n.status === 'BLOCKED' ? 'var(--red)' : 'var(--ink)' }}>{n.method} {n.host} · {n.status}{n.sha ? ' · synthetic marker ' + n.sha : ''}{n.status === 'BLOCKED' ? ' · not on the allowlist · logged' : ''}</div>)}
              <div className="text-muted mt-1">federalregister.gov stays off the allowlist for Call A and B; Call C reads it as a committed fixture.</div>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 content-start">
          {src.proposals.length > 0 && (
            <div className="panel min-w-0">
              <div className="panel-head flex-wrap gap-2"><div className="panel-title min-w-0">Verifier</div><span className="font-mono text-[12px] text-muted">{accepted.length} ACCEPTED · {rejected.length} REJECTED</span></div>
              <div className="p-3 grid gap-2 text-[13px]">
                {src.proposals.map((p, i) => (
                  <div key={i} className="border border-line rounded-r p-2 grid gap-1" style={{ borderColor: p.verdict.ok ? 'var(--green)' : 'var(--red)' }}>
                    <div className="flex flex-wrap justify-between gap-2"><span className="min-w-0 font-semibold">{p.label} · {p.claim.field} = {p.claim.value} {p.claim.unit}</span><span className="min-w-0 font-mono font-bold" style={{ color: p.verdict.ok ? 'var(--green)' : 'var(--red)' }}>{p.verdict.ok ? 'ACCEPTED' : 'REJECT · ' + p.verdict.reason}</span></div>
                    <div className="min-w-0 break-words font-mono text-[12px] text-muted">quote “{p.claim.quote}” · fixture string characters {p.claim.start}–{p.claim.end} · synthetic marker {p.claim.doc_sha256}</div>
                    <div className="text-[12px] text-muted">{p.verdict.note}</div>
                    {p.verdict.ok && src.slot && (
                      <div className="flex gap-2 items-center flex-wrap">
                        <button onClick={() => s.applyExtraction(src.slot!, p)} disabled={s.viewSeq != null} className="btn btn-primary disabled:opacity-50">Apply accepted span to {SLOT_LABEL[src.slot]} · extractor</button>
                        {s.extracted[src.slot + '.' + p.claim.field] && s.extracted[src.slot + '.' + p.claim.field].acceptance === 'NONE' && <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" onChange={(event) => { if (event.currentTarget.checked) s.acknowledgeExtraction(src.slot!, p.claim.field); }} /> Acknowledge unauthenticated browser-session acceptance · memory only · no identity</label>}
                        {s.extracted[src.slot + '.' + p.claim.field]?.acceptance === 'UNAUTHENTICATED_BROWSER_SESSION' && <span className="chip chip-sm">SESSION ACCEPTED · MEMORY ONLY · NO IDENTITY · NOT HUMAN REVIEW</span>}
                      </div>
                    )}
                  </div>
                ))}
                {doc?.poisoned && <div className="text-[13px] font-semibold">{src.proposals.filter((p) => p.claim.field === 'bias').length} of {src.proposals.filter((p) => p.claim.field === 'bias').length} outcomes end at 7A002.a.1.a or REJECT. The EAR99 claim on the page had no path into the rule.</div>}
                <div className="text-[12px] text-muted">two REJECT reasons shown; zero obeyed, and if one had, here is the rejection it would have hit · never “model robustness”</div>
              </div>
            </div>
          )}
          {src.candidates.length > 0 && src.candidateNode && (
            <div className="panel min-w-0">
              <div className="panel-head flex-wrap gap-2"><div className="panel-title min-w-0">Find a compliant alternative · {SLOT_LABEL[src.candidateNode]}</div><span className="min-w-0 text-[12px] text-muted">agent proposals re-checked by the rule engine · CACHED</span></div>
              <div className="p-3 grid gap-2 text-[13px]">
                {src.candidates.map((c) => (
                  <div key={c.pid} className="border border-line rounded-r p-2 grid gap-1" style={{ borderColor: c.state === 'green' ? 'var(--green)' : c.state === 'grey' ? 'var(--line)' : 'var(--grey)' }}>
                    <div className="flex justify-between gap-2 flex-wrap"><span className="font-semibold">{c.name}</span><span className="font-mono font-bold" style={{ color: c.state === 'green' ? 'var(--green)' : c.state === 'grey' ? 'var(--muted)' : 'var(--grey)' }}>{c.state}</span></div>
                    <div className="text-[12px]">{c.why}</div>
                    <div className="font-mono text-[12px] text-muted">{c.net.map((n) => n.method + ' ' + n.host + ' · ' + n.status).join(' · ')} · {c.verdict}</div>
                    <div className="text-[12px] text-muted">price {c.priceDelta >= 0 ? '+' : ''}{c.priceDelta.toFixed(0)} USD · {c.stock} · origin {c.origin} <span className="chip chip-sm">declared</span> · {c.dutyNote}</div>
                    <button onClick={() => s.acceptCandidate(src.candidateNode!, c.pid)} disabled={c.state === 'abstained' || s.viewSeq != null} className="btn btn-primary justify-self-start disabled:opacity-40">Accept · a human part_swapped, then attest</button>
                  </div>
                ))}
                <div className="text-[12px] text-muted">the agent proposes · never “the tool finds compliant parts”</div>
              </div>
            </div>
          )}
          {src.proposals.length === 0 && src.candidates.length === 0 && <div className="text-[13px] text-muted p-3">Drop a document on the left, or open Reasoning and press “Find a compliant alternative” on a fired rule.</div>}
        </div>
      </div>
    </div>
  );
}
