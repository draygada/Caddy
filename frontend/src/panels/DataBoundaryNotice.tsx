import { useState, type ReactNode } from 'react';
import {
  assessDataBoundary,
  DATA_BOUNDARY_POLICY,
  DATA_CLASS_OPTIONS,
} from '../lib/data-boundary';

type DataBoundaryNoticeProps = {
  children: ReactNode;
};

// The declaration is remembered for this browser tab only, so a reload while iterating does not re-block;
// a fresh tab fails closed again, which is the policy.
const STORAGE_KEY = 'caddy.data-class';
const readDeclared = () => { try { return sessionStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; } };
const writeDeclared = (value: string) => { try { sessionStorage.setItem(STORAGE_KEY, value); } catch { /* storage unavailable: the gate simply asks again */ } };

/** Benji's hackathon data boundary. Fails closed until the operator declares PUBLIC or SYNTHETIC data. */
export function DataBoundaryNotice({ children }: DataBoundaryNoticeProps) {
  const [selection, setSelection] = useState(readDeclared);
  const decision = assessDataBoundary(selection);
  const declare = (value: string) => { setSelection(value); writeDeclared(value); };

  return (
    <div className="h-full min-w-0 flex flex-col bg-bg text-ink">
      {decision.allowed ? (
        <div className="min-h-0 flex-1 flex flex-col" data-data-boundary={decision.classification}>
          {children}
        </div>
      ) : (
        <main className="flex-1 grid place-items-center p-6">
          <section aria-labelledby="data-boundary-title" className="panel w-[min(100%,520px)]">
            <div className="panel-head"><div id="data-boundary-title" className="panel-title">Hackathon data boundary: PUBLIC or SYNTHETIC only</div></div>
            <div className="p-4 grid gap-3 text-[13px]">
              <p className="m-0 text-muted">
                No authentication or GovCloud assurance. This selection gate does not scan content or claim regulated compliance.
              </p>
              <div className="grid gap-1">
                <label htmlFor="deployment-data-class" className="text-[12px] text-muted">Declared data class</label>
                <select
                  id="deployment-data-class"
                  value={selection}
                  onChange={(event) => declare(event.target.value)}
                  aria-describedby="data-boundary-decision"
                  className="field text-ink"
                >
                  <option value="">Choose a data class</option>
                  {DATA_CLASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <p id="data-boundary-decision" role={selection ? 'alert' : 'status'} aria-live="polite" className={'m-0 font-semibold ' + (selection ? 'text-red' : 'text-muted')}>
                {decision.reason}
              </p>
              <p className="m-0 text-[12px] text-muted">
                Permitted classes: {DATA_BOUNDARY_POLICY.allowedDataClasses.join(' or ')}. Do not enter CUI, ITAR-controlled technical data, export-controlled customer designs, secrets, or credentials.
              </p>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
