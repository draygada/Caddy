import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Edges, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  DESIGN,
  FIXTURE_META,
  KESTREL_SCENE_NODES,
  KESTREL_SLOTS,
  NODE_PRESENTATION,
  SCENARIOS,
  SCENARIO_ORDER,
  getNode,
  getNodeLabel,
  responseForScenario,
} from './fixtures.js'
import { createInitialState, directnessFor, inspectionReducer, visualStateFor } from './inspectionState.js'
import './styles.css'

const STATUS = {
  clear: { icon: '✓', label: 'CLEAR', description: 'No implemented tripwire fired.' },
  watch: { icon: '△', label: 'WATCH', description: 'A reviewed proximity state was returned.' },
  question: { icon: '?', label: 'QUESTION', description: 'Required evidence is missing; cannot evaluate.' },
  flag: { icon: '!', label: 'DIRECT', description: 'A synthetic direct tripwire fixture fired.' },
  propagated: { icon: '↗', label: 'PROPAGATED', description: 'Affected by a child; the parent did not independently cross a threshold.' },
  pending: { icon: '…', label: 'CHECKING', description: 'The last confirmed fixture is retained as stale.' },
  unavailable: { icon: '×', label: 'UNAVAILABLE', description: 'Evaluation is unavailable; the last fixture is stale.' },
}

const rotations = {
  fuselage: [0, 0, Math.PI / 2],
  nose: [0, 0, -Math.PI / 2],
  motorMount: [0, 0, Math.PI / 2],
  motor: [0, 0, Math.PI / 2],
  pod: [Math.PI / 2, 0, 0],
  lens: [Math.PI / 2, 0, 0],
  gnss: [Math.PI / 2, 0, 0],
}

function Geometry({ shape }) {
  switch (shape) {
    case 'fuselage': return <cylinderGeometry args={[0.16, 0.28, 3.05, 32]} />
    case 'nose': return <coneGeometry args={[0.24, 0.64, 28]} />
    case 'portWing':
    case 'starboardWing': return <boxGeometry args={[1.45, 0.055, 2.32]} />
    case 'tail': return <boxGeometry args={[0.64, 0.055, 1.46]} />
    case 'motorMount': return <cylinderGeometry args={[0.18, 0.19, 0.22, 24]} />
    case 'motor': return <cylinderGeometry args={[0.14, 0.14, 0.28, 24]} />
    case 'propeller': return <boxGeometry args={[0.055, 0.06, 1.4]} />
    case 'pod': return <capsuleGeometry args={[0.16, 0.54, 6, 16]} />
    case 'camera': return <boxGeometry args={[0.17, 0.18, 0.22]} />
    case 'lens': return <cylinderGeometry args={[0.085, 0.085, 0.08, 20]} />
    case 'board': return <boxGeometry args={[0.5, 0.045, 0.64]} />
    case 'chipLarge': return <boxGeometry args={[0.15, 0.055, 0.15]} />
    case 'chip': return <boxGeometry args={[0.11, 0.055, 0.11]} />
    case 'chipSmall': return <boxGeometry args={[0.075, 0.05, 0.075]} />
    case 'gnss': return <cylinderGeometry args={[0.105, 0.105, 0.05, 20]} />
    case 'battery': return <boxGeometry args={[0.66, 0.24, 0.38]} />
    case 'datalink': return <boxGeometry args={[0.12, 0.52, 0.12]} />
    default: return <boxGeometry args={[0.1, 0.1, 0.1]} />
  }
}

function StateBadge({ state, count }) {
  const meta = STATUS[state] ?? STATUS.unavailable
  return <span className={`state-badge state-${state}`}><span aria-hidden="true">{meta.icon}</span>{meta.label}{count > 1 ? ` ×${count}` : ''}</span>
}

function TopBar({ state }) {
  const determinations = Object.values(state.response.determinations)
  const direct = determinations.reduce((total, item) => total + item.direct_tripwires.length, 0)
  const propagated = determinations.reduce((total, item) => total + item.propagated_tripwires.length, 0)
  const questions = determinations.reduce((total, item) => total + item.unresolved_tripwires.length, 0)
  return (
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><i />T</div><div><strong>TRIPWIRE</strong><small>VISUAL INSPECTION</small></div></div>
      <div className="design-title"><span className="overline">ASSEMBLY / SYN-KST-FW-01</span><h1>Kestrel fixed-wing UAS</h1></div>
      <div className="topbar-status" aria-label="Fixture posture and aggregate counts">
        <div className="posture-pill"><i aria-hidden="true" />{FIXTURE_META.artifactStatus}<small>{FIXTURE_META.approvalStatus}</small></div>
        <div className="top-stat"><span>DIRECT</span><strong>{direct}</strong></div>
        <div className="top-stat"><span>PARENT</span><strong>{propagated}</strong></div>
        <div className="top-stat"><span>QUESTIONS</span><strong>{questions}</strong></div>
        <div className="source-date"><span>SOURCE SNAPSHOT</span><strong>{FIXTURE_META.sourceDate}</strong></div>
      </div>
    </header>
  )
}

