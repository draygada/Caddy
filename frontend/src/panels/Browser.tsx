import { useState, type DragEvent, type ReactNode } from 'react';
import { useStore } from '../store';
import { DEFAULT_PART, GENERIC_NAME, SLOTS, type PartId, type Slot } from '../lib/catalog';
import { Body, Chevron, Component, Doc, Eye, EyeOff, Feature, Folder, Gear, Sketch } from './Icons';

interface RowProps {
  depth: number;
  icon: ReactNode;
  name: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  hiddenId?: string;
  active?: boolean;
  dim?: boolean;
  radio?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  title?: string;
}

function Row({ depth, icon, name, open, onToggle, hiddenId, active, dim, radio, onClick, trailing, draggable, onDragStart, onDragEnd, title }: RowProps) {
  const hidden = useStore((s) => (hiddenId ? !!s.hidden[hiddenId] : false));
  const toggleHidden = useStore((s) => s.toggleHidden);
  return (
    <div
      role="treeitem" aria-expanded={onToggle ? open : undefined} aria-selected={active}
      className="tree-row" data-active={active ? 'true' : 'false'} data-dim={dim || hidden ? 'true' : 'false'}
      style={{ paddingLeft: 6 + depth * 16, cursor: draggable ? 'grab' : 'pointer' }}
      onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} title={title}
      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); if (e.key === 'ArrowRight' && onToggle && !open) onToggle(); if (e.key === 'ArrowLeft' && onToggle && open) onToggle(); }}
    >
      {onToggle ? <button className="tree-btn" aria-label={open ? 'collapse' : 'expand'} onClick={(e) => { e.stopPropagation(); onToggle(); }}><Chevron open={open} width={12} height={12} /></button> : <span />}
      {hiddenId ? (
        <button className="tree-btn" aria-label={hidden ? 'show' : 'hide'} aria-pressed={!hidden} onClick={(e) => { e.stopPropagation(); toggleHidden(hiddenId); }} style={{ color: hidden ? 'var(--muted)' : 'var(--ink)' }}>{hidden ? <EyeOff /> : <Eye />}</button>
      ) : radio != null ? (
        <span className="inline-flex items-center justify-center w-[18px] h-[18px]"><span className="w-[10px] h-[10px] rounded-full border" style={{ borderColor: 'var(--muted)', background: radio ? 'var(--accent)' : 'transparent', boxShadow: radio ? 'inset 0 0 0 2px var(--surface)' : 'none' }} /></span>
      ) : <span />}
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-muted">{icon}</span>
      <span className="tree-name" style={{ fontWeight: active ? 700 : 500 }}>{name}</span>
      <span className="text-[12px] text-muted whitespace-nowrap">{trailing}</span>
    </div>
  );
}

/** Fusion-style browser: the design as a tree of components, bodies and features, with visibility eyes and an active component. Unplaced components stay draggable onto the plate. */
export function Browser() {
  const sel = useStore((s) => s.sel);
  const parts = useStore((s) => s.parts);
  const features = useStore((s) => s.features);
  const select = useStore((s) => s.select);
  const place = useStore((s) => s.place);
  const patch = useStore((s) => s.patch);
  const [open, setOpen] = useState<Record<string, boolean>>({ root: true, airframe: true, bodies: true, features: false, settings: false });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const onDragStart = (pid: PartId) => (e: DragEvent<HTMLDivElement>) => {
    try { e.dataTransfer.setData('text/plain', pid); e.dataTransfer.effectAllowed = 'move'; } catch { /* no dataTransfer */ }
    patch({ dragPart: pid, dragging: true });
  };
  const onDragEnd = () => patch({ dragPart: null, dragging: false });
  const placedCount = SLOTS.filter((s) => parts[s]).length;

  return (
    <div data-panel="browser" className="panel flex flex-col min-h-0">
      <div className="panel-head">
        <div className="panel-title">Browser</div>
        <span className="text-[12px] text-muted">{placedCount} of {SLOTS.length} components placed</span>
      </div>
      <div role="tree" className="overflow-auto min-h-0 py-1">
        <Row depth={0} icon={<Doc />} name="Kestrel bracket" open={open.root} onToggle={() => toggle('root')} trailing="v1" />
        {open.root && (
          <>
            <Row depth={1} icon={<Gear />} name="Document settings" open={open.settings} onToggle={() => toggle('settings')} />
            {open.settings && <Row depth={2} icon={<span />} name={<span className="text-muted">Units · m</span>} />}
            <Row depth={1} icon={<Component />} name="Airframe" open={open.airframe} onToggle={() => toggle('airframe')} radio={sel === 'airframe'} active={sel === 'airframe'} onClick={() => select('airframe')} />
            {open.airframe && (
              <>
                <Row depth={2} icon={<Folder />} name="Bodies" open={open.bodies} onToggle={() => toggle('bodies')} />
                {open.bodies && (
                  <>
                    <Row depth={3} icon={<Body />} name="Base plate" hiddenId="plate" onClick={() => select('airframe')} />
                    <Row depth={3} icon={<Body />} name="Flange" hiddenId="flange" onClick={() => select('airframe')} />
                  </>
                )}
                <Row depth={2} icon={<Folder />} name="Features" open={open.features} onToggle={() => toggle('features')} trailing={String(features.length)} />
                {open.features && features.map((f) => <Row key={f.n} depth={3} icon={f.text.startsWith('extrude') ? <Feature /> : <Sketch />} name={f.text} trailing={f.n} />)}
              </>
            )}
            {SLOTS.map((slot: Slot) => {
              const pid = parts[slot];
              const placed = !!pid;
              const dragPid = pid ?? DEFAULT_PART[slot];
              return (
                <Row
                  key={slot} depth={1} icon={<Component />} name={GENERIC_NAME[slot]}
                  hiddenId={placed ? slot : undefined}
                  active={sel === slot} dim={!placed}
                  onClick={() => (placed ? select(slot) : place(slot, dragPid))}
                  trailing={placed ? '' : 'not placed · drag onto the plate'}
                  draggable onDragStart={onDragStart(dragPid)} onDragEnd={onDragEnd}
                  title={placed ? 'click to select · drag onto the plate to move' : 'drag onto the plate to place, or click'}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
