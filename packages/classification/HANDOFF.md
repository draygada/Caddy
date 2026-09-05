# Handoff: classification lane

## Objective

Remake the proto-prod classification engine as a Strafe Forge lane: a pure order-of-review engine over a dated, content-addressed reference pack, with a per-provision advocate and judge whose citations must resolve to bytes, code owning every conclusion, an ordinal claim class capped by evidence grade, ranked questions, and records on the product thread that only a human can adopt. Decision engine only — no memo rendering (Charlie, 2026-09-05). Direction of record: strafe-prototype `docs/classification_engine_remake_spec_2026-09-05.md` and `_engineering_direction_`; ratification in Charlie's decisions ledger, 2026-09-05.

## Custody

- Branch: `lane/classification` (fresh from `main @ 92241b9ca7c9`)
- Worktree label: `forge/classification`
- Writable: `packages/classification/**`, `tests/classification/**`, `governance/receipts/classification.json` — every changed path is inside that allowlist (custody output below)
- Registry: **not admitted**. The lane entry is proposed at `packages/classification/handoff/custody-lane-entry.proposed.json`; `governance/custody.v1.json` was not edited from the lane.
- Candidate commit (code): `640d8a1a7d1caa68edfe8151f20be3eee239fe97`; this handoff commit is its direct successor and changes no runtime source.
- Authority: Charlie Haywood's in-session instruction, 2026-09-05 (ledger entry of the same date). Push of this branch is under that instruction; merge to `main` is not requested and not authorised here.

## What was built (`packages/classification/forge_classification/`)

| Module | Interface | What it owns |
|---|---|---|
| `records` | `canonical_bytes`, `content_hash`, `seal_record`, `seal_event`, `record_ref` | RFC 8785 canonical bytes and SHA-256 for `forge.record/1` / `forge.command/1` / `forge.event/1`; floats refused; matches the repository's normative vector |
| `pack` | `build_pack(raw_dir)`, `resolve(pack, provision)`, `diff(a, b)` | Paragraph-grain units from the committed eCFR XML: 21 USML categories, 637 CCL entries, 22 CFR 120.41 (five releases), 15 CFR 772.1 "specially designed" (six releases); 6,125 units; pack sha `21818b45…60e`; the two residual units |
| `snapshot` | `snapshot(part_revision, declared, item_kind)` | The fact snapshot from the frozen PartDocument plus declared-facts records; evidence grade from the platform's `source_confidence` (MEASURED+artifact → verified; DECLARED by HUMAN → attested; else asserted); explicit unknowns recorded, never folded |
| `model` | `ModelClient.propose(kind, prompt, schema)`; `ScriptedModel`, `CacheModel`, `LiveAnthropicModel`, `Budget`, `BudgetedModel` | The port; budget reserved before any call; breach is a hard abort |
| `verifier` | `verify_citation(pack, claim) → Accepted | Rejected` | The fourth document class: `{unit_key, unit_sha256, quote, start, end}`; forbidden keys refused; `unit.text[start:end] == quote` or `span_not_found` |
| `engine` | `classify(snapshot, pack, model, budget, progress=None) → envelope` | The waves and the orchestration; `PROMPT_SCHEMAS` carry no conclusion key; the advocate cannot record `not_met` |
| `reconcile` | `normalise_elements`, `reconcile_ruling`, `generalise_stray_codes` | Records outrank summaries |
| `route` | `decide_step`, `stage_for`, `assemble` | The order-of-review decision table; CCL reached only on a USML negative; stages walked in order; EAR99 a floor elected only when every specific candidate is knocked out; two supported in one step is ambiguous |
| `claim` | `decide_claim`, `fit_quality` | Ordinal claim class + instrument; `supported` only when every decisive fact is verified or attested and cited; EAR99 caps at conditional |
| `questions` | `assess_readiness`, `derive_questions` | Field dictionary; readiness bands; questions ranked by re-running the route with the element flipped both ways |
| `thread` | `Thread.append_record / append_analysis / adopt / verify_chain / to_jsonl`, `route_consistent` | Records in the proposed `compliance` domain; chained events; actor discipline; refusals `WRONG_ACTOR`, `ROUTE_CONTRADICTS_RECORDS`, `STALE_BASE`, `CLAIM_CLASS_NOT_ADOPTABLE`, `SUPERSESSION_WITHOUT_ADOPTION`, `IDEMPOTENCY_CONFLICT`, `REFERENCE_MISSING` |
| `impact` | `impact(pack_a, pack_b, analyses)` | Which candidates cited a changed unit; re-analysis proposals; a diff, no model |
| `gates` | `GateState`, `waive`, `fail`, `stale_after` | Eight stages; `pass` unreachable; a waiver is never a pass |
| `service` | `declare`, `request_analysis`, `adopt`, `board`, `impact`, `rederive` | The facade seam every caller crosses |
| `contracts` | `load_schema`, `example_envelope` | `contracts/envelope.schema.json` (JSON Schema 2020-12; no numeric field anywhere; knockouts need a reason and a cited failed element; `supported` needs verified/attested decisive facts) |

Vocabulary: `packages/classification/CONTEXT.md`. Decisions: `packages/classification/docs/adr/0001…0005`.

## Tests

