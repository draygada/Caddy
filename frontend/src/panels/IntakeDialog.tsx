import { useState } from 'react';
import { useStore, INTAKE_DEFAULT, intakeIncomplete, type Intake } from '../store';
import { IntakeForm } from './IntakeForm';

/** Amber notice shown wherever the project's use case is still missing or "not sure yet". */
export function NeedsInfoBanner({ compact = false }: { compact?: boolean }) {
  const project = useStore((s) => s.project);
  const patch = useStore((s) => s.patch);
  if (!project || !intakeIncomplete(project.intake)) return null;
  return (
    <div role="status" className={'flex items-center justify-between gap-3 flex-wrap ' + (compact ? 'px-3 py-2 text-[13px]' : 'px-4 py-3 text-[14px]')} style={{ background: 'color-mix(in srgb, var(--amber) 12%, var(--surface))', borderBottom: '1px solid var(--line2)' }}>
      <span><b style={{ color: 'var(--amber)' }}>This application requires more information.</b> {project.intake ? 'Some use-case answers are still “not sure yet”.' : 'The use-case questions were skipped when the project was created.'} Classification and sourcing cannot complete until they are answered.</span>
      <button onClick={() => patch({ intakeOpen: true })} className="btn btn-primary">Answer the questions</button>
    </div>
  );
}

/** Modal for answering or editing the project's use-case questions from inside the workbench. */
export function IntakeDialog() {
  const open = useStore((s) => s.intakeOpen);
  const project = useStore((s) => s.project);
  const setProjectIntake = useStore((s) => s.setProjectIntake);
  const patch = useStore((s) => s.patch);
  const [draft, setDraft] = useState<Intake>(project?.intake ?? INTAKE_DEFAULT);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (!open || !project) return null;
  if (seeded !== project.id + ':' + String(!!project.intake)) { setDraft(project.intake ?? INTAKE_DEFAULT); setSeeded(project.id + ':' + String(!!project.intake)); }
  return (
    <div className="absolute inset-0 z-[40] bg-scrim flex items-center justify-center p-4" onMouseDown={() => patch({ intakeOpen: false })}>
      <div role="dialog" aria-label="Use case" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[760px] bg-surface border border-line rounded-r shadow-[0_16px_40px_rgba(0,0,0,.22)] flex flex-col max-h-full">
        <div className="panel-head"><div className="panel-title">{project.name} · use case <span className="sub">· declared facts · badged, never inferred</span></div><button onClick={() => patch({ intakeOpen: false })} className="btn btn-xs btn-icon" aria-label="Close" title="Close · Esc">×</button></div>
        <div className="p-4 overflow-auto"><IntakeForm value={draft} onChange={setDraft} /></div>
        <div className="px-4 py-3 border-t border-line2 flex justify-end gap-2">
          <button onClick={() => patch({ intakeOpen: false })} className="btn">Cancel</button>
          <button onClick={() => setProjectIntake(draft)} className="btn btn-primary">Save answers</button>
        </div>
      </div>
    </div>
  );
}
