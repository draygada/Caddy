import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  DESIGN_FIXTURES,
  FIXTURE_META,
  KESTREL_SCENE_NODES,
  KESTREL_SLOTS,
  SCENARIOS,
  SCENARIO_ORDER,
  assertFixtureContract,
  responseForScenario,
} from './fixtures.js'
import { createInitialState, directnessFor, inspectionReducer } from './inspectionState.js'

const forbiddenKeys = new Set(['fact', 'frame_rate', 'evidence_ref', 'source_text'])

function visit(value, callback) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    callback(key, child)
    visit(child, callback)
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

test('all fixture graphs and complete response collections pass local contract assertions', () => {
  assert.equal(assertFixtureContract(), true)
  for (const scenarioId of SCENARIO_ORDER) {
    const response = SCENARIOS[scenarioId].response
    assert.equal(response.stub, true)
    assert.equal(response.fixture_mode, 'SYNTHETIC_DEMO')
    assert.equal(response.rule_pack_sha, FIXTURE_META.rulePackSha)
    assert.equal(Object.keys(response.determinations).length, DESIGN_FIXTURES[scenarioId].nodes.length)
  }
})

test('every response revision is bound to its canonical scenario design', () => {
  for (const scenarioId of SCENARIO_ORDER) {
    const digest = createHash('sha256').update(canonicalJson(DESIGN_FIXTURES[scenarioId])).digest('hex')
    assert.equal(SCENARIOS[scenarioId].response.design_revision, `sha256:${digest}`)
  }
})

test('design nodes remain inside the exact frozen enums and contain no presentation-only fields', () => {
  const kinds = new Set(['product', 'assembly', 'part'])
  const roles = new Set(['nav', 'sensor', 'power', 'comms', 'structure', null])
  const forbiddenNodeFields = new Set(['label', 'provenance'])
  for (const design of Object.values(DESIGN_FIXTURES)) {
    for (const node of design.nodes) {
      assert.equal(kinds.has(node.kind), true)
      assert.equal(roles.has(node.role), true)
      for (const key of Object.keys(node)) assert.equal(forbiddenNodeFields.has(key), false)
      assert.deepEqual(node.items, [])
    }
  }
})

test('scene projection binds every node once and exposes all five stable slots', () => {
  const nodeIds = new Set(DESIGN_FIXTURES.baseline.nodes.map((node) => node.id))
  assert.equal(KESTREL_SCENE_NODES.length, nodeIds.size)
  assert.equal(new Set(KESTREL_SCENE_NODES.map((binding) => binding.nodeId)).size, nodeIds.size)
  assert.deepEqual(KESTREL_SLOTS.map((slot) => slot.id), ['nose_thermal', 'belly_sensor_pod', 'fc_bay', 'battery_bay', 'mast_datalink'])
})

test('F1 exposes the governed 1000 to 1300 Wh model and complete derived endurance facts', () => {
  const finding = SCENARIOS.f1.response.determinations.kestrel.direct_tripwires[0]
  const facts = Object.fromEntries(finding.facts.map((item) => [item.attribute, item]))
  assert.equal(facts.baseline_energy_Wh.observed, 1000)
  assert.equal(facts.F1_energy_Wh.observed, 1300)
  assert.equal(facts.baseline_result_h.observed < 3, true)
  assert.equal(facts.F1_result_h.observed >= 3, true)
  assert.equal(facts.F1_result_h.operator, '>=')
  assert.ok(facts.formula)
  assert.ok(facts.usable_fraction)
  assert.ok(facts.steady_or_maximum_power_assumption)
  assert.ok(facts.atmosphere_and_wind_assumption)
  assert.equal(finding.cause_node_id, 'battery_pack')
  assert.equal(finding.node_id, 'kestrel')
})

