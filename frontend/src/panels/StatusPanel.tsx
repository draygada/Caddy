import { useStore } from '../store';
import type { Outcome } from '../lib/rules';
import { attentionOf, overallOf, slotStatus } from '../lib/viewmodel';
import { GENERIC_NAME, SLOTS, type Node } from '../lib/catalog';

export function StatusPanel({ o }: { o: Outcome }) {
  const unconfirmed = useStore((s) => s.unconfirmed);
  const parts = useStore((s) => s.parts);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  const openReasoning = useStore((s) => s.openReasoning);
  const nodes: Node[] = ['airframe', ...SLOTS];
  const overall = overallOf(o);
  const attentionCount = attentionOf(o, unconfirmed).length;
  return (
    <div data-panel="status" aria-live="polite" className="panel flex-none">
      <div className="panel-head">
        <div className="panel-title">Product status <span className="sub">· Kestrel, as designed</span></div>
        <span className="flex gap-1">
          <button onClick={openReasoning} className="btn">Reasoning · {attentionCount}</button>
          <button onClick={() => useStore.getState().patch({ sourcingOpen: true })} className="btn btn-primary">Source this design</button>
        </span>
      </div>
      <div className="p-3 grid gap-1 border-b border-line2">
        <span className="status-word text-[20px] justify-self-start" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>
        <div className="text-[14px]">{overall.entries}</div>
      </div>
      <div className="px-3 py-2 grid">
        <div className="text-[13px] text-muted pb-1">by part · as designed</div>
        {nodes.map((n) => {
          const st = slotStatus(o, unconfirmed, n);
          const name = n === 'airframe' ? 'Airframe' : GENERIC_NAME[n] + (parts[n] ? '' : ' · empty');
          return (
            <button key={n} onClick={() => select(n)} className="row-hover grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-baseline min-h-7 py-[3px] px-1 -mx-1 text-left bg-transparent border-0 text-ink cursor-pointer rounded-r" style={{ background: sel === n ? 'var(--surface2)' : 'transparent' }}>
              <span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-[14px]">{name}</span>
              <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: st.color }}>{st.word}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
