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

The model remains recognizable. Do not paint the entire aircraft red when one child fires; use an outline/pulse on the child and a separate parent badge or halo.

## Required interactions

1. Click a mesh → select its node, highlight the matching BOM row, open the inspector.
2. Click a BOM row or tripwire card → focus/highlight the matching mesh.
3. Toggle inspection/exploded mode → expose internal component anchors without pretending to be a full CAD editor.
4. Toggle “show all parts” → label the inventory, including clear nodes.
5. Toggle “show tripwires” → render only `question`, `watch`, and `flag` markers.
6. Click a marker → show causal fact, threshold, rule entry, exact source text, source date, evidence state, propagation path, and destination table.

## State mapping

- `clear`: neutral material plus small green/clear BOM status. Copy: “No implemented tripwire fired.”
- `watch`: amber outline/marker. Only render when the backend returns an explicit reviewed proximity result.
- `question`: amber dashed marker. Copy starts with the missing fact, e.g. “Needs one-month bias stability.”
- `flag`: red marker for EAR consequences; near-black marker for ITAR. Never rely on color alone—include icon, label, and text.
- propagated parent: ring/halo and “affected by [child]”; never imply the parent’s own parameter crossed the threshold.

## Data boundary

The component tree and all marker states come from FB-01 fixtures or `/evaluate`. React may select, filter, sort, focus, and style them. It may not compare engineering values to regulatory thresholds or invent a `watch` margin.

Every rendered object declares one `nodeId`. A development assertion fails on duplicate mesh bindings, response nodes with no UI representation, or a visible mesh with no node record.

## Implementation guidance

- Split the current monolithic `App.jsx` into small components: scene/model, assembly tree, marker layer, inspector, legend/status bar.
- A hand-built Kestrel made from Three.js primitives is acceptable. Attach semantic anchors to components instead of importing arbitrary CAD.
- Use raycast selection and `Html`/sprite markers that remain projector-readable.
- Keep state in one reducer/store keyed by `selectedNodeId` and `designRevision`.
- Support fixture mode from committed JSON so the full visual review does not depend on the backend.

## Acceptance

- A new viewer can identify at least eight components in inspection mode.
- Mesh, BOM, inspector, and marker selection stay synchronized for every visible node.
- The camera swap fixture visibly marks the camera and separately marks the airframe as propagated.
- The missing-gyro-evidence fixture renders a question, not clear.
- Reversing to the baseline fixture clears the relevant marker without losing the audit/change indication owned by FB-05.
- Keyboard focus can reach the BOM rows, markers have text equivalents, and status is not color-only.
- At 1280×720 and 1920×1080, the model, selected component, threshold, and rule entry are legible in one frame.
- No horizontal scroll, occluding inspector, or marker pile-up in the three canonical demo states.

## Visual falsifiers

- Feed an unknown node ID: show a loud contract error instead of dropping it.
- Feed a child and parent flag together: verify the causal distinction remains visible.
- Feed six simultaneous markers: verify labels do not obscure the aircraft; cluster/list if needed.
- Disable color: icon/text still distinguishes question, direct flag, and propagated flag.
- Resize to 1280×720: the canonical threshold and citation remain above the fold.

## Cut line

Keep mesh/BOM synchronization, in-context markers, inspector evidence, parent propagation, and the three canonical states. Cut drag-and-drop, freeform CAD authoring, arbitrary file import, photorealism, animation polish, and generalized exploded-view physics before cutting the causal overlay.
