// THE SEAM, browser side. The service facade (backend/app/service.py) owns
// apply_change / rederive / now; the browser posts changes and renders the
// outcome. Until the backend is reachable this module answers locally from
// the synthetic rule table so the shell is usable, and reports `cached`.
import { outcome, type Design, type Outcome } from './rules';

export type ServiceState = 'cached' | 'unreachable';

export interface EvaluateResult { outcome: Outcome; mode: ServiceState }

export const service = {
  /** Synchronous today so the outcome renders in the same frame (Doherty: no spinner). */
  evaluate(d: Design): Outcome {
    return outcome(d);
  },
  /** Placeholder for GET /api/now; the store reads `serviceState` from the URL until this is wired. */
  async now(): Promise<{ mode: ServiceState }> {
    return { mode: 'cached' };
  },
};
