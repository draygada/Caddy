import type {
  CadAssemblyInstance,
  CadAssemblyMate,
  CadBody,
  CadDocument,
  CadOperation,
  CadParameter,
  CadSketch,
  FeatureOperation,
  SketchEntity,
} from './types';

export interface HardenedDronePart {
  partNumber: string;
  bodyId: string;
  name: string;
  quantity: number;
  slot: string;
  material: string;
  boundary: string;
}

export interface HardenedDroneFixture {
  document: CadDocument;
  operation: CadOperation;
  frameSpanMm: number;
}

export const HARDENED_DRONE_BENCHMARK = {
  id: 'benchmark:qx-0-bench-quad-v1',
  name: 'QX-0 Bench Quad',
  version: '1.0.0',
  defaultFrameSpanMm: 260,
  expandedFrameSpanMm: 300,
  bodyDefinitions: 12,
  bomLines: 12,
  physicalInstances: 25,
  mates: 24,
  claimCeiling: 'Synthetic non-flight-capable geometry benchmark. Not a flightworthy design, manufacturing release, legal classification, or permission to build or operate an aircraft.',
} as const;

const MATERIAL = 'Synthetic benchmark polymer (metadata only)';

export const HARDENED_DRONE_PARTS: readonly HardenedDronePart[] = [
  { partNumber: 'QX0-100', bodyId: 'body:frame', name: 'Cross frame', quantity: 1, slot: 'airframe', material: MATERIAL, boundary: 'Inert structural envelope' },
  { partNumber: 'QX0-110', bodyId: 'body:deck', name: 'Perforated deck', quantity: 1, slot: 'airframe', material: MATERIAL, boundary: 'Inert structural envelope' },
  { partNumber: 'QX0-120', bodyId: 'body:guard', name: 'Guard ring', quantity: 4, slot: 'airframe', material: MATERIAL, boundary: 'Inert perimeter geometry' },
  { partNumber: 'QX0-200', bodyId: 'body:puck', name: 'Dummy rotor puck', quantity: 4, slot: 'motor', material: MATERIAL, boundary: 'Solid placeholder; no propulsion geometry' },
  { partNumber: 'QX0-210', bodyId: 'body:esc', name: 'ESC envelope', quantity: 4, slot: 'ESC', material: MATERIAL, boundary: 'Envelope only; no circuitry or control logic' },
  { partNumber: 'QX0-300', bodyId: 'body:standoff', name: 'Deck standoff', quantity: 4, slot: 'harness/connectors/fasteners/passives', material: MATERIAL, boundary: 'Inert fastener proxy' },
  { partNumber: 'QX0-400', bodyId: 'body:canopy', name: 'Bench canopy', quantity: 1, slot: 'airframe', material: MATERIAL, boundary: 'Inert enclosure geometry' },
  { partNumber: 'QX0-410', bodyId: 'body:rail', name: 'Landing rail', quantity: 2, slot: 'airframe', material: MATERIAL, boundary: 'Bench support only' },
  { partNumber: 'QX0-500', bodyId: 'body:battery', name: 'Battery envelope', quantity: 1, slot: 'battery', material: MATERIAL, boundary: 'Envelope only; no electrical specification' },
  { partNumber: 'QX0-600', bodyId: 'body:controller', name: 'Controller envelope', quantity: 1, slot: 'flight-controller PCBA', material: MATERIAL, boundary: 'Envelope only; no electronics or firmware' },
  { partNumber: 'QX0-700', bodyId: 'body:sensor', name: 'Sensor pod proxy', quantity: 1, slot: 'sensor pod / thermal core', material: MATERIAL, boundary: 'Solid placeholder; no sensing capability' },
  { partNumber: 'QX0-800', bodyId: 'body:mast', name: 'GNSS / datalink mast proxy', quantity: 1, slot: 'GNSS / datalink', material: MATERIAL, boundary: 'Solid placeholder; no radio capability' },
];

export function hardenedDroneBomCsv(): string {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = HARDENED_DRONE_PARTS.map((part) => [part.partNumber, part.name, part.quantity, part.slot, part.material, part.boundary].map(escape).join(','));
  return ['part_number,name,quantity,slot,material,boundary', ...rows].join('\n') + '\n';
}

