// Builds the bodies the viewport, dialogs and measure tool all read from one
// design state, so a preview (dialog live-edit) and the committed design use
// the same construction.
import { CATALOG, SLOTS, type Dims, type PartId, type Slot } from './catalog';
import type { Geo, Positions } from './design';
import { boxFaces, cylAlongX, discX, discZ, discZd, emptySolid, indexFaces, partSolid, plateOutline, prismFaces, solidBounds, type Face, type Solid, type Vec3 } from './geometry';
import type { Attrs, Parts } from './rules';
import { HOLE_INSET_X, HOLE_INSET_Y } from './sketch';

/** The plate length and width come from the geometry, not from the wing span. */
export interface SceneInput { dims: Dims; geo: Geo; parts: Parts; attrs: Attrs; pos: Positions; /** wing span, m, for a wing-kind airframe */ span?: number }
/** Kestrel's default span when a caller has none. */
export const WING_SPAN_DEFAULT = 1.8;
export type BodyKey = Slot | 'plate' | 'flange';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Flange sheet thickness, m (same 6 mm stock as the plate). */
export const FLANGE_T = 0.006;

/** Where a frame kit carries its motors: pad centres and pad top height, frame-local metres. */
function frameMounts(pid: PartId): { tips: [number, number][]; padZ: number } {
  // Chimera7 Pro V2: 327 mm wheelbase, arms at atan2(199, 270) from the stack centre, motor pads 9 mm plus 2 mm up
  void pid;
  const cx0 = 0.135, cy0 = 0.0995, ang = Math.atan2(199, 270), r = 0.1635;
  return { tips: [ang, Math.PI - ang, Math.PI + ang, -ang].map((a) => [cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r] as [number, number]), padZ: 0.011 };
}
/** The height a part is drawn at when it is not the slot's default part. */
const PART_H: Partial<Record<PartId, number>> = { f60prov: 0.0317, hq7035: 0.0067 };

/** Frame-kind airframe: the frame is the body, no plate, no flange; motors and props repeat on every arm pad. */
function buildFrameBodies(d: SceneInput, frame: PartId): Record<BodyKey, Solid> {
  const fh = d.dims.frame;
  const kit = partSolid(frame, 'frame', 0, 0, 0, d.dims, fh);
  const plate = indexFaces({ slot: 'airframe', faces: kit.faces.map((f) => ({ ...f, slot: 'airframe' })), c: kit.c }, 'plate');
  const flange = indexFaces({ slot: 'airframe', faces: [], c: [0, 0, 0] }, 'flange');
  const out = { plate, flange } as Record<BodyKey, Solid>;
  const { tips, padZ } = frameMounts(frame);
  const motorH = d.parts.motor ? PART_H[d.parts.motor] ?? d.dims.motor : d.dims.motor;
  for (const slot of SLOTS) {
    const pid = d.parts[slot];
    if (slot === 'motor' || slot === 'prop') {
      // one body, four instances: centred on each arm pad, props on top of the motors
      const z = slot === 'motor' ? padZ : padZ + motorH;
      const h = pid ? PART_H[pid] ?? d.dims[slot] : d.dims[slot];
      let faces: Face[] = [];
      for (const [tx, ty] of tips) {
        if (!pid) { faces = faces.concat(emptySolid(slot, tx - 0.015, ty - 0.015, z, d.dims).faces); continue; }
        const probe = solidBounds(partSolid(pid, slot, 0, 0, 0, d.dims, h));
        const ax = (probe.minx + probe.maxx) / 2, ay = (probe.miny + probe.maxy) / 2;
        faces = faces.concat(partSolid(pid, slot, tx - ax, ty - ay, z, d.dims, h).faces);
      }
      out[slot] = indexFaces({ slot, faces, c: [0.135, 0.0995, z + h / 2] }, slot);
      continue;
    }
    const { x, y } = d.pos[slot];
    const z = d.pos[slot].z ?? 0;
    if (!pid) { out[slot] = indexFaces(emptySolid(slot, x, y, z, d.dims), slot); continue; }
    out[slot] = indexFaces(partSolid(pid, slot, x, y, z, d.dims, PART_H[pid] ?? d.dims[slot]), slot);
  }
  return out;
}

/** A polygon with its outward normal (Newell), flipped toward the hint so winding never hides a face. */
function poly(pts: Vec3[], hint: Vec3, fill: string): Face {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const len = Math.hypot(nx, ny, nz) || 1;
  let n: Vec3 = [nx / len, ny / len, nz / len];
  if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = [-n[0], -n[1], -n[2]];
  return { pts, n, slot: 'airframe', fill };
}

