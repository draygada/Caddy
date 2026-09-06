// Builds the bodies the viewport, dialogs and measure tool all read from one
// design state, so a preview (dialog live-edit) and the committed design use
// the same construction.
import { CATALOG, SLOTS, type Dims, type Slot } from './catalog';
import type { Geo, Positions } from './design';
import { boxFaces, discX, discZ, discZd, emptySolid, indexFaces, partSolid, plateOutline, prismFaces, type Solid } from './geometry';
import type { Attrs, Parts } from './rules';
import { HOLE_INSET_X, HOLE_INSET_Y } from './sketch';

/** The plate length and width come from the geometry, not from the wing span. */
export interface SceneInput { dims: Dims; geo: Geo; parts: Parts; attrs: Attrs; pos: Positions }
export type BodyKey = Slot | 'plate' | 'flange';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Flange sheet thickness, m (same 6 mm stock as the plate). */
export const FLANGE_T = 0.006;

export function buildBodies(d: SceneInput): Record<BodyKey, Solid> {
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
