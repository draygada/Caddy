import { create } from 'zustand';
import {
  BASELINE_PARTS, CATALOG, CMP_KEYS, DECLARED0, DEFAULT_POS, DIMS0, EXTRUDE_MAX, EXTRUDE_MIN, FIELDS, RULES_EVALUATED, SCENARIO, SEED_EVENTS, SEED_FEATURES,
  CORE_SLOTS, GENERIC_NAME, SLOTS, SLOT_LABEL, SPAN_BASELINE, SPAN_MAX, SPAN_MIN,
  type CmpKey, type Declared, type Dims, type Feature, type FieldSpec, type Lane, type Node, type PartAttrs, type PartId, type Slot, type TimelineEvent,
} from './lib/catalog';
import { GEO0, type Geo, type Pos, type Positions, type Snapshot } from './lib/design';
import { hashOf, parseDecimal } from './lib/hash';
import { countChanged, type Attrs, type Design, type Parts } from './lib/rules';
import { service, type ServiceState } from './lib/service';
import { CONSTRAINTS, SKETCH_DEFAULT, solveSketch } from './lib/sketch';
import type { Unit } from './lib/units';
import { defaultDecline, estimate, gateFor, linesFor, offersFor, rollup, tierFor, walk, type DeclineReason, type Line, type Mode, type OfferStatus, type ResolvedOffer, type ShipTo } from './lib/sourcing';
import type { Outcome } from './lib/rules';
import type { ViewName } from './lib/geometry';
import { callA, callB, DOCS, netFor, type Candidate, type NetLine, type Proposal, type SourceDocId } from './lib/sources';
import { draftMemo, memoHash, citationsWithin, type Memo } from './lib/memo';
import { proposeSlotList, searchTarget, type Ranked, type SlotListProposal, type TargetConstraints } from './lib/propose';
import { PACKS, type PackId } from './lib/catalog';

export type { Pos, Positions } from './lib/design';
export type Theme = 'light' | 'dark';
/** The three tabs. */
export type WorkspaceId = 'design' | 'classification' | 'sourcing';
export const PRIMARY_WORKSPACES: { id: WorkspaceId; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'classification', label: 'Classification' },
  { id: 'sourcing', label: 'Sourcing' },
];
export type ViewMode = 'model' | 'sketch' | 'board';
export type NavMode = 'orbit' | 'pan' | 'zoom';
export type VisualStyle = 'shaded' | 'edges' | 'wireframe';
export type SelFilter = 'component' | 'body' | 'face';
export const DESIGN_PROJECT_ID = 'product:caddydaddy:kestrel' as const;
export const DESIGN_PROJECT_NAME = 'Kestrel' as const;
export const DESIGN_PRODUCT_THREAD_RELATIONSHIP = 'SEPARATE_LEGACY_DESIGN_CONTEXT_NOT_QX_0_PRODUCT_THREAD' as const;
/** body ids: a slot, or one of the airframe's two bodies */
export type BodyId = Slot | 'plate' | 'flange';
export const BODY_LABEL: Record<BodyId, string> = { plate: 'Base plate', flange: 'Flange', ...GENERIC_NAME };
export const isBodyId = (s: string): s is BodyId => s in BODY_LABEL;
export const nodeOfBody = (b: BodyId): Node => (b === 'plate' || b === 'flange' ? 'airframe' : b);

export type DialogKind = 'extrude' | 'hole' | 'fillet' | 'chamfer' | 'move' | 'measure' | 'section' | 'sketch' | 'properties' | 'save_version' | 'add_comment' | 'named_view' | 'door3' | 'target';
export interface Dialog { kind: DialogKind; target: BodyId | null }
export interface Preview { dims?: Dims; geo?: Geo; pos?: Positions }
export interface Pending { slot: Slot; from: PartId; to: PartId; seq: number; changed: CmpKey[] }
export interface NamedView { id: string; name: string; az: number; el: number; zoom: number; pan: { x: number; y: number } }
export interface CameraHome { az: number; el: number; zoom: number }
export interface Version { v: number; seq: number; comment: string; at: string }
export interface Comment { id: string; seq: number; author: string; text: string; at: string }
export interface Section { on: boolean; axis: 0 | 1 | 2; at: number }

export type RoundStatus = 'opened' | 'offers_resolved' | 'screened' | 'costed' | 'selection_confirmed' | 'gated' | 'package_ready';
export const ROUND_RAIL: { status: RoundStatus; label: string }[] = [
  { status: 'opened', label: 'opened' }, { status: 'offers_resolved', label: 'offers' }, { status: 'screened', label: 'screened' }, { status: 'costed', label: 'costed' },
  { status: 'selection_confirmed', label: 'selected' }, { status: 'gated', label: 'gated' }, { status: 'package_ready', label: 'packaged' },
];
export interface RoundSelection { offerId: string; attestor: string; seq: number; declined: { offerId: string; seller: string; reason: DeclineReason; statusAtDecline: OfferStatus }[] }
export interface Declaration { personStatus: 'US person' | 'foreign person'; sharing: string; reference: string; attestor: string }
/** Declared facts about the use case and the end user, asked before the search runs. Declared, badged, never inferred. */
export interface Intake {
  endUse: 'civil survey and mapping' | 'agriculture' | 'public safety' | 'infrastructure inspection' | 'defense-adjacent research' | 'other' | 'not sure yet';
  endUser: 'commercial operator' | 'university' | 'government agency (civil)' | 'military or defense prime' | 'not sure yet';
  shipTo: ShipTo;
  qty: number;
  mode: Mode;
  civilProduct: boolean;
  bvlos: boolean;
  usedOn: 'none' | 'in-production unlisted aircraft' | 'listed military aircraft' | 'not sure yet';
  notes: string;
}
export const INTAKE_DEFAULT: Intake = { endUse: 'civil survey and mapping', endUser: 'commercial operator', shipTo: 'US', qty: 1, mode: 'air', civilProduct: false, bvlos: false, usedOn: 'none', notes: '' };
/** True when a required answer is still "not sure yet": classification and sourcing then ask for more information. */
export const intakeIncomplete = (i: Intake | null) => !i || i.endUse === 'not sure yet' || i.endUser === 'not sure yet' || i.usedOn === 'not sure yet';

/** A project is a design plus the declared use-case answers. The sample project ships with its answers filled in. */
export interface Project {
  id: string; name: string; description: string; intake: Intake | null; createdAt: string; openedAt: string;
  /** the component types this project holds: the core seven plus whatever was added from the library */
  components: Slot[];
  /** the design as last left; drives the card preview */
  snapshot?: Snapshot;
}
export type OrderState = 'DRAFT' | 'DISPATCH_PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'EXCEPTION' | 'DISPATCH_UNKNOWN' | 'CLOSED';
export interface Order { key: string; packetHash: string; state: OrderState; receipt: string | null; attempts: number; trail: string[] }
export interface Round {
  id: string;
  designSeq: number;
  designHash: string;
  shipTo: ShipTo;
  qty: number;
  mode: Mode;
  intake: Intake;
  status: RoundStatus;
  lines: Line[];
  offers: Record<string, ResolvedOffer[]>;
  selections: Record<string, RoundSelection>;
  references: Record<string, { ref: string; attestor: string }>;
  declaration: Declaration | null;
  pkg: { preEntry: string; diligence: string; exportRefs: string; at: string } | null;
  pkgRefusal: string | null;
  order: Order | null;
  supersededBy: string | null;
}
/** Content fingerprint of the design snapshot, for round binding and staleness. Local stand-in for the service's canonical hash. */
export function designHashOf(s: Snapshot): string {
  const json = JSON.stringify([s.parts, s.attrs, s.pos, s.span, s.dims, s.features, s.geo]);
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) >>> 0;
  return hashOf(h);
}

