export const WORKSPACES = [
  { id: 'design', label: 'Design', kind: 'workspace' },
  { id: 'core', label: 'Core / Assembly', kind: 'workspace' },
  { id: 'classification', label: 'Classification', kind: 'workspace' },
  { id: 'tripwire', label: 'Tripwire', kind: 'workspace' },
  { id: 'source', label: 'Source', kind: 'overlay' },
  { id: 'sources', label: 'Sources', kind: 'overlay' },
  { id: 'record', label: 'Record', kind: 'overlay' },
  { id: 'collaboration', label: 'Collaboration', kind: 'workspace' },
  { id: 'now', label: 'Now', kind: 'workspace' },
] as const;

export type WorkspaceId = (typeof WORKSPACES)[number]['id'];

interface MissionNavProps {
  active: WorkspaceId;
  onSelect: (workspace: WorkspaceId) => void;
}

export function MissionNav({ active, onSelect }: MissionNavProps) {
  return (
    <nav aria-label="Product workspaces" className="flex-none min-w-0 border-b border-line2 bg-surface">
      <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-[6px] [scrollbar-width:thin]">
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
              className="flex-none min-h-8 whitespace-nowrap rounded-r border px-3 text-[12px] font-semibold cursor-pointer"
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
    </nav>
  );
}
