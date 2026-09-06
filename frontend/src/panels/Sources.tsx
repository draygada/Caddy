import { useState } from 'react';
import { useStore } from '../store';
import { DOCS, type SourceDocId } from '../lib/sources';
import { SLOT_LABEL, type Slot } from '../lib/catalog';

const DOC_IDS: SourceDocId[] = ['gx220-vendor-page', 'hg5700-brochure', 'lepton-datasheet'];

/** Sources panel: drop a datasheet, watch the network strip, see every claim go through the verifier; Call B candidates with the engine dry-run. */
export function Sources() {
  const s = useStore();
  const src = s.sources;
  const doc = src.doc ? DOCS[src.doc] : null;
  const [slot, setSlot] = useState<Slot>('imu');
  const accepted = src.proposals.filter((p) => p.verdict.ok);
  const rejected = src.proposals.filter((p) => !p.verdict.ok);
  return (
    <div role="dialog" aria-label="Sources" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[13px] font-semibold">Sources <span className="text-muted font-normal">· no number enters a rule unless it resolves to bytes</span></span>
          <span className="chip">{src.llmNote ? 'CACHED' : 'idle'}</span>
          {s.apiNote && <span className="text-[12px] text-amber">{s.apiNote}</span>}
        </div>
        <button onClick={() => s.patch({ sourcesOpen: false })} className="btn">Back to model · Esc</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="grid gap-3 content-start">
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Drop a datasheet or vendor page</div><span className="text-[12px] text-muted">fixtures · allowlisted fetcher</span></div>
            <div className="p-3 grid gap-2 text-[13px]">
              <label className="grid gap-1 text-muted">onto which part?<select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} className="field text-ink">{(['imu', 'thermal'] as Slot[]).map((x) => <option key={x} value={x}>{SLOT_LABEL[x]}</option>)}</select></label>
              <div className="flex gap-2 flex-wrap">
                {DOC_IDS.map((id) => <button key={id} onClick={() => s.dropDocument(id, DOCS[id].slot ?? slot)} className={'btn ' + (src.doc === id ? 'btn-primary' : '')}>{DOCS[id].title}{DOCS[id].poisoned ? ' ☠' : ''}</button>)}
              </div>
              <div className="text-[12px] text-muted">Call A returns unverified claims (field, value, unit, quote, byte span, sha). No classification field exists in the schema. The verifier checks span, parse and value in that order; only its accept constructs a typed Spec.</div>
            </div>
          </div>
          {doc && (
            <div className="panel">
              <div className="panel-head"><div className="panel-title">{doc.title}</div><span className="font-mono text-[12px] text-muted">sha {doc.sha}{doc.poisoned ? ' · POISONED FIXTURE' : ''}</span></div>
              <div className="p-3 grid gap-2 text-[13px]">
                <pre className="font-mono text-[12px] whitespace-pre-wrap leading-[1.5] p-2 rounded-r border border-line2 bg-surface2 m-0">
                  {doc.hidden ? (<>{doc.text.slice(0, doc.hidden[0])}<mark style={{ background: src.showHidden ? 'var(--amber)' : 'transparent', color: src.showHidden ? 'var(--black)' : 'var(--surface2)', transition: 'background .3s' }}>{doc.text.slice(doc.hidden[0], doc.hidden[1])}</mark>{doc.text.slice(doc.hidden[1])}</>) : doc.text}
                </pre>
                {doc.poisoned && <button onClick={() => s.patch({ sources: { ...src, showHidden: !src.showHidden } })} className="btn justify-self-start">{src.showHidden ? 'Hide hidden text' : 'Show hidden text'}</button>}
                {doc.poisoned && <div className="text-[12px] text-muted">The page carries an “EAR99” banner and a hidden line instructing the model to report 5 °/h. The banner has no path into a rule: the schema has no classification field. All three cached outcomes end at 7A002.a.1.a or at a REJECT.</div>}
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Network strip</div><span className="text-[12px] text-muted">allowlist: flir.com · aerospace.honeywell.com · invensense.tdk.com · u-blox.com · molicel.com</span></div>
            <div className="p-3 grid gap-1 font-mono text-[12px]">
              {src.network.length === 0 && <div className="text-muted">no requests yet</div>}
              {src.network.map((n, i) => <div key={i} style={{ color: n.status === 'BLOCKED' ? 'var(--red)' : 'var(--ink)' }}>{n.method} {n.host} · {n.status}{n.sha ? ' · sha ' + n.sha : ''}{n.status === 'BLOCKED' ? ' · not on the allowlist · logged' : ''}</div>)}
              <div className="text-muted mt-1">federalregister.gov stays off the allowlist for Call A and B; Call C reads it as a committed fixture.</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 content-start">
          {src.proposals.length > 0 && (
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Verifier</div><span className="font-mono text-[12px] text-muted">{accepted.length} ACCEPTED · {rejected.length} REJECTED</span></div>
              <div className="p-3 grid gap-2 text-[13px]">
                {src.proposals.map((p, i) => (
                  <div key={i} className="border border-line rounded-r p-2 grid gap-1" style={{ borderColor: p.verdict.ok ? 'var(--green)' : 'var(--red)' }}>
                    <div className="flex justify-between gap-2"><span className="font-semibold">{p.label} · {p.claim.field} = {p.claim.value} {p.claim.unit}</span><span className="font-mono font-bold" style={{ color: p.verdict.ok ? 'var(--green)' : 'var(--red)' }}>{p.verdict.ok ? 'ACCEPTED' : 'REJECT · ' + p.verdict.reason}</span></div>
                    <div className="font-mono text-[12px] text-muted">quote “{p.claim.quote}” · bytes {p.claim.start}–{p.claim.end} · sha {p.claim.doc_sha256}</div>
                    <div className="text-[12px] text-muted">{p.verdict.note}</div>
                    {p.verdict.ok && src.slot && (
                      <div className="flex gap-2 items-center flex-wrap">
                        <button onClick={() => s.applyExtraction(src.slot!, p.verdict.ok ? p.verdict.spec.field : '', p.claim.value, p.claim.unit)} disabled={s.viewSeq != null} className="btn btn-primary disabled:opacity-50">Apply to {SLOT_LABEL[src.slot]} · extracted_by extractor</button>
                        {s.extracted[src.slot + '.' + p.claim.field] && !s.extracted[src.slot + '.' + p.claim.field].verified && <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" onChange={() => s.markVerified(src.slot!, p.claim.field)} /> verified against the datasheet (human)</label>}
                        {s.extracted[src.slot + '.' + p.claim.field]?.verified && <span className="chip chip-sm">verified · L2</span>}
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
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Find a compliant alternative · {SLOT_LABEL[src.candidateNode]}</div><span className="text-[12px] text-muted">agent proposals re-checked by the rule engine · CACHED</span></div>
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
