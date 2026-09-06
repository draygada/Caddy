# UX law audit: Sourcing tab

**Product**: Caddy frontend, local dev build at http://localhost:5173 (branch `diego-uiux-refinement`, after the three-step sourcing rebuild in `720cdbd`)
**Flow**: Sourcing tab from the declared use case to the package: step 1 (use case), step 2 (pick suppliers, before and after selecting an offer), step 3 (package and order)
**Viewports**: desktop 1440x900 (center origin), mobile 375x812 (thumb origin)
**Screens walked**: 8 (4 desktop, 4 mobile). The gated state with incomplete answers was walked and fixed in the 2026-09-06 design-flow audit and its form is unchanged, so it was not re-walked.
**Method**: live browser walk with the in-page measurement probe on every screen, then a judgment pass on the DOM against the rest of the app (Design tab, Classification tab, Settings). The brief was: does Sourcing follow the same style and the same simplification as the rest of the page. Every finding below was fixed in the same change set and re-measured.
**Not covered**: the connected operations and order services (the offline round only), printing the supplier request, the escalation lane with a live proposal, dark theme contrast.

## Verdict

The rebuilt tab already matches the rest of the app structurally: one surface per step, the panel and button families from `index.css`, a single primary per screen (measured: no competing primaries on any of the 8 screens). What it missed were the floors: a hand-drawn 16px radio that failed WCAG 2.5.8 and contrast, 24px stepper buttons and 18px disclosure summaries that failed the touch threshold, a 14-item ungrouped parts list, and a step-2 checkmark that showed done with zero picks. All fixed; after the changes there are 0 WCAG 2.5.8 failures on all 8 screens and the only residual touch misses are the 24px-wide radio inside a 44px row and one 36px "Re-screen" button.

Before: 3 Tier 1 blocker-or-high findings (target size, contrast, honesty of progress), plus Miller and Nielsen H1 misses. After: 0 blockers, 0 AA target failures, 0 text contrast failures, 0 ungrouped lists over 7.

## Findings

### 1. WCAG 2.5.8 Target Size :: blocker, fixed

**Screen**: desktop and mobile `02-pick`, `03-pick-selected`
**Measured**: the offer radio was 16x16 with 12px spacing (desktop) and 16x44 (mobile); the "recorded as declined" summary was 1062x16.8
**Threshold**: 24x24 CSS px or 24px clear spacing (hard, Level AA)
**Why it matters**: the radio is how a supplier is chosen; a miss lands on the neighbouring offer's name button.
**Fix**: 24px radio with a 2px ring, grid column widened to match; every `<summary>` is a 32px flex row (44px below 640px).
```tsx
<button role="radio" className="w-6 h-6 rounded-full border-2 ..." />
<summary className="cursor-pointer flex items-center min-h-8 max-sm:min-h-11">
```
Re-measured: 0 AA failures on all 8 screens.

### 2. Contrast on the offer radio :: high, fixed

**Screen**: `03-pick-selected`, both viewports
**Measured**: 2.14:1 on the checked radio (ink text colour inherited over the accent fill), 4.5 needed
**Fix**: the radio sets its own foreground, accent-foreground when checked and muted when not, and its ring is `--muted` instead of the 16% hairline, so both states read on light and dark grounds.

### 3. Fitts's Law / WCAG 2.5.5 on touch :: high, fixed

