import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { COMMANDS, runCommand, type Command } from '../commands';

const GROUP_LABEL: Record<Command['group'], string> = { view: 'View', create: 'Create', modify: 'Modify', inspect: 'Inspect', select: 'Select', document: 'Document', panels: 'Panels' };

/** S-key command box: every command, searchable, recent ones pinned when the query is empty. */
export function CommandBox() {
  const open = useStore((s) => s.cmdOpen);
  const recent = useStore((s) => s.recent);
  const st = useStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  const target = st.selBody ?? (st.sel === 'airframe' ? 'plate' : st.sel);
  const list = useMemo(() => {
    const visible = COMMANDS.filter((c) => !c.when || c.when(st, target));
    const needle = q.trim().toLowerCase();
    if (!needle) {
      const rec = recent.map((id) => visible.find((c) => c.id === id)).filter((c): c is Command => !!c);
      return [...rec.map((c) => ({ c, recent: true })), ...visible.filter((c) => !recent.includes(c.id)).map((c) => ({ c, recent: false }))];
    }
    const words = needle.split(/\s+/);
    return visible.filter((c) => words.every((w) => (c.label + ' ' + c.group + ' ' + (c.keys || '')).toLowerCase().includes(w))).map((c) => ({ c, recent: false }));
  }, [q, recent, st, target]);
  if (!open) return null;
  const run = (c: Command) => runCommand(c.id, target);
  return (
    <div className="absolute inset-0 z-[30] flex items-start justify-center pt-16" onMouseDown={() => st.patch({ cmdOpen: false })}>
      <div role="dialog" aria-label="Commands" onMouseDown={(e) => e.stopPropagation()} className="w-[520px] max-h-[70%] flex flex-col bg-surface border border-line rounded-r shadow-[0_16px_40px_rgba(0,0,0,.22)] overflow-hidden">
        <div className="flex items-center gap-2 px-3 border-b border-line2">
          <span className="font-mono text-[12px] text-muted">S</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="type a command…" className="flex-1 min-h-11 bg-transparent border-0 outline-none text-[15px] text-ink"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { const it = list[idx]; if (it) run(it.c); }
              else if (e.key === 'Escape') st.patch({ cmdOpen: false });
            }} />
          <span className="text-[12px] text-muted">↑↓ · Enter · Esc</span>
        </div>
        <div className="overflow-auto py-1">
          {list.length === 0 && <div className="px-3 py-3 text-[13px] text-muted">no command matches “{q}”</div>}
          {list.map(({ c, recent: isRecent }, i) => (
            <button key={c.id} onMouseEnter={() => setIdx(i)} onClick={() => run(c)} className="w-full text-left px-3 min-h-8 grid grid-cols-[72px_1fr_auto] gap-3 items-center bg-transparent border-0 text-ink cursor-pointer text-[13px]" style={{ background: i === idx ? 'var(--surface2)' : 'transparent' }}>
              <span className="text-[11px] font-mono uppercase tracking-[.06em] text-muted">{isRecent ? 'recent' : GROUP_LABEL[c.group]}</span>
              <span>{c.label}</span>
              <span className="font-mono text-[11px] text-muted">{c.keys || ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
