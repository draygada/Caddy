// Lane-local synthetic fixture shaped like the service's design/catalog/rules
// documents. Nothing here is live; every number is declared, dated, and cached.
import type { Snapshot } from './design';

/** The seven core slots the rules read, plus the preset components a project can add from the library. */
export type CoreSlot = 'battery' | 'thermal' | 'imu' | 'fc' | 'gnss' | 'datalink' | 'pod';
export type ExtraSlot = 'camera' | 'lidar' | 'esc' | 'motor' | 'servo' | 'airspeed' | 'transponder' | 'companion' | 'antenna' | 'parachute' | 'frame' | 'prop';
export type Slot = CoreSlot | ExtraSlot;
export type Node = Slot | 'airframe';
export type PartId =
  | 'p45b' | 'amprius' | 'lepton' | 'boson' | 'icm' | 'hg5700' | 'imung' | 'acc120' | 'h743' | 'h753' | 'h743m' | 'neom9n' | 'crpa' | 'mcode' | 'pmddl' | 'aescustom' | 'podeo'
  | 'imx477' | 'lw20' | 'alpha80' | 'at7215' | 'hv6120' | 'ms4525' | 'ping200' | 'orinnano' | 'hg2409p' | 'ifc60'
  | 'chimera7' | 'px6cmini' | 'tekko65' | 'f60prov' | 'hq7035' | 'tattu1300' | 'm10gps' | 'sik915' | 'thumbpro';
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
  camera: 'EO camera',
  lidar: 'LiDAR',
  esc: 'motor controller',
  motor: 'propulsion motor',
  servo: 'servo',
  airspeed: 'airspeed sensor',
  transponder: 'transponder',
  companion: 'companion computer',
  antenna: 'antenna',
  parachute: 'parachute',
  frame: 'frame',
  prop: 'propeller',
};

/** The slots every project starts with; the rules and the demo scenario read these. */
export const CORE_SLOTS: CoreSlot[] = ['battery', 'thermal', 'imu', 'fc', 'gnss', 'datalink', 'pod'];
export const EXTRA_SLOTS: ExtraSlot[] = ['camera', 'lidar', 'esc', 'motor', 'servo', 'airspeed', 'transponder', 'companion', 'antenna', 'parachute', 'frame', 'prop'];
export const SLOTS: Slot[] = [...CORE_SLOTS, ...EXTRA_SLOTS];

/** What the palette shows: the component type, no specification. The model is chosen in the Spec panel. */
export const GENERIC_NAME: Record<Slot, string> = {
  battery: 'Battery pack', thermal: 'Thermal sensor', imu: 'IMU', fc: 'Flight controller', gnss: 'GNSS receiver', datalink: 'Datalink radio', pod: 'Sensor pod',
  camera: 'EO camera', lidar: 'LiDAR rangefinder', esc: 'Motor controller', motor: 'Propulsion motor', servo: 'Control-surface servo', airspeed: 'Airspeed sensor', transponder: 'ADS-B transponder', companion: 'Companion computer', antenna: 'Telemetry antenna', parachute: 'Recovery parachute',
  frame: 'Frame kit', prop: 'Propeller',
};
export const PART_CLASS: Record<Slot, string> = {
  battery: 'pack', thermal: 'thermal_imager', imu: 'sensor', fc: 'board', gnss: 'gnss', datalink: 'radio', pod: 'payload',
  camera: 'camera', lidar: 'sensor', esc: 'board', motor: 'motor', servo: 'actuator', airspeed: 'sensor', transponder: 'radio', companion: 'board', antenna: 'antenna', parachute: 'recovery',
  frame: 'structure', prop: 'propeller',
};

