import { useState, type DragEvent, type ReactNode } from 'react';
import { useStore, BODY_LABEL } from '../store';
import { DEFAULT_PART, GENERIC_NAME, SLOTS, type PartId, type Slot } from '../lib/catalog';
import { UNITS } from '../lib/units';
import { Body, Chevron, Component, Doc, Eye, EyeOff, Feature, Folder, Gear, Sketch, Home } from './Icons';

const SWATCHES = ['#1f5a3f', '#2a78d6', '#b3261e', '#8a5a00', '#6b3fa0', '#0e7490', '#a3480a', '#4b5563'];

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
  const [open, setOpen] = useState(false);
  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button aria-label="appearance" title="Appearance · tint" onClick={() => setOpen((v) => !v)} className="tree-btn"><span className="w-[10px] h-[10px] rounded-[2px] border" style={{ background: tint || 'var(--m2)', borderColor: 'var(--line)' }} /></button>
      {open && (
        <div className="absolute right-0 top-5 z-[15] grid grid-cols-4 gap-1 p-1 bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)]" onMouseLeave={() => setOpen(false)}>
          {SWATCHES.map((c) => <button key={c} aria-label={c} onClick={() => { setTint(slot, c); setOpen(false); }} className="w-5 h-5 rounded-[3px] border" style={{ background: c, borderColor: tint === c ? 'var(--ink)' : 'transparent' }} />)}
          <button onClick={() => { setTint(slot, null); setOpen(false); }} className="col-span-4 btn btn-xs mt-1">none</button>
        </div>
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
  const placedCount = SLOTS.filter((sl) => s.parts[sl]).length;
  const readOnly = s.viewSeq != null;

  return (
    <div data-panel="browser" className="panel flex flex-col min-h-0">
      <div className="panel-head">
        <div className="panel-title">Browser</div>
        <span className="text-[12px] text-muted flex items-center gap-2">
          {s.isolated && <button onClick={() => s.isolate(null)} className="btn btn-xs">isolated · {BODY_LABEL[s.isolated]} · show all</button>}
          {readOnly ? <span className="text-amber font-semibold">replay #{s.viewSeq}</span> : placedCount + ' of ' + SLOTS.length + ' placed'}
        </span>
      </div>
      <div role="tree" className="overflow-auto min-h-0 py-1">
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
            {open.airframe && (
              <>
                <Row depth={2} icon={<Folder />} name="Bodies" open={open.bodies} onToggle={() => toggle('bodies')} />
                {open.bodies && (
                  <>
                    <Row depth={3} icon={<Body />} name="Base plate" hiddenId="plate" active={s.selBody === 'plate' && s.selFilter !== 'component'} onClick={() => { s.select('airframe'); s.patch({ selBody: 'plate' }); }} />
                    <Row depth={3} icon={<Body />} name="Flange" hiddenId="flange" active={s.selBody === 'flange'} onClick={() => { s.select('airframe'); s.patch({ selBody: 'flange' }); }} />
                  </>
                )}
                <Row depth={2} icon={<Folder />} name="Features" open={open.features} onToggle={() => toggle('features')} trailing={String(s.features.length)} />
                {open.features && s.features.map((f) => <Row key={f.n} depth={3} icon={f.kind === 'sketch' ? <Sketch /> : f.kind === 'hole' ? <Body /> : <Feature />} name={f.text} trailing={f.n} onClick={() => { if (f.kind === 'sketch') s.openDialog('sketch', 'plate'); }} />)}
              </>
            )}
            {SLOTS.map((slot: Slot) => {
              const pid = s.parts[slot];
              const placed = !!pid;
              const dragPid = pid ?? DEFAULT_PART[slot];
              return (
                <Row key={slot} depth={1} icon={<Component />} name={GENERIC_NAME[slot]} hiddenId={placed ? slot : undefined} active={s.sel === slot} dim={!placed}
                  onClick={() => (placed ? s.select(slot) : s.place(slot, dragPid))}
                  trailing={placed ? <Swatch slot={slot} /> : 'not placed · drag onto the plate'}
                  draggable={!readOnly} onDragStart={onDragStart(dragPid)} onDragEnd={onDragEnd}
                  title={placed ? 'click to select · drag onto the plate to move' : 'drag onto the plate to place, or click'} />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
