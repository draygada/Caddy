import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useStore, BODY_LABEL } from '../store';
import { CATALOG, CORE_SLOTS, DEFAULT_PART, GENERIC_NAME, type PartId, type Slot } from '../lib/catalog';
import { UNITS } from '../lib/units';
import { Body, Chevron, Component, Doc, Eye, EyeOff, Feature, Folder, Gear, Sketch, Home } from './Icons';
import { ComponentLibrary } from './ComponentLibrary';

const SWATCHES = ['#205840', '#2a78d6', '#b3261e', '#8a5a00', '#6b3fa0', '#0e7490', '#a3480a', '#4b5563'];

interface RowProps {
  depth: number; icon: ReactNode; name: ReactNode; open?: boolean; onToggle?: () => void; hiddenId?: string; active?: boolean; dim?: boolean; radio?: boolean;
  onClick?: () => void; trailing?: ReactNode; draggable?: boolean; onDragStart?: (e: DragEvent<HTMLDivElement>) => void; onDragEnd?: () => void; title?: string;
}

function Row({ depth, icon, name, open, onToggle, hiddenId, active, dim, radio, onClick, trailing, draggable, onDragStart, onDragEnd, title }: RowProps) {
  const hidden = useStore((s) => (hiddenId ? !!s.hidden[hiddenId] : false));
  const toggleHidden = useStore((s) => s.toggleHidden);
  return (
    <div role="treeitem" aria-expanded={onToggle ? open : undefined} aria-selected={active} className="tree-row" data-active={active ? 'true' : 'false'} data-dim={dim || hidden ? 'true' : 'false'}
      style={{ paddingLeft: 6 + depth * 16, cursor: draggable ? 'grab' : 'pointer' }} onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} title={title} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); if (e.key === 'ArrowRight' && onToggle && !open) onToggle(); if (e.key === 'ArrowLeft' && onToggle && open) onToggle(); }}>
      {onToggle ? <button className="tree-btn" aria-label={open ? 'collapse' : 'expand'} onClick={(e) => { e.stopPropagation(); onToggle(); }}><Chevron open={open} width={12} height={12} /></button> : <span />}
      {hiddenId ? (
        <button className="tree-btn" aria-label={hidden ? 'show' : 'hide'} aria-pressed={!hidden} onClick={(e) => { e.stopPropagation(); toggleHidden(hiddenId); }} style={{ color: hidden ? 'var(--muted)' : 'var(--ink)' }}>{hidden ? <EyeOff /> : <Eye />}</button>
      ) : radio != null ? (
        <span className="inline-flex items-center justify-center w-[18px] h-[18px]"><span className="w-[10px] h-[10px] rounded-full border" style={{ borderColor: 'var(--muted)', background: radio ? 'var(--accent)' : 'transparent', boxShadow: radio ? 'inset 0 0 0 2px var(--surface)' : 'none' }} /></span>
      ) : <span />}
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-muted">{icon}</span>
      <span className="tree-name" style={{ fontWeight: active ? 700 : 500 }}>{name}</span>
      <span className="text-[12px] text-muted whitespace-nowrap flex items-center gap-1">{trailing}</span>
    </div>
  );
}

function Swatch({ slot }: { slot: Slot }) {
  const tint = useStore((s) => s.tint[slot]);
  const setTint = useStore((s) => s.setTint);
  const [open, setOpen] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // The popover is a fixed overlay so the panel's scroll container cannot clip it.
  const toggle = () => {
    if (open) { setOpen(null); return; }
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    setOpen({ left: Math.max(8, r.right - 116), top: r.bottom + 4 });
  };
  return (
    <span onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <button ref={btn} aria-label="appearance" title="Appearance · tint" aria-expanded={!!open} onClick={toggle} className="tree-btn"><span className="w-[10px] h-[10px] rounded-[2px] border" style={{ background: tint || 'var(--m2)', borderColor: 'var(--line)' }} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-[49]" onMouseDown={(e) => { e.stopPropagation(); setOpen(null); }} />
          <div role="menu" aria-label="tint" className="fixed z-[50] w-[116px] grid grid-cols-4 gap-1 p-1 bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)]" style={{ left: open.left, top: open.top }} onMouseDown={(e) => e.stopPropagation()}>
            {SWATCHES.map((c) => <button key={c} aria-label={c} onClick={() => { setTint(slot, c); setOpen(null); }} className="w-5 h-5 rounded-[3px] border cursor-pointer" style={{ background: c, borderColor: tint === c ? 'var(--ink)' : 'transparent' }} />)}
            <button onClick={() => { setTint(slot, null); setOpen(null); }} className="col-span-4 btn btn-xs mt-1">none</button>
          </div>
        </>
      )}
    </span>
  );
}

