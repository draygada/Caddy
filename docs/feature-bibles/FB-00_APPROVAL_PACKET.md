# FB-00 open approval packet

Status: OPEN. This file is a decision checklist and mechanical-work boundary, not an approved rule pack or legal review.

## Fastest safe product posture

Recommended hackathon posture: `SYNTHETIC_DEMO`.

> Tripwire is a design-stage screening aid. It flags supplied facts that may meet named control parameters. It does not issue a legal classification, licensing determination, or destination authorization.

Under this posture, baseline/F1/F3/F8 and the missing-evidence case remain the only P0 scenarios; destinations always return `not_evaluated`; affected facts and results are visibly labeled synthetic/fixture; real MPNs are not presented as verified; and unsupported rows, nonempty `items[]`, live AI, and other flips remain excluded.

`SOURCE_BACKED_REAL` is a separate, blocked posture. It requires cached authoritative vendor evidence and qualified semantic review before any real product fact or regulatory result is presented as verified.

Benji/product owner must ratify one posture before `rules.P0.json` or golden legal outputs are promoted. Mechanical prestaging below does not depend on that ratification.

## Why six draft rows cannot simply be copied

- Required baseline `CCL-9A012.a.1` is absent from `rules.DRAFT.json`, although the pinned 15 CFR 774 XML contains the source paragraph.
- Draft `CCL-6A003.b.4.b` reduces the condition to `frame_rate_hz > 9`; the pinned text also depends on the incorporated focal-plane array's 6A002.a.3.f status, and Note 3 contains additional release branches.
- `CCL-6A003.b.4.b-RS1` needs an explicit prerequisite on an established 6A003.b.4.b entry. Exactly 60 Hz does not satisfy its `>60` branch; the draft's Boson path instead relies on 327,680 elements.
- The current grammar does not say whether a rule adds an entry, excludes/replaces an entry, adds a reason, or propagates an entry.
- Current provenance does not bind every rule to a full source SHA-256 and raw span.
- Lepton/Boson facts are URL and planning assertions, not cached vendor receipts. A supplier-declared ECCN cannot prove the classification the evaluator is meant to test.

## Product and technical decisions

### D1 — Fixture posture

Choose and record exactly one: `SYNTHETIC_DEMO` (recommended for the hackathon) or `SOURCE_BACKED_REAL` (blocked pending evidence/review). Record owner, date, scope, and the exact claim ceiling above.

### D2 — F1 endurance contract

Record one worked, unit-complete contract:

```text
formula:
baseline_energy_Wh:
F1_energy_Wh:
usable_fraction:
steady_or_maximum_power_assumption:
atmosphere_and_wind_assumption:
baseline_result_h:  # must remain < 3 h
F1_result_h:        # must become >= 3 h
provenance: synthetic_demo | engineer_verified
```

Benji may approve an explicitly synthetic demo formula. Calling the result actual maximum Kestrel endurance requires qualified engineering/source review.

### D3 — P0 schema thaw/refreeze

The technical owner may approve contract shape, not regulatory meaning. The P0 refreeze must provide:

- explicit effects: `add_entry`, `exclude_or_replace_entry`, `add_reason`, and `propagate_entry`;
- `requires_entry` for dependent reason branches such as RS1;
- only numeric attribute comparison, declared equality, and descendant-entry presence predicates;
- exclusive typed clauses/atoms with `additionalProperties: false`;
- exact supported units for hours, hertz, and element count;
- missing, stale, or incompatible facts → tripwire `cannot_evaluate` and determination `question`;
- a pinned canonical-JSON digest algorithm;
- source receipt fields for repository file, full SHA-256, raw span, normalized display text, content date, and URL;
- no generic list, existence, ancestor, nonempty `items[]`, or destination semantics.

## Qualified export-controls review required

One qualified independent reviewer must approve or reject each item with exact source spans:

1. the 9A012 chapeau mapping and whether `bvlos` represents “designed to have controlled flight out of direct natural vision”;
2. `9A012.a.1 < 3 h` and `9A012.a.2 >= 3 h`, control reasons, MT handling, and effective date;
3. the complete minimum facts for `6A003.b.4.b`, including FPA qualification and Note 3 exclusions;
4. whether and how Note 3.a produces the proposed `6A993.a` alternative;
5. `9A012.a.3` propagation only after a valid child determination;
6. RS1's disjunction, prerequisite entry, omitted civil-embedding branch, and referenced exemptions;
7. every displayed quote, normalized span, date, and reason code.

That reviewer may also sign FB-00's final truth-pack receipt. Until then, no draft rule becomes `rules.P0.json` and no semantic engine lane starts.

## Safe mechanical prestaging

One path-isolated contract task may perform only the following before semantic approval:

- generate candidate-only full-hash/raw-span receipts from the pinned XML and regenerate stale 9A012 candidate sections, without marking them approved;
- author candidate schema changes plus invalid graph vectors for duplicate IDs, invalid root, dangling parents, and cycles; runtime validators and test code wait for their owning lane;
- author canonical-JSON vectors, request-ID/race response vectors, fixture-duplication checks, and response-shape vectors without implementing backend or frontend runtime code;
- author a wholly synthetic, non-demo collision input/output pack for USML → CCL → EAR99 ordering and missing-fact behavior; engine tests wait for FB-02;
- produce a vendor-evidence gap ledger without inferring a classification.

This prestage task is limited to Wave 0's exact `schemas/`, `data/demo/`, `data/rules/`, `backend/tests/fixtures/`, and `docs/api/` allowlist. It may not edit `backend/engine/`, `backend/tests/*.py`, `backend/app.py`, `frontend/`, or `vite.config.js`.

Pinned inputs for that task:

- `data/ecfr/title-15-part-774-2026-09-01.xml`: `c60be9cd7da59aa8e5cca3bce8a3938bd40d79f7aec5f3a3fb4c7c40e818b51f`.
- `data/fr/2026-16628.json`: `36c722b4ad9426c1822c8b01dcced93e1193c6866257c033904ec1c301b32c15`.
- `data/rules/rules.DRAFT.json`: `ac95bcdd0bdb967b90afab1b0fa8f3c8a6581220c96382207b3ba2f432c8f97f` (unapproved input only).

Do not prestage real-row promotion, golden legal outputs, destination results, or the fps-only camera predicate. Every artifact remains `candidate` until D1–D3 and the qualified semantic review are recorded.