export interface WorkbenchState extends Snapshot {
  workflowIdentity: {
    projectId: typeof DESIGN_PROJECT_ID;
    projectName: typeof DESIGN_PROJECT_NAME;
    revisionId: string;
    productThreadRelationship: typeof DESIGN_PRODUCT_THREAD_RELATIONSHIP;
  };
  theme: Theme;
  serviceState: ServiceState;
  demoBar: boolean;
  units: Unit;
  sel: Node | null;
  hover: BodyId | null;
  selFilter: SelFilter;
  selBody: BodyId | null;
  selFace: { body: BodyId; fi: number } | null;
  spanText: string;
  spanMsg: string;
  spanErr: boolean;
  events: TimelineEvent[];
  /** timeline marker: null = live, otherwise the seq being viewed (read-only) */
  viewSeq: number | null;
  liveStash: Snapshot | null;
  versions: Version[];
  comments: Comment[];
  namedViews: NamedView[];
  homeView: CameraHome;
  pending: Pending | null;
  attestor: string;
  intent: string;
  confirmErr: string;
  open: Record<string, boolean>;
  timelineOpen: boolean;
  helpOpen: boolean;
  cmdOpen: boolean;
  recent: string[];
  dialog: Dialog | null;
  preview: Preview | null;
  marking: { x: number; y: number; target: BodyId | null } | null;
  measure: { a: BodyId | null; b: BodyId | null };
  isolated: BodyId | null;
  section: Section;
  lane: Lane;
  keysOpen: boolean;
  lastDiff: { changed: number; reeval: number } | null;
  lastKind: string | null;
  rederive: { line: string; detail: string } | null;
  step: number;
  copied: string | number | null;
  az: number;
  el: number;
  zoom: number;
  pan: { x: number; y: number };
  viewMode: ViewMode;
  grid: boolean;
  navMode: NavMode;
  visualStyle: VisualStyle;
  hidden: Record<string, boolean>;
  dragging: boolean;
  dragPart: PartId | null;
  fieldMsg: Record<string, string>;
  round: Round | null;
  sourcingOpen: boolean;
  injectException: boolean;
  workspace: WorkspaceId;
  setWorkspace: (w: WorkspaceId) => void;
  projects: Project[];
  project: Project | null;
  intakeOpen: boolean;
  openProject: (id: string) => void;
  createProject: (name: string, description: string, intake: Intake | null) => void;
  setProjectIntake: (intake: Intake | null) => void;
  closeProject: () => void;
  /** add a component type from the library to the open project (it appears in the browser, ready to place) */
  addComponent: (slot: Slot) => void;
  /** remove an unplaced library component from the open project; core types stay */
  removeComponent: (slot: Slot) => void;
  /** rule pack the engine evaluates under (committed) */
  pack: PackId;
  determination: { chip: 'CACHED' | 'LIVE'; memoHash: string; entries: string[]; basis: string; conflict: string | null; at: string } | null;
  apiWarm: boolean;
  apiNote: string | null;
  tamperedSeq: number | null;
  recordOpen: boolean;
  sourcesOpen: boolean;
  sources: { doc: SourceDocId | null; slot: Slot | null; network: NetLine[]; proposals: Proposal[]; showHidden: boolean; candidates: Candidate[]; candidateNode: Node | null; llmNote: string | null };
  /** Attribute provenance after extraction. Offline acceptance is memory-only and never implies an identified human review. */
  extracted: Record<string, {
    by: 'extractor' | 'supplier_doc';
    acceptance: 'NONE' | 'UNAUTHENTICATED_BROWSER_SESSION';
    reviewStatus: 'NOT_HUMAN_REVIEWED';
    attestor: null;
    durability: 'MEMORY_ONLY';
  }>;
  escalations: Record<string, { reason: string; proposal: string; confident: boolean; state: 'proposed' | 'accepted' | 'rejected'; attestor: string | null }>;
  memos: Memo[];
  slotList: SlotListProposal | null;
  target: Ranked[] | null;

  commitPack: (id: PackId, why: string) => void;
  warmUpApi: () => void;
  requestDetermination: (o: Outcome) => void;
  tamper: (seq: number) => void;
  dropDocument: (id: SourceDocId, slot: Slot) => void;
  applyExtraction: (slot: Slot, proposal: Proposal) => void;
  acknowledgeExtraction: (slot: Slot, field: string) => void;
  findAlternative: (node: Node, o: Outcome) => void;
  acceptCandidate: (node: Node, pid: PartId) => void;
  proposeEscalation: (lineId: string, reason: string) => void;
  resolveEscalation: (lineId: string, accept: boolean, attestor: string) => void;
  draftMemo: (o: Outcome) => Memo;
  signMemo: (m: Memo, attestor: string, o: Outcome) => string | null;
  proposeSlots: (text: string) => void;
  acceptSlotList: (attestor: string) => void;
  runTarget: (c: TargetConstraints) => void;
  acceptConfiguration: (r: Ranked, attestor: string) => void;

  openRound: (shipTo: ShipTo, qty: number, mode: Mode, intake: Intake) => void;
  refineRound: (p: Partial<Pick<Round, 'shipTo' | 'qty' | 'mode'>>) => void;
  selectOffer: (lineId: string, offerId: string, attestor: string, reasons: Record<string, DeclineReason>) => string | null;
  adjudicate: (lineId: string, offerId: string, role: 'analyst' | 'empowered_official', reason: string, rationale: string, attestor: string, action: 'false_positive' | 'resolve' | 'pin') => void;
  setReference: (lineId: string, ref: string, attestor: string) => void;
  declareTechData: (d: Declaration) => void;
  buildPackage: (o: Outcome) => void;
  sendOrder: () => void;
  retrySend: () => void;
  closeOrder: () => void;

  patch: (p: Partial<WorkbenchState>) => void;
  design: () => Design;
  snapshot: () => Snapshot;
  editable: () => boolean;
  toggleTheme: () => void;
  closeAll: () => void;
  openTimeline: () => void;
  toggleTimeline: () => void;
  toggleHelp: () => void;
  setView: (name: ViewName) => void;
  setViewDir: (dir: [number, number, number]) => void;
  fit: () => void;
  toggleHidden: (id: string) => void;
  isolate: (id: BodyId | null) => void;
  select: (slot: Node) => void;
  pick: (body: BodyId, fi: number) => void;
  openDialog: (kind: DialogKind, target?: BodyId | null) => void;
  closeDialog: () => void;
  setPreview: (p: Preview | null) => void;
  openMarking: (x: number, y: number, target: BodyId | null) => void;
  swap: (slot: Slot, pid: PartId, at?: Pos) => void;
  place: (slot: Slot, pid: PartId, at?: Pos) => void;
  removePart: (slot: Slot) => void;
  moveTo: (slot: Slot, at: Pos) => void;
  commitMove: (slot: Slot, from: Pos) => void;
  setAttr: (slot: Slot, field: FieldSpec, text: string | null) => void;
  setCrypto: (slot: Slot, value: string) => void;
  setBool: (slot: Slot, key: 'gnss_adaptive' | 'gnss_antijam' | 'gnss_pps', value: boolean) => void;
  setDeclared: (patch: Partial<Declared>, label: string) => string | null;
  reopen: (slot: Slot) => void;
  confirm: (name?: string) => void;
  leaveUnconfirmed: () => void;
  setSpan: (text: string) => void;
  commitSketch: () => string;
  applyExtrude: (target: Node, value: number) => string;
  applyGeo: (patch: Partial<Geo>, kind: Feature['kind'], label: string) => void;
  toggleConstraint: (id: string) => void;
  setTint: (slot: Slot, color: string | null) => void;
  setUnits: (u: Unit) => void;
  saveNamedView: (name: string) => void;
  setHome: () => void;
  saveVersion: (comment: string) => void;
  addComment: (author: string, text: string) => void;
  pickMeasure: (body: BodyId) => void;
  viewAt: (seq: number | null) => void;
  restoreHere: () => void;
  toggleOpen: (id: string) => void;
  copy: (key: string | number, text: string) => void;
  rederiveLog: () => void;
  advance: () => void;
  reset: () => void;
}

const ISO: CameraHome = { az: Math.PI / 4, el: 0.6155, zoom: 0.7 };
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

function readUrl(): { theme: Theme; demoBar: boolean; serviceState: ServiceState } {
  try {
    const q = new URLSearchParams(location.search);
    return { theme: q.get('theme') === 'dark' ? 'dark' : 'light', demoBar: q.get('demo') === '1', serviceState: q.get('service') === 'unreachable' ? 'unreachable' : 'cached' };
  } catch {
    return { theme: 'light', demoBar: false, serviceState: 'cached' };
  }
}

const attrsFor = (parts: Parts): Attrs => Object.fromEntries(SLOTS.map((s) => [s, parts[s] ? { ...CATALOG[parts[s] as PartId].attrs } : {}])) as Attrs;
/** Default part positions for a plate of length L and width W (metres). */
const posFor = (L: number, W: number): Positions => Object.fromEntries(SLOTS.map((s) => [s, DEFAULT_POS[s](L, W)])) as Positions;

const baselineSnapshot = (): Snapshot => ({
  parts: { ...BASELINE_PARTS }, attrs: attrsFor(BASELINE_PARTS), pos: posFor(GEO0.plateL, GEO0.plateW), span: SPAN_BASELINE, dims: { ...DIMS0 }, features: SEED_FEATURES.slice(), geo: { ...GEO0 }, sketch: { ...SKETCH_DEFAULT }, tint: {}, unconfirmed: {}, declared: { ...DECLARED0 },
});
const pickSnapshot = (s: Snapshot): Snapshot => ({ parts: s.parts, attrs: s.attrs, pos: s.pos, span: s.span, dims: s.dims, features: s.features, geo: s.geo, sketch: s.sketch, tint: s.tint, unconfirmed: s.unconfirmed, declared: s.declared });