test('baseline 9A012.a.1 is active and F1 replaces it cleanly with 9A012.a.2', () => {
  const baseline = SCENARIOS.baseline.response
  const baselineDetermination = baseline.determinations.kestrel
  const baselineFinding = baselineDetermination.direct_tripwires[0]
  const baselineFacts = Object.fromEntries(baselineFinding.facts.map((item) => [item.attribute, item]))
  assert.equal(baselineDetermination.state, 'flag')
  assert.deepEqual(baselineDetermination.entries, ['9A012.a.1'])
  assert.equal(baselineFinding.rule_id, 'CCL-9A012.a.1')
  assert.equal(baselineFinding.entry, '9A012.a.1')
  assert.equal(baselineFinding.cause_node_id, 'battery_pack')
  assert.equal(baselineFacts.endurance_h.observed, 2.83)
  assert.equal(baselineFacts.endurance_h.operator, '<')
  assert.equal(baselineFacts.endurance_h.threshold, 3)
  assert.equal(directnessFor(baselineDetermination), 'flag')
  assert.equal(baseline.summary.flag, 1)

  const f1 = SCENARIOS.f1.response
  const f1Determination = f1.determinations.kestrel
  assert.deepEqual(f1Determination.entries, ['9A012.a.2'])
  assert.deepEqual(f1Determination.direct_tripwires.map((tripwire) => tripwire.rule_id), ['CCL-9A012.a.2'])
  assert.deepEqual(f1.delta.tripwires_removed, [{ node_id: 'kestrel', rule_id: 'CCL-9A012.a.1', kind: 'direct', cause_node_id: 'battery_pack' }])
  assert.deepEqual(f1.delta.tripwires_added, [{ node_id: 'kestrel', rule_id: 'CCL-9A012.a.2', kind: 'direct', cause_node_id: 'battery_pack' }])
  assert.deepEqual(f1.delta.rules_evaluated, ['CCL-9A012.a.1', 'CCL-9A012.a.2'])
})

test('F3 never reduces the camera result to a frame-rate-only predicate', () => {
  const findings = SCENARIOS.f3.response.determinations.nose_thermal.direct_tripwires
  const primaryFacts = new Set(findings[0].facts.map((item) => item.attribute))
  assert.equal(primaryFacts.has('frame_rate_hz'), true)
  assert.equal(primaryFacts.has('fpa_qualifies_6A002_a_3_f'), true)
  assert.equal([...primaryFacts].filter((key) => key.startsWith('note_3_')).length >= 3, true)
  const primaryFactMap = Object.fromEntries(findings[0].facts.map((item) => [item.attribute, item]))
  assert.deepEqual(primaryFactMap.note_3_b_min_horizontal_or_vertical_ifov_mrad, {
    attribute: 'note_3_b_min_horizontal_or_vertical_ifov_mrad', observed: 6, unit: 'mrad', operator: '>=', threshold: 2,
  })
  assert.deepEqual(primaryFactMap.note_3_c_intended_civil_vehicle_gross_weight_kg, {
    attribute: 'note_3_c_intended_civil_vehicle_gross_weight_kg', observed: 5000, unit: 'kg', operator: '<', threshold: 4500,
  })
  assert.ok(primaryFactMap.note_3_c_placement_and_configuration_solely_driver_assistance)
  assert.ok(primaryFactMap.note_3_c_operable_only_in_intended_civil_vehicle)
  assert.ok(primaryFactMap.note_3_c_operable_only_in_authorized_maintenance_test_facility)
  assert.equal(primaryFactMap.note_3_b_exclusion_applies.observed, false)
  assert.equal(primaryFactMap.note_3_c_exclusion_applies.observed, false)
  const rsFacts = Object.fromEntries(findings[1].facts.map((item) => [item.attribute, item]))
  assert.equal(rsFacts.requires_entry.observed, '6A003.b.4.b')
  assert.equal(rsFacts.frame_rate_hz.observed, 60)
  assert.equal(rsFacts.frame_rate_hz.operator, '>')
  assert.equal(rsFacts.frame_rate_hz.threshold, 60)
  assert.equal(rsFacts.frame_rate_hz.observed > rsFacts.frame_rate_hz.threshold, false)
  assert.equal(rsFacts.fpa_elements.threshold, 111000)
  assert.equal(rsFacts.fpa_elements.observed > rsFacts.fpa_elements.threshold, true)
  const parent = SCENARIOS.f3.response.determinations.kestrel.propagated_tripwires[0]
  assert.deepEqual(parent.path, ['nose_thermal', 'sensor_pod', 'kestrel'])
  assert.equal(SCENARIOS.f3.eyebrow.includes('SIGNED'), false)
})

