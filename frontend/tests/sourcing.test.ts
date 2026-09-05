import { describe, expect, it } from 'vitest';
import { BASELINE_PARTS } from '../src/lib/catalog';
import { estimate, gateFor, linesFor, offersFor, rollup, screen, sortOffers, tierFor, walk, type ResolvedOffer } from '../src/lib/sourcing';
import { outcome } from '../src/lib/rules';
import { useStore, INTAKE_DEFAULT } from '../src/store';

const resolve = (parts = BASELINE_PARTS, qty = 1, mode: 'air' | 'ocean' = 'air') => {
  const lines = linesFor(parts);
  const out: Record<string, ResolvedOffer[]> = {};
  for (const line of lines) out[line.id] = offersFor(parts).filter((o) => o.lineId === line.id).map((offer) => { const tier = tierFor(line, offer, false); const tree = walk(offer, tier); const ru = rollup(tree); return { offer, tier, tree, status: ru.status, because: ru.because, ladder: estimate(offer, line, qty, mode) }; });
  return { lines, out };
};

describe('sourcing lane (S1, S2)', () => {
  it('twelve lines follow the design; the motor has a cheaper blocked seller sorted last', () => {
    const { lines, out } = resolve();
    expect(lines).toHaveLength(14);
    const motor = sortOffers(out['l-motor']);
    expect(motor).toHaveLength(2);
    expect(motor[0].offer.seller).toBe('T-Motor');
    expect(motor[0].status).toBe('review_required'); // ownership unknown is a review flag, never zero
    expect(motor[1].offer.seller).toBe('Brightwing Components');
    expect(motor[1].status).toBe('review_blocked');
    expect(motor[1].offer.unitPrice).toBeLessThan(motor[0].offer.unitPrice);
    expect(motor[1].because).toContain('SZ DJI Technology Co., Ltd.');
  });
  it('screening is exact or suffix-normalised only', () => {
    expect(screen('SZ DJI Technology Co., Ltd.').result).toBe('exact');
    expect(screen('SZ DJI Technology Co Ltd').result).toBe('exact');
    expect(screen('DJI').result).toBe('none');
  });
  it('MPF minimum applies on the cells line; domestic offers have no entry layers', () => {
    const { lines, out } = resolve();
    const cells = out['l-cells'][0];
    expect(cells.ladder.rows.find((r) => r.layer === 'MPF')?.note).toContain('minimum applied');
    const cellsLine = lines.find((l) => l.id === 'l-cells')!;
    const bigger = estimate(cells.offer, cellsLine, 40, 'air');
    expect(bigger.rows.find((r) => r.layer === 'MPF')?.note).not.toContain('minimum applied');
    const imu = out['l-imu'][0];
    expect(imu.ladder.domestic).toBe(true);
    expect(imu.ladder.rows.every((r) => r.rate === 'not applicable' || r.layer === 'de minimis')).toBe(true);
  });
  it('the export gate is the engine cell verbatim: HG5700 blocks to Taiwan, the IMU baseline does not', () => {
    const parts = { ...BASELINE_PARTS, imu: 'hg5700' as const };
    const o = outcome({ parts, attrs: { battery: { pack_wh: 1000, wh_kg: 260 }, thermal: { hz: 9, elements: 19200 }, imu: { bias: 0.01, arw: 0.002 }, fc: { tmin: -40, tmax: 85 }, gnss: { gnss_speed: 500 }, datalink: { crypto_bits: 256 }, pod: {} }, span: 3 });
    const line = linesFor(parts).find((l) => l.id === 'l-imu')!;
    expect(gateFor(line, o, 'TW').blocks).toBe(true);
    expect(gateFor(line, o, 'US').blocks).toBe(false);
  });
});

describe('round state machine and order send-off', () => {
  it('opens a round, refuses a blocked selection, records declined offers, refuses a partial package, dispatches exactly once', () => {
    const st = useStore.getState();
    st.reset();
    st.openRound('US', 1, 'air', INTAKE_DEFAULT);
    let r = useStore.getState().round!;
    expect(r.status).toBe('costed');
    expect(useStore.getState().events[0].kind).toBe('cost_estimated');
    const motor = sortOffers(r.offers['l-motor']);
    expect(useStore.getState().selectOffer('l-motor', motor[1].offer.id, 'diego', {})).toContain('review blocked');
    expect(useStore.getState().selectOffer('l-motor', motor[0].offer.id, '', {})).toContain('attestor');
    expect(useStore.getState().selectOffer('l-motor', motor[0].offer.id, 'diego', {})).toBeNull();
    r = useStore.getState().round!;
    expect(r.selections['l-motor'].declined[0].reason).toBe('owner screened');
    expect(r.selections['l-motor'].declined[0].statusAtDecline).toBe('review_blocked');
    const o = outcome(useStore.getState().design());
    useStore.getState().buildPackage(o);
    expect(useStore.getState().round!.pkgRefusal).toContain('without a selection');
    for (const line of r.lines) { const list = sortOffers(useStore.getState().round!.offers[line.id]); if (!useStore.getState().round!.selections[line.id] && list[0]) useStore.getState().selectOffer(line.id, list[0].offer.id, 'diego', {}); }
    expect(useStore.getState().round!.status).toBe('selection_confirmed');
    useStore.getState().buildPackage(o);
    expect(useStore.getState().round!.pkg).not.toBeNull();
    useStore.getState().sendOrder();
    const o1 = useStore.getState().round!.order!;
    expect(o1.state).toBe('ACKNOWLEDGED');
    useStore.getState().retrySend();
    const o2 = useStore.getState().round!.order!;
    expect(o2.receipt).toBe(o1.receipt);
    expect(o2.attempts).toBe(2);
    expect(useStore.getState().events.filter((e) => e.kind === 'order_dispatched' && !e.text.startsWith('retry'))).toHaveLength(1);
  });
  it('a design edit after the round opened makes the package refuse', () => {
    const st = useStore.getState();
    st.reset();
    st.openRound('US', 1, 'air', INTAKE_DEFAULT);
    useStore.getState().setSpan('3.4');
    const o = outcome(useStore.getState().design());
    useStore.getState().buildPackage(o);
    expect(useStore.getState().round!.pkgRefusal).toContain('design state changed');
  });
});
