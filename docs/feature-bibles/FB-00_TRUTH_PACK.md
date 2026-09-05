# FB-00 — Governed truth pack

Owner lane: truth/contract integration. Priority: P0 blocking gate. This is not an ordinary implementation lane.

## Outcome

Produce the smallest approved, executable body of facts needed for the demo before engine builders encode assumptions independently. The current `data/rules/rules.DRAFT.json` is research material and its machine checks do not approve legal semantics.

## Required decisions and artifacts

- A decision record names the exact P0 scenario: baseline, F1 battery/endurance, F3 thermal camera plus parent propagation, F8 no-change, and one missing-evidence case.
- `data/rules/rules.P0.json` is explicitly partial and contains only reviewed entries needed by that scenario: baseline `CCL-9A012.a.1`, `CCL-9A012.a.2`, `RELEASE-6A003.b.4.b-note3a`, `CCL-6A003.b.4.b`, `CCL-6A003.b.4.b-RS1`, and `CCL-9A012.a.3`. Every displayed sentence resolves to a pinned corpus span and content date.
- Destination output is `{ "status": "not_evaluated", "reason": "P0 has no approved destination policy" }`. Country Chart X/blank cells alone may not be converted into NLR, STA, LIC, denial, DDTC, or other exact outcomes.
- The rule grammar is made executable for the retained subset through one controlled schema thaw/refreeze. Clauses and atoms get exclusive discriminators and `additionalProperties: false`; `not` accepts one clause such as `{ "not": { "any": [...] } }`; unsupported declaration, list, and existence constructs remain excluded. Units and value types are explicit before an evaluator is written.
- A baseline Kestrel design and golden before/after outputs contain every required attribute, unit, parent edge, stable ID, and provenance label.
- Unsupported draft rows, F2, F4, F5/F6, P3 downward inheritance, `items[]` runtime behavior, live AI, and destination/legal coverage are explicitly excluded rather than left ambiguous.

## Non-negotiable semantic decisions

1. Order of review is code-owned: USML/ITAR, then specific CCL entries, then EAR99 only after the applicable specific candidates are rejected.
2. Missing, stale, or unit-incompatible facts produce `cannot_evaluate`; they never satisfy a rule and never render clear.
3. Design graph admission rejects duplicate IDs, a missing/non-product root, dangling parents, and cycles even if the current JSON Schema cannot express those invariants.
4. List negation means exactly what the approved P0 rule says. No generic `NOT(all)`/`NOT(any)` interpretation may be invented by a builder.
5. Destination output remains `not_evaluated` throughout P0; absence of a governed policy is explicit, not guessed around.
6. Scene coordinates and component anchors live in a separate rendering map; they do not enter legal fact schemas.
7. F1 endurance and every other derived value have one pinned formula, input-unit contract, worked example, and source/provenance decision. The engine, not React, computes them.

## Acceptance

- No P0 screen copy depends on `rules.DRAFT.json` or a hard-coded regulatory string in JSX.
- Every P0 rule has one positive, one exact-boundary, one negative, and one missing-fact fixture.
- Exact before/after truth tables exist for baseline, F1, F3, F8, and the missing-evidence case.
- Chart regeneration reproduces the committed `countries` shape and passes schema validation.
- Semantic graph admission rejects duplicate IDs, missing/non-product roots, dangling parents, and cycles.
- The P0 baseline and flips validate and produce the expected entries: baseline `9A012.a.1`; F1 `9A012.a.2`; F3 fires the camera thresholds and adds `9A012.a.3` to the product; F8 has zero changed determinations.
- An independent reviewer signs the truth-pack receipt and records the refrozen schema and P0 rule-pack digests plus the coverage/claim ceiling. Machine quote/shape checks alone do not clear this gate.

## Preconstruction falsifier

Ask two independent implementers to derive the same golden outputs using only the truth pack. If they can reasonably disagree about a rule operator, list meaning, unit, formula, parent entry, missing-fact state, or displayed citation, FB-00 fails and no engine session starts.

## Stop rules

Stop rather than curate legal meaning when a quote, threshold, effective date, declaration, exception, destination policy, or schema change lacks the required authority. Visual-shell work may continue against clearly labeled golden fixtures, but no fixture may be represented as live engine output.
