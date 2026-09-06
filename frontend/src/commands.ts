// Every user-facing command in one registry: the S-key command box, the
// right-click marking menu and the keyboard shortcuts all resolve here.
import { useStore, nodeOfBody, type BodyId, type WorkbenchState } from './store';
import { UNITS } from './lib/units';
import { useTripwireStore } from './tripwire-store';

export type CommandGroup = 'view' | 'create' | 'modify' | 'inspect' | 'select' | 'document' | 'review' | 'panels';
export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  keys?: string;
  /** Commands default to the Design workspace; global commands remain safe elsewhere. */
  scope?: 'design' | 'global';
  /** false hides the command in menus for the current state */
  when?: (st: WorkbenchState, target: BodyId | null) => boolean;
  run: (st: WorkbenchState, target: BodyId | null) => void;
}

const needsBody = (_st: WorkbenchState, t: BodyId | null) => t != null;
const needsSlot = (_st: WorkbenchState, t: BodyId | null) => t != null && t !== 'plate' && t !== 'flange';

export const COMMANDS: Command[] = [
  { id: 'view.home', label: 'Home view', group: 'view', keys: 'F', run: (st) => st.setView('iso') },
  { id: 'view.fit', label: 'Fit to view', group: 'view', run: (st) => st.fit() },
  { id: 'view.top', label: 'Look from top', group: 'view', run: (st) => st.setViewDir([0, 0, 1]) },
  { id: 'view.front', label: 'Look from front', group: 'view', run: (st) => st.setViewDir([0, 1, 0]) },
  { id: 'view.right', label: 'Look from right', group: 'view', run: (st) => st.setViewDir([1, 0, 0]) },
  { id: 'view.orbit', label: 'Orbit (drag mode)', group: 'view', run: (st) => st.patch({ navMode: 'orbit' }) },
  { id: 'view.pan', label: 'Pan (drag mode)', group: 'view', run: (st) => st.patch({ navMode: 'pan' }) },
  { id: 'view.zoom', label: 'Zoom (drag mode)', group: 'view', run: (st) => st.patch({ navMode: 'zoom' }) },
  { id: 'view.shaded', label: 'Visual style · Shaded', group: 'view', run: (st) => st.patch({ visualStyle: 'shaded' }) },
  { id: 'view.edges', label: 'Visual style · Shaded with edges', group: 'view', run: (st) => st.patch({ visualStyle: 'edges' }) },
  { id: 'view.wire', label: 'Visual style · Wireframe', group: 'view', run: (st) => st.patch({ visualStyle: 'wireframe' }) },
  { id: 'view.grid', label: 'Toggle layout grid', group: 'view', run: (st) => st.patch({ grid: !st.grid }) },
  { id: 'view.model', label: 'Model view', group: 'view', run: (st) => { st.closeDialog(); st.patch({ viewMode: 'model' }); } },
  { id: 'view.sheet', label: 'Drawing sheet', group: 'view', run: (st) => { st.closeDialog(); st.patch({ viewMode: 'sheet' }); } },
  { id: 'view.named', label: 'Save named view…', group: 'view', run: (st) => st.openDialog('named_view', null) },
  { id: 'view.sethome', label: 'Set current view as home', group: 'view', run: (st) => st.setHome() },

  { id: 'create.sketch', label: 'Sketch · plate profile & constraints', group: 'create', run: (st) => { st.patch({ sel: 'airframe', selBody: 'plate', selFace: null }); st.openDialog('sketch', 'plate'); } },
  { id: 'create.extrude', label: 'Extrude…', group: 'create', keys: 'E', when: needsBody, run: (st, t) => st.openDialog('extrude', t) },
  { id: 'create.hole', label: 'Hole… (plate)', group: 'create', keys: 'H', run: (st) => st.openDialog('hole', 'plate') },
  { id: 'modify.fillet', label: 'Fillet… (plate corners)', group: 'modify', run: (st) => st.openDialog('fillet', 'plate') },
  { id: 'modify.chamfer', label: 'Chamfer… (plate corners)', group: 'modify', run: (st) => st.openDialog('chamfer', 'plate') },
  { id: 'modify.move', label: 'Move…', group: 'modify', keys: 'M', when: needsSlot, run: (st, t) => st.openDialog('move', t) },

  { id: 'inspect.measure', label: 'Measure…', group: 'inspect', keys: 'I', run: (st) => st.openDialog('measure', null) },
  { id: 'inspect.section', label: 'Section analysis…', group: 'inspect', run: (st) => { st.patch({ section: { ...st.section, on: true } }); st.openDialog('section', null); } },
  { id: 'inspect.properties', label: 'Properties', group: 'inspect', when: needsBody, run: (st, t) => st.openDialog('properties', t) },

  { id: 'select.hide', label: 'Hide', group: 'select', when: needsBody, run: (st, t) => { if (t) st.patch({ hidden: { ...st.hidden, [t]: true } }); } },
  { id: 'select.showall', label: 'Show all · clear isolate', group: 'select', run: (st) => st.patch({ hidden: {}, isolated: null }) },
  { id: 'select.isolate', label: 'Isolate', group: 'select', when: needsBody, run: (st, t) => st.isolate(t) },
  { id: 'select.select', label: 'Select', group: 'select', when: needsBody, run: (st, t) => { if (t) st.select(nodeOfBody(t)); } },
  { id: 'select.component', label: 'Selection filter · Components', group: 'select', run: (st) => st.patch({ selFilter: 'component', selFace: null }) },
  { id: 'select.body', label: 'Selection filter · Bodies', group: 'select', run: (st) => st.patch({ selFilter: 'body', selFace: null }) },
  { id: 'select.face', label: 'Selection filter · Faces', group: 'select', run: (st) => st.patch({ selFilter: 'face' }) },

  { id: 'tab.design', label: 'Design tab', group: 'view', keys: '1', run: (st) => st.setWorkspace('design') },
  { id: 'tab.classification', label: 'Classification tab · parts of concern', group: 'view', keys: '2', run: (st) => st.setWorkspace('classification') },
  { id: 'doc.source', label: 'Sourcing tab · source this design', group: 'document', keys: '3', run: (st) => st.setWorkspace('sourcing') },
  { id: 'doc.door3', label: 'New from description… (Door 3)', group: 'create', run: (st) => st.openDialog('door3', null) },
  { id: 'doc.target', label: 'Design to a target…', group: 'create', run: (st) => { st.openReasoning(); } },
  { id: 'view.board', label: 'Board view · flight controller', group: 'view', run: (st) => { st.closeDialog(); st.patch({ viewMode: 'board' }); } },
  { id: 'doc.version', label: 'Save version…', group: 'document', run: (st) => st.openDialog('save_version', null) },
  { id: 'doc.comment', label: 'Add comment…', group: 'document', run: (st) => st.openDialog('add_comment', null) },
  ...UNITS.map((u) => ({ id: 'doc.units.' + u, label: 'Units · ' + u, group: 'document' as CommandGroup, run: (st: WorkbenchState) => st.setUnits(u) })),
  { id: 'doc.live', label: 'Timeline · back to live', group: 'document', when: (st) => st.viewSeq != null, run: (st) => st.viewAt(null) },
  { id: 'doc.restore', label: 'Timeline · restore this state (supersede)', group: 'document', when: (st) => st.viewSeq != null, run: (st) => st.restoreHere() },

  { id: 'review.tripwire', label: 'Tripwire · review a canonical Candidate 0.1 entity…', group: 'review', keys: 'T', scope: 'global', run: () => useTripwireStore.getState().openPanel() },

  { id: 'panels.timeline', label: 'Timeline drawer', group: 'panels', keys: 'L', run: (st) => st.toggleTimeline() },
  { id: 'panels.reasoning', label: 'Reasoning · why the product reads', group: 'panels', run: (st) => st.openReasoning() },
  { id: 'panels.help', label: 'Keyboard and mouse help', group: 'panels', keys: '?', scope: 'global', run: (st) => st.toggleHelp() },
  { id: 'panels.theme', label: 'Toggle dark theme', group: 'panels', scope: 'global', run: (st) => st.toggleTheme() },
  { id: 'panels.rederive', label: 'Re-derive the log', group: 'panels', run: (st) => { st.rederiveLog(); st.openTimeline(); } },
];

