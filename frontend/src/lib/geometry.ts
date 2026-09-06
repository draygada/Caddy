// Flat-shaded axonometric projection of the Kestrel bracket and its slot
// bodies. This is a derived preview drawn as SVG polygons; it is not geometry
// truth and cannot commit or export anything.
import { CATALOG, DIMS0, type Dims, type Node, type PartId, type Slot } from './catalog';

export type Vec3 = [number, number, number];
export interface Face { pts: Vec3[]; n: Vec3; slot: string; fill?: string; late?: boolean; /** stable-within-solid face index */ fi?: number; /** body id for body-level selection (plate / flange / slot) */ body?: string; /** produced by a section cut */ cut?: boolean }
export interface Solid { slot: string; faces: Face[]; c?: Vec3; pid?: PartId }
export interface Projector {
  ox: number;
  oy: number;
  U: number;
  se: number;
  ce: number;
  pt: (x: number, y: number, z: number) => [number, number];
  depth: (x: number, y: number, z: number) => number;
  view: Vec3;
  ca: number;
  sa: number;
}
export interface ProjectedFace { pts: string; fill: string; d: number; slot: string; fi: number; body: string; cut: boolean }
export interface ThumbFace { pts: string; fill: string; stroke: string; dash: string }

export const K = 1.2247;

export function proj(a: number, e: number, U: number, ox: number, oy: number): Projector {
  const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
  return {
    ox, oy, U, se, ce,
    pt: (x, y, z) => [ox + (x * ca - y * sa) * U * K, oy + ((x * sa + y * ca) * se - z * ce) * U * K],
    depth: (x, y, z) => (x * sa + y * ca) * ce + z * se,
    view: [sa * ce, ca * ce, se],
    ca,
    sa,
  };
}

export function boxFaces(x: number, y: number, z: number, dx: number, dy: number, dz: number, slot: string, fill?: string): Face[] {
  const x1 = x + dx, y1 = y + dy, z1 = z + dz;
  return [
    { pts: [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], n: [0, 0, 1], slot, fill },
    { pts: [[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]], n: [0, 0, -1], slot, fill },
    { pts: [[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]], n: [0, -1, 0], slot, fill },
    { pts: [[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], n: [0, 1, 0], slot, fill },
    { pts: [[x, y, z], [x, y1, z], [x, y1, z1], [x, y, z1]], n: [-1, 0, 0], slot, fill },
    { pts: [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], n: [1, 0, 0], slot, fill },
  ];
}

export function cylFaces(cx: number, cy: number, z: number, r: number, h: number, slot: string, N = 20, fill?: string): Face[] {
  const f: Face[] = [];
  const ring = (zz: number): Vec3[] => Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t), zz]; });
  const top = ring(z + h), bot = ring(z);
  f.push({ pts: top, n: [0, 0, 1], slot, fill });
  f.push({ pts: bot, n: [0, 0, -1], slot, fill });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; const tm = ((i + 0.5) / N) * Math.PI * 2;
    f.push({ pts: [bot[i], bot[j], top[j], top[i]], n: [Math.cos(tm), Math.sin(tm), 0], slot, fill });
  }
  return f;
}

/** Cylinder whose axis runs along +X from x0 (centre cy, cz). */
export function cylAlongX(x0: number, cy: number, cz: number, r: number, len: number, slot: string, N = 12, fill?: string): Face[] {
  const f: Face[] = [];
  const ring = (xx: number): Vec3[] => Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [xx, cy + r * Math.cos(t), cz + r * Math.sin(t)]; });
  const a = ring(x0), b = ring(x0 + len);
  f.push({ pts: b, n: [1, 0, 0], slot, fill });
  f.push({ pts: a, n: [-1, 0, 0], slot, fill });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; const tm = ((i + 0.5) / N) * Math.PI * 2;
    f.push({ pts: [a[i], a[j], b[j], b[i]], n: [0, Math.cos(tm), Math.sin(tm)], slot, fill });
  }
  return f;
}

/** Cylinder whose axis runs along +Y from y0 (centre cx, cz). */
export function cylAlongY(cx: number, y0: number, cz: number, r: number, len: number, slot: string, N = 12, fill?: string): Face[] {
  const f: Face[] = [];
  const ring = (yy: number): Vec3[] => Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [cx + r * Math.cos(t), yy, cz + r * Math.sin(t)]; });
  const a = ring(y0), b = ring(y0 + len);
  f.push({ pts: b, n: [0, 1, 0], slot, fill });
  f.push({ pts: a, n: [0, -1, 0], slot, fill });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; const tm = ((i + 0.5) / N) * Math.PI * 2;
    f.push({ pts: [a[i], a[j], b[j], b[i]], n: [Math.cos(tm), 0, Math.sin(tm)], slot, fill });
  }
  return f;
}

const ringZ = (cx: number, cy: number, z: number, r: number, N: number): Vec3[] =>
  Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t), z]; });

export function discZ(cx: number, cy: number, z: number, r: number, slot: string, fill: string, N = 12): Face {
  return { pts: ringZ(cx, cy, z, r, N), n: [0, 0, 1], slot, fill, late: true };
}
export function discZd(cx: number, cy: number, z: number, r: number, slot: string, fill: string, N = 12): Face {
  return { pts: ringZ(cx, cy, z, r, N), n: [0, 0, -1], slot, fill, late: true };
}
export function discX(x: number, cy: number, cz: number, r: number, nx: number, slot: string, fill: string, N = 12): Face {
  const pts: Vec3[] = Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [x, cy + r * Math.cos(t), cz + r * Math.sin(t)]; });
  return { pts, n: [nx, 0, 0], slot, fill, late: true };
}