/** The component library: every type a project can hold, grouped for the picker. Core types are in every project; the rest are added per project. */
export type ComponentCategory = 'Structure' | 'Power and propulsion' | 'Sensing' | 'Navigation and control' | 'Communications' | 'Payload and recovery';
export interface ComponentPreset { slot: Slot; category: ComponentCategory; blurb: string; regulated: boolean }
export const COMPONENT_PRESETS: ComponentPreset[] = [
  { slot: 'frame', category: 'Structure', blurb: 'carbon frame kit · arms, stack mount and camera cage · no modeled rule reads it', regulated: false },
  { slot: 'battery', category: 'Power and propulsion', blurb: 'main pack · energy and density are read by the endurance and cell rules', regulated: true },
  { slot: 'motor', category: 'Power and propulsion', blurb: 'brushless outrunner for the propeller · no modeled rule reads it', regulated: false },
  { slot: 'esc', category: 'Power and propulsion', blurb: 'electronic speed controller between pack and motor · no modeled rule reads it', regulated: false },
  { slot: 'prop', category: 'Power and propulsion', blurb: 'propeller set · one per motor · no modeled rule reads it', regulated: false },
  { slot: 'thermal', category: 'Sensing', blurb: 'LWIR core · frame rate and element count are read by 6A003', regulated: true },
  { slot: 'camera', category: 'Sensing', blurb: 'daylight EO camera module · no modeled rule reads it', regulated: false },
  { slot: 'lidar', category: 'Sensing', blurb: 'laser rangefinder for terrain following · no modeled rule reads it', regulated: false },
  { slot: 'airspeed', category: 'Sensing', blurb: 'digital pitot for airspeed hold · no modeled rule reads it', regulated: false },
  { slot: 'imu', category: 'Navigation and control', blurb: 'inertial unit · bias stability and ARW are read by 7A002 and USML XII', regulated: true },
  { slot: 'gnss', category: 'Navigation and control', blurb: 'GNSS receiver · velocity limit and anti-jam features are read by 7A105', regulated: true },
  { slot: 'fc', category: 'Navigation and control', blurb: 'flight-control MCU · temperature range and cryptography are read by 3A001 and 5A002', regulated: true },
  { slot: 'servo', category: 'Navigation and control', blurb: 'control-surface actuator · no modeled rule reads it', regulated: false },
  { slot: 'companion', category: 'Navigation and control', blurb: 'onboard computer for perception and mission logic · no modeled rule reads it', regulated: false },
  { slot: 'datalink', category: 'Communications', blurb: 'IP radio · key length and mass-market status are read by 5A002', regulated: true },
  { slot: 'antenna', category: 'Communications', blurb: 'directional telemetry antenna · no modeled rule reads it', regulated: false },
  { slot: 'transponder', category: 'Communications', blurb: 'ADS-B out for airspace visibility · no modeled rule reads it', regulated: false },
  { slot: 'pod', category: 'Payload and recovery', blurb: 'stabilised sensor carrier on the nose rail', regulated: false },
  { slot: 'parachute', category: 'Payload and recovery', blurb: 'ballistic recovery system for BVLOS operations · no modeled rule reads it', regulated: false },
];
export const COMPONENT_CATEGORIES: ComponentCategory[] = ['Structure', 'Power and propulsion', 'Sensing', 'Navigation and control', 'Communications', 'Payload and recovery'];

