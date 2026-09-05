# FB-07 — Demo hardening and verification gate

Owner lane: verification/integration. Priority: P0.

## Outcome

Produce a candidate-bound GO or HOLD verdict for the exact commit and local environment used in the hackathon demo.

## Required gates

### Automated

- Clean checkout/install using only declared dependencies.
- Schema and data validation.
- Engine unit/boundary/propagation tests.
- F1, F3, F8, and missing-evidence tests; any skip among them is a HOLD. Non-P0 flip skips are documented deferrals, not false failures.
- API contract and stale-response tests.
- Frontend production build.
- Network-denied canonical demo test.
- Performance budget against the real P0 rule pack, not an empty rules array.

### Visual

- Fresh browser at 1280×720 and 1920×1080.
- Baseline, F1 battery, F3 camera-propagation, F8 no-change, and missing-evidence states captured.
- Mesh/BOM/inspector synchronization exercised.
- Direct versus propagated flags distinguishable without narration.
- Missing evidence visibly amber/question, not green.
- Long citation, six-marker, request-race, contract-error, backend-error, and visibly badged fixture-mode states inspected.

### Adversarial

- At least one mutation per claimed gate is observed red, then reverted.
- A verifier who did not build the lane runs the checks from the bible and records exact output.
- Claims copy is compared to demonstrated behavior; anything else is labeled design intent or removed.

## Demo runbook

1. Start backend and frontend from a clean terminal.
2. Confirm rule-pack digest/date and offline fixture availability.
3. Load baseline and select camera and battery in the model.
4. Perform F1 and F3, run F8, and reverse each substantive edit.
5. Disable network and repeat the shortest run.
6. Restart both processes and repeat once from cold state.
7. Save screenshots, command output, commit hash, and verdict in `docs/verification/`.

## GO conditions

- The exact candidate passes every P0 automated and visual gate.
- No P0 test is skipped.
- The F1/F3/F8 loop succeeds twice, including once without network.
- Every on-screen claim resolves to engine output, pinned evidence, or an explicit synthetic/design-intent label.
- The presenter has a committed fixture-mode fallback and knows the cut features.

Otherwise the verdict is HOLD with the smallest failing condition and owner.

## Final cut order

1. Live model/API calls.
2. Audit signatures/tamper animation.
3. Extra flip rows and destinations (already outside P0).
4. Drag/drop and exploded animation polish.
5. Extra destination rows or optional component palettes.

Never cut the inspectable model, F1/F3/F8 loop, deterministic flags, exact causal explanation, parent propagation, missing-evidence state, or offline path.
