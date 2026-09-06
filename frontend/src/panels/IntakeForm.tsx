import type { Intake } from '../store';
import { SHIP_TO, type Mode, type ShipTo } from '../lib/sourcing';

const END_USES: Intake['endUse'][] = ['civil survey and mapping', 'agriculture', 'public safety', 'infrastructure inspection', 'defense-adjacent research', 'other', 'not sure yet'];
const END_USERS: Intake['endUser'][] = ['commercial operator', 'university', 'government agency (civil)', 'military or defense prime', 'not sure yet'];
const USED_ON: Intake['usedOn'][] = ['none', 'in-production unlisted aircraft', 'listed military aircraft', 'not sure yet'];

/** The use-case questions every project answers before classification and sourcing can complete. Declared facts, badged, never inferred. */
export function IntakeForm({ value, onChange, disabled = false }: { value: Intake; onChange: (next: Intake) => void; disabled?: boolean }) {
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 text-[13px]">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-muted">what is the product for?<select value={value.endUse} disabled={disabled} onChange={(e) => set('endUse', e.target.value as Intake['endUse'])} className="field text-ink">{END_USES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="grid gap-1 text-muted">who is the end user?<select value={value.endUser} disabled={disabled} onChange={(e) => set('endUser', e.target.value as Intake['endUser'])} className="field text-ink">{END_USERS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="grid gap-1 text-muted">where does it ship?<select value={value.shipTo} disabled={disabled} onChange={(e) => set('shipTo', e.target.value as ShipTo)} className="field text-ink">{SHIP_TO.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
        <label className="grid gap-1 text-muted">is the pod used on an aircraft?<select value={value.usedOn} disabled={disabled} onChange={(e) => set('usedOn', e.target.value as Intake['usedOn'])} className="field text-ink">{USED_ON.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="grid gap-1 text-muted">units<input type="number" min={1} max={500} value={value.qty} disabled={disabled} onChange={(e) => set('qty', Math.max(1, Math.min(500, +e.target.value || 1)))} className="field font-mono text-ink" /></label>
        <label className="grid gap-1 text-muted">transport<select value={value.mode} disabled={disabled} onChange={(e) => set('mode', e.target.value as Mode)} className="field text-ink"><option value="air">air</option><option value="ocean">ocean</option></select></label>
      </div>
      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.civilProduct} disabled={disabled} onChange={(e) => set('civilProduct', e.target.checked)} /> declared a civil product <span className="chip chip-sm">declared</span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.bvlos} disabled={disabled} onChange={(e) => set('bvlos', e.target.checked)} /> beyond visual line of sight</label>
      </div>
      <input aria-label="notes" placeholder="anything else about the use case · one line, goes on the record" value={value.notes} disabled={disabled} onChange={(e) => set('notes', e.target.value)} className="field" />
      <div className="text-[12px] text-muted">These answers are declared facts. They print on the record and beside every sourcing pick. "Not sure yet" is allowed; classification and sourcing will ask for the answer before they complete.</div>
    </div>
  );
}