/** Wing-kind airframe: the plate is the floor of the centre body; the shell is a blended flying wing built around it, hatch removed so the bay shows. */
function wingShell(L: number, W: number, T: number, wallH: number, span: number): Face[] {
  const SKIN = '#e4e8ee', CARBON = '#2b3038', ELEVON = '#cdd3db', panel = Math.max(0.25, (span - W) / 2);
  const H = T + wallH; // top of the body, where the wing root blends in
  const lean = 0.04; // the walls lean inward toward the hatch opening
  const out: Face[] = [];
  const add = (...fs: Face[]) => { out.push(...fs); };
  // centre body: leaning side walls and the rear bulkhead, standing on the floor plate
  add(poly([[0, 0, T], [L, 0, T], [L, lean, H], [0, lean, H]], [0, -1, 0.4], SKIN));
  add(poly([[0, W, T], [0, W - lean, H], [L, W - lean, H], [L, W, T]], [0, 1, 0.4], SKIN));
  add(poly([[L, 0, T], [L, W, T], [L, W - lean, H], [L, lean, H]], [1, 0, 0.3], SKIN));
  // hatch rim: a thin lip around the opening
  add(poly([[0, lean, H], [L, lean, H], [L, lean + 0.008, H], [0, lean + 0.008, H]], [0, 0, 1], CARBON));
  add(poly([[0, W - lean, H], [0, W - lean - 0.008, H], [L, W - lean - 0.008, H], [L, W - lean, H]], [0, 0, 1], CARBON));
  // nose: a two-segment loft from the front bulkhead section, through a mid section, down to a small rounded tip
  type Sec = { x: number; y0: number; y1: number; z0: number; z1: number; lean: number };
  const secs: Sec[] = [
    { x: 0, y0: 0, y1: W, z0: 0, z1: H, lean },
    { x: -0.13, y0: 0.045, y1: W - 0.045, z0: 0.004, z1: H - 0.014, lean: 0.03 },
    { x: -0.25, y0: W / 2 - 0.035, y1: W / 2 + 0.035, z0: 0.012, z1: 0.036, lean: 0.012 },
  ];
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i], b = secs[i + 1];
    add(poly([[a.x, a.y0, a.z0], [b.x, b.y0, b.z0], [b.x, b.y1, b.z0], [a.x, a.y1, a.z0]], [0, 0, -1], SKIN));
    add(poly([[a.x, a.y0 + a.lean, a.z1], [a.x, a.y1 - a.lean, a.z1], [b.x, b.y1 - b.lean, b.z1], [b.x, b.y0 + b.lean, b.z1]], [0, 0, 1], SKIN));
    add(poly([[a.x, a.y0, a.z0], [a.x, a.y0 + a.lean, a.z1], [b.x, b.y0 + b.lean, b.z1], [b.x, b.y0, b.z0]], [-0.2, -1, 0], SKIN));
    add(poly([[a.x, a.y1, a.z0], [b.x, b.y1, b.z0], [b.x, b.y1 - b.lean, b.z1], [a.x, a.y1 - a.lean, a.z1]], [-0.2, 1, 0], SKIN));
  }
  const tip = secs[secs.length - 1];
  add(poly([[tip.x, tip.y0, tip.z0], [tip.x, tip.y0 + tip.lean, tip.z1], [tip.x, tip.y1 - tip.lean, tip.z1], [tip.x, tip.y1, tip.z0]], [-1, 0, 0], CARBON));
  // wing panels: root chord the body length, swept and tapered to the tip, thick at the root and thin at the tip
  const le0 = 0.0, te0 = L, leT = 0.30, teT = L - 0.02;
  const zTopRoot = H, zBotRoot = 0, zTopTip = 0.034, zBotTip = 0.02;
  const wing = (side: -1 | 1) => {
    const y0 = side < 0 ? 0 : W, y1 = side < 0 ? -panel : W + panel;
    const top: Vec3[] = [[le0, y0, zTopRoot], [te0, y0, zTopRoot], [teT, y1, zTopTip], [leT, y1, zTopTip]];
    const bot: Vec3[] = [[le0, y0, zBotRoot], [leT, y1, zBotTip], [teT, y1, zBotTip], [te0, y0, zBotRoot]];
    add(poly(top, [0, 0, 1], SKIN), poly(bot, [0, 0, -1], SKIN));
    // leading edge as two bevels meeting at mid-height, carbon like a real LE strip
    const mid: Vec3[] = [[le0 - 0.03, y0, (zTopRoot + zBotRoot) / 2], [leT - 0.012, y1, (zTopTip + zBotTip) / 2]];
    add(poly([[le0, y0, zTopRoot], [leT, y1, zTopTip], mid[1], mid[0]], [-1, 0, 0.6], CARBON));
    add(poly([[le0, y0, zBotRoot], mid[0], mid[1], [leT, y1, zBotTip]], [-1, 0, -0.6], CARBON));
    // trailing edge and tip
    add(poly([[te0, y0, zTopRoot], [te0, y0, zBotRoot], [teT, y1, zBotTip], [teT, y1, zTopTip]], [1, 0, 0], SKIN));
    add(poly([[leT, y1, zTopTip], [teT, y1, zTopTip], [teT, y1, zBotTip], [leT, y1, zBotTip]], [0, side, 0], SKIN));
    // elevon: the rear fifth of the panel, a hair above the skin
    const ex0 = teT - 0.1, yi = side < 0 ? y0 - 0.04 : y0 + 0.04, yo = side < 0 ? y1 + 0.04 : y1 - 0.04;
    const zi = zTopRoot - (zTopRoot - zTopTip) * (0.04 / panel) + 0.0006, zo = zTopTip + (zTopRoot - zTopTip) * (0.04 / panel) + 0.0006;
    add(poly([[ex0, yi, zi], [te0 - 0.004, yi, zi], [teT - 0.004, yo, zo], [ex0 - 0.03, yo, zo]], [0, 0, 1], ELEVON));
    // winglet: a swept fin at the tip, thin
    const wy = side < 0 ? y1 - 0.004 : y1 + 0.004;
    const fin: Vec3[] = [[leT + 0.02, wy, zTopTip], [teT, wy, zTopTip], [teT - 0.015, wy, zTopTip + 0.1], [leT + 0.09, wy, zTopTip + 0.1]];
    const finIn: Vec3[] = fin.map((q) => [q[0], y1, q[2]] as Vec3);
    add(poly(fin, [0, side, 0], CARBON), poly(finIn.slice().reverse(), [0, -side, 0], CARBON));
    add(poly([fin[3], fin[2], finIn[2], finIn[3]], [0, 0, 1], CARBON), poly([fin[0], finIn[0], finIn[3], fin[3]], [-1, 0, 0], CARBON), poly([fin[1], fin[2], finIn[2], finIn[1]], [1, 0, 0], CARBON));
  };
  wing(-1); wing(1);
  // pusher motor on the rear bulkhead with a folding prop
  add(...cylAlongX(L, W / 2, 0.034, 0.017, 0.04, 'airframe', 12, CARBON).map((f) => ({ ...f, slot: 'airframe' })));
  add(...boxFaces(L + 0.04, W / 2 - 0.005, 0.029, 0.01, 0.01, 0.01, 'airframe', '#c8ccd2'));
  add(...boxFaces(L + 0.043, W / 2 + 0.006, 0.033, 0.006, 0.14, 0.002, 'airframe', CARBON), ...boxFaces(L + 0.043, W / 2 - 0.146, 0.033, 0.006, 0.14, 0.002, 'airframe', CARBON));
  return out;
}

