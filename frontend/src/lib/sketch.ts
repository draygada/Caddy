// Sketch constraint model for the plate profile. A stand-in for the kernel's
// solver that produces the contract's state vocabulary with stable codes:
// UNDER_CONSTRAINED | SOLVED | REDUNDANT | CONTRADICTORY, plus degrees of freedom.
export type ConstraintState = 'SOLVED' | 'UNDER_CONSTRAINED' | 'REDUNDANT' | 'CONTRADICTORY';
export type SketchEntity = 'rect' | 'holes';

export interface ConstraintDef {
  id: string;
  label: string;
  entity: SketchEntity;
  kind: 'dimension' | 'geometric';
  /** glyph drawn beside the entity when active */
  glyph: string;
  /** removes this many degrees of freedom when active */
  dof: number;
  role: 'required' | 'redundant' | 'contradictory';
}

export const CONSTRAINTS: ConstraintDef[] = [
  { id: 'horizontal', label: 'edges horizontal / vertical', entity: 'rect', kind: 'geometric', glyph: '⊥', dof: 2, role: 'required' },
  { id: 'dim_span', label: 'span dimension · drives L', entity: 'rect', kind: 'dimension', glyph: '↔', dof: 1, role: 'required' },
  { id: 'dim_width', label: 'width dimension · 1.2 m', entity: 'rect', kind: 'dimension', glyph: '↕', dof: 1, role: 'required' },
  { id: 'holes_symmetric', label: 'holes symmetric about both centre lines', entity: 'holes', kind: 'geometric', glyph: '⇔', dof: 6, role: 'required' },
  { id: 'dim_holeD', label: 'hole diameter · ⌀', entity: 'holes', kind: 'dimension', glyph: '⌀', dof: 1, role: 'required' },
  { id: 'hole_inset_x', label: 'hole inset from plate end · 0.25 m', entity: 'holes', kind: 'dimension', glyph: '↦', dof: 1, role: 'required' },
  { id: 'hole_inset_y', label: 'hole inset from plate edge · 0.20 m', entity: 'holes', kind: 'dimension', glyph: '↥', dof: 1, role: 'required' },
  { id: 'dim_span_dup', label: 'a second span dimension · same value', entity: 'rect', kind: 'dimension', glyph: '↔', dof: 0, role: 'redundant' },
  { id: 'holes_equal', label: 'holes equal diameter · already implied by symmetry', entity: 'holes', kind: 'geometric', glyph: '=', dof: 0, role: 'redundant' },
  { id: 'dim_span_conflict', label: 'span dimension · 2.0 m while the driving span differs', entity: 'rect', kind: 'dimension', glyph: '↔', dof: 0, role: 'contradictory' },
  { id: 'hole_big', label: 'hole diameter · 0.60 m, crosses the plate edge', entity: 'holes', kind: 'dimension', glyph: '⌀', dof: 0, role: 'contradictory' },
];

/** rect: 4 DOF (two corners, anchored at origin leaves L, W, and two edge angles); holes: 4 × (x, y, d) = 12 → symmetry shares them. */
const TOTAL_DOF: Record<SketchEntity, number> = { rect: 4, holes: 9 };

export const SKETCH_DEFAULT: Record<string, boolean> = Object.fromEntries(CONSTRAINTS.map((c) => [c.id, c.role === 'required' && c.id !== 'hole_inset_y']));

export interface EntityResult { state: ConstraintState; dof: number; code: string; guidance: string; implicated: string[] }
export interface SketchResult { entities: Record<SketchEntity, EntityResult>; overall: ConstraintState; dof: number }

export function solveSketch(active: Record<string, boolean>): SketchResult {
  const entities = {} as Record<SketchEntity, EntityResult>;
  for (const e of ['rect', 'holes'] as SketchEntity[]) {
    const mine = CONSTRAINTS.filter((c) => c.entity === e);
    const on = mine.filter((c) => active[c.id]);
    const contradictory = on.filter((c) => c.role === 'contradictory');
    const redundant = on.filter((c) => c.role === 'redundant');
    const missing = mine.filter((c) => c.role === 'required' && !active[c.id]);
    const dof = Math.max(0, TOTAL_DOF[e] - on.filter((c) => c.role === 'required').reduce((s, c) => s + c.dof, 0));
    let r: EntityResult;
    if (contradictory.length) r = { state: 'CONTRADICTORY', dof, code: 'SK-CON-' + (e === 'rect' ? '01' : '02'), guidance: 'two constraints cannot both hold: ' + contradictory.map((c) => c.label).join('; ') + '. Remove one; nothing is solved while they conflict.', implicated: contradictory.map((c) => c.id) };
    else if (redundant.length) r = { state: 'REDUNDANT', dof, code: 'SK-RED-' + (e === 'rect' ? '01' : '02'), guidance: redundant.map((c) => c.label).join('; ') + ' — already implied. The sketch solves, but the duplicate will fight any future edit.', implicated: redundant.map((c) => c.id) };
    else if (missing.length) r = { state: 'UNDER_CONSTRAINED', dof, code: 'SK-UND-' + (e === 'rect' ? '01' : '02'), guidance: dof + ' degree' + (dof === 1 ? '' : 's') + ' of freedom left · add: ' + missing.map((c) => c.label).join('; '), implicated: missing.map((c) => c.id) };
    else r = { state: 'SOLVED', dof: 0, code: 'SK-OK', guidance: 'fully defined · every entity is fixed by a dimension or a geometric relation', implicated: [] };
    entities[e] = r;
  }
  const rank: ConstraintState[] = ['SOLVED', 'UNDER_CONSTRAINED', 'REDUNDANT', 'CONTRADICTORY'];
  const overall = rank[Math.max(...Object.values(entities).map((r) => rank.indexOf(r.state)))];
  return { entities, overall, dof: entities.rect.dof + entities.holes.dof };
}

/** Fusion colours: black = fully defined, blue = under-constrained; amber and red for the two failure classes. */
export const SKETCH_COLOR: Record<ConstraintState, string> = { SOLVED: 'var(--ink)', UNDER_CONSTRAINED: 'var(--focus)', REDUNDANT: 'var(--amber)', CONTRADICTORY: 'var(--red)' };