function rectangle(id: string, origin: [number, number], width: number, height: number): SketchEntity {
  return { id, kind: 'rectangle', construction: false, origin: { x: origin[0], y: origin[1] }, width, height };
}

function circle(id: string, center: [number, number], radius: number): SketchEntity {
  return { id, kind: 'circle', construction: false, center: { x: center[0], y: center[1] }, radius };
}

function line(id: string, start: [number, number], end: [number, number]): SketchEntity {
  return { id, kind: 'line', construction: false, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] } };
}

function sketch(
  id: string,
  name: string,
  plane: 'XY' | 'XZ' | 'YZ',
  entities: SketchEntity[],
  drivingIntent?: { entityId: string; value: number; expression: string },
): CadSketch {
  return {
    id,
    name,
    plane: { kind: 'origin', plane },
    entities,
    dimensions: drivingIntent ? [{ id: `dimension:${id}`, kind: 'distance', entityIds: [drivingIntent.entityId], value: drivingIntent.value, expression: drivingIntent.expression, unit: 'mm' }] : [],
    constraints: drivingIntent ? [{ id: `constraint:${id}`, kind: 'fixed', entityIds: [drivingIntent.entityId] }] : [],
    solverState: drivingIntent ? 'under-constrained' : 'unresolved',
  };
}

function feature(
  id: string,
  kind: FeatureOperation['kind'],
  name: string,
  inputIds: string[],
  targetBodyIds: string[],
  outputBodyName: string | null,
  parameters: FeatureOperation['parameters'],
): FeatureOperation {
  return { id, kind, name, dependsOn: [...new Set([...inputIds, ...targetBodyIds])], suppressed: false, inputIds, targetBodyIds, outputBodyName, parameters };
}

function body(id: string, name: string, featureIds: string[]): CadBody {
  return { id, name, featureIds, material: MATERIAL, visible: true, state: 'draft' };
}

function instance(
  id: string,
  name: string,
  bodyId: string,
  translation: [number, number, number],
  rotationDegrees: [number, number, number] = [0, 0, 0],
  grounded = false,
): CadAssemblyInstance {
  return { id, name, bodyId, grounded, transform: { translation, rotationDegrees } };
}

function mate(
  id: string,
  name: string,
  kind: CadAssemblyMate['kind'],
  instanceAId: string,
  instanceBId: string,
  offset = 0,
): CadAssemblyMate {
  return { id, name, kind, instanceAId, instanceBId, referenceA: 'origin', referenceB: 'origin', offset, unit: kind === 'angle' ? 'deg' : 'mm' };
}

function parameter(id: string, name: string, expression: string, unit: CadParameter['unit'], resolvedValue: number): CadParameter {
  return { id, name, expression, unit, resolvedValue };
}

