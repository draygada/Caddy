# UX law audit: projects to customs filing

**Product**: Caddy frontend, http://localhost:5173, branch `diego-uiux-refinement` at `3af350d`
**Flow**: projects home, open Merlin, Design, Classification, Sourcing step 1 (use case), step 2 (pick suppliers), step 3 (package and order), step 4 (customs filing draft); the use case dialog and the new project dialog
**Viewports**: desktop 1440x900, phone 390x844
**Screens walked**: 19, including 3 forced error states (package built with open lines, units typed as 0 and as 251, a reload in the middle of a round)
**Method**: live browser walk with the ux-law-audit probe injected into the page; Tier 1 findings are DOM measurements, Tier 2 are judged from the screenshots and labelled as such. The phone pass was driven by dispatched clicks because pointer clicks timed out under touch emulation; rects and styles are real, the touch itself was not exercised.
**Not covered**: a complete package (all sixteen lines picked), the order staging path, the connected service round against the live product service, the classification reasoning modal.

## Verdict

The desktop flow is in good shape: one primary action per sourcing screen, an honest stepper, refusals in the product's own words, no contrast failures and no target-size failures. The phone is where the flow broke: the stepper overflowed into its neighbours, the pick radio stretched into a 24x44 oval, the floating command palette button sat on top of the parts list, and the main action of steps 1 and 3 sat below the fold. Every one of those is fixed in `3af350d`. The one high finding left open is that a round lives in memory only, so a reload loses the picks; that is a policy decision under the hackathon data boundary, not a screen defect.

## Findings

### 1. WCAG 2.5.5 target size on touch :: high (fixed)

**Screen**: `m05-step2-offers`, `m06-pick-panel`, `m08-package` (phone)
**Measured**: 6 targets under 44px: the pick radios at 24x44, the inactive stepper circles at 40x44, Re-screen at 78x36
**Threshold**: 44x44 CSS px on a touch viewport (Apple HIG; Material 48dp)
**Why it matters**: finger input has positional variance a cursor does not; the radio is the one control that commits a pick
**Fix**: the radio is a 24px ring inside a 44x44 button on phones (`max-sm:w-11 max-sm:h-11`); stepper buttons carry `max-sm:min-w-11`; `.btn-xs` is 44px tall on touch viewports.
**Conflict**: panel heads grow on phones. Density lost to an accessibility floor is the right trade on the ladder.

### 2. Figure and ground, Fitts :: high (fixed)

**Screen**: `m04-sourcing-usecase`, `m05-step2-offers`, `m08-package` (phone)
**Measured**: judgment. The fixed command palette opener (44x44, bottom left) covered the use case labels, the second offer card and the pick list.
**Why it matters**: the palette runs CAD commands; on the Sourcing and Classification tabs it had nothing to offer and hid content the user was reading
**Fix**: `CommandBox` renders the floating opener only while the design workspace is the active tab. Cmd+K still opens the palette everywhere, so the accelerator for repeat users is intact.

### 3. Gestalt continuity, Prägnanz on the stepper :: high (fixed)

**Screen**: `m05-step2-offers`, `m08-package` (phone)
**Measured**: judgment. Four equal 97px columns: the active label "Package and order" overflowed its cell and painted over the step 2 circle; the counter rendered as "0 o".
**Why it matters**: the stepper is the flow's only map; a stepper that reads wrong costs trust in every later step
**Fix**: on phones the list is a flex row; the active step takes the remaining width and truncates, the other steps are 44px circles, the connectors and the counter hide.

### 4. Fitts, primary action below the fold :: medium (fixed)

**Screen**: `m04-sourcing-usecase` (Find suppliers, ID 5.42, below the fold), `m06-pick-panel` (Pick GetFPV, below the fold), `m08-package` (Build the package, below a sixteen-row list)
**Threshold**: primary action visible without scrolling; ID under 4.0 comfortable, over 5.5 a finding
**Fix**: the step 1 call to action is sticky at the bottom of its scroller on phones with an opaque ground and a top rule; the package panel is ordered before the pick list on phones (`max-md:order-2` on the list); the sign-off block scrolls into view when an offer is picked on a phone.
**Conflict**: the sticky block hides about 90px of scrolling content on a phone. Content scrolls under it and nothing else in the flow was harmed.

### 5. Nielsen H9, recovery from the package refusal :: high (fixed)

**Screen**: `09-package-refused` (desktop)
**Measured**: judgment. "refused: 15 lines without a selection: Thermal imaging core, …" named the problem; the only way back was the footer's Back to suppliers, which landed on the current part, not an open one.
**Fix**: the refusal now carries a button "Go to Thermal imaging core · the first open line" that opens step 2 on that line. The refusal keeps the product's own word, refused, and stays in a `role=alert` region.

### 6. Nielsen H1, the round drifts from the declared use case :: high (fixed)

