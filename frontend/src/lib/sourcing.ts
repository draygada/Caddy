// Sourcing lane, browser-side stand-in for backend/app/sourcing. Pure functions
// over committed-style fixtures: resolve offers, walk owners, screen names against a synthetic CSL fixture slice,
// roll up, estimate landed cost, gate on the engine's destination cell.
// Every number here is declared and dated; nothing is a determination.
import { CATALOG, CORE_SLOTS, type PartId, type Slot } from './catalog';
import { hashOf } from './hash';
import type { Outcome, Parts } from './rules';
import type { DestWord } from './catalog';

export type ShipTo = 'US' | 'TW' | 'DE' | 'CA';
export type Mode = 'air' | 'ocean';
export type OfferStatus = 'no_candidate_match' | 'review_required' | 'review_blocked' | 'abstained';
export const STATUS_RANK: Record<OfferStatus, number> = { no_candidate_match: 0, review_required: 1, abstained: 2, review_blocked: 3 };
export const STATUS_WORD: Record<OfferStatus, string> = { no_candidate_match: 'no candidate match', review_required: 'review required', abstained: 'abstained', review_blocked: 'review blocked' };
export const STATUS_COLOR: Record<OfferStatus, string> = { no_candidate_match: 'var(--green)', review_required: 'var(--amber)', abstained: 'var(--grey)', review_blocked: 'var(--red)' };

export const FIXTURES = {
  offers: 'offers@6e1a3c · retrieved 2026-09-04',
  ownership: 'ownership@b7d0f2 · retrieved 2026-09-04',
  tariff: 'tariff@3c02a7 · HTS 2026 rev 9 · effective 2026-09-03',
  csl: 'synthetic CSL fixture slice@91f4e8 · 2 fixture keys · 1 active match · 2026-09-04 06:00Z',
};

export interface Line {
  id: string;
  description: string;
  partClass: string;
  /** slot-backed line: swaps with the design; null for the fixed BOM */
  slot: Slot | null;
  qtyPerUnit: number;
  /** manufacturer's declared ECCN with source and date, or not yet classified */
  declaredEccn: string;
  heading: string;
  usdValue: number;
}

export interface Offer {
  id: string;
  lineId: string;
  seller: string;
  sellerCountry: string;
  shipFrom: string;
  declaredOrigin: string;
  unitPrice: number;
  stock: number;
  leadDays: number;
  moq: number;
  authorized: boolean;
  declaredEccn: string;
  declaredHts: string;
  synthetic: boolean;
  /** manufacturer behind the seller, for the walk */
  manufacturer: string;
}

export interface Owner { name: string; pct: number; relation: string; evidence: string; synthetic?: boolean }
export type PartyNode = { name: string; role: 'seller' | 'manufacturer' | 'owner'; pct?: number; screening: 'exact' | 'normalized' | 'none' | 'abstained'; listed?: string; children: PartyNode[]; unknown?: boolean };

