import { useStore, intakeIncomplete } from '../store';
import { useTripwireStore } from '../tripwire-store';

interface TopBarProps {
  onHome?: () => void;
  onOpenTripwire?: () => void;
}

export function TopBar({ onHome, onOpenTripwire }: TopBarProps = {}) {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const patch = useStore((s) => s.patch);
  const project = useStore((s) => s.project);
  const closeProject = useStore((s) => s.closeProject);
  const projectName = project?.name ?? 'Kestrel';
  const closeTripwire = useTripwireStore((s) => s.closePanel);
  // The logo goes back to the projects page.
  const goHome = () => {
    onHome?.();
    closeTripwire();
    closeProject();
  };
  return (
    <div className="h-12 flex-none flex items-center gap-2 px-2 sm:gap-4 sm:pl-4 sm:pr-3 border-b border-line2 bg-surface">
      <button onClick={goHome} title="All projects" className="flex items-center gap-[10px] bg-transparent border-0 p-0 text-ink cursor-pointer min-h-6">
        <img src="/logo.png" alt="" width={34} height={34} className="block w-[34px] h-[34px]" />
        <span className="font-bold tracking-[.01em]">Caddy</span>
      </button>
      <span className="hidden sm:inline text-muted text-[13px]">{projectName}</span>
      {project && (intakeIncomplete(project.intake)
        ? <button onClick={() => patch({ intakeOpen: true })} className="chip" style={{ color: 'var(--amber)', borderColor: 'var(--amber)', cursor: 'pointer' }}>requires more information</button>
        : <button onClick={() => patch({ intakeOpen: true })} className="chip" style={{ cursor: 'pointer' }} title="edit the use case">use case declared</button>)}
      <div className="flex-1" />
      <div className="flex gap-[6px]">
        {project && (
          <button onClick={() => patch({ cmdOpen: true, marking: null })} className="btn hidden sm:inline-flex items-center gap-2 text-muted" title="search every command and operation" aria-label="Open command search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span>Commands</span>
            <kbd className="chip chip-sm">⌘ K</kbd>
          </button>
        )}
        {onOpenTripwire && <button onClick={onOpenTripwire} className="btn hidden">Tripwire</button>}
        <button onClick={toggleTheme} className="btn">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
        <button onClick={toggleHelp} aria-label="Keyboard and mouse help" className="btn btn-icon">?</button>
      </div>
    </div>
  );
}
