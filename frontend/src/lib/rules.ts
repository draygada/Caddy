// Local synthetic stand-in for the service's rule engine (14 rows plus MT
// branches, propagation P1 to P4, the Country Chart, the duty rows). It exists
// so the shell renders an outcome before the seam is wired; the browser will
// render the backend's response verbatim once it exists.
import {
  CATALOG, CELLS, DECLARED0, DEST, LEVEL, LISTED_AIRCRAFT, PACKS, SLOTS, SPAN_BASELINE, TONE,
  type ColSet, type Declared, type DestCode, type DestWord, type Node, type PackId, type PartAttrs, type PartId, type Slot, type Tone,
} from './catalog';

export type RuleKind = 'CCL' | 'USML';
export interface Rule {
  id: string; node: Node; entry: string; kind: RuleKind; reason: string; number: string; sentence: string;
  ecfr: string; eff: string; fr: string; url: string; atoms: string[]; cols?: ColSet;
}
export interface CannotFire { id: string; node: Node; entry: string; text: string }
/** Amber, never red: who may buy the finished product, separate from export control. */
export interface Advisory { id: string; node: Node; entry: string; text: string; printOnly?: boolean; /** 'amber' needs a look; 'info' is a declared fact restated */ severity?: 'amber' | 'info' }
export interface DestCell { code: DestCode; word: DestWord; para: string; tone: Tone }
export interface DeMinimis { code: DestCode; subject_to_EAR: boolean; us_controlled_pct: number; threshold: number; because: string }
export interface DutyRow { id: string; label: string; rate: string; amount: number | null; note: string; fired: boolean; printOnly: boolean; citation: string }
export interface Outcome {
  rules: Rule[];
  cannot: CannotFire[];
  advisories: Advisory[];
  cols: Record<Node, DestCell[]>;
  cruiseW: number;
  endurance: number | null;
  range: number | null;
  keys: string[];
  pack: PackId;
  /** only when final_assembly_country ≠ US */
  deMinimis: DeMinimis[] | null;
  duty: { rows: DutyRow[]; declaredValue: number; usContent: number; destinations: { code: DestCode; text: string }[] };
}

export type Parts = Record<Slot, PartId | null>;
export type Attrs = Record<Slot, PartAttrs>;
/** What the engine reads: which part sits in each slot, that part's current (editable) attributes, the span, the declared facts. */
export interface Design { parts: Parts; attrs: Attrs; span: number; declared?: Declared }

const f2 = (n: number) => n.toFixed(2);
const ECFR = (p: PackId) => PACKS[p].ecfr_date;

/** Declared simplification: 200 W of fixed load plus 120 W of induced power at the 1.8 m baseline span, falling with the square of the span ratio. */
export function cruiseWatts(span: number): number {
  return 200 + 120 * Math.pow(SPAN_BASELINE / span, 2);
}

