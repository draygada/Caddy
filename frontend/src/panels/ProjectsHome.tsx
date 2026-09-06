import { useState } from 'react';
import { useStore, INTAKE_DEFAULT, intakeIncomplete, type Intake } from '../store';
import { IntakeForm } from './IntakeForm';
import { DesignPreview } from './DesignPreview';
import { baselineSnapshotFor } from '../store';

/** The entry point: your projects, open one or create one. Creating asks the use-case questions first; they can be skipped for now. */
export function ProjectsHome() {
  const projects = useStore((s) => s.projects);
  const openProject = useStore((s) => s.openProject);
  const createProject = useStore((s) => s.createProject);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const theme = useStore((s) => s.theme);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intake, setIntake] = useState<Intake>(INTAKE_DEFAULT);

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg text-ink">
      <div className="h-12 flex-none flex items-center gap-3 px-4 border-b border-line2 bg-surface">
        <img src="/logo.png" alt="" width={34} height={34} className="block w-[34px] h-[34px]" />
        <span className="font-bold tracking-[.01em]">Caddy</span>
        <span className="text-muted text-[13px]">Projects</span>
        <div className="flex-1" />
        <button onClick={toggleTheme} className="btn">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="max-w-[1040px] mx-auto grid gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[22px] font-bold m-0">Projects</h1>
              <div className="text-[13px] text-muted">Open a design, or start a new one. Every project carries the use-case answers that classification and sourcing read.</div>
            </div>
            <button onClick={() => setCreating(true)} className="btn btn-primary btn-lg">New project</button>
          </div>

          {creating && (
            <div className="panel">
              <div className="panel-head"><div className="panel-title">New project <span className="sub">· the use case comes first</span></div><button onClick={() => setCreating(false)} className="btn">Cancel</button></div>
              <div className="p-4 grid gap-4">
                <div className="grid grid-cols-[1fr_2fr] gap-3 text-[13px]">
                  <label className="grid gap-1 text-muted">project name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kestrel v2" className="field" autoFocus /></label>
                  <label className="grid gap-1 text-muted">what are you building?<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="fixed-wing survey drone with a thermal payload" className="field" /></label>
                </div>
                <div className="border-t border-line2 pt-3">
                  <div className="text-[13px] font-semibold mb-2">Before the design starts <span className="text-muted font-normal">· declared facts · badged, never inferred</span></div>
                  <IntakeForm value={intake} onChange={setIntake} />
                </div>
                <div className="flex justify-between gap-2 flex-wrap items-center border-t border-line2 pt-3">
                  <button onClick={() => createProject(name, description, null)} className="btn" title="just tinkering: the design opens, but classification and sourcing will ask for these answers before they complete">Skip for now · I don't know yet</button>
                  <div className="flex gap-2 items-center">
                    {intakeIncomplete(intake) && <span className="text-[12px] text-amber">some answers are “not sure yet”; the project will ask again</span>}
                    <button onClick={() => createProject(name, description, intake)} className="btn btn-primary btn-lg">Create project</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {projects.map((p) => (
              <button key={p.id} onClick={() => openProject(p.id)} className="panel text-left p-0 grid gap-0 cursor-pointer hover:border-focus overflow-hidden" style={{ borderColor: 'var(--line2)' }}>
                <DesignPreview snap={p.snapshot ?? baselineSnapshotFor(p.id)} className="w-full block border-b border-line2" />
                <div className="p-4 grid gap-2">
                <div className="flex justify-between gap-2 items-baseline"><span className="text-[16px] font-semibold">{p.name}</span><span className="text-[12px] text-muted">opened {p.openedAt.slice(5)}</span></div>
                <div className="text-[13px] text-muted min-h-[18px]">{p.description || 'no description'}</div>
                <div className="text-[12px] flex gap-2 items-center flex-wrap">
                  {intakeIncomplete(p.intake) ? <span className="chip chip-sm" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>requires more information</span> : <span className="chip chip-sm">use case declared</span>}
                  {p.intake && <span className="text-muted">{p.intake.endUse} · {p.intake.endUser} · ship-to {p.intake.shipTo}</span>}
                </div>
                </div>
              </button>
            ))}
            <button onClick={() => setCreating(true)} className="panel text-left p-4 grid place-items-center min-h-[120px] cursor-pointer border-dashed hover:border-focus text-muted">+ New project</button>
          </div>
        </div>
      </div>
    </div>
  );
}
