# UX law audit: Caddy design flow

**Product**: Caddy frontend, local dev build at http://localhost:5173 (branch `diego-uiux-refinement`)
**Flow**: projects home to a sourced design: projects, new project, design workspace (model, spec, sketch, library, CAD authoring), classification, sourcing
**Viewports**: mobile 390x844 (thumb origin), desktop 1440x900 (center origin)
**Screens walked**: 17 (9 desktop, 8 mobile), including 2 forced states: a project created with the use-case questions skipped, and the sourcing gate that follows from it
**Method**: live browser walk with the in-page measurement probe on every screen, scored with the Tier 1 thresholds, then a judgment pass on the screenshots. Every finding below was fixed in the same change set and re-measured.
**Not covered**: the connected kernel and sourcing services (offline fixtures only), the Tripwire panel, dark theme contrast, and anything behind a real order send-off.

## Verdict

The flow had one structural problem and one design-system problem. Structurally, missing use-case answers were shouted from two places at once on every design screen (banner and status panel), and the sourcing tab used to show the pipeline before the answers existed. At the system level, the tree and checkbox targets were 13 to 18px, and nothing on a touch viewport reached 44px, because the tokens only defined desktop density. Both are fixed at the token level, so the fix covers all 17 screens rather than one.

Before: 45 Tier 1 findings, 6 blockers. After: 0 blockers, 0 WCAG 2.5.8 failures on any screen, and the remaining Tier 1 hits are density notes on the CAD workspace that are judged acceptable (see conflicts).

## Findings

### 1. WCAG 2.5.8 Target Size :: blocker, fixed

**Screen**: every design screen, worst `desktop/09-sketch` (36 targets) and `mobile/04-browser` (25)
**Measured**: browser tree expand, collapse, hide and tint buttons were 18x18 with 4px spacing; the tree filter was 19.6px tall; intake and sketch checkboxes were 13x13
**Threshold**: 24x24 CSS px or 24px clear spacing (hard, Level AA)
**Why it matters**: the tree is the primary way to select and hide parts; a mis-tap selects the neighbour.
**Fix**:
```css
.tree-btn { width: 24px; height: 24px; border-radius: 6px; }
.tree-row { grid-template-columns: 24px 24px 24px minmax(0, 1fr) auto; min-height: 28px; }
input[type="checkbox"] { width: 24px; height: 24px; accent-color: var(--accent); }
```
Re-measured: 0 failures on all 17 screens.

### 2. Fitts's Law / WCAG 2.5.5 on touch :: high, fixed