`packages/classification/.venv/bin/pytest tests/classification -q` → **129 passed** on `640d8a1a7d1c` (network cable irrelevant: no adapter is live in tests). Families: normative hash vectors; reference pack (literal paragraphs, 21 categories, 637 entries, five-vs-six releases, unknown provisions, hash stability, diff); snapshot (evidence grades, explicit unknowns, precedence); model port (scripting, cache, budget); verifier (accept, span_not_found, sha_mismatch, unit_unknown, every forbidden key, unquotable unit); envelope schema (no numeric confidence, knockout rule, closed enums, supported rule); engine route pins and reconciliation pins (22 tests incl. blindness and schema-forbidden-key checks); thread (actor discipline, contradiction refusal, stale adoption, supersession-only-with-adoption, chain tamper, idempotency, JSONL round trip); impact; gates; facade round trip (declare → analyse → round → answer → analyse → adopt), failure records, re-derive to the same envelope hash; the two 08-21 acceptance shapes.

Every test scripts the model. **No live model call was made; no spend occurred.**

## Shared-contract proposals (for the integrator; nothing below was edited from the lane)

1. **Custody registry** — admit lane `classification` (entry in `handoff/custody-lane-entry.proposed.json`).
2. **Platform records** — add authority domain `compliance`, sole writer the classification lane, canonical truth "classification analyses, declared regulatory facts, analysis rounds and failures, adopted classification records and their supersession, reference-pack impact". Record kinds: `compliance.declared-facts.v1` (payload `{part_revision_id, facts[{path, value, unit}]}`), `compliance.analysis.v1` (payload `{envelope, envelope_sha256}`; actor AGENT/SYSTEM), `compliance.analysis-round.v1`, `compliance.analysis-failure.v1`, `compliance.classification-record.v1` (actor HUMAN; payload `{analysis_revision_id, item, attestor{actor_id, role}, claim_class, posture, leading_provision, adoption_sentence}`), `compliance.classification-supersession.v1` (SYSTEM, only alongside an adoption; `cause ∈ facts_moved|lists_moved|reanalysis|corrected`), `compliance.impact.v1`. All use the frozen envelope; `claim_ceiling` is `SYNTHETIC_LOCAL_ONLY`. Stable diagnostics added: `WRONG_ACTOR`, `ROUTE_CONTRADICTS_RECORDS`, `CLAIM_CLASS_NOT_ADOPTABLE`, `SUPERSESSION_WITHOUT_ADOPTION`.
3. **Verifier** — a fourth document class `UnverifiedCitation {unit_key, unit_sha256, quote, start, end}`, forbidden-key list extended by `disposition`, `status`, `claim_class`, `instrument`, `posture`, `route`.
4. **Candidate status vocabulary** — `not_reached` added to the 2026-08-10 three-status contract (`docs/adr/0005`).
5. **Lane-local lockfile** — `packages/classification/uv.lock` exists because `uv sync` wrote it; the root `pyproject.toml` / `uv.lock` are untouched. Delete it if the repository policy is one root lock.

## Dependencies, licences, data

- Runtime: Python standard library only.
- Dev (lane-local pyproject): `pytest==8.4.1` (MIT), `jsonschema==4.25.1` (MIT), build backend `hatchling==1.27.0` (MIT). AGENTS.md requires an exact-version licence and transitive-notice review before any promotion; that review is owed and was not done here.
- `anthropic` is **not** pinned; `LiveAnthropicModel` imports it lazily and abstains when absent. Pinning it is an integrator decision.
- Data: `data/ecfr/raw/` — public eCFR XML. Part 121 and part 774 exports copied from the strafe-prototype corpus (retrieved 2026-06-25; no content date in the export); §120.41 and §772.1 pulled 2026-09-05 from `www.ecfr.gov` versioner at content date 2026-09-01 (public .gov data, under Charlie's standing gov-data-pull grant). Hashes in `data/ecfr/manifest.json`.

## Claim ceiling — what is and is not shown

Demonstrated: boundary mechanics on scripted model outputs — the route table, the reconciliation rules, the claim-class cap, the verifier, the thread's refusals, re-derivation to the same hash, and the reference pack's parse of the committed text.

Not shown, not claimed: any classification accuracy or coverage; any legal conclusion, determination, or clearance; live model behaviour (no run, no cache fixtures recorded); the differential harness against the proto-prod adapter (spec R-1/R-9: not built here); element frames (deferred by R-7); a memo or any prose rendering (out of scope by Charlie's instruction); admission of the lane or the `compliance` domain.

## Remaining unknowns

- R-6 (the spend and call ceiling) is a number Charlie sets from measured runs; the lane defaults are placeholders.
- Gate pass criteria (Benji's drawing #2) do not exist; every gate is `hold` or `waived`.
- Whether the integrator wants the domain named `compliance`.
- The content date of the part-121/part-774 exports; re-pull from the versioner at a dated URL to fix it.
- Whether the 08-21 acceptance rows themselves (sequestered gold) should be run: they need a live or cache-recorded model.

## Rollback

Nothing on `main` changed. Delete the branch (`git branch -D lane/classification`; delete the remote branch) and the lane is gone; no shared file, lock, schema or registry was edited.

## Custody check (verbatim, changed paths elided — all 47 are inside the allowlist)

```
lane=classification
branch=lane/classification
base=92241b9ca7c9df37cc48e55b4ea388cb21686bb4
head=HEAD
changed_paths=47
CUSTODY_PASS
```

`now_observation` in `governance/receipts/classification.json` validates against `governance/now-observation.v1.schema.json`.