function ScenarioBar({ state, onScenario }) {
  return (
    <nav className="scenario-bar" aria-label="Synthetic demo scenarios">
      <span className="scenario-label">SCENARIO</span>
      <div className="scenario-scroll" tabIndex="0" aria-label="Horizontally scrollable scenario choices"><div className="scenario-buttons">
        {SCENARIO_ORDER.map((scenarioId) => {
          const scenario = SCENARIOS[scenarioId]
          const active = state.targetScenarioId === scenarioId
          return <button key={scenarioId} className={active ? 'scenario-button active' : 'scenario-button'} aria-label={`${scenario.short}: ${scenario.label}. ${scenario.artifact_status}; ${scenario.approval_status}`} aria-pressed={active} onClick={() => onScenario(scenarioId)}><span className="scenario-code">{scenario.short}</span><span className="scenario-copy">{scenario.label}</span></button>
        })}
      </div></div>
      <div className={`evaluation-state ${state.evaluationStatus}`} role="status" aria-live="polite">{state.evaluationStatus === 'confirmed' ? 'STUB CONFIRMED' : state.evaluationStatus === 'pending' ? 'CHECKING…' : 'CONTRACT HOLD'}</div>
    </nav>
  )
}

function BomTree({ state, onSelect }) {
  const children = React.useMemo(() => {
    const map = new Map(DESIGN.nodes.map((item) => [item.id, []]))
    DESIGN.nodes.forEach((item) => { if (item.parent) map.get(item.parent)?.push(item) })
    return map
  }, [])
  const renderNode = (node, depth = 0) => {
    const visual = visualStateFor(state, node.id)
    const selected = state.selectedNodeId === node.id
    const changed = state.response.delta.changed_nodes.includes(node.id)
    const meta = NODE_PRESENTATION[node.id]
    return (
      <React.Fragment key={node.id}>
        <button className={`bom-row ${selected ? 'selected' : ''}`} style={{ '--depth': depth }} onClick={() => onSelect(node.id)} aria-current={selected ? 'true' : undefined} data-node-id={node.id}>
          <span className="bom-branch" aria-hidden="true">{node.kind === 'part' ? '·' : depth ? '⌄' : '◆'}</span>
          <span className="bom-copy"><strong>{meta.label}</strong><small>{node.mpn}</small></span>
          {changed && <span className="changed-tick" title="Changed in current fixture">Δ</span>}
          <span className={`row-status state-${visual.state}`} title={STATUS[visual.state].label} aria-label={STATUS[visual.state].label}>{STATUS[visual.state].icon}</span>
        </button>
        {(children.get(node.id) ?? []).map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    )
  }
  return (
    <aside className="panel bom-panel" aria-label="Assembly tree">
      <div className="panel-heading"><div><span className="overline">ASSEMBLY TREE</span><h2>Installed inventory</h2></div><span className="count-chip">{DESIGN.nodes.length} NODES</span></div>
      <div className="bom-legend"><span>Δ fixture change</span><span>stable node IDs</span></div>
      <div className="bom-scroll">{renderNode(getNode(DESIGN.root))}</div>
      <p className="fixture-footnote">Every MPN and engineering fact shown here is synthetic. No item or source is presented as verified.</p>
    </aside>
  )
}

function materialFor({ selected, state, internal }) {
  if (selected) return { color: '#d9ae63', emissive: '#6d4512', intensity: 0.42 }
  if (state === 'flag') return { color: '#9b4339', emissive: '#54110b', intensity: 0.3 }
  if (state === 'propagated') return { color: '#4f5860', emissive: '#181b1e', intensity: 0.12 }
  if (state === 'question') return { color: '#a97832', emissive: '#4c3009', intensity: 0.24 }
  return { color: internal ? '#35565c' : '#66767d', emissive: '#000000', intensity: 0 }
}

function SemanticPart({ binding, state, inspectionMode, onSelect }) {
  if (binding.internal && !inspectionMode) return null
  const selected = state.selectedNodeId === binding.nodeId
  const visual = visualStateFor(state, binding.nodeId)
  const material = materialFor({ selected, state: visual.state, internal: binding.internal })
  const edgeColor = selected ? '#ffdda0' : visual.state === 'question' ? '#efb34f' : visual.state === 'propagated' ? '#d7dce0' : '#ff776a'
  return (
    <mesh position={binding.position} rotation={rotations[binding.shape] ?? [0, 0, 0]} userData={{ nodeId: binding.nodeId }} onClick={(event) => { event.stopPropagation(); onSelect(binding.nodeId) }} onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = 'default' }} castShadow receiveShadow>
      <Geometry shape={binding.shape} />
      <meshStandardMaterial color={material.color} emissive={material.emissive} emissiveIntensity={material.intensity} metalness={binding.internal ? 0.2 : 0.5} roughness={binding.internal ? 0.58 : 0.4} transparent={binding.internal} opacity={binding.internal ? 0.94 : 1} />
      {(selected || ['flag', 'question', 'propagated'].includes(visual.state)) && <Edges threshold={12} color={edgeColor} />}
    </mesh>
  )
}

