import { useEffect, useState } from 'react';
import { DESIGN_PROJECT_NAME, useStore } from '../store';
import { PRODUCT_NAME, PRODUCT_THREAD_DURABILITY_NOTICE, rederiveProductThread, tamperProductThread, useProductThread, type ProductThreadVerification } from '../lib/product-thread';

const short = (value: string | null) => value ? `${value.slice(0, 12)}...${value.slice(-8)}` : 'GENESIS';

/** /record: printable, device-local product thread plus explicitly untracked legacy projection. */
export function Record() {
  const s = useStore();
  const thread = useProductThread();
  const [verification, setVerification] = useState<ProductThreadVerification | null>(null);
  const legacyEvents = s.events;
  const untrackedCount = legacyEvents.length;

  useEffect(() => setVerification(null), [thread.mutationVersion, untrackedCount]);

  const rederive = async () => setVerification(await rederiveProductThread(untrackedCount));
  const tamper = async () => {
    const latest = thread.events.at(-1);
    if (!latest || !tamperProductThread(latest.sequence)) return;
    setVerification(await rederiveProductThread(untrackedCount));
  };

  return (
    <div role="dialog" aria-label="Product decision record" className="absolute inset-0 bg-bg z-[9] flex flex-col overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-[10px] border-b border-line2 bg-surface print:hidden">
        <span className="min-w-0 break-words text-[13px] font-semibold">/record <span className="text-muted font-normal">· device-local Product Thread · printable</span></span>
        <span className="flex flex-wrap gap-2"><button onClick={() => void rederive()} className="btn btn-primary">Re-derive all recorded lanes</button><button onClick={() => void tamper()} disabled={thread.events.length === 0} className="btn disabled:opacity-40">Tamper latest + verify</button><button onClick={() => window.print()} className="btn">Print · Cmd-P</button><button onClick={() => s.patch({ recordOpen: false })} className="btn">Close · Esc</button></span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-surface text-ink">
        <div className="grid w-full min-w-0 max-w-[1100px] mx-auto gap-5 text-[13px] [overflow-wrap:anywhere]" id="record">
          <section className="border border-amber rounded-r p-3 bg-surface2">
            <h1 className="text-[20px] font-bold m-0">CADdyDaddy product revision thread</h1>
            <div className="font-semibold mt-2">Active project: {PRODUCT_NAME} · active CAD revision: {thread.currentCadRevision?.revisionId ?? 'not yet accepted'}</div>
            <div className="font-mono text-[11px] break-all mt-2">{thread.productId} · {thread.threadId}</div>
            <div className="text-amber mt-2"><b>DEVICE-LOCAL · UNSIGNED · NOT SHARED.</b> {PRODUCT_THREAD_DURABILITY_NOTICE} It has no user authentication, server sync, cross-browser concurrency, Ed25519 signature, or KMS/HSM custody.</div>
            <div className="mt-2"><b>{thread.storageStatus}</b> · {thread.storageDetail}</div>
            <div className="text-muted mt-2">{DESIGN_PROJECT_NAME} is the separate legacy Design context; its local timeline is not the active QX-0 Product Thread.</div>
            {thread.currentCadRevision && <div className="font-mono text-[11px] break-all mt-2">CAD document {thread.currentCadRevision.documentSha256} · geometry {thread.currentCadRevision.geometrySha256}</div>}
            <div className="text-amber mt-2"><b>BOM_CSV_ARTIFACT_SHA256 only.</b> The BOM binding identifies downloadable CSV bytes verified through the sealed package manifest. Semantic BOM graph digest: <b>NOT_PROVIDED</b>.</div>
            {thread.artifactBinding && <div className="font-mono text-[11px] break-all mt-2">BOM CSV artifact {thread.artifactBinding.bomCsvArtifactSha256} · semantic BOM digest {thread.artifactBinding.semanticBomDigest}</div>}
          </section>

          <section className="panel p-3 grid gap-2">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-[15px] font-semibold m-0">Integrity and replay</h2><span className="chip">{verification?.status ?? 'NOT_REDERIVED'}</span></div>
            <div className="font-mono text-[11px] break-all">recorded {thread.events.length} · head {short(thread.events.at(-1)?.eventHash ?? null)} · untracked legacy {untrackedCount}</div>
            {verification && <div role={verification.status === 'BROKEN' ? 'alert' : 'status'} className={`border rounded-r p-2 ${verification.status === 'BROKEN' ? 'border-red text-red' : verification.status === 'INCOMPLETE_UNTRACKED' ? 'border-amber text-amber' : 'border-line text-ink'}`}><b>{verification.status}</b> · {verification.detail}</div>}
            {!verification && <div className="text-muted">Run re-derive to recompute every event hash, previous-hash link, and every recorded lane projection.</div>}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
              {verification && Object.entries(verification.lanes).map(([lane, projection]) => <div key={lane} className="border border-line2 rounded-r p-2"><b>{lane}</b> · {projection.count} event(s)<div className="font-mono text-[10px] break-all">#{projection.lastSequence} {projection.lastEventType}<br />{short(projection.headEventHash)}</div></div>)}
            </div>
          </section>

          <section className="panel min-w-0">
            <div className="panel-head"><div className="panel-title">Recorded product-thread envelopes</div><span className="sub">all lanes · oldest first</span></div>
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[1050px] border-collapse"><thead><tr className="text-left text-muted"><th className="p-2"># / lane</th><th className="p-2">event</th><th className="p-2">revision + artifacts</th><th className="p-2">actor / attestation</th><th className="p-2">continuity</th><th className="p-2">boundary</th></tr></thead>
                <tbody>{thread.events.map((event) => <tr key={`${event.sequence}:${event.eventHash}`} className="border-t border-line2 align-top"><td className="p-2 font-mono">#{event.sequence}<br />{event.sourceLane}<br />{event.timestamp}</td><td className="p-2"><b>{event.eventType}</b><br /><span className="text-muted">{event.summary}</span></td><td className="p-2 font-mono text-[11px]">{event.revisionId ?? 'NOT_REVISION_BOUND'}{event.artifacts.map((artifact) => <div key={`${event.sequence}:${artifact.artifactId}`} className="mt-1 break-all">{artifact.kind} · {artifact.artifactId} · {artifact.sha256}</div>)}</td><td className="p-2 font-mono text-[11px]">{event.actorId}<br />{event.actorAttestation}</td><td className="p-2 font-mono text-[10px] break-all">prev {event.previousHash ?? 'GENESIS'}<br />event {event.eventHash}</td><td className="p-2 text-[11px]">{event.durabilityBoundary}<br />{event.signatureBoundary}</td></tr>)}</tbody>
              </table>
            </div>
            {thread.events.length === 0 && <div className="p-3 text-muted">No connected QX-0 workflow outcome has been recorded in this device-local Product Thread.</div>}
          </section>

          <section className="panel p-3 grid gap-2">
            <h2 className="text-[15px] font-semibold m-0">Outside the product thread · never counted as replay-complete</h2>
            <div className="text-amber"><b>{untrackedCount} {DESIGN_PROJECT_NAME} legacy event(s)</b> remain in the older design/sourcing projection. They lack the QX-0 envelope and are deliberately not imported or presented as cryptographically linked.</div>
            <div className="max-h-48 overflow-y-auto font-mono text-[11px]">{legacyEvents.map((event) => <div key={event.seq} className="border-t border-line2 py-1">#{event.seq} · {event.lane} · {event.kind} · {event.text}</div>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