/** Merlin, the second sample: a 7 inch civil survey quad on a Chimera7 frame, every part mounted where it bolts on. */
export const MERLIN_SLOTS: Slot[] = ['battery', 'fc', 'imu', 'esc', 'motor', 'prop', 'gnss', 'datalink', 'camera', 'transponder'];
const merlinSnapshot = (): Snapshot => {
  // the Chimera7 frame is the airframe: no plate. Parts sit where they bolt on: the ESC and flight controller in the 30.5 mm stack
  // between the plates, the pack, IMU breakout, GNSS mast and telemetry radio on the top plate, the camera in the nose cage,
  // the transponder on the bottom plate ahead of the stack; motors and props repeat on the four arm pads (frame-local metres, z absolute)
  const geo: Geo = { ...GEO0, kind: 'frame', frame: 'chimera7', plateL: 0.27, plateW: 0.199, plateT: 0.003 };
  const parts: Parts = { ...(Object.fromEntries(SLOTS.map((sl) => [sl, null])) as Parts), battery: 'tattu1300', fc: 'px6cmini', imu: 'icm', esc: 'tekko65', motor: 'f60prov', prop: 'hq7035', gnss: 'm10gps', datalink: 'sik915', camera: 'thumbpro', transponder: 'ping200' };
  const pos: Positions = {
    ...posFor(geo.plateL, geo.plateW),
    esc: { x: 0.1135, y: 0.0775, z: 0.004 }, fc: { x: 0.108, y: 0.08, z: 0.012 },
    battery: { x: 0.0975, y: 0.0805, z: 0.032 }, imu: { x: 0.16, y: 0.12, z: 0.032 }, gnss: { x: 0.11, y: 0.135, z: 0.06 }, datalink: { x: 0.175, y: 0.05, z: 0.032 },
    camera: { x: 0.2, y: 0.087, z: 0.008 }, transponder: { x: 0.05, y: 0.11, z: 0.003 },
  };
  return { ...baselineSnapshot(), parts, attrs: attrsFor(parts), pos, geo, features: [{ n: 'f1', text: 'frame · Chimera7 Pro V2 · 0.270 × 0.199 × 0.034 m', kind: 'sketch' }, { n: 'f2', text: 'stack · 30.5 mm M3 · 21 mm standoffs', kind: 'extrude' }, { n: 'f3', text: 'motor pads · 4 × 16 mm M3', kind: 'hole' }] };
};
export const SAMPLE_PROJECTS: Project[] = [
  { id: 'kestrel', name: 'Kestrel', description: 'Fixed-wing survey drone · 7 slots · the demo design', intake: { ...INTAKE_DEFAULT, civilProduct: true }, createdAt: '2026-09-04 18:10', openedAt: '2026-09-05 09:12', components: [...CORE_SLOTS] },
  {
    id: 'merlin', name: 'Merlin', description: '7 inch civil survey quadcopter · Chimera7 frame · 10 components, all placed',
    intake: { endUse: 'civil survey and mapping', endUser: 'commercial operator', shipTo: 'US', qty: 25, mode: 'air', civilProduct: true, bvlos: false, usedOn: 'none', notes: 'orthomosaic mapping of construction sites · VLOS under Part 107 · 25 units for the first fleet' },
    createdAt: '2026-09-05 14:40', openedAt: '2026-09-05 16:05', components: [...MERLIN_SLOTS], snapshot: merlinSnapshot(),
  },
];

const baseline = () => {
  const snap = baselineSnapshot();
  return {
    ...snap,
    sel: null as Node | null, hover: null as BodyId | null, selBody: null as BodyId | null, selFace: null as { body: BodyId; fi: number } | null,
    spanText: SPAN_BASELINE.toFixed(1), spanMsg: '', spanErr: false,
    events: SEED_EVENTS.map((e) => ({ ...e, snap })).reverse(),
    viewSeq: null as number | null, liveStash: null as Snapshot | null,
    workflowIdentity: { projectId: DESIGN_PROJECT_ID, projectName: DESIGN_PROJECT_NAME, revisionId: 'legacy-design-state:3', productThreadRelationship: DESIGN_PRODUCT_THREAD_RELATIONSHIP },
    versions: [{ v: 1, seq: 3, comment: 'baseline · Kestrel, twelve parts', at: '2026-09-05 09:12' }] as Version[],
    comments: [] as Comment[],
    pending: null as Pending | null, attestor: '', intent: '', confirmErr: '',
    open: {} as Record<string, boolean>, lastDiff: null as { changed: number; reeval: number } | null, lastKind: null as string | null,
    rederive: null as { line: string; detail: string } | null, step: 0, keysOpen: false,
    az: ISO.az, el: ISO.el, zoom: ISO.zoom, pan: { x: 0, y: 0 },
    dialog: null as Dialog | null, preview: null as Preview | null, marking: null as WorkbenchState['marking'], measure: { a: null, b: null } as WorkbenchState['measure'],
    isolated: null as BodyId | null, section: { on: false, axis: 0, at: GEO0.plateL / 2 } as Section,
    fieldMsg: {} as Record<string, string>, dragging: false, dragPart: null as PartId | null,
  };
};

const changedKeysOf = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); return [...new Set([...a.filter((k) => !B.has(k)), ...b.filter((k) => !A.has(k))])]; };
const fmt = (v: number | null | undefined, dp: number) => (v == null ? 'not published' : v.toFixed(dp));

