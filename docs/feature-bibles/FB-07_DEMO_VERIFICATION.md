# FB-07 — Demo hardening and verification gate

Owner lane: verification/integration. Priority: P0.

## Outcome

Produce a candidate-bound GO or HOLD verdict for the exact commit and local environment used in the hackathon demo.

## Required gates

### Automated

- Clean checkout/install using only declared dependencies.
- Schema and data validation.
- Engine unit/boundary/propagation tests.
- All implemented flip tests; skipped canonical P0 flips are a HOLD.
- API contract and stale-response tests.
- Frontend production build.
- Network-denied canonical demo test.
- Performance budget.

### Visual

- Fresh browser at 1280×720 and 1920×1080.
- Baseline, battery, camera, and gyro states captured.
- Mesh/BOM/inspector synchronization exercised.
- Direct versus propagated flags distinguishable without narration.
- Missing evidence visibly amber/question, not green.
- Long citation, six-marker, backend-error, and fixture-mode states inspected.

### Adversarial

- At least one mutation per claimed gate is observed red, then reverted.
- A verifier who did not build the lane runs the checks from the bible and records exact output.
- Claims copy is compared to demonstrated behavior; anything else is labeled design intent or removed.

## Demo runbook

1. Start backend and frontend from a clean terminal.
2. Confirm rule-pack digest/date and offline fixture availability.
3. Load baseline and select camera, IMU, and battery in the model.
4. Perform the three canonical edits and reverse each.
5. Disable network and repeat the shortest run.
6. Restart both processes and repeat once from cold state.
7. Save screenshots, command output, commit hash, and verdict in `docs/verification/`.

## GO conditions

- The exact candidate passes every P0 automated and visual gate.
- No P0 test is skipped.
- The three-edit loop succeeds twice, including once without network.
- Every on-screen claim resolves to engine output, pinned evidence, or an explicit synthetic/design-intent label.
- The presenter has a committed fixture-mode fallback and knows the cut features.

Otherwise the verdict is HOLD with the smallest failing condition and owner.

## Final cut order

1. Live model/API calls.
2. Audit signatures/tamper animation.
3. Extra flip rows and destinations.
4. Drag/drop and exploded animation polish.
5. Wing-span fourth edit.

Never cut the inspectable model, three canonical edits, deterministic flags, exact causal explanation, parent propagation, missing-evidence state, or offline path.
