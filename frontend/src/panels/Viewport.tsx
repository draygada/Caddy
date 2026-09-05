import { useMemo, useRef, useState, type DragEvent, type MouseEvent as RMouseEvent, type WheelEvent } from 'react';
import { Check, Display, Fit, Grid as GridIcon, Home, Orbit, Pan, Zoom } from './Icons';
import { useStore, type Pos } from '../store';
import { CATALOG, DESIGN_HASH_SHORT, SLOTS, SLOT_LABEL, type Node, type PartId, type Slot } from '../lib/catalog';
import { boxFaces, discX, discZ, discZd, emptySolid, isNode, isSlot, K, partSolid, proj, renderSolid, solidBounds, type Face, type Projector, type Solid, type Vec3 } from '../lib/geometry';
import type { Outcome } from '../lib/rules';

const VB_W = 760, VB_H = 490;

/** ViewCube cells: each face is split 3×3; centre = face view, edge strips = edge views, corners = corner views (26 directions). */
interface CubeCell { pts: string; fill: string; dir: Vec3; label?: string; m?: string; d: number; kind: 'face' | 'edge' | 'corner' }
// u = screen-right and v = screen-up of each face when looked at head-on in this projection, so the
// painted label stays upright on its face and rotates, skews and foreshortens with the cube.
const FACE_DEFS: { n: Vec3; u: Vec3; v: Vec3; label: string }[] = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0], label: 'Top' },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], label: 'Bottom' },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], label: 'Front' },
  { n: [0, -1, 0], u: [-1, 0, 0], v: [0, 0, 1], label: 'Back' },
  { n: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], label: 'Right' },
  { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], label: 'Left' },
];
const CUTS = [-0.5, -0.28, 0.28, 0.5];
function cubeCells(pr: Projector): CubeCell[] {
  const out: CubeCell[] = [];
  const add = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  for (const f of FACE_DEFS) {
    const dot = f.n[0] * pr.view[0] + f.n[1] * pr.view[1] + f.n[2] * pr.view[2];
    if (dot <= 0.02) continue;
    const nx = f.n[0] * pr.ca - f.n[1] * pr.sa;
    const fill = f.n[2] > 0.5 ? 'var(--m1)' : f.n[2] < -0.5 ? 'var(--m3)' : nx < 0 ? 'var(--m2)' : 'var(--m3)';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const corners: Vec3[] = [[CUTS[i], CUTS[j]], [CUTS[i + 1], CUTS[j]], [CUTS[i + 1], CUTS[j + 1]], [CUTS[i], CUTS[j + 1]]].map(([a, b]) => add(add(add([0, 0, 0], f.n, 0.5), f.u, a), f.v, b));
      const du = i === 0 ? -1 : i === 2 ? 1 : 0, dv = j === 0 ? -1 : j === 2 ? 1 : 0;
      const dir: Vec3 = add(add([...f.n] as Vec3, f.u, du), f.v, dv);
      const kind = du === 0 && dv === 0 ? 'face' : du !== 0 && dv !== 0 ? 'corner' : 'edge';
      let m: string | undefined;
      if (kind === 'face') {
        // affine map from face-local (x right, y down) to screen, anchored at the face centre
        const c = add([0, 0, 0], f.n, 0.5);
        const pc = pr.pt(c[0], c[1], c[2]);
        const pu = pr.pt(c[0] + f.u[0], c[1] + f.u[1], c[2] + f.u[2]), pv = pr.pt(c[0] + f.v[0], c[1] + f.v[1], c[2] + f.v[2]);
        m = 'matrix(' + [pu[0] - pc[0], pu[1] - pc[1], -(pv[0] - pc[0]), -(pv[1] - pc[1]), pc[0], pc[1]].map((v) => v.toFixed(3)).join(' ') + ')';
      }
      out.push({ pts: corners.map((p) => pr.pt(p[0], p[1], p[2]).map((v) => v.toFixed(1)).join(',')).join(' '), fill, dir, label: kind === 'face' ? f.label : undefined, m, d: dot, kind });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}
const W = 1.2, T = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Deco { stroke: string; sw: number; dash: string }
interface Extent { dx0: number; dx1: number; dy0: number; dy1: number }

/** Screen point (viewBox units) → plate coordinates on the z = T plane. Undefined when the view is edge-on. */
function toPlate(pr: Projector, sx: number, sy: number, ca: number, sa: number): Pos | null {
  if (Math.abs(pr.se) < 0.08) return null;
  const UK = pr.U * K;
  const a = (sx - pr.ox) / UK;
  const b = ((sy - pr.oy) / UK + T * pr.ce) / pr.se;
  return { x: a * ca + b * sa, y: -a * sa + b * ca };
}

function SheetView({ span }: { span: number }) {
  const views = [
    { name: 'Top', note: 'plan view · derived from the model on release' },
    { name: 'Front', note: 'elevation · derived from the model on release' },
    { name: 'Right', note: 'side elevation · derived from the model on release' },
  ];
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-surface2">
      <div className="w-full max-w-[820px] aspect-[1.414] bg-surface border border-line shadow-[0_2px_8px_rgba(0,0,0,.08)] grid grid-cols-2 grid-rows-[1fr_1fr_auto] gap-2 p-3">
        {views.map((sv) => (
          <div key={sv.name} className="border border-dashed border-line rounded-r relative min-h-0 flex items-center justify-center" style={{ background: 'repeating-linear-gradient(135deg,transparent 0 10px,var(--line2) 10px 11px)' }}>
            <span className="absolute left-2 top-[6px] text-[13px] font-semibold">{sv.name}</span>
            <span className="font-mono text-[12px] text-muted text-center px-3">{sv.note}</span>
          </div>
        ))}
        <div className="border border-dashed border-line rounded-r relative min-h-0 flex items-center justify-center">
          <span className="absolute left-2 top-[6px] text-[13px] font-semibold">Isometric</span>
          <span className="font-mono text-[12px] text-muted">from the model view</span>
        </div>
        <div className="col-span-2 border border-line rounded-r grid grid-cols-[2fr_1fr_1fr_1fr] text-[13px]">
          <div className="px-[10px] py-[6px] border-r border-line2"><span className="text-muted">title</span><br /><b>Kestrel bracket · slot assembly</b></div>
          <div className="px-[10px] py-[6px] border-r border-line2"><span className="text-muted">design hash</span><br /><span className="font-mono">{DESIGN_HASH_SHORT}</span></div>
          <div className="px-[10px] py-[6px] border-r border-line2"><span className="text-muted">span</span><br /><span className="font-mono">{span.toFixed(1)} m</span></div>
          <div className="px-[10px] py-[6px]"><span className="text-muted">sheet</span><br /><span className="font-mono">A3 · not yet generated</span></div>
        </div>
      </div>
    </div>
  );
}

