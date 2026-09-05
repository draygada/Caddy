# FB-03 — Visual model inspection and tripwire overlay

Owner lane: frontend. Priority: P0. This is the requested centerpiece.

## User story

As an aerospace designer, I can look at the 3D product and understand what components it contains and which specific components or parent assemblies have active or potential export-control tripwires, without first decoding a legal dashboard.

## First-frame layout

- Center: large, orbitable Kestrel model.
- Left or bottom: compact assembly/BOM tree grouped by assembly.
- Right: inspector/tripwire panel for the selected node.
- Top: design name, rule-pack date, offline/live-fixture state, and aggregate count.
- In-model markers: anchored badges for visible parts with `question` or `flag` states.

The model remains recognizable and uses a neutral airframe. Green paint must not imply legal clearance. Do not paint the entire aircraft red when one child fires; use an outline/pulse on the child and a separate parent badge or halo.

## Installed-component context

The P0 scene exposes five stable, always-discoverable locations:

| Scene slot | Bound design nodes |
|---|---|
| Nose | `nose_thermal` |
| Belly | `sensor_pod` and its children |
| Flight-controller bay | `fc_board`, `fc_mcu`, `io_mcu`, `imu`, `baro`, `mag`, `gnss` |
| Battery bay | `battery_pack` |
| Mast | `datalink` |

Each overview marker shows the slot, installed short MPN, and status. Interior locations use a translucent schematic cutaway and are explicitly labeled “schematic location”; dimensional CAD accuracy is not claimed. A separate `kestrelSlots` scene map binds anchors to node IDs and contains no regulatory facts.

## Required interactions

1. Click a mesh → select its node, highlight the matching BOM row, open the inspector.
2. Click a BOM row or tripwire card → focus/highlight the matching mesh.
3. Toggle inspection mode → expose internal component anchors without pretending to be a full CAD editor.
4. Toggle “show all parts” → label the inventory, including clear nodes.
5. Toggle “show tripwires” → render only `question`, `watch`, and `flag` markers.
6. Click a marker → show every causal fact/prerequisite, threshold, rule entry, exact source text, source date, evidence state, propagation path, and destination table.

## State mapping

- `clear`: neutral material plus small green/clear BOM status. Copy: “No implemented tripwire fired.”
- `watch`: amber outline/marker. Only render when the backend returns an explicit reviewed proximity result.
- `question`: amber dashed marker. Copy starts with the missing fact, e.g. “Needs one-month bias stability.”
- `flag`: red marker for EAR consequences; near-black marker for ITAR. Never rely on color alone—include icon, label, and text.
- propagated parent: ring/halo and “affected by [child]”; never imply the parent’s own parameter crossed the threshold.
- multiple flags: one marker with a count and accessible list; never stack unreadable badges.
- transient change/no-change: render additions/removals even when aggregate severity remains unchanged; F8 says “0 determinations changed” and does not pulse.
- pending/API error: retain the last confirmed state as visibly stale and show “Checking…” or “Evaluation unavailable”; never green.
- contract error: block the response and name the mismatched request, revision, digest, or node binding.

## Data boundary

The component tree and all marker states come from FB-01 fixtures or same-origin `/api/evaluate`. React may select, filter, sort, focus, and style them. It may not compare engineering values to regulatory thresholds or invent a `watch` margin.

Before FB-01 is frozen, layout scaffolding may use a visibly synthetic frontend-local mock. That mock is disposable pre-stage material, not a golden fixture or accepted contract evidence. An FB-03 candidate cannot pass until its design and all response states validate against the exact frozen FB-01 contract; stale aliases or scenario values are a HOLD.

Every rendered object declares one `nodeId`. A development assertion fails on duplicate mesh bindings, response nodes with no UI representation, or a visible mesh with no node record.

## Implementation guidance

- Split the current monolithic `App.jsx` into small components: scene/model, assembly tree, marker layer, inspector, legend/status bar.
- A hand-built Kestrel made from Three.js primitives is acceptable. Attach semantic anchors to components instead of importing arbitrary CAD.
- Use raycast selection and `Html`/sprite markers that remain projector-readable.
- Keep state in one reducer/store keyed by `selectedNodeId`, `designRevision`, and latest `requestId`.
- Support fixture mode from committed JSON so the full visual review does not depend on the backend.

## Acceptance

- A new viewer can identify all five installed locations without orbiting first and at least eight components in inspection mode.
- Every scene-map node exists exactly once in the baseline design; missing or duplicate bindings fail loudly.
- Mesh, BOM, inspector, and marker selection stay synchronized for every visible node.
- The camera swap fixture visibly marks the camera and separately marks the airframe as propagated.
- The F1 fixture marks the airframe result and identifies the battery as its causal input without claiming the battery itself crossed the airframe rule.
- The F8 fixture reports zero changed determinations and produces no false marker pulse.
- A missing-fact fixture renders a question, not clear.
- Reversing to the baseline fixture clears the relevant marker while preserving the in-memory change indication; FB-05 persistence is not required for P0.
- Keyboard focus can reach the BOM rows, markers have text equivalents, and status is not color-only.
- At 1280×720 and 1920×1080, the model, selected component, threshold, and rule entry are legible in one frame.
- No horizontal scroll, occluding inspector, or marker pile-up in baseline, F1, F3, F8, or missing-evidence states.

## Visual falsifiers

- Feed an unknown node ID: show a loud contract error instead of dropping it.
- Feed a child and parent flag together: verify the causal distinction remains visible.
- Feed six simultaneous markers: verify labels do not obscure the aircraft; cluster/list if needed.
- Disable color: icon/text still distinguishes question, direct flag, and propagated flag.
- Resize to 1280×720: the canonical threshold and citation remain above the fold.
- Feed a late response with an older `request_id`: it must not repaint the scene.
- Replace copy with “classified as”: a claims test must fail. P0 copy says “meets the parameters of” or “tripwire fired,” never that Tripwire issued a final classification.

## Cut line

Keep the five-location context layer, mesh/BOM synchronization, in-context markers, inspector evidence, parent propagation, and the canonical states. Cut board GLB/KiCad work, connector art, drag-and-drop, freeform CAD authoring, arbitrary file import, photorealism, animation polish, and generalized exploded-view physics before cutting the causal overlay.
