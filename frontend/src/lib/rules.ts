// Local synthetic stand-in for the service's rule engine. It exists so the
// shell renders an outcome before the seam is wired; the real evaluation is
// `backend/app/engine` and the browser will render its response verbatim.
import {
  CELLS, DEST, ECFR_DATE, LEVEL, TONE,
  type ColSet, type DestCode, type DestWord, type Node, type PartAttrs, type PartId, type Slot, type Tone,
} from './catalog';

export type RuleKind = 'CCL' | 'USML';
export interface Rule {
  id: string; node: Node; entry: string; kind: RuleKind; reason: string; number: string; sentence: string;
  ecfr: string; eff: string; fr: string; url: string; atoms: string[]; cols?: ColSet;
}
export interface CannotFire { id: string; node: Node; entry: string; text: string }
export interface DestCell { code: DestCode; word: DestWord; para: string; tone: Tone }
export interface Outcome {
  rules: Rule[];
  cannot: CannotFire[];
  cols: Record<Node, DestCell[]>;
  cruiseW: number;
  endurance: number | null;
  range: number | null;
  keys: string[];
}

export type Parts = Record<Slot, PartId | null>;
export type Attrs = Record<Slot, PartAttrs>;
/** What the engine reads: which part sits in each slot, that part's current (editable) attributes, and the span. */
export interface Design { parts: Parts; attrs: Attrs; span: number }

const f2 = (n: number) => n.toFixed(2);

export function cruiseWatts(span: number): number {
  return 200 + 120 * Math.pow(3 / span, 2);
}

