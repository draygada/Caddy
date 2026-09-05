# frontend — CADdy Daddy / Tripwire shell

React 19 · TypeScript · Tailwind CSS v4 · Vite · zustand · vitest. Built from the Claude Design handoff (`CADdy Daddy.dc.html`) and `docs/ux/tripwire_ux_flows_and_laws_2026-09-05.md`, flows A–E plus the timeline, help overlay and demo caption bar.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm test
npm run build
```

URL switches: `?demo=1` shows the caption bar (→ / Space advances the eight-step scenario) · `?theme=dark` · `?service=unreachable` shows the cached-baseline banner.

## Interaction model

- **Browser → bracket.** The left panel is a Fusion-style browser: the document, its settings, the airframe with its bodies (eye toggles) and feature history, and one generic row per component type (Battery pack, Thermal sensor, IMU, Flight controller). Drag an unplaced component onto the plate to place it where you drop it, or click it. A slot with no part renders as a dashed footprint. The specific model is chosen in Spec.
- **Navigate.** Bottom-centre navigation bar: orbit / pan / zoom drag modes, fit, and display settings (shaded, shaded with edges, wireframe; layout grid). The ViewCube snaps to 26 views (faces, edges, corners), drags to orbit, and has a home button. Drag a placed body to move it on the plate (`part_moved` in the log).
- **Edit the spec.** Each regulated field is a numeric input with its valid range printed beside it; Enter or blur applies, out-of-range values clamp with a message, and an edited value is chipped `L1 edited` with the datasheet value it replaced. Edits change the part itself: the rule table re-evaluates, the body resizes (pack energy → height, sensor elements → footprint), and an `attr_changed` event is logged. IMU bias and ARW can be cleared to “not published”.
- **Remove from design** empties the slot; the swap-comparison and attestation flow is unchanged for swaps between placed parts.

## Where the backend plugs in

`src/lib/service.ts` is the browser side of the seam described in the engineering direction (`backend/app/service.py`: `apply_change · rederive · now`). Today `service.evaluate()` answers locally from `src/lib/rules.ts`, a synthetic copy of the 14-row rule table so the shell renders an outcome. When the FastAPI service exists, replace that call with a POST to `/api/...` (Vite already proxies `/api` → `127.0.0.1:8000`) and render the response shape verbatim; the panels read an `Outcome` (`rules`, `cannot`, `cols`, `cruiseW`, `endurance`, `range`, `keys`) and nothing else. The log (`events`) should likewise come from the service; the store's `append` is the local stand-in for the signed chain.

## Layout

- `src/store.ts` — zustand store: shell state, selection, swap/confirm, span, extrude, demo scenario, timeline log.
- `src/lib/catalog.ts` — the fixture: parts, palette order, destination chart cells, key groups, seed events, scenario copy.
- `src/lib/rules.ts` — synthetic outcome engine over a `Design` (`parts`, editable `attrs`, `span`); to be replaced by the service.
- `src/lib/geometry.ts` — SVG axonometric renderer for the bracket and slot bodies (derived preview, never geometry truth).
- `src/lib/viewmodel.ts` — pure derivations: slot status words, overall status, needs-attention list, destinations strip, spec fields, flag cards.
- `src/panels/*` — TopBar, Browser (tree, eyes, drag-to-place), Viewport (+ drawing sheet, view cube, body move, drop placement), StatusPanel, SpecPanel (editable fields via NumField, swap card, span, no-change banner), Reasoning (attention, destinations, flags), Timeline, HelpOverlay, DemoBar.
- `tests/rules.test.ts` — F1–F4, F8 flips, edited-spec and empty-slot cases, and the Postel span parser.

## Claim ceiling

This is a slot-assembly editor with one parametric dimension and a rendered outcome. It computes nothing authoritative; the meshes are previews; every regulatory string is rendered from data and is subject to the say/never-say table in the UX doc §8.
