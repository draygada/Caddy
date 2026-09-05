# FB-02 — Deterministic tripwire engine

Owner lane: backend engine. Priority: P0.

## User-visible outcome

For any accepted P0 design edit, Tripwire deterministically returns per-node findings, the exact causal facts and rules, ancestor propagation, and explicit missing-evidence questions in under 50 ms for an 80-node tree.

## Scope

- Load and validate the canonical design and approved `rules.P0.json` pack.
- Evaluate typed clauses and atoms with unit-aware comparisons.
- Hard-code order of review outside rule data: USML/ITAR → CCL/EAR → EAR99 only after specific candidates are rejected.
- Evaluate parts/items first, then propagate named consequences to assemblies/products.
- Return causal objects suitable for direct UI rendering.
- Implement only the admitted P0 flips F1, F3, and F8 plus the missing-evidence fixture. F2/F4/F5/F6 remain excluded until their unresolved facts and grammar are governed.

## Implementation shape

- `backend/engine/model.py`: validated domain types and graph indexes.
- `backend/engine/units.py`: explicit supported unit normalization; reject unknown/incompatible units.
- `backend/engine/evaluate.py`: pure orchestration and order of review.
- Add focused modules only if they make tests smaller: `clauses.py`, `propagate.py`.
- No database, network, model call, wall-clock dependency, or UI import.
- Reject duplicate IDs, dangling parents, missing/non-product roots, and cycles before evaluation; never silently overwrite a node.

## Causal tripwire object

Each fired or unresolved tripwire includes:

- `rule_id`, `jurisdiction`, `entry`, and reasons for control;
- target `node_id` and optional source/ancestor node IDs;
- `fact` with attribute, observed value/unit, operator, and threshold;
- `state`: `fired`, `not_fired`, or `cannot_evaluate`;
- verbatim text, URL, eCFR content date, and rule effective date when present;
- evidence level and source span/digest when present;
- destination status fixed to `not_evaluated` for P0.

Do not return a generic boolean when a causal object can be returned.

## Acceptance

- F1 battery/endurance flips 9A012.a.1 → a.2 at the specified threshold.
- F3 camera swap flags the camera and propagates 9A012.a.3 to the airframe.
- F3 exact camera boundaries distinguish `>9`, `>60`, and `>111000` without collapsing the predicates.
- F2/F4/F5/F6 tests remain explicitly excluded, not skipped P0 checks or visible product claims.
- F8 no-change edits report zero changed determinations.
- Empty fields never fire; mismatched units never compare.
- Same canonical input produces byte-equivalent canonical output.
- The 80-node performance test loads the real P0 pack and remains below 50 ms on the local target; an empty-pack benchmark is not evidence.

## Falsifiers

1. Reverse the jurisdiction evaluation order in a mutation; an order-of-review test must fail.
2. Remove the missing-field guard; an empty-value fixture must become red.
3. Remove child-to-parent propagation; F3 must fail on the airframe node.
4. Change `>` to `>=` for the 9 Hz or 60 Hz camera branch; the exact-boundary test must fail.
5. Admit a duplicate ID or graph cycle; semantic graph validation must fail before evaluation.

## Cut line

Minimum engine for the demo is baseline plus F1, F3, F8, the camera parent-propagation path, and missing-evidence questions. Additional rows or destination conclusions may be displayed only after their separate governed artifacts and exact tests pass.