**Screen**: all 4 mobile screens
**Measured**: stepper buttons 93x24, 187x24, 159x24; "Details" and "Adjudicate" 36px; disclosure summaries 18px
**Threshold**: 44x44 on touch (soft)
**Fix**: stepper buttons `min-h-8 max-sm:min-h-11` with 4px horizontal padding and the app radius; "Details · owners, estimate" and "Adjudicate" promoted from `btn-xs` to `btn` (32px desktop, 44px touch via the existing touch media block); summaries as above.
Re-measured on mobile `02-pick`: 6 misses down to 2. Residual: the 24px radio inside a 44px row (the row's name button is the finger target, same trade as the browser tree glyphs) and "Re-screen" at 36px, which is a repeat-user action kept small on purpose.

### 4. Miller's Law, ungrouped list :: medium, fixed

**Screen**: `02-pick`, both viewports
**Measured**: the parts list had 14 items in one `<nav>` with no grouping; Hick worst choice count 14
**Threshold**: chunk lists over 7 (soft)
**Fix**: the list is two labelled groups, "Components · 7" (lines with a slot on the plate) and "Fixed lines · 7" (harness, cells, airframe and the like), each a `role="group"` with a mono eyebrow. Nothing was removed: the choice count is a property of the round, so chunking beats cutting.
**Conflict**: Hick's Law still reports 13 to 14 choices in the container. Accepted: it is a navigation list, not a decision, and the user scans it by name.

### 5. Goal-Gradient honesty :: high, fixed

**Screen**: `04-package`, both viewports
**Measured**: on step 3 the stepper drew a checkmark on "Pick suppliers · 0 of 14"
**Threshold**: progress markers must reflect true state (dark-pattern gate)
**Fix**: a step is done only when its own condition holds: step 1 when the use case is complete, step 2 when every line has a pick, step 3 never.
```ts
const done = st.n === 1 ? !incomplete : st.n === 2 ? r != null && n > 0 && selectedCount === n : false;
```
Re-measured: the stepper on step 3 with 0 picks reads "✓ Use case · 2 Pick suppliers · 0 of 14 · 3 Package and order".

### 6. Nielsen H1, visibility of system status :: medium, fixed

**Screen**: all step-2 screens
**Measured**: 0 live regions, no stepper text the probe could find
**Fix**: the footer's "part k of n" is a `role="status"` region and says "· picked" once the line has a pick; the stepper list carries an accessible name "Sourcing steps · step 2 of 3". Re-measured: 1 live region on step 2. Step 1 and step 3 have none by design; their state is the panel content itself.

### 7. Law of Similarity, style parity with the rest of the app :: medium (judgment), fixed

**Screen**: `02-pick`, `03-pick-selected`
**Evidence**: the offer cards, the blocking-gate box, the pick box and the two disclosures were hand-styled `border rounded-r bg-surface` divs while every other surface in the app (Design panels, status card, Settings, Classification rows) uses `.panel`. Distinct button treatments on the pick screen: 12 before, 11 after.
**Fix**: all five use `.panel` with only the border colour overridden for state (focus for the selected offer and the pick box, red for a blocking gate, amber for escalation). The "Adjudicate…" ellipsis label became "Adjudicate", matching the app's plain imperative labels.

### 8. Mobile reach of the primary :: medium (judgment), partly fixed

**Screen**: mobile `03-pick-selected`
**Measured**: the primary "Pick … · next part" was below the fold; the parts list took 38% of the viewport height
**Fix**: the list is capped at 30vh on phones so the offers and the pick box start higher. The primary can still fall below the fold when an offer has its details open; that is the user's own disclosure and scrolls naturally.

### 9. Hick's Law on step 2 :: measured, accepted

**Measured**: 13 to 14 enabled controls in the offers column
**Assessment**: two offers with a radio, a name, Details and (for a blocked seller) Adjudicate, plus the footer. The count is the round's shape. Progressive disclosure is already in place for owners, the cost ladder, escalation and the supplier request. No change.

### 10. Aesthetic-Usability, spacing grid :: low, accepted

**Measured**: 7 of 13 sampled spacing values off the 4/8 grid on the selected-offer screen (down from the same on the first pass)
**Assessment**: the residue is the 2px ring inset, the 5px dot offset and the 12px panel padding that the rest of the app also uses. Cosmetic; left alone.

## Conflicts and trade-offs

- **Radio width versus row density.** A 44px radio would double the height of every offer row on phones. The 24px control meets the hard AA floor and the 44px row is the touch target, the same resolution the design-flow audit used for the browser tree.
- **Chunking versus a flat list.** Two groups add two eyebrow rows to the list. Worth it: the fixed lines (harness, cells, airframe) are things the user cannot change on the plate and reading them apart from the placed components is the point.
- **Honest progress versus reassurance.** Removing the step-2 checkmark makes step 3 look less finished with open lines. That is the truth: the package can be built with open lines, and the footer's "Package · 13 open" already says so.

## What the rest of the app should keep doing

- One step per screen, three steps total, the stepper across the top: the same shape as the three tabs and the Settings sections.
- Every surface a `.panel`, every action a `.btn`, state only as a border colour or a status word paired with colour.
- The blocking gate stays inline and red where the pick is made, never behind a disclosure.
- Escape and the X close the tab; Back and Skip are always present in the footer.

## What to instrument next

| Law | What it needs | Suggested instrumentation |
|---|---|---|
| Pareto Principle | Which of Details, Adjudicate, Escalation and Ask the supplier are used | Click event per control id per round |
| Peak-End Rule | How the package and order step is remembered | One-question survey after "Build the package" |
| Doherty Threshold | Interaction latency on pick and Re-screen | PerformanceObserver event timing in the dev build |
| Choice Overload | Whether two or three offers per line changes pick time | Time from line select to pick, by offer count |

## Method notes and limits

Target size, contrast, salience, live regions, chunking and Fitts came from the probe on the live DOM at both viewports. Screenshots from the browser pane were unreliable during this run, so the Tier 2 findings (style parity, mobile reach) are judged from the DOM and computed styles rather than pixels, and are labelled as judgment. The probe reports a textless radio's colour as a contrast pair; the fix sets a real foreground so the number is honest either way. The gated intake state and the escalation lane with a live proposal were not re-walked.
