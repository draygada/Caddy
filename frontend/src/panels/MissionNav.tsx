import { PRIMARY_WORKSPACES, type WorkspaceId } from '../store';

export type { WorkspaceId } from '../store';

interface MissionNavProps {
  active: WorkspaceId;
  onSelect: (workspace: WorkspaceId) => void;
}

/** Three tabs: Design, Classification, Sourcing. Secondary surfaces are reached from the command box (S). */
export function MissionNav({ active, onSelect }: MissionNavProps) {
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
    </nav>
  );
}
