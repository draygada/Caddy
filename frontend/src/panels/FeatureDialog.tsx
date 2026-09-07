import { useEffect, useState } from 'react';
import { useStore, nodeOfBody, BODY_LABEL, type BodyId } from '../store';
import { EXTRUDE_MAX, EXTRUDE_MIN, PLATE_T, SLOT_LABEL, CATALOG, type Slot } from '../lib/catalog';
import { CONSTRAINTS, SKETCH_COLOR, solveSketch } from '../lib/sketch';
import { fmtLen, fmtNum, fromUnit, unitStep, type Unit } from '../lib/units';
import { buildBodies } from '../lib/scene';
import { bounds3, boundsCenter, boundsVolume } from '../lib/geometry';
import { parseDecimal } from '../lib/hash';
import { useModalFocusTrap } from '../lib/modal-focus';

function LenField({ id, label, metres, units, min, max, onChange, hint }: { id: string; label: string; metres: number; units: Unit; min: number; max: number; onChange: (m: number) => void; hint?: string }) {
  const [text, setText] = useState(fmtNum(metres, units, true));
  useEffect(() => { setText(fmtNum(metres, units, true)); }, [metres, units]);
  const commit = () => { const p = parseDecimal(text); if (p == null) return; onChange(Math.max(min, Math.min(max, fromUnit(p, units)))); };
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} value={text} inputMode="decimal" onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} className="field w-[120px] font-mono text-[15px] font-semibold" />
        <input type="range" min={min} max={max} step={fromUnit(unitStep(units), units) / 2} value={metres} onChange={(e) => onChange(+e.target.value)} className="flex-1 accent-[var(--focus)]" aria-label={label + ' slider'} />
        <span className="text-[13px] text-muted whitespace-nowrap">{units}</span>
      </div>
      <div className="text-[12px] text-muted">{hint || (fmtLen(min, units, true) + ' – ' + fmtLen(max, units, true))}</div>
    </div>
  );
}

