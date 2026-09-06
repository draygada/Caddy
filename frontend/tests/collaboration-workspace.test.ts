import { describe, expect, it } from 'vitest';
import {
  BROWSER_AGENT,
  CollaborationWorkspaceError,
  CollaborationWorkspaceModel,
  HUMAN_OPERATOR,
  MERGE_SERVICE,
  assessChangeFootprints,
  getPageSessionCollaborationWorkspace,
  replayCollaboration,
  type CollaborationEvent,
} from '../src/lib/collaboration-workspace';

const timestamps = [
  '2026-09-05T18:00:00Z',
  '2026-09-05T18:00:01Z',
  '2026-09-05T18:00:02Z',
  '2026-09-05T18:00:03Z',
  '2026-09-05T18:00:04Z',
  '2026-09-05T18:00:05Z',
  '2026-09-05T18:00:06Z',
  '2026-09-05T18:00:07Z',
  '2026-09-05T18:00:08Z',
  '2026-09-05T18:00:09Z',
];

function fixture() {
  let index = 0;
  const workspace = new CollaborationWorkspaceModel([], () => timestamps[index++] ?? '2026-09-05T18:01:00Z');
  workspace.createBranch({ branch: 'main', revisionId: 'rev:main', actor: HUMAN_OPERATOR });
  workspace.createBranch({ branch: 'feature/a', fromBranch: 'main', revisionId: 'rev:main', actor: HUMAN_OPERATOR });
  workspace.commitRevision({
    branch: 'feature/a',
    expectedHeadRevisionId: 'rev:main',
    revisionId: 'rev:feature-a',
    summary: 'Move motor mount',
    footprint: { reads: ['definition:airframe'], writes: ['component:motor'], impacts: ['operation:solve'] },
    replayFingerprint: 'fp:geometry-a',
    actor: BROWSER_AGENT,
  });
  workspace.requestReview({
    reviewId: 'review:a',
    title: 'Motor mount update',
    sourceBranch: 'feature/a',
    targetBranch: 'main',
    replayFingerprints: ['fp:geometry-a', 'fp:geometry-a'],
    actor: BROWSER_AGENT,
  });
  workspace.requestAuthorization({ authorizationId: 'auth:a', reviewId: 'review:a', actor: BROWSER_AGENT });
  return workspace;
}

