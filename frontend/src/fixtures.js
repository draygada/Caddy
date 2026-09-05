export const FIXTURE_META = Object.freeze({
  mode: 'fixture',
  connectivity: 'offline',
  corpusDate: '2026-09-01',
  rulePackSha: 'fixture:fb00-blocked:no-approved-pack',
  destinationPolicySha: null,
})

export const DESIGN = Object.freeze({
  root: 'kestrel',
  nodes: [
    { id: 'kestrel', label: 'Kestrel UAS', kind: 'product', parent: null, role: 'airframe', mpn: 'KST-FW-01', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'airframe', label: 'Airframe shell', kind: 'assembly', parent: 'kestrel', role: 'structure', mpn: 'KST-AF-01', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'port_wing', label: 'Port wing', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'KST-WNG-L', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'starboard_wing', label: 'Starboard wing', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'KST-WNG-R', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'tailplane', label: 'V-tail assembly', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'KST-TAIL-V', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'propulsion', label: 'Propulsion', kind: 'assembly', parent: 'kestrel', role: 'power', mpn: 'KST-PROP-01', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'motor', label: 'Pusher motor', kind: 'part', parent: 'propulsion', role: 'power', mpn: 'MN5008', vendor: 'T-Motor', provenance: 'fixture' },
    { id: 'prop', label: 'Pusher propeller', kind: 'part', parent: 'propulsion', role: 'power', mpn: '18×6.1 CF', vendor: 'T-Motor', provenance: 'fixture' },
    { id: 'sensor_pod', label: 'Belly sensor pod', kind: 'assembly', parent: 'kestrel', role: 'sensor', mpn: 'KST-SP-02', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'nose_thermal', label: 'Nose thermal camera', kind: 'part', parent: 'sensor_pod', role: 'sensor', mpn: '500-0771-01', vendor: 'Teledyne FLIR', provenance: 'fixture' },
    { id: 'eo_camera', label: 'Belly EO camera', kind: 'part', parent: 'sensor_pod', role: 'sensor', mpn: 'IMX477', vendor: 'Sony', provenance: 'fixture' },
    { id: 'fc_board', label: 'Flight-controller board', kind: 'assembly', parent: 'kestrel', role: 'nav', mpn: 'KST-FC-R3', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'fc_mcu', label: 'Primary MCU', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'STM32H743', vendor: 'ST', provenance: 'fixture' },
    { id: 'io_mcu', label: 'I/O MCU', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'STM32F103', vendor: 'ST', provenance: 'fixture' },
    { id: 'imu', label: 'Inertial measurement unit', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'ICM-42688-P', vendor: 'TDK InvenSense', provenance: 'fixture' },
    { id: 'baro', label: 'Barometer', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'BMP388', vendor: 'Bosch', provenance: 'fixture' },
    { id: 'mag', label: 'Magnetometer', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'BMM150', vendor: 'Bosch', provenance: 'fixture' },
    { id: 'gnss', label: 'GNSS receiver', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'NEO-M9N', vendor: 'u-blox', provenance: 'fixture' },
    { id: 'battery_pack', label: 'Battery pack', kind: 'part', parent: 'kestrel', role: 'power', mpn: 'KST-6S-22A', vendor: 'Tripwire demo', provenance: 'synthetic' },
    { id: 'datalink', label: 'Mast datalink', kind: 'part', parent: 'kestrel', role: 'comms', mpn: 'OEM-M0048-4-1', vendor: 'Microhard', provenance: 'fixture' },
  ],
})

