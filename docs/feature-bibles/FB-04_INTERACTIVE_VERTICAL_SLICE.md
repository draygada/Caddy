# FB-04 — Interactive edit-to-explanation loop

Owner lane: integration. Priority: P0.

## Outcome

Connect the engine and visual shell so two deterministic edits and one no-change control drive a complete loop: edit → evaluate → highlight → explain → reverse/clear.

## Canonical edits

1. Battery 1,000 Wh → 1,300 Wh: derived endurance crosses the three-hour line.
2. Lepton 3.5 → Boson+ 640: direct camera finding plus explicit airframe propagation.
3. F8 no-change control: a non-regulatory edit produces zero changed determinations and no false visual pulse.

Span/range and gyro paths are not P0 until their formulas or unresolved facts are governed.

Preset buttons or a bounded part picker are acceptable. Free dragging is not required.

## Interaction contract

- Edits create a new immutable design revision in client state.
- The UI sends the whole small design to same-origin `/api/evaluate`; Vite proxies that path to FastAPI `/evaluate` in development.
- Only a response whose `request_id`, design revision, and P0 rule-pack digest all match current client state is rendered; late or mismatched responses are rejected as contract errors.
- While evaluating, preserve the previous result with a visible pending state rather than clearing the model.
- On error, preserve the design edit, show the failure, and allow retry or an explicit user-selected committed fixture fallback. Fixture mode is visibly badged and never activates automatically. Never render a guessed green state.
- Selecting a result focuses the affected node and exposes the causal chain.

## Acceptance

- F1, F3, and F8 work from a clean local start; both substantive edits reverse correctly.
- A stale response cannot overwrite a newer edit.
- Backend unavailable produces a visible bounded error; committed fixture mode still demonstrates the product honestly.
- Camera child-to-parent propagation is identical in engine JSON, marker layer, BOM tree, and inspector.
- Every edit shows before/after engineering values and the rule-pack digest/date used.
- F3 shows the new camera entry and `+9A012.a.3` separately even if the product was already red.
- F8 visibly reports zero changed determinations and leaves marker state unchanged.
- No model/API/classification request occurs during the live change path.

## Falsifiers

- Add response latency and make two edits quickly; stale output must not win.
- Return a different design revision or rule-pack digest; UI must refuse it.
- Kill the backend after one successful edit; UI must not silently reuse the old finding as if current.
- Reverse the edit; any surviving active marker fails the lane.

## Cut line

If integration is late, use only preset F1/F3/F8 buttons and committed response fixtures. The UI and presenter must say fixture mode. Do not replace causal correctness with uncontrolled animation.
