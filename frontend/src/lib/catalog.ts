// Lane-local synthetic fixture shaped like the service's design/catalog/rules
// documents. Nothing here is live; every number is declared, dated, and cached.
import type { Snapshot } from './design';

export type Slot = 'battery' | 'thermal' | 'imu' | 'fc' | 'gnss' | 'datalink' | 'pod';
export type Node = Slot | 'airframe';
export type PartId =
  | 'p45b' | 'amprius' | 'lepton' | 'boson' | 'icm' | 'hg5700' | 'imung' | 'acc120' | 'h743' | 'h753' | 'h743m' | 'neom9n' | 'crpa' | 'mcode' | 'pmddl' | 'aescustom' | 'podeo';
export type CmpKey = 'function' | 'performance' | 'form' | 'fit';
export const CMP_KEYS: CmpKey[] = ['function', 'performance', 'form', 'fit'];

export interface PartAttrs {
  pack_wh?: number;
  wh_kg?: number;
  hz?: number;
  px?: string;
  elements?: number;
  /** null = the vendor does not publish the field the rule reads */
  bias?: number | null;
  arw?: number | null;
  inrun?: number;
  tmin?: number;
  tmax?: number;
  crypto?: string;
  /** accelerometer bias stability, µg per year (row 7) */
  accel_bias?: number | null;
  /** GNSS features (row 8) */
  gnss_adaptive?: boolean;
  gnss_antijam?: boolean;
  gnss_speed?: number;
  gnss_pps?: boolean;
  /** datalink key length, bits (row 10) */
  crypto_bits?: number;
}

export interface Part {
  slot: Slot;
  /** type-first display name: what the part is, not its part number */
  name: string;
  mpn: string;
  vendor: string;
  origin: string;
  /** true = real part, false = synthetic fixture */
  real: boolean;
  stock: string;
  attrs: PartAttrs;
  cmp: Record<CmpKey, string>;
  /** declared unit value, USD, for de minimis and the 9802 credit */
  value_usd: number;
}

export const SLOT_LABEL: Record<Node, string> = {
  airframe: 'airframe',
  battery: 'battery',
  thermal: 'thermal core',
  imu: 'IMU',
  fc: 'flight controller',
  gnss: 'GNSS',
  datalink: 'datalink',
  pod: 'sensor pod',
};

export const SLOTS: Slot[] = ['battery', 'thermal', 'imu', 'fc', 'gnss', 'datalink', 'pod'];

/** What the palette shows: the component type, no specification. The model is chosen in the Spec panel. */
export const GENERIC_NAME: Record<Slot, string> = { battery: 'Battery pack', thermal: 'Thermal sensor', imu: 'IMU', fc: 'Flight controller', gnss: 'GNSS receiver', datalink: 'Datalink radio', pod: 'Sensor pod' };
export const PART_CLASS: Record<Slot, string> = { battery: 'pack', thermal: 'thermal_imager', imu: 'sensor', fc: 'board', gnss: 'gnss', datalink: 'radio', pod: 'payload' };