function CutawayShell({ inspectionMode }) {
  if (!inspectionMode) return null
  return <mesh position={[-0.18, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.32, 0.32, 1.75, 32, 1, true]} /><meshPhysicalMaterial color="#7ca4aa" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} /><Edges color="#54747a" /></mesh>
}

function aggregateSlotState(slot, state) {
  if (state.evaluationStatus !== 'confirmed') return state.evaluationStatus === 'pending' ? 'pending' : 'unavailable'
  const values = slot.nodeIds.map((nodeId) => directnessFor(state.response.determinations[nodeId]))
  if (values.includes('propagated')) return 'propagated'
  if (values.includes('flag')) return 'flag'
  if (values.includes('question')) return 'question'
  if (values.includes('watch')) return 'watch'
  return 'clear'
}

function SlotMarkers({ state, onSelect }) {
  return KESTREL_SLOTS.map((slot, index) => {
    const status = aggregateSlotState(slot, state)
    const node = getNode(slot.primaryNodeId)
    return (
      <Html key={slot.id} position={slot.anchor} center distanceFactor={5.7} zIndexRange={[30 - index, 1]}>
        <button className={`slot-marker state-${status} ${state.selectedNodeId === slot.primaryNodeId ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); onSelect(slot.primaryNodeId) }} aria-label={`${slot.label}, ${node.mpn}, ${STATUS[status].label}, ${slot.note}`}>
          <span className="slot-index">0{index + 1}</span><span className="slot-copy"><strong>{slot.label}</strong><small>{node.mpn}</small></span><span className="slot-state"><b aria-hidden="true">{STATUS[status].icon}</b>{STATUS[status].label}</span>{slot.note.startsWith('schematic') && <em>SCHEMATIC</em>}
        </button>
      </Html>
    )
  })
}

function TripwireMarkers({ state, onSelect }) {
  if (state.evaluationStatus !== 'confirmed') return null
  return KESTREL_SCENE_NODES.flatMap((binding) => {
    const determination = state.response.determinations[binding.nodeId]
    const status = directnessFor(determination)
    if (!['flag', 'question', 'watch', 'propagated'].includes(status)) return []
    const count = determination.direct_tripwires.length + determination.propagated_tripwires.length + determination.unresolved_tripwires.length
    return [<Html key={`tripwire-${binding.nodeId}`} position={[binding.position[0], binding.position[1] + 0.43, binding.position[2]]} center zIndexRange={[50, 31]}><button className={`tripwire-marker state-${status}`} onClick={(event) => { event.stopPropagation(); onSelect(binding.nodeId) }} aria-label={`${STATUS[status].label} on ${getNodeLabel(binding.nodeId)}. ${count} causal object${count === 1 ? '' : 's'}. Open inspector.`}><b aria-hidden="true">{STATUS[status].icon}</b><span>{STATUS[status].label}{count > 1 ? ` ×${count}` : ''}</span></button></Html>]
  })
}

function KestrelScene({ state, inspectionMode, showTripwires, onSelect }) {
  return (
    <Canvas camera={{ position: [5.3, 3.7, 6.45], fov: 38 }} dpr={[1, 1.6]} shadows onPointerMissed={() => onSelect('kestrel')} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#101920']} /><fog attach="fog" args={['#101920', 7, 12]} /><ambientLight intensity={1.3} /><directionalLight position={[3, 5, 4]} intensity={2.2} color="#e9f6ff" castShadow /><directionalLight position={[-4, 2, -3]} intensity={0.75} color="#d4a25c" />
      <group rotation={[0, -0.08, -0.02]} position={[0, 0.08, 0]}>
        {KESTREL_SCENE_NODES.map((binding) => <SemanticPart key={binding.nodeId} binding={binding} state={state} inspectionMode={inspectionMode} onSelect={onSelect} />)}
        <CutawayShell inspectionMode={inspectionMode} /><SlotMarkers state={state} onSelect={onSelect} />{showTripwires && <TripwireMarkers state={state} onSelect={onSelect} />}
      </group>
      <gridHelper args={[12, 24, '#2d454d', '#1b2a31']} position={[0, -0.72, 0]} /><OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={4.2} maxDistance={9} minPolarAngle={0.45} maxPolarAngle={1.48} />
    </Canvas>
  )
}

function SceneInventory({ state, inspectionMode, showAllParts, onSelect }) {
  if (!showAllParts) return null
  const visible = KESTREL_SCENE_NODES.filter((binding) => inspectionMode || !binding.internal)
  return <div className="scene-inventory" aria-label="Visible model parts"><span>VISIBLE MODEL NODES · SYNTHETIC</span><div>{visible.map(({ nodeId }) => <button key={nodeId} onClick={() => onSelect(nodeId)} className={state.selectedNodeId === nodeId ? 'selected' : ''}>{NODE_PRESENTATION[nodeId].short}</button>)}</div></div>
}

function MobileLocationRail({ state, onSelect }) {
  return <div className="mobile-location-rail" aria-label="Five installed locations">{KESTREL_SLOTS.map((slot, index) => {
    const status = aggregateSlotState(slot, state)
    return <button key={slot.id} className={`state-${status} ${state.selectedNodeId === slot.primaryNodeId ? 'selected' : ''}`} onClick={() => onSelect(slot.primaryNodeId)}><span>0{index + 1}</span><strong>{slot.label}</strong><small>{STATUS[status].icon} {STATUS[status].label}</small></button>
  })}</div>
}

function Viewport({ state, onSelect }) {
  const [inspectionMode, setInspectionMode] = React.useState(true)
  const [showAllParts, setShowAllParts] = React.useState(false)
  const [showTripwires, setShowTripwires] = React.useState(true)
  const scenario = SCENARIOS[state.evaluationStatus === 'pending' ? state.targetScenarioId : state.scenarioId]
  return (
    <main className="viewport-panel">
      <div className="viewport-heading"><div><span className="overline">{scenario.eyebrow}</span><h2>{scenario.headline}</h2><p>{scenario.detail}</p></div><div className="delta-summary" aria-label="Fixture delta"><strong>{state.evaluationStatus === 'confirmed' ? state.response.delta.tripwires_added.length : '…'}</strong><span>ADDED</span><strong>{state.evaluationStatus === 'confirmed' ? state.response.delta.tripwires_removed.length : '…'}</strong><span>REMOVED</span></div></div>
      <div className={`viewport-canvas ${state.evaluationStatus !== 'confirmed' ? 'stale' : ''}`} data-testid="model-viewport">
        <KestrelScene state={state} inspectionMode={inspectionMode} showTripwires={showTripwires} onSelect={onSelect} />
        <div className="orientation-cue" aria-hidden="true"><span>N</span><i />NOSE</div><div className="model-caption"><strong>SCHEMATIC ASSEMBLY</strong><span>not dimensional CAD</span></div>
        <SceneInventory state={state} inspectionMode={inspectionMode} showAllParts={showAllParts} onSelect={onSelect} /><MobileLocationRail state={state} onSelect={onSelect} />
        {state.evaluationStatus !== 'confirmed' && <div className="stale-banner" role="status"><strong>{state.evaluationStatus === 'pending' ? 'CHECKING STUB…' : 'EVALUATION UNAVAILABLE'}</strong><span>Last confirmed fixture retained as stale. Nothing is painted clear.</span></div>}
      </div>
      <div className="view-controls" aria-label="Model display controls">
        <label><input type="checkbox" checked={inspectionMode} onChange={(event) => setInspectionMode(event.target.checked)} /><span>Inspection mode</span><small>schematic internals</small></label>
        <label><input type="checkbox" checked={showAllParts} onChange={(event) => setShowAllParts(event.target.checked)} /><span>Show all parts</span><small>inventory labels</small></label>
        <label><input type="checkbox" checked={showTripwires} onChange={(event) => setShowTripwires(event.target.checked)} /><span>Show tripwires</span><small>question + flag</small></label>
        <span className="orbit-hint">DRAG TO ORBIT · SCROLL TO ZOOM</span>
      </div>
    </main>
  )
}

function formatValue(value) {
  if (value === null || value === undefined) return 'MISSING'
  if (Array.isArray(value)) return value.join(' · ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function FactsTable({ facts }) {
  return <div className="facts-wrap"><span className="section-label">ALL CAUSAL FACTS · PREREQUISITES · EXCLUSIONS</span><table className="facts-table"><thead><tr><th>ATTRIBUTE</th><th>OBSERVED</th><th>TEST</th><th>THRESHOLD</th></tr></thead><tbody>{facts.map((item, index) => <tr key={`${item.attribute}-${index}`} className={item.observed === null ? 'missing' : ''}><th scope="row">{item.attribute}</th><td>{formatValue(item.observed)}{item.unit ? ` ${item.unit}` : ''}</td><td>{item.operator}</td><td>{formatValue(item.threshold)}{item.unit ? ` ${item.unit}` : ''}</td></tr>)}</tbody></table></div>
}

function TripwireCard({ tripwire, kind, onSelect }) {
  const displayState = kind === 'propagated' ? 'propagated' : kind === 'unresolved' ? 'question' : 'flag'
  return (
    <article className={`tripwire-card ${kind}`} data-tripwire-kind={kind}>
      <div className="tripwire-card-head"><StateBadge state={displayState} /><button onClick={() => onSelect(tripwire.node_id)}>FOCUS {getNodeLabel(tripwire.node_id)} ↗</button></div>
      <div className="rule-heading"><div><span>RULE ENTRY · UNAPPROVED STUB</span><h3>{tripwire.entry}</h3></div><code>{tripwire.rule_id}</code></div>
      <dl className="rule-meta"><div><dt>STATE</dt><dd>{tripwire.state}</dd></div><div><dt>JURISDICTION</dt><dd>{tripwire.jurisdiction}</dd></div><div><dt>REASON FOR CONTROL</dt><dd>{tripwire.reason_for_control.length ? tripwire.reason_for_control.join(' · ') : '—'}</dd></div><div><dt>CAUSE</dt><dd><button onClick={() => onSelect(tripwire.cause_node_id)}>{getNodeLabel(tripwire.cause_node_id)} ↗</button></dd></div></dl>
      {kind === 'unresolved' && <div className="question-callout"><strong>{tripwire.question}</strong><span>Missing fact: <code>{tripwire.missing_fact}</code></span></div>}
      {kind === 'propagated' && <div className="propagation-path"><span>PROPAGATION PATH</span><strong>{tripwire.path.map(getNodeLabel).join(' → ')}</strong><small>Parent affected by child; no independent parent threshold crossing is implied.</small></div>}
      <FactsTable facts={tripwire.facts} />
      <div className="evidence-block"><span className="section-label">SOURCE TEXT · UNAPPROVED FIXTURE DISPLAY</span><blockquote>{tripwire.text}</blockquote><dl><div><dt>SOURCE URL</dt><dd><a href={tripwire.source_url} target="_blank" rel="noreferrer">eCFR source pointer ↗</a></dd></div><div><dt>SOURCE DATE</dt><dd>{tripwire.ecfr_date}</dd></div><div><dt>RULE EFFECTIVE</dt><dd>{tripwire.rule_effective ?? 'not supplied'}</dd></div><div><dt>EVIDENCE STATE</dt><dd>{tripwire.evidence.level}</dd></div><div><dt>EVIDENCE SHA-256</dt><dd>{tripwire.evidence.sha256 ?? 'not supplied'}</dd></div><div><dt>SOURCE SPAN</dt><dd>{tripwire.evidence.span ? tripwire.evidence.span.join('–') : 'not supplied'}</dd></div></dl></div>
    </article>
  )
}

function DestinationTable({ destinations }) {
  return <section className="destination-card" aria-labelledby="destination-heading"><span className="section-label" id="destination-heading">DESTINATION TABLE</span><table><tbody><tr><th scope="row">STATUS</th><td>{destinations.status}</td></tr><tr><th scope="row">REASON</th><td>{destinations.reason}</td></tr></tbody></table><p>No destination authorization or legal conclusion is produced by this interface.</p></section>
}

function Inspector({ state, onSelect }) {
  const node = getNode(state.selectedNodeId)
  const presentation = NODE_PRESENTATION[state.selectedNodeId]
  const determination = state.response.determinations[state.selectedNodeId]
  const directness = directnessFor(determination)
  const directCount = determination.direct_tripwires.length
  return (
    <aside className="panel inspector-panel" aria-label="Selected node inspector" data-selected-node={node.id}>
      <div className="inspector-title"><span className="overline">SELECTED NODE</span><h2>{presentation.label}</h2><code>{node.id}</code></div>
      <div className="selected-summary"><StateBadge state={state.evaluationStatus === 'confirmed' ? directness : state.evaluationStatus} count={directCount} /><p>{STATUS[directness].description}</p></div>
      <dl className="node-meta"><div><dt>KIND / ROLE</dt><dd>{node.kind} / {node.role}</dd></div><div><dt>SYNTHETIC MPN</dt><dd>{node.mpn}</dd></div><div><dt>ARTIFACT STATUS</dt><dd>{FIXTURE_META.artifactStatus}</dd></div><div><dt>APPROVAL</dt><dd>{FIXTURE_META.approvalStatus}</dd></div></dl>
      <div className="inspector-scroll">
        {state.evaluationStatus !== 'confirmed' && <div className="stale-card"><strong>LAST RESULT IS STALE</strong><p>Checking a local stub. The confirmed fixture remains visible but must not be read as current or clear.</p></div>}
        {determination.direct_tripwires.map((tripwire) => <TripwireCard key={tripwire.rule_id} tripwire={tripwire} kind="direct" onSelect={onSelect} />)}
        {determination.propagated_tripwires.map((tripwire) => <TripwireCard key={tripwire.rule_id} tripwire={tripwire} kind="propagated" onSelect={onSelect} />)}
        {determination.unresolved_tripwires.map((tripwire) => <TripwireCard key={tripwire.rule_id} tripwire={tripwire} kind="unresolved" onSelect={onSelect} />)}
        {!directCount && !determination.propagated_tripwires.length && !determination.unresolved_tripwires.length && <div className="clear-card"><span aria-hidden="true">✓</span><div><strong>No implemented tripwire fired.</strong><p>This is a stub result for the supplied synthetic fixture—not a classification, verification, or destination authorization.</p></div></div>}
        <DestinationTable destinations={determination.destinations} />
      </div>
    </aside>
  )
}

function ContractError({ message }) {
  if (!message) return null
  return <div className="contract-error" role="alert"><span aria-hidden="true">!</span><div><strong>CONTRACT RESPONSE BLOCKED</strong><p>{message}</p><small>The scene retains its last admitted fixture and will not silently drop an unknown or mismatched binding.</small></div></div>
}

export default function App() {
  const [state, dispatch] = React.useReducer(inspectionReducer, undefined, createInitialState)
  const requestCounter = React.useRef(state.latestRequestId)
  const pendingTimer = React.useRef(null)
  React.useEffect(() => () => { if (pendingTimer.current) window.clearTimeout(pendingTimer.current) }, [])
  const selectNode = React.useCallback((nodeId) => dispatch({ type: 'SELECT_NODE', nodeId }), [])
  const selectScenario = React.useCallback((scenarioId) => {
    requestCounter.current += 1
    const requestId = requestCounter.current
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
    dispatch({ type: 'EVALUATION_STARTED', scenarioId, requestId })
    pendingTimer.current = window.setTimeout(() => {
      dispatch({ type: 'EVALUATION_RECEIVED', response: responseForScenario(scenarioId, requestId) })
      pendingTimer.current = null
    }, 140)
  }, [])
  return (
    <div className="app-shell">
      <TopBar state={state} /><ScenarioBar state={state} onScenario={selectScenario} />
      <div className="workspace-grid"><BomTree state={state} onSelect={selectNode} /><Viewport state={state} onSelect={selectNode} /><Inspector state={state} onSelect={selectNode} /></div>
      <footer className="status-footer"><span><b>{FIXTURE_META.artifactStatus}</b> · {FIXTURE_META.connectivity} · {FIXTURE_META.approvalStatus}</span><span>RULE INPUT {FIXTURE_META.rulePackSha.slice(0, 23)}… · explicitly unapproved</span><span>DESIGN {state.designRevision.slice(0, 24)}…</span><span>Tripwire is a design-stage screening aid; it does not issue a legal classification or destination authorization.</span></footer>
      <ContractError message={state.evaluationStatus === 'contract_error' ? state.contractError : null} />
    </div>
  )
}
