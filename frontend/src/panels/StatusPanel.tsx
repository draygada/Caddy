import { useStore, intakeIncomplete } from '../store';
import type { Outcome } from '../lib/rules';
import { attentionOf, overallOf, slotStatus } from '../lib/viewmodel';
import { CORE_SLOTS, GENERIC_NAME, SLOTS, type Node } from '../lib/catalog';

const CLEAN = 'no match · limited scan';

/** Product status: the overall word, then only the parts that need a look. Clean parts roll up into one line. */
export function StatusPanel({ o }: { o: Outcome }) {
  const unconfirmed = useStore((s) => s.unconfirmed);
  const parts = useStore((s) => s.parts);
  const sel = useStore((s) => s.sel);
  const select = useStore((s) => s.select);
  const openReasoning = useStore((s) => s.openReasoning);
  const setWorkspace = useStore((s) => s.setWorkspace);
  const incomplete = useStore((s) => intakeIncomplete(s.project?.intake ?? null));
  const components = useStore((s) => s.project?.components);
  // the airframe, every component type in the project, and anything placed
  const nodes: Node[] = ['airframe', ...SLOTS.filter((sl) => !!parts[sl] || (components ?? CORE_SLOTS).includes(sl))];
  const overall = overallOf(o);
  const attentionCount = attentionOf(o, unconfirmed).length;
  const statuses = nodes.map((n) => ({ n, st: slotStatus(o, unconfirmed, n) }));
  const concern = statuses.filter((x) => x.st.word !== CLEAN);
  const clean = statuses.filter((x) => x.st.word === CLEAN);
  const name = (n: Node) => (n === 'airframe' ? 'Airframe' : GENERIC_NAME[n] + (parts[n] ? '' : ' · empty'));
  return (
    <div data-panel="status" aria-live="polite" className="panel flex-none">
      <div className="panel-head">
        <div className="panel-title">Product status <span className="sub">· as designed</span></div>
        <span className="flex gap-1">
          <button onClick={openReasoning} className="btn">Reasoning · {attentionCount}</button>
          <button onClick={() => setWorkspace('sourcing')} className="btn btn-primary">Source this design</button>
        </span>
      </div>
      {incomplete ? (
        <div className="p-3 grid gap-2 border-b border-line2">
          <span className="status-word text-[18px] justify-self-start" style={{ color: 'var(--amber)' }}>? Requires more information</span>
          <div className="text-[13px]">The use-case answers are missing or “not sure yet”. Classification can be computed on the parts alone, but the product status is not complete until the end use, the end user and the aircraft question are answered.</div>
          <button onClick={() => useStore.getState().patch({ intakeOpen: true })} className="btn btn-primary justify-self-start">Answer the questions</button>
        </div>
      ) : (
        <div className="p-3 grid gap-1 border-b border-line2">
          <span className="status-word text-[20px] justify-self-start" style={{ color: overall.color, background: overall.bg }}>{overall.glyph} {overall.word}</span>
        </div>
      )}
      <div className="px-3 py-2 grid">
        <div className="flex justify-between items-baseline pb-1">
          <span className="text-[13px] text-muted">{concern.length ? 'parts that need a look' : 'no part needs a look'}</span>
          <button onClick={() => setWorkspace('classification')} className="btn btn-xs">see classification</button>
        </div>
        {concern.map(({ n, st }) => (
          <button key={n} onClick={() => select(n)} className="row-hover grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-baseline min-h-7 py-[3px] px-1 -mx-1 text-left bg-transparent border-0 text-ink cursor-pointer rounded-r" style={{ background: sel === n ? 'var(--surface2)' : 'transparent' }}>
            <span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-[14px]">{name(n)}</span>
            <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: st.color }}>{st.word}</span>
          </button>
        ))}
        {clean.length > 0 && (
          <div className="text-[13px] text-muted py-[3px] px-1"><b className="text-ink">{clean.length} part{clean.length === 1 ? '' : 's'}</b> · no match in the modeled rows · {clean.map(({ n }) => name(n)).join(', ')}</div>
        )}
      </div>
    </div>
  );
}
