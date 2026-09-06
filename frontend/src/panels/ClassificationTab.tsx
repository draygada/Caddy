import { useState } from 'react';
import { useStore, intakeIncomplete } from '../store';
import { CATALOG, CORE_SLOTS, GENERIC_NAME, SLOTS, type Node, type Slot } from '../lib/catalog';
import { AF_THUMB, THUMBS, type ThumbFace } from '../lib/geometry';
import type { Outcome, Rule } from '../lib/rules';
import { destCellsOf, overallOf, slotStatus, STATUS_CLAIM_CEILING } from '../lib/viewmodel';

type Level = 0 | 1 | 2 | 3 | 4;
const LEVEL_COLOR: Record<Level, string> = { 0: 'var(--m2)', 1: 'var(--amber)', 2: 'var(--amber)', 3: 'var(--red)', 4: 'var(--black)' };
const LEVEL_WORD: Record<Level, string> = { 0: 'no match in the modeled rows', 1: 'missing evidence', 2: 'needs attention', 3: 'modeled candidate match', 4: 'USML candidate' };

interface PartRow {
  node: Node;
  name: string;
  model: string;
  thumb: ThumbFace[] | null;
  level: Level;
  why: string;
  rules: Rule[];
  cannot: string[];
  advisories: string[];
  unconfirmed: boolean;
}

function levelOf(o: Outcome, node: Node, unconfirmed: boolean): Level {
  const rs = o.rules.filter((r) => r.node === node);
  if (rs.some((r) => r.kind === 'USML')) return 4;
  if (rs.length) return 3;
  if (unconfirmed || o.advisories.some((a) => a.node === node && a.severity !== 'info')) return 2;
  if (o.cannot.some((c) => c.node === node)) return 1;
  return 0;
}

function whyOf(o: Outcome, node: Node, unconfirmed: boolean, level: Level): string {
  const rs = o.rules.filter((r) => r.node === node);
  if (level >= 3) return rs[0].number + ' · ' + rs[0].entry + (rs.length > 1 ? ' and ' + (rs.length - 1) + ' more' : '');
  if (unconfirmed) return 'part swapped and not yet confirmed by a human';
  const adv = o.advisories.find((a) => a.node === node && a.severity !== 'info');
  if (adv) return adv.text.split(' · ').slice(0, 2).join(' · ');
  const cannot = o.cannot.filter((c) => c.node === node);
  if (cannot.length) return cannot.length + ' rule' + (cannot.length === 1 ? '' : 's') + ' cannot fire: ' + cannot[0].text.replace(/^cannot fire · /, '');
  return 'nothing in the fourteen modeled rows matched this part';
}

function RiskBar({ level }: { level: Level }) {
  return (
    <span className="inline-flex gap-[3px]" aria-label={LEVEL_WORD[level]} title={LEVEL_WORD[level]}>
      {[1, 2, 3, 4].map((i) => <span key={i} className="w-[14px] h-[8px] rounded-[2px]" style={{ background: i <= level ? LEVEL_COLOR[level] : 'var(--m1)' }} />)}
    </span>
  );
}

function Thumb({ faces }: { faces: ThumbFace[] | null }) {
  if (!faces) return <div className="w-14 h-11 border border-dashed border-line rounded-r" />;
  return <svg viewBox="0 0 56 44" className="w-14 h-11 block">{faces.map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth="0.8" strokeDasharray={f.dash || undefined} strokeLinejoin="round" />)}</svg>;
}

