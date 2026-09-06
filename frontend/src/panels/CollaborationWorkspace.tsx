import { useMemo, useState, type FormEvent } from 'react';
import {
  BROWSER_AGENT,
  CollaborationWorkspaceError,
  CollaborationWorkspaceModel,
  HUMAN_OPERATOR,
  MERGE_SERVICE,
  getPageSessionCollaborationWorkspace,
  type Actor,
  type ReviewDecision,
} from '../lib/collaboration-workspace';

const short = (value: string | null) => value ? value.replace(/^event:/, '').slice(0, 10) : 'genesis';

export function CollaborationWorkspace() {
  const workspace: CollaborationWorkspaceModel = getPageSessionCollaborationWorkspace();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Open review is ready for a binding human decision.');
  const [branchName, setBranchName] = useState('feature/new-concept');
  const [activeBranch, setActiveBranch] = useState('feature/assembly');
  const [sourceBranch, setSourceBranch] = useState('feature/assembly');
  const [targetBranch, setTargetBranch] = useState('main');
  const [reviewTitle, setReviewTitle] = useState('Candidate integration review');
  const [selectedReviewId, setSelectedReviewId] = useState('review:assembly-004');
  const [comment, setComment] = useState('');
  const [commentActor, setCommentActor] = useState<Actor['actorKind']>('HUMAN');

  const projection = useMemo(() => workspace.project(), [workspace, version]);
  const audit = useMemo(() => workspace.auditEvidence().slice().reverse(), [workspace, version]);
  const branches = Object.values(projection.branches);
  const reviews = Object.values(projection.reviews);
  const review = projection.reviews[selectedReviewId] ?? reviews[0];
  const authorizationId = review ? `authorization:${review.reviewId.replace(/^review:/, '')}` : '';
  const authorization = projection.authorizations[authorizationId];
  const eligibility = review
    ? workspace.mergeEligibility(review.reviewId, authorizationId)
    : { state: 'BLOCKED' as const, eligible: false, reasons: ['REVIEW_NOT_SELECTED'], mergedRevisionId: null };

  const run = (action: () => void, success: string) => {
    try {
      action();
      setError(null);
      setNotice(success);
      setVersion((current) => current + 1);
    } catch (caught) {
      const message = caught instanceof CollaborationWorkspaceError ? caught.message : String(caught);
      setError(message);
    }
  };

  const addBranch = (event: FormEvent) => {
    event.preventDefault();
    const parent = projection.branches[activeBranch];
    if (!parent) return;
    run(() => workspace.createBranch({
      branch: branchName.trim(),
      fromBranch: parent.name,
      revisionId: parent.headRevisionId,
      actor: HUMAN_OPERATOR,
    }), `Created ${branchName.trim()} from ${parent.name}.`);
  };

  const appendRevision = () => {
    const branch = projection.branches[activeBranch];
    if (!branch) return;
    const revisionId = `rev:${activeBranch.replace(/[^a-z0-9]+/gi, '-')}-${workspace.events.length + 1}`;
    run(() => workspace.commitRevision({
      branch: activeBranch,
      expectedHeadRevisionId: branch.headRevisionId,
      revisionId,
      summary: 'Local browser workspace revision',
      footprint: {
        reads: [`definition:${activeBranch}`],
        writes: [`component:${revisionId}`],
        impacts: ['operation:assembly-solve'],
      },
      replayFingerprint: `geometry:${revisionId}`,
      actor: BROWSER_AGENT,
    }), `Appended ${revisionId}; existing reviews remain pinned to their original revision.`);
  };

  const openReview = (event: FormEvent) => {
    event.preventDefault();
    const source = projection.branches[sourceBranch];
    if (!source) return;
    const revision = projection.revisions[source.headRevisionId];
    const identifier = workspace.events.length + 1;
    const reviewId = `review:${identifier}`;
    run(() => {
      workspace.requestReview({
        reviewId,
        title: reviewTitle.trim(),
        sourceBranch,
        targetBranch,
        actor: BROWSER_AGENT,
        replayFingerprints: [revision.replayFingerprint, revision.replayFingerprint],
      });
      workspace.requestAuthorization({
        authorizationId: `authorization:${identifier}`,
        reviewId,
        actor: BROWSER_AGENT,
      });
      setSelectedReviewId(reviewId);
    }, `Opened ${reviewId} with replay evidence and a separate authorization request.`);
  };

  const recordDecision = (decision: ReviewDecision) => {
    if (!review) return;
    run(() => workspace.recordReview({
      reviewId: review.reviewId,
      decision,
      actor: HUMAN_OPERATOR,
      comment: comment.trim() || `${decision.replace('_', ' ').toLowerCase()} from local operator`,
    }), `Binding ${decision.replace('_', ' ').toLowerCase()} recorded; the prior record was not edited.`);
  };

  const addComment = (event: FormEvent) => {
    event.preventDefault();
    if (!review || !comment.trim()) return;
    const actor: Actor = commentActor === 'AGENT' ? BROWSER_AGENT : HUMAN_OPERATOR;
    run(() => workspace.recordReview({ reviewId: review.reviewId, decision: 'COMMENT', actor, comment: comment.trim() }), 'Comment appended to the review ledger.');
    setComment('');
  };

  const authorize = () => {
    if (!authorization) return;
    run(() => workspace.transitionAuthorization({
      authorizationId: authorization.authorizationId,
      status: 'AUTHORIZED',
      actor: HUMAN_OPERATOR,
    }), 'Human authorization recorded. This authorizes only the selected merge subject.');
  };

  const merge = () => {
    if (!review || !authorization) return;
    run(() => workspace.merge({
      mergeId: `merge:${review.reviewId.replace(/^review:/, '')}`,
      reviewId: review.reviewId,
      authorizationId: authorization.authorizationId,
      actor: MERGE_SERVICE,
      evidenceRefs: [`event-head:${workspace.events.at(-1)?.eventHash ?? 'none'}`, `review:${review.reviewId}`],
    }), `Atomic merge applied to ${review.targetBranch}; authorization advanced to APPLIED in the same transaction.`);
  };

  return (
    <section aria-label="Collaboration workspace" data-panel="collaboration-workspace" className="h-full min-h-0 overflow-auto bg-bg text-ink">
      <header className="sticky top-0 z-[2] border-b border-line2 bg-surface px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold">Collaboration workspace</div>
            <div className="text-[12px] text-muted">append-only branch graph · review custody · atomic merge gate</div>
          </div>
          <div className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[12px] max-w-[520px]">
            <b>Hackathon storage boundary:</b> this workspace is local-memory only. Refreshing loses changes; there is no server sync, identity proof, file lock, or durable multi-user concurrency yet.
          </div>
        </div>
        <div aria-live="polite" className={`mt-2 text-[12px] ${error ? 'text-red-500' : 'text-muted'}`}>{error ?? notice}</div>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(260px,.72fr)_minmax(380px,1.2fr)_minmax(360px,1fr)]">
        <div className="grid content-start gap-3">
          <section className="panel">
            <div className="panel-head"><div className="panel-title">Branches <span className="sub">· {branches.length}</span></div></div>
            <div className="grid gap-1 p-3">
              {branches.map((branch) => (
                <button
                  type="button"
                  key={branch.name}
                  onClick={() => setActiveBranch(branch.name)}
                  className="row-hover grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded px-2 py-2 text-left"
                  style={{ background: activeBranch === branch.name ? 'var(--surface2)' : 'transparent' }}
                >
                  <span className="min-w-0"><b className="block truncate text-[13px]">{branch.name}</b><span className="text-[11px] text-muted">from {branch.fromBranch ?? 'genesis'}</span></span>
                  <span className="font-mono text-[11px] text-muted">{short(branch.headRevisionId)}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-line2 p-3 grid gap-2">
              <button type="button" className="btn" onClick={appendRevision}>Append revision to {activeBranch}</button>
              <form onSubmit={addBranch} className="grid gap-2">
                <label className="text-[11px] text-muted">New branch from selected head</label>
                <div className="flex gap-2"><input aria-label="New branch name" className="field min-w-0 flex-1" value={branchName} onChange={(event) => setBranchName(event.target.value)} /><button className="btn" type="submit">Create</button></div>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div className="panel-title">Open review</div></div>
            <form onSubmit={openReview} className="grid gap-2 p-3 text-[12px]">
              <label>Source<select aria-label="Review source branch" className="field mt-1 w-full" value={sourceBranch} onChange={(event) => setSourceBranch(event.target.value)}>{branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
              <label>Target<select aria-label="Review target branch" className="field mt-1 w-full" value={targetBranch} onChange={(event) => setTargetBranch(event.target.value)}>{branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
              <label>Purpose<input aria-label="Review purpose" className="field mt-1 w-full" value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} /></label>
              <button className="btn btn-primary" type="submit">Request review + authorization</button>
            </form>
          </section>
        </div>

        <section className="panel min-w-0">
          <div className="panel-head">
            <div className="panel-title">Review custody <span className="sub">· revision-specific</span></div>
            <select aria-label="Selected review" className="field max-w-[210px]" value={review?.reviewId ?? ''} onChange={(event) => setSelectedReviewId(event.target.value)}>{reviews.map((item) => <option key={item.reviewId} value={item.reviewId}>{item.reviewId}</option>)}</select>
          </div>
          {!review && <div className="p-4 text-muted">No review selected.</div>}
          {review && <div className="grid gap-3 p-3">
            <div>
              <div className="text-[15px] font-semibold">{review.title}</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{review.sourceBranch} @ {review.reviewedRevisionId} → {review.targetBranch} @ {review.expectedTargetRevisionId}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
              <Metric label="Replay" value={review.assessment.conflicts.some((item) => item.code.startsWith('REPLAY_')) ? 'failed' : '2 agree'} good={!review.assessment.conflicts.some((item) => item.code.startsWith('REPLAY_'))} />
              <Metric label="Conflicts" value={String(review.assessment.conflicts.length)} good={review.assessment.allowed} />
              <Metric label="Decision" value={review.bindingDecision ?? 'awaiting human'} good={review.bindingDecision === 'APPROVE'} />
              <Metric label="Authorization" value={authorization?.status ?? 'missing'} good={authorization?.status === 'AUTHORIZED' || authorization?.status === 'APPLIED' || authorization?.status === 'VERIFIED'} />
            </div>
            {review.assessment.conflicts.length > 0 && <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-[12px]">{review.assessment.conflicts.map((conflict) => <div key={conflict.conflictId}><b>{conflict.code}</b> · {conflict.resources.join(', ') || 'no resource token'}</div>)}</div>}
            <div className="grid gap-2">
              {review.entries.map((entry) => <article key={entry.eventId} className="border-l-2 border-line2 pl-3 text-[12px]"><div><b>{entry.decision}</b> · {entry.actorKind}:{entry.actorId} {entry.bindingHumanDecision && <span className="text-amber-600">· binding</span>}</div><div>{entry.comment}</div><div className="font-mono text-[10px] text-muted">{entry.occurredAt} · {short(entry.eventId)}</div></article>)}
            </div>
            <form onSubmit={addComment} className="grid gap-2 border-t border-line2 pt-3">
              <textarea aria-label="Review comment" className="field min-h-20 resize-y" placeholder="Record rationale or evidence..." value={comment} onChange={(event) => setComment(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <select aria-label="Comment actor" className="field" value={commentActor} onChange={(event) => setCommentActor(event.target.value as Actor['actorKind'])}><option value="HUMAN">Human comment</option><option value="AGENT">Agent advisory</option></select>
                <button className="btn" type="submit">Append comment</button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={review.bindingDecision !== null} onClick={() => recordDecision('APPROVE')}>Approve as human</button>
              <button type="button" className="btn" disabled={review.bindingDecision !== null} onClick={() => recordDecision('REQUEST_CHANGES')}>Request changes</button>
              <button type="button" className="btn" disabled={review.bindingDecision !== null} onClick={() => recordDecision('REJECT')}>Reject</button>
            </div>
            <div data-merge-state={eligibility.state} className="rounded border border-line2 bg-surface2 p-3">
              <div className="text-[12px] font-semibold">Atomic merge gate</div>
              <div className="mt-1 text-[11px] text-muted">
                {eligibility.state === 'MERGED'
                  ? <><b className="text-emerald-600">{authorization?.status ?? 'UNKNOWN'} / MERGED</b> · revision {eligibility.mergedRevisionId} is recorded in the append-only ledger.</>
                  : eligibility.eligible
                    ? 'Eligible: exact reviewed heads, human approval, replay, conflicts, and subject-bound authorization all pass.'
                    : `Blocked: ${eligibility.reasons.join(' · ')}`}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn" disabled={!authorization || authorization.status !== 'REQUESTED'} onClick={authorize}>Authorize this merge</button>
                <button type="button" className="btn btn-primary" disabled={!eligibility.eligible} onClick={merge}>{eligibility.state === 'MERGED' ? 'Merged' : 'Merge atomically'}</button>
              </div>
            </div>
          </div>}
        </section>

        <section className="panel min-w-0">
          <div className="panel-head"><div className="panel-title">Audit evidence <span className="sub">· {audit.length} immutable events</span></div><span className="font-mono text-[10px] text-muted">head {short(audit[0]?.eventHash ?? null)}</span></div>
          <div className="max-h-[calc(100vh-190px)] overflow-auto">
            {audit.map((row) => <article key={row.eventId} className="grid gap-1 border-b border-line2 p-3 text-[11px]">
              <div className="flex items-start justify-between gap-2"><b>#{row.sequence} · {row.eventType}</b><span className="font-mono text-muted">{short(row.eventHash)}</span></div>
              <div>{row.summary}</div>
              <div className="text-muted">{row.actor} · {row.occurredAt}</div>
              <div className="font-mono text-[10px] text-muted">prev {short(row.previousEventHash)} · id {short(row.eventId)}</div>
              {row.evidenceRefs.length > 0 && <div className="text-[10px] text-muted">evidence: {row.evidenceRefs.join(' · ')}</div>}
            </article>)}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="rounded border border-line2 bg-surface2 p-2"><div className="text-[10px] uppercase tracking-wide text-muted">{label}</div><div className={`mt-1 font-semibold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</div></div>;
}
