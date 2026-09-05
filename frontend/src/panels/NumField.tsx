import { useEffect, useState } from 'react';

interface Props {
  id: string;
  value: number | null | undefined;
  dp: number;
  unit: string;
  min: number;
  max: number;
  nullable?: boolean;
  disabled?: boolean;
  msg?: string;
  onCommit: (text: string | null) => void;
}

/** Numeric field in the spec panel: Enter or blur applies; the range is printed beside it; a cleared nullable field means "not published". */
export function NumField({ id, value, dp, unit, min, max, nullable, disabled, msg, onCommit }: Props) {
  const shown = value == null ? '' : value.toFixed(dp);
  const [text, setText] = useState(shown);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => { if (text.trim() === '' && value == null) return; onCommit(text); };
  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          id={id} inputMode="decimal" value={text} disabled={disabled} placeholder={nullable ? 'not published' : String(min) + '–' + String(max)}
          onChange={(e) => setText(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
          aria-describedby={id + '-msg'}
          className="field w-[120px] font-mono text-[16px] font-semibold disabled:opacity-50"
        />
        <span className="text-[13px] text-muted">{unit ? unit + ' · ' : ''}{min}–{max}{nullable ? ' · clear = not published' : ''}</span>
        {nullable && value != null && !disabled && <button onClick={() => onCommit(null)} className="btn btn-xs">not published</button>}
      </div>
      <div id={id + '-msg'} role="status" className="text-[13px] text-muted min-h-[18px] mt-1">{msg || ''}</div>
    </div>
  );
}