**Screen**: all 8 mobile screens, worst `mobile/04-browser` (54 targets under 44px)
**Measured**: top bar buttons 32px, workspace tabs 32px, mode row 39px, nav toolbar 32x32, tree rows 26px
**Threshold**: 44x44 on touch (soft but near-universal)
**Fix**: a touch media block that raises the same tokens without touching desktop density.
```css
@media (max-width: 820px), (pointer: coarse) {
  .btn, .nav-btn, [role="tab"], [role="radio"], .tree-row, .field { min-height: 44px; }
  .btn-icon, .nav-btn { min-width: 44px; }
  button.chip, a.chip { min-height: 44px; }
  .row-hover { min-height: 44px; }
}
```
Re-measured on `mobile/03-design-model`: 20 misses down to 0. Residual: the 24px tree glyph buttons stay at AA size on purpose (44px rows would double the tree's height); they sit in 44px rows so the row itself is the touch target.

### 3. Von Restorff Effect :: high, fixed

**Screen**: `desktop/03-design-empty`, `desktop/06-library`
**Measured**: two "Answer the questions" primary buttons within 0.1% of each other's salience (524.6 and 523.9), one in the banner and one in the status panel
**Threshold**: one element tops the salience ranking
**Fix**: the banner keeps the primary button; the status panel's copy of it became a quiet `btn btn-xs` labelled "answer them". Re-measured: no competing primaries on those screens.

### 4. Default Effect, dark-pattern gate :: high, fixed

**Screen**: `desktop/02-new-project`, `mobile/02-new-project`, `desktop/05-sourcing-gate`
**Measured**: "declared a civil product" was pre-checked on a form whose whole point is declared, never inferred, facts
**Threshold**: declarations default to off
**Fix**: `INTAKE_DEFAULT.civilProduct = false`; the Kestrel demo project declares it explicitly. Re-measured: 0 pre-checked declarations. The sketch constraint checkboxes also read as "pre-checked" to the probe; those are model state, not consent, and were left alone.

### 5. Hick's Law on the new-project form :: high, chunked

**Screen**: `desktop/02-new-project`
**Measured**: 14 simultaneously visible controls in one panel
**Threshold**: 7 (soft)
**Fix**: the intake form is now three labelled fieldsets (use case, shipping, declarations) and stacks to one column below 640px. Count is unchanged at 12 to 14 because nothing was removed; Hick degrades for labelled, scannable groups and deleting a question would move its complexity onto classification.
**Conflict**: Tesler's Law, resolved by chunking rather than cutting.

### 6. Nielsen H3, user control and freedom :: high, fixed

**Screen**: 13 screens had no back, cancel, close or undo control by accessible name
**Measured**: the logo returned to projects but was an unnamed button
**Fix**: the logo is now `<a href="/" aria-label="Back to all projects">`, which is also the Jakob's Law convention (finding 9). Modals already had "Cancel · Esc" and "Close · Esc". The projects home itself is the root and correctly has no exit.

### 7. Nielsen H1, visibility of system status :: medium, fixed

**Screen**: 10 screens with no live region, including projects home, the new-project modal and the sourcing gate
**Fix**: `role="status"` on the projects count, the "not sure yet" warning in the modal, the sourcing gate header, the browser's placed count, and a screen-reader status for the active view mode. The status panel already had `aria-live`.

### 8. Mobile command launcher :: high (judgment), fixed

**Screen**: `mobile/03-design-model`
**Measured**: the floating black "Commands" block topped the salience ranking at 1214, more than twice the active tab (507), and covered the right end of the navigation toolbar
**Fix**: it is now a 44px icon button in the standard `btn` family, bottom-left, away from the toolbar, and hidden at widths where the top bar already shows Commands.

### 9. Jakob's Law :: low, fixed

**Screen**: all 17
**Measured**: logo did not link home and the bar was not a `<header>`
**Fix**: header element plus a root link on both bars. Re-measured: `logoLinksHome: true`.

### 10. Mobile layout breakage :: high (judgment), fixed

**Screen**: `mobile/02-new-project`, `mobile/08-sourcing`, top bar on every mobile screen
**Evidence**: name and description in a forced two-column grid with truncated selects; "Run the search · source this design" overflowing its card; "Dark theme" clipped off the right of the top bar
**Fix**: intake and modal grids are `grid-cols-1 sm:grid-cols-2`; the run button is `w-full sm:w-auto`; the theme button is icon-only below 640px with a full accessible name.

### 11. Aesthetic-Usability, spacing grid :: low, mostly fixed

**Measured**: 10px paddings on buttons, fields and panel heads put 100% of sampled spacing off the 4/8 grid
**Fix**: `.btn` and `.field` padding 0 12px, `.panel-head` 8px 12px, `.chip` 4px 8px, `.tree-row` 28px. The residual off-grid values are Tailwind arbitrary paddings inside the CAD authoring page and are cosmetic.

### 12. Law of Similarity :: medium, partly addressed

**Measured**: 11 to 13 distinct button treatments on the design screens
**Assessment**: most of the count is the same three families (btn, btn-xs, tree-btn, nav-btn) at different font sizes and the transparent tree rows the probe counts as buttons. Radius was unified to 6px. Further reduction is a design-system decision, not a screen fix, and is left as a note.

### 13. Hick's Law on the design workspace :: high (measured), accepted

**Measured**: 51 to 68 enabled controls on the model, spec, sketch and CAD authoring screens
**Assessment**: this is a CAD workspace; the controls are grouped into labelled panels (browser tree, mode row, nav toolbar, status, spec) and the law does not apply to scannable labelled sets. Progressive disclosure already exists (collapsed tree sections, the library behind a button, the docked sketch panel). No change.

## Conflicts and trade-offs

- **Tree glyph size versus tree density.** WCAG 2.5.8 wants 24px, WCAG 2.5.5 wants 44px. The glyph buttons are 24px on all viewports and sit in 44px rows on touch, so the row is the finger target and the glyph is the pointer target. Going to 44px glyphs would make the browser tree scroll on every phone.
- **Two "Answer the questions" buttons versus visibility.** Removing the second copy loses one entry point in the status panel, but it stays reachable as a small link and from the top-bar chip. One primary is worth more than two paths.
- **Chunking versus cutting on the intake form.** Nothing was removed; the answers feed classification and sourcing. The form got structure instead.

## What we did not break, and should not

- Three tabs only. The audit found no reason to add a fourth.
- The sourcing gate: with incomplete answers the tab shows only the form. That is the correct Tesler placement of complexity.
- Every status word is paired with a colour, never colour alone.
- The spec panel clamps out-of-range values and says so, which is the right Postel behaviour.
- Escape closes every overlay and the marking menu.

## What to instrument next

| Law | What it needs | Suggested instrumentation |
|---|---|---|
| Peak-End Rule | How the sourcing send-off is remembered | One-question survey after the first sealed package |
| Pareto Principle | Which of the ~60 workspace controls are used | Click event per command id, 30 days |
| Choice Overload | Whether the 17-type component library helps or hurts placement | Time from library open to first placement, by list length |
| Doherty Threshold | Real INP on the viewport during orbit and drag | PerformanceObserver for event timing in the dev build |
| Flow | Time-on-task by tenure | Session length and edits per session, first-week versus later |

## Method notes and limits

Target size, contrast, salience, live regions, escape hatches and logo links came from the probe. No contrast failure was found on the light theme; the dark theme was not measured. Fitts index of difficulty was reported by the probe but not acted on: on desktop the primary actions sit at 4.8 to 5.5 and the flow has no single dominant CTA once inside the workspace. Hick and Similarity counts are facts, but the decision to accept them on the CAD screens is judgment. Findings 8 and 10 are judgments from screenshots. A usability test would catch what the probe cannot: whether the library dialog's "Add" versus "Add and place" split is understood, and whether people find the CAD authoring mode at all.
