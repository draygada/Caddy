import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  CadApiError,
  applyCadIntent,
  cadAuthoringReducer,
  cadId,
  createCadAuthoringState,
  createCadDocument,
  createFeatureOperation,
  createInstanceOperation,
  createMateOperation,
  createParameterOperation,
  createSketchOperation,
  exportCad,
  importCad,
  recomputeCad,
  type CadAssemblyMate,
  type CadDocument,
  type CadExportResponse,
  type CadFeatureKind,
  type CadOperation,
  type CadSketch,
  type CadTransferFormat,
  type SketchConstraintKind,
  type SketchDimensionKind,
  type SketchEntity,
} from '../cad';
import {
  CAD_OUTPUT_LIMITATIONS,
  createNativeDocumentDraft,
  downloadCadOutputArtifact,
  generateCadOutputs,
  loadNativeDocument,
  restoreNativeAuthoring,
  sealNativeDocument,
  type CadNativeEnvelope,
  type CadOutputArtifact,
  type CadOutputBundle,
} from '../cad/output-client';

type AuthoringWorkspaceProps = { fetchImpl?: typeof fetch; initialDocument?: CadDocument };

/** Small helpers so every control here is the same control as the rest of Caddy. */
const fieldCls = 'field min-h-[32px] text-[13px] w-full';
const noteCls = 'text-[12px] text-muted leading-snug';
const statusTone = (status: string) => (status === 'failed' || status === 'stale' ? 'var(--red)' : status === 'running' || status === 'queued' ? 'var(--amber)' : 'var(--green)');
const statusWord = (status: string) => (status === 'failed' ? 'failed' : status === 'stale' ? 'stale' : status === 'running' ? 'running' : status === 'queued' ? 'queued' : status === 'idle' ? 'idle' : 'valid');

function Panel({ title, sub, trailing, children, id }: { title: string; sub?: string; trailing?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="panel">
      <div className="panel-head py-[8px]">
        <div className="panel-title" id={id}>{title}{sub && <span className="sub"> · {sub}</span>}</div>
        {trailing && <span className="text-[12px] text-muted whitespace-nowrap">{trailing}</span>}
      </div>
      <div className="p-3 grid gap-2">{children}</div>
    </section>
  );
}

function initialSketch(): CadSketch {
  return {
    id: cadId('sketch'),
    name: 'Sketch 1',
    plane: { kind: 'origin', plane: 'XY' },
    entities: [{ id: cadId('entity'), kind: 'rectangle', construction: false, origin: { x: -20, y: -12 }, width: 40, height: 24 }],
    dimensions: [],
    constraints: [],
    solverState: 'unresolved',
  };
}

