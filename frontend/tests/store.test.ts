import { describe, expect, it } from 'vitest';
import { useStore } from '../src/store';
import { solveSketch, SKETCH_DEFAULT } from '../src/lib/sketch';
import { fmtLen, fromUnit, toUnit } from '../src/lib/units';
import { clipFaces, boxFaces, plateOutline } from '../src/lib/geometry';
import { buildBodies } from '../src/lib/scene';
import { commandAvailable, commandById } from '../src/commands';

describe('timeline replay (undo is supersede)', () => {
  it('viewAt shows the snapshot at seq N, live returns, restore appends instead of deleting', () => {
    const st = useStore.getState();
    st.reset();
    st.swap('battery', 'amprius');
    st.confirm('benji');
    st.setSpan('2.0');
    const s1 = useStore.getState();
    expect(s1.events.length).toBe(6);
    expect(s1.span).toBe(2.0);
    s1.viewAt(4); // after the swap, before confirm and span
    const s2 = useStore.getState();
    expect(s2.viewSeq).toBe(4);
    expect(s2.span).toBe(1.8);
    expect(s2.parts.battery).toBe('amprius');
    expect(s2.editable()).toBe(false);
    s2.setSpan('2.2'); // blocked while replaying
    expect(useStore.getState().span).toBe(1.8);
    s2.viewAt(null);
    expect(useStore.getState().span).toBe(2.0);
    useStore.getState().viewAt(3); // baseline
    expect(useStore.getState().parts.battery).toBe('p45b');
    useStore.getState().restoreHere();
    const s3 = useStore.getState();
    expect(s3.viewSeq).toBeNull();
    expect(s3.parts.battery).toBe('p45b');
    expect(s3.events.length).toBe(7);
    expect(s3.events[0].kind).toBe('state_restored');
    expect(s3.events.find((e) => e.seq === 4)?.kind).toBe('part_swapped');
  });
  it('feature dialogs append geometry features; versions pin a seq', () => {
    const st = useStore.getState();
    st.reset();
    st.applyGeo({ fillet: 0.01 }, 'fillet', 'fillet · plate corners r 0.010 m');
    expect(useStore.getState().geo.fillet).toBe(0.01);
    expect(useStore.getState().features.at(-1)?.kind).toBe('fillet');
    useStore.getState().saveVersion('rounded corners');
    expect(useStore.getState().versions.length).toBe(2);
    expect(useStore.getState().events[0].kind).toBe('version_saved');
  });
  it('commits a solved sketch and extrudes its plate profile into rendered geometry', () => {
    const st = useStore.getState();
    st.reset();
    st.toggleConstraint('hole_inset_y');
    expect(st.commitSketch()).toBe('SOLVED · 0 DOF');
    expect(useStore.getState().features.at(-1)?.kind).toBe('sketch');
    useStore.getState().applyGeo({ plateT: 0.02 }, 'extrude', 'extrude · plate profile to 0.020 m');
    const current = useStore.getState();
    expect(current.geo.plateT).toBe(0.02);
    expect(current.features.at(-1)?.kind).toBe('extrude');
    expect(buildBodies(current.snapshot()).plate.c?.[2]).toBeCloseTo(0.01, 9);
  });
});

describe('command workspace scope', () => {
  it('keeps global review commands available but blocks hidden Design mutations', () => {
    expect(commandAvailable(commandById('review.tripwire')!, false)).toBe(true);
    expect(commandAvailable(commandById('create.extrude')!, false)).toBe(false);
    expect(commandAvailable(commandById('create.extrude')!, true)).toBe(true);
  });
});

describe('sketch solver', () => {
  it('default has under-constrained holes; adding the inset solves; duplicates are redundant; conflicts are contradictory', () => {
    const d = solveSketch(SKETCH_DEFAULT);
    expect(d.entities.holes.state).toBe('UNDER_CONSTRAINED');
    expect(d.entities.holes.dof).toBe(1);
    const ok = solveSketch({ ...SKETCH_DEFAULT, hole_inset_y: true });
    expect(ok.overall).toBe('SOLVED');
    expect(solveSketch({ ...SKETCH_DEFAULT, hole_inset_y: true, dim_span_dup: true }).entities.rect.state).toBe('REDUNDANT');
    const bad = solveSketch({ ...SKETCH_DEFAULT, hole_inset_y: true, hole_big: true });
    expect(bad.entities.holes.state).toBe('CONTRADICTORY');
    expect(bad.entities.holes.code).toBe('SK-CON-02');
  });
});

describe('units and geometry helpers', () => {
  it('converts and formats lengths', () => {
    expect(toUnit(1, 'mm')).toBe(1000);
    expect(fromUnit(39.37007874015748, 'in')).toBeCloseTo(1, 9);
    expect(fmtLen(3.4, 'mm')).toBe('3400 mm');
  });
  it('clips faces at a plane and rounds plate corners', () => {
    const faces = boxFaces(0, 0, 0, 2, 1, 1, 'x');
    const cut = clipFaces(faces, 0, 1);
    expect(cut.some((f) => f.cut)).toBe(true);
    expect(cut.every((f) => f.pts.every((p) => p[0] <= 1 + 1e-9))).toBe(true);
    expect(plateOutline(3, 1.2, 0.1, 0).length).toBe(24);
    expect(plateOutline(3, 1.2, 0, 0.1).length).toBe(8);
    expect(plateOutline(3, 1.2, 0, 0).length).toBe(4);
  });
});

describe('the Merlin sample project', () => {
  it('opens on its frame: ten components all mounted, the frame is the airframe body, four motors and props on the arm pads', () => {
    const st = useStore.getState();
    st.reset();
    st.openProject('merlin');
    const s = useStore.getState();
    expect(s.project?.id).toBe('merlin');
    expect(s.project?.components).toHaveLength(10);
    expect(s.project?.components).not.toContain('frame');
    expect(s.geo.kind).toBe('frame');
    expect(s.geo.frame).toBe('chimera7');
    const placed = s.project!.components.filter((sl) => s.parts[sl]);
    expect(placed).toHaveLength(10);
    expect(s.parts.frame).toBeNull();
    expect(s.parts.thermal).toBeNull();
    const bodies = buildBodies(s.snapshot());
    expect(bodies.plate.faces.length).toBeGreaterThan(20);
    expect(bodies.flange.faces).toHaveLength(0);
    for (const sl of placed) expect(bodies[sl].faces.length).toBeGreaterThan(6);
    // four motors: the motor body spans the whole wheelbase, not one bell
    const xs = bodies.motor.faces.flatMap((f) => f.pts.map((q) => q[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.25);
    // every mounted part sits at or above the bottom plate
    for (const sl of placed) if (sl !== 'motor' && sl !== 'prop') expect(s.pos[sl].z ?? 0).toBeGreaterThanOrEqual(0.003);
    expect(useStore.getState().projects.find((p) => p.id === 'kestrel')?.snapshot).toBeUndefined();
  });
});

describe('replay carries attestation state', () => {
  it('an unconfirmed swap is not shown on a replayed earlier state', () => {
    const st = useStore.getState();
    st.reset();
    st.swap('thermal', 'boson');
    expect(useStore.getState().unconfirmed.thermal).toBe(4);
    useStore.getState().viewAt(3);
    expect(useStore.getState().unconfirmed.thermal).toBeUndefined();
    useStore.getState().viewAt(null);
    expect(useStore.getState().unconfirmed.thermal).toBe(4);
  });
});
