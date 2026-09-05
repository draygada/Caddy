export const FIXTURE_META = Object.freeze({
  artifactStatus: 'SYNTHETIC_DEMO',
  fixtureMode: 'SYNTHETIC_DEMO',
  approvalStatus: 'STUBBED / UNAPPROVED',
  connectivity: 'OFFLINE FIXTURE',
  sourceDate: '2026-09-01',
  rulePackSha: 'sha256:ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f',
  destinationPolicySha: null,
})

const SOURCE_URL = 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774'

const syntheticAttr = (value, unit = null, note = 'Synthetic fixture value; not source or engineer verified.') => ({
  value,
  unit,
  source_url: null,
  quote: `SYNTHETIC_DEMO — ${note}`,
  span: null,
  doc_sha256: null,
  extracted_by: null,
})

const node = ({ id, kind, parent = null, role = null, mpn, partClass, attrs = {}, declared }) => ({
  id,
  kind,
  parent,
  role,
  mpn,
  vendor: 'Synthetic fixture lab',
  origin: null,
  value_usd: null,
  part_class: partClass,
  attrs,
  items: [],
  ...(declared ? { declared } : {}),
})

const BASE_NODES = [
  node({
    id: 'kestrel', kind: 'product', role: 'structure', mpn: 'SYN-KST-FW-01', partClass: 'airframe',
    attrs: {
      usable_fraction: syntheticAttr(0.85, 'ratio'),
      steady_power_W: syntheticAttr(300, 'W'),
      endurance_h: syntheticAttr(2.83, 'h', 'Derived as 1000 Wh × 0.85 ÷ 300 W.'),
      atmosphere_and_wind_assumption: syntheticAttr('ISA sea-level / calm wind'),
    },
    declared: { bvlos: true, civil_product: true, military_use: false, designed_to_incorporate: false },
  }),
  node({ id: 'airframe', kind: 'assembly', parent: 'kestrel', role: 'structure', mpn: 'SYN-AIRFRAME-A', partClass: 'airframe' }),
  node({ id: 'port_wing', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'SYN-WING-L', partClass: 'airframe' }),
  node({ id: 'starboard_wing', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'SYN-WING-R', partClass: 'airframe' }),
  node({ id: 'tailplane', kind: 'part', parent: 'airframe', role: 'structure', mpn: 'SYN-VTAIL-A', partClass: 'airframe' }),
  node({ id: 'propulsion', kind: 'assembly', parent: 'kestrel', role: 'power', mpn: 'SYN-PROP-A', partClass: 'motor' }),
  node({ id: 'motor', kind: 'part', parent: 'propulsion', role: 'power', mpn: 'SYN-MOTOR-08', partClass: 'motor' }),
  node({ id: 'prop', kind: 'part', parent: 'propulsion', role: 'power', mpn: 'SYN-PROP-18', partClass: 'prop' }),
  node({ id: 'sensor_pod', kind: 'assembly', parent: 'kestrel', role: 'sensor', mpn: 'SYN-POD-02', partClass: 'sensor' }),
  node({
    id: 'nose_thermal', kind: 'part', parent: 'sensor_pod', role: 'sensor', mpn: 'SYN-THERM-640', partClass: 'sensor',
    attrs: {
      frame_rate_hz: syntheticAttr(9, 'Hz'),
      fpa_elements: syntheticAttr(327680, 'elements'),
      fpa_qualifies_6A002_a_3_f: syntheticAttr(true),
      min_ifov_mrad_per_pixel: syntheticAttr(6, 'mrad/pixel'),
      fixed_focal_length_nonremovable: syntheticAttr(true),
      direct_view_display: syntheticAttr(false),
      facility_to_obtain_viewable_image: syntheticAttr(true),
      single_application_not_user_modifiable: syntheticAttr(false),
      designed_for_civilian_vehicle_under_3t: syntheticAttr(false),
      civil_vehicle_only_operable_when_installed: syntheticAttr(false),
      removal_disables_camera: syntheticAttr(false),
    },
    declared: { civil_product: false },
  }),
  node({ id: 'eo_camera', kind: 'part', parent: 'sensor_pod', role: 'sensor', mpn: 'SYN-EO-12', partClass: 'sensor' }),
  node({ id: 'fc_board', kind: 'assembly', parent: 'kestrel', role: 'nav', mpn: 'SYN-FC-R3', partClass: 'board' }),
  node({ id: 'fc_mcu', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-MCU-A', partClass: 'ic' }),
  node({ id: 'io_mcu', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-MCU-IO', partClass: 'ic' }),
  node({
    id: 'imu', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-IMU-6D', partClass: 'sensor',
    attrs: {
      gyro_rate_range_deg_s: syntheticAttr(250, 'deg/s'),
      gyro_bias_stability_1mo_deg_h: syntheticAttr(null, 'deg/h', 'Required one-month fixed-calibration evidence is intentionally absent.'),
    },
    declared: { spinning_mass: false },
  }),
  node({ id: 'baro', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-BARO-01', partClass: 'sensor' }),
  node({ id: 'mag', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-MAG-03', partClass: 'sensor' }),
  node({ id: 'gnss', kind: 'part', parent: 'fc_board', role: 'nav', mpn: 'SYN-GNSS-09', partClass: 'sensor' }),
  node({
    id: 'battery_pack', kind: 'part', parent: 'kestrel', role: 'power', mpn: 'SYN-BATT-1000', partClass: 'cell',
    attrs: { energy_capacity_Wh: syntheticAttr(1000, 'Wh') },
  }),
  node({ id: 'datalink', kind: 'part', parent: 'kestrel', role: 'comms', mpn: 'SYN-LINK-48', partClass: 'radio' }),
]

function makeDesign(mutator) {
  const design = {
    root: 'kestrel',
    rule_pack_sha: FIXTURE_META.rulePackSha,
    nodes: BASE_NODES.map((item) => ({
      ...item,
      attrs: Object.fromEntries(Object.entries(item.attrs).map(([key, attr]) => [key, { ...attr }])),
      items: item.items.map((entry) => ({ ...entry })),
      ...(item.declared ? { declared: { ...item.declared } } : {}),
    })),
  }
  if (mutator) mutator(design)
  return design
}

const updateAttr = (design, nodeId, attribute, value, unit, note) => {
  const target = design.nodes.find((item) => item.id === nodeId)
  target.attrs[attribute] = syntheticAttr(value, unit, note)
}

export const DESIGN_FIXTURES = Object.freeze({
  baseline: makeDesign(),
  f1: makeDesign((design) => {
    updateAttr(design, 'battery_pack', 'energy_capacity_Wh', 1300, 'Wh')
    updateAttr(design, 'kestrel', 'endurance_h', 3.68, 'h', 'Derived as 1300 Wh × 0.85 ÷ 300 W.')
  }),
  f3: makeDesign((design) => updateAttr(design, 'nose_thermal', 'frame_rate_hz', 60, 'Hz')),
  f8: makeDesign(),
  missing: makeDesign(),
})

export const DESIGN = DESIGN_FIXTURES.baseline

export const NODE_PRESENTATION = Object.freeze({
  kestrel: { label: 'Kestrel UAS', short: 'Kestrel', detail: 'Synthetic fixed-wing product fixture' },
  airframe: { label: 'Airframe shell', short: 'Airframe', detail: 'Neutral composite shell' },
  port_wing: { label: 'Port wing', short: 'Port wing', detail: 'Synthetic wing structure' },
  starboard_wing: { label: 'Starboard wing', short: 'Starboard wing', detail: 'Synthetic wing structure' },
  tailplane: { label: 'V-tail assembly', short: 'V-tail', detail: 'Synthetic tail structure' },
  propulsion: { label: 'Propulsion assembly', short: 'Propulsion', detail: 'Synthetic pusher assembly' },
  motor: { label: 'Pusher motor', short: 'Motor', detail: 'Synthetic motor placeholder' },
  prop: { label: 'Pusher propeller', short: 'Propeller', detail: 'Synthetic propeller placeholder' },
  sensor_pod: { label: 'Belly sensor pod', short: 'Sensor pod', detail: 'Synthetic exterior pod' },
  nose_thermal: { label: 'Nose thermal camera', short: 'Thermal', detail: 'Synthetic camera facts; no real product asserted' },
  eo_camera: { label: 'Belly EO camera', short: 'EO camera', detail: 'Synthetic camera placeholder' },
  fc_board: { label: 'Flight-controller board', short: 'FC board', detail: 'Schematic internal location' },
  fc_mcu: { label: 'Primary MCU', short: 'Primary MCU', detail: 'Schematic internal component' },
  io_mcu: { label: 'I/O MCU', short: 'I/O MCU', detail: 'Schematic internal component' },
  imu: { label: 'Inertial measurement unit', short: 'IMU', detail: 'Synthetic facts with intentional evidence gap' },
  baro: { label: 'Barometer', short: 'Barometer', detail: 'Schematic internal component' },
  mag: { label: 'Magnetometer', short: 'Magnetometer', detail: 'Schematic internal component' },
  gnss: { label: 'GNSS receiver', short: 'GNSS', detail: 'Synthetic navigation component' },
  battery_pack: { label: 'Battery pack', short: 'Battery', detail: 'Synthetic energy input' },
  datalink: { label: 'Mast datalink', short: 'Datalink', detail: 'Synthetic communications component' },
})

export const KESTREL_SCENE_NODES = Object.freeze([
  { nodeId: 'kestrel', position: [0, 0, 0], shape: 'fuselage', internal: false },
  { nodeId: 'airframe', position: [1.52, 0, 0], shape: 'nose', internal: false },
  { nodeId: 'port_wing', position: [-0.08, -0.01, 1.17], shape: 'portWing', internal: false },
  { nodeId: 'starboard_wing', position: [-0.08, -0.01, -1.17], shape: 'starboardWing', internal: false },
  { nodeId: 'tailplane', position: [-1.25, 0.14, 0], shape: 'tail', internal: false },
  { nodeId: 'propulsion', position: [-1.66, 0, 0], shape: 'motorMount', internal: false },
  { nodeId: 'motor', position: [-1.82, 0, 0], shape: 'motor', internal: false },
  { nodeId: 'prop', position: [-2.02, 0, 0], shape: 'propeller', internal: false },
  { nodeId: 'sensor_pod', position: [0.45, -0.32, 0], shape: 'pod', internal: false },
  { nodeId: 'nose_thermal', position: [1.73, -0.16, 0], shape: 'camera', internal: false },
  { nodeId: 'eo_camera', position: [0.62, -0.49, 0], shape: 'lens', internal: false },
  { nodeId: 'fc_board', position: [0.1, 0.12, 0.28], shape: 'board', internal: true },
  { nodeId: 'fc_mcu', position: [0.02, 0.19, 0.27], shape: 'chipLarge', internal: true },
  { nodeId: 'io_mcu', position: [0.25, 0.19, 0.27], shape: 'chip', internal: true },
  { nodeId: 'imu', position: [-0.16, 0.19, 0.27], shape: 'chip', internal: true },
  { nodeId: 'baro', position: [0.2, 0.19, 0.08], shape: 'chipSmall', internal: true },
  { nodeId: 'mag', position: [-0.12, 0.19, 0.08], shape: 'chipSmall', internal: true },
  { nodeId: 'gnss', position: [0.02, 0.2, -0.17], shape: 'gnss', internal: true },
  { nodeId: 'battery_pack', position: [-0.56, 0.12, 0], shape: 'battery', internal: true },
  { nodeId: 'datalink', position: [-0.58, 0.48, 0], shape: 'datalink', internal: false },
])

export const KESTREL_SLOTS = Object.freeze([
  { id: 'nose_thermal', label: 'Nose', note: 'exterior location', primaryNodeId: 'nose_thermal', nodeIds: ['nose_thermal'], anchor: [1.83, 0.54, 0.02] },
  { id: 'belly_sensor_pod', label: 'Belly', note: 'exterior location', primaryNodeId: 'sensor_pod', nodeIds: ['sensor_pod', 'eo_camera'], anchor: [0.62, -0.42, 0.44] },
  { id: 'fc_bay', label: 'FC bay', note: 'schematic location', primaryNodeId: 'fc_board', nodeIds: ['fc_board', 'fc_mcu', 'io_mcu', 'imu', 'baro', 'mag', 'gnss'], anchor: [0.08, 0.86, 0.48] },
  { id: 'battery_bay', label: 'Battery bay', note: 'schematic location', primaryNodeId: 'battery_pack', nodeIds: ['battery_pack'], anchor: [-0.62, 0.76, -0.44] },
  { id: 'mast_datalink', label: 'Mast', note: 'exterior location', primaryNodeId: 'datalink', nodeIds: ['datalink'], anchor: [-0.62, 1.05, 0.12] },
])

const DESIGN_REVISIONS = Object.freeze({
  baseline: 'sha256:dce8e8ee9202e69e8afc9b5c21bb03ab0a464aa74a7fd8f72aaa9feb56f5e37a',
  f1: 'sha256:627f2f29af653eaf63a9d0d120d9428fba03abe8514b26ce4889d843dd8be6be',
  f3: 'sha256:ce0a03e8c3a58d01e128114a28e970f3daf232709b19c6bc1a8700411822e9d2',
  f8: 'sha256:dce8e8ee9202e69e8afc9b5c21bb03ab0a464aa74a7fd8f72aaa9feb56f5e37a',
  missing: 'sha256:dce8e8ee9202e69e8afc9b5c21bb03ab0a464aa74a7fd8f72aaa9feb56f5e37a',
})

function emptyDetermination() {
  return {
    state: 'clear',
    jurisdiction: null,
    entries: [],
    direct_tripwires: [],
    propagated_tripwires: [],
    unresolved_tripwires: [],
    destinations: { status: 'not_evaluated', reason: 'SYNTHETIC_DEMO has no approved destination policy.' },
    evidence_level: 'synthetic',
  }
}

const nodeIds = DESIGN.nodes.map((item) => item.id)

function determinationsWith(overrides = {}) {
  return Object.fromEntries(nodeIds.map((nodeId) => [
    nodeId,
    overrides[nodeId] ? { ...emptyDetermination(), ...overrides[nodeId] } : emptyDetermination(),
  ]))
}

const syntheticEvidence = () => ({ level: 'synthetic', sha256: null, span: null })

const f1EnduranceTripwire = {
  rule_id: 'CCL-9A012.a.2',
  state: 'fired',
  jurisdiction: 'EAR',
  entry: '9A012.a.2',
  reason_for_control: ['NS1', 'AT1'],
  node_id: 'kestrel',
  cause_node_id: 'battery_pack',
  facts: [
    { attribute: 'bvlos', observed: true, unit: null, operator: 'equals', threshold: true },
    { attribute: 'formula', observed: 'energy_Wh × usable_fraction ÷ steady_power_W', unit: null, operator: 'equals', threshold: 'declared synthetic model' },
    { attribute: 'baseline_energy_Wh', observed: 1000, unit: 'Wh', operator: 'equals', threshold: 1000 },
    { attribute: 'F1_energy_Wh', observed: 1300, unit: 'Wh', operator: 'equals', threshold: 1300 },
    { attribute: 'usable_fraction', observed: 0.85, unit: 'ratio', operator: 'equals', threshold: 0.85 },
    { attribute: 'steady_or_maximum_power_assumption', observed: 300, unit: 'W', operator: 'equals', threshold: 300 },
    { attribute: 'atmosphere_and_wind_assumption', observed: 'ISA sea-level / calm wind', unit: null, operator: 'equals', threshold: 'ISA sea-level / calm wind' },
    { attribute: 'baseline_result_h', observed: 2.83, unit: 'h', operator: '<', threshold: 3 },
    { attribute: 'F1_result_h', observed: 3.68, unit: 'h', operator: '>=', threshold: 3 },
  ],
  text: "a.2. A maximum 'endurance' of 3 hours or greater;",
  source_url: SOURCE_URL,
  ecfr_date: FIXTURE_META.sourceDate,
  rule_effective: '2026-08-13',
  evidence: syntheticEvidence(),
}

const f3CameraTripwire = {
  rule_id: 'CCL-6A003.b.4.b',
  state: 'fired',
  jurisdiction: 'EAR',
  entry: '6A003.b.4.b',
  reason_for_control: ['NS2', 'AT1'],
  node_id: 'nose_thermal',
  cause_node_id: 'nose_thermal',
  facts: [
    { attribute: 'frame_rate_hz', observed: 60, unit: 'Hz', operator: '>', threshold: 9 },
    { attribute: 'fpa_qualifies_6A002_a_3_f', observed: true, unit: null, operator: 'equals', threshold: true },
    { attribute: 'note_3_a_max_frame_rate_exclusion', observed: false, unit: null, operator: 'equals', threshold: false },
    { attribute: 'note_3_b_min_ifov_mrad_per_pixel', observed: 6, unit: 'mrad/pixel', operator: '<', threshold: 10 },
    { attribute: 'note_3_b_fixed_focal_length_nonremovable', observed: true, unit: null, operator: 'equals', threshold: true },
    { attribute: 'note_3_b_direct_view_display', observed: false, unit: null, operator: 'equals', threshold: false },
    { attribute: 'note_3_b_facility_to_obtain_viewable_image', observed: true, unit: null, operator: 'equals', threshold: true },
    { attribute: 'note_3_b_single_application_not_user_modifiable', observed: false, unit: null, operator: 'equals', threshold: false },
    { attribute: 'note_3_c_designed_for_civilian_vehicle_under_3t', observed: false, unit: null, operator: 'equals', threshold: false },
    { attribute: 'note_3_c_vehicle_only_operable_when_installed', observed: false, unit: null, operator: 'equals', threshold: false },
    { attribute: 'note_3_c_removal_disables_camera', observed: false, unit: null, operator: 'equals', threshold: false },
  ],
  text: 'b.4.b. Incorporating “focal plane arrays” controlled by 6A002.a.3.f; or',
  source_url: SOURCE_URL,
  ecfr_date: FIXTURE_META.sourceDate,
  rule_effective: null,
  evidence: syntheticEvidence(),
}

const f3RsTripwire = {
  rule_id: 'CCL-6A003.b.4.b-RS1',
  state: 'fired',
  jurisdiction: 'EAR',
  entry: '6A003.b.4.b (RS1)',
  reason_for_control: ['RS1'],
  node_id: 'nose_thermal',
  cause_node_id: 'nose_thermal',
  facts: [
    { attribute: 'requires_entry', observed: '6A003.b.4.b', unit: null, operator: 'equals', threshold: '6A003.b.4.b' },
    { attribute: 'frame_rate_hz', observed: 60, unit: 'Hz', operator: '>', threshold: 60 },
    { attribute: 'fpa_elements', observed: 327680, unit: 'elements', operator: '>', threshold: 111000 },
    { attribute: 'civil_product_embedding_branch', observed: false, unit: null, operator: 'equals', threshold: true },
  ],
  text: 'RS applies to 6A003.b.3, 6A003.b.4.a, 6A003.b.4.c and to items controlled in 6A003.b.4.b that have a frame rate greater than 60 Hz or that incorporate a focal plane array with more than 111,000 elements, or to items in 6A003.b.4.b when being exported or reexported to be embedded in a civil product. (But see § 742.6(a)(2)(iii) and (v) for certain exemptions)',
  source_url: SOURCE_URL,
  ecfr_date: FIXTURE_META.sourceDate,
  rule_effective: null,
  evidence: syntheticEvidence(),
}

const f3ParentTripwire = {
  rule_id: 'CCL-9A012.a.3',
  state: 'fired',
  jurisdiction: 'EAR',
  entry: '9A012.a.3',
  reason_for_control: ['NS1', 'AT1'],
  node_id: 'kestrel',
  cause_node_id: 'nose_thermal',
  path: ['nose_thermal', 'sensor_pod', 'kestrel'],
  facts: [
    { attribute: 'bvlos', observed: true, unit: null, operator: 'equals', threshold: true },
    { attribute: 'installed_descendant_entry', observed: '6A003.b.4.b', unit: null, operator: 'in', threshold: ['6A003.b.3', '6A003.b.4.b', '6A008.d', '6A008.e', '6A008.f', '6A008.g', '6A008.h'] },
  ],
  text: 'a.3. “UAVs” or unmanned “airships” incorporating items specified in ECCN 6A003.b.3, 6A003.b.4.b, or 6A008.d to .h;',
  source_url: SOURCE_URL,
  ecfr_date: FIXTURE_META.sourceDate,
  rule_effective: '2026-08-13',
  evidence: syntheticEvidence(),
}

const missingImuEvidence = {
  rule_id: 'CCL-7A002.a.1.a',
  state: 'cannot_evaluate',
  jurisdiction: 'EAR',
  entry: '7A002.a.1.a',
  reason_for_control: ['NS1', 'AT1'],
  node_id: 'imu',
  cause_node_id: 'imu',
  missing_fact: 'gyro_bias_stability_1mo_deg_h',
  question: 'Needs one-month fixed-calibration bias stability.',
  facts: [
    { attribute: 'gyro_rate_range_deg_s', observed: 250, unit: 'deg/s', operator: '<', threshold: 500 },
    { attribute: 'gyro_bias_stability_1mo_deg_h', observed: null, unit: 'deg/h', operator: '<', threshold: 0.5 },
    { attribute: 'measurement_environment', observed: '1 g', unit: null, operator: 'equals', threshold: '1 g' },
    { attribute: 'measurement_period', observed: null, unit: null, operator: 'equals', threshold: 'one month' },
    { attribute: 'calibration_basis', observed: null, unit: null, operator: 'equals', threshold: 'fixed calibration value' },
  ],
  text: 'a.1.a. A “bias” “stability” of less (better) than 0.5 degree per hour, when measured in a 1 g environment over a period of one month, and with respect to a fixed calibration value; or',
  source_url: SOURCE_URL,
  ecfr_date: FIXTURE_META.sourceDate,
  rule_effective: null,
  evidence: { level: 'missing', sha256: null, span: null },
}

function response({ scenarioId, requestId, determinations, delta }) {
  const summary = { clear: 0, watch: 0, question: 0, flag: 0 }
  Object.values(determinations).forEach(({ state }) => { summary[state] += 1 })
  return {
    request_id: requestId,
    stub: true,
    fixture_mode: FIXTURE_META.fixtureMode,
    design_revision: DESIGN_REVISIONS[scenarioId],
    rule_pack_sha: FIXTURE_META.rulePackSha,
    destination_policy_sha: FIXTURE_META.destinationPolicySha,
    ecfr_date: FIXTURE_META.sourceDate,
    determinations,
    delta,
    summary,
  }
}

const baselineResponse = response({
  scenarioId: 'baseline', requestId: 1, determinations: determinationsWith(),
  delta: {
    changed_nodes: ['nose_thermal', 'kestrel'],
    tripwires_added: [],
    tripwires_removed: [
      { node_id: 'nose_thermal', rule_id: f3CameraTripwire.rule_id, kind: 'direct' },
      { node_id: 'nose_thermal', rule_id: f3RsTripwire.rule_id, kind: 'direct' },
      { node_id: 'kestrel', rule_id: f3ParentTripwire.rule_id, kind: 'propagated', cause_node_id: 'nose_thermal' },
    ],
    rules_evaluated: [f3CameraTripwire.rule_id, f3RsTripwire.rule_id, f3ParentTripwire.rule_id],
  },
})

const f1Response = response({
  scenarioId: 'f1', requestId: 2,
  determinations: determinationsWith({
    kestrel: {
      state: 'flag', jurisdiction: 'EAR', entries: ['9A012.a.2'], direct_tripwires: [f1EnduranceTripwire],
      destinations: { status: 'not_evaluated', reason: 'SYNTHETIC_DEMO has no approved destination policy.' }, evidence_level: 'synthetic',
    },
  }),
  delta: {
    changed_nodes: ['battery_pack', 'kestrel'],
    tripwires_added: [{ node_id: 'kestrel', rule_id: f1EnduranceTripwire.rule_id, kind: 'direct', cause_node_id: 'battery_pack' }],
    tripwires_removed: [{ node_id: 'kestrel', rule_id: 'CCL-9A012.a.1', kind: 'direct', cause_node_id: 'battery_pack' }],
    rules_evaluated: ['CCL-9A012.a.1', f1EnduranceTripwire.rule_id],
  },
})

const f3Response = response({
  scenarioId: 'f3', requestId: 3,
  determinations: determinationsWith({
    nose_thermal: {
      state: 'flag', jurisdiction: 'EAR', entries: ['6A003.b.4.b'], direct_tripwires: [f3CameraTripwire, f3RsTripwire],
      destinations: { status: 'not_evaluated', reason: 'SYNTHETIC_DEMO has no approved destination policy.' }, evidence_level: 'synthetic',
    },
    kestrel: {
      state: 'flag', jurisdiction: 'EAR', entries: ['9A012.a.3'], propagated_tripwires: [f3ParentTripwire],
      destinations: { status: 'not_evaluated', reason: 'SYNTHETIC_DEMO has no approved destination policy.' }, evidence_level: 'synthetic',
    },
  }),
  delta: {
    changed_nodes: ['nose_thermal', 'kestrel'],
    tripwires_added: [
      { node_id: 'nose_thermal', rule_id: f3CameraTripwire.rule_id, kind: 'direct' },
      { node_id: 'nose_thermal', rule_id: f3RsTripwire.rule_id, kind: 'direct' },
      { node_id: 'kestrel', rule_id: f3ParentTripwire.rule_id, kind: 'propagated', cause_node_id: 'nose_thermal' },
    ],
    tripwires_removed: [],
    rules_evaluated: [f3CameraTripwire.rule_id, f3RsTripwire.rule_id, f3ParentTripwire.rule_id],
  },
})

const f8Response = response({
  scenarioId: 'f8', requestId: 4, determinations: determinationsWith(),
  delta: { changed_nodes: [], tripwires_added: [], tripwires_removed: [], rules_evaluated: ['F8-NO-CHANGE-CONTROL'] },
})

const missingResponse = response({
  scenarioId: 'missing', requestId: 5,
  determinations: determinationsWith({
    imu: {
      state: 'question', jurisdiction: null, entries: [], unresolved_tripwires: [missingImuEvidence],
      destinations: { status: 'not_evaluated', reason: 'SYNTHETIC_DEMO has no approved destination policy.' }, evidence_level: 'missing',
    },
  }),
  delta: {
    changed_nodes: ['imu'],
    tripwires_added: [{ node_id: 'imu', rule_id: missingImuEvidence.rule_id, kind: 'unresolved' }],
    tripwires_removed: [],
    rules_evaluated: [missingImuEvidence.rule_id],
  },
})

export const SCENARIOS = Object.freeze({
  baseline: {
    id: 'baseline', short: 'BASE', label: 'Baseline', artifact_status: FIXTURE_META.artifactStatus, approval_status: FIXTURE_META.approvalStatus,
    eyebrow: 'BASE · 9 HZ CAMERA', headline: 'Baseline restored · active camera markers cleared',
    detail: 'Synthetic baseline facts only. The prior change remains visible in session history.', focusNodeId: 'nose_thermal', response: baselineResponse,
  },
  f1: {
    id: 'f1', short: 'F1', label: 'Energy / endurance', artifact_status: FIXTURE_META.artifactStatus, approval_status: FIXTURE_META.approvalStatus,
    eyebrow: 'F1 · GOVERNED SYNTHETIC ENERGY', headline: '1000 → 1300 Wh · derived endurance 2.83 → 3.68 h',
    detail: 'The airframe is the result node; the battery is only the causal input to the declared synthetic model.', focusNodeId: 'kestrel', response: f1Response,
  },
  f3: {
    id: 'f3', short: 'F3', label: 'Complete camera predicate', artifact_status: FIXTURE_META.artifactStatus, approval_status: FIXTURE_META.approvalStatus,
    eyebrow: 'F3 · COMPLETE SIGNED-PREDICATE SHAPE', headline: 'Camera direct tripwires · separate parent propagation',
    detail: '9 / 60 / 111,000 thresholds appear with the FPA prerequisite, Note 3 exclusions, and RS1 prerequisite—not frame rate alone.', focusNodeId: 'nose_thermal', response: f3Response,
  },
  f8: {
    id: 'f8', short: 'F8', label: 'No-change control', artifact_status: FIXTURE_META.artifactStatus, approval_status: FIXTURE_META.approvalStatus,
    eyebrow: 'F8 · CONTROL', headline: '0 determinations changed',
    detail: 'The fixture replay reports no visual delta; no marker pulse is manufactured.', focusNodeId: 'kestrel', response: f8Response,
  },
  missing: {
    id: 'missing', short: '?', label: 'Missing evidence', artifact_status: FIXTURE_META.artifactStatus, approval_status: FIXTURE_META.approvalStatus,
    eyebrow: 'MISSING EVIDENCE · CANNOT EVALUATE', headline: 'Needs one-month fixed-calibration bias stability',
    detail: 'Required IMU evidence is absent, so the result remains a question and is never painted clear.', focusNodeId: 'imu', response: missingResponse,
  },
})

export const SCENARIO_ORDER = Object.freeze(['baseline', 'f1', 'f3', 'f8', 'missing'])

export function getNode(nodeId, design = DESIGN) {
  return design.nodes.find((item) => item.id === nodeId)
}

export function getNodeLabel(nodeId) {
  return NODE_PRESENTATION[nodeId]?.label ?? nodeId
}

export function responseForScenario(scenarioId, requestId) {
  const scenario = SCENARIOS[scenarioId]
  if (!scenario) throw new Error(`Unknown fixture scenario: ${scenarioId}`)
  return { ...scenario.response, request_id: requestId }
}

const requiredTripwireKeys = ['rule_id', 'state', 'jurisdiction', 'entry', 'reason_for_control', 'node_id', 'cause_node_id', 'facts', 'text', 'source_url', 'ecfr_date', 'rule_effective', 'evidence']

export function assertResponseContract(candidate, expected) {
  if (!candidate || typeof candidate !== 'object') throw new Error('Evaluation response is missing')
  if (candidate.request_id !== expected.requestId) throw new Error(`Mismatched request_id: expected ${expected.requestId}, received ${String(candidate.request_id)}`)
  if (candidate.design_revision !== expected.designRevision) throw new Error(`Mismatched design_revision: expected ${expected.designRevision}, received ${String(candidate.design_revision)}`)
  if (candidate.rule_pack_sha !== expected.rulePackSha) throw new Error(`Mismatched rule_pack_sha: expected ${expected.rulePackSha}, received ${String(candidate.rule_pack_sha)}`)
  if (candidate.stub !== true || candidate.fixture_mode !== 'SYNTHETIC_DEMO') throw new Error('Response posture mismatch: only stubbed SYNTHETIC_DEMO fixtures are admitted')
  const designIds = new Set(nodeIds)
  for (const [nodeId, determination] of Object.entries(candidate.determinations ?? {})) {
    if (!designIds.has(nodeId)) throw new Error(`Unknown response node_id: ${nodeId}`)
    if (!['clear', 'watch', 'question', 'flag'].includes(determination.state)) throw new Error(`Unknown presentation state ${String(determination.state)} for ${nodeId}`)
    for (const collection of ['direct_tripwires', 'propagated_tripwires', 'unresolved_tripwires']) {
      if (!Array.isArray(determination[collection])) throw new Error(`${collection} must be an array for ${nodeId}`)
      for (const tripwire of determination[collection]) {
        for (const key of requiredTripwireKeys) if (!(key in tripwire)) throw new Error(`${collection} object on ${nodeId} is missing ${key}`)
        if (!Array.isArray(tripwire.facts) || tripwire.facts.length === 0) throw new Error(`${tripwire.rule_id} must expose complete facts[]`)
        if (tripwire.node_id !== nodeId) throw new Error(`${tripwire.rule_id} target node mismatch`)
        if (!designIds.has(tripwire.cause_node_id)) throw new Error(`${tripwire.rule_id} has unknown cause node`)
        if (collection === 'propagated_tripwires' && (!Array.isArray(tripwire.path) || tripwire.path.length < 2)) throw new Error(`${tripwire.rule_id} is missing propagation path`)
        if (collection === 'unresolved_tripwires' && !tripwire.missing_fact) throw new Error(`${tripwire.rule_id} is missing missing_fact`)
      }
    }
    if (!determination.destinations || determination.destinations.status !== 'not_evaluated') throw new Error(`Destination posture mismatch for ${nodeId}`)
  }
  for (const nodeId of designIds) if (!candidate.determinations?.[nodeId]) throw new Error(`Response missing node_id: ${nodeId}`)
  return true
}

export function assertFixtureContract() {
  for (const [scenarioId, design] of Object.entries(DESIGN_FIXTURES)) {
    const designIds = new Set()
    for (const item of design.nodes) {
      if (designIds.has(item.id)) throw new Error(`Duplicate design node_id: ${item.id}`)
      designIds.add(item.id)
    }
    const root = design.nodes.find((item) => item.id === design.root)
    if (!root || root.kind !== 'product') throw new Error(`Invalid product root in ${scenarioId}`)
    for (const item of design.nodes) if (item.parent !== null && !designIds.has(item.parent)) throw new Error(`Unknown parent node_id ${item.parent} for ${item.id}`)
  }
  const sceneIds = new Set()
  for (const binding of KESTREL_SCENE_NODES) {
    if (!nodeIds.includes(binding.nodeId)) throw new Error(`Unknown scene node_id: ${binding.nodeId}`)
    if (sceneIds.has(binding.nodeId)) throw new Error(`Duplicate scene node_id binding: ${binding.nodeId}`)
    sceneIds.add(binding.nodeId)
  }
  for (const nodeId of nodeIds) if (!sceneIds.has(nodeId)) throw new Error(`Design node has no scene binding: ${nodeId}`)
  for (const slot of KESTREL_SLOTS) {
    for (const nodeId of slot.nodeIds) if (!nodeIds.includes(nodeId)) throw new Error(`Unknown slot node_id ${nodeId} in ${slot.id}`)
  }
  for (const scenarioId of SCENARIO_ORDER) {
    const candidate = SCENARIOS[scenarioId].response
    assertResponseContract(candidate, { requestId: candidate.request_id, designRevision: DESIGN_REVISIONS[scenarioId], rulePackSha: FIXTURE_META.rulePackSha })
  }
  return true
}
