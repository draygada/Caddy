import type { PartId } from './catalog';
// The replayable design state. Every timeline event carries the Snapshot that
// resulted from it, so dragging the timeline marker to seq N shows exactly the
// state at N without deleting anything: undo is supersede.
import type { Declared, Dims, Feature, Slot } from './catalog';
import type { Attrs, Parts } from './rules';

/** plate coordinates in metres; z is the standoff above the plate top, 0 when omitted */
export interface Pos { x: number; y: number; z?: number }
export type Positions = Record<Slot, Pos>;

/** Plate geometry parameters driven by the feature dialogs. */
export interface Geo {
  /** what the airframe body is: a mounting plate (Kestrel) or a frame kit the parts bolt onto (Merlin). Missing means plate. */
  kind?: 'plate' | 'frame';
  /** the frame kit part when kind is frame; it is the airframe, not a slot */
  frame?: PartId;
  /** plate length along X, m: the sensor-bay bracket, not the wing span */
  plateL: number;
  /** plate width along Y, m */
  plateW: number;
  /** extrusion depth of the committed plate profile, m */
  plateT: number;
  /** corner fillet radius on the base plate, m (0 = none) */
  fillet: number;
  /** corner chamfer on the base plate, m (0 = none; fillet wins when both set) */
  chamfer: number;
  /** plate hole diameter, m */
  holeD: number;
}
/** Kestrel plate: 460 x 300 x 6 mm, four 6.5 mm clearance holes. */
export const GEO0: Geo = { plateL: 0.46, plateW: 0.3, plateT: 0.006, fillet: 0, chamfer: 0, holeD: 0.0065 };

export interface Snapshot {
  parts: Parts;
  attrs: Attrs;
  pos: Positions;
  span: number;
  dims: Dims;
  features: Feature[];
  geo: Geo;
  /** active sketch constraints by id */
  sketch: Record<string, boolean>;
  tint: Partial<Record<Slot, string>>;
  /** swaps awaiting a human attestation: slot → seq of the part_swapped event */
  unconfirmed: Partial<Record<Slot, number>>;
  /** declared facts, product-level and per node */
  declared: Declared;
}
