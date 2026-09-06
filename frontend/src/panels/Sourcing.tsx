import { useEffect, useMemo, useState } from 'react';
import { useStore, designHashOf, INTAKE_DEFAULT, intakeIncomplete, type Intake, type Round } from '../store';
import type { Outcome } from '../lib/rules';
import { GENERIC_NAME, type Slot } from '../lib/catalog';
import { THUMBS, AF_THUMB } from '../lib/geometry';
import { IntakeForm } from './IntakeForm';
import { CHECKLIST, CLAIM_COST, CLAIM_PACKAGE, CLAIM_SCREEN, DECLINE_REASONS, FIXTURES, SHIP_TO, STATUS_COLOR, STATUS_WORD, WARNINGS, escalationReason, gateFor, sortOffers, supplierQuestions, type DeclineReason, type Line, type Mode, type PartyNode, type ResolvedOffer, type ShipTo } from '../lib/sourcing';
import { OperationsClient, OperationsServiceError, loadOperationsCandidateIdentity, type LiveSourcingOffer, type OperationsEnvelope, type ServiceOffer, type SourcingDispatchEnvelope, type SourcingPackageEnvelope, type SourcingRoundEnvelope } from '../lib/operations-client';
import { OrderClient, OrderServiceError, type OrderEnvelope, type RecordingOutcome } from '../lib/order-client';

