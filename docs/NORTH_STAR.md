# Tripwire north star

Status: canonical for the DNHacks build as of 2026-09-05.

## The thesis

Export compliance should behave like an engineering constraint, not an after-the-fact legal excavation.

**Tripwire makes export-control consequences visible at design time. A designer can inspect what is in a CAD/BOM assembly, change a part or parameter, and immediately see—on the affected component and its parents—which deterministic, source-cited regulatory tripwires fired, what fact crossed the line, and what needs review before the design leaves CAD.**

This is the hackathon project. The product is the feedback loop between the design and the cited tripwire, not a general CAD system, a chatbot, or an autonomous legal determination.

## The six-second test

A person seeing the product for the first time must understand, without narration:

1. this is a real assembled product with identifiable parts;
2. a particular part or engineering parameter changed;
3. that change caused a visible flag on the part and, when applicable, the parent assembly;
4. clicking the flag explains the threshold, the observed value, the exact cited text, and the next human decision.

If the screen cannot communicate those four facts, the feature is not done.

## The canonical demo loop

1. Open the preloaded Kestrel fixed-wing drone as a CAD-style assembly model in inspection mode. This demo does not claim native CAD import or dimensional CAD accuracy.
2. Select a visible component. The model, BOM row, and inspector all identify the same `node_id`.
3. Make one bounded edit: change battery capacity or swap the thermal camera.
4. Run the deterministic evaluator. No model call occurs on this path.
5. Render the result in context:
   - the changed component is marked;
   - affected ancestors are marked separately;
   - the panel names the before/after fact and threshold;
   - the panel shows the rule entry, verbatim source text, content date, and evidence state;
   - destination consequences say `not evaluated` unless a separately approved policy artifact exists.
6. Reverse the change. The relevant flag clears and an in-memory before/after indication remains for the current demo run.

The winning run is two substantive edits plus a control: F1 battery/endurance, F3 thermal-camera swap with parent propagation, then F8 no-change to prove the system does not manufacture a visual delta. F2 span/range and the gyro path are excluded from P0 until their derived formulas and unresolved facts are governed.

## Product promises

Tripwire promises only what the local build demonstrates:

- **In-context inventory:** visible CAD objects resolve to typed product, assembly, and part records.
- **Deterministic feedback:** the same design, rule pack, and country chart produce the same findings offline.
- **Causal flags:** every rendered flag names the node, fact, operator, threshold, rule, and evidence used.
- **Propagation:** a controlled child can visibly affect its parent without hiding the causal path.
- **Honest uncertainty:** absent or incomparable facts render as a question, never as green or a guessed classification.
- **Reproducibility:** the build pins the rule pack and source date and can replay the committed F1/F3/F8 fixtures.

Tripwire does not promise a final legal classification, full EAR/ITAR coverage, arbitrary CAD authoring, autonomous filing, or a live-network-dependent result.

## Non-negotiable invariants

1. The live edit path is deterministic and offline.
2. USML is evaluated before CCL; EAR99 is unavailable until specific controlled entries have been rejected.
3. Missing evidence cannot satisfy a rule and cannot render as cleared.
4. A visual flag and its explanation are derived from the same evaluation result; the UI does not recreate legal logic.
5. Every mesh/BOM/inspector selection uses the same stable `node_id`.
6. Synthetic parts and synthetic facts are visibly labeled.
7. A rule quote is rendered only from the pinned local corpus or rule pack.
8. Builder-green is not acceptance. A different session must try to falsify the lane.

## Authority and precedence

For implementation questions, use this order:

1. this north star;
2. `docs/feature-bibles/00_INDEX.md` and the named feature bible;
3. frozen JSON schemas and test fixtures in this repository;
4. `THE_BUILD.md` as research and scenario detail;
5. older planning material as historical context only.

The `hackathon-dc-2026/bible/` set describes an earlier agent-gate concept. It is not implementation authority for Tripwire. Any conflict resolves in favor of the files above and must be recorded rather than silently blended.

## Definition of hackathon success

The project is demo-ready when a clean local start can perform the F1/F3/F8 canonical loop, every visible claim resolves to deterministic output or pinned evidence, the required automated and visual checks pass, and the entire run succeeds with network access disabled. A draft rule file, skipped F1/F3/F8 check, exact destination badge without approved policy, or fixture presented as live evaluation is a HOLD.

## The sentence to hold onto

**See the compliance consequence while the design is still changeable.**
