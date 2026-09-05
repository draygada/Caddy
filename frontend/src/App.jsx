import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Edges, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  DESIGN,
  FIXTURE_META,
  KESTREL_SCENE_NODES,
  KESTREL_SLOTS,
  SCENARIOS,
  SCENARIO_ORDER,
  getNode,
  responseForScenario,
} from './fixtures.js'
import { createInitialState, inspectionReducer, visualStateFor } from './inspectionState.js'
import './styles.css'

const STATUS = {
  clear: { icon: '✓', label: 'CLEAR', long: 'No implemented tripwire fired.' },
  watch: { icon: '△', label: 'NEAR TRIPWIRE', long: 'A reviewed proximity state was returned.' },
  question: { icon: '?', label: 'QUESTION', long: 'Evidence is needed before this can resolve.' },
  flag: { icon: '!', label: 'DIRECT FLAG', long: 'One or more fixture tripwires fired.' },
  propagated: { icon: '↗', label: 'PROPAGATED', long: 'Affected by a child component.' },
  pending: { icon: '…', label: 'CHECKING', long: 'Showing the last confirmed result as stale.' },
  unavailable: { icon: '×', label: 'UNAVAILABLE', long: 'The last confirmed result is stale.' },
}

const shapeGeometry = {
  fuselage: <cylinderGeometry args={[0.16, 0.28, 3.05, 32]} />,
  nose: <coneGeometry args={[0.24, 0.64, 28]} />,
  portWing: <boxGeometry args={[1.45, 0.055, 2.32]} />,
  starboardWing: <boxGeometry args={[1.45, 0.055, 2.32]} />,
  tail: <boxGeometry args={[0.64, 0.055, 1.46]} />,
  motorMount: <cylinderGeometry args={[0.18, 0.19, 0.22, 24]} />,
  motor: <cylinderGeometry args={[0.14, 0.14, 0.28, 24]} />,
  propeller: <boxGeometry args={[0.055, 0.06, 1.4]} />,
  pod: <capsuleGeometry args={[0.16, 0.54, 6, 16]} />,
  camera: <boxGeometry args={[0.17, 0.18, 0.22]} />,
  lens: <cylinderGeometry args={[0.085, 0.085, 0.08, 20]} />,
  board: <boxGeometry args={[0.5, 0.045, 0.64]} />,
  chipLarge: <boxGeometry args={[0.15, 0.055, 0.15]} />,
  chip: <boxGeometry args={[0.11, 0.055, 0.11]} />,
  chipSmall: <boxGeometry args={[0.075, 0.05, 0.075]} />,
  gnss: <cylinderGeometry args={[0.105, 0.105, 0.05, 20]} />,
  battery: <boxGeometry args={[0.66, 0.24, 0.38]} />,
  datalink: <boxGeometry args={[0.12, 0.52, 0.12]} />,
}

const rotatedOnX = new Set(['fuselage', 'nose', 'motorMount', 'motor'])
const rotatedOnZ = new Set(['pod', 'lens', 'gnss'])

function directnessFor(determination) {
  if (determination?.propagated_tripwires?.length) return 'propagated'
  return determination?.state ?? 'clear'
}

function StateBadge({ state, className = '' }) {
  const meta = STATUS[state] ?? STATUS.unavailable
  return <span className={`state-badge state-${state} ${className}`}><span aria-hidden="true">{meta.icon}</span> {meta.label}</span>
}

function TopBar({ state }) {
  const determinations = Object.values(state.response.determinations)
  const direct = determinations.reduce((count, item) => count + item.direct_tripwires.length, 0)
  const propagated = determinations.reduce((count, item) => count + item.propagated_tripwires.length, 0)
  const questions = determinations.reduce((count, item) => count + item.unresolved_tripwires.length, 0)
  return (
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span />T</div><div><strong>TRIPWIRE</strong><small>VISUAL INSPECTION</small></div></div>
      <div className="design-title"><span className="overline">ASSEMBLY / KST-FW-01</span><h1>Kestrel fixed-wing UAS</h1></div>
      <div className="topbar-status">
        <div className="offline-pill"><span aria-hidden="true" /> FIXTURE / OFFLINE</div>
        <div className="top-stat"><span>DIRECT</span><strong>{direct}</strong></div>
        <div className="top-stat"><span>PARENT</span><strong>{propagated}</strong></div>
        <div className="top-stat"><span>QUESTIONS</span><strong>{questions}</strong></div>
        <div className="corpus-date"><span>FIXTURE CORPUS</span><strong>{FIXTURE_META.corpusDate}</strong></div>
      </div>
    </header>
  )
}

