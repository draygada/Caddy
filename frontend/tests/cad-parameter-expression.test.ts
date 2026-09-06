import { describe, expect, it } from 'vitest';
import {
  applyCadIntent,
  cadAuthoringReducer,
  createCadAuthoringState,
  createCadDocument,
  createFeatureOperation,
  createParameterOperation,
  createSketchOperation,
  validateBoundedParameterExpression,
  type CadParameter,
  type CadSketch,
  type ParameterSetOperation,
} from '../src/cad';
import { BrowserCadError, recomputeCadInBrowser } from '../src/cad/browser-kernel';

const profile: CadSketch = {
  id: 'sketch:parameter-plate',
  name: 'Parameter plate',
  plane: { kind: 'origin', plane: 'XY' },
  entities: [{ id: 'entity:parameter-rectangle', kind: 'rectangle', construction: false, origin: { x: 0, y: 0 }, width: 20, height: 10 }],
  dimensions: [],
  constraints: [],
  solverState: 'unresolved',
};

function parameter(expression: string, unit: CadParameter['unit'] = 'mm'): CadParameter {
  return { id: 'parameter:wall-height', name: 'wall_height', expression, unit, resolvedValue: null };
}

async function oneBodyDocument() {
  const base = createCadDocument('Parameter validation', 'document:parameter-validation');
  const sketch = createSketchOperation(profile, 'operation:parameter-sketch');
  const sketchResponse = await recomputeCadInBrowser({ document: applyCadIntent(base, sketch), operation: sketch, expectedRevisionId: base.revisionId });
  const extrude = createFeatureOperation({ id: 'operation:parameter-extrude', kind: 'feature.extrude', name: 'Extrude plate', inputIds: [profile.id], outputBodyName: 'Plate', parameters: { distance: 5 } });
  return recomputeCadInBrowser({ document: applyCadIntent(sketchResponse.document, extrude), operation: extrude, expectedRevisionId: sketchResponse.revisionId });
}

describe('bounded browser parameter expressions', () => {
  it('accepts finite literals only when their optional unit matches the declared unit', () => {
    expect(validateBoundedParameterExpression(parameter('18 mm'))).toBe(18);
    expect(validateBoundedParameterExpression(parameter('-1.25e2 deg', 'deg'))).toBe(-125);
    expect(validateBoundedParameterExpression(parameter('0.5', 'unitless'))).toBe(0.5);
    expect(() => createParameterOperation(parameter('not-a-dimensional-value'))).toThrow(/finite numeric literal/);
    expect(() => createParameterOperation(parameter('wall_height = 18 mm'))).toThrow(/formulas and assignments/);
    expect(() => createParameterOperation(parameter('18 deg'))).toThrow(/does not match declared unit mm/);
  });

  it('rejects an invalid direct-kernel operation without advancing the last-valid revision or mesh', async () => {
    const baseline = await oneBodyDocument();
    const validOperation = createParameterOperation(parameter('18 mm'), 'operation:valid-parameter');
    const validResponse = await recomputeCadInBrowser({
      document: applyCadIntent(baseline.document, validOperation),
      operation: validOperation,
      expectedRevisionId: baseline.revisionId,
    });
    expect(validResponse.document.parameters[0]).toMatchObject({ name: 'wall_height', expression: '18 mm' });

    const invalidOperation: ParameterSetOperation = {
      ...validOperation,
      id: 'operation:invalid-parameter',
      name: 'Set invalid wall_height',
      parameter: parameter('not-a-dimensional-value'),
    };
    let state = createCadAuthoringState(validResponse.document);
    state = { ...state, lastValidMesh: validResponse.mesh, dependencyGraph: validResponse.dependencyGraph, diagnostics: validResponse.diagnostics, kernel: validResponse.kernel };
    const acceptedDocument = state.lastValidDocument;
    const acceptedMesh = state.lastValidMesh;
    state = cadAuthoringReducer(state, { type: 'stage', operation: invalidOperation, requestId: 'request:invalid' });
    state = cadAuthoringReducer(state, { type: 'started', requestId: 'request:invalid' });

    let failure: BrowserCadError | null = null;
    try {
      await recomputeCadInBrowser({ document: applyCadIntent(acceptedDocument, invalidOperation), operation: invalidOperation, expectedRevisionId: acceptedDocument.revisionId });
    } catch (error) {
      failure = error as BrowserCadError;
    }
    expect(failure).toMatchObject({ code: 'BROWSER_CAD_INVALID' });
    expect(failure?.diagnostics).toEqual([expect.objectContaining({ code: 'PARAMETER_EXPRESSION_INVALID', operationId: invalidOperation.id })]);
    state = cadAuthoringReducer(state, { type: 'failed', requestId: 'request:invalid', error: failure!.message, diagnostics: failure!.diagnostics });

    expect(state.status).toBe('failed');
    expect(state.lastValidDocument).toBe(acceptedDocument);
    expect(state.lastValidDocument.revisionId).toBe(validResponse.revisionId);
    expect(state.lastValidMesh).toBe(acceptedMesh);
    expect(state.history.at(-1)).toMatchObject({ status: 'failed', revisionId: validResponse.revisionId });
  });
});
