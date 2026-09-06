import { useStore } from '../store';
import { STATUS_WORD } from '../lib/sourcing';

/** /record: the printable design decision record. Cmd-P prints it; no PDF library. */
export function Record({ embedded = false }: { embedded?: boolean } = {}) {
  const s = useStore();
  const r = s.round;
  const design = s.events.filter((e) => e.lane === 'design').slice().reverse();
  const sourcing = s.events.filter((e) => e.lane === 'sourcing' || e.lane === 'order').slice().reverse();
  const footer = (
    <div className="text-[11px] text-muted border-t border-line2 pt-2 mt-4 grid gap-1">
      <div>22 CFR 120.41 Note 2: documents contemporaneous with development, in their totality · 22 CFR 122.5(a): none of it may be altered once recorded</div>
      <div>15 CFR 762.2 · 19 CFR 163.4 · 31 CFR 501.601 · retention computed per transaction as the longest applicable window (ITAR printed as five years from the 122.5 anchor; anchor and period to be confirmed from the section)</div>
      <div>local demo record shaped for human review; a broker validates applicability and retention · sequence markers and the tamper control are simulations, not signatures or a cryptographic hash chain · production KMS/HSM-backed key custody is a roadmap requirement · rendered from current local event and round projections</div>
    </div>
  );
  return (
    <div role="dialog" aria-label="Design decision record" className="absolute inset-0 bg-bg z-[9] flex flex-col overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface print:hidden">
        <span className="min-w-0 break-words text-[13px] font-semibold">/record <span className="text-muted font-normal">· design decision record · printable</span></span>
        <span className="flex flex-wrap gap-2"><button onClick={() => window.print()} className="btn btn-primary">Print · Cmd-P</button>{!embedded && <button onClick={() => s.patch({ recordOpen: false })} className="btn">Close · Esc</button>}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-surface text-ink">
        <div className="grid w-full min-w-0 max-w-[880px] mx-auto gap-6 text-[13px] [overflow-wrap:anywhere]" id="record">
          <section className="min-w-0 break-after-page">
            <h1 className="text-[20px] font-bold m-0">Design decision record · Kestrel</h1>
            <div className="text-muted">local event head #{s.events.length} · sequence marker {s.events[0]?.hash} · export pack {s.pack} · printed {new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
            <h2 className="text-[15px] font-semibold mt-4 mb-1">1 · Design events</h2>
            <div className="max-w-full overflow-x-auto overscroll-x-contain print:overflow-visible">
              <table className="w-full min-w-[720px] border-collapse print:min-w-0"><thead><tr className="text-left text-muted"><th className="py-1 pr-2">#</th><th className="pr-2">kind</th><th className="pr-2">what</th><th className="pr-2">paragraph · number</th><th>intent</th></tr></thead>
                <tbody>{design.map((e) => <tr key={e.seq} className="border-t border-line2 align-top"><td className="py-1 pr-2 font-mono">{e.seq}</td><td className="pr-2 font-mono">{e.kind}</td><td className="pr-2">{e.text}</td><td className="pr-2 text-muted">{e.entry}</td><td className="italic text-muted">{e.intent || '(none typed)'}</td></tr>)}</tbody></table>
            </div>
            {footer}
          </section>
          <section className="min-w-0 break-after-page">
            <h2 className="text-[15px] font-semibold mb-1">2 · Party trees and outcomes</h2>
            {!r && <div className="text-muted">no round opened</div>}
            {r && Object.entries(r.offers).flatMap(([lineId, list]) => list.map((ro) => (
              <div key={ro.offer.id} className="border-t border-line2 py-1">
                <b>{r.lines.find((l) => l.id === lineId)?.description}</b> · {ro.offer.seller} · {STATUS_WORD[ro.status]} · {ro.tier} · {ro.because}
                <div className="text-muted text-[12px]">{ro.tree.children.map((c) => c.name + ' (' + c.role + (c.pct != null ? ' ' + c.pct + ' %' : '') + ' · ' + c.screening + ')').join(' · ') || 'no children walked'}</div>
              </div>
            )))}
            {footer}
          </section>
          <section className="min-w-0 break-after-page">
            <h2 className="text-[15px] font-semibold mb-1">3 · Selections with declined alternatives and reasons</h2>
            {r && Object.entries(r.selections).map(([lineId, sel]) => (
              <div key={lineId} className="border-t border-line2 py-1"><b>{r.lines.find((l) => l.id === lineId)?.description}</b> · selected {r.offers[lineId]?.find((x) => x.offer.id === sel.offerId)?.offer.seller} · attestor {sel.attestor} · #{sel.seq}
                <div className="text-muted text-[12px]">{sel.declined.length ? sel.declined.map((d) => 'declined ' + d.seller + ' · ' + d.reason + ' · was ' + STATUS_WORD[d.statusAtDecline]).join(' · ') : 'no alternatives shown'}</div>
              </div>
            ))}
            {r && Object.keys(r.selections).length === 0 && <div className="text-muted">no selections</div>}
            <h2 className="text-[15px] font-semibold mt-4 mb-1">4 · Estimate ladders</h2>
            {r && Object.entries(r.selections).map(([lineId, sel]) => { const ro = r.offers[lineId]?.find((x) => x.offer.id === sel.offerId); return ro ? <div key={lineId} className="border-t border-line2 py-1"><b>{ro.offer.seller}</b> · {ro.ladder.rows.map((rw) => rw.layer + ' ' + rw.rate + (rw.amount != null ? ' $' + rw.amount.toFixed(2) : '')).join(' · ')} · total {ro.ladder.total?.toFixed(2) ?? 'rate not verified'} · hash {ro.ladder.hash}</div> : null; })}
            <h2 className="text-[15px] font-semibold mt-4 mb-1">5 · Technical-data declarations and export gates</h2>
            {r?.declaration ? <div>{r.declaration.personStatus} · {r.declaration.sharing} · reference {r.declaration.reference || 'none'} (typed, not validated) · attestor {r.declaration.attestor}</div> : <div className="text-muted">none</div>}
            {r && Object.entries(r.references).map(([lineId, ref]) => <div key={lineId}>{r.lines.find((l) => l.id === lineId)?.description} · reference {ref.ref} · typed, not validated · attestor {ref.attestor}</div>)}
            <h2 className="text-[15px] font-semibold mt-4 mb-1">6 · Sourcing and order events</h2>
            {sourcing.map((e) => <div key={e.seq} className="border-t border-line2 py-1"><span className="font-mono">#{e.seq} {e.kind}</span> · {e.text} <span className="text-muted">· {e.entry}</span></div>)}
            {s.memos.length > 0 && <><h2 className="text-[15px] font-semibold mt-4 mb-1">7 · Intent memos</h2>{s.memos.map((m) => <pre key={m.id} className="whitespace-pre-wrap font-sans text-[12px] border-t border-line2 py-1 m-0">{m.text}{'\n'}attested by {m.signedBy} · local content marker {m.hash}</pre>)}</>}
            {footer}
          </section>
        </div>
      </div>
    </div>
  );
}
