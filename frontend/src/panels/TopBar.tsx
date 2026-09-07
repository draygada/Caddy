import { useState } from 'react';
import { useStore, intakeIncomplete, PRIMARY_WORKSPACES, type WorkspaceId } from '../store';
import { useTripwireStore } from '../tripwire-store';
import { SettingsDialog } from './SettingsDialog';

interface TopBarProps {
  onHome?: () => void;
  /** the active workspace tab; omitted on the projects page */
  active?: WorkspaceId;
  onSelect?: (workspace: WorkspaceId) => void;
}

/** One bar: logo, project, the three workspace tabs, and a gear for settings (use case, theme, commands, help). */
export function TopBar({ onHome, active, onSelect }: TopBarProps = {}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    <header className="h-12 min-w-0 flex-none flex items-center gap-2 px-2 sm:gap-3 sm:pl-4 sm:pr-3 border-b border-line2 bg-surface">
      <a href="/" onClick={(e) => { e.preventDefault(); goHome(); }} aria-label="Back to all projects" title="Back to all projects" className="flex shrink-0 items-center gap-[10px] bg-transparent border-0 p-0 text-ink no-underline cursor-pointer min-h-11 max-[480px]:w-11 max-[480px]:justify-center">
        <img src="/logo.png" alt="" width={34} height={34} className="block w-[34px] h-[34px]" />
        <span className="font-bold tracking-[.01em] max-[480px]:hidden">Caddy</span>
      </a>
      <span className="hidden md:inline shrink-0 text-muted text-[13px] max-w-[210px] whitespace-nowrap overflow-hidden text-ellipsis">{projectName} · Candidate 0.2</span>
      {project && active && onSelect && (
        <div role="tablist" aria-label="Primary workspaces" className="flex min-w-0 items-stretch gap-1 sm:ml-2 max-[480px]:flex-1 max-[480px]:justify-center">
          {PRIMARY_WORKSPACES.map((w) => {
            const selected = active === w.id;
            return (
              <button key={w.id} type="button" role="tab" aria-selected={selected} data-workspace={w.id} onClick={() => onSelect(w.id)}
                className="min-h-8 min-w-0 whitespace-nowrap rounded-r border px-2 sm:px-4 text-[13px] max-[360px]:px-1 max-[360px]:text-[11px] font-semibold cursor-pointer"
                style={{ borderColor: selected ? 'var(--accent)' : 'transparent', background: selected ? 'var(--accent)' : 'transparent', color: selected ? 'var(--accentfg)' : 'var(--ink)' }}>
                {w.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex-1 max-[480px]:hidden" />
      <button onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-label="Settings" title={incomplete ? 'Settings · the use case requires more information' : 'Settings'} className="btn btn-icon relative shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        {incomplete && <span aria-hidden="true" className="absolute -top-[2px] -right-[2px] w-2 h-2 rounded-full" style={{ background: 'var(--amber)' }} />}
      </button>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
