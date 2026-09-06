import { describe, expect, it } from 'vitest';
import {
  TRIPWIRE_ATLAS,
  assertTripwireAtlas,
  createAtlasSession,
  getAtlasScenario,
  getScenarioTripwires,
  getTripwireEvidence,
  markAtlasUnavailable,
  receiveAtlasEvaluation,
  startAtlasEvaluation,
} from '../src/lib/tripwire-atlas';

describe('Tripwire Atlas immutable frontend projection', () => {
  it('pins the unified FB-03 source commit, tree and source-bundle digest', () => {
    expect(assertTripwireAtlas()).toBe(true);
    expect(TRIPWIRE_ATLAS.provenance).toMatchObject({
      candidateCommit: '1ecd99f5241a53cffcf6d939928533766e331cc4',
      tripwireTree: '773c868372f8c88cdddfb6b1bb7d3ba82d55b73b',
      fb03SourceCommit: '05cb545e3fca7e0df0084e6f1e624e777d701457',
      fb03SourceTree: '987bda5616ca93b1039d2f01bb8d687e82446aa9',
      sourceBundleSha256: 'ea848433e31d8304ae2131f03ece5f7b8e522a5130c4249371cddb94e4056c92',
    });
  });

  it('exposes direct camera results separately from parent propagation', () => {
    const tripwires = getScenarioTripwires(getAtlasScenario('f3'));
    expect(tripwires.filter((item) => item.kind === 'direct').map((item) => item.ruleId)).toEqual(expect.arrayContaining(['CCL-6A003.b.4.b', 'CCL-6A003.b.4.b-RS1']));
    expect(tripwires.find((item) => item.kind === 'propagated')).toMatchObject({
      ruleId: 'CCL-9A012.a.3',
      causeNodeId: 'nose_thermal',
      targetNodeId: 'kestrel',
      path: ['nose_thermal', 'sensor_pod', 'kestrel'],
    });
  });

  it('preserves active markers across the F8 zero-change revision', () => {
    const f3 = getAtlasScenario('f3');
    const f8 = getAtlasScenario('f8');
    expect(f8.designRevision).toBe(f3.designRevision);
    expect(f8.tripwireIds).toEqual(f3.tripwireIds);
    expect(f8.delta).toEqual({ changedNodeIds: [], added: [], removed: [] });
  });

  it('renders absent IMU evidence as cannot-evaluate and never clear', () => {
    const [tripwire] = getScenarioTripwires(getAtlasScenario('missing'));
    expect(tripwire).toMatchObject({ state: 'cannot_evaluate', kind: 'unresolved', missingFact: 'gyro_bias_stability_1mo_deg_h' });
    expect(tripwire.facts.find((fact) => fact.label === 'One-month bias stability')?.observed).toBeNull();
  });

  it('retains last-confirmed state through pending and unavailable responses', () => {
    const initial = createAtlasSession('f3');
    const pending = startAtlasEvaluation(initial, 'f8');
    const unavailable = markAtlasUnavailable(pending);
    expect(pending.lastConfirmedScenarioId).toBe('f3');
    expect(unavailable.lastConfirmedScenarioId).toBe('f3');
    expect(unavailable.mode).toBe('unavailable');
  });

  it('ignores late responses and blocks mismatched current responses', () => {
    const pending = startAtlasEvaluation(createAtlasSession('f3'), 'f8');
    const late = receiveAtlasEvaluation(pending, 'f3', pending.latestRequestId - 1);
    expect(late.lastConfirmedScenarioId).toBe('f3');
    expect(late.ignoredRequestIds).toContain(pending.latestRequestId - 1);
    const mismatch = receiveAtlasEvaluation(pending, 'baseline', pending.latestRequestId);
    expect(mismatch.mode).toBe('contract_error');
  });

  it('makes source jumps resolvable while holding the legal claim ceiling', () => {
    for (const scenario of TRIPWIRE_ATLAS.scenarios) {
      expect(scenario.humanReviewRequired).toBe(true);
      expect(scenario.legalEffect).toBe('NONE');
      for (const tripwire of getScenarioTripwires(scenario)) {
        for (const source of getTripwireEvidence(tripwire)) {
          expect(source.repositoryUrl).toContain(TRIPWIRE_ATLAS.provenance.candidateCommit);
          expect(source.canonicalUrl).toMatch(/^https:\/\//);
          expect(source.legalRelevance).toBe('UNVERIFIED');
        }
      }
    }
    expect(TRIPWIRE_ATLAS.posture).toMatchObject({ humanReviewRequirement: 'REQUIRED', destinationStatus: 'NOT_EVALUATED', legalEffect: 'NONE' });
  });
});