function ScenarioBar({ state, onScenario }) {
  return (
    <nav className="scenario-bar" aria-label="Fixture scenarios">
      <span className="scenario-label">SCENARIO</span>
      <div className="scenario-buttons">
        {SCENARIO_ORDER.map((scenarioId) => {
          const scenario = SCENARIOS[scenarioId]
          const active = state.targetScenarioId === scenarioId
          return (
            <button key={scenarioId} className={active ? 'scenario-button active' : 'scenario-button'} aria-pressed={active} onClick={() => onScenario(scenarioId)}>
              <span className="scenario-code">{scenario.short}</span><span className="scenario-copy">{scenario.label}</span>
            </button>
          )
        })}
      </div>
      <div className={`evaluation-state ${state.evaluationStatus}`} role="status" aria-live="polite">
        {state.evaluationStatus === 'confirmed' ? 'CONFIRMED FIXTURE' : state.evaluationStatus === 'pending' ? 'CHECKING…' : 'RESULT STALE'}
      </div>
    </nav>
  )
}

function BomTree({ state, onSelect }) {
  const children = React.useMemo(() => {
    const map = new Map()
    DESIGN.nodes.forEach((node) => map.set(node.id, []))
    DESIGN.nodes.forEach((node) => { if (node.parent) map.get(node.parent)?.push(node) })
    return map
  }, [])
  const renderNode = (node, depth = 0) => {
    const determination = state.response.determinations[node.id]
    const visual = visualStateFor(state, node.id)
    const directness = state.evaluationStatus === 'confirmed' ? directnessFor(determination) : visual.state
    const selected = state.selectedNodeId === node.id
    const isChanged = state.response.delta.changed_nodes.includes(node.id)
    return (
      <React.Fragment key={node.id}>
        <button className={`bom-row ${selected ? 'selected' : ''}`} style={{ '--depth': depth }} onClick={() => onSelect(node.id)} aria-current={selected ? 'true' : undefined}>
          <span className="bom-branch" aria-hidden="true">{node.kind === 'part' ? '·' : depth ? '⌄' : '◆'}</span>
          <span className="bom-copy"><strong>{node.label}</strong><small>{node.mpn}</small></span>
          {isChanged && <span className="changed-tick" title="Changed in this fixture">Δ</span>}
          <span className={`row-status state-${directness}`} title={STATUS[directness]?.label} aria-label={STATUS[directness]?.label}>{STATUS[directness]?.icon}</span>
        </button>
        {(children.get(node.id) ?? []).map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    )
  }
  return (
    <aside className="panel bom-panel" aria-label="Assembly tree">
      <div className="panel-heading"><div><span className="overline">ASSEMBLY TREE</span><h2>Installed inventory</h2></div><span className="count-chip">{DESIGN.nodes.length} NODES</span></div>
      <div className="bom-legend"><span>Δ fixture change</span><span>IDs are stable</span></div>
      <div className="bom-scroll">{renderNode(getNode(DESIGN.root))}</div>
      <div className="fixture-footnote">All product geometry and unverified facts are labeled fixture or synthetic.</div>
    </aside>
  )
}

function partMaterial(selected, determination, evaluationStatus, internal) {
  const directness = directnessFor(determination)
  let color = internal ? '#35545a' : '#64717a'
  let emissive = '#000000'
  let emissiveIntensity = 0
  if (selected) { color = '#d6a657'; emissive = '#6f4712'; emissiveIntensity = 0.35 }
  else if (evaluationStatus === 'confirmed' && directness === 'flag') { color = '#9b3d32'; emissive = '#5b0d08'; emissiveIntensity = 0.22 }
  else if (evaluationStatus === 'confirmed' && directness === 'propagated') { color = '#7d4039'; emissive = '#32100e'; emissiveIntensity = 0.12 }
  else if (evaluationStatus === 'confirmed' && directness === 'question') color = '#a67731'
  return { color, emissive, emissiveIntensity }
}

function SemanticPart({ binding, state, inspectionMode, onSelect }) {
  const node = getNode(binding.nodeId)
  if (binding.internal && !inspectionMode) return null
  const selected = state.selectedNodeId === binding.nodeId
  const determination = state.response.determinations[binding.nodeId]
  const material = partMaterial(selected, determination, state.evaluationStatus, binding.internal)
  const rotation = rotatedOnX.has(binding.shape) ? [0, 0, Math.PI / 2] : rotatedOnZ.has(binding.shape) ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  const directness = directnessFor(determination)
  return (
    <mesh
      position={binding.position} rotation={rotation} userData={{ nodeId: binding.nodeId }}
      onClick={(event) => { event.stopPropagation(); onSelect(binding.nodeId) }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = 'default' }}
      castShadow receiveShadow
    >
      {shapeGeometry[binding.shape]}
      <meshStandardMaterial color={material.color} emissive={material.emissive} emissiveIntensity={material.emissiveIntensity} metalness={binding.internal ? 0.25 : 0.5} roughness={binding.internal ? 0.55 : 0.38} transparent={binding.internal} opacity={binding.internal ? 0.92 : 1} />
      {(selected || (state.evaluationStatus === 'confirmed' && determination.state !== 'clear')) && <Edges threshold={12} color={selected ? '#ffd98e' : directness === 'question' ? '#f3b34f' : '#ff7667'} />}
    </mesh>
  )
}

