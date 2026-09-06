import { useEffect, useRef, useState } from 'react';
import { MORE_WORKSPACES, PRIMARY_WORKSPACES, type WorkspaceId } from '../store';

export type { WorkspaceId } from '../store';

interface MissionNavProps {
  active: WorkspaceId;
  onSelect: (workspace: WorkspaceId) => void;
}

/** Three tabs: Design, Classification, Sourcing. Everything else lives behind More (and the command box). */
export function MissionNav({ active, onSelect }: MissionNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const activeMore = MORE_WORKSPACES.find((w) => w.id === active);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [moreOpen]);

  return (
    <nav aria-label="Product workspaces" className="flex-none flex items-center gap-1 px-2 py-[6px] border-b border-line2 bg-surface">
      <div role="tablist" aria-label="Primary workspaces" className="flex items-stretch gap-1">
        {PRIMARY_WORKSPACES.map((w) => {
          const selected = active === w.id;
          return (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-workspace={w.id}
              onClick={() => onSelect(w.id)}
              className="min-h-8 whitespace-nowrap rounded-r border px-4 text-[13px] font-semibold cursor-pointer"
              style={{ borderColor: selected ? 'var(--accent)' : 'transparent', background: selected ? 'var(--accent)' : 'transparent', color: selected ? 'var(--accentfg)' : 'var(--ink)' }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <div ref={moreRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className="btn"
          style={activeMore ? { borderColor: 'var(--accent)', fontWeight: 600 } : undefined}
        >
          {activeMore ? activeMore.label : 'More'} ▾
        </button>
        {moreOpen && (
          <div role="menu" aria-label="More workspaces" className="absolute right-0 top-[38px] z-[15] w-[280px] bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)] py-1">
            {MORE_WORKSPACES.map((w) => (
              <button key={w.id} role="menuitem" onClick={() => { onSelect(w.id); setMoreOpen(false); }} className="row-hover w-full text-left px-3 min-h-9 grid gap-0 bg-transparent border-0 text-ink cursor-pointer" style={{ background: active === w.id ? 'var(--surface2)' : 'transparent' }}>
                <span className="text-[13px] font-semibold">{w.label}</span>
                <span className="text-[12px] text-muted">{w.hint}</span>
              </button>
            ))}
            <div className="border-t border-line2 mt-1 pt-1 px-3 py-1 text-[11px] text-muted">also reachable from the command box · S</div>
          </div>
        )}
      </div>
    </nav>
  );
}
