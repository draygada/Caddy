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

## Fusion-style tooling

- **Timeline strip** under the canvas: one icon per logged operation, oldest left. Drag the marker (or click an icon, or use ⏮ ◀ ▶ ⏭) to replay the design to that seq; everything is read-only while replaying, "Live" returns, and "Restore here" appends a `state_restored` event that supersedes the later ones. Every event carries its `Snapshot`; nothing is deleted.
- **Docked feature dialogs** (right edge of the canvas) with live preview and OK/Cancel: Extrude (E), Hole (H), Fillet, Chamfer, Move (M), Measure (I), Section analysis, Sketch, Properties, Save version, Add comment, Save named view.
- **Marking menu** on right-click: an eight-command wheel around the cursor (Select, Move, Hide, Isolate, Extrude, Measure, Section, Fit) plus an overflow list, targeting the body under the cursor.
- **Command box** on `S`: every command in `src/commands.ts`, searchable, recent ones pinned.
- **Sketch mode**: the plate profile with Fusion's constraint colours (black fully defined, blue under-constrained; amber redundant, red contradictory), constraint glyphs, DOF counts and stable codes from `src/lib/sketch.ts`; toggle constraints in the dialog to walk the contract's four states.
- **Isolate / section**: isolate any body from the marking menu or browser; the section dialog clips the model at an X/Y/Z plane you slide, cut faces outlined amber.
- **Selection filter** (components / bodies / faces) in the toolbar, pale-blue hover pre-highlight, stronger blue selection; a picked face shows in Properties (index within body, not a durable id).
- **Appearance**: per-component tint swatches in the browser.
- **Versions and comments**: Save version pins a seq with a comment (v1, v2…); comments attach to a state; both are folders in the browser and open the timeline at their seq.
- **Named views**: Home, Top, Front, Right plus saved cameras; "set" makes the current camera the home view.
- **Units**: Document settings › Units switches m / mm / in across the span input, dimension label, dialogs, sheet and measure readouts (storage stays in metres).

## Where the backend plugs in

`src/lib/service.ts` remains the browser side of the design-simulator seam. `service.evaluate()` answers locally from `src/lib/rules.ts`, a synthetic copy of the rule table, so Diego's CAD and product-status interactions stay responsive without being presented as authoritative.

`src/lib/tripwire.ts`, `src/tripwire-store.ts`, and `src/panels/TripwirePanel.tsx` are a separate live proof seam. They load `/api/candidate`, expose only the stable entities and exact request bindings supplied by that immutable candidate, POST the selected binding to `/api/compliance-at-design-click`, cryptographically validate the stamped response, and render the receipt under the `DRAFT_REVIEW_ONLY` / `HUMAN_REVIEW_REQUIRED` ceiling. The synthetic Kestrel preview is never silently mapped to the canonical bracket candidate.

## Layout

- `src/store.ts` — zustand store: shell state, selection, swap/confirm, span, extrude, demo scenario, timeline log.
- `src/lib/catalog.ts` — the fixture: parts, palette order, destination chart cells, key groups, seed events, scenario copy.
- `src/lib/rules.ts` — synthetic outcome engine over a `Design` (`parts`, editable `attrs`, `span`); to be replaced by the service.
- `src/lib/geometry.ts` — SVG axonometric renderer for the bracket and slot bodies (derived preview, never geometry truth).
- `src/lib/viewmodel.ts` — pure derivations: slot status words, overall status, needs-attention list, destinations strip, spec fields, flag cards.
- `src/panels/*` — TopBar, Browser (tree, eyes, drag-to-place), Viewport (+ drawing sheet, view cube, body move, drop placement), StatusPanel, SpecPanel (editable fields via NumField, swap card, span, no-change banner), Reasoning (attention, destinations, flags), Timeline, HelpOverlay, DemoBar.
- `tests/rules.test.ts` — F1–F4, F8 flips, edited-spec and empty-slot cases, and the Postel span parser.

## Claim ceiling

The design workspace is a slot-assembly editor with local preview tooling and a rendered synthetic outcome. It computes nothing authoritative; the meshes are previews. The Tripwire drawer is the distinct Candidate 0.1 proof: it binds one API-supplied stable entity to the immutable API-supplied revision and returns insufficient evidence requiring human review, never a compliance determination.