export const CATALOG: Record<PartId, Part> = {
  p45b: { slot: 'battery', name: 'Battery pack · 1,000 Wh', mpn: 'INR21700-P45B ×24', vendor: 'Molicel', origin: 'TW', real: true, stock: 'in stock · 2 wk', attrs: { pack_wh: 1000, wh_kg: 260 }, cmp: { function: 'energy storage · 6S pack', performance: '1,000 Wh · 260 Wh/kg', form: '21700 Li-ion · 3.8 kg', fit: 'XT90 · 6S balance lead' }, value_usd: 288 },
  amprius: { slot: 'battery', name: 'Battery pack · 1,300 Wh · Si-anode', mpn: 'SA08-450 ×1', vendor: 'Amprius', origin: 'US', real: true, stock: 'in stock · 6 wk', attrs: { pack_wh: 1300, wh_kg: 450 }, cmp: { function: 'energy storage · 6S pack', performance: '1,300 Wh · 450 Wh/kg', form: 'Si-anode pouch · 3.3 kg', fit: 'XT90 · 6S balance lead' }, value_usd: 640 },
  lepton: { slot: 'thermal', name: 'Thermal sensor · 9 Hz · 160×120', mpn: '500-0771-01', vendor: 'Teledyne FLIR', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: { hz: 9, px: '160×120', elements: 19200 }, cmp: { function: 'LWIR imaging core', performance: '9 Hz · 160×120', form: '12×12×7 mm · 0.9 g', fit: 'Lepton socket' }, value_usd: 199 },
  boson: { slot: 'thermal', name: 'Thermal sensor · 60 Hz · 640×512', mpn: '20640A012-6PAAX', vendor: 'Teledyne FLIR', origin: 'US', real: true, stock: 'in stock · 4 wk', attrs: { hz: 60, px: '640×512', elements: 327680 }, cmp: { function: 'LWIR imaging core', performance: '60 Hz · 640×512', form: '21×21×11 mm · 7.5 g', fit: 'Boson 80-pin' }, value_usd: 3450 },
  icm: { slot: 'imu', name: 'IMU · MEMS, consumer grade', mpn: 'ICM-42688-P', vendor: 'TDK InvenSense', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: { bias: null, arw: null, inrun: 0.17 }, cmp: { function: '6-axis inertial', performance: 'in-run bias instability 0.17 °/h · one-month bias stability not published', form: 'LGA 2.5×3 mm', fit: 'SPI on carrier' }, value_usd: 12 },
  hg5700: { slot: 'imu', name: 'IMU · navigation grade', mpn: 'HG5700AB03', vendor: 'Honeywell', origin: 'US', real: true, stock: 'quote · 12 wk', attrs: { bias: 0.01, arw: 0.002 }, cmp: { function: '6-axis inertial', performance: 'bias stability 0.01 °/h · ARW 0.002 °/√h', form: '50 mm module · 65 g', fit: 'SPI on carrier' }, value_usd: 6200 },
  imung: { slot: 'imu', name: 'IMU · synthetic fixture', mpn: 'IMU-NG-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { bias: 0.003, arw: 0.0008 }, cmp: { function: '6-axis inertial', performance: 'bias stability 0.003 °/h · ARW 0.0008 °/√h', form: '40 mm module · 48 g', fit: 'SPI on carrier' }, value_usd: 4800 },
  h743: { slot: 'fc', name: 'Flight controller · no crypto', mpn: 'STM32H743VIT6', vendor: 'STMicroelectronics', origin: 'MY', real: true, stock: 'in stock · 1 wk', attrs: { tmin: -40, tmax: 85, crypto: 'none' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash', form: 'LQFP-100', fit: 'FC carrier' }, value_usd: 14 },
  h753: { slot: 'fc', name: 'Flight controller · AES-256', mpn: 'STM32H753VIT6', vendor: 'STMicroelectronics', origin: 'MY', real: true, stock: 'in stock · 1 wk', attrs: { tmin: -40, tmax: 85, crypto: 'AES-256 · declared mass-market' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash · AES-256', form: 'LQFP-100', fit: 'FC carrier' }, value_usd: 16 },
  acc120: { slot: 'imu', name: 'IMU · tactical, accelerometer grade', mpn: 'ACC-120', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { bias: 0.8, arw: 0.02, accel_bias: 100 }, cmp: { function: '6-axis inertial', performance: 'accel bias stability 100 µg/yr · gyro 0.8 °/h', form: '45 mm module · 55 g', fit: 'SPI on carrier' }, value_usd: 3900 },
  h743m: { slot: 'fc', name: 'Flight controller · PRC-assembled board', mpn: 'STM32H743-M', vendor: 'synthetic vendor', origin: 'CN', real: false, stock: 'fixture', attrs: { tmin: -40, tmax: 85, crypto: 'none' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash', form: 'LQFP-100 on a CN-assembled carrier', fit: 'FC carrier' }, value_usd: 11 },
  neom9n: { slot: 'gnss', name: 'GNSS receiver · civil, multi-band', mpn: 'NEO-M9N', vendor: 'u-blox', origin: 'CH', real: true, stock: 'in stock · 1 wk', attrs: { gnss_adaptive: false, gnss_antijam: false, gnss_speed: 500, gnss_pps: false }, cmp: { function: 'GNSS position and time', performance: '4 constellations · 25 Hz · 500 m/s', form: '12×16 mm module', fit: 'UART on carrier' }, value_usd: 68 },
  crpa: { slot: 'gnss', name: 'GNSS receiver · adaptive antenna', mpn: 'CRPA-4-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { gnss_adaptive: true, gnss_antijam: true, gnss_speed: 500, gnss_pps: false }, cmp: { function: 'GNSS position and time', performance: '4-element controlled reception pattern · null steering', form: '90 mm array', fit: 'coax + UART' }, value_usd: 2400 },
  mcode: { slot: 'gnss', name: 'GNSS receiver · PPS decryption', mpn: 'GNSS-MCODE-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { gnss_adaptive: false, gnss_antijam: true, gnss_speed: 1200, gnss_pps: true }, cmp: { function: 'GNSS position and time', performance: 'PPS decryption · 1,200 m/s', form: '40 mm module', fit: 'UART on carrier' }, value_usd: 9800 },
  pmddl: { slot: 'datalink', name: 'Datalink radio · 2.4 GHz, AES-256 mass-market', mpn: 'pMDDL2450', vendor: 'Microhard', origin: 'CA', real: true, stock: 'in stock · 2 wk', attrs: { crypto_bits: 256 }, cmp: { function: 'IP datalink', performance: '2.4 GHz · 25 Mbps · AES-256', form: '33×49 mm module', fit: 'Ethernet + coax' }, value_usd: 420 },
  aescustom: { slot: 'datalink', name: 'Datalink radio · custom cryptography', mpn: 'AES-CUSTOM', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { crypto_bits: 256 }, cmp: { function: 'IP datalink', performance: 'proprietary key management · AES-256 · not mass-market', form: '40×60 mm module', fit: 'Ethernet + coax' }, value_usd: 1900 },
  podeo: { slot: 'pod', name: 'Sensor pod · EO gimbal', mpn: 'POD-EO-1', vendor: 'in-house', origin: 'US', real: true, stock: 'built to order · 3 wk', attrs: {}, cmp: { function: 'stabilised sensor carrier', performance: '2-axis · 0.3 kg payload', form: '120 mm sphere · 0.6 kg', fit: 'nose rail' }, value_usd: 1500 },
};

export const PART_IDS = Object.keys(CATALOG) as PartId[];

/** Palette order per slot: recommended swap first, then the rest. */
export const PALETTE: Record<Slot, PartId[]> = {
  battery: ['amprius', 'p45b'],
  thermal: ['boson', 'lepton'],
  imu: ['hg5700', 'imung', 'acc120', 'icm'],
  fc: ['h753', 'h743', 'h743m'],
  gnss: ['crpa', 'mcode', 'neom9n'],
  datalink: ['aescustom', 'pmddl'],
  pod: ['podeo'],
};

/** Editable regulated fields per slot, with the valid input range the spec panel enforces. */
export interface FieldSpec {
  key: keyof PartAttrs;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** decimals shown */
  dp: number;
  /** may be cleared to "not published" */
  nullable?: boolean;
  threshold: string;
}
export const FIELDS: Record<Slot, FieldSpec[]> = {
  battery: [
    { key: 'pack_wh', label: 'pack energy', unit: 'Wh', min: 100, max: 5000, dp: 0, threshold: 'feeds endurance ≥ 3.0 h (9A012.a.2)' },
    { key: 'wh_kg', label: 'cell energy density', unit: 'Wh/kg', min: 50, max: 600, dp: 0, threshold: '> 350 Wh/kg (3A001.e.1.b)' },
  ],
  thermal: [
    { key: 'hz', label: 'frame rate', unit: 'Hz', min: 1, max: 120, dp: 0, threshold: '> 9 Hz (6A003.b.4.b)' },
    { key: 'elements', label: 'elements', unit: '', min: 1000, max: 2000000, dp: 0, threshold: '> 111,000 or > 60 Hz (6A003 RS1)' },
  ],
  imu: [
    { key: 'bias', label: 'bias stability · one month · fixed calibration value', unit: '°/h', min: 0.001, max: 100, dp: 3, nullable: true, threshold: '< 0.5 °/h (7A002.a.1.a) · MT < 0.5 °/h 1 σ (7A102.a)' },
    { key: 'arw', label: 'angle random walk', unit: '°/√h', min: 0.0001, max: 1, dp: 4, nullable: true, threshold: '≤ 0.0035 °/√h (7A002.a.1.b) · < 0.001 (USML XII(e)(12)(i))' },
  ],
  fc: [
    { key: 'tmin', label: 'operating temperature · min', unit: '°C', min: -100, max: 0, dp: 0, threshold: '< −55 °C (3A001.a.2)' },
    { key: 'tmax', label: 'operating temperature · max', unit: '°C', min: 0, max: 200, dp: 0, threshold: '> +125 °C (3A001.a.2)' },
  ],
  gnss: [
    { key: 'gnss_speed', label: 'velocity limit', unit: 'm/s', min: 100, max: 3000, dp: 0, threshold: '> 600 m/s (7A105.b.1 · XII(d)(2)(ii))' },
  ],
  datalink: [
    { key: 'crypto_bits', label: 'symmetric key length', unit: 'bits', min: 0, max: 512, dp: 0, threshold: '> 56 bits and not mass-market (5A002.a)' },
  ],
  pod: [],
};
/** IMU accelerometer field (row 7) lives beside the gyro fields. */
FIELDS.imu.push({ key: 'accel_bias', label: 'accelerometer bias stability · per year', unit: 'µg', min: 1, max: 10000, dp: 0, nullable: true, threshold: '< 130 µg (7A001.a.1.a) · MT < 1250 µg (7A101.a) · ITAR < 10 µg (XII(e)(11))' });
/** Boolean features the spec shows as declared checkboxes on the part. */
export interface BoolFieldSpec { key: 'gnss_adaptive' | 'gnss_antijam' | 'gnss_pps'; label: string }
export const BOOL_FIELDS: Record<Slot, BoolFieldSpec[]> = { battery: [], thermal: [], imu: [], fc: [], gnss: [{ key: 'gnss_adaptive', label: 'adaptive (controlled reception pattern) antenna' }, { key: 'gnss_antijam', label: 'anti-jam null steering' }, { key: 'gnss_pps', label: 'PPS / M-code decryption' }], datalink: [], pod: [] };
export const CRYPTO_OPTIONS = ['none', 'AES-256 · declared mass-market', 'AES-256 · not mass-market'];

/** Default placement on the plate (metres, plate origin). Thermal core rides the far end of the span. */
export const DEFAULT_POS: Record<Slot, (span: number) => { x: number; y: number }> = {
  battery: () => ({ x: 0.35, y: 0.2 }),
  imu: () => ({ x: 1.55, y: 0.2 }),
  fc: () => ({ x: 1.5, y: 0.62 }),
  thermal: (span) => ({ x: span - 0.5, y: 0.45 }),
  gnss: () => ({ x: 1.9, y: 0.2 }),
  datalink: () => ({ x: 2.3, y: 0.78 }),
  pod: () => ({ x: 0.4, y: 0.82 }),
};

export const BASELINE_PARTS: Record<Slot, PartId | null> = { battery: 'p45b', thermal: 'lepton', imu: 'icm', fc: 'h743', gnss: 'neom9n', datalink: 'pmddl', pod: 'podeo' };
/** The model placed when a generic component is dragged in from the palette. */
export const DEFAULT_PART: Record<Slot, PartId> = { battery: 'p45b', thermal: 'lepton', imu: 'icm', fc: 'h743', gnss: 'neom9n', datalink: 'pmddl', pod: 'podeo' };

export const AIRFRAME = { name: 'Kestrel airframe', mpn: 'KSTRL-AF-01', vendor: 'in-house', origin: 'US', real: true as const };

export type DestCode = 'CA' | 'DE' | 'TW' | 'VN' | 'CN';
export const DEST: DestCode[] = ['CA', 'DE', 'TW', 'VN', 'CN'];

export type ColSet = 'NLR' | 'NS1' | 'NS2' | 'MT' | 'USML' | 'SIX' | 'EI';
export type DestWord = 'NLR' | 'STA' | 'LIC' | 'DDTC' | 'DENIAL';
export type Tone = 'green' | 'amber' | 'red' | 'black';

export const LEVEL: Record<DestWord, number> = { NLR: 0, STA: 1, LIC: 2, DDTC: 3, DENIAL: 3 };
export const TONE: Record<DestWord, Tone> = { NLR: 'green', STA: 'amber', LIC: 'red', DDTC: 'black', DENIAL: 'black' };

export const CELLS: Record<ColSet, Record<DestCode, [DestWord, string]>> = {
  NLR: { CA: ['NLR', '(list-based)'], DE: ['NLR', '(list-based)'], TW: ['NLR', '(list-based)'], VN: ['NLR', '(list-based)'], CN: ['NLR', '(list-based) · 744.21 line'] },
  SIX: { CA: ['NLR', '(list-based) · 600-series'], DE: ['STA', '(c)(2) · 600-series · consignee statement'], TW: ['LIC', '600-series · STA (c)(2) not available'], VN: ['LIC', '600-series'], CN: ['LIC', '742.6(a)(7) · no de minimis, 734.4(a)(6)(ii)'] },
  EI: { CA: ['NLR', '(list-based)'], DE: ['STA', '(c)(1) · ENC eligibility declared, not computed'], TW: ['LIC', 'ENC not verified'], VN: ['LIC', 'NS1 + EI'], CN: ['LIC', 'NS1 + EI · 744.21'] },
  NS1: { CA: ['NLR', '(list-based)'], DE: ['STA', '(c)(1)(ii)(A) · payload 1.5 kg'], TW: ['LIC', 'STA (c)(2) not verified'], VN: ['LIC', 'NS1'], CN: ['LIC', 'NS1 · 744.21'] },
  NS2: { CA: ['NLR', '(list-based)'], DE: ['STA', '(c)(1)'], TW: ['LIC', 'STA (c)(2) not verified'], VN: ['LIC', 'NS2'], CN: ['LIC', 'NS2 · 744.21'] },
  MT: { CA: ['NLR', '(list-based)'], DE: ['LIC', 'MT1 · STA barred, 740.20(b)(2)(iii)'], TW: ['LIC', 'MT1 · STA barred, 740.20(b)(2)(iii)'], VN: ['LIC', 'MT1'], CN: ['LIC', 'MT1'] },
  USML: { CA: ['DDTC', '22 CFR 123'], DE: ['DDTC', '22 CFR 123'], TW: ['DDTC', '22 CFR 123'], VN: ['DDTC', '22 CFR 123'], CN: ['DENIAL', '126.1(d)(1)'] },
};

export const KEY_GROUPS: { name: string; keys: string[] }[] = [
  { name: 'USML', keys: ['VIII(h)(1)', 'VIII(a)(5)', 'XI(c)(2)', 'XII(e)(11)', 'XII(e)(12)(i)'] },
  { name: 'CCL', keys: ['9A012.a.1', '9A012.a.2', '9A012.a.3', '9A012.a.5', '9A012 MT', '6A003.b.4.b', '6A003 RS1', '7A002.a.1.a', '7A002.a.1.b', '7A003.d.1', '7A102.a', '7A001.a.1.a', '7A005.b', '7A105.b.1', '3A001.a.2', '3A001.e.1.b', '5A002.a', '5A992.c', '9A991.d', '3A611.g'] },
  { name: 'duty', keys: ['232-UAS-THERMAL', '232-UAS-NOTHERMAL', '301-TW', '9802.00.80', 'MPF-FY2026', 'HMF', 'DE-MINIMIS'] },
  { name: 'print-only', keys: ['§848', 'ASDA', 'FCC-COVERED', 'SHTC', 'S122-STATUS'] },
];

export const RULES_EVALUATED = 37;

/** Declared facts: checkboxes and references, never inferred. Product-level unless noted. */
export type BoardTarget = 'civil UAV' | '600-series UAV' | 'USML article';
export type UsedOn = 'F-22' | 'F-16' | 'C-130' | 'Cessna 208';
export interface Declared {
  civil_product: boolean;
  military_use: boolean;
  designed_to_incorporate: boolean;
  mass_market: boolean;
  civil_gnss_service: boolean;
  designed_for_inertial_nav: boolean;
  production_nonusml_equivalent: boolean;
  document_ref: string;
  board_target: BoardTarget;
  used_on: { aircraft: UsedOn; document_ref: string }[];
  final_assembly_country: 'US' | 'TW';
  faa_44704_certificate: boolean;
  blue_uas_listed: boolean;
  allied_content_certified: boolean;
  fcc_dow_dhs_determination: boolean;
  prime_flowdown: boolean;
}
export const DECLARED0: Declared = {
  civil_product: true, military_use: false, designed_to_incorporate: false, mass_market: true, civil_gnss_service: true, designed_for_inertial_nav: false, production_nonusml_equivalent: false, document_ref: '',
  board_target: 'civil UAV', used_on: [], final_assembly_country: 'US', faa_44704_certificate: false, blue_uas_listed: false, allied_content_certified: false, fcc_dow_dhs_determination: false, prime_flowdown: false,
};
export const LISTED_AIRCRAFT: UsedOn[] = ['F-22', 'F-16', 'C-130'];

/** Rule packs are content-addressed data. v1 is the pre-2026-08-13 9A012 text (1 h / 30 min tiers); v2 the current text. */
export type PackId = 'v1' | 'v2';
export interface RulePack { id: PackId; sha: string; ecfr_date: string; effective: string; enduranceNs1H: number; enduranceAtH: number | null; label: string }
export const PACKS: Record<PackId, RulePack> = {
  v1: { id: 'v1', sha: 'a4c1e9', ecfr_date: '2026-08-01', effective: '2021-10-05', enduranceNs1H: 1.0, enduranceAtH: 0.5, label: 'v1 · 9A012.a.1 endurance ≥ 30 min (AT) · a.2 endurance ≥ 1 h (NS1)' },
  v2: { id: 'v2', sha: '3c02a7', ecfr_date: '2026-09-01', effective: '2026-08-13', enduranceNs1H: 3.0, enduranceAtH: null, label: 'v2 · 9A012.a.2 endurance ≥ 3 h (NS1) · 30 min tier removed · 91 FR 52501' },
};
export const ECFR_DATE = '2026-09-01';

export type Lane = 'all' | 'design' | 'proposal' | 'sourcing' | 'order';
export const LANES: Lane[] = ['all', 'design', 'proposal', 'sourcing', 'order'];

export interface TimelineEvent {
  seq: number;
  lane: Exclude<Lane, 'all'>;
  kind: string;
  text: string;
  entry: string;
  intent: string;
  /** status word beside the kind; '' when none */
  word: string;
  /** CSS color for the word */
  color: string;
  hash?: string;
  slot?: Slot;
  /** design state after this event; the timeline marker replays to it */
  snap?: Snapshot;
}

export const SEED_EVENTS: TimelineEvent[] = [
  { seq: 1, lane: 'design', kind: 'design_opened', text: 'Kestrel baseline · 12 parts · final_assembly_country US (declared)', entry: '0 fired · 37 evaluated', intent: 'baseline', word: '', color: 'var(--ink)' },
  { seq: 2, lane: 'design', kind: 'rule_pack_pinned', text: 'export pack v1 · duty pack v1', entry: 'eCFR 2026-09-01 · pack sha 3c02a7…', intent: 'pin the packs the log will re-derive against', word: '', color: 'var(--ink)' },
  { seq: 3, lane: 'design', kind: 'fixture_manifest', text: 'catalog@a91f · chart@3c02 · rules@7d19', entry: 'retrieved 2026-09-04', intent: 'no network on the change path', word: '', color: 'var(--ink)' },
];

export interface Feature { n: string; text: string; kind?: 'sketch' | 'extrude' | 'hole' | 'fillet' | 'chamfer' }
export const SEED_FEATURES: Feature[] = [
  { n: 'f1', text: 'base plate · span × 1.2 × 0.08 m', kind: 'sketch' },
  { n: 'f2', text: 'flange · 0.08 × 1.2 × 0.80 m', kind: 'extrude' },
  { n: 'f3', text: '4 holes ⌀ 0.14 m · plate', kind: 'hole' },
  { n: 'f4', text: '2 holes ⌀ 0.14 m · flange', kind: 'hole' },
];
export const PLATE_W = 1.2;
export const PLATE_T = 0.08;

export type Dims = Record<Node, number>;
export const DIMS0: Dims = { battery: 0.35, imu: 0.1, fc: 0.03, thermal: 0.3, airframe: 0.8, gnss: 0.06, datalink: 0.12, pod: 0.3 };

export const SPAN_MIN = 1.5;
export const SPAN_MAX = 6.0;
export const SPAN_BASELINE = 3.0;
export const EXTRUDE_MIN = 0.02;
export const EXTRUDE_MAX = 1.5;

export const SCENARIO: string[] = [
  'Baseline: Kestrel, every column NLR (list-based). Four IMU rows cannot fire and say so.',
  'Battery slot selected; the palette shows the packs that fit it. Click one or drag it onto the bracket.',
  'Amprius pack: endurance 3.25 h crosses 3.0 h; 9A012.a.2 fires; Germany STA, Taiwan and Vietnam LIC.',
  'Confirm: same function, performance, form and fit · attestor benji; the amber leaves the label, the spec and the timeline.',
  'Span 3.4 m: cruise W falls to 293 W, range 319 km crosses 300 km; MT fires regardless of payload; the strip stops changing.',
  'Boson+ 640 at 60 Hz: 6A003.b.4.b fires and pulls 9A012.a.3 onto the airframe.',
  'HG5700: one-month bias stability 0.01 °/h · the first IMU red; 7A002.a.1.a → 7A003.d.1 → 9A012.a.5; STA barred.',
  'H743 → H753: re-evaluated 37 rules · 0 changed. The zero is as loud as the red.',
];

export const SHORTCUTS: { key: string; what: string }[] = [
  { key: 'drag', what: 'orbit, full 360° including underneath' },
  { key: 'drag a body', what: 'move it on the plate; drag a palette part onto the plate to place it' },
  { key: 'shift + drag', what: 'pan' },
  { key: 'wheel', what: 'zoom 30–200 %' },
  { key: 'view cube', what: 'drag it to orbit; click a face to snap: Top · Bottom · Front · Back · Right · Left' },
  { key: 'S', what: 'command box · every command, searchable, recent pinned' },
  { key: 'right-click', what: 'marking menu on the body under the cursor' },
  { key: 'E · M · H · I', what: 'extrude · move · hole · measure' },
  { key: 'F', what: 'home view' },
  { key: 'L', what: 'timeline' },
  { key: 'Esc', what: 'close' },
  { key: '→ / Space', what: 'advance the demo (?demo=1)' },
];