export const KESTREL_SCENE_NODES = Object.freeze([
  { nodeId: 'kestrel', position: [0, 0, 0], shape: 'fuselage', internal: false },
  { nodeId: 'airframe', position: [1.55, 0, 0], shape: 'nose', internal: false },
  { nodeId: 'port_wing', position: [-0.1, -0.01, 1.22], shape: 'portWing', internal: false },
  { nodeId: 'starboard_wing', position: [-0.1, -0.01, -1.22], shape: 'starboardWing', internal: false },
  { nodeId: 'tailplane', position: [-1.25, 0.14, 0], shape: 'tail', internal: false },
  { nodeId: 'propulsion', position: [-1.65, 0, 0], shape: 'motorMount', internal: false },
  { nodeId: 'motor', position: [-1.82, 0, 0], shape: 'motor', internal: false },
  { nodeId: 'prop', position: [-2.02, 0, 0], shape: 'propeller', internal: false },
  { nodeId: 'sensor_pod', position: [0.48, -0.32, 0], shape: 'pod', internal: false },
  { nodeId: 'nose_thermal', position: [1.75, -0.16, 0], shape: 'camera', internal: false },
  { nodeId: 'eo_camera', position: [0.64, -0.5, 0], shape: 'lens', internal: false },
  { nodeId: 'fc_board', position: [0.08, 0.12, 0.28], shape: 'board', internal: true },
  { nodeId: 'fc_mcu', position: [0.02, 0.19, 0.27], shape: 'chipLarge', internal: true },
  { nodeId: 'io_mcu', position: [0.25, 0.19, 0.27], shape: 'chip', internal: true },
  { nodeId: 'imu', position: [-0.16, 0.19, 0.27], shape: 'chip', internal: true },
  { nodeId: 'baro', position: [0.2, 0.19, 0.08], shape: 'chipSmall', internal: true },
  { nodeId: 'mag', position: [-0.12, 0.19, 0.08], shape: 'chipSmall', internal: true },
  { nodeId: 'gnss', position: [0.02, 0.2, -0.17], shape: 'gnss', internal: true },
  { nodeId: 'battery_pack', position: [-0.55, 0.12, 0], shape: 'battery', internal: true },
  { nodeId: 'datalink', position: [-0.58, 0.48, 0], shape: 'datalink', internal: false },
])

export const KESTREL_SLOTS = Object.freeze([
  { id: 'nose', label: 'Nose', note: 'thermal camera', primaryNodeId: 'nose_thermal', nodeIds: ['nose_thermal'], anchor: [1.83, 0.5, 0.02] },
  { id: 'belly', label: 'Belly', note: 'sensor pod', primaryNodeId: 'sensor_pod', nodeIds: ['sensor_pod', 'eo_camera'], anchor: [0.62, -0.4, 0.42] },
  { id: 'fc-bay', label: 'FC bay', note: 'schematic location', primaryNodeId: 'fc_board', nodeIds: ['fc_board', 'fc_mcu', 'io_mcu', 'imu', 'baro', 'mag', 'gnss'], anchor: [0.08, 0.83, 0.5] },
  { id: 'battery-bay', label: 'Battery bay', note: 'schematic location', primaryNodeId: 'battery_pack', nodeIds: ['battery_pack'], anchor: [-0.6, 0.76, -0.45] },
  { id: 'mast', label: 'Mast', note: 'datalink', primaryNodeId: 'datalink', nodeIds: ['datalink'], anchor: [-0.62, 1.04, 0.12] },
])

const nodeIds = DESIGN.nodes.map((node) => node.id)

function emptyDetermination() {
  return {
    state: 'clear', jurisdiction: null, entries: [], direct_tripwires: [], propagated_tripwires: [], unresolved_tripwires: [],
    destinations: { status: 'not_evaluated', reason: 'No approved destination policy is available in P0 fixture mode.' },
    evidence_level: 'synthetic',
  }
}

function determinationsWith(overrides = {}) {
  return Object.fromEntries(nodeIds.map((nodeId) => [nodeId, overrides[nodeId] ? { ...emptyDetermination(), ...overrides[nodeId] } : emptyDetermination()]))
}

