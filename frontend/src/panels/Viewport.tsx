import { useMemo, useRef, useState, type DragEvent, type MouseEvent as RMouseEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStore, isBodyId, nodeOfBody, BODY_LABEL, type BodyId, type Pos } from '../store';
import { CATALOG, CORE_SLOTS, PLATE_T, SLOTS, SLOT_LABEL, type PartId, type Slot } from '../lib/catalog';
import { boxFaces, clipFaces, K, proj, renderSolid, solidBounds, type Face, type Projector, type Solid, type Vec3 } from '../lib/geometry';
import { buildBodies } from '../lib/scene';
import { fmtLen } from '../lib/units';
import type { Outcome } from '../lib/rules';
import { Check, Display, Fit, Grid as GridIcon, Home, Orbit, Pan, Zoom } from './Icons';
import { SketchView } from './SketchView';
import { BoardView } from './BoardView';
import { FeatureDialog } from './FeatureDialog';
import { MarkingMenu } from './MarkingMenu';

const VB_W = 760, VB_H = 490;
/** Scene unit is the metre; the plate is a few hundred millimetres, so 1 m draws as 1000 px at zoom 1. */
const PX_PER_M = 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** ViewCube cells: each face split 3×3; centre = face view, edge strips = edge views, corners = corner views (26 directions). */
interface CubeCell { pts: string; fill: string; dir: Vec3; key: string; label?: string; m?: string; d: number; kind: 'face' | 'edge' | 'corner'; cx: number; cy: number }
/** One visible face: its outline and the grooves that split it 3×3 (drawn in the groove colour so the pads read as rounded tiles). */
interface CubeFace { pts: string; fill: string; d: number; grooves: string[]; n: Vec3 }
/** The little XYZ triad at the cube's front-bottom-left corner. */
interface CubeTriad { o: number[]; x: number[]; y: number[]; z: number[]; yBehind: boolean }
const FACE_DEFS: { n: Vec3; u: Vec3; v: Vec3; label: string }[] = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0], label: 'Top' },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], label: 'Bottom' },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], label: 'Front' },
  { n: [0, -1, 0], u: [-1, 0, 0], v: [0, 0, 1], label: 'Back' },
  { n: [1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], label: 'Right' },
  { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], label: 'Left' },
];
const CUTS = [-0.5, -0.28, 0.28, 0.5];
function cubeCells(pr: Projector): { cells: CubeCell[]; faces: CubeFace[]; triad: CubeTriad } {
  const out: CubeCell[] = [];
  const faces: CubeFace[] = [];
  const add = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const P = (p: Vec3) => pr.pt(p[0], p[1], p[2]).map((v) => v.toFixed(1)).join(',');
  for (const f of FACE_DEFS) {
    const dot = f.n[0] * pr.view[0] + f.n[1] * pr.view[1] + f.n[2] * pr.view[2];
    if (dot <= 0.02) continue;
    // one pale tone for every face, a touch lighter on top, like the Fusion cube
    const fill = f.n[2] > 0.5 ? 'var(--cube-top)' : 'var(--cube)';
    const at = (a: number, b: number): Vec3 => add(add(add([0, 0, 0], f.n, 0.5), f.u, a), f.v, b);
    const outline = [at(-0.5, -0.5), at(0.5, -0.5), at(0.5, 0.5), at(-0.5, 0.5)].map(P).join(' ');
    // grooves at the 3×3 cuts, drawn edge to edge in the groove colour
    const c1 = CUTS[1], c2 = CUTS[2];
    const grooves = [
      P(at(-0.5, c1)) + ' ' + P(at(0.5, c1)), P(at(-0.5, c2)) + ' ' + P(at(0.5, c2)), P(at(c1, -0.5)) + ' ' + P(at(c1, 0.5)), P(at(c2, -0.5)) + ' ' + P(at(c2, 0.5)),
    ];
    faces.push({ pts: outline, fill, d: dot, grooves, n: f.n });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const corners: Vec3[] = [[CUTS[i], CUTS[j]], [CUTS[i + 1], CUTS[j]], [CUTS[i + 1], CUTS[j + 1]], [CUTS[i], CUTS[j + 1]]].map(([a, b]) => add(add(add([0, 0, 0], f.n, 0.5), f.u, a), f.v, b));
      const mid = at((CUTS[i] + CUTS[i + 1]) / 2, (CUTS[j] + CUTS[j + 1]) / 2);
      const [cx, cy] = pr.pt(mid[0], mid[1], mid[2]);
      const du = i === 0 ? -1 : i === 2 ? 1 : 0, dv = j === 0 ? -1 : j === 2 ? 1 : 0;
      const dir: Vec3 = add(add([...f.n] as Vec3, f.u, du), f.v, dv);
      const kind = du === 0 && dv === 0 ? 'face' : du !== 0 && dv !== 0 ? 'corner' : 'edge';
      let m: string | undefined;
      if (kind === 'face') {
        const c = add([0, 0, 0], f.n, 0.5);
        const pc = pr.pt(c[0], c[1], c[2]);
        const pu = pr.pt(c[0] + f.u[0], c[1] + f.u[1], c[2] + f.u[2]), pv = pr.pt(c[0] + f.v[0], c[1] + f.v[1], c[2] + f.v[2]);
        let a = pu[0] - pc[0], b = pu[1] - pc[1], cc = -(pv[0] - pc[0]), dd = -(pv[1] - pc[1]);
        // never mirror the text: a negative determinant flips the up axis; if it then reads right-to-left, turn it 180°
        if (a * dd - b * cc < 0) { cc = -cc; dd = -dd; }
        if (a < 0) { a = -a; b = -b; cc = -cc; dd = -dd; }
        m = 'matrix(' + [a, b, cc, dd, pc[0], pc[1]].map((v) => v.toFixed(3)).join(' ') + ')';
      }
      // cells that share a direction (the three cells meeting at a corner, the two along an edge) share a key and highlight together
      out.push({ pts: corners.map(P).join(' '), fill, dir, key: dir.map((v) => Math.sign(v)).join(','), label: kind === 'face' ? f.label : undefined, m, d: dot, kind, cx, cy });
    }
  }
  // the triad is its own small gizmo at the bottom-left of the widget, oriented by the same camera
  const o0 = pr.pt(0, 0, 0);
  const dir = (x: number, y: number, z: number): [number, number] => { const p = pr.pt(x, y, z); return [p[0] - o0[0], p[1] - o0[1]]; };
  const og: [number, number] = [40, 158];
  const ax = (v: [number, number]) => [og[0] + v[0], og[1] + v[1]];
  const triad: CubeTriad = { o: og, x: ax(dir(0.85, 0, 0)), y: ax(dir(0, 0.85, 0)), z: ax(dir(0, 0, 0.85)), yBehind: pr.view[1] > 0 };
  return { cells: out.sort((a, b) => a.d - b.d), faces: faces.sort((a, b) => a.d - b.d), triad };
}

