# UX law audit and design audit: the merged sourcing pipeline

**Product**: Caddy frontend, local dev build at http://localhost:5173, branch `diego-uiux-refinement` after merging `ship/hardened-drone-candidate-0.2` (Benji's backend, proxies and product thread) and `lane/sourcing-search` (the sourcing and search lane)
**Flow**: Sourcing tab, four steps: Use case, Pick suppliers with the connected service round open, Package and order, Customs filing. Plus the CAD authoring workspace that came over from the ship branch, because it is the one surface that did not match the design system.
**Viewports**: desktop 1440x900 (center origin), mobile 375x812 (thumb origin)
**Screens walked**: 6 (desktop: pick with service round, filing, authoring; mobile: pick with service round, filing) plus the earlier 8-screen sourcing walk this pipeline builds on
**Method**: live browser walk with the in-page measurement probe (target size, contrast, salience, live regions, chunking, spacing grid, font sizes), then the impeccable code-level audit on the five dimensions. Tier 1 findings are measured. Tier 2 are judged and labelled. Everything fixed was re-measured.
**Ownership**: Benji owns the backend (product service, proxies, the sourcing and search lane). We own the UI and UX. The audit only touches the surface; where the backend does not yet expose something, the UI says so rather than pretending.

## Verdict

The merged pipeline reaches the browser through two honest seams: the enumerated `/api/sourcing/*` and `/api/orders/*` proxy routes to the product service, and the product-thread artifact gate that blocks package and order until the CAD output identities exist. The UI now carries both seams inside the four-step sourcing tab without adding a single new control family. The two things the audit found were the same two the last audit found on Benji's surfaces: type below the legibility floor and controls below the target floor, both in the authoring workspace. Both are fixed at the constant level, so the fix covers every control in that file.

The customs filing is the one genuinely new surface. It is computed in the browser from the round's own ladders, mirroring the lane's `package.py` line for line, so when the product service exposes the package artefacts the view reads them 1:1.

Measured after the changes, all six screens: 0 WCAG 2.5.8 failures, 0 text contrast failures, 0 text nodes under 12px, no horizontal scroll on mobile, no competing primary actions.

## Impeccable audit health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 4 | 0 WCAG 2.5.8 failures, 0 contrast failures, 0 unlabeled inputs across 22 authoring fields, on every walked screen |
| 2 | Performance | 3 | no layout-property animation anywhere; the filing table renders once per round; authoring re-renders on every keystroke of its own state, acceptable for a workshop |
| 3 | Responsive design | 3 | no horizontal scroll at 375px on any sourcing step; the filing table scrolls inside its own container; authoring collapses to one column below 1000px |
| 4 | Theming | 4 | 0 literal hex colours left in Sourcing, Classification, Settings, TopBar and (after this change) AuthoringWorkspace; every colour is a token and both themes resolve |
| 5 | Anti-patterns | 3 | one type family, restrained accent, no gradients, no card grids; residual: authoring still uses inline style objects rather than the class families |
| **Total** | | **17/20** | **Good: address the weak dimensions** |

### Anti-patterns verdict

Pass. The surface reads as a tool: Work Sans throughout, Geist Mono for identifiers and numbers, the logo green as the only accent, status words always paired with colour, panels and disclosures for depth. The one tell that arrived with the merge was a gradient header and a hand-picked green palette on the authoring workspace; both are gone.

## Findings

### 1. Legibility floor on the authoring workspace :: high, fixed

**Screen**: `desktop/authoring`
**Measured**: 56 text nodes under 12px, the smallest 6px; inline `fontSize` declarations of 8, 9, 10 and 11
**Threshold**: 12px minimum for UI text, 13px for body (soft, but 6px is unreadable at any DPI)
**Fix**: every inline font size below 12 raised to 12 at the source; the constants for buttons and fields set 13px.
Re-measured: font sizes on the screen are 12, 13, 14 and 23; the two SVG placeholder labels at 6px and 8px were raised with the rest, so 0 nodes under 12px remain.

### 2. WCAG 2.5.5 and control family on the authoring workspace :: high, fixed

**Screen**: `desktop/authoring`
**Measured**: 17 of 23 buttons under 32px (smallest 25px), 77 targets under 44px, padding on a 7/9px grid (49 of 53 sampled spacing values off the 4px grid)
**Fix**: the `button`, `actionButton`, `field` and `card` constants now match the design system: 32px minimum height, 0 12px padding, 6px radius, the accent for the primary action, the line and surface tokens for everything else.
Re-measured: 0 buttons under 32px, 0 targets under 24px (the disclosure summaries are 32px rows and every button has a 32px minimum width), spacing residue 1 of 5.

