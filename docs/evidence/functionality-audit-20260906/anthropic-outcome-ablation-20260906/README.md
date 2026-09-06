# Anthropic outcome ablation: 2026-09-06

Status: **PARTIAL SUCCESS; ASSURANCE FAILURE CAUGHT AND FIXED**

This packet records a bounded classification-engine ablation against public synthetic data. It does not classify a real article, provide legal advice, establish export jurisdiction, clear a transaction, or prove production readiness.

## Executive result

| Case | Execution shape | Provider attempts | Engine output | Evidence verdict |
|---|---|---:|---|---|
| Defense-specific complete UAV | Deterministic USML proposal; live Anthropic advocate and judge | 2 | `ITAR / USML VIII(a)(5)` | Hybrid diagnostic success; not a legal determination |
| Civil 90-minute UAV, first adjudication | Deterministic proposal and advocate; live Anthropic USML judge | 1 | `UNDETERMINED` at USML | Correct fail-closed result because citations did not verify |
| Civil 90-minute UAV, CCL continuation | Deterministic USML closure and CCL proposal; live Anthropic CCL advocate and judge | 2 | Apparent `EAR99` | **INVALID / P0 assurance counterexample** |
| Ambiguous module | Fully live Anthropic proposal path | 2 | `UNDETERMINED` | Expected ambiguity behavior; CCL correctly not reached |
| Defense, civil, and ambiguous full-live baseline | Fully live Anthropic path | 6 total | All `UNDETERMINED` | Transport worked; proposal timeout/budget interaction prevented closure |

The emitted labels span ITAR, EAR99, and UNDETERMINED, but they are not three equally valid conclusions. The ITAR result is a hybrid adjudication demonstration. The ambiguous result is a fully live fail-closed demonstration. The apparent EAR99 result is a captured engine/model contradiction and must not be relied on.

## P0 counterexample: false EAR99 fall-through

The pinned reference unit `9A012.a.2` states: `A maximum 'endurance' of 1 hour or greater;`. The synthetic item states 90 minutes under the referenced ISA sea-level zero-wind conditions.

The live judge returned all of the following in one response:

- A `not_met` element for the one-hour endurance threshold.
- A `knocked_out` ruling with a valid citation to `9A012.a.2`.
- Reason text acknowledging that 90 minutes is 1.5 hours and therefore meets the threshold.
- A challenge stating the knockout was erroneous, marked `sustained`.

The pre-fix reconciler honored the cited `not_met` token before considering the sustained self-challenge, so ordered review fell through to EAR99. This was not a defensible classification result.

The fix in `packages/classification/forge_classification/reconcile.py` makes any sustained self-challenge defeat either dispositive ruling and reconcile to `undetermined`. The regression in `tests/classification/test_engine.py` pins the knocked-out case alongside the existing supported-ruling check.

## Ordered-review observations

- The ITAR hybrid stopped at USML once `USML VIII(a)(5)` was supported; CCL was not reached.
- The fully live ambiguous case stopped at USML and produced seven specific missing-fact questions.
- The first civil hybrid stopped at USML when the judge's failed-element citations were struck.
- The second civil hybrid reached CCL only after a citation-valid scripted USML knockout.
- The second civil hybrid's emitted EAR99 must be treated as a regression fixture, not outcome evidence.

## Call and cost ledger

| Phase | Provider attempts |
|---|---:|
| Three fully live baseline cases | 6 |
| Preliminary hybrid advocate timeout | 1 |
| Routing-only correction attempts | 0 |
| ITAR adjudication plus first civil USML judge | 3 |
| Civil CCL continuation | 2 |
| **Total** | **12 / 12 authorized** |

Each provider attempt was application-estimated at 250,000 micro-USD, yielding a conservative provider-attempt estimate of 3,000,000 micro-USD ($3.00) against the authorized 6,000,000 micro-USD ($6.00) ceiling. This is not an Anthropic invoice. Hybrid engine budget ledgers also count deterministic fixture calls and therefore must not be interpreted as provider spend.

The model identifier was `claude-sonnet-5`. No additional provider retry was launched after the 12-call envelope was reached.

## Reference-pack drift warning

The repository's pinned pack resolves `9A012.a.2` to the one-hour endurance threshold. The current eCFR page inspected on 2026-09-06 did not align cleanly with that pinned decomposition, indicating possible regulatory-source drift. Before any real use, refresh and re-pin the corpus, review the diff, and obtain qualified export-control review. Sources inspected: [22 CFR 120.41](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-120/subpart-C/section-120.41), [22 CFR 121.1 Category VIII](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-121/subject-group-ECFRf7e5fe639be4566/section-121.1), and [15 CFR 774 Supplement No. 1](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774).

## Data and deployment boundary

- Inputs are public synthetic hypotheticals only.
- No customer, controlled, CUI, ITAR, EAR-controlled technical, or proprietary design data was submitted.
- The isolated preview did not receive a stable alias.
- Temporary previews `caddydaddy-product-service-6hcxlqhq3-strafe1.vercel.app` and `caddydaddy-product-service-73lgffllz-strafe1.vercel.app` were removed after the run.
- Temporary Anthropic key `caddydaddy-outcome-ablation-20260906` was deleted after the run.
- The pre-existing `stafe-api-key` was untouched.
- The local key bridge was zero bytes with mode `000` after cleanup.
- This repository packet contains no Anthropic key or application access token.

## Evidence map

| Path | Purpose |
|---|---|
| `results.json` | Machine-readable outcomes, call ledger, and cleanup receipt |
| `transport-status.json` | HTTP status from each fully live request |
| `requests/*.json` | Public synthetic inputs |
| `responses/full-live-*.json` | Fully live baseline results |
| `responses/hybrid-itar.json` | Successful hybrid ITAR adjudication |
| `responses/hybrid-ear-usml-open.json` | First live civil judge, correctly held at USML |
| `responses/hybrid-ear-counterexample.json` | Pre-fix false EAR99 fall-through counterexample |
| `hybrid_ablation.py` | Exact disposable scripted/live stage harness |
| `MANIFEST.sha256` | Content hashes for this packet |

## Next valid EAR gate

A future live run may claim an EAR classification outcome only after the sustained-challenge regression passes, the active pack is refreshed or deliberately re-accepted, the result contains no contradictory ruling/elements/reason/challenge, and the run remains clearly marked review-only pending qualified human verification.
