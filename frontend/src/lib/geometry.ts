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

const FOOTPRINT: Record<string, [number, number]> = {
  battery: [0.9, 0.5], imu: [0.22, 0.22], fc: [0.7, 0.45], thermal: [0.36, 0.36], gnss: [0.22, 0.22], datalink: [0.4, 0.25], pod: [0.3, 0.3],
  camera: [0.2, 0.2], lidar: [0.18, 0.24], esc: [0.4, 0.24], motor: [0.3, 0.3], servo: [0.24, 0.12], airspeed: [0.3, 0.08], transponder: [0.24, 0.18], companion: [0.36, 0.24], antenna: [0.2, 0.2], parachute: [0.3, 0.3],
};

/** Dashed outline of the slot footprint when no part is placed. */
export function emptySolid(slot: Slot, x: number, y: number, z: number, dims: Dims): Solid {
  const h = dims[slot];
  const fp = FOOTPRINT[slot] || [0.6, 0.4];
  const ox = slot === 'thermal' ? x - 0.18 : x, oy = slot === 'thermal' ? y - 0.18 : y;
  return { slot, faces: boxFaces(ox, oy, z, fp[0], fp[1], h, slot, 'none'), c: [ox + fp[0] / 2, oy + fp[1] / 2, z + h / 2] };
}

/** Axis-aligned extent of a solid's footprint in plate coordinates. */
export function solidBounds(solid: Solid): { minx: number; maxx: number; miny: number; maxy: number } {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const f of solid.faces) for (const p of f.pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  return { minx, maxx, miny, maxy };
}

/**
 * Build a part body at plate position (x, y). `h` overrides the slot height (spec-driven);
 * `fs` scales the footprint about (x, y) so a bigger sensor reads as a bigger body.
 */
