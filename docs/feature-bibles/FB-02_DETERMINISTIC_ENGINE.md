# FB-02 — Deterministic tripwire engine

Owner lane: backend engine. Priority: P0.

## User-visible outcome

For any accepted design edit, Tripwire deterministically returns per-node findings, the exact causal facts and rules, ancestor propagation, bounded destination consequences, and explicit missing-evidence questions in under 50 ms for an 80-node tree.

## Scope

- Load and validate the canonical design, approved rule pack, and country chart.
- Evaluate typed clauses and atoms with unit-aware comparisons.
- Hard-code order of review outside rule data: USML/ITAR → CCL/EAR → EAR99 only after specific candidates are rejected.
- Evaluate parts/items first, then propagate named consequences to assemblies/products.
- Return causal objects suitable for direct UI rendering.
- Implement the canonical F1–F8 flip tests, beginning with F1, F3, and F4.

## Implementation shape

- `backend/engine/model.py`: validated domain types and graph indexes.
- `backend/engine/units.py`: explicit supported unit normalization; reject unknown/incompatible units.
- `backend/engine/evaluate.py`: pure orchestration and order of review.
- Add focused modules only if they make tests smaller: `clauses.py`, `propagate.py`, `destinations.py`.
- No database, network, model call, wall-clock dependency, or UI import.

## Causal tripwire object

Each fired or unresolved tripwire includes:

- `rule_id`, `jurisdiction`, `entry`, and reasons for control;
- target `node_id` and optional source/ancestor node IDs;
- `fact` with attribute, observed value/unit, operator, and threshold;
- `state`: `fired`, `not_fired`, or `cannot_evaluate`;
- verbatim text, URL, eCFR content date, and rule effective date when present;
- evidence level and source span/digest when present;
- a bounded destination explanation derived from chart columns.

Do not return a generic boolean when a causal object can be returned.

## Acceptance

- F1 battery/endurance flips 9A012.a.1 → a.2 at the specified threshold.
- F2 span changes derived endurance/range and the 300 km MT atom independently.
- F3 camera swap flags the camera and propagates 9A012.a.3 to the airframe.
- F4 missing one-month gyro stability renders `question`; supplied qualifying evidence fires the intended path and propagation.
- F5/F6 used-on changes exercise ITAR before CCL and cannot leak to EAR99.
- F8 no-change edits report zero changed determinations.
- Empty fields never fire; mismatched units never compare.
- Same canonical input produces byte-equivalent canonical output.
- The 80-node performance test remains below 50 ms on the local target.

## Falsifiers

1. Reverse the jurisdiction evaluation order in a mutation; an order-of-review test must fail.
2. Remove the missing-field guard; an empty-value fixture must become red.
3. Remove child-to-parent propagation; F3 must fail on the airframe node.
4. Change `>` to `>=` for the 60 Hz camera branch; the exact-boundary test must fail.
5. Mark a chart blank as `X`; the destination test must fail.

## Cut line

Minimum engine for the demo is F1, F3, F4, the parent-propagation path, missing-evidence questions, and the five fixed destinations. Additional rows may be displayed only after their exact tests pass.
