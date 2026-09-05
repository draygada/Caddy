import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { service } from './lib/service';
import { TopBar } from './panels/TopBar';
import { Browser } from './panels/Browser';
import { Viewport } from './panels/Viewport';
import { StatusPanel } from './panels/StatusPanel';
import { SpecPanel } from './panels/SpecPanel';
import { Reasoning } from './panels/Reasoning';
import { Sourcing } from './panels/Sourcing';
import { Timeline } from './panels/Timeline';
import { HelpOverlay } from './panels/HelpOverlay';
import { DemoBar } from './panels/DemoBar';
import { CommandBox } from './panels/CommandBox';
import { TripwirePanel } from './panels/TripwirePanel';
import { runCommand } from './commands';
import { useTripwireStore } from './tripwire-store';

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
      else if ((e.key === 'ArrowRight' || e.key === ' ') && st.demoBar) { e.preventDefault(); st.advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const theme = useStore((s) => s.theme);
  const parts = useStore((s) => s.parts);
  const attrs = useStore((s) => s.attrs);
  const span = useStore((s) => s.span);
  const demoBar = useStore((s) => s.demoBar);
  const unreachable = useStore((s) => s.serviceState === 'unreachable');
  const reasoningOpen = useStore((s) => s.reasoningOpen);
  const sourcingOpen = useStore((s) => s.sourcingOpen);
  const timelineOpen = useStore((s) => s.timelineOpen);
  const helpOpen = useStore((s) => s.helpOpen);
  const eventCount = useStore((s) => s.events.length);
  const openTimeline = useStore((s) => s.openTimeline);
  const compact = useCompactWorkspace();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('model');
  const o = useMemo(() => service.evaluate({ parts, attrs, span }), [parts, attrs, span]);
  useKeyboard();

  return (
    <div data-theme={theme} className="relative h-full min-w-0 flex flex-col bg-bg text-ink overflow-hidden">
      <TopBar />
      {unreachable && (
        <div role="status" className="flex-none px-4 py-2 border-b border-line2 bg-surface2 text-[14px] flex gap-3 items-center">
          <span className="chip">Cached</span>
          <span>service not reachable · replaying the cached baseline · last outcome 2026-09-05 09:12</span>
        </div>
      )}
      {!compact ? (
        <div className="flex-1 min-h-0 grid grid-cols-[340px_minmax(0,1fr)_400px_32px] gap-2 pt-2 pb-2 pl-2">
          <Browser />
          <div className="flex flex-col gap-2 min-h-0 min-w-0">
            <Viewport o={o} />
          </div>
          <div className="flex flex-col gap-2 min-h-0">
            <StatusPanel o={o} />
            <SpecPanel o={o} />
          </div>
          <button
            onClick={openTimeline}
            aria-label="Open timeline"
            className="w-8 min-h-full bg-surface border border-line2 border-r-0 rounded-l-r text-ink cursor-pointer text-[13px] font-semibold tracking-[.04em] py-3 hover:bg-hover"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Timeline · {eventCount} events
          </button>
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
            {([
              ['browser', 'Browser'], ['model', 'Model'], ['status', 'Status'], ['spec', 'Spec'],
            ] as const).map(([id, label]) => (
              <button key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id)} className="min-h-12 border-0 border-r border-line2 bg-transparent text-[12px] font-semibold text-ink aria-pressed:bg-accent aria-pressed:text-accentfg">{label}</button>
            ))}
            <button aria-label="Open timeline" onClick={openTimeline} className="min-h-12 border-0 bg-transparent text-[12px] font-semibold text-ink">History</button>
          </nav>
        </div>
      )}
      {reasoningOpen && <Reasoning o={o} />}
      {sourcingOpen && <Sourcing o={o} />}
      {timelineOpen && <Timeline />}
      {helpOpen && <HelpOverlay />}
      <CommandBox />
      <TripwirePanel />
      {demoBar && <DemoBar />}
    </div>
  );
}
