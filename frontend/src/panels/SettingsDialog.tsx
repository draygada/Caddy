import { useEffect, useState } from 'react';
import { useStore, INTAKE_DEFAULT, intakeIncomplete, type Intake } from '../store';
import { IntakeForm } from './IntakeForm';

/** One place for the product's use case, the theme, the command search and the help. Opened from the gear in the top bar. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const patch = useStore((s) => s.patch);
  const setProjectIntake = useStore((s) => s.setProjectIntake);
  const [draft, setDraft] = useState<Intake>(project?.intake ?? INTAKE_DEFAULT);
  const dirty = JSON.stringify(draft) !== JSON.stringify(project?.intake ?? INTAKE_DEFAULT);
  const incomplete = intakeIncomplete(project?.intake ?? null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <div role="dialog" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[760px] bg-surface border border-line rounded-r shadow-[0_16px_40px_rgba(0,0,0,.22)] flex flex-col max-h-full">
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
