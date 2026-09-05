import { useStore, fieldKey } from '../store';
import { CATALOG, CMP_KEYS, CRYPTO_OPTIONS, KEY_GROUPS, PALETTE, RULES_EVALUATED, SLOT_LABEL, type PartId } from '../lib/catalog';
import type { Outcome } from '../lib/rules';
import { partOf, specAttrsOf } from '../lib/viewmodel';
import { NumField } from './NumField';

export function SpecPanel({ o }: { o: Outcome }) {
  const s = useStore();
  const sel = s.sel;
  const selPart = sel ? partOf(sel, s.parts, s.span) : null;
  const slot = sel && sel !== 'airframe' ? sel : null;
  const pid = slot ? s.parts[slot] : null;
  const specAttrs = slot ? specAttrsOf(slot, pid, s.attrs[slot]) : [];
  const showNoChange = !!(s.lastDiff && s.lastDiff.changed === 0);
  const pending = s.pending;
  const unconfirmedSeq = slot ? s.unconfirmed[slot] : undefined;

  return (
    <div data-panel="spec" className="panel flex-1 flex flex-col min-h-0">
      <div className="panel-head">
        <div className="panel-title">Spec <span className="sub">· {sel ? SLOT_LABEL[sel] : 'select a body'}</span></div>
        {selPart && selPart.real === false && <span className="chip">Synthetic</span>}
        {slot && !pid && <span className="chip">empty</span>}
      </div>
      <div className="overflow-auto min-h-0">
        {showNoChange && (
          <div role="status" className="px-3 py-[10px] border-b border-line2">
            <div className="flex justify-between items-center gap-2">
              <div className="font-mono text-[18px] font-bold">{RULES_EVALUATED} rules · 0 changed</div>
              <button onClick={() => s.patch({ keysOpen: !s.keysOpen })} className="btn">{s.keysOpen ? 'hide 37 keys' : 'show 37 keys'}</button>
            </div>
            <div className="text-[13px] text-muted">{s.lastKind || ''}</div>
            {s.keysOpen && KEY_GROUPS.map((g) => (
              <div key={g.name} className="pt-2">
                <div className="text-[13px] text-muted">{g.name} · {g.keys.length}</div>
                <div className="font-mono text-[13px] leading-[1.6]">{g.keys.join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
        {pending && (() => {
          const from = CATALOG[pending.from], to = CATALOG[pending.to];
          return (
            <div data-card="swap-comparison" className="px-3 py-[10px] border-b border-line2 grid gap-2">
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
        {!sel && <div className="p-3 text-[14px] text-muted">Select a body in the viewport or the palette to see and edit its specification. Drag a palette part onto the bracket to place it; drag a placed body to move it. Product status shows what the design means for compliance.</div>}
        {slot && !pid && (
          <div className="px-3 py-[10px] border-b border-line2 text-[14px] text-muted">
            no {SLOT_LABEL[slot]} in the design · drag one from the palette onto the dashed footprint, or click a palette row.
          </div>
        )}
        {slot && pid && (
          <div className="px-3 py-[10px] border-b border-line2 grid gap-1">
            <label htmlFor={slot + '.model'} className="text-[13px] text-muted">model · choosing another one is a swap and needs an attestation</label>
            <select id={slot + '.model'} value={pid} onChange={(e) => s.swap(slot, e.target.value as PartId)} className="field text-[14px]">
              {PALETTE[slot].map((id) => <option key={id} value={id}>{CATALOG[id].name}{CATALOG[id].real === false ? ' (synthetic)' : ''}</option>)}
            </select>
            <div className="text-[13px] text-muted flex flex-wrap gap-x-3 gap-y-1 items-center">
              <span>{selPart?.vendor}</span>
              <span>origin {selPart?.origin} <span className="chip chip-sm">declared</span></span>
              <button onClick={() => s.removePart(slot)} className="btn btn-xs ml-auto">Remove from design</button>
            </div>
          </div>
        )}
        {sel === 'airframe' && selPart && (
          <div className="px-3 py-[10px] border-b border-line2 text-[13px] text-muted flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span className="text-ink font-semibold">{selPart.name}</span>
            <span>{selPart.vendor}</span>
            <span>origin {selPart.origin} <span className="chip chip-sm">declared</span></span>
          </div>
        )}
        {unconfirmedSeq != null && slot && (
          <div className="px-3 py-[10px] border-b border-line2 flex justify-between items-center gap-2">
            <span className="text-[13px] font-semibold text-amber">? unconfirmed swap · seq #{unconfirmedSeq}</span>
            <button onClick={() => s.reopen(slot)} className="btn">Show comparison</button>
          </div>
        )}
        {sel === 'airframe' && (
          <>
            <div className="px-3 py-[10px] border-b border-line2">
              <label htmlFor="span" className="block text-[13px] text-muted mb-1">span · 1.5–6.0 m · accepts 3.4 · 3,4 · 3.4 m</label>
              <div className="flex gap-2 items-center">
                <input id="span" name="span" inputMode="decimal" value={s.spanText} onChange={(e) => s.patch({ spanText: e.target.value })} onBlur={() => s.setSpan(s.spanText)} onKeyDown={(e) => { if (e.key === 'Enter') s.setSpan((e.target as HTMLInputElement).value); }} aria-describedby="span-msg" className="field w-[120px] font-mono text-[16px] font-semibold" />
                <span className="text-[14px] text-muted">m · Enter applies</span>
              </div>
              <div id="span-msg" role="status" className="text-[13px] min-h-[18px] mt-1" style={{ color: s.spanErr ? 'var(--red)' : 'var(--muted)' }}>{s.spanMsg}</div>
            </div>
            <div aria-live="polite" className="px-3 py-[10px] border-b border-line2 grid gap-[6px]">
              <div className="text-[13px] text-muted">derived · usable pack fraction 0.80 · cruise 90 km/h (declared)</div>
              <div className="font-mono text-[14px]">cruise_W = 200 + 120 × (3.0/{s.span.toFixed(1)})² = <b>{o.cruiseW.toFixed(0)} W</b></div>
              <div className="font-mono text-[14px]">endurance = <b>{o.endurance != null ? o.endurance.toFixed(2) : '—'} h</b> <span className="text-muted">· pack_Wh × 0.80 / cruise_W</span></div>
              <div className="font-mono text-[14px]">range = <b>{o.range != null ? o.range.toFixed(0) : '—'} km</b> <span className="text-muted">· endurance × 90 km/h</span></div>
            </div>
          </>
        )}
        {slot && specAttrs.map((a) => {
          const key = fieldKey(slot, a.field);
          return (
            <div key={key} className="px-3 py-[10px] border-b border-line2">
              <div className="flex justify-between gap-2 items-baseline mb-1">
                <label htmlFor={key} className="text-[13px] text-muted">{a.field.label}</label>
                <span className="chip chip-sm" style={{ color: a.levelColor }}>{a.level}</span>
              </div>
              <NumField id={key} value={a.value} dp={a.field.dp} unit={a.field.unit} min={a.field.min} max={a.field.max} nullable={a.field.nullable} disabled={!pid} msg={s.fieldMsg[key]} onCommit={(text) => s.setAttr(slot, a.field, text)} />
              <div className="text-[13px] text-muted">source: {a.source}</div>
            </div>
          );
        })}
        {slot === 'fc' && pid && (
          <div className="px-3 py-[10px] border-b border-line2">
            <div className="flex justify-between gap-2 items-baseline mb-1">
              <label htmlFor="fc.crypto" className="text-[13px] text-muted">crypto</label>
              <span className="chip chip-sm">declared</span>
            </div>
            <select id="fc.crypto" value={s.attrs.fc.crypto || 'none'} onChange={(e) => s.setCrypto('fc', e.target.value)} className="field font-mono text-[14px]">
              {CRYPTO_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-[13px] text-muted mt-1">source: {s.attrs.fc.crypto && s.attrs.fc.crypto !== 'none' ? 'vendor self-classification' : 'none on part'}</div>
          </div>
        )}
        {sel && (
          <div className="px-3 py-[10px] grid gap-1">
            <div className="text-[13px] text-muted">feature history · geometry only</div>
            {s.features.map((f) => (
              <div key={f.n} className="font-mono text-[13px] grid grid-cols-[28px_1fr] gap-[6px]"><span className="text-muted">{f.n}</span><span>{f.text}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