export const CATALOG: Record<PartId, Part> = {
  // Envelopes are the manufacturers' published numbers (retrieved 2026-09-05); the source is cited on each line. Fixture parts (real: false) carry a plausible envelope for their class.
  // Molicel INR21700-P45B cell: 21.55 mm diameter x 70.15 mm, 70 g. Pack 6S4P as two layers of 3 x 4 cells: 222 x 90 x 48 mm. https://www.molicel.com/inr-21700-p45b/
  p45b: { slot: 'battery', name: 'Battery pack · 1,000 Wh', mpn: 'INR21700-P45B ×24', vendor: 'Molicel', origin: 'TW', real: true, stock: 'in stock · 2 wk', attrs: { pack_wh: 1000, wh_kg: 260 }, cmp: { function: 'energy storage · 6S pack', performance: '1,000 Wh · 260 Wh/kg', form: '24 × 21700 · 222 × 90 × 48 mm · 3.8 kg', fit: 'XT90 · 6S balance lead' }, value_usd: 288 },
  // Amprius SA08 SiCore pouch: 144.5 x 52.0 x 6.25 mm, 106.5 g, 37.6 Wh. Pack as four stacks of nine pouches: 289 x 104 x 70 mm with the BMS. https://amprius.com/documents/Amprius_Product_Catalog.pdf
  amprius: { slot: 'battery', name: 'Battery pack · 1,300 Wh · Si-anode', mpn: 'SA08 ×36', vendor: 'Amprius', origin: 'US', real: true, stock: 'in stock · 6 wk', attrs: { pack_wh: 1300, wh_kg: 450 }, cmp: { function: 'energy storage · 6S pack', performance: '1,300 Wh · 450 Wh/kg', form: '36 × SA08 pouch · 289 × 104 × 70 mm · 3.3 kg', fit: 'XT90 · 6S balance lead' }, value_usd: 640 },
  // FLIR Lepton 3.5 module: 10.5 x 12.7 x 7.14 mm, 0.9 g, socketed on a 25 x 25 mm breakout. https://www.flir.com/globalassets/imported-assets/document/flir-lepton-engineering-datasheet.pdf
  lepton: { slot: 'thermal', name: 'Thermal sensor · 9 Hz · 160×120', mpn: '500-0771-01', vendor: 'Teledyne FLIR', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: { hz: 9, px: '160×120', elements: 19200 }, cmp: { function: 'LWIR imaging core', performance: '9 Hz · 160×120', form: '10.5 × 12.7 × 7.1 mm · 0.9 g', fit: 'Lepton socket' }, value_usd: 199 },
  // FLIR Boson 640 core: 21 x 21 x 11 mm and 7.5 g without lens; the 14 mm lens adds about 20 mm forward. https://groupgets.com/products/flir-boson-640
  boson: { slot: 'thermal', name: 'Thermal sensor · 60 Hz · 640×512', mpn: '20640A012-6PAAX', vendor: 'Teledyne FLIR', origin: 'US', real: true, stock: 'in stock · 4 wk', attrs: { hz: 60, px: '640×512', elements: 327680 }, cmp: { function: 'LWIR imaging core', performance: '60 Hz · 640×512', form: '21 × 21 × 11 mm · 7.5 g · lens adds 20 mm', fit: 'Boson 80-pin' }, value_usd: 3450 },
  // TDK ICM-42688-P: 2.5 x 3.0 x 0.91 mm LGA, drawn on a 25.4 x 25.4 mm breakout with a pin header. https://invensense.tdk.com/products/motion-tracking/6-axis/icm-42688-p/
  icm: { slot: 'imu', name: 'IMU · MEMS, consumer grade', mpn: 'ICM-42688-P', vendor: 'TDK InvenSense', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: { bias: null, arw: null, inrun: 0.17 }, cmp: { function: '6-axis inertial', performance: 'in-run bias instability 0.17 °/h · one-month bias stability not published', form: 'LGA 2.5 × 3 × 0.9 mm on a 25 mm breakout', fit: 'SPI on carrier' }, value_usd: 12 },
  // Honeywell HG5700: 102 mm tall, 92 mm body diameter, 127 mm isolator ring, 1,360 g. https://www.honeywellaerospace.com/us/en/products-and-services/products/navigation-and-sensors/inertial-measurement-units/hg5700-inertial-measurement-unit
  hg5700: { slot: 'imu', name: 'IMU · navigation grade', mpn: 'HG5700AB03', vendor: 'Honeywell', origin: 'US', real: true, stock: 'quote · 12 wk', attrs: { bias: 0.01, arw: 0.002 }, cmp: { function: '6-axis inertial', performance: 'bias stability 0.01 °/h · ARW 0.002 °/√h', form: '⌀127 mm ring · 102 mm tall · 1.36 kg', fit: 'four-hole ring · RS-422' }, value_usd: 6200 },
  // Synthetic fixture: a tactical MEMS puck in the HG4930 class, drawn as a 40 mm diameter x 20 mm flanged cylinder.
  imung: { slot: 'imu', name: 'IMU · synthetic fixture', mpn: 'IMU-NG-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { bias: 0.003, arw: 0.0008 }, cmp: { function: '6-axis inertial', performance: 'bias stability 0.003 °/h · ARW 0.0008 °/√h', form: '⌀40 × 20 mm puck · 48 g · fixture', fit: 'SPI on carrier' }, value_usd: 4800 },
  // STM32H743VIT6: LQFP-100, 14 x 14 x 1.4 mm, drawn on a Pixhawk-6C-class 84.8 x 44 mm FMU carrier. https://www.st.com/en/microcontrollers-microprocessors/stm32h743vi.html · https://docs.holybro.com/autopilot/pixhawk-6c/dimensions
  h743: { slot: 'fc', name: 'Flight controller · no crypto', mpn: 'STM32H743VIT6', vendor: 'STMicroelectronics', origin: 'MY', real: true, stock: 'in stock · 1 wk', attrs: { tmin: -40, tmax: 85, crypto: 'none' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash', form: 'LQFP-100 · 14 × 14 × 1.4 mm on an 85 × 44 mm carrier', fit: 'FC carrier' }, value_usd: 14 },
  // STM32H753VIT6: same LQFP-100 package and carrier as the H743. https://www.st.com/en/microcontrollers-microprocessors/stm32h753vi.html
  h753: { slot: 'fc', name: 'Flight controller · AES-256', mpn: 'STM32H753VIT6', vendor: 'STMicroelectronics', origin: 'MY', real: true, stock: 'in stock · 1 wk', attrs: { tmin: -40, tmax: 85, crypto: 'AES-256 · declared mass-market' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash · AES-256', form: 'LQFP-100 · 14 × 14 × 1.4 mm on an 85 × 44 mm carrier', fit: 'FC carrier' }, value_usd: 16 },
  // Synthetic fixture: an accelerometer-grade tactical IMU drawn as a 45 x 45 x 25 mm finned box.
  acc120: { slot: 'imu', name: 'IMU · tactical, accelerometer grade', mpn: 'ACC-120', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { bias: 0.8, arw: 0.02, accel_bias: 100 }, cmp: { function: '6-axis inertial', performance: 'accel bias stability 100 µg/yr · gyro 0.8 °/h', form: '45 × 45 × 25 mm module · 55 g · fixture', fit: 'SPI on carrier' }, value_usd: 3900 },
  // Synthetic fixture: the H743 package on a CN-assembled carrier of the same 84.8 x 44 mm outline.
  h743m: { slot: 'fc', name: 'Flight controller · PRC-assembled board', mpn: 'STM32H743-M', vendor: 'synthetic vendor', origin: 'CN', real: false, stock: 'fixture', attrs: { tmin: -40, tmax: 85, crypto: 'none' }, cmp: { function: 'flight-control MCU', performance: '480 MHz · 2 MB flash', form: 'LQFP-100 on a CN-assembled 85 × 44 mm carrier · fixture', fit: 'FC carrier' }, value_usd: 11 },
  // u-blox NEO-M9N: 12.2 x 16.0 x 2.4 mm LCC module, drawn on a 25 x 45 mm carrier under a 25 x 25 x 4 mm patch. https://content.u-blox.com/sites/default/files/NEO-M9N-00B_DataSheet_UBX-19014285.pdf
  neom9n: { slot: 'gnss', name: 'GNSS receiver · civil, multi-band', mpn: 'NEO-M9N', vendor: 'u-blox', origin: 'CH', real: true, stock: 'in stock · 1 wk', attrs: { gnss_adaptive: false, gnss_antijam: false, gnss_speed: 500, gnss_pps: false }, cmp: { function: 'GNSS position and time', performance: '4 constellations · 25 Hz · 500 m/s', form: '12.2 × 16 × 2.4 mm module · 25 mm patch', fit: 'UART on carrier' }, value_usd: 68 },
  // Synthetic fixture: a four-element CRPA drawn as a 90 x 90 x 20 mm tray with four 30 mm patches.
  crpa: { slot: 'gnss', name: 'GNSS receiver · adaptive antenna', mpn: 'CRPA-4-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { gnss_adaptive: true, gnss_antijam: true, gnss_speed: 500, gnss_pps: false }, cmp: { function: 'GNSS position and time', performance: '4-element controlled reception pattern · null steering', form: '90 × 90 × 20 mm array · fixture', fit: 'coax + UART' }, value_usd: 2400 },
  // Synthetic fixture: a PPS-capable receiver drawn as a 40 x 40 x 15 mm finned enclosure.
  mcode: { slot: 'gnss', name: 'GNSS receiver · PPS decryption', mpn: 'GNSS-MCODE-1', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { gnss_adaptive: false, gnss_antijam: true, gnss_speed: 1200, gnss_pps: true }, cmp: { function: 'GNSS position and time', performance: 'PPS decryption · 1,200 m/s', form: '40 × 40 × 15 mm module · fixture', fit: 'UART on carrier' }, value_usd: 9800 },
  // Microhard pMDDL2450 OEM motherboard: 27 x 33 x 4 mm, 7 g, two U.FL, 80-pin SMT header. https://www.microhardcorp.com/brochures/pMDDL2450.Brochure.Rev.1.3.0.pdf
  pmddl: { slot: 'datalink', name: 'Datalink radio · 2.4 GHz, AES-256 mass-market', mpn: 'pMDDL2450', vendor: 'Microhard', origin: 'CA', real: true, stock: 'in stock · 2 wk', attrs: { crypto_bits: 256 }, cmp: { function: 'IP datalink', performance: '2.4 GHz · 25 Mbps · AES-256', form: '27 × 33 × 4 mm OEM board · 7 g', fit: '80-pin SMT · 2 × U.FL' }, value_usd: 420 },
  // Synthetic fixture: an enclosed proprietary radio drawn as a 60 x 40 x 20 mm finned box.
  aescustom: { slot: 'datalink', name: 'Datalink radio · custom cryptography', mpn: 'AES-CUSTOM', vendor: 'synthetic vendor', origin: '·', real: false, stock: 'fixture', attrs: { crypto_bits: 256 }, cmp: { function: 'IP datalink', performance: 'proprietary key management · AES-256 · not mass-market', form: '60 × 40 × 20 mm module · fixture', fit: 'Ethernet + coax' }, value_usd: 1900 },
  // In-house design: declared envelope, a 120 mm ball on a 120 x 120 mm yaw base, 140 mm tall, 0.6 kg.
  podeo: { slot: 'pod', name: 'Sensor pod · EO gimbal', mpn: 'POD-EO-1', vendor: 'in-house', origin: 'US', real: true, stock: 'built to order · 3 wk', attrs: {}, cmp: { function: 'stabilised sensor carrier', performance: '2-axis · 0.3 kg payload', form: '⌀120 mm ball · 140 mm tall · 0.6 kg · declared', fit: 'nose rail' }, value_usd: 1500 },
  // library presets: one default model per added component type
  // Raspberry Pi High Quality Camera (Sony IMX477): 38 x 38 mm board, 18.6 mm tall without lens, 30 mm hole pattern. https://datasheets.raspberrypi.com/hq-camera/hq-camera-product-brief.pdf
  imx477: { slot: 'camera', name: 'EO camera · 12 MP · 4K30', mpn: 'IMX477 module', vendor: 'Sony', origin: 'JP', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'daylight imaging', performance: '12.3 MP · 4K at 30 fps', form: '38 × 38 × 18.6 mm board and mount · 15 g', fit: 'MIPI CSI-2' }, value_usd: 60 },
  // LightWare LW20/C: 30 x 20 x 43 mm, 19 g, IP67. https://lightwarelidar.com/shop/lw20-c-100-m/
  lw20: { slot: 'lidar', name: 'LiDAR rangefinder · 100 m', mpn: 'LW20/C', vendor: 'LightWare', origin: 'ZA', real: true, stock: 'in stock · 2 wk', attrs: {}, cmp: { function: 'laser altimetry', performance: '100 m · 388 Hz', form: '43 × 30 × 20 mm · 19 g', fit: 'I2C or serial' }, value_usd: 300 },
  // T-Motor ALPHA 80A 12S: 88.5 x 36.6 x 19 mm, 110 g. https://shop.tmotor.com/products/alpha-80a-12s-foc-esc
  alpha80: { slot: 'esc', name: 'Motor controller · 80 A · 12S', mpn: 'Alpha 80A HV', vendor: 'T-Motor', origin: 'CN', real: true, stock: 'in stock · 2 wk', attrs: {}, cmp: { function: 'brushless speed control', performance: '80 A continuous · 6S to 12S', form: '88.5 × 36.6 × 19 mm · 110 g', fit: 'PWM · XT90' }, value_usd: 130 },
  // T-Motor AT7215: 81.4 mm diameter x 57.9 mm, about 550 g with lead, 10 mm shaft; the vendor lists KV200 to KV270. https://uav-en.tmotor.com/2020/Motors_0831/365.html
  at7215: { slot: 'motor', name: 'Propulsion motor · 3,600 W', mpn: 'AT7215 KV150', vendor: 'T-Motor', origin: 'CN', real: true, stock: 'in stock · 3 wk', attrs: {}, cmp: { function: 'fixed-wing propulsion', performance: '3,600 W · 150 KV', form: '⌀81.4 × 57.9 mm outrunner · 550 g', fit: 'M4 cross mount · 10 mm shaft' }, value_usd: 260 },
  // MKS HV6120: 23 x 8 x 26.5 mm, 11 g. https://mks-servo.com/HV6120
  hv6120: { slot: 'servo', name: 'Control-surface servo · 5.4 kg·cm · slim wing', mpn: 'HV6120', vendor: 'MKS Servos', origin: 'TW', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'control-surface actuation', performance: '5.4 kg·cm · 0.08 s/60° · HV brushless', form: '23 × 8 × 26.5 mm slim case · 11 g', fit: 'PWM · 3-pin' }, value_usd: 75 },
  // TE MS4525DO, DS dual-side-port package: about 18 x 10 x 7 mm with two 3 mm barbs (read from the outline drawing), on a 20 x 12 mm carrier with a 100 mm pitot tube. https://www.te.com/en/product-4525DO-DS3AI001DP.html
  ms4525: { slot: 'airspeed', name: 'Airspeed sensor · digital pitot', mpn: 'MS4525DO', vendor: 'TE Connectivity', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'differential pressure', performance: '±1 psi · 14-bit', form: '18 × 10 × 7 mm sensor · 100 mm pitot tube · 12 g', fit: 'I2C' }, value_usd: 45 },
  // uAvionix ping200X: 47 x 54 x 9 mm, 50 g. https://uavionix.com/uncrewed-aircraft-systems/ping200x/
  ping200: { slot: 'transponder', name: 'ADS-B transponder · 20 W · Mode S', mpn: 'ping200X', vendor: 'uAvionix', origin: 'US', real: true, stock: 'in stock · 3 wk', attrs: {}, cmp: { function: 'ADS-B out · Mode S', performance: '20 W · TSO-C112e', form: '47 × 54 × 9 mm · 50 g', fit: 'serial · SMA' }, value_usd: 2000 },
  // NVIDIA Jetson Orin Nano Developer Kit: 100 x 79 x 21 mm, 174 g. https://developer.nvidia.com/embedded/learn/jetson-orin-nano-devkit-user-guide/hardware_spec.html
  orinnano: { slot: 'companion', name: 'Companion computer · 40 TOPS', mpn: 'Jetson Orin Nano 8GB', vendor: 'NVIDIA', origin: 'CN', real: true, stock: 'in stock · 2 wk', attrs: {}, cmp: { function: 'onboard compute', performance: '40 TOPS · 8 GB', form: 'developer kit · 100 × 79 × 21 mm · 174 g', fit: 'Ethernet · USB · CSI' }, value_usd: 250 },
  // L-com HG2409P: 4.5 x 4.5 x 0.9 in (114 x 114 x 23 mm), 0.18 kg. https://www.l-com.com/Images/Downloadables/Datasheets/ds_HG2409P-NF.pdf
  hg2409p: { slot: 'antenna', name: 'Telemetry antenna · 2.4 GHz · 9 dBi flat patch', mpn: 'HG2409P', vendor: 'L-com', origin: 'US', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'directional telemetry', performance: '9 dBi · 2.4 GHz · 60° beam', form: '114 × 114 × 23 mm flat panel · 0.18 kg', fit: 'N-female · SMA pigtail' }, value_usd: 55 },
  // Fruity Chutes Iris Ultra 60 in compact (IFC-60-S): packs to 3.9 in diameter x 3.2 in (99 x 81 mm), 6.8 oz (193 g). https://shop.fruitychutes.com/products/iris-ultra-60-compact-parachute-19lbs-20fps-12lbs-15fps
  ifc60: { slot: 'parachute', name: 'Recovery parachute · 8 kg', mpn: 'IFC-60-S', vendor: 'Fruity Chutes', origin: 'US', real: true, stock: 'built to order · 4 wk', attrs: {}, cmp: { function: 'ballistic recovery', performance: '8 kg at 4.5 m/s', form: '60 in canopy · ⌀99 × 81 mm packed · 193 g', fit: 'servo release' }, value_usd: 480 },
  // Merlin, a 7 inch civil survey quadcopter. Envelopes and masses are the manufacturers' published numbers (retrieved 2026-09-05); the source is cited on each line.
  // iFlight Chimera7 Pro V2 O4 frame kit: L270 x W199 x H34 mm, 355 g, 327 mm wheelbase, 6 mm arms, 30 x 30 mm M3 stack mount. https://shop.iflight.com/Chimera7-O4-Frame-Kit-Pro2286
  chimera7: { slot: 'frame', name: 'Frame kit · 7 inch · carbon', mpn: 'Chimera7 Pro V2 O4', vendor: 'iFlight', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'quadcopter airframe', performance: '327 mm wheelbase · 6 mm arms', form: '270 × 199 × 34 mm · 355 g', fit: '30 × 30 mm M3 stack' }, value_usd: 110 },
  // Holybro Pixhawk 6C Mini, Model A: 54.3 x 39 x 17.5 mm, 42.4 g, STM32H743 at 480 MHz, ICM-42688-P and BMI088 IMUs, -40 to 85 C. https://docs.holybro.com/autopilot/pixhawk-6c-mini/technical-specification
  px6cmini: { slot: 'fc', name: 'Flight controller · Pixhawk 6C Mini', mpn: 'Pixhawk 6C Mini', vendor: 'Holybro', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: { tmin: -40, tmax: 85, crypto: 'none' }, cmp: { function: 'flight-control autopilot', performance: 'STM32H743 · 480 MHz · dual IMU', form: '54.3 × 39 × 17.5 mm · 42.4 g', fit: 'JST-GH · foam or M3' }, value_usd: 150 },
  // Holybro Tekko32 F4 Metal 4in1 65A ESC (AM32): 43 x 44 mm, 15.8 g, 30.5 x 30.5 mm M4 holes, 65 A x 4 continuous, 75 A burst, 4S to 6S. https://holybro.com/products/tekko32-f4-metal-4in1-65a-esc-65a
  tekko65: { slot: 'esc', name: 'Motor controller · 4-in-1 · 65 A', mpn: 'Tekko32 F4 Metal 4in1 65A', vendor: 'Holybro', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'four-channel brushless speed control', performance: '65 A × 4 continuous · 75 A burst · 4S to 6S', form: '43 × 44 mm · 15.8 g', fit: '30.5 × 30.5 mm M4 · 8-pin JST-SH' }, value_usd: 75 },
  // T-Motor F60 PRO V 2207.5 1750KV: 26.8 mm diameter x 31.7 mm, 34.3 g with lead, 4 mm shaft, M5 prop thread, 16 x 16 mm M3 mount, 6S, 1,003 W max. https://www.getfpv.com/t-motor-f60-pro-v-motor-1750kv-1950kv-2020kv-2550kv.html · https://tmotorhobby.com/goods-1183
  f60prov: { slot: 'motor', name: 'Propulsion motor · 2207.5 · 1,750 KV', mpn: 'F60 PRO V 2207.5 1750KV', vendor: 'T-Motor', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'quadcopter propulsion · one per arm', performance: '1,003 W · 1,750 KV · 6S', form: '⌀26.8 × 31.7 mm · 34.3 g', fit: '16 × 16 mm M3 · M5 prop shaft' }, value_usd: 28 },
  // HQProp 7X3.5X3 V1S polycarbonate: 7 in (177.8 mm) diameter, 3.5 in pitch, 3 blades, 7.76 g, hub 13.2 mm diameter x 6.7 mm, 5 mm shaft. https://www.hqprop.com/hq-durable-prop-7x35x3v1s-2cw2ccw-poly-carbonate-p0132.html
  hq7035: { slot: 'prop', name: 'Propeller · 7 × 3.5 · 3-blade', mpn: '7X3.5X3 V1S', vendor: 'HQProp', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'thrust · one per motor', performance: '7 in · 3.5 in pitch · 3 blades', form: '⌀177.8 mm · hub ⌀13.2 × 6.7 mm · 7.76 g', fit: '5 mm shaft' }, value_usd: 3 },
  // Tattu R-Line V3 1300 mAh 6S 120C: 75 x 38 x 38 mm, 208 g, 22.2 V, XT60. 1.3 Ah x 22.2 V = 28.9 Wh; 28.9 Wh / 0.208 kg = 139 Wh/kg at pack level. https://genstattu.com/ta-rl3-120c-1300-6s1p.html
  tattu1300: { slot: 'battery', name: 'Battery pack · 29 Wh · 6S LiPo', mpn: 'TA-RL3-120C-1300-6S1P', vendor: 'Tattu (Grepow)', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: { pack_wh: 29, wh_kg: 139 }, cmp: { function: 'energy storage · 6S pack', performance: '1,300 mAh · 22.2 V · 120C', form: '75 × 38 × 38 mm · 208 g', fit: 'XT60 · JST-XH balance' }, value_usd: 35 },
  // Holybro M10 GPS: 50 mm diameter x 14.4 mm, 32 g, u-blox M10 chipset, 25 x 25 x 4 mm patch, up to 25 Hz, IST8310 compass, -40 to 80 C. u-blox M10 velocity limit 500 m/s. https://holybro.com/products/m10-gps
  m10gps: { slot: 'gnss', name: 'GNSS receiver · civil · u-blox M10', mpn: 'M10 GPS', vendor: 'Holybro', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: { gnss_adaptive: false, gnss_antijam: false, gnss_speed: 500, gnss_pps: false }, cmp: { function: 'GNSS position and time · compass', performance: '4 constellations · 25 Hz · 500 m/s', form: '⌀50 × 14.4 mm · 32 g', fit: '10-pin JST-GH' }, value_usd: 40 },
  // Holybro SiK Telemetry Radio V3, 915 MHz 100 mW: 28 x 53 x 10.7 mm without antenna, 23.5 g with antenna, 6-pin JST-GH, RP-SMA; the SiK firmware offers optional AES-128. https://docs.holybro.com/radio/sik-telemetry-radio-v3
  sik915: { slot: 'datalink', name: 'Datalink radio · 915 MHz · SiK telemetry', mpn: 'SiK Telemetry Radio V3 915', vendor: 'Holybro', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: { crypto_bits: 128 }, cmp: { function: 'MAVLink telemetry link', performance: '915 MHz · 100 mW · AES-128 optional in firmware', form: '28 × 53 × 10.7 mm · 23.5 g with antenna', fit: '6-pin JST-GH · RP-SMA' }, value_usd: 45 },
  // RunCam Thumb Pro W: 54 x 25.5 x 21 mm, 16 g, IMX577 12 MP, 4K at 30 fps, 155 degree FOV, 5 V at 500 mA. https://shop.runcam.com/runcam-thumb-pro-w/
  thumbpro: { slot: 'camera', name: 'EO camera · 4K30 · 16 g', mpn: 'Thumb Pro W', vendor: 'RunCam', origin: 'CN', real: true, stock: 'in stock · 1 wk', attrs: {}, cmp: { function: 'daylight survey imaging', performance: '4K at 30 fps · 12 MP IMX577 · 155°', form: '54 × 25.5 × 21 mm · 16 g', fit: '2-pin 5 V · microSD' }, value_usd: 90 },
};