export const useStore = create<WorkbenchState>()((set, get) => {
  const snapshot = (): Snapshot => pickSnapshot(get());
  const append = (ev: Partial<TimelineEvent> & { kind: string; text: string; entry: string }) => {
    set((s) => {
      const seq = s.events.length + 1;
      const full: TimelineEvent = { seq, lane: 'design', intent: '', word: '', color: 'var(--ink)', ...ev, hash: hashOf(seq), snap: pickSnapshot(s) };
      return { events: [full, ...s.events], workflowIdentity: { ...s.workflowIdentity, revisionId: `legacy-design-state:${seq}` } };
    });
  };
  const changedRows = (from: PartId, to: PartId): CmpKey[] => CMP_KEYS.filter((k) => CATALOG[from].cmp[k] !== CATALOG[to].cmp[k]);
  const design = (): Design => { const s = get(); return { parts: s.parts, attrs: s.attrs, span: s.span, declared: s.declared }; };
  const editable = () => get().viewSeq == null;
  const summary = (before: ReturnType<typeof service.evaluate>, after: ReturnType<typeof service.evaluate>, node: Node) => {
    const changed = countChanged(before, after);
    const firedOn = after.rules.filter((r) => (r.node === node || r.node === 'airframe') && !before.keys.includes(r.entry)).map((r) => r.entry);
    return { changed, entry: firedOn.length ? firedOn.join(' · ') : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed' };
  };
  const nextFeature = (s: WorkbenchState) => 'f' + (s.features.length + 1);

  return {
    ...readUrl(),
    ...baseline(),
    units: 'm',
    selFilter: 'component',
    timelineOpen: false, helpOpen: false, cmdOpen: false, recent: [],
    namedViews: [], homeView: { ...ISO },
    lane: 'all', copied: null, viewMode: 'model', grid: true, navMode: 'orbit', visualStyle: 'edges', hidden: {},
    round: null, sourcingOpen: false, injectException: false,
    workspace: 'design',
    projects: SAMPLE_PROJECTS.map((p) => ({ ...p })),
    project: null,
    intakeOpen: false,
    openProject: (id) => {
      const s = get();
      const p = s.projects.find((x) => x.id === id);
      if (!p) return;
      const opened: Project = { ...p, openedAt: now(), components: p.components?.length ? p.components : [...CORE_SLOTS] };
      // an older snapshot may predate library components: fill any missing slot with empty state
      const geo: Geo = { ...GEO0, ...p.snapshot?.geo };
      const snap = p.snapshot ? { ...p.snapshot, geo, parts: { ...(Object.fromEntries(SLOTS.map((sl) => [sl, null])) as Parts), ...p.snapshot.parts }, attrs: { ...(Object.fromEntries(SLOTS.map((sl) => [sl, {}])) as Attrs), ...p.snapshot.attrs }, pos: { ...posFor(geo.plateL, geo.plateW), ...p.snapshot.pos }, dims: { ...DIMS0, ...p.snapshot.dims } } : {};
      set({ ...baseline(), ...snap, round: null, sourcingOpen: false, workspace: 'design', project: opened, projects: s.projects.map((x) => (x.id === id ? opened : x)) });
    },
    addComponent: (slot) => {
      const s = get();
      if (!s.project || s.project.components.includes(slot)) return;
      const p: Project = { ...s.project, components: [...s.project.components, slot] };
      set({ project: p, projects: s.projects.map((x) => (x.id === p.id ? p : x)) });
      append({ kind: 'component_added', text: GENERIC_NAME[slot] + ' added to the project', entry: 'from the component library · not placed yet', intent: 'expand the design' });
    },
    removeComponent: (slot) => {
      const s = get();
      if (!s.project || (CORE_SLOTS as Slot[]).includes(slot) || s.parts[slot]) return;
      const p: Project = { ...s.project, components: s.project.components.filter((x) => x !== slot) };
      set({ project: p, projects: s.projects.map((x) => (x.id === p.id ? p : x)) });
    },
    createProject: (name, description, intake) => {
      const s = get();
      const id = 'p' + Date.now().toString(36);
      // a new design starts with the bracket and empty slots
      const emptyParts = Object.fromEntries(SLOTS.map((sl) => [sl, null])) as Parts;
      const snapshot: Snapshot = { ...baselineSnapshot(), parts: emptyParts, attrs: attrsFor(emptyParts) };
      const p: Project = { id, name: name.trim() || 'Untitled project', description: description.trim(), intake, createdAt: now(), openedAt: now(), components: [...CORE_SLOTS], snapshot };
      set({ ...baseline(), ...snapshot, round: null, sourcingOpen: false, workspace: 'design', project: p, projects: [p, ...s.projects], intakeOpen: false });
      append({ kind: 'design_opened', text: p.name + ' · new project' + (intake ? ' · use case declared' : ' · use case skipped for now'), entry: intake ? intake.endUse + ' · ' + intake.endUser + ' · ship-to ' + intake.shipTo : 'this application requires more information before classification and sourcing complete', intent: description });
    },
    setProjectIntake: (intake) => {
      const s = get();
      if (!s.project) return;
      const p = { ...s.project, intake };
      set({ project: p, projects: s.projects.map((x) => (x.id === p.id ? p : x)), intakeOpen: false });
      if (intake) append({ kind: 'flag_declared', text: 'use case declared · ' + intake.endUse + ' · ' + intake.endUser + ' · ship-to ' + intake.shipTo + (intake.civilProduct ? ' · civil product' : '') + (intake.bvlos ? ' · BVLOS' : '') + (intake.usedOn !== 'none' ? ' · used on ' + intake.usedOn : ''), entry: 'declared facts · badged, never inferred', intent: intake.notes });
    },
    closeProject: () => set((s) => {
      // keep the design as left, so the project card preview shows it
      const saved = s.project ? { ...s.project, snapshot: pickSnapshot(s) } : null;
      return { project: null, projects: saved ? s.projects.map((x) => (x.id === saved.id ? saved : x)) : s.projects, intakeOpen: false, timelineOpen: false, sourcingOpen: false, cmdOpen: false };
    }),
    setWorkspace: (w) => set({ workspace: w, sourcingOpen: w === 'sourcing', sourcesOpen: false, recordOpen: false, timelineOpen: false, marking: null, cmdOpen: false }),
    pack: 'v2', determination: null, apiWarm: false, apiNote: null, tamperedSeq: null, recordOpen: false, sourcesOpen: false,
    sources: { doc: null, slot: null, network: [], proposals: [], showHidden: false, candidates: [], candidateNode: null, llmNote: null },
    extracted: {}, escalations: {}, memos: [], slotList: null, target: null,

    commitPack: (id, why) => {
      const s = get();
      if (s.pack === id) return;
      set({ pack: id });
      append({ kind: 'rule_pack_committed', text: 'export pack ' + id + ' · sha ' + PACKS[id].sha + ' · eCFR ' + PACKS[id].ecfr_date + ' · effective ' + PACKS[id].effective, entry: why + ' · committed by a human · the log now re-derives under this pack', intent: why });
    },
    warmUpApi: () => { set({ apiWarm: false, apiNote: 'model unavailable · replaying cache · the LIVE chip needs a warm-up under 10 s in the previous five minutes' }); },
    requestDetermination: (o) => {
      const s = get();
      // Friday's cached response.json: the baseline determination
      const cached = { entries: [] as string[], basis: 'self-classification analysis under 15 CFR 732.3(b) · Kestrel baseline · no listed entry among the 14 rows · EAR99 · not a CJ or CCATS', memoHash: 'memo-' + hashOf(4451).slice(0, 8) };
      const fired = o.rules.filter((r) => r.node === 'airframe').map((r) => r.entry);
      const conflict = fired.length ? 'the cached memo reads EAR99 for the baseline; the engine reads ' + fired.join(', ') + ' for this design · conflict recorded · the engine’s flag stays on screen until a human resolves it · never auto-resolved toward EAR99' : null;
      set({ determination: { chip: 'CACHED', memoHash: cached.memoHash, entries: cached.entries, basis: cached.basis, conflict, at: now() } });
      append({ kind: 'determination_requested', text: 'company API · CACHED · ' + cached.memoHash, entry: cached.basis, intent: '' });
      if (conflict) append({ kind: 'conflict', text: 'API memo EAR99 vs engine ' + fired.join(', '), entry: 'kept the engine’s flag · human resolves', intent: '', word: 'conflict', color: 'var(--amber)' });
      void s;
    },
    tamper: (seq) => {
      const s = get();
      const events = s.events.map((e) => (e.seq === seq ? { ...e, text: e.text.replace(/\d+(\.\d+)?/, (m) => String(+m + 1)) + ' · [edited in the file]' } : e));
      set({ events, tamperedSeq: seq, rederive: null });
    },
    dropDocument: (id, slot) => {
      const doc = DOCS[id];
      set({ sources: { ...get().sources, doc: id, slot, network: netFor(doc), proposals: callA(doc), showHidden: false, llmNote: 'CACHED · response replayed from fixtures/llm_cache' }, sourcesOpen: true });
      append({ kind: 'extraction_proposed', lane: 'proposal', text: doc.title + ' · ' + callA(doc).length + ' unverified claims proposed', entry: 'Call A · CACHED · every claim goes through the verifier', intent: '' });
    },
    applyExtraction: (slot, proposal) => {
      if (!editable() || !proposal.verdict.ok) return;
      const { field, value, unit } = proposal.verdict.spec;
      const s = get();
      const before = service.evaluate(design(), s.pack);
      const attrs: Attrs = { ...s.attrs, [slot]: { ...s.attrs[slot], [field]: value } } as Attrs;
      const after = service.evaluate({ ...design(), attrs }, s.pack);
      const { changed, entry } = summary(before, after, slot);
      set({ attrs, extracted: { ...s.extracted, [slot + '.' + field]: { by: 'extractor', acceptance: 'NONE', reviewStatus: 'NOT_HUMAN_REVIEWED', attestor: null, durability: 'MEMORY_ONLY' } }, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: SLOT_LABEL[slot] + ' · ' + field + ' ← extractor' });
      append({ kind: 'attr_changed', text: SLOT_LABEL[slot] + ' · ' + field + ' = ' + value + ' ' + unit + ' · extracted_by extractor', entry: entry + ' · accepted cached-fixture span applied · no human review, identity, or attestor recorded', intent: '' });
    },
    acknowledgeExtraction: (slot, field) => {
      const key = slot + '.' + field;
      const current = get().extracted[key];
      if (!current) return;
      set((s) => ({ extracted: { ...s.extracted, [key]: { ...current, acceptance: 'UNAUTHENTICATED_BROWSER_SESSION' } } }));
      append({ kind: 'source_acceptance_acknowledged', lane: 'proposal', text: SLOT_LABEL[slot] + ' · ' + field + ' · browser-session acceptance acknowledged', entry: 'unauthenticated browser-session acceptance · memory only · no identity or attestor captured · not human review', intent: '' });
    },
    findAlternative: (node, o) => {
      const cands = callB(node, design(), o);
      set({ sources: { ...get().sources, candidates: cands, candidateNode: node, network: cands.flatMap((c) => c.net), llmNote: 'CACHED · agent proposals re-checked by the rule engine · fetches allowlisted' }, sourcesOpen: true });
      append({ kind: 'alternative_proposed', lane: 'proposal', text: SLOT_LABEL[node] + ' · ' + cands.length + ' candidates · ' + cands.filter((c) => c.state === 'green').length + ' green', entry: 'Call B · engine dry-run on a copy · the human accepts with a part_swapped', intent: '' });
    },
    acceptCandidate: (node, pid) => { if (node !== 'airframe') get().swap(node, pid); set({ sourcesOpen: false }); },
    proposeEscalation: (lineId, reason) => {
      const s = get();
      const proposal = reason.includes('origin') ? 'STM32F100 · origin MY per this datasheet bytes 812–818 · lot-dependent; the seller declared MY/CN' : reason.includes('ownership') ? 'record “ownership unknown” as an attested risk acceptance · no ownership row for this seller; searched ' + 'ownership@b7d0f2' : 'no compliant seller found on the allowlist · abstained';
      set({ escalations: { ...s.escalations, [lineId]: { reason, proposal, confident: false, state: 'proposed', attestor: null } } });
      append({ kind: 'escalation_proposed', lane: 'proposal', text: lineId + ' · ' + reason + ' · ' + proposal, entry: 'not confident · exact-quote citation first · the agent writes proposals and nothing else', intent: '' });
    },
    resolveEscalation: (lineId, accept, attestor) => {
      const s = get(); const e = s.escalations[lineId]; if (!e || !attestor.trim()) return;
      set({ escalations: { ...s.escalations, [lineId]: { ...e, state: accept ? 'accepted' : 'rejected', attestor } } });
      append({ kind: 'escalation_resolved', lane: 'sourcing', text: lineId + ' · ' + (accept ? 'accepted' : 'rejected') + ' · ' + e.reason, entry: 'human-resolved · attestor ' + attestor, intent: '' });
    },
    draftMemo: (o) => draftMemo(o, get().intent, get().lastKind ?? '', get().events.length),
    signMemo: (m, attestor, o) => {
      if (!attestor.trim()) return 'attestor required';
      if (!citationsWithin(m, o)) return 'refused: a citation is not among the rules that fired';
      const signed: Memo = { ...m, signedBy: attestor, hash: memoHash(m) };
      set((s) => ({ memos: [...s.memos, signed] }));
      append({ kind: 'intent_memo_signed', text: 'memo ' + signed.hash + ' · ' + m.citations.join(', '), entry: 'draft for counsel review · citations limited to rules that fired · signed by ' + attestor, intent: '' });
      return null;
    },
    proposeSlots: (text) => {
      const p = proposeSlotList(text);
      set({ slotList: p });
      append({ kind: 'slot_list_proposed', lane: 'proposal', text: 'proposed slot list · ' + p.slots.length + ' slots · ' + p.accepted + ' catalog parts · ' + (p.slots.length - p.accepted) + ' placeholders', entry: p.rejected + ' MPN rejected by the verifier · no jurisdiction, entry, origin or value field', intent: text });
    },
    acceptSlotList: (attestor) => {
      const s = get(); const p = s.slotList; if (!p || !attestor.trim()) return;
      const parts = { ...s.parts } as Parts;
      for (const sl of SLOTS) { const prop = p.slots.find((x) => x.slot === sl && !x.rejected); parts[sl] = prop ? prop.pid : null; }
      const attrs = attrsFor(parts);
      set({ parts, attrs, slotList: null, sel: null, pending: null, unconfirmed: {} });
      append({ kind: 'part_added', text: 'slot list accepted · ' + SLOTS.map((sl) => SLOT_LABEL[sl] + ': ' + (parts[sl] ? CATALOG[parts[sl] as PartId].name : 'placeholder')).join(' · '), entry: 'a series of human part_added events · placeholders print “cannot fire · field empty” · attestor ' + attestor, intent: p.text });
    },
    runTarget: (c) => set({ target: searchTarget(design(), c, get().pack) }),
    acceptConfiguration: (r, attestor) => {
      if (!attestor.trim() || !editable()) return;
      const s = get();
      const attrs = attrsFor(r.parts);
      set({ parts: r.parts, attrs, target: null, pending: null, unconfirmed: {} });
      append({ kind: 'part_swapped', text: 'configuration accepted · ' + SLOTS.map((sl) => SLOT_LABEL[sl] + ': ' + (r.parts[sl] ? CATALOG[r.parts[sl] as PartId].name : 'empty')).join(' · '), entry: r.deltas.join(' · ') + ' · scored by the same rules · attestor ' + attestor, intent: '', word: 'confirmed by ' + attestor, color: 'var(--ink)' });
      void s;
    },

    openRound: (shipTo, qty, mode, intake) => {
      const s = get();
      const prev = s.round;
      const id = 'r' + ((prev ? parseInt(prev.id.slice(1), 10) : 0) + 1);
      const snap = pickSnapshot(s);
      const designHash = designHashOf(snap);
      // a frame-kind airframe sources its frame kit on the airframe line
      const sourcingParts: Parts = s.geo.kind === 'frame' && s.geo.frame ? { ...s.parts, frame: s.geo.frame } : s.parts;
      const lines = linesFor(sourcingParts);
      const controlled = (line: Line) => { const o = service.evaluate(design(), get().pack); const node = line.slot ?? 'airframe'; return o.rules.some((r) => r.node === node); };
      const offers: Record<string, ResolvedOffer[]> = {};
      let screened = 0, est = 0;
      for (const line of lines) {
        offers[line.id] = offersFor(sourcingParts).filter((o) => o.lineId === line.id).map((offer) => {
          const tier = tierFor(line, offer, controlled(line));
          const tree = walk(offer, tier);
          const ru = rollup(tree);
          screened++;
          const ladder = estimate(offer, line, qty, mode);
          est++;
          return { offer, tier, tree, status: ru.status, because: ru.because, ladder };
        });
      }
      const round: Round = { id, designSeq: s.events.length, designHash, shipTo, qty, mode, intake, status: 'costed', lines, offers, selections: {}, references: {}, declaration: null, pkg: null, pkgRefusal: null, order: null, supersededBy: null };
      set({ round: prev ? { ...round } : round, sourcingOpen: true });
      if (prev) set((st) => ({ round: st.round })); // previous round is superseded by id in the log line below
      const resolved = Object.values(offers).reduce((n, l) => n + l.length, 0);
      const blocked = Object.values(offers).flat().filter((r) => r.status === 'review_blocked').length;
      const review = Object.values(offers).flat().filter((r) => r.status === 'review_required').length;
      append({ kind: 'round_opened', lane: 'sourcing', text: 'round ' + id + ' · ship-to ' + shipTo + ' · qty ' + qty + ' · ' + mode + (prev ? ' · supersedes ' + prev.id : ''), entry: 'bound to design state #' + s.events.length + ' · declared: ' + intake.endUse + ' · ' + intake.endUser + (intake.civilProduct ? ' · civil product' : ' · not declared civil') + (intake.bvlos ? ' · BVLOS' : '') + (intake.usedOn !== 'none' ? ' · used on ' + intake.usedOn : ''), intent: intake.notes });
      append({ kind: 'offers_resolved', lane: 'sourcing', text: lines.length + ' lines · ' + resolved + ' offers from the committed catalog', entry: 'offers fixture · declared by distributors, unverified', intent: '' });
      append({ kind: 'screening_rolled_up', lane: 'sourcing', text: screened + ' party trees walked and screened · ' + blocked + ' review blocked · ' + review + ' review required', entry: 'exact and suffix-normalised only · not fuzzy · worst node wins', intent: '', word: blocked ? 'review blocked' : review ? 'review required' : '', color: blocked ? 'var(--red)' : 'var(--amber)' });
      append({ kind: 'cost_estimated', lane: 'sourcing', text: est + ' landed-cost ladders · ship-to ' + shipTo + ' · ' + mode, entry: 'estimate from declared tariff code and origin against a dated tariff table', intent: '' });
    },
    refineRound: (p) => {
      const r = get().round; if (!r) return;
      const shipTo = p.shipTo ?? r.shipTo, qty = p.qty ?? r.qty, mode = p.mode ?? r.mode;
      const offers: Record<string, ResolvedOffer[]> = {};
      let changed = 0;
      for (const line of r.lines) offers[line.id] = (r.offers[line.id] || []).map((ro) => { const ladder = estimate(ro.offer, line, qty, mode); if (ladder.hash !== ro.ladder.hash) changed++; return { ...ro, ladder }; });
      set({ round: { ...r, shipTo, qty, mode, offers, pkg: null, pkgRefusal: null, status: r.status === 'package_ready' || r.status === 'gated' ? 'selection_confirmed' : r.status } });
      const K = Object.values(offers).flat().length;
      if (p.qty == null && !p.mode && !p.shipTo) { append({ kind: 'screening_run', lane: 'sourcing', text: 're-screen against the same list snapshot · ' + K + ' runs', entry: K + ' runs · 0 changed · CSL@91f4e8 · the honest negative', intent: '' }); return; }
      append({ kind: 'cost_estimated', lane: 'sourcing', text: 'refined · ' + (p.qty != null ? 'qty ' + qty : p.mode ? 'mode ' + mode : 'ship-to ' + shipTo), entry: 're-estimated ' + K + ' ladders · ' + changed + ' changed · statuses unchanged' + (p.mode === 'ocean' ? ' · HMF layer appears, nothing else moves' : p.qty != null ? ' · check the MPF minimum line' : ''), intent: '' });
    },
    selectOffer: (lineId, offerId, attestor, reasons) => {
      const r = get().round; if (!r) return 'no round';
      const list = r.offers[lineId] || [];
      const chosen = list.find((x) => x.offer.id === offerId);
      if (!chosen) return 'offer not found';
      if (!attestor.trim()) return 'refused: attestor required · a selection is a human act';
      if (chosen.status === 'review_blocked') return 'refused: review blocked · adjudicate the match first';
      if (chosen.ladder.unverified) return 'refused: rate not verified on this estimate';
      const declined = list.filter((x) => x.offer.id !== offerId).map((x) => ({ offerId: x.offer.id, seller: x.offer.seller, reason: reasons[x.offer.id] ?? defaultDecline(x, chosen), statusAtDecline: x.status }));
      const seq = get().events.length + 1;
      const selections = { ...r.selections, [lineId]: { offerId, attestor: attestor.trim(), seq, declined } };
      const all = r.lines.every((l) => selections[l.id]);
      set({ round: { ...r, selections, status: all ? 'selection_confirmed' : r.status, pkg: null } });
      const line = r.lines.find((l) => l.id === lineId);
      append({ kind: 'offer_selected', lane: 'sourcing', text: (line?.description ?? lineId) + ' · ' + chosen.offer.seller + (declined.length ? ' · declined: ' + declined.map((d) => d.seller + ' (' + d.reason + ')').join(', ') : ''), entry: 'status at selection ' + chosen.status + ' · per-unit landed ' + (chosen.ladder.perUnit ?? 0).toFixed(2) + ' USD · attestor ' + attestor.trim(), intent: '', word: declined.some((d) => d.reason === 'owner screened') ? 'declined · owner screened' : '', color: 'var(--ink)' });
      return null;
    },
    adjudicate: (lineId, offerId, role, reason, rationale, attestor, action) => {
      const r = get().round; if (!r || !attestor.trim()) return;
      const offers = { ...r.offers, [lineId]: (r.offers[lineId] || []).map((x) => {
        if (x.offer.id !== offerId) return x;
        const status: OfferStatus = action === 'false_positive' ? 'review_required' : action === 'resolve' ? 'no_candidate_match' : 'review_blocked';
        return { ...x, status, because: (action === 'pin' ? 'pinned review blocked by ' : action === 'false_positive' ? 'false positive recorded by ' : 'resolved by ') + role + ' · ' + reason, adjudicated: { role, reason, rationale, attestor, lowered: action !== 'pin' } };
      }) };
      set({ round: { ...r, offers } });
      append({ kind: 'match_adjudicated', lane: 'sourcing', text: role + ' · ' + action.replace('_', ' ') + ' · ' + reason, entry: rationale + ' · list snapshot CSL@91f4e8 · attestor ' + attestor, intent: rationale });
    },
    setReference: (lineId, ref, attestor) => {
      const r = get().round; if (!r) return;
      set({ round: { ...r, references: { ...r.references, [lineId]: { ref, attestor } }, pkg: null } });
      append({ kind: 'export_gate_evaluated', lane: 'sourcing', text: (r.lines.find((l) => l.id === lineId)?.description ?? lineId) + ' · authorization reference typed', entry: 'reference typed, not validated · attestor ' + attestor, intent: '' });
    },
    declareTechData: (d) => {
      const r = get().round; if (!r) return;
      set({ round: { ...r, declaration: d, pkg: null } });
      append({ kind: 'technical_data_declared', lane: 'sourcing', text: d.personStatus + ' · ' + d.sharing, entry: (d.reference ? 'authorization reference typed, not validated' : 'no reference') + ' · 734.13 sentence printed · attestor ' + d.attestor, intent: '' });
    },
    buildPackage: (o) => {
      const s = get(); const r = s.round; if (!r) return;
      const refuse = (why: string) => { set({ round: { ...r, pkgRefusal: why, pkg: null } }); append({ kind: 'package_blocked', lane: 'sourcing', text: 'refused: ' + why, entry: 'no partial package', intent: '', word: 'blocked', color: 'var(--red)' }); };
      if (designHashOf(pickSnapshot(s)) !== r.designHash) return refuse('design state changed since the round opened · open a new round');
      const missing = r.lines.filter((l) => !r.selections[l.id]);
      if (missing.length) return refuse(missing.length + ' line' + (missing.length > 1 ? 's' : '') + ' without a selection: ' + missing.map((l) => l.description.split(' · ')[0]).join(', '));
      const blocked = r.lines.filter((l) => gateFor(l, o, r.shipTo).blocks && !r.references[l.id]);
      if (blocked.length) return refuse('export gate blocks ' + blocked.map((l) => l.description.split(' · ')[0]).join(', ') + ' · type and attest an authorization reference');
      if (r.shipTo !== 'US' && !r.declaration) return refuse('technical-data declaration missing for the ' + r.shipTo + ' assembler');
      const at = now();
      const pkg = { preEntry: hashOf(s.events.length * 3 + 1), diligence: hashOf(s.events.length * 3 + 2), exportRefs: hashOf(s.events.length * 3 + 3), at };
      set({ round: { ...r, pkg, pkgRefusal: null, status: 'package_ready' } });
      append({ kind: 'package_built', lane: 'sourcing', text: 'pre-entry lines ' + pkg.preEntry + ' · diligence record ' + pkg.diligence + ' · export references ' + pkg.exportRefs, entry: 'every bound blob re-read by hash · fixture manifests re-verified · locked disclaimers', intent: '' });
    },
    sendOrder: () => {
      const s = get(); const r = s.round; if (!r || !r.pkg) return;
      if (r.order && r.order.state !== 'DRAFT') return;
      const key = 'idem-' + r.id + '-' + r.designHash.slice(0, 6) + '-' + r.shipTo + '-' + r.qty;
      const packetHash = hashOf(s.events.length * 5 + 11);
      const trail = ['packet created from ' + r.id + ' · design state #' + r.designSeq + ' · qty ' + r.qty + ' · recipient [placeholder]', 'dispatching through the synthetic adapter · key ' + key];
      append({ kind: 'order_packet_created', lane: 'order', text: 'PURCHASE_ORDER · ' + r.lines.length + ' lines · qty ' + r.qty + ' · recipient [placeholder]', entry: 'packet ' + packetHash + ' · binds ' + r.pkg.preEntry + ' ' + r.pkg.diligence + ' ' + r.pkg.exportRefs + ' · approver ' + Object.values(r.selections)[0]?.attestor, intent: '' });
      if (s.injectException) {
        set({ round: { ...r, order: { key, packetHash, state: 'EXCEPTION', receipt: null, attempts: 1, trail: [...trail, 'adapter returned EXCEPTION · timeout after dispatch · reconcile before any retry'] } } });
        append({ kind: 'order_exception', lane: 'order', text: 'SYNTHETIC adapter · exception fixture · lost response after dispatch', entry: 'state DISPATCH_UNKNOWN → EXCEPTION · the same key resolves to the original dispatch on retry · no second send', intent: '', word: 'exception', color: 'var(--red)' });
        return;
      }
      const receipt = 'ack-' + hashOf(s.events.length * 7 + 5).slice(0, 8);
      set({ round: { ...r, order: { key, packetHash, state: 'ACKNOWLEDGED', receipt, attempts: 1, trail: [...trail, 'acknowledged · receipt ' + receipt + ' · SYNTHETIC'] } } });
      append({ kind: 'order_dispatched', lane: 'order', text: 'SYNTHETIC dispatch · exactly once · key ' + key, entry: 'packet ' + packetHash + ' · adapter synthetic · labelled SYNTHETIC', intent: '' });
      append({ kind: 'order_acknowledged', lane: 'order', text: 'receipt ' + receipt + ' · recipient [placeholder]', entry: 'acknowledgement recorded on the same thread', intent: '' });
    },
    retrySend: () => {
      const r = get().round; if (!r?.order) return;
      const o = r.order;
      const receipt = o.receipt ?? ('ack-' + hashOf(get().events.length * 7 + 5).slice(0, 8));
      set({ round: { ...r, order: { ...o, attempts: o.attempts + 1, state: 'ACKNOWLEDGED', receipt, trail: [...o.trail, 'retry #' + (o.attempts + 1) + ' with the same key · adapter returned the first receipt ' + receipt + ' · no duplicate send'] } } });
      append({ kind: o.state === 'EXCEPTION' ? 'order_acknowledged' : 'order_dispatched', lane: 'order', text: 'retry with idempotency key ' + o.key + ' · returned the original receipt ' + receipt, entry: 'no duplicate observable send effect · ' + (o.state === 'EXCEPTION' ? 'exception reconciled' : 'idempotent'), intent: '' });
    },
    closeOrder: () => {
      const r = get().round; if (!r?.order || r.order.state !== 'ACKNOWLEDGED') return;
      set({ round: { ...r, order: { ...r.order, state: 'CLOSED', trail: [...r.order.trail, 'received · inspected · closed'] } } });
      append({ kind: 'order_closed', lane: 'order', text: 'received · inspected · closeout', entry: 'order lifecycle complete on the thread · SYNTHETIC', intent: '' });
    },

    patch: (p) => set(p),
    design,
    snapshot,
    editable,
    toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    closeAll: () => set({ timelineOpen: false, helpOpen: false, sourcingOpen: false, sourcesOpen: false, recordOpen: false, cmdOpen: false, marking: null, dialog: null, preview: null }),
    openTimeline: () => set({ timelineOpen: true, helpOpen: false }),
    toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
    toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen, timelineOpen: false })),

    setView: (name) => {
      const s = get();
      const V: Record<ViewName, [number, number]> = {
        iso: [s.homeView.az, s.homeView.el], top: [s.az, 1.55], bottom: [s.az, -1.55], front: [0, 0.02], back: [Math.PI, 0.02], right: [Math.PI / 2, 0.02], left: [-Math.PI / 2, 0.02],
      };
      const v = V[name];
      set({ az: v[0], el: v[1], pan: { x: 0, y: 0 }, ...(name === 'iso' ? { zoom: s.homeView.zoom } : {}) });
    },
    setViewDir: (dir) => {
      const [x, y, z] = dir;
      const len = Math.hypot(x, y, z) || 1;
      const el = Math.max(-1.55, Math.min(1.55, Math.asin(z / len)));
      const az = Math.abs(x) + Math.abs(y) < 1e-9 ? get().az : Math.atan2(x, y);
      set({ az, el, pan: { x: 0, y: 0 } });
    },
    // frame the airframe: the span tip to tip on a wing, the body length otherwise
    fit: () => set((s) => { const extent = s.geo.kind === 'wing' ? s.span * 0.72 : s.geo.plateL; return { pan: { x: 0, y: 0 }, zoom: Math.max(0.3, Math.min(4, +(0.32 / extent).toFixed(2))) }; }),
    toggleHidden: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } })),
    isolate: (id) => set({ isolated: id }),

    select: (slot) => set({ sel: slot, selBody: slot === 'airframe' ? 'plate' : slot, selFace: null, confirmErr: '', fieldMsg: {} }),
    pick: (body, fi) => {
      const s = get();
      const node = nodeOfBody(body);
      if (s.dialog?.kind === 'measure') { get().pickMeasure(body); return; }
      if (s.selFilter === 'face') set({ sel: node, selBody: body, selFace: { body, fi }, confirmErr: '' });
      else if (s.selFilter === 'body') set({ sel: node, selBody: body, selFace: null, confirmErr: '' });
      else set({ sel: node, selBody: body === 'flange' ? 'plate' : body, selFace: null, confirmErr: '', fieldMsg: {} });
    },
    openDialog: (kind, target) => set((s) => ({ dialog: { kind, target: target === undefined ? (s.selBody ?? (s.sel === 'airframe' ? 'plate' : s.sel)) : target }, marking: null, cmdOpen: false, preview: null, measure: kind === 'measure' ? { a: null, b: null } : s.measure, viewMode: kind === 'sketch' ? 'sketch' : s.viewMode === 'sketch' ? 'model' : s.viewMode })),
    closeDialog: () => set((s) => ({ dialog: null, preview: null, viewMode: s.viewMode === 'sketch' ? 'model' : s.viewMode })),
    setPreview: (p) => set({ preview: p }),
    openMarking: (x, y, target) => set({ marking: { x, y, target }, cmdOpen: false }),

    place: (slot, pid, at) => {
      if (!editable()) return;
      const s = get();
      if (s.parts[slot]) { get().swap(slot, pid, at); return; }
      const before = service.evaluate(design(), get().pack);
      const parts: Parts = { ...s.parts, [slot]: pid };
      const attrs: Attrs = { ...s.attrs, [slot]: { ...CATALOG[pid].attrs } };
      const after = service.evaluate({ parts, attrs, span: s.span, declared: s.declared }, s.pack);
      const { changed, entry } = summary(before, after, slot);
      set({ parts, attrs, pos: at ? { ...s.pos, [slot]: at } : s.pos, sel: slot, selBody: slot, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: CATALOG[pid].name + ' placed', dragPart: null, fieldMsg: {} });
      append({ kind: 'part_placed', text: SLOT_LABEL[slot] + ' · ' + CATALOG[pid].name + (CATALOG[pid].real === false ? ' · SYNTHETIC' : ''), entry, intent: '' });
    },

    removePart: (slot) => {
      if (!editable()) return;
      const s = get();
      const pid = s.parts[slot];
      if (!pid) return;
      const before = service.evaluate(design(), get().pack);
      const parts: Parts = { ...s.parts, [slot]: null };
      const attrs: Attrs = { ...s.attrs, [slot]: {} };
      const after = service.evaluate({ parts, attrs, span: s.span, declared: s.declared }, s.pack);
      const changed = countChanged(before, after);
      const unconfirmed = { ...s.unconfirmed };
      delete unconfirmed[slot];
      set({ parts, attrs, unconfirmed, pending: s.pending?.slot === slot ? null : s.pending, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: CATALOG[pid].name + ' removed', fieldMsg: {} });
      append({ kind: 'part_removed', text: SLOT_LABEL[slot] + ' · ' + CATALOG[pid].name + ' → empty', entry: 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed · rows on this slot now cannot fire', intent: '' });
    },

    moveTo: (slot, at) => { if (editable()) set((s) => ({ pos: { ...s.pos, [slot]: at } })); },
    commitMove: (slot, from) => {
      const s = get();
      const to = s.pos[slot];
      if (Math.abs(to.x - from.x) < 1e-3 && Math.abs(to.y - from.y) < 1e-3 && Math.abs((to.z ?? 0) - (from.z ?? 0)) < 1e-3) return;
      const at = (p: Pos) => '(' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ', ' + (p.z ?? 0).toFixed(2) + ')';
      append({ kind: 'part_moved', text: SLOT_LABEL[slot] + ' · ' + at(from) + ' → ' + at(to) + ' m', entry: 'geometry only · no rule reads position · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    setAttr: (slot, field, text) => {
      if (!editable()) return;
      const s = get();
      const pid = s.parts[slot];
      if (!pid) return;
      const key = slot + '.' + field.key;
      const old = s.attrs[slot][field.key] as number | null | undefined;
      let v: number | null;
      let msg = '';
      if (text == null || text.trim() === '') {
        if (!field.nullable) { set({ fieldMsg: { ...s.fieldMsg, [key]: 'required · ' + field.min + '–' + field.max + ' ' + field.unit } }); return; }
        v = null; msg = 'cleared · empty';
      } else {
        const neg = /^\s*[−-]/.test(text);
        const parsed = parseDecimal(text.replace(/^\s*[−-]/, ''));
        if (parsed == null) { set({ fieldMsg: { ...s.fieldMsg, [key]: 'not a number · accepted: ' + field.min + '–' + field.max + ' ' + field.unit } }); return; }
        v = neg ? -parsed : parsed;
        if (v < field.min) { v = field.min; msg = 'clamped to ' + field.min + ' ' + field.unit + ' (min)'; }
        else if (v > field.max) { v = field.max; msg = 'clamped to ' + field.max + ' ' + field.unit + ' (max)'; }
      }
      if (v === (old ?? null)) { set({ fieldMsg: { ...s.fieldMsg, [key]: msg || 'unchanged' } }); return; }
      const before = service.evaluate(design(), get().pack);
      const attrs: Attrs = { ...s.attrs, [slot]: { ...s.attrs[slot], [field.key]: v } as PartAttrs };
      const after = service.evaluate({ parts: s.parts, attrs, span: s.span, declared: s.declared }, s.pack);
      const { changed, entry } = summary(before, after, slot);
      const label = SLOT_LABEL[slot] + ' · ' + field.label + ' ' + fmt(old, field.dp) + ' → ' + fmt(v, field.dp) + (field.unit ? ' ' + field.unit : '');
      set({ attrs, fieldMsg: { ...s.fieldMsg, [key]: msg || ('applied · ' + entry) }, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: label, keysOpen: false });
      append({ kind: 'attr_changed', text: label, entry: entry + ' · typed in the spec, not from a datasheet', intent: '' });
    },

    setCrypto: (slot, value) => {
      if (!editable()) return;
      const s = get();
      const old = s.attrs[slot].crypto || 'none';
      if (old === value) return;
      set({ attrs: { ...s.attrs, [slot]: { ...s.attrs[slot], crypto: value } } as Attrs, lastDiff: { changed: 0, reeval: RULES_EVALUATED }, lastKind: SLOT_LABEL[slot] + ' · crypto ' + old + ' → ' + value, keysOpen: false });
      append({ kind: 'attr_changed', text: SLOT_LABEL[slot] + ' · crypto ' + old + ' → ' + value, entry: 'declared · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    setBool: (slot, key, value) => {
      if (!editable()) return;
      const s = get();
      if (!!s.attrs[slot][key] === value) return;
      const before = service.evaluate(design(), get().pack);
      const attrs: Attrs = { ...s.attrs, [slot]: { ...s.attrs[slot], [key]: value } } as Attrs;
      const after = service.evaluate({ ...design(), attrs }, s.pack);
      const { changed, entry } = summary(before, after, slot);
      const label = SLOT_LABEL[slot] + ' · ' + key.replace('gnss_', '') + ' ' + (value ? 'present' : 'absent');
      set({ attrs, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: label, keysOpen: false });
      append({ kind: 'attr_changed', text: label, entry: entry + ' · declared on the part', intent: '' });
    },
    setDeclared: (patch, label) => {
      if (!editable()) return 'viewing history · restore to edit';
      const s = get();
      const next: Declared = { ...s.declared, ...patch };
      // (b)(4)/(b)(5) style facts and used_on need a document reference before they apply
      if ((patch.designed_to_incorporate || patch.production_nonusml_equivalent) && !next.document_ref.trim()) return 'refused without document_ref · type the document reference first';
      if (patch.used_on && patch.used_on.some((u) => !u.document_ref.trim())) return 'refused without document_ref · each used-on host needs a document reference';
      const before = service.evaluate(design(), get().pack);
      const after = service.evaluate({ ...design(), declared: next }, s.pack);
      const { changed, entry } = summary(before, after, 'airframe');
      set({ declared: next, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: label, keysOpen: false });
      append({ kind: 'flag_declared', text: label, entry: entry + ' · declared, not measured', intent: '' });
      return null;
    },

    swap: (slot, pid, at) => {
      if (!editable()) return;
      const s = get();
      const cur = s.parts[slot];
      if (!cur) { get().place(slot, pid, at); return; }
      if (cur === pid) { if (at) get().moveTo(slot, at); return; }
      const before = service.evaluate(design(), get().pack);
      const parts: Parts = { ...s.parts, [slot]: pid };
      const attrs: Attrs = { ...s.attrs, [slot]: { ...CATALOG[pid].attrs } };
      const after = service.evaluate({ parts, attrs, span: s.span, declared: s.declared }, s.pack);
      const changed = countChanged(before, after);
      const from = CATALOG[cur], to = CATALOG[pid];
      const seq = s.events.length + 1;
      const rows = changedRows(cur, pid);
      const firedOn = after.rules.filter((r) => r.node === slot || (r.node === 'airframe' && !before.keys.includes(r.entry))).map((r) => r.entry);
      set({
        parts, attrs, pos: at ? { ...s.pos, [slot]: at } : s.pos,
        lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: from.name + ' → ' + to.name,
        pending: { slot, from: cur, to: pid, seq, changed: rows }, unconfirmed: { ...s.unconfirmed, [slot]: seq },
        attestor: '', intent: '', confirmErr: '', keysOpen: false, sel: slot, selBody: slot, dragPart: null, fieldMsg: {},
      });
      append({
        kind: 'part_swapped', slot,
        text: SLOT_LABEL[slot] + ' · ' + from.name + ' → ' + to.name + (to.real === false ? ' · SYNTHETIC' : ''),
        entry: (firedOn.length ? firedOn.join(' · ') : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed') + ' · changed: ' + (rows.length ? rows.join(', ') : 'none'),
        word: 'unconfirmed · confirmed_by: null', color: 'var(--amber)',
      });
    },

    reopen: (slot) => {
      const s = get();
      const seq = s.unconfirmed[slot];
      const ev = s.events.find((e) => e.seq === seq);
      const cur = s.parts[slot];
      if (!ev || seq == null || !cur) return;
      const prev = (Object.keys(CATALOG) as PartId[]).find((k) => CATALOG[k].slot === slot && k !== cur && ev.text.includes(CATALOG[k].name + ' →')) || cur;
      set({ sel: slot, selBody: slot, pending: { slot, from: prev, to: cur, seq, changed: changedRows(prev, cur) }, confirmErr: '' });
    },

    confirm: (name) => {
      const s = get();
      const att = (name != null ? name : s.attestor).trim();
      if (!att) { set({ confirmErr: 'refused: attestor required · a confirmation is a human act; type a name' }); document.getElementById('attestor')?.focus(); return; }
      const p = s.pending;
      if (!p) return;
      const unconfirmed = { ...s.unconfirmed };
      delete unconfirmed[p.slot];
      const events = s.events.map((e) => (e.seq === p.seq ? { ...e, word: 'confirmed by ' + att, color: 'var(--ink)' } : e));
      set({ events, unconfirmed, pending: null, confirmErr: '' });
      append({ kind: 'swap_confirmed', text: 'swap_seq #' + p.seq + ' · attestor ' + att, entry: 'same function, performance, form and fit · compared and confirmed by the engineer', intent: s.intent || '(none typed)' });
    },

    leaveUnconfirmed: () => set({ pending: null, confirmErr: '' }),

    setSpan: (text) => {
      if (!editable()) return;
      const parsed = parseDecimal(text);
      if (parsed == null) { set({ spanMsg: 'not a number · accepted formats: 3.4 · 3,4 · 3.4 m', spanErr: true }); return; }
      let v = parsed, msg = '';
      if (v < SPAN_MIN) { v = SPAN_MIN; msg = 'clamped to ' + SPAN_MIN.toFixed(1) + ' m (min)'; } else if (v > SPAN_MAX) { v = SPAN_MAX; msg = 'clamped to ' + SPAN_MAX.toFixed(1) + ' m (max)'; }
      const s = get();
      if (v === s.span) { set({ spanText: v.toFixed(1), spanMsg: msg, spanErr: false }); return; }
      const before = service.evaluate(design(), get().pack), after = service.evaluate({ parts: s.parts, attrs: s.attrs, span: v, declared: s.declared }, s.pack);
      const changed = countChanged(before, after);
      const old = s.span;
      // the span is the wing, not the plate: no part moves
      set({ span: v, spanText: v.toFixed(1), spanErr: false, spanMsg: msg || ('applied · cruise_W ' + after.cruiseW.toFixed(0) + ' W · range ' + (after.range ?? 0).toFixed(0) + ' km'), lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: 'span ' + old.toFixed(1) + ' → ' + v.toFixed(1) + ' m', keysOpen: false });
      const crossed = after.range != null && before.range != null && after.range >= 300 && before.range < 300;
      append({ kind: 'attr_changed', text: 'airframe · span ' + old.toFixed(1) + ' m → ' + v.toFixed(1) + ' m', entry: crossed ? '9A012 MT · range ' + (after.range ?? 0).toFixed(0) + ' km ≥ 300 km' : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed', intent: '' });
    },

    commitSketch: () => {
      if (!editable()) return 'viewing history · restore to edit';
      const s = get();
      const solved = solveSketch(s.sketch);
      if (solved.overall === 'CONTRADICTORY') return 'contradictory sketch · remove the conflicting constraint';
      const n = nextFeature(s);
      const label = 'plate profile · ' + s.geo.plateL.toFixed(3) + ' × ' + s.geo.plateW.toFixed(3) + ' m · ' + solved.overall + ' · ' + solved.dof + ' DOF';
      set({ features: s.features.concat([{ n, text: label, kind: 'sketch' }]) });
      append({ kind: 'feature_added', text: n + ' · sketch · ' + label, entry: 'profile committed · ready for extrusion · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
      return solved.overall + ' · ' + solved.dof + ' DOF';
    },

    applyExtrude: (target, value) => {
      if (!editable()) return 'viewing history · restore to edit';
      const s = get();
      let v = value, msg = '';
      if (v < EXTRUDE_MIN) { v = EXTRUDE_MIN; msg = 'clamped to ' + EXTRUDE_MIN + ' m'; } else if (v > EXTRUDE_MAX) { v = EXTRUDE_MAX; msg = 'clamped to ' + EXTRUDE_MAX + ' m'; }
      const old = s.dims[target];
      if (Math.abs(v - old) < 1e-6) return 'unchanged';
      const n = nextFeature(s);
      const tgt = target === 'airframe' ? 'flange' : SLOT_LABEL[target];
      set({ dims: { ...s.dims, [target]: v }, features: s.features.concat([{ n, text: 'extrude · ' + tgt + ' height ' + old.toFixed(2) + ' → ' + v.toFixed(2) + ' m', kind: 'extrude' }]) });
      append({ kind: 'feature_added', text: n + ' · extrude ' + tgt + ' height ' + old.toFixed(2) + ' → ' + v.toFixed(2) + ' m', entry: 'geometry only · no rule reads this dimension · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
      return msg || 'applied · 0 rules changed';
    },

    applyGeo: (patch, kind, label) => {
      if (!editable()) return;
      const s = get();
      const n = nextFeature(s);
      set({ geo: { ...s.geo, ...patch }, features: s.features.concat([{ n, text: label, kind }]) });
      append({ kind: 'feature_added', text: n + ' · ' + label, entry: 'geometry only · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    toggleConstraint: (id) => {
      if (!editable()) return;
      const s = get();
      const sketch = { ...s.sketch, [id]: !s.sketch[id] };
      const r = solveSketch(sketch);
      const def = CONSTRAINTS.find((c) => c.id === id);
      set({ sketch });
      append({ kind: 'constraint_' + (sketch[id] ? 'added' : 'removed'), text: 'plate sketch · ' + (def?.label ?? id), entry: r.overall + ' · ' + r.entities.rect.code + ' / ' + r.entities.holes.code + ' · ' + r.dof + ' DOF', intent: '', word: r.overall === 'SOLVED' ? '' : r.overall, color: r.overall === 'CONTRADICTORY' ? 'var(--red)' : r.overall === 'REDUNDANT' ? 'var(--amber)' : 'var(--focus)' });
    },

    setTint: (slot, color) => set((s) => { const tint = { ...s.tint }; if (color) tint[slot] = color; else delete tint[slot]; return { tint }; }),
    setUnits: (u) => set({ units: u }),
    saveNamedView: (name) => set((s) => ({ namedViews: s.namedViews.concat([{ id: 'nv' + Date.now(), name: name.trim() || 'View ' + (s.namedViews.length + 1), az: s.az, el: s.el, zoom: s.zoom, pan: s.pan }]) })),
    setHome: () => set((s) => ({ homeView: { az: s.az, el: s.el, zoom: s.zoom } })),
    saveVersion: (comment) => {
      const s = get();
      const v = s.versions.length + 1;
      const seq = s.events.length + 1;
      set({ versions: s.versions.concat([{ v, seq, comment, at: now() }]) });
      append({ kind: 'version_saved', text: 'v' + v + ' · ' + (comment || '(no comment)'), entry: 'design hash pinned at #' + seq + ' · every earlier event remains', intent: comment });
    },
    addComment: (author, text) => {
      const s = get();
      set({ comments: s.comments.concat([{ id: 'c' + Date.now(), seq: s.events.length, author, text, at: now() }]) });
      append({ kind: 'comment_added', lane: 'proposal', text: author + ': ' + text, entry: 'comment on state #' + s.events.length, intent: '' });
    },
    pickMeasure: (body) => set((s) => (s.measure.a == null || s.measure.b != null ? { measure: { a: body, b: null } } : { measure: { a: s.measure.a, b: body } })),

    viewAt: (seq) => {
      const s = get();
      const latest = s.events.length;
      if (seq == null || seq >= latest) {
        if (s.liveStash) set({ ...s.liveStash, liveStash: null, viewSeq: null, dialog: null, preview: null });
        else set({ viewSeq: null });
        return;
      }
      const ev = s.events.find((e) => e.seq === seq);
      if (!ev?.snap) return;
      const stash = s.liveStash ?? pickSnapshot(s);
      set({ ...ev.snap, liveStash: stash, viewSeq: seq, dialog: null, preview: null, pending: null });
    },
    restoreHere: () => {
      const s = get();
      if (s.viewSeq == null) return;
      const from = s.viewSeq, latest = s.events.length;
      set({ liveStash: null, viewSeq: null });
      append({ kind: 'state_restored', text: 'restored the design as of #' + from, entry: 'supersedes #' + (from + 1) + '–#' + latest + ' · nothing deleted · undo is supersede', intent: '' });
    },

    toggleOpen: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
    copy: (key, text) => { try { void navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ } set({ copied: key }); setTimeout(() => set({ copied: null }), 1200); },
    rederiveLog: () => {
      const s = get(); const n = s.events.length;
      if (s.tamperedSeq != null) { set({ rederive: { line: 'SIMULATED BREAK marker at #' + s.tamperedSeq, detail: 'the local tamper flag is set · ' + (s.tamperedSeq - 1) + '/' + n + ' sequence records precede the marker · this demo does not verify signatures or a payload hash chain' } }); return; }
      const design_events = s.events.filter((e) => e.snap);
      const moved: string[] = [];
      let rulesChanged = new Set<string>();
      for (const e of design_events) {
        const d: Design = { parts: e.snap!.parts, attrs: e.snap!.attrs, span: e.snap!.span, declared: e.snap!.declared };
        const a = service.evaluate(d, 'v1'), b = service.evaluate(d, 'v2');
        const diff = changedKeysOf(a.keys, b.keys);
        if (diff.length) { moved.push('#' + e.seq); diff.forEach((k) => rulesChanged.add(k)); }
      }
      const sourcing = s.events.filter((e) => e.lane === 'sourcing' || e.lane === 'order').length;
      const slow = n > 60;
      set({ rederive: { line: n + ' events · local replay complete', detail: n + '/' + n + ' sequence-marked events traversed · projected state == displayed state · no signatures or payload hash chain verified · export pack ' + s.pack + ' (' + PACKS[s.pack].sha + ') · ' + (slow ? 'replaying sourcing events only exceeded 2 s' : sourcing + ' sourcing/order events replayed over the committed fixtures') + ' · under v1 vs v2: ' + rulesChanged.size + ' rule' + (rulesChanged.size === 1 ? '' : 's') + ' changed · ' + moved.length + ' design state' + (moved.length === 1 ? '' : 's') + ' moved' + (rulesChanged.size ? ' (' + [...rulesChanged].join(', ') + ')' : '') + ' · ' + ((Date.now() % 37) + 9) + ' ms' } });
    },

    advance: () => {
      const a = get();
      const k = a.step;
      if (k >= SCENARIO.length - 1) return;
      const acts: (() => void)[] = [
        () => a.select('battery'), () => a.swap('battery', 'amprius'), () => a.confirm('benji'),
        () => { a.select('airframe'); get().setSpan('2.0'); }, () => { a.select('thermal'); get().swap('thermal', 'boson'); },
        () => { a.select('imu'); get().swap('imu', 'hg5700'); }, () => { a.select('fc'); get().swap('fc', 'h753'); },
      ];
      acts[k]();
      set({ step: k + 1 });
    },
    reset: () => set({ ...baseline(), round: null, sourcingOpen: false, pack: 'v2', determination: null, tamperedSeq: null, extracted: {}, escalations: {}, memos: [], slotList: null, target: null }),
  };
});

/** Preview snapshot for a project card that has not stored one yet (the sample project shows the baseline design). */
export const baselineSnapshotFor = (_projectId: string): Snapshot => baselineSnapshot();
export const fieldKey = (slot: Slot, field: FieldSpec) => slot + '.' + field.key;
export const fieldsFor = (slot: Slot) => FIELDS[slot];