const SLOT_LINE: Record<Slot, Omit<Line, 'id' | 'slot' | 'declaredEccn' | 'usdValue'>> = {
  battery: { description: 'Battery pack', partClass: 'pack', qtyPerUnit: 1, heading: '8507.60' },
  thermal: { description: 'Thermal imaging core', partClass: 'thermal_imager', qtyPerUnit: 1, heading: '8525.89' },
  imu: { description: 'Inertial measurement unit', partClass: 'sensor', qtyPerUnit: 1, heading: '9014.20' },
  fc: { description: 'Flight controller MCU', partClass: 'ic', qtyPerUnit: 1, heading: '8542.31' },
  gnss: { description: 'GNSS receiver module', partClass: 'gnss', qtyPerUnit: 1, heading: '8526.91' },
  datalink: { description: 'Datalink radio', partClass: 'radio', qtyPerUnit: 1, heading: '8517.62' },
  pod: { description: 'Sensor pod · gimbal', partClass: 'payload', qtyPerUnit: 1, heading: '9013.80' },
  camera: { description: 'EO camera module', partClass: 'camera', qtyPerUnit: 1, heading: '8525.89' },
  lidar: { description: 'LiDAR rangefinder', partClass: 'sensor', qtyPerUnit: 1, heading: '9015.10' },
  esc: { description: 'Motor controller', partClass: 'board', qtyPerUnit: 1, heading: '8504.40' },
  motor: { description: 'Propulsion motor', partClass: 'motor', qtyPerUnit: 1, heading: '8501.31' },
  servo: { description: 'Control-surface servo', partClass: 'actuator', qtyPerUnit: 4, heading: '8501.10' },
  airspeed: { description: 'Airspeed sensor', partClass: 'sensor', qtyPerUnit: 1, heading: '9026.20' },
  transponder: { description: 'ADS-B transponder', partClass: 'radio', qtyPerUnit: 1, heading: '8526.10' },
  companion: { description: 'Companion computer', partClass: 'board', qtyPerUnit: 1, heading: '8471.50' },
  antenna: { description: 'Telemetry antenna', partClass: 'antenna', qtyPerUnit: 1, heading: '8517.71' },
  parachute: { description: 'Recovery parachute', partClass: 'recovery', qtyPerUnit: 1, heading: '8804.00' },
};
const PART_ECCN: Record<PartId, string> = {
  p45b: 'EAR99 · Molicel product page · 2026-08-20', amprius: 'EAR99 · Amprius spec sheet · 2026-08-22', lepton: '6A003.b.4.a · Teledyne FLIR · 2026-07-30', boson: '6A003.b.4.b · Teledyne FLIR · 2026-07-30',
  icm: 'EAR99 · TDK InvenSense · 2026-06-11', hg5700: '7A002.a.1.a · Honeywell · 2026-05-02', imung: 'not yet classified · SYNTHETIC part', acc120: 'not yet classified · SYNTHETIC part', h743: '3A991.a.2 · STMicroelectronics · 2026-03-15', h753: '5A992.c · STMicroelectronics self-classification · 2026-03-15', h743m: 'not yet classified · SYNTHETIC part',
  neom9n: '7A994 · u-blox · 2026-04-01', crpa: 'not yet classified · SYNTHETIC part', mcode: 'not yet classified · SYNTHETIC part', pmddl: '5A992.c · Microhard self-classification · 2026-02-19', aescustom: 'not yet classified · SYNTHETIC part', podeo: 'EAR99 · in-house',
  imx477: 'EAR99 · Sony product page · 2026-06-02', lw20: 'EAR99 · LightWare spec sheet · 2026-05-14', alpha80: 'EAR99 · T-Motor product page · 2026-04-22', at7215: 'EAR99 · T-Motor product page · 2026-04-22', hv6120: 'EAR99 · MKS product page · 2026-03-30',
  ms4525: 'EAR99 · TE Connectivity datasheet · 2026-02-11', ping200: '7A994 · uAvionix self-classification · 2026-05-05', orinnano: '4A994 · NVIDIA export page · 2026-06-18', hg2409p: 'EAR99 · L-com datasheet · 2026-01-27', ifc60: 'EAR99 · Fruity Chutes product page · 2026-03-03',
};
const PART_VALUE = (pid: PartId) => CATALOG[pid].value_usd;

const FIXED_LINES: Line[] = [
  { id: 'l-esc', description: 'Electronic speed controller', partClass: 'esc', slot: null, qtyPerUnit: 1, declaredEccn: 'EAR99 · declared by seller', heading: '8504.40', usdValue: 45 },
  { id: 'l-motor', description: 'Brushless motor · MN5008', partClass: 'motor', slot: null, qtyPerUnit: 1, declaredEccn: 'EAR99 · declared by seller', heading: '8501.31', usdValue: 60 },
  { id: 'l-prop', description: 'Propeller · pusher', partClass: 'propeller', slot: null, qtyPerUnit: 2, declaredEccn: 'EAR99 · declared by seller', heading: '8807.30', usdValue: 18 },
  { id: 'l-harness', description: 'Harness · connectors · fasteners', partClass: 'connector', slot: null, qtyPerUnit: 1, declaredEccn: 'EAR99 · declared by seller', heading: '8544.42', usdValue: 35 },
  { id: 'l-cells', description: 'Cells · 21700 spares', partClass: 'cell', slot: null, qtyPerUnit: 24, declaredEccn: 'EAR99 · declared by seller', heading: '8507.60', usdValue: 12 },
  { id: 'l-frame', description: 'Airframe · aluminium bracket', partClass: 'structure', slot: null, qtyPerUnit: 1, declaredEccn: 'EAR99 · in-house', heading: '8807.30', usdValue: 210 },
  { id: 'l-iomcu', description: 'IO MCU · STM32F100', partClass: 'ic', slot: null, qtyPerUnit: 1, declaredEccn: '3A991.a.2 · STMicroelectronics · 2026-03-15', heading: '8542.31', usdValue: 4 },
];

/** Twelve lines: the four slots follow the design, the other eight are the fixed BOM. */
export function linesFor(parts: Parts): Line[] {
  // every core slot gets a line (empty ones say so); library components only once a part is placed
  const slotLines: Line[] = (Object.keys(SLOT_LINE) as Slot[]).filter((slot) => (CORE_SLOTS as Slot[]).includes(slot) || parts[slot]).map((slot) => {
    const pid = parts[slot];
    const base = SLOT_LINE[slot];
    return { id: 'l-' + slot, slot, ...base, description: pid ? base.description + ' · ' + CATALOG[pid].name : base.description + ' · slot empty', declaredEccn: pid ? PART_ECCN[pid] : 'no part', usdValue: pid ? PART_VALUE(pid) : 0 };
  });
  // a placed motor controller or motor from the library replaces the fixed BOM's generic line for it
  const fixed = FIXED_LINES.filter((l) => !(l.id === 'l-esc' && parts.esc) && !(l.id === 'l-motor' && parts.motor));
  return [...slotLines, ...fixed];
}