export function Viewport({ o: _o }: { o: Outcome }) {
  const s = useStore();
  const orbit = useRef({ on: false, pan: false, start: [0, 0, 0, 0, 0, 0, 0.7], moved: false });
  const [dispOpen, setDispOpen] = useState(false);
  const cube = useRef({ on: false, start: [0, 0, 0, 0], moved: false });
  const move = useRef<{ slot: Slot; from: Pos; grab: Pos; moved: boolean } | null>(null);
  const prRef = useRef<{ pr: Projector; ca: number; sa: number; extents: Record<Slot, Extent> } | null>(null);

  const L = s.span;
  const scene = useMemo(() => {
    const U = 100 * s.zoom;
    const p0 = proj(s.az, s.el, U, 0, 0);
    const c0 = p0.pt(L / 2, W / 2, 0.3);
    const pr = proj(s.az, s.el, U, 380 + s.pan.x - c0[0], 262 + s.pan.y - c0[1]);
    const plate: Solid = { slot: 'airframe', faces: boxFaces(0, 0, 0, L, W, T, 'airframe').concat(([[0.25, 0.2], [L - 0.25, 0.2], [0.25, W - 0.2], [L - 0.25, W - 0.2]] as [number, number][]).flatMap(([x, y]) => [discZ(x, y, T, 0.07, 'airframe', 'var(--m3)'), discZd(x, y, 0, 0.07, 'airframe', 'var(--m1)')])) };
    const flange: Solid = { slot: 'airframe', faces: boxFaces(0, 0, T, 0.08, W, s.dims.airframe, 'airframe').concat(([[0.35, 0.5], [W - 0.35, 0.5]] as [number, number][]).flatMap(([y, z]) => [discX(0.08, y, z, 0.07, 1, 'airframe', 'var(--m2)'), discX(0, y, z, 0.07, -1, 'airframe', 'var(--m2)')])), c: [0.04, W / 2, T + s.dims.airframe / 2] };
    // spec-driven size: a bigger pack is taller, a bigger sensor has a bigger footprint
    const bodyFor = (slot: Slot): Solid => {
      const pid = s.parts[slot];
      const { x, y } = s.pos[slot];
      if (!pid) return emptySolid(slot, x, y, T, s.dims);
      const a = s.attrs[slot], tpl = CATALOG[pid].attrs;
      let h = s.dims[slot], fs = 1;
      if (slot === 'battery' && a.pack_wh && tpl.pack_wh) h = s.dims.battery * clamp(a.pack_wh / tpl.pack_wh, 0.5, 2.5);
      if (slot === 'thermal' && a.elements && tpl.elements) fs = clamp(Math.sqrt(a.elements / tpl.elements), 0.6, 2);
      return partSolid(pid, slot, x, y, T, s.dims, h, fs);
    };
    const bodies = Object.fromEntries(SLOTS.map((sl) => [sl, bodyFor(sl)])) as Record<Slot, Solid>;
    const extents = Object.fromEntries(SLOTS.map((sl) => { const b = solidBounds(bodies[sl]); const p = s.pos[sl]; return [sl, { dx0: b.minx - p.x, dx1: b.maxx - p.x, dy0: b.miny - p.y, dy1: b.maxy - p.y }]; })) as Record<Slot, Extent>;
    const solids: Solid[] = [...SLOTS.filter((sl) => !s.hidden[sl]).map((sl) => bodies[sl]), ...(s.hidden.flange ? [] : [flange])];
    const dep = (so: Solid) => (so.c ? pr.depth(so.c[0], so.c[1], so.c[2]) : 0);
    solids.sort((a, b) => dep(a) - dep(b));
    const dragSlot: Node | null = s.dragPart ? CATALOG[s.dragPart].slot : null;
    const deco = (slot: string, _f: Face): Deco => {
      const on = s.sel === slot, hv = s.hover === slot, dt = dragSlot === slot;
      const empty = isSlot(slot) && !s.parts[slot];
      const base = dt || on ? 'var(--focus)' : hv ? 'var(--ink)' : empty ? 'var(--muted)' : 'var(--m3)';
      const stroke = s.visualStyle === 'wireframe' ? (dt || on || hv ? base : 'var(--ink)') : s.visualStyle === 'shaded' && !(dt || on || hv || empty) ? 'none' : base;
      return { stroke, sw: dt || on ? 3 : hv ? 2 : s.visualStyle === 'wireframe' ? 0.8 : 1, dash: dt || empty ? '6 4' : '' };
    };
    const plateVisible = !s.hidden.plate;
    let faces = [] as ReturnType<typeof renderSolid<Deco>>;
    if (s.el >= 0) { if (plateVisible) faces = renderSolid(plate, pr, deco); for (const so of solids) faces = faces.concat(renderSolid(so, pr, deco)); }
    else { for (const so of solids) faces = faces.concat(renderSolid(so, pr, deco)); if (plateVisible) faces = faces.concat(renderSolid(plate, pr, deco)); }
    if (s.visualStyle === 'wireframe') faces = faces.map((f) => ({ ...f, fill: 'none' }));

    const gridLines: { x1: string; y1: string; x2: string; y2: string; stroke: string; sw: number }[] = [];
    if (s.grid) {
      // Cover the whole viewport: inverse-project the four viewBox corners onto the z = 0 plane
      // and grid the bounding box, snapped to the 0.5 m minor pitch. Edge-on views fall back to a wide fixed range.
      const ca = Math.cos(s.az), sa = Math.sin(s.az);
      const UK = pr.U * K;
      const corner = (sx: number, sy: number): Pos | null => {
        if (Math.abs(pr.se) < 0.08) return null;
        const a = (sx - pr.ox) / UK, b = (sy - pr.oy) / UK / pr.se;
        return { x: a * ca + b * sa, y: -a * sa + b * ca };
      };
      const cs = [corner(0, 0), corner(VB_W, 0), corner(0, VB_H), corner(VB_W, VB_H)];
      let gx0 = -20, gx1 = L + 20, gy0 = -20, gy1 = W + 20;
      if (cs.every((c): c is Pos => !!c)) {
        const lim = 60;
        gx0 = clamp(Math.floor(Math.min(...cs.map((c) => c.x)) * 2) / 2, -lim, lim);
        gx1 = clamp(Math.ceil(Math.max(...cs.map((c) => c.x)) * 2) / 2, -lim, lim);
        gy0 = clamp(Math.floor(Math.min(...cs.map((c) => c.y)) * 2) / 2, -lim, lim);
        gy1 = clamp(Math.ceil(Math.max(...cs.map((c) => c.y)) * 2) / 2, -lim, lim);
      }
      const step = s.zoom < 0.45 ? 1 : 0.5;
      const ln = (a: [number, number], b: [number, number], major: boolean) => {
        const p = pr.pt(a[0], a[1], -0.001), q = pr.pt(b[0], b[1], -0.001);
        gridLines.push({ x1: p[0].toFixed(1), y1: p[1].toFixed(1), x2: q[0].toFixed(1), y2: q[1].toFixed(1), stroke: major ? 'var(--line)' : 'var(--line2)', sw: major ? 1 : 0.6 });
      };
      for (let x = gx0; x <= gx1 + 1e-9; x += step) ln([x, gy0], [x, gy1], Math.abs(x % 1) < 1e-9);
      for (let y = gy0; y <= gy1 + 1e-9; y += step) ln([gx0, y], [gx1, y], Math.abs(y % 1) < 1e-9);
    }
    const axes = ([['X', [0.6, 0, 0]], ['Y', [0, 0.6, 0]], ['Z', [0, 0, 0.6]]] as [string, [number, number, number]][]).map(([label, v]) => {
      const o0 = pr.pt(-0.6, -0.6, 0), p = pr.pt(-0.6 + v[0], -0.6 + v[1], v[2]);
      const t = pr.pt(-0.6 + v[0] * 1.25, -0.6 + v[1] * 1.25, v[2] * 1.25);
      return { label, x1: o0[0].toFixed(1), y1: o0[1].toFixed(1), x2: p[0].toFixed(1), y2: p[1].toFixed(1), tx: t[0].toFixed(1), ty: (t[1] + 4).toFixed(1) };
    });
    const cpr = proj(s.az, s.el, 40, 60, 60);
    const cubeFaces = cubeCells(cpr);
    const d1 = pr.pt(0, W + 0.3, 0), d2 = pr.pt(L, W + 0.3, 0);
    const dim = { x1: d1[0].toFixed(1), y1: d1[1].toFixed(1), x2: d2[0].toFixed(1), y2: d2[1].toFixed(1), tx: ((d1[0] + d2[0]) / 2).toFixed(1), ty: (Math.max(d1[1], d2[1]) + 18).toFixed(1) };
    prRef.current = { pr, ca: Math.cos(s.az), sa: Math.sin(s.az), extents };
    return { faces, gridLines, axes, cubeFaces, dim };
  }, [s.az, s.el, s.zoom, s.pan, L, s.dims, s.parts, s.attrs, s.pos, s.sel, s.hover, s.dragPart, s.grid, s.hidden, s.visualStyle]);

  const svgPt = (e: { clientX: number; clientY: number; currentTarget: Element }): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * VB_W, ((e.clientY - r.top) / r.height) * VB_H];
  };
  /** Clamp a body's anchor so its footprint stays on the plate. */
  const onPlate = (slot: Slot, p: Pos): Pos => {
    const ex = prRef.current?.extents[slot];
    if (!ex) return p;
    return { x: clamp(p.x, 0.12 - ex.dx0, L - 0.05 - ex.dx1), y: clamp(p.y, 0.05 - ex.dy0, W - 0.05 - ex.dy1) };
  };
  const platePt = (sx: number, sy: number): Pos | null => { const c = prRef.current; return c ? toPlate(c.pr, sx, sy, c.ca, c.sa) : null; };

  const vpDown = (e: RMouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const [x, y] = svgPt(e);
    orbit.current = { on: true, pan: e.shiftKey || e.button === 1 || s.navMode === 'pan', start: [x, y, s.az, s.el, s.pan.x, s.pan.y, s.zoom], moved: false };
  };
  const vpMove = (e: RMouseEvent<SVGSVGElement>) => {
    const mv = move.current;
    if (mv) {
      const [x, y] = svgPt(e);
      const p = platePt(x, y);
      if (!p) return;
      const next = onPlate(mv.slot, { x: mv.from.x + (p.x - mv.grab.x), y: mv.from.y + (p.y - mv.grab.y) });
      if (Math.abs(next.x - mv.from.x) + Math.abs(next.y - mv.from.y) > 0.01) mv.moved = true;
      s.moveTo(mv.slot, next);
      return;
    }
    const ob = orbit.current;
    if (!ob.on) return;
    const [x, y] = svgPt(e);
    const dx = x - ob.start[0], dy = y - ob.start[1];
    if (Math.abs(dx) + Math.abs(dy) > 3) ob.moved = true;
    if (ob.pan) s.patch({ pan: { x: ob.start[4] + dx, y: ob.start[5] + dy } });
    else if (s.navMode === 'zoom' && !e.shiftKey) s.patch({ zoom: clamp(+(ob.start[6] - dy * 0.006).toFixed(2), 0.3, 2) });
    else s.patch({ az: ob.start[2] - dx * 0.008, el: clamp(ob.start[3] + dy * 0.008, -1.55, 1.55) });
  };
  const vpUp = () => {
    const mv = move.current;
    if (mv) {
      move.current = null;
      if (mv.moved) { s.commitMove(mv.slot, mv.from); orbit.current.moved = true; setTimeout(() => { orbit.current.moved = false; }, 0); }
      return;
    }
    const ob = orbit.current;
    if (!ob.on) return;
    ob.on = false; ob.pan = false;
    setTimeout(() => { ob.moved = false; }, 0);
  };
  const bodyDown = (slot: string) => (e: RMouseEvent<SVGPolygonElement>) => {
    if (e.button !== 0 || e.shiftKey || !isSlot(slot) || !s.parts[slot]) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const [x, y] = svgPt({ clientX: e.clientX, clientY: e.clientY, currentTarget: svg });
    const p = platePt(x, y);
    if (!p) return;
    e.stopPropagation();
    move.current = { slot, from: { ...s.pos[slot] }, grab: p, moved: false };
  };
  const vpWheel = (e: WheelEvent<SVGSVGElement>) => {
    const dz = e.deltaY > 0 ? -0.05 : 0.05;
    s.patch({ zoom: clamp(+(s.zoom + dz).toFixed(2), 0.3, 2) });
  };
  const cubeDown = (e: RMouseEvent<SVGSVGElement>) => {
    e.stopPropagation(); e.preventDefault();
    cube.current = { on: true, start: [e.clientX, e.clientY, s.az, s.el], moved: false };
    const mv = (ev: MouseEvent) => {
      const cb = cube.current; if (!cb.on) return;
      const dx = ev.clientX - cb.start[0], dy = ev.clientY - cb.start[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) cb.moved = true;
      useStore.getState().patch({ az: cb.start[2] - dx * 0.02, el: clamp(cb.start[3] + dy * 0.02, -1.55, 1.55) });
    };
    const up = () => { cube.current.on = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); setTimeout(() => { cube.current.moved = false; }, 0); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const vpDragOver = (e: DragEvent<SVGSVGElement>) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ } if (!s.dragging) s.patch({ dragging: true }); };
  const vpDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    let pid: PartId | null = s.dragPart;
    try { const raw = e.dataTransfer.getData('text/plain'); if (!pid && raw in CATALOG) pid = raw as PartId; } catch { /* ignore */ }
    if (!pid) { s.patch({ dragging: false, dragPart: null }); return; }
    const slot = CATALOG[pid].slot;
    const [x, y] = svgPt(e);
    const p = platePt(x, y);
    // the drop point becomes the body's anchor, clamped onto the plate once its extent is known
    const at = p ? { x: clamp(p.x, 0.15, L - 0.45), y: clamp(p.y, 0.1, W - 0.35) } : undefined;
    s.swap(slot, pid, at);
    s.patch({ dragging: false, dragPart: null });
  };
  const snap = (dir: Vec3) => { if (cube.current.moved) return; s.setViewDir(dir); };
  const clickFace = (slot: string) => { if (orbit.current.moved) return; if (isNode(slot)) s.select(slot); };

  const sel = s.sel;
  const hasSlot = !!sel;
  const extrudeTarget = sel === 'airframe' ? 'flange' : sel ? SLOT_LABEL[sel] : '';
  const dropSlot = s.dragPart ? CATALOG[s.dragPart].slot : null;
  const dropHint = dropSlot ? 'drop to place in ' + SLOT_LABEL[dropSlot] + (s.parts[dropSlot] && s.parts[dropSlot] !== s.dragPart ? ' · a part_swapped event, unconfirmed until attested' : ' · a part_placed event') : '';
  const isModel = s.viewMode === 'model';
  const cursor = s.dragging ? 'copy' : move.current ? 'grabbing' : orbit.current.on ? (orbit.current.pan ? 'grabbing' : s.navMode === 'zoom' ? 'ns-resize' : 'move') : s.navMode === 'pan' ? 'grab' : s.navMode === 'zoom' ? 'zoom-in' : 'default';

  return (
    <div data-panel="viewport" className="panel flex-1 flex flex-col min-h-0 relative">
      <div className="flex items-center gap-2 px-3 py-[6px] border-b border-line2 flex-wrap">
        <div role="radiogroup" aria-label="View mode" className="flex border border-line rounded-r overflow-hidden">
          <button role="radio" aria-checked={isModel} onClick={() => s.patch({ viewMode: 'model' })} className="min-h-8 px-[10px] border-0 cursor-pointer text-[13px] font-semibold" style={{ background: isModel ? 'var(--accent)' : 'transparent', color: isModel ? 'var(--accentfg)' : 'var(--ink)' }}>Model</button>
          <button role="radio" aria-checked={!isModel} onClick={() => s.patch({ viewMode: 'sheet' })} className="min-h-8 px-[10px] border-0 border-l border-line cursor-pointer text-[13px] font-semibold" style={{ background: !isModel ? 'var(--accent)' : 'transparent', color: !isModel ? 'var(--accentfg)' : 'var(--ink)' }}>Drawing sheet</button>
        </div>
        <div className="flex-1" />
        {hasSlot ? (
          <>
            <label htmlFor="extrude" className="text-[13px] text-muted">Extrude · {extrudeTarget}</label>
            <input id="extrude" inputMode="decimal" value={s.extrudeText} onChange={(e) => s.patch({ extrudeText: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') s.applyExtrude(); }} aria-describedby="extrude-msg" className="w-[84px] min-h-8 px-2 border border-line rounded-r bg-surface text-ink font-mono text-[14px]" />
            <span className="text-[13px] text-muted">m</span>
            <button onClick={s.applyExtrude} className="btn btn-primary">Apply</button>
            <span id="extrude-msg" role="status" className="text-[13px] text-muted">{s.extrudeMsg}</span>
          </>
        ) : (
          <span className="text-[13px] text-muted">drag a body to move it · drag empty space to {s.navMode} · wheel to zoom</span>
        )}
      </div>
      {!isModel && <SheetView span={s.span} />}
      <div className="flex-1 min-h-0 items-center justify-center p-2 relative" style={{ display: isModel ? 'flex' : 'none', background: s.dragging ? 'var(--surface2)' : 'transparent' }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="Orbitable bracket with movable slot bodies"
          onMouseDown={vpDown} onMouseMove={vpMove} onMouseUp={vpUp} onMouseLeave={vpUp} onWheel={vpWheel} onDragOver={vpDragOver} onDrop={vpDrop}
          className="w-full h-full block font-sans select-none"
          style={{ cursor }}
        >
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="transparent" />
          {scene.gridLines.map((g, i) => <line key={'g' + i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={g.stroke} strokeWidth={g.sw} />)}
          {scene.axes.map((ax) => (
            <g key={ax.label}>
              <line x1={ax.x1} y1={ax.y1} x2={ax.x2} y2={ax.y2} stroke="var(--muted)" strokeWidth="1.5" />
              <text x={ax.tx} y={ax.ty} fill="var(--muted)" fontSize="12" fontFamily="Geist Mono, monospace" textAnchor="middle">{ax.label}</text>
            </g>
          ))}
          {scene.faces.map((f, i) => (
            <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth={f.sw} strokeDasharray={f.dash || undefined} strokeLinejoin="round" data-slot={f.slot}
              onMouseDown={bodyDown(f.slot)} onClick={() => clickFace(f.slot)} onMouseEnter={() => { if (isNode(f.slot)) s.patch({ hover: f.slot }); }} onMouseLeave={() => s.patch({ hover: null })}
              style={{ cursor: isSlot(f.slot) && s.parts[f.slot] ? 'grab' : 'pointer' }} />
          ))}
          <line x1={scene.dim.x1} y1={scene.dim.y1} x2={scene.dim.x2} y2={scene.dim.y2} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={scene.dim.tx} y={scene.dim.ty} fill="var(--muted)" fontSize="13" fontFamily="Geist Mono, monospace" textAnchor="middle">span {L.toFixed(1)} m</text>
          {s.dragging && <text x="380" y="476" fill="var(--ink)" fontSize="14" fontWeight="600" textAnchor="middle">{dropHint}</text>}
        </svg>
        {/* ViewCube: faces, edges and corners snap the camera; drag orbits; home returns to the isometric */}
        <div className="absolute right-3 top-3 grid gap-1 justify-items-center p-[6px]" onMouseDown={(e) => e.stopPropagation()}>
          <div className="relative w-[136px] h-[136px]">
            <button onClick={() => s.setView('iso')} aria-label="Home view" title="Home" className="tree-btn absolute left-0 top-0 w-6 h-6 text-ink"><Home /></button>
            <button onClick={() => s.patch({ az: s.az - Math.PI / 12 })} aria-label="Rotate view 15° left" title="Rotate left" className="tree-btn absolute left-0 bottom-0 w-6 h-6 text-ink text-[14px]">⟲</button>
            <button onClick={() => s.patch({ az: s.az + Math.PI / 12 })} aria-label="Rotate view 15° right" title="Rotate right" className="tree-btn absolute right-0 bottom-0 w-6 h-6 text-ink text-[14px]">⟳</button>
            <svg viewBox="0 0 120 120" role="group" aria-label="View cube: drag to orbit; click a face, edge or corner to snap" onMouseDown={cubeDown} className="absolute left-2 top-2 w-[120px] h-[120px] block select-none cursor-grab">
              {scene.cubeFaces.map((cf, i) => <polygon key={i} points={cf.pts} fill={cf.fill} stroke="var(--ink)" strokeWidth={cf.kind === 'face' ? 0.8 : 0.35} strokeOpacity={cf.kind === 'face' ? 1 : 0.5} strokeLinejoin="round" onClick={() => snap(cf.dir)} className="cube-cell cursor-pointer"><title>{cf.label || (cf.kind === 'edge' ? 'edge view' : 'corner view')}</title></polygon>)}
              {scene.cubeFaces.filter((cf) => cf.label).map((cf) => <text key={'t' + cf.label} transform={cf.m} x="0" y="0.02" fill="var(--ink)" fontSize="0.2" fontWeight="600" fontFamily="Work Sans, system-ui, sans-serif" textAnchor="middle" dominantBaseline="middle" onClick={() => snap(cf.dir)} className="cursor-pointer" style={{ pointerEvents: 'all', letterSpacing: '0.01em' }}>{(cf.label || "").toUpperCase()}</text>)}
            </svg>
          </div>
        </div>
        {/* Navigation bar: orbit / pan / zoom drag modes, fit, display settings */}
        <div className="absolute left-1/2 bottom-3 -translate-x-1/2 flex items-center gap-[2px] px-1 py-[3px] bg-surface border border-line rounded-r shadow-[0_2px_8px_rgba(0,0,0,.08)]" onMouseDown={(e) => e.stopPropagation()}>
          <button className="nav-btn" aria-pressed={s.navMode === 'orbit'} title="Orbit (drag)" onClick={() => s.patch({ navMode: 'orbit' })}><Orbit /></button>
          <button className="nav-btn" aria-pressed={s.navMode === 'pan'} title="Pan (drag · or shift-drag)" onClick={() => s.patch({ navMode: 'pan' })}><Pan /></button>
          <button className="nav-btn" aria-pressed={s.navMode === 'zoom'} title="Zoom (drag up/down · or wheel)" onClick={() => s.patch({ navMode: 'zoom' })}><Zoom /></button>
          <span className="w-px h-5 bg-line2 mx-1" />
          <button className="nav-btn" title="Fit" onClick={() => s.fit()}><Fit /></button>
          <span className="w-px h-5 bg-line2 mx-1" />
          <div className="relative">
            <button className="nav-btn" aria-expanded={dispOpen} title="Display settings" onClick={() => setDispOpen((v) => !v)}><Display /><span className="text-[12px] text-muted">{Math.round(s.zoom * 100)}%</span></button>
            {dispOpen && (
              <div role="menu" className="absolute bottom-[38px] left-0 w-[220px] bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)] py-1 text-[13px]">
                <div className="px-3 pt-1 pb-[2px] text-[12px] text-muted">Visual style</div>
                {(['shaded', 'edges', 'wireframe'] as const).map((v) => (
                  <button key={v} role="menuitemradio" aria-checked={s.visualStyle === v} onClick={() => s.patch({ visualStyle: v })} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer">
                    <span className="text-ink">{s.visualStyle === v ? <Check /> : null}</span>{v === 'shaded' ? 'Shaded' : v === 'edges' ? 'Shaded with visible edges' : 'Wireframe'}
                  </button>
                ))}
                <div className="border-t border-line2 my-1" />
                <button role="menuitemcheckbox" aria-checked={s.grid} onClick={() => s.patch({ grid: !s.grid })} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer">
                  <span>{s.grid ? <Check /> : null}</span><span className="inline-flex items-center gap-2"><GridIcon /> Layout grid</span>
                </button>
                <div className="border-t border-line2 my-1" />
                <button onClick={() => { s.setView('iso'); setDispOpen(false); }} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer"><span /><span>Reset camera · Iso 70%</span></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