const usd = (v: number | null | undefined) => (v == null ? 'rate not verified' : v.toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
const FEDERAL_BUYER_CLASSES = ['radio', 'motor', 'thermal_imager', 'ic', 'board', 'cell', 'pack', 'gnss', 'esc'];

function serviceError(error: unknown): string {
  return error instanceof OperationsServiceError || error instanceof OrderServiceError ? `${error.code} · ${error.message}` : error instanceof Error ? error.message : 'Unknown service error';
}

function ownerNames(offer: ServiceOffer): string {
  const names: string[] = [];
  const visit = (node: ServiceOffer['ownership_walk']['seller']) => {
    names.push(node.name + (node.pct ? ` (${node.pct}%)` : ''));
    node.owners.forEach(visit);
  };
  visit(offer.ownership_walk.seller);
  if (offer.ownership_walk.manufacturer) visit(offer.ownership_walk.manufacturer);
  return names.join(' → ');
}

/** The connected service round: kept as a component, not mounted in the three-step tab. */
export function ServiceSourcing() {
  const [quantity, setQuantity] = useState(2);
  const [mode, setMode] = useState<'air' | 'ocean'>('air');
  const [inputMode, setInputMode] = useState<'live-bounded' | 'offline-demo'>('live-bounded');
  const [seller, setSeller] = useState('Operator-provided supplier');
  const [manufacturer, setManufacturer] = useState('Operator-provided manufacturer');
  const [origin, setOrigin] = useState('US');
  const [unitPrice, setUnitPrice] = useState('100.00');
  const [leadDays, setLeadDays] = useState(7);
  const [screeningStatus, setScreeningStatus] = useState<'NO_CANDIDATE_MATCH' | 'POTENTIAL_MATCH' | 'UNKNOWN'>('UNKNOWN');
  const [screeningSource, setScreeningSource] = useState('Operator-provided screening record');
  const [screeningText, setScreeningText] = useState('Screening scope and result not yet supplied.');
  const [screeningComplete, setScreeningComplete] = useState(false);
  const [ownershipComplete, setOwnershipComplete] = useState(false);
  const [screeningAttestor, setScreeningAttestor] = useState('operator:browser-demo');
  const [client, setClient] = useState<OperationsClient | null>(null);
  const [round, setRound] = useState<SourcingRoundEnvelope | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [pkg, setPkg] = useState<SourcingPackageEnvelope | null>(null);
  const [dispatch, setDispatch] = useState<SourcingDispatchEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [orderClient, setOrderClient] = useState<OrderClient | null>(null);
  const [orderEvidence, setOrderEvidence] = useState<OrderEnvelope | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [orderRetry, setOrderRetry] = useState<{ label: string; action: (api: OrderClient) => Promise<OrderEnvelope> } | null>(null);
  const [validatedManifest, setValidatedManifest] = useState<string | null>(null);
  const [recordingOutcome, setRecordingOutcome] = useState<RecordingOutcome>('DISPATCHED');
  const [orderKey, setOrderKey] = useState('');
  const [acknowledgementRef, setAcknowledgementRef] = useState('evidence:operator-observed-recording');
  const [resolutionRef, setResolutionRef] = useState('');
  const [reconciledEffect, setReconciledEffect] = useState<'NOT_SENT' | 'SENT'>('NOT_SENT');

  const currentClient = async () => {
    if (client) return client;
    const identity = await loadOperationsCandidateIdentity();
    const next = new OperationsClient(identity);
    setClient(next);
    return next;
  };
  const run = async (label: string, action: (value: OperationsClient) => Promise<void>) => {
    setBusy(label);
    setError(null);
    try { await action(await currentClient()); } catch (caught) { setError(serviceError(caught)); } finally { setBusy(null); }
  };
  const currentOrderClient = async () => {
    if (orderClient) return orderClient;
    const operations = await currentClient();
    const next = new OrderClient(operations.candidate);
    setOrderClient(next);
    return next;
  };
  const runOrder = async (label: string, action: (value: OrderClient) => Promise<OrderEnvelope>) => {
    setOrderBusy(label);
    setOrderError(null);
    try {
      const value = await action(await currentOrderClient());
      setOrderEvidence(value);
      setOrderRetry(null);
    } catch (caught) {
      setOrderError(serviceError(caught));
      setOrderRetry({ label, action });
    } finally {
      setOrderBusy(null);
    }
  };
  const evidence: OperationsEnvelope | null = dispatch ?? pkg ?? round ?? client?.getLastValid('sourcing') ?? null;
  const visibleOrderEvidence = orderEvidence ?? orderClient?.getLastValid() ?? null;
  const receipt = visibleOrderEvidence?.receipt;
  const now = () => new Date().toISOString();
  const actor = 'operator:browser-demo';
  const createRound = (api: OperationsClient) => {
    if (inputMode === 'offline-demo') return api.createSourcingRound({ part_key: 'flight-controller', quantity, mode, input_mode: 'offline-demo' });
    const evidence = {
      status: screeningStatus,
      source_name: screeningSource,
      source_text: screeningText,
      checked_at: now(),
      attestor: screeningAttestor,
      complete: screeningComplete,
    } as const;
    const offer: LiveSourcingOffer = {
      offer_id: `offer:user:${seller.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'supplier'}`,
      part_key: 'flight-controller',
      seller,
      manufacturer,
      origin: origin.toUpperCase(),
      ship_from: origin.toUpperCase(),
      unit_price_usd: unitPrice,
      lead_days: leadDays,
      declared_hts: '8542.31',
      declared_eccn: 'not-independently-verified',
      screening_evidence: { seller: evidence, manufacturer: evidence, ownership_complete: ownershipComplete },
    };
    return api.createSourcingRound({ part_key: 'flight-controller', quantity, mode, input_mode: 'live-bounded', offers: [offer] });
  };

  return (
    <section className="panel min-w-0 lg:col-span-2" aria-label="Service-backed sourcing">
      <div className="panel-head flex-wrap gap-2">
        <div className="panel-title">Service-backed sourcing <span className="sub">· client-carried continuity</span></div>
        <span className="chip">{evidence ? evidence.status : 'not run'}</span>
      </div>
      <div className="p-3 grid gap-3 text-[13px]">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-muted">input lane<select value={inputMode} onChange={(event) => { setInputMode(event.target.value as typeof inputMode); setRound(null); setSelectedOffer(null); setPkg(null); setDispatch(null); }} className="field text-ink"><option value="live-bounded">Connected Candidate 0.2 input</option><option value="offline-demo">Offline demo · 2-key fixture</option></select></label>
          <label className="grid gap-1 text-muted">quantity<input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))} className="field w-28 font-mono text-ink" /></label>
          <label className="grid gap-1 text-muted">mode<select value={mode} onChange={(event) => setMode(event.target.value as 'air' | 'ocean')} className="field text-ink"><option value="air">air</option><option value="ocean">ocean</option></select></label>
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => run('round', async (api) => { const value = await createRound(api); setRound(value); setSelectedOffer(value.round.selected_offer_id); setPkg(null); setDispatch(null); })}>{busy === 'round' ? 'Creating…' : inputMode === 'offline-demo' ? 'Run Offline demo' : 'Create connected bounded round'}</button>
        </div>
        {inputMode === 'live-bounded' && (
          <div className="border border-line2 rounded-r p-3 grid gap-2" aria-label="Connected Candidate 0.2 sourcing input">
            <div className="flex flex-wrap justify-between gap-2"><b>User-provided offer + screening evidence</b><span className="text-[12px] text-muted">connected Candidate 0.2 service · hashed · revalidated each request · never full-list clearance</span></div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
              <label className="grid gap-1 text-muted">seller<input value={seller} onChange={(event) => setSeller(event.target.value)} className="field text-ink" /></label>
              <label className="grid gap-1 text-muted">manufacturer<input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className="field text-ink" /></label>
              <label className="grid gap-1 text-muted">origin / ship-from<input value={origin} maxLength={2} onChange={(event) => setOrigin(event.target.value)} className="field font-mono text-ink uppercase" /></label>
              <label className="grid gap-1 text-muted">unit price USD<input value={unitPrice} inputMode="decimal" onChange={(event) => setUnitPrice(event.target.value)} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">lead days<input type="number" min={0} max={3650} value={leadDays} onChange={(event) => setLeadDays(Math.max(0, Math.min(3650, Number(event.target.value) || 0)))} className="field font-mono text-ink" /></label>
              <label className="grid gap-1 text-muted">screening result<select value={screeningStatus} onChange={(event) => setScreeningStatus(event.target.value as typeof screeningStatus)} className="field text-ink"><option value="UNKNOWN">UNKNOWN · HOLD</option><option value="POTENTIAL_MATCH">POTENTIAL MATCH · BLOCK</option><option value="NO_CANDIDATE_MATCH">NO CANDIDATE MATCH · bounded attestation</option></select></label>
            </div>
            <label className="grid gap-1 text-muted">screening source / list version<input value={screeningSource} onChange={(event) => setScreeningSource(event.target.value)} className="field text-ink" /></label>
            <label className="grid gap-1 text-muted">screening evidence text<textarea value={screeningText} onChange={(event) => setScreeningText(event.target.value)} rows={3} className="field text-ink resize-y" /></label>
            <label className="grid gap-1 text-muted">attestor<input value={screeningAttestor} onChange={(event) => setScreeningAttestor(event.target.value)} className="field font-mono text-ink" /></label>
            <div className="flex flex-wrap gap-4 text-[12px]"><label className="flex items-center gap-2"><input type="checkbox" checked={screeningComplete} onChange={(event) => setScreeningComplete(event.target.checked)} /> screening evidence complete for the declared scope</label><label className="flex items-center gap-2"><input type="checkbox" checked={ownershipComplete} onChange={(event) => setOwnershipComplete(event.target.checked)} /> ownership inputs complete</label></div>
            {(!screeningComplete || !ownershipComplete || screeningStatus === 'UNKNOWN') && <div className="text-amber text-[12px]">HOLD is mandatory until screening and ownership evidence are explicitly complete. Completeness still does not imply full-list coverage or clearance.</div>}
          </div>
        )}
        {inputMode === 'offline-demo' && <div className="border border-amber rounded-r p-2 text-[12px] text-amber"><b>Offline demo.</b> Synthetic two-key screening corpus, three fixture offers, one active match. Never substitute this lane for a current list or transaction review.</div>}
        {client && <div className="font-mono text-[12px] break-all text-muted">candidate {client.candidate.candidate_id} · {client.candidate.revision_id} · snapshot {client.candidate.snapshot_sha256}</div>}
        {error && <div role="alert" className="border border-red rounded-r p-2 text-red"><b>Service evidence not replaced.</b> {error}{evidence ? ' · Last valid result remains below.' : ''}</div>}
        {round && (
          <div className="grid gap-2">
            <div className="font-mono text-[12px] break-all">{round.round.round_id}</div>
            {round.round.offers.map((offer) => (
              <article key={offer.offer_id} className="border border-line rounded-r p-3 grid gap-2">
                <div className="flex flex-wrap justify-between gap-2"><b>{offer.seller}</b><span className="chip">{offer.screening_disposition}</span></div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(145px,1fr))] gap-2 text-[12px]"><span>origin <b>{offer.origin}</b></span><span>lead <b>{offer.lead_days} days</b></span><span>modeled landed estimate <b>${offer.landed_cost.total_usd}</b></span><span>modeled per unit <b>${offer.landed_cost.per_unit_usd}</b></span></div>
                <div className="text-[12px] text-muted">ownership walk · {ownerNames(offer)}</div>
                <div className="text-[12px] text-muted">{offer.landed_cost.rows.map((row) => `${row.layer} $${row.amount_usd}`).join(' · ')} · modeled estimate from declared/fixture inputs; not a supplier quote or tariff determination</div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary disabled:opacity-40" disabled={!['eligible-fixture', 'eligible-bounded'].includes(offer.screening_disposition) || busy !== null} onClick={() => run('select', async (api) => { const value = await api.selectSourcingOffer(round.round.round_id, offer.offer_id); setSelectedOffer(value.selected_offer.offer_id); })}>{selectedOffer === offer.offer_id ? 'Selected' : 'Select eligible offer'}</button>
                  <button className="btn" disabled={busy !== null} onClick={() => run('hold', async (api) => { await api.adjudicateSourcingOffer({ round_id: round.round.round_id, offer_id: offer.offer_id, decision: 'HOLD', attestor: 'reviewer:browser-session', rationale: 'Retain the offer and original screening state for bounded comparison.' }); })}>Record HOLD</button>
                </div>
              </article>
            ))}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary disabled:opacity-40" disabled={!selectedOffer || busy !== null} onClick={() => run('package', async (api) => { const value = await api.buildSourcingPackage(round.round.round_id); setPkg(value); setDispatch(null); setValidatedManifest(null); setOrderEvidence(null); setOrderError(null); setOrderKey(`recording-${value.package.manifest_sha256.slice(0, 16)}-${Date.now().toString(36)}`); })}>{busy === 'package' ? 'Sealing…' : 'Build + reread sealed package'}</button>
              <button className="btn disabled:opacity-40" disabled={!pkg || busy !== null} onClick={() => run('dispatch', async (api) => setDispatch(await api.stageSourcingDispatch(round.round.round_id, pkg!.package.manifest_sha256, `browser-${pkg!.package.manifest_sha256}`)))}>{dispatch ? 'Retry same idempotency key' : 'Stage dispatch · zero send'}</button>
            </div>
          </div>
        )}
        {pkg && <div className="border border-line rounded-r p-2 font-mono text-[12px] break-all">SEALED · reread {String(pkg.package.byte_reread_verified)} · payload {pkg.package.payload_sha256} · manifest {pkg.package.manifest_sha256} · {pkg.package.dispatch_ceiling}</div>}
        {dispatch && <div className="border border-line rounded-r p-2 text-[12px]"><b>{dispatch.status}</b> · external_send {String(dispatch.dispatch.external_send)} · network_calls {dispatch.dispatch.network_calls} · retry returns the same staged receipt</div>}
        {pkg && (
          <div className="border border-line rounded-r p-3 grid gap-3" aria-label="Operator order lifecycle rehearsal">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>Operator order lifecycle rehearsal</b>
              <div className="flex flex-wrap gap-1"><span className="chip">PROCESS_LOCAL_DEMO_ONLY</span><span className="chip">RECORDING_ONLY</span><span className="chip">external effect NONE</span></div>
            </div>
            <div className="text-[12px] text-muted">This rehearses hash-linked, client-carried demo records against the sealed fixture package. They are not durable, externally authenticated, or globally replay-protected. No supplier receives a message, request, acknowledgement, or order.</div>
            <div className="flex flex-wrap items-end gap-2">
              <button className="btn btn-primary disabled:opacity-40" disabled={orderBusy !== null} onClick={() => void runOrder('validate-order-package', async (api) => { const value = await api.validateSourcingPackage(pkg.package); setValidatedManifest(value.package?.manifest_sha256 ?? null); return value; })}>{orderBusy === 'validate-order-package' ? 'Validating…' : validatedManifest ? 'Package validated' : '1 · Validate package bytes'}</button>
              <label className="grid gap-1 text-muted">simulated recording outcome<select value={recordingOutcome} onChange={(event) => setRecordingOutcome(event.target.value as RecordingOutcome)} className="field text-ink" disabled={orderBusy !== null}><option value="DISPATCHED">DISPATCHED</option><option value="ACKNOWLEDGED">ACKNOWLEDGED</option><option value="EXCEPTION">EXCEPTION · known not sent</option><option value="UNKNOWN">UNKNOWN · reconciliation required</option></select></label>
              <label className="grid gap-1 text-muted min-w-[240px] flex-1">idempotency key<input value={orderKey} onChange={(event) => setOrderKey(event.target.value)} className="field font-mono text-ink" disabled={orderBusy !== null} /></label>
              <button className="btn btn-primary disabled:opacity-40" disabled={!validatedManifest || !orderKey.trim() || orderBusy !== null} onClick={() => void runOrder('record-dispatch', (api) => api.dispatchRecording({ manifest_sha256: validatedManifest!, recording_outcome: recordingOutcome, idempotency_key: orderKey.trim(), route_ref: 'supplier:recording-demo-only', actor_id: actor, occurred_at: now() }))}>{orderBusy === 'record-dispatch' ? 'Recording…' : '2 · Record simulated dispatch'}</button>
            </div>
            {orderError && <div role="alert" className="border border-red rounded-r p-2 text-red flex flex-wrap items-center justify-between gap-2"><span><b>Order evidence not replaced.</b> {orderError}{visibleOrderEvidence ? ' · Last valid record remains visible.' : ''}</span>{orderRetry && <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder(orderRetry.label, orderRetry.action)}>Retry failed operation</button>}</div>}
            {receipt && (
              <div className="grid gap-3">
                <div className="border border-line2 rounded-r p-2 grid gap-1 text-[12px]">
                  <div className="flex flex-wrap justify-between gap-2"><b>{receipt.state} · simulated</b><span className="font-mono break-all">{receipt.receipt_id}</span></div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2"><span>execution <b>{receipt.execution_mode}</b></span><span>external effect <b>{receipt.external_effect}</b></span><span>simulated outcome record (no external send) <b>{receipt.send_effect}</b></span><span>retry <b>{receipt.retry_disposition}</b></span></div>
                  <div className="font-mono break-all text-muted">receipt sha256 {receipt.receipt_sha256} · detail {receipt.detail_code}</div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('read-receipt', (api) => api.readReceipt(receipt.receipt_id))}>{orderBusy === 'read-receipt' ? 'Reading…' : '3 · Read latest receipt'}</button>
                  {receipt.state === 'DISPATCHED' && <><label className="grid gap-1 text-muted min-w-[260px] flex-1">recorded acknowledgement evidence<input value={acknowledgementRef} onChange={(event) => setAcknowledgementRef(event.target.value)} className="field font-mono text-ink" /></label><button className="btn disabled:opacity-40" disabled={!acknowledgementRef.trim() || orderBusy !== null} onClick={() => void runOrder('acknowledge', (api) => api.acknowledge(receipt.receipt_id, acknowledgementRef.trim(), actor, now()))}>4 · Record acknowledgement</button></>}
                  {receipt.state === 'UNKNOWN' && <><label className="grid gap-1 text-muted min-w-[280px] flex-1">mandatory reconciliation evidence<input value={resolutionRef} onChange={(event) => setResolutionRef(event.target.value)} placeholder="evidence:confirmed-not-received" className="field font-mono text-ink" /></label><label className="grid gap-1 text-muted">definitive effect<select value={reconciledEffect} onChange={(event) => setReconciledEffect(event.target.value as 'NOT_SENT' | 'SENT')} className="field text-ink"><option value="NOT_SENT">NOT_SENT</option><option value="SENT">SENT</option></select></label><button className="btn btn-primary disabled:opacity-40" disabled={!resolutionRef.trim() || orderBusy !== null} onClick={() => void runOrder('reconcile', (api) => api.reconcileUnknown(receipt.receipt_id, resolutionRef.trim(), reconciledEffect, actor, now()))}>4 · Reconcile UNKNOWN + close</button></>}
                  {(receipt.state === 'ACKNOWLEDGED' || receipt.state === 'EXCEPTION') && <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('close', (api) => api.close(receipt.receipt_id, actor, now(), resolutionRef.trim() || undefined))}>5 · Close process-local order</button>}
                  <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('verify-audit', (api) => api.verifyAudit())}>{orderBusy === 'verify-audit' ? 'Verifying…' : 'Verify audit hash chain'}</button>
                </div>
              </div>
            )}
            {visibleOrderEvidence && (
              <div className="border-t border-line2 pt-2 grid gap-1 text-[12px] text-muted">
                <div><b className="text-ink">{visibleOrderEvidence.status}</b> · {visibleOrderEvidence.claim_ceiling}</div>
                {visibleOrderEvidence.event_count != null && <div className="font-mono break-all">hash-linked events {visibleOrderEvidence.event_count} · audit head {visibleOrderEvidence.audit_head_sha256}</div>}
                {(visibleOrderEvidence.audit_events ?? visibleOrderEvidence.events ?? []).map((item) => <div key={item.event_id} className="font-mono break-all">#{item.sequence} {item.event_type} · {item.state} · {item.event_sha256}</div>)}
              </div>
            )}
          </div>
        )}
        {evidence && (
          <div className="border-t border-line2 pt-2 grid gap-1 text-[12px] text-muted">
            <div><b className="text-ink">Claim ceiling:</b> {evidence.claim_ceiling}</div>
            <div className="font-mono break-all">corpus {evidence.corpus.corpus_sha256} · source hashes {Object.keys(evidence.source_hashes).length}</div>
            {evidence.limitations.map((item) => <div key={item}>· {item}</div>)}
          </div>
        )}
        {!evidence && <div className="text-[12px] text-muted">Requires the mounted local service adapters. No offline data is substituted when an endpoint is absent, stale, or malformed.</div>}
      </div>
    </section>
  );
}