**Screen**: `04-sourcing-usecase` after editing units (desktop)
**Measured**: judgment. With round r1 open at 25 units, saving 251 units in the use case dialog left the round chips at QTY 25 and no notice anywhere. The stale bar only watched the design hash.
**Why it matters**: the landed estimate, the MOQ checks and the package all read the round's quantity, so the user was looking at numbers for a use case they had just changed
**Fix**: the stale bar also fires when units, destination or transport differ from the round, says both values, and "Open round r2" takes the current use case rather than the old one.

### 7. Nielsen H2, Skip did not skip :: medium (fixed)

**Screen**: `07-after-pick-part2` (desktop)
**Measured**: judgment. Skip moved to the next part and recorded nothing; the line stayed open and the package button still counted it.
**Fix**: the button reads "Skip for now" when the part has no pick and "Next part" when it has one.

### 8. Nielsen H4, two controls named Model :: medium (fixed)

**Screen**: `m02-design` (phone)
**Measured**: Von Restorff competition: Model (mode radio, salience 507.6), Design (465), Model (panel tab, 431.2)
**Fix**: the phone panel tab is "Viewport"; the mode radio keeps "Model".

### 9. Nielsen H1, the units field corrects silently :: low (fixed)

**Screen**: `11-intake-dialog` (desktop)
**Measured**: typing 0 saved as 1; typing 25 after an existing 1 saved as 251 with no message
**Fix**: the label now reads "units · 1 to 500". The clamp stays: accepting and correcting is the Postel-correct behaviour, it only needed to be visible.

### 10. Type floor :: low (fixed)

**Screen**: `05-step2-offers` (both viewports)
**Measured**: 11px on the parts nav group headers and on the per-unit caption; the rest of the product holds a 12px floor
**Fix**: both are 12px.

### 11. Fitts, Print the draft :: medium (fixed)

**Screen**: `10-customs-draft` (desktop)
**Measured**: index of difficulty 5.63 at 116x32 in the bottom right corner
**Fix**: the button is the 44px large variant; the corner position stays because the draft is a read-only screen and the footer is its natural home.

### 12. Zeigarnik, Nielsen H3: a round does not survive a reload :: high (open)

**Screen**: observed between the desktop and phone passes
**Measured**: the round opened on the desktop pass was gone after a reload; projects, picks and the attestor name reset
**Why it matters**: sixteen picks with typed attestations is real work; losing it on a refresh is the classic multi-step form failure
**Fix, proposed**: session-scoped persistence of the round (sessionStorage keyed by project, cleared on a new tab) if the memory-only rule under the hackathon data boundary allows it. Not changed here because that rule is Benji's, not a UI call.

## Measured and not findings

- **Hick's Law** fired on the 16-line parts nav, the 66-node design tree, the 14 controls of the intake dialog and the 20 rows of the package list. These are scannable, labelled, chunked lists (Components and Fixed lines groups; use case, shipping and declarations fieldsets). Hick's Law was measured on unfamiliar equiprobable stimuli and degrades for exactly this shape. No change.
- **Law of Similarity** reported 6 to 12 "button treatments" per screen. Most are rows and tree items that are buttons semantically. The one real inconsistency is `.btn` at 13px beside 14px large buttons on the same footer; left as is.
- **Default effect** flagged "declared a civil product" as pre-checked. It is pre-checked on the two seeded projects because their intake declares it; a new project starts unchecked. Not a consent pattern.
- **Contrast**: no failures on any screen. **Label proximity**: no violations. **Pre-checked opt-ins, urgency language, suppressed focus rings**: none.
- **Nielsen H1 live regions**: Classification and step 1 have none, and also have no async state. The refusal, the footer counter and the pick hint are `role=alert`, `role=status` and `aria-live=polite`.

## What we did not break, and should not

- One primary action per sourcing screen; Von Restorff was clean on every sourcing screen at both sizes.
- The stepper reports real steps and real counts; nothing is endowed.
- A pick is a human act: the name is required, never pre-filled, and goes on the record with the pick.
- Refusals use the product's own words and never partially succeed.
- Every dialog has × and Esc; the logo links home; the Enter key submits nothing destructive.

## What to instrument next

| Law | What it needs | Suggested instrumentation |
|---|---|---|
| Pareto Principle | Which tab and which sourcing action carry the use | Event per tab switch and per footer action, 30 days |
| Peak-End Rule | How the package moment is remembered | One-question prompt after "Build the package" succeeds |
| Choice Overload | Pick time against offers per part | Time from part open to pick, bucketed by offer count |
| Flow | Challenge against skill | Time on task per step by user tenure |
| Zeigarnik | Whether people come back to an open round | Rounds reopened after a return visit, once persistence exists |

## Method notes and limits

Numbers came from the skill's probe (bounding rects, computed styles, salience, Fitts against viewport centre on desktop and the thumb rest on the phone). The phone pass used dispatched clicks, so touch-specific behaviour such as hover fallbacks and scroll momentum was not exercised. The 7-item Hick and Miller thresholds are soft conventions and were not acted on. A real usability test would catch what this cannot: whether the attestor concept lands with a first-time buyer, and whether sixteen sequential picks feel like progress or like a chore.
