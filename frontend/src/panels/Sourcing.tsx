import { useEffect, useMemo, useState } from 'react';
import { useStore, designHashOf, ROUND_RAIL, INTAKE_DEFAULT, type Intake, type Round } from '../store';
import type { Outcome } from '../lib/rules';
import { GENERIC_NAME, type Slot } from '../lib/catalog';
import { THUMBS, AF_THUMB } from '../lib/geometry';
import { CHECKLIST, CLAIM_COST, CLAIM_OFFER, CLAIM_PACKAGE, CLAIM_SCREEN, DECLINE_REASONS, FIXTURES, SHIP_TO, STATUS_COLOR, STATUS_WORD, WARNINGS, escalationReason, gateFor, sortOffers, supplierQuestions, type DeclineReason, type Line, type Mode, type PartyNode, type ResolvedOffer, type ShipTo } from '../lib/sourcing';

const usd = (v: number | null | undefined) => (v == null ? 'rate not verified' : v.toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
const FEDERAL_BUYER_CLASSES = ['radio', 'motor', 'thermal_imager', 'ic', 'board', 'cell', 'pack', 'gnss', 'esc'];

function Party({ n, depth = 0 }: { n: PartyNode; depth?: number }) {
  const color = n.screening === 'exact' || n.screening === 'normalized' ? 'var(--red)' : n.unknown ? 'var(--amber)' : 'var(--muted)';
  return (
    <div style={{ paddingLeft: depth * 14 }} className="grid gap-[2px] py-[3px]">
      <div className="flex gap-2 items-baseline text-[13px]"><span className="chip chip-sm">{n.role}</span><span className={n.unknown ? 'text-amber' : ''}>{n.name}{n.pct != null ? <span className="text-muted"> · {n.pct} %</span> : null}</span></div>
      <div className="font-mono text-[12px]" style={{ color }}>screening: {n.screening}{n.listed ? ' · ' + n.listed : ''}</div>
      {n.children.map((c, i) => <Party key={i} n={c} depth={depth + 1} />)}
    </div>
  );
}

/** What picking this seller changes: the gate, the duty layers, the federal-buyer flag, the screening status. Rendered, never decided. */
function consequences(ro: ResolvedOffer, line: Line, round: Round, o: Outcome): { tone: string; text: string }[] {
  const out: { tone: string; text: string }[] = [];
  const it = round.intake;
  if (it.endUser === 'military or defense prime') out.push({ tone: 'var(--amber)', text: 'declared end user: military or defense prime · 15 CFR 744.21 military end-use review applies for CN, RU, VE destinations · prime flow-down sets the full ownership walk on every line' });
  if (!it.civilProduct && line.partClass === 'thermal_imager') out.push({ tone: 'var(--amber)', text: 'not declared a civil product · the 6A003 “embedded in a civil product” clause is printed, not evaluated' });
  if (it.usedOn === 'listed military aircraft') out.push({ tone: 'var(--black)', text: 'declared used on a listed military aircraft · VIII(h)(1) via 120.41(a)(2) · the (b)(3) open fact is a question the engineer owns · every destination reads DDTC' });
  if (it.bvlos) out.push({ tone: 'var(--muted)', text: 'declared BVLOS operation · an operating declaration, not a rule input this weekend' });
  const gate = gateFor(line, o, round.shipTo);
  if (round.shipTo !== 'US') out.push({ tone: gate.blocks ? 'var(--red)' : gate.word === 'STA' ? 'var(--amber)' : 'var(--green)', text: 'export gate to ' + round.shipTo + ': ' + gate.word + ' · ' + gate.para + (gate.blocks ? ' · the package is blocked until you type and attest an authorization reference' : '') });
  out.push({ tone: STATUS_COLOR[ro.status], text: STATUS_WORD[ro.status] + ' · ' + ro.because });
  const fired = ro.ladder.rows.filter((r) => r.amount != null && r.amount > 0 && r.layer !== 'MPF' && r.layer !== 'HMF' && !r.layer.startsWith('base'));
  if (ro.ladder.domestic) out.push({ tone: 'var(--muted)', text: 'ships from the US · no entry, no duty layers' });
  else {
    out.push({ tone: 'var(--amber)', text: '$ enters the US from ' + ro.offer.shipFrom + ' · landed ' + usd(ro.ladder.perUnit) + ' per unit' + (fired.length ? ' · ' + fired.map((r) => r.layer + ' ' + r.rate).join(' · ') : ' · no Chapter 99 add-on for origin ' + ro.offer.declaredOrigin) + ' · estimate' });
    const mpf = ro.ladder.rows.find((r) => r.layer === 'MPF');
    if (mpf?.note.includes('minimum')) out.push({ tone: 'var(--amber)', text: '$ MPF minimum applied (' + usd(mpf.amount) + ') · on a small order the fee outweighs the duty' });
  }
  if (ro.offer.declaredOrigin === 'CN' && FEDERAL_BUYER_CLASSES.includes(line.partClass)) out.push({ tone: 'var(--amber)', text: 'federal-buyer flag · PRC-origin ' + line.partClass + ' · §848, American Security Drone Act, FCC Covered List · amber, never red · who may buy the finished product, separate from export control' });
  if (ro.offer.declaredEccn !== line.declaredEccn.split(' · ')[0] && !/declared by seller|no part|not yet/.test(line.declaredEccn)) out.push({ tone: 'var(--amber)', text: 'seller declares ECCN ' + ro.offer.declaredEccn + ' where the manufacturer declared ' + line.declaredEccn.split(' · ')[0] + ' · classification conflict between sellers · escalation' });
  if (ro.offer.synthetic) out.push({ tone: 'var(--grey)', text: 'SYNTHETIC seller · a fixture, badged and said aloud' });
  if (ro.offer.stock === 0) out.push({ tone: 'var(--muted)', text: 'no stock · lead ' + ro.offer.leadDays + ' days · quote' });
  return out;
}

export function Sourcing({ o }: { o: Outcome }) {
  const s = useStore();
  const r = s.round;
  const [shipTo, setShipTo] = useState<ShipTo>('US');
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<Mode>('air');
  const [intake, setIntake] = useState<Intake>(INTAKE_DEFAULT);
  const [stage, setStage] = useState<number>(-1); // -1 idle · 0..3 running · 4 done
  const [k, setK] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, DeclineReason>>({});
  const [attestor, setAttestor] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'none' | 'owners' | 'estimate'>('none');
  const [adj, setAdj] = useState<{ offerId: string; role: 'analyst' | 'empowered_official'; reason: string; rationale: string; action: 'false_positive' | 'resolve' | 'pin' } | null>(null);
  const [refDraft, setRefDraft] = useState('');
  const [decl, setDecl] = useState({ personStatus: 'foreign person' as 'US person' | 'foreign person', sharing: 'assembly drawings and the BOM', reference: '' });
  const [askOpen, setAskOpen] = useState(false);
  const stale = useMemo(() => (r ? designHashOf(s.snapshot()) !== r.designHash : false), [r, s]);
  const close = () => s.patch({ sourcingOpen: false });
  const n = r?.lines.length ?? 0;
  // start at the first part without a selection
  useEffect(() => { if (r && k == null && stage >= 4) { const i = r.lines.findIndex((l) => !r.selections[l.id]); setK(i < 0 ? n : i); } if (!r) { setK(null); setStage(-1); } if (r && stage === -1 && k == null) setStage(4); }, [r, k, n, stage]);
  useEffect(() => { if (stage >= 0 && stage < 4) { const id = setTimeout(() => setStage(stage + 1), 550); return () => clearTimeout(id); } }, [stage]);
  useEffect(() => { setPick(null); setReasons({}); setErr(null); setTab('none'); setAdj(null); setRefDraft(''); }, [k]);

  const rail = r && (
    <div className="flex items-center gap-1 flex-wrap">
      {ROUND_RAIL.map((st, i) => { const idx = ROUND_RAIL.findIndex((x) => x.status === r.status); const done = i <= idx; return <span key={st.status} className="chip" style={{ color: done ? 'var(--accentfg)' : 'var(--muted)', background: done ? 'var(--accent)' : 'transparent', borderColor: done ? 'var(--accent)' : 'var(--line)' }}>{st.label}</span>; })}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface flex-wrap">
      <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
        <span className="text-[13px] font-semibold">Sourcing <span className="text-muted font-normal">· part by part</span></span>
        {r && <span className="font-mono text-[13px]">{r.id} · design state #{r.designSeq}</span>}
        {r && <span className="chip">ship-to {r.shipTo}</span>}{r && <span className="chip">qty {r.qty}</span>}{r && <span className="chip">{r.mode}</span>}
        {rail}
      </div>
      <button onClick={close} className="btn">Back to model · Esc</button>
    </div>
  );

  if (!r || k == null) {
    const stages = [
      { label: 'resolve offers', detail: 'committed catalog · ' + FIXTURES.offers },
      { label: 'walk owners', detail: 'seller and manufacturer · full walk where controlled, foreign or flagged · ' + FIXTURES.ownership },
      { label: 'screen every name', detail: 'Consolidated Screening List · exact and suffix-normalised · ' + FIXTURES.csl },
      { label: 'estimate landed cost', detail: 'declared code × origin × dated tariff table · ' + FIXTURES.tariff },
    ];
    const running = stage >= 0 && stage < 4;
    const start = () => { setStage(0); s.openRound(shipTo, qty, mode, intake); };
    const counts = r ? { offers: Object.values(r.offers).flat().length, blocked: Object.values(r.offers).flat().filter((x) => x.status === 'review_blocked').length, review: Object.values(r.offers).flat().filter((x) => x.status === 'review_required').length } : null;
    return (
      <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
        {header}
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Before the search runs</div><span className="text-[12px] text-muted">declared facts · badged, never inferred</span></div>
            <div className="p-3 grid gap-3 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-muted">what is the product for?<select value={intake.endUse} onChange={(e) => setIntake({ ...intake, endUse: e.target.value as Intake['endUse'] })} className="field text-ink" disabled={running}>{['civil survey and mapping', 'agriculture', 'public safety', 'infrastructure inspection', 'defense-adjacent research', 'other'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">who is the end user?<select value={intake.endUser} onChange={(e) => setIntake({ ...intake, endUser: e.target.value as Intake['endUser'] })} className="field text-ink" disabled={running}>{['commercial operator', 'university', 'government agency (civil)', 'military or defense prime', 'unknown'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">where does it ship?<select value={shipTo} onChange={(e) => setShipTo(e.target.value as ShipTo)} className="field text-ink" disabled={running}>{SHIP_TO.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
                <label className="grid gap-1 text-muted">is the pod used on an aircraft?<select value={intake.usedOn} onChange={(e) => setIntake({ ...intake, usedOn: e.target.value as Intake['usedOn'] })} className="field text-ink" disabled={running}>{['none', 'in-production unlisted aircraft', 'listed military aircraft'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">units<input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(500, +e.target.value || 1)))} className="field font-mono text-ink" disabled={running} /></label>
                <label className="grid gap-1 text-muted">transport<select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="field text-ink" disabled={running}><option value="air">air</option><option value="ocean">ocean</option></select></label>
              </div>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2"><input type="checkbox" checked={intake.civilProduct} onChange={(e) => setIntake({ ...intake, civilProduct: e.target.checked })} disabled={running} /> declared a civil product <span className="chip chip-sm">declared</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={intake.bvlos} onChange={(e) => setIntake({ ...intake, bvlos: e.target.checked })} disabled={running} /> beyond visual line of sight</label>
              </div>
              <input aria-label="notes" placeholder="anything else about the use case · one line, goes on the round" value={intake.notes} onChange={(e) => setIntake({ ...intake, notes: e.target.value })} className="field" disabled={running} />
              <div className="text-[12px] text-muted">These answers are declared facts. They print on the round and beside every pick; they do not change what the rule engine computed for the design.</div>
              <button onClick={start} disabled={s.viewSeq != null || running} className="btn btn-primary btn-lg justify-self-start disabled:opacity-50">Run the search · source this design</button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">The pipeline</div><span className="text-[12px] text-muted">{running ? 'running' : r ? 'done' : 'idle'}</span></div>
            <div className="p-3 grid gap-2 text-[13px]">
              {stages.map((st, i) => {
                const state = stage < 0 ? 'idle' : i < stage ? 'done' : i === stage ? 'running' : 'waiting';
                return (
                  <div key={st.label} className="grid grid-cols-[18px_1fr] gap-2 items-start">
                    <span className="mt-[3px] w-[14px] h-[14px] rounded-full border flex items-center justify-center text-[10px]" style={{ borderColor: state === 'done' ? 'var(--accent)' : 'var(--line)', background: state === 'done' ? 'var(--accent)' : state === 'running' ? 'var(--focus)' : 'transparent', color: 'var(--accentfg)' }}>{state === 'done' ? '✓' : ''}</span>
                    <span><b style={{ color: state === 'waiting' || state === 'idle' ? 'var(--muted)' : 'var(--ink)' }}>{st.label}</b><br /><span className="text-[12px] text-muted">{st.detail}</span>
                      {state === 'done' && counts && i === 0 && <><br /><span className="font-mono text-[12px]">{r!.lines.length} lines · {counts.offers} offers</span></>}
                      {state === 'done' && counts && i === 2 && <><br /><span className="font-mono text-[12px]">{counts.blocked} review blocked · {counts.review} review required</span></>}
                      {state === 'done' && counts && i === 3 && <><br /><span className="font-mono text-[12px]">{counts.offers} ladders · every layer dated</span></>}
                    </span>
                  </div>
                );
              })}
              <div className="text-[12px] text-muted border-t border-line2 pt-2">no model on this path · every stage is a pure function over dated fixtures · the agent may only propose on the escalation lane</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const done = k >= n;
  const line = done ? null : r.lines[k];
  const list = line ? sortOffers(r.offers[line.id] || []) : [];
  const sel = line ? r.selections[line.id] : undefined;
  const picked = list.find((x) => x.offer.id === (pick ?? sel?.offerId));
  const gate = line ? gateFor(line, o, r.shipTo) : null;
  const slot = line?.slot ?? null;
  const thumb = slot ? (s.parts[slot] ? THUMBS[s.parts[slot]!] : null) : line?.id === 'l-frame' ? AF_THUMB : null;
  const selectedCount = Object.keys(r.selections).length;

  const confirm = () => {
    if (!line || !picked) return;
    const e = s.selectOffer(line.id, picked.offer.id, attestor, reasons);
    setErr(e);
    if (!e) setTimeout(() => setK(k + 1), 250);
  };

  return (
    <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      {header}
      {stale && (
        <div role="status" className="px-4 py-2 border-b border-line2 bg-surface2 text-[13px] flex justify-between items-center gap-3 flex-wrap">
          <span className="text-amber font-semibold">the design changed after this round opened (#{r.designSeq}) · this round stays openable; a new round names it</span>
          <button onClick={() => { s.openRound(r.shipTo, r.qty, r.mode, r.intake); setK(null); }} className="btn btn-primary">Open round r{parseInt(r.id.slice(1), 10) + 1}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-line2 bg-surface">
        <span className="font-mono text-[13px] font-bold whitespace-nowrap">{done ? 'review' : 'part ' + (k + 1) + ' of ' + n}</span>
        <div className="flex-1 flex gap-[3px]">
          {r.lines.map((l, i) => <button key={l.id} onClick={() => setK(i)} title={l.description} className="h-2 flex-1 rounded-[2px] border-0 cursor-pointer" style={{ background: i === k ? 'var(--focus)' : r.selections[l.id] ? 'var(--accent)' : 'var(--m2)' }} />)}
          <button onClick={() => setK(n)} title="review · package · order" className="h-2 w-8 rounded-[2px] border-0 cursor-pointer" style={{ background: done ? 'var(--focus)' : r.pkg ? 'var(--accent)' : 'var(--m2)' }} />
        </div>
        <button onClick={() => s.refineRound({})} className="btn" title="re-screen against the same list snapshot · K runs, 0 changed">Re-screen</button>
        <span className="text-[12px] text-muted whitespace-nowrap">{selectedCount} of {n} picked</span>
        <button onClick={() => setK(Math.max(0, k - 1))} disabled={k === 0} className="btn disabled:opacity-40">Back</button>
        <button onClick={() => setK(Math.min(n, k + 1))} disabled={done} className="btn disabled:opacity-40">{sel || done ? 'Next' : 'Skip'}</button>
      </div>

      {!done && line && gate && (
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
          <div className="grid gap-3 content-start">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">This is your {slot ? GENERIC_NAME[slot as Slot].toLowerCase() : line.description.split(' · ')[0].toLowerCase()}</div><span className="text-[12px] text-muted">× {line.qtyPerUnit * r.qty}</span></div>
              <div className="p-3 grid gap-2">
                <div className="flex gap-3 items-center">
                  {thumb ? <svg viewBox="0 0 56 44" className="w-[84px] h-[66px] block flex-none">{thumb.map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth="0.8" strokeDasharray={f.dash || undefined} strokeLinejoin="round" />)}</svg> : <div className="w-[84px] h-[66px] flex-none border border-dashed border-line rounded-r" />}
                  <div className="min-w-0"><div className="font-semibold text-[15px]">{line.description}</div><div className="text-[13px] text-muted">{line.partClass} · HTS {line.heading}</div></div>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <span className="text-muted">manufacturer ECCN</span><span className="font-mono">{line.declaredEccn}</span>
                  <span className="text-muted">export gate · {r.shipTo}</span><span className="font-mono font-semibold" style={{ color: gate.blocks ? 'var(--red)' : gate.word === 'STA' ? 'var(--amber)' : 'var(--green)' }}>{gate.word} <span className="font-normal text-muted">{gate.para}</span></span>
                  <span className="text-muted">in the design</span><span>{slot ? (s.parts[slot] ? 'placed · change the model in Spec' : 'slot empty') : 'fixed BOM line'}</span>
                </div>
                {sel && <div className="text-[13px] border-t border-line2 pt-2">picked <b>{list.find((x) => x.offer.id === sel.offerId)?.offer.seller}</b> · attestor {sel.attestor} · #{sel.seq}{sel.declined.length ? <span className="text-muted"> · declined {sel.declined.map((d) => d.seller + ' (' + d.reason + ')').join(', ')}</span> : null}</div>}
              </div>
            </div>
            {(() => {
              const reason = escalationReason(line, list);
              const esc = s.escalations[line.id];
              if (!reason && !esc) return null;
              return (
                <div className="panel" style={{ borderColor: 'var(--amber)' }}>
                  <div className="panel-head"><div className="panel-title">Escalation lane <span className="sub">· {reason ?? esc?.reason}</span></div>{esc && <span className="chip chip-sm">{esc.state}</span>}</div>
                  <div className="p-3 grid gap-2 text-[13px]">
                    {!esc && <><div className="text-muted">the agent may propose a seller, a part or a fact here; every deterministic check runs on a copy first; a human resolves.</div><button onClick={() => s.proposeEscalation(line.id, reason!)} className="btn justify-self-start">Ask the agent for a proposal</button></>}
                    {esc && (
                      <>
                        <div className="border border-line rounded-r p-2 grid gap-1">
                          <div className="font-mono text-[12px] text-muted">proposal · {esc.reason} · {esc.confident ? 'confident' : 'not confident'} · exact-quote citation first</div>
                          <div>{esc.proposal}</div>
                          {esc.state === 'proposed' && (
                            <div className="flex gap-2 items-center flex-wrap"><input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field w-[160px]" /><button onClick={() => s.resolveEscalation(line.id, true, attestor)} disabled={!attestor.trim()} className="btn btn-primary disabled:opacity-50">Accept</button><button onClick={() => s.resolveEscalation(line.id, false, attestor)} disabled={!attestor.trim()} className="btn disabled:opacity-50">Reject</button></div>
                          )}
                          {esc.state !== 'proposed' && <div className="text-[12px] text-muted">{esc.state} · human-resolved · attestor {esc.attestor}</div>}
                        </div>
                        <div className="text-[12px] text-muted">the agent proposes; a human resolves · rejection as fast as acceptance · the agent has no path to a terminal state</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Ask the supplier</div><button onClick={() => setAskOpen((v) => !v)} className="btn btn-xs">{askOpen ? 'hide' : 'generate the request'}</button></div>
              {askOpen && (
                <div className="p-3 grid gap-2 text-[13px]" id="supplier-request">
                  <div className="font-semibold">Supplier request · {line.description}</div>
                  <div className="text-muted">Please answer in the regulation’s words, with the source document and date for each value:</div>
                  <ol className="m-0 pl-5 grid gap-1">{supplierQuestions(line).map((q, i) => <li key={i}>{q}</li>)}</ol>
                  <div className="text-[12px] text-muted">generated from the rule fields · no model · the verified-answer loop (supplier PDF → extractor → verifier → extracted_by supplier_doc) is roadmap</div>
                  <button onClick={() => window.print()} className="btn justify-self-start">Print the request</button>
                </div>
              )}
            </div>
            {r.shipTo !== 'US' && gate.blocks && (
              <div className="panel" style={{ borderColor: 'var(--red)' }}>
                <div className="panel-head"><div className="panel-title text-red">Your regulation changes here</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  <div>Sending this part to {r.shipTo} reads <b>{gate.word}</b> ({gate.para}). The package is blocked until an authorization reference is typed and attested.</div>
                  {gate.word === 'DENIAL' ? <div className="text-muted">DENIAL has no reference field. Change the design or the destination.</div> : r.references[line.id] ? (
                    <div>reference <span className="font-mono">{r.references[line.id].ref}</span> · attestor {r.references[line.id].attestor} · <span className="text-amber font-semibold">reference typed, not validated</span></div>
                  ) : (
                    <div className="grid gap-2">
                      <input aria-label="authorization reference" placeholder="licence / agreement / exemption / DSP-5 number" value={refDraft} onChange={(e) => setRefDraft(e.target.value)} className="field" />
                      <div className="flex gap-2"><input aria-label="attestor for the reference" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field flex-1" /><button onClick={() => { if (refDraft.trim() && attestor.trim()) s.setReference(line.id, refDraft.trim(), attestor.trim()); }} className="btn btn-primary">Attest reference</button></div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {list.length > 1 && (() => {
              const cheapest = list.slice().sort((a, b) => (a.ladder.perUnit ?? Infinity) - (b.ladder.perUnit ?? Infinity))[0];
              const clean = list.find((x) => x.status === 'no_candidate_match');
              const delta = clean && cheapest && clean.ladder.perUnit != null && cheapest.ladder.perUnit != null ? clean.ladder.perUnit - cheapest.ladder.perUnit : null;
              return (
                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Price against regulation</div></div>
                  <div className="p-3 grid gap-1 text-[13px]">
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>cheapest landed · <b>{cheapest.offer.seller}</b> <span style={{ color: STATUS_COLOR[cheapest.status] }}>· {STATUS_WORD[cheapest.status]}</span></span><span className="font-mono">{usd(cheapest.ladder.perUnit)}</span></div>
                    {clean && clean !== cheapest && <div className="grid grid-cols-[1fr_auto] gap-2"><span>cheapest with no candidate match · <b>{clean.offer.seller}</b></span><span className="font-mono">{usd(clean.ladder.perUnit)}</span></div>}
                    {delta != null && delta > 0 && <div className="text-muted">the cleaner seller costs <span className="font-mono text-ink">{usd(delta)}</span> more per unit · the cheaper one is {STATUS_WORD[cheapest.status]}{cheapest.offer.declaredOrigin === 'CN' ? ' and PRC-origin (Section 301 in the ladder, federal-buyer flag)' : ''}</div>}
                    {!clean && <div className="text-amber">no offer on this line is free of a review flag · pick with the flag on the record, or escalate</div>}
                    <div className="text-[12px] text-muted">status sorts above price, always · the human is on the pick button</div>
                  </div>
                </div>
              );
            })()}
            {picked && (
              <div className="panel" style={{ borderColor: 'var(--focus)' }}>
                <div className="panel-head"><div className="panel-title">If you pick {picked.offer.seller}</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {consequences(picked, line, r, o).map((c, i) => <div key={i} className="grid grid-cols-[8px_1fr] gap-2 items-start"><span className="mt-[6px] w-2 h-2 rounded-full" style={{ background: c.tone }} /><span>{c.text}</span></div>)}
                  <div className="text-[12px] text-muted">{CLAIM_OFFER}</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 content-start">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Where you can get it <span className="sub">· {list.length} offer{list.length === 1 ? '' : 's'} · status first, then landed cost · blocked last</span></div></div>
              <div className="p-3 grid gap-2">
                {list.length === 0 && <div className="text-[13px] text-amber">no offer match · escalation lane: the agent may propose a seller; a human resolves.</div>}
                {list.map((ro) => {
                  const on = (pick ?? sel?.offerId) === ro.offer.id;
                  const declined = sel?.declined.find((d) => d.offerId === ro.offer.id);
                  return (
                    <div key={ro.offer.id} className="border rounded-r bg-surface grid gap-2 p-3" style={{ borderColor: on ? 'var(--focus)' : 'var(--line)', boxShadow: on ? 'inset 0 0 0 1px var(--focus)' : 'none', opacity: declined ? 0.7 : 1 }}>
                      <div className="flex justify-between gap-2 items-baseline flex-wrap">
                        <button onClick={() => { setPick(ro.offer.id); setErr(null); }} className="text-left bg-transparent border-0 p-0 cursor-pointer text-ink font-semibold text-[14px]">{ro.offer.seller} <span className="text-muted font-normal">· {ro.offer.sellerCountry}</span>{ro.offer.synthetic && <span className="chip chip-sm ml-2">Synthetic</span>}{ro.offer.authorized && <span className="chip chip-sm ml-1">authorized</span>}</button>
                        <span className="text-[13px] font-bold" style={{ color: STATUS_COLOR[ro.status] }}>{STATUS_WORD[ro.status]}</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-x-3 gap-y-1 text-[12px]">
                        <div><span className="text-muted">ship-from · origin</span><br /><span className="font-mono">{ro.offer.shipFrom} · {ro.offer.declaredOrigin} <span className="chip chip-sm">declared</span></span></div>
                        <div><span className="text-muted">price</span><br /><span className="font-mono">{usd(ro.offer.unitPrice)}</span></div>
                        <div><span className="text-muted">landed / unit</span><br /><span className="font-mono font-semibold" style={{ color: ro.ladder.unverified ? 'var(--grey)' : 'var(--ink)' }}>{usd(ro.ladder.perUnit)}</span></div>
                        <div><span className="text-muted">stock · lead · MOQ</span><br /><span className="font-mono">{ro.offer.stock} · {ro.offer.leadDays} d · {ro.offer.moq}</span></div>
                        <div><span className="text-muted">seller ECCN · HTS</span><br /><span className="font-mono">{ro.offer.declaredEccn} · {ro.offer.declaredHts}</span></div>
                      </div>
                      <div className="flex gap-1 flex-wrap items-center">
                        <button onClick={() => { setPick(ro.offer.id); setTab(tab === 'owners' && on ? 'none' : 'owners'); }} className="btn">Owners · {ro.tier}</button>
                        <button onClick={() => { setPick(ro.offer.id); setTab(tab === 'estimate' && on ? 'none' : 'estimate'); }} className="btn">Landed cost</button>
                        {ro.status === 'review_blocked' && <button onClick={() => setAdj({ offerId: ro.offer.id, role: 'analyst', reason: 'name match on a different entity', rationale: '', action: 'false_positive' })} className="btn">Adjudicate…</button>}
                        <span className="flex-1" />
                        {sel?.offerId === ro.offer.id ? <span className="text-[13px] font-semibold text-green">picked</span> : declined ? <span className="text-[12px] text-muted">declined · {declined.reason}</span> : <button onClick={() => { setPick(ro.offer.id); setErr(null); }} className={'btn ' + (on ? 'btn-primary' : '')} disabled={ro.status === 'review_blocked'} title={ro.status === 'review_blocked' ? 'review blocked stops a pick · adjudicate first' : ''}>{on ? 'picked below' : 'Pick this'}</button>}
                      </div>
                      {on && tab === 'owners' && (
                        <div className="border-t border-line2 pt-2"><div className="text-[13px] font-semibold mb-1">Who owns them · {FIXTURES.ownership}</div><Party n={ro.tree} /><div className="text-[12px] text-muted mt-1">{CLAIM_SCREEN} · Affiliates Rule returns 10 November 2026; the walk rests on the OFAC 50 % rule.</div></div>
                      )}
                      {on && tab === 'estimate' && (
                        <div className="border-t border-line2 pt-2">
                          <div className="text-[13px] font-semibold mb-1">What it costs to land · {ro.ladder.domestic ? 'domestic · no entry' : 'entering the US'}</div>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-[2px] text-[12px]">
                            {ro.ladder.rows.map((rw, i) => <div key={i} className="contents"><div className={rw.verified ? '' : 'text-grey'}><b>{rw.layer}</b> <span className="text-muted">· {rw.citation}</span><br /><span className="text-muted">{rw.note}</span></div><div className="font-mono text-right text-amber">{rw.rate}</div><div className="font-mono text-right text-amber">{rw.amount == null ? '' : '$ ' + rw.amount.toFixed(2)}</div></div>)}
                          </div>
                          <div className="flex justify-between gap-2 mt-2 font-mono text-[13px]"><span>total estimate</span><b>{usd(ro.ladder.total)}</b></div>
                          <div className="text-[12px] text-muted">{ro.ladder.assumptions} · hash {ro.ladder.hash} · {CLAIM_COST}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {adj && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Adjudicate the match</div><button onClick={() => setAdj(null)} className="btn">Cancel</button></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  <label className="grid gap-1 text-muted">role<select value={adj.role} onChange={(e) => setAdj({ ...adj, role: e.target.value as typeof adj.role, action: e.target.value === 'analyst' ? 'false_positive' : adj.action })} className="field text-ink"><option value="analyst">analyst · may record a false positive</option><option value="empowered_official">empowered official · resolves or pins</option></select></label>
                  <label className="grid gap-1 text-muted">action<select value={adj.action} onChange={(e) => setAdj({ ...adj, action: e.target.value as typeof adj.action })} className="field text-ink"><option value="false_positive">record false positive · lowers to review required</option>{adj.role === 'empowered_official' && <option value="resolve">resolve · no candidate match</option>}{adj.role === 'empowered_official' && <option value="pin">pin review blocked</option>}</select></label>
                  <label className="grid gap-1 text-muted">reason code<select value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className="field text-ink">{['name match on a different entity', 'ownership below 50 %', 'list entry withdrawn', 'red flag confirmed', 'other'].map((x) => <option key={x}>{x}</option>)}</select></label>
                  <input aria-label="rationale" placeholder="rationale · required" value={adj.rationale} onChange={(e) => setAdj({ ...adj, rationale: e.target.value })} className="field" />
                  <input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                  <button disabled={!adj.rationale.trim() || !attestor.trim()} onClick={() => { s.adjudicate(line.id, adj.offerId, adj.role, adj.reason, adj.rationale, attestor, adj.action); setAdj(null); }} className="btn btn-primary disabled:opacity-50">Record adjudication</button>
                </div>
              </div>
            )}
            {picked && !sel && (
              <div className="panel" style={{ borderColor: 'var(--focus)' }}>
                <div className="panel-head"><div className="panel-title">Pick {picked.offer.seller}</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {list.filter((x) => x.offer.id !== picked.offer.id).length > 0 && <div className="text-muted">the other offers you saw are recorded as declined, each with a reason and its status at the moment of decline:</div>}
                  {list.filter((x) => x.offer.id !== picked.offer.id).map((x) => (
                    <div key={x.offer.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center"><span>{x.offer.seller} <span className="text-muted">· was {STATUS_WORD[x.status]}</span></span><select value={reasons[x.offer.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [x.offer.id]: e.target.value as DeclineReason })} className="btn text-ink"><option value="">reason from status</option>{DECLINE_REASONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                  ))}
                  <input aria-label="attestor" placeholder="attestor · required · a pick is a human act" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                  {err && <div role="alert" className="text-red font-semibold">{err}</div>}
                  <button onClick={confirm} disabled={s.viewSeq != null} className="btn btn-primary btn-lg text-left disabled:opacity-50">Confirm pick · next part</button>
                </div>
              </div>
            )}
            {sel && <button onClick={() => setK(k + 1)} className="btn btn-primary btn-lg justify-self-end">Next part →</button>}
          </div>
        </div>
      )}

      {done && (
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Your picks <span className="sub">· {selectedCount} of {n}</span></div></div>
            <div className="grid text-[13px]">
              {r.lines.map((l, i) => { const sl = r.selections[l.id]; const ro = sl ? (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId) : null; const g = gateFor(l, o, r.shipTo); return (
                <button key={l.id} onClick={() => setK(i)} className="row-hover grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 items-center px-3 min-h-10 border-t border-line2 text-left bg-transparent text-ink cursor-pointer">
                  <span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{l.description.split(' · ')[0]}</span>
                  <span className="text-muted">{ro ? ro.offer.seller : <span className="text-amber">not picked</span>}</span>
                  {r.shipTo !== 'US' ? <span className="font-mono font-bold text-[12px]" style={{ color: g.blocks ? (r.references[l.id] ? 'var(--amber)' : 'var(--red)') : 'var(--green)' }}>{g.word}{g.blocks && r.references[l.id] ? ' · ref typed' : ''}</span> : <span />}
                  <span className="font-mono">{ro ? usd(ro.ladder.perUnit) : ''}</span>
                </button>
              ); })}
            </div>
          </div>
          <div className="grid gap-3 content-start">
            {r.shipTo !== 'US' && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Sharing drawings with the {r.shipTo} assembler</div>{r.declaration && <span className="chip">declared</span>}</div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {r.declaration ? <div>{r.declaration.personStatus} · {r.declaration.sharing} · {r.declaration.reference ? <span>reference <span className="font-mono">{r.declaration.reference}</span> · <span className="text-amber font-semibold">typed, not validated</span></span> : 'no reference'} · attestor {r.declaration.attestor}</div> : (
                    <>
                      <div className="text-muted">15 CFR 734.13: release of technology to a foreign person is a deemed export. ITAR + foreign + controlled → DDTC reference; EAR technology + foreign → licence or exception reference; EAR99 → none.</div>
                      <label className="grid gap-1 text-muted">person status<select value={decl.personStatus} onChange={(e) => setDecl({ ...decl, personStatus: e.target.value as typeof decl.personStatus })} className="field text-ink"><option>foreign person</option><option>US person</option></select></label>
                      <input aria-label="what will be shared" value={decl.sharing} onChange={(e) => setDecl({ ...decl, sharing: e.target.value })} className="field" />
                      <input aria-label="authorization reference" placeholder="authorization reference · typed, never validated" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} className="field" />
                      <input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                      <button disabled={!attestor.trim()} onClick={() => s.declareTechData({ ...decl, attestor: attestor.trim() })} className="btn btn-primary disabled:opacity-50">Record declaration</button>
                    </>
                  )}
                  <div className="text-[12px] text-muted">not a deemed-export determination · Taiwan customs and the SHTC export permit are not modelled</div>
                </div>
              </div>
            )}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Build the package</div>{r.pkg && <span className="chip">ready</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <button onClick={() => s.buildPackage(o)} disabled={s.viewSeq != null} className="btn btn-primary btn-lg justify-self-start disabled:opacity-50">Build the package</button>
                {r.pkgRefusal && <div role="alert" className="text-red font-semibold">refused: {r.pkgRefusal}</div>}
                {r.pkg && (
                  <div className="grid gap-1 border-t border-line2 pt-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>pre-entry lines for broker validation</span><span className="font-mono">{r.pkg.preEntry}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>diligence record</span><span className="font-mono">{r.pkg.diligence}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>export references</span><span className="font-mono">{r.pkg.exportRefs}</span></div>
                    <div className="text-[12px] text-muted mt-1">{CLAIM_PACKAGE} Draft prepared for review by a licensed customs broker. Not a customs entry, not a broker engagement or power of attorney, not legal, customs or tax advice. The importer of record remains responsible under 19 CFR 141.1.</div>
                    <div className="text-[12px] mt-1"><b>first-run checklist</b> · {CHECKLIST.join(' · ')}</div>
                    <div className="text-[12px]"><b>warnings</b> · {WARNINGS.join(' · ')}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Send the order <span className="sub">· synthetic, exactly once</span></div>{r.order && <span className="chip" style={{ color: r.order.state === 'EXCEPTION' ? 'var(--red)' : undefined }}>{r.order.state}</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={s.injectException} onChange={(e) => s.patch({ injectException: e.target.checked })} disabled={!!r.order} /> inject a lost response after dispatch</label>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={s.sendOrder} disabled={!r.pkg || !!r.order} className="btn btn-primary disabled:opacity-40">Send order (synthetic)</button>
                  <button onClick={s.retrySend} disabled={!r.order || r.order.state === 'CLOSED'} className="btn disabled:opacity-40">Retry with the same key</button>
                  <button onClick={s.closeOrder} disabled={!r.order || r.order.state !== 'ACKNOWLEDGED'} className="btn disabled:opacity-40">Receive · inspect · close</button>
                </div>
                {r.order && <div className="grid gap-1 border-t border-line2 pt-2 font-mono text-[12px]"><div>PURCHASE_ORDER · design state #{r.designSeq} · qty {r.qty} · recipient: [placeholder] · SYNTHETIC</div><div>packet {r.order.packetHash} · key {r.order.key} · attempts {r.order.attempts}</div>{r.order.trail.map((tl, i) => <div key={i} className="text-muted">· {tl}</div>)}</div>}
                <div className="text-[12px] text-muted">a retry with the same key returns the first receipt · nothing leaves the machine · any real external send is a separately authorized communication</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