/** Classification: the part visually, why it trips, and the regulation behind an expand. Only parts of concern up front. */
export function ClassificationTab({ o }: { o: Outcome }) {
  const s = useStore();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showClean, setShowClean] = useState(false);
  const overall = overallOf(o);
  const incomplete = intakeIncomplete(s.project?.intake ?? null);
  const components = s.project?.components ?? CORE_SLOTS;
  const rows: PartRow[] = (['airframe', ...SLOTS.filter((sl) => !!s.parts[sl] || (components as Slot[]).includes(sl))] as Node[]).map((node) => {
    const unconfirmed = node !== 'airframe' && !!s.unconfirmed[node as Slot];
    const level = levelOf(o, node, unconfirmed);
    const pid = node === 'airframe' ? null : s.parts[node as Slot];
    return {
      node,
      name: node === 'airframe' ? 'Airframe' : GENERIC_NAME[node as Slot],
      model: node === 'airframe' ? 'Kestrel bracket · span ' + s.span.toFixed(1) + ' m' : pid ? CATALOG[pid].name : 'slot empty',
      thumb: node === 'airframe' ? AF_THUMB : pid ? THUMBS[pid] : null,
      level,
      why: whyOf(o, node, unconfirmed, level),
      rules: o.rules.filter((r) => r.node === node),
      cannot: o.cannot.filter((c) => c.node === node).map((c) => c.entry + ' · ' + c.text),
      advisories: o.advisories.filter((a) => a.node === node).map((a) => a.text),
      unconfirmed,
    };
  });
  const concern = rows.filter((r) => r.level > 0).sort((a, b) => b.level - a.level);
  const clean = rows.filter((r) => r.level === 0);
  const toggle = (id: string) => setOpen((v) => ({ ...v, [id]: !v[id] }));

  const Row = ({ r }: { r: PartRow }) => {
    const isOpen = !!open[r.node];
    const st = slotStatus(o, s.unconfirmed, r.node);
    const cells = destCellsOf(o, r.node);
    return (
      <div className="border-t border-line2">
        <button onClick={() => toggle(r.node)} aria-expanded={isOpen} className="row-hover w-full text-left grid grid-cols-[56px_minmax(0,1fr)_auto_auto] gap-4 items-center px-4 py-3 bg-transparent border-0 text-ink cursor-pointer">
          <Thumb faces={r.thumb} />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{r.name} <span className="text-muted font-normal text-[13px]">· {r.model}</span></span>
            <span className="block text-[13px]" style={{ color: r.level >= 3 ? LEVEL_COLOR[r.level] : 'var(--muted)' }}>{r.why}</span>
          </span>
          <span className="grid justify-items-end gap-1"><RiskBar level={r.level} /><span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: st.color }}>{st.word}</span></span>
          <span className="text-[13px] text-muted w-[72px] text-right">{isOpen ? 'less' : 'see more'}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pl-[88px] grid gap-3 text-[13px]">
            {r.rules.map((rule) => (
              <div key={rule.id} className="border border-line rounded-r p-3 grid gap-2 bg-surface">
                <div className="flex justify-between gap-2 flex-wrap"><span className="font-mono font-semibold">{rule.entry}</span><span className="flex gap-1"><span className="chip chip-sm">eCFR {rule.ecfr}</span><span className="chip chip-sm">effective {rule.eff}</span></span></div>
                <div>{rule.reason}</div>
                <blockquote className="m-0 px-3 py-2 border-l-2 border-line leading-[1.45]">“{rule.sentence}”</blockquote>
                <div>number that crossed: <b className="font-mono">{rule.number}</b></div>
                <div className="text-muted text-[12px]">{rule.fr}</div>
                {rule.atoms.map((a, i) => <div key={i} className="font-mono text-[12px] text-muted">{a}</div>)}
              </div>
            ))}
            {r.unconfirmed && <div className="border border-line rounded-r p-3 bg-surface flex justify-between gap-2 items-center"><span>The swap on this part has not been confirmed. Compare function, performance, form and fit, then attest.</span><button onClick={() => { s.reopen(r.node as Slot); s.setWorkspace('design'); }} className="btn">Open the comparison</button></div>}
            {r.advisories.map((a, i) => <div key={i} className="border border-line rounded-r p-3 bg-surface text-amber">{a}</div>)}
            {r.cannot.length > 0 && (
              <div className="border border-line rounded-r p-3 bg-surface grid gap-1">
                <div className="font-semibold">Missing evidence · these rules could not be evaluated</div>
                {r.cannot.map((c, i) => <div key={i} className="font-mono text-[12px] text-muted">{c}</div>)}
              </div>
            )}
            <div className="grid grid-cols-5 gap-2 border-t border-line2 pt-2">
              {cells.map((c) => <div key={c.code} className="min-w-0"><div className="font-mono text-[12px] text-muted">{c.code}</div><div className="font-mono font-bold text-[13px] inline-block px-1 rounded-r" style={{ color: c.color, background: c.bg }}>{c.word}</div><div className="text-[11px] text-muted leading-[1.3]">{c.para}</div></div>)}
            </div>
            <div className="flex gap-2"><button onClick={() => { s.select(r.node); s.setWorkspace('design'); }} className="btn">Open in Design</button><button onClick={() => { s.select(r.node); s.openReasoning(); }} className="btn">Full reasoning</button></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div className="panel">
        <div className="p-4 grid gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            {incomplete ? <span className="status-word text-[22px]" style={{ color: 'var(--amber)' }}>? Requires more information</span> : <span className="status-word text-[22px]" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>}
            <span className="text-[14px] text-muted">{incomplete ? 'the use-case answers are missing or “not sure yet” · the parts below are still evaluated on their own attributes' : overall.sub}</span>
          </div>
          <div className="text-[14px]">{overall.entries}</div>
          <div className="text-[12px] text-muted">{STATUS_CLAIM_CEILING.title}: {STATUS_CLAIM_CEILING.body}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Parts of concern <span className="sub">· {concern.length} of {rows.length}</span></div><span className="text-[12px] text-muted">click a part for the regulation behind it</span></div>
        {concern.length === 0 && <div className="px-4 py-6 text-[14px] text-muted">No part matched a modeled row. Human review is still required before any export decision.</div>}
        {concern.map((r) => <Row key={r.node} r={r} />)}
      </div>

      {clean.length > 0 && (
        <div className="panel">
          <button onClick={() => setShowClean((v) => !v)} aria-expanded={showClean} className="row-hover w-full text-left flex justify-between items-center px-4 min-h-12 bg-transparent border-0 text-ink cursor-pointer">
            <span className="text-[14px]"><b>{clean.length} part{clean.length === 1 ? '' : 's'}</b> <span className="text-muted">· no match in the modeled rows · {clean.map((r) => r.name).join(', ')}</span></span>
            <span className="text-[13px] text-muted">{showClean ? 'hide' : 'show'}</span>
          </button>
          {showClean && clean.map((r) => <Row key={r.node} r={r} />)}
        </div>
      )}

      <div className="text-[12px] text-muted px-1">Every status pairs a colour with a word. Green never appears here because the modeled rows are a limited scan: “no match” is not NLR. Full reasoning, declared facts, routing and rule packs are one click away on any part.</div>
    </div>
  );
}