function CutawayShell({ inspectionMode }) {
  if (!inspectionMode) return null
  return (
    <mesh position={[-0.18, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.32, 0.32, 1.75, 32, 1, true]} />
      <meshPhysicalMaterial color="#7fa5aa" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      <Edges color="#54747a" />
    </mesh>
  )
}

function aggregateSlotState(slot, response, evaluationStatus) {
  if (evaluationStatus !== 'confirmed') return evaluationStatus === 'pending' ? 'pending' : 'unavailable'
  const determinations = slot.nodeIds.map((nodeId) => response.determinations[nodeId])
  if (determinations.some((item) => item.propagated_tripwires.length)) return 'propagated'
  if (determinations.some((item) => item.state === 'flag')) return 'flag'
  if (determinations.some((item) => item.state === 'question')) return 'question'
  if (determinations.some((item) => item.state === 'watch')) return 'watch'
  return 'clear'
}

function SlotMarkers({ state, onSelect }) {
  return KESTREL_SLOTS.map((slot, index) => {
    const status = aggregateSlotState(slot, state.response, state.evaluationStatus)
    const node = getNode(slot.primaryNodeId)
    const changed = slot.nodeIds.some((nodeId) => state.response.delta.changed_nodes.includes(nodeId))
    return (
      <Html key={slot.id} position={slot.anchor} center distanceFactor={5.7} zIndexRange={[20 - index, 0]}>
        <button className={`slot-marker state-${status} ${state.selectedNodeId === slot.primaryNodeId ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); onSelect(slot.primaryNodeId) }} aria-label={`${slot.label}, ${node.mpn}, ${STATUS[status].label}${slot.note.includes('schematic') ? ', schematic location' : ''}`}>
          <span className="slot-index">0{index + 1}</span><span className="slot-copy"><strong>{slot.label}</strong><small>{node.mpn}</small></span>
          {changed && <span className="marker-change">Δ</span>}<span className="slot-state"><b aria-hidden="true">{STATUS[status].icon}</b>{STATUS[status].label}</span>
          {slot.note.includes('schematic') && <em>SCHEMATIC</em>}
        </button>
      </Html>
    )
  })
}

function TripwireMarkers({ state, onSelect }) {
  if (state.evaluationStatus !== 'confirmed') return null
  const active = KESTREL_SCENE_NODES.filter(({ nodeId }) => {
    const item = state.response.determinations[nodeId]
    return item.state === 'flag' || item.state === 'question' || item.state === 'watch'
  })
  if (active.length > 4) return <Html position={[0, 0.94, 0]} center><button className="cluster-marker" onClick={() => onSelect(active[0].nodeId)}><strong>{active.length}</strong><span>ACTIVE MARKERS</span></button></Html>
  return active.map((binding) => {
    const determination = state.response.determinations[binding.nodeId]
    const directness = directnessFor(determination)
    const meta = STATUS[directness]
    return (
      <Html key={`alert-${binding.nodeId}`} position={[binding.position[0], binding.position[1] + 0.42, binding.position[2]]} center>
        <button className={`tripwire-marker state-${directness}`} onClick={(event) => { event.stopPropagation(); onSelect(binding.nodeId) }} aria-label={`${meta.label} on ${getNode(binding.nodeId).label}. Open evidence.`}>
          <b aria-hidden="true">{meta.icon}</b><span>{directness === 'propagated' ? 'PARENT' : directness === 'flag' ? 'DIRECT' : meta.label}</span>
        </button>
      </Html>
    )
  })
}

function KestrelScene({ state, inspectionMode, showTripwires, onSelect }) {
  return (
    <Canvas camera={{ position: [5.3, 3.8, 6.55], fov: 38 }} dpr={[1, 1.7]} shadows onPointerMissed={() => onSelect('kestrel')} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#101820']} /><fog attach="fog" args={['#101820', 7, 12]} />
      <ambientLight intensity={1.25} /><directionalLight position={[3, 5, 4]} intensity={2.2} color="#e9f6ff" castShadow /><directionalLight position={[-4, 2, -3]} intensity={0.75} color="#d19a58" />
      <group rotation={[0, -0.08, -0.02]} position={[0, 0.08, 0]}>
        {KESTREL_SCENE_NODES.map((binding) => <SemanticPart key={binding.nodeId} binding={binding} state={state} inspectionMode={inspectionMode} onSelect={onSelect} />)}
        <CutawayShell inspectionMode={inspectionMode} /><SlotMarkers state={state} onSelect={onSelect} />{showTripwires && <TripwireMarkers state={state} onSelect={onSelect} />}
      </group>
      <gridHelper args={[12, 24, '#2d454d', '#1b2a31']} position={[0, -0.72, 0]} />
      <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={4.2} maxDistance={9} minPolarAngle={0.45} maxPolarAngle={1.48} />
    </Canvas>
  )
}

function SceneInventory({ state, inspectionMode, showAllParts, onSelect }) {
  if (!showAllParts) return null
  const visibleNodes = KESTREL_SCENE_NODES.filter((binding) => inspectionMode || !binding.internal)
  return (
    <div className="scene-inventory" aria-label="Visible scene inventory"><span>VISIBLE NODES</span><div>
      {visibleNodes.map(({ nodeId }) => <button key={nodeId} onClick={() => onSelect(nodeId)} className={state.selectedNodeId === nodeId ? 'selected' : ''}>{getNode(nodeId).label}</button>)}
    </div></div>
  )
}

function MobileLocationRail({ state, onSelect }) {
  return (
    <div className="mobile-location-rail" aria-label="Kestrel installed locations">
      {KESTREL_SLOTS.map((slot, index) => {
        const status = aggregateSlotState(slot, state.response, state.evaluationStatus)
        const node = getNode(slot.primaryNodeId)
        return (
          <button key={slot.id} className={`state-${status} ${state.selectedNodeId === slot.primaryNodeId ? 'selected' : ''}`} onClick={() => onSelect(slot.primaryNodeId)} aria-label={`${slot.label}, ${node.mpn}, ${STATUS[status].label}`}>
            <span>0{index + 1}</span><strong>{slot.label}</strong><small>{STATUS[status].icon} {STATUS[status].label}</small>
          </button>
        )
      })}
    </div>
  )
}

function Viewport({ state, onSelect }) {
  const [inspectionMode, setInspectionMode] = React.useState(true)
  const [showAllParts, setShowAllParts] = React.useState(false)
  const [showTripwires, setShowTripwires] = React.useState(true)
  const scenario = SCENARIOS[state.evaluationStatus === 'pending' ? state.targetScenarioId : state.scenarioId]
  return (
    <main className="viewport-panel">
      <div className="viewport-heading">
        <div><span className="overline">{scenario.eyebrow}</span><h2>{scenario.headline}</h2><p>{scenario.detail}</p></div>
        <div className="delta-summary" aria-label="Evaluation delta"><strong>{state.evaluationStatus === 'confirmed' ? state.response.delta.tripwires_added.length : '…'}</strong><span>ADDED</span><strong>{state.evaluationStatus === 'confirmed' ? state.response.delta.tripwires_removed.length : '…'}</strong><span>REMOVED</span></div>
      </div>
      <div className={`viewport-canvas ${state.evaluationStatus !== 'confirmed' ? 'stale' : ''}`}>
        <KestrelScene state={state} inspectionMode={inspectionMode} showTripwires={showTripwires} onSelect={onSelect} />
        <div className="orientation-cue" aria-hidden="true"><span>N</span><i />NOSE</div><div className="model-caption"><strong>SCHEMATIC ASSEMBLY</strong><span>Not dimensional CAD</span></div>
        <SceneInventory state={state} inspectionMode={inspectionMode} showAllParts={showAllParts} onSelect={onSelect} />
        <MobileLocationRail state={state} onSelect={onSelect} />
        {state.evaluationStatus !== 'confirmed' && <div className="stale-banner" role="status"><strong>{state.evaluationStatus === 'pending' ? 'CHECKING…' : 'EVALUATION UNAVAILABLE'}</strong><span>Last confirmed result retained as stale. Nothing is painted clear.</span></div>}
      </div>
      <div className="view-controls" aria-label="Model display controls">
        <label><input type="checkbox" checked={inspectionMode} onChange={(event) => setInspectionMode(event.target.checked)} /><span>Inspection mode</span><small>schematic internals</small></label>
        <label><input type="checkbox" checked={showAllParts} onChange={(event) => setShowAllParts(event.target.checked)} /><span>Show all parts</span><small>inventory labels</small></label>
        <label><input type="checkbox" checked={showTripwires} onChange={(event) => setShowTripwires(event.target.checked)} /><span>Show tripwires</span><small>question + flag</small></label>
        <div className="orbit-hint">DRAG TO ORBIT · SCROLL TO ZOOM</div>
      </div>
    </main>
  )
}

function FactComparison({ fact }) {
  if (!fact || fact.operator === null) return null
  return (
    <div className="fact-comparison" aria-label="Fixture fact and threshold">
      <div><span>BEFORE</span><strong>{fact.before ?? '—'} {fact.unit}</strong></div><span className="fact-arrow" aria-hidden="true">→</span>
      <div><span>OBSERVED</span><strong>{fact.observed} {fact.unit}</strong></div><div className="threshold-cell"><span>TRIPWIRE</span><strong>{fact.operator} {fact.threshold} {fact.unit}</strong></div>
    </div>
  )
}

function TripwireCard({ tripwire, kind, onSelect }) {
  const isPropagated = kind === 'propagated'
  const cause = getNode(tripwire.cause_node_id)
  return (
    <article className={`tripwire-card ${kind}`}>
      <div className="tripwire-card-head"><StateBadge state={isPropagated ? 'propagated' : 'flag'} /><button onClick={() => onSelect(tripwire.cause_node_id)}>{cause?.label ?? tripwire.cause_node_id} ↗</button></div>
      <h3>{tripwire.entry}</h3><p className="relationship">{tripwire.relationship}</p><FactComparison fact={tripwire.fact} />
      {tripwire.propagation_path && <div className="propagation-path"><span>PROPAGATION PATH</span><strong>{tripwire.propagation_path.map((nodeId) => getNode(nodeId)?.label ?? nodeId).join(' → ')}</strong></div>}
      <div className="evidence-block"><span>RULE ID</span><code>{tripwire.rule_id}</code><span>EVIDENCE TEXT · EXACT FIXTURE VALUE</span><blockquote>{tripwire.source_text}</blockquote><div><span>SOURCE DATE</span><strong>{tripwire.source_date}</strong><span>EVIDENCE</span><strong>{tripwire.evidence_state.toUpperCase()}</strong></div></div>
    </article>
  )
}

function QuestionCard({ unresolved }) {
  return (
    <article className="tripwire-card question-card"><StateBadge state="question" /><h3>{unresolved.question}</h3><p>Missing fact: <code>{unresolved.missing_fact}</code></p>
      <div className="evidence-block"><span>RULE ID</span><code>{unresolved.rule_id}</code><span>EVIDENCE TEXT · EXACT FIXTURE VALUE</span><blockquote>{unresolved.source_text}</blockquote><div><span>SOURCE DATE</span><strong>{unresolved.source_date}</strong><span>EVIDENCE</span><strong>MISSING</strong></div></div>
    </article>
  )
}

function Inspector({ state, onSelect }) {
  const node = getNode(state.selectedNodeId)
  const determination = state.response.determinations[state.selectedNodeId]
  const directness = state.evaluationStatus === 'confirmed' ? directnessFor(determination) : state.evaluationStatus === 'pending' ? 'pending' : 'unavailable'
  const findings = [...determination.direct_tripwires.map((item) => ({ item, kind: 'direct' })), ...determination.propagated_tripwires.map((item) => ({ item, kind: 'propagated' }))]
  const parent = node.parent ? getNode(node.parent) : null
  return (
    <aside className="panel inspector-panel" aria-label="Node inspector">
      <div className="inspector-title"><span className="overline">SELECTED NODE</span><h2>{node.label}</h2><code>{node.id}</code></div>
      <div className="selected-summary"><StateBadge state={directness} /><p>{STATUS[directness].long}</p></div>
      <dl className="node-meta"><div><dt>MPN</dt><dd>{node.mpn}</dd></div><div><dt>TYPE</dt><dd>{node.kind.toUpperCase()}</dd></div><div><dt>PROVENANCE</dt><dd>{node.provenance.toUpperCase()}</dd></div>{parent && <div><dt>PARENT</dt><dd><button onClick={() => onSelect(parent.id)}>{parent.label} ↗</button></dd></div>}</dl>
      <div className="inspector-scroll">
        {state.evaluationStatus !== 'confirmed' ? <div className="stale-card"><strong>{state.evaluationStatus === 'pending' ? 'Checking fixture response…' : 'Evaluation unavailable'}</strong><p>Last confirmed state: {STATUS[directnessFor(determination)].label}. It is retained as stale and is not presented as clear.</p></div>
          : findings.length ? findings.map(({ item, kind }) => <TripwireCard key={`${kind}-${item.rule_id}`} tripwire={item} kind={kind} onSelect={onSelect} />)
            : determination.unresolved_tripwires.length ? determination.unresolved_tripwires.map((item) => <QuestionCard key={item.rule_id} unresolved={item} />)
              : <div className="clear-card"><span aria-hidden="true">✓</span><div><strong>No implemented tripwire fired.</strong><p>This statement covers only the synthetic P0 fixture response. It is not a legal conclusion.</p></div></div>}
        <div className="destination-card"><span>DESTINATIONS</span><strong>NOT EVALUATED</strong><p>{determination.destinations.reason}</p></div>
      </div>
    </aside>
  )
}

function ContractError({ message }) {
  return <div className="contract-error" role="alert"><span aria-hidden="true">×</span><div><strong>CONTRACT ERROR — RESPONSE BLOCKED</strong><p>{message}</p><small>The last confirmed fixture remains stale; no clear state is rendered.</small></div></div>
}

export default function App() {
  const [state, dispatch] = React.useReducer(inspectionReducer, undefined, createInitialState)
  const requestId = React.useRef(state.latestRequestId)
  const timers = React.useRef(new Set())
  React.useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])
  const selectNode = React.useCallback((nodeId) => dispatch({ type: 'SELECT_NODE', nodeId }), [])
  const selectScenario = React.useCallback((scenarioId) => {
    if (scenarioId === state.targetScenarioId && state.evaluationStatus === 'pending') return
    const nextRequestId = ++requestId.current
    dispatch({ type: 'EVALUATION_STARTED', requestId: nextRequestId, scenarioId })
    const delay = scenarioId === 'f1' ? 420 : scenarioId === 'missing' ? 330 : 230
    const timer = window.setTimeout(() => { timers.current.delete(timer); dispatch({ type: 'EVALUATION_RECEIVED', response: responseForScenario(scenarioId, nextRequestId) }) }, delay)
    timers.current.add(timer)
  }, [state.evaluationStatus, state.targetScenarioId])
  return (
    <div className="app-shell">
      <TopBar state={state} /><ScenarioBar state={state} onScenario={selectScenario} />{state.contractError && <ContractError message={state.contractError} />}
      <div className="workspace-grid"><BomTree state={state} onSelect={selectNode} /><Viewport state={state} onSelect={selectNode} /><Inspector state={state} onSelect={selectNode} /></div>
      <footer className="status-footer"><span><b>NODE</b> {state.selectedNodeId}</span><span><b>REV</b> {state.designRevision}</span><span><b>PACK</b> FB-00 BLOCKED · FIXTURE CONTRACT ONLY</span>{state.ignoredRequestIds.length > 0 && <span><b>RACE GUARD</b> ignored older request {state.ignoredRequestIds.at(-1)}</span>}</footer>
    </div>
  )
}