export function createHardenedDroneFixture(options: { frameSpanMm?: number } = {}): HardenedDroneFixture {
  const frameSpanMm = options.frameSpanMm ?? HARDENED_DRONE_BENCHMARK.defaultFrameSpanMm;
  if (!Number.isFinite(frameSpanMm) || frameSpanMm < 180 || frameSpanMm > 420) throw new Error('QX-0 frame span must be a finite bench-scale value from 180 mm through 420 mm.');
  const halfSpan = frameSpanMm / 2;
  const station = halfSpan - 15;
  const escStation = Math.round(station * 0.58 * 1000) / 1000;

  const parameters = [
    parameter('parameter:frame-span', 'frame_span', `${frameSpanMm} mm`, 'mm', frameSpanMm),
    parameter('parameter:deck-clearance', 'deck_clearance', '10 mm', 'mm', 10),
    parameter('parameter:guard-diameter', 'guard_diameter', '48 mm', 'mm', 48),
    parameter('parameter:fixture-scale', 'fixture_scale', '1', 'unitless', 1),
  ];

  const sketches: CadSketch[] = [
    sketch('sketch:frame', 'Cross frame profile', 'XY', [
      rectangle('entity:frame-x', [-halfSpan, -15], frameSpanMm, 30),
      rectangle('entity:frame-y', [-15, -halfSpan], 30, frameSpanMm),
    ], { entityId: 'entity:frame-x', value: frameSpanMm, expression: 'frame_span' }),
    sketch('sketch:deck', 'Deck profile', 'XY', [rectangle('entity:deck', [-25, -25], 50, 50)]),
    sketch('sketch:deck-holes', 'Deck hole pattern', 'XY', [
      circle('entity:deck-hole-ne', [15, 15], 3), circle('entity:deck-hole-nw', [-15, 15], 3),
      circle('entity:deck-hole-se', [15, -15], 3), circle('entity:deck-hole-sw', [-15, -15], 3),
    ]),
    sketch('sketch:guard-outer', 'Guard outer profile', 'XY', [circle('entity:guard-outer', [0, 0], 24)]),
    sketch('sketch:guard-inner', 'Guard opening', 'XY', [circle('entity:guard-inner', [0, 0], 18)]),
    sketch('sketch:puck', 'Dummy rotor puck profile', 'XY', [circle('entity:puck', [0, 0], 12)]),
    sketch('sketch:esc', 'ESC envelope profile', 'XY', [rectangle('entity:esc', [-14, -6], 28, 12)]),
    sketch('sketch:standoff', 'Standoff profile', 'XY', [circle('entity:standoff', [0, 0], 2.5)]),
    sketch('sketch:canopy', 'Canopy revolve section', 'XY', [
      line('entity:canopy-1', [0, 0], [20, 0]), line('entity:canopy-2', [20, 0], [20, 4]),
      line('entity:canopy-3', [20, 4], [8, 12]), line('entity:canopy-4', [8, 12], [0, 12]),
      line('entity:canopy-5', [0, 12], [0, 0]),
    ]),
    sketch('sketch:rail', 'Landing rail profile', 'XZ', [rectangle('entity:rail', [-55, -3], 110, 6)]),
    sketch('sketch:battery', 'Battery envelope profile', 'XY', [rectangle('entity:battery', [-24, -14], 48, 28)]),
    sketch('sketch:controller', 'Controller envelope profile', 'XY', [rectangle('entity:controller', [-17, -17], 34, 34)]),
    sketch('sketch:sensor', 'Sensor pod proxy profile', 'YZ', [{ id: 'entity:sensor', kind: 'spline', construction: false, closed: true, points: [{ x: -12, y: -8 }, { x: 12, y: -8 }, { x: 12, y: 3 }, { x: 0, y: 9 }, { x: -12, y: 3 }] }]),
    sketch('sketch:mast', 'GNSS datalink mast profile', 'XY', [circle('entity:mast', [0, 0], 2)]),
  ];

  const features: FeatureOperation[] = [
    feature('operation:frame-extrude', 'feature.extrude', 'Extrude cross frame', ['sketch:frame'], [], 'Cross frame', { distance: 5, unit: 'mm' }),
    feature('operation:deck-extrude', 'feature.extrude', 'Extrude deck', ['sketch:deck'], [], 'Perforated deck', { distance: 8, unit: 'mm' }),
    feature('operation:deck-hole', 'feature.hole', 'Cut deck hole pattern', ['sketch:deck-holes'], ['body:deck'], null, { radius: 3, unit: 'mm' }),
    feature('operation:guard-extrude', 'feature.extrude', 'Extrude guard outer', ['sketch:guard-outer'], [], 'Guard ring', { distance: 4, unit: 'mm' }),
    feature('operation:guard-hole', 'feature.hole', 'Cut guard opening', ['sketch:guard-inner'], ['body:guard'], null, { radius: 18, unit: 'mm' }),
    feature('operation:puck-extrude', 'feature.extrude', 'Extrude dummy rotor puck', ['sketch:puck'], [], 'Dummy rotor puck', { distance: 6, unit: 'mm' }),
    feature('operation:esc-extrude', 'feature.extrude', 'Extrude ESC envelope', ['sketch:esc'], [], 'ESC envelope', { distance: 4, unit: 'mm' }),
    feature('operation:standoff-extrude', 'feature.extrude', 'Extrude standoff', ['sketch:standoff'], [], 'Deck standoff', { distance: 10, unit: 'mm' }),
    feature('operation:canopy-revolve', 'feature.revolve', 'Revolve canopy', ['sketch:canopy'], [], 'Bench canopy', { angle: 360, unit: 'deg' }),
    feature('operation:rail-extrude', 'feature.extrude', 'Extrude landing rail', ['sketch:rail'], [], 'Landing rail', { distance: 4, unit: 'mm' }),
    feature('operation:battery-extrude', 'feature.extrude', 'Extrude battery envelope', ['sketch:battery'], [], 'Battery envelope', { distance: 16, unit: 'mm' }),
    feature('operation:controller-extrude', 'feature.extrude', 'Extrude controller envelope', ['sketch:controller'], [], 'Controller envelope', { distance: 6, unit: 'mm' }),
    feature('operation:sensor-extrude', 'feature.extrude', 'Extrude sensor pod proxy', ['sketch:sensor'], [], 'Sensor pod proxy', { distance: 18, unit: 'mm' }),
    feature('operation:mast-extrude', 'feature.extrude', 'Extrude GNSS datalink mast proxy', ['sketch:mast'], [], 'GNSS datalink mast proxy', { distance: 32, unit: 'mm' }),
  ];

  const bodies: CadBody[] = [
    body('body:frame', 'Cross frame', ['operation:frame-extrude']),
    body('body:deck', 'Perforated deck', ['operation:deck-extrude', 'operation:deck-hole']),
    body('body:guard', 'Guard ring', ['operation:guard-extrude', 'operation:guard-hole']),
    body('body:puck', 'Dummy rotor puck', ['operation:puck-extrude']),
    body('body:esc', 'ESC envelope', ['operation:esc-extrude']),
    body('body:standoff', 'Deck standoff', ['operation:standoff-extrude']),
    body('body:canopy', 'Bench canopy', ['operation:canopy-revolve']),
    body('body:rail', 'Landing rail', ['operation:rail-extrude']),
    body('body:battery', 'Battery envelope', ['operation:battery-extrude']),
    body('body:controller', 'Controller envelope', ['operation:controller-extrude']),
    body('body:sensor', 'Sensor pod proxy', ['operation:sensor-extrude']),
    body('body:mast', 'GNSS datalink mast proxy', ['operation:mast-extrude']),
  ];

  const instances: CadAssemblyInstance[] = [
    instance('instance:frame', 'Cross frame', 'body:frame', [0, 0, 0], [0, 0, 0], true),
    instance('instance:deck', 'Perforated deck', 'body:deck', [0, 0, 10]),
    instance('instance:guard-east', 'Guard east', 'body:guard', [station, 0, 5]),
    instance('instance:guard-west', 'Guard west', 'body:guard', [-station, 0, 5]),
    instance('instance:guard-north', 'Guard north', 'body:guard', [0, station, 5]),
    instance('instance:guard-south', 'Guard south', 'body:guard', [0, -station, 5]),
    instance('instance:puck-east', 'Dummy rotor puck east', 'body:puck', [station, 0, 9]),
    instance('instance:puck-west', 'Dummy rotor puck west', 'body:puck', [-station, 0, 9]),
    instance('instance:puck-north', 'Dummy rotor puck north', 'body:puck', [0, station, 9]),
    instance('instance:puck-south', 'Dummy rotor puck south', 'body:puck', [0, -station, 9]),
    instance('instance:esc-east', 'ESC envelope east', 'body:esc', [escStation, 0, 6]),
    instance('instance:esc-west', 'ESC envelope west', 'body:esc', [-escStation, 0, 6], [0, 0, 180]),
    instance('instance:esc-north', 'ESC envelope north', 'body:esc', [0, escStation, 6], [0, 0, 90]),
    instance('instance:esc-south', 'ESC envelope south', 'body:esc', [0, -escStation, 6], [0, 0, -90]),
    instance('instance:standoff-ne', 'Deck standoff NE', 'body:standoff', [18, 18, 5]),
    instance('instance:standoff-nw', 'Deck standoff NW', 'body:standoff', [-18, 18, 5]),
    instance('instance:standoff-se', 'Deck standoff SE', 'body:standoff', [18, -18, 5]),
    instance('instance:standoff-sw', 'Deck standoff SW', 'body:standoff', [-18, -18, 5]),
    instance('instance:canopy', 'Bench canopy', 'body:canopy', [0, 0, 18]),
    instance('instance:rail-port', 'Landing rail port', 'body:rail', [0, -32, -5]),
    instance('instance:rail-starboard', 'Landing rail starboard', 'body:rail', [0, 28, -5]),
    instance('instance:battery', 'Battery envelope', 'body:battery', [0, -7, 14]),
    instance('instance:controller', 'Controller envelope', 'body:controller', [0, 8, 30]),
    instance('instance:sensor', 'Sensor pod proxy', 'body:sensor', [0, -39, 12]),
    instance('instance:mast', 'GNSS datalink mast proxy', 'body:mast', [0, 28, 18]),
  ];

  const mates: CadAssemblyMate[] = [
    mate('mate:deck-frame', 'Deck height from frame', 'distance', 'instance:frame', 'instance:deck', 10),
    ...(['east', 'west', 'north', 'south'] as const).map((side) => mate(`mate:guard-${side}-frame`, `Guard ${side} to frame`, 'fixed', 'instance:frame', `instance:guard-${side}`)),
    ...(['east', 'west', 'north', 'south'] as const).map((side) => mate(`mate:puck-${side}-guard`, `Puck ${side} concentric to guard`, 'concentric', `instance:guard-${side}`, `instance:puck-${side}`)),
    ...(['east', 'west', 'north', 'south'] as const).map((side) => mate(`mate:esc-${side}-frame`, `ESC ${side} to frame`, 'fixed', 'instance:frame', `instance:esc-${side}`)),
    ...(['ne', 'nw', 'se', 'sw'] as const).map((side) => mate(`mate:standoff-${side}-deck`, `Standoff ${side} to deck`, 'fixed', 'instance:deck', `instance:standoff-${side}`)),
    mate('mate:canopy-deck', 'Canopy to deck', 'coincident', 'instance:deck', 'instance:canopy'),
    mate('mate:rail-port-frame', 'Port rail to frame', 'fixed', 'instance:frame', 'instance:rail-port'),
    mate('mate:rail-starboard-frame', 'Starboard rail to frame', 'fixed', 'instance:frame', 'instance:rail-starboard'),
    mate('mate:battery-deck', 'Battery envelope to deck', 'fixed', 'instance:deck', 'instance:battery'),
    mate('mate:controller-deck', 'Controller clearance from deck', 'distance', 'instance:deck', 'instance:controller', 12),
    mate('mate:sensor-deck', 'Sensor pod presentation angle', 'angle', 'instance:deck', 'instance:sensor', -12),
    mate('mate:mast-deck', 'Mast origin to deck', 'coincident', 'instance:deck', 'instance:mast'),
  ];

  const operations: CadOperation[] = [
    ...parameters.map((item) => ({ id: `operation:${item.id}`, kind: 'parameter.set' as const, name: `Set ${item.name}`, dependsOn: [], suppressed: false, parameter: item })),
    ...sketches.map((item) => ({ id: `operation:${item.id}`, kind: 'sketch.create' as const, name: `Create ${item.name}`, dependsOn: [], suppressed: false, sketch: item })),
    ...features,
    ...instances.map((item) => ({ id: `operation:${item.id}`, kind: 'assembly.instance.add' as const, name: `Insert ${item.name}`, dependsOn: [item.bodyId], suppressed: false, instance: item })),
    ...mates.map((item) => ({ id: `operation:${item.id}`, kind: 'assembly.mate.add' as const, name: `Mate ${item.name}`, dependsOn: [item.instanceAId, item.instanceBId], suppressed: false, mate: item })),
  ];
  const operation = operations[operations.length - 1];
  if (!operation) throw new Error('QX-0 benchmark operation sequence is empty.');

  return {
    frameSpanMm,
    operation,
    document: {
      schemaVersion: 'caddydaddy.cad-document/1',
      id: 'document:qx-0-bench-quad-v1',
      name: `QX-0 Bench Quad - ${frameSpanMm} mm frame`,
      revisionId: 'revision:new',
      units: { length: 'mm', angle: 'deg' },
      parameters,
      sketches,
      operations,
      bodies,
      assembly: { instances, mates },
    },
  };
}