interface Deco { stroke: string; sw: number; dash: string; hoverMix: boolean; selFace: boolean; tint?: string }
interface Extent { dx0: number; dx1: number; dy0: number; dy1: number }

function toPlate(pr: Projector, sx: number, sy: number, ca: number, sa: number, thickness: number): Pos | null {
  if (Math.abs(pr.se) < 0.08) return null;
  const UK = pr.U * K;
  const a = (sx - pr.ox) / UK;
  const b = ((sy - pr.oy) / UK + thickness * pr.ce) / pr.se;
  return { x: a * ca + b * sa, y: -a * sa + b * ca };
}


export function Viewport({ o: _o }: { o: Outcome }) {
  const s = useStore();
  const orbit = useRef({ on: false, pan: false, start: [0, 0, 0, 0, 0, 0, 0.7], moved: false, bg: false });
  const cube = useRef({ on: false, start: [0, 0, 0, 0], moved: false });
  const move = useRef<{ slot: Slot; from: Pos; grab: Pos; moved: boolean } | null>(null);
  // dragging one arrow of the move triad: the axis, the pointer start and the axis direction on screen
  const axisMove = useRef<{ slot: Slot; axis: 0 | 1 | 2; from: Pos; start: [number, number]; dir: [number, number]; moved: boolean } | null>(null);
  const [axisHover, setAxisHover] = useState<0 | 1 | 2 | null>(null);
  const prRef = useRef<{ pr: Projector; ca: number; sa: number; extents: Record<Slot, Extent> } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dispOpen, setDispOpen] = useState(false);
  const [cubeHover, setCubeHover] = useState<string | null>(null);
  const [cubeMenu, setCubeMenu] = useState(false);

  const dims = s.preview?.dims ?? s.dims, geo = s.preview?.geo ?? s.geo, pos = s.preview?.pos ?? s.pos;
  const L = geo.plateL, W = geo.plateW;
  // a component body shows when it is placed, or when its type is in the project (dashed footprint); library types not in the project draw nothing
  const inProject = (sl: Slot) => !!s.parts[sl] || (s.project?.components ?? CORE_SLOTS).includes(sl);
  const visible = (b: BodyId) => !s.hidden[b] && (!s.isolated || s.isolated === b) && (b === 'plate' || b === 'flange' || inProject(b));
  // plate depth comes from the committed sketch geometry (main), falling back to the catalog constant
  const plateT = geo.plateT ?? PLATE_T;

  const scene = useMemo(() => {
    const U = PX_PER_M * s.zoom;
    const p0 = proj(s.az, s.el, U, 0, 0);
    const c0 = p0.pt(L / 2, W / 2, 0.03);
    const pr = proj(s.az, s.el, U, 380 + s.pan.x - c0[0], 262 + s.pan.y - c0[1]);
    const bodies = buildBodies({ dims, geo, parts: s.parts, attrs: s.attrs, pos, span: s.span });
    const extents = Object.fromEntries(SLOTS.map((sl) => { const b = solidBounds(bodies[sl]); const p = pos[sl]; return [sl, { dx0: b.minx - p.x, dx1: b.maxx - p.x, dy0: b.miny - p.y, dy1: b.maxy - p.y }]; })) as Record<Slot, Extent>;
    const cut = (so: Solid): Solid => (s.section.on ? { ...so, faces: clipFaces(so.faces, s.section.axis, s.section.at) } : so);
    const solids: Solid[] = [...SLOTS.filter(visible).map((sl) => cut(bodies[sl])), ...(visible('flange') ? [cut(bodies.flange)] : [])];
    const plate = visible('plate') ? cut(bodies.plate) : null;
    const dep = (so: Solid) => (so.c ? pr.depth(so.c[0], so.c[1], so.c[2]) : 0);
    solids.sort((a, b) => dep(a) - dep(b));
    const dragSlot: Slot | null = s.dragPart ? CATALOG[s.dragPart].slot : null;
    const deco = (_slot: string, f: Face): Deco => {
      const body = (f.body || _slot) as BodyId;
      const slotBody = isBodyId(body) && body !== 'plate' && body !== 'flange' ? body : null;
      const selected = s.selFilter === 'component' ? (nodeOfBody(body) === s.sel && !(s.sel === 'airframe' && s.selBody === 'flange' && body === 'plate')) : s.selBody === body;
      const on = s.selFilter === 'face' ? false : selected;
      const hv = s.hover === body && s.selFilter !== 'face';
      const dt = dragSlot != null && dragSlot === body;
      const empty = slotBody != null && !s.parts[slotBody];
      const base = dt || on ? 'var(--focus)' : hv ? 'var(--ink)' : empty ? 'var(--muted)' : f.cut ? 'var(--amber)' : 'var(--m3)';
      const stroke = s.visualStyle === 'wireframe' ? (dt || on || hv ? base : 'var(--ink)') : s.visualStyle === 'shaded' && !(dt || on || hv || empty || f.cut) ? 'none' : base;
      return { stroke, sw: dt || on ? 3 : hv || f.cut ? 2 : s.visualStyle === 'wireframe' ? 0.8 : 1, dash: dt || empty ? '6 4' : f.cut ? '3 3' : '', hoverMix: (s.hover === body && s.selFilter !== 'face') || (s.selFilter === 'face' && s.hover === body), selFace: !!s.selFace && s.selFace.body === body && s.selFace.fi === f.fi, tint: slotBody ? s.tint[slotBody] : undefined };
    };
    let faces = [] as ReturnType<typeof renderSolid<Deco>>;
    if (s.el >= 0) { if (plate) faces = renderSolid(plate, pr, deco); for (const so of solids) faces = faces.concat(renderSolid(so, pr, deco)); }
    else { for (const so of solids) faces = faces.concat(renderSolid(so, pr, deco)); if (plate) faces = faces.concat(renderSolid(plate, pr, deco)); }
    faces = faces.map((f) => {
      let fill = f.fill;
      if (f.tint && fill !== 'none') fill = `color-mix(in srgb, ${fill} 55%, ${f.tint})`;
      if (f.hoverMix && fill !== 'none') fill = `color-mix(in srgb, ${fill} 82%, var(--focus))`;
      if (f.selFace) fill = 'var(--focus)';
      if (s.visualStyle === 'wireframe' && !f.selFace) fill = 'none';
      return { ...f, fill };
    });

    const gridLines: { x1: string; y1: string; x2: string; y2: string; stroke: string; sw: number }[] = [];
    if (s.grid) {
      const ca = Math.cos(s.az), sa = Math.sin(s.az);
      const UK = pr.U * K;
      const corner = (sx: number, sy: number): Pos | null => { if (Math.abs(pr.se) < 0.08) return null; const a = (sx - pr.ox) / UK, b = (sy - pr.oy) / UK / pr.se; return { x: a * ca + b * sa, y: -a * sa + b * ca }; };
      const cs = [corner(0, 0), corner(VB_W, 0), corner(0, VB_H), corner(VB_W, VB_H)];
      // 50 mm grid with a 100 mm major line (100 mm minor when zoomed out); extents snap to the 50 mm lattice
      const step = s.zoom < 0.45 ? 0.1 : 0.05, lattice = 20;
      let gx0 = -2, gx1 = L + 2, gy0 = -2, gy1 = W + 2;
      if (cs.every((c): c is Pos => !!c)) {
        const lim = 6;
        gx0 = clamp(Math.floor(Math.min(...cs.map((c) => c.x)) * lattice) / lattice, -lim, lim); gx1 = clamp(Math.ceil(Math.max(...cs.map((c) => c.x)) * lattice) / lattice, -lim, lim);
        gy0 = clamp(Math.floor(Math.min(...cs.map((c) => c.y)) * lattice) / lattice, -lim, lim); gy1 = clamp(Math.ceil(Math.max(...cs.map((c) => c.y)) * lattice) / lattice, -lim, lim);
      }
      const major = (v: number) => Math.abs(Math.round(v * 1000) % 100) < 1;
      const ln = (a: [number, number], b: [number, number], isMajor: boolean) => { const p = pr.pt(a[0], a[1], -0.0001), q = pr.pt(b[0], b[1], -0.0001); gridLines.push({ x1: p[0].toFixed(1), y1: p[1].toFixed(1), x2: q[0].toFixed(1), y2: q[1].toFixed(1), stroke: isMajor ? 'var(--line)' : 'var(--line2)', sw: isMajor ? 1 : 0.6 }); };
      for (let x = gx0; x <= gx1 + 1e-9; x += step) ln([x, gy0], [x, gy1], major(x));
      for (let y = gy0; y <= gy1 + 1e-9; y += step) ln([gx0, y], [gx1, y], major(y));
    }
    const axes = ([['X', [0.06, 0, 0]], ['Y', [0, 0.06, 0]], ['Z', [0, 0, 0.06]]] as [string, [number, number, number]][]).map(([label, v]) => {
      const o0 = pr.pt(-0.06, -0.06, 0), p = pr.pt(-0.06 + v[0], -0.06 + v[1], v[2]);
      const t = pr.pt(-0.06 + v[0] * 1.25, -0.06 + v[1] * 1.25, v[2] * 1.25);
      return { label, x1: o0[0].toFixed(1), y1: o0[1].toFixed(1), x2: p[0].toFixed(1), y2: p[1].toFixed(1), tx: t[0].toFixed(1), ty: (t[1] + 4).toFixed(1) };
    });
    const cube = cubeCells(proj(s.az, s.el, 33, 108, 102));
    // the dimension line: the body length, or the span tip to tip on a wing
    const wing = geo.kind === 'wing', half = Math.max(0.2, (s.span - W) / 2);
    const d1 = wing ? pr.pt(L + 0.06, -half, 0) : pr.pt(0, W + 0.03, 0), d2 = wing ? pr.pt(L + 0.06, W + half, 0) : pr.pt(L, W + 0.03, 0);
    const dim = { x1: d1[0].toFixed(1), y1: d1[1].toFixed(1), x2: d2[0].toFixed(1), y2: d2[1].toFixed(1), tx: ((d1[0] + d2[0]) / 2).toFixed(1), ty: (Math.max(d1[1], d2[1]) + 18).toFixed(1) };
    let plane: string | null = null;
    if (s.section.on) {
      const zTop = plateT + Math.max(dims.airframe, 0.12), a = s.section.at, m = 0.02;
      const corners: Vec3[] = s.section.axis === 0 ? [[a, -m, -0.005], [a, W + m, -0.005], [a, W + m, zTop], [a, -m, zTop]] : s.section.axis === 1 ? [[-m, a, -0.005], [L + m, a, -0.005], [L + m, a, zTop], [-m, a, zTop]] : [[-m, -m, a], [L + m, -m, a], [L + m, W + m, a], [-m, W + m, a]];
      plane = corners.map((p) => pr.pt(p[0], p[1], p[2]).map((v) => v.toFixed(1)).join(',')).join(' ');
    }
    prRef.current = { pr, ca: Math.cos(s.az), sa: Math.sin(s.az), extents };
    // the move triad: X, Y and Z arrows on the selected placed part, sized in screen space so they read at every zoom
    let triad: { o: [number, number]; arms: { axis: 0 | 1 | 2; x2: number; y2: number; hx: number; hy: number; dir: [number, number]; label: string }[] } | null = null;
    const tSlot = s.sel && s.sel !== 'airframe' && s.parts[s.sel] && !s.hidden[s.sel] && s.selFilter !== 'face' && s.viewSeq == null ? s.sel : null;
    if (tSlot) {
      const p = pos[tSlot]; const oz = plateT + (p.z ?? 0);
      const o = pr.pt(p.x, p.y, oz);
      const armPx = 58;
      const arms = ([[0, 'X', [1, 0, 0]], [1, 'Y', [0, 1, 0]], [2, 'Z', [0, 0, 1]]] as [0 | 1 | 2, string, Vec3][]).map(([axis, label, v]) => {
        const q = pr.pt(p.x + v[0], p.y + v[1], oz + v[2]);
        const dir: [number, number] = [q[0] - o[0], q[1] - o[1]]; // screen pixels per metre along this axis
        const len = Math.hypot(dir[0], dir[1]) || 1;
        const ux = dir[0] / len, uy = dir[1] / len;
        return { axis, label, dir, x2: o[0] + ux * armPx, y2: o[1] + uy * armPx, hx: o[0] + ux * (armPx + 10), hy: o[1] + uy * (armPx + 10) };
      });
      triad = { o: [o[0], o[1]], arms };
    }
    return { faces, gridLines, axes, cube, dim, plane, triad, faceCount: boxFaces.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.az, s.el, s.zoom, s.pan, L, dims, geo, pos, s.parts, s.attrs, s.sel, s.selBody, s.selFace, s.selFilter, s.hover, s.dragPart, s.grid, s.hidden, s.isolated, s.visualStyle, s.section, s.tint]);

  const svgPt = (e: { clientX: number; clientY: number; currentTarget: Element }): [number, number] => { const r = e.currentTarget.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * VB_W, ((e.clientY - r.top) / r.height) * VB_H]; };
  const onPlate = (slot: Slot, p: Pos): Pos => { const ex = prRef.current?.extents[slot]; if (!ex) return p; return { x: clamp(p.x, 0.012 - ex.dx0, L - 0.005 - ex.dx1), y: clamp(p.y, 0.005 - ex.dy0, W - 0.005 - ex.dy1) }; };
  const platePt = (sx: number, sy: number, lift = 0): Pos | null => { const c = prRef.current; return c ? toPlate(c.pr, sx, sy, c.ca, c.sa, plateT + lift) : null; };

  const vpDown = (e: RMouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (s.marking) s.patch({ marking: null });
    const [x, y] = svgPt(e);
    // a press on empty space (the backdrop rect or a grid line, not a body face) that does not turn into a drag clears the selection
    orbit.current = { on: true, pan: e.shiftKey || e.button === 1 || s.navMode === 'pan', start: [x, y, s.az, s.el, s.pan.x, s.pan.y, s.zoom], moved: false, bg: ['svg', 'rect', 'line'].includes((e.target as Element).tagName) };
  };
  const vpMove = (e: RMouseEvent<SVGSVGElement>) => {
    const mv = move.current;
    if (mv) {
      const [x, y] = svgPt(e); const p = platePt(x, y, mv.from.z ?? 0); if (!p) return;
      const next = { ...onPlate(mv.slot, { x: mv.from.x + (p.x - mv.grab.x), y: mv.from.y + (p.y - mv.grab.y) }), z: mv.from.z ?? 0 };
      if (Math.abs(next.x - mv.from.x) + Math.abs(next.y - mv.from.y) > 0.001) mv.moved = true;
      s.moveTo(mv.slot, next);
      return;
    }
    const ob = orbit.current; if (!ob.on) return;
    const [x, y] = svgPt(e); const dx = x - ob.start[0], dy = y - ob.start[1];
    if (Math.abs(dx) + Math.abs(dy) > 3) ob.moved = true;
    if (ob.pan) s.patch({ pan: { x: ob.start[4] + dx, y: ob.start[5] + dy } });
    else if (s.navMode === 'zoom' && !e.shiftKey) s.patch({ zoom: clamp(+(ob.start[6] * Math.exp(-dy * 0.006)).toFixed(2), 0.3, 4) });
    else s.patch({ az: ob.start[2] - dx * 0.008, el: clamp(ob.start[3] + dy * 0.008, -1.55, 1.55) });
  };
  const vpUp = () => {
    const mv = move.current;
    if (mv) { move.current = null; if (mv.moved) { s.commitMove(mv.slot, mv.from); orbit.current.moved = true; setTimeout(() => { orbit.current.moved = false; }, 0); } return; }
    const ob = orbit.current; if (!ob.on) return;
    ob.on = false; ob.pan = false;
    if (!ob.moved && ob.bg && s.sel) s.patch({ sel: null, selBody: null, selFace: null });
    setTimeout(() => { ob.moved = false; }, 0);
  };
  const bodyDown = (body: string) => (e: RMouseEvent<SVGPolygonElement>) => {
    if (e.button !== 0 || e.shiftKey || !isBodyId(body) || body === 'plate' || body === 'flange' || !s.parts[body] || s.viewSeq != null || s.dialog?.kind === 'measure' || s.selFilter === 'face') return;
    const svg = e.currentTarget.ownerSVGElement; if (!svg) return;
    const [x, y] = svgPt({ clientX: e.clientX, clientY: e.clientY, currentTarget: svg });
    const p = platePt(x, y, s.pos[body].z ?? 0); if (!p) return;
    e.stopPropagation();
    move.current = { slot: body, from: { ...s.pos[body] }, grab: p, moved: false };
  };
  const axisDown = (axis: 0 | 1 | 2, dir: [number, number]) => (e: RMouseEvent<SVGElement>) => {
    const slot = s.sel; if (e.button !== 0 || !slot || slot === 'airframe' || !s.parts[slot] || s.viewSeq != null) return;
    e.stopPropagation(); e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement; if (!svg) return;
    const rect = svg.getBoundingClientRect(); const sx = ((e.clientX - rect.left) / rect.width) * VB_W, sy = ((e.clientY - rect.top) / rect.height) * VB_H;
    const from: Pos = { ...s.pos[slot], z: s.pos[slot].z ?? 0 };
    axisMove.current = { slot, axis, from, start: [sx, sy], dir, moved: false };
    const mv = (ev: MouseEvent) => {
      const am = axisMove.current; if (!am) return;
      const mx = ((ev.clientX - rect.left) / rect.width) * VB_W, my = ((ev.clientY - rect.top) / rect.height) * VB_H;
      // metres along the axis = pointer travel projected onto the axis's screen direction, divided by pixels per metre
      const d2 = am.dir[0] * am.dir[0] + am.dir[1] * am.dir[1]; if (d2 < 1) return;
      const tm = ((mx - am.start[0]) * am.dir[0] + (my - am.start[1]) * am.dir[1]) / d2;
      if (Math.abs(tm) > 0.002) am.moved = true;
      const st = useStore.getState();
      const next: Pos = { ...am.from };
      if (am.axis === 0) next.x = am.from.x + tm; else if (am.axis === 1) next.y = am.from.y + tm; else next.z = Math.max(0, Math.min(1.5, (am.from.z ?? 0) + tm));
      const onP = onPlate(am.slot, next);
      st.moveTo(am.slot, { x: onP.x, y: onP.y, z: +(next.z ?? 0).toFixed(3) });
    };
    const up = () => {
      const am = axisMove.current; axisMove.current = null;
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (am && am.moved) { useStore.getState().commitMove(am.slot, am.from); orbit.current.moved = true; setTimeout(() => { orbit.current.moved = false; }, 0); }
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const vpWheel = (e: WheelEvent<SVGSVGElement>) => { s.patch({ zoom: clamp(+(s.zoom * (e.deltaY > 0 ? 1 / 1.08 : 1.08)).toFixed(2), 0.3, 4) }); };
  const cubeDown = (e: RMouseEvent<SVGSVGElement>) => {
    e.stopPropagation(); e.preventDefault();
    cube.current = { on: true, start: [e.clientX, e.clientY, s.az, s.el], moved: false };
    const mv = (ev: MouseEvent) => { const cb = cube.current; if (!cb.on) return; const dx = ev.clientX - cb.start[0], dy = ev.clientY - cb.start[1]; if (Math.abs(dx) + Math.abs(dy) > 3) cb.moved = true; useStore.getState().patch({ az: cb.start[2] - dx * 0.02, el: clamp(cb.start[3] + dy * 0.02, -1.55, 1.55) }); };
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
    const [x, y] = svgPt(e); const p = platePt(x, y);
    const at = p ? { x: clamp(p.x, 0.015, L - 0.045), y: clamp(p.y, 0.01, W - 0.035) } : undefined;
    s.swap(slot, pid, at);
    s.patch({ dragging: false, dragPart: null });
  };
  const snap = (dir: Vec3) => { if (cube.current.moved) return; s.setViewDir(dir); };
  const clickFace = (body: string, fi: number) => { if (orbit.current.moved) return; if (isBodyId(body)) s.pick(body, fi); };
  const onContext = (e: RMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    s.openMarking(e.clientX - r.left, e.clientY - r.top, s.hover);
  };

  const dropSlot = s.dragPart ? CATALOG[s.dragPart].slot : null;
  const dropHint = dropSlot ? 'drop to place in ' + SLOT_LABEL[dropSlot] + (s.parts[dropSlot] && s.parts[dropSlot] !== s.dragPart ? ' · a part_swapped event, unconfirmed until attested' : ' · a part_placed event') : '';
  const mode = s.viewMode;
  const cursor = s.dragging ? 'copy' : move.current ? 'grabbing' : orbit.current.on ? (orbit.current.pan ? 'grabbing' : s.navMode === 'zoom' ? 'ns-resize' : 'move') : s.navMode === 'pan' ? 'grab' : s.navMode === 'zoom' ? 'zoom-in' : 'default';
  const modeBtn = (m: typeof mode, label: string, extra = '') => (
    <button role="radio" aria-checked={mode === m} onClick={() => { if (m === 'sketch') s.openDialog('sketch', 'plate'); else { if (s.dialog?.kind === 'sketch') s.closeDialog(); s.patch({ viewMode: m }); } }} className={'min-h-8 px-[10px] border-0 cursor-pointer text-[13px] font-semibold ' + extra} style={{ background: mode === m ? 'var(--accent)' : 'transparent', color: mode === m ? 'var(--accentfg)' : 'var(--ink)' }}>{label}</button>
  );

  return (
    <div data-panel="viewport" data-cad-workspace="design" className="panel flex-1 flex flex-col min-h-0 relative">
      <div className="flex items-center gap-2 px-3 py-[6px] border-b border-line2 flex-wrap">
        <div role="radiogroup" aria-label="View mode" className="flex border border-line rounded-r overflow-hidden">
          {modeBtn('model', 'Model')}{modeBtn('sketch', 'Sketch', 'border-l border-line')}{modeBtn('board', 'Board', 'border-l border-line')}
        </div>
        <label className="text-[13px] text-muted flex items-center gap-1">select
          <select aria-label="Selection filter" value={s.selFilter} onChange={(e) => s.patch({ selFilter: e.target.value as typeof s.selFilter, selFace: null })} className="btn text-ink">
            <option value="component">components</option><option value="body">bodies</option><option value="face">faces</option>
          </select>
        </label>
        {s.selFilter === 'face' && s.selFace && <span role="status" className="chip normal-case">{BODY_LABEL[s.selFace.body]} · face {s.selFace.fi + 1} · preview index</span>}
        <div className="flex-1" />
        {s.viewSeq != null ? (
          <span className="text-[13px] font-semibold text-amber">replaying #{s.viewSeq} · read-only · <button onClick={() => s.viewAt(null)} className="underline">back to live</button></span>
        ) : (
          <span role="status" className="sr-only">{mode} view</span>
        )}
      </div>
      {mode === 'sketch' && (
        <div className="flex-1 min-h-0 flex">
          <SketchView />
          {s.dialog?.kind === 'sketch' && <FeatureDialog docked />}
        </div>
      )}
      {mode === 'board' && <BoardView />}
      <div ref={canvasRef} onContextMenu={onContext} className="flex-1 min-h-0 items-center justify-center p-2 relative" style={{ display: mode === 'model' ? 'flex' : 'none', background: s.dragging ? 'var(--surface2)' : 'transparent' }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="Orbitable bracket with movable slot bodies"
          onMouseDown={vpDown} onMouseMove={vpMove} onMouseUp={vpUp} onMouseLeave={vpUp} onWheel={vpWheel} onDragOver={vpDragOver} onDrop={vpDrop}
          className="w-full h-full block font-sans select-none" style={{ cursor }}>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="transparent" />
          {scene.gridLines.map((g, i) => <line key={'g' + i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={g.stroke} strokeWidth={g.sw} />)}
          {scene.triad && (() => { const tr = scene.triad; const col = ['#e03131', '#40c057', '#1c3fe0']; return (
            <g aria-label="Move triad: drag an arrow to move the part along that axis" style={{ cursor: 'move' }}>
              {tr.arms.map((a) => { const on = axisHover === a.axis || axisMove.current?.axis === a.axis; const c = col[a.axis]; const ang = Math.atan2(a.hy - a.y2, a.hx - a.x2); const px = Math.cos(ang), py = Math.sin(ang), nx = -py * 5, ny = px * 5; return (
                <g key={a.axis} onMouseDown={axisDown(a.axis, a.dir)} onMouseEnter={() => setAxisHover(a.axis)} onMouseLeave={() => setAxisHover(null)}>
                  <line x1={tr.o[0]} y1={tr.o[1]} x2={a.x2} y2={a.y2} stroke="transparent" strokeWidth="14" />
                  <line x1={tr.o[0]} y1={tr.o[1]} x2={a.x2} y2={a.y2} stroke={c} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
                  <polygon points={`${a.hx},${a.hy} ${a.x2 + nx},${a.y2 + ny} ${a.x2 - nx},${a.y2 - ny}`} fill={c} stroke={on ? 'var(--ink)' : 'none'} strokeWidth="1" />
                  <text x={a.hx + px * 9} y={a.hy + py * 9 + 4} fill={c} fontSize="11" fontFamily="Geist Mono, monospace" fontWeight="700" textAnchor="middle" style={{ pointerEvents: 'none' }}>{a.label}</text>
                </g>
              ); })}
              <circle cx={tr.o[0]} cy={tr.o[1]} r="3.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" style={{ pointerEvents: 'none' }} />
            </g>
          ); })()}
          {scene.axes.map((ax) => (<g key={ax.label}><line x1={ax.x1} y1={ax.y1} x2={ax.x2} y2={ax.y2} stroke="var(--muted)" strokeWidth="1.5" /><text x={ax.tx} y={ax.ty} fill="var(--muted)" fontSize="12" fontFamily="Geist Mono, monospace" textAnchor="middle">{ax.label}</text></g>))}
          {scene.faces.map((f, i) => (
            <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth={f.sw} strokeDasharray={f.dash || undefined} strokeLinejoin="round" data-slot={f.slot} data-body={f.body} data-face={f.fi}
              onMouseDown={bodyDown(f.body)} onClick={() => clickFace(f.body, f.fi)} onMouseEnter={() => { if (isBodyId(f.body)) s.patch({ hover: f.body }); }} onMouseLeave={() => s.patch({ hover: null })}
              style={{ cursor: isBodyId(f.body) && f.body !== 'plate' && f.body !== 'flange' && s.parts[f.body] && s.selFilter !== 'face' ? 'grab' : 'pointer' }} />
          ))}
          {scene.plane && <polygon points={scene.plane} fill="var(--focus)" fillOpacity="0.08" stroke="var(--focus)" strokeWidth="1.2" strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />}
          <line x1={scene.dim.x1} y1={scene.dim.y1} x2={scene.dim.x2} y2={scene.dim.y2} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={scene.dim.tx} y={scene.dim.ty} fill="var(--muted)" fontSize="13" fontFamily="Geist Mono, monospace" textAnchor="middle">{geo.kind === 'wing' ? 'span ' + fmtLen(s.span, s.units) : (geo.kind === 'frame' ? 'frame' : 'plate') + ' L ' + fmtLen(L, s.units)}</text>
          {s.dragging && <text x="380" y="476" fill="var(--ink)" fontSize="14" fontWeight="600" textAnchor="middle">{dropHint}</text>}
        </svg>
        <div className="absolute right-1 top-1 group" onMouseDown={(e) => e.stopPropagation()}>
          <div className="relative w-[200px] h-[200px]">
            <button onClick={() => s.setView('iso')} aria-label="Home view" title="Home" className="tree-btn absolute left-2 top-2 w-6 h-6 text-ink opacity-0 group-hover:opacity-100 transition-opacity"><Home /></button>
            <svg viewBox="0 0 200 200" role="group" aria-label="View cube: drag to orbit; click a face, edge or corner to snap" onMouseDown={cubeDown} className="absolute inset-0 w-[200px] h-[200px] block select-none cursor-grab">
              {/* rotate arrows: 90° to the neighbouring face, and the two roll arcs above */}
              {([
                { k: 'up', pts: '93,24 107,24 100,13', title: 'Rotate up', go: () => s.patch({ el: clamp(s.el + Math.PI / 2, -1.55, 1.55) }) },
                { k: 'down', pts: '93,176 107,176 100,187', title: 'Rotate down', go: () => s.patch({ el: clamp(s.el - Math.PI / 2, -1.55, 1.55) }) },
                { k: 'left', pts: '24,93 24,107 13,100', title: 'Rotate left', go: () => s.patch({ az: s.az - Math.PI / 2 }) },
                { k: 'right', pts: '176,93 176,107 187,100', title: 'Rotate right', go: () => s.patch({ az: s.az + Math.PI / 2 }) },
              ] as { k: string; pts: string; title: string; go: () => void }[]).map((a) => (
                <polygon key={a.k} points={a.pts} className="cube-arrow" onMouseDown={(e) => e.stopPropagation()} onClick={a.go}><title>{a.title}</title></polygon>
              ))}
              <g className="cube-arrow" onMouseDown={(e) => e.stopPropagation()} onClick={() => s.patch({ az: s.az - Math.PI / 4 })}>
                <title>Roll left 45°</title>
                <path d="M 78 30 A 66 66 0 0 0 46 54" fill="none" strokeWidth={4} strokeLinecap="round" />
                <polygon points="40.1,59.9 49.5,57.5 42.5,50.5" />
              </g>
              <g className="cube-arrow" onMouseDown={(e) => e.stopPropagation()} onClick={() => s.patch({ az: s.az + Math.PI / 4 })}>
                <title>Roll right 45°</title>
                <path d="M 122 30 A 66 66 0 0 1 154 54" fill="none" strokeWidth={4} strokeLinecap="round" />
                <polygon points="159.9,59.9 150.5,57.5 157.5,50.5" />
              </g>
              {/* cube tiles: pale faces with grey borders, white grooves edged in grey, white corner discs with a grey ring */}
              {/* the triad is a small gizmo bottom-left, oriented by the camera, never over the cube */}
              {(() => {
                const t = scene.cube.triad;
                const lab = (e: number[]) => { const dx = e[0] - t.o[0], dy = e[1] - t.o[1]; const n = Math.hypot(dx, dy) || 1; return [e[0] + (dx / n) * 8, e[1] + (dy / n) * 8]; };
                const ax = (e: number[], color: string, name: string, op: number) => { const [lx, ly] = lab(e); return (
                  <g key={name} opacity={op} style={{ pointerEvents: 'none' }}>
                    <line x1={t.o[0]} y1={t.o[1]} x2={e[0]} y2={e[1]} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
                    <text x={lx} y={ly} fill={color} fontSize="12" fontWeight="700" fontFamily="Work Sans, system-ui, sans-serif" textAnchor="middle" dominantBaseline="middle">{name}</text>
                  </g>); };
                return <>{ax(t.y, '#40c057', 'Y', t.yBehind ? 0.5 : 0.8)}{ax(t.x, '#e03131', 'X', 0.95)}{ax(t.z, '#1c3fe0', 'Z', 0.95)}</>;
              })()}
              {/* cube tiles: pale faces, a thin grey edge, light grooves between the 3×3 zones, one disc per visible vertex */}
              {scene.cube.faces.map((cf, i) => <polygon key={'f' + i} points={cf.pts} fill={cf.fill} stroke="none" />)}
              {scene.cube.faces.flatMap((cf, i) => cf.grooves.map((ln, j) => <polyline key={'g' + i + '-' + j} points={ln} fill="none" stroke="var(--cube-line)" strokeWidth={1.6} strokeLinecap="butt" />))}
              {scene.cube.faces.map((cf, i) => <polygon key={'fo' + i} points={cf.pts} fill="none" stroke="var(--cube-edge)" strokeWidth={1} strokeLinejoin="round" />)}
              {/* hover highlight: every cell sharing the direction (three at a corner, two along an edge) */}
              {scene.cube.cells.filter((c) => cubeHover === c.key).map((c, i) => <polygon key={'h' + i} points={c.pts} fill="var(--focus)" fillOpacity={0.45} stroke="none" />)}
              {scene.cube.cells.filter((cf) => cf.label).map((cf) => <text key={'t' + cf.label} transform={cf.m} x="0" y="0.02" fill="var(--cube-ink)" fontSize="0.27" fontWeight="600" fontFamily="Work Sans, system-ui, sans-serif" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>{cf.label}</text>)}
              {/* invisible hit areas on top */}
              {scene.cube.cells.map((c, i) => <polygon key={'c' + i} points={c.pts} fill="transparent" stroke="none" onMouseEnter={() => setCubeHover(c.key)} onMouseLeave={() => setCubeHover(null)} onClick={() => snap(c.dir)} className="cursor-pointer"><title>{c.label ? c.label + ' view' : c.kind === 'edge' ? 'edge view' : 'corner view'}</title></polygon>)}
            </svg>
            <button onClick={() => setCubeMenu((v) => !v)} aria-haspopup="menu" aria-expanded={cubeMenu} aria-label="View options" className="tree-btn absolute right-3 bottom-3 w-[46px] h-6 max-sm:h-11 max-sm:w-14 max-sm:bottom-1 text-ink flex items-center gap-1 justify-center">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><polygon points="12,3 21,7.5 12,12 3,7.5" fill="var(--cube-top)" stroke="var(--cube-ink)" strokeWidth="1" strokeLinejoin="round" /><polygon points="3,7.5 12,12 12,21 3,16.5" fill="var(--cube)" stroke="var(--cube-ink)" strokeWidth="1" strokeLinejoin="round" /><polygon points="21,7.5 12,12 12,21 21,16.5" fill="var(--cube)" stroke="var(--cube-ink)" strokeWidth="1" strokeLinejoin="round" /></svg>
              <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><polygon points="0,0 10,0 5,6" fill="currentColor" /></svg>
            </button>
            {cubeMenu && <div className="fixed inset-0 z-[19]" onMouseDown={(e) => { e.stopPropagation(); setCubeMenu(false); }} />}
            {cubeMenu && (
              <div role="menu" className="absolute right-3 top-[176px] panel py-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,.14)] z-20 text-[13px]">
                {[
                  { label: 'Go home', go: () => s.setView('iso') },
                  { label: 'Fit to view', go: () => s.fit() },
                ].map((it) => <button key={it.label} role="menuitem" className="tree-row px-2" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} onClick={() => { it.go(); setCubeMenu(false); }}>{it.label}</button>)}
                <div className="border-t border-line2 my-1" />
                {FACE_DEFS.map((f) => <button key={f.label} role="menuitem" className="tree-row px-2" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} onClick={() => { s.setViewDir(f.n); setCubeMenu(false); }}>{f.label}</button>)}
              </div>
            )}
          </div>
        </div>
        <div className="absolute left-1/2 bottom-3 -translate-x-1/2 z-[20] flex items-center gap-[2px] px-1 py-[3px] bg-surface border border-line rounded-r shadow-[0_2px_8px_rgba(0,0,0,.08)]" onMouseDown={(e) => e.stopPropagation()}>
          <button className="nav-btn" aria-pressed={s.navMode === 'orbit'} title="Orbit (drag)" onClick={() => s.patch({ navMode: 'orbit' })}><Orbit /></button>
          <button className="nav-btn" aria-pressed={s.navMode === 'pan'} title="Pan (drag · or shift-drag)" onClick={() => s.patch({ navMode: 'pan' })}><Pan /></button>
          <button className="nav-btn" aria-pressed={s.navMode === 'zoom'} title="Zoom (drag up/down · or wheel)" onClick={() => s.patch({ navMode: 'zoom' })}><Zoom /></button>
          <span className="w-px h-5 bg-line2 mx-1" />
          <button className="nav-btn" title="Fit" onClick={() => s.fit()}><Fit /></button>
          <span className="w-px h-5 bg-line2 mx-1" />
          <div className="relative">
            <button className="nav-btn" aria-expanded={dispOpen} title="Display settings" onClick={() => setDispOpen((v) => !v)}><Display /><span className="text-[12px] text-muted">{Math.round(s.zoom * 100)}%</span></button>
            {dispOpen && createPortal(<div className="fixed inset-0 z-[19]" onMouseDown={(e) => { e.stopPropagation(); setDispOpen(false); }} />, document.body)}
            {dispOpen && (
              <div role="menu" className="absolute z-[20] bottom-[38px] left-0 w-[220px] bg-surface border border-line rounded-r shadow-[0_8px_24px_rgba(0,0,0,.14)] py-1 text-[13px]">
                <div className="px-3 pt-1 pb-[2px] text-[12px] text-muted">Visual style</div>
                {(['shaded', 'edges', 'wireframe'] as const).map((v) => (
                  <button key={v} role="menuitemradio" aria-checked={s.visualStyle === v} onClick={() => s.patch({ visualStyle: v })} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer">
                    <span className="text-ink">{s.visualStyle === v ? <Check /> : null}</span>{v === 'shaded' ? 'Shaded' : v === 'edges' ? 'Shaded with visible edges' : 'Wireframe'}
                  </button>
                ))}
                <div className="border-t border-line2 my-1" />
                <button role="menuitemcheckbox" aria-checked={s.grid} onClick={() => s.patch({ grid: !s.grid })} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer"><span>{s.grid ? <Check /> : null}</span><span className="inline-flex items-center gap-2"><GridIcon /> Layout grid</span></button>
                <button role="menuitemcheckbox" aria-checked={s.section.on} onClick={() => { s.patch({ section: { ...s.section, on: !s.section.on } }); if (!s.section.on) s.openDialog('section', null); }} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer"><span>{s.section.on ? <Check /> : null}</span><span>Section analysis</span></button>
                <div className="border-t border-line2 my-1" />
                <button onClick={() => { s.setView('iso'); setDispOpen(false); }} className="row-hover w-full text-left px-3 min-h-7 grid grid-cols-[16px_1fr] gap-2 items-center bg-transparent border-0 text-ink cursor-pointer"><span /><span>Reset camera · home</span></button>
              </div>
            )}
          </div>
        </div>
        <MarkingMenu />
      </div>
      {!(mode === 'sketch' && s.dialog?.kind === 'sketch') && <FeatureDialog />}
    </div>
  );
}
