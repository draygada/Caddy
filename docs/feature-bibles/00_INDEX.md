# Tripwire feature-bible index

These files are literal build instructions. A session gets one bible, one path-bounded lane, one worktree, and one falsifier. It returns an artifact and evidence, never its own acceptance verdict.

Canonical objective: [../NORTH_STAR.md](../NORTH_STAR.md).

## Critical path

```text
FB-00 governed truth pack
              |
FB-01 golden design + API contract
              |
              +--> FB-02 deterministic engine -----+
              |                                    |
              +--> FB-03 visual inspection shell --+--> FB-04 interactive loop
                                                       |
                                                       +--> FB-07 demo hardening

FB-05 audit history and FB-06 AI/classification bridges are roadmap lanes, not hackathon P0.
```

## Bibles and ownership

| ID | Outcome | Primary paths | Depends on | Demo priority |
|---|---|---|---|---|
| `FB-00` | Approved, explicitly partial P0 rule pack and semantic decisions | `data/rules/`, decision record, corpus receipts | required authority | P0 blocker |
| `FB-01` | One canonical Kestrel fixture and stable evaluate contract | exact cross-owner allowlist: `data/demo/`, `backend/tests/fixtures/`, `docs/api/` | FB-00; serialized contract owner | P0 |
| `FB-02` | Deterministic per-node evaluation and propagation | `backend/engine/`, engine tests | FB-01, approved P0 rule pack | P0 |
| `FB-03` | Inspectable 3D inventory with in-context tripwire markers | `frontend/src/` | FB-01; fixture-shaped evaluator response | P0 |
| `FB-04` | End-to-end edit → evaluate → flag → explain → clear loop | exact integration allowlist: `backend/app.py`, `backend/tests/test_api.py`, `frontend/src/api/`, `frontend/src/App.jsx`, `vite.config.js` | FB-02, FB-03; serialized integration owner | P0 |
| `FB-05` | Append-only change/evaluation timeline and replay/tamper proof | `backend/log/`, log tests, timeline UI | FB-04 | roadmap |
| `FB-06` | Bounded extractor, replacement search, and classification request | `backend/integrations/`, cached fixtures | FB-04 verified | roadmap |
| `FB-07` | Offline demo, visual QA, failure recovery, and final claims gate | scripts/tests/docs only | FB-04 | P0 |

## Work order

1. Clear FB-00 or explicitly HOLD the engine. Do not disguise draft research as an approved rule pack.
2. Refreeze the governed schema subset in FB-00, then freeze FB-01 in less than 45 minutes. Do not keep researching.
3. Run FB-02 and FB-03 in parallel against that fixture/contract; FB-03 may start in visibly labeled fixture mode.
4. Integrate only when each lane has a fresh, blinded falsification receipt.
5. Build FB-04 as the first live vertical slice. It supports only F1 battery, F3 camera propagation, F8 no-change, and the mandatory missing-evidence state.
6. Run FB-07. Do not start FB-05 or FB-06 during the hackathon critical path.

## Frozen cross-lane contracts

- `schemas/design.schema.json`, `rules.schema.json`, `chart.schema.json`, and `log.schema.json` change only in the controlled FB-00 thaw/refreeze with the integration owner present; after that receipt they are frozen again.
- `node_id` is the only identity shared by 3D meshes, BOM rows, engine results, audit events, and inspector selection.
- The engine, not React, owns rule evaluation, order of review, threshold comparison, evidence state, ancestor propagation, and destination state.
- The frontend may map engine states to presentation, but it may not infer a rule outcome from raw attributes.
- Every API response echoes `request_id` and carries the rule-pack digest and design revision used to produce it.
- Node determinations use only `direct_tripwires`, `propagated_tripwires`, and `unresolved_tripwires`. The envelope has one `delta` with changed nodes, tripwires added/removed, and rule IDs re-evaluated.
- Destinations remain `{status: "not_evaluated", reason: ...}` in P0.

## Common response vocabulary

Every node can render one of these presentation states:

| State | Meaning | UI treatment |
|---|---|---|
| `clear` | No implemented rule fired and required facts for those rules were present | green/neutral; never say “uncontrolled” |
| `watch` | A deterministic proximity or explicit design declaration makes a threshold relevant, but it has not fired | amber outline; label “near tripwire” |
| `question` | A required fact/evidence field is absent, stale, or incomparable | amber dashed outline; label what is missing |
| `flag` | One or more implemented rules fired | red for EAR consequence, black for ITAR; parent propagation is visually distinct |
| `pending` | A newer revision is being evaluated | retain the last result but mark it stale/checking; never repaint it as current |

`watch` is optional for the hackathon. If no reviewed proximity rule exists, omit it rather than invent a margin. `question` is mandatory wherever a missing fact could affect an implemented rule. A stubbed, failed, or stale response is never `clear`.

## Session protocol

Every builder prompt must include:

- exact bible ID and immutable base commit;
- owned paths and forbidden paths;
- the acceptance checks to run;
- the prewritten falsifier;
- “Your output claims nothing—a blinded verifier decides what is true.”

Every verifier receives only the bible, candidate commit, and fixtures. It does not receive builder reasoning. A verifier must exercise at least one intentionally bad fixture or mutation and prove the claimed gate goes red.

## Stop rules

Stop and escalate rather than improvise when:

- a frozen schema must change;
- a rule quote or threshold is disputed;
- the approved partial `rules.P0.json` does not exist;
- two sessions need to edit the same file;
- the UI and engine disagree about a node state;
- a claim requires a network response to survive;
- less than two hours remain and the F1/F3/F8 vertical slice is not green.

The current known stop is FB-00: approved `data/rules/rules.P0.json` does not exist. FB-02 cannot start until that is cleared. FB-03 may proceed against the golden response fixtures only and must label that state.

At the two-hour stop, retain only preset F1/F3/F8 actions, exact citations, the missing-evidence state, and FB-07. If the live evaluator is not verified, switch visibly to committed fixture mode rather than implying a live result.
