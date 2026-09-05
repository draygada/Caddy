import { useStore } from '../store';
import { LANES } from '../lib/catalog';
import { hashOf } from '../lib/hash';

export function Timeline() {
  const events = useStore((s) => s.events);
  const lane = useStore((s) => s.lane);
  const copied = useStore((s) => s.copied);
  const rederive = useStore((s) => s.rederive);
  const closeAll = useStore((s) => s.closeAll);
  const patch = useStore((s) => s.patch);
  const copy = useStore((s) => s.copy);
  const rederiveLog = useStore((s) => s.rederiveLog);
  const filtered = lane === 'all' ? events : events.filter((e) => e.lane === lane);
  const shown = filtered.slice(0, 8);
  return (
    <>
      <div onClick={closeAll} className="absolute inset-0 bg-scrim z-[5]" />
      <div role="dialog" aria-label="Timeline" className="absolute top-0 right-0 bottom-0 w-[460px] bg-surface border-l border-line z-[6] flex flex-col shadow-[-8px_0_24px_rgba(0,0,0,.12)]">
        <div className="flex items-center justify-between gap-2 px-[14px] py-[10px] border-b border-line2">
          <div className="text-[13px] font-semibold">Timeline <span className="text-muted font-normal">· newest first · {shown.length} of {events.length}</span></div>
          <button onClick={closeAll} className="btn">Close · Esc</button>
        </div>
        <div role="radiogroup" aria-label="Lane filter" className="flex gap-1 px-[14px] py-2 border-b border-line2">
          {LANES.map((l) => (
            <button key={l} role="radio" aria-checked={lane === l} onClick={() => patch({ lane: l })} className="btn font-semibold" style={{ background: lane === l ? 'var(--accent)' : 'transparent', color: lane === l ? 'var(--accentfg)' : 'var(--ink)' }}>{l}</button>
          ))}
        </div>
        <div aria-live="polite" className="flex-1 overflow-auto min-h-0">
          {filtered.length === 0 && <div className="px-[14px] py-4 text-[14px] text-muted">no events in this lane</div>}
          {shown.map((e) => {
            const hash = e.hash || hashOf(e.seq);
            return (
              <div key={e.seq} className="grid grid-cols-[44px_1fr] gap-x-[10px] px-[14px] py-[10px] border-b border-line2" style={{ background: e.word.startsWith('unconfirmed') ? 'var(--surface2)' : 'transparent' }}>
                <div className="font-mono text-[13px] text-muted border-r-2 border-line pt-[2px]">#{e.seq}</div>
                <div className="grid gap-[2px] min-w-0">
                  <div className="flex gap-2 items-baseline flex-wrap">
                    <span className="font-mono font-semibold">{e.kind}</span>
                    <span className="chip chip-sm">{e.lane}</span>
                    <span className="text-[13px] font-bold" style={{ color: e.color }}>{e.word}</span>
                  </div>
                  <div className="text-[14px]">{e.text}</div>
                  <div className="text-[13px] text-muted font-mono">{e.entry}</div>
                  <div className="text-[13px] text-muted italic">intent: {e.intent || '(none typed)'}</div>
                  <div className="text-[13px] text-muted font-mono flex gap-[6px] items-center">
                    {hash} <button onClick={() => copy(e.seq, hash)} className="btn btn-xs">{copied === e.seq ? 'copied' : 'copy'}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-[14px] py-[10px] border-t border-line2 grid gap-2">
          <div className="flex gap-2 items-center">
            <button onClick={rederiveLog} className="btn btn-lg px-[14px]">Re-derive</button>
            <span className="text-[13px] text-muted">replays the log through the rules; nothing is deletable · undo is supersede.</span>
          </div>
          {rederive && (
            <>
              <div role="status" className="font-mono text-[18px] font-bold">{rederive.line}</div>
              <div className="text-[13px] text-muted">{rederive.detail} · ephemeral demo key (production: KMS/HSM)</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
