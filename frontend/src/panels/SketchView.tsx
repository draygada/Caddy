import { useStore } from '../store';
import { PLATE_W } from '../lib/catalog';
import { CONSTRAINTS, SKETCH_COLOR, solveSketch } from '../lib/sketch';
import { fmtNum } from '../lib/units';

/** Top-down sketch of the plate profile with Fusion's constraint colours: black fully defined, blue under-constrained; amber redundant, red contradictory. */
export function SketchView() {
  const s = useStore();
  const L = s.span, W = PLATE_W;
  const r = solveSketch(s.sketch);
  const cRect = SKETCH_COLOR[r.entities.rect.state], cHoles = SKETCH_COLOR[r.entities.holes.state];
  const VBW = 760, VBH = 490;
  const sc = Math.min(560 / L, 300 / W);
  const ox = (VBW - L * sc) / 2, oy = (VBH - W * sc) / 2 + 10;
  const X = (x: number) => ox + x * sc, Y = (y: number) => oy + (W - y) * sc;
  const holeR = (s.sketch.hole_big ? 0.6 : s.geo.holeD) / 2;
  const holes: [number, number][] = [[0.25, 0.2], [L - 0.25, 0.2], [0.25, W - 0.2], [L - 0.25, W - 0.2]];
  const glyphs = (entity: 'rect' | 'holes') => CONSTRAINTS.filter((c) => c.entity === entity && s.sketch[c.id]).map((c) => c.glyph);
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, color: string) => (
    <g key={label} stroke={color} fill={color} fontFamily="Geist Mono, monospace" fontSize="12">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" />
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} strokeWidth="1" /><line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" stroke="none">{label}</text>
    </g>
  );
  const vdim = (x: number, y1: number, y2: number, label: string, color: string) => (
    <g key={label} stroke={color} fill={color} fontFamily="Geist Mono, monospace" fontSize="12">
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth="1" />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} strokeWidth="1" /><line x1={x - 4} y1={y2} x2={x + 4} y2={y2} strokeWidth="1" />
      <text x={x + 8} y={(y1 + y2) / 2 + 4} stroke="none">{label}</text>
    </g>
  );
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-2 relative" style={{ background: 'var(--surface2)' }}>
      <svg viewBox={`0 0 ${VBW} ${VBH}`} role="img" aria-label="Plate sketch with constraints" className="w-full h-full block select-none">
        {Array.from({ length: 30 }, (_, i) => <line key={'gx' + i} x1={i * 26.2} y1={0} x2={i * 26.2} y2={VBH} stroke="var(--line2)" strokeWidth="0.6" />)}
        {Array.from({ length: 20 }, (_, i) => <line key={'gy' + i} x1={0} y1={i * 26.2} x2={VBW} y2={i * 26.2} stroke="var(--line2)" strokeWidth="0.6" />)}
        <rect x={X(0)} y={Y(W)} width={L * sc} height={W * sc} fill="var(--surface)" stroke={cRect} strokeWidth={r.entities.rect.state === 'SOLVED' ? 2 : 2.5} strokeDasharray={r.entities.rect.state === 'CONTRADICTORY' ? '8 5' : undefined} />
        {holes.map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r={holeR * sc} fill="none" stroke={cHoles} strokeWidth={2} strokeDasharray={r.entities.holes.state === 'CONTRADICTORY' ? '6 4' : undefined} />)}
        {s.sketch.dim_span && dim(X(0), Y(0) + 28, X(L), Y(0) + 28, 'L = ' + fmtNum(L, s.units) + ' ' + s.units, cRect)}
        {s.sketch.dim_span_dup && dim(X(0), Y(0) + 48, X(L), Y(0) + 48, 'L = ' + fmtNum(L, s.units) + ' ' + s.units + ' (duplicate)', 'var(--amber)')}
        {s.sketch.dim_span_conflict && dim(X(0), Y(0) + 48, X(2.0), Y(0) + 48, 'L = ' + fmtNum(2.0, s.units) + ' ' + s.units + ' ≠ ' + fmtNum(L, s.units), 'var(--red)')}
        {s.sketch.dim_width && vdim(X(L) + 28, Y(W), Y(0), 'W = ' + fmtNum(W, s.units) + ' ' + s.units, cRect)}
        {s.sketch.dim_holeD && dim(X(0.25) - holeR * sc, Y(W - 0.2) - 22, X(0.25) + holeR * sc, Y(W - 0.2) - 22, '⌀ ' + fmtNum(holeR * 2, s.units), cHoles)}
        {s.sketch.hole_inset_x && dim(X(0), Y(W) - 14, X(0.25), Y(W) - 14, fmtNum(0.25, s.units), cHoles)}
        {s.sketch.hole_inset_y && vdim(X(0) - 28, Y(W), Y(W - 0.2), fmtNum(0.2, s.units), cHoles)}
        {s.sketch.holes_symmetric && <g stroke={cHoles} strokeWidth="1" strokeDasharray="4 4"><line x1={X(L / 2)} y1={Y(W) - 6} x2={X(L / 2)} y2={Y(0) + 6} /><line x1={X(0) - 6} y1={Y(W / 2)} x2={X(L) + 6} y2={Y(W / 2)} /></g>}
        <text x={X(0)} y={Y(W) - 40} fontFamily="Geist Mono, monospace" fontSize="14" fontWeight="700" fill={cRect}>rect · {r.entities.rect.state} · {glyphs('rect').join(' ')}</text>
        <text x={X(L / 2) + 10} y={Y(W / 2) - 8} fontFamily="Geist Mono, monospace" fontSize="14" fontWeight="700" fill={cHoles}>holes · {r.entities.holes.state} · {glyphs('holes').join(' ')}</text>
        <g fontFamily="Work Sans, system-ui, sans-serif" fontSize="12">
          {(['SOLVED', 'UNDER_CONSTRAINED', 'REDUNDANT', 'CONTRADICTORY'] as const).map((k, i) => (
            <g key={k}><rect x={14 + i * 170} y={VBH - 26} width={12} height={12} fill={SKETCH_COLOR[k]} rx="2" /><text x={32 + i * 170} y={VBH - 16} fill="var(--muted)">{k.toLowerCase().replace('_', '-')}</text></g>
          ))}
        </g>
      </svg>
    </div>
  );
}