test('F8 preserves F3 evaluated markers while reporting an exact zero delta', () => {
  const f3 = SCENARIOS.f3.response
  const f8 = SCENARIOS.f8.response
  assert.deepEqual(DESIGN_FIXTURES.f8, DESIGN_FIXTURES.f3)
  assert.equal(f8.design_revision, f3.design_revision)
  assert.deepEqual(f8.determinations, f3.determinations)
  assert.deepEqual(f8.summary, f3.summary)
  assert.deepEqual(f8.delta, { changed_nodes: [], tripwires_added: [], tripwires_removed: [], rules_evaluated: [] })
  assert.equal(directnessFor(f8.determinations.nose_thermal), 'flag')
  assert.equal(directnessFor(f8.determinations.kestrel), 'propagated')
  assert.equal(f8.determinations.nose_thermal.direct_tripwires.length, 2)
  assert.equal(f8.determinations.kestrel.propagated_tripwires.length, 1)
})

test('missing evidence is cannot_evaluate/question and deprecated response fields are absent', () => {
  const determination = SCENARIOS.missing.response.determinations.imu
  const unresolved = determination.unresolved_tripwires[0]
  assert.equal(determination.state, 'question')
  assert.equal(unresolved.state, 'cannot_evaluate')
  assert.equal(unresolved.facts.find((item) => item.attribute === unresolved.missing_fact).observed, null)
  for (const scenario of Object.values(SCENARIOS)) {
    visit(scenario.response, (key) => assert.equal(forbiddenKeys.has(key), false, `deprecated field ${key}`))
  }
})

test('reducer synchronizes selection, admits monotonic responses, and ignores a late response', () => {
  let state = createInitialState()
  state = inspectionReducer(state, { type: 'SELECT_NODE', nodeId: 'battery_pack' })
  assert.equal(state.selectedNodeId, 'battery_pack')
  const requestId = state.latestRequestId + 1
  state = inspectionReducer(state, { type: 'EVALUATION_STARTED', scenarioId: 'f1', requestId })
  assert.equal(state.evaluationStatus, 'pending')
  const late = responseForScenario('baseline', requestId - 1)
  state = inspectionReducer(state, { type: 'EVALUATION_RECEIVED', response: late })
  assert.equal(state.evaluationStatus, 'pending')
  assert.deepEqual(state.ignoredRequestIds, [requestId - 1])
  state = inspectionReducer(state, { type: 'EVALUATION_RECEIVED', response: responseForScenario('f1', requestId) })
  assert.equal(state.evaluationStatus, 'confirmed')
  assert.equal(state.selectedNodeId, 'kestrel')
  assert.equal(state.response.delta.changed_nodes.includes('battery_pack'), true)
})

test('F3 to F8 pending retains the last-confirmed marker projection until the unchanged response is admitted', () => {
  let state = createInitialState()
  const lastConfirmedResponse = state.response
  const lastConfirmedDeterminations = state.response.determinations
  const markerNodeIds = (response) => Object.entries(response.determinations)
    .filter(([, determination]) => ['flag', 'question', 'watch', 'propagated'].includes(directnessFor(determination)))
    .map(([nodeId]) => nodeId)

  assert.deepEqual(markerNodeIds(state.response), ['kestrel', 'nose_thermal'])
  const requestId = state.latestRequestId + 1
  state = inspectionReducer(state, { type: 'EVALUATION_STARTED', scenarioId: 'f8', requestId })
  assert.equal(state.evaluationStatus, 'pending')
  assert.strictEqual(state.response, lastConfirmedResponse)
  assert.strictEqual(state.response.determinations, lastConfirmedDeterminations)
  assert.deepEqual(markerNodeIds(state.response), ['kestrel', 'nose_thermal'])

  state = inspectionReducer(state, { type: 'EVALUATION_RECEIVED', response: responseForScenario('f8', requestId) })
  assert.equal(state.evaluationStatus, 'confirmed')
  assert.strictEqual(state.response.determinations, lastConfirmedDeterminations)
  assert.deepEqual(markerNodeIds(state.response), ['kestrel', 'nose_thermal'])
})