export function AuthoringWorkspace({ fetchImpl = fetch, initialDocument }: AuthoringWorkspaceProps) {
  const [state, dispatch] = useReducer(cadAuthoringReducer, initialDocument ?? createCadDocument(), createCadAuthoringState);
  // the workspace lives inside the viewport pane, so the three columns only appear when there is room for them
  const hostRef = useRef<HTMLElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWide(host.clientWidth >= 1000);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(host);
    return () => ro?.disconnect();
  }, []);
  const [sketch, setSketch] = useState<CadSketch>(initialSketch);
  const [featureKind, setFeatureKind] = useState<CadFeatureKind>('feature.extrude');
  const [featureName, setFeatureName] = useState('Extrude 1');
  const [featureInputs, setFeatureInputs] = useState(sketch.id);
  const [featureTargets, setFeatureTargets] = useState('');
  const [featureValue, setFeatureValue] = useState(10);
  const [outputBodyName, setOutputBodyName] = useState('Body 1');
  const [parameterName, setParameterName] = useState('thickness');
  const [parameterExpression, setParameterExpression] = useState('4 mm');
  const [instanceName, setInstanceName] = useState('Component 1');
  const [instanceBody, setInstanceBody] = useState('');
  const [mate, setMate] = useState<Pick<CadAssemblyMate, 'name' | 'kind' | 'instanceAId' | 'instanceBId' | 'offset'>>({ name: 'Mate 1', kind: 'coincident', instanceAId: '', instanceBId: '', offset: 0 });
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [nativeEnvelope, setNativeEnvelope] = useState<CadNativeEnvelope | null>(null);
  const [sealedSnapshotArtifact, setSealedSnapshotArtifact] = useState<CadOutputArtifact | null>(null);
  const [outputBundle, setOutputBundle] = useState<CadOutputBundle | null>(null);
  const [outputMessage, setOutputMessage] = useState<string | null>(null);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [outputBusy, setOutputBusy] = useState(false);
  const [kernelArtifacts, setKernelArtifacts] = useState<CadExportResponse[]>([]);

  async function submitOperation(operation: CadOperation) {
    const requestId = cadId('request');
    const draft = applyCadIntent(state.document, operation);
    const executionPreference = state.kernel?.engineMode === 'BROWSER_JSCAD_BOUNDED' ? 'BROWSER_JSCAD_BOUNDED' : 'AUTO';
    dispatch({ type: 'stage', operation, requestId });
    dispatch({ type: 'started', requestId });
    try {
      const response = await recomputeCad({ document: draft, operation, expectedRevisionId: state.lastValidDocument.revisionId }, fetchImpl, executionPreference);
      dispatch({ type: 'succeeded', requestId, response });
      setFormError(null);
    } catch (error) {
      dispatch({ type: 'failed', requestId, error: error instanceof Error ? error.message : 'CAD recompute failed.', stale: error instanceof CadApiError && error.code === 'CAD_STALE', diagnostics: error instanceof CadApiError ? error.diagnostics : undefined });
    }
  }

  function safely(build: () => CadOperation) {
    try {
      void submitOperation(build());
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The operation is invalid.');
    }
  }

  async function handleImport(file: File, format: CadTransferFormat) {
    setTransferMessage(`Reading ${file.name}…`);
    try {
      const response = await importCad({ format, fileName: file.name, dataBase64: await fileToBase64(file), expectedRevisionId: state.lastValidDocument.revisionId }, fetchImpl);
      dispatch({ type: 'replace-from-import', response });
      setTransferMessage(`Imported ${file.name} as authoritative revision ${response.revisionId}.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : 'Import failed; the last valid document is unchanged.');
    }
  }

  async function handleExport(format: CadTransferFormat) {
    setTransferMessage(`Requesting ${format} export…`);
    try {
      const result = await exportCad({ document: state.lastValidDocument, format, revisionId: state.lastValidDocument.revisionId }, fetchImpl);
      downloadExport(result);
      setKernelArtifacts((current) => [...current.filter((item) => item.format !== result.format), result]);
      setTransferMessage(`Exported ${result.fileName} from ${result.revisionId}.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : 'Export failed; no file was created.');
    }
  }

  async function handleNativeSeal() {
    setOutputBusy(true);
    setOutputMessage('Validating and sealing CADdyDaddy snapshot (.caddy.json)…');
    try {
      if (!state.lastValidMesh) throw new Error('Run one successful kernel recompute before sealing a CADdyDaddy snapshot.');
      const envelope = await sealNativeDocument(await createNativeDocumentDraft(state.lastValidDocument, state.lastValidMesh), fetchImpl);
      setNativeEnvelope(envelope);
      setSealedSnapshotArtifact(envelope.artifact);
      setOutputError(null);
      setOutputMessage(`Sealed CADdyDaddy snapshot revision ${shortId(envelope.document.revision_id)} · ${shortId(envelope.document.document_hash)}. Download it explicitly when ready.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'CADdyDaddy snapshot seal failed closed.');
      setOutputMessage('Last valid snapshot/output state preserved. No replacement snapshot was sealed.');
    } finally { setOutputBusy(false); }
  }

  async function handleArtifactDownload(artifact: CadOutputArtifact) {
    setOutputBusy(true);
    setOutputMessage(`Validating ${artifact.path} before download…`);
    try {
      await downloadCadOutputArtifact(artifact);
      setOutputError(null);
      setOutputMessage(`Download requested for ${artifact.path.split('/').at(-1) ?? artifact.path}. Your browser controls where the file is saved.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'Artifact download failed closed.');
      setOutputMessage('No download was requested. Last valid snapshot/output state preserved.');
    } finally { setOutputBusy(false); }
  }

  async function handleNativeLoad(file: File) {
    setOutputBusy(true);
    setOutputMessage(`Validating ${file.name}…`);
    try {
      const envelope = await loadNativeDocument(await fileToBase64(file), fetchImpl);
      dispatch({ type: 'replace-from-import', response: restoreNativeAuthoring(envelope.document) });
      setNativeEnvelope(envelope);
      setSealedSnapshotArtifact(envelope.artifact);
      setOutputBundle(null);
      setKernelArtifacts([]);
      setOutputError(null);
      setOutputMessage(`Loaded schema- and hash-validated CADdyDaddy snapshot revision ${shortId(envelope.document.revision_id)}. Exchange artifacts must be regenerated.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'CADdyDaddy snapshot load failed closed.');
      setOutputMessage('Last valid authoring state preserved.');
    } finally { setOutputBusy(false); }
  }

  async function handleGenerateOutputs() {
    setOutputBusy(true);
    setOutputMessage('Sealing CADdyDaddy snapshot and deriving output package…');
    try {
      if (!state.lastValidMesh) throw new Error('Run one successful kernel recompute before generating outputs.');
      const envelope = await sealNativeDocument(await createNativeDocumentDraft(state.lastValidDocument, state.lastValidMesh), fetchImpl);
      const currentArtifacts = kernelArtifacts.filter((artifact) => artifact.revisionId === state.lastValidDocument.revisionId);
      const bundle = await generateCadOutputs({ document: envelope.document, mesh: state.lastValidMesh, kernelArtifacts: currentArtifacts }, fetchImpl);
      setNativeEnvelope(envelope);
      setSealedSnapshotArtifact(envelope.artifact);
      setOutputBundle(bundle);
      setOutputError(null);
      setOutputMessage(`Validated ${bundle.artifacts.length} artifacts available for explicit download · package ${shortId(bundle.package.package_id)}.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'Output generation failed closed.');
      setOutputMessage('Last valid output bundle preserved. No replacement artifacts were admitted.');
    } finally { setOutputBusy(false); }
  }

  const engineMode = state.kernel?.engineMode ?? (state.kernel?.mode === 'live' ? 'CONNECTED_OCCT' : 'AUTO_CONNECTED_OCCT_OR_BROWSER_JSCAD_BOUNDED');
  const engineLabel = engineMode === 'CONNECTED_OCCT' ? 'Connected Candidate 0.2 service · stateless kernel adapter' : engineMode === 'BROWSER_JSCAD_BOUNDED' ? 'browser kernel · bounded JSCAD fallback' : 'kernel · connected service when reachable, browser fallback otherwise';
  const kernelWord = state.kernel ? `${state.kernel.name} ${state.kernel.version}` : 'kernel not yet proven';

  return (
    <section ref={hostRef} data-cad-authoring-workspace aria-labelledby="cad-authoring-title" className="cad-authoring-workspace h-full min-h-0 overflow-auto bg-bg text-ink">
      <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 border-b border-line2 bg-surface">
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <span id="cad-authoring-title" className="text-[13px] font-semibold">CAD authoring</span>
          <span className="text-[13px] text-muted">{state.document.name} · draft {shortId(state.document.revisionId)} · rendered {shortId(state.lastValidDocument.revisionId)}</span>
          <span className="text-[12px] text-muted" title={engineMode}>{engineLabel}</span>
        </div>
        <span role="status" aria-live="polite" className="status-word text-[13px]" style={{ color: statusTone(state.status) }}>{statusWord(state.status)} · {kernelWord}</span>
      </div>

      {(state.error || formError) && (
        <div role="alert" className="mx-3 mt-2 px-3 py-2 rounded-r border text-[13px] flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
          <span>{formError ?? state.error}</span>
          <button type="button" onClick={() => dispatch({ type: 'recover-last-valid' })} className="btn btn-xs">Restore last valid</button>
        </div>
      )}

      <div className="cad-authoring-layout" style={{ display: 'grid', gap: 8, padding: 8, alignItems: 'start', ...(wide ? { gridTemplateColumns: 'minmax(220px, .72fr) minmax(360px, 1.45fr) minmax(280px, .95fr)' } : { gridTemplateColumns: 'minmax(0, 1fr)' }) }}>
        <aside className="cad-authoring-column" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <ProjectTree document={state.document} selectedId={state.selectedId} onSelect={(id) => dispatch({ type: 'select', id })} />
          <TransferPanel message={transferMessage} onImport={handleImport} onExport={handleExport} />
          <OutputPanel
            busy={outputBusy}
            nativeEnvelope={nativeEnvelope}
            sealedSnapshotArtifact={sealedSnapshotArtifact}
            bundle={outputBundle}
            message={outputMessage}
            error={outputError}
            retainedFormats={kernelArtifacts.filter((artifact) => artifact.revisionId === state.lastValidDocument.revisionId).map((artifact) => artifact.format)}
            onNativeSeal={handleNativeSeal}
            onNativeLoad={handleNativeLoad}
            onGenerate={handleGenerateOutputs}
            onDownload={handleArtifactDownload}
          />
        </aside>

        <main className="cad-authoring-column" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <SemanticMesh mesh={state.lastValidMesh} document={state.lastValidDocument} />
          <DependencyRail graph={state.dependencyGraph} history={state.history} diagnostics={state.diagnostics} />
          <div className={noteCls}>The connected OCCT service is used when it is reachable. Otherwise the browser kernel does bounded solid modelling and real STL exchange. Failed, stale or unsupported work never replaces the last valid model.</div>
        </main>

        <aside className="cad-authoring-column" style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <SketchEditor sketch={sketch} onChange={setSketch} onCommit={() => { setFeatureInputs(sketch.id); safely(() => createSketchOperation(sketch)); }} />
          <Panel id="feature-builder-title" title="Feature">
            <select aria-label="Feature type" value={featureKind} onChange={(event) => { const kind = event.target.value as CadFeatureKind; setFeatureKind(kind); setFeatureName(featureLabel(kind)); }} className={fieldCls}>
              {FEATURE_KINDS.map((kind) => <option key={kind} value={kind}>{featureLabel(kind)}{kind === 'feature.fillet' || kind === 'feature.chamfer' ? ' · connected service only' : ''}</option>)}
            </select>
            <input aria-label="Feature name" value={featureName} onChange={(event) => setFeatureName(event.target.value)} className={fieldCls} />
            <input aria-label="Feature input references" placeholder="sketch, entity or body ids, comma separated" value={featureInputs} onChange={(event) => setFeatureInputs(event.target.value)} className={fieldCls} />
            <input aria-label="Target body references" placeholder="target body ids, comma separated" value={featureTargets} onChange={(event) => setFeatureTargets(event.target.value)} className={fieldCls} />
            <div className="flex gap-2">
              <button type="button" disabled={!state.selectedId} onClick={() => state.selectedId && setFeatureInputs(state.selectedId)} className="btn btn-xs disabled:opacity-50">Use selection as input</button>
              <button type="button" disabled={!state.selectedId} onClick={() => state.selectedId && setFeatureTargets(state.selectedId)} className="btn btn-xs disabled:opacity-50">Use selection as target</button>
            </div>
            <label className="grid gap-1 text-[12px] text-muted">distance, angle or radius
              <input aria-label="Feature numeric value" type="number" value={featureValue} onChange={(event) => setFeatureValue(Number(event.target.value))} className={fieldCls + ' font-mono'} />
            </label>
            <input aria-label="Output body name" placeholder="new body name; blank modifies the targets" value={outputBodyName} onChange={(event) => setOutputBodyName(event.target.value)} className={fieldCls} />
            <button type="button" onClick={() => safely(() => createFeatureOperation({ kind: featureKind, name: featureName, inputIds: ids(featureInputs), targetBodyIds: ids(featureTargets), outputBodyName, parameters: featureParameters(featureKind, featureValue) }))} className="btn btn-primary">Queue {featureLabel(featureKind)}</button>
          </Panel>

          <Panel id="parameters-title" title="Parameters" trailing={state.document.parameters.length + ' defined'}>
            {state.document.parameters.map((parameter) => <div key={parameter.id} className="font-mono text-[12px]">{parameter.name} = {parameter.expression}</div>)}
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Parameter name" value={parameterName} onChange={(event) => setParameterName(event.target.value)} className={fieldCls} />
              <input aria-label="Parameter expression" value={parameterExpression} onChange={(event) => setParameterExpression(event.target.value)} className={fieldCls + ' font-mono'} />
            </div>
            <button type="button" onClick={() => safely(() => createParameterOperation({ id: state.document.parameters.find((item) => item.name === parameterName)?.id ?? cadId('parameter'), name: parameterName, expression: parameterExpression, unit: 'mm', resolvedValue: null }))} className="btn">Stage parameter</button>
          </Panel>

          <Panel id="assembly-title" title="Assembly" sub="instances and mates">
            <input aria-label="Instance name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} className={fieldCls} />
            <select aria-label="Instance body" value={instanceBody} onChange={(event) => setInstanceBody(event.target.value)} className={fieldCls}>
              <option value="">choose a body</option>{state.document.bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
            </select>
            <button type="button" disabled={!instanceBody} onClick={() => safely(() => createInstanceOperation({ id: cadId('instance'), name: instanceName, bodyId: instanceBody, grounded: state.document.assembly.instances.length === 0, transform: { translation: [0, 0, 0], rotationDegrees: [0, 0, 0] } }))} className="btn disabled:opacity-50">Insert instance</button>
            <div className="border-t border-line2 pt-2 grid gap-2">
              <input aria-label="Mate name" value={mate.name} onChange={(event) => setMate({ ...mate, name: event.target.value })} className={fieldCls} />
              <select aria-label="Mate type" value={mate.kind} onChange={(event) => setMate({ ...mate, kind: event.target.value as CadAssemblyMate['kind'] })} className={fieldCls}>{MATE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="First mate instance" value={mate.instanceAId} onChange={(event) => setMate({ ...mate, instanceAId: event.target.value })} className={fieldCls}><option value="">instance A</option>{state.document.assembly.instances.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select aria-label="Second mate instance" value={mate.instanceBId} onChange={(event) => setMate({ ...mate, instanceBId: event.target.value })} className={fieldCls}><option value="">instance B</option>{state.document.assembly.instances.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </div>
              <button type="button" onClick={() => safely(() => createMateOperation({ id: cadId('mate'), name: mate.name, kind: mate.kind, instanceAId: mate.instanceAId, instanceBId: mate.instanceBId, referenceA: 'origin', referenceB: 'origin', offset: mate.offset, unit: mate.kind === 'angle' ? 'deg' : 'mm' }))} className="btn">Stage mate</button>
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

const FEATURE_KINDS: CadFeatureKind[] = ['feature.extrude', 'feature.revolve', 'feature.boolean.union', 'feature.boolean.subtract', 'feature.boolean.intersect', 'feature.hole', 'feature.fillet', 'feature.chamfer'];
const MATE_KINDS: CadAssemblyMate['kind'][] = ['fixed', 'coincident', 'concentric', 'distance', 'angle'];

function ProjectTree({ document, selectedId, onSelect }: { document: CadDocument; selectedId: string | null; onSelect: (id: string) => void }) {
  const sections = [
    { label: 'Sketches', rows: document.sketches.map((item) => ({ id: item.id, label: item.name, meta: `${item.entities.length} entities · ${item.solverState}` })) },
    { label: 'Bodies', rows: document.bodies.map((item) => ({ id: item.id, label: item.name, meta: `${item.featureIds.length} features · ${item.state}` })) },
    { label: 'Instances', rows: document.assembly.instances.map((item) => ({ id: item.id, label: item.name, meta: item.grounded ? 'grounded' : 'free' })) },
    { label: 'Mates', rows: document.assembly.mates.map((item) => ({ id: item.id, label: item.name, meta: item.kind })) },
  ];
  return (
    <section aria-labelledby="project-tree-title" className="panel">
      <div className="panel-head py-[8px]"><div className="panel-title" id="project-tree-title">Model tree</div></div>
      <div role="tree" className="py-1">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="tree-row" style={{ cursor: 'default', gridTemplateColumns: 'minmax(0,1fr) auto', paddingLeft: 10 }}><span className="tree-name font-semibold">{section.label}</span><span className="text-[12px] text-muted">{section.rows.length}</span></div>
            {section.rows.length === 0 && <div className="text-[12px] text-muted" style={{ paddingLeft: 26, minHeight: 22 }}>none yet</div>}
            {section.rows.map((row) => (
              <button key={row.id} type="button" role="treeitem" aria-selected={selectedId === row.id} onClick={() => onSelect(row.id)} className="tree-row" data-active={selectedId === row.id ? 'true' : 'false'} style={{ gridTemplateColumns: 'minmax(0,1fr) auto', paddingLeft: 26 }}>
                <span className="tree-name">{row.label}</span>
                <span className="text-[12px] text-muted whitespace-nowrap">{row.meta}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function SketchEditor({ sketch, onChange, onCommit }: { sketch: CadSketch; onChange: (sketch: CadSketch) => void; onCommit: () => void }) {
  const [dimensionKind, setDimensionKind] = useState<SketchDimensionKind>('distance');
  const [constraintKind, setConstraintKind] = useState<SketchConstraintKind>('coincident');
  const [referenceIds, setReferenceIds] = useState('');
  return (
    <Panel id="sketch-editor-title" title="Sketch" trailing={`${sketch.dimensions.length} dimensions · ${sketch.constraints.length} constraints`}>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <input aria-label="Sketch name" value={sketch.name} onChange={(event) => onChange({ ...sketch, name: event.target.value })} className={fieldCls} />
        <select aria-label="Sketch plane" value={sketch.plane.kind === 'origin' ? sketch.plane.plane : 'FACE'} onChange={(event) => onChange({ ...sketch, plane: event.target.value === 'FACE' ? { kind: 'face', entityId: '' } : { kind: 'origin', plane: event.target.value as 'XY' | 'XZ' | 'YZ' } })} className={fieldCls}><option>XY</option><option>XZ</option><option>YZ</option><option value="FACE">Face</option></select>
      </div>
      {sketch.plane.kind === 'face' && <input aria-label="Sketch face entity reference" placeholder="face entity id" value={sketch.plane.entityId} onChange={(event) => onChange({ ...sketch, plane: { kind: 'face', entityId: event.target.value } })} className={fieldCls} />}
      <div aria-label="Add sketch entity" className="flex gap-1 flex-wrap">{(['line', 'circle', 'rectangle', 'arc', 'spline'] as SketchEntity['kind'][]).map((kind) => <button key={kind} type="button" onClick={() => onChange({ ...sketch, entities: [...sketch.entities, defaultEntity(kind)] })} className="btn btn-xs">{kind}</button>)}</div>
      <div className="grid gap-1">{sketch.entities.map((entity, index) => <EntityRow key={entity.id} entity={entity} onChange={(next) => onChange({ ...sketch, entities: sketch.entities.map((item) => item.id === next.id ? next : item) })} onRemove={() => onChange({ ...sketch, entities: sketch.entities.filter((item) => item.id !== entity.id) })} index={index} />)}</div>
      <div className="border-t border-line2 pt-2 grid grid-cols-2 gap-2">
        <select aria-label="Dimension kind" value={dimensionKind} onChange={(event) => setDimensionKind(event.target.value as SketchDimensionKind)} className={fieldCls}>{(['distance', 'horizontal-distance', 'vertical-distance', 'radius', 'diameter', 'angle'] as SketchDimensionKind[]).map((kind) => <option key={kind}>{kind}</option>)}</select>
        <select aria-label="Constraint kind" value={constraintKind} onChange={(event) => setConstraintKind(event.target.value as SketchConstraintKind)} className={fieldCls}>{(['coincident', 'horizontal', 'vertical', 'parallel', 'perpendicular', 'tangent', 'equal', 'concentric', 'fixed'] as SketchConstraintKind[]).map((kind) => <option key={kind}>{kind}</option>)}</select>
        <input aria-label="Sketch relation entity references" placeholder="entity ids, comma separated" value={referenceIds} onChange={(event) => setReferenceIds(event.target.value)} className={fieldCls + ' col-span-2'} />
        <button type="button" onClick={() => onChange({ ...sketch, dimensions: [...sketch.dimensions, { id: cadId('dimension'), kind: dimensionKind, entityIds: ids(referenceIds), value: 10, expression: null, unit: dimensionKind === 'angle' ? 'deg' : 'mm' }] })} className="btn btn-xs">Add dimension</button>
        <button type="button" onClick={() => onChange({ ...sketch, constraints: [...sketch.constraints, { id: cadId('constraint'), kind: constraintKind, entityIds: ids(referenceIds) }] })} className="btn btn-xs">Add constraint</button>
      </div>
      <div className={noteCls}>the connected service solves the sketch; the browser kernel records it without solving</div>
      <button type="button" onClick={onCommit} className="btn btn-primary">Queue sketch for recompute</button>
    </Panel>
  );
}

function EntityRow({ entity, onChange, onRemove, index }: { entity: SketchEntity; onChange: (entity: SketchEntity) => void; onRemove: () => void; index: number }) {
  const values = entityNumbers(entity);
  return (
    <div className="grid grid-cols-[76px_1fr_auto] gap-2 items-center">
      <span className="text-[12px] text-muted whitespace-nowrap">{index + 1} · {entity.kind}</span>
      <input aria-label={`${entity.kind} geometry values`} value={values.join(', ')} onChange={(event) => onChange(updateEntityNumbers(entity, event.target.value.split(',').map(Number)))} className="field min-h-[28px] text-[12px] font-mono w-full" />
      <button type="button" aria-label={`Remove ${entity.kind}`} onClick={onRemove} className="btn btn-xs">×</button>
    </div>
  );
}

function SemanticMesh({ mesh, document }: { mesh: ReturnType<typeof createCadAuthoringState>['lastValidMesh']; document: CadDocument }) {
  const projected = useMemo(() => mesh?.vertices.map(([x, y, z]) => [120 + x * 3 + z, 105 - y * 3 - z * .5] as const) ?? [], [mesh]);
  return (
    <section aria-labelledby="mesh-title" className="panel">
      <div className="panel-head py-[8px]"><div className="panel-title" id="mesh-title">Last valid mesh</div><span className="text-[12px] text-muted">{mesh ? `${mesh.triangles.length} triangles` : 'no kernel mesh yet'}</span></div>
      <svg role="img" aria-labelledby="semantic-mesh-title semantic-mesh-desc" viewBox="0 0 240 210" className="block w-full min-h-[270px] bg-surface2">
        <title id="semantic-mesh-title">Revision-bound CAD mesh projection</title>
        <desc id="semantic-mesh-desc">Two-dimensional projection of {document.bodies.length} bodies from revision {document.revisionId}.</desc>
        {Array.from({ length: 13 }, (_, i) => <line key={'gx' + i} x1={i * 20} y1={0} x2={i * 20} y2={210} stroke="var(--line2)" strokeWidth=".5" />)}
        {Array.from({ length: 11 }, (_, i) => <line key={'gy' + i} x1={0} y1={i * 21} x2={240} y2={i * 21} stroke="var(--line2)" strokeWidth=".5" />)}
        {mesh?.triangles.map((triangle, index) => { const points = triangle.map((vertex) => projected[vertex]).filter(Boolean).map((point) => point.join(',')).join(' '); return <polygon key={`${triangle.join('-')}:${index}`} points={points} fill={mesh.groups.find((group) => index >= group.startTriangle && index < group.startTriangle + group.triangleCount)?.color ?? 'var(--m2)'} fillOpacity=".7" stroke="var(--ink)" strokeWidth=".4" strokeLinejoin="round" />; })}
        {!mesh && <text x="120" y="98" textAnchor="middle" fill="var(--muted)" fontSize="9" fontFamily="Work Sans, system-ui, sans-serif">no validated mesh yet</text>}
        {!mesh && <text x="120" y="112" textAnchor="middle" fill="var(--muted)" fontSize="7" fontFamily="Work Sans, system-ui, sans-serif">queue a sketch and a feature</text>}
      </svg>
      <div className={'px-3 py-2 border-t border-line2 ' + noteCls}>a projection of the last successful kernel mesh, not a B-rep claim</div>
    </section>
  );
}

function DependencyRail({ graph, history, diagnostics }: { graph: ReturnType<typeof createCadAuthoringState>['dependencyGraph']; history: ReturnType<typeof createCadAuthoringState>['history']; diagnostics: ReturnType<typeof createCadAuthoringState>['diagnostics'] }) {
  return (
    <Panel id="dependency-title" title="Dependencies and revisions" trailing={`${graph.nodes.length} nodes · ${graph.edges.length} edges`}>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {graph.nodes.map((node) => <div key={node.id} className="border border-line2 rounded-r px-2 py-1 text-[13px]"><div className="font-semibold">{node.label}</div><div className="text-[12px] text-muted">{node.kind} · {node.state}</div></div>)}
        {graph.nodes.length === 0 && <div className={noteCls}>the dependency graph arrives with the first recompute or import</div>}
      </div>
      <details open>
        <summary className="text-[12px] text-muted cursor-pointer select-none">operation history · {history.length}</summary>
        <ol className="m-0 mt-1 pl-5 text-[13px] grid gap-[2px]">{history.slice().reverse().map((item) => <li key={item.id}><span className="font-semibold">{item.status}</span> · {item.label} · <span className="font-mono text-[12px] text-muted">{shortId(item.revisionId)}</span></li>)}</ol>
      </details>
      {diagnostics.length > 0 && (
        <details>
          <summary className="text-[12px] text-muted cursor-pointer select-none">kernel diagnostics · {diagnostics.length}</summary>
          {diagnostics.map((item) => <div key={item.id} className="mt-1 text-[13px]" style={{ color: item.severity === 'error' ? 'var(--red)' : 'var(--amber)' }}><span className="font-mono">{item.code}</span> · {item.message}</div>)}
        </details>
      )}
    </Panel>
  );
}

function TransferPanel({ message, onImport, onExport }: { message: string | null; onImport: (file: File, format: CadTransferFormat) => void; onExport: (format: CadTransferFormat) => void }) {
  return (
    <Panel id="transfer-title" title="Exchange" sub="STEP, IGES, STL">
      <label className="btn text-center cursor-pointer flex items-center justify-center">Import STEP / IGES / STL<input aria-label="Import CAD file" type="file" accept=".step,.stp,.iges,.igs,.stl" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, formatFromName(file.name)); }} /></label>
      <div className="flex gap-2 flex-wrap">{(['STEP', 'IGES', 'STL'] as CadTransferFormat[]).map((format) => <button key={format} type="button" onClick={() => onExport(format)} className="btn btn-xs" title={format === 'STL' ? 'browser kernel or connected service' : 'connected service only'}>Export {format}</button>)}</div>
      <div className={noteCls}>STL works in the browser. STEP and IGES need the connected service and fail closed without it. No exchange format keeps editable feature history.</div>
      {message && <div role="status" className="text-[12px] px-2 py-1 rounded-r bg-surface2">{message}</div>}
    </Panel>
  );
}

export function OutputPanel({ busy, nativeEnvelope, sealedSnapshotArtifact, bundle, message, error, retainedFormats, onNativeSeal, onNativeLoad, onGenerate, onDownload }: {
  busy: boolean;
  nativeEnvelope: CadNativeEnvelope | null;
  sealedSnapshotArtifact: CadOutputArtifact | null;
  bundle: CadOutputBundle | null;
  message: string | null;
  error: string | null;
  retainedFormats: CadTransferFormat[];
  onNativeSeal: () => void;
  onNativeLoad: (file: File) => void;
  onGenerate: () => void;
  onDownload: (artifact: CadOutputArtifact) => void;
}) {
  return (
    <Panel id="outputs-title" title="Snapshot and outputs" trailing={bundle ? 'last valid package' : 'not generated'}>
      <div className={noteCls} title="CADdyDaddy snapshot (.caddy.json) & manufacturing outputs">CADdyDaddy snapshot (.caddy.json) & manufacturing outputs</div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onNativeSeal} className="btn btn-xs disabled:opacity-50">Seal snapshot</button>
        <label className={'btn btn-xs text-center cursor-pointer flex items-center justify-center' + (busy ? ' opacity-50' : '')}>Load snapshot<input aria-label="Load CADdyDaddy snapshot (.caddy.json)" type="file" accept=".json,.caddy.json,application/json" disabled={busy} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onNativeLoad(file); event.currentTarget.value = ''; }} /></label>
      </div>
      <button type="button" disabled={!sealedSnapshotArtifact} onClick={() => sealedSnapshotArtifact && onDownload(sealedSnapshotArtifact)} aria-label="Download sealed CADdyDaddy snapshot (.caddy.json)" className="btn btn-xs" style={{ opacity: sealedSnapshotArtifact ? 1 : .5 }}>Download sealed snapshot</button>
      <button type="button" disabled={busy} onClick={onGenerate} className="btn btn-primary disabled:opacity-50">{busy ? 'Validating outputs…' : 'Generate drawing and BOM package'}</button>
      <div className={noteCls}>Retained STEP / IGES / STL exchange · {retainedFormats.length ? retainedFormats.join(' / ') : 'none'} · snapshot {nativeEnvelope ? shortId(nativeEnvelope.document.document_hash) : 'not sealed'}</div>
      {error && <div role="alert" className="text-[12px] px-2 py-1 rounded-r border" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}
      {message && <div role="status" aria-live="polite" className="text-[12px] px-2 py-1 rounded-r bg-surface2">{message}</div>}
      {bundle && (
        <div className="grid gap-1">
          <div className="font-mono text-[12px] text-muted break-all">package {bundle.package.package_id}<br />manifest {bundle.package.manifest_file_sha256}</div>
          {bundle.artifacts.map((artifact) => <div className="cad-output-download" key={artifact.path}><button className="btn btn-xs w-full flex justify-between gap-2 text-left disabled:opacity-50" type="button" disabled={busy} onClick={() => onDownload(artifact)} aria-label={`Download ${artifact.path}`}><span>{artifact.path}</span><span className="font-mono text-muted">{artifact.size_bytes} B · {shortId(artifact.sha256)}</span></button></div>)}
        </div>
      )}
      <details>
        <summary className="text-[12px] text-muted cursor-pointer select-none">output boundaries</summary>
        <ul className="m-0 mt-1 pl-5 text-[12px] text-muted leading-snug">{CAD_OUTPUT_LIMITATIONS.map((item) => <li key={item}>{item.replaceAll('_', ' ').toLowerCase()}</li>)}</ul>
      </details>
    </Panel>
  );
}

function ids(value: string): string[] { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function shortId(value: string): string { return value.length > 25 ? `${value.slice(0, 12)}...${value.slice(-7)}` : value; }
function featureLabel(kind: CadFeatureKind): string { return kind.replace('feature.', '').replaceAll('.', ' '); }
function featureParameters(kind: CadFeatureKind, value: number): Record<string, string | number | boolean> { if (kind === 'feature.revolve') return { angle: value, unit: 'deg' }; if (kind === 'feature.fillet' || kind === 'feature.chamfer' || kind === 'feature.hole') return { radius: value, unit: 'mm' }; return { distance: value, unit: 'mm' }; }

function defaultEntity(kind: SketchEntity['kind']): SketchEntity {
  const base = { id: cadId('entity'), construction: false };
  if (kind === 'line') return { ...base, kind, start: { x: 0, y: 0 }, end: { x: 20, y: 0 } };
  if (kind === 'circle') return { ...base, kind, center: { x: 0, y: 0 }, radius: 10 };
  if (kind === 'arc') return { ...base, kind, center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 180 };
  if (kind === 'rectangle') return { ...base, kind, origin: { x: -10, y: -8 }, width: 20, height: 16 };
  return { ...base, kind, points: [{ x: 0, y: 0 }, { x: 8, y: 12 }, { x: 18, y: 3 }], closed: false };
}

function entityNumbers(entity: SketchEntity): number[] {
  if (entity.kind === 'line') return [entity.start.x, entity.start.y, entity.end.x, entity.end.y];
  if (entity.kind === 'circle') return [entity.center.x, entity.center.y, entity.radius];
  if (entity.kind === 'arc') return [entity.center.x, entity.center.y, entity.radius, entity.startAngle, entity.endAngle];
  if (entity.kind === 'rectangle') return [entity.origin.x, entity.origin.y, entity.width, entity.height];
  return entity.points.flatMap((point) => [point.x, point.y]);
}

function updateEntityNumbers(entity: SketchEntity, values: number[]): SketchEntity {
  const safe = values.map((value) => Number.isFinite(value) ? value : 0);
  if (entity.kind === 'line') return { ...entity, start: { x: safe[0] ?? 0, y: safe[1] ?? 0 }, end: { x: safe[2] ?? 0, y: safe[3] ?? 0 } };
  if (entity.kind === 'circle') return { ...entity, center: { x: safe[0] ?? 0, y: safe[1] ?? 0 }, radius: safe[2] ?? 0 };
  if (entity.kind === 'arc') return { ...entity, center: { x: safe[0] ?? 0, y: safe[1] ?? 0 }, radius: safe[2] ?? 0, startAngle: safe[3] ?? 0, endAngle: safe[4] ?? 0 };
  if (entity.kind === 'rectangle') return { ...entity, origin: { x: safe[0] ?? 0, y: safe[1] ?? 0 }, width: safe[2] ?? 0, height: safe[3] ?? 0 };
  const points = Array.from({ length: Math.floor(safe.length / 2) }, (_, index) => ({ x: safe[index * 2] ?? 0, y: safe[index * 2 + 1] ?? 0 }));
  return { ...entity, points };
}

function formatFromName(name: string): CadTransferFormat { const lower = name.toLowerCase(); if (lower.endsWith('.stl')) return 'STL'; if (lower.endsWith('.iges') || lower.endsWith('.igs')) return 'IGES'; return 'STEP'; }

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function downloadExport(result: CadExportResponse): void {
  const binary = atob(result.dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
