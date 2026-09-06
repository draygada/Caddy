import {
  DESIGN,
  FIXTURE_META,
  SCENARIOS,
  assertFixtureContract,
  assertResponseContract,
} from './fixtures.js'

const designNodeIds = new Set(DESIGN.nodes.map((node) => node.id))

export function createInitialState() {
  let contractError = null
  try {
    assertFixtureContract()
  } catch (error) {
    contractError = error instanceof Error ? error.message : String(error)
  }
  const first = SCENARIOS.f3
  return {
    selectedNodeId: first.focusNodeId,
    scenarioId: first.id,
    targetScenarioId: first.id,
    latestRequestId: first.response.request_id,
    designRevision: first.response.design_revision,
    response: first.response,
    evaluationStatus: contractError ? 'contract_error' : 'confirmed',
    contractError,
    ignoredRequestIds: [],
    sessionChanges: [{ scenarioId: first.id, changedNodeIds: first.response.delta.changed_nodes }],
  }
}

export function inspectionReducer(state, action) {
  switch (action.type) {
    case 'SELECT_NODE':
      if (!designNodeIds.has(action.nodeId)) {
        return { ...state, evaluationStatus: 'contract_error', contractError: `Unknown selection node_id: ${String(action.nodeId)}` }
      }
      return { ...state, selectedNodeId: action.nodeId }
    case 'EVALUATION_STARTED':
      if (action.requestId <= state.latestRequestId) {
        return { ...state, evaluationStatus: 'contract_error', contractError: `Non-monotonic request_id: ${action.requestId} after ${state.latestRequestId}` }
      }
      return {
        ...state,
        latestRequestId: action.requestId,
        targetScenarioId: action.scenarioId,
        evaluationStatus: 'pending',
        contractError: null,
      }
    case 'EVALUATION_RECEIVED': {
      if (action.response.request_id < state.latestRequestId) {
        return { ...state, ignoredRequestIds: [...state.ignoredRequestIds, action.response.request_id].slice(-4) }
      }
      const target = SCENARIOS[state.targetScenarioId]
      try {
        assertResponseContract(action.response, {
          requestId: state.latestRequestId,
          designRevision: target.response.design_revision,
          rulePackSha: FIXTURE_META.rulePackSha,
        })
      } catch (error) {
        return { ...state, evaluationStatus: 'contract_error', contractError: error instanceof Error ? error.message : String(error) }
      }
      return {
        ...state,
        response: action.response,
        scenarioId: state.targetScenarioId,
        designRevision: action.response.design_revision,
        selectedNodeId: target.focusNodeId,
        evaluationStatus: 'confirmed',
        contractError: null,
        sessionChanges: [
          ...state.sessionChanges,
          { scenarioId: state.targetScenarioId, changedNodeIds: action.response.delta.changed_nodes },
        ].slice(-8),
      }
    }
    case 'EVALUATION_FAILED':
      if (action.requestId < state.latestRequestId) return state
      return { ...state, evaluationStatus: 'unavailable', contractError: action.message || 'Evaluation unavailable' }
    default:
      return state
  }
}

export function directnessFor(determination) {
  if (determination?.propagated_tripwires?.length) return 'propagated'
  return determination?.state ?? 'question'
}

export function visualStateFor(state, nodeId) {
  const lastConfirmed = directnessFor(state.response.determinations[nodeId])
  if (state.evaluationStatus === 'confirmed') return { state: lastConfirmed, lastConfirmed }
  if (state.evaluationStatus === 'pending') return { state: 'pending', lastConfirmed }
  return { state: 'unavailable', lastConfirmed }
}