/** Darken a #rrggbb colour by factor k (1 = unchanged). */
export function shadeHex(hex: string, k: number): string {
  if (k >= 1 || hex.length !== 7) return hex;
  const v = parseInt(hex.slice(1), 16);
  const r = Math.round(((v >> 16) & 255) * k), g = Math.round(((v >> 8) & 255) * k), b = Math.round((v & 255) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Back-face cull, depth sort, flat fill by facing. `deco` adds per-face view props (selection stroke, handlers). */
export function renderSolid<T extends object = Record<never, never>>(
  solid: Solid, pr: Projector, deco?: (slot: string, f: Face) => T,
): (ProjectedFace & T)[] {
  const out: (ProjectedFace & T)[] = [];
  for (const f of solid.faces) {
    const dot = f.n[0] * pr.view[0] + f.n[1] * pr.view[1] + f.n[2] * pr.view[2];
    if (dot <= 0.02) continue;
    let d = f.pts.reduce((s, p) => s + pr.depth(p[0], p[1], p[2]), 0) / f.pts.length;
    if (f.late) d += 100;
    const nx = f.n[0] * pr.ca - f.n[1] * pr.sa;
    // theme greys shade by facing through three tokens; a literal colour is shaded the same way in place
    const k = f.n[2] > 0.5 ? 1 : f.n[2] < -0.5 ? 0.62 : nx < 0 ? 0.86 : 0.72;
    const fill = f.fill ? (f.fill.startsWith('#') ? shadeHex(f.fill, k) : f.fill) : (f.n[2] > 0.5 ? 'var(--m1)' : f.n[2] < -0.5 ? 'var(--m3)' : nx < 0 ? 'var(--m2)' : 'var(--m3)');
    const base: ProjectedFace = { pts: f.pts.map((p) => pr.pt(p[0], p[1], p[2]).map((v) => v.toFixed(1)).join(',')).join(' '), fill, d, slot: solid.slot, fi: f.fi ?? -1, body: f.body ?? solid.slot, cut: !!f.cut };
    out.push(Object.assign(base, deco ? deco(solid.slot, f) : ({} as T)));
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

/** Footprint of the slot's default part in metres (the published envelope in the CATALOG comments); drawn as a dashed outline when the slot is empty. */
const FOOTPRINT: Record<string, [number, number]> = {
  battery: [0.222, 0.09], imu: [0.0254, 0.0254], fc: [0.0848, 0.044], thermal: [0.025, 0.025], gnss: [0.025, 0.045], datalink: [0.027, 0.033], pod: [0.12, 0.12],
  camera: [0.038, 0.038], lidar: [0.043, 0.03], esc: [0.0885, 0.0366], motor: [0.09, 0.0814], servo: [0.024, 0.012], airspeed: [0.16, 0.012], transponder: [0.047, 0.054], companion: [0.1, 0.079], antenna: [0.114, 0.114], parachute: [0.099, 0.099],
  frame: [0.27, 0.199], prop: [0.178, 0.178],
};

/** Dashed outline of the slot footprint when no part is placed. */
export function emptySolid(slot: Slot, x: number, y: number, z: number, dims: Dims): Solid {
  const h = dims[slot];
  const fp = FOOTPRINT[slot] || [0.06, 0.04];
  // the thermal core is positioned by its centre; every other slot by its near corner
  const ox = slot === 'thermal' ? x - fp[0] / 2 : x, oy = slot === 'thermal' ? y - fp[1] / 2 : y;
  return { slot, faces: boxFaces(ox, oy, z, fp[0], fp[1], h, slot, 'none'), c: [ox + fp[0] / 2, oy + fp[1] / 2, z + h / 2] };
}

/** Axis-aligned extent of a solid's footprint in plate coordinates. */
export function solidBounds(solid: Solid): { minx: number; maxx: number; miny: number; maxy: number } {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const f of solid.faces) for (const p of f.pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  return { minx, maxx, miny, maxy };
}

/**
 * Build a part body at plate position (x, y), in metres at the published envelope (see the CATALOG comments for each source).
 * `h` overrides the slot height (spec-driven extrude); `fs` scales the footprint about (x, y) so a bigger sensor reads as a bigger body.
 */
export function partSolid(pid: PartId, slot: Slot, x: number, y: number, z: number, dims: Dims, h = dims[slot], fs = 1): Solid {
  let faces: Face[] = [];
  let c: Vec3;
  const M1 = 'var(--m1)', M2 = 'var(--m2)', M3 = 'var(--m3)';
  const PCB = '#2f6b3a', BLACK = '#1b1f26', GOLD = '#c9a227', ALU = '#c8ccd2', JST = '#e6e2d6', RED = '#d94b3d', GREEN = '#3b9d5a';
  const box = (bx: number, by: number, bz: number, dx: number, dy: number, dz: number, fill?: string) => boxFaces(x + bx, y + by, z + bz, dx, dy, dz, slot, fill);
  const cyl = (cx: number, cy: number, cz: number, r: number, hh: number, N = 14, fill?: string) => cylFaces(x + cx, y + cy, z + cz, r, hh, slot, N, fill);
  const cx_ = (bx: number, cy: number, cz: number, r: number, len: number, N = 12, fill?: string) => cylAlongX(x + bx, y + cy, z + cz, r, len, slot, N, fill);
  const cy_ = (cx: number, by: number, cz: number, r: number, len: number, N = 12, fill?: string) => cylAlongY(x + cx, y + by, z + cz, r, len, slot, N, fill);
  const holes = (pts: [number, number][], hz: number, r = 0.0015) => pts.map(([hx, hy]) => discZ(x + hx, y + hy, z + hz, r, slot, M3));
  /** the four holes of a rectangular pattern `w` x `d` centred at (cx, cy) */
  const pattern = (cx: number, cy: number, w: number, d: number): [number, number][] => [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx - w / 2, cy + d / 2], [cx + w / 2, cy + d / 2]];
  /** Prism from a local counter-clockwise outline rotated by `ang` about (cx, cy), for arms and blades that do not lie on the axes. */
  const turned = (outline: [number, number][], cx: number, cy: number, ang: number, z0: number, z1: number, fill: string) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pts = outline.map(([px, py]) => [x + cx + px * ca - py * sa, y + cy + px * sa + py * ca] as [number, number]);
    return prismFaces(pts, z + z0, z + z1, slot).map((f) => ({ ...f, fill }));
  };
  /** JST-GH style connector row along a board edge: `n` housings of 8.3 x 4.5 x 4 mm from (x0, y0) stepping `pitch` along X */
  const jstRow = (x0: number, y0: number, z0: number, n: number, pitch: number, dy = 0.0045, dz = 0.004) => { for (let i = 0; i < n; i++) faces = faces.concat(box(x0 + i * pitch, y0, z0, 0.0083, dy, dz, JST)); };
  switch (pid) {
    case 'p45b': {
      // 24 x INR21700-P45B (21.55 mm dia x 70.15 mm) as two layers of 3 x 4 lying along X: 222 x 90 x 48 mm; nickel strips at the cell ends, XT90 and balance lead on the +X end
      const cr = Math.max(0.006, (h - 0.005) / 4), seg = 0.07015;
      faces = box(0, 0, 0, 0.222, 0.09, 0.002, M3);
      for (const layer of [0, 1]) for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) faces = faces.concat(cx_(0.004 + col * (seg + 0.002), 0.0115 + row * 0.0225, 0.002 + cr + layer * cr * 2, cr, seg, 10));
      faces = faces.concat(box(0, 0.002, 0.002, 0.003, 0.086, cr * 4, M3), box(0.219, 0.002, 0.002, 0.003, 0.086, cr * 4, M3));
      for (const col of [0.0745, 0.1465]) faces = faces.concat(box(col - 0.0015, 0.004, 0.002 + cr * 4, 0.003, 0.082, 0.001, M3));
      faces = faces.concat(box(0.004, 0.004, 0.002 + cr * 4, 0.214, 0.082, 0.0015, M1), box(0.222, 0.03, 0.01, 0.016, 0.012, 0.012, GOLD), box(0.222, 0.055, 0.012, 0.012, 0.006, 0.004, M3));
      c = [x + 0.111, y + 0.045, z + h / 2]; break;
    }
    case 'amprius': {
      // 36 x SA08 pouches (144.5 x 52 x 6.25 mm) in four stacks of nine lying flat, tabs at the stack ends, a BMS board and XT90 on top: 289 x 104 x 70 mm
      const t = Math.max(0.003, (h - 0.014) / 9), H = t * 9;
      faces = box(0, 0, 0, 0.289, 0.104, 0.0015, M3);
      for (const sx of [0, 0.1445]) for (const sy of [0, 0.052]) for (let i = 0; i < 9; i++) faces = faces.concat(box(sx + 0.0005, sy + 0.0005, 0.0015 + i * t, 0.1435, 0.051, t * 0.9, i % 2 ? M1 : M2), box(sx + (sx ? 0.1435 : -0.004), sy + 0.015 + (i % 2) * 0.016, 0.0015 + i * t + t * 0.3, 0.005, 0.008, 0.0004, M3));
      faces = faces.concat(box(0, 0, 0.0015 + H, 0.289, 0.104, 0.002, M3), box(0.02, 0.02, 0.0035 + H, 0.06, 0.04, 0.006, PCB), box(0.289, 0.04, 0.02, 0.016, 0.012, 0.012, GOLD));
      c = [x + 0.1445, y + 0.052, z + h / 2]; break;
    }
    case 'lepton': {
      // Lepton 3.5 (10.5 x 12.7 x 7.14 mm) with its shutter housing, socketed on a 25 x 25 mm breakout; positioned by its centre
      const k = h / 0.012;
      faces = box(-0.0125, -0.0125, 0, 0.025, 0.025, 0.0016, PCB).concat(holes(pattern(0, 0, 0.021, 0.021), 0.0016, 0.001));
      faces = faces.concat(box(-0.007, -0.0075, 0.0016, 0.014, 0.015, 0.002, M3), box(-0.00525, -0.00635, 0.0036, 0.0105, 0.0127, 0.0055 * k, M2), box(-0.00525, -0.00635, 0.0036 + 0.0055 * k, 0.0105, 0.006, 0.0015 * k, M3));
      faces = faces.concat(cyl(0, 0.002, 0.0036 + 0.0055 * k, 0.0025, 0.002 * k, 10, M3), cyl(0, 0.002, 0.0036 + 0.0075 * k, 0.0015, 0.0004, 8, BLACK), box(-0.0125, 0.009, 0.0016, 0.008, 0.003, 0.002, M3));
      c = [x, y, z + h * 0.5]; break;
    }
    case 'boson': {
      // Boson 640 core (21 x 21 x 11 mm body) with the stepped 14 mm lens barrel forward along +X and the rear connector; positioned by its centre
      const k = h / 0.012, H = 0.011 * k;
      faces = box(-0.0105, -0.0105, 0, 0.021, 0.021, H, M2);
      for (const [hx, hy] of pattern(0, 0, 0.017, 0.017)) faces = faces.concat(cyl(hx, hy, H, 0.001, 0.0005, 8, M3));
      faces = faces.concat(cx_(0.0105, 0, H / 2, 0.008, 0.008, 16, M3), cx_(0.0185, 0, H / 2, 0.0075, 0.01, 16, M2), cx_(0.0285, 0, H / 2, 0.0078, 0.002, 16, M3), discX(x + 0.0305, y, z + H / 2, 0.006, 1, slot, BLACK));
      faces = faces.concat(box(-0.0145, -0.005, 0.002, 0.004, 0.01, 0.004, M3), box(-0.0165, -0.003, 0.003, 0.002, 0.006, 0.002, BLACK));
      c = [x, y, z + H / 2]; break;
    }
    case 'icm': {
      // ICM-42688-P: a 2.5 x 3 x 0.9 mm LGA on a 25.4 x 25.4 mm breakout, eight-pin header along one edge
      faces = box(0, 0, 0, 0.0254, 0.0254, 0.0016, PCB).concat(holes(pattern(0.0127, 0.0127, 0.0204, 0.0204), 0.0016, 0.0015));
      faces = faces.concat(box(0.0112, 0.0115, 0.0016, 0.003, 0.0025, 0.0009, BLACK), box(0.005, 0.006, 0.0016, 0.002, 0.001, 0.0006, M3), box(0.018, 0.008, 0.0016, 0.001, 0.002, 0.0006, M3));
      faces = faces.concat(box(0.0015, 0.0225, 0.0016, 0.0225, 0.0025, 0.0025, BLACK));
      for (let i = 0; i < 8; i++) faces = faces.concat(box(0.0024 + i * 0.00254, 0.0234, 0.0041, 0.0006, 0.0006, Math.max(0.002, h - 0.0041), M3));
      c = [x + 0.0127, y + 0.0127, z + h / 2]; break;
    }
    case 'hg5700': {
      // HG5700: 92 mm aluminium body on a 127 mm isolator ring, 102 mm tall; RS-422 circular connector on the side. The published height is drawn as is.
      const H = 0.102, cx0 = 0.0635, cy0 = 0.0635;
      faces = cyl(cx0, cy0, 0, 0.0635, 0.012, 28, M3).concat(holes([[cx0 - 0.055, cy0], [cx0 + 0.055, cy0], [cx0, cy0 - 0.055], [cx0, cy0 + 0.055]], 0.012, 0.003));
      faces = faces.concat(cyl(cx0, cy0, 0.012, 0.046, H - 0.016, 24, M2), cyl(cx0, cy0, H - 0.004, 0.044, 0.004, 24, M1), box(cx0 - 0.02, cy0 - 0.012, H, 0.04, 0.024, 0.0004, ALU));
      faces = faces.concat(cy_(cx0, cy0 + 0.046, 0.05, 0.008, 0.012, 12, M3), cy_(cx0, cy0 + 0.058, 0.05, 0.006, 0.004, 12, BLACK));
      c = [x + cx0, y + cy0, z + H / 2]; break;
    }
    case 'imung': {
      // fixture: tactical MEMS puck in the HG4930 class, a 40 mm diameter x 20 mm flanged cylinder with a side connector
      const H = Math.max(h, 0.02);
      faces = box(-0.003, -0.003, 0, 0.046, 0.046, 0.002, M3).concat(holes(pattern(0.02, 0.02, 0.04, 0.04), 0.002, 0.0015));
      faces = faces.concat(cyl(0.02, 0.02, 0.002, 0.02, H - 0.004, 20, M2), cyl(0.02, 0.02, H - 0.002, 0.018, 0.002, 20, M1), cyl(0.02, 0.02, H, 0.004, 0.001, 10, M3));
      faces = faces.concat(cx_(0.038, 0.02, H * 0.5, 0.005, 0.006, 12, M3), cx_(0.044, 0.02, H * 0.5, 0.004, 0.003, 12, BLACK));
      c = [x + 0.02, y + 0.02, z + H / 2]; break;
    }
    case 'acc120': {
      // fixture: accelerometer-grade IMU as a 45 x 45 x 25 mm finned box with a top connector
      const H = Math.max(h, 0.025);
      faces = box(-0.003, -0.003, 0, 0.051, 0.051, 0.002, M3).concat(box(0, 0, 0.002, 0.045, 0.045, H - 0.002, M2));
      for (let i = 0; i < 5; i++) faces = faces.concat(box(0.003 + i * 0.009, -0.002, 0.005, 0.004, 0.049, H - 0.01, M3));
      faces = faces.concat(cyl(0.0225, 0.0225, H, 0.006, 0.006, 12, M3), cyl(0.0225, 0.0225, H + 0.006, 0.0045, 0.002, 12, BLACK));
      c = [x + 0.0225, y + 0.0225, z + H / 2]; break;
    }
    case 'h743': case 'h753': case 'h743m': {
      // the LQFP-100 (14 x 14 x 1.4 mm) on a Pixhawk-6C-class 84.8 x 44 mm carrier: JST-GH rows on both long edges, microSD, USB-C, four M3 holes
      const pcb = pid === 'h743m' ? '#3a4a3e' : PCB;
      faces = box(0, 0, 0, 0.0848, 0.044, h, pcb).concat(holes(pattern(0.0424, 0.022, 0.0788, 0.038), h, 0.0015));
      faces = faces.concat(box(0.03, 0.015, h, 0.014, 0.014, 0.0014, BLACK), box(0.032, 0.017, h + 0.0014, 0.01, 0.01, 0.0002, M3));
      if (pid === 'h753') faces = faces.concat(box(0.055, 0.012, h, 0.008, 0.008, 0.001, BLACK), box(0.057, 0.014, h + 0.001, 0.004, 0.004, 0.0002, GOLD));
      else faces = faces.concat(box(0.055, 0.012, h, 0.007, 0.007, 0.001, BLACK));
      faces = faces.concat(box(0.006, 0.03, h, 0.012, 0.011, 0.002, BLACK), box(0.008, 0.01, h, 0.005, 0.005, 0.0012, M3), box(0.015, 0.01, h, 0.005, 0.005, 0.0012, M3));
      jstRow(0.006, 0, h, 6, 0.012); jstRow(0.006, 0.0395, h, 6, 0.012);
      faces = faces.concat(box(0.0848, 0.017, h, 0.003, 0.009, 0.0032, M3), box(-0.002, 0.018, h, 0.002, 0.012, 0.0012, M3), box(0.074, 0.03, h + 0.001, 0.002, 0.002, 0.0008, GREEN), box(0.078, 0.03, h + 0.001, 0.002, 0.002, 0.0008, RED));
      c = [x + 0.0424, y + 0.022, z + h / 2]; break;
    }
    case 'neom9n': {
      // NEO-M9N (12.2 x 16 x 2.4 mm) on a 25 x 45 mm carrier under a 25 x 25 x 4 mm ceramic patch; JST-GH on the near edge
      faces = box(0, 0, 0, 0.025, 0.045, 0.0016, PCB).concat(holes(pattern(0.0125, 0.0225, 0.021, 0.041), 0.0016, 0.0012));
      faces = faces.concat(box(0.0064, 0.003, 0.0016, 0.0122, 0.016, 0.0024, ALU), box(0.0074, 0.004, 0.004, 0.0102, 0.014, 0.0003, M3));
      faces = faces.concat(box(0, 0.02, 0.0016, 0.025, 0.025, Math.max(0.002, h - 0.004), '#d9d3c0'), box(0.005, 0.025, Math.max(0.0036, h - 0.0024), 0.015, 0.015, 0.0003, ALU), cyl(0.0125, 0.0325, Math.max(0.0039, h - 0.0021), 0.0008, 0.0004, 8, M3));
      faces = faces.concat(box(0.002, -0.002, 0.0016, 0.0083, 0.0045, 0.004, JST), box(0.02, 0.001, 0.0016, 0.003, 0.003, 0.0012, M3));
      c = [x + 0.0125, y + 0.0225, z + h / 2]; break;
    }
    case 'crpa': {
      // fixture: four-element controlled reception pattern array, a 90 x 90 x 20 mm tray with four 30 mm patches and an electronics bay underneath
      const H = Math.max(h, 0.02);
      faces = box(0, 0, 0, 0.09, 0.09, H * 0.6, M2).concat(box(0, 0, H * 0.6, 0.09, 0.09, 0.002, M3));
      for (const [hx, hy] of [[0.01, 0.01], [0.05, 0.01], [0.01, 0.05], [0.05, 0.05]] as [number, number][]) faces = faces.concat(box(hx, hy, H * 0.6 + 0.002, 0.03, 0.03, H * 0.3, '#d9d3c0'), box(hx + 0.006, hy + 0.006, H * 0.9 + 0.002, 0.018, 0.018, 0.0004, ALU));
      faces = faces.concat(cyl(0.045, 0.045, H * 0.6 + 0.002, 0.003, 0.004, 8, M3), cx_(-0.008, 0.045, H * 0.3, 0.005, 0.008, 10, M3), cx_(-0.012, 0.045, H * 0.3, 0.004, 0.004, 10, BLACK));
      c = [x + 0.045, y + 0.045, z + H / 2]; break;
    }
    case 'mcode': {
      // fixture: PPS-capable receiver, a 40 x 40 x 15 mm finned enclosure with a circular connector and two RF ports on top
      const H = Math.max(h, 0.015);
      faces = box(0, 0, 0, 0.04, 0.04, H, M2);
      for (let i = 0; i < 6; i++) faces = faces.concat(box(-0.002, 0.002 + i * 0.0064, 0.003, 0.044, 0.003, H - 0.005, M3));
      faces = faces.concat(cyl(0.012, 0.02, H, 0.005, 0.006, 12, M3), cyl(0.012, 0.02, H + 0.006, 0.004, 0.002, 12, BLACK), cyl(0.03, 0.013, H, 0.0025, 0.008, 8, GOLD), cyl(0.03, 0.027, H, 0.0025, 0.008, 8, GOLD));
      c = [x + 0.02, y + 0.02, z + H / 2]; break;
    }
    case 'pmddl': {
      // pMDDL2450 OEM motherboard: 27 x 33 x 4 mm, RF shield can, two U.FL antenna ports, the 80-pin SMT header along the near edge
      faces = box(0, 0, 0, 0.027, 0.033, 0.001, PCB).concat(holes(pattern(0.0135, 0.0165, 0.023, 0.029), 0.001, 0.0008));
      faces = faces.concat(box(0.003, 0.006, 0.001, 0.021, 0.02, Math.max(0.001, h - 0.0015), ALU), box(0.004, 0.0015, 0.001, 0.019, 0.003, 0.002, BLACK));
      faces = faces.concat(cyl(0.005, 0.03, 0.001, 0.0012, 0.0012, 8, GOLD), cyl(0.022, 0.03, 0.001, 0.0012, 0.0012, 8, GOLD));
      c = [x + 0.0135, y + 0.0165, z + h / 2]; break;
    }
    case 'aescustom': {
      // fixture: enclosed proprietary radio, a 60 x 40 x 20 mm finned aluminium box with two SMA ports and a circular connector
      const H = Math.max(h, 0.02);
      faces = box(0, 0, 0, 0.06, 0.04, H, M2);
      for (let i = 0; i < 7; i++) faces = faces.concat(box(0.004 + i * 0.0076, -0.002, 0.003, 0.003, 0.044, H - 0.005, M3));
      faces = faces.concat(cyl(0.015, 0.02, H, 0.003, 0.008, 8, GOLD), cyl(0.045, 0.02, H, 0.003, 0.008, 8, GOLD), cx_(0.06, 0.02, H * 0.5, 0.005, 0.006, 12, M3), cx_(0.066, 0.02, H * 0.5, 0.004, 0.002, 12, BLACK));
      c = [x + 0.03, y + 0.02, z + H / 2]; break;
    }
    case 'podeo': {
      // in-house two-axis EO gimbal: 120 x 120 mm mounting plate, yaw ring, twin arms and a stacked-disc 120 mm ball with the lens window forward
      faces = box(0, 0, 0, 0.12, 0.12, h * 0.05, M3).concat(cyl(0.06, 0.06, h * 0.05, 0.052, h * 0.06, 20, M2), cyl(0.06, 0.06, h * 0.11, 0.02, h * 0.06, 12, M3));
      faces = faces.concat(box(0.052, -0.008, h * 0.15, 0.016, 0.02, h * 0.5, M2), box(0.052, 0.108, h * 0.15, 0.016, 0.02, h * 0.5, M2));
      const rs = [0.024, 0.04, 0.05, 0.056, 0.058, 0.056, 0.05, 0.04, 0.024], step = h * 0.08;
      rs.forEach((r, i) => { faces = faces.concat(cyl(0.06, 0.06, h * 0.2 + i * step, r, step, 18, i % 2 ? M2 : M1)); });
      faces = faces.concat(cx_(0.108, 0.06, h * 0.56, 0.018, 0.012, 12, M3), discX(x + 0.12, y + 0.06, z + h * 0.56, 0.014, 1, slot, BLACK));
      c = [x + 0.06, y + 0.06, z + h / 2]; break;
    }
    case 'imx477': {
      // Raspberry Pi HQ camera (IMX477): 38 x 38 mm board, 30 mm hole pattern, 36 mm milled mount with the CS barrel and focus ring, 18.6 mm tall without lens; FPC and tripod boss
      faces = box(0, 0, 0, 0.038, 0.038, 0.0016, PCB).concat(holes(pattern(0.019, 0.019, 0.03, 0.03), 0.0016, 0.00125));
      const k = h / 0.0186;
      faces = faces.concat(cyl(0.019, 0.019, 0.0016, 0.018, 0.006 * k, 20, M3), cyl(0.019, 0.019, 0.0016 + 0.006 * k, 0.0125, 0.009 * k, 20, M2), cyl(0.019, 0.019, 0.0016 + 0.015 * k, 0.0128, 0.002 * k, 20, M3), discZ(x + 0.019, y + 0.019, z + 0.0016 + 0.017 * k, 0.007, slot, BLACK));
      faces = faces.concat(box(0.008, -0.001, 0.0016, 0.02, 0.003, 0.0025, M3), box(0.014, 0.034, 0.0016, 0.01, 0.005, 0.006, M3));
      c = [x + 0.019, y + 0.019, z + h / 2]; break;
    }
    case 'lw20': {
      // LW20/C: 43 x 30 x 20 mm IP67 housing with the beam along +X, two round apertures on the front face, cable gland at the back
      faces = box(0, 0, 0, 0.043, 0.03, h, BLACK).concat(box(0.001, 0.001, h, 0.041, 0.028, 0.0008, M3));
      faces = faces.concat(discX(x + 0.043, y + 0.009, z + h * 0.55, 0.0055, 1, slot, '#2b3a55'), discX(x + 0.043, y + 0.021, z + h * 0.55, 0.0055, 1, slot, '#2b3a55'), cx_(0.041, 0.009, h * 0.55, 0.006, 0.002, 12, M3), cx_(0.041, 0.021, h * 0.55, 0.006, 0.002, 12, M3));
      faces = faces.concat(cx_(-0.006, 0.015, h * 0.4, 0.0025, 0.006, 10, M3), cx_(-0.016, 0.015, h * 0.4, 0.0012, 0.01, 8, BLACK));
      c = [x + 0.0215, y + 0.015, z + h / 2]; break;
    }
    case 'alpha80': {
      // ALPHA 80A 12S: 88.5 x 36.6 x 19 mm finned body, two power leads on the -X end, three motor leads on the +X end
      faces = box(0, 0, 0, 0.0885, 0.0366, h * 0.55, BLACK);
      for (let i = 0; i < 9; i++) faces = faces.concat(box(0.005 + i * 0.009, 0.002, h * 0.55, 0.004, 0.0326, h * 0.45, M2));
      faces = faces.concat(box(0.025, 0.012, h * 0.55, 0.04, 0.012, h * 0.46, M3));
      for (const [wy, col] of [[0.012, RED], [0.024, BLACK]] as [number, string][]) faces = faces.concat(cx_(-0.025, wy, h * 0.25, 0.002, 0.025, 8, col));
      for (const wy of [0.008, 0.018, 0.028]) faces = faces.concat(cx_(0.0885, wy, h * 0.25, 0.0018, 0.025, 8, BLACK));
      c = [x + 0.044, y + 0.018, z + h / 2]; break;
    }
    case 'at7215': {
      // AT7215: 81.4 mm outrunner, 57.9 mm long, axis along +X on its cross mount; 10 mm shaft and prop adapter forward, three leads aft
      const r = h / 2, cy0 = 0.0407, cz0 = r + 0.003;
      faces = box(0, cy0 - 0.0357, 0, 0.006, 0.0714, 0.003, M3).concat(box(0, cy0 - 0.005, 0, 0.006, 0.01, cz0, M3), holes([[0.003, cy0 - 0.032], [0.003, cy0 + 0.032]], 0.003, 0.002));
      faces = faces.concat(cx_(0.006, cy0, cz0, 0.02, 0.006, 16, M3), cx_(0.012, cy0, cz0, r, 0.0519, 24, M2), cx_(0.0639, cy0, cz0, r * 0.92, 0.004, 24, M3));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; faces = faces.concat(box(0.018, cy0 + Math.cos(a) * r * 0.94 - 0.0025, cz0 + Math.sin(a) * r * 0.94 - 0.0025, 0.04, 0.005, 0.005, BLACK)); }
      faces = faces.concat(cx_(0.0679, cy0, cz0, 0.005, 0.03, 10, ALU), cx_(0.0979, cy0, cz0, 0.012, 0.006, 12, M3));
      for (let i = 0; i < 3; i++) faces = faces.concat(cx_(-0.03, cy0 - 0.01 + i * 0.01, cz0 - r * 0.5, 0.0018, 0.03, 8, BLACK));
      c = [x + 0.045, y + cy0, z + cz0]; break;
    }
    case 'hv6120': {
      // MKS HV6120 slim wing servo (23 x 8 x 26.5 mm standing on its edge): thin case, mounting ears, output gear and arm, lead
      faces = box(0.002, 0.002, 0, 0.02, 0.008, h * 0.8, BLACK).concat(box(0, 0.0035, h * 0.35, 0.002, 0.005, 0.0012, M3), box(0.022, 0.0035, h * 0.35, 0.002, 0.005, 0.0012, M3));
      faces = faces.concat(holes([[0.001, 0.006], [0.023, 0.006]], h * 0.35 + 0.0012, 0.0006));
      faces = faces.concat(cyl(0.007, 0.006, h * 0.8, 0.003, h * 0.12, 12, M2), cyl(0.007, 0.006, h * 0.92, 0.0018, h * 0.08, 10, M3), box(0.006, 0.0055, h, 0.016, 0.0014, 0.0008, JST), cyl(0.02, 0.0062, h, 0.0006, 0.0008, 6, M3));
      faces = faces.concat(cx_(-0.008, 0.005, h * 0.2, 0.0008, 0.01, 6, RED), cx_(-0.008, 0.0065, h * 0.2, 0.0008, 0.01, 6, BLACK));
      c = [x + 0.012, y + 0.006, z + h / 2]; break;
    }
    case 'ms4525': {
      // MS4525DO on a 20 x 12 mm carrier, two barbed ports, silicone lines to a 100 mm pitot-static tube along +X on a short mast
      faces = box(0, 0, 0, 0.02, 0.012, 0.0016, PCB).concat(box(0.003, 0.002, 0.0016, 0.012, 0.008, 0.005, BLACK));
      faces = faces.concat(cyl(0.006, 0.006, 0.0066, 0.0015, 0.005, 8, M3), cyl(0.012, 0.006, 0.0066, 0.0015, 0.005, 8, M3), box(0.015, -0.001, 0.0016, 0.005, 0.004, 0.003, JST));
      faces = faces.concat(cx_(0.006, 0.006, 0.0116, 0.0012, 0.04, 6, ALU), cx_(0.012, 0.0085, 0.0116, 0.0012, 0.036, 6, ALU));
      faces = faces.concat(cx_(0.045, 0.006, h * 0.6, 0.003, 0.1, 10, ALU), cx_(0.145, 0.006, h * 0.6, 0.0015, 0.015, 8, ALU), cyl(0.05, 0.006, 0.0016, 0.0025, h * 0.6, 8, M3));
      c = [x + 0.03, y + 0.006, z + h / 2]; break;
    }
    case 'ping200': {
      // ping200X: 47 x 54 x 9 mm black anodised case, SMA on the +X edge, five-wire lead on the -X edge, status LED
      faces = box(0, 0, 0, 0.047, 0.054, h, BLACK).concat(box(0.001, 0.001, h, 0.045, 0.052, 0.0006, M3), box(0.008, 0.015, h + 0.0006, 0.031, 0.024, 0.0003, ALU));
      faces = faces.concat(holes(pattern(0.0235, 0.027, 0.039, 0.046), h + 0.0006, 0.0015));
      faces = faces.concat(cx_(0.047, 0.027, h * 0.5, 0.003, 0.01, 8, GOLD), box(-0.004, 0.02, h * 0.2, 0.004, 0.014, h * 0.5, M3), box(0.04, 0.045, h + 0.0006, 0.002, 0.002, 0.001, GREEN));
      for (let i = 0; i < 5; i++) faces = faces.concat(cx_(-0.022, 0.021 + i * 0.003, h * 0.45, 0.0007, 0.018, 6, i % 2 ? RED : BLACK));
      c = [x + 0.0235, y + 0.027, z + h / 2]; break;
    }
    case 'orinnano': {
      // Jetson Orin Nano developer kit (100 x 79 x 21 mm): carrier board, module, finned heatsink and fan, RJ45, USB and HDMI along the far edge, barrel jack
      faces = box(0, 0, 0, 0.1, 0.079, 0.0016, PCB).concat(holes(pattern(0.05, 0.0395, 0.092, 0.071), 0.0016, 0.0015));
      faces = faces.concat(box(0.015, 0.012, 0.0016, 0.07, 0.045, 0.003, PCB), box(0.015, 0.012, 0.0046, 0.07, 0.045, 0.002, M3));
      for (let i = 0; i < 12; i++) faces = faces.concat(box(0.017 + i * 0.0055, 0.012, 0.0066, 0.0025, 0.045, h * 0.55, M2));
      faces = faces.concat(cyl(0.05, 0.0345, 0.0066 + h * 0.55, 0.02, h * 0.3, 16, BLACK), cyl(0.05, 0.0345, 0.0066 + h * 0.85, 0.005, 0.001, 8, M3));
      faces = faces.concat(box(0, 0.062, 0.0016, 0.016, 0.017, 0.013, M3), box(0.02, 0.064, 0.0016, 0.013, 0.015, 0.007, M3), box(0.036, 0.064, 0.0016, 0.013, 0.015, 0.007, M3), box(0.055, 0.067, 0.0016, 0.015, 0.01, 0.005, BLACK), box(0.09, 0.03, 0.0016, 0.009, 0.009, 0.006, BLACK));
      c = [x + 0.05, y + 0.0395, z + h / 2]; break;
    }
    case 'hg2409p': {
      // HG2409P flat patch (114 x 114 x 23 mm): white radome on a bracket bar, pigtail to an SMA
      faces = box(0.01, 0.052, 0, 0.094, 0.01, h * 0.3, M3).concat(box(0, 0, h * 0.3, 0.114, 0.114, h * 0.7, JST), box(0.004, 0.004, h, 0.106, 0.106, 0.0006, '#efece4'));
      faces = faces.concat(cy_(0.057, -0.02, h * 0.6, 0.0015, 0.02, 6, BLACK), cy_(0.057, -0.03, h * 0.6, 0.003, 0.01, 8, GOLD));
      c = [x + 0.057, y + 0.057, z + h / 2]; break;
    }
    case 'ifc60': {
      // IFC-60-S packed in its deployment bag (99 mm dia x 81 mm): cylinder bag, drawstring collar, shroud-line bundle and bridle loop on a base plate
      const cx0 = 0.0495, cy0 = 0.0495;
      faces = cyl(cx0, cy0, 0, 0.043, h * 0.75, 18, RED).concat(cyl(cx0, cy0, h * 0.75, 0.04, h * 0.12, 18, JST), cyl(cx0, cy0, h * 0.87, 0.033, h * 0.06, 14, RED));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; faces = faces.concat(box(cx0 + Math.cos(a) * 0.041 - 0.002, cy0 + Math.sin(a) * 0.041 - 0.002, h * 0.1, 0.004, 0.004, h * 0.6, BLACK)); }
      faces = faces.concat(cyl(cx0, cy0, h * 0.93, 0.01, h * 0.07, 10, ALU), box(0.01, 0.01, 0, 0.079, 0.079, 0.002, M3));
      c = [x + cx0, y + cy0, z + h / 2]; break;
    }
    case 'chimera7': {
      // Chimera7 Pro V2 (270 x 199 x 34 mm): 3 mm carbon bottom plate, four 6 mm arms at the 327 mm wheelbase angle with motor pads, 21 mm standoffs, 2 mm top plate, camera cage forward
      const cb = BLACK, cx0 = 0.135, cy0 = 0.0995, ang = Math.atan2(199, 270);
      faces = box(0.045, 0.035, 0, 0.18, 0.13, 0.003, cb).concat(holes(pattern(cx0, cy0, 0.03, 0.03), 0.003, 0.0015));
      const arm: [number, number][] = [[0.02, -0.008], [0.16, -0.008], [0.16, 0.008], [0.02, 0.008]];
      for (const a of [ang, Math.PI - ang, Math.PI + ang, -ang]) {
        faces = faces.concat(turned(arm, cx0, cy0, a, 0.003, 0.009, cb));
        const ex = cx0 + Math.cos(a) * 0.1635, ey = cy0 + Math.sin(a) * 0.1635;
        faces = faces.concat(cyl(ex, ey, 0.009, 0.015, 0.002, 12, M3), holes([[ex, ey]], 0.011, 0.004));
      }
      for (const [sx, sy] of pattern(cx0, cy0, 0.03, 0.03)) faces = faces.concat(cyl(sx, sy, 0.009, 0.0025, Math.max(0.005, h - 0.013), 8, ALU));
      faces = faces.concat(box(0.075, 0.05, Math.max(0.014, h - 0.004), 0.12, 0.1, 0.002, cb), box(0.2, 0.07, 0.003, 0.003, 0.06, Math.max(0.01, h - 0.006), cb), box(0.203, 0.07, 0.003, 0.02, 0.003, Math.max(0.01, h - 0.006), cb), box(0.203, 0.127, 0.003, 0.02, 0.003, Math.max(0.01, h - 0.006), cb));
      faces = faces.concat(box(0.04, 0.09, 0.003, 0.01, 0.02, 0.004, M3), box(0.037, 0.095, 0.005, 0.003, 0.01, 0.003, GOLD));
      c = [x + cx0, y + cy0, z + h / 2]; break;
    }
    case 'px6cmini': {
      // Pixhawk 6C Mini (54.3 x 39 x 17.5 mm): black case, JST-GH rows on both long edges, USB-C on the end, orientation arrow, status LEDs
      const H = Math.max(h, 0.0175), cb = BLACK;
      faces = box(0, 0, 0, 0.0543, 0.039, H, cb).concat(box(0.001, 0.001, H, 0.0523, 0.037, 0.0008, M2), box(0.012, 0.01, H + 0.0008, 0.028, 0.019, 0.0003, ALU));
      faces = faces.concat(box(0.035, 0.017, H + 0.0011, 0.008, 0.004, 0.0004, RED), box(0.043, 0.015, H + 0.0011, 0.003, 0.008, 0.0004, RED));
      jstRow(0.004, -0.002, H * 0.3, 5, 0.0095, 0.002, H * 0.4); jstRow(0.006, 0.039, H * 0.3, 4, 0.011, 0.002, H * 0.4);
      faces = faces.concat(box(0.0543, 0.015, H * 0.35, 0.002, 0.009, H * 0.3, M3), box(0.0543, 0.028, H * 0.35, 0.0015, 0.005, H * 0.2, M3));
      faces = faces.concat(box(0.003, 0.031, H + 0.0008, 0.002, 0.002, 0.0006, GREEN), box(0.007, 0.031, H + 0.0008, 0.002, 0.002, 0.0006, GOLD), box(0.011, 0.031, H + 0.0008, 0.002, 0.002, 0.0006, RED));
      c = [x + 0.027, y + 0.0195, z + H / 2]; break;
    }
    case 'tekko65': {
      // Tekko32 F4 Metal 4in1 65A (43 x 44 mm): PCB with the 30.5 mm M4 holes, eight metal-cased MOSFETs, F4 MCU, bulk capacitor along the pack edge, gold pads, JST-SH signal header
      const T = 0.0016;
      faces = box(0, 0, 0, 0.043, 0.044, T, PCB).concat(holes(pattern(0.0215, 0.022, 0.0305, 0.0305), T, 0.002));
      for (const [mx, my] of [[0.011, 0.003], [0.027, 0.003], [0.011, 0.035], [0.027, 0.035], [0.003, 0.013], [0.003, 0.025], [0.035, 0.013], [0.035, 0.025]] as [number, number][]) faces = faces.concat(box(mx, my, T, 0.005, 0.006, 0.0012, ALU));
      faces = faces.concat(box(0.018, 0.0185, T, 0.007, 0.007, 0.001, BLACK), box(0.019, 0.0195, T + 0.001, 0.005, 0.005, 0.0002, M3));
      faces = faces.concat(cx_(0.011, 0.044, T + 0.005, 0.005, 0.02, 10, BLACK), discX(x + 0.031, y + 0.044, z + T + 0.005, 0.005, 1, slot, ALU));
      faces = faces.concat(box(0, 0.015, T, 0.003, 0.005, 0.0004, GOLD), box(0, 0.023, T, 0.003, 0.005, 0.0004, GOLD));
      for (const [px, py] of [[0.0005, 0.0005], [0.038, 0.0005], [0.0005, 0.0425], [0.038, 0.0425]] as [number, number][]) for (let k = 0; k < 3; k++) faces = faces.concat(box(px + k * 0.0015, py, T, 0.001, 0.001, 0.0003, GOLD));
      faces = faces.concat(box(0.038, 0.014, T, 0.003, 0.012, 0.003, JST));
      c = [x + 0.0215, y + 0.022, z + h / 2]; break;
    }
    case 'f60prov': {
      // F60 PRO V 2207.5 (26.8 mm dia x 31.7 mm): cross base with the 16 mm M3 pattern, stator, bell with vent slots, cap, M5 shaft and prop nut, three leads
      const cx0 = 0.015, cy0 = 0.015, r = 0.0134, bz = 0.0015 + h * 0.2, bh = h * 0.55;
      faces = box(0.003, 0.013, 0, 0.024, 0.004, 0.0015, M3).concat(box(0.013, 0.003, 0, 0.004, 0.024, 0.0015, M3), holes([[0.007, cy0], [0.023, cy0], [cx0, 0.007], [cx0, 0.023]], 0.0015, 0.0015));
      faces = faces.concat(cyl(cx0, cy0, 0.0015, 0.009, h * 0.2, 16, M3), cyl(cx0, cy0, bz, r, bh, 20, '#3a3f47'));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; faces = faces.concat(box(cx0 + Math.cos(a) * r * 0.96 - 0.0012, cy0 + Math.sin(a) * r * 0.96 - 0.0012, bz + bh * 0.2, 0.0024, 0.0024, bh * 0.5, BLACK)); }
      faces = faces.concat(cyl(cx0, cy0, bz + bh, r, h * 0.06, 20, M2), cyl(cx0, cy0, bz + bh + h * 0.06, 0.006, h * 0.05, 14, M3), cyl(cx0, cy0, bz + bh + h * 0.11, 0.0025, h * 0.14, 8, ALU), cyl(cx0, cy0, bz + bh + h * 0.25, 0.004, h * 0.05, 6, M3));
      for (let i = 0; i < 3; i++) faces = faces.concat(cx_(-0.012, 0.011 + i * 0.004, 0.002, 0.0009, 0.014, 6, BLACK));
      c = [x + cx0, y + cy0, z + h / 2]; break;
    }
    case 'hq7035': {
      // HQProp 7 x 3.5 x 3 V1S (177.8 mm dia, hub 13.2 mm dia x 6.7 mm): three tapered polycarbonate blades at 120 degrees, round hub with the 5 mm bore
      const cx0 = 0.0889, cy0 = 0.0889, pc = ALU;
      const blade: [number, number][] = [[0.006, -0.006], [0.03, -0.012], [0.06, -0.011], [0.086, -0.004], [0.086, 0.004], [0.06, 0.011], [0.03, 0.012], [0.006, 0.006]];
      for (let i = 0; i < 3; i++) faces = faces.concat(turned(blade, cx0, cy0, (i / 3) * Math.PI * 2 + 0.3, h * 0.2, h * 0.45, pc));
      faces = faces.concat(cyl(cx0, cy0, 0, 0.0066, h, 14, pc), discZ(x + cx0, y + cy0, z + h, 0.0025, slot, M3), cyl(cx0, cy0, h * 0.2, 0.0075, h * 0.2, 14, '#b4b9c2'));
      c = [x + cx0, y + cy0, z + h / 2]; break;
    }
    case 'tattu1300': {
      // Tattu R-Line V3 1300 mAh 6S (75 x 38 x 38 mm): shrink-wrapped brick with softened edges, label band, XT60 lead and balance lead out the +X end
      const H = h, cb = BLACK;
      faces = box(0.002, 0, 0.002, 0.071, 0.038, H - 0.004, cb).concat(box(0, 0.002, 0.002, 0.075, 0.034, H - 0.004, cb), box(0.002, 0.002, 0, 0.071, 0.034, H, cb));
      faces = faces.concat(box(0.018, -0.0005, 0.006, 0.035, 0.039, H * 0.45, GOLD), box(0.018, 0.002, H + 0.0003, 0.035, 0.034, 0.0005, GOLD), box(0.025, 0.01, H + 0.0008, 0.02, 0.018, 0.0003, cb));
      faces = faces.concat(cx_(0.075, 0.016, H * 0.5, 0.0015, 0.012, 6, RED), cx_(0.075, 0.021, H * 0.5, 0.0015, 0.012, 6, cb), box(0.087, 0.013, H * 0.5 - 0.004, 0.016, 0.008, 0.008, '#e0b52a'));
      for (let i = 0; i < 4; i++) faces = faces.concat(cx_(0.075, 0.028 + i * 0.0015, H * 0.25, 0.0005, 0.011, 6, i % 2 ? BLACK : JST));
      faces = faces.concat(box(0.086, 0.027, H * 0.25 - 0.002, 0.005, 0.008, 0.004, JST));
      c = [x + 0.0375, y + 0.019, z + H / 2]; break;
    }
    case 'm10gps': {
      // Holybro M10 GPS (50 mm dia x 14.4 mm): black puck over the 25 mm patch, orientation arrow, LED and safety switch on top, JST-GH lead out the side
      const H = h, cb = BLACK;
      faces = cyl(0.025, 0.025, 0, 0.025, H, 24, cb).concat(cyl(0.025, 0.025, H, 0.024, 0.0008, 24, M2), box(0.018, 0.023, H + 0.0008, 0.012, 0.004, 0.0003, JST), box(0.03, 0.02, H + 0.0008, 0.003, 0.01, 0.0003, JST));
      faces = faces.concat(cyl(0.025, 0.038, H + 0.0008, 0.003, 0.0015, 10, M3), cyl(0.025, 0.038, H + 0.0023, 0.0015, 0.0006, 8, RED), box(0.012, 0.012, H + 0.0008, 0.002, 0.002, 0.0006, GREEN));
      faces = faces.concat(cy_(0.025, -0.02, 0.004, 0.001, 0.021, 6, cb), box(0.021, -0.026, 0.0025, 0.008, 0.006, 0.003, JST));
      c = [x + 0.025, y + 0.025, z + H / 2]; break;
    }
    case 'sik915': {
      // SiK Telemetry Radio V3 (53 x 28 x 10.7 mm): black case, RP-SMA and rubber-duck antenna along +X, JST-GH and micro-USB on the other end, two LEDs
      const H = h, cb = BLACK;
      faces = box(0, 0, 0, 0.053, 0.028, H, cb).concat(box(0.001, 0.001, H, 0.051, 0.026, 0.0008, M3), box(0.01, 0.006, H + 0.0008, 0.025, 0.016, 0.0003, ALU));
      faces = faces.concat(cx_(0.053, 0.014, H * 0.5, 0.0025, 0.005, 8, GOLD), cx_(0.058, 0.014, H * 0.5, 0.0018, 0.008, 8, cb), cx_(0.066, 0.014, H * 0.5, 0.0014, 0.04, 8, '#2b2f36'));
      faces = faces.concat(box(-0.0025, 0.008, H * 0.25, 0.0025, 0.0083, H * 0.45, JST), box(-0.002, 0.02, H * 0.35, 0.002, 0.005, H * 0.2, M3));
      faces = faces.concat(box(0.043, 0.003, H + 0.0008, 0.002, 0.002, 0.0006, GREEN), box(0.047, 0.003, H + 0.0008, 0.002, 0.002, 0.0006, RED));
      c = [x + 0.0265, y + 0.014, z + H / 2]; break;
    }
    case 'thumbpro': {
      // RunCam Thumb Pro W (54 x 25.5 x 21 mm): black body on a mount tab, lens barrel and glass forward along +X, record button on top, microSD slot on the side, 2-pin power at the rear
      const H = Math.max(0.004, h - 0.0015), cb = BLACK;
      faces = box(0.008, 0.008, 0, 0.012, 0.01, 0.0015, M3).concat(box(0, 0, 0.0015, 0.054, 0.0255, H, cb), box(0.001, 0.001, 0.0015 + H, 0.052, 0.0235, 0.0005, M3));
      faces = faces.concat(cx_(0.054, 0.01275, 0.0015 + H * 0.5, 0.0075, 0.004, 14, M3), cx_(0.058, 0.01275, 0.0015 + H * 0.5, 0.0065, 0.002, 14, cb), discX(x + 0.06, y + 0.01275, z + 0.0015 + H * 0.5, 0.0045, 1, slot, '#2b3a55'));
      faces = faces.concat(cyl(0.038, 0.01275, 0.002 + H, 0.0025, 0.0012, 8, RED), box(0.018, 0.0255, 0.006, 0.01, 0.0008, 0.0025, M3), box(-0.0025, 0.01, 0.006, 0.0025, 0.005, 0.004, JST), box(0.004, 0.003, 0.002 + H, 0.002, 0.002, 0.0005, GREEN));
      c = [x + 0.027, y + 0.01275, z + 0.0015 + H / 2]; break;
    }
  }
  if (fs !== 1) {
    const sc = (p: Vec3): Vec3 => [x + (p[0] - x) * fs, y + (p[1] - y) * fs, p[2]];
    faces = faces.map((f) => ({ ...f, pts: f.pts.map(sc) }));
    c = sc(c);
  }
  return { slot, pid, faces, c };
}

