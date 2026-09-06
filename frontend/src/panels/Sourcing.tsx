import { useEffect, useMemo, useState } from 'react';
import { useStore, designHashOf, ROUND_RAIL, INTAKE_DEFAULT, type Intake, type Round } from '../store';
import type { Outcome } from '../lib/rules';
import { GENERIC_NAME, type Slot } from '../lib/catalog';
import { THUMBS, AF_THUMB } from '../lib/geometry';
import { CHECKLIST, CLAIM_COST, CLAIM_OFFER, CLAIM_PACKAGE, CLAIM_SCREEN, DECLINE_REASONS, FIXTURES, SHIP_TO, STATUS_COLOR, STATUS_WORD, WARNINGS, escalationReason, gateFor, sortOffers, supplierQuestions, type DeclineReason, type Line, type Mode, type PartyNode, type ResolvedOffer, type ShipTo } from '../lib/sourcing';
import { OperationsClient, OperationsServiceError, loadOperationsCandidateIdentity, type LiveSourcingOffer, type OperationsEnvelope, type ServiceOffer, type SourcingDispatchEnvelope, type SourcingPackageEnvelope, type SourcingRoundEnvelope } from '../lib/operations-client';
import { OrderClient, OrderServiceError, orderDisplayLabel, type OrderEnvelope, type RecordingOutcome } from '../lib/order-client';
import { appendProductEvent, productArtifactGate, useProductThread, type ProductArtifactBinding, type ProductArtifactRef } from '../lib/product-thread';

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

