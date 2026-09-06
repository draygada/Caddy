import { useEffect, useMemo, useState } from 'react';
import {
  CoreCandidateError,
  getTripwireBinding,
  listCoreEntities,
  loadCachedCoreCandidate,
  loadCoreCandidate,
  type CoreCandidateLoad,
  type CoreEntityBinding,
} from '../lib/core-client';

const short = (value: string, keep = 10) => value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;

function Fact({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="grid grid-cols-[minmax(110px,0.55fr)_minmax(0,1fr)] gap-3 py-1.5 border-b border-line2 last:border-b-0 text-[12px]">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 font-mono break-all text-right">{String(value)}</dd>
    </div>
  );
}

function StatusPill({ available }: { available: boolean }) {
  return <span className="chip" aria-label={available ? 'available' : 'unavailable'}>{available ? 'Available' : 'Unavailable'}</span>;
}

function EntityButton({ entity, selected, onSelect }: { entity: CoreEntityBinding; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="row-hover w-full min-h-12 rounded-r px-2 py-1.5 text-left grid grid-cols-[32px_minmax(0,1fr)] gap-2 bg-transparent border text-ink cursor-pointer"
      style={{ borderColor: selected ? 'var(--focus)' : 'transparent', background: selected ? 'var(--surface2)' : 'transparent' }}
    >
      <span className="font-mono text-[12px] font-semibold" aria-hidden="true">F{entity.ordinal}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium truncate">{entity.binding.coreSemanticReferenceId}</span>
        <span className="block text-[11px] text-muted font-mono truncate">{entity.entityId}</span>
      </span>
    </button>
  );
}

