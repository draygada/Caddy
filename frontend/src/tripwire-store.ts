import { create } from 'zustand';
import {
  listStableTargets,
  loadCandidate,
  publicTripwireError,
  runTripwire,
  type CandidatePayload,
  type StableTripwireTarget,
  type ValidatedTripwireResult,
} from './lib/tripwire';

export type TripwirePhase = 'idle' | 'loading' | 'ready' | 'running' | 'bound' | 'blocked' | 'error';

interface TripwireState {
  open: boolean;
  phase: TripwirePhase;
  candidate: CandidatePayload | null;
  targets: StableTripwireTarget[];
  selectedEntityId: string | null;
  result: ValidatedTripwireResult | null;
  error: { code: string; message: string } | null;
  openPanel: () => void;
  closePanel: () => void;
  load: () => Promise<void>;
  selectEntity: (entityId: string) => void;
  review: () => Promise<void>;
}

export const useTripwireStore = create<TripwireState>((set, get) => ({
  open: false,
  phase: 'idle',
  candidate: null,
  targets: [],
  selectedEntityId: null,
  result: null,
  error: null,
  openPanel: () => {
    set({ open: true });
    if (!get().candidate && get().phase !== 'loading') void get().load();
  },
  closePanel: () => set({ open: false }),
  load: async () => {
    set({ phase: 'loading', candidate: null, targets: [], selectedEntityId: null, result: null, error: null });
    try {
      const candidate = await loadCandidate();
      set({ candidate, targets: listStableTargets(candidate), phase: 'ready' });
    } catch (error) {
      set({ phase: 'error', error: publicTripwireError(error) });
    }
  },
  selectEntity: (selectedEntityId) => set({ selectedEntityId, result: null, error: null, phase: 'ready' }),
  review: async () => {
    const { candidate, selectedEntityId } = get();
    if (!candidate || !selectedEntityId) {
      set({ phase: 'error', error: publicTripwireError(new Error('SELECTION_REQUIRED')) });
      return;
    }
    set({ phase: 'running', result: null, error: null });
    try {
      const result = await runTripwire(candidate, selectedEntityId);
      set({ result, phase: result.displayState === 'BOUND' ? 'bound' : 'blocked' });
    } catch (error) {
      set({ phase: 'error', error: publicTripwireError(error) });
    }
  },
}));
