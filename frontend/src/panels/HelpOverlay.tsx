import { useStore } from '../store';
import { SHORTCUTS } from '../lib/catalog';

export function HelpOverlay() {
  const closeAll = useStore((s) => s.closeAll);
  const shortcuts = SHORTCUTS.some((shortcut) => shortcut.key.toLowerCase() === 't')
    ? SHORTCUTS
    : [...SHORTCUTS, { key: 'T', what: 'Open the live canonical Tripwire proof' }];
  return (
    <div onClick={closeAll} className="absolute inset-0 bg-scrim z-[7] flex items-center justify-center">
      <div role="dialog" aria-label="Keyboard and mouse" onClick={(e) => e.stopPropagation()} className="w-[min(460px,calc(100%-16px))] max-h-[calc(100%-16px)] overflow-auto bg-surface border border-line rounded-r px-[18px] py-4 grid gap-[10px] shadow-[0_12px_32px_rgba(0,0,0,.2)]">
        <div className="flex justify-between items-center">
          <div className="font-semibold">Keyboard and mouse</div>
          <button onClick={closeAll} className="btn">Close · Esc</button>
        </div>
        {shortcuts.map((k) => (
          <div key={k.key} className="grid grid-cols-[120px_1fr] gap-3 items-center text-[14px]">
            <span className="font-mono text-[13px] px-2 py-[3px] border border-line border-b-2 rounded-r text-center">{k.key}</span>
            <span>{k.what}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
