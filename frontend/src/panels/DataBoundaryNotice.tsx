import { useState, type ReactNode } from 'react';
import {
  assessDataBoundary,
  DATA_BOUNDARY_POLICY,
  DATA_CLASS_OPTIONS,
} from '../lib/data-boundary';

type DataBoundaryNoticeProps = {
  children: ReactNode;
};

export function DataBoundaryNotice({ children }: DataBoundaryNoticeProps) {
  const [selection, setSelection] = useState('');
  const decision = assessDataBoundary(selection);

  return (
    <div className="h-full min-w-0 flex flex-col bg-bg text-ink">
      <section
        aria-labelledby="data-boundary-title"
        className="flex-none border-b border-line2 bg-surface2 px-4 py-2"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-[260px] flex-1">
            <h1 id="data-boundary-title" className="text-[13px] font-semibold tracking-[.04em]">
              Hackathon data boundary: PUBLIC or SYNTHETIC only
            </h1>
            <p className="mt-1 text-[12px] text-muted">
              No authentication or GovCloud assurance. This selection gate does not scan content or claim regulated compliance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="deployment-data-class" className="text-[12px] font-semibold">
              Declared data class
            </label>
            <select
              id="deployment-data-class"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              aria-describedby="data-boundary-decision"
              className="min-h-9 rounded-r border border-line2 bg-surface px-3 text-[12px] text-ink"
            >
              <option value="">Select data class</option>
              {DATA_CLASS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p
          id="data-boundary-decision"
          role={decision.allowed ? 'status' : 'alert'}
          aria-live="polite"
          className="mt-2 text-[12px] font-semibold"
        >
          {decision.reason}
        </p>
      </section>

      {decision.allowed ? (
        <div className="min-h-0 flex-1" data-data-boundary={decision.classification}>
          {children}
        </div>
      ) : (
        <main className="flex-1 grid place-items-center bg-bg p-6">
          <div className="max-w-2xl rounded-r border border-line2 bg-surface p-6">
            <p className="text-[16px] font-semibold">Application access blocked</p>
            <p className="mt-2 text-[13px] text-muted">{decision.reason}</p>
            <p className="mt-4 text-[12px] text-muted">
              Permitted classes: {DATA_BOUNDARY_POLICY.allowedDataClasses.join(' or ')}. Do not enter CUI, ITAR-controlled technical data, export-controlled customer designs, secrets, or credentials.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