function Party({ n, depth = 0 }: { n: PartyNode; depth?: number }) {
  const color = n.screening === 'exact' || n.screening === 'normalized' ? 'var(--red)' : n.unknown ? 'var(--amber)' : 'var(--muted)';
  return (
    <div style={{ paddingLeft: depth * 14 }} className="grid gap-[2px] py-[3px]">
      <div className="flex gap-2 items-baseline text-[13px]"><span className="chip chip-sm">{n.role}</span><span className={n.unknown ? 'text-amber' : ''}>{n.name}{n.pct != null ? <span className="text-muted"> · {n.pct} %</span> : null}</span></div>
      <div className="font-mono text-[12px]" style={{ color }}>screening: {n.screening}{n.listed ? ' · ' + n.listed : ''}</div>
      {n.children.map((c, i) => <Party key={i} n={c} depth={depth + 1} />)}
    </div>
  );
}

/** What picking this seller changes: the gate, the duty layers, the federal-buyer flag, the screening status. Rendered, never decided. */
function consequences(ro: ResolvedOffer, line: Line, round: Round, o: Outcome): { tone: string; text: string }[] {
  const out: { tone: string; text: string }[] = [];
  const it = round.intake;
  if (it.endUser === 'military or defense prime') out.push({ tone: 'var(--amber)', text: 'declared end user: military or defense prime · 15 CFR 744.21 military end-use review applies for CN, RU, VE destinations · prime flow-down sets the full ownership walk on every line' });
  if (!it.civilProduct && line.partClass === 'thermal_imager') out.push({ tone: 'var(--amber)', text: 'not declared a civil product · the 6A003 “embedded in a civil product” clause is printed, not evaluated' });
  if (it.usedOn === 'listed military aircraft') out.push({ tone: 'var(--black)', text: 'declared used on a listed military aircraft · VIII(h)(1) via 120.41(a)(2) · the (b)(3) open fact is a question the engineer owns · every destination reads DDTC' });
  const gate = gateFor(line, o, round.shipTo);
  if (round.shipTo !== 'US') out.push({ tone: gate.blocks ? 'var(--red)' : gate.word === 'STA' ? 'var(--amber)' : 'var(--green)', text: 'export gate to ' + round.shipTo + ': ' + gate.word + ' · ' + gate.para + (gate.blocks ? gate.word === 'REVIEW' ? ' · the package is blocked pending documented human review' : ' · the package is blocked until you type and attest an authorization reference' : '') });
  out.push({ tone: STATUS_COLOR[ro.status], text: STATUS_WORD[ro.status] + ' · ' + ro.because });
  const fired = ro.ladder.rows.filter((r) => r.amount != null && r.amount > 0 && r.layer !== 'MPF' && r.layer !== 'HMF' && !r.layer.startsWith('base'));
  if (ro.ladder.domestic) out.push({ tone: 'var(--muted)', text: 'ships from the US · no entry, no duty layers' });
  else {
    out.push({ tone: 'var(--amber)', text: '$ enters the US from ' + ro.offer.shipFrom + ' · modeled landed estimate ' + usd(ro.ladder.perUnit) + ' per unit' + (fired.length ? ' · ' + fired.map((r) => r.layer + ' ' + r.rate).join(' · ') : ' · no Chapter 99 add-on for origin ' + ro.offer.declaredOrigin) + ' · from declared/fixture inputs; not a supplier quote or tariff determination' });
    const mpf = ro.ladder.rows.find((r) => r.layer === 'MPF');
    if (mpf?.note.includes('minimum')) out.push({ tone: 'var(--amber)', text: '$ MPF minimum applied (' + usd(mpf.amount) + ') · on a small order the fee outweighs the duty' });
  }
  if (ro.offer.declaredOrigin === 'CN' && FEDERAL_BUYER_CLASSES.includes(line.partClass)) out.push({ tone: 'var(--amber)', text: 'federal-buyer flag · PRC-origin ' + line.partClass + ' · §848, American Security Drone Act, FCC Covered List · amber, never red · who may buy the finished product, separate from export control' });
  if (ro.offer.declaredEccn !== line.declaredEccn.split(' · ')[0] && !/declared by seller|no part|not yet/.test(line.declaredEccn)) out.push({ tone: 'var(--amber)', text: 'seller declares ECCN ' + ro.offer.declaredEccn + ' where the manufacturer declared ' + line.declaredEccn.split(' · ')[0] + ' · classification conflict between sellers · escalation' });
  if (ro.offer.synthetic) out.push({ tone: 'var(--grey)', text: 'SYNTHETIC seller · a fixture, badged and said aloud' });
  if (ro.offer.stock === 0) out.push({ tone: 'var(--muted)', text: 'no stock · lead ' + ro.offer.leadDays + ' days · quote' });
  return out;
}

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [{ n: 1, label: 'Use case' }, { n: 2, label: 'Pick suppliers' }, { n: 3, label: 'Package and order' }];

