import { useRef, type MouseEvent, type ReactElement } from 'react';
import { useStore } from '../store';
import { Body, Check, Component, Doc, Feature, Folder, Gear, Pan, Sketch } from './Icons';

const ICON: Record<string, (p: { width?: number; height?: number }) => ReactElement> = {
  design_opened: Doc, rule_pack_pinned: Gear, fixture_manifest: Folder, part_swapped: Component, part_placed: Component, part_removed: Component,
  part_moved: Pan, attr_changed: Feature, feature_added: Body, swap_confirmed: Check, state_restored: Doc, version_saved: Doc, comment_added: Doc,
  constraint_added: Sketch, constraint_removed: Sketch,
};

/** Fusion-style timeline: one icon per operation, oldest left, and a marker you drag to replay the design to that point. */
export function TimelineStrip() {
  const events = useStore((s) => s.events);
  const viewSeq = useStore((s) => s.viewSeq);
  const viewAt = useStore((s) => s.viewAt);
  const restoreHere = useStore((s) => s.restoreHere);
  const asc = events.slice().reverse();
  const latest = events.length;
  const cur = viewSeq ?? latest;
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  const seqAt = (clientX: number) => {
    const el = stripRef.current; if (!el) return cur;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.max(1, Math.min(latest, Math.round(t * latest)));
  };
  const onDown = (e: MouseEvent<HTMLDivElement>) => {
    drag.current = true;
    viewAt(seqAt(e.clientX) >= latest ? null : seqAt(e.clientX));
    const move = (ev: globalThis.MouseEvent) => { if (!drag.current) return; const q = seqAt(ev.clientX); viewAt(q >= latest ? null : q); };
    const up = () => { drag.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const step = (d: number) => { const q = Math.max(1, Math.min(latest, cur + d)); viewAt(q >= latest ? null : q); };

  return (
    <div className="flex-none h-11 flex items-center gap-2 px-2 border-t border-line2 bg-surface select-none">
      <div className="flex gap-[2px]">
        <button className="btn btn-xs text-ink min-w-6 px-0" title="First" onClick={() => viewAt(1)}>⏮</button>
        <button className="btn btn-xs text-ink min-w-6 px-0" title="Previous" onClick={() => step(-1)}>◀</button>
        <button className="btn btn-xs text-ink min-w-6 px-0" title="Next" onClick={() => step(1)}>▶</button>
        <button className="btn btn-xs text-ink min-w-6 px-0" title="Live" onClick={() => viewAt(null)}>⏭</button>
      </div>
      <div ref={stripRef} onMouseDown={onDown} className="relative flex-1 h-8 cursor-pointer" title="drag the marker to replay the design to that point">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-line" />
        {asc.map((e) => {
          const Ico = ICON[e.kind] || Feature;
          const x = (e.seq / latest) * 100;
          const after = e.seq > cur;
          const amber = e.word.startsWith('unconfirmed');
          return (
            <button key={e.seq} title={'#' + e.seq + ' ' + e.kind + ' · ' + e.text} onMouseDown={(ev) => ev.stopPropagation()} onClick={() => viewAt(e.seq >= latest ? null : e.seq)}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-[4px] border flex items-center justify-center bg-surface hover:bg-hover"
              style={{ left: x + '%', borderColor: amber ? 'var(--amber)' : e.seq === cur ? 'var(--focus)' : 'var(--line)', color: amber ? 'var(--amber)' : 'var(--ink)', opacity: after ? 0.35 : 1 }}>
              <Ico width={13} height={13} />
            </button>
          );
        })}
        <div className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 pointer-events-none" style={{ left: (cur / latest) * 100 + '%', background: 'var(--focus)' }}>
          <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'var(--focus)' }} />
        </div>
      </div>
      <div className="font-mono text-[12px] text-muted whitespace-nowrap min-w-[120px] text-right">
        {viewSeq == null ? '#' + latest + ' · live' : '#' + viewSeq + ' of ' + latest + ' · replay'}
      </div>
      {viewSeq != null && (
        <>
          <button onClick={() => viewAt(null)} className="btn">Live</button>
          <button onClick={restoreHere} className="btn btn-primary" title="Append a state_restored event; later events remain in the log">Restore here</button>
        </>
      )}
    </div>
  );
}