export const PART_IDS = Object.keys(CATALOG) as PartId[];

/** Palette order per slot: recommended swap first, then the rest. */
export const PALETTE: Record<Slot, PartId[]> = {
  battery: ['amprius', 'p45b', 'tattu1300'],
  thermal: ['boson', 'lepton'],
  imu: ['hg5700', 'imung', 'acc120', 'icm'],
  fc: ['h753', 'h743', 'h743m', 'px6cmini'],
  gnss: ['crpa', 'mcode', 'neom9n', 'm10gps'],
  datalink: ['aescustom', 'pmddl', 'sik915'],
  pod: ['podeo'],
  camera: ['imx477', 'thumbpro'], lidar: ['lw20'], esc: ['alpha80', 'tekko65'], motor: ['at7215', 'f60prov'], servo: ['hv6120'], airspeed: ['ms4525'], transponder: ['ping200'], companion: ['orinnano'], antenna: ['hg2409p'], parachute: ['ifc60'],
  frame: ['chimera7'], prop: ['hq7035'],
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
  camera: [], lidar: [], esc: [], motor: [], servo: [], airspeed: [], transponder: [], companion: [], antenna: [], parachute: [], frame: [], prop: [],
};
/** IMU accelerometer field (row 7) lives beside the gyro fields. */
FIELDS.imu.push({ key: 'accel_bias', label: 'accelerometer bias stability · per year', unit: 'µg', min: 1, max: 10000, dp: 0, nullable: true, threshold: '< 130 µg (7A001.a.1.a) · MT < 1250 µg (7A101.a) · ITAR < 10 µg (XII(e)(11))' });
/** Boolean features the spec shows as declared checkboxes on the part. */
export interface BoolFieldSpec { key: 'gnss_adaptive' | 'gnss_antijam' | 'gnss_pps'; label: string }
export const BOOL_FIELDS: Record<Slot, BoolFieldSpec[]> = {
  battery: [], thermal: [], imu: [], fc: [], gnss: [{ key: 'gnss_adaptive', label: 'adaptive (controlled reception pattern) antenna' }, { key: 'gnss_antijam', label: 'anti-jam null steering' }, { key: 'gnss_pps', label: 'PPS / M-code decryption' }], datalink: [], pod: [],
  camera: [], lidar: [], esc: [], motor: [], servo: [], airspeed: [], transponder: [], companion: [], antenna: [], parachute: [], frame: [], prop: [],
};
export const CRYPTO_OPTIONS = ['none', 'AES-256 · declared mass-market', 'AES-256 · not mass-market'];

