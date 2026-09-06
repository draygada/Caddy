import { describe, expect, it } from 'vitest';
import { PROGRESS_ATLAS, calculateProgress, countsAsCandidateComplete, orderedNextSteps, type ProgressCapability } from '../src/data/progress-atlas';

describe('Candidate 0.1 progress atlas', () => {
  it('derives its numerator and denominator only from manifest rows', () => {
    const progress = calculateProgress();
    expect(progress.denominator).toBe(PROGRESS_ATLAS.capabilities.length);
    expect(progress.numerator).toBe(PROGRESS_ATLAS.capabilities.filter(countsAsCandidateComplete).length);
    expect(progress).toMatchObject({ numerator: 9, denominator: 17, percent: 53 });

    const oneMoreUnavailable: ProgressCapability = {
      id: 'proof-only-gap',
      name: 'Proof-only gap',
      lane: 'platform',
      status: 'unavailable',
      summary: 'Test row.',
      boundary: 'Not implemented.',
      evidence: [{ label: 'Test', path: 'frontend/tests/progress-atlas.test.ts' }],
    };
    const expanded = calculateProgress([...PROGRESS_ATLAS.capabilities, oneMoreUnavailable]);
    expect(expanded.numerator).toBe(progress.numerator);
    expect(expanded.denominator).toBe(progress.denominator + 1);
  });

  it('never counts an unavailable capability as complete', () => {
    const unavailable = PROGRESS_ATLAS.capabilities.filter((capability) => capability.status === 'unavailable');
    expect(unavailable).toHaveLength(8);
    expect(unavailable.every((capability) => countsAsCandidateComplete(capability) === false)).toBe(true);

    const removedSurface = PROGRESS_ATLAS.capabilities.map((capability) => capability.id === 'engineering-atlas' ? { ...capability, status: 'unavailable' as const } : capability);
    expect(calculateProgress(removedSurface).numerator).toBe(calculateProgress().numerator - 1);
  });

  it('keeps the delivery boundaries and the dependency chain explicit', () => {
    expect(PROGRESS_ATLAS.capabilities.filter((capability) => capability.status === 'fixture_backed')).toHaveLength(5);
    expect(PROGRESS_ATLAS.capabilities.filter((capability) => capability.status === 'local_memory')).toHaveLength(2);
    expect(PROGRESS_ATLAS.capabilities.find((capability) => capability.id === 'classification-tab')?.boundary).toContain('not a legal determination');
    expect(PROGRESS_ATLAS.capabilities.find((capability) => capability.id === 'sourcing')?.boundary).toContain('2-key CSL slice');

    const steps = orderedNextSteps();
    const seen = new Set<string>();
    for (const step of steps) {
      expect(step.prerequisites.every((dependency) => seen.has(dependency))).toBe(true);
      expect(step.unlocks.length).toBeGreaterThan(20);
      seen.add(step.id);
    }
  });
});