export function outcome(d: Design, packId: PackId = 'v2'): Outcome {
  const { span } = d;
  const decl = d.declared ?? DECLARED0;
  const pack = PACKS[packId];
  const rules: Rule[] = [], cannot: CannotFire[] = [], advisories: Advisory[] = [];
  const cols = Object.fromEntries((['airframe', ...SLOTS] as Node[]).map((n) => [n, ['NLR']])) as Record<Node, ColSet[]>;
  const bat = d.attrs.battery, th = d.attrs.thermal, imu = d.attrs.imu, fc = d.attrs.fc, gnss = d.attrs.gnss, dl = d.attrs.datalink;
  const cruiseW = cruiseWatts(span);
  const wh = bat.pack_wh;
  const endurance = wh ? (wh * 0.8) / cruiseW : null;
  const range = endurance != null ? endurance * 90 : null;
  const add = (r: Rule) => { rules.push(r); if (r.cols) cols[r.node].push(r.cols); };
  const E = ECFR(packId);

  // Row 1 · pack Wh → endurance (pack-dependent threshold)
  if (!wh || endurance == null || range == null) {
    cannot.push({ id: 'c-bat', node: 'battery', entry: '9A012.a.2', text: 'cannot fire · field empty (pack energy)' });
    cannot.push({ id: 'c-bat2', node: 'battery', entry: '3A001.e.1.b', text: 'cannot fire · field empty (cell energy density)' });
  } else {
    if (endurance >= pack.enduranceNs1H) add({ id: 'r1', node: 'airframe', entry: '9A012.a.2', kind: 'CCL', reason: 'NS Column 1 · endurance crossed ' + pack.enduranceNs1H.toFixed(1) + ' h · pack ' + pack.id, number: 'endurance ' + f2(endurance) + ' h ≥ ' + pack.enduranceNs1H.toFixed(1) + ' h', sentence: pack.id === 'v2' ? '“Unmanned aerial vehicles” having any of the following: … a.2. An endurance of 3 hours or greater;' : '… a.2. An endurance of 1 hour or greater;', ecfr: E, eff: pack.effective, fr: pack.id === 'v2' ? '91 FR 52501, published 2026-08-14 · NS1 line was 1 h; the 30 min tier removed' : 'pre-2026-08-13 text · typed from the eCFR versioner at /full/2026-08-01', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['pack_wh ' + wh.toLocaleString() + ' × 0.80 / cruise_W ' + cruiseW.toFixed(0) + ' W = ' + f2(endurance) + ' h (declared simplification)'], cols: 'NS1' });
    else if (pack.enduranceAtH != null && endurance >= pack.enduranceAtH) add({ id: 'r1at', node: 'airframe', entry: '9A012.a.1', kind: 'CCL', reason: 'AT only · endurance crossed 30 min · pack v1', number: 'endurance ' + f2(endurance) + ' h ≥ 0.5 h', sentence: 'a.1. An endurance of 30 minutes or greater but less than 1 hour;', ecfr: E, eff: pack.effective, fr: 'pre-2026-08-13 text', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['no control-column match in modeled destinations · not an export determination'], cols: 'NLR' });
    // Row 2 · span → cruise W → range
    if (range >= 300) add({ id: 'r2', node: 'airframe', entry: '9A012 MT', kind: 'CCL', reason: 'MT · range crossed 300 km, regardless of payload', number: 'range ' + range.toFixed(0) + ' km ≥ 300 km', sentence: 'Capable of a range of 300 km or greater, regardless of payload.', ecfr: E, eff: '2026-08-13', fr: '742.5(a)(2) 500 kg line kept separate · STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012 MT', atoms: ['range = ' + f2(endurance) + ' h × 90 km/h (declared cruise speed) = ' + range.toFixed(0) + ' km'], cols: 'MT' });
    // Row 11 · cell energy density
    if ((bat.wh_kg ?? 0) > 350) add({ id: 'r11', node: 'battery', entry: '3A001.e.1.b', kind: 'CCL', reason: 'NS Column 2 · cell energy density; the pack row has no modeled match (Note)', number: 'cell ' + bat.wh_kg + ' Wh/kg > 350 Wh/kg', sentence: 'Rechargeable cells having an energy density exceeding 350 Wh/kg at 20 °C;', ecfr: E, eff: '2023-05-17', fr: '88 FR 31445 · Note: the pack is not a cell', url: 'ecfr.gov/…/part-774/supplement-1 · 3A001', atoms: ['wh_kg ' + bat.wh_kg + ' · source: vendor datasheet p.1'], cols: 'NS2' });
  }

  // Rows 3 and 4 · thermal
  if (th.hz == null) cannot.push({ id: 'c-th', node: 'thermal', entry: '6A003.b.4.b', text: 'cannot fire · field empty (frame rate)' });
  else {
    if (th.hz > 9) {
      add({ id: 'r3', node: 'thermal', entry: '6A003.b.4.b', kind: 'CCL', reason: 'NS Column 2 · frame rate crossed 9 Hz', number: 'frame rate ' + th.hz + ' Hz > 9 Hz', sentence: 'b.4.b. Having a frame rate of more than 9 Hz;', ecfr: E, eff: '2020-10-05', fr: '85 FR 62583', url: 'ecfr.gov/…/part-774/supplement-1 · 6A003', atoms: ['hz ' + th.hz + ' · source: datasheet bytes 2210–2214'], cols: 'NS2' });
      add({ id: 'r3p', node: 'airframe', entry: '9A012.a.3', kind: 'CCL', reason: 'P1 child pulls parent · incorporates a 6A003.b.4.b imaging core', number: 'propagated from thermal core', sentence: 'a.3. Incorporating imaging equipment controlled by 6A003;', ecfr: E, eff: '2026-08-13', fr: '91 FR 52501 · propagation P1', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['child: thermal core · 6A003.b.4.b'], cols: 'NS1' });
    }
    const elements = th.elements ?? 0;
    if (elements > 111000 || th.hz > 60) add({ id: 'r4', node: 'thermal', entry: '6A003 RS1', kind: 'CCL', reason: 'RS Column 1 · elements; “embedded in a civil product” clause printed, not evaluated' + (decl.civil_product ? ' · civil product declared' : ' · civil product not declared'), number: elements.toLocaleString() + ' elements > 111,000', sentence: 'Having more than 111,000 elements or a frame rate exceeding 60 Hz;', ecfr: E, eff: '2020-10-05', fr: '85 FR 62583 · ‡ Note on embedding in a civil product: printed, not evaluated', url: 'ecfr.gov/…/part-774/supplement-1 · 6A003', atoms: ['elements ' + th.px + ' = ' + elements.toLocaleString()], cols: 'NS2' });
  }

  // Rows 5, 6, 7 · IMU
  const imuReal = d.parts.imu ? CATALOG[d.parts.imu].real : true;
  if (imu.bias == null) {
    cannot.push({ id: 'c-imu', node: 'imu', entry: '7A002.a.1.a', text: imu.inrun != null ? 'cannot fire · one-month bias stability not published (vendor quotes in-run bias instability ' + imu.inrun + ' °/h, not the field the rule reads)' : 'cannot fire · field empty (bias stability)' });
    cannot.push({ id: 'c-mt', node: 'imu', entry: '7A102.a MT', text: 'cannot fire · drift-rate stability (1 σ) not published' });
  } else if (imu.bias < 0.5) {
    add({ id: 'r5', node: 'imu', entry: '7A002.a.1.a', kind: 'CCL', reason: 'NS Column 1 · bias stability under 0.5 °/h → 7A003.d.1 → 9A012.a.5', number: 'bias stability ' + imu.bias + ' °/h < 0.5 °/h', sentence: 'a.1.a. A bias stability of less than 0.5° per hour (one month, with respect to a fixed calibration value);', ecfr: E, eff: '2024-04-15', fr: '89 FR 27430 · rate range < 500 °/s (chapeau)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A002', atoms: ['bias ' + imu.bias + ' · one month · fixed calibration value · source: brochure p.2 bytes 1412–1420'], cols: 'NS1' });
    add({ id: 'r5mt', node: 'imu', entry: '7A102.a', kind: 'CCL', reason: 'MT · drift-rate stability (1 σ) under 0.5 °/h · STA barred', number: 'drift-rate stability ' + imu.bias + ' °/h < 0.5 °/h', sentence: 'Gyros usable in the systems in 9A012 or 9A112, having a rated drift rate stability of less than 0.5° (1 sigma or rms) per hour;', ecfr: E, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A102', atoms: [], cols: 'MT' });
    add({ id: 'r5p', node: 'airframe', entry: '9A012.a.5', kind: 'CCL', reason: 'P1 child pulls parent · incorporates a 7A00x inertial part', number: 'propagated from IMU', sentence: 'a.5. Incorporating inertial navigation or guidance equipment controlled by 7A002 or 7A003;', ecfr: E, eff: '2026-08-13', fr: '91 FR 52501 · propagation P1', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['child: IMU · 7A002.a.1.a'], cols: 'NS1' });
  }
  const arw = imu.arw;
  if (arw == null) cannot.push({ id: 'c-arw', node: 'imu', entry: '7A002.a.1.b', text: 'cannot fire · angle random walk not published' });
  else if (arw < 0.001) {
    add({ id: 'r6u', node: 'imu', entry: 'USML XII(e)(12)(i)', kind: 'USML', reason: 'defense article · ARW under 0.001 °/√h', number: 'ARW ' + arw + ' °/√h < 0.001 °/√h', sentence: '(i) Gyroscopes … having an angle random walk of less than 0.001 degrees per square root hour;', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1 · CN: DENIAL · 126.1(d)(1)', url: 'ecfr.gov/…/title-22/part-121 · XII(e)', atoms: ['arw ' + arw + (imuReal === false ? ' · SYNTHETIC part; the row is a fixture' : '')], cols: 'USML' });
  } else if (arw <= 0.0035) add({ id: 'r6', node: 'imu', entry: '7A002.a.1.b', kind: 'CCL', reason: 'NS Column 1 · angle random walk at or under 0.0035 °/√h', number: 'ARW ' + arw + ' °/√h ≤ 0.0035 °/√h', sentence: 'a.1.b. An angle random walk of 0.0035° per square root hour or less;', ecfr: E, eff: '2024-04-15', fr: '89 FR 27430', url: 'ecfr.gov/…/part-774/supplement-1 · 7A002', atoms: ['arw ' + arw + ' · source: datasheet p.3'], cols: 'NS1' });
  const ab = imu.accel_bias;
  if (ab === undefined && d.parts.imu) cannot.push({ id: 'c-acc', node: 'imu', entry: '7A001.a.1.a', text: 'cannot fire · accelerometer bias stability not published' });
  else if (ab != null) {
    if (ab < 10) add({ id: 'r7u', node: 'imu', entry: 'USML XII(e)(11)', kind: 'USML', reason: 'defense article · accelerometer bias stability under 10 µg', number: 'accel bias ' + ab + ' µg < 10 µg', sentence: '(11) Accelerometers … having a bias repeatability of less than 10 micro g;', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1', url: 'ecfr.gov/…/title-22/part-121 · XII(e)', atoms: ['accel_bias ' + ab], cols: 'USML' });
    else if (ab < 130) { add({ id: 'r7', node: 'imu', entry: '7A001.a.1.a', kind: 'CCL', reason: 'NS Column 1 · accelerometer bias stability under 130 µg per year', number: 'accel bias ' + ab + ' µg/yr < 130 µg/yr', sentence: 'a.1.a. A “bias” “stability” of less (better) than 130 micro g with respect to a fixed calibration value over a period of one year;', ecfr: E, eff: '2024-04-15', fr: '89 FR 27430', url: 'ecfr.gov/…/part-774/supplement-1 · 7A001', atoms: ['accel_bias ' + ab + ' µg/yr'], cols: 'NS1' }); add({ id: 'r7mt', node: 'imu', entry: '7A101.a', kind: 'CCL', reason: 'MT · accelerometer bias under 1250 µg and 1250 ppm · STA barred', number: 'accel bias ' + ab + ' µg < 1250 µg', sentence: 'Accelerometers … having a bias repeatability of less (better) than 1250 micro g;', ecfr: E, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A101', atoms: [], cols: 'MT' }); }
    else if (ab < 1250) add({ id: 'r7mt', node: 'imu', entry: '7A101.a', kind: 'CCL', reason: 'MT · accelerometer bias under 1250 µg', number: 'accel bias ' + ab + ' µg < 1250 µg', sentence: 'Accelerometers … having a bias repeatability of less (better) than 1250 micro g;', ecfr: E, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A101', atoms: [], cols: 'MT' });
  }

  // Row 8 · GNSS
  if (d.parts.gnss) {
    if (gnss.gnss_pps) add({ id: 'r8u', node: 'gnss', entry: 'USML XII(d)(2)(ii)', kind: 'USML', reason: 'defense article · PPS / M-code decryption', number: 'PPS decryption: declared present', sentence: '(ii) … capable of decrypting GNSS precise positioning service (PPS) signals;', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1 · CN: DENIAL', url: 'ecfr.gov/…/title-22/part-121 · XII(d)', atoms: ['gnss_pps true · SYNTHETIC part'], cols: 'USML' });
    if ((gnss.gnss_speed ?? 0) > 600) add({ id: 'r8mt', node: 'gnss', entry: '7A105.b.1', kind: 'CCL', reason: 'MT · designed for velocities over 600 m/s · the USML entry carries the same line; the panel shows why the EAR row fired', number: 'velocity ' + gnss.gnss_speed + ' m/s > 600 m/s', sentence: 'b.1. Designed or modified for use in … operating at velocities in excess of 600 m/s;', ecfr: E, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A105', atoms: ['gnss_speed ' + gnss.gnss_speed], cols: 'MT' });
    if (gnss.gnss_antijam) add({ id: 'r8aj', node: 'gnss', entry: '7A105.b.3', kind: 'CCL', reason: 'MT · anti-jam null steering', number: 'anti-jam: declared present', sentence: 'b.3. Designed or modified for … nulling antennas … to resist jamming;', ecfr: E, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A105', atoms: ['gnss_antijam true'], cols: 'MT' });
    if (gnss.gnss_adaptive) {
      if (decl.civil_gnss_service) advisories.push({ id: 'a-gnss', node: 'gnss', entry: '7A005.b · Note', text: 'adaptive antenna present, but the civil-service carve-out is declared (Note to 7A005): the row does not fire · declared, badged' });
      else add({ id: 'r8', node: 'gnss', entry: '7A005.b', kind: 'CCL', reason: 'NS Column 1 · adaptive (controlled reception pattern) antenna · civil-service carve-out not declared', number: 'adaptive antenna: declared present', sentence: 'b. Employing adaptive antenna systems;', ecfr: E, eff: '2024-04-15', fr: '89 FR 27430 · civil GNSS service carve-out is a declared fact', url: 'ecfr.gov/…/part-774/supplement-1 · 7A005', atoms: ['gnss_adaptive true'], cols: 'NS1' });
    }
  } else cannot.push({ id: 'c-gnss', node: 'gnss', entry: '7A005.b', text: 'cannot fire · field empty (GNSS features)' });

  // Row 9 · IC temperature grade
  if (fc.tmin == null || fc.tmax == null) cannot.push({ id: 'c-fc', node: 'fc', entry: '3A001.a.2', text: 'cannot fire · field empty (temperature grade)' });
  else if (fc.tmax > 125 || fc.tmin < -55) add({ id: 'r9', node: 'fc', entry: '3A001.a.2', kind: 'CCL', reason: 'NS Column 2 · rated for operation outside −55 °C … +125 °C · automotive carve-out shown crossed out', number: 'operating range ' + fc.tmin + ' … ' + fc.tmax + ' °C', sentence: 'a.2. Integrated circuits … rated for operation at an ambient temperature above 398 K (125 °C) or below 218 K (−55 °C);', ecfr: E, eff: '2024-04-15', fr: '89 FR 27430 · synthetic fixture row; check the exact chapeau before relying on it', url: 'ecfr.gov/…/part-774/supplement-1 · 3A001', atoms: ['tmin ' + fc.tmin + ' · tmax ' + fc.tmax + ' · typed in the spec'], cols: 'NS2' });

  // Row 10 · datalink crypto
  if (d.parts.datalink) {
    const bits = dl.crypto_bits ?? 0;
    if (bits > 56 && !decl.mass_market) add({ id: 'r10', node: 'datalink', entry: '5A002.a', kind: 'CCL', reason: 'NS Column 1 + EI · key > 56 bits · mass-market not declared', number: 'key ' + bits + ' bits > 56 bits', sentence: 'a. Designed or modified to use “cryptography for data confidentiality” having a “described security algorithm” …', ecfr: E, eff: '2021-03-29', fr: '86 FR 16482 · 740.17(b) mass-market is a declared fact', url: 'ecfr.gov/…/part-774/supplement-1 · 5A002', atoms: ['crypto_bits ' + bits + ' · mass_market false'], cols: 'EI' });
    else if (bits > 56) advisories.push({ id: 'a-dl', node: 'datalink', entry: '5A992.c', text: 'AES-' + bits + ' declared mass-market (740.17(b)) · 5A992.c · vendor self-classification, NLR · declared, badged', severity: 'info' });
  } else cannot.push({ id: 'c-dl', node: 'datalink', entry: '5A002.a', text: 'cannot fire · field empty (key length)' });

  // Row 12 · board target
  if (d.parts.fc) {
    if (decl.board_target === '600-series UAV') add({ id: 'r12', node: 'fc', entry: '3A611.g', kind: 'CCL', reason: 'NS Column 1 + RS Column 1 · layout target 600-series UAV · LVS $1,500 · layout is the only characteristic evaluated (Note)', number: 'board_target: 600-series UAV', sentence: 'g. Printed circuit boards … “specially designed” for a commodity controlled by 3A611 or a defense article …', ecfr: E, eff: '2024-04-15', fr: 'connectors under a 600-series parent print 3A611.y.1; heat sinks 3A611.y.3 · .y parts never green', url: 'ecfr.gov/…/part-774/supplement-1 · 3A611', atoms: ['declared board_target'], cols: 'SIX' });
    else if (decl.board_target === 'USML article') add({ id: 'r12u', node: 'fc', entry: 'USML XI(c)(2)', kind: 'USML', reason: 'defense article · layout target USML article', number: 'board_target: USML article', sentence: '(2) Printed circuit boards … specially designed for defense articles …', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1', url: 'ecfr.gov/…/title-22/part-121 · XI(c)', atoms: ['declared board_target'], cols: 'USML' });
    else advisories.push({ id: 'a-board', node: 'fc', entry: '9A991.d', text: 'layout target civil UAV · 9A991.d · AT only · declared', severity: 'info' });
  }

  // Row 13 · used on, for the pod
  if (d.parts.pod) {
    const listed = decl.used_on.filter((u) => LISTED_AIRCRAFT.includes(u.aircraft));
    const unlisted = decl.used_on.filter((u) => !LISTED_AIRCRAFT.includes(u.aircraft));
    if (listed.length) add({ id: 'r13', node: 'pod', entry: 'USML VIII(h)(1)', kind: 'USML', reason: 'defense article · declared used on ' + listed.map((u) => u.aircraft).join(', ') + ' · 120.41(a)(2) · the (b)(3) open fact is printed, never decided', number: 'used_on: ' + listed.map((u) => u.aircraft + (u.document_ref ? ' (' + u.document_ref + ')' : ' (no document ref)')).join(', '), sentence: '(h)(1) Parts, components, accessories, and attachments … specially designed for … aircraft enumerated in paragraph (a) …', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1 · 120.41(a)(2) · (b)(3): a production, non-USML equivalent releases only if named', url: 'ecfr.gov/…/title-22/part-121 · VIII(h)', atoms: ['declared fact · nothing physical changed'], cols: 'USML' });
    else if (unlisted.length) add({ id: 'r13x', node: 'pod', entry: '9A610.x', kind: 'CCL', reason: 'NS Column 1 + RS Column 1 · used on an in-production unlisted aircraft · 772.1 (b)(3) line', number: 'used_on: ' + unlisted.map((u) => u.aircraft).join(', '), sentence: 'x. “Parts,” “components,” “accessories” and “attachments” that are “specially designed” for a commodity subject to control in this ECCN …', ecfr: E, eff: '2024-04-15', fr: '600-series · second host F-16 → 9A610.x', url: 'ecfr.gov/…/part-774/supplement-1 · 9A610', atoms: ['declared fact'], cols: 'SIX' });
  }

  // Row 14 · component origin PRC · amber, never red · USG-buyer column
  for (const slot of SLOTS) {
    const pid = d.parts[slot];
    if (pid && CATALOG[pid].origin === 'CN') advisories.push({ id: 'a-prc-' + slot, node: slot, entry: '§848 · ASDA · FCC Covered List', text: 'PRC-origin ' + CATALOG[pid].name + ' · §848 FY2020 NDAA (class deviation) · American Security Drone Act · FCC Covered List, 47 CFR 2.903(a) · amber, never red · who may buy the finished product, separate from export control' });
  }

  // P2 see-through: any USML leaf makes every ancestor print the sentence
  const usmlChildren = rules.filter((r) => r.kind === 'USML' && r.node !== 'airframe');
  if (usmlChildren.length) add({ id: 'r-see', node: 'airframe', entry: '120.11(c) see-through', kind: 'USML', reason: 'contains defense article; DDTC approval for the incorporated part', number: 'propagated from ' + [...new Set(usmlChildren.map((r) => r.node))].join(', '), sentence: 'A defense article incorporated into a civil item remains a defense article.', ecfr: E, eff: '2022-09-06', fr: '22 CFR 120.11(c) · P2 see-through', url: 'ecfr.gov/…/title-22/part-120 · 120.11', atoms: [decl.designed_to_incorporate ? 'VIII(a)(5) via declared designed_to_incorporate · 120.3 Note 2: the incorporation itself is the design intent' : 'VIII(a)(5) only via declared designed_to_incorporate · not declared'], cols: 'USML' });
  if (decl.designed_to_incorporate && usmlChildren.length) add({ id: 'r-a5', node: 'airframe', entry: 'USML VIII(a)(5)', kind: 'USML', reason: 'declared designed to incorporate a defense article · 120.3 Note 2', number: 'declared designed_to_incorporate', sentence: '(5) Unmanned aerial vehicles … specially designed to incorporate a defense article;', ecfr: E, eff: '2023-09-14', fr: '22 CFR 121.1 · 120.3 Note 2 sentence on the card', url: 'ecfr.gov/…/title-22/part-121 · VIII(a)', atoms: ['declared fact'], cols: 'USML' });

  // Country Chart per node: strictest column set of every entry met
  const merged = {} as Record<Node, DestCell[]>;
  for (const n of Object.keys(cols) as Node[]) {
    merged[n] = DEST.map((dc) => {
      let best: [DestWord, string] | null = null;
      for (const set of cols[n]) { const c = CELLS[set][dc]; if (!best || LEVEL[c[0]] > LEVEL[best[0]]) best = c; }
      const b = best as [DestWord, string];
      return { code: dc, word: b[0], para: b[1], tone: TONE[b[0]] };
    });
  }

  // P4 de minimis: only when final assembly is outside the US
  const partsPlaced = SLOTS.filter((s) => d.parts[s]).map((s) => ({ slot: s, part: CATALOG[d.parts[s] as PartId] }));
  const totalValue = partsPlaced.reduce((sum, p) => sum + p.part.value_usd, 0) + 210;
  const usContent = partsPlaced.filter((p) => p.part.origin === 'US').reduce((sum, p) => sum + p.part.value_usd, 0) + 210;
  let deMinimis: DeMinimis[] | null = null;
  if (decl.final_assembly_country !== 'US') {
    const sixHundred = rules.some((r) => r.cols === 'SIX');
    deMinimis = DEST.map((dc) => {
      const num = partsPlaced.filter((p) => p.part.origin === 'US' && merged[p.slot].find((c) => c.code === dc)?.word === 'LIC').reduce((sum, p) => sum + p.part.value_usd, 0);
      const pct = totalValue ? (num / totalValue) * 100 : 0;
      const threshold = dc === 'CN' && sixHundred ? 0 : 25;
      return { code: dc, subject_to_EAR: pct > threshold, us_controlled_pct: pct, threshold, because: 'US-origin parts whose own ' + dc + ' state is LIC: $' + num.toFixed(0) + ' of $' + totalValue.toFixed(0) + (threshold === 0 ? ' · 600-series to the PRC: 0 % (734.4(a)(6))' : ' · 25 % default (734.4(d))') };
    });
  }

  // Duty rows on the product node (the drone coming home)
  const thermalPresent = !!d.parts.thermal;
  const abroad = decl.final_assembly_country !== 'US';
  const credit = abroad ? usContent : 0;
  const dutiable = Math.max(0, totalValue - credit);
  const duty: DutyRow[] = [
    { id: 'BASE', label: 'HTS 8806.23 · unmanned aircraft, MTOW 7–25 kg', rate: 'Free', amount: 0, note: abroad ? 'general column' : 'domestic assembly · no entry', fired: true, printOnly: false, citation: 'HTS 2026 rev 9' },
    thermalPresent
      ? { id: '232-UAS-THERMAL', label: 'Section 232 · unmanned aircraft with thermal imaging', rate: '+100 %', amount: abroad ? dutiable : null, note: 'any_descendant part_class = thermal_imager · note 43(c)(3)', fired: abroad, printOnly: false, citation: '91 FR 53699 · effective 2026-09-03' }
      : { id: '232-UAS-NOTHERMAL', label: 'Section 232 · unmanned aircraft without thermal imaging', rate: '+25 %', amount: abroad ? dutiable * 0.25 : null, note: 'no thermal imager in the tree', fired: abroad, printOnly: false, citation: '91 FR 53699 · effective 2026-09-03' },
    { id: '232-UAS-ALLIED-CAP', label: 'Section 232 · allied content cap', rate: '15 % (not reportable per CSMS #69738151, 2026-09-02)', amount: null, note: decl.allied_content_certified ? 'allied content certified · declared' : 'never fired this weekend · the Annex is an image', fired: false, printOnly: true, citation: 'CSMS #69738151' },
    { id: '232-UAS-BLUE-DELAY', label: 'Section 232 · Blue UAS delay', rate: 'delayed', amount: null, note: decl.blue_uas_listed ? 'Blue UAS listed 2026-09-02 · declared' : 'not listed', fired: abroad && decl.blue_uas_listed, printOnly: false, citation: '91 FR 53699' },
    { id: '301-TW', label: 'Section 301 · Taiwan', rate: '+10 %', amount: abroad && !decl.faa_44704_certificate ? dutiable * 0.1 : null, note: decl.faa_44704_certificate ? 'FAA 44704 certificate declared · not applied' : 'origin TW · column-1 < 10 % · no FAA certificate', fired: abroad && !decl.faa_44704_certificate, printOnly: false, citation: 'HTS note 52 · 91 FR 47318' },
    { id: '9802-US-CONTENT', label: 'US content credit · 9802.00.80', rate: 'credit', amount: abroad ? -credit : null, note: 'Σ value of US-origin parts assembled abroad · applied to the 232 and 301 add-ons · pointer to the assembler’s declaration', fired: abroad, printOnly: false, citation: 'HTS 9802.00.80' },
    { id: '232-UAS-DRAWBACK', label: 'Section 232 · drawback', rate: 'not available', amount: null, note: 'printed, not evaluated', fired: false, printOnly: true, citation: '91 FR 53699' },
    { id: '232-UAS-PARTS-2027', label: 'Section 232 · parts phase', rate: 'from 2027-01-01', amount: null, note: 'date only · printed, not evaluated', fired: false, printOnly: true, citation: '91 FR 53699' },
    { id: 'FCC-COVERED-LIST', label: 'FCC Covered List', rate: 'authorization', amount: null, note: abroad && !decl.fcc_dow_dhs_determination ? 'assembly ≠ US and no DoW/DHS determination · barred from new authorization · amber' : decl.fcc_dow_dhs_determination ? 'DoW/DHS determination declared' : 'domestic assembly', fired: abroad && !decl.fcc_dow_dhs_determination, printOnly: false, citation: '47 CFR 2.903(a)' },
    { id: 'ORIGIN-RULE', label: 'Origin rule', rate: 'not decided', amount: null, note: 'H339851 (substantial transformation of a UAS on assembly) vs N352538 · the tool never decides origin', fired: false, printOnly: true, citation: 'CBP rulings H339851 · N352538' },
  ];
  const destinations = [
    { code: 'CA' as DestCode, text: 'Free · CUSMA · 8806.23' },
    { code: 'DE' as DestCode, text: '0 % (unverified) · EU' },
    { code: 'TW' as DestCode, text: 'SHTC export permit, Foreign Trade Act Art. 13: not modelled' },
    { code: 'VN' as DestCode, text: 'import licence: Decree 288/2025 Art. 6' },
    { code: 'CN' as DestCode, text: '0 % (unverified)' },
  ];

  return { rules, cannot, advisories, cols: merged, cruiseW, endurance, range, keys: rules.map((r) => r.entry), pack: packId, deMinimis, duty: { rows: duty, declaredValue: totalValue, usContent, destinations } };
}

/** Symmetric difference of fired entry keys between two outcomes. */
export function countChanged(before: Outcome, after: Outcome): number {
  const a = new Set(before.keys), b = new Set(after.keys);
  let changed = 0;
  a.forEach((k) => { if (!b.has(k)) changed++; });
  b.forEach((k) => { if (!a.has(k)) changed++; });
  return changed;
}
export function changedKeys(before: Outcome, after: Outcome): string[] {
  const a = new Set(before.keys), b = new Set(after.keys);
  return [...new Set([...[...a].filter((k) => !b.has(k)), ...[...b].filter((k) => !a.has(k))])];
}
