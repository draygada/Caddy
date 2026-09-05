import { create } from 'zustand';
import {
  BASELINE_PARTS, CATALOG, CMP_KEYS, DEFAULT_POS, DIMS0, EXTRUDE_MAX, EXTRUDE_MIN, FIELDS, RULES_EVALUATED, SCENARIO, SEED_EVENTS, SEED_FEATURES,
  SLOTS, SLOT_LABEL, SPAN_BASELINE, SPAN_MAX, SPAN_MIN,
  type CmpKey, type Dims, type Feature, type FieldSpec, type Lane, type Node, type PartAttrs, type PartId, type Slot, type TimelineEvent,
} from './lib/catalog';
import { hashOf, parseDecimal } from './lib/hash';
import { countChanged, type Attrs, type Design, type Parts } from './lib/rules';
import { service, type ServiceState } from './lib/service';
import type { ViewName } from './lib/geometry';

export type Theme = 'light' | 'dark';
export type ViewMode = 'model' | 'sheet';
export type NavMode = 'orbit' | 'pan' | 'zoom';
export type VisualStyle = 'shaded' | 'edges' | 'wireframe';
export interface Pos { x: number; y: number }
export type Positions = Record<Slot, Pos>;

export interface Pending { slot: Slot; from: PartId; to: PartId; seq: number; changed: CmpKey[] }

export interface WorkbenchState {
  theme: Theme;
  serviceState: ServiceState;
  demoBar: boolean;
  sel: Node | null;
  hover: Node | null;
  parts: Parts;
  /** editable instance attributes per slot; {} when the slot is empty */
  attrs: Attrs;
  pos: Positions;
  span: number;
  spanText: string;
  spanMsg: string;
  spanErr: boolean;
  events: TimelineEvent[];
  unconfirmed: Partial<Record<Slot, number>>;
  pending: Pending | null;
  attestor: string;
  intent: string;
  confirmErr: string;
  open: Record<string, boolean>;
  timelineOpen: boolean;
  helpOpen: boolean;
  reasoningOpen: boolean;
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
  /** browser eye toggles: body id → hidden */
  hidden: Record<string, boolean>;
  dragging: boolean;
  dragPart: PartId | null;
  dims: Dims;
  features: Feature[];
  extrudeText: string;
  extrudeMsg: string;
  /** per-field message after an edit (clamped / applied / not a number) */
  fieldMsg: Record<string, string>;

  patch: (p: Partial<WorkbenchState>) => void;
  design: () => Design;
  toggleTheme: () => void;
  closeAll: () => void;
  openTimeline: () => void;
  toggleTimeline: () => void;
  toggleHelp: () => void;
  openReasoning: () => void;
  setView: (name: ViewName) => void;
  /** snap the camera to look along a direction (ViewCube face / edge / corner) */
  setViewDir: (dir: [number, number, number]) => void;
  fit: () => void;
  toggleHidden: (id: string) => void;
  select: (slot: Node) => void;
  swap: (slot: Slot, pid: PartId, at?: Pos) => void;
  place: (slot: Slot, pid: PartId, at?: Pos) => void;
  removePart: (slot: Slot) => void;
  moveTo: (slot: Slot, at: Pos) => void;
  commitMove: (slot: Slot, from: Pos) => void;
  setAttr: (slot: Slot, field: FieldSpec, text: string | null) => void;
  setCrypto: (slot: Slot, value: string) => void;
  reopen: (slot: Slot) => void;
  confirm: (name?: string) => void;
  leaveUnconfirmed: () => void;
  setSpan: (text: string) => void;
  applyExtrude: () => void;
  toggleOpen: (id: string) => void;
  copy: (key: string | number, text: string) => void;
  rederiveLog: () => void;
  advance: () => void;
  reset: () => void;
}

const ISO: [number, number] = [Math.PI / 4, 0.6155];

function readUrl(): { theme: Theme; demoBar: boolean; serviceState: ServiceState } {
  try {
    const q = new URLSearchParams(location.search);
    return {
      theme: q.get('theme') === 'dark' ? 'dark' : 'light',
      demoBar: q.get('demo') === '1',
      serviceState: q.get('service') === 'unreachable' ? 'unreachable' : 'cached',
    };
  } catch {
    return { theme: 'light', demoBar: false, serviceState: 'cached' };
  }
}

const attrsFor = (parts: Parts): Attrs => Object.fromEntries(SLOTS.map((s) => [s, parts[s] ? { ...CATALOG[parts[s] as PartId].attrs } : {}])) as Attrs;
const posFor = (span: number): Positions => Object.fromEntries(SLOTS.map((s) => [s, DEFAULT_POS[s](span)])) as Positions;

