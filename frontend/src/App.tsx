import { useEffect, useMemo, useState } from 'react';
import { useStore, intakeIncomplete, type WorkspaceId } from './store';
import { service } from './lib/service';
import { TopBar } from './panels/TopBar';
import { Browser } from './panels/Browser';
import { Viewport } from './panels/Viewport';
import { StatusPanel } from './panels/StatusPanel';
import { SpecPanel } from './panels/SpecPanel';
import { Sourcing } from './panels/Sourcing';
import { Timeline } from './panels/Timeline';
import { HelpOverlay } from './panels/HelpOverlay';
import { DemoBar } from './panels/DemoBar';
import { CommandBox } from './panels/CommandBox';
import { TripwirePanel } from './panels/TripwirePanel';
import { ClassificationTab } from './panels/ClassificationTab';
import { ProjectsHome } from './panels/ProjectsHome';
import { IntakeDialog, NeedsInfoBanner } from './panels/IntakeDialog';
import { runCommand } from './commands';
import { overallOf } from './lib/viewmodel';
import { useTripwireStore } from './tripwire-store';
import { DataBoundaryNotice } from './panels/DataBoundaryNotice';

type MobilePanel = 'browser' | 'model' | 'status' | 'spec';

function useCompactWorkspace() {
  const [compact, setCompact] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return compact;
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const tripwire = useTripwireStore.getState();
      const tag = ((e.target as HTMLElement | null)?.tagName || '').toLowerCase();
      if (e.key === 'Escape') {
        if (tripwire.open) tripwire.closePanel();
        else st.closeAll();
        return;
      }
      // ⌘K / Ctrl+K opens the command search from anywhere, like the original workbench
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); st.patch({ cmdOpen: !st.cmdOpen, marking: null }); return; }
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === '?') st.toggleHelp();
      else if (k === 's') { e.preventDefault(); st.patch({ cmdOpen: !st.cmdOpen, marking: null }); }
      else if (k === 'l') st.toggleTimeline();
      else if (k === 'f') st.setView('iso');
      else if (k === 'e') runCommand('create.extrude');
      else if (k === 'm') runCommand('modify.move');
      else if (k === 'h') runCommand('create.hole');
      else if (k === 'i') runCommand('inspect.measure');
      else if (k === 't') runCommand('review.tripwire');
      else if (k === '1') st.setWorkspace('design');
      else if (k === '2') st.setWorkspace('classification');
      else if (k === '3') st.setWorkspace('sourcing');
      else if ((e.key === 'ArrowRight' || e.key === ' ') && st.demoBar) { e.preventDefault(); st.advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function StrafeApplication() {
  const theme = useStore((s) => s.theme);
  const parts = useStore((s) => s.parts);
  const attrs = useStore((s) => s.attrs);
  const span = useStore((s) => s.span);
  const demoBar = useStore((s) => s.demoBar);
  const unreachable = useStore((s) => s.serviceState === 'unreachable');
  const sourcingOpen = useStore((s) => s.sourcingOpen);
  const declared = useStore((s) => s.declared);
  const pack = useStore((s) => s.pack);
  const timelineOpen = useStore((s) => s.timelineOpen);
  const helpOpen = useStore((s) => s.helpOpen);
  const openTimeline = useStore((s) => s.openTimeline);
  const workspace = useStore((s) => s.workspace);
  const setWorkspace = useStore((s) => s.setWorkspace);
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const compact = useCompactWorkspace();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('model');
  const [statusOpen, setStatusOpen] = useState(false);
  useEffect(() => {
    if (!statusOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStatusOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [statusOpen]);
  const o = useMemo(() => service.evaluate({ parts, attrs, span, declared }, pack), [parts, attrs, span, declared, pack]);
  useKeyboard();
  const overall = overallOf(o);
  const placed = Object.values(parts).filter(Boolean).length;
  const incomplete = intakeIncomplete(project?.intake ?? null);
  // always on top of the model, bottom right: the word and the part count; click to see the parts behind it
  const statusCard = statusOpen ? (
    <div role="dialog" aria-label="Product status" className="absolute right-3 bottom-3 z-[21] w-[min(92%,380px)] max-h-[70%] flex flex-col shadow-[0_8px_28px_rgba(20,24,31,.18)] [&>*]:min-h-0 [&>*]:overflow-auto">
      <StatusPanel o={o} onClose={() => setStatusOpen(false)} />
    </div>
  ) : (
    <button onClick={() => setStatusOpen(true)} aria-haspopup="dialog" aria-expanded={false} title="product status · click to see the parts behind it"
      className="panel absolute right-3 bottom-3 z-[21] flex items-center gap-3 px-3 min-h-10 cursor-pointer text-left shadow-[0_8px_28px_rgba(20,24,31,.18)]">
      <span className="status-word text-[13px]" style={incomplete ? { color: 'var(--amber)' } : { color: overall.color, background: overall.bg }}>{incomplete ? '? Requires more information' : overall.glyph + ' ' + overall.word}</span>
      <span className="text-[12px] text-muted whitespace-nowrap">{placed} part{placed === 1 ? '' : 's'}</span>
    </button>
  );

  const active: WorkspaceId = sourcingOpen ? 'sourcing' : workspace;
  if (!project) return <div data-theme={theme} className="h-full min-w-0 bg-bg text-ink">
    <ProjectsHome />
  </div>;
  const goHome = () => { useStore.getState().closeAll(); useTripwireStore.getState().closePanel(); setWorkspace('design'); };

  const designSurface = !compact ? (
    <div className="flex-1 min-h-0 grid grid-cols-[340px_minmax(0,1fr)] gap-2 p-2">
      <Browser />
      <div className="flex flex-col gap-2 min-h-0 min-w-0">
        <div className="relative flex-1 min-h-0 flex flex-col">
          <Viewport o={o} />
          {statusCard}
        </div>
        {sel && <div className="flex-none"><SpecPanel o={o} /></div>}
      </div>
    </div>
  ) : (
    <div className="flex-1 min-h-0 flex flex-col bg-bg">
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {mobilePanel === 'browser' && <div className="h-full flex flex-col"><Browser /></div>}
        {mobilePanel === 'model' && <div className="h-full min-h-[480px] flex flex-col"><Viewport o={o} /></div>}
        {mobilePanel === 'status' && <StatusPanel o={o} />}
        {mobilePanel === 'spec' && <SpecPanel o={o} />}
      </div>
      <nav aria-label="Mobile workspace" className="flex-none grid grid-cols-5 border-t border-line2 bg-surface pb-[env(safe-area-inset-bottom)]">
        {([['browser', 'Browser'], ['model', 'Model'], ['status', 'Status'], ['spec', 'Spec']] as const).map(([id, label]) => (
          <button key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)} className="min-h-12 border-0 border-r border-line2 bg-transparent text-[12px] font-semibold text-ink aria-pressed:bg-accent aria-pressed:text-accentfg">{label}</button>
        ))}
        <button aria-label="Open timeline" onClick={openTimeline} className="min-h-12 border-0 bg-transparent text-[12px] font-semibold text-ink">History</button>
      </nav>
    </div>
  );

  const surface = active === 'classification' ? <ClassificationTab o={o} />
    : active === 'sourcing' ? <div className="relative flex-1 min-h-0"><Sourcing o={o} embedded /></div>
    : designSurface;

  return (
    <div data-theme={theme} className="relative h-full min-w-0 flex flex-col bg-bg text-ink overflow-hidden">
      <TopBar onHome={goHome} active={active} onSelect={setWorkspace} />
      {unreachable && (
        <div role="status" className="flex-none px-4 py-2 border-b border-line2 bg-surface2 text-[14px] flex gap-3 items-center">
          <span className="chip">Cached</span>
          <span>service not reachable · replaying the cached baseline · last outcome 2026-09-05 09:12</span>
        </div>
      )}
      {active !== 'sourcing' && <NeedsInfoBanner compact />}
      {surface}
      <IntakeDialog />
      {timelineOpen && <Timeline />}
      {helpOpen && <HelpOverlay />}
      <CommandBox />
      <TripwirePanel />
      {demoBar && <DemoBar />}
    </div>
  );
}

// Benji's hackathon data boundary: the shell only opens once the operator declares PUBLIC or SYNTHETIC data.
export default function App() {
  return (
    <DataBoundaryNotice>
      <StrafeApplication />
    </DataBoundaryNotice>
  );
}
