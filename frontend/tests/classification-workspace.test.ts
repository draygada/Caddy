import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_SCENARIOS,
  getWorkspaceScenario,
  reconcileCandidate,
  runClassificationWorkspace,
  type CandidateInput,
} from '../src/lib/classification-workspace';

describe('classification workspace', () => {
  it('holds at an open USML step and makes every CCL stage not reached', () => {
    const result = runClassificationWorkspace(getWorkspaceScenario('open-evidence'));
    expect(result.route).toBe('UNDETERMINED');
    expect(result.claimCeiling).toBe('UNDETERMINED_NO_CLEARANCE');
    expect(result.readiness).toBe('HOLD_MISSING_EVIDENCE');
    expect(result.questions[0]).toMatchObject({ rank: 1, impact: 'route-blocking' });
    expect(result.stages.filter((stage) => ['six_hundred_series', 'specially_designed_ear', 'other_ccl', 'residual'].includes(stage.stage)).every((stage) => stage.state === 'not_reached')).toBe(true);
    expect(result.candidates.filter((candidate) => candidate.stage === 'other_ccl').every((candidate) => candidate.disposition === 'not_reached')).toBe(true);
  });

  it('elects EAR99 only after every specific candidate closes negative', () => {
    const result = runClassificationWorkspace(getWorkspaceScenario('commercial-record'));
    expect(result.route).toBe('EAR99');
    expect(result.classification).toEqual(['EAR99']);
    expect(result.routeDisposition).toBe('residual');
    expect(result.questions).toEqual([]);
    expect(result.readiness).toBe('READY_FOR_COUNSEL_REVIEW');
    expect(result.claimCeiling).toBe('DRAFT_REVIEW_ONLY');
    expect(result.candidates.filter((candidate) => candidate.stage !== 'residual').every((candidate) => candidate.disposition === 'knocked_out')).toBe(true);
  });

  it('stops at a supported USML candidate and never evaluates the CCL', () => {
    const result = runClassificationWorkspace(getWorkspaceScenario('military-record'));
    expect(result.route).toBe('ITAR');
    expect(result.classification).toContain('USML XI(c)(2)');
    expect(result.stages.find((stage) => stage.stage === 'six_hundred_series')?.state).toBe('not_reached');
    expect(result.candidates.find((candidate) => candidate.provision === '3A611.g')?.disposition).toBe('not_reached');
  });

  it('refuses to knock out a provision on an uncited failed element', () => {
    const candidate: CandidateInput = {
      candidateId: 'test',
      provision: 'USML XI(c)(2)',
      stage: 'usml_enumerated',
      whyConsidered: 'test fixture',
      advocate: [],
      judge: [{
        elementId: 'el-1',
        label: 'element',
        disposition: 'not_met',
        basis: 'stated',
        factPaths: ['fact.one'],
        citation: null,
        note: 'No citation is attached.',
      }],
      challenge: null,
    };
    const reconciled = reconcileCandidate(candidate);
    expect(reconciled.disposition).toBe('undetermined');
    expect(reconciled.reconciliationNotes).toContain('An uncited failed element cannot knock out a candidate.');
  });

  it('keeps the legal and coverage ceiling explicit for every scenario', () => {
    for (const scenario of WORKSPACE_SCENARIOS) {
      const result = runClassificationWorkspace(scenario);
      expect(result.claimClass).toBe('JURISDICTION_SCREENING_SIMULATION');
      expect(result.exclusions.join(' ')).toContain('No legal determination');
      expect(result.exclusions.join(' ')).toContain('Parts 744 or 746');
      expect(result.coverage).toEqual(['USML_ORDER_OF_REVIEW', 'CCL_JURISDICTION_ROUTE']);
    }
  });
});