/** ~20 offers over the lines. Real sellers with real absences; two synthetic sellers badged. */
export function offersFor(parts: Parts): Offer[] {
  const o: Offer[] = [];
  const add = (x: Omit<Offer, 'id'>) => o.push({ id: 'o' + (o.length + 1), ...x });
  const bat = parts.battery, th = parts.thermal, imu = parts.imu, fc = parts.fc, gn = parts.gnss, dl = parts.datalink, pod = parts.pod;
  if (bat === 'p45b') { add({ lineId: 'l-battery', seller: 'Molicel (E-One Moli Energy)', sellerCountry: 'TW', shipFrom: 'TW', declaredOrigin: 'TW', unitPrice: 288, stock: 40, leadDays: 14, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8507.60', synthetic: false, manufacturer: 'Molicel (E-One Moli Energy)' }); add({ lineId: 'l-battery', seller: 'Brightwing Components', sellerCountry: 'HK', shipFrom: 'HK', declaredOrigin: 'TW', unitPrice: 251, stock: 12, leadDays: 21, moq: 1, authorized: false, declaredEccn: 'EAR99', declaredHts: '8507.60', synthetic: true, manufacturer: 'Molicel (E-One Moli Energy)' }); }
  if (bat === 'amprius') { add({ lineId: 'l-battery', seller: 'Amprius Technologies', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 640, stock: 6, leadDays: 42, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8507.60', synthetic: false, manufacturer: 'Amprius Technologies' }); }
  if (th === 'lepton') { add({ lineId: 'l-thermal', seller: 'GroupGets', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 199, stock: 120, leadDays: 7, moq: 1, authorized: true, declaredEccn: '6A003.b.4.a', declaredHts: '8525.89', synthetic: false, manufacturer: 'Teledyne FLIR' }); add({ lineId: 'l-thermal', seller: 'Digi-Key Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 219, stock: 38, leadDays: 3, moq: 1, authorized: true, declaredEccn: '6A003.b.4.a', declaredHts: '8525.89', synthetic: false, manufacturer: 'Teledyne FLIR' }); }
  if (th === 'boson') { add({ lineId: 'l-thermal', seller: 'Teledyne FLIR', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 3450, stock: 4, leadDays: 28, moq: 1, authorized: true, declaredEccn: '6A003.b.4.b', declaredHts: '8525.89', synthetic: false, manufacturer: 'Teledyne FLIR' }); add({ lineId: 'l-thermal', seller: 'Nordkap Sensor AS', sellerCountry: 'NO', shipFrom: 'NO', declaredOrigin: 'US', unitPrice: 3290, stock: 2, leadDays: 35, moq: 1, authorized: false, declaredEccn: '6A003.b.4.b', declaredHts: '8525.89', synthetic: true, manufacturer: 'Teledyne FLIR' }); }
  if (imu === 'icm') { add({ lineId: 'l-imu', seller: 'Mouser Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 12.4, stock: 2400, leadDays: 2, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '9014.20', synthetic: false, manufacturer: 'TDK InvenSense' }); add({ lineId: 'l-imu', seller: 'Digi-Key Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 11.9, stock: 3100, leadDays: 3, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '9014.20', synthetic: false, manufacturer: 'TDK InvenSense' }); }
  if (imu === 'hg5700') add({ lineId: 'l-imu', seller: 'Honeywell Aerospace', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 6200, stock: 0, leadDays: 84, moq: 1, authorized: true, declaredEccn: '7A002.a.1.a', declaredHts: '9014.20', synthetic: false, manufacturer: 'Honeywell Aerospace' });
  if (imu === 'acc120') add({ lineId: 'l-imu', seller: 'synthetic vendor', sellerCountry: '·', shipFrom: 'US', declaredOrigin: '·', unitPrice: 3900, stock: 2, leadDays: 45, moq: 1, authorized: false, declaredEccn: 'not yet classified', declaredHts: '9014.20', synthetic: true, manufacturer: 'synthetic vendor' });
  if (imu === 'imung') add({ lineId: 'l-imu', seller: 'synthetic vendor', sellerCountry: '·', shipFrom: 'US', declaredOrigin: '·', unitPrice: 4800, stock: 1, leadDays: 60, moq: 1, authorized: false, declaredEccn: 'not yet classified', declaredHts: '9014.20', synthetic: true, manufacturer: 'synthetic vendor' });
  if (fc === 'h743m') add({ lineId: 'l-fc', seller: 'LCSC Electronics', sellerCountry: 'CN', shipFrom: 'CN', declaredOrigin: 'CN', unitPrice: 11, stock: 900, leadDays: 9, moq: 1, authorized: false, declaredEccn: 'EAR99', declaredHts: '8542.31', synthetic: true, manufacturer: 'synthetic vendor' });
  if (fc && fc !== 'h743m') { add({ lineId: 'l-fc', seller: 'Digi-Key Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'MY', unitPrice: fc === 'h753' ? 16.2 : 14.1, stock: 900, leadDays: 3, moq: 1, authorized: true, declaredEccn: fc === 'h753' ? '5A992.c' : '3A991.a.2', declaredHts: '8542.31', synthetic: false, manufacturer: 'STMicroelectronics' }); add({ lineId: 'l-fc', seller: 'LCSC Electronics', sellerCountry: 'CN', shipFrom: 'CN', declaredOrigin: 'MY', unitPrice: fc === 'h753' ? 12.8 : 10.9, stock: 4200, leadDays: 9, moq: 1, authorized: false, declaredEccn: fc === 'h753' ? '5A992.c' : '3A991.a.2', declaredHts: '8542.31', synthetic: false, manufacturer: 'STMicroelectronics' }); }
  if (gn === 'neom9n') { add({ lineId: 'l-gnss', seller: 'u-blox', sellerCountry: 'CH', shipFrom: 'US', declaredOrigin: 'CH', unitPrice: 68, stock: 300, leadDays: 5, moq: 1, authorized: true, declaredEccn: '7A994', declaredHts: '8526.91', synthetic: false, manufacturer: 'u-blox' }); add({ lineId: 'l-gnss', seller: 'Digi-Key Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'CH', unitPrice: 74, stock: 120, leadDays: 3, moq: 1, authorized: true, declaredEccn: '7A994', declaredHts: '8526.91', synthetic: false, manufacturer: 'u-blox' }); }
  if (gn === 'crpa' || gn === 'mcode') add({ lineId: 'l-gnss', seller: 'synthetic vendor', sellerCountry: '·', shipFrom: 'US', declaredOrigin: '·', unitPrice: gn === 'crpa' ? 2400 : 9800, stock: 1, leadDays: 60, moq: 1, authorized: false, declaredEccn: 'not yet classified', declaredHts: '8526.91', synthetic: true, manufacturer: 'synthetic vendor' });
  if (dl === 'pmddl') add({ lineId: 'l-datalink', seller: 'Microhard Systems', sellerCountry: 'CA', shipFrom: 'CA', declaredOrigin: 'CA', unitPrice: 420, stock: 15, leadDays: 10, moq: 1, authorized: true, declaredEccn: '5A992.c', declaredHts: '8517.62', synthetic: false, manufacturer: 'Microhard Systems' });
  if (dl === 'aescustom') add({ lineId: 'l-datalink', seller: 'synthetic vendor', sellerCountry: '·', shipFrom: 'US', declaredOrigin: '·', unitPrice: 1900, stock: 3, leadDays: 30, moq: 1, authorized: false, declaredEccn: 'not yet classified', declaredHts: '8517.62', synthetic: true, manufacturer: 'synthetic vendor' });
  if (pod) add({ lineId: 'l-pod', seller: 'in-house machining', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 1500, stock: 0, leadDays: 21, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '9013.80', synthetic: false, manufacturer: 'in-house machining' });
  add({ lineId: 'l-esc', seller: 'T-Motor', sellerCountry: 'CN', shipFrom: 'CN', declaredOrigin: 'CN', unitPrice: 45, stock: 60, leadDays: 12, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8504.40', synthetic: false, manufacturer: 'T-Motor' });
  add({ lineId: 'l-motor', seller: 'T-Motor', sellerCountry: 'CN', shipFrom: 'CN', declaredOrigin: 'CN', unitPrice: 60, stock: 80, leadDays: 12, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8501.31', synthetic: false, manufacturer: 'T-Motor' });
  add({ lineId: 'l-motor', seller: 'Brightwing Components', sellerCountry: 'HK', shipFrom: 'HK', declaredOrigin: 'CN', unitPrice: 49, stock: 30, leadDays: 18, moq: 1, authorized: false, declaredEccn: 'EAR99', declaredHts: '8501.31', synthetic: true, manufacturer: 'T-Motor' });
  add({ lineId: 'l-prop', seller: 'APC Propellers', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 18, stock: 500, leadDays: 4, moq: 2, authorized: true, declaredEccn: 'EAR99', declaredHts: '8807.30', synthetic: false, manufacturer: 'APC Propellers' });
  add({ lineId: 'l-harness', seller: 'Digi-Key Electronics', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'JP', unitPrice: 35, stock: 200, leadDays: 3, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8544.42', synthetic: false, manufacturer: 'JST' });
  add({ lineId: 'l-cells', seller: 'Molicel (E-One Moli Energy)', sellerCountry: 'TW', shipFrom: 'TW', declaredOrigin: 'TW', unitPrice: 12, stock: 5000, leadDays: 14, moq: 24, authorized: true, declaredEccn: 'EAR99', declaredHts: '8507.60', synthetic: false, manufacturer: 'Molicel (E-One Moli Energy)' });
  add({ lineId: 'l-iomcu', seller: 'LCSC Electronics', sellerCountry: 'CN', shipFrom: 'CN', declaredOrigin: 'MY/CN (lot)', unitPrice: 4.1, stock: 12000, leadDays: 9, moq: 1, authorized: false, declaredEccn: '3A991.a.2', declaredHts: '8542.31', synthetic: false, manufacturer: 'STMicroelectronics' });
  add({ lineId: 'l-frame', seller: 'in-house machining', sellerCountry: 'US', shipFrom: 'US', declaredOrigin: 'US', unitPrice: 210, stock: 0, leadDays: 21, moq: 1, authorized: true, declaredEccn: 'EAR99', declaredHts: '8807.30', synthetic: false, manufacturer: 'in-house machining' });
  return o;
}

/** Committed ownership table. A missing key is real absence: "ownership unknown", never zero. */
const OWNERSHIP: Record<string, Owner[]> = {
  'Molicel (E-One Moli Energy)': [{ name: 'Taiwan Cement Corporation', pct: 100, relation: 'parent', evidence: 'taiwancement.com/en/about · 2026-08-30' }],
  'Amprius Technologies': [{ name: 'public float (NYSE: AMPX)', pct: 100, relation: 'public', evidence: 'sec.gov 10-K 2025 · 2026-08-30' }],
  'Teledyne FLIR': [{ name: 'Teledyne Technologies Inc.', pct: 100, relation: 'parent', evidence: 'teledyne.com · 2026-08-30' }],
  'TDK InvenSense': [{ name: 'TDK Corporation', pct: 100, relation: 'parent', evidence: 'tdk.com · 2026-08-30' }],
  'Digi-Key Electronics': [{ name: 'Digi-Key Corporation (private)', pct: 100, relation: 'parent', evidence: 'digikey.com/en/about · 2026-08-30' }],
  'Mouser Electronics': [{ name: 'TTI, Inc.', pct: 100, relation: 'parent', evidence: 'mouser.com/about · 2026-08-30' }, { name: 'Berkshire Hathaway Inc.', pct: 100, relation: 'grandparent', evidence: 'berkshirehathaway.com · 2026-08-30' }],
  'Honeywell Aerospace': [{ name: 'Honeywell International Inc.', pct: 100, relation: 'parent', evidence: 'honeywell.com · 2026-08-30' }],
  'STMicroelectronics': [{ name: 'STMicroelectronics N.V. (public)', pct: 100, relation: 'parent', evidence: 'st.com · 2026-08-30' }],
  'LCSC Electronics': [{ name: 'Shenzhen LCSC Electronics Technology Co., Ltd.', pct: 100, relation: 'parent', evidence: 'lcsc.com/about · 2026-08-30' }],
  'u-blox': [{ name: 'u-blox Holding AG (public)', pct: 100, relation: 'parent', evidence: 'u-blox.com · 2026-08-30' }],
  'Microhard Systems': [{ name: 'Microhard Systems Inc. (private)', pct: 100, relation: 'parent', evidence: 'microhardcorp.com · 2026-08-30' }],
  'Brightwing Components': [{ name: 'SZ DJI Technology Co., Ltd.', pct: 60, relation: 'parent', evidence: 'fixture row · SYNTHETIC', synthetic: true }, { name: 'Brightwing Holdings Ltd.', pct: 40, relation: 'parent', evidence: 'fixture row · SYNTHETIC', synthetic: true }],
  'Nordkap Sensor AS': [{ name: 'Nordkap Holding AS', pct: 100, relation: 'parent', evidence: 'fixture row · SYNTHETIC', synthetic: true }],
  'APC Propellers': [{ name: 'Landing Products Inc.', pct: 100, relation: 'parent', evidence: 'apcprop.com · 2026-08-30' }],
  'JST': [{ name: 'J.S.T. Mfg. Co., Ltd.', pct: 100, relation: 'parent', evidence: 'jst-mfg.com · 2026-08-30' }],
  'in-house machining': [{ name: 'the design owner', pct: 100, relation: 'self', evidence: 'this document' }],
};
/** Synthetic CSL fixture slice: two fixture keys, one active match. Exact and suffix-normalised only; not a full-corpus screen. */
const CSL: Record<string, string> = { 'sz dji technology co': 'Entity List (15 CFR 744 Supp. 4)', 'shenzhen lcsc electronics technology co': '' };
const norm = (n: string) => n.toLowerCase().replace(/[.,]/g, '').replace(/\s+(ltd|limited|inc|corporation|corp|co|as|ag|nv|gmbh|llc)\b/g, ' $1').replace(/,?\s*(ltd|limited|inc|llc|nv|ag|as|gmbh)$/g, '').trim();
export function screen(name: string): { result: 'exact' | 'normalized' | 'none'; listed?: string } {
  const key = norm(name);
  for (const k of Object.keys(CSL)) { if (!CSL[k]) continue; if (key === k) return { result: 'exact', listed: CSL[k] }; if (key.replace(/\s*co$/, '') === k.replace(/\s*co$/, '')) return { result: 'normalized', listed: CSL[k] }; }
  return { result: 'none' };
}

export type Tier = 'seller + manufacturer' | 'full walk';
export function tierFor(line: Line, offer: Offer, controlled: boolean): Tier {
  const eccnEar99 = /EAR99/.test(line.declaredEccn) && /EAR99/.test(offer.declaredEccn);
  const domestic = offer.shipFrom === 'US' && offer.declaredOrigin === 'US';
  return !controlled && eccnEar99 && domestic ? 'seller + manufacturer' : 'full walk';
}

export function walk(offer: Offer, tier: Tier): PartyNode {
  const node = (name: string, role: PartyNode['role'], pct?: number, depth = 0): PartyNode => {
    const sc = screen(name);
    const owners = OWNERSHIP[name];
    const children: PartyNode[] = [];
    if (tier === 'full walk' && depth < 3) {
      if (owners) for (const o of owners) children.push(node(o.name, 'owner', o.pct, depth + 1));
      else if (name === 'synthetic vendor') children.push({ name: 'synthetic vendor · fixture · no owners modelled', role: 'owner', screening: 'none', children: [] });
      else if (role !== 'owner') children.push({ name: 'ownership unknown · no ownership row typed · searched ' + FIXTURES.ownership, role: 'owner', screening: 'abstained', children: [], unknown: true });
    }
    return { name, role, pct, screening: sc.result, listed: sc.listed, children };
  };
  const root = node(offer.seller, 'seller');
  if (offer.manufacturer !== offer.seller) root.children.unshift(node(offer.manufacturer, 'manufacturer', undefined, 1));
  return root;
}

export function rollup(tree: PartyNode): { status: OfferStatus; because: string } {
  let blocked: string | null = null, unknown = false, abst = false;
  const visit = (n: PartyNode) => {
    if (n.screening === 'exact' || n.screening === 'normalized') blocked = blocked ?? (n.name + ' matched on the Consolidated Screening List (' + n.listed + ')' + (n.pct != null ? ' · ' + n.pct + ' % owner' : ''));
    if (n.unknown) unknown = true;
    if (n.screening === 'abstained' && !n.unknown) abst = true;
    n.children.forEach(visit);
  };
  visit(tree);
  if (blocked) return { status: 'review_blocked', because: blocked };
  if (unknown) return { status: 'review_required', because: 'ownership unknown · no ownership row typed; unknown is a review flag, not a match' };
  if (abst) return { status: 'abstained', because: 'screening abstained' };
  return { status: 'no_candidate_match', because: 'no candidate match as of ' + FIXTURES.csl };
}

export interface LadderRow { layer: string; citation: string; rate: string; amount: number | null; note: string; verified: boolean }
export interface Ladder { rows: LadderRow[]; total: number | null; perUnit: number | null; assumptions: string; hash: string; unverified: boolean; domestic: boolean }

const BASE_RATE: Record<string, { rate: number; note: string }> = { '9013.80': { rate: 0.045, note: 'optical devices and instruments' }, '8507.60': { rate: 0.034, note: 'lithium-ion accumulators' }, '8525.89': { rate: 0, note: 'Free · cameras' }, '9014.20': { rate: 0, note: 'Free · navigational instruments' }, '8542.31': { rate: 0, note: 'Free · processors' }, '8526.91': { rate: 0, note: 'Free · radio navigational aid' }, '8517.62': { rate: 0, note: 'Free · reception/transmission apparatus' }, '8504.40': { rate: 0.015, note: 'static converters' }, '8501.31': { rate: 0.04, note: 'DC motors ≤ 750 W' }, '8807.30': { rate: 0, note: 'Free · aircraft parts' }, '8544.42': { rate: 0.026, note: 'insulated conductors with connectors' } };
const MPF = { rate: 0.003464, min: 33.58, max: 651.5, fy: 'FY2026 · 19 CFR 24.23' };

export function estimate(offer: Offer, line: Line, qtyUnits: number, mode: Mode): Ladder {
  const qty = qtyUnits * line.qtyPerUnit;
  const value = offer.unitPrice * qty;
  const rows: LadderRow[] = [];
  const domestic = offer.shipFrom === 'US';
  const na = (layer: string, citation: string, note: string) => rows.push({ layer, citation, rate: 'not applicable', amount: null, note, verified: true });
  if (domestic) {
    ['base rate', 'Section 301', 'Section 232', 'country action', 'AD/CVD scope', 'MPF', 'HMF'].forEach((l) => na(l, '', 'domestic shipment · no entry'));
    rows.push({ layer: 'de minimis', citation: '19 CFR 10.151 · suspended 2025-08-29', rate: 'note', amount: null, note: 'no de minimis since 29 August 2025', verified: true });
    const hash = hashOf(Math.round(value * 100) + qty);
    return { rows, total: value, perUnit: value / qty, assumptions: 'declared value ' + value.toFixed(2) + ' USD · domestic · ' + FIXTURES.tariff, hash, unverified: false, domestic };
  }
  const base = BASE_RATE[offer.declaredHts];
  let unverified = false;
  if (base) rows.push({ layer: 'base rate · ' + offer.declaredHts, citation: 'HTS 2026 rev 9 · general column', rate: (base.rate * 100).toFixed(1) + ' %', amount: value * base.rate, note: base.note, verified: true });
  else { rows.push({ layer: 'base rate · ' + offer.declaredHts, citation: 'HTS 2026 rev 9', rate: 'rate not verified', amount: null, note: 'heading not in the tariff fixture', verified: false }); unverified = true; }
  if (offer.declaredOrigin === 'CN') rows.push({ layer: 'Section 301', citation: 'HTS 9903.88.03 · List 3', rate: '25.0 %', amount: value * 0.25, note: 'origin CN as declared by the seller', verified: true });
  else if (offer.declaredOrigin === 'TW' && ['8507.60', '8501.31'].includes(offer.declaredHts)) rows.push({ layer: 'Section 301 · Taiwan', citation: 'HTS Chapter 99 note 52', rate: '10.0 %', amount: value * 0.10, note: 'no FAA 44704 certificate declared', verified: true });
  else na('Section 301', 'HTS Chapter 99 subchapter III', 'origin ' + offer.declaredOrigin + ' · no action for this heading');
  na('Section 232', 'Proclamation 91 FR 53699 · note 43', 'part line · unmanned-aircraft rows apply at the product level, not in scope here');
  na('country action', 'HTS Chapter 99', 'none for ' + offer.declaredOrigin + ' × ' + offer.declaredHts);
  na('AD/CVD scope', 'ITA case list 2026-09-03', 'no case in scope for this code and origin');
  const mpfRaw = value * MPF.rate; const mpf = Math.min(MPF.max, Math.max(MPF.min, mpfRaw));
  rows.push({ layer: 'MPF', citation: MPF.fy, rate: (MPF.rate * 100).toFixed(4) + ' %', amount: mpf, note: mpfRaw < MPF.min ? 'minimum applied (' + MPF.min.toFixed(2) + ' USD)' : mpfRaw > MPF.max ? 'maximum applied' : 'within the min/max band', verified: true });
  if (mode === 'ocean') rows.push({ layer: 'HMF', citation: '26 U.S.C. 4461 · 0.125 %', rate: '0.125 %', amount: value * 0.00125, note: 'ocean mode', verified: true });
  else na('HMF', '26 U.S.C. 4461', 'not applicable · air');
  rows.push({ layer: 'de minimis', citation: '19 CFR 10.151 · suspended 2025-08-29', rate: 'note', amount: null, note: 'no de minimis since 29 August 2025', verified: true });
  rows.push({ layer: 'Section 122', citation: 'Trade Act 1974 §122', rate: 'status', amount: null, note: 'check current status · never a rate here', verified: true });
  const total = unverified ? null : value + rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const hash = hashOf(Math.round(value * 100) + qty * 7 + (mode === 'ocean' ? 3 : 1) + rows.length * 13);
  return { rows, total, perUnit: total != null ? total / qty : null, assumptions: 'declared value ' + value.toFixed(2) + ' USD at qty ' + qty + ' · ' + mode + ' · entry date = today · ' + FIXTURES.tariff, hash, unverified, domestic };
}

export interface ResolvedOffer { offer: Offer; tier: Tier; tree: PartyNode; status: OfferStatus; because: string; ladder: Ladder; adjudicated?: { role: string; reason: string; rationale: string; attestor: string; lowered: boolean } }

/** Sort: status ascending by severity, then per-unit landed cost; unverified rates last within a status; blocked visible and last. */
export function sortOffers(list: ResolvedOffer[]): ResolvedOffer[] {
  return list.slice().sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || Number(a.ladder.unverified) - Number(b.ladder.unverified) || (a.ladder.perUnit ?? Infinity) - (b.ladder.perUnit ?? Infinity));
}

export type DeclineReason = 'price' | 'lead time' | 'quality' | 'owner screened' | 'ownership unknown' | 'origin' | 'export gate' | 'other';
export const DECLINE_REASONS: DeclineReason[] = ['price', 'lead time', 'quality', 'owner screened', 'ownership unknown', 'origin', 'export gate', 'other'];
export const defaultDecline = (o: ResolvedOffer, chosen: ResolvedOffer): DeclineReason => o.status === 'review_blocked' ? 'owner screened' : o.status === 'review_required' ? 'ownership unknown' : (o.ladder.perUnit ?? 0) > (chosen.ladder.perUnit ?? 0) ? 'price' : o.offer.leadDays > chosen.offer.leadDays ? 'lead time' : 'other';

/** Positive controls remain verbatim; an incomplete no-match path routes to human review. */
export function gateFor(line: Line, outcome: Outcome, shipTo: ShipTo): { word: DestWord | 'REVIEW' | 'DOMESTIC'; para: string; blocks: boolean } {
  if (shipTo === 'US') return { word: 'DOMESTIC', para: 'no export gate evaluated', blocks: false };
  const node = line.slot ?? 'airframe';
  const cell = outcome.cols[node].find((c) => c.code === shipTo);
  if (!cell || cell.word === 'NLR') return { word: 'REVIEW', para: 'limited modeled scan · Parts 744 / 746 and other controls not evaluated', blocks: true };
  return { word: cell.word, para: cell.para, blocks: cell.word === 'LIC' || cell.word === 'DDTC' || cell.word === 'DENIAL' };
}

export const SHIP_TO: { code: ShipTo; label: string }[] = [{ code: 'US', label: 'US · own facility' }, { code: 'TW', label: 'TW · Taiwan assembly site' }, { code: 'DE', label: 'DE · Germany' }, { code: 'CA', label: 'CA · Canada' }];
export const CHECKLIST = ['DDTC registration · DS-2032', 'empowered official designation', 'broker power of attorney · CBP 5291', 'importer number · CBP 5106', 'continuous bond', 'ACH authorization'];
export const WARNINGS = ['no de minimis since 29 August 2025', 'lithium: hazmat carriage documentation (UN3480/UN3481), not a customs filing', 'EEI required: yes for any line valued over 2,500 USD to a non-Canada destination · 15 CFR 30.2'];
/** Escalation reasons the lane raises for a line; the agent may propose, a human resolves. */
export function escalationReason(_line: Line, offers: ResolvedOffer[]): string | null {
  if (offers.length === 0) return 'no offer match';
  if (offers.some((o) => /lot/.test(o.offer.declaredOrigin))) return 'origin depends on lot';
  const eccns = new Set(offers.map((o) => o.offer.declaredEccn));
  if (eccns.size > 1) return 'classification conflict between sellers';
  if (offers.every((o) => o.status === 'review_required')) return 'ownership unknown';
  return null;
}
/** Supplier request page: the regulation's question in the regulation's words, generated from the rule fields. Deterministic, no model. */
export function supplierQuestions(line: Line): string[] {
  const q: string[] = [];
  if (line.partClass === 'sensor') q.push('one-month bias stability with respect to a fixed calibration value (7A002.a.1.a); rate range (chapeau, < 500 °/s)', 'drift-rate stability, 1 σ (7A102.a)', 'angle random walk (7A002.a.1.b)', 'accelerometer bias repeatability over one year (7A001.a.1.a)');
  if (line.partClass === 'motor' || line.partClass === 'esc') q.push('country of manufacture of the flight controller and the motor (§848 FY2020 NDAA · class deviation)', 'country where the magnet’s rare earth was mined, refined, separated (DFARS 252.225-7052, effective 2027-01-01)');
  if (line.partClass === 'structure') q.push('aluminium smelt and cast country (Proclamation 11021)', 'country of origin of the machined bracket and the rule applied (H339851 vs N352538)');
  if (line.partClass === 'thermal_imager') q.push('frame rate at native resolution (6A003.b.4.b)', 'number of elements (6A003 RS1)', 'whether the core is embedded in a civil product as delivered (Note, printed not evaluated)');
  if (line.partClass === 'gnss') q.push('adaptive antenna and anti-jam capability (7A005.b · 7A105.b.3)', 'velocity limit (7A105.b.1 · XII(d)(2)(ii))', 'civil GNSS service designation (Note to 7A005)');
  if (line.partClass === 'radio') q.push('symmetric key length and mass-market self-classification (5A002.a · 740.17(b) · 5A992.c)');
  if (line.partClass === 'ic') q.push('rated operating temperature range (3A001.a.2)', 'country of origin per lot and the lot code on the reel label');
  if (line.partClass === 'pack' || line.partClass === 'cell') q.push('cell energy density at 20 °C (3A001.e.1.b)', 'UN3480/UN3481 carriage documentation');
  q.push('declared ECCN and HTS with the source document and date; “not yet classified” is an acceptable answer', 'country of origin as you would declare it on the commercial invoice');
  return q;
}
export const CLAIM_OFFER = 'Distributor-declared availability, price, classification and tariff code as of the fixture date. Not a quote, not a classification determination.';
export const CLAIM_SCREEN = 'Review-only screening aid over a name match and a committed ownership table, not a legal determination · not fuzzy.';
export const CLAIM_COST = 'Estimate from declared tariff code and origin against a dated tariff table, not a customs determination.';
export const CLAIM_PACKAGE = 'Prepared from declared data for broker and counsel validation. Not an entry, not a filing, not ready to ship.';
