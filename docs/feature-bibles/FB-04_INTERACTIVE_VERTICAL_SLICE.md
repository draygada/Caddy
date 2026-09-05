# FB-04 — Interactive edit-to-explanation loop

Owner lane: integration. Priority: P0.

## Outcome

Connect the engine and visual shell so three deterministic edits drive a complete loop: edit → evaluate → highlight → explain → reverse/clear.

## Canonical edits

1. Battery 1,000 Wh → 1,300 Wh: derived endurance crosses the three-hour line.
2. Lepton 3.5 → Boson+ 640: camera finding plus airframe propagation.
3. Baseline IMU → qualifying/synthetic gyro: missing-evidence state first, then controlled result when the exact field is supplied.

Wing span/range is the fourth edit if time permits.

Preset buttons or a bounded part picker are acceptable. Free dragging is not required.

## Interaction contract

- Edits create a new immutable design revision in client state.
- The UI sends the whole small design or a clearly versioned patch to `/evaluate`.
- Only a response matching the current design revision is rendered; late responses are discarded.
- While evaluating, preserve the previous result with a visible pending state rather than clearing the model.
- On error, preserve the design edit, show the failure, and allow retry or fixture fallback. Never render a guessed green state.
- Selecting a result focuses the affected node and exposes the causal chain.

## Acceptance

- All three edits work from a clean local start and reverse correctly.
- A stale response cannot overwrite a newer edit.
- Backend unavailable produces a visible bounded error; committed fixture mode still demonstrates the product honestly.
- Camera child-to-parent propagation is identical in engine JSON, marker layer, BOM tree, and inspector.
- Every edit shows before/after engineering values and the rule-pack digest/date used.
- No model/API/classification request occurs during the live change path.

## Falsifiers

- Add response latency and make two edits quickly; stale output must not win.
- Return a different design revision or rule-pack digest; UI must refuse it.
- Kill the backend after one successful edit; UI must not silently reuse the old finding as if current.
- Reverse the edit; any surviving active marker fails the lane.

## Cut line

If integration is late, use only preset edit buttons and the three committed response fixtures. The presenter must say fixture mode. Do not replace causal correctness with uncontrolled animation.