export function outcome(d: Design): Outcome {
  const { span } = d;
  const rules: Rule[] = [], cannot: CannotFire[] = [];
  const cols: Record<Node, ColSet[]> = { airframe: ['NLR'], battery: ['NLR'], thermal: ['NLR'], imu: ['NLR'], fc: ['NLR'] };
  const bat = d.attrs.battery, th = d.attrs.thermal, imu = d.attrs.imu, fc = d.attrs.fc;
  const cruiseW = cruiseWatts(span);
  const wh = bat.pack_wh;
  const endurance = wh ? (wh * 0.8) / cruiseW : null;
  const range = endurance != null ? endurance * 90 : null;
  const add = (r: Rule) => { rules.push(r); if (r.cols) cols[r.node].push(r.cols); };

  if (!wh || endurance == null || range == null) {
    cannot.push({ id: 'c-bat', node: 'battery', entry: '9A012.a.2', text: 'cannot fire — field empty (pack energy)' });
    cannot.push({ id: 'c-bat2', node: 'battery', entry: '3A001.e.1.b', text: 'cannot fire — field empty (cell energy density)' });
  } else {
    if (endurance >= 3) add({ id: 'r1', node: 'airframe', entry: '9A012.a.2', kind: 'CCL', reason: 'NS Column 1 · endurance crossed 3.0 h', number: 'endurance ' + f2(endurance) + ' h ≥ 3.0 h', sentence: '“Unmanned aerial vehicles” having any of the following: … a.2. An endurance of 3 hours or greater;', ecfr: ECFR_DATE, eff: '2026-08-13', fr: '91 FR 52501, published 2026-08-14 · NS1 line was 1 h; the 30 min tier removed', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['pack_wh ' + wh.toLocaleString() + ' × 0.80 / cruise_W ' + cruiseW.toFixed(0) + ' W = ' + f2(endurance) + ' h (declared simplification)'], cols: 'NS1' });
    if (range >= 300) add({ id: 'r2', node: 'airframe', entry: '9A012 MT', kind: 'CCL', reason: 'MT · range crossed 300 km, regardless of payload', number: 'range ' + range.toFixed(0) + ' km ≥ 300 km', sentence: 'Capable of a range of 300 km or greater, regardless of payload.', ecfr: ECFR_DATE, eff: '2026-08-13', fr: '742.5(a)(2) 500 kg line kept separate · STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012 MT', atoms: ['range = ' + f2(endurance) + ' h × 90 km/h (declared cruise speed) = ' + range.toFixed(0) + ' km'], cols: 'MT' });
    if ((bat.wh_kg ?? 0) > 350) add({ id: 'r11', node: 'battery', entry: '3A001.e.1.b', kind: 'CCL', reason: 'NS Column 2 · cell energy density; the pack row stays green (Note)', number: 'cell ' + bat.wh_kg + ' Wh/kg > 350 Wh/kg', sentence: 'Rechargeable cells having an energy density exceeding 350 Wh/kg at 20 °C;', ecfr: ECFR_DATE, eff: '2023-05-17', fr: '88 FR 31445 · Note: the pack is not a cell', url: 'ecfr.gov/…/part-774/supplement-1 · 3A001', atoms: ['wh_kg ' + bat.wh_kg + ' · source: vendor datasheet p.1'], cols: 'NS2' });
  }

  if (th.hz == null) {
    cannot.push({ id: 'c-th', node: 'thermal', entry: '6A003.b.4.b', text: 'cannot fire — field empty (frame rate)' });
  } else {
    if (th.hz > 9) {
      add({ id: 'r3', node: 'thermal', entry: '6A003.b.4.b', kind: 'CCL', reason: 'NS Column 2 · frame rate crossed 9 Hz', number: 'frame rate ' + th.hz + ' Hz > 9 Hz', sentence: 'b.4.b. Having a frame rate of more than 9 Hz;', ecfr: ECFR_DATE, eff: '2020-10-05', fr: '85 FR 62583', url: 'ecfr.gov/…/part-774/supplement-1 · 6A003', atoms: ['hz ' + th.hz + ' · source: datasheet bytes 2210–2214'], cols: 'NS2' });
      add({ id: 'r3p', node: 'airframe', entry: '9A012.a.3', kind: 'CCL', reason: 'P1 child pulls parent · incorporates a 6A003.b.4.b imaging core', number: 'propagated from thermal core', sentence: 'a.3. Incorporating imaging equipment controlled by 6A003;', ecfr: ECFR_DATE, eff: '2026-08-13', fr: '91 FR 52501 · propagation P1', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['child: thermal core · 6A003.b.4.b'], cols: 'NS1' });
    }
    const elements = th.elements ?? 0;
    if (elements > 111000 || th.hz > 60) add({ id: 'r4', node: 'thermal', entry: '6A003 RS1', kind: 'CCL', reason: 'RS Column 1 · elements; “embedded in a civil product” clause printed, not evaluated', number: elements.toLocaleString() + ' elements > 111,000', sentence: 'Having more than 111,000 elements or a frame rate exceeding 60 Hz;', ecfr: ECFR_DATE, eff: '2020-10-05', fr: '85 FR 62583 · ‡ Note on embedding in a civil product: printed, not evaluated', url: 'ecfr.gov/…/part-774/supplement-1 · 6A003', atoms: ['elements ' + th.px + ' = ' + elements.toLocaleString()], cols: 'NS2' });
  }

  if (imu.bias == null) {
    cannot.push({ id: 'c-imu', node: 'imu', entry: '7A002.a.1.a', text: imu.inrun != null ? 'cannot fire — one-month bias stability not published (vendor quotes in-run bias instability ' + imu.inrun + ' °/h, not the field the rule reads)' : 'cannot fire — field empty (bias stability)' });
    cannot.push({ id: 'c-mt', node: 'imu', entry: '7A102.a MT', text: 'cannot fire — drift-rate stability (1 σ) not published' });
  } else {
    const bias = imu.bias;
    if (bias < 0.5) {
      add({ id: 'r5', node: 'imu', entry: '7A002.a.1.a', kind: 'CCL', reason: 'NS Column 1 · bias stability under 0.5 °/h → 7A003.d.1 → 9A012.a.5', number: 'bias stability ' + bias + ' °/h < 0.5 °/h', sentence: 'a.1.a. A bias stability of less than 0.5° per hour (one month, with respect to a fixed calibration value);', ecfr: ECFR_DATE, eff: '2024-04-15', fr: '89 FR 27430 · rate range < 500 °/s (chapeau)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A002', atoms: ['bias ' + bias + ' · one month · fixed calibration value · source: brochure p.2 bytes 1412–1420'], cols: 'NS1' });
      add({ id: 'r5mt', node: 'imu', entry: '7A102.a', kind: 'CCL', reason: 'MT · drift-rate stability (1 σ) under 0.5 °/h · STA barred', number: 'drift-rate stability ' + bias + ' °/h < 0.5 °/h', sentence: 'Gyros usable in the systems in 9A012 or 9A112, having a rated drift rate stability of less than 0.5° (1 sigma or rms) per hour;', ecfr: ECFR_DATE, eff: '2024-04-15', fr: 'STA barred, 740.20(b)(2)(iii)', url: 'ecfr.gov/…/part-774/supplement-1 · 7A102', atoms: [], cols: 'MT' });
      add({ id: 'r5p', node: 'airframe', entry: '9A012.a.5', kind: 'CCL', reason: 'P1 child pulls parent · incorporates a 7A00x inertial part', number: 'propagated from IMU', sentence: 'a.5. Incorporating inertial navigation or guidance equipment controlled by 7A002 or 7A003;', ecfr: ECFR_DATE, eff: '2026-08-13', fr: '91 FR 52501 · propagation P1', url: 'ecfr.gov/…/part-774/supplement-1 · 9A012', atoms: ['child: IMU · 7A002.a.1.a'], cols: 'NS1' });
    }
  }
  const arw = imu.arw;
  if (arw == null) {
    cannot.push({ id: 'c-arw', node: 'imu', entry: '7A002.a.1.b', text: 'cannot fire — angle random walk not published' });
  } else if (arw < 0.001) {
    add({ id: 'r6u', node: 'imu', entry: 'USML XII(e)(12)(i)', kind: 'USML', reason: 'defense article · ARW under 0.001 °/√h', number: 'ARW ' + arw + ' °/√h < 0.001 °/√h', sentence: '(i) Gyroscopes … having an angle random walk of less than 0.001 degrees per square root hour;', ecfr: ECFR_DATE, eff: '2023-09-14', fr: '22 CFR 121.1 · CN: DENIAL — 126.1(d)(1)', url: 'ecfr.gov/…/title-22/part-121 · XII(e)', atoms: ['arw ' + arw + ' · SYNTHETIC part; the row is a fixture'], cols: 'USML' });
    add({ id: 'r6see', node: 'airframe', entry: '120.11(c) see-through', kind: 'USML', reason: 'contains defense article; DDTC approval for the incorporated part', number: 'propagated from IMU', sentence: 'A defense article incorporated into a civil item remains a defense article.', ecfr: ECFR_DATE, eff: '2022-09-06', fr: '22 CFR 120.11(c) · P2 see-through', url: 'ecfr.gov/…/title-22/part-120 · 120.11', atoms: ['VIII(a)(5) only via declared designed_to_incorporate — not declared'], cols: 'USML' });
  } else if (arw <= 0.0035) {
    add({ id: 'r6', node: 'imu', entry: '7A002.a.1.b', kind: 'CCL', reason: 'NS Column 1 · angle random walk at or under 0.0035 °/√h', number: 'ARW ' + arw + ' °/√h ≤ 0.0035 °/√h', sentence: 'a.1.b. An angle random walk of 0.0035° per square root hour or less;', ecfr: ECFR_DATE, eff: '2024-04-15', fr: '89 FR 27430', url: 'ecfr.gov/…/part-774/supplement-1 · 7A002', atoms: ['arw ' + arw + ' · source: datasheet p.3'], cols: 'NS1' });
  }

  if (fc.tmin == null || fc.tmax == null) cannot.push({ id: 'c-fc', node: 'fc', entry: '3A001.a.2', text: 'cannot fire — field empty (temperature grade)' });
  else if (fc.tmax > 125 || fc.tmin < -55) add({ id: 'r7', node: 'fc', entry: '3A001.a.2', kind: 'CCL', reason: 'NS Column 2 · rated for operation outside −55 °C … +125 °C', number: 'operating range ' + fc.tmin + ' … ' + fc.tmax + ' °C', sentence: 'a.2. Integrated circuits … rated for operation at an ambient temperature above 398 K (125 °C) or below 218 K (−55 °C);', ecfr: ECFR_DATE, eff: '2024-04-15', fr: '89 FR 27430 · synthetic fixture row; check the exact chapeau before relying on it', url: 'ecfr.gov/…/part-774/supplement-1 · 3A001', atoms: ['tmin ' + fc.tmin + ' · tmax ' + fc.tmax + ' · typed in the spec'], cols: 'NS2' });

  const merged = {} as Record<Node, DestCell[]>;
  for (const n of Object.keys(cols) as Node[]) {
    merged[n] = DEST.map((d) => {
      let best: [DestWord, string] | null = null;
      for (const set of cols[n]) { const c = CELLS[set][d]; if (!best || LEVEL[c[0]] > LEVEL[best[0]]) best = c; }
      const b = best as [DestWord, string];
      return { code: d, word: b[0], para: b[1], tone: TONE[b[0]] };
    });
  }
  return { rules, cannot, cols: merged, cruiseW, endurance, range, keys: rules.map((r) => r.entry) };
}

/** Symmetric difference of fired entry keys between two outcomes. */
export function countChanged(before: Outcome, after: Outcome): number {
  const a = new Set(before.keys), b = new Set(after.keys);
  let changed = 0;
  a.forEach((k) => { if (!b.has(k)) changed++; });
  b.forEach((k) => { if (!a.has(k)) changed++; });
  return changed;
}