/** Default placement on the plate (metres, plate origin) as a function of the plate length L and width W. The pack fills the near corner; the pod and the thermal core ride the far end. */
export const DEFAULT_POS: Record<Slot, (L: number, W: number) => { x: number; y: number }> = {
  battery: () => ({ x: 0.02, y: 0.02 }),
  imu: () => ({ x: 0.13, y: 0.16 }),
  fc: () => ({ x: 0.02, y: 0.16 }),
  thermal: (L, W) => ({ x: L - 0.05, y: W - 0.08 }),
  gnss: () => ({ x: 0.27, y: 0.16 }),
  datalink: (_L, W) => ({ x: 0.02, y: W - 0.07 }),
  pod: (L) => ({ x: L - 0.12, y: 0.02 }),
  camera: (_L, W) => ({ x: 0.13, y: W - 0.07 }),
  lidar: (_L, W) => ({ x: 0.18, y: W - 0.07 }),
  esc: () => ({ x: 0.13, y: 0.115 }),
  motor: () => ({ x: 0.25, y: 0.02 }),
  servo: (_L, W) => ({ x: 0.24, y: W - 0.05 }),
  airspeed: (_L, W) => ({ x: 0.28, y: W - 0.04 }),
  transponder: (_L, W) => ({ x: 0.22, y: W - 0.07 }),
  companion: (L) => ({ x: L - 0.12, y: 0.15 }),
  antenna: (L, W) => ({ x: L - 0.13, y: W - 0.13 }),
  parachute: () => ({ x: 0.25, y: 0.15 }),
  frame: (L) => ({ x: L - 0.28, y: 0.05 }),
  prop: (L, W) => ({ x: L - 0.19, y: W - 0.19 }),
};

