import { describe, expect, it } from 'vitest';
import { BASELINE_PARTS, CATALOG, SLOTS, type PartId, type Slot } from '../src/lib/catalog';
import { countChanged, outcome, type Design, type Parts } from '../src/lib/rules';
import { parseDecimal } from '../src/lib/hash';

const design = (over: Partial<Parts> = {}, span = 3.0, edit: Partial<Record<Slot, Record<string, number | null>>> = {}): Design => {
  const parts: Parts = { ...BASELINE_PARTS, ...over };
  const attrs = Object.fromEntries(SLOTS.map((s) => [s, parts[s] ? { ...CATALOG[parts[s] as PartId].attrs, ...(edit[s] || {}) } : {}])) as Design['attrs'];
  return { parts, attrs, span };
};

describe('outcome (synthetic rule table)', () => {
  it('baseline: nothing fires, every column NLR, four IMU rows cannot fire', () => {
    const o = outcome(design());
    expect(o.rules).toHaveLength(0);
    expect(o.cannot.filter((c) => c.node === 'imu')).toHaveLength(4);
    for (const node of Object.keys(o.cols) as (keyof typeof o.cols)[]) expect(o.cols[node].every((d) => d.word === 'NLR')).toBe(true);
  });
  it('F1 Amprius: endurance crosses 3.0 h, 9A012.a.2 fires, DE STA, TW/VN/CN LIC', () => {
    const o = outcome(design({ battery: 'amprius' }));
    expect(o.endurance).toBeCloseTo(3.25, 2);
    expect(o.keys).toContain('9A012.a.2');
    expect(o.keys).toContain('3A001.e.1.b');
    const af = Object.fromEntries(o.cols.airframe.map((d) => [d.code, d.word]));
    expect(af).toMatchObject({ CA: 'NLR', DE: 'STA', TW: 'LIC', VN: 'LIC', CN: 'LIC' });
  });
  it('F2 span 3.4 m: cruise W 293, range 319 km, MT fires', () => {
    const o = outcome(design({ battery: 'amprius' }, 3.4));
    expect(Math.round(o.cruiseW)).toBe(293);
    expect(Math.round(o.range ?? 0)).toBe(319);
    expect(o.rules.some((r) => r.cols === 'MT')).toBe(true);
    expect(o.cols.airframe.find((d) => d.code === 'DE')?.word).toBe('LIC');
  });
  it('F3 Boson: 6A003.b.4.b fires and pulls 9A012.a.3 onto the airframe', () => {
    const o = outcome(design({ thermal: 'boson' }));
    expect(o.keys).toEqual(expect.arrayContaining(['6A003.b.4.b', '9A012.a.3', '6A003 RS1']));
  });
  it('F4 HG5700: first IMU red with propagation; IMU-NG is USML with CN denial', () => {
    const hg = outcome(design({ imu: 'hg5700' }));
    expect(hg.keys).toEqual(expect.arrayContaining(['7A002.a.1.a', '7A102.a', '9A012.a.5', '7A002.a.1.b']));
    const ng = outcome(design({ imu: 'imung' }));
    expect(ng.rules.some((r) => r.kind === 'USML')).toBe(true);
    expect(ng.cols.airframe.find((d) => d.code === 'CN')?.word).toBe('DENIAL');
  });
  it('F8 H743 → H753: re-evaluated, 0 changed', () => {
    expect(countChanged(outcome(design()), outcome(design({ fc: 'h753' })))).toBe(0);
  });
  it('empty battery slot: cannot fire, never green by silence', () => {
    const o = outcome(design({ battery: null }));
    expect(o.endurance).toBeNull();
    expect(o.cannot.map((c) => c.entry)).toEqual(expect.arrayContaining(['9A012.a.2', '3A001.e.1.b']));
  });
  it('edited spec changes the outcome: Lepton typed to 30 Hz fires 6A003.b.4.b; ICM with a typed bias fires 7A002.a.1.a', () => {
    const th = outcome(design({}, 3.0, { thermal: { hz: 30 } }));
    expect(th.keys).toContain('6A003.b.4.b');
    const imu = outcome(design({}, 3.0, { imu: { bias: 0.2 } }));
    expect(imu.keys).toContain('7A002.a.1.a');
  });
  it('flight controller rated beyond +125 °C fires 3A001.a.2', () => {
    const o = outcome(design({}, 3.0, { fc: { tmax: 150 } }));
    expect(o.keys).toContain('3A001.a.2');
  });
});

describe('parseDecimal (Postel)', () => {
  it('accepts 3.4, 3,4 and 3.4 m; rejects letters', () => {
    expect(parseDecimal('3.4')).toBe(3.4);
    expect(parseDecimal('3,4')).toBe(3.4);
    expect(parseDecimal('3.4 m')).toBe(3.4);
    expect(parseDecimal('three')).toBeNull();
  });
});