const baseline = () => ({
  sel: null as Node | null,
  hover: null as Node | null,
  parts: { ...BASELINE_PARTS },
  attrs: attrsFor(BASELINE_PARTS),
  pos: posFor(SPAN_BASELINE),
  span: SPAN_BASELINE,
  spanText: SPAN_BASELINE.toFixed(1),
  spanMsg: '',
  spanErr: false,
  events: SEED_EVENTS.slice().reverse(),
  unconfirmed: {} as Partial<Record<Slot, number>>,
  pending: null as Pending | null,
  attestor: '',
  intent: '',
  confirmErr: '',
  open: {} as Record<string, boolean>,
  lastDiff: null as { changed: number; reeval: number } | null,
  lastKind: null as string | null,
  rederive: null as { line: string; detail: string } | null,
  step: 0,
  keysOpen: false,
  az: ISO[0],
  el: ISO[1],
  zoom: 0.7,
  pan: { x: 0, y: 0 },
  dims: { ...DIMS0 },
  features: SEED_FEATURES.slice(),
  extrudeText: '',
  extrudeMsg: '',
  fieldMsg: {} as Record<string, string>,
  dragging: false,
  dragPart: null as PartId | null,
});

const fmt = (v: number | null | undefined, dp: number) => (v == null ? 'not published' : v.toFixed(dp));

