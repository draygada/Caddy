import { useState } from 'react';
import { useStore } from '../store';
import { DEST, LISTED_AIRCRAFT, PACKS, RULES_EVALUATED, SLOT_LABEL, type UsedOn } from '../lib/catalog';
import type { Outcome } from '../lib/rules';
import { attentionOf, cardGroupsOf, destCellsOf, overallOf, type Attention } from '../lib/viewmodel';
import { callC } from '../lib/sources';
import type { Memo } from '../lib/memo';
import type { Ranked, TargetConstraints } from '../lib/propose';
import { partName } from '../lib/propose';
import { isBodyId } from '../store';

function Section({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-head"><div className="panel-title">{title}{sub && <span className="sub"> · {sub}</span>}</div>{right}</div>
      {children}
    </div>
  );
}

export function Reasoning({ o }: { o: Outcome }) {
  const s = useStore();
  const overall = overallOf(o);
  const attention = attentionOf(o, s.unconfirmed);
  const destNodeKey = s.sel || 'airframe';
  const destCells = destCellsOf(o, destNodeKey);
  const mtFixed = o.rules.some((r) => r.cols === 'MT');
  const cardGroups = cardGroupsOf(o, s.unconfirmed, s.events);
  const changedText = s.lastDiff ? 'last edit ' + s.lastDiff.changed + ' changed' : 'baseline';
  const act = (t: Attention) => { if (!t.target) return; if (t.target.kind === 'go') s.select(t.target.slot); else s.reopen(t.target.slot); s.patch({ reasoningOpen: false }); };
  const d = s.declared;
  const [declErr, setDeclErr] = useState<string | null>(null);
  const [docRef, setDocRef] = useState(d.document_ref);
  const [host, setHost] = useState<UsedOn>('F-22');
  const [hostRef, setHostRef] = useState('');
  const [memo, setMemo] = useState<Memo | null>(null);
  const [memoAtt, setMemoAtt] = useState('');
  const [memoErr, setMemoErr] = useState<string | null>(null);
  const [tc, setTc] = useState<TargetConstraints>({ nlrTo: 'DE', maxDutyPct: 25, noUsml: true });
  const [tgtAtt, setTgtAtt] = useState('');
  const decl = (patch: Parameters<typeof s.setDeclared>[0], label: string) => setDeclErr(s.setDeclared(patch, label));
  const c3 = callC();
  const readOnly = s.viewSeq != null;
  const tone = (w: string) => (w === 'NLR' ? 'var(--green)' : w === 'STA' ? 'var(--amber)' : w === 'LIC' ? 'var(--red)' : 'var(--blackfg)');
  const toneBg = (w: string) => (w === 'DDTC' || w === 'DENIAL' ? 'var(--black)' : 'transparent');

  return (
    <div role="dialog" aria-label="Reasoning" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[13px] font-semibold">Reasoning <span className="text-muted font-normal">· why the product reads</span></span>
          <span className="status-word text-[16px]" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>
          <span className="text-[13px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{overall.sub}</span>
          <span className="chip">RULE · eCFR {PACKS[s.pack].ecfr_date}</span><span className="chip">pack {s.pack} · effective {PACKS[s.pack].effective}</span>
        </div>
        <button onClick={s.closeAll} className="btn">Back to model · Esc</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 content-start">
        <div className="grid gap-4 content-start">
          <Section title="Needs attention" sub={String(attention.length)}>
            <div className="px-3 pt-[6px] pb-[10px] grid gap-1">
              {attention.slice(0, 9).map((t, i) => (
                <button key={i} onClick={() => act(t)} className="row-hover grid grid-cols-[auto_1fr] gap-2 items-start min-h-6 py-1 text-left bg-transparent border-0 text-ink" style={{ cursor: t.target ? 'pointer' : 'default' }}>
                  <span className="font-mono text-[13px] font-bold px-[5px] py-px rounded-r whitespace-nowrap" style={{ color: t.color, background: t.bg }}>{t.glyph} {t.word}</span>
                  <span className="text-[14px] min-w-0">{t.text} <span className="text-muted text-[13px]">· {t.action}</span></span>
                </button>
              ))}
            </div>
            <div data-panel="destinations" className="border-t border-line2">
              <div className="px-3 pt-[10px] pb-1 text-[13px] font-semibold">Destinations <span className="text-muted font-normal">· {SLOT_LABEL[destNodeKey]}{destNodeKey === 'airframe' ? ' (product)' : ''}</span></div>
              <div className="grid grid-cols-5">
                {destCells.map((c) => (
                  <div key={c.code} className="px-2 pt-[6px] pb-2 border-r border-line2 min-w-0">
                    <div className="text-[13px] text-muted font-mono">{c.code}</div>
                    <div className="font-mono text-[16px] font-bold inline-block px-[3px] rounded-r my-[2px]" style={{ color: c.color, background: c.bg }}>{c.word}</div>
                    <div className="text-[13px] text-muted leading-[1.35]">{c.para}</div>
                  </div>
                ))}
              </div>
              {mtFixed && <div className="px-3 pt-2 text-[13px] font-semibold">MT fired; strip fixed at the strictest column set.</div>}
              <div className="px-3 pt-2 pb-[10px] text-[13px] text-muted">NLR is list-based; part 744 end-use/end-user and part 746 checks are not modelled. Licence exceptions beyond STA (c)(1)/(c)(2)/(c)(1)(ii)(A), GBS and LVS are not modelled; ENC eligibility is declared, not computed.</div>
            </div>
          </Section>

          <Section title="Declared facts" sub="checkboxes and references · never inferred" right={<span className="chip chip-sm">declared</span>}>
            <div className="p-3 grid gap-2 text-[13px]">
              {declErr && <div role="alert" className="text-red font-semibold">{declErr}</div>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {([['civil_product', 'civil product (6A003 embedding clause printed)'], ['military_use', 'military end use'], ['mass_market', 'mass-market cryptography · 740.17(b) · 5A992.c'], ['civil_gnss_service', 'civil GNSS service · Note to 7A005'], ['designed_for_inertial_nav', 'designed for inertial navigation'], ['prime_flowdown', 'prime flow-down · full ownership walk']] as [keyof typeof d, string][]).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!d[k]} disabled={readOnly} onChange={(e) => decl({ [k]: e.target.checked } as Partial<typeof d>, k + ' ' + (e.target.checked ? 'declared' : 'withdrawn'))} /> {label}</label>
                ))}
              </div>
              <div className="border-t border-line2 pt-2 grid gap-1">
                <div className="text-muted">facts that need a document reference · (b)(4)/(b)(5) refused without one</div>
                <div className="flex gap-2 flex-wrap items-center">
                  <input aria-label="document reference" value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="document_ref · drawing or contract number" className="field flex-1 min-w-[200px]" disabled={readOnly} />
                  <button onClick={() => decl({ document_ref: docRef }, 'document_ref set')} className="btn" disabled={readOnly}>Set reference</button>
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={d.designed_to_incorporate} disabled={readOnly} onChange={(e) => decl({ designed_to_incorporate: e.target.checked }, 'designed_to_incorporate ' + (e.target.checked ? 'declared' : 'withdrawn'))} /> designed to incorporate a defense article · VIII(a)(5) · 120.3 Note 2</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={d.production_nonusml_equivalent} disabled={readOnly} onChange={(e) => decl({ production_nonusml_equivalent: e.target.checked }, 'production_nonusml_equivalent ' + (e.target.checked ? 'declared' : 'withdrawn'))} /> a production, non-USML equivalent exists · (b)(3) · names the commodity</label>
              </div>
              <div className="border-t border-line2 pt-2 grid gap-1">
                <div className="text-muted">used on · the sensor pod · 120.41(a)(2)</div>
                <div className="flex gap-2 flex-wrap items-center">
                  <select value={host} onChange={(e) => setHost(e.target.value as UsedOn)} className="btn text-ink" disabled={readOnly}>{(['F-22', 'F-16', 'C-130', 'Cessna 208'] as UsedOn[]).map((h) => <option key={h}>{h}{LISTED_AIRCRAFT.includes(h) ? ' · listed' : ' · in-production, unlisted'}</option>)}</select>
                  <input aria-label="host document reference" value={hostRef} onChange={(e) => setHostRef(e.target.value)} placeholder="document_ref · required" className="field flex-1 min-w-[160px]" disabled={readOnly} />
                  <button onClick={() => { if (decl({ used_on: [...d.used_on, { aircraft: host, document_ref: hostRef }] }, 'used_on ' + host + ' declared') == null) setHostRef(''); }} className="btn btn-primary" disabled={readOnly}>Declare</button>
                </div>
                {d.used_on.map((u, i) => <div key={i} className="flex justify-between gap-2"><span>{u.aircraft} · {LISTED_AIRCRAFT.includes(u.aircraft) ? 'listed · VIII(h)(1)' : 'in-production unlisted · 9A610.x'} · ref {u.document_ref}</span><button onClick={() => decl({ used_on: d.used_on.filter((_, j) => j !== i) }, 'used_on ' + u.aircraft + ' withdrawn')} className="btn btn-xs" disabled={readOnly}>withdraw</button></div>)}
                <div className="text-[12px] text-muted">a declared fact and a measured attribute are distinguishable with colour removed: checkbox + “declared” chip vs value + unit + source</div>
              </div>
            </div>
          </Section>

          <Section title="Routing" sub="final assembly and the duty layer · the drone coming home" right={<span className="chip chip-sm">$ · estimate</span>}>
            <div className="p-3 grid gap-2 text-[13px]">
              <div role="radiogroup" aria-label="final assembly country" className="flex gap-1 items-center">
                <span className="text-muted mr-1">final_assembly_country</span>
                {(['US', 'TW'] as const).map((c) => <button key={c} role="radio" aria-checked={d.final_assembly_country === c} disabled={readOnly} onClick={() => decl({ final_assembly_country: c }, 'final_assembly_country ' + d.final_assembly_country + ' → ' + c)} className="btn font-semibold" style={{ background: d.final_assembly_country === c ? 'var(--accent)' : 'transparent', color: d.final_assembly_country === c ? 'var(--accentfg)' : 'var(--ink)' }}>{c === 'US' ? 'US · own facility' : 'TW · Taiwan assembly'}</button>)}
                <span className="chip chip-sm">declared</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {([['faa_44704_certificate', 'FAA 44704 certificate'], ['blue_uas_listed', 'Blue UAS listed 2026-09-02'], ['allied_content_certified', 'allied content certified'], ['fcc_dow_dhs_determination', 'FCC DoW/DHS determination']] as [keyof typeof d, string][]).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={!!d[k]} disabled={readOnly} onChange={(e) => decl({ [k]: e.target.checked } as Partial<typeof d>, k + ' ' + (e.target.checked ? 'declared' : 'withdrawn'))} /> {label}</label>
                ))}
              </div>
              {o.deMinimis && (
                <div className="border-t border-line2 pt-2">
                  <div className="text-muted mb-1">P4 · de minimis per destination · US-controlled content over the total declared value</div>
                  <div className="grid grid-cols-5 gap-2">
                    {o.deMinimis.map((m) => <div key={m.code} className="min-w-0"><div className="font-mono text-muted">{m.code}</div><div className="font-mono font-bold" style={{ color: m.subject_to_EAR ? 'var(--red)' : 'var(--green)' }}>{m.us_controlled_pct.toFixed(1)} % {m.subject_to_EAR ? '· subject to the EAR' : '· below ' + m.threshold + ' %'}</div><div className="text-[12px] text-muted">{m.because}</div></div>)}
                  </div>
                </div>
              )}
              <div className="border-t border-line2 pt-2">
                <div className="text-muted mb-1">entering the US · declared value ${o.duty.declaredValue.toFixed(0)} · US content ${o.duty.usContent.toFixed(0)}</div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-[2px]">
                  {o.duty.rows.map((r) => (
                    <div key={r.id} className="contents">
                      <div style={{ opacity: r.fired || r.printOnly ? 1 : 0.55 }}><b>{r.label}</b> <span className="text-muted">· {r.citation}</span>{r.printOnly && <span className="chip chip-sm ml-2 italic">printed, not evaluated</span>}<br /><span className="text-[12px] text-muted">{r.note}</span></div>
                      <div className="font-mono text-right" style={{ color: 'var(--amber)' }}>{r.fired ? '$ ' : ''}{r.rate}</div>
                      <div className="font-mono text-right" style={{ color: 'var(--amber)' }}>{r.amount != null && r.fired ? (r.amount < 0 ? '−$ ' + Math.abs(r.amount).toFixed(0) : '$ ' + r.amount.toFixed(0)) : ''}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[12px] text-muted mt-1">every dollar figure is a rate applied to the declared value with the word “estimate” in the same line · heading-level only · “would apply” · not tied to any actual or intended importation · no entry, no importer (H350722)</div>
              </div>
              <div className="border-t border-line2 pt-2 grid grid-cols-5 gap-2">
                {o.duty.destinations.map((x) => <div key={x.code} className="min-w-0"><div className="font-mono text-muted">{x.code}</div><div className="text-[12px]">{x.text}</div></div>)}
              </div>
            </div>
          </Section>

          <Section title="Request determination" sub="the company API · once" right={s.determination && <span className="chip">{s.determination.chip}</span>}>
            <div className="p-3 grid gap-2 text-[13px]">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => s.requestDetermination(o)} className="btn btn-primary">Request determination (company API)</button>
                <button onClick={s.warmUpApi} className="btn">Warm up for LIVE</button>
              </div>
              {s.apiNote && <div className="text-amber text-[12px]">{s.apiNote}</div>}
              {s.determination && (
                <div className="border-t border-line2 pt-2 grid gap-1">
                  <div className="font-mono text-[12px]">{s.determination.basis} · {s.determination.chip} · memo hash {s.determination.memoHash}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-muted">API memo</div><div className="font-mono">{s.determination.entries.length ? s.determination.entries.join(', ') : 'EAR99 · no listed entry'}</div></div>
                    <div><div className="text-muted">engine · as designed</div><div className="font-mono">{o.rules.filter((r) => r.node === 'airframe').map((r) => r.entry).join(', ') || 'no listed entry'}</div></div>
                  </div>
                  {s.determination.conflict && <div className="text-amber font-semibold">{s.determination.conflict}</div>}
                  <div className="text-[12px] text-muted">“determination” is reserved for this memo; nothing the tripwire engine prints is called one · self-classification analysis under 15 CFR 732.3(b), not a CJ or CCATS</div>
                </div>
              )}
            </div>
          </Section>

          <Section title="Rule packs · the law is untrusted text too" sub="Call C over the Federal Register" right={<span className="chip">pack {s.pack}</span>}>
            <div className="p-3 grid gap-2 text-[13px]">
              <div className="grid grid-cols-2 gap-2">
                {(['v1', 'v2'] as const).map((p) => <button key={p} onClick={() => s.commitPack(p, 'commit pack ' + p + ' · human')} disabled={readOnly} className="border rounded-r p-2 text-left" style={{ borderColor: s.pack === p ? 'var(--focus)' : 'var(--line)', background: s.pack === p ? 'var(--surface2)' : 'transparent' }}><div className="font-mono text-[12px] text-muted">{p} · sha {PACKS[p].sha} · eCFR {PACKS[p].ecfr_date} · effective {PACKS[p].effective}</div><div>{PACKS[p].label}</div><div className="text-[12px] text-muted">{s.pack === p ? 'committed · the engine evaluates under this pack' : 'commit as a human · rule_pack_committed'}</div></button>)}
              </div>
              <div className="border-t border-line2 pt-2 grid gap-1">
                <div className="font-semibold">Proposed rule patch · {c3.patch.rule_id} · {c3.patch.field} {c3.patch.value} {c3.patch.unit}</div>
                <div className="font-mono text-[12px] text-muted">quote “{c3.patch.quote}” · bytes {c3.patch.start}–{c3.patch.end} · sha {c3.patch.doc_sha256} · 91 FR 52501</div>
                <div className="font-mono font-bold" style={{ color: c3.verdict.ok ? 'var(--green)' : 'var(--red)' }}>{c3.verdict.ok ? 'ACCEPTED by the verifier' : 'REJECT · ' + c3.verdict.reason}</div>
                <div className="text-[12px] text-muted">{c3.from} → {c3.to} · no jurisdiction, entry or reasons field on the patch schema · proposed rule patch, verified against the Federal Register text at bytes {c3.patch.start}–{c3.patch.end}, committed by a human · never “the tool updates itself”</div>
                <button onClick={() => { s.rederiveLog(); s.openTimeline(); }} className="btn justify-self-start">Re-derive under v1 and v2 · which rule changed, which design moved</button>
              </div>
            </div>
          </Section>

          <Section title="Design to a target" sub="scored by the same rules · never ranked on price alone">
            <div className="p-3 grid gap-2 text-[13px]">
              <div className="flex gap-3 flex-wrap items-center">
                <label className="flex items-center gap-1 text-muted">NLR to<select value={tc.nlrTo} onChange={(e) => setTc({ ...tc, nlrTo: e.target.value as TargetConstraints['nlrTo'] })} className="btn text-ink">{['DE', 'TW', 'CA', 'none'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="flex items-center gap-1 text-muted">enters the US at ≤<select value={tc.maxDutyPct} onChange={(e) => setTc({ ...tc, maxDutyPct: +e.target.value as TargetConstraints['maxDutyPct'] })} className="btn text-ink"><option value={25}>25 %</option><option value={100}>100 %</option><option value={1000}>any</option></select></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={tc.noUsml} onChange={(e) => setTc({ ...tc, noUsml: e.target.checked })} /> no defense article</label>
                <button onClick={() => s.runTarget(tc)} className="btn btn-primary">Search the catalog</button>
              </div>
              {s.target && (
                <div className="grid gap-1 border-t border-line2 pt-2">
                  {s.target.map((r: Ranked, i) => (
                    <div key={i} className="border border-line rounded-r p-2 grid gap-1" style={{ borderColor: r.passes ? 'var(--green)' : 'var(--line)' }}>
                      <div className="flex justify-between gap-2 flex-wrap"><span className="font-semibold">{r.passes ? '✓ satisfies the constraints' : '✗ does not satisfy'} · {r.outcome.rules.length} rule{r.outcome.rules.length === 1 ? '' : 's'} fired · ${r.cost.toFixed(0)} declared</span><span className="text-[12px] text-muted">{r.deltas.join(' · ')}</span></div>
                      <div className="text-[12px] text-muted">{(Object.keys(r.parts) as (keyof typeof r.parts)[]).map((k) => SLOT_LABEL[k] + ': ' + partName(r.parts[k])).join(' · ')}</div>
                      <div className="flex gap-2 items-center"><input aria-label="attestor" value={tgtAtt} onChange={(e) => setTgtAtt(e.target.value)} placeholder="attestor · required" className="field w-[180px]" /><button onClick={() => s.acceptConfiguration(r, tgtAtt)} disabled={!tgtAtt.trim() || readOnly} className="btn btn-primary disabled:opacity-50">Accept this configuration</button></div>
                    </div>
                  ))}
                  <div className="text-[12px] text-muted">candidate configurations scored by the same rules; every number quoted · the human on the accept button · never “the tool designs the product”</div>
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="grid gap-4 content-start">
          <Section title="Flags" right={<span className="font-mono text-[13px] text-muted">{o.rules.length} fired · {RULES_EVALUATED} evaluated · {o.cannot.length} cannot fire · {changedText}</span>}>
            <div className="pb-2">
              {cardGroups.map((g) => (
                <div key={g.name}>
                  <div className="px-3 pt-[10px] pb-[2px] text-[13px] text-muted">{g.name} · {g.count}</div>
                  {g.cards.map((c) => {
                    const open = !!s.open[c.id];
                    const isOpenFact = c.id.startsWith('of-');
                    const node = o.rules.find((r) => r.id === c.id)?.node;
                    return (
                      <div key={c.id} data-rule={c.id} className="mx-3 mt-[6px] border border-line rounded-r bg-surface">
                        <button onClick={() => { if (c.expandable) s.toggleOpen(c.id); }} aria-expanded={open} className="row-hover grid grid-cols-[auto_1fr_auto] gap-2 min-h-11 px-[10px] py-2 text-left bg-transparent border-0 text-ink cursor-pointer w-full items-start">
                          <span className="font-mono text-[13px] font-bold px-[5px] py-px rounded-r whitespace-nowrap" style={{ color: c.color, background: c.bg }}>{c.glyph} {c.word}</span>
                          <span className="min-w-0"><span className="font-mono font-semibold">{c.entry}</span> <span className="text-muted">· {c.node}</span><br /><span className="text-[13px] text-muted">{c.reason}</span></span>
                          <span className="text-[13px] text-muted">{c.expandable ? (open ? '−' : '+') : ''}</span>
                        </button>
                        {open && c.expandable && (
                          <div className="px-[10px] pb-[10px] grid gap-2 border-t border-line2">
                            <blockquote className="mt-2 mb-0 px-[10px] py-2 border-l-2 border-line text-[14px] leading-[1.45]">“{c.sentence}”</blockquote>
                            <div className="text-[14px]">number that crossed: <b className="font-mono">{c.number}</b></div>
                            <div className="flex gap-[6px] flex-wrap"><span className="chip">eCFR {c.ecfr}</span><span className="chip">effective {c.eff}</span><span className="chip">RULE</span></div>
                            <div className="text-[13px] text-muted">{c.fr} · <a href="#" onClick={(e) => e.preventDefault()} className="text-muted">{c.url}</a></div>
                            {c.atoms.map((at, i) => <div key={i} className="text-[13px] font-mono text-muted">{at}</div>)}
                            <div className="flex gap-2 flex-wrap">
                              {node && node !== 'airframe' && isBodyId(node) && <button onClick={() => s.findAlternative(node, o)} className="btn">Find a compliant alternative · Call B</button>}
                              {isOpenFact && <button onClick={() => { setMemo(s.draftMemo(o)); setMemoErr(null); }} className="btn">Draft the intent memo</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Section>
          {memo && (
            <Section title="Intent memo" sub="draft for counsel review · citations limited to rules that fired" right={<button onClick={() => setMemo(null)} className="btn btn-xs">discard</button>}>
              <div className="p-3 grid gap-2 text-[13px]">
                <textarea aria-label="memo" value={memo.text} onChange={(e) => setMemo({ ...memo, text: e.target.value })} rows={12} className="field py-2 leading-[1.5] font-sans" />
                <div className="font-mono text-[12px] text-muted">citations: {memo.citations.join(', ') || 'none'} · state #{memo.seq}</div>
                <div className="flex gap-2 items-center"><input aria-label="attestor" value={memoAtt} onChange={(e) => setMemoAtt(e.target.value)} placeholder="signed by · required" className="field w-[200px]" /><button onClick={() => { const e = s.signMemo(memo, memoAtt, o); setMemoErr(e); if (!e) setMemo(null); }} className="btn btn-primary">Sign · the memo hash enters the chain</button></div>
                {memoErr && <div role="alert" className="text-red font-semibold">{memoErr}</div>}
                <div className="text-[12px] text-muted">never “legal memo” or “opinion” · /record prints it under the Note 2 footer</div>
              </div>
            </Section>
          )}
          {s.memos.length > 0 && <Section title="Signed memos" sub={String(s.memos.length)}><div className="p-3 grid gap-1 text-[13px]">{s.memos.map((m) => <div key={m.id} className="font-mono text-[12px]">{m.hash} · signed by {m.signedBy} · {m.citations.join(', ')} · #{m.seq}</div>)}</div></Section>}
          <Section title="Destinations · all nodes" sub="the strictest column set of every entry met">
            <div className="p-3 grid gap-1 text-[12px] font-mono">
              <div className="grid grid-cols-[110px_repeat(5,1fr)] gap-1 text-muted"><span /> {DEST.map((c) => <span key={c}>{c}</span>)}</div>
              {(Object.keys(o.cols) as (keyof typeof o.cols)[]).map((n) => <div key={n} className="grid grid-cols-[110px_repeat(5,1fr)] gap-1"><span className="text-muted">{SLOT_LABEL[n]}</span>{o.cols[n].map((c) => <span key={c.code} className="font-bold px-1 rounded-r" style={{ color: tone(c.word), background: toneBg(c.word) }}>{c.word}</span>)}</div>)}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
