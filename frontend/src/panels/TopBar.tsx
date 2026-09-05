import { useStore } from '../store';
import { ECFR_DATE } from '../lib/catalog';
import { useTripwireStore } from '../tripwire-store';

export function TopBar() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const patch = useStore((s) => s.patch);
  const openTripwire = useTripwireStore((s) => s.openPanel);
  const closeTripwire = useTripwireStore((s) => s.closePanel);
  return (
    <div className="h-12 flex-none flex items-center gap-2 px-2 sm:gap-4 sm:pl-4 sm:pr-3 border-b border-line2 bg-surface">
      <button onClick={() => { patch({ sel: null, timelineOpen: false, helpOpen: false }); closeTripwire(); }} title="Return to baseline" className="flex items-center gap-[10px] bg-transparent border-0 p-0 text-ink cursor-pointer min-h-6">
        <img src="/logo.png" alt="" width={24} height={24} className="block w-6 h-6 rounded-[5px]" />
        <span className="font-bold tracking-[.01em]">Caddy</span>
      </button>
      <span className="hidden sm:inline text-muted text-[13px]">Kestrel</span>
      <div className="flex-1" />
      <div className="hidden xl:flex gap-[6px] items-center">
        <span className="chip">Synthetic rules · eCFR {ECFR_DATE}</span>
        <span className="chip">Design preview</span>
      </div>
      <div className="hidden sm:block w-px h-5 bg-line2" />
      <div className="flex gap-[6px]">
        <button onClick={openTripwire} className="btn btn-primary">Tripwire</button>
        <button onClick={toggleTheme} className="btn">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
        <button onClick={toggleHelp} aria-label="Keyboard and mouse help" className="btn btn-icon">?</button>
      </div>
    </div>
  );
}
