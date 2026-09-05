import { useStore, BODY_LABEL } from '../store';
import { COMMANDS, MARKING_OVERFLOW, MARKING_WHEEL, runCommand } from '../commands';

/** Right-click wheel: eight frequent commands around the cursor, more in the list beneath. Target is the body under the cursor. */
export function MarkingMenu() {
  const marking = useStore((s) => s.marking);
  const st = useStore();
  if (!marking) return null;
  const { x, y, target } = marking;
  const R = 64;
  const items = MARKING_WHEEL.map((id) => COMMANDS.find((c) => c.id === id)!).filter(Boolean);
  const overflow = MARKING_OVERFLOW.map((id) => COMMANDS.find((c) => c.id === id)!).filter(Boolean);
  const enabled = (c: (typeof items)[number]) => !c.when || c.when(st, target);
  return (
    <>
      <div className="absolute inset-0 z-[20]" onMouseDown={() => st.patch({ marking: null })} onContextMenu={(e) => { e.preventDefault(); st.patch({ marking: null }); }} />
      <div className="absolute z-[21]" style={{ left: x, top: y }} role="menu" aria-label="Marking menu">
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full" style={{ background: 'var(--focus)' }} />
        {target && <div className="absolute -translate-x-1/2 translate-y-[-118px] text-[12px] font-mono text-muted whitespace-nowrap px-2 py-[2px] bg-surface border border-line rounded-r">{BODY_LABEL[target]}</div>}
        {items.map((c, i) => {
          const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
          const cx = Math.cos(a) * R, cy = Math.sin(a) * R;
          const ok = enabled(c);
          return (
            <button key={c.id} role="menuitem" disabled={!ok} onClick={() => runCommand(c.id, target)}
              className="absolute -translate-x-1/2 -translate-y-1/2 min-w-[68px] h-7 px-2 text-[12px] font-semibold rounded-r border bg-surface whitespace-nowrap hover:bg-hover disabled:opacity-40"
              style={{ left: cx, top: cy, borderColor: 'var(--line)', color: 'var(--ink)' }}>
              {c.label.replace('…', '').replace(/ \(.*\)$/, '')}
            </button>
          );
        })}
        <div className="absolute -translate-x-1/2 w-[200px] bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)] py-1" style={{ left: 0, top: R + 26 }}>
          {overflow.map((c) => (
            <button key={c.id} role="menuitem" disabled={!enabled(c)} onClick={() => runCommand(c.id, target)} className="row-hover w-full text-left px-3 min-h-7 text-[13px] bg-transparent border-0 text-ink cursor-pointer disabled:opacity-40 flex justify-between gap-2">
              <span>{c.label}</span>{c.keys && <span className="font-mono text-[11px] text-muted">{c.keys}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
