import type {
  AssemblyInstanceOperation,
  AssemblyMateOperation,
  CadAssemblyInstance,
  CadAssemblyMate,
  CadDocument,
  CadFeatureKind,
  CadOperation,
  CadParameter,
  CadSketch,
  FeatureOperation,
  ParameterSetOperation,
  SketchCreateOperation,
} from './types';

let nextId = 0;

export function cadId(prefix: string): string {
  nextId += 1;
  return `${prefix}:${Date.now().toString(36)}-${nextId.toString(36)}`;
}

export function createCadDocument(name = 'Untitled assembly', id = cadId('document')): CadDocument {
  return {
    schemaVersion: 'caddydaddy.cad-document/1',
    id,
    name,
    revisionId: 'revision:new',
    units: { length: 'mm', angle: 'deg' },
    parameters: [],
    sketches: [],
    operations: [],
    bodies: [],
    assembly: { instances: [], mates: [] },
  };
}

function ensureUnique(items: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id.trim()) throw new Error(`${label} IDs cannot be empty.`);
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} ID: ${item.id}`);
    ids.add(item.id);
  }
}

export function validateSketch(sketch: CadSketch): CadSketch {
  if (!sketch.name.trim()) throw new Error('Sketch name is required.');
  if (sketch.plane.kind === 'face' && !sketch.plane.entityId.trim()) throw new Error('A face sketch requires an entity reference.');
  if (sketch.entities.length === 0) throw new Error('A sketch needs at least one entity.');
  ensureUnique(sketch.entities, 'sketch entity');
  ensureUnique(sketch.dimensions, 'dimension');
  ensureUnique(sketch.constraints, 'constraint');
  const entityIds = new Set(sketch.entities.map((entity) => entity.id));
  for (const dimension of sketch.dimensions) {
    if (dimension.entityIds.some((id) => !entityIds.has(id))) throw new Error(`Dimension ${dimension.id} references a missing entity.`);
  }
  for (const constraint of sketch.constraints) {
    if (constraint.entityIds.some((id) => !entityIds.has(id))) throw new Error(`Constraint ${constraint.id} references a missing entity.`);
  }
  return sketch;
}

export function createSketchOperation(sketch: CadSketch, id = cadId('operation')): SketchCreateOperation {
  return {
    id,
    kind: 'sketch.create',
    name: `Create ${sketch.name}`,
    dependsOn: sketch.plane.kind === 'face' ? [sketch.plane.entityId] : [],
    suppressed: false,
    sketch: validateSketch(sketch),
  };
}

export interface FeatureOperationInput {
  kind: CadFeatureKind;
  name: string;
  inputIds: string[];
  targetBodyIds?: string[];
  outputBodyName?: string | null;
  parameters: Record<string, string | number | boolean>;
  id?: string;
}

export function createFeatureOperation(input: FeatureOperationInput): FeatureOperation {
  if (!input.name.trim()) throw new Error('Feature name is required.');
  if (input.inputIds.length === 0) throw new Error(`${input.kind} needs at least one input reference.`);
  return {
    id: input.id ?? cadId('operation'),
    kind: input.kind,
    name: input.name.trim(),
    dependsOn: [...new Set([...input.inputIds, ...(input.targetBodyIds ?? [])])],
    suppressed: false,
    inputIds: [...input.inputIds],
    targetBodyIds: [...(input.targetBodyIds ?? [])],
    outputBodyName: input.outputBodyName?.trim() || null,
    parameters: { ...input.parameters },
  };
}

const BOUNDED_PARAMETER_LITERAL = /^([+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?))(?:\s*(mm|cm|m|in|deg|rad))?$/;

export function validateBoundedParameterExpression(parameter: CadParameter): number {
  const expression = parameter.expression.trim();
  const match = BOUNDED_PARAMETER_LITERAL.exec(expression);
  if (!match) {
    throw new Error(`Parameter ${parameter.name} requires a finite numeric literal with an optional declared unit; formulas and assignments are not evaluated in bounded browser mode.`);
  }
  const value = Number(match[1]);
  const expressionUnit = match[2];
  if (!Number.isFinite(value)) throw new Error(`Parameter ${parameter.name} requires a finite numeric literal.`);
  if ((parameter.unit === 'unitless' && expressionUnit) || (expressionUnit && expressionUnit !== parameter.unit)) {
    throw new Error(`Parameter ${parameter.name} expression unit ${expressionUnit} does not match declared unit ${parameter.unit}.`);
  }
  return value;
}

export function createParameterOperation(parameter: CadParameter, id = cadId('operation')): ParameterSetOperation {
  if (!parameter.name.trim() || !parameter.expression.trim()) throw new Error('Parameter name and expression are required.');
  validateBoundedParameterExpression(parameter);
  return {
    id,
    kind: 'parameter.set',
    name: `Set ${parameter.name}`,
    dependsOn: [],
    suppressed: false,
    parameter: { ...parameter },
  };
}

export function createInstanceOperation(instance: CadAssemblyInstance, id = cadId('operation')): AssemblyInstanceOperation {
  if (!instance.name.trim() || !instance.bodyId.trim()) throw new Error('Assembly instances require a name and body.');
  return {
    id,
    kind: 'assembly.instance.add',
    name: `Insert ${instance.name}`,
    dependsOn: [instance.bodyId],
    suppressed: false,
    instance: { ...instance },
  };
}

export function createMateOperation(mate: CadAssemblyMate, id = cadId('operation')): AssemblyMateOperation {
  if (!mate.instanceAId || !mate.instanceBId || mate.instanceAId === mate.instanceBId) {
    throw new Error('A mate requires two different assembly instances.');
  }
  return {
    id,
    kind: 'assembly.mate.add',
    name: `Mate ${mate.name}`,
    dependsOn: [mate.instanceAId, mate.instanceBId],
    suppressed: false,
    mate: { ...mate },
  };
}

export function applyCadIntent(document: CadDocument, operation: CadOperation): CadDocument {
  const next: CadDocument = {
    ...document,
    parameters: [...document.parameters],
    sketches: [...document.sketches],
    operations: [...document.operations, operation],
    bodies: document.bodies.map((body) => ({ ...body, featureIds: [...body.featureIds] })),
    assembly: {
      instances: [...document.assembly.instances],
      mates: [...document.assembly.mates],
    },
  };

  if (operation.kind === 'sketch.create') next.sketches.push(operation.sketch);
  if (operation.kind === 'parameter.set') {
    const index = next.parameters.findIndex((item) => item.id === operation.parameter.id || item.name === operation.parameter.name);
    if (index >= 0) next.parameters[index] = operation.parameter;
    else next.parameters.push(operation.parameter);
  }
  if (operation.kind === 'assembly.instance.add') next.assembly.instances.push(operation.instance);
  if (operation.kind === 'assembly.mate.add') next.assembly.mates.push(operation.mate);
  if (operation.kind.startsWith('feature.')) {
    const feature = operation as FeatureOperation;
    for (const bodyId of feature.targetBodyIds) {
      const body = next.bodies.find((item) => item.id === bodyId);
      if (body) body.featureIds.push(feature.id);
    }
    if (feature.outputBodyName) {
      next.bodies.push({
        id: cadId('body'),
        name: feature.outputBodyName,
        featureIds: [feature.id],
        material: null,
        visible: true,
        state: 'draft',
      });
    }
  }
  return next;
}
