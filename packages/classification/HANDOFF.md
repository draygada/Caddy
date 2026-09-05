# Handoff: classification lane

## Objective

A fully automatic classification engine for Strafe Forge: a product description or a Forge part revision goes through the entire order of review — USML first, then the CCL stage by stage, then the EAR99 residual — with a per-provision advocate and judge whose citations must resolve to bytes in a dated reference pack, and the output is the **jurisdictional determination**: `ITAR`, `EAR` (with the supported entry when one closes), `EAR99`, or `UNDETERMINED` when the USML step cannot close on the facts given. No human gate anywhere; no memo; no CJ/CCATS recommendation. Direction of record: strafe-prototype `docs/classification_engine_remake_spec_2026-09-05.md` (§1 hallmark inventory) as cut by Charlie's three 2026-09-05 ledger entries; lane ADR-0006.

## Custody

- Branch: `lane/classification` (fresh from `main @ 92241b9ca7c9`); candidate (code) commit `c59a7ea0e1671ef599cae572f8f98b58a792e46e`; this handoff commit is its direct successor and changes no runtime source.
- Worktree label `forge/classification`; writable `packages/classification/**`, `tests/classification/**`, `governance/receipts/classification.json` — every changed path is inside that allowlist (custody output below).
- Registry: **not admitted**; the lane entry is proposed at `packages/classification/handoff/custody-lane-entry.proposed.json`. No shared file was edited from the lane.
- Authority: Charlie Haywood's in-session instructions, 2026-09-05. Push of this branch is under that instruction; merge to `main` is not requested here.

## The engine (`packages/classification/forge_classification/`)

```python
from forge_classification import run
out = run(product_description_or_part_revision, model, item_kind="commodity", facts={...})
out["determination"]  # {jurisdiction, classification[], usml_step, ccl_step, basis[], open_candidates[]}
```

| Module | Interface | Owns |
|---|---|---|
| `pack` | `build_pack(raw_dir)`, `resolve`, `diff` | Paragraph-grain units from the committed eCFR XML: 21 USML categories, 637 CCL entries, 22 CFR 120.41 (five releases), 15 CFR 772.1 "specially designed" (six releases); 6,125 units; pack sha `21818b45…60e`; two residual units |
| `snapshot` | `snapshot_from_product`, `snapshot_from_part_revision` | The hashed fact snapshot; explicit unknowns recorded, never folded |
| `model` | `ModelClient.propose`; `ScriptedModel`, `CacheModel`, `LiveAnthropicModel`, `Budget`, `BudgetedModel` | The port; budget reserved before any call; breach is a hard abort |
| `verifier` | `verify_citation(pack, claim)` | A citation is a byte range in a hashed unit or it is nothing; conclusion keys are schema violations |
| `engine` | `determine(snapshot, pack, model, budget)`; `PROMPT_SCHEMAS` | The waves: USML propose (retry once) → advocate → verifier → judge → USML step → CCL propose → stages in order → determination. No wave schema carries a conclusion key; the advocate cannot record `not_met` |
| `reconcile` | `normalise_elements`, `reconcile_ruling`, `generalise_stray_codes` | Records outrank summaries: a knockout needs a verified citation on a failed element; supported needs every element met and no sustained challenge; silence is never a finding |
| `route` | `decide_step`, `stage_for`, `assemble` | The order-of-review decision table ending in the determination |
| `hashing`, `contracts` | `canonical_bytes`, `sha256`; `load_schema` | Hashing (floats refused); `contracts/determination.schema.json` |

Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001…0006` (0001 superseded by 0006).

## Tests

`packages/classification/.venv/bin/pytest tests/classification -q` → **98 passed in 0.86s** on `c59a7ea0e167`. Families: reference pack (literal paragraphs, coverage, five-vs-six releases, unknown provisions, hash stability, diff); snapshot; model port (scripting, per-provision routing, cache, budget); verifier (accept, span_not_found, sha_mismatch, unit_unknown, every forbidden key, unquotable unit); determination schema (no numeric confidence, no instrument, knockout rule, jurisdiction agrees with steps, closed enums); engine determination pins (ITAR / UNDETERMINED / EAR with entry / EAR99 / EAR with entry open / two supported / later stage not reached), reconciliation pins (uncited knockout, forged citation, sustained challenge, open element, advocate cannot knock out, unknown provisions, empty proposal retry, judge abstention, stray codes), containment (blindness, schema keys, no human-gate or filing vocabulary in the output), hard limits (budget, model unavailable, provenance); end-to-end `run` from a part revision and from a plain description, including the undetermined case.

Every test scripts the model. **No live model call was made; no spend occurred.**

## Shared-contract proposals (for the integrator; nothing was edited from the lane)

1. **Custody registry** — admit lane `classification` (`handoff/custody-lane-entry.proposed.json`).
2. **Lane-local lockfile** — `packages/classification/uv.lock` exists because `uv sync` wrote it; the root `pyproject.toml` / `uv.lock` are untouched. Delete it if the repository policy is one root lock.

(The earlier proposals for a `compliance` authority domain and record kinds were withdrawn with the human gates: the lane emits no product-thread records.)

## Dependencies, licences, data

- Runtime: Python standard library only. Dev (lane-local): `pytest==8.4.1` (MIT), `jsonschema==4.25.1` (MIT), build backend `hatchling==1.27.0` (MIT); the exact-version licence and transitive-notice review AGENTS.md requires is owed before promotion.
- `anthropic` is **not** pinned; `LiveAnthropicModel` imports it lazily and abstains when absent.
- Data: `data/ecfr/raw/` — public eCFR XML. Part 121 and part 774 exports from the strafe-prototype corpus (retrieved 2026-06-25; no content date in the export); §120.41 and §772.1 pulled 2026-09-05 from `www.ecfr.gov` at content date 2026-09-01 (public .gov data under Charlie's standing pull grant). Hashes in `data/ecfr/manifest.json`.

## Claim ceiling

Demonstrated: boundary mechanics on scripted model outputs — the route table, the reconciliation rules, the verifier, the determination contract, and the reference pack's parse of the committed text.

Not shown, not claimed: any classification accuracy or coverage; any legal conclusion, determination in the regulatory sense, or clearance (`UNDETERMINED` is an engine outcome, and `EAR99` is a residual, not a clearance); live model behaviour (no run, no cache fixtures recorded); a differential harness against proto-prod; element frames.

## Remaining unknowns

- The spend and call ceiling (ledger R-6) is a number Charlie sets from measured runs; the defaults are placeholders.
- The content date of the part-121/part-774 exports; re-pull from the versioner at a dated URL to fix it.
- Real-model behaviour on the 08-21 acceptance rows (sequestered gold) — needs a live or cache-recorded run.

## Rollback

Nothing on `main` changed. Delete the branch (`git branch -D lane/classification`; delete the remote branch) and the lane is gone.

## Custody check (verbatim, changed paths elided — all inside the allowlist)

```
lane=classification
branch=lane/classification
base=92241b9ca7c9df37cc48e55b4ea388cb21686bb4
head=HEAD
changed_paths=40
CUSTODY_PASS
```

`now_observation` in `governance/receipts/classification.json` validates against `governance/now-observation.v1.schema.json`.
