import { useStore } from '../store';
import { RULES_EVALUATED, SLOT_LABEL } from '../lib/catalog';
import type { Outcome } from '../lib/rules';
import { attentionOf, cardGroupsOf, destCellsOf, overallOf, type Attention } from '../lib/viewmodel';

export function Reasoning({ o }: { o: Outcome }) {
  const s = useStore();
  const overall = overallOf(o);
  const attention = attentionOf(o, s.unconfirmed);
  const destNodeKey = s.sel || 'airframe';
  const destCells = destCellsOf(o, destNodeKey);
  const mtFixed = o.rules.some((r) => r.cols === 'MT');
  const cardGroups = cardGroupsOf(o, s.unconfirmed, s.events);
  const changedText = s.lastDiff ? 'last edit ' + s.lastDiff.changed + ' changed' : 'baseline';
  const act = (t: Attention) => {
    if (!t.target) return;
    if (t.target.kind === 'go') s.select(t.target.slot); else s.reopen(t.target.slot);
    s.patch({ reasoningOpen: false });
  };

  return (
    <div role="dialog" aria-label="Reasoning" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[13px] font-semibold">Reasoning <span className="text-muted font-normal">· why the product reads</span></span>
          <span className="status-word text-[16px]" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>
          <span className="text-[13px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{overall.sub}</span>
        </div>
        <button onClick={s.closeAll} className="btn">Back to model · Esc</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 content-start">
        <div className="panel">
          <div className="px-3 py-[10px] border-b border-line2 text-[13px] font-semibold">Needs attention · {attention.length}</div>
          <div className="px-3 pt-[6px] pb-[10px] grid gap-1">
            {attention.slice(0, 7).map((t, i) => (
              <button key={i} onClick={() => act(t)} className="row-hover grid grid-cols-[auto_1fr] gap-2 items-start min-h-6 py-1 text-left bg-transparent border-0 text-ink" style={{ cursor: t.target ? 'pointer' : 'default' }}>
                <span className="font-mono text-[13px] font-bold px-[5px] py-px rounded-r whitespace-nowrap" style={{ color: t.color, background: t.bg }}>{t.glyph} {t.word}</span>
                <span className="text-[14px] min-w-0">{t.text} <span className="text-muted text-[13px]">· {t.action}</span></span>
              </button>
            ))}
          </div>
          <div data-panel="destinations" className="border-t border-line2">
            <div className="px-3 pt-[10px] pb-1 text-[13px] font-semibold">Destinations <span className="text-muted font-normal">· {SLOT_LABEL[destNodeKey]}{destNodeKey === 'airframe' ? ' (product)' : ''}</span></div>
            <div className="grid grid-cols-5">
              {destCells.map((d) => (
                <div key={d.code} className="px-2 pt-[6px] pb-2 border-r border-line2 min-w-0">
                  <div className="text-[13px] text-muted font-mono">{d.code}</div>
                  <div className="font-mono text-[16px] font-bold inline-block px-[3px] rounded-r my-[2px]" style={{ color: d.color, background: d.bg }}>{d.word}</div>
                  <div className="text-[13px] text-muted leading-[1.35]">{d.para}</div>
                </div>
              ))}
            </div>
            {mtFixed && <div className="px-3 pt-2 text-[13px] font-semibold">MT fired; strip fixed at the strictest column set.</div>}
            <div className="px-3 pt-2 pb-[10px] text-[13px] text-muted">NLR is list-based; part 744 / 746 checks are not modelled.</div>
          </div>
        </div>
        <div className="panel">
          <div className="px-3 py-[10px] border-b border-line2 flex justify-between gap-2 items-center">
            <span className="text-[13px] font-semibold">Flags</span>
            <span className="font-mono text-[13px] text-muted">{o.rules.length} fired · {RULES_EVALUATED} evaluated · {o.cannot.length} cannot fire · {changedText}</span>
          </div>
          <div className="pb-2">
            {cardGroups.map((g) => (
              <div key={g.name}>
                <div className="px-3 pt-[10px] pb-[2px] text-[13px] text-muted">{g.name} · {g.count}</div>
                {g.cards.map((c) => {
                  const open = !!s.open[c.id];
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
                          <div className="flex gap-[6px] flex-wrap">
                            <span className="chip">eCFR {c.ecfr}</span>
                            <span className="chip">effective {c.eff}</span>
                          </div>
                          <div className="text-[13px] text-muted">{c.fr} · <a href="#" onClick={(e) => e.preventDefault()} className="text-muted">{c.url}</a></div>
                          {c.atoms.map((at, i) => <div key={i} className="text-[13px] font-mono text-muted">{at}</div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
