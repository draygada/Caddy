import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { COMMANDS, commandAvailable, designWorkspaceMounted, runCommand, searchCommands, type Command } from '../commands';
import { useModalFocusTrap } from '../lib/modal-focus';

const GROUP_LABEL: Record<Command['group'], string> = { navigate: 'Navigate', view: 'View', create: 'Create', modify: 'Modify', inspect: 'Inspect', select: 'Select', document: 'Document', review: 'Review', panels: 'Panels' };

type PaletteShortcutEvent = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'key' | 'preventDefault'>;

export function commandPaletteBlocked(): boolean {
  return Boolean(useStore.getState().dialog || (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')));
}

export function handleCommandPaletteKeydown(event: PaletteShortcutEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return false;
  event.preventDefault();
  const state = useStore.getState();
  if (commandPaletteBlocked()) return true;
  state.patch({ cmdOpen: true, marking: null });
  return true;
}

/** S-key command box: every command, searchable, recent ones pinned when the query is empty. */
export function CommandBox() {
  const open = useStore((s) => s.cmdOpen);
  const recent = useStore((s) => s.recent);
  const st = useStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [designMounted, setDesignMounted] = useState(designWorkspaceMounted);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(open);
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => {
    const syncWorkspace = () => setDesignMounted(designWorkspaceMounted());
    syncWorkspace();
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(syncWorkspace);
    observer?.observe(document.body, { childList: true, subtree: true });
    return () => { observer?.disconnect(); };
  }, []);
  const target = st.selBody ?? (st.sel === 'airframe' ? 'plate' : st.sel);
  const list = useMemo(() => {
    const visible = COMMANDS.filter((c) => c.id !== 'doc.now' && commandAvailable(c, designMounted) && (!c.when || c.when(st, target)));
    const needle = q.trim().toLowerCase();
    if (!needle) {
      const rec = recent.map((id) => visible.find((c) => c.id === id)).filter((c): c is Command => !!c);
      return [...rec.map((c) => ({ c, recent: true })), ...visible.filter((c) => !recent.includes(c.id)).map((c) => ({ c, recent: false }))];
    }
    return searchCommands(visible, needle).map((c) => ({ c, recent: false }));
  }, [q, recent, st, target, designMounted]);
  // the floating opener belongs to the design workspace; on the other tabs it only covered content
  if (!open) return st.workspace !== 'design' ? null : (
    <button type="button" aria-label="Open command palette" aria-keyshortcuts="Meta+K Control+K S" onClick={() => { if (!commandPaletteBlocked()) st.patch({ cmdOpen: true }); }}
      className="btn btn-icon fixed sm:hidden left-3 bottom-[68px] md:bottom-3 z-[28] min-h-11 min-w-11 flex items-center justify-center bg-surface shadow-[0_4px_14px_rgba(0,0,0,.14)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span className="sr-only">Commands</span>
    </button>
  );
  const run = (c: Command) => {
    st.patch({ cmdOpen: false, marking: null });
    runCommand(c.id, target);
  };
  return (
    <div className="fixed inset-0 z-[50] flex items-start justify-center px-2 pt-16 bg-[rgba(15,23,32,.18)]" onMouseDown={() => st.patch({ cmdOpen: false })}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Commands" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} className="w-[min(520px,100%)] max-h-[70%] flex flex-col bg-surface border border-line rounded-r shadow-[0_16px_40px_rgba(0,0,0,.22)] overflow-hidden">
        <div className="flex items-center gap-2 px-3 border-b border-line2">
          <span className="font-mono text-[12px] text-muted">S / ⌘K</span>
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="type a command…" className="flex-1 min-h-11 bg-transparent border-0 outline-none text-[15px] text-ink"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { const it = list[idx]; if (it) run(it.c); }
              else if (e.key === 'Escape') st.patch({ cmdOpen: false });
            }} />
          <span className="text-[12px] text-muted">↑↓ · Enter · Esc</span>
        </div>
        {!designMounted && (
          <div role="status" className="px-3 py-2 border-b border-line2 bg-surface2 text-[12px] text-muted">
            Global commands only. Open <b className="text-ink">Design</b> in the mission rail to use Sketch, Extrude, modify, inspect, and view commands. Off-screen CAD mutations are blocked.
          </div>
        )}
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