const EXTRA_NULL = { camera: null, lidar: null, esc: null, motor: null, servo: null, airspeed: null, transponder: null, companion: null, antenna: null, parachute: null, frame: null, prop: null } as const;
export const BASELINE_PARTS: Record<Slot, PartId | null> = { battery: 'p45b', thermal: 'lepton', imu: 'icm', fc: 'h743', gnss: 'neom9n', datalink: 'pmddl', pod: 'podeo', ...EXTRA_NULL };
/** The model placed when a generic component is dragged in from the palette. */
export const DEFAULT_PART: Record<Slot, PartId> = {
  battery: 'p45b', thermal: 'lepton', imu: 'icm', fc: 'h743', gnss: 'neom9n', datalink: 'pmddl', pod: 'podeo',
  camera: 'imx477', lidar: 'lw20', esc: 'alpha80', motor: 'at7215', servo: 'hv6120', airspeed: 'ms4525', transponder: 'ping200', companion: 'orinnano', antenna: 'hg2409p', parachute: 'ifc60',
  frame: 'chimera7', prop: 'hq7035',
};

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
  { n: 'f1', text: 'base plate · 0.460 × 0.300 × 0.006 m', kind: 'sketch' },
  { n: 'f2', text: 'flange · 0.006 × 0.300 × 0.060 m', kind: 'extrude' },
  { n: 'f3', text: '4 holes ⌀ 6.5 mm · plate', kind: 'hole' },
  { n: 'f4', text: '2 holes ⌀ 6.5 mm · flange', kind: 'hole' },
];
/** The Kestrel sensor-bay plate: 460 x 300 x 6 mm aluminium with a 60 mm flange. The plate is a bracket inside the fuselage; it is not the wing span. */
export const PLATE_L = 0.46;
export const PLATE_W = 0.3;
export const PLATE_T = 0.006;

