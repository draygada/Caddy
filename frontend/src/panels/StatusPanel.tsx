import { useStore, intakeIncomplete } from '../store';
import type { Outcome } from '../lib/rules';
import { overallOf, slotStatus } from '../lib/viewmodel';
import { CORE_SLOTS, GENERIC_NAME, SLOTS, type Node } from '../lib/catalog';

const CLEAN = 'no match · limited scan';

/** Product status: the overall word, then only the parts that need a look. Clean parts roll up into one line. */
export function StatusPanel({ o, onClose }: { o: Outcome; onClose?: () => void }) {
  const unconfirmed = useStore((s) => s.unconfirmed);
  const parts = useStore((s) => s.parts);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  const incomplete = useStore((s) => intakeIncomplete(s.project?.intake ?? null));
  const components = useStore((s) => s.project?.components);
  // the airframe, every component type in the project, and anything placed
  const nodes: Node[] = ['airframe', ...SLOTS.filter((sl) => !!parts[sl] || (components ?? CORE_SLOTS).includes(sl))];
  const overall = overallOf(o);
  const statuses = nodes.map((n) => ({ n, st: slotStatus(o, unconfirmed, n) }));
  const concern = statuses.filter((x) => x.st.word !== CLEAN);
  const clean = statuses.filter((x) => x.st.word === CLEAN);
  const name = (n: Node) => (n === 'airframe' ? 'Airframe' : GENERIC_NAME[n] + (parts[n] ? '' : ' · empty'));
  return (
    <div data-panel="status" aria-live="polite" className="panel flex-none">
      <div className="panel-head py-[6px]">
        <div className="panel-title">Product status</div>
        <div className="flex gap-1">
          <button onClick={() => useStore.getState().setWorkspace('classification')} className="btn btn-xs btn-primary" title="the full reasoning, part by part">View classification</button>
          {onClose && <button onClick={onClose} className="btn btn-xs btn-icon" aria-label="Close" title="Close · Esc">×</button>}
        </div>
      </div>
      {incomplete ? (
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-line2">
          <span className="status-word text-[14px]" style={{ color: 'var(--amber)' }}>? Requires more information</span>
          <button onClick={() => useStore.getState().patch({ intakeOpen: true })} className="btn btn-xs" title="the use-case answers are missing or not sure yet; the status is not complete until they are answered">answer them</button>
        </div>
      ) : (
        <div className="px-3 py-2 border-b border-line2">
          <span className="status-word text-[14px]" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>
        </div>
      )}
      <div className="px-3 py-1 grid">
        {concern.map(({ n, st }) => (
          <button key={n} onClick={() => select(n)} className="row-hover grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-baseline min-h-6 py-[1px] px-1 -mx-1 text-left bg-transparent border-0 text-ink cursor-pointer rounded-r" style={{ background: sel === n ? 'var(--surface2)' : 'transparent' }}>
            <span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-[13px]">{name(n)}</span>
            <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: st.color }}>{st.word}</span>
          </button>
        ))}
        {clean.length > 0 && (
          <div className="text-[12px] text-muted py-[2px] px-1 whitespace-nowrap overflow-hidden text-ellipsis" title={clean.map(({ n }) => name(n)).join(', ')}><b className="text-ink">{clean.length} part{clean.length === 1 ? '' : 's'}</b> · no match · {clean.map(({ n }) => name(n)).join(', ')}</div>
        )}
        {concern.length === 0 && clean.length === 0 && <div className="text-[12px] text-muted py-[2px] px-1">no parts placed</div>}
      </div>
    </div>
  );
}
