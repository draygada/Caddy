import { useState } from 'react';
import { useStore, fieldKey } from '../store';
import { BOOL_FIELDS, CATALOG, CMP_KEYS, CRYPTO_OPTIONS, GENERIC_NAME, PALETTE, SLOT_LABEL, SPAN_BASELINE, type PartId } from '../lib/catalog';
import type { Outcome } from '../lib/rules';
import { partOf, specAttrsOf } from '../lib/viewmodel';
import { fmtNum, fromUnit, toUnit } from '../lib/units';
import { parseDecimal } from '../lib/hash';
import { NumField } from './NumField';

/** spec rows the panel does not show; the rule engine still reads them */
const HIDDEN_FIELDS = new Set(['imu.bias']);

/** Specifications for the selected body: the part, the model, each number with its valid range. History and geometry sit behind the info button. */
export function SpecPanel({ o }: { o: Outcome }) {
  const s = useStore();
  const sel = s.sel;
  const selPart = sel ? partOf(sel, s.parts, s.span) : null;
  const slot = sel && sel !== 'airframe' ? sel : null;
  const pid = slot ? s.parts[slot] : null;
  const specAttrs = slot ? specAttrsOf(slot, pid, s.attrs[slot], s.extracted).filter((a) => !HIDDEN_FIELDS.has(slot + '.' + a.field.key)) : [];
  const pending = s.pending;
  const unconfirmedSeq = slot ? s.unconfirmed[slot] : undefined;
  const readOnly = s.viewSeq != null;
  const u = s.units;
  const [infoOpen, setInfoOpen] = useState(false);
  const commitSpan = (text: string) => { const p = parseDecimal(text); if (p == null) { s.setSpan(text); return; } s.setSpan(String(fromUnit(p, u))); };
  const title = slot ? GENERIC_NAME[slot] + ' Specifications' : sel === 'airframe' ? 'Airframe Specifications' : 'Specifications';
  // a frame-kind airframe is a bought frame kit, not a plate with a wing span
  const frameKit = s.geo.kind === 'frame' && s.geo.frame ? CATALOG[s.geo.frame] : null;

  return (
    <div data-panel="spec" className="panel flex flex-col relative">
      <div className="panel-head">
        <div className="panel-title">{title}{!sel && <span className="sub"> · select a body</span>}</div>
        <div className="flex items-center gap-1">
          {selPart && selPart.real === false && <span className="chip chip-sm">Synthetic</span>}
          {slot && !pid && <span className="chip chip-sm" style={{ color: 'var(--amber)' }}>empty</span>}
          {sel && <button onClick={() => setInfoOpen(true)} className="btn btn-xs btn-icon" aria-haspopup="dialog" aria-label="Feature history and geometry" title="feature history and geometry">i</button>}
          {slot && pid && !readOnly && <button onClick={() => s.removePart(slot)} className="btn btn-xs btn-icon" aria-label="Remove from design" title="Remove from design">×</button>}
        </div>
      </div>
      <div className="grid gap-x-4 px-3 py-1 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {readOnly && <div role="status" className="col-span-full py-2 text-[13px] text-amber font-semibold">replaying #{s.viewSeq} · read-only · <button onClick={() => s.viewAt(null)} className="underline">back to live</button> or restore from the timeline</div>}
        {pending && (() => {
          const from = CATALOG[pending.from], to = CATALOG[pending.to];
          return (
            <div data-card="swap-comparison" className="col-span-full py-2 grid gap-2">
              <div className="flex justify-between gap-2 items-baseline">
                <span className="text-[14px] font-semibold">Swap · {SLOT_LABEL[pending.slot]}</span>
                <span className="text-[13px] font-bold text-amber whitespace-nowrap">? unconfirmed</span>
              </div>
              <div className="font-mono text-[13px] text-muted">{from.name} → {to.name} · seq #{pending.seq} · re-classified, not inherited</div>
              {CMP_KEYS.map((k) => {
                const ch = from.cmp[k] !== to.cmp[k];
                const color = ch ? 'var(--amber)' : 'var(--muted)';
                return (
                  <div key={k} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-[2px] py-[6px] border-t border-line2">
                    <span className="font-semibold">{k === 'form' ? 'form (incl. material)' : k}</span>
                    <span className="text-[13px] font-bold" style={{ color }}>{ch ? 'changed' : 'same'}</span>
                    <span className="col-span-2 text-[13px] text-muted">{from.cmp[k]}</span>
                    <span className="col-span-2 text-[13px]" style={{ color, fontWeight: ch ? 700 : 400 }}>→ {to.cmp[k]}</span>
                  </div>
                );
              })}
              <input id="attestor" aria-label="attestor, required" value={s.attestor} onChange={(e) => s.patch({ attestor: e.target.value, confirmErr: '' })} placeholder="attestor · required" className="field" style={{ borderColor: s.confirmErr ? 'var(--red)' : 'var(--line)' }} />
              <input aria-label="intent, optional, one line" value={s.intent} onChange={(e) => s.patch({ intent: e.target.value })} placeholder="intent · optional, one line" className="field" />
              {s.confirmErr && <div role="alert" className="text-[13px] text-red font-semibold">{s.confirmErr}</div>}
              <button onClick={() => s.confirm()} className="btn btn-primary btn-lg text-left leading-[1.25]">Confirm: same function, performance, form and fit</button>
              <button onClick={s.leaveUnconfirmed} className="btn btn-lg">Leave unconfirmed</button>
              <div className="text-[13px] text-muted">{pending.changed.length ? 'Changed: ' + pending.changed.join(', ') + ' · the (b)(3) open fact stays in Flags.' : 'Comparator unchanged · still compared and confirmed, never copied.'}</div>
            </div>
          );
        })()}
        {!sel && <div className="col-span-full py-2 text-[14px] text-muted">Select a body in the model or the browser to see and edit its specification.</div>}
        {slot && (
          <div className="py-2 grid gap-1">
            <label htmlFor={slot + '.model'} className="text-[13px] text-muted">model</label>
            <select id={slot + '.model'} value={pid ?? ''} disabled={readOnly} onChange={(e) => { const next = e.target.value as PartId; if (!next) return; if (pid) s.swap(slot, next); else s.place(slot, next); }} className="field text-[14px] disabled:opacity-50">
              {!pid && <option value="">Choose a model</option>}
              {PALETTE[slot].map((id) => <option key={id} value={id}>{CATALOG[id].name}{CATALOG[id].real === false ? ' (synthetic)' : ''}</option>)}
            </select>
            {pid && selPart && <div className="text-[13px] text-muted flex flex-wrap gap-x-3 gap-y-1 items-center"><span>{selPart.vendor}</span><span>origin {selPart.origin}</span></div>}
          </div>
        )}
        {sel === 'airframe' && selPart && (
          <div className="col-span-full py-2 text-[13px] text-muted flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span className="text-ink font-semibold">{frameKit ? frameKit.name + ' · ' + frameKit.mpn : selPart.name}</span>
            <span>{frameKit ? frameKit.vendor : selPart.vendor}</span>
            <span>origin {frameKit ? frameKit.origin : selPart.origin}</span>
          </div>
        )}
        {unconfirmedSeq != null && slot && (
          <div className="col-span-full py-2 flex justify-between items-center gap-2">
            <span className="text-[13px] font-semibold text-amber">? unconfirmed swap · seq #{unconfirmedSeq}</span>
            <button onClick={() => s.reopen(slot)} className="btn">Show comparison</button>
          </div>
        )}
        {sel === 'airframe' && !frameKit && (
          <div className="py-2">
            <label htmlFor="span" className="block text-[13px] text-muted mb-1">span</label>
            <div className="flex gap-2 items-center">
              <input id="span" name="span" inputMode="decimal" key={u + s.span} defaultValue={toUnit(s.span, u).toFixed(u === 'mm' ? 0 : 2)} disabled={readOnly} onBlur={(e) => commitSpan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitSpan((e.target as HTMLInputElement).value); }} aria-describedby="span-msg" className="field w-[120px] font-mono text-[16px] font-semibold disabled:opacity-50" />
              <span className="text-[13px] text-muted">{u} · {fmtNum(1.5, u)}–{fmtNum(6.0, u)}</span>
            </div>
            <div id="span-msg" role="status" className="text-[13px] min-h-[18px] mt-1" style={{ color: s.spanErr ? 'var(--red)' : 'var(--muted)' }}>{s.spanMsg}</div>
          </div>
        )}
        {slot && specAttrs.map((a) => {
          const key = fieldKey(slot, a.field);
          return (
            <div key={key} className="py-2">
              <div className="flex justify-between gap-2 items-baseline mb-1">
                <label htmlFor={key} className="text-[13px] text-muted">{a.field.label}</label>
                {a.level === 'missing' && <span className="chip chip-sm" style={{ color: 'var(--amber)' }}>missing</span>}
              </div>
              <NumField id={key} value={a.value} dp={a.field.dp} unit={a.field.unit} min={a.field.min} max={a.field.max} nullable={a.field.nullable} disabled={!pid || readOnly} msg={s.fieldMsg[key]} onCommit={(text) => s.setAttr(slot, a.field, text)} />
            </div>
          );
        })}
        {slot && pid && BOOL_FIELDS[slot].length > 0 && (
          <div className="py-2 grid gap-1">
            <div className="text-[13px] text-muted">features</div>
            {BOOL_FIELDS[slot].map((b) => (
              <label key={b.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!s.attrs[slot][b.key]} disabled={readOnly} onChange={(e) => s.setBool(slot, b.key, e.target.checked)} /> {b.label}</label>
            ))}
          </div>
        )}
        {slot === 'fc' && pid && (
          <div className="py-2">
            <label htmlFor="fc.crypto" className="block text-[13px] text-muted mb-1">crypto</label>
            <select id="fc.crypto" value={s.attrs.fc.crypto || 'none'} disabled={readOnly} onChange={(e) => s.setCrypto('fc', e.target.value)} className="field font-mono text-[14px]">
              {CRYPTO_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
      {infoOpen && sel && (
        <>
          <div className="fixed inset-0 z-[29] bg-scrim" onMouseDown={() => setInfoOpen(false)} />
          <div role="dialog" aria-label="Feature history and geometry" className="fixed z-[30] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,520px)] max-h-[80vh] panel flex flex-col">
            <div className="panel-head"><div className="panel-title">{title} <span className="sub">· history and geometry</span></div><button onClick={() => setInfoOpen(false)} className="btn btn-xs btn-icon" aria-label="Close" title="Close · Esc">×</button></div>
            <div className="overflow-auto min-h-0 p-3 grid gap-3 text-[13px]">
              {sel === 'airframe' && (
                <div className="grid gap-[6px]">
                  <div className="text-muted">geometry · usable pack fraction 0.80 · cruise 90 km/h (declared)</div>
                  <div className="font-mono">cruise_W = 200 + 120 × ({SPAN_BASELINE.toFixed(1)}/{s.span.toFixed(1)})² = <b>{o.cruiseW.toFixed(0)} W</b></div>
                  <div className="font-mono">endurance = <b>{o.endurance != null ? o.endurance.toFixed(2) : '·'} h</b> <span className="text-muted">· pack_Wh × 0.80 / cruise_W</span></div>
                  <div className="font-mono">range = <b>{o.range != null ? o.range.toFixed(0) : '·'} km</b> <span className="text-muted">· endurance × 90 km/h</span></div>
                </div>
              )}
              <div className="grid gap-1">
                <div className="text-muted">feature history · geometry only</div>
                {s.features.length === 0 && <div className="text-muted">no features yet</div>}
                {s.features.map((f) => (
                  <div key={f.n} className="font-mono grid grid-cols-[28px_1fr] gap-[6px]"><span className="text-muted">{f.n}</span><span>{f.text}</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