export function fitThumb(faces: (ProjectedFace & { stroke: string; dash: string })[]): ThumbFace[] {
  const nums = faces.flatMap((f) => f.pts.split(' ').map((p) => p.split(',').map(Number)));
  const xs = nums.map((p) => p[0]), ys = nums.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const sc = Math.min(50 / (maxx - minx || 1), 38 / (maxy - miny || 1));
  const ox = 28 - ((minx + maxx) / 2) * sc, oy = 22 - ((miny + maxy) / 2) * sc;
  return faces.map((f) => ({
    fill: f.fill, stroke: f.stroke, dash: f.dash,
    pts: f.pts.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return (x * sc + ox).toFixed(1) + ',' + (y * sc + oy).toFixed(1); }).join(' '),
  }));
}

const THUMB_DIMS: Dims = { ...DIMS0 };
const THUMB_PR = proj(Math.PI / 4, 0.6155, 200, 0, 0);

export function thumbFaces(pid: PartId): ThumbFace[] {
  const slot = CATALOG[pid].slot;
  const faces = renderSolid(partSolid(pid, slot, 0, 0, 0, THUMB_DIMS), THUMB_PR).map((f) => ({ ...f, stroke: 'var(--line)', dash: '' }));
  return fitThumb(faces);
}

export const THUMBS: Record<PartId, ThumbFace[]> = Object.fromEntries((Object.keys(CATALOG) as PartId[]).map((k) => [k, thumbFaces(k)])) as Record<PartId, ThumbFace[]>;