export const commandById = (id: string) => COMMANDS.find((c) => c.id === id);

export const commandAvailable = (command: Command, designMounted: boolean) => command.scope === 'global' || designMounted;

/** The Design viewport is deliberately unmounted in other mission workspaces. */
export function designWorkspaceMounted() {
  return typeof document === 'undefined' || Boolean(document.querySelector('[data-cad-workspace="design"]'));
}

/** Run a command against the live store, tracking recency for the command box. */
export function runCommand(id: string, target?: BodyId | null) {
  const st = useStore.getState();
  const c = commandById(id);
  if (!c) return;
  // Never let a shortcut silently mutate the off-screen Design store.
  if (!commandAvailable(c, designWorkspaceMounted())) return;
  const t = target === undefined ? (st.selBody ?? (st.sel === 'airframe' ? 'plate' : st.sel)) : target;
  if (c.when && !c.when(st, t)) return;
  c.run(st, t);
  useStore.setState((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 6), cmdOpen: false, marking: null }));
}

/** Marking-menu wheel (8) and overflow list, in Fusion's order of frequency. */
export const MARKING_WHEEL = ['select.select', 'modify.move', 'select.hide', 'select.isolate', 'create.extrude', 'inspect.measure', 'inspect.section', 'view.fit'];
export const MARKING_OVERFLOW = ['select.showall', 'inspect.properties', 'create.sketch', 'create.hole', 'modify.fillet', 'modify.chamfer', 'view.named', 'doc.version'];