function ServiceSourcing() {
  const productThread = useProductThread();
  const artifactGate = productArtifactGate(productThread.artifactBinding);
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
  const [recordingOutcome, setRecordingOutcome] = useState<RecordingOutcome>('SIMULATED');
  const [orderKey, setOrderKey] = useState('');
  const [acknowledgementRef, setAcknowledgementRef] = useState('evidence:operator-observed-recording');
  const [resolutionRef, setResolutionRef] = useState('');
  const [reconciledEffect, setReconciledEffect] = useState<'NOT_SENT' | 'SIMULATED'>('NOT_SENT');
  const [packageBinding, setPackageBinding] = useState<ProductArtifactBinding | null>(null);
  const now = () => new Date().toISOString();
  const actor = 'operator:browser-demo';

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
      const artifacts: ProductArtifactRef[] = [{ artifactId: value.candidate.candidate_id, kind: 'operations-candidate-snapshot', sha256: value.candidate.artifact_sha256 }];
      if (packageBinding) artifacts.push(
        { artifactId: `cad:${packageBinding.revisionId}`, kind: 'cad-geometry', sha256: packageBinding.cadArtifactSha256 },
        { artifactId: `cad-manifest:${packageBinding.revisionId}`, kind: 'cad-artifact-manifest', sha256: packageBinding.artifactManifestSha256 },
        { artifactId: `bom-csv:${packageBinding.revisionId}`, kind: 'BOM_CSV_ARTIFACT_SHA256', sha256: packageBinding.bomCsvArtifactSha256 },
      );
      if (value.package?.manifest_sha256) artifacts.push({ artifactId: value.package.package_id, kind: 'order-package-manifest', sha256: value.package.manifest_sha256 });
      if (value.receipt) artifacts.push({ artifactId: value.receipt.receipt_id, kind: 'order-receipt', sha256: value.receipt.receipt_sha256 });
      if (value.audit_head_sha256) artifacts.push({ artifactId: 'order-audit-head', kind: 'order-audit-head', sha256: value.audit_head_sha256 });
      await appendProductEvent({
        sourceLane: value.receipt ? 'receipt' : 'order',
        eventType: `order.${label}`,
        summary: value.receipt ? `${orderDisplayLabel(value.receipt.state)} · external effect ${value.receipt.external_effect} · ${value.receipt.detail_code}.` : `${orderDisplayLabel(value.status)} · ${value.claim_ceiling}.`,
        actorId: value.request?.actor_id ?? actor,
        actorAttestation: 'SERVICE_REPORTED',
        revisionId: packageBinding?.revisionId ?? value.candidate.revision,
        artifacts,
        payload: { status: value.status, receiptState: value.receipt?.state ?? null, externalEffect: value.receipt?.external_effect ?? 'NONE', eventCount: value.event_count ?? value.audit_events?.length ?? null },
      });
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
        <div role={artifactGate.ready ? 'status' : 'alert'} className={`border rounded-r p-2 text-[12px] ${artifactGate.ready ? 'border-line text-ink' : 'border-amber text-amber'}`}>
          <b>{artifactGate.code}</b> · {artifactGate.detail} The service sourcing round may still be explored, but package and order actions stay blocked until this browser session receives the exact CAD output identities.
          {productThread.artifactBinding && <div className="font-mono break-all mt-1">CAD {productThread.artifactBinding.revisionId} · geometry {productThread.artifactBinding.cadArtifactSha256} · manifest {productThread.artifactBinding.artifactManifestSha256} · BOM CSV artifact {productThread.artifactBinding.bomCsvArtifactSha256} · semantic BOM digest {productThread.artifactBinding.semanticBomDigest}</div>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-muted">input lane<select value={inputMode} onChange={(event) => { setInputMode(event.target.value as typeof inputMode); setRound(null); setSelectedOffer(null); setPkg(null); setPackageBinding(null); setDispatch(null); }} className="field text-ink"><option value="live-bounded">Connected Candidate 0.2 input</option><option value="offline-demo">Offline demo · 2-key fixture</option></select></label>
          <label className="grid gap-1 text-muted">quantity<input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))} className="field w-28 font-mono text-ink" /></label>
          <label className="grid gap-1 text-muted">mode<select value={mode} onChange={(event) => setMode(event.target.value as 'air' | 'ocean')} className="field text-ink"><option value="air">air</option><option value="ocean">ocean</option></select></label>
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => run('round', async (api) => { const value = await createRound(api); setRound(value); setSelectedOffer(value.round.selected_offer_id); setPkg(null); setPackageBinding(null); setDispatch(null); await appendProductEvent({ sourceLane: 'sourcing', eventType: 'sourcing.round_created', summary: `${value.round.round_id} · ${value.round.offers.length} offer(s) · ${value.round.request.input_mode}.`, actorId: actor, actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: value.candidate.revision_id, artifacts: [{ artifactId: value.candidate.candidate_id, kind: 'operations-candidate-snapshot', sha256: value.candidate.snapshot_sha256 }], payload: { roundId: value.round.round_id, offerCount: value.round.offers.length, partKey: value.round.request.part_key, quantity: value.round.request.quantity, claimCeiling: value.claim_ceiling } }); })}>{busy === 'round' ? 'Creating…' : inputMode === 'offline-demo' ? 'Run Offline demo' : 'Create connected bounded round'}</button>
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
                  <button className="btn btn-primary disabled:opacity-40" disabled={!['eligible-fixture', 'eligible-bounded'].includes(offer.screening_disposition) || busy !== null} onClick={() => run('select', async (api) => { const value = await api.selectSourcingOffer(round.round.round_id, offer.offer_id); setSelectedOffer(value.selected_offer.offer_id); await appendProductEvent({ sourceLane: 'sourcing', eventType: 'sourcing.offer_selected', summary: `${value.selected_offer.offer_id} · ${value.selected_offer.seller} · ${value.selected_offer.screening_disposition}.`, actorId: actor, actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: value.candidate.revision_id, artifacts: [{ artifactId: value.candidate.candidate_id, kind: 'operations-candidate-snapshot', sha256: value.candidate.snapshot_sha256 }], payload: { roundId: value.round_id, offerId: value.selected_offer.offer_id, screeningDisposition: value.selected_offer.screening_disposition } }); })}>{selectedOffer === offer.offer_id ? 'Selected' : 'Select eligible offer'}</button>
                  <button className="btn" disabled={busy !== null} onClick={() => run('hold', async (api) => { const value = await api.adjudicateSourcingOffer({ round_id: round.round.round_id, offer_id: offer.offer_id, decision: 'HOLD', attestor: 'reviewer:browser-session', rationale: 'Retain the offer and original screening state for bounded comparison.' }); await appendProductEvent({ sourceLane: 'sourcing', eventType: 'sourcing.offer_held', summary: `${value.offer.offer_id} retained on HOLD without changing screening.`, actorId: value.adjudication.attestor, actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: value.candidate.revision_id, artifacts: [{ artifactId: value.candidate.candidate_id, kind: 'operations-candidate-snapshot', sha256: value.candidate.snapshot_sha256 }], payload: { roundId: value.round_id, offerId: value.offer.offer_id, decision: value.adjudication.decision, changesScreening: !value.adjudication.does_not_change_screening } }); })}>Record HOLD</button>
                </div>
              </article>
            ))}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary disabled:opacity-40" disabled={!selectedOffer || busy !== null || !artifactGate.ready} onClick={() => run('package', async (api) => { const binding = productThread.artifactBinding; if (!binding) throw new OperationsServiceError('BLOCKED_MISSING_CAD_ARTIFACTS', artifactGate.detail); const value = await api.buildSourcingPackage(round.round.round_id); setPkg(value); setPackageBinding(binding); setDispatch(null); setValidatedManifest(null); setOrderEvidence(null); setOrderError(null); setOrderKey(`recording-${value.package.manifest_sha256.slice(0, 16)}-${Date.now().toString(36)}`); await appendProductEvent({ sourceLane: 'sourcing', eventType: 'sourcing.package_bound', summary: `${value.package.manifest_sha256} bound in the product thread to CAD ${binding.revisionId}.`, actorId: actor, actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: binding.revisionId, artifacts: [{ artifactId: `cad:${binding.revisionId}`, kind: 'cad-geometry', sha256: binding.cadArtifactSha256 }, { artifactId: `cad-manifest:${binding.revisionId}`, kind: 'cad-artifact-manifest', sha256: binding.artifactManifestSha256 }, { artifactId: `bom-csv:${binding.revisionId}`, kind: 'BOM_CSV_ARTIFACT_SHA256', sha256: binding.bomCsvArtifactSha256 }, { artifactId: `sourcing-payload:${value.package.round_id}`, kind: 'sourcing-package-payload', sha256: value.package.payload_sha256 }, { artifactId: `sourcing-manifest:${value.package.round_id}`, kind: 'sourcing-package-manifest', sha256: value.package.manifest_sha256 }], payload: { roundId: value.package.round_id, byteRereadVerified: value.package.byte_reread_verified, dispatchCeiling: value.package.dispatch_ceiling, servicePackageEmbedsCadHashes: false, bindingLayer: 'PRODUCT_THREAD_EVENT', bomIdentity: 'BOM_CSV_ARTIFACT_SHA256', semanticBomDigest: binding.semanticBomDigest } }); })}>{busy === 'package' ? 'Sealing…' : artifactGate.ready ? 'Build + bind + reread sealed package' : 'Blocked · register CAD + BOM CSV artifact hashes'}</button>
              <button className="btn disabled:opacity-40" disabled={!pkg || !packageBinding || busy !== null} onClick={() => run('dispatch', async (api) => { const value = await api.stageSourcingDispatch(round.round.round_id, pkg!.package.manifest_sha256, `browser-${pkg!.package.manifest_sha256}`); setDispatch(value); await appendProductEvent({ sourceLane: 'sourcing', eventType: 'sourcing.dispatch_staged', summary: `${value.dispatch.dispatch_id} · external send ${String(value.dispatch.external_send)} · network calls ${value.dispatch.network_calls}.`, actorId: actor, actorAttestation: 'OPERATOR_ACTION_RECORDED', revisionId: packageBinding!.revisionId, artifacts: [{ artifactId: `cad:${packageBinding!.revisionId}`, kind: 'cad-geometry', sha256: packageBinding!.cadArtifactSha256 }, { artifactId: `bom-csv:${packageBinding!.revisionId}`, kind: 'BOM_CSV_ARTIFACT_SHA256', sha256: packageBinding!.bomCsvArtifactSha256 }, { artifactId: `sourcing-manifest:${round.round.round_id}`, kind: 'sourcing-package-manifest', sha256: value.dispatch.manifest_sha256 }], payload: { dispatchId: value.dispatch.dispatch_id, externalSend: value.dispatch.external_send, networkCalls: value.dispatch.network_calls, idempotencyKey: value.dispatch.idempotency_key, bomIdentity: 'BOM_CSV_ARTIFACT_SHA256', semanticBomDigest: packageBinding!.semanticBomDigest } }); })}>{dispatch ? 'Retry same idempotency key' : 'Stage dispatch · zero send'}</button>
            </div>
          </div>
        )}
        {pkg && <div className="border border-line rounded-r p-2 font-mono text-[12px] break-all">SEALED · reread {String(pkg.package.byte_reread_verified)} · payload {pkg.package.payload_sha256} · manifest {pkg.package.manifest_sha256} · {pkg.package.dispatch_ceiling}{packageBinding ? ` · product-thread bound to CAD ${packageBinding.revisionId}, geometry ${packageBinding.cadArtifactSha256}, artifact manifest ${packageBinding.artifactManifestSha256}, BOM CSV artifact ${packageBinding.bomCsvArtifactSha256}, semantic BOM digest ${packageBinding.semanticBomDigest}` : ' · BLOCKED: no exact CAD/BOM CSV artifact binding'}</div>}
        {dispatch && <div className="border border-line rounded-r p-2 text-[12px]"><b>{dispatch.status}</b> · external_send {String(dispatch.dispatch.external_send)} · network_calls {dispatch.dispatch.network_calls} · retry returns the same staged receipt</div>}
        {pkg && (
          <div className="border border-line rounded-r p-3 grid gap-3" aria-label="Operator order lifecycle rehearsal">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>Operator order lifecycle rehearsal</b>
              <div className="flex flex-wrap gap-1"><span className="chip">PROCESS_LOCAL_DEMO_ONLY</span><span className="chip">RECORDING_ONLY</span><span className="chip">external effect NONE</span></div>
            </div>
            <div className="text-[12px] text-muted">This rehearses hash-linked, client-carried demo records against the sealed fixture package. They are not durable, externally authenticated, or globally replay-protected. No supplier receives a message, request, acknowledgement, or order.</div>
            <div className="flex flex-wrap items-end gap-2">
              <button className="btn btn-primary disabled:opacity-40" disabled={orderBusy !== null || !packageBinding} onClick={() => void runOrder('validate-order-package', async (api) => { const value = await api.validateSourcingPackage(pkg.package); setValidatedManifest(value.package?.manifest_sha256 ?? null); return value; })}>{orderBusy === 'validate-order-package' ? 'Validating…' : validatedManifest ? 'Package validated' : '1 · Validate package bytes'}</button>
              <label className="grid gap-1 text-muted">recording-only outcome<select value={recordingOutcome} onChange={(event) => setRecordingOutcome(event.target.value as RecordingOutcome)} className="field text-ink" disabled={orderBusy !== null}><option value="SIMULATED">SIMULATED</option><option value="ACKNOWLEDGED">ACKNOWLEDGED</option><option value="EXCEPTION">EXCEPTION · known not sent</option><option value="UNKNOWN">UNKNOWN · reconciliation required</option></select></label>
              <label className="grid gap-1 text-muted min-w-[240px] flex-1">idempotency key<input value={orderKey} onChange={(event) => setOrderKey(event.target.value)} className="field font-mono text-ink" disabled={orderBusy !== null} /></label>
              <button className="btn btn-primary disabled:opacity-40" disabled={!validatedManifest || !orderKey.trim() || orderBusy !== null} onClick={() => void runOrder('record-staged-simulation', (api) => api.dispatchRecording({ manifest_sha256: validatedManifest!, recording_outcome: recordingOutcome, idempotency_key: orderKey.trim(), route_ref: 'supplier:recording-demo-only', actor_id: actor, occurred_at: now() }))}>{orderBusy === 'record-staged-simulation' ? 'Recording…' : '2 · Record staged simulation'}</button>
            </div>
            {orderError && <div role="alert" className="border border-red rounded-r p-2 text-red flex flex-wrap items-center justify-between gap-2"><span><b>Order evidence not replaced.</b> {orderError}{visibleOrderEvidence ? ' · Last valid record remains visible.' : ''}</span>{orderRetry && <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder(orderRetry.label, orderRetry.action)}>Retry failed operation</button>}</div>}
            {receipt && (
              <div className="grid gap-3">
                <div className="border border-line2 rounded-r p-2 grid gap-1 text-[12px]">
                  <div className="flex flex-wrap justify-between gap-2"><b>{orderDisplayLabel(receipt.state)} · simulated</b><span className="font-mono break-all">{receipt.receipt_id}</span></div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2"><span>execution <b>{receipt.execution_mode}</b></span><span>external effect <b>{receipt.external_effect}</b></span><span>recording-only outcome <b>{orderDisplayLabel(receipt.send_effect)}</b></span><span>retry <b>{receipt.retry_disposition}</b></span></div>
                  <div className="font-mono break-all text-muted">receipt sha256 {receipt.receipt_sha256} · detail {receipt.detail_code}</div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('read-receipt', (api) => api.readReceipt(receipt.receipt_id))}>{orderBusy === 'read-receipt' ? 'Reading…' : '3 · Read latest receipt'}</button>
                  {receipt.state === 'DISPATCHED' && <><label className="grid gap-1 text-muted min-w-[260px] flex-1">recorded acknowledgement evidence<input value={acknowledgementRef} onChange={(event) => setAcknowledgementRef(event.target.value)} className="field font-mono text-ink" /></label><button className="btn disabled:opacity-40" disabled={!acknowledgementRef.trim() || orderBusy !== null} onClick={() => void runOrder('acknowledge', (api) => api.acknowledge(receipt.receipt_id, acknowledgementRef.trim(), actor, now()))}>4 · Record acknowledgement</button></>}
                  {receipt.state === 'UNKNOWN' && <><label className="grid gap-1 text-muted min-w-[280px] flex-1">mandatory reconciliation evidence<input value={resolutionRef} onChange={(event) => setResolutionRef(event.target.value)} placeholder="evidence:confirmed-not-received" className="field font-mono text-ink" /></label><label className="grid gap-1 text-muted">simulated effect<select value={reconciledEffect} onChange={(event) => setReconciledEffect(event.target.value as 'NOT_SENT' | 'SIMULATED')} className="field text-ink"><option value="NOT_SENT">NOT_SENT</option><option value="SIMULATED">SIMULATED</option></select></label><button className="btn btn-primary disabled:opacity-40" disabled={!resolutionRef.trim() || orderBusy !== null} onClick={() => void runOrder('reconcile', (api) => api.reconcileUnknown(receipt.receipt_id, resolutionRef.trim(), reconciledEffect === 'SIMULATED' ? 'SENT' : reconciledEffect, actor, now()))}>4 · Reconcile UNKNOWN + close</button></>}
                  {(receipt.state === 'ACKNOWLEDGED' || receipt.state === 'EXCEPTION') && <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('close', (api) => api.close(receipt.receipt_id, actor, now(), resolutionRef.trim() || undefined))}>5 · Close process-local order</button>}
                  <button className="btn" disabled={orderBusy !== null} onClick={() => void runOrder('verify-audit', (api) => api.verifyAudit())}>{orderBusy === 'verify-audit' ? 'Verifying…' : 'Verify audit hash chain'}</button>
                </div>
              </div>
            )}
            {visibleOrderEvidence && (
              <div className="border-t border-line2 pt-2 grid gap-1 text-[12px] text-muted">
                <div><b className="text-ink">{orderDisplayLabel(visibleOrderEvidence.status)}</b> · {visibleOrderEvidence.claim_ceiling}</div>
                {visibleOrderEvidence.event_count != null && <div className="font-mono break-all">hash-linked events {visibleOrderEvidence.event_count} · audit head {visibleOrderEvidence.audit_head_sha256}</div>}
                {(visibleOrderEvidence.audit_events ?? visibleOrderEvidence.events ?? []).map((item) => <div key={item.event_id} className="font-mono break-all">#{item.sequence} {orderDisplayLabel(item.event_type)} · {orderDisplayLabel(item.state)} · {item.event_sha256}</div>)}
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
  if (it.bvlos) out.push({ tone: 'var(--muted)', text: 'declared BVLOS operation · an operating declaration, not a rule input this weekend' });
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

export function Sourcing({ o }: { o: Outcome }) {
  const s = useStore();
  const r = s.round;
  const [shipTo, setShipTo] = useState<ShipTo>('US');
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<Mode>('air');
  const [intake, setIntake] = useState<Intake>(INTAKE_DEFAULT);
  const [stage, setStage] = useState<number>(-1); // -1 idle · 0..3 running · 4 done
  const [k, setK] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, DeclineReason>>({});
  const [attestor, setAttestor] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'none' | 'owners' | 'estimate'>('none');
  const [adj, setAdj] = useState<{ offerId: string; role: 'analyst' | 'empowered_official'; reason: string; rationale: string; action: 'false_positive' | 'resolve' | 'pin' } | null>(null);
  const [refDraft, setRefDraft] = useState('');
  const [decl, setDecl] = useState({ personStatus: 'foreign person' as 'US person' | 'foreign person', sharing: 'assembly drawings and the BOM', reference: '' });
  const [askOpen, setAskOpen] = useState(false);
  const stale = useMemo(() => (r ? designHashOf(s.snapshot()) !== r.designHash : false), [r, s]);
  const close = () => s.patch({ sourcingOpen: false });
  const n = r?.lines.length ?? 0;
  // start at the first part without a selection
  useEffect(() => { if (r && k == null && stage >= 4) { const i = r.lines.findIndex((l) => !r.selections[l.id]); setK(i < 0 ? n : i); } if (!r) { setK(null); setStage(-1); } if (r && stage === -1 && k == null) setStage(4); }, [r, k, n, stage]);
  useEffect(() => { setPick(null); setReasons({}); setErr(null); setTab('none'); setAdj(null); setRefDraft(''); }, [k]);

  const rail = r && (
    <div className="flex items-center gap-1 flex-wrap">
      {ROUND_RAIL.map((st, i) => { const idx = ROUND_RAIL.findIndex((x) => x.status === r.status); const done = i <= idx; return <span key={st.status} className="chip" style={{ color: done ? 'var(--accentfg)' : 'var(--muted)', background: done ? 'var(--accent)' : 'transparent', borderColor: done ? 'var(--accent)' : 'var(--line)' }}>{st.label}</span>; })}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface flex-wrap">
      <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
        <span className="text-[13px] font-semibold">Sourcing <span className="text-muted font-normal">· {r ? 'offline lab · part by part' : 'service + offline lab'}</span></span>
        {r && <span className="font-mono text-[13px]">{r.id} · design state #{r.designSeq}</span>}
        {r && <span className="chip">ship-to {r.shipTo}</span>}{r && <span className="chip">qty {r.qty}</span>}{r && <span className="chip">{r.mode}</span>}
        {rail}
      </div>
      <button onClick={close} className="btn">Back to model · Esc</button>
    </div>
  );

  if (!r || k == null) {
    const stages = [
      { label: 'resolve offers', detail: 'committed catalog · ' + FIXTURES.offers },
      { label: 'walk owners', detail: 'seller and manufacturer · full walk where controlled, foreign or flagged · ' + FIXTURES.ownership },
      { label: 'screen fixture names', detail: 'exact and suffix-normalised · ' + FIXTURES.csl },
      { label: 'estimate modeled landed cost', detail: 'declared/fixture inputs · not a supplier quote or tariff determination · ' + FIXTURES.tariff },
    ];
    const running = stage >= 0 && stage < 4;
    const start = () => { s.openRound(shipTo, qty, mode, intake); setStage(4); };
    const counts = r ? { offers: Object.values(r.offers).flat().length, blocked: Object.values(r.offers).flat().filter((x) => x.status === 'review_blocked').length, review: Object.values(r.offers).flat().filter((x) => x.status === 'review_required').length } : null;
    return (
      <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
        {header}
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
          <ServiceSourcing />
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Offline lab · before the search runs</div><span className="text-[12px] text-muted">local fixtures · never service evidence</span></div>
            <div className="p-3 grid gap-3 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-muted">what is the product for?<select value={intake.endUse} onChange={(e) => setIntake({ ...intake, endUse: e.target.value as Intake['endUse'] })} className="field text-ink" disabled={running}>{['civil survey and mapping', 'agriculture', 'public safety', 'infrastructure inspection', 'defense-adjacent research', 'other'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">who is the end user?<select value={intake.endUser} onChange={(e) => setIntake({ ...intake, endUser: e.target.value as Intake['endUser'] })} className="field text-ink" disabled={running}>{['commercial operator', 'university', 'government agency (civil)', 'military or defense prime', 'unknown'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">where does it ship?<select value={shipTo} onChange={(e) => setShipTo(e.target.value as ShipTo)} className="field text-ink" disabled={running}>{SHIP_TO.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></label>
                <label className="grid gap-1 text-muted">is the pod used on an aircraft?<select value={intake.usedOn} onChange={(e) => setIntake({ ...intake, usedOn: e.target.value as Intake['usedOn'] })} className="field text-ink" disabled={running}>{['none', 'in-production unlisted aircraft', 'listed military aircraft'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="grid gap-1 text-muted">units<input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(500, +e.target.value || 1)))} className="field font-mono text-ink" disabled={running} /></label>
                <label className="grid gap-1 text-muted">transport<select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="field text-ink" disabled={running}><option value="air">air</option><option value="ocean">ocean</option></select></label>
              </div>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2"><input type="checkbox" checked={intake.civilProduct} onChange={(e) => setIntake({ ...intake, civilProduct: e.target.checked })} disabled={running} /> declared a civil product <span className="chip chip-sm">declared</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={intake.bvlos} onChange={(e) => setIntake({ ...intake, bvlos: e.target.checked })} disabled={running} /> beyond visual line of sight</label>
              </div>
              <input aria-label="notes" placeholder="anything else about the use case · one line, goes on the round" value={intake.notes} onChange={(e) => setIntake({ ...intake, notes: e.target.value })} className="field" disabled={running} />
              <div className="text-[12px] text-muted">These answers are declared facts. They print on the round and beside every pick; they do not change what the rule engine computed for the design.</div>
              <button onClick={start} disabled={s.viewSeq != null || running} className="btn btn-primary btn-lg justify-self-start disabled:opacity-50">Run the search · source this design</button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">The pipeline</div><span className="text-[12px] text-muted">{running ? 'running' : r ? 'done' : 'idle'}</span></div>
            <div className="p-3 grid gap-2 text-[13px]">
              {stages.map((st, i) => {
                const state = stage < 0 ? 'idle' : i < stage ? 'done' : i === stage ? 'running' : 'waiting';
                return (
                  <div key={st.label} className="grid grid-cols-[18px_1fr] gap-2 items-start">
                    <span className="mt-[3px] w-[14px] h-[14px] rounded-full border flex items-center justify-center text-[10px]" style={{ borderColor: state === 'done' ? 'var(--accent)' : 'var(--line)', background: state === 'done' ? 'var(--accent)' : state === 'running' ? 'var(--focus)' : 'transparent', color: 'var(--accentfg)' }}>{state === 'done' ? '✓' : ''}</span>
                    <span><b style={{ color: state === 'waiting' || state === 'idle' ? 'var(--muted)' : 'var(--ink)' }}>{st.label}</b><br /><span className="text-[12px] text-muted">{st.detail}</span>
                      {state === 'done' && counts && i === 0 && <><br /><span className="font-mono text-[12px]">{r!.lines.length} lines · {counts.offers} offers</span></>}
                      {state === 'done' && counts && i === 2 && <><br /><span className="font-mono text-[12px]">{counts.blocked} review blocked · {counts.review} review required</span></>}
                      {state === 'done' && counts && i === 3 && <><br /><span className="font-mono text-[12px]">{counts.offers} ladders · every layer dated</span></>}
                    </span>
                  </div>
                );
              })}
              <div className="text-[12px] text-muted border-t border-line2 pt-2">no model on this path · every stage is a pure function over dated fixtures · the agent may only propose on the escalation lane</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const done = k >= n;
  const line = done ? null : r.lines[k];
  const list = line ? sortOffers(r.offers[line.id] || []) : [];
  const sel = line ? r.selections[line.id] : undefined;
  const picked = list.find((x) => x.offer.id === (pick ?? sel?.offerId));
  const gate = line ? gateFor(line, o, r.shipTo) : null;
  const slot = line?.slot ?? null;
  const thumb = slot ? (s.parts[slot] ? THUMBS[s.parts[slot]!] : null) : line?.id === 'l-frame' ? AF_THUMB : null;
  const selectedCount = Object.keys(r.selections).length;

  const confirm = () => {
    if (!line || !picked) return;
    const e = s.selectOffer(line.id, picked.offer.id, attestor, reasons);
    setErr(e);
    if (!e) setTimeout(() => setK(k + 1), 250);
  };

  return (
    <div role="dialog" aria-label="Sourcing" className="absolute inset-0 bg-bg z-[8] flex flex-col">
      {header}
      {stale && (
        <div role="status" className="px-4 py-2 border-b border-line2 bg-surface2 text-[13px] flex justify-between items-center gap-3 flex-wrap">
          <span className="text-amber font-semibold">the design changed after this round opened (#{r.designSeq}) · this round stays openable; a new round names it</span>
          <button onClick={() => { s.openRound(r.shipTo, r.qty, r.mode, r.intake); setK(null); }} className="btn btn-primary">Open round r{parseInt(r.id.slice(1), 10) + 1}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-line2 bg-surface">
        <span className="font-mono text-[13px] font-bold whitespace-nowrap">{done ? 'review' : 'part ' + (k + 1) + ' of ' + n}</span>
        <div className="flex-1 flex gap-[3px]">
          {r.lines.map((l, i) => <button key={l.id} onClick={() => setK(i)} title={l.description} className="h-2 flex-1 rounded-[2px] border-0 cursor-pointer" style={{ background: i === k ? 'var(--focus)' : r.selections[l.id] ? 'var(--accent)' : 'var(--m2)' }} />)}
          <button onClick={() => setK(n)} title="review · package · order" className="h-2 w-8 rounded-[2px] border-0 cursor-pointer" style={{ background: done ? 'var(--focus)' : r.pkg ? 'var(--accent)' : 'var(--m2)' }} />
        </div>
        <button onClick={() => s.refineRound({})} className="btn" title="re-screen against the same two-key synthetic fixture slice · K runs, 0 changed">Re-screen</button>
        <span className="text-[12px] text-muted whitespace-nowrap">{selectedCount} of {n} picked</span>
        <button onClick={() => setK(Math.max(0, k - 1))} disabled={k === 0} className="btn disabled:opacity-40">Back</button>
        <button onClick={() => setK(Math.min(n, k + 1))} disabled={done} className="btn disabled:opacity-40">{sel || done ? 'Next' : 'Skip'}</button>
      </div>

      {!done && line && gate && (
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
          <div className="grid gap-3 content-start">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">This is your {slot ? GENERIC_NAME[slot as Slot].toLowerCase() : line.description.split(' · ')[0].toLowerCase()}</div><span className="text-[12px] text-muted">× {line.qtyPerUnit * r.qty}</span></div>
              <div className="p-3 grid gap-2">
                <div className="flex gap-3 items-center">
                  {thumb ? <svg viewBox="0 0 56 44" className="w-[84px] h-[66px] block flex-none">{thumb.map((f, i) => <polygon key={i} points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth="0.8" strokeDasharray={f.dash || undefined} strokeLinejoin="round" />)}</svg> : <div className="w-[84px] h-[66px] flex-none border border-dashed border-line rounded-r" />}
                  <div className="min-w-0"><div className="font-semibold text-[15px]">{line.description}</div><div className="text-[13px] text-muted">{line.partClass} · HTS {line.heading}</div></div>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <span className="text-muted">manufacturer ECCN</span><span className="font-mono">{line.declaredEccn}</span>
                  <span className="text-muted">export gate · {r.shipTo}</span><span className="font-mono font-semibold" style={{ color: gate.blocks ? 'var(--red)' : gate.word === 'STA' ? 'var(--amber)' : 'var(--green)' }}>{gate.word} <span className="font-normal text-muted">{gate.para}</span></span>
                  <span className="text-muted">in the design</span><span>{slot ? (s.parts[slot] ? 'placed · change the model in Spec' : 'slot empty') : 'fixed BOM line'}</span>
                </div>
                {sel && <div className="text-[13px] border-t border-line2 pt-2">picked <b>{list.find((x) => x.offer.id === sel.offerId)?.offer.seller}</b> · attestor {sel.attestor} · #{sel.seq}{sel.declined.length ? <span className="text-muted"> · declined {sel.declined.map((d) => d.seller + ' (' + d.reason + ')').join(', ')}</span> : null}</div>}
              </div>
            </div>
            {(() => {
              const reason = escalationReason(line, list);
              const esc = s.escalations[line.id];
              if (!reason && !esc) return null;
              return (
                <div className="panel" style={{ borderColor: 'var(--amber)' }}>
                  <div className="panel-head"><div className="panel-title">Escalation lane <span className="sub">· {reason ?? esc?.reason}</span></div>{esc && <span className="chip chip-sm">{esc.state}</span>}</div>
                  <div className="p-3 grid gap-2 text-[13px]">
                    {!esc && <><div className="text-muted">the agent may propose a seller, a part or a fact here; every deterministic check runs on a copy first; a human resolves.</div><button onClick={() => s.proposeEscalation(line.id, reason!)} className="btn justify-self-start">Ask the agent for a proposal</button></>}
                    {esc && (
                      <>
                        <div className="border border-line rounded-r p-2 grid gap-1">
                          <div className="font-mono text-[12px] text-muted">proposal · {esc.reason} · {esc.confident ? 'confident' : 'not confident'} · exact-quote citation first</div>
                          <div>{esc.proposal}</div>
                          {esc.state === 'proposed' && (
                            <div className="flex gap-2 items-center flex-wrap"><input aria-label="attestor" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field w-[160px]" /><button onClick={() => s.resolveEscalation(line.id, true, attestor)} disabled={!attestor.trim()} className="btn btn-primary disabled:opacity-50">Accept</button><button onClick={() => s.resolveEscalation(line.id, false, attestor)} disabled={!attestor.trim()} className="btn disabled:opacity-50">Reject</button></div>
                          )}
                          {esc.state !== 'proposed' && <div className="text-[12px] text-muted">{esc.state} · human-resolved · attestor {esc.attestor}</div>}
                        </div>
                        <div className="text-[12px] text-muted">the agent proposes; a human resolves · rejection as fast as acceptance · the agent has no path to a terminal state</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Ask the supplier</div><button onClick={() => setAskOpen((v) => !v)} className="btn btn-xs">{askOpen ? 'hide' : 'generate the request'}</button></div>
              {askOpen && (
                <div className="p-3 grid gap-2 text-[13px]" id="supplier-request">
                  <div className="font-semibold">Supplier request · {line.description}</div>
                  <div className="text-muted">Please answer in the regulation’s words, with the source document and date for each value:</div>
                  <ol className="m-0 pl-5 grid gap-1">{supplierQuestions(line).map((q, i) => <li key={i}>{q}</li>)}</ol>
                  <div className="text-[12px] text-muted">generated from the rule fields · no model · the verified-answer loop (supplier PDF → extractor → verifier → extracted_by supplier_doc) is roadmap</div>
                  <button onClick={() => window.print()} className="btn justify-self-start">Print the request</button>
                </div>
              )}
            </div>
            {r.shipTo !== 'US' && gate.blocks && (
              <div className="panel" style={{ borderColor: 'var(--red)' }}>
                <div className="panel-head"><div className="panel-title text-red">{gate.word === 'REVIEW' ? 'Human review required' : 'Your regulation changes here'}</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  <div>Sending this part to {r.shipTo} reads <b>{gate.word}</b> ({gate.para}). {gate.word === 'REVIEW' ? 'The limited scan cannot authorize export; the package remains blocked until a human review is documented.' : 'The package is blocked until an authorization reference is typed and attested.'}</div>
                  {gate.word === 'DENIAL' ? <div className="text-muted">DENIAL has no reference field. Change the design or the destination.</div> : r.references[line.id] ? (
                    <div>reference <span className="font-mono">{r.references[line.id].ref}</span> · attestor {r.references[line.id].attestor} · <span className="text-amber font-semibold">reference typed, not validated</span></div>
                  ) : (
                    <div className="grid gap-2">
                      <input aria-label="authorization reference" placeholder={gate.word === 'REVIEW' ? 'documented reviewer decision / evidence reference' : 'licence / agreement / exemption / DSP-5 number'} value={refDraft} onChange={(e) => setRefDraft(e.target.value)} className="field" />
                      <div className="flex gap-2"><input aria-label="attestor for the reference" placeholder="attestor · required" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field flex-1" /><button onClick={() => { if (refDraft.trim() && attestor.trim()) s.setReference(line.id, refDraft.trim(), attestor.trim()); }} className="btn btn-primary">{gate.word === 'REVIEW' ? 'Attest review' : 'Attest reference'}</button></div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {list.length > 1 && (() => {
              const cheapest = list.slice().sort((a, b) => (a.ladder.perUnit ?? Infinity) - (b.ladder.perUnit ?? Infinity))[0];
              const clean = list.find((x) => x.status === 'no_candidate_match');
              const delta = clean && cheapest && clean.ladder.perUnit != null && cheapest.ladder.perUnit != null ? clean.ladder.perUnit - cheapest.ladder.perUnit : null;
              return (
                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Price against regulation</div></div>
                  <div className="p-3 grid gap-1 text-[13px]">
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>lowest modeled landed estimate · <b>{cheapest.offer.seller}</b> <span style={{ color: STATUS_COLOR[cheapest.status] }}>· {STATUS_WORD[cheapest.status]}</span></span><span className="font-mono">{usd(cheapest.ladder.perUnit)}</span></div>
                    {clean && clean !== cheapest && <div className="grid grid-cols-[1fr_auto] gap-2"><span>cheapest with no candidate match · <b>{clean.offer.seller}</b></span><span className="font-mono">{usd(clean.ladder.perUnit)}</span></div>}
                    {delta != null && delta > 0 && <div className="text-muted">the cleaner seller costs <span className="font-mono text-ink">{usd(delta)}</span> more per unit · the cheaper one is {STATUS_WORD[cheapest.status]}{cheapest.offer.declaredOrigin === 'CN' ? ' and PRC-origin (Section 301 in the ladder, federal-buyer flag)' : ''}</div>}
                    {!clean && <div className="text-amber">no offer on this line is free of a review flag · pick with the flag on the record, or escalate</div>}
                    <div className="text-[12px] text-muted">status sorts above price, always · the human is on the pick button</div>
                  </div>
                </div>
              );
            })()}
            {picked && (
              <div className="panel" style={{ borderColor: 'var(--focus)' }}>
                <div className="panel-head"><div className="panel-title">If you pick {picked.offer.seller}</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {consequences(picked, line, r, o).map((c, i) => <div key={i} className="grid grid-cols-[8px_1fr] gap-2 items-start"><span className="mt-[6px] w-2 h-2 rounded-full" style={{ background: c.tone }} /><span>{c.text}</span></div>)}
                  <div className="text-[12px] text-muted">{CLAIM_OFFER}</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 content-start">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Where you can get it <span className="sub">· {list.length} offer{list.length === 1 ? '' : 's'} · status first, then modeled landed-cost estimate · blocked last</span></div></div>
              <div className="p-3 grid gap-2">
                {list.length === 0 && <div className="text-[13px] text-amber">no offer match · escalation lane: the agent may propose a seller; a human resolves.</div>}
                {list.map((ro) => {
                  const on = (pick ?? sel?.offerId) === ro.offer.id;
                  const declined = sel?.declined.find((d) => d.offerId === ro.offer.id);
                  return (
                    <div key={ro.offer.id} className="border rounded-r bg-surface grid gap-2 p-3" style={{ borderColor: on ? 'var(--focus)' : 'var(--line)', boxShadow: on ? 'inset 0 0 0 1px var(--focus)' : 'none', opacity: declined ? 0.7 : 1 }}>
                      <div className="flex justify-between gap-2 items-baseline flex-wrap">
                        <button onClick={() => { setPick(ro.offer.id); setErr(null); }} className="text-left bg-transparent border-0 p-0 cursor-pointer text-ink font-semibold text-[14px]">{ro.offer.seller} <span className="text-muted font-normal">· {ro.offer.sellerCountry}</span>{ro.offer.synthetic && <span className="chip chip-sm ml-2">Synthetic</span>}{ro.offer.authorized && <span className="chip chip-sm ml-1">authorized</span>}</button>
                        <span className="text-[13px] font-bold" style={{ color: STATUS_COLOR[ro.status] }}>{STATUS_WORD[ro.status]}</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-x-3 gap-y-1 text-[12px]">
                        <div><span className="text-muted">ship-from · origin</span><br /><span className="font-mono">{ro.offer.shipFrom} · {ro.offer.declaredOrigin} <span className="chip chip-sm">declared</span></span></div>
                        <div><span className="text-muted">price</span><br /><span className="font-mono">{usd(ro.offer.unitPrice)}</span></div>
                        <div><span className="text-muted">modeled landed estimate / unit</span><br /><span className="font-mono font-semibold" style={{ color: ro.ladder.unverified ? 'var(--grey)' : 'var(--ink)' }}>{usd(ro.ladder.perUnit)}</span></div>
                        <div><span className="text-muted">stock · lead · MOQ</span><br /><span className="font-mono">{ro.offer.stock} · {ro.offer.leadDays} d · {ro.offer.moq}</span></div>
                        <div><span className="text-muted">seller ECCN · HTS</span><br /><span className="font-mono">{ro.offer.declaredEccn} · {ro.offer.declaredHts}</span></div>
                      </div>
                      <div className="flex gap-1 flex-wrap items-center">
                        <button onClick={() => { setPick(ro.offer.id); setTab(tab === 'owners' && on ? 'none' : 'owners'); }} className="btn">Owners · {ro.tier}</button>
                        <button onClick={() => { setPick(ro.offer.id); setTab(tab === 'estimate' && on ? 'none' : 'estimate'); }} className="btn">Modeled landed estimate</button>
                        {ro.status === 'review_blocked' && <button onClick={() => setAdj({ offerId: ro.offer.id, role: 'analyst', reason: 'name match on a different entity', rationale: '', action: 'false_positive' })} className="btn">Adjudicate…</button>}
                        <span className="flex-1" />
                        {sel?.offerId === ro.offer.id ? <span className="text-[13px] font-semibold text-green">picked</span> : declined ? <span className="text-[12px] text-muted">declined · {declined.reason}</span> : <button onClick={() => { setPick(ro.offer.id); setErr(null); }} className={'btn ' + (on ? 'btn-primary' : '')} disabled={ro.status === 'review_blocked'} title={ro.status === 'review_blocked' ? 'review blocked stops a pick · adjudicate first' : ''}>{on ? 'picked below' : 'Pick this'}</button>}
                      </div>
                      {on && tab === 'owners' && (
                        <div className="border-t border-line2 pt-2"><div className="text-[13px] font-semibold mb-1">Who owns them · {FIXTURES.ownership}</div><Party n={ro.tree} /><div className="text-[12px] text-muted mt-1">{CLAIM_SCREEN} · Affiliates Rule returns 10 November 2026; the walk rests on the OFAC 50 % rule.</div></div>
                      )}
                      {on && tab === 'estimate' && (
                        <div className="border-t border-line2 pt-2">
                          <div className="text-[13px] font-semibold mb-1">Modeled landed-cost estimate · declared/fixture inputs · not a supplier quote or tariff determination · {ro.ladder.domestic ? 'domestic · no entry' : 'entering the US'}</div>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-[2px] text-[12px]">
                            {ro.ladder.rows.map((rw, i) => <div key={i} className="contents"><div className={rw.verified ? '' : 'text-grey'}><b>{rw.layer}</b> <span className="text-muted">· {rw.citation}</span><br /><span className="text-muted">{rw.note}</span></div><div className="font-mono text-right text-amber">{rw.rate}</div><div className="font-mono text-right text-amber">{rw.amount == null ? '' : '$ ' + rw.amount.toFixed(2)}</div></div>)}
                          </div>
                          <div className="flex justify-between gap-2 mt-2 font-mono text-[13px]"><span>total estimate</span><b>{usd(ro.ladder.total)}</b></div>
                          <div className="text-[12px] text-muted">{ro.ladder.assumptions} · hash {ro.ladder.hash} · {CLAIM_COST}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {adj && (
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Adjudicate the match</div><button onClick={() => setAdj(null)} className="btn">Cancel</button></div>
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
              <div className="panel" style={{ borderColor: 'var(--focus)' }}>
                <div className="panel-head"><div className="panel-title">Pick {picked.offer.seller}</div></div>
                <div className="p-3 grid gap-2 text-[13px]">
                  {list.filter((x) => x.offer.id !== picked.offer.id).length > 0 && <div className="text-muted">the other offers you saw are recorded as declined, each with a reason and its status at the moment of decline:</div>}
                  {list.filter((x) => x.offer.id !== picked.offer.id).map((x) => (
                    <div key={x.offer.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center"><span>{x.offer.seller} <span className="text-muted">· was {STATUS_WORD[x.status]}</span></span><select value={reasons[x.offer.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [x.offer.id]: e.target.value as DeclineReason })} className="btn text-ink"><option value="">reason from status</option>{DECLINE_REASONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                  ))}
                  <input aria-label="attestor" placeholder="attestor · required · a pick is a human act" value={attestor} onChange={(e) => setAttestor(e.target.value)} className="field" />
                  {err && <div role="alert" className="text-red font-semibold">{err}</div>}
                  <button onClick={confirm} disabled={s.viewSeq != null} className="btn btn-primary btn-lg text-left disabled:opacity-50">Confirm pick · next part</button>
                </div>
              </div>
            )}
            {sel && <button onClick={() => setK(k + 1)} className="btn btn-primary btn-lg justify-self-end">Next part →</button>}
          </div>
        </div>
      )}

      {done && (
        <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-4 content-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Your picks <span className="sub">· {selectedCount} of {n}</span></div></div>
            <div className="grid text-[13px]">
              {r.lines.map((l, i) => { const sl = r.selections[l.id]; const ro = sl ? (r.offers[l.id] || []).find((x) => x.offer.id === sl.offerId) : null; const g = gateFor(l, o, r.shipTo); return (
                <button key={l.id} onClick={() => setK(i)} className="row-hover grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 items-center px-3 min-h-10 border-t border-line2 text-left bg-transparent text-ink cursor-pointer">
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
              <div className="panel-head"><div className="panel-title">Build the package</div>{r.pkg && <span className="chip">ready</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <button onClick={() => s.buildPackage(o)} disabled={s.viewSeq != null} className="btn btn-primary btn-lg justify-self-start disabled:opacity-50">Build the package</button>
                {r.pkgRefusal && <div role="alert" className="text-red font-semibold">refused: {r.pkgRefusal}</div>}
                {r.pkg && (
                  <div className="grid gap-1 border-t border-line2 pt-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>pre-entry lines for broker validation</span><span className="font-mono">{r.pkg.preEntry}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>diligence record</span><span className="font-mono">{r.pkg.diligence}</span></div>
                    <div className="grid grid-cols-[1fr_auto] gap-2"><span>export references</span><span className="font-mono">{r.pkg.exportRefs}</span></div>
                    <div className="text-[12px] text-muted mt-1">{CLAIM_PACKAGE} Draft prepared for review by a licensed customs broker. Not a customs entry, not a broker engagement or power of attorney, not legal, customs or tax advice. The importer of record remains responsible under 19 CFR 141.1.</div>
                    <div className="text-[12px] mt-1"><b>first-run checklist</b> · {CHECKLIST.join(' · ')}</div>
                    <div className="text-[12px]"><b>warnings</b> · {WARNINGS.join(' · ')}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Stage the order <span className="sub">· simulated, exactly once</span></div>{r.order && <span className="chip" style={{ color: r.order.state === 'EXCEPTION' ? 'var(--red)' : undefined }}>{orderDisplayLabel(r.order.state)}</span>}</div>
              <div className="p-3 grid gap-2 text-[13px]">
                <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={s.injectException} onChange={(e) => s.patch({ injectException: e.target.checked })} disabled={!!r.order} /> inject a lost response after dispatch</label>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={s.sendOrder} disabled={!r.pkg || !!r.order} className="btn btn-primary disabled:opacity-40">Stage order (simulated)</button>
                  <button onClick={s.retrySend} disabled={!r.order || r.order.state === 'CLOSED'} className="btn disabled:opacity-40">Retry staged action with the same key</button>
                  <button onClick={s.closeOrder} disabled={!r.order || r.order.state !== 'ACKNOWLEDGED'} className="btn disabled:opacity-40">Receive · inspect · close</button>
                </div>
                {r.order && <div className="grid gap-1 border-t border-line2 pt-2 font-mono text-[12px]"><div>PURCHASE_ORDER · design state #{r.designSeq} · qty {r.qty} · recipient: [placeholder] · SIMULATED</div><div>packet {r.order.packetHash} · key {r.order.key} · attempts {r.order.attempts}</div>{r.order.trail.map((tl, i) => <div key={i} className="text-muted">· {orderDisplayLabel(tl)}</div>)}</div>}
                <div className="text-[12px] text-muted">a retry with the same key returns the first receipt · nothing leaves the machine · any real external send is a separately authorized communication</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