export function buildBodies(d: SceneInput): Record<BodyKey, Solid> {
  if (d.geo.kind === 'frame' && d.geo.frame) return buildFrameBodies(d, d.geo.frame);
  const L = d.geo.plateL, W = d.geo.plateW, T = d.geo.plateT;
  const r = d.geo.holeD / 2;
  const ix = HOLE_INSET_X, iy = HOLE_INSET_Y;
  const plate: Solid = indexFaces({
    slot: 'airframe',
    faces: prismFaces(plateOutline(L, W, d.geo.fillet, d.geo.chamfer), 0, T, 'airframe')
      .concat(([[ix, iy], [L - ix, iy], [ix, W - iy], [L - ix, W - iy]] as [number, number][]).flatMap(([x, y]) => [discZ(x, y, T, r, 'airframe', 'var(--m3)'), discZd(x, y, 0, r, 'airframe', 'var(--m1)')])),
    c: [L / 2, W / 2, T / 2],
  }, 'plate');
  if (d.geo.kind === 'wing') plate.faces = plate.faces.concat(indexFaces({ slot: 'airframe', faces: wingShell(L, W, T, d.dims.airframe, d.span ?? WING_SPAN_DEFAULT) }, 'plate').faces.map((f, i) => ({ ...f, fi: plate.faces.length + i })));
  const flange: Solid = indexFaces({
    slot: 'airframe',
    faces: boxFaces(0, 0, T, FLANGE_T, W, d.dims.airframe, 'airframe').concat(([[0.035, T + 0.03], [W - 0.035, T + 0.03]] as [number, number][]).flatMap(([y, z]) => [discX(FLANGE_T, y, z, r, 1, 'airframe', 'var(--m2)'), discX(0, y, z, r, -1, 'airframe', 'var(--m2)')])),
    c: [FLANGE_T / 2, W / 2, T + d.dims.airframe / 2],
  }, 'flange');
  const out = { plate, flange } as Record<BodyKey, Solid>;
  for (const slot of SLOTS) {
    const pid = d.parts[slot];
    const { x, y } = d.pos[slot];
    const z = T + (d.pos[slot].z ?? 0);
    if (!pid) { out[slot] = indexFaces(emptySolid(slot, x, y, T, d.dims), slot); continue; }
    const a = d.attrs[slot], tpl = CATALOG[pid].attrs;
    let h = d.dims[slot], fs = 1;
    if (slot === 'battery' && a.pack_wh && tpl.pack_wh) h = d.dims.battery * clamp(a.pack_wh / tpl.pack_wh, 0.5, 2.5);
    if (slot === 'thermal' && a.elements && tpl.elements) fs = clamp(Math.sqrt(a.elements / tpl.elements), 0.6, 2);
    out[slot] = indexFaces(partSolid(pid, slot, x, y, z, d.dims, h, fs), slot);
  }
  return out;
}