function Frame({ title, sub, children, onOk, onCancel, okLabel = 'OK', okDisabled, placement = 'right-3 top-[176px]', docked = false }: { title: string; sub?: string; children: React.ReactNode; onOk?: () => void; onCancel: () => void; okLabel?: string; okDisabled?: boolean; placement?: string; docked?: boolean }) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>(!docked);
  // docked: a side column that takes its own width, so the canvas beside it is never covered
  const cls = docked
    ? 'relative z-[30] flex-none w-[340px] max-w-[45%] h-full flex flex-col bg-surface border-l border-line2'
    : 'absolute ' + placement + ' w-[min(300px,calc(100%-24px))] max-h-[calc(100%-180px)] flex flex-col bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)] z-[30]';
  return (
    <div ref={dialogRef} role="dialog" aria-modal={docked ? undefined : true} aria-label={title} tabIndex={docked ? undefined : -1} className={cls} onMouseDown={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-line2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{title}</span>
        {sub && <span className="text-[12px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{sub}</span>}
      </div>
      <div className="p-3 grid gap-3 overflow-auto min-h-0">{children}</div>
      <div className="px-3 py-2 border-t border-line2 flex justify-end gap-2">
        <button onClick={onCancel} className="btn">{onOk ? 'Cancel' : 'Close'}</button>
        {onOk && <button onClick={onOk} disabled={okDisabled} className="btn btn-primary disabled:opacity-50">{okLabel}</button>}
      </div>
    </div>
  );
}

/** Docked feature dialog: live preview via store.preview, OK commits an event, Cancel discards. */
export function FeatureDialog({ docked = false }: { docked?: boolean } = {}) {
  const s = useStore();
  const d = s.dialog;
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  useEffect(() => { setText(''); setText2(''); }, [d?.kind]);
  if (!d) return null;
  const u = s.units;
  const readOnly = s.viewSeq != null;
  const cancel = () => s.closeDialog();
  const ro = readOnly ? <div className="text-[12px] text-amber font-semibold">viewing history #{s.viewSeq} · restore to edit</div> : null;
  const geo = s.preview?.geo ?? s.geo, dims = s.preview?.dims ?? s.dims, pos = s.preview?.pos ?? s.pos;

  switch (d.kind) {
    case 'extrude': {
      if (d.target === 'plate') {
        const thickness = geo.plateT ?? PLATE_T;
        return (
          <Frame title="Extrude" sub="plate sketch → solid body" onCancel={cancel} okDisabled={readOnly} onOk={() => { s.applyGeo({ plateT: thickness }, 'extrude', 'extrude · plate profile to ' + thickness.toFixed(3) + ' m'); s.closeDialog(); }} okLabel="Commit extrusion">
            {ro}
            <LenField id="dlg-extrude-plate" label="profile depth" metres={thickness} units={u} min={0.002} max={0.05} onChange={(m) => s.setPreview({ ...s.preview, geo: { ...s.geo, plateT: m } })} hint="drives the rendered plate, mounted bodies, properties, section plane, and design hash" />
            <div className="text-[12px] text-muted">Consumes the committed plate profile and appends an <span className="font-mono">extrude</span> feature plus a <span className="font-mono">feature_added</span> event.</div>
          </Frame>
        );
      }
      const node = d.target ? nodeOfBody(d.target) : 'airframe';
      const label = node === 'airframe' ? 'flange' : SLOT_LABEL[node];
      return (
        <Frame title="Extrude" sub={label} onCancel={cancel} okDisabled={readOnly} onOk={() => { s.applyExtrude(node, dims[node]); s.closeDialog(); }}>
          {ro}
          <LenField id="dlg-extrude" label={'height · ' + label} metres={dims[node]} units={u} min={EXTRUDE_MIN} max={EXTRUDE_MAX} onChange={(m) => s.setPreview({ ...s.preview, dims: { ...s.dims, [node]: m } })} />
          <div className="text-[12px] text-muted">previewing live · OK appends a feature and a <span className="font-mono">feature_added</span> event · no rule reads this dimension</div>
        </Frame>
      );
    }
    case 'hole':
      return (
        <Frame title="Hole" sub="base plate · 4 through holes" onCancel={cancel} okDisabled={readOnly} onOk={() => { s.applyGeo({ holeD: geo.holeD }, 'hole', '4 holes ⌀ ' + geo.holeD.toFixed(3) + ' m · plate'); s.closeDialog(); }}>
          {ro}
          <LenField id="dlg-hole" label="diameter" metres={geo.holeD} units={u} min={0.003} max={0.03} onChange={(m) => s.setPreview({ ...s.preview, geo: { ...s.geo, holeD: m } })} />
        </Frame>
      );
    case 'fillet':
      return (
        <Frame title="Fillet" sub="base plate · 4 corners" onCancel={cancel} okDisabled={readOnly} onOk={() => { s.applyGeo({ fillet: geo.fillet, chamfer: 0 }, 'fillet', 'fillet · plate corners r ' + geo.fillet.toFixed(3) + ' m'); s.closeDialog(); }}>
          {ro}
          <LenField id="dlg-fillet" label="radius" metres={geo.fillet} units={u} min={0} max={Math.min(0.05, geo.plateW / 2 - 0.012)} onChange={(m) => s.setPreview({ ...s.preview, geo: { ...s.geo, fillet: m, chamfer: 0 } })} />
          {s.geo.chamfer > 0 && <div className="text-[12px] text-muted">replaces the current chamfer ({fmtLen(s.geo.chamfer, u, true)})</div>}
        </Frame>
      );
    case 'chamfer':
      return (
        <Frame title="Chamfer" sub="base plate · 4 corners" onCancel={cancel} okDisabled={readOnly} onOk={() => { s.applyGeo({ chamfer: geo.chamfer, fillet: 0 }, 'chamfer', 'chamfer · plate corners ' + geo.chamfer.toFixed(3) + ' m'); s.closeDialog(); }}>
          {ro}
          <LenField id="dlg-chamfer" label="distance" metres={geo.chamfer} units={u} min={0} max={Math.min(0.05, geo.plateW / 2 - 0.012)} onChange={(m) => s.setPreview({ ...s.preview, geo: { ...s.geo, chamfer: m, fillet: 0 } })} />
          {s.geo.fillet > 0 && <div className="text-[12px] text-muted">replaces the current fillet ({fmtLen(s.geo.fillet, u, true)})</div>}
        </Frame>
      );
    case 'move': {
      const slot = d.target as Slot;
      const p = pos[slot];
      return (
        <Frame title="Move" sub={BODY_LABEL[slot]} onCancel={cancel} okDisabled={readOnly} onOk={() => { const from = s.pos[slot]; s.moveTo(slot, p); s.commitMove(slot, from); s.closeDialog(); }}>
          {ro}
          <LenField id="dlg-mx" label="X · along the plate" metres={p.x} units={u} min={0.005} max={geo.plateL - 0.03} onChange={(m) => s.setPreview({ ...s.preview, pos: { ...pos, [slot]: { ...p, x: m } } })} />
          <LenField id="dlg-my" label="Y · across the plate" metres={p.y} units={u} min={0.005} max={geo.plateW - 0.025} onChange={(m) => s.setPreview({ ...s.preview, pos: { ...pos, [slot]: { ...p, y: m } } })} />
          <div className="text-[12px] text-muted">or drag the body in the viewport · position feeds no rule</div>
        </Frame>
      );
    }
    case 'measure': {
      const bodies = buildBodies({ dims, geo, parts: s.parts, attrs: s.attrs, pos });
      const info = (b: BodyId | null) => { if (!b) return null; const bb = bounds3(bodies[b]); return { bb, c: boundsCenter(bb), size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]] as const, vol: boundsVolume(bb) }; };
      const A = info(s.measure.a), B = info(s.measure.b);
      const dist = A && B ? Math.hypot(B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]) : null;
      const ang = A && B ? (Math.atan2(B.c[1] - A.c[1], B.c[0] - A.c[0]) * 180) / Math.PI : null;
      const row = (k: string, v: string) => <div key={k} className="grid grid-cols-[1fr_auto] gap-2 text-[13px]"><span className="text-muted">{k}</span><span className="font-mono">{v}</span></div>;
      return (
        <Frame title="Measure" sub="click two bodies" onCancel={cancel} placement="left-3 top-[112px]">
          <div className="text-[13px]">{!s.measure.a ? 'click the first body in the viewport' : !s.measure.b ? 'first: ' + BODY_LABEL[s.measure.a] + ' · click the second body' : BODY_LABEL[s.measure.a] + ' → ' + BODY_LABEL[s.measure.b]}</div>
          {A && B && dist != null && ang != null && (
            <div className="grid gap-1 border-t border-line2 pt-2">
              {row('distance · centre to centre', fmtLen(dist, u, true))}
              {row('ΔX', fmtLen(B.c[0] - A.c[0], u, true))}{row('ΔY', fmtLen(B.c[1] - A.c[1], u, true))}{row('ΔZ', fmtLen(B.c[2] - A.c[2], u, true))}
              {row('angle in plan · from +X', ang.toFixed(1) + '°')}
            </div>
          )}
          {[['a', A, s.measure.a], ['b', B, s.measure.b]].map(([k, I, b]) => I && b ? (
            <div key={k as string} className="grid gap-1 border-t border-line2 pt-2">
              <div className="text-[13px] font-semibold">{BODY_LABEL[b as BodyId]}</div>
              {row('size', (I as NonNullable<typeof A>).size.map((v) => fmtNum(v, u, true)).join(' × ') + ' ' + u)}
              {row('bounding volume', ((I as NonNullable<typeof A>).vol * 1e3).toFixed(1) + ' L')}
            </div>
          ) : null)}
          <div className="text-[12px] text-muted">centres and volumes are from the derived preview mesh bounds, not exact B-rep mass properties</div>
        </Frame>
      );
    }
    case 'section': {
      const sec = s.section;
      const maxAt = sec.axis === 0 ? geo.plateL : sec.axis === 1 ? geo.plateW : (geo.plateT ?? PLATE_T) + Math.max(dims.airframe, 0.15);
      return (
        <Frame title="Section analysis" sub="clip the model at a plane" onCancel={() => { s.patch({ section: { ...sec, on: false } }); s.closeDialog(); }} onOk={() => s.closeDialog()} okLabel="Keep">
          <div role="radiogroup" aria-label="plane" className="flex gap-1">
            {(['X', 'Y', 'Z'] as const).map((ax, i) => <button key={ax} role="radio" aria-checked={sec.axis === i} onClick={() => s.patch({ section: { on: true, axis: i as 0 | 1 | 2, at: i === 0 ? geo.plateL / 2 : i === 1 ? geo.plateW / 2 : 0.03 } })} className="btn font-semibold" style={{ background: sec.axis === i ? 'var(--accent)' : 'transparent', color: sec.axis === i ? 'var(--accentfg)' : 'var(--ink)' }}>{ax} plane</button>)}
          </div>
          <LenField id="dlg-section" label="offset along the axis" metres={sec.at} units={u} min={0} max={maxAt} onChange={(m) => s.patch({ section: { ...sec, on: true, at: m } })} />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={sec.on} onChange={(e) => s.patch({ section: { ...sec, on: e.target.checked } })} /> section on</label>
          <div className="text-[12px] text-muted">everything beyond the plane is clipped; cut faces are outlined amber · view only, nothing is committed</div>
        </Frame>
      );
    }
    case 'sketch': {
      const r = solveSketch(s.sketch);
      // plain words for each state; the codes and DOF counts stay in the solver
      const word = (e: 'rect' | 'holes') => {
        const st = r.entities[e];
        return st.state === 'SOLVED' ? 'fully defined' : st.state === 'UNDER_CONSTRAINED' ? st.dof + ' degree' + (st.dof === 1 ? '' : 's') + ' of freedom left' : st.state === 'REDUNDANT' ? 'over-defined' : 'contradictory';
      };
      const short = (label: string) => label.replace(' · ⌀', '');
      const row = (c: (typeof CONSTRAINTS)[number]) => (
        <label key={c.id} className="flex items-center gap-2 text-[13px] cursor-pointer min-h-7">
          <input type="checkbox" checked={!!s.sketch[c.id]} disabled={readOnly} onChange={() => s.toggleConstraint(c.id)} />
          <span>{short(c.label)}</span>
          <span className="text-muted text-[12px] ml-auto">{c.entity}</span>
        </label>
      );
      return (
        <Frame title="Sketch" sub="plate profile" onCancel={cancel} onOk={() => { s.commitSketch(); s.closeDialog(); }} okLabel="Finish sketch" okDisabled={readOnly || r.overall === 'CONTRADICTORY'} docked={docked}>
          {ro}
          <div className="grid gap-1">
            {(['rect', 'holes'] as const).map((e) => (
              <div key={e} className="flex items-center gap-2 text-[13px]">
                <span className="w-[10px] h-[10px] rounded-[2px] flex-none" style={{ background: SKETCH_COLOR[r.entities[e].state] }} />
                <span className="font-semibold w-12">{e === 'rect' ? 'plate' : 'holes'}</span>
                <span style={{ color: SKETCH_COLOR[r.entities[e].state] }}>{word(e)}</span>
              </div>
            ))}
          </div>
          <div className="grid">
            <div className="text-[12px] text-muted pb-1">constraints</div>
            {CONSTRAINTS.filter((c) => c.role === 'required').map(row)}
          </div>
          <details className="grid">
            <summary className="text-[12px] text-muted cursor-pointer select-none">what if a constraint is redundant or contradictory</summary>
            <div className="grid pt-1">{CONSTRAINTS.filter((c) => c.role !== 'required').map(row)}</div>
          </details>
        </Frame>
      );
    }
    case 'properties': {
      const b = d.target!;
      const bodies = buildBodies({ dims, geo, parts: s.parts, attrs: s.attrs, pos });
      const bb = bounds3(bodies[b]);
      const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
      const slot = b !== 'plate' && b !== 'flange' ? b : null;
      const row = (k: string, v: string) => <div key={k} className="grid grid-cols-[1fr_auto] gap-2 text-[13px]"><span className="text-muted">{k}</span><span className="font-mono text-right">{v}</span></div>;
      return (
        <Frame title="Properties" sub={BODY_LABEL[b]} onCancel={cancel}>
          {slot && row('model', s.parts[slot] ? CATALOG[s.parts[slot]!].name : 'empty')}
          {slot && row('position', fmtNum(pos[slot].x, u, true) + ', ' + fmtNum(pos[slot].y, u, true) + ' ' + u)}
          {row('size', size.map((v) => fmtNum(v, u, true)).join(' × ') + ' ' + u)}
          {row('bounding volume', (boundsVolume(bb) * 1e3).toFixed(1) + ' L')}
          {row('faces', String(bodies[b].faces.length))}
          {b === 'plate' && row('corners', geo.fillet > 0 ? 'fillet r ' + fmtLen(geo.fillet, u, true) : geo.chamfer > 0 ? 'chamfer ' + fmtLen(geo.chamfer, u, true) : 'sharp')}
          {b === 'plate' && row('holes', '4 × ⌀ ' + fmtLen(geo.holeD, u, true))}
          {s.selFace && s.selFace.body === b && row('selected face', '#' + s.selFace.fi + ' · index within body, not a durable id')}
          <div className="text-[12px] text-muted">derived from the preview mesh; exact mass properties come from the kernel</div>
        </Frame>
      );
    }
    case 'save_version':
      return (
        <Frame title="Save version" sub={'v' + (s.versions.length + 1) + ' at #' + (s.events.length + 1)} onCancel={cancel} onOk={() => { s.saveVersion(text.trim()); s.closeDialog(); }} okLabel="Save version">
          <input aria-label="version comment" value={text} onChange={(e) => setText(e.target.value)} placeholder="what changed · one line" className="field" autoFocus />
          <div className="text-[12px] text-muted">pins the current design state in this tab's session log; earlier versions stay openable from the browser</div>
        </Frame>
      );
    case 'add_comment':
      return (
        <Frame title="Add comment" sub={'on state #' + s.events.length} onCancel={cancel} onOk={() => { s.addComment(text.trim(), text2.trim()); s.closeDialog(); }} okLabel="Post comment" okDisabled={!text.trim() || !text2.trim()}>
          <input aria-label="author, required" value={text} onChange={(e) => setText(e.target.value)} placeholder="author · required" className="field" autoFocus />
          <input aria-label="comment" value={text2} onChange={(e) => setText2(e.target.value)} placeholder="comment" className="field" />
        </Frame>
      );
    case 'door3': {
      const p = s.slotList;
      return (
        <Frame title="New from description" sub="Door 3 · a prompt becomes a slot list" onCancel={() => { s.patch({ slotList: null }); cancel(); }} onOk={p ? () => { s.acceptSlotList(text2.trim()); s.closeDialog(); } : () => s.proposeSlots(text)} okLabel={p ? 'Accept · seeds the design' : 'Propose slots'} okDisabled={p ? !text2.trim() : !text.trim()}>
          {!p && <textarea aria-label="description" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="a long-range survey drone with a thermal camera, GNSS, a datalink and a laser rangefinder pod" className="field py-2 font-sans" autoFocus />}
          {p && (
            <div className="grid gap-1 text-[13px]">
              <div className="font-mono text-[12px] text-muted">proposed slot list · {p.slots.length} slots · {p.accepted} catalog parts · {p.slots.length - p.accepted} placeholders · {p.rejected} rejected</div>
              {p.slots.map((sl, i) => <div key={i} className="grid grid-cols-[1fr_auto] gap-2"><span>{sl.role}{sl.mpn ? ' · ' + sl.mpn : ''}{sl.rejected ? <span className="text-red"> · {sl.rejected}</span> : sl.placeholder ? <span className="text-muted"> · placeholder · cannot fire · field empty</span> : ''}</span><span className="chip chip-sm">{sl.rejected ? 'rejected' : sl.placeholder ? 'placeholder' : 'catalog'}</span></div>)}
              <input aria-label="attestor" value={text2} onChange={(e) => setText2(e.target.value)} placeholder="attestor · a series of human part_added events" className="field" />
              <div className="text-[12px] text-muted">no jurisdiction, entry, origin or value field in the schema · the verifier rejects any MPN not in the catalog · geometry is not generated</div>
            </div>
          )}
        </Frame>
      );
    }
    case 'target':
      return <Frame title="Design to a target" sub="in Reasoning" onCancel={cancel}><div className="text-[13px] text-muted">Open Reasoning → Design to a target.</div></Frame>;
    case 'named_view':
      return (
        <Frame title="Save named view" sub="current camera" onCancel={cancel} onOk={() => { s.saveNamedView(text); s.closeDialog(); }} okLabel="Save view">
          <input aria-label="view name" value={text} onChange={(e) => setText(e.target.value)} placeholder={'View ' + (s.namedViews.length + 1)} className="field" autoFocus />
          <div className="text-[12px] text-muted">az {(s.az * 180 / Math.PI).toFixed(0)}° · el {(s.el * 180 / Math.PI).toFixed(0)}° · {Math.round(s.zoom * 100)}%</div>
        </Frame>
      );
  }
}