### 3. Theming on the authoring workspace :: medium, fixed

**Measured**: 35 distinct literal hex colours and a `linear-gradient` header background in the merged file
**Fix**: mapped to the tokens (bg, surface, surface2, line, line2, ink, muted, accent, focus, amber, red) with amber and red tints as `color-mix` over the surface so dark mode resolves. Re-measured: 0 literal colours.

### 4. Nielsen H1 on the connected service round :: medium (judgment), kept

**Screen**: `desktop/02-pick-service`, `mobile/02-pick-service`
**Evidence**: the product service reachable from this machine is a Candidate 0.1 snapshot without `/api/sourcing` routes, so the connected round returns `ROUTE_NOT_FOUND`; the product-thread gate reads `BLOCKED_MISSING_CAD_ARTIFACTS` until a CAD output is registered
**Assessment**: this is the right behaviour. The UI shows the gate as an alert with the exact code and the reason, the round state as a chip, and the service error verbatim. Nothing is faked. Both are live regions (measured: 2 on the screen). What changes today is on Benji's side: run the merged product service locally or point `VITE_API_TARGET` at the deployment that carries the routes.

### 5. Hick's Law on the pick step with the service round open :: measured, accepted

**Measured**: 50 interactive elements on desktop, 49 on mobile, worst decision container 14
**Assessment**: the service round is behind a disclosure and closed by default, so the count only applies once the user opens it. Inside it the controls are the service's own vocabulary (input lane, offer, hold, package, dispatch, order lifecycle). Progressive disclosure is the correct placement. No change.

### 6. Fitts's Law on mobile, service round :: low, accepted

**Measured**: the primary "Create connected bounded round" sits below the fold on mobile once the disclosure is open
**Assessment**: it is inside a section the user just opened by choice and scrolls into reach. The two residual 44px misses on that screen are the 24px radio in its 44px row and the 36px Re-screen button, both accepted in the previous audit.

### 7. Miller's Law on the filing draft :: pass

**Measured**: the pre-entry table is one row per picked line with the layers, valuation and flags behind a per-row disclosure; 11 interactive elements on desktop, 12 on mobile; 0 ungrouped lists over 7
**Assessment**: nothing to fix. Lines without a pick are named in a live region rather than silently dropped.

### 8. Doherty Threshold :: measured, pass

**Measured**: 0 long tasks over 50ms on any walked screen; first contentful paint 4.7s on a cold dev-server load, which is Vite transform time, not the app
**Assessment**: no change. Production builds should be measured separately.

## Conflicts and trade-offs

- **Constants versus per-element polish on authoring.** The fix changes four style constants and the numeric font sizes, not the markup. That keeps Benji's test contract (the layout class, the download class, the disabled attribute, the literal grid template) intact while bringing every control onto the design system. A full rewrite to the class families is the better end state and is listed below.
- **Computed filing draft versus waiting for the service.** The customs filing is computed in the browser today. The trade is honesty for availability: the view says "declared data, heading level only", prints the fixture dates on every rate, and carries the same disclaimer the lane prints. When the lane's `pre_entry_lines` reaches the product service, the view swaps its data source without changing shape.

## What to instrument next

| Law | What it needs | Suggested instrumentation |
|---|---|---|
| Doherty Threshold | Round-trip time of the connected round, package and dispatch calls | Timing around each OperationsClient call, surfaced in the status chip |
| Peak-End Rule | Whether the filing draft is the moment the flow is remembered by | One question after "Print the draft" |
| Pareto Principle | Which authoring controls are used | Click event per control id, 30 days |
| Zeigarnik Effect | Whether users return to rounds with open lines | Count of rounds with open lines reopened within a week |

## Next fixes, in order

1. Rewrite the authoring workspace onto the `.panel`, `.btn`, `.field` classes and drop the inline style objects, so its hover, focus and disabled states match the rest of the app without duplication.
2. When Benji exposes the package artefacts on the product service, read `pre_entry_lines`, `export_references` and `retention` from the sealed package instead of computing them in the browser.

## Method notes and limits

Screenshots from the browser pane were unavailable during this run; every Tier 1 number came from the probe on the live DOM at both viewports, and the Tier 2 findings are judged from the DOM and computed styles. The connected service round was exercised against the enumerated proxy and a Candidate 0.1 snapshot service; the routes it needs exist in the merged product service but that service was not running on this machine, so the connected happy path is not yet walked end to end.
