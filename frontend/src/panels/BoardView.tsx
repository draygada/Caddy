import { useStore } from '../store';
import type { BoardTarget } from '../lib/catalog';

/** F-20: the flight-controller board with five footprints. Copper is decorative; the layout target is the only characteristic evaluated. */
export function BoardView() {
  const s = useStore();
  const fp = [
    { name: 'U1 · IMU · LGA-14', x: 60, y: 60, w: 30, h: 30 }, { name: 'U2 · STM32H743 · LQFP-100', x: 140, y: 40, w: 110, h: 110 }, { name: 'J1 · SMA coax', x: 300, y: 60, w: 40, h: 40 },
    { name: 'R1 · 0402', x: 80, y: 150, w: 12, h: 6 }, { name: 'U3 · GNSS stand-in (ESP32 body)', x: 280, y: 130, w: 70, h: 45 },
  ];
  const tgt = s.declared.board_target;
  const entry = tgt === 'civil UAV' ? '9A991.d · AT only' : tgt === '600-series UAV' ? '3A611.g · NS1 + RS1 · LVS $1,500' : 'USML XI(c)(2)';
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4 relative" style={{ background: 'var(--surface2)' }}>
      <div className="grid gap-3 w-full max-w-[720px]">
        <svg viewBox="0 0 400 220" className="w-full block rounded-r border border-line" style={{ background: '#205840' }}>
          {fp.map((f) => <g key={f.name}><rect x={f.x} y={f.y} width={f.w} height={f.h} fill="#c9a227" stroke="#e8ecf1" strokeWidth="0.8" /><text x={f.x} y={f.y - 4} fontSize="7" fill="#e8ecf1" fontFamily="Geist Mono, monospace">{f.name}</text></g>)}
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={20 + i * 30} y1={200} x2={20 + i * 30} y2={190} stroke="#c9a227" strokeWidth="1" />)}
          <text x="10" y="212" fontSize="7" fill="#e8ecf1" fontFamily="Geist Mono, monospace">fc_bay · board.glb from kicad-cli pcb export glb · 0.17 s (fixture) · copper is decorative</text>
        </svg>
        <div className="panel p-3 grid gap-2 text-[13px]">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-muted">board_target
              <select value={tgt} disabled={s.viewSeq != null} onChange={(e) => s.setDeclared({ board_target: e.target.value as BoardTarget }, 'board_target ' + tgt + ' → ' + e.target.value)} className="btn text-ink ml-2">{(['civil UAV', '600-series UAV', 'USML article'] as BoardTarget[]).map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <span className="font-mono font-semibold">modeled candidate · {entry}</span>
            <span className="chip chip-sm">human review</span>
          </div>
          <div className="font-mono text-[12px] text-muted">DRC · kicad-cli pcb drc --format json · 0 errors · 2 warnings (silkscreen overlap) · fixture</div>
          <div className="text-[12px] text-muted">{tgt === '600-series UAV' ? 'modeled candidate: connectors under a 600-series parent print 3A611.y.1; heat sinks 3A611.y.3 · no modeled column match at CA/DE/TW/VN; CN produces a license-review trigger (RS, 742.6(a)(7)); modeled no-de-minimis flag for PRC (734.4(a)(6)(ii))' : 'layout is the only characteristic evaluated (Note) · the GNSS body is a labelled stand-in · no live re-layout'}</div>
          <div className="text-[12px] font-semibold text-amber">Declared scenario input. Outputs are limited modeled candidates for human review, not a classification, license determination, authorization, or comprehensive destination/end-use screen.</div>
        </div>
      </div>
    </div>
  );
}