export function partSolid(pid: PartId, slot: Slot, x: number, y: number, z: number, dims: Dims, h = dims[slot], fs = 1): Solid {
  let faces: Face[] = [];
  let c: Vec3;
  // Shapes follow the published mechanical envelopes (see the research notes in the commit), drawn at the scene's symbolic scale.
  const M1 = 'var(--m1)', M2 = 'var(--m2)', M3 = 'var(--m3)';
  const box = (bx: number, by: number, bz: number, dx: number, dy: number, dz: number, fill?: string) => boxFaces(x + bx, y + by, z + bz, dx, dy, dz, slot, fill);
  const cyl = (cx: number, cy: number, cz: number, r: number, hh: number, N = 14, fill?: string) => cylFaces(x + cx, y + cy, z + cz, r, hh, slot, N, fill);
  const cx_ = (bx: number, cy: number, cz: number, r: number, len: number, N = 12, fill?: string) => cylAlongX(x + bx, y + cy, z + cz, r, len, slot, N, fill);
  const cy_ = (cx: number, by: number, cz: number, r: number, len: number, N = 12, fill?: string) => cylAlongY(x + cx, y + by, z + cz, r, len, slot, N, fill);
  const holes = (pts: [number, number][], hz: number, r = 0.012) => pts.map(([hx, hy]) => discZ(x + hx, y + hy, z + hz, r, slot, M3));
  switch (pid) {
    case 'p45b': {
      // 6S4P brick of 21700 cells (21.55 × 70.15 mm each) lying along X in two layers, nickel strips on the ends, XT90 and balance lead on one end
      const cr = 0.052, seg = 0.28;
      faces = box(0, 0, 0, 0.9, 0.5, 0.02, M3);
      for (const layer of [0, 1]) for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
        faces = faces.concat(cx_(0.02 + col * (seg + 0.01), 0.07 + row * 0.12, 0.02 + cr + layer * cr * 2, cr, seg, 10));
      }
      faces = faces.concat(box(0.0, 0.03, 0.02, 0.02, 0.44, cr * 4, M3), box(0.88, 0.03, 0.02, 0.02, 0.44, cr * 4, M3));
      for (const col of [0.3, 0.59]) faces = faces.concat(box(col - 0.005, 0.03, 0.02 + cr * 4, 0.02, 0.44, 0.008, M3));
      faces = faces.concat(box(0.9, 0.18, 0.05, 0.08, 0.06, 0.05, '#c9a227'), box(0.9, 0.3, 0.06, 0.07, 0.03, 0.02, M3), box(0.02, 0.02, 0.02 + cr * 4, 0.86, 0.46, 0.006, M1));
      c = [x + 0.45, y + 0.25, z + h / 2]; break;
    }
    case 'amprius': {
      // six SA08 pouches (144.5 × 52 × 6.7 mm) stacked flat with tabs at one end, a BMS board and XT90 on top
      const t = h * 0.14;
      faces = box(0, 0, 0, 0.9, 0.5, 0.015, M3);
      for (let i = 0; i < 6; i++) faces = faces.concat(box(0.03, 0.04, 0.015 + i * t, 0.8, 0.42, t * 0.9, i % 2 ? M1 : M2), box(0.83, 0.12 + (i % 2) * 0.2, 0.015 + i * t + t * 0.3, 0.05, 0.08, 0.004, M3));
      const top = 0.015 + 6 * t;
      faces = faces.concat(box(0.03, 0.04, top, 0.8, 0.42, 0.01, M3), box(0.1, 0.1, top + 0.01, 0.3, 0.2, 0.02, '#2f6b3a'), box(0.85, 0.2, top - 0.02, 0.08, 0.06, 0.05, '#c9a227'));
      faces = faces.concat(box(0.0, 0.0, 0.015, 0.02, 0.5, top, M3), box(0.0, 0.0, 0.015, 0.9, 0.02, top, M3));
      c = [x + 0.45, y + 0.25, z + h / 2]; break;
    }
    case 'lepton': {
      // Lepton 3.5 (11.8 × 12.7 × 7.2 mm) with its shutter housing, socketed on a breakout board
      faces = box(-0.12, -0.12, 0, 0.24, 0.24, 0.012, '#2f6b3a').concat(holes([[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]], 0.012));
      faces = faces.concat(box(-0.07, -0.07, 0.012, 0.14, 0.14, 0.02, M3), box(-0.06, -0.065, 0.032, 0.12, 0.13, h * 0.3, M2), box(-0.06, -0.065, 0.032 + h * 0.3, 0.12, 0.07, h * 0.12, M3));
      faces = faces.concat(cyl(0, 0.02, 0.032 + h * 0.3, 0.035, h * 0.18, 12, M3), cyl(0, 0.02, 0.032 + h * 0.48, 0.022, 0.006, 10, '#1b1f26'));
      faces = faces.concat(box(-0.12, 0.1, 0.012, 0.1, 0.02, 0.02, M3));
      c = [x, y, z + h * 0.3]; break;
    }
    case 'boson': {
      // Boson 640 core (21 × 21 × 11 mm body) with the stepped lens barrel forward along +X and the rear connector block
      faces = box(-0.18, -0.18, 0, 0.36, 0.36, h * 0.55, M2);
      for (const [hx, hy] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]] as [number, number][]) faces = faces.concat(cyl(hx, hy, h * 0.55, 0.012, 0.006, 8, M3));
      faces = faces.concat(cx_(0.18, 0, h * 0.28, 0.12, 0.14, 16, M3), cx_(0.32, 0, h * 0.28, 0.1, 0.16, 16, M2), cx_(0.48, 0, h * 0.28, 0.105, 0.03, 16, M3));
      faces = faces.concat(discX(x + 0.51, y, z + h * 0.28, 0.07, 1, slot, '#1b1f26'));
      faces = faces.concat(box(-0.26, -0.1, h * 0.1, 0.08, 0.2, h * 0.3, M3), box(-0.3, -0.05, h * 0.18, 0.04, 0.1, h * 0.1, '#1b1f26'));
      c = [x, y, z + h / 2]; break;
    }
    case 'icm': {
      // ICM-42688-P: a 2.5 × 3 mm LGA on a breakout, pin header along one edge
      faces = box(0, 0, 0, 0.22, 0.22, 0.012, '#2f6b3a').concat(holes([[0.02, 0.02], [0.2, 0.02], [0.02, 0.2], [0.2, 0.2]], 0.012));
      faces = faces.concat(box(0.085, 0.09, 0.012, 0.05, 0.04, 0.012, '#1b1f26'), box(0.04, 0.04, 0.012, 0.02, 0.03, 0.006, M3), box(0.16, 0.05, 0.012, 0.03, 0.02, 0.006, M3));
      for (let i = 0; i < 6; i++) faces = faces.concat(box(0.03 + i * 0.028, 0.19, 0.012, 0.012, 0.012, 0.05, M3));
      c = [x + 0.11, y + 0.11, z + h * 0.15]; break;
    }
    case 'hg5700': {
      // HG5700: sealed aluminium block, 46 in³, 4 in tall, four-hole base flange and a circular connector on one side
      const H = h * 1.4;
      faces = box(-0.03, -0.03, 0, 0.28, 0.28, 0.02, M3).concat(holes([[-0.01, -0.01], [0.23, -0.01], [-0.01, 0.23], [0.23, 0.23]], 0.02, 0.014));
      faces = faces.concat(box(0, 0, 0.02, 0.22, 0.22, H, M2), box(0.02, 0.02, 0.02 + H, 0.18, 0.18, 0.01, M1), box(0.05, 0.06, 0.02 + H + 0.01, 0.12, 0.1, 0.003, '#c8ccd2'));
      faces = faces.concat(cy_(0.11, 0.22, 0.02 + H * 0.55, 0.045, 0.05, 12, M3), cy_(0.11, 0.27, 0.02 + H * 0.55, 0.035, 0.02, 12, '#1b1f26'));
      for (let i = 0; i < 4; i++) faces = faces.concat(box(0.22, 0.02 + i * 0.05, 0.02 + H * 0.15, 0.01, 0.03, H * 0.7, M3));
      c = [x + 0.11, y + 0.11, z + H / 2]; break;
    }
    case 'imung': {
      // tactical MEMS IMU puck (HG4930 class): flanged cylinder with a side connector
      faces = box(-0.02, -0.02, 0, 0.26, 0.26, 0.015, M3).concat(holes([[0, 0], [0.22, 0], [0, 0.22], [0.22, 0.22]], 0.015, 0.012));
      faces = faces.concat(cyl(0.11, 0.11, 0.015, 0.11, h * 1.1, 20, M2), cyl(0.11, 0.11, 0.015 + h * 1.1, 0.09, 0.01, 20, M1), cyl(0.11, 0.11, 0.025 + h * 1.1, 0.02, 0.008, 10, M3));
      faces = faces.concat(cx_(0.21, 0.11, 0.015 + h * 0.5, 0.035, 0.05, 12, M3), cx_(0.26, 0.11, 0.015 + h * 0.5, 0.028, 0.02, 12, '#1b1f26'));
      c = [x + 0.11, y + 0.11, z + h * 0.6]; break;
    }
    case 'acc120': {
      // accelerometer-grade IMU: squat finned box with a top connector
      faces = box(-0.02, -0.02, 0, 0.26, 0.26, 0.015, M3).concat(box(0, 0, 0.015, 0.22, 0.22, h * 0.9, M2));
      for (let i = 0; i < 5; i++) faces = faces.concat(box(0.01 + i * 0.044, -0.015, 0.03, 0.02, 0.25, h * 0.75, M3));
      faces = faces.concat(cyl(0.11, 0.11, 0.015 + h * 0.9, 0.04, 0.04, 12, M3), cyl(0.11, 0.11, 0.055 + h * 0.9, 0.03, 0.01, 12, '#1b1f26'));
      c = [x + 0.11, y + 0.11, z + h * 0.55]; break;
    }
    case 'h743': case 'h753': case 'h743m': {
      // Pixhawk-class flight controller: PCB, MCU, crypto or second MCU, JST-GH rows on both long edges, USB-C, microSD, four holes
      const pcb = pid === 'h743m' ? '#3a4a3e' : '#2f6b3a';
      faces = box(0, 0, 0, 0.7, 0.45, h, pcb).concat(holes([[0.03, 0.03], [0.67, 0.03], [0.03, 0.42], [0.67, 0.42]], h));
      faces = faces.concat(box(0.27, 0.15, h, 0.16, 0.16, 0.03, '#1b1f26'), box(0.29, 0.17, h + 0.03, 0.12, 0.12, 0.002, M3));
      if (pid === 'h753') faces = faces.concat(box(0.5, 0.1, h, 0.1, 0.1, 0.025, '#1b1f26'), box(0.52, 0.12, h + 0.025, 0.06, 0.06, 0.002, '#c9a227'));
      else faces = faces.concat(box(0.5, 0.1, h, 0.08, 0.08, 0.02, '#1b1f26'));
      faces = faces.concat(box(0.08, 0.3, h, 0.12, 0.09, 0.025, '#1b1f26'), box(0.1, 0.12, h, 0.06, 0.06, 0.015, M3), box(0.18, 0.12, h, 0.06, 0.06, 0.015, M3));
      for (let i = 0; i < 6; i++) faces = faces.concat(box(0.06 + i * 0.1, 0.0, h, 0.07, 0.05, 0.035, '#e6e2d6'), box(0.06 + i * 0.1, 0.4, h, 0.07, 0.05, 0.035, '#e6e2d6'));
      faces = faces.concat(box(0.7, 0.18, h, 0.04, 0.09, 0.03, M3), box(-0.03, 0.18, h, 0.03, 0.12, 0.012, M3), box(0.62, 0.32, h + 0.01, 0.02, 0.02, 0.01, '#3b9d5a'), box(0.66, 0.32, h + 0.01, 0.02, 0.02, 0.01, '#d94b3d'));
      c = [x + 0.35, y + 0.22, z + h / 2]; break;
    }
    case 'neom9n': {
      // NEO-M9N on a carrier: a 25 mm ceramic patch antenna on top, the 12.2 × 16 mm module beside it, SMA on the edge
      faces = box(0, 0, 0, 0.22, 0.22, 0.012, '#2f6b3a').concat(holes([[0.02, 0.02], [0.2, 0.02], [0.02, 0.2], [0.2, 0.2]], 0.012));
      faces = faces.concat(box(0.03, 0.05, 0.012, 0.15, 0.15, h * 0.7, '#d9d3c0'), box(0.06, 0.08, 0.012 + h * 0.7, 0.09, 0.09, 0.003, '#c8ccd2'), cyl(0.105, 0.125, 0.015 + h * 0.7, 0.008, 0.004, 8, M3));
      faces = faces.concat(box(0.03, 0.005, 0.012, 0.06, 0.045, 0.015, M3), box(0.12, 0.005, 0.012, 0.05, 0.03, 0.02, '#e6e2d6'));
      faces = faces.concat(cy_(0.2, 0.22, 0.03, 0.02, 0.05, 10, '#c9a227'));
      c = [x + 0.11, y + 0.11, z + h / 2]; break;
    }
    case 'crpa': {
      // four-element controlled reception pattern array: ground plane, four raised patches, electronics tray underneath
      faces = box(-0.08, -0.08, 0, 0.38, 0.38, h * 0.5, M2).concat(box(-0.08, -0.08, h * 0.5, 0.38, 0.38, 0.012, M3));
      for (const [hx, hy] of [[-0.04, -0.04], [0.14, -0.04], [-0.04, 0.14], [0.14, 0.14]] as [number, number][]) faces = faces.concat(box(hx, hy, h * 0.5 + 0.012, 0.12, 0.12, 0.035, '#d9d3c0'), box(hx + 0.025, hy + 0.025, h * 0.5 + 0.047, 0.07, 0.07, 0.003, '#c8ccd2'));
      faces = faces.concat(cyl(0.11, 0.11, h * 0.5 + 0.012, 0.015, 0.02, 8, M3), cx_(-0.12, 0.11, h * 0.25, 0.03, 0.04, 10, M3), cx_(-0.16, 0.11, h * 0.25, 0.024, 0.02, 10, '#1b1f26'));
      c = [x + 0.11, y + 0.11, z + h / 2]; break;
    }
    case 'mcode': {
      // PPS-capable receiver: ruggedised finned enclosure, circular power/data connector, two RF ports
      faces = box(0, 0, 0, 0.22, 0.22, h * 1.5, M2);
      for (let i = 0; i < 6; i++) faces = faces.concat(box(-0.01, 0.01 + i * 0.035, 0.02, 0.24, 0.015, h * 1.3, M3));
      faces = faces.concat(cyl(0.06, 0.11, h * 1.5, 0.03, 0.04, 12, M3), cyl(0.06, 0.11, h * 1.5 + 0.04, 0.024, 0.01, 12, '#1b1f26'), cyl(0.16, 0.07, h * 1.5, 0.014, 0.05, 8, '#c9a227'), cyl(0.16, 0.15, h * 1.5, 0.014, 0.05, 8, '#c9a227'));
      c = [x + 0.11, y + 0.11, z + h * 0.8]; break;
    }
    case 'pmddl': {
      // pMDDL2450 OEM: 33.5 × 48.5 mm board, RF shield can, two MMCX antenna ports, board-to-board header
      faces = box(0, 0, 0, 0.4, 0.25, 0.012, '#2f6b3a').concat(holes([[0.02, 0.02], [0.38, 0.02], [0.02, 0.23], [0.38, 0.23]], 0.012));
      faces = faces.concat(box(0.06, 0.04, 0.012, 0.24, 0.17, h * 0.7, '#c8ccd2'), box(0.32, 0.05, 0.012, 0.05, 0.15, 0.03, '#1b1f26'));
      faces = faces.concat(cyl(0.34, 0.06, 0.042, 0.012, 0.02, 8, '#c9a227'), cyl(0.34, 0.19, 0.042, 0.012, 0.02, 8, '#c9a227'));
      faces = faces.concat(box(0.01, 0.06, 0.012, 0.03, 0.13, 0.04, M3));
      c = [x + 0.2, y + 0.12, z + h / 2]; break;
    }
    case 'aescustom': {
      // enclosed proprietary radio: finned aluminium box, two SMA ports, circular connector
      faces = box(0, 0, 0, 0.4, 0.25, h * 1.2, M2);
      for (let i = 0; i < 7; i++) faces = faces.concat(box(0.03 + i * 0.05, -0.01, 0.02, 0.02, 0.27, h * 1.0, M3));
      faces = faces.concat(cyl(0.1, 0.12, h * 1.2, 0.018, 0.05, 8, '#c9a227'), cyl(0.3, 0.12, h * 1.2, 0.018, 0.05, 8, '#c9a227'), cx_(0.4, 0.12, h * 0.6, 0.035, 0.04, 12, M3), cx_(0.44, 0.12, h * 0.6, 0.028, 0.015, 12, '#1b1f26'));
      c = [x + 0.2, y + 0.12, z + h * 0.65]; break;
    }
    case 'podeo': {
      // two-axis EO gimbal: mounting plate, yaw ring, twin arms and a stacked-disc ball with the lens window forward
      faces = box(0, 0, 0, 0.3, 0.3, h * 0.12, M3).concat(cyl(0.15, 0.15, h * 0.12, 0.13, h * 0.12, 20, M2), cyl(0.15, 0.15, h * 0.24, 0.05, h * 0.08, 12, M3));
      faces = faces.concat(box(0.13, -0.02, h * 0.3, 0.04, 0.05, h * 0.5, M2), box(0.13, 0.27, h * 0.3, 0.04, 0.05, h * 0.5, M2));
      const rs = [0.06, 0.1, 0.125, 0.135, 0.13, 0.115, 0.09, 0.05], step = h * 0.08;
      rs.forEach((r, i) => { faces = faces.concat(cyl(0.15, 0.15, h * 0.32 + i * step, r, step, 18, i % 2 ? M2 : M1)); });
      faces = faces.concat(cx_(0.27, 0.15, h * 0.62, 0.045, 0.03, 12, M3), discX(x + 0.3, y + 0.15, z + h * 0.62, 0.035, 1, slot, '#1b1f26'));
      c = [x + 0.15, y + 0.15, z + h / 2]; break;
    }
    case 'imx477': {
      // IMX477 module: 38 × 38 mm board, lens holder, C-mount style barrel, ribbon connector
      faces = box(0, 0, 0, 0.2, 0.2, 0.012, '#2f6b3a').concat(holes([[0.02, 0.02], [0.18, 0.02], [0.02, 0.18], [0.18, 0.18]], 0.012));
      faces = faces.concat(box(0.05, 0.05, 0.012, 0.1, 0.1, h * 0.25, '#1b1f26'), cyl(0.1, 0.1, 0.012 + h * 0.25, 0.05, h * 0.5, 16, M3), cyl(0.1, 0.1, 0.012 + h * 0.75, 0.042, h * 0.2, 16, M2), cyl(0.1, 0.1, 0.012 + h * 0.95, 0.03, 0.006, 12, '#1b1f26'));
      faces = faces.concat(box(0.03, 0.0, 0.012, 0.14, 0.02, 0.015, M3), box(0.15, 0.14, 0.012, 0.03, 0.03, 0.01, M3));
      c = [x + 0.1, y + 0.1, z + h / 2]; break;
    }
    case 'lw20': {
      // LW20/C: 20 × 30 × 35 mm IP67 housing, two round apertures on the front, cable gland at the back
      faces = box(0, 0, 0, 0.18, 0.24, h, '#1b1f26').concat(box(0.01, 0.01, h, 0.16, 0.22, 0.008, M3));
      faces = faces.concat(discX(x + 0.18, y + 0.07, z + h * 0.55, 0.045, 1, slot, '#2b3a55'), discX(x + 0.18, y + 0.17, z + h * 0.55, 0.045, 1, slot, '#2b3a55'), cx_(0.16, 0.07, h * 0.55, 0.05, 0.02, 12, M3), cx_(0.16, 0.17, h * 0.55, 0.05, 0.02, 12, M3));
      faces = faces.concat(cx_(-0.05, 0.12, h * 0.4, 0.02, 0.05, 10, M3), cx_(-0.12, 0.12, h * 0.4, 0.008, 0.08, 8, '#1b1f26'));
      c = [x + 0.09, y + 0.12, z + h / 2]; break;
    }
    case 'alpha80': {
      // Alpha 80A HV: 88.5 × 36.6 × 19 mm finned body, two power leads one end, three motor leads the other
      faces = box(0, 0, 0, 0.4, 0.24, h * 0.55, '#1b1f26');
      for (let i = 0; i < 9; i++) faces = faces.concat(box(0.03 + i * 0.04, 0.02, h * 0.55, 0.02, 0.2, h * 0.45, M2));
      faces = faces.concat(box(0.12, 0.09, h * 0.55, 0.16, 0.06, h * 0.46, M3));
      for (const [wy, col] of [[0.08, '#d94b3d'], [0.16, '#1b1f26']] as [number, string][]) faces = faces.concat(cx_(-0.12, wy, h * 0.25, 0.018, 0.12, 8, col));
      for (const wy of [0.05, 0.12, 0.19]) faces = faces.concat(cx_(0.4, wy, h * 0.25, 0.016, 0.12, 8, '#1b1f26'));
      c = [x + 0.2, y + 0.12, z + h / 2]; break;
    }
    case 'at7215': {
      // AT7215: 81.4 mm outrunner (57.9 mm long) on its cross mount, axis along +X, prop adapter and shaft forward
      const r = 0.15, cy0 = 0.15, cz0 = h * 0.5 + 0.02;
      faces = box(0.0, 0.03, 0, 0.03, 0.24, 0.02, M3).concat(box(0.0, 0.13, 0, 0.03, 0.04, cz0, M3), box(-0.06, 0.13, cz0 - 0.02, 0.09, 0.04, 0.04, M3));
      faces = faces.concat(cx_(0.03, cy0, cz0, r * 0.7, 0.05, 18, M3), cx_(0.08, cy0, cz0, r, 0.22, 24, M2), cx_(0.3, cy0, cz0, r * 0.92, 0.02, 24, M3));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; faces = faces.concat(box(0.1, cy0 + Math.cos(a) * r * 0.93 - 0.01, cz0 + Math.sin(a) * r * 0.93 - 0.01, 0.18, 0.02, 0.02, '#1b1f26')); }
      faces = faces.concat(cx_(0.32, cy0, cz0, 0.05, 0.03, 12, M3), cx_(0.35, cy0, cz0, 0.02, 0.08, 10, '#c8ccd2'), cx_(0.43, cy0, cz0, 0.035, 0.015, 10, M3));
      for (const wy of [0.1, 0.15, 0.2]) faces = faces.concat(cx_(-0.14, wy, cz0 - r * 0.5, 0.014, 0.12, 8, '#1b1f26'));
      c = [x + 0.15, y + 0.15, z + cz0]; break;
    }
    case 'hv6120': {
      // MKS HV6120 slim wing servo (23 × 8 × 26.5 mm): thin case, mounting ears, output gear and arm, lead
      faces = box(0.02, 0.02, 0, 0.2, 0.08, h * 0.8, '#1b1f26').concat(box(0, 0.035, h * 0.35, 0.02, 0.05, 0.012, M3), box(0.22, 0.035, h * 0.35, 0.02, 0.05, 0.012, M3));
      faces = faces.concat(holes([[0.01, 0.06], [0.23, 0.06]], h * 0.35 + 0.012, 0.006));
      faces = faces.concat(cyl(0.07, 0.06, h * 0.8, 0.03, h * 0.12, 12, M2), cyl(0.07, 0.06, h * 0.92, 0.018, h * 0.08, 10, M3), box(0.06, 0.055, h * 1.0, 0.16, 0.014, 0.008, '#e6e2d6'), cyl(0.2, 0.062, h * 1.0, 0.006, 0.008, 6, M3));
      faces = faces.concat(cx_(-0.08, 0.05, h * 0.2, 0.008, 0.1, 6, '#d94b3d'), cx_(-0.08, 0.065, h * 0.2, 0.008, 0.1, 6, '#1b1f26'));
      c = [x + 0.12, y + 0.06, z + h / 2]; break;
    }
    case 'ms4525': {
      // MS4525DO board with two barbed ports, silicone lines to a pitot-static tube along +X
      faces = box(0, 0, 0, 0.1, 0.08, 0.012, '#2f6b3a').concat(box(0.02, 0.02, 0.012, 0.05, 0.04, h * 0.5, '#1b1f26'));
      faces = faces.concat(cyl(0.035, 0.04, 0.012 + h * 0.5, 0.008, h * 0.4, 8, M3), cyl(0.06, 0.04, 0.012 + h * 0.5, 0.008, h * 0.4, 8, M3), box(0.07, 0.0, 0.012, 0.03, 0.02, 0.012, '#e6e2d6'));
      faces = faces.concat(cx_(0.035, 0.04, 0.012 + h * 0.9, 0.008, 0.16, 6, '#c8ccd2'), cx_(0.06, 0.055, 0.012 + h * 0.9, 0.008, 0.14, 6, '#c8ccd2'));
      faces = faces.concat(cx_(0.18, 0.04, h * 0.6, 0.012, 0.22, 10, '#c8ccd2'), cx_(0.4, 0.04, h * 0.6, 0.006, 0.08, 8, '#c8ccd2'), cyl(0.2, 0.04, 0.012, 0.014, h * 0.6, 8, M3));
      c = [x + 0.1, y + 0.04, z + h / 2]; break;
    }
    case 'ping200': {
      // ping200X: 47 × 54 × 9 mm black anodised case, SMA on one edge, five-wire lead on the other, status LED
      faces = box(0, 0, 0, 0.24, 0.18, h, '#1b1f26').concat(box(0.01, 0.01, h, 0.22, 0.16, 0.004, M3), box(0.05, 0.05, h + 0.004, 0.14, 0.08, 0.002, '#c8ccd2'));
      faces = faces.concat(holes([[0.02, 0.02], [0.22, 0.02], [0.02, 0.16], [0.22, 0.16]], h + 0.004, 0.008));
      faces = faces.concat(cx_(0.24, 0.09, h * 0.5, 0.016, 0.05, 8, '#c9a227'), box(-0.03, 0.06, h * 0.2, 0.03, 0.06, h * 0.5, M3), box(0.2, 0.14, h + 0.004, 0.012, 0.012, 0.006, '#3b9d5a'));
      for (let i = 0; i < 5; i++) faces = faces.concat(cx_(-0.12, 0.065 + i * 0.012, h * 0.45, 0.004, 0.09, 6, i % 2 ? '#d94b3d' : '#1b1f26'));
      c = [x + 0.12, y + 0.09, z + h / 2]; break;
    }
    case 'orinnano': {
      // Orin Nano developer kit (100 × 79 × 21 mm): carrier board, module, finned heatsink and fan, port stack on one edge
      faces = box(0, 0, 0, 0.36, 0.28, 0.012, '#2f6b3a').concat(holes([[0.02, 0.02], [0.34, 0.02], [0.02, 0.26], [0.34, 0.26]], 0.012));
      faces = faces.concat(box(0.06, 0.05, 0.012, 0.25, 0.16, 0.02, '#2f6b3a'), box(0.06, 0.05, 0.032, 0.25, 0.16, 0.01, M3));
      for (let i = 0; i < 10; i++) faces = faces.concat(box(0.07 + i * 0.024, 0.05, 0.042, 0.012, 0.16, h * 0.55, M2));
      faces = faces.concat(cyl(0.185, 0.13, 0.042 + h * 0.55, 0.07, h * 0.3, 16, '#1b1f26'), cyl(0.185, 0.13, 0.042 + h * 0.85, 0.02, 0.006, 8, M3));
      faces = faces.concat(box(0.0, 0.22, 0.012, 0.09, 0.06, 0.05, M3), box(0.1, 0.23, 0.012, 0.06, 0.05, 0.04, M3), box(0.17, 0.23, 0.012, 0.06, 0.05, 0.04, M3), box(0.25, 0.24, 0.012, 0.04, 0.03, 0.02, '#1b1f26'), box(0.33, 0.1, 0.012, 0.03, 0.03, 0.02, '#1b1f26'));
      c = [x + 0.18, y + 0.14, z + h / 2]; break;
    }
    case 'hg2409p': {
      // HG2409P flat patch (114 × 114 × 32 mm): white radome on a bracket bar, pigtail to an SMA
      faces = box(0.02, 0.09, 0, 0.16, 0.02, h * 0.5, M3).concat(box(0.0, 0.0, h * 0.5, 0.2, 0.2, h * 0.5, '#e6e2d6'), box(0.02, 0.02, h * 1.0, 0.16, 0.16, 0.004, '#efece4'));
      faces = faces.concat(cy_(0.1, -0.06, h * 0.75, 0.006, 0.06, 6, '#1b1f26'), cy_(0.1, -0.09, h * 0.75, 0.014, 0.03, 8, '#c9a227'));
      c = [x + 0.1, y + 0.1, z + h / 2]; break;
    }
    case 'ifc60': {
      // IFC-60 packed in its deployment bag (3.9 in dia × 5.1 in): cylinder bag, drawstring collar, shroud-line bundle and bridle loop
      faces = cyl(0.15, 0.15, 0, 0.13, h * 0.75, 18, '#d94b3d').concat(cyl(0.15, 0.15, h * 0.75, 0.12, h * 0.12, 18, '#e6e2d6'), cyl(0.15, 0.15, h * 0.87, 0.1, h * 0.06, 14, '#d94b3d'));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; faces = faces.concat(box(0.15 + Math.cos(a) * 0.125 - 0.006, 0.15 + Math.sin(a) * 0.125 - 0.006, h * 0.1, 0.012, 0.012, h * 0.6, '#1b1f26')); }
      faces = faces.concat(cyl(0.15, 0.15, h * 0.93, 0.03, h * 0.07, 10, '#c8ccd2'), box(0.03, 0.03, 0, 0.24, 0.24, 0.01, M3));
      c = [x + 0.15, y + 0.15, z + h / 2]; break;
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
