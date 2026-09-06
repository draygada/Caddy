import { useMemo } from 'react';
import type { Snapshot } from '../lib/design';
import { PLATE_W } from '../lib/catalog';
import { proj, renderSolid, type Solid } from '../lib/geometry';
import { buildBodies } from '../lib/scene';

/** Static isometric thumbnail of a design snapshot, for the project cards. Empty slots draw as dashed footprints. */
export function DesignPreview({ snap, className }: { snap: Snapshot; className?: string }) {
  const faces = useMemo(() => {
    const W = 280, H = 150;
    const L = snap.span;
    const U = Math.min(60, 200 / (L + PLATE_W));
    const p0 = proj(Math.PI / 4, 0.6155, U, 0, 0);
    const c0 = p0.pt(L / 2, PLATE_W / 2, 0.25);
    const pr = proj(Math.PI / 4, 0.6155, U, W / 2 - c0[0], H / 2 - c0[1] + 8);
    const bodies = buildBodies({ span: L, dims: snap.dims, geo: snap.geo, parts: snap.parts, attrs: snap.attrs, pos: snap.pos });
    const order: Solid[] = [bodies.plate, bodies.flange, bodies.battery, bodies.imu, bodies.fc, bodies.thermal, bodies.gnss, bodies.datalink, bodies.pod];
    const dep = (so: Solid) => (so.c ? pr.depth(so.c[0], so.c[1], so.c[2]) : -1);
    const solids = order.slice(1).sort((a, b) => dep(a) - dep(b));
    const deco = (slot: string) => ({ dashed: slot !== 'airframe' && !snap.parts[slot as keyof typeof snap.parts] });
    return [...renderSolid(order[0], pr, deco), ...solids.flatMap((so) => renderSolid(so, pr, deco))];
  }, [snap]);
  return (
    <svg viewBox="0 0 280 150" className={className} role="img" aria-label="design preview">
      <rect x="0" y="0" width="280" height="150" fill="var(--surface2)" />
      {faces.map((f, i) => <polygon key={i} points={f.pts} fill={f.dashed ? 'none' : f.fill} stroke={f.dashed ? 'var(--muted)' : 'var(--m3)'} strokeWidth={0.8} strokeDasharray={f.dashed ? '4 3' : undefined} strokeLinejoin="round" />)}
    </svg>
  );
}
