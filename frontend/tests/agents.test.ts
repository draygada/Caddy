import { describe, expect, it } from 'vitest';
import { DOCS, callA, callB, callC, verify } from '../src/lib/sources';
import { outcome } from '../src/lib/rules';
import { BASELINE_PARTS, CATALOG, DECLARED0, SLOTS, type PartId } from '../src/lib/catalog';
import { proposeSlotList, searchTarget } from '../src/lib/propose';
import { draftMemo, citationsWithin } from '../src/lib/memo';
import { useStore, INTAKE_DEFAULT } from '../src/store';

const attrsOf = (parts: typeof BASELINE_PARTS) => Object.fromEntries(SLOTS.map((s) => [s, parts[s] ? { ...CATALOG[parts[s] as PartId].attrs } : {}])) as ReturnType<typeof useStore.getState>['attrs'];

describe('the verifier (F-07)', () => {
  it('the poisoned page: every outcome ends at 7A002.a.1.a or a REJECT; the EAR99 banner has no path into a rule', () => {
    const doc = DOCS['gx220-vendor-page'];
    const runs = callA(doc).filter((p) => p.claim.field === 'bias');
    expect(runs).toHaveLength(3);
    expect(runs[0].verdict.ok).toBe(false); if (!runs[0].verdict.ok) expect(runs[0].verdict.reason).toBe('number_mismatch');
    expect(runs[1].verdict.ok).toBe(false); if (!runs[1].verdict.ok) expect(runs[1].verdict.reason).toBe('span_not_found');
    expect(runs[2].verdict.ok).toBe(true);
    const parts = { ...BASELINE_PARTS };
    const attrs = attrsOf(parts); attrs.imu = { ...attrs.imu, bias: 0.3 };
    expect(outcome({ parts, attrs, span: 1.8, declared: DECLARED0 }).keys).toContain('7A002.a.1.a');
  });
  it('applies an accepted poisoned-fixture span as extractor data and records only explicit unauthenticated session acceptance', () => {
    const accepted = callA(DOCS['gx220-vendor-page']).find((proposal) => proposal.label.includes('told the truth'))!;
    const st = useStore.getState(); st.reset();
    st.applyExtraction('imu', accepted);
    let current = useStore.getState();
    expect(current.attrs.imu.bias).toBe(0.3);
    expect(current.extracted['imu.bias']).toEqual({ by: 'extractor', acceptance: 'NONE', reviewStatus: 'NOT_HUMAN_REVIEWED', attestor: null, durability: 'MEMORY_ONLY' });
    expect(current.events[0].entry).toContain('no human review, identity, or attestor recorded');

    current.acknowledgeExtraction('imu', 'bias');
    current = useStore.getState();
    expect(current.extracted['imu.bias']).toMatchObject({ acceptance: 'UNAUTHENTICATED_BROWSER_SESSION', reviewStatus: 'NOT_HUMAN_REVIEWED', attestor: null, durability: 'MEMORY_ONLY' });
    expect(current.events[0]).toMatchObject({ kind: 'source_acceptance_acknowledged', lane: 'proposal' });
    expect(current.events[0].entry).toBe('unauthenticated browser-session acceptance · memory only · no identity or attestor captured · not human review');
  });
  it('refuses the poisoned fixture wrong-span proposal before it can mutate the design or create acceptance evidence', () => {
    const wrongSpan = callA(DOCS['gx220-vendor-page']).find((proposal) => proposal.label.includes('wrong offsets'))!;
    expect(wrongSpan.verdict).toMatchObject({ ok: false, reason: 'span_not_found' });
    const st = useStore.getState(); st.reset();
    const beforeBias = useStore.getState().attrs.imu.bias;
    st.applyExtraction('imu', wrongSpan);
    const current = useStore.getState();
    expect(current.attrs.imu.bias).toBe(beforeBias);
    expect(current.extracted['imu.bias']).toBeUndefined();
  });
  it('schemas reject classification keys', () => {
    const doc = DOCS['hg5700-brochure'];
    const v = verify(doc, { field: 'bias', value: 0.01, unit: '°/h', quote: '0.01 °/h', start: 0, end: 9, doc_sha256: doc.sha, classification: 'EAR99' });
    expect(v.ok).toBe(false); if (!v.ok) expect(v.reason).toBe('schema_violation');
  });
  it('Call B: a green candidate makes the flip disappear on the copy; synthetic parts abstain', () => {
    const parts = { ...BASELINE_PARTS, thermal: 'boson' as const };
    const d = { parts, attrs: attrsOf(parts), span: 1.8, declared: DECLARED0 };
    const o = outcome(d);
    const cands = callB('thermal', d, o);
    expect(cands.find((c) => c.pid === 'lepton')?.state).toBe('green');
    const imuParts = { ...BASELINE_PARTS, imu: 'hg5700' as const };
    const d2 = { parts: imuParts, attrs: attrsOf(imuParts), span: 1.8, declared: DECLARED0 };
    expect(callB('imu', d2, outcome(d2)).find((c) => c.pid === 'imung')?.state).toBe('abstained');
  });
});

describe('rule packs (F-11)', () => {
  it('the same design reads differently under v1 and v2; Call C verifies the patch bytes', () => {
    const d = { parts: BASELINE_PARTS, attrs: attrsOf(BASELINE_PARTS), span: 1.8, declared: DECLARED0 };
    expect(outcome(d, 'v2').keys).not.toContain('9A012.a.2');
    expect(outcome(d, 'v1').keys).toContain('9A012.a.2');
    expect(callC().verdict.ok).toBe(true);
  });
});

