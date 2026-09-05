// Flat-shaded axonometric projection of the Kestrel bracket and its slot
// bodies. This is a derived preview drawn as SVG polygons; it is not geometry
// truth and cannot commit or export anything.
import { CATALOG, type Dims, type Node, type PartId, type Slot } from './catalog';

export type Vec3 = [number, number, number];
export interface Face { pts: Vec3[]; n: Vec3; slot: string; fill?: string; late?: boolean }
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
export interface ProjectedFace { pts: string; fill: string; d: number; slot: string }
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

export function cylFaces(cx: number, cy: number, z: number, r: number, h: number, slot: string, N = 20): Face[] {
  const f: Face[] = [];
  const ring = (zz: number): Vec3[] => Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t), zz]; });
  const top = ring(z + h), bot = ring(z);
  f.push({ pts: top, n: [0, 0, 1], slot });
  f.push({ pts: bot, n: [0, 0, -1], slot });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; const tm = ((i + 0.5) / N) * Math.PI * 2;
    f.push({ pts: [bot[i], bot[j], top[j], top[i]], n: [Math.cos(tm), Math.sin(tm), 0], slot });
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
    const fill = f.fill || (f.n[2] > 0.5 ? 'var(--m1)' : f.n[2] < -0.5 ? 'var(--m3)' : nx < 0 ? 'var(--m2)' : 'var(--m3)');
    const base: ProjectedFace = { pts: f.pts.map((p) => pr.pt(p[0], p[1], p[2]).map((v) => v.toFixed(1)).join(',')).join(' '), fill, d, slot: solid.slot };
    out.push(Object.assign(base, deco ? deco(solid.slot, f) : ({} as T)));
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

const FOOTPRINT: Record<string, [number, number]> = { battery: [0.9, 0.5], imu: [0.22, 0.22], fc: [0.7, 0.45], thermal: [0.36, 0.36] };

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
  switch (pid) {
    case 'p45b': {
      faces = boxFaces(x, y, z, 0.9, 0.5, 0.04, slot, 'var(--m3)');
      for (const cx of [0.15, 0.45, 0.75]) for (const cy of [0.13, 0.37]) faces = faces.concat(cylFaces(x + cx, y + cy, z + 0.04, 0.11, h - 0.04, slot, 12));
      c = [x + 0.45, y + 0.25, z + h / 2]; break;
    }
    case 'amprius': {
      faces = boxFaces(x, y, z, 0.9, 0.5, h * 0.55, slot).concat(boxFaces(x + 0.05, y + 0.05, z + h * 0.55, 0.8, 0.4, h * 0.3, slot), boxFaces(x + 0.1, y + 0.1, z + h * 0.85, 0.7, 0.3, h * 0.15, slot, 'var(--m3)'));
      c = [x + 0.45, y + 0.25, z + h / 2]; break;
    }
    case 'lepton': {
      faces = boxFaces(x - 0.08, y - 0.08, z, 0.16, 0.16, h * 0.35, slot).concat(cylFaces(x, y, z + h * 0.35, 0.05, h * 0.25, slot, 12));
      c = [x, y, z + h * 0.3]; break;
    }
    case 'boson': {
      faces = boxFaces(x - 0.18, y - 0.18, z, 0.36, 0.36, h * 0.6, slot).concat(cylFaces(x, y, z + h * 0.6, 0.12, h * 0.4, slot, 16));
      c = [x, y, z + h / 2]; break;
    }
    case 'icm': {
      faces = boxFaces(x, y, z, 0.22, 0.22, 0.02, slot, 'var(--m3)').concat(boxFaces(x + 0.06, y + 0.06, z + 0.02, 0.1, 0.1, h * 0.3, slot));
      c = [x + 0.11, y + 0.11, z + h * 0.15]; break;
    }
    case 'hg5700': {
      faces = cylFaces(x + 0.11, y + 0.11, z, 0.15, h * 1.4, slot, 16).concat(boxFaces(x + 0.06, y + 0.06, z + h * 1.4, 0.1, 0.1, 0.02, slot, 'var(--m3)'));
      c = [x + 0.11, y + 0.11, z + h * 0.7]; break;
    }
    case 'imung': {
      faces = boxFaces(x, y, z, 0.22, 0.22, h * 1.2, slot).concat(boxFaces(x + 0.22, y + 0.06, z + h * 0.3, 0.05, 0.1, h * 0.5, slot, 'var(--m3)'));
      c = [x + 0.11, y + 0.11, z + h * 0.6]; break;
    }
    case 'h743': {
      faces = boxFaces(x, y, z, 0.7, 0.45, h, slot).concat(boxFaces(x + 0.25, y + 0.12, z + h, 0.16, 0.16, 0.03, slot, 'var(--m3)'), boxFaces(x + 0.05, y + 0.32, z + h, 0.12, 0.08, 0.03, slot, 'var(--m3)'));
      c = [x + 0.35, y + 0.22, z + h / 2]; break;
    }
    case 'h753': {
      faces = boxFaces(x, y, z, 0.7, 0.45, h, slot).concat(boxFaces(x + 0.25, y + 0.12, z + h, 0.16, 0.16, 0.03, slot, 'var(--m3)'), boxFaces(x + 0.5, y + 0.1, z + h, 0.1, 0.1, 0.03, slot, 'var(--m3)'), boxFaces(x + 0.05, y + 0.32, z + h, 0.12, 0.08, 0.03, slot, 'var(--m3)'));
      c = [x + 0.35, y + 0.22, z + h / 2]; break;
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

const THUMB_DIMS: Dims = { battery: 0.35, imu: 0.1, fc: 0.03, thermal: 0.3, airframe: 0.8 };
const THUMB_PR = proj(Math.PI / 4, 0.6155, 1, 0, 0);

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
export const isSlot = (s: string): s is Slot => s === 'battery' || s === 'thermal' || s === 'imu' || s === 'fc';
export const isNode = (s: string): s is Node => s === 'airframe' || s === 'battery' || s === 'thermal' || s === 'imu' || s === 'fc';
