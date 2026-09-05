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
import { createInitialState, inspectionReducer } from './inspectionState.js'

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

test('F3 never reduces the camera result to a frame-rate-only predicate', () => {
  const findings = SCENARIOS.f3.response.determinations.nose_thermal.direct_tripwires
  const primaryFacts = new Set(findings[0].facts.map((item) => item.attribute))
  assert.equal(primaryFacts.has('frame_rate_hz'), true)
  assert.equal(primaryFacts.has('fpa_qualifies_6A002_a_3_f'), true)
  assert.equal([...primaryFacts].filter((key) => key.startsWith('note_3_')).length >= 3, true)
  const rsFacts = Object.fromEntries(findings[1].facts.map((item) => [item.attribute, item]))
  assert.equal(rsFacts.requires_entry.observed, '6A003.b.4.b')
  assert.equal(rsFacts.frame_rate_hz.observed, 60)
  assert.equal(rsFacts.frame_rate_hz.operator, '>')
  assert.equal(rsFacts.frame_rate_hz.threshold, 60)
  assert.equal(rsFacts.fpa_elements.threshold, 111000)
  assert.equal(rsFacts.fpa_elements.observed > rsFacts.fpa_elements.threshold, true)
  const parent = SCENARIOS.f3.response.determinations.kestrel.propagated_tripwires[0]
  assert.deepEqual(parent.path, ['nose_thermal', 'sensor_pod', 'kestrel'])
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
