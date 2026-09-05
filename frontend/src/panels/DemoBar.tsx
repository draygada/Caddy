import { useStore } from '../store';
import { SCENARIO } from '../lib/catalog';

export function DemoBar() {
  const step = useStore((s) => s.step);
  const advance = useStore((s) => s.advance);
  const reset = useStore((s) => s.reset);
  const atEnd = step >= SCENARIO.length - 1;
  return (
    <div className="flex-none h-11 flex items-center gap-[14px] px-4 border-t border-line2 bg-surface">
      <span className="font-mono text-[13px] font-bold whitespace-nowrap">step {step + 1} of {SCENARIO.length}</span>
      <span className="text-[14px] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{SCENARIO[step]}</span>
      <button onClick={reset} className="btn">Reset</button>
      <button onClick={advance} disabled={atEnd} className="btn btn-primary px-3" style={{ opacity: atEnd ? 0.5 : 1 }}>{atEnd ? 'end of scenario' : 'Next · →'}</button>
    </div>
  );
}
