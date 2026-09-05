// The replayable design state. Every timeline event carries the Snapshot that
// resulted from it, so dragging the timeline marker to seq N shows exactly the
// state at N without deleting anything: undo is supersede.
import type { Dims, Feature, Slot } from './catalog';
import type { Attrs, Parts } from './rules';

export interface Pos { x: number; y: number }
export type Positions = Record<Slot, Pos>;

/** Plate geometry parameters driven by the feature dialogs. */
export interface Geo {
  /** corner fillet radius on the base plate, m (0 = none) */
  fillet: number;
  /** corner chamfer on the base plate, m (0 = none; fillet wins when both set) */
  chamfer: number;
  /** plate hole diameter, m */
  holeD: number;
}
export const GEO0: Geo = { fillet: 0, chamfer: 0, holeD: 0.14 };

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
}
