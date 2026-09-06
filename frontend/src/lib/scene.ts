// Builds the bodies the viewport, dialogs and measure tool all read from one
// design state, so a preview (dialog live-edit) and the committed design use
// the same construction.
import { CATALOG, SLOTS, type Dims, type PartId, type Slot } from './catalog';
import type { Geo, Positions } from './design';
import { boxFaces, discX, discZ, discZd, emptySolid, indexFaces, partSolid, plateOutline, prismFaces, solidBounds, type Face, type Solid } from './geometry';
import type { Attrs, Parts } from './rules';
import { HOLE_INSET_X, HOLE_INSET_Y } from './sketch';

/** The plate length and width come from the geometry, not from the wing span. */
export interface SceneInput { dims: Dims; geo: Geo; parts: Parts; attrs: Attrs; pos: Positions }
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
