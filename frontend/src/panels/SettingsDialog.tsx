import { useEffect, useRef, useState } from 'react';
import { useStore, INTAKE_DEFAULT, intakeIncomplete, type Intake } from '../store';
import { IntakeForm } from './IntakeForm';

/** One place for the product's use case, the theme, the command search and the help. Opened from the gear in the top bar. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const project = useStore((s) => s.project);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const patch = useStore((s) => s.patch);
  const setProjectIntake = useStore((s) => s.setProjectIntake);
  const liveAuth = useStore((s) => s.liveAuth);
  const setLiveAuth = useStore((s) => s.setLiveAuth);
  const [draft, setDraft] = useState<Intake>(project?.intake ?? INTAKE_DEFAULT);
  const dirty = JSON.stringify(draft) !== JSON.stringify(project?.intake ?? INTAKE_DEFAULT);
  const incomplete = intakeIncomplete(project?.intake ?? null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')) : [];
    const focusFrame = requestAnimationFrame(() => (focusable()[0] ?? dialog)?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0], last = items[items.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (e.shiftKey && (outside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);
  const setTheme = (t: 'light' | 'dark') => { if (theme !== t) toggleTheme(); };
  const Section = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <section className="grid gap-2 border-t border-line2 pt-3 first:border-0 first:pt-0">
      <h3 className="m-0 text-[13px] font-semibold">{title}{sub && <span className="text-muted font-normal"> · {sub}</span>}</h3>
      {children}
    </section>
  );
  return (
    <div className="fixed inset-0 z-[40] bg-scrim flex items-center justify-center p-4" onMouseDown={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[760px] bg-surface border border-line rounded-r shadow-[0_16px_40px_rgba(0,0,0,.22)] flex flex-col max-h-full">
        <div className="panel-head"><div className="panel-title">Settings{project && <span className="sub"> · {project.name}</span>}</div><button onClick={onClose} className="btn btn-xs btn-icon" aria-label="Close" title="Close · Esc">×</button></div>
        <div className="p-4 overflow-auto grid gap-4 text-[13px]">
          {project && (
            <Section title="Product" sub={incomplete ? 'requires more information' : 'use case declared'}>
              <IntakeForm value={draft} onChange={setDraft} />
              <div className="flex gap-2 items-center flex-wrap">
                <button onClick={() => { setProjectIntake(draft); patch({ intakeOpen: false }); }} disabled={!dirty} className="btn btn-primary disabled:opacity-50">Save answers</button>
                {dirty && <button onClick={() => setDraft(project.intake ?? INTAKE_DEFAULT)} className="btn">Discard changes</button>}
                {incomplete && <span className="text-[12px] text-amber">some answers are missing or “not sure yet”</span>}
              </div>
            </Section>
          )}
          <Section title="Live classification" sub={liveAuth.accessToken.trim() && liveAuth.publicSyntheticDataConfirmed ? 'available · explicit Ask Claude actions are enabled' : 'off · deterministic runs remain available'}>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <label className="grid gap-1 text-muted">live access token <span className="text-[12px]">· the value the product service was started with · kept for this tab only</span><input type="password" autoComplete="off" value={liveAuth.accessToken} onChange={(e) => setLiveAuth({ ...liveAuth, accessToken: e.target.value })} className="field font-mono text-ink" /></label>
              {liveAuth.accessToken && <button onClick={() => setLiveAuth({ accessToken: '', publicSyntheticDataConfirmed: false })} className="btn">Forget token</button>}
            </div>
            <label className="flex items-center gap-3 min-h-11 cursor-pointer"><input type="checkbox" checked={liveAuth.publicSyntheticDataConfirmed} onChange={(e) => setLiveAuth({ ...liveAuth, publicSyntheticDataConfirmed: e.target.checked })} /> the data I submit to the engine is public or synthetic</label>
            <div className="text-[12px] text-muted">Every live call presents the token; the server enforces its own call and cost caps and fails closed when the lane is not configured. The key stays on the server.</div>
          </Section>
          <Section title="Appearance">
            <div role="radiogroup" aria-label="Theme" className="flex gap-1">
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className="btn" style={theme === t ? { background: 'var(--accent)', color: 'var(--accentfg)', borderColor: 'var(--accent)' } : undefined}>{t === 'light' ? '☀ Light' : '☾ Dark'}</button>
              ))}
            </div>
          </Section>
          <Section title="Commands and help">
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => { onClose(); patch({ cmdOpen: true, marking: null }); }} className="btn flex items-center gap-2"><span>Command search</span><kbd className="chip chip-sm">⌘ K</kbd></button>
              <button onClick={() => { onClose(); toggleHelp(); }} className="btn flex items-center gap-2"><span>Keyboard and mouse help</span><kbd className="chip chip-sm">?</kbd></button>
            </div>
            <div className="text-[12px] text-muted">1, 2, 3 switch tabs · S or ⌘K opens the command search · Esc closes anything</div>
          </Section>
        </div>
      </div>
    </div>
  );
}