export function CoreAssemblyWorkspace() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [load, setLoad] = useState<CoreCandidateLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  async function fetchLive() {
    setPhase('loading');
    setError(null);
    try {
      const next = await loadCoreCandidate();
      const first = listCoreEntities(next.candidate)[0]?.entityId ?? null;
      setLoad(next);
      setSelectedEntityId((current) => current && listCoreEntities(next.candidate).some((entity) => entity.entityId === current) ? current : first);
      setPhase('ready');
    } catch (cause) {
      const message = cause instanceof CoreCandidateError ? cause.message : 'The core candidate could not be loaded.';
      setError(message);
      setPhase(load ? 'ready' : 'error');
    }
  }

  function useRecoveryFixture() {
    const next = loadCachedCoreCandidate();
    setLoad(next);
    setSelectedEntityId(listCoreEntities(next.candidate)[0]?.entityId ?? null);
    setError(null);
    setPhase('ready');
  }

  useEffect(() => {
    let active = true;
    void loadCoreCandidate()
      .then((next) => {
        if (!active) return;
        setLoad(next);
        setSelectedEntityId(listCoreEntities(next.candidate)[0]?.entityId ?? null);
        setPhase('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof CoreCandidateError ? cause.message : 'The core candidate could not be loaded.');
        setPhase('error');
      });
    return () => { active = false; };
  }, []);

  const entities = useMemo(() => load ? listCoreEntities(load.candidate) : [], [load]);
  const selected = entities.find((entity) => entity.entityId === selectedEntityId) ?? null;
  const request = load && selected ? getTripwireBinding(load.candidate, selected.entityId) : null;
  const candidate = load?.candidate ?? null;

  if (!candidate) {
    return (
      <section aria-labelledby="core-workspace-title" className="panel min-h-[360px] grid place-items-center p-6">
        <div className="max-w-xl text-center grid gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[.12em] text-muted">Core / assembly</div>
            <h2 id="core-workspace-title" className="m-0 mt-1 text-xl">Immutable Candidate workspace</h2>
          </div>
          {phase === 'loading' ? (
            <div role="status" aria-live="polite" className="text-[14px] text-muted">Loading the real <span className="font-mono">/api/candidate</span> contract…</div>
          ) : (
            <div role="alert" className="grid gap-3">
              <p className="m-0 text-[14px]">{error}</p>
              <p className="m-0 text-[12px] text-muted">Recovery never enables editing or recompute. It opens a pinned, visibly labeled Candidate 0.1 fixture.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="btn btn-primary" onClick={() => void fetchLive()}>Retry live contract</button>
                <button type="button" className="btn" onClick={useRecoveryFixture}>Open cached fixture</button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  const grouped = candidate.document.scene.nodes.map((node) => ({
    node,
    body: candidate.document.bodies.find((body) => body.bodyId === node.bodyId),
    entities: entities.filter((entity) => entity.nodeId === node.nodeId),
  }));
  const diagnostics = candidate.states.current.diagnostics;
  const modeLabel = load.source === 'api' ? 'API contract' : 'Cached fixture';

  return (
    <section aria-labelledby="core-workspace-title" className="grid gap-3 min-w-0">
      <header className="panel p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[.12em] text-muted">Core / assembly workspace</div>
          <h2 id="core-workspace-title" className="m-0 mt-1 text-xl">{candidate.document.label}</h2>
          <p className="m-0 mt-1 text-[12px] text-muted">Two-body assembly · {entities.length} exact entity bindings · {candidate.document.operations.length} operation</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{modeLabel}</span>
          <span className="chip">{candidate.snapshotProvenance.mode}</span>
          <span className="chip">revision {short(candidate.document.revisionId, 8)}</span>
          <button type="button" className="btn" disabled={phase === 'loading'} onClick={() => void fetchLive()}>{phase === 'loading' ? 'Refreshing…' : 'Refresh API'}</button>
        </div>
      </header>

      <div role="status" aria-live="polite" className="panel px-4 py-3 border-l-4" style={{ borderLeftColor: load.source === 'api' ? 'var(--ok)' : 'var(--warn)' }}>
        <div className="font-semibold text-[13px]">Precomputed immutable snapshot</div>
        <div className="mt-1 text-[12px] text-muted">Live recompute is unavailable. The kernel succeeded at build time; this deployed workspace is read-only and does not execute OCCT.</div>
        {load.warning && <div className="mt-2 text-[12px]" role="alert">{load.warning}</div>}
        {error && <div className="mt-2 text-[12px]" role="alert">Refresh failed: {error} The currently displayed snapshot was preserved.</div>}
      </div>

      <div className="grid grid-cols-[minmax(230px,.7fr)_minmax(300px,1fr)_minmax(320px,1.15fr)] gap-3 items-start max-[1050px]:grid-cols-2 max-[720px]:grid-cols-1">
        <div className="panel min-w-0">
          <div className="panel-head"><div className="panel-title">Assembly <span className="sub">· select a face</span></div><span className="chip">2 bodies</span></div>
          {grouped.map(({ node, body, entities: bodyEntities }) => (
            <div key={node.nodeId} className="border-b border-line2 last:border-b-0">
              <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border border-line" style={{ background: node.appearance.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{node.label}</div>
                  <div className="text-[11px] text-muted truncate">{body?.material ?? 'Material unavailable'} · {node.visible ? 'visible' : 'hidden'}</div>
                </div>
                <span className="chip">{bodyEntities.length} faces</span>
              </div>
              <div className="px-2 pb-2" role="group" aria-label={`${node.label} selectable entities`}>
                {bodyEntities.map((entity) => <EntityButton key={entity.entityId} entity={entity} selected={entity.entityId === selectedEntityId} onSelect={() => setSelectedEntityId(entity.entityId)} />)}
              </div>
              <dl className="m-0 px-3 pb-3">
                <Fact label="Node" value={node.nodeId} />
                <Fact label="Translation" value={`${node.transform.translation.join(', ')} ${candidate.document.units.length}`} />
              </dl>
            </div>
          ))}
        </div>

        <div className="grid gap-3 min-w-0">
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Operation graph <span className="sub">· build-time</span></div><span className="chip">{candidate.states.current.recomputeStatus}</span></div>
            <div className="p-3 grid gap-3">
              {candidate.document.operations.map((operation) => (
                <article key={operation.operationId} className="border border-line2 rounded p-3">
                  <div className="flex flex-wrap justify-between gap-2"><strong className="text-[13px]">{operation.label}</strong><span className="chip">{candidate.states.current.operationStatus[operation.operationId] ?? 'UNKNOWN'}</span></div>
                  <div className="mt-1 text-[11px] font-mono text-muted break-all">{operation.operationId} · {operation.type}@{operation.typeVersion}</div>
                  <div className="mt-3 text-[11px] uppercase tracking-[.08em] text-muted">Parameter bindings</div>
                  <div className="mt-1 grid gap-1">
                    {Object.entries(operation.parameterBindings).map(([slot, parameterId]) => {
                      const parameter = candidate.document.parameters.find((item) => item.parameterId === parameterId);
                      return <div key={slot} className="flex justify-between gap-3 text-[12px]"><span>{slot}</span><span className="font-mono text-right">{parameter?.literal ?? '—'} {parameter?.unit ?? ''} <span className="text-muted">({parameterId})</span></span></div>;
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-muted">Depends on: {operation.dependsOn.length ? operation.dependsOn.join(', ') : 'root operation'}</div>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Runtime capabilities</div><span className="chip">read-only</span></div>
            <dl className="m-0 px-3 py-1">
              {Object.entries(candidate.capabilities).map(([capability, available]) => (
                <div key={capability} className="flex items-center justify-between gap-3 py-2 border-b border-line2 last:border-b-0 text-[12px]">
                  <dt className="font-mono break-all">{capability}</dt><dd className="m-0"><StatusPill available={available} /></dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Diagnostics</div><span className="chip">{diagnostics.length}</span></div>
            <div className="p-3 text-[12px]">
              {diagnostics.length === 0 ? <span className="text-muted">No kernel diagnostics were reported in this snapshot.</span> : <pre className="m-0 whitespace-pre-wrap break-all font-mono">{JSON.stringify(diagnostics, null, 2)}</pre>}
            </div>
          </div>
        </div>

        <div className="grid gap-3 min-w-0 max-[1050px]:col-span-2 max-[720px]:col-span-1">
          <div className="panel">
            <div className="panel-head"><div className="panel-title">Selected entity binding <span className="sub">· exact Tripwire request</span></div><span className="chip">{selected ? `F${selected.ordinal}` : 'none'}</span></div>
            {selected && request ? (
              <div className="p-3 grid gap-3">
                <dl className="m-0">
                  <Fact label="Body" value={selected.bodyLabel} />
                  <Fact label="Entity" value={selected.entityId} />
                  <Fact label="Core entity" value={selected.binding.coreEntityId} />
                  <Fact label="Semantic ref" value={selected.binding.coreSemanticReferenceId} />
                  <Fact label="Feature" value={selected.featureId} />
                </dl>
                <div>
                  <div className="text-[11px] uppercase tracking-[.08em] text-muted mb-1">Request body sent without adaptation</div>
                  <pre tabIndex={0} aria-label="Exact Tripwire request JSON" className="m-0 max-h-72 overflow-auto rounded bg-surface2 border border-line2 p-3 text-[11px] leading-5 font-mono whitespace-pre-wrap break-all">{JSON.stringify(request, null, 2)}</pre>
                </div>
              </div>
            ) : <div className="p-3 text-[13px] text-muted">Select a mapped entity to inspect its immutable review binding.</div>}
          </div>

          <div className="panel">
            <div className="panel-head"><div className="panel-title">Revision & kernel provenance</div><span className="chip">verified chain</span></div>
            <dl className="m-0 p-3">
              <Fact label="Revision" value={candidate.document.revisionId} />
              <Fact label="Content hash" value={candidate.forgeRevision.content_hash} />
              <Fact label="Geometry hash" value={candidate.forgeRevision.geometry_artifact_hash} />
              <Fact label="Artifact" value={candidate.kernelProvenance.geometryArtifactId} />
              <Fact label="Kernel" value={candidate.kernelProvenance.kernel} />
              <Fact label="Binding" value={candidate.kernelProvenance.binding} />
              <Fact label="Toolchain" value={candidate.kernelProvenance.toolchain} />
              <Fact label="Platform" value={candidate.kernelProvenance.platformImage} />
              <Fact label="Engine manifest" value={candidate.kernelProvenance.engineManifestHash} />
              <Fact label="Source commit" value={candidate.snapshotProvenance.source.commit} />
              <Fact label="Source tree" value={candidate.snapshotProvenance.source.tree} />
              <Fact label="Loaded" value={load.loadedAt} />
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