/** Three steps across the top, one screen each. Step two is a parts list beside the offers for the selected part. */
export function Sourcing({ o, embedded = false }: { o: Outcome; embedded?: boolean }) {
  const s = useStore();
  const r = s.round;
  // the use-case answers come from the project; sourcing never asks for them itself
  const intake: Intake = s.project?.intake ?? INTAKE_DEFAULT;
  const incomplete = intakeIncomplete(s.project?.intake ?? null);
  const shipTo: ShipTo = intake.shipTo, qty = intake.qty, mode: Mode = intake.mode;
  const [stepWanted, setStepWanted] = useState<Step | null>(null);
  const [k, setK] = useState<number>(0);
  const [pick, setPick] = useState<string | null>(null);
  const [openOffer, setOpenOffer] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, DeclineReason>>({});
  const [attestor, setAttestor] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Intake>(() => s.project?.intake ?? INTAKE_DEFAULT);
  const [adj, setAdj] = useState<{ offerId: string; role: 'analyst' | 'empowered_official'; reason: string; rationale: string; action: 'false_positive' | 'resolve' | 'pin' } | null>(null);
  const [refDraft, setRefDraft] = useState('');
  const [decl, setDecl] = useState({ personStatus: 'foreign person' as 'US person' | 'foreign person', sharing: 'assembly drawings and the BOM', reference: '' });
  const stale = useMemo(() => (r ? designHashOf(s.snapshot()) !== r.designHash : false), [r, s]);
  const close = () => s.patch({ sourcingOpen: false });
  const n = r?.lines.length ?? 0;
  // the gate: with incomplete answers the tab shows only the questions; with no round yet it shows the use case; then the pick step
  const step: Step = incomplete || !r ? 1 : stepWanted ?? 2;
  useEffect(() => { setPick(null); setReasons({}); setErr(null); setOpenOffer(null); setAdj(null); setRefDraft(''); }, [k]);
  useEffect(() => { if (r && k >= r.lines.length) setK(Math.max(0, r.lines.length - 1)); }, [r, k]);
  const selectedCount = r ? Object.keys(r.selections).length : 0;
  const total = r ? r.lines.reduce((sum, l) => { const sl = r.selections[l.id]; const ro = sl ? (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId) : null; return sum + (ro?.ladder.perUnit ?? 0) * l.qtyPerUnit * r.qty; }, 0) : 0;
  const start = () => { s.openRound(shipTo, qty, mode, intake); setK(0); setStepWanted(2); };

  const stepper = (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-line2 bg-surface flex-wrap">
      <ol aria-label={'Sourcing steps · step ' + step + ' of 3'} className="m-0 p-0 list-none flex items-center gap-2 flex-1 min-w-[320px]">
        {STEPS.map((st, i) => {
          const done = st.n === 1 ? !incomplete : st.n === 2 ? r != null && n > 0 && selectedCount === n : false;
          const on = st.n === step;
          const reachable = st.n === 1 || (r != null && !incomplete);
          return (
            <li key={st.n} className="flex items-center gap-2 flex-1 min-w-0">
              <button onClick={() => reachable && setStepWanted(st.n)} disabled={!reachable} aria-current={on ? 'step' : undefined} className="flex items-center gap-2 bg-transparent border-0 px-1 min-h-8 max-sm:min-h-11 rounded-r text-[13px] cursor-pointer disabled:cursor-default" style={{ color: on ? 'var(--ink)' : 'var(--muted)', fontWeight: on ? 600 : 400 }}>
                <span className="w-6 h-6 rounded-full grid place-items-center font-mono text-[12px] flex-none" style={{ background: on || done ? 'var(--accent)' : 'var(--m1)', color: on || done ? 'var(--accentfg)' : 'var(--ink)' }}>{done && !on ? '✓' : st.n}</span>
                <span className="whitespace-nowrap">{st.label}{st.n === 2 && r && <span className="text-muted font-normal"> · {selectedCount} of {n}</span>}</span>
              </button>
              {i < STEPS.length - 1 && <span className="flex-1 h-[2px] mx-2 min-w-4" style={{ background: st.n < step ? 'var(--accent)' : 'var(--m1)' }} />}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2 flex-wrap text-[12px] text-muted">
        {r && <span className="font-mono">{r.id} · design #{r.designSeq}</span>}
        {r && <span className="chip">ship-to {r.shipTo}</span>}{r && <span className="chip">qty {r.qty}</span>}{r && <span className="chip">{r.mode}</span>}
        {r && step === 2 && <button onClick={() => s.refineRound({})} className="btn btn-xs" title="re-screen against the same fixture slice">Re-screen</button>}
        {!embedded && <button onClick={close} className="btn btn-xs btn-icon" aria-label="Back to model" title="Back to model · Esc">×</button>}
      </div>
    </div>
  );

  const staleBar = stale && r && (
    <div role="status" className="px-4 py-2 border-b border-line2 bg-surface2 text-[13px] flex justify-between items-center gap-3 flex-wrap">
      <span className="text-amber font-semibold">the design changed after this round opened (#{r.designSeq}) · this round stays openable; a new round names it</span>
      <button onClick={() => { s.openRound(r.shipTo, r.qty, r.mode, r.intake); setK(0); }} className="btn btn-primary">Open round r{parseInt(r.id.slice(1), 10) + 1}</button>
    </div>
  );

  // step 1 · the use case: the form until it is complete, then the summary and the start button
  if (step === 1) {
    const stillIncomplete = intakeIncomplete(draft);
    return (
      <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
        {stepper}
        <div className="flex-1 min-h-0 overflow-auto p-4 flex justify-center content-start">
          <div className="panel w-full max-w-[820px] self-start">
            {incomplete ? (
              <>
                <div className="panel-head" role="status"><div className="panel-title">This application requires more information</div><span className="text-[12px] text-muted">answer before sourcing starts</span></div>
                <div className="p-4 grid gap-4 text-[13px]">
                  <div>{s.project?.intake ? 'Some use-case answers are still “not sure yet”.' : 'The use-case questions were skipped when this project was created.'} Sourcing reads the ship-to, the quantity, the transport mode, the end use and the end user before it resolves a single offer.</div>
                  <IntakeForm value={draft} onChange={setDraft} />
                  <div className="flex gap-2 items-center flex-wrap border-t border-line2 pt-3">
                    <button onClick={() => s.setProjectIntake(draft)} disabled={stillIncomplete} className="btn btn-primary btn-lg disabled:opacity-50" title={stillIncomplete ? 'every answer must be a real choice, not “not sure yet”' : 'save the answers to the project'}>Save answers</button>
                    {stillIncomplete && <span className="text-[12px] text-amber">some answers are still “not sure yet”</span>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="panel-head"><div className="panel-title">Use case</div><span className="chip">declared</span></div>
                <div className="p-4 grid gap-4 text-[13px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <span className="text-muted">product for</span><span>{intake.endUse}</span>
                    <span className="text-muted">end user</span><span>{intake.endUser}</span>
                    <span className="text-muted">ships to</span><span>{SHIP_TO.find((x) => x.code === shipTo)?.label}</span>
                    <span className="text-muted">used on an aircraft</span><span>{intake.usedOn}</span>
                    <span className="text-muted">units · transport</span><span className="font-mono">{qty} · {mode}</span>
                    <span className="text-muted">declared</span><span>{[intake.civilProduct ? 'civil product' : null, intake.bvlos ? 'BVLOS' : null].filter(Boolean).join(' · ') || 'none'}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center border-t border-line2 pt-3">
                    <button onClick={start} disabled={s.viewSeq != null} className="btn btn-primary btn-lg disabled:opacity-50 w-full sm:w-auto">{r ? 'Open a new round' : 'Find suppliers'}</button>
                    {r && <button onClick={() => setStepWanted(2)} className="btn btn-lg">Continue round {r.id}</button>}
                    <button onClick={() => s.patch({ intakeOpen: true })} className="btn">Edit the use case</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!r) return null;

  // step 3 · review the picks, declare, build the package, send the order
  if (step === 3) {
    return (
      <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
        {stepper}
        {staleBar}
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Your picks <span className="sub">· {selectedCount} of {n}</span></div><span className="font-mono text-[13px]">{usd(total)}</span></div>
            <div className="grid text-[13px]">
              {r.lines.map((l, i) => { const sl = r.selections[l.id]; const ro = sl ? (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId) : null; const g = gateFor(l, o, r.shipTo); return (
                <button key={l.id} onClick={() => { setK(i); setStepWanted(2); }} className="row-hover grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 items-center px-3 min-h-10 border-t border-line2 text-left bg-transparent text-ink cursor-pointer">
                  <span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{l.description.split(' · ')[0]}</span>
                  <span className="text-muted">{ro ? ro.offer.seller : <span className="text-amber">not picked</span>}</span>
                  {r.shipTo !== 'US' ? <span className="font-mono font-bold text-[12px]" style={{ color: g.blocks ? (r.references[l.id] ? 'var(--amber)' : 'var(--red)') : 'var(--green)' }}>{g.word}{g.blocks && r.references[l.id] ? ' · ref typed' : ''}</span> : <span />}
                  <span className="font-mono">{ro ? usd(ro.ladder.perUnit) : ''}</span>
                </button>
              ); })}
            </div>
          </div>
          <div className="grid gap-3 content-start">
            {r.shipTo !== 'US' && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Sharing drawings with the {r.shipTo} assembler</div>{r.declaration && <span className="chip">declared</span>}</div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {r.declaration ? <div>{r.declaration.personStatus} · {r.declaration.sharing} · {r.declaration.reference ? <span>reference <span className="font-mono">{r.declaration.reference}</span> · <span className="text-amber font-semibold">typed, not validated</span></span> : 'no reference'} · attestor {r.declaration.attestor}</div> : (
                    <>
                      <div className="text-muted">15 CFR 734.13: release of technology to a foreign person is a deemed export. ITAR + foreign + controlled → DDTC reference; EAR technology + foreign → licence or exception reference; EAR99 → none.</div>
                      <label className="grid gap-1 text-muted">person status<select value={decl.personStatus} onChange={(e) => setDecl({ ...decl, personStatus: e.target.value as typeof decl.personStatus })} className="field text-ink"><option>foreign person</option><option>US person</option></select></label>
                      <input aria-label="what will be shared" value={decl.sharing} onChange={(e) => setDecl({ ...decl, sharing: e.target.value })} className="field" />
                      <input aria-label="authorization reference" placeholder="authorization reference · typed, never validated" value={decl.reference} onChange={(e) => setDecl({ ...decl, reference: e.target.value })} className="field" />
                      <input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                      <button disabled={!attestor.trim()} onClick={() => s.declareTechData({ ...decl, attestor: attestor.trim() })} className="btn btn-primary disabled:opacity-50">Record declaration</button>
                    </>
                  )}
                  <div className="text-[12px] text-muted">not a deemed-export determination · Taiwan customs and the SHTC export permit are not modelled</div>
                </div>
              </div>
            )}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Package</div>{r.pkg && <span className="chip">ready</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <button onClick={() => s.buildPackage(o)} disabled={s.viewSeq != null} className="btn btn-primary btn-lg justify-self-start disabled:opacity-50">Build the package</button>
                {r.pkgRefusal && <div role="alert" className="text-red font-semibold">refused: {r.pkgRefusal}</div>}
                {r.pkg && (
                  <div className="grid gap-1 border-t border-line2 pt-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>pre-entry lines for broker validation</span><span className="font-mono">{r.pkg.preEntry}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>diligence record</span><span className="font-mono">{r.pkg.diligence}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>export references</span><span className="font-mono">{r.pkg.exportRefs}</span></div>
                    <details className="text-[12px] text-muted"><summary className="cursor-pointer flex items-center min-h-8 max-sm:min-h-11">what this package is, checklist and warnings</summary><div className="mt-1">{CLAIM_PACKAGE} Draft prepared for review by a licensed customs broker. Not a customs entry, not a broker engagement or power of attorney, not legal, customs or tax advice. The importer of record remains responsible under 19 CFR 141.1.</div><div className="mt-1"><b>first-run checklist</b> · {CHECKLIST.join(' · ')}</div><div><b>warnings</b> · {WARNINGS.join(' · ')}</div></details>
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Order <span className="sub">· synthetic, exactly once</span></div>{r.order && <span className="chip" style={{ color: r.order.state === 'EXCEPTION' ? 'var(--red)' : undefined }}>{r.order.state}</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={s.sendOrder} disabled={!r.pkg || !!r.order} className="btn btn-primary disabled:opacity-40">Send order</button>
                  <button onClick={s.retrySend} disabled={!r.order || r.order.state === 'CLOSED'} className="btn disabled:opacity-40">Retry with the same key</button>
                  <button onClick={s.closeOrder} disabled={!r.order || r.order.state !== 'ACKNOWLEDGED'} className="btn disabled:opacity-40">Receive · inspect · close</button>
                </div>
                <label className="flex items-center gap-2 text-muted text-[12px]"><input type="checkbox" checked={s.injectException} onChange={(e) => s.patch({ injectException: e.target.checked })} disabled={!!r.order} /> inject a lost response after dispatch</label>
                {r.order && <div className="grid gap-1 border-t border-line2 pt-2 font-mono text-[12px]"><div>PURCHASE_ORDER · design state #{r.designSeq} · qty {r.qty} · recipient: [placeholder] · SYNTHETIC</div><div>packet {r.order.packetHash} · key {r.order.key} · attempts {r.order.attempts}</div>{r.order.trail.map((tl, i) => <div key={i} className="text-muted">· {tl}</div>)}</div>}
                <div className="text-[12px] text-muted">a retry with the same key returns the first receipt · nothing leaves the machine</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border-t border-line2 bg-surface text-[13px]">
          <button onClick={() => setStepWanted(2)} className="btn">Back to suppliers</button>
          <span className="flex-1" />
          <span className="text-muted">modeled landed estimate · {r.qty} units</span><b className="font-mono">{usd(total)}</b>
        </div>
      </div>
    );
  }

  // step 2 · parts on the left, the offers for the selected part on the right
  const line = r.lines[k];
  const list = line ? sortOffers(r.offers[line.id] || []) : [];
  const sel = line ? r.selections[line.id] : undefined;
  const picked = list.find((x) => x.offer.id === (pick ?? sel?.offerId));
  const gate = line ? gateFor(line, o, r.shipTo) : null;
  const slot = line?.slot ?? null;
  const thumb = slot ? (s.parts[slot] ? THUMBS[s.parts[slot]!] : null) : line?.id === 'l-frame' ? AF_THUMB : null;
  const dotFor = (l: Line) => { const g = gateFor(l, o, r.shipTo); const sl = r.selections[l.id]; if (sl && g.blocks && !r.references[l.id]) return 'var(--red)'; if (sl) { const ro = (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId); return ro && ro.status !== 'no_candidate_match' ? 'var(--amber)' : 'var(--green)'; } return 'var(--m2)'; };
  const confirm = () => {
    if (!line || !picked) return;
    const e = s.selectOffer(line.id, picked.offer.id, attestor, reasons);
    setErr(e);
    if (!e) setTimeout(() => { if (k + 1 < n) setK(k + 1); else setStepWanted(3); }, 250);
  };
  const reason = line ? escalationReason(line, list) : null;
  const esc = line ? s.escalations[line.id] : undefined;

  return (
    <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      {stepper}
      {staleBar}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="Parts in this round" className="border-b md:border-b-0 md:border-r border-line2 bg-surface overflow-auto max-h-[30vh] md:max-h-none">
          {([['Components', r.lines.filter((l) => l.slot)], ['Fixed lines', r.lines.filter((l) => !l.slot)]] as const).filter(([, ls]) => ls.length > 0).map(([group, ls]) => (
          <div key={group} role="group" aria-label={group}>
          <div className="px-4 pt-2 pb-1 text-[11px] font-mono uppercase tracking-[.06em] text-muted">{group} · {ls.length}</div>
          {ls.map((l) => { const i = r.lines.indexOf(l); const sl = r.selections[l.id]; const ro = sl ? (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId) : null; const g = gateFor(l, o, r.shipTo); const offers = (r.offers[l.id] || []).length; return (
            <button key={l.id} onClick={() => setK(i)} aria-current={i === k ? 'true' : undefined} className="row-hover w-full grid grid-cols-[10px_minmax(0,1fr)_auto] gap-3 items-center px-4 min-h-12 border-b border-line2 text-left bg-transparent text-ink cursor-pointer" style={i === k ? { background: 'var(--hover)', boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}>
              <span className="w-[8px] h-[8px] rounded-full" style={{ background: dotFor(l) }} />
              <span className="min-w-0"><span className="block text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{l.description.split(' · ')[0]}</span><span className="block text-[12px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{ro ? ro.offer.seller + (g.blocks ? ' · ' + g.word + (r.references[l.id] ? ' · ref typed' : '') : ro.status !== 'no_candidate_match' ? ' · ' + STATUS_WORD[ro.status] : '') : offers + ' offer' + (offers === 1 ? '' : 's') + ' · pick one'}</span></span>
              <span className="font-mono text-[12px]">{ro ? usd(ro.ladder.perUnit) : ''}</span>
            </button>
          ); })}
          </div>
          ))}
        </nav>
        {line && gate && (
          <div className="min-h-0 overflow-auto p-4 grid gap-3 content-start">
            <div className="flex gap-3 items-center flex-wrap">
              {thumb ? <svg viewBox="0 0 56 44" className="w-[70px] h-[55px] block flex-none">{thumb.map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth="0.8" strokeDasharray={f.dash || undefined} strokeLinejoin="round" />)}</svg> : <div className="w-[70px] h-[55px] flex-none border border-dashed border-line rounded-r" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[16px]">{slot ? GENERIC_NAME[slot as Slot] : line.description.split(' · ')[0]} <span className="text-muted font-normal text-[13px]">· {line.description}</span></div>
                <div className="text-[12px] text-muted flex gap-2 flex-wrap items-center">
                  <span className="font-mono">{line.declaredEccn.split(' · ')[0]}</span><span>HTS {line.heading}</span><span>× {line.qtyPerUnit * r.qty}</span>
                  {r.shipTo !== 'US' && <span className="font-mono font-bold" style={{ color: gate.blocks ? 'var(--red)' : gate.word === 'STA' ? 'var(--amber)' : 'var(--green)' }}>{gate.word} to {r.shipTo} <span className="font-normal text-muted">· {gate.para}</span></span>}
                  {sel && <span className="text-green font-semibold">picked {list.find((x) => x.offer.id === sel.offerId)?.offer.seller} · attestor {sel.attestor}</span>}
                </div>
              </div>
            </div>

            {r.shipTo !== 'US' && gate.blocks && (
              <div className="panel p-3 grid gap-2 text-[13px]" style={{ borderColor: 'var(--red)' }}>
                <div><b className="text-red">{gate.word === 'REVIEW' ? 'Human review required.' : 'Authorization needed.'}</b> Sending this part to {r.shipTo} reads <b>{gate.word}</b> ({gate.para}). {gate.word === 'REVIEW' ? 'The package stays blocked until a human review is documented.' : 'The package stays blocked until an authorization reference is typed and attested.'}</div>
                {gate.word === 'DENIAL' ? <div className="text-muted">DENIAL has no reference field. Change the design or the destination.</div> : r.references[line.id] ? (
                  <div>reference <span className="font-mono">{r.references[line.id].ref}</span> · attestor {r.references[line.id].attestor} · <span className="text-amber font-semibold">typed, not validated</span></div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <input aria-label="authorization reference" placeholder={gate.word === 'REVIEW' ? 'documented reviewer decision / evidence reference' : 'licence / agreement / exemption / DSP-5 number'} value={refDraft} onChange={(e) => setRefDraft(e.target.value)} className="field flex-1 min-w-[200px]" />
                    <input aria-label="attestor for the reference" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field w-[160px]" />
                    <button onClick={() => { if (refDraft.trim() && attestor.trim()) s.setReference(line.id, refDraft.trim(), attestor.trim()); }} className="btn btn-primary">{gate.word === 'REVIEW' ? 'Attest review' : 'Attest reference'}</button>
                  </div>
                )}
              </div>
            )}

            <div role="radiogroup" aria-label="Offers" className="grid gap-2">
              {list.length === 0 && <div className="text-[13px] text-amber">no offer match · ask the agent for a proposal below; a human resolves.</div>}
              {list.map((ro) => {
                const on = (pick ?? sel?.offerId) === ro.offer.id;
                const declined = sel?.declined.find((d) => d.offerId === ro.offer.id);
                const blocked = ro.status === 'review_blocked';
                const open = openOffer === ro.offer.id;
                return (
                  <div key={ro.offer.id} className="panel grid gap-2 p-3" style={{ borderColor: on ? 'var(--focus)' : undefined, boxShadow: on ? 'inset 0 0 0 1px var(--focus)' : 'none', opacity: declined ? 0.7 : 1 }}>
                    <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 items-center">
                      <button role="radio" aria-checked={on} aria-label={'pick ' + ro.offer.seller} disabled={blocked || !!sel} onClick={() => { setPick(ro.offer.id); setErr(null); }} className="w-6 h-6 rounded-full border-2 p-0 cursor-pointer disabled:cursor-default disabled:opacity-40" style={{ color: on ? 'var(--accentfg)' : 'var(--muted)', borderColor: on ? 'var(--accent)' : 'var(--muted)', background: on ? 'var(--accent)' : 'transparent', boxShadow: on ? 'inset 0 0 0 4px var(--surface)' : 'none' }} />
                      <button onClick={() => { if (!blocked && !sel) { setPick(ro.offer.id); setErr(null); } }} className="min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer text-ink">
                        <span className="block text-[14px] font-semibold">{ro.offer.seller} <span className="text-muted font-normal text-[12px]">· ships {ro.offer.shipFrom} · origin {ro.offer.declaredOrigin} · {ro.offer.stock} in stock · {ro.offer.leadDays} d · MOQ {ro.offer.moq}</span></span>
                        <span className="flex gap-2 flex-wrap items-center text-[12px]">
                          <span className="font-bold" style={{ color: STATUS_COLOR[ro.status] }}>{STATUS_WORD[ro.status]}</span>
                          {ro.offer.synthetic && <span className="chip chip-sm">Synthetic</span>}{ro.offer.authorized && <span className="chip chip-sm">authorized</span>}
                          {ro.offer.declaredOrigin === 'CN' && FEDERAL_BUYER_CLASSES.includes(line.partClass) && <span className="chip chip-sm" style={{ color: 'var(--amber)' }}>federal buyer flag</span>}
                          {sel?.offerId === ro.offer.id && <span className="text-green font-semibold">picked</span>}{declined && <span className="text-muted">declined · {declined.reason}</span>}
                        </span>
                      </button>
                      <span className="text-right"><span className="block font-mono text-[16px] font-bold" style={{ color: ro.ladder.unverified ? 'var(--grey)' : 'var(--ink)' }}>{usd(ro.ladder.perUnit)}</span><span className="block text-[11px] text-muted">landed / unit · list {usd(ro.offer.unitPrice)}</span></span>
                    </div>
                    <div className="flex gap-1 flex-wrap items-center">
                      <button onClick={() => setOpenOffer(open ? null : ro.offer.id)} aria-expanded={open} className="btn">{open ? 'Hide details' : 'Details · owners, estimate'}</button>
                      {blocked && <button onClick={() => setAdj({ offerId: ro.offer.id, role: 'analyst', reason: 'name match on a different entity', rationale: '', action: 'false_positive' })} className="btn">Adjudicate</button>}
                    </div>
                    {open && (
                      <div className="border-t border-line2 pt-2 grid gap-3 text-[12px]">
                        <div><div className="text-[13px] font-semibold mb-1">Who owns them · {ro.tier} · {FIXTURES.ownership}</div><Party n={ro.tree} /><div className="text-muted mt-1">{CLAIM_SCREEN}</div></div>
                        <div>
                          <div className="text-[13px] font-semibold mb-1">Modeled landed-cost estimate · {ro.ladder.domestic ? 'domestic · no entry' : 'entering the US'}</div>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-[2px]">
                            {ro.ladder.rows.map((rw, i) => <div key={i} className="contents"><div className={rw.verified ? '' : 'text-grey'}><b>{rw.layer}</b> <span className="text-muted">· {rw.citation}</span></div><div className="font-mono text-right text-amber">{rw.rate}</div><div className="font-mono text-right text-amber">{rw.amount == null ? '' : '$ ' + rw.amount.toFixed(2)}</div></div>)}
                          </div>
                          <div className="flex justify-between gap-2 mt-2 font-mono text-[13px]"><span>total estimate</span><b>{usd(ro.ladder.total)}</b></div>
                          <div className="text-muted">{ro.ladder.assumptions} · {CLAIM_COST}</div>
                        </div>
                        <div className="text-muted">seller ECCN {ro.offer.declaredEccn} · HTS {ro.offer.declaredHts} · {ro.offer.sellerCountry}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {adj && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Adjudicate the match</div><button onClick={() => setAdj(null)} className="btn btn-xs btn-icon" aria-label="Cancel">×</button></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  <label className="grid gap-1 text-muted">role<select value={adj.role} onChange={(e) => setAdj({ ...adj, role: e.target.value as typeof adj.role, action: e.target.value === 'analyst' ? 'false_positive' : adj.action })} className="field text-ink"><option value="analyst">analyst · may record a false positive</option><option value="empowered_official">empowered official · resolves or pins</option></select></label>
                  <label className="grid gap-1 text-muted">action<select value={adj.action} onChange={(e) => setAdj({ ...adj, action: e.target.value as typeof adj.action })} className="field text-ink"><option value="false_positive">record false positive · lowers to review required</option>{adj.role === 'empowered_official' && <option value="resolve">resolve · no candidate match</option>}{adj.role === 'empowered_official' && <option value="pin">pin review blocked</option>}</select></label>
                  <label className="grid gap-1 text-muted">reason code<select value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} className="field text-ink">{['name match on a different entity', 'ownership below 50 %', 'list entry withdrawn', 'red flag confirmed', 'other'].map((x) => <option key={x}>{x}</option>)}</select></label>
                  <input aria-label="rationale" placeholder="rationale · required" value={adj.rationale} onChange={(e) => setAdj({ ...adj, rationale: e.target.value })} className="field" />
                  <input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                  <button disabled={!adj.rationale.trim() || !attestor.trim()} onClick={() => { s.adjudicate(line.id, adj.offerId, adj.role, adj.reason, adj.rationale, attestor, adj.action); setAdj(null); }} className="btn btn-primary disabled:opacity-50">Record adjudication</button>
                </div>
              </div>
            )}

            {picked && !sel && (
              <div className="panel p-3 grid gap-2 text-[13px]" style={{ borderColor: 'var(--focus)' }}>
                <div className="font-semibold text-[14px]">Pick {picked.offer.seller}</div>
                {consequences(picked, line, r, o).slice(0, 4).map((c, i) => <div key={i} className="grid grid-cols-[8px_1fr] gap-2 items-start text-[12px]"><span className="mt-[5px] w-2 h-2 rounded-full" style={{ background: c.tone }} /><span>{c.text}</span></div>)}
                {list.filter((x) => x.offer.id !== picked.offer.id).length > 0 && (
                  <details className="text-[12px] text-muted"><summary className="cursor-pointer flex items-center min-h-8 max-sm:min-h-11">the other {list.length - 1} offer{list.length === 2 ? ' is' : 's are'} recorded as declined · reasons from their status · change</summary>
                    <div className="grid gap-1 mt-1">{list.filter((x) => x.offer.id !== picked.offer.id).map((x) => (
                      <div key={x.offer.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center"><span>{x.offer.seller} <span className="text-muted">· was {STATUS_WORD[x.status]}</span></span><select value={reasons[x.offer.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [x.offer.id]: e.target.value as DeclineReason })} className="btn text-ink"><option value="">reason from status</option>{DECLINE_REASONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                    ))}</div>
                  </details>
                )}
                <div className="flex gap-2 flex-wrap items-center">
                  <input aria-label="attestor" placeholder="attestor · required · a pick is a human act" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field flex-1 min-w-[200px]" />
                  <button onClick={confirm} disabled={s.viewSeq != null || !attestor.trim()} className="btn btn-primary btn-lg disabled:opacity-50">Pick {picked.offer.seller}{k + 1 < n ? ' · next part' : ' · package'}</button>
                </div>
                {err && <div role="alert" className="text-red font-semibold">{err}</div>}
              </div>
            )}

            {(reason || esc) && (
              <details className="panel p-3 text-[13px]" style={{ borderColor: 'var(--amber)' }} open={!!esc}>
                <summary className="cursor-pointer font-semibold flex items-center gap-2 flex-wrap min-h-8 max-sm:min-h-11">Escalation <span className="text-muted font-normal">· {reason ?? esc?.reason}</span>{esc && <span className="chip chip-sm ml-2">{esc.state}</span>}</summary>
                <div className="grid gap-2 mt-2">
                  {!esc && <><div className="text-muted">the agent may propose a seller, a part or a fact here; every deterministic check runs on a copy first; a human resolves.</div><button onClick={() => s.proposeEscalation(line.id, reason!)} className="btn justify-self-start">Ask the agent for a proposal</button></>}
                  {esc && (
                    <div className="border border-line rounded-r p-2 grid gap-1">
                      <div className="font-mono text-[12px] text-muted">proposal · {esc.reason} · {esc.confident ? 'confident' : 'not confident'}</div>
                      <div>{esc.proposal}</div>
                      {esc.state === 'proposed' && (
                        <div className="flex gap-2 items-center flex-wrap"><input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field w-[160px]" /><button onClick={() => s.resolveEscalation(line.id, true, attestor)} disabled={!attestor.trim()} className="btn btn-primary disabled:opacity-50">Accept</button><button onClick={() => s.resolveEscalation(line.id, false, attestor)} disabled={!attestor.trim()} className="btn disabled:opacity-50">Reject</button></div>
                      )}
                      {esc.state !== 'proposed' && <div className="text-[12px] text-muted">{esc.state} · human-resolved · attestor {esc.attestor}</div>}
                    </div>
                  )}
                </div>
              </details>
            )}

            <details className="panel p-3 text-[13px]">
              <summary className="cursor-pointer font-semibold flex items-center gap-2 flex-wrap min-h-8 max-sm:min-h-11">Ask the supplier <span className="text-muted font-normal">· {supplierQuestions(line).length} questions from the rule fields</span></summary>
              <div className="grid gap-2 mt-2" id="supplier-request">
                <div className="text-muted">Please answer in the regulation’s words, with the source document and date for each value:</div>
                <ol className="m-0 pl-5 grid gap-1">{supplierQuestions(line).map((q, i) => <li key={i}>{q}</li>)}</ol>
                <button onClick={() => window.print()} className="btn justify-self-start">Print the request</button>
              </div>
            </details>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-t border-line2 bg-surface text-[13px]">
        <button onClick={() => setK(Math.max(0, k - 1))} disabled={k === 0} className="btn disabled:opacity-40">Back</button>
        <span role="status" className="text-muted">part {k + 1} of {n}{sel ? ' · picked' : ''}</span>
        <span className="flex-1" />
        <span className="text-muted hidden sm:inline">modeled landed estimate</span><b className="font-mono">{usd(total)}</b>
        {k + 1 < n ? <button onClick={() => setK(k + 1)} className="btn">{sel ? 'Next' : 'Skip'}</button> : null}
        <button onClick={() => setStepWanted(3)} className={'btn ' + (selectedCount === n ? 'btn-primary' : '')}>Package{selectedCount < n ? ' · ' + (n - selectedCount) + ' open' : ''}</button>
      </div>
    </div>
  );
}
