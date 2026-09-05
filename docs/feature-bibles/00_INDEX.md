# Tripwire feature-bible index

These files are literal build instructions. A session gets one bible, one path-bounded lane, one worktree, and one falsifier. It returns an artifact and evidence, never its own acceptance verdict.

Canonical objective: [../NORTH_STAR.md](../NORTH_STAR.md).

## Critical path

```text
FB-01 golden design + API contract
              |
              +--> FB-02 deterministic engine -----+
              |                                    |
              +--> FB-03 visual inspection shell --+--> FB-04 interactive loop
                                                       |
                                                       +--> FB-05 audit timeline
                                                       |
                                                       +--> FB-07 demo hardening

FB-06 AI/classification bridges is optional and starts only after FB-04 is verified.
```

## Bibles and ownership

| ID | Outcome | Primary paths | Depends on | Demo priority |
|---|---|---|---|---|
| `FB-01` | One canonical Kestrel fixture and stable evaluate contract | `data/demo/`, `backend/tests/fixtures/`, `docs/api/` | frozen schemas | P0 |
| `FB-02` | Deterministic per-node evaluation, propagation, and destination projection | `backend/engine/`, engine tests | FB-01, approved rule pack | P0 |
| `FB-03` | Inspectable 3D inventory with in-context tripwire markers | `frontend/src/` | FB-01; fixture-shaped evaluator response | P0 |
| `FB-04` | End-to-end edit → evaluate → flag → explain → clear loop | frontend integration and `backend/app.py` | FB-02, FB-03 | P0 |
| `FB-05` | Append-only change/evaluation timeline and replay/tamper proof | `backend/log/`, log tests, timeline UI | FB-04 | P1 |
| `FB-06` | Bounded extractor, replacement search, and classification request | `backend/integrations/`, cached fixtures | FB-04 verified | P2/cuttable |
| `FB-07` | Offline demo, visual QA, failure recovery, and final claims gate | scripts/tests/docs only | FB-04; FB-05 if retained | P0 |

## Work order

1. Freeze FB-01 in less than 45 minutes. Do not keep researching.
2. Run FB-02 and FB-03 in parallel against that fixture/contract.
3. Integrate only when each lane has a blinded falsification receipt.
4. Build FB-04 as the first vertical slice. It must support the three-edit canonical loop before any optional feature begins.
5. Add FB-05 if the vertical slice is stable.
6. Start FB-06 only if every P0 check is green and the offline demo has been rehearsed once.
7. FB-07 owns the final clock and can cut any P1/P2 feature without reopening the north star.

## Frozen cross-lane contracts

- `schemas/design.schema.json`, `rules.schema.json`, `chart.schema.json`, and `log.schema.json` do not change without the integration owner present.
- `node_id` is the only identity shared by 3D meshes, BOM rows, engine results, audit events, and inspector selection.
- The engine, not React, owns rule evaluation, order of review, threshold comparison, evidence state, ancestor propagation, and destination state.
- The frontend may map engine states to presentation, but it may not infer a rule outcome from raw attributes.
- Every API response carries the rule-pack digest and design revision used to produce it.

## Common response vocabulary

Every node can render one of four presentation states:

| State | Meaning | UI treatment |
|---|---|---|
| `clear` | No implemented rule fired and required facts for those rules were present | green/neutral; never say “uncontrolled” |
| `watch` | A deterministic proximity or explicit design declaration makes a threshold relevant, but it has not fired | amber outline; label “near tripwire” |
| `question` | A required fact/evidence field is absent, stale, or incomparable | amber dashed outline; label what is missing |
| `flag` | One or more implemented rules fired | red for EAR consequence, black for ITAR; parent propagation is visually distinct |

`watch` is optional for the hackathon. If no reviewed proximity rule exists, omit it rather than invent a margin. `question` is mandatory wherever a missing fact could affect an implemented rule.

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
- the approved `rules.json` does not exist;
- two sessions need to edit the same file;
- the UI and engine disagree about a node state;
- a claim requires a network response to survive;
- less than two hours remain and the three-edit vertical slice is not green.

At the two-hour stop, cut FB-05 and FB-06, reduce editing to three preset actions, retain exact citations, and finish FB-07.