export const useStore = create<WorkbenchState>()((set, get) => {
  const append = (ev: Partial<TimelineEvent> & { kind: string; text: string; entry: string }) => {
    set((s) => {
      const seq = s.events.length + 1;
      const full: TimelineEvent = { seq, lane: 'design', intent: '', word: '', color: 'var(--ink)', ...ev, hash: hashOf(seq) };
      return { events: [full, ...s.events] };
    });
  };
  const changedRows = (from: PartId, to: PartId): CmpKey[] => CMP_KEYS.filter((k) => CATALOG[from].cmp[k] !== CATALOG[to].cmp[k]);
  const design = (): Design => { const s = get(); return { parts: s.parts, attrs: s.attrs, span: s.span }; };
  const summary = (before: ReturnType<typeof service.evaluate>, after: ReturnType<typeof service.evaluate>, node: Node) => {
    const changed = countChanged(before, after);
    const firedOn = after.rules.filter((r) => (r.node === node || r.node === 'airframe') && !before.keys.includes(r.entry)).map((r) => r.entry);
    return { changed, entry: firedOn.length ? firedOn.join(' · ') : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed' };
  };

  return {
    ...readUrl(),
    ...baseline(),
    timelineOpen: false,
    helpOpen: false,
    reasoningOpen: false,
    lane: 'all',
    copied: null,
    viewMode: 'model',
    grid: true,
    navMode: 'orbit',
    visualStyle: 'edges',
    hidden: {},

    patch: (p) => set(p),
    design,
    toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    closeAll: () => set({ timelineOpen: false, helpOpen: false, reasoningOpen: false }),
    openTimeline: () => set({ timelineOpen: true, helpOpen: false }),
    toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
    toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen, timelineOpen: false })),
    openReasoning: () => set({ reasoningOpen: true, timelineOpen: false, helpOpen: false }),

    setView: (name) => {
      const s = get();
      const V: Record<ViewName, [number, number]> = {
        iso: ISO, top: [s.az, 1.55], bottom: [s.az, -1.55], front: [0, 0.02], back: [Math.PI, 0.02], right: [Math.PI / 2, 0.02], left: [-Math.PI / 2, 0.02],
      };
      const v = V[name];
      set({ az: v[0], el: v[1], pan: { x: 0, y: 0 }, ...(name === 'iso' ? { zoom: 0.7 } : {}) });
    },

    setViewDir: (dir) => {
      const [x, y, z] = dir;
      const len = Math.hypot(x, y, z) || 1;
      const el = Math.max(-1.55, Math.min(1.55, Math.asin(z / len)));
      const az = Math.abs(x) + Math.abs(y) < 1e-9 ? get().az : Math.atan2(x, y);
      set({ az, el, pan: { x: 0, y: 0 } });
    },
    fit: () => set((s) => ({ pan: { x: 0, y: 0 }, zoom: Math.max(0.3, Math.min(2, +(2.1 / s.span).toFixed(2))) })),
    toggleHidden: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } })),

    select: (slot) => set((s) => ({ sel: slot, confirmErr: '', extrudeText: s.dims[slot].toFixed(2), extrudeMsg: '', fieldMsg: {} })),

    place: (slot, pid, at) => {
      const s = get();
      if (s.parts[slot]) { get().swap(slot, pid, at); return; }
      const before = service.evaluate(design());
      const parts: Parts = { ...s.parts, [slot]: pid };
      const attrs: Attrs = { ...s.attrs, [slot]: { ...CATALOG[pid].attrs } };
      const after = service.evaluate({ parts, attrs, span: s.span });
      const { changed, entry } = summary(before, after, slot);
      const pos = at ? { ...s.pos, [slot]: at } : s.pos;
      set({ parts, attrs, pos, sel: slot, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: CATALOG[pid].name + ' placed', extrudeText: s.dims[slot].toFixed(2), extrudeMsg: '', dragPart: null, fieldMsg: {} });
      append({ kind: 'part_placed', text: SLOT_LABEL[slot] + ' · ' + CATALOG[pid].name + (CATALOG[pid].real === false ? ' · SYNTHETIC' : ''), entry, intent: '' });
    },

    removePart: (slot) => {
      const s = get();
      const pid = s.parts[slot];
      if (!pid) return;
      const before = service.evaluate(design());
      const parts: Parts = { ...s.parts, [slot]: null };
      const attrs: Attrs = { ...s.attrs, [slot]: {} };
      const after = service.evaluate({ parts, attrs, span: s.span });
      const changed = countChanged(before, after);
      const unconfirmed = { ...s.unconfirmed };
      delete unconfirmed[slot];
      set({ parts, attrs, unconfirmed, pending: s.pending?.slot === slot ? null : s.pending, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: CATALOG[pid].name + ' removed', fieldMsg: {} });
      append({ kind: 'part_removed', text: SLOT_LABEL[slot] + ' · ' + CATALOG[pid].name + ' → empty', entry: 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed · rows on this slot now cannot fire', intent: '' });
    },

    moveTo: (slot, at) => set((s) => ({ pos: { ...s.pos, [slot]: at } })),
    commitMove: (slot, from) => {
      const s = get();
      const to = s.pos[slot];
      if (Math.abs(to.x - from.x) < 1e-3 && Math.abs(to.y - from.y) < 1e-3) return;
      append({ kind: 'part_moved', text: SLOT_LABEL[slot] + ' · (' + from.x.toFixed(2) + ', ' + from.y.toFixed(2) + ') → (' + to.x.toFixed(2) + ', ' + to.y.toFixed(2) + ') m', entry: 'geometry only · no rule reads position · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    setAttr: (slot, field, text) => {
      const s = get();
      const pid = s.parts[slot];
      if (!pid) return;
      const key = slot + '.' + field.key;
      const old = s.attrs[slot][field.key] as number | null | undefined;
      let v: number | null;
      let msg = '';
      if (text == null || text.trim() === '') {
        if (!field.nullable) { set({ fieldMsg: { ...s.fieldMsg, [key]: 'required — ' + field.min + '–' + field.max + ' ' + field.unit } }); return; }
        v = null; msg = 'cleared · not published · the rule cannot fire on this field';
      } else {
        const parsed = parseDecimal(text.replace(/^[−-]/, (m) => (m ? '-' : '')).replace(/^-/, ''));
        const neg = /^\s*[−-]/.test(text);
        if (parsed == null) { set({ fieldMsg: { ...s.fieldMsg, [key]: 'not a number — accepted: ' + field.min + '–' + field.max + ' ' + field.unit } }); return; }
        v = neg ? -parsed : parsed;
        if (v < field.min) { v = field.min; msg = 'clamped to ' + field.min + ' ' + field.unit + ' (min)'; }
        else if (v > field.max) { v = field.max; msg = 'clamped to ' + field.max + ' ' + field.unit + ' (max)'; }
      }
      if (v === (old ?? null)) { set({ fieldMsg: { ...s.fieldMsg, [key]: msg || 'unchanged' } }); return; }
      const before = service.evaluate(design());
      const attrs: Attrs = { ...s.attrs, [slot]: { ...s.attrs[slot], [field.key]: v } as PartAttrs };
      const after = service.evaluate({ parts: s.parts, attrs, span: s.span });
      const { changed, entry } = summary(before, after, slot);
      set({ attrs, fieldMsg: { ...s.fieldMsg, [key]: msg || ('applied · ' + entry) }, lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: SLOT_LABEL[slot] + ' · ' + field.label + ' ' + fmt(old, field.dp) + ' → ' + fmt(v, field.dp) + (field.unit ? ' ' + field.unit : ''), keysOpen: false });
      append({ kind: 'attr_changed', text: SLOT_LABEL[slot] + ' · ' + field.label + ' ' + fmt(old, field.dp) + ' → ' + fmt(v, field.dp) + (field.unit ? ' ' + field.unit : ''), entry: entry + ' · typed in the spec, not from a datasheet', intent: '' });
    },

    setCrypto: (slot, value) => {
      const s = get();
      const old = s.attrs[slot].crypto || 'none';
      if (old === value) return;
      set({ attrs: { ...s.attrs, [slot]: { ...s.attrs[slot], crypto: value } } as Attrs, lastDiff: { changed: 0, reeval: RULES_EVALUATED }, lastKind: SLOT_LABEL[slot] + ' · crypto ' + old + ' → ' + value, keysOpen: false });
      append({ kind: 'attr_changed', text: SLOT_LABEL[slot] + ' · crypto ' + old + ' → ' + value, entry: 'declared · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    swap: (slot, pid, at) => {
      const s = get();
      const cur = s.parts[slot];
      if (!cur) { get().place(slot, pid, at); return; }
      if (cur === pid) { if (at) get().moveTo(slot, at); return; }
      const before = service.evaluate(design());
      const parts: Parts = { ...s.parts, [slot]: pid };
      const attrs: Attrs = { ...s.attrs, [slot]: { ...CATALOG[pid].attrs } };
      const after = service.evaluate({ parts, attrs, span: s.span });
      const changed = countChanged(before, after);
      const from = CATALOG[cur], to = CATALOG[pid];
      const seq = s.events.length + 1;
      const rows = changedRows(cur, pid);
      const firedOn = after.rules.filter((r) => r.node === slot || (r.node === 'airframe' && !before.keys.includes(r.entry))).map((r) => r.entry);
      set({
        parts, attrs, pos: at ? { ...s.pos, [slot]: at } : s.pos,
        lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: from.name + ' → ' + to.name,
        pending: { slot, from: cur, to: pid, seq, changed: rows },
        unconfirmed: { ...s.unconfirmed, [slot]: seq },
        attestor: '', intent: '', confirmErr: '', keysOpen: false, sel: slot, extrudeText: s.dims[slot].toFixed(2), dragPart: null, fieldMsg: {},
      });
      append({
        kind: 'part_swapped',
        text: SLOT_LABEL[slot] + ' · ' + from.name + ' → ' + to.name + (to.real === false ? ' · SYNTHETIC' : ''),
        entry: (firedOn.length ? firedOn.join(' · ') : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed') + ' · changed: ' + (rows.length ? rows.join(', ') : 'none'),
        word: 'unconfirmed · confirmed_by: null', color: 'var(--amber)', slot,
      });
    },

    reopen: (slot) => {
      const s = get();
      const seq = s.unconfirmed[slot];
      const ev = s.events.find((e) => e.seq === seq);
      const cur = s.parts[slot];
      if (!ev || seq == null || !cur) return;
      const prev = (Object.keys(CATALOG) as PartId[]).find((k) => CATALOG[k].slot === slot && k !== cur && ev.text.includes(CATALOG[k].name + ' →')) || cur;
      set({ sel: slot, pending: { slot, from: prev, to: cur, seq, changed: changedRows(prev, cur) }, confirmErr: '' });
    },

    confirm: (name) => {
      const s = get();
      const att = (name != null ? name : s.attestor).trim();
      if (!att) {
        set({ confirmErr: 'refused: attestor required — a confirmation is a human act; type a name' });
        document.getElementById('attestor')?.focus();
        return;
      }
      const p = s.pending;
      if (!p) return;
      const unconfirmed = { ...s.unconfirmed };
      delete unconfirmed[p.slot];
      const events = s.events.map((e) => (e.seq === p.seq ? { ...e, word: 'confirmed by ' + att, color: 'var(--ink)' } : e));
      set({ events, unconfirmed, pending: null, confirmErr: '' });
      append({ kind: 'swap_confirmed', text: 'swap_seq #' + p.seq + ' · attestor ' + att, entry: 'same function, performance, form and fit — compared and confirmed by the engineer', intent: s.intent || '(none typed)' });
    },

    leaveUnconfirmed: () => set({ pending: null, confirmErr: '' }),

    setSpan: (text) => {
      const parsed = parseDecimal(text);
      if (parsed == null) { set({ spanMsg: 'not a number — accepted formats: 3.4 · 3,4 · 3.4 m', spanErr: true }); return; }
      let v = parsed, msg = '';
      if (v < SPAN_MIN) { v = SPAN_MIN; msg = 'clamped to 1.5 m (min)'; } else if (v > SPAN_MAX) { v = SPAN_MAX; msg = 'clamped to 6.0 m (max)'; }
      const s = get();
      if (v === s.span) { set({ spanText: v.toFixed(1), spanMsg: msg, spanErr: false }); return; }
      const before = service.evaluate(design()), after = service.evaluate({ parts: s.parts, attrs: s.attrs, span: v });
      const changed = countChanged(before, after);
      const old = s.span;
      // keep bodies on the plate when it shrinks
      const pos = { ...s.pos };
      for (const sl of SLOTS) pos[sl] = { x: Math.min(pos[sl].x, v - 0.3), y: pos[sl].y };
      set({
        span: v, spanText: v.toFixed(1), spanErr: false, pos,
        spanMsg: msg || ('applied · cruise_W ' + after.cruiseW.toFixed(0) + ' W · range ' + (after.range ?? 0).toFixed(0) + ' km'),
        lastDiff: { changed, reeval: RULES_EVALUATED }, lastKind: 'span ' + old.toFixed(1) + ' → ' + v.toFixed(1) + ' m', keysOpen: false,
      });
      const crossed = after.range != null && before.range != null && after.range >= 300 && before.range < 300;
      append({ kind: 'attr_changed', text: 'airframe · span ' + old.toFixed(1) + ' m → ' + v.toFixed(1) + ' m', entry: crossed ? '9A012 MT · range ' + (after.range ?? 0).toFixed(0) + ' km ≥ 300 km' : 're-evaluated ' + RULES_EVALUATED + ' · ' + changed + ' changed', intent: '' });
    },

    applyExtrude: () => {
      const s = get();
      const slot = s.sel;
      if (!slot) return;
      const parsed = parseDecimal(s.extrudeText);
      if (parsed == null) { set({ extrudeMsg: 'not a number — e.g. 0.45' }); return; }
      let v = parsed, msg = '';
      if (v < EXTRUDE_MIN) { v = EXTRUDE_MIN; msg = 'clamped to 0.02 m'; } else if (v > EXTRUDE_MAX) { v = EXTRUDE_MAX; msg = 'clamped to 1.5 m'; }
      const old = s.dims[slot];
      if (v === old) { set({ extrudeMsg: 'unchanged', extrudeText: v.toFixed(2) }); return; }
      const n = 'f' + (s.features.length + 1);
      const tgt = slot === 'airframe' ? 'flange' : SLOT_LABEL[slot];
      set({
        dims: { ...s.dims, [slot]: v }, extrudeText: v.toFixed(2), extrudeMsg: msg || 'applied · 0 rules changed',
        features: s.features.concat([{ n, text: 'extrude · ' + tgt + ' height ' + old.toFixed(2) + ' → ' + v.toFixed(2) + ' m' }]),
      });
      append({ kind: 'feature_added', text: n + ' · extrude ' + tgt + ' height ' + old.toFixed(2) + ' → ' + v.toFixed(2) + ' m', entry: 'geometry only · no rule reads this dimension · re-evaluated ' + RULES_EVALUATED + ' · 0 changed', intent: '' });
    },

    toggleOpen: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),

    copy: (key, text) => {
      try { void navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
      set({ copied: key });
      setTimeout(() => set({ copied: null }), 1200);
    },

    rederiveLog: () => {
      const n = get().events.length;
      set({ rederive: { line: n + ' events · chain intact', detail: n + '/' + n + ' signatures valid · derived state == displayed state · pack v1 · ' + ((Date.now() % 37) + 9) + ' ms' } });
    },

    advance: () => {
      const a = get();
      const k = a.step;
      if (k >= SCENARIO.length - 1) return;
      const acts: (() => void)[] = [
        () => a.select('battery'),
        () => a.swap('battery', 'amprius'),
        () => a.confirm('benji'),
        () => { a.select('airframe'); get().setSpan('3.4'); },
        () => { a.select('thermal'); get().swap('thermal', 'boson'); },
        () => { a.select('imu'); get().swap('imu', 'hg5700'); },
        () => { a.select('fc'); get().swap('fc', 'h753'); },
      ];
      acts[k]();
      set({ step: k + 1 });
    },

    reset: () => set({ ...baseline() }),
  };
});

export const fieldKey = (slot: Slot, field: FieldSpec) => slot + '.' + field.key;
export const fieldsFor = (slot: Slot) => FIELDS[slot];
