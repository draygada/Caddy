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
      <button onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-label="Settings" title={incomplete ? 'Settings · the use case requires more information' : 'Settings'} className="btn btn-icon relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        {incomplete && <span aria-hidden="true" className="absolute -top-[2px] -right-[2px] w-2 h-2 rounded-full" style={{ background: 'var(--amber)' }} />}
      </button>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
