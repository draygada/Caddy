import { useEffect, useRef, useState } from 'react';

export const WORKSPACES = [
  { id: 'design', label: 'Design', kind: 'workspace' },
  { id: 'core', label: 'CAD / Core', kind: 'workspace' },
  { id: 'classification', label: 'Classification', kind: 'workspace' },
  { id: 'source', label: 'Source', kind: 'overlay' },
  { id: 'sources', label: 'Sources', kind: 'overlay' },
  { id: 'record', label: 'Record', kind: 'overlay' },
  { id: 'collaboration', label: 'Collaboration', kind: 'workspace' },
] as const;

export type WorkspaceId = (typeof WORKSPACES)[number]['id'];

const WORKSPACE_IDS = new Set<string>(WORKSPACES.map(({ id }) => id));

export function workspaceFromSearch(search: string): WorkspaceId {
  const candidate = new URLSearchParams(search).get('workspace');
  return candidate && WORKSPACE_IDS.has(candidate) ? candidate as WorkspaceId : 'design';
}

export function workspaceLocation(currentHref: string, workspace: WorkspaceId): string {
  const url = new URL(currentHref);
  url.searchParams.set('workspace', workspace);
  url.searchParams.delete('now');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isOverlayWorkspace(workspace: WorkspaceId): workspace is 'source' | 'sources' | 'record' {
  return workspace === 'source' || workspace === 'sources' || workspace === 'record';
}

interface MissionNavProps {
  active: WorkspaceId;
  onSelect: (workspace: WorkspaceId) => void;
}

export function MissionNav({ active, onSelect }: MissionNavProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [railState, setRailState] = useState({ overflow: false, atStart: true, atEnd: false });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      setRailState({
        overflow: maxScroll > 2,
        atStart: rail.scrollLeft <= 2,
        atEnd: rail.scrollLeft >= maxScroll - 2,
      });
    };
    const selected = rail.querySelector<HTMLElement>(`[data-workspace="${active}"]`);
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    rail.addEventListener('scroll', measure, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(rail);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [active]);

  const reverse = railState.atEnd && !railState.atStart;
  const moveRail = () => {
    const rail = railRef.current;
    if (!rail || !railState.overflow) return;
    rail.scrollBy({
      left: Math.max(220, rail.clientWidth * 0.75) * (reverse ? -1 : 1),
      behavior: 'smooth',
    });
  };

  return (
    <nav aria-label="Product workspaces" className="relative flex max-w-full flex-none min-w-0 overflow-hidden border-b border-line2 bg-surface">
      <div ref={railRef} data-primary-workspace-rail className="flex min-w-0 max-w-full flex-1 items-stretch gap-1 overflow-x-auto overscroll-x-contain py-[6px] px-2 [scrollbar-width:thin]">
        {WORKSPACES.map((workspace) => {
          const selected = active === workspace.id;
          return (
            <button
              key={workspace.id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              aria-pressed={selected}
              data-workspace={workspace.id}
              onClick={() => onSelect(workspace.id)}
              className="cad-mission-target flex-none min-h-8 whitespace-nowrap rounded-r border px-3 text-[12px] font-semibold cursor-pointer"
              style={{
                borderColor: selected ? 'var(--accent)' : 'transparent',
                background: selected ? 'var(--accent)' : 'transparent',
                color: selected ? 'var(--accentfg)' : 'var(--ink)',
              }}
            >
              {workspace.label}
              {workspace.kind === 'overlay' && <span className="ml-1 text-[9px] opacity-70">↗</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={reverse ? 'Show previous workspaces' : 'Show more workspaces'}
        aria-disabled={!railState.overflow}
        disabled={!railState.overflow}
        onClick={moveRail}
        className="cad-mission-target flex w-14 flex-none cursor-pointer items-center justify-center whitespace-nowrap border-0 border-l border-line2 bg-surface px-1 font-mono text-[9px] text-muted disabled:cursor-default disabled:opacity-40 sm:hidden"
      >
        {reverse ? 'BACK <' : 'MORE >'}
      </button>
    </nav>
  );
}
