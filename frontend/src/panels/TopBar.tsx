import { useStore, intakeIncomplete, PRIMARY_WORKSPACES, type WorkspaceId } from '../store';
import { useTripwireStore } from '../tripwire-store';

interface TopBarProps {
  onHome?: () => void;
  /** the active workspace tab; omitted on the projects page */
  active?: WorkspaceId;
  onSelect?: (workspace: WorkspaceId) => void;
  /** the overall product status word; clicking it opens the status modal */
  status?: { glyph: string; word: string; color: string; bg: string } | null;
  onStatus?: () => void;
}

/** One bar: logo, project, the three workspace tabs, the status and use-case chips, commands, theme, help. */
export function TopBar({ onHome, active, onSelect, status, onStatus }: TopBarProps = {}) {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const patch = useStore((s) => s.patch);
  const project = useStore((s) => s.project);
  const closeProject = useStore((s) => s.closeProject);
  const projectName = project?.name ?? 'Kestrel';
  const closeTripwire = useTripwireStore((s) => s.closePanel);
  const incomplete = project ? intakeIncomplete(project.intake) : false;
  // The logo goes back to the projects page.
  const goHome = () => {
    onHome?.();
    closeTripwire();
    closeProject();
  };
  return (
    <header className="h-12 flex-none flex items-center gap-2 px-2 sm:gap-3 sm:pl-4 sm:pr-3 border-b border-line2 bg-surface">
      <a href="/" onClick={(e) => { e.preventDefault(); goHome(); }} aria-label="Back to all projects" title="Back to all projects" className="flex shrink-0 items-center gap-[10px] bg-transparent border-0 p-0 text-ink no-underline cursor-pointer min-h-11">
        <img src="/logo.png" alt="" width={34} height={34} className="block w-[34px] h-[34px]" />
        <span className="font-bold tracking-[.01em]">Caddy</span>
      </a>
      <span className="hidden md:inline shrink-0 text-muted text-[13px] max-w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">{projectName}</span>
      {project && active && onSelect && (
        <div role="tablist" aria-label="Primary workspaces" className="flex items-stretch gap-1 sm:ml-2">
          {PRIMARY_WORKSPACES.map((w) => {
            const selected = active === w.id;
            return (
              <button key={w.id} type="button" role="tab" aria-selected={selected} data-workspace={w.id} onClick={() => onSelect(w.id)}
                className="min-h-8 whitespace-nowrap rounded-r border px-3 sm:px-4 text-[13px] font-semibold cursor-pointer"
                style={{ borderColor: selected ? 'var(--accent)' : 'transparent', background: selected ? 'var(--accent)' : 'transparent', color: selected ? 'var(--accentfg)' : 'var(--ink)' }}>
                {w.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex-1" />
      {project && (
        <div className="hidden sm:flex items-center gap-[6px]">
          {incomplete
            ? <button onClick={() => patch({ intakeOpen: true })} className="chip" style={{ color: 'var(--amber)', borderColor: 'var(--amber)', cursor: 'pointer' }}>requires more information</button>
            : <button onClick={() => patch({ intakeOpen: true })} className="chip" style={{ cursor: 'pointer' }} title="edit the use case">use case declared</button>}
          {status && onStatus && (
            <button onClick={onStatus} className="chip" title="product status · what the design means for compliance" aria-haspopup="dialog"
              style={{ cursor: 'pointer', color: incomplete ? 'var(--amber)' : status.color, background: incomplete ? 'transparent' : status.bg, borderColor: incomplete ? 'var(--amber)' : status.bg === 'transparent' ? 'var(--line)' : status.bg }}>
              {incomplete ? '? status' : status.glyph + ' ' + status.word}
            </button>
          )}
        </div>
      )}
      <div className="flex gap-[6px]">
        {project && (
          <button onClick={() => patch({ cmdOpen: true, marking: null })} className="btn hidden sm:inline-flex items-center gap-2 text-muted" title="search every command and operation" aria-label="Open command search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="hidden lg:inline">Commands</span>
            <kbd className="chip chip-sm hidden lg:inline">⌘ K</kbd>
          </button>
        )}
        <button onClick={toggleTheme} className="btn min-w-11" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}><span className="hidden lg:inline">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span><span className="lg:hidden" aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button>
        <button onClick={toggleHelp} aria-label="Keyboard and mouse help" className="btn btn-icon">?</button>
      </div>
    </header>
  );
}
