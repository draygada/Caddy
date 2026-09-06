import { useMemo, useReducer, useState, type CSSProperties } from 'react';
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
  type CadOutputBundle,
} from '../cad/output-client';

const card: CSSProperties = { border: '1px solid var(--line, #ccd3d8)', borderRadius: 8, background: 'var(--surface, #fff)' };
const mono: CSSProperties = { fontFamily: 'Geist Mono, ui-monospace, monospace' };
const field: CSSProperties = { width: '100%', minWidth: 0, padding: '7px 8px', border: '1px solid var(--line, #b9c2c9)', borderRadius: 5, background: 'var(--surface, #fff)', color: 'inherit', font: 'inherit' };
const button: CSSProperties = { border: '1px solid var(--line, #aeb8c0)', borderRadius: 5, background: 'var(--surface, #fff)', color: 'inherit', padding: '7px 9px', fontSize: 11, fontWeight: 750, cursor: 'pointer' };
const actionButton: CSSProperties = { ...button, background: '#173f35', borderColor: '#173f35', color: '#fff' };

type AuthoringWorkspaceProps = { fetchImpl?: typeof fetch; initialDocument?: CadDocument };

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
  const [sketch, setSketch] = useState<CadSketch>(initialSketch);
  const [featureKind, setFeatureKind] = useState<CadFeatureKind>('feature.extrude');
  const [featureName, setFeatureName] = useState('Extrude 1');
  const [featureInputs, setFeatureInputs] = useState('');
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
  const [outputBundle, setOutputBundle] = useState<CadOutputBundle | null>(null);
  const [outputMessage, setOutputMessage] = useState<string | null>(null);
  const [outputError, setOutputError] = useState<string | null>(null);
  const [outputBusy, setOutputBusy] = useState(false);
  const [kernelArtifacts, setKernelArtifacts] = useState<CadExportResponse[]>([]);

  async function submitOperation(operation: CadOperation) {
    const requestId = cadId('request');
    const draft = applyCadIntent(state.document, operation);
    dispatch({ type: 'stage', operation, requestId });
    dispatch({ type: 'started', requestId });
    try {
      const response = await recomputeCad({ document: draft, operation, expectedRevisionId: state.lastValidDocument.revisionId }, fetchImpl);
      dispatch({ type: 'succeeded', requestId, response });
      setFormError(null);
    } catch (error) {
      dispatch({ type: 'failed', requestId, error: error instanceof Error ? error.message : 'CAD recompute failed.', stale: error instanceof CadApiError && error.code === 'CAD_STALE' });
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
    setTransferMessage(`Reading ${file.name}...`);
    try {
      const response = await importCad({ format, fileName: file.name, dataBase64: await fileToBase64(file), expectedRevisionId: state.lastValidDocument.revisionId }, fetchImpl);
      dispatch({ type: 'replace-from-import', response });
      setTransferMessage(`Imported ${file.name} as authoritative revision ${response.revisionId}.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : 'Import failed; the last valid document is unchanged.');
    }
  }

  async function handleExport(format: CadTransferFormat) {
    setTransferMessage(`Requesting ${format} export...`);
    try {
      const result = await exportCad({ document: state.lastValidDocument, format, revisionId: state.lastValidDocument.revisionId }, fetchImpl);
      downloadExport(result);
      setKernelArtifacts((current) => [...current.filter((item) => item.format !== result.format), result]);
      setTransferMessage(`Exported ${result.fileName} from ${result.revisionId}.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : 'Export failed; no file was created.');
    }
  }

  async function handleNativeSave() {
    setOutputBusy(true);
    setOutputMessage('Validating and sealing native authoring state...');
    try {
      if (!state.lastValidMesh) throw new Error('Run one successful kernel recompute before saving native output.');
      const envelope = await sealNativeDocument(await createNativeDocumentDraft(state.lastValidDocument, state.lastValidMesh), fetchImpl);
      await downloadCadOutputArtifact(envelope.artifact);
      setNativeEnvelope(envelope);
      setOutputError(null);
      setOutputMessage(`Saved native revision ${shortId(envelope.document.revision_id)} · ${shortId(envelope.document.document_hash)}.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'Native save failed closed.');
      setOutputMessage('Last valid native/output state preserved. No file was downloaded.');
    } finally { setOutputBusy(false); }
  }

  async function handleNativeLoad(file: File) {
    setOutputBusy(true);
    setOutputMessage(`Validating ${file.name}...`);
    try {
      const envelope = await loadNativeDocument(await fileToBase64(file), fetchImpl);
      dispatch({ type: 'replace-from-import', response: restoreNativeAuthoring(envelope.document) });
      setNativeEnvelope(envelope);
      setOutputBundle(null);
      setKernelArtifacts([]);
      setOutputError(null);
      setOutputMessage(`Loaded verified native revision ${shortId(envelope.document.revision_id)}. Exchange artifacts must be regenerated.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'Native load failed closed.');
      setOutputMessage('Last valid authoring state preserved.');
    } finally { setOutputBusy(false); }
  }

  async function handleGenerateOutputs() {
    setOutputBusy(true);
    setOutputMessage('Sealing native state and deriving output package...');
    try {
      if (!state.lastValidMesh) throw new Error('Run one successful kernel recompute before generating outputs.');
      const envelope = await sealNativeDocument(await createNativeDocumentDraft(state.lastValidDocument, state.lastValidMesh), fetchImpl);
      const currentArtifacts = kernelArtifacts.filter((artifact) => artifact.revisionId === state.lastValidDocument.revisionId);
      const bundle = await generateCadOutputs({ document: envelope.document, mesh: state.lastValidMesh, kernelArtifacts: currentArtifacts }, fetchImpl);
      setNativeEnvelope(envelope);
      setOutputBundle(bundle);
      setOutputError(null);
      setOutputMessage(`Verified ${bundle.artifacts.length} downloadable artifacts · package ${shortId(bundle.package.package_id)}.`);
    } catch (error) {
      setOutputError(error instanceof Error ? error.message : 'Output generation failed closed.');
      setOutputMessage('Last valid output bundle preserved. No replacement artifacts were admitted.');
    } finally { setOutputBusy(false); }
  }

  const statusColor = state.status === 'failed' || state.status === 'stale' ? '#a33d2f' : state.status === 'running' || state.status === 'queued' ? '#9b6200' : '#176b45';

  return (
    <section aria-labelledby="cad-authoring-title" style={{ height: '100%', minHeight: 0, overflow: 'auto', background: '#edf0ec', color: 'var(--ink, #17201d)' }}>
      <header style={{ padding: '12px 14px', borderBottom: '1px solid #bfc9c2', background: 'linear-gradient(115deg, #f5f0e5 0%, #e7eee8 55%, #e1e8eb 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: '#176b45', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 850 }}>Live authoring contract · stateless kernel adapter</div>
            <h2 id="cad-authoring-title" style={{ margin: '4px 0 2px', fontSize: 23 }}>CAD authoring workshop</h2>
            <div style={{ fontSize: 11, color: '#5d6861' }}>{state.document.name} · draft {shortId(state.document.revisionId)} · rendered {shortId(state.lastValidDocument.revisionId)}</div>
          </div>
          <div role="status" aria-live="polite" style={{ ...mono, padding: '7px 9px', border: `1px solid ${statusColor}`, borderRadius: 5, color: statusColor, background: '#fff', fontSize: 10, fontWeight: 850, textTransform: 'uppercase' }}>{state.status} · {state.kernel ? `${state.kernel.name} ${state.kernel.version}` : 'kernel not yet proven'}</div>
        </div>
        <div role="note" style={{ marginTop: 9, padding: '8px 10px', borderLeft: '4px solid #9b6200', background: '#fff9eb', fontSize: 11, lineHeight: 1.4 }}>
          Operations are editable intent until <span style={mono}>/api/cad/recompute</span> returns a revision-bound document, graph, mesh, diagnostics, and kernel receipt. Failed or stale work never replaces the last valid viewport.
        </div>
      </header>

      {(state.error || formError) && <div role="alert" style={{ margin: '10px 12px 0', padding: 9, background: '#fff0ed', border: '1px solid #dca39a', borderRadius: 6, color: '#7d281e', fontSize: 11 }}>{formError ?? state.error} <button type="button" onClick={() => dispatch({ type: 'recover-last-valid' })} style={{ ...button, marginLeft: 8 }}>Restore last valid</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .72fr) minmax(360px, 1.45fr) minmax(280px, .95fr)', gap: 10, padding: 10, alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: 9 }}>
          <ProjectTree document={state.document} selectedId={state.selectedId} onSelect={(id) => dispatch({ type: 'select', id })} />
          <TransferPanel message={transferMessage} onImport={handleImport} onExport={handleExport} />
          <OutputPanel
            busy={outputBusy}
            nativeEnvelope={nativeEnvelope}
            bundle={outputBundle}
            message={outputMessage}
            error={outputError}
            retainedFormats={kernelArtifacts.filter((artifact) => artifact.revisionId === state.lastValidDocument.revisionId).map((artifact) => artifact.format)}
            onNativeSave={handleNativeSave}
            onNativeLoad={handleNativeLoad}
            onGenerate={handleGenerateOutputs}
          />
        </aside>

        <main style={{ display: 'grid', gap: 9, minWidth: 0 }}>
          <SemanticMesh mesh={state.lastValidMesh} document={state.lastValidDocument} />
          <DependencyRail graph={state.dependencyGraph} history={state.history} diagnostics={state.diagnostics} />
        </main>

        <aside style={{ display: 'grid', gap: 9 }}>
          <SketchEditor sketch={sketch} onChange={setSketch} onCommit={() => safely(() => createSketchOperation(sketch))} />
          <section aria-labelledby="feature-builder-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}>
            <h3 id="feature-builder-title" style={{ margin: 0, fontSize: 13 }}>Feature builder</h3>
            <select aria-label="Feature type" value={featureKind} onChange={(event) => { const kind = event.target.value as CadFeatureKind; setFeatureKind(kind); setFeatureName(featureLabel(kind)); }} style={field}>
              {FEATURE_KINDS.map((kind) => <option key={kind} value={kind}>{featureLabel(kind)}</option>)}
            </select>
            <input aria-label="Feature name" value={featureName} onChange={(event) => setFeatureName(event.target.value)} style={field} />
            <input aria-label="Feature input references" placeholder="Sketch/entity/body IDs, comma separated" value={featureInputs} onChange={(event) => setFeatureInputs(event.target.value)} style={field} />
            <input aria-label="Target body references" placeholder="Target body IDs, comma separated" value={featureTargets} onChange={(event) => setFeatureTargets(event.target.value)} style={field} />
            <label style={{ fontSize: 10 }}>Distance / angle / radius<input aria-label="Feature numeric value" type="number" value={featureValue} onChange={(event) => setFeatureValue(Number(event.target.value))} style={{ ...field, marginTop: 3 }} /></label>
            <input aria-label="Output body name" placeholder="New body name; blank modifies targets" value={outputBodyName} onChange={(event) => setOutputBodyName(event.target.value)} style={field} />
            <button type="button" onClick={() => safely(() => createFeatureOperation({ kind: featureKind, name: featureName, inputIds: ids(featureInputs), targetBodyIds: ids(featureTargets), outputBodyName, parameters: featureParameters(featureKind, featureValue) }))} style={actionButton}>Queue {featureLabel(featureKind)}</button>
          </section>

          <section aria-labelledby="parameters-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}>
            <h3 id="parameters-title" style={{ margin: 0, fontSize: 13 }}>Parameters</h3>
            {state.document.parameters.map((parameter) => <div key={parameter.id} style={{ ...mono, fontSize: 10 }}>{parameter.name} = {parameter.expression}</div>)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              <input aria-label="Parameter name" value={parameterName} onChange={(event) => setParameterName(event.target.value)} style={field} />
              <input aria-label="Parameter expression" value={parameterExpression} onChange={(event) => setParameterExpression(event.target.value)} style={field} />
            </div>
            <button type="button" onClick={() => safely(() => createParameterOperation({ id: state.document.parameters.find((item) => item.name === parameterName)?.id ?? cadId('parameter'), name: parameterName, expression: parameterExpression, unit: 'mm', resolvedValue: null }))} style={button}>Stage parameter edit</button>
          </section>

          <section aria-labelledby="assembly-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}>
            <h3 id="assembly-title" style={{ margin: 0, fontSize: 13 }}>Assembly instances & mates</h3>
            <input aria-label="Instance name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} style={field} />
            <select aria-label="Instance body" value={instanceBody} onChange={(event) => setInstanceBody(event.target.value)} style={field}>
              <option value="">Choose body</option>{state.document.bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
            </select>
            <button type="button" disabled={!instanceBody} onClick={() => safely(() => createInstanceOperation({ id: cadId('instance'), name: instanceName, bodyId: instanceBody, grounded: state.document.assembly.instances.length === 0, transform: { translation: [0, 0, 0], rotationDegrees: [0, 0, 0] } }))} style={button}>Insert instance</button>
            <div style={{ borderTop: '1px solid #d9dfdb', paddingTop: 7, display: 'grid', gap: 5 }}>
              <input aria-label="Mate name" value={mate.name} onChange={(event) => setMate({ ...mate, name: event.target.value })} style={field} />
              <select aria-label="Mate type" value={mate.kind} onChange={(event) => setMate({ ...mate, kind: event.target.value as CadAssemblyMate['kind'] })} style={field}>{MATE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <select aria-label="First mate instance" value={mate.instanceAId} onChange={(event) => setMate({ ...mate, instanceAId: event.target.value })} style={field}><option value="">Instance A</option>{state.document.assembly.instances.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select aria-label="Second mate instance" value={mate.instanceBId} onChange={(event) => setMate({ ...mate, instanceBId: event.target.value })} style={field}><option value="">Instance B</option>{state.document.assembly.instances.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </div>
              <button type="button" onClick={() => safely(() => createMateOperation({ id: cadId('mate'), name: mate.name, kind: mate.kind, instanceAId: mate.instanceAId, instanceBId: mate.instanceBId, referenceA: 'origin', referenceB: 'origin', offset: mate.offset, unit: mate.kind === 'angle' ? 'deg' : 'mm' }))} style={button}>Stage mate</button>
            </div>
          </section>
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
  return <section aria-labelledby="project-tree-title" style={{ ...card, padding: 10 }}><h3 id="project-tree-title" style={{ margin: '0 0 8px', fontSize: 13 }}>Model tree</h3>{sections.map((section) => <div key={section.label} style={{ marginTop: 8 }}><div style={{ ...mono, fontSize: 9, fontWeight: 850, textTransform: 'uppercase', color: '#66736b' }}>{section.label} · {section.rows.length}</div>{section.rows.length === 0 && <div style={{ fontSize: 10, color: '#7c867f', padding: '4px 0' }}>None authored</div>}{section.rows.map((row) => <button key={row.id} type="button" onClick={() => onSelect(row.id)} style={{ ...button, width: '100%', textAlign: 'left', marginTop: 4, background: selectedId === row.id ? '#e6f0e9' : '#fff' }}><span>{row.label}</span><span style={{ display: 'block', ...mono, marginTop: 2, fontSize: 8, color: '#68746c' }}>{row.meta}</span></button>)}</div>)}</section>;
}

function SketchEditor({ sketch, onChange, onCommit }: { sketch: CadSketch; onChange: (sketch: CadSketch) => void; onCommit: () => void }) {
  const [dimensionKind, setDimensionKind] = useState<SketchDimensionKind>('distance');
  const [constraintKind, setConstraintKind] = useState<SketchConstraintKind>('coincident');
  const [referenceIds, setReferenceIds] = useState('');
  return <section aria-labelledby="sketch-editor-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}>
    <h3 id="sketch-editor-title" style={{ margin: 0, fontSize: 13 }}>Sketch authoring</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 5 }}><input aria-label="Sketch name" value={sketch.name} onChange={(event) => onChange({ ...sketch, name: event.target.value })} style={field} /><select aria-label="Sketch plane" value={sketch.plane.kind === 'origin' ? sketch.plane.plane : 'FACE'} onChange={(event) => onChange({ ...sketch, plane: event.target.value === 'FACE' ? { kind: 'face', entityId: '' } : { kind: 'origin', plane: event.target.value as 'XY' | 'XZ' | 'YZ' } })} style={field}><option>XY</option><option>XZ</option><option>YZ</option><option value="FACE">Face</option></select></div>
    {sketch.plane.kind === 'face' && <input aria-label="Sketch face entity reference" placeholder="Face entity ID" value={sketch.plane.entityId} onChange={(event) => onChange({ ...sketch, plane: { kind: 'face', entityId: event.target.value } })} style={field} />}
    <div aria-label="Add sketch entity" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(['line', 'circle', 'rectangle', 'arc', 'spline'] as SketchEntity['kind'][]).map((kind) => <button key={kind} type="button" onClick={() => onChange({ ...sketch, entities: [...sketch.entities, defaultEntity(kind)] })} style={button}>+ {kind}</button>)}</div>
    <div style={{ display: 'grid', gap: 4 }}>{sketch.entities.map((entity, index) => <EntityRow key={entity.id} entity={entity} onChange={(next) => onChange({ ...sketch, entities: sketch.entities.map((item) => item.id === next.id ? next : item) })} onRemove={() => onChange({ ...sketch, entities: sketch.entities.filter((item) => item.id !== entity.id) })} index={index} />)}</div>
    <div style={{ borderTop: '1px solid #d9dfdb', paddingTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
      <select aria-label="Dimension kind" value={dimensionKind} onChange={(event) => setDimensionKind(event.target.value as SketchDimensionKind)} style={field}>{(['distance', 'horizontal-distance', 'vertical-distance', 'radius', 'diameter', 'angle'] as SketchDimensionKind[]).map((kind) => <option key={kind}>{kind}</option>)}</select>
      <select aria-label="Constraint kind" value={constraintKind} onChange={(event) => setConstraintKind(event.target.value as SketchConstraintKind)} style={field}>{(['coincident', 'horizontal', 'vertical', 'parallel', 'perpendicular', 'tangent', 'equal', 'concentric', 'fixed'] as SketchConstraintKind[]).map((kind) => <option key={kind}>{kind}</option>)}</select>
      <input aria-label="Sketch relation entity references" placeholder="Entity IDs, comma separated" value={referenceIds} onChange={(event) => setReferenceIds(event.target.value)} style={{ ...field, gridColumn: '1 / -1' }} />
      <button type="button" onClick={() => onChange({ ...sketch, dimensions: [...sketch.dimensions, { id: cadId('dimension'), kind: dimensionKind, entityIds: ids(referenceIds), value: 10, expression: null, unit: dimensionKind === 'angle' ? 'deg' : 'mm' }] })} style={button}>Add dimension</button>
      <button type="button" onClick={() => onChange({ ...sketch, constraints: [...sketch.constraints, { id: cadId('constraint'), kind: constraintKind, entityIds: ids(referenceIds) }] })} style={button}>Add constraint</button>
    </div>
    <div style={{ ...mono, fontSize: 9, color: '#66736b' }}>{sketch.dimensions.length} dimensions · {sketch.constraints.length} constraints · solver pending kernel</div>
    <button type="button" onClick={onCommit} style={actionButton}>Queue sketch for recompute</button>
  </section>;
}

function EntityRow({ entity, onChange, onRemove, index }: { entity: SketchEntity; onChange: (entity: SketchEntity) => void; onRemove: () => void; index: number }) {
  const values = entityNumbers(entity);
  return <div style={{ display: 'grid', gridTemplateColumns: '62px 1fr auto', gap: 4, alignItems: 'center', background: '#f2f5f2', padding: 5, borderRadius: 5 }}><span style={{ ...mono, fontSize: 9 }}>{index + 1}. {entity.kind}</span><input aria-label={`${entity.kind} geometry values`} value={values.join(', ')} onChange={(event) => onChange(updateEntityNumbers(entity, event.target.value.split(',').map(Number)))} style={{ ...field, padding: '5px 6px', fontSize: 9 }} /><button type="button" aria-label={`Remove ${entity.kind}`} onClick={onRemove} style={{ ...button, padding: '4px 6px' }}>x</button></div>;
}

function SemanticMesh({ mesh, document }: { mesh: ReturnType<typeof createCadAuthoringState>['lastValidMesh']; document: CadDocument }) {
  const projected = useMemo(() => mesh?.vertices.map(([x, y, z]) => [120 + x * 3 + z, 105 - y * 3 - z * .5] as const) ?? [], [mesh]);
  return <section aria-labelledby="mesh-title" style={{ ...card, overflow: 'hidden' }}><div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #d9dfdb' }}><h3 id="mesh-title" style={{ margin: 0, fontSize: 13 }}>Last valid semantic mesh</h3><span style={{ ...mono, fontSize: 9 }}>{mesh ? `${mesh.triangles.length} triangles` : 'no live mesh'}</span></div><svg role="img" aria-labelledby="semantic-mesh-title semantic-mesh-desc" viewBox="0 0 240 210" style={{ display: 'block', width: '100%', minHeight: 270, background: 'radial-gradient(circle at 50% 44%, #f8fbf8, #dce4df)' }}><title id="semantic-mesh-title">Revision-bound CAD mesh fallback</title><desc id="semantic-mesh-desc">Accessible two-dimensional projection of {document.bodies.length} bodies from revision {document.revisionId}.</desc><path d="M0 175 H240 M25 0 V210" stroke="#c6d0ca" strokeWidth=".5" />{mesh?.triangles.map((triangle, index) => { const points = triangle.map((vertex) => projected[vertex]).filter(Boolean).map((point) => point.join(',')).join(' '); return <polygon key={`${triangle.join('-')}:${index}`} points={points} fill={mesh.groups.find((group) => index >= group.startTriangle && index < group.startTriangle + group.triangleCount)?.color ?? '#7fa896'} fillOpacity=".52" stroke="#294d42" strokeWidth=".65" />; })}{!mesh && <text x="120" y="92" textAnchor="middle" fill="#526159" fontSize="8">No authoritative mesh yet</text>}{!mesh && <text x="120" y="108" textAnchor="middle" fill="#6c776f" fontSize="6">Author a feature, then connect /api/cad/recompute</text>}</svg><div style={{ padding: 8, fontSize: 10, color: '#66736b' }}>Semantic SVG fallback remains keyboard- and screen-reader-readable. No WebGL or successful kernel execution is implied.</div></section>;
}

function DependencyRail({ graph, history, diagnostics }: { graph: ReturnType<typeof createCadAuthoringState>['dependencyGraph']; history: ReturnType<typeof createCadAuthoringState>['history']; diagnostics: ReturnType<typeof createCadAuthoringState>['diagnostics'] }) {
  return <section aria-labelledby="dependency-title" style={{ ...card, padding: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h3 id="dependency-title" style={{ margin: 0, fontSize: 13 }}>Dependency & revision rail</h3><span style={{ ...mono, fontSize: 9 }}>{graph.nodes.length} nodes · {graph.edges.length} edges</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginTop: 8 }}>{graph.nodes.map((node) => <div key={node.id} style={{ padding: 7, border: '1px solid #d7ddd9', borderRadius: 5, fontSize: 10 }}><b>{node.label}</b><span style={{ ...mono, display: 'block', marginTop: 3, fontSize: 8 }}>{node.kind} · {node.state}</span></div>)}{graph.nodes.length === 0 && <div style={{ fontSize: 10, color: '#6c776f' }}>Dependency graph arrives only with an authoritative recompute or import response.</div>}</div><details style={{ marginTop: 9 }} open><summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Operation history ({history.length})</summary><ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 9 }}>{history.slice().reverse().map((item) => <li key={item.id} style={{ padding: '3px 0' }}><b>{item.status}</b> · {item.label} · <span style={mono}>{shortId(item.revisionId)}</span></li>)}</ol></details>{diagnostics.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Kernel diagnostics ({diagnostics.length})</summary>{diagnostics.map((item) => <div key={item.id} style={{ marginTop: 5, padding: 6, background: item.severity === 'error' ? '#fff0ed' : '#fff9eb', fontSize: 9 }}><b>{item.code}</b> · {item.message}</div>)}</details>}</section>;
}

function TransferPanel({ message, onImport, onExport }: { message: string | null; onImport: (file: File, format: CadTransferFormat) => void; onExport: (format: CadTransferFormat) => void }) {
  return <section aria-labelledby="transfer-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}><h3 id="transfer-title" style={{ margin: 0, fontSize: 13 }}>Kernel exchange</h3><label style={{ ...button, textAlign: 'center' }}>Import STEP / IGES / STL<input aria-label="Import CAD file" type="file" accept=".step,.stp,.iges,.igs,.stl" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, formatFromName(file.name)); }} /></label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>{(['STEP', 'IGES', 'STL'] as CadTransferFormat[]).map((format) => <button key={format} type="button" onClick={() => onExport(format)} style={button}>{format}</button>)}</div><p style={{ margin: 0, fontSize: 9, lineHeight: 1.4, color: '#66736b' }}>Exports are kernel exchange bytes, not editable feature-history round trips. A validated export is retained for the current manufacturing bundle.</p>{message && <div role="status" style={{ fontSize: 9, padding: 6, background: '#f2f5f2' }}>{message}</div>}</section>;
}

function OutputPanel({ busy, nativeEnvelope, bundle, message, error, retainedFormats, onNativeSave, onNativeLoad, onGenerate }: {
  busy: boolean;
  nativeEnvelope: CadNativeEnvelope | null;
  bundle: CadOutputBundle | null;
  message: string | null;
  error: string | null;
  retainedFormats: CadTransferFormat[];
  onNativeSave: () => void;
  onNativeLoad: (file: File) => void;
  onGenerate: () => void;
}) {
  return <section aria-labelledby="outputs-title" style={{ ...card, padding: 10, display: 'grid', gap: 7 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}><h3 id="outputs-title" style={{ margin: 0, fontSize: 13 }}>Native & manufacturing outputs</h3><span style={{ ...mono, fontSize: 8 }}>{bundle ? 'last valid' : 'not generated'}</span></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
      <button type="button" disabled={busy} onClick={onNativeSave} style={button}>Save native</button>
      <label style={{ ...button, textAlign: 'center', opacity: busy ? .55 : 1 }}>Load native<input aria-label="Load native CAD document" type="file" accept=".json,.caddy.json,application/json" disabled={busy} style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onNativeLoad(file); event.currentTarget.value = ''; }} /></label>
    </div>
    <button type="button" disabled={busy} onClick={onGenerate} style={{ ...actionButton, opacity: busy ? .55 : 1 }}>{busy ? 'Validating outputs...' : 'Generate drawing + BOM package'}</button>
    <div style={{ ...mono, fontSize: 8, color: '#66736b' }}>Retained exchange · {retainedFormats.length ? retainedFormats.join(' / ') : 'none'} · native {nativeEnvelope ? shortId(nativeEnvelope.document.document_hash) : 'not sealed'}</div>
    {error && <div role="alert" style={{ padding: 7, border: '1px solid #dca39a', background: '#fff0ed', color: '#7d281e', fontSize: 9 }}>{error}</div>}
    {message && <div role="status" aria-live="polite" style={{ padding: 7, background: '#f2f5f2', fontSize: 9, lineHeight: 1.35 }}>{message}</div>}
    {bundle && <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ ...mono, fontSize: 8, overflowWrap: 'anywhere' }}>package · {bundle.package.package_id}<br />manifest · {bundle.package.manifest_file_sha256}</div>
      <div style={{ display: 'grid', gap: 3 }}>{bundle.artifacts.map((artifact) => <button key={artifact.path} type="button" onClick={() => void downloadCadOutputArtifact(artifact)} style={{ ...button, display: 'flex', justifyContent: 'space-between', gap: 6, textAlign: 'left' }}><span>{artifact.path}</span><span style={{ ...mono, fontSize: 8 }}>{artifact.size_bytes} B · {shortId(artifact.sha256)}</span></button>)}</div>
    </div>}
    <details><summary style={{ cursor: 'pointer', fontSize: 9, fontWeight: 800 }}>Output boundaries</summary><ul style={{ margin: '5px 0 0', paddingLeft: 17, fontSize: 8, lineHeight: 1.45 }}>{CAD_OUTPUT_LIMITATIONS.map((item) => <li key={item}>{item.replaceAll('_', ' ').toLowerCase()}</li>)}</ul></details>
  </section>;
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
