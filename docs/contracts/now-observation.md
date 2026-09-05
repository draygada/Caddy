# Contract: evidence for Shipyard Now

## Boundary

Shipyard may render a top-level **Now** tab (working label `LIVE NOW`) from Forge source observations. Now answers “what are we actually doing right now, as of this moment?” Build remains the link target for intended scope, architecture, and roadmap. A disagreement is valid: Now must continue to show observed reality.

Now is a projection, never a progress authority. Forge's Git objects, custody receipts, test/verification receipts, product-thread records, and release receipts remain authoritative. Shipyard does not write Forge state.

## Required projection

The aggregate view shows:

- a prominent `AS OF`, computed freshness age, and `LIVE | STALE | PARTIAL | UNKNOWN` source health;
- the current north-star positioning and an exact active objective only when backed by a current directive/task receipt;
- each active or prepared lane's observed task title, owner/model when available, current action, logical worktree label, branch, custody scope, last evidenced change, elapsed time, and state;
- the observed critical-path step and why it is next, or `UNKNOWN` if no governing receipt identifies one;
- a recent event stream from task, Git, custody, test, verification, deploy, and release observations;
- every active blocker/hold with the exact clearer and next unblock;
- running or last-completed checks with `RUNNING | PASSED | FAILED | UNKNOWN`, evidence reference, and observation time;
- preview/release state and an exact immutable candidate when one exists; otherwise `NONE` or `UNKNOWN`; and
- immediate controls only through Helm's `REQUESTED -> AUTHORIZED -> APPLIED -> VERIFIED` lifecycle, with `REJECTED` and `ROLLED_BACK` preserved where applicable.

## Truth and freshness

1. Every visible status has a source receipt/event and `MEASURED | INFERRED | UNKNOWN`. Inference names its inputs and cannot become measured through repetition.
2. Plans, queued messages, file presence, branch names, and model activity cannot prove active or completed work. A commit proves only the recorded change; a passing check proves only its named assertion on its exact candidate.
3. The consumer computes health at read time from source observation timestamps and a displayed threshold. `LIVE` requires all critical sources within threshold; `PARTIAL` means some required sources are missing or stale; `STALE` means the last critical observation exceeded threshold; absent telemetry is `UNKNOWN`. It shows the last known observation rather than fabricating a heartbeat.
4. Elapsed time is derived from source event times, never stored as an advancing claim.
5. A candidate is identified by immutable commit/artifact hash. Preview, authorized release, deployed, and verified are distinct states.
6. Controls create authorization requests; they do not directly mutate Forge or imply success.

## Forge lane receipt subset

Every lane custody receipt contains `now_observation` conforming to `governance/now-observation.v1.schema.json`. At preparation it truthfully reports no assigned task/owner/model, a custody hold, and the exact next unblock. A writer updates it only upon a material sourced observation; time-based freshness degradation is deliberate.

The safe browser projection may include only `now_observation`, repository/lane IDs, branch, custody path patterns, and separately observed immutable Git/test/release identifiers. It replaces the absolute worktree with `worktree_label`. It must exclude absolute paths, transcript bodies, prompts, secrets, credentials, command output containing sensitive content, and source snippets.

## Acceptance fixtures for Shipyard

An independent verifier must demonstrate:

1. a new sourced lane event changes Now;
2. withholding one critical source past its threshold visibly changes health to `PARTIAL` or `STALE` without advancing state;
3. a deliberately divergent Build-plan fixture does not change Now;
4. an unassigned-custody hold names `main integration owner` and the atomic lease assignment as its next unblock; and
5. every rendered field resolves to a receipt/event/candidate or is visibly `UNKNOWN`.

These are Shipyard projection tests. Forge only supplies the source contract and lane receipts in this bootstrap.