const f1AirframeTripwire = {
  rule_id: 'F1-ENDURANCE-P0-FIXTURE', entry: 'Endurance parameter · visual fixture', cause_node_id: 'battery_pack',
  relationship: 'airframe result using battery capacity as a causal input',
  fact: { attribute: 'modeled_endurance', before: 48, observed: 78, unit: 'min', operator: '>', threshold: 60 },
  evidence_ref: 'fixture:f1-endurance#visual-only',
  source_text: '[FIXTURE TEXT] Endurance criterion placeholder; governed source text is unavailable while FB-00 is blocked.',
  source_date: FIXTURE_META.corpusDate, evidence_state: 'synthetic',
}

const f3CameraTripwire = {
  rule_id: 'CCL-6A003.b.4.b-FIXTURE', entry: '6A003.b.4.b · visual fixture', cause_node_id: 'nose_thermal',
  relationship: 'direct camera parameter',
  fact: { attribute: 'frame_rate', before: 9, observed: 60, unit: 'Hz', operator: '>', threshold: 9 },
  evidence_ref: 'fixture:f3-camera#visual-only',
  source_text: '[FIXTURE TEXT] Thermal-camera frame-rate criterion placeholder; governed source text is unavailable while FB-00 is blocked.',
  source_date: FIXTURE_META.corpusDate, evidence_state: 'synthetic',
}

const f3ParentTripwire = {
  rule_id: 'CCL-9A012.a.3-FIXTURE', entry: '9A012.a.3 · visual fixture', cause_node_id: 'nose_thermal',
  relationship: 'propagated from installed camera; no Kestrel parameter crossed this threshold',
  propagation_path: ['nose_thermal', 'sensor_pod', 'kestrel'],
  fact: { attribute: 'installed_component_result', observed: 'camera tripwire fired', unit: null, operator: null, threshold: null },
  evidence_ref: 'fixture:f3-parent#visual-only',
  source_text: '[FIXTURE TEXT] Parent-effect placeholder; governed source text is unavailable while FB-00 is blocked.',
  source_date: FIXTURE_META.corpusDate, evidence_state: 'synthetic',
}

const missingImuEvidence = {
  rule_id: 'IMU-BIAS-P0-FIXTURE', entry: 'Inertial parameter · visual fixture', cause_node_id: 'imu',
  missing_fact: 'one_month_bias_stability', question: 'Needs one-month bias stability.', evidence_ref: null,
  source_text: '[FIXTURE TEXT] Evidence requirement placeholder; governed source text is unavailable while FB-00 is blocked.',
  source_date: FIXTURE_META.corpusDate, evidence_state: 'missing',
}

function response({ requestId, revision, determinations, delta }) {
  const counts = { clear: 0, watch: 0, question: 0, flag: 0 }
  Object.values(determinations).forEach(({ state }) => { counts[state] += 1 })
  return {
    request_id: requestId, stub: false, fixture: true, offline: true, design_revision: revision,
    rule_pack_sha: FIXTURE_META.rulePackSha, destination_policy_sha: FIXTURE_META.destinationPolicySha,
    ecfr_date: FIXTURE_META.corpusDate, determinations, delta, summary: counts,
  }
}

const baselineResponse = response({
  requestId: 1, revision: 'fixture:kestrel-baseline-r1', determinations: determinationsWith(),
  delta: {
    changed_nodes: ['nose_thermal', 'kestrel'], tripwires_added: [],
    tripwires_removed: [
      { node_id: 'nose_thermal', rule_id: f3CameraTripwire.rule_id, kind: 'direct' },
      { node_id: 'kestrel', rule_id: f3ParentTripwire.rule_id, kind: 'propagated', cause_node_id: 'nose_thermal' },
    ], rules_evaluated: [f3CameraTripwire.rule_id, f3ParentTripwire.rule_id],
  },
})

