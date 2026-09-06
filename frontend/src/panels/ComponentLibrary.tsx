import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { CATALOG, COMPONENT_CATEGORIES, COMPONENT_PRESETS, DEFAULT_PART, GENERIC_NAME, type Slot } from '../lib/catalog';
import { THUMBS } from '../lib/geometry';

/** The preset component library: everything a project can hold, grouped by category. Types already in the project are shown as such. */
export function ComponentLibrary({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const addComponent = useStore((s) => s.addComponent);
  const place = useStore((s) => s.place);
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const have = new Set<Slot>(project?.components ?? []);
  const needle = q.trim().toLowerCase();
  const matches = (slot: Slot, blurb: string) => !needle || GENERIC_NAME[slot].toLowerCase().includes(needle) || blurb.toLowerCase().includes(needle) || CATALOG[DEFAULT_PART[slot]].name.toLowerCase().includes(needle);
  const addAndPlace = (slot: Slot) => { addComponent(slot); place(slot, DEFAULT_PART[slot]); onClose(); };
  return (
    <div className="fixed inset-0 z-[40] bg-scrim flex items-center justify-center p-4" onMouseDown={onClose}>
      <div role="dialog" aria-label="Component library" onMouseDown={(e) => e.stopPropagation()} className="panel w-full max-w-[760px] max-h-full flex flex-col shadow-[0_16px_40px_rgba(0,0,0,.22)]">
        <div className="panel-head">
          <div className="panel-title">Add components <span className="sub">· the library · a type joins the project, then you place it</span></div>
          <button onClick={onClose} className="btn">Close · Esc</button>
        </div>
        <div className="px-4 pt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" aria-label="Search the component library" className="field w-full" autoFocus />
        </div>
        <div className="p-4 grid gap-4 overflow-auto">
          {COMPONENT_CATEGORIES.map((cat) => {
            const items = COMPONENT_PRESETS.filter((p) => p.category === cat && matches(p.slot, p.blurb));
            if (items.length === 0) return null;
            return (
              <div key={cat} className="grid gap-2">
                <div className="text-[12px] font-mono uppercase tracking-[.06em] text-muted">{cat}</div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
                  {items.map((p) => {
                    const inProject = have.has(p.slot);
                    const pid = DEFAULT_PART[p.slot];
                    return (
                      <div key={p.slot} className="border border-line2 rounded-r p-3 grid grid-cols-[56px_minmax(0,1fr)] gap-3 items-start" style={{ background: inProject ? 'var(--surface2)' : 'var(--surface)' }}>
                        <svg viewBox="0 0 56 44" width="56" height="44" aria-hidden="true" className="block">{THUMBS[pid].map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth="0.6" />)}</svg>
                        <div className="grid gap-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-[14px]">{GENERIC_NAME[p.slot]}</span>
                            {p.regulated ? <span className="chip chip-sm">read by rules</span> : <span className="chip chip-sm">no rule</span>}
                          </div>
                          <div className="text-[12px] text-muted">{p.blurb}</div>
                          <div className="text-[12px] text-muted">default model · {CATALOG[pid].name} · {CATALOG[pid].vendor}</div>
                          <div className="flex gap-2 pt-1">
                            {inProject
                              ? <span className="text-[12px] text-muted self-center">in this project</span>
                              : <>
                                <button onClick={() => { addComponent(p.slot); onClose(); }} className="btn btn-xs" title="add the type to the browser; place it later by drag or click">Add to project</button>
                                <button onClick={() => addAndPlace(p.slot)} className="btn btn-xs btn-primary" title="add the type and place its default model on the plate now">Add and place</button>
                              </>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {COMPONENT_PRESETS.every((p) => !matches(p.slot, p.blurb)) && <div className="text-[13px] text-muted">nothing in the library matches “{q}”</div>}
        </div>
      </div>
    </div>
  );
}