export type Dims = Record<Node, number>;
/** Slot heights in metres: the default part's published height (see the CATALOG comments); extrude edits them per project. */
export const EXTRA_DIMS = { camera: 0.0186, lidar: 0.02, esc: 0.019, motor: 0.0814, servo: 0.0265, airspeed: 0.007, transponder: 0.009, companion: 0.021, antenna: 0.023, parachute: 0.081, frame: 0.034, prop: 0.0067 } as const;
export const DIMS0: Dims = { battery: 0.048, imu: 0.008, fc: 0.0016, thermal: 0.012, airframe: 0.06, gnss: 0.008, datalink: 0.004, pod: 0.14, ...EXTRA_DIMS };

/** Wing span of the Kestrel airframe, metres: a civil survey fixed-wing of this class flies 1.2 to 2.4 m; the baseline is 1.8 m. Only the cruise-power model reads it. */
export const SPAN_MIN = 1.2;
export const SPAN_MAX = 2.4;
export const SPAN_BASELINE = 1.8;
export const EXTRUDE_MIN = 0.001;
export const EXTRUDE_MAX = 0.15;

export const SCENARIO: string[] = [
  'Baseline: Kestrel has no match in the 14-row limited scan. Human review is required; four IMU rows cannot fire and say so.',
  'Battery slot selected; the palette shows the packs that fit it. Click one or drag it onto the bracket.',
  'Amprius pack: endurance 3.25 h crosses 3.0 h; 9A012.a.2 fires; Germany STA, Taiwan and Vietnam LIC.',
  'Confirm: same function, performance, form and fit · attestor benji; the amber leaves the label, the spec and the timeline.',
  'Span 2.0 m: cruise W falls to 297 W, range 315 km crosses 300 km; MT fires regardless of payload; the strip stops changing.',
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