const f1Response = response({
  requestId: 2, revision: 'fixture:kestrel-f1-battery-r2',
  determinations: determinationsWith({
    kestrel: { state: 'flag', jurisdiction: 'EAR', entries: [f1AirframeTripwire.entry], direct_tripwires: [f1AirframeTripwire], propagated_tripwires: [], unresolved_tripwires: [], evidence_level: 'synthetic' },
  }),
  delta: { changed_nodes: ['battery_pack', 'kestrel'], tripwires_added: [{ node_id: 'kestrel', rule_id: f1AirframeTripwire.rule_id, kind: 'direct', cause_node_id: 'battery_pack' }], tripwires_removed: [], rules_evaluated: [f1AirframeTripwire.rule_id] },
})

const f3Response = response({
  requestId: 3, revision: 'fixture:kestrel-f3-camera-r3',
  determinations: determinationsWith({
    nose_thermal: { state: 'flag', jurisdiction: 'EAR', entries: [f3CameraTripwire.entry], direct_tripwires: [f3CameraTripwire], propagated_tripwires: [], unresolved_tripwires: [], evidence_level: 'synthetic' },
    kestrel: { state: 'flag', jurisdiction: 'EAR', entries: [f3ParentTripwire.entry], direct_tripwires: [], propagated_tripwires: [f3ParentTripwire], unresolved_tripwires: [], evidence_level: 'synthetic' },
  }),
  delta: {
    changed_nodes: ['nose_thermal', 'kestrel'],
    tripwires_added: [
      { node_id: 'nose_thermal', rule_id: f3CameraTripwire.rule_id, kind: 'direct' },
      { node_id: 'kestrel', rule_id: f3ParentTripwire.rule_id, kind: 'propagated', cause_node_id: 'nose_thermal' },
    ], tripwires_removed: [], rules_evaluated: [f3CameraTripwire.rule_id, f3ParentTripwire.rule_id],
  },
})

const f8Response = response({
  requestId: 4, revision: 'fixture:kestrel-f8-control-r4', determinations: determinationsWith(),
  delta: { changed_nodes: [], tripwires_added: [], tripwires_removed: [], rules_evaluated: ['F8-NO-CHANGE-CONTROL'] },
})

const missingResponse = response({
  requestId: 5, revision: 'fixture:kestrel-missing-evidence-r5',
  determinations: determinationsWith({
    imu: { state: 'question', jurisdiction: null, entries: [missingImuEvidence.entry], direct_tripwires: [], propagated_tripwires: [], unresolved_tripwires: [missingImuEvidence], evidence_level: 'missing' },
  }),
  delta: { changed_nodes: ['imu'], tripwires_added: [{ node_id: 'imu', rule_id: missingImuEvidence.rule_id, kind: 'unresolved' }], tripwires_removed: [], rules_evaluated: [missingImuEvidence.rule_id] },
})

export const SCENARIOS = Object.freeze({
  baseline: { id: 'baseline', short: 'BASE', label: 'Baseline restored', eyebrow: 'BASELINE · REVERSE CHANGE', headline: 'Camera returned to 9 Hz. Active fixture markers cleared.', detail: 'The prior visual change remains in this session; no current tripwire marker is active.', focusNodeId: 'nose_thermal', response: baselineResponse },
  f1: { id: 'f1', short: 'F1', label: 'Battery / endurance', eyebrow: 'F1 · BATTERY CAPACITY', headline: 'Battery capacity changed. The airframe endurance tripwire fired.', detail: 'Kestrel is the result node; the battery is shown separately as the causal input.', focusNodeId: 'kestrel', response: f1Response },
  f3: { id: 'f3', short: 'F3', label: 'Thermal camera', eyebrow: 'F3 · CAMERA SWAP', headline: 'Camera changed from 9 to 60 Hz. A direct tripwire fired.', detail: 'The camera is marked directly; Kestrel carries a distinct propagated-parent marker.', focusNodeId: 'nose_thermal', response: f3Response },
  f8: { id: 'f8', short: 'F8', label: 'Zero-change control', eyebrow: 'F8 · CONTROL', headline: '0 determinations changed', detail: 'The fixture replay found no visual delta. Nothing pulses and no marker is manufactured.', focusNodeId: 'kestrel', response: f8Response },
  missing: { id: 'missing', short: '?', label: 'Missing evidence', eyebrow: 'EVIDENCE CHECK', headline: 'Needs one-month bias stability.', detail: 'The missing IMU fact is a question—not a clear result and not a guessed outcome.', focusNodeId: 'imu', response: missingResponse },
})