describe('collaboration workspace event graph', () => {
  it('is append-only, hash chained, and deterministically replayed', () => {
    const workspace = fixture();
    const events = workspace.events;
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4]);
    expect(events[0].previousEventHash).toBeNull();
    expect(events[4].previousEventHash).toBe(events[3].eventHash);
    expect(new CollaborationWorkspaceModel(events).project()).toEqual(workspace.project());
    expect(replayCollaboration(events)).toEqual(replayCollaboration(events));

    const tampered = structuredClone(events) as CollaborationEvent[];
    tampered[2].payload.summary = 'silently altered';
    expect(() => replayCollaboration(tampered)).toThrowError(/HASH_MISMATCH/);
  });

  it('keeps agent decisions advisory and rejects a second binding terminal decision without appending', () => {
    const workspace = fixture();
    workspace.recordReview({ reviewId: 'review:a', decision: 'APPROVE', actor: BROWSER_AGENT });
    expect(workspace.project().reviews['review:a'].bindingDecision).toBeNull();
    workspace.recordReview({ reviewId: 'review:a', decision: 'APPROVE', actor: HUMAN_OPERATOR });
    const countAtDecision = workspace.events.length;
    expect(workspace.project().reviews['review:a'].bindingDecision).toBe('APPROVE');
    expect(() => workspace.recordReview({ reviewId: 'review:a', decision: 'REJECT', actor: HUMAN_OPERATOR }))
      .toThrowError(/REVIEW_TERMINAL/);
    expect(workspace.events).toHaveLength(countAtDecision);
  });

  it('requires explicit human authorization and atomically advances merge plus authorization receipts', () => {
    const workspace = fixture();
    workspace.recordReview({ reviewId: 'review:a', decision: 'APPROVE', actor: HUMAN_OPERATOR });
    expect(() => workspace.transitionAuthorization({ authorizationId: 'auth:a', status: 'AUTHORIZED', actor: BROWSER_AGENT }))
      .toThrowError(/HUMAN_AUTHORIZATION_REQUIRED/);
    workspace.transitionAuthorization({ authorizationId: 'auth:a', status: 'AUTHORIZED', actor: HUMAN_OPERATOR });
    expect(workspace.mergeEligibility('review:a', 'auth:a')).toEqual({
      state: 'ELIGIBLE',
      eligible: true,
      reasons: [],
      mergedRevisionId: null,
    });
    const before = workspace.events.length;
    const merge = workspace.merge({
      mergeId: 'merge:a',
      reviewId: 'review:a',
      authorizationId: 'auth:a',
      actor: MERGE_SERVICE,
      evidenceRefs: ['test:deterministic-replay', 'test:human-review'],
    });
    const projection = workspace.project();
    expect(workspace.events).toHaveLength(before + 2);
    expect(projection.branches.main.headRevisionId).toBe(merge.payload.revisionId);
    expect(projection.authorizations['auth:a'].status).toBe('APPLIED');
    expect(projection.reviews['review:a'].mergedRevisionId).toBe(merge.payload.revisionId);
    expect(workspace.auditEvidence().at(-1)?.summary).toContain('APPLIED');

    const terminal = workspace.mergeEligibility('review:a', 'auth:a');
    expect(terminal).toEqual({
      state: 'MERGED',
      eligible: false,
      reasons: [],
      mergedRevisionId: merge.payload.revisionId,
    });
    expect(terminal.reasons).not.toContain('AUTHORIZATION_NOT_GRANTED');
    expect(terminal.reasons).not.toContain('STALE_TARGET');
    expect(new CollaborationWorkspaceModel(workspace.events).mergeEligibility('review:a', 'auth:a')).toEqual(terminal);

    const countAtMerge = workspace.events.length;
    expect(() => workspace.merge({
      mergeId: 'merge:a-again',
      reviewId: 'review:a',
      authorizationId: 'auth:a',
      actor: MERGE_SERVICE,
      evidenceRefs: ['test:duplicate-merge'],
    })).toThrowError(/MERGE_ALREADY_APPLIED/);
    expect(workspace.events).toHaveLength(countAtMerge);
  });

  it('rejects a genuinely stale target before merge without consuming authorization', () => {
    const workspace = fixture();
    workspace.recordReview({ reviewId: 'review:a', decision: 'APPROVE', actor: HUMAN_OPERATOR });
    workspace.transitionAuthorization({ authorizationId: 'auth:a', status: 'AUTHORIZED', actor: HUMAN_OPERATOR });
    workspace.commitRevision({
      branch: 'main',
      expectedHeadRevisionId: 'rev:main',
      revisionId: 'rev:main-concurrent',
      summary: 'Concurrent target update',
      footprint: { reads: [], writes: ['component:airframe'], impacts: [] },
      replayFingerprint: 'fp:main-concurrent',
      actor: BROWSER_AGENT,
    });

    expect(workspace.mergeEligibility('review:a', 'auth:a')).toEqual({
      state: 'BLOCKED',
      eligible: false,
      reasons: ['STALE_TARGET'],
      mergedRevisionId: null,
    });
    const before = workspace.events.length;
    expect(() => workspace.merge({
      mergeId: 'merge:stale',
      reviewId: 'review:a',
      authorizationId: 'auth:a',
      actor: MERGE_SERVICE,
      evidenceRefs: ['test:stale-target'],
    })).toThrowError(/MERGE_INELIGIBLE/);
    expect(workspace.events).toHaveLength(before);
    expect(workspace.project().authorizations['auth:a'].status).toBe('AUTHORIZED');
  });

  it('preserves an applied merge in the page-session graph across workspace remounts', () => {
    const mounted = getPageSessionCollaborationWorkspace();
    mounted.recordReview({ reviewId: 'review:assembly-004', decision: 'APPROVE', actor: HUMAN_OPERATOR });
    mounted.transitionAuthorization({
      authorizationId: 'authorization:assembly-004',
      status: 'AUTHORIZED',
      actor: HUMAN_OPERATOR,
    });
    const merge = mounted.merge({
      mergeId: 'merge:assembly-004',
      reviewId: 'review:assembly-004',
      authorizationId: 'authorization:assembly-004',
      actor: MERGE_SERVICE,
      evidenceRefs: ['test:page-session-remount'],
    });
    const eventCount = mounted.events.length;

    const remounted = getPageSessionCollaborationWorkspace();
    expect(remounted).toBe(mounted);
    expect(remounted.events).toHaveLength(eventCount);
    expect(remounted.project().authorizations['authorization:assembly-004'].status).toBe('APPLIED');
    expect(remounted.mergeEligibility('review:assembly-004', 'authorization:assembly-004')).toEqual({
      state: 'MERGED',
      eligible: false,
      reasons: [],
      mergedRevisionId: merge.payload.revisionId,
    });
  });

  it('rejects conflicts and leaves both the event log and target head untouched', () => {
    const workspace = fixture();
    workspace.commitRevision({
      branch: 'main',
      expectedHeadRevisionId: 'rev:main',
      revisionId: 'rev:main-new',
      summary: 'Concurrent motor edit',
      footprint: { reads: [], writes: ['component:motor'], impacts: ['operation:solve'] },
      replayFingerprint: 'fp:main-new',
      actor: BROWSER_AGENT,
    });
    workspace.requestReview({
      reviewId: 'review:conflict',
      title: 'Conflicting motor update',
      sourceBranch: 'feature/a',
      targetBranch: 'main',
      upstream: { reads: [], writes: ['component:motor'], impacts: ['operation:solve'] },
      replayFingerprints: ['fp:geometry-a', 'fp:geometry-a'],
      actor: BROWSER_AGENT,
    });
    workspace.requestAuthorization({ authorizationId: 'auth:conflict', reviewId: 'review:conflict', actor: BROWSER_AGENT });
    workspace.recordReview({ reviewId: 'review:conflict', decision: 'APPROVE', actor: HUMAN_OPERATOR });
    workspace.transitionAuthorization({ authorizationId: 'auth:conflict', status: 'AUTHORIZED', actor: HUMAN_OPERATOR });
    const assessment = workspace.project().reviews['review:conflict'].assessment;
    expect(assessment.allowed).toBe(false);
    expect(assessment.conflicts.map((conflict) => conflict.code)).toEqual(['WRITE_WRITE_CONFLICT', 'NONCOMMUTATIVE_DEPENDENCY']);
    const before = workspace.events.length;
    const head = workspace.project().branches.main.headRevisionId;
    expect(() => workspace.merge({
      mergeId: 'merge:conflict',
      reviewId: 'review:conflict',
      authorizationId: 'auth:conflict',
      actor: MERGE_SERVICE,
      evidenceRefs: ['test:conflict'],
    })).toThrowError(/MERGE_INELIGIBLE/);
    expect(workspace.events).toHaveLength(before);
    expect(workspace.project().branches.main.headRevisionId).toBe(head);
  });

  it('makes replay and stale-base failures explicit with stable conflict identities', () => {
    const first = assessChangeFootprints({
      baseRevisionId: 'rev:base',
      headRevisionId: 'rev:head',
      proposal: { reads: [], writes: ['b', 'a'], impacts: [] },
      upstream: { reads: [], writes: ['a', 'b'], impacts: [] },
      replayFingerprints: ['fp:one', 'fp:two'],
    });
    const second = assessChangeFootprints({
      baseRevisionId: 'rev:base',
      headRevisionId: 'rev:head',
      proposal: { reads: [], writes: ['a', 'b'], impacts: [] },
      upstream: { reads: [], writes: ['b', 'a'], impacts: [] },
      replayFingerprints: ['fp:one', 'fp:two'],
    });
    expect(first.conflicts.map((conflict) => conflict.code)).toEqual(['WRITE_WRITE_CONFLICT', 'REPLAY_DIVERGENCE']);
    expect(first.conflicts.map((conflict) => conflict.conflictId)).toEqual(second.conflicts.map((conflict) => conflict.conflictId));
    expect(() => { throw new CollaborationWorkspaceError('EXPLICIT_FAILURE', 'evidence remains visible'); }).toThrowError(/EXPLICIT_FAILURE/);
  });
});