describe('rows 7, 8, 10, 12, 13, 14 and declared facts', () => {
  it('fires the accelerometer, GNSS, crypto, board target, used-on and PRC rows', () => {
    const parts = { ...BASELINE_PARTS, imu: 'acc120' as const, gnss: 'mcode' as const, datalink: 'aescustom' as const, fc: 'h743m' as const };
    const attrs = attrsOf(parts);
    const o = outcome({ parts, attrs, span: 1.8, declared: { ...DECLARED0, mass_market: false, board_target: '600-series UAV', used_on: [{ aircraft: 'F-22', document_ref: 'DWG-1' }] } });
    expect(o.keys).toEqual(expect.arrayContaining(['7A001.a.1.a', '7A101.a', 'USML XII(d)(2)(ii)', '7A105.b.1', '7A105.b.3', '5A002.a', '3A611.g', 'USML VIII(h)(1)', '120.11(c) see-through']));
    expect(o.advisories.some((a) => a.entry.startsWith('§848'))).toBe(true);
    expect(o.cols.airframe.find((c) => c.code === 'CN')?.word).toBe('DENIAL');
  });
  it('civil GNSS service declared suppresses 7A005.b; de minimis and the duty stack appear for Taiwan assembly', () => {
    const parts = { ...BASELINE_PARTS, gnss: 'crpa' as const };
    const attrs = attrsOf(parts);
    expect(outcome({ parts, attrs, span: 1.8, declared: { ...DECLARED0, civil_gnss_service: true } }).keys).not.toContain('7A005.b');
    expect(outcome({ parts, attrs, span: 1.8, declared: { ...DECLARED0, civil_gnss_service: false } }).keys).toContain('7A005.b');
    const tw = outcome({ parts: BASELINE_PARTS, attrs: attrsOf(BASELINE_PARTS), span: 1.8, declared: { ...DECLARED0, final_assembly_country: 'TW' } });
    expect(tw.deMinimis).not.toBeNull();
    expect(tw.duty.rows.find((r) => r.id === '232-UAS-THERMAL')?.fired).toBe(true);
    expect(tw.duty.rows.find((r) => r.id === '301-TW')?.fired).toBe(true);
    const us = outcome({ parts: BASELINE_PARTS, attrs: attrsOf(BASELINE_PARTS), span: 1.8, declared: DECLARED0 });
    expect(us.deMinimis).toBeNull();
  });
  it('declared facts needing a document reference are refused without one', () => {
    const st = useStore.getState(); st.reset();
    expect(st.setDeclared({ designed_to_incorporate: true }, 'x')).toContain('document_ref');
    expect(st.setDeclared({ used_on: [{ aircraft: 'F-22', document_ref: '' }] }, 'x')).toContain('document_ref');
    expect(useStore.getState().setDeclared({ document_ref: 'DWG-7' }, 'ref')).toBeNull();
    expect(useStore.getState().setDeclared({ used_on: [{ aircraft: 'F-22', document_ref: 'DWG-7' }] }, 'F-22')).toBeNull();
    expect(useStore.getState().events[0].kind).toBe('flag_declared');
  });
});

describe('Door 3, design to a target, the memo', () => {
  it('a description becomes a slot list; an off-catalog MPN is rejected and becomes a placeholder', () => {
    const p = proposeSlotList('long range survey drone with a thermal camera, gnss, datalink and a laser rangefinder pod');
    expect(p.slots.find((s) => s.slot === 'battery')?.pid).toBe('amprius');
    expect(p.rejected).toBe(1);
    expect(p.slots.find((s) => s.rejected)?.placeholder).toBe(true);
  });
  it('target search ranks passing configurations first and never on price alone', () => {
    const d = { parts: BASELINE_PARTS, attrs: attrsOf(BASELINE_PARTS), span: 1.8, declared: DECLARED0 };
    const res = searchTarget(d, { nlrTo: 'DE', maxDutyPct: 25, noUsml: true }, 'v2');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].passes).toBe(true);
    expect(res[0].parts.thermal).toBeNull(); // no thermal imager to stay at +25 %
  });
  it('the memo cites only rules that fired', () => {
    const parts = { ...BASELINE_PARTS, imu: 'hg5700' as const };
    const o = outcome({ parts, attrs: attrsOf(parts), span: 1.8, declared: DECLARED0 });
    const m = draftMemo(o, 'tactical IMU for the survey mission', 'ICM → HG5700', 7);
    expect(citationsWithin(m, o)).toBe(true);
    expect(citationsWithin({ ...m, citations: [...m.citations, '9A012 MT'] }, o)).toBe(false);
  });
});

describe('tamper and the log', () => {
  it('Re-derive prints the simulated break marker; the round still opens after a reset', () => {
    const st = useStore.getState(); st.reset();
    st.swap('battery', 'amprius');
    useStore.getState().tamper(4);
    useStore.getState().rederiveLog();
    expect(useStore.getState().rederive?.line).toBe('SIMULATED BREAK marker at #4');
    useStore.getState().reset();
    useStore.getState().rederiveLog();
    expect(useStore.getState().rederive?.line).toContain('local replay complete');
    useStore.getState().openRound('US', 1, 'air', INTAKE_DEFAULT);
    expect(useStore.getState().round?.lines.length).toBe(14);
  });
});