export const SCENARIO_ORDER = Object.freeze(['baseline', 'f1', 'f3', 'f8', 'missing'])

export function responseForScenario(scenarioId, requestId) {
  const scenario = SCENARIOS[scenarioId]
  if (!scenario) throw new Error(`Unknown fixture scenario: ${scenarioId}`)
  return { ...scenario.response, request_id: requestId }
}

export function getNode(nodeId) { return DESIGN.nodes.find((node) => node.id === nodeId) }

export function assertFixtureContract() {
  const designIds = new Set()
  for (const node of DESIGN.nodes) {
    if (designIds.has(node.id)) throw new Error(`Duplicate design node_id: ${node.id}`)
    designIds.add(node.id)
  }
  if (!designIds.has(DESIGN.root)) throw new Error(`Unknown design root node_id: ${DESIGN.root}`)
  for (const node of DESIGN.nodes) {
    if (node.parent !== null && !designIds.has(node.parent)) throw new Error(`Unknown parent node_id ${node.parent} for ${node.id}`)
  }
  const sceneIds = new Set()
  for (const binding of KESTREL_SCENE_NODES) {
    if (!designIds.has(binding.nodeId)) throw new Error(`Unknown scene node_id: ${binding.nodeId}`)
    if (sceneIds.has(binding.nodeId)) throw new Error(`Duplicate scene node_id binding: ${binding.nodeId}`)
    sceneIds.add(binding.nodeId)
  }
  for (const nodeId of designIds) if (!sceneIds.has(nodeId)) throw new Error(`Design node has no scene binding: ${nodeId}`)
  for (const slot of KESTREL_SLOTS) {
    for (const nodeId of slot.nodeIds) if (!designIds.has(nodeId)) throw new Error(`Unknown slot node_id ${nodeId} in ${slot.id}`)
  }
  for (const scenarioId of SCENARIO_ORDER) {
    const scenario = SCENARIOS[scenarioId]
    assertResponseContract(scenario.response, { requestId: scenario.response.request_id, designRevision: scenario.response.design_revision, rulePackSha: FIXTURE_META.rulePackSha })
  }
  return true
}

export function assertResponseContract(candidate, expected) {
  if (!candidate || typeof candidate !== 'object') throw new Error('Evaluation response is missing')
  if (candidate.request_id !== expected.requestId) throw new Error(`Mismatched request_id: expected ${expected.requestId}, received ${String(candidate.request_id)}`)
  if (candidate.design_revision !== expected.designRevision) throw new Error(`Mismatched design_revision: expected ${expected.designRevision}, received ${String(candidate.design_revision)}`)
  if (candidate.rule_pack_sha !== expected.rulePackSha) throw new Error(`Mismatched rule_pack_sha: expected ${expected.rulePackSha}, received ${String(candidate.rule_pack_sha)}`)
  if (candidate.fixture !== true || candidate.offline !== true) throw new Error('Response mode mismatch: FB-03 accepts labeled offline fixtures only')
  const designIds = new Set(nodeIds)
  for (const [nodeId, determination] of Object.entries(candidate.determinations ?? {})) {
    if (!designIds.has(nodeId)) throw new Error(`Unknown response node_id: ${nodeId}`)
    if (!['clear', 'watch', 'question', 'flag'].includes(determination.state)) throw new Error(`Unknown presentation state ${String(determination.state)} for ${nodeId}`)
  }
  for (const nodeId of designIds) if (!candidate.determinations?.[nodeId]) throw new Error(`Response missing node_id: ${nodeId}`)
  return true
}