export const AF_THUMB: ThumbFace[] = fitThumb(
  renderSolid({ slot: 'a', faces: boxFaces(0, 0, 0, 1.2, 0.5, 0.04, 'a').concat(boxFaces(0, 0, 0.04, 0.04, 0.5, 0.35, 'a')) }, THUMB_PR).map((f) => ({ ...f, stroke: 'var(--line)', dash: '' })),
);

export type ViewName = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'right' | 'left';
export const CUBE_NAMES: Record<string, [string, ViewName]> = {
  '0,0,1': ['Top', 'top'], '0,0,-1': ['Bottom', 'bottom'], '0,1,0': ['Front', 'front'], '0,-1,0': ['Back', 'back'], '1,0,0': ['Right', 'right'], '-1,0,0': ['Left', 'left'],
};
export const isSlot = (s: string): s is Slot => s === 'battery' || s === 'thermal' || s === 'imu' || s === 'fc' || s === 'gnss' || s === 'datalink' || s === 'pod';
export const isNode = (s: string): s is Node => s === 'airframe' || isSlot(s);

/** Number faces within a solid so a selection can name one (index is stable for the same shape, not a durable topology id). */
export function indexFaces(solid: Solid, body?: string): Solid {
  return { ...solid, faces: solid.faces.map((f, i) => ({ ...f, fi: i, body: body ?? f.body ?? solid.slot })) };
}