/** Fusion-style browser: document, settings, named views, versions, comments, the airframe with bodies and features, and one row per component. */
export function Browser() {
  const s = useStore();
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true, airframe: true, bodies: true, features: false, settings: false, views: false, versions: false, comments: false });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const onDragStart = (pid: PartId) => (e: DragEvent<HTMLDivElement>) => { try { e.dataTransfer.setData('text/plain', pid); e.dataTransfer.effectAllowed = 'move'; } catch { /* no dataTransfer */ } s.patch({ dragPart: pid, dragging: true }); };
  const onDragEnd = () => s.patch({ dragPart: null, dragging: false });
  const components: Slot[] = s.project?.components ?? [...CORE_SLOTS];
  const placedCount = components.filter((sl) => s.parts[sl]).length;
  const readOnly = s.viewSeq != null;
  const [library, setLibrary] = useState(false);
  // the tree filter from the original workbench: "/" focuses it, Esc clears it
  const [q, setQ] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement | null)?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); search.current?.focus(); search.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const needle = q.trim().toLowerCase();
  const hit = (...texts: (string | undefined | null)[]) => !needle || texts.some((t) => (t || '').toLowerCase().includes(needle));
  const filtering = needle.length > 0;
  const shownComponents = components.filter((sl) => hit(GENERIC_NAME[sl], s.parts[sl] ? CATALOG[s.parts[sl] as PartId].name : 'not placed'));
  const shownFeatures = s.features.filter((f) => hit(f.text, f.n));
  const bodyHit = (name: string) => hit(name);

  return (
    <div data-panel="browser" className="panel h-full flex flex-col min-h-0">
      <div className="panel-head">
        <div className="panel-title">Browser</div>
        <span className="text-[12px] text-muted flex items-center gap-2">
          {s.isolated && <button onClick={() => s.isolate(null)} className="btn btn-xs">isolated · {BODY_LABEL[s.isolated]} · show all</button>}
          {readOnly ? <span className="text-amber font-semibold">replay #{s.viewSeq}</span> : placedCount + ' of ' + components.length + ' placed'}
        </span>
      </div>
      <div className="flex items-center gap-2 px-2 py-[6px] border-b border-line2">
        <span className="text-muted inline-flex" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
        <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); (e.target as HTMLInputElement).blur(); } }}
          type="search" placeholder="Filter components and features" aria-label="Filter the browser tree" className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-muted" />
        <kbd className="chip chip-sm">/</kbd>
      </div>
      {library && <ComponentLibrary onClose={() => setLibrary(false)} />}
      <div role="tree" className="overflow-auto min-h-0 py-1 flex-1">
        <Row depth={0} icon={<Doc />} name="Kestrel bracket" open={open.root} onToggle={() => toggle('root')} trailing={'v' + s.versions.length} />
        {open.root && (
          <>
            <Row depth={1} icon={<Gear />} name="Document settings" open={open.settings} onToggle={() => toggle('settings')} />
            {open.settings && (
              <div className="tree-row" style={{ paddingLeft: 6 + 2 * 16, cursor: 'default' }}>
                <span /><span /><span className="inline-flex items-center justify-center w-[18px] h-[18px] text-muted" />
                <span className="tree-name text-muted">Units</span>
                <select aria-label="Units" value={s.units} onChange={(e) => s.setUnits(e.target.value as typeof s.units)} className="btn btn-xs text-ink">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
            )}
            <Row depth={1} icon={<Home />} name="Named views" open={open.views} onToggle={() => toggle('views')} trailing={<button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); s.openDialog('named_view', null); }}>save</button>} />
            {open.views && (
              <>
                <Row depth={2} icon={<Home />} name="Home" onClick={() => s.setView('iso')} trailing={<button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); s.setHome(); }} title="set the current camera as home">set</button>} />
                {(['Top', 'Front', 'Right'] as const).map((n) => <Row key={n} depth={2} icon={<Eye />} name={n} onClick={() => s.setViewDir(n === 'Top' ? [0, 0, 1] : n === 'Front' ? [0, 1, 0] : [1, 0, 0])} />)}
                {s.namedViews.map((v) => <Row key={v.id} depth={2} icon={<Eye />} name={v.name} onClick={() => s.patch({ az: v.az, el: v.el, zoom: v.zoom, pan: v.pan })} trailing={<button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); s.patch({ namedViews: s.namedViews.filter((x) => x.id !== v.id) }); }}>×</button>} />)}
              </>
            )}
            <Row depth={1} icon={<Folder />} name="Versions" open={open.versions} onToggle={() => toggle('versions')} trailing={<>{s.versions.length}<button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); s.openDialog('save_version', null); }}>save</button></>} />
            {open.versions && s.versions.slice().reverse().map((v) => (
              <Row key={v.v} depth={2} icon={<Doc />} name={<span>v{v.v} <span className="text-muted">· {v.comment || '(no comment)'}</span></span>} active={s.viewSeq === v.seq} onClick={() => s.viewAt(v.seq >= s.events.length ? null : v.seq)} trailing={'#' + v.seq + ' · ' + v.at.slice(5)} title="open this version in the timeline" />
            ))}
            <Row depth={1} icon={<Folder />} name="Comments" open={open.comments} onToggle={() => toggle('comments')} trailing={<>{s.comments.length}<button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); s.openDialog('add_comment', null); }}>add</button></>} />
            {open.comments && (s.comments.length === 0 ? <div className="text-[12px] text-muted" style={{ paddingLeft: 6 + 2 * 16 + 58 }}>no comments · add one on the current state</div> : s.comments.slice().reverse().map((c) => (
              <Row key={c.id} depth={2} icon={<Doc />} name={<span><b>{c.author}</b> <span className="text-muted">· {c.text}</span></span>} trailing={'#' + c.seq} onClick={() => s.viewAt(c.seq >= s.events.length ? null : c.seq)} title={c.at} />
            )))}
            <Row depth={1} icon={<Component />} name="Airframe" open={open.airframe} onToggle={() => toggle('airframe')} radio={s.sel === 'airframe'} active={s.sel === 'airframe'} onClick={() => s.select('airframe')} />
            {(open.airframe || filtering) && (
              <>
                <Row depth={2} icon={<Folder />} name="Bodies" open={open.bodies} onToggle={() => toggle('bodies')} />
                {(open.bodies || filtering) && (
                  <>
                    {bodyHit('Base plate') && <Row depth={3} icon={<Body />} name="Base plate" hiddenId="plate" active={s.selBody === 'plate' && s.selFilter !== 'component'} onClick={() => { s.select('airframe'); s.patch({ selBody: 'plate' }); }} />}
                    {bodyHit('Flange') && <Row depth={3} icon={<Body />} name="Flange" hiddenId="flange" active={s.selBody === 'flange'} onClick={() => { s.select('airframe'); s.patch({ selBody: 'flange' }); }} />}
                  </>
                )}
                <Row depth={2} icon={<Folder />} name="Features" open={open.features} onToggle={() => toggle('features')} trailing={String(s.features.length)} />
                {(open.features || filtering) && shownFeatures.map((f) => <Row key={f.n} depth={3} icon={f.kind === 'sketch' ? <Sketch /> : f.kind === 'hole' ? <Body /> : <Feature />} name={f.text} trailing={f.n} onClick={() => { if (f.kind === 'sketch') s.openDialog('sketch', 'plate'); }} />)}
              </>
            )}
            {shownComponents.map((slot: Slot) => {
              const pid = s.parts[slot];
              const placed = !!pid;
              const dragPid = pid ?? DEFAULT_PART[slot];
              const removable = !placed && !(CORE_SLOTS as Slot[]).includes(slot) && !readOnly;
              return (
                <Row key={slot} depth={1} icon={<Component />} name={GENERIC_NAME[slot]} hiddenId={placed ? slot : undefined} active={s.sel === slot} dim={!placed}
                  onClick={() => (placed ? s.select(slot) : s.place(slot, dragPid))}
                  trailing={placed ? <Swatch slot={slot} /> : <>not placed · click or drag{removable && <button className="btn btn-xs" title="remove this component type from the project" onClick={(e) => { e.stopPropagation(); s.removeComponent(slot); }}>×</button>}</>}
                  draggable={!readOnly} onDragStart={onDragStart(dragPid)} onDragEnd={onDragEnd}
                  title={placed ? 'click to select · drag onto the plate to move' : 'drag onto the plate to place, or click'} />
              );
            })}
            {filtering && shownComponents.length === 0 && shownFeatures.length === 0 && <div className="text-[12px] text-muted px-3 py-2">nothing matches “{q}”</div>}
          </>
        )}
      </div>
      {!readOnly && (
        <div className="flex-none border-t border-line2 p-2">
          <button onClick={() => setLibrary(true)} className="btn w-full" title="pick component types from the preset library">Add components from the library</button>
        </div>
      )}
    </div>
  );
}