/** Prism from a counter-clockwise 2D outline between z0 and z1, with outward side normals. */
export function prismFaces(outline: [number, number][], z0: number, z1: number, slot: string): Face[] {
  const top: Face = { pts: outline.map(([x, y]) => [x, y, z1] as Vec3), n: [0, 0, 1], slot };
  const bot: Face = { pts: outline.map(([x, y]) => [x, y, z0] as Vec3), n: [0, 0, -1], slot };
  const sides: Face[] = outline.map(([x, y], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    const ex = x2 - x, ey = y2 - y, len = Math.hypot(ex, ey) || 1;
    return { pts: [[x, y, z0], [x2, y2, z0], [x2, y2, z1], [x, y, z1]] as Vec3[], n: [ey / len, -ex / len, 0], slot };
  });
  return [top, bot, ...sides];
}

/** Rectangle outline with optional corner fillet (arc) or chamfer (single cut). */
export function plateOutline(L: number, W: number, fillet: number, chamfer: number): [number, number][] {
  const r = Math.min(fillet, L / 2 - 0.01, W / 2 - 0.01), c = Math.min(chamfer, L / 2 - 0.01, W / 2 - 0.01);
  const corners: [number, number, number, number][] = [[0, 0, 1, 1], [L, 0, -1, 1], [L, W, -1, -1], [0, W, 1, -1]];
  const out: [number, number][] = [];
  for (const [cx, cy, sx, sy] of corners) {
    if (r > 0) {
      const ox = cx + sx * r, oy = cy + sy * r;
      const a0 = Math.atan2(-sy, -sx);
      const dir = sx * sy > 0 ? 1 : -1;
      for (let k = 0; k <= 5; k++) { const a = a0 + dir * (k / 5) * (Math.PI / 2); out.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); }
    } else if (c > 0) {
      const p1: [number, number] = [cx, cy + sy * c], p2: [number, number] = [cx + sx * c, cy];
      if (sx * sy > 0) out.push(p1, p2); else out.push(p2, p1);
    } else out.push([cx, cy]);
  }
  return out;
}

/** Sutherland–Hodgman clip of every face against the half-space p[axis] <= at. Faces that were cut are flagged. */
export function clipFaces(faces: Face[], axis: 0 | 1 | 2, at: number): Face[] {
  const out: Face[] = [];
  for (const f of faces) {
    const inside = (p: Vec3) => p[axis] <= at;
    if (f.pts.every(inside)) { out.push(f); continue; }
    if (!f.pts.some(inside)) continue;
    const pts: Vec3[] = [];
    for (let i = 0; i < f.pts.length; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
      const ia = inside(a), ib = inside(b);
      if (ia) pts.push(a);
      if (ia !== ib) {
        const t = (at - a[axis]) / (b[axis] - a[axis]);
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    if (pts.length >= 3) out.push({ ...f, pts, cut: true });
  }
  return out;
}

export interface Bounds3 { min: Vec3; max: Vec3 }
export function bounds3(solid: Solid): Bounds3 {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const f of solid.faces) for (const p of f.pts) for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; }
  return { min, max };
}
export const boundsVolume = (b: Bounds3) => Math.max(0, (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]));
export const boundsCenter = (b: Bounds3): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
