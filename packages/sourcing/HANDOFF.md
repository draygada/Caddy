# Handoff: sourcing lane (with the search lane and the HTTP adapter)

## Objective

The sourcing backend the DNHacks design suite specifies: "Source this design" as a Job-1 evidence record. A round bound to one exact design state resolves offers per line from a committed fixture, walks ownership with risk-tiered depth, screens every party against a dated Consolidated Screening List snapshot, computes a landed-cost ladder per offer as a pure hashed function, records the engineer's selection with every declined offer and its reason, gates each line for a ship-to outside the US on the rule engine's destination cell verbatim, takes the technical-data declaration under the three-line rule, builds a fail-closed package of three hashed artefacts, and dispatches a synthetic order packet exactly once. Everything is an event in a hash-chained thread that re-derives. Direction of record: strafe-prototype `docs/dnhacks_engineering_direction_2026-09-05.md` §3.6–§3.8 and `docs/dnhacks_feature_specs_2026-09-05.md` F-13…F-17, as corrected by Diego's 2026-09-03 research and 2026-09-05 validation. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001…0005`.

Since 2026-09-06 the lane also carries the search lane the research brief §6 named: a bounded proposer over an owned pool with byte-verified extraction, a rule dry-run on copies, the walk/screen/cost on copies, agent proposals a human resolves; live government data as fixture refreshes; a FastAPI adapter with one page over `round_view` and a read-only `/now`; the engine adapter for Diego's `evaluate()` output. Direction of record adds strafe-prototype `docs/agentic_part_search_research_2026-09-05.md` (§1, §2, §6, §7) and the eight evidence streams with verifier passes.

## Custody

- Branch: **`lane/sourcing-search`**, created on Charlie's instruction off `lane/sourcing` @ `890f955`; the lane is based on `main @ 92241b9ca7c9df37cc48e55b4ea388cb21686bb4`. Candidate commit `6e710f0ff918f6813bc889ddbc1c6c1a62726a13` (the final fix pass after the whole-branch review; supersedes `6fd70505b7ca…`, Task 6.1); this paperwork commit is its direct successor and changes no runtime source.
- Worktree label `forge/sourcing`; writable `packages/sourcing/**`, `tests/sourcing/**`, `governance/receipts/sourcing.json` — all 95 changed paths are inside that allowlist (custody output at the foot of this file).
- Registry: **not admitted**. The lane is proposed in `packages/sourcing/handoff/custody-lane-entry.proposed.json`; its write allowlist, worktree and worktree label are unchanged from the original proposal, and only the `branch` field was corrected to `lane/sourcing-search` so the check and the integrator both read the branch that exists. No shared file was edited from the lane: `governance/custody.v1.json` and `tools/check_custody.py` are untouched, and the custody run below used a patched copy of the tool over a merged registry in the coordinator's gitignored scratch directory.
- Authority: Charlie Haywood's in-session instructions, 2026-09-05/06 ("implement the sourcing back end", then the part-search lane on a separate branch). **Not pushed**; merge to `main` is not requested here.
- Independence: the lane is based on `main`, not on `ship/caddydaddy-integration`, and imports nothing from `features/tripwire`, `packages/classification` or `packages/compliance-bridge`. It takes the engine's per-node evaluation as input data.

## The lanes

### `forge_sourcing/` — the round (stdlib only)

```python
from forge_sourcing import Service
svc = Service(Path("packages/sourcing/data"))
r = svc.open_round(design, ship_to="US-bench", quantity=1, transport_mode="air", request_key="demo-1", opened_at="2026-09-06T01:00:00Z")
svc.resolve(r["round_id"]); svc.screen(r["round_id"]); svc.cost(r["round_id"], entry_date="2026-09-06")
view = svc.round_view(r["round_id"])        # the browser renders this and computes nothing
```

| Module | Interface | Owns |
|---|---|---|
| `service` | the seam: `open_round · resolve · screen · rescreen · cost · refine · select · adjudicate · resolve_escalation · gate · declare · build_package · create_packet · dispatch · close_order · rederive · tamper · round_view · timeline` **· `record_proposal · accept_proposal · reject_proposal`** | binding every event to design hash, design seq and fixture hashes; the words on every card. The three proposal verbs append `alternative_proposed` / `escalation_proposed` (agent), and on resolution `escalation_resolved` (human) or `proposal_rejected`; a proposal is stored by copy, its candidate urls are hashed at proposal time, and a resolved proposal refuses every further verb |
| `round` | `new_round`, `transition`, `request_key_hash` | the round record, the status order, idempotency, supersession |
| `parties` | `depth_tier`, `extract_parties`, `walk` | risk-tiered depth (printed with reasons); the walk over the ownership table; `unknown` and `terminal` ownership states |
| `screen` | `normalize`, `screen`, `node_status`, `rollup` | exact and suffix-normalized matching over name and alternate names; adjudication effects; worst-node roll-up |
| `cost` | `estimate` (pure) | the ladder: base by heading with HTS revision · Section 232 scope · Section 301 by Chapter 99 heading · country action · AD/CVD · MPF by fiscal-year row with min/max · HMF ocean-only · Section 122 banner · de minimis note · total, per-unit, assumptions, claim ceiling, hash; domestic → "no entry"; foreign ship-to → destination notes |
| `select` | `build_selection`, `build_adjudication`, `default_reason` | refusals (blocked, stale fixture, hash fail, missing decline, unknown reason); two roles; snapshot binding |
| `gate` | `evaluate_gate`, `required_reference`, `build_declaration` | the engine's cell verbatim; typed-not-validated references; the three-line rule with the 734.13 sentence |
| `package` | `verify_bindings`, `pre_entry_lines`, `diligence_record`, `export_references`, `retention`, `warnings` | fail-closed re-verification; Chapter 99 lines per program in CBP's order; FCC two states; lithium as carriage; 9802 pointer; retention per regime; locked disclaimers; first-run checklist |
| `order` | `create_packet`, `synthetic_dispatch` | the packet fields of thread 5 §10; SYNTHETIC label; the exception fixture |
| `thread` | `append`, `verify_chain`, `tamper`, `of_kind`, `head` | hash chain; actor discipline (agents propose only; terminal kinds need a human attestor); no signing (ADR-0003) |
| `fixtures` | `FixtureStore` (optional `csl_file` path) | manifests (source, retrieved-at, sha256, row count, revision); offers by content hash; ownership by normalized child; the CSL index |
| `hashing` | `canonical_bytes`, `sha256`, `content_id` | canonical JSON; floats refused |

### `forge_search/` — the proposer (pypdf + jsonschema)

| Module | Interface | Owns |
|---|---|---|
| `documents` | `document_text(data, name)`, `text_sha256`, `numbered`, `hidden_spans`, `EXTRACTOR` | the exact characters the verifier binds and the model is shown; pypdf pinned and recorded; hidden HTML text kept and named; per-line character offsets (ADR-0005) |
| `fetch` | `Fetcher(cache_dir, manifest_path, fixtures_dir, *, offline)`, `fetch(url) → FetchResult(url, status, sha256, bytes, retrieved_at)`, `host_allowed`, `ALLOWLIST`, `BLOCKED_DEMO` | the static host allowlist; the content-addressed cache under `.cache/fetch`; the committed document manifest; the BLOCKED log line; `fixture://` names confined to the fixtures directory at both doors |
| `schemas` | `UNVERIFIED_SPEC_SCHEMA`, `EXTRACT_SCHEMA`, `SEARCH_SCHEMA`, `validate(instance, schema)` | the three closed schemas. There is no slot for a classification, a jurisdiction, a control-list citation, an origin, an ownership fact or a screening result — the model cannot write one because no key exists |
| `verify` | `verify(...) → Accepted \| Rejected`, `Spec(field, value, unit, quote, start, end, doc_sha256)`, `parse_number_unit`, `UNIT_ALIASES` | a number enters a rule only if it resolves to exact characters in the document the model was shown: span equality, doc-sha equality, unit canonicalisation, adjacency binding, comma refusal, ambiguity refusal, dimension tuples as one group; the stored figure is the document's, not the model's spelling |
| `rules` | `load_rules`, `rows_for`, `fields_for`, `rule_sentences`, `release_texts`, `rows_by_entry`, `atoms`, `RULES_PART_CLASS` | the draft rule rows as data; every threshold a decimal string at load, so no record carries a float |
| `dryrun` | `dry_run(rules, *, part_class, role, fields, declared)`, `flip_gone(tripped, before_entries, after, rules)`, `derive_fields` | one node, on a copy: fires / does not fire / cannot conclude (an unpublished field can never fire, and never greens) |
| `fit` | `fit_check(comparator, candidate_fields)`, `DIMENSIONS` | the four dimensions of 22 CFR 120.41(b)(3) / 15 CFR 772.1: function, performance, form (incl. material), fit |
| `model` | `ModelClient` protocol, `ScriptedModel`, `CacheModel`, `BudgetedModel`, `LiveAnthropicModel`, `RecordingModel`, `Budget`, `Abstain`, `prompt_sha256`, `MODEL_FOR_KIND` | the model port: cache keyed by `sha256(kind + prompt)`; any non-`end_turn` stop reason is an `Abstain`; the budget reserves before the call |
| `prompts` | `extract_prompt`, `search_prompt`, `escalation_prompt`, `PROMPT_VERSION` | deterministic prompt text — a wording change is a `PROMPT_VERSION` bump and a new cache key. The extract prompt asks for the **shortest clause** containing the figure and its unit (a whole row with two same-unit groups is refused as ambiguous) |
| `extract` | `extract(text, doc_sha256, part_class, field_units, rule_sentences, model) → ExtractResult` | Call A: prompt → model → schema check → verifier per claim. A schema-invalid response abstains the whole response; only `ExtractResult.accepted` specs reach a rule |
| `evaluate` | `evaluate_candidate(service, rnd, line, slot, candidate, *, specs, rules, tripped)`, `rank`, `CLAIM_CEILING`, `HONESTY_NOTE` | the evaluate step on **copies**: fit → dry-run → walk and screen → cost; green / grey / red; ranking by screening status then landed cost. The round is never mutated (its digest is unchanged after an evaluation) |
| `propose` | `propose_alternative`, `propose_escalation`, `candidate_pipeline`, `Ports(fetcher, model, rules, pool, pool_sha256, documents_sha256)`, `default_ports(data_dir, *, mode, offline, budget)` | Call B and the escalation agent over the owned pool: one bounded `search` call proposes `{mpn, url}` pairs, code does the rest, the result is an agent `*_proposed` event a human resolves. Sources are gated to the pool's own documents; an abstained proposal is never green; the escalation agent is never confident |

### `forge_sourcing_api/` — the HTTP adapter (fastapi + uvicorn)

| Route / module | Shape | Notes |
|---|---|---|
| `GET /api/sourcing/health` · `/states` | `{candidate, result}` | `candidate` is the envelope: `git_sha`, `design_hash`, `log_head_seq`, `log_head_hash`, `fixture_manifest_shas`, `search {pool_sha256, rules_sha256}`, `mode {llm, api}` |
| `GET /api/sourcing/now` | `{as_of, candidate, round_status, last_event, tests, features[], claim_ceiling}` | F-25. GET-only, writes nothing; `tests` is read back from `.cache/last_pytest.json`; every unknown prints `UNKNOWN` |
| `POST /api/sourcing/rounds` | `{state \| design, ship_to, quantity, transport_mode, request_key, run}` → `{candidate, result, view}` | `run: true` also resolves, screens and costs |
| `GET /api/sourcing/rounds/{id}` · `/timeline?last=N` | `round_view` · the event tail | the browser renders these and computes nothing |
| `POST /api/sourcing/rounds/{id}/{verb}` | one verb per call: `resolve screen rescreen cost refine select adjudicate resolve_escalation gate declare package propose accept_proposal reject_proposal` | a lane refusal is **409**; a malformed or incomplete body is **422** |
| `POST /api/sourcing/packets` · `/packets/{id}/dispatch` · `/packets/{id}/close` | the synthetic order path | `dispatch` takes the idempotency key and a human attestor |
| `POST /api/sourcing/rederive` · `/tamper` | the re-derive line · one-field tamper | `/tamper` is **unauthenticated demo tooling** — env-gate it at integration |
| `GET /` | `static/round.html` | mounted on **`app`, not `router`** |
| `engine_adapter` | `design_for_round(design_doc, response, *, design_seq, quantities=None)` | consumes Diego's Wave-0 candidate `evaluate()` response verbatim and produces `open_round` input |

### Scripts (`scripts/`) — human-run; never on the request path

| Script | `make` target | What it does |
|---|---|---|
| `seed_documents.py` | `seed` | fetches the pool's real documents into `.cache/fetch` under the allowlist (network); bytes never committed |
| `determinism_check.py` | `determinism` | prints `sha256(extracted text)` per cached document, to compare across two machines |
| `refresh_csl.py` | `refresh-csl` | downloads the full Consolidated Screening List into `.cache/csl` (public .gov data) |
| `refresh_hts.py` | `refresh-hts` | reads base rates for `tariff.json`'s headings from the USITC HTS REST API; prints the diff, writes only with `--write` |
| `refresh_cross.py` | `refresh-cross` | CBP CROSS rulings, printed as number, subject and date |
| `refresh_ownership.py` | `refresh-ownership` | GLEIF / Companies House ownership rows with a url and no invented percentage |
| `eval_search.py` | `eval` | the six measurements over `data/search/gold_swaps.json` from the committed cache; no top-line accuracy rate by design |
| `record_cache.py` | `record-cache` | **LIVE** model calls under the spend cap; requires `ANTHROPIC_API_KEY`; the only script that spends money |
| `build_manifest.py` | `manifest` | regenerates `data/manifest.json` and the `search/*` shas |

## Data

`packages/sourcing/data/`, manifested in `manifest.json`: `kestrel_round_input.json` (13 lines with hand-typed engine evaluations; the F4 HG5700 state), `offers.json` (17 offers; two SYNTHETIC sellers), `ownership.json` (18 rows; two SYNTHETIC), `tariff.json`, `csl_subset.csv` (7 verbatim rows of the 2026-09-04 snapshot; the loader takes the full 26,082-row CSV unchanged).

Search fixtures, with the shas `make manifest` prints:

| File | sha256 (8) | Bytes / rows |
|---|---|---|
| `data/search/pool.json` | `56682ab9e537` | 14,294 |
| `data/search/rules.DRAFT.json` | `ac95bcdd0bdb` | 38,805 — byte copy of the tripwire draft |
| `data/search/gold_swaps.json` | `ffb45598034a` | 2,176 |
| `data/search/documents.json` | `c0f53fbd0ec4` | 2,669 |
| `data/search/engine/kestrel-baseline.design.json` | `84f3ab7bae30` | 9,737 |
| `data/search/engine/evaluate-camera-flag.json` | `6acb9faee046` | 5,713 |
| `data/search/engine/evaluate-missing-evidence.json` | `a60654b8957e` | 3,974 |
| `data/search/fixtures/gx220_vendor_page.html` | `164ab9e7c1a3` | 854 |
| `data/search/fixtures/icm42688p_test_excerpt.txt` | `522ea1b7da6a` | 427 |
| `data/search/fixtures/imu_ng_synthetic_sheet.txt` | `be5751c90231` | 281 |
| `data/search/fixtures/lepton35_test_sheet.txt` | `9f686b5c9915` | 319 |
| `data/search/fixtures/molicel_p45b_test_excerpt.txt` | `d7828393aec2` | 380 |
| round fixtures | `offers fb1a82ef` · `ownership 51960858` · `tariff c4e68789` · `csl fa863267` | 17 · 18 · 10 · 7 rows |

`data/search/documents.json` carries the five `fixture://` urls with `status: FIXTURE`, `sha256`, `text_sha256` and the extractor pin (`pypdf 6.17.0`; `PdfReader(...).pages[i].extract_text()` joined by `\f`; stdlib `html.parser` with script/style dropped, hidden nodes kept, block tags starting a new line).

`data/llm_cache/` is **empty** (`.gitkeep` only). No live run has happened, so every proposal abstains with "cache miss" and `make eval` reports `cache_misses: 6` by design.

`.cache/` is gitignored. After `make seed` expect `.cache/fetch/` to hold the fetched vendor documents plus the fetch manifest and the BLOCKED log (st.com, digikey.com and mouser.com are expected to fail: st.com resets non-browser connections and the two distributors bar automated retrieval). `make eval` writes `.cache/eval/results.jsonl` and `errors.jsonl`; the suite writes `.cache/last_pytest.json`, which `/now` reads back. `make refresh-csl` writes `.cache/csl/`.

## Tests

`packages/sourcing/.venv/bin/python -m pytest tests/sourcing -q` → **163 passed in 0.77 s** on `6e710f0ff918` (the fix-pass candidate; 144 on `6fd70505b7ca` before it).

Families: **S1** (resolve every line; round binds the design state; unknown ownership is a flag not a block; depth tier printed; the motor's 301 line and the §848 amber; the cells' MPF minimum and Taiwan 10 %; domestic "no entry"; claim ceilings on every card; event order; idempotent open) · **S2** (the cheaper motor second and blocked with both lists named; selection records declined reason, status and classification state; reason defaults; refusals for a blocked offer, an unknown reason code, a missing attestor; re-selection appends a successor; round confirms when every line is selected; two adjudication roles bound to the snapshot; refuse an analyst escalation and an unknown role) · **S3** (supersession with the seq in the note; the gate as the engine cell; typed reference lifts the block and is never validated; the three-line declaration rule) · **S4** (re-derive covers both lanes; tamper on the declined reason breaks at that seq) · the three no-change edits · package · order · cost hash · claims vocabulary · boundary — plus **documents** (sniffing, hidden line kept and named, exact offsets, sha over utf-8 bytes, same-process determinism and the recorded pin) · **fetch** (allowlist and the blocked demo hosts, blocked hosts logged and never requested, offline cache, `fixture://` cannot escape the fixtures directory, a missing fixture is an error not an exception, the CSL path passes through) · **schemas / verifier** (the eight forced outcomes, the unit trap, adjacency, comma refusal, ambiguity by group, dimension tuples, the stored figure is the document's, no classification slot) · **model port** (scripted order then abstain, cache miss then replay with usage, budget reserve and breach, live model abstains without a key and never touches the network, recording model fills and replays) · **Call A** (accepts the frame rate and records the prompt hash, abstains on a schema-invalid response and on a model abstain, and the **poisoned page**'s three outcomes end at the rule or at REJECT) · **rules / dry-run** (decimal-string thresholds and the sha, fields from the rows that apply, fires / does not fire / cannot conclude, tree rows not evaluated) · **fit** (all four dimensions, unresolved fields, case-insensitive substrings) · **evaluate on copies** (green, grey on an unpublished field, grey on an unverified rate, red on the USML row and on the tripped row, no-specs grey, ranking; the round digest is unchanged) · **proposals** (recorded as agent events, the stored proposal is a copy and candidate urls are in the chain, escalation over the pool and a human acceptance, a source the pool never listed is ignored, budget exhaustion is an abstain not a crash, a budget breach after a read candidate is grey not green, accepted/rejected lifecycle refusals) · **claims over proposals** (the never-say grep over a round carrying proposals) · **refresh parsers** (HTS free/percent, CROSS number-subject-date, GLEIF rows with a url and no percentage) · **eval harness** (the six measurements without a percentage; cache misses counted and abstains bucketed) · **engine adapter** (the Wave-0 response becomes `open_round` input; the 848 row becomes the amber flag; a bad revision is refused; `cannot_evaluate` rows reach `unresolved`; an unresolved rule blocks the declaration and the words name the cause) · **API and page** (health/states/envelope, `/now` read-only and defaulting to UNKNOWN, a lane refusal is 409 with the shipped body, malformed body 422, missing key 422 naming the key, unknown state 422 naming the states, select and a refusal, propose records an agent event whatever the cache holds, re-derive and tamper, the page renders from the response and says nothing forbidden) · **docs** (the glossary names the search terms, the ADRs and README carry the decisions and the claim sentence, every emitted kind is in the schema proposal).

**Every run is offline. No model call, no network call, no spend.**

## Where the data diverges from the spec (and the code follows the data)

1. **Thirteen lines, not twelve.** THE BUILD §1.1 says twelve; §2.4 lists thirteen rows. The fixture carries the thirteen; counts are read off the output.
2. **The DJI match lands on two lists.** The real CSL names "SZ DJI Technology Co., Ltd." on Treasury's CMIC list and lists it as an alternate name of "DJI" on the BIS Entity List. F-14's card text assumed the Entity List alone; the card prints both.
3. **Six review-required lines at baseline, not two.** Under the risk-tiered full walk, GroupGets, T-Motor, JLCPCB and LCSC have no ownership row, so thermal core, motor, propeller, board, passives and the IMU (sold by LCSC) are review-required; the other seven are clean because public terminal rows were typed for their manufacturers. S1's "every other tree no candidate match" was written for a seven-row table.
4. **No Kestrel line crosses the MPF minimum at quantity 2.** $576 × 0.3464 % is $2.00; the minimum needs about $9,694 of entered value. F-05's sentence was arithmetic, not law; the test asserts "minimum applied" at both quantities.
5. **Molicel cells on the Taiwan round are a domestic purchase there** (seller TW, ship-to TW): the card says "domestic purchase (TW): no entry", not "Taiwan customs: not modelled".
6. **The HG5700 has no list price** (quote only): its estimate prints "price not declared; sorts last" and the S3 gate still blocks the line on LIC.
7. **Every import card says "rate not verified"** because every base rate in `tariff.json` is expected, not read; the cost sort key is suppressed for unverified estimates by design (Tab 3 step 6). Charlie's data pass flips this.
8. **The 848 row's `part_class_in` names `flight_controller` / `radio` / `camera` / `gimbal`.** `radio` IS in that list and maps to itself in `RULES_PART_CLASS`, but the pool has no radio slot (its slots are `thermal_core` / `imu` / `battery_cells` / `io_mcu`), and the thermal core is `thermal_imager` → `sensor`, not `camera` — so the flag row cannot fire in the dry-run today. A mapping gap for the engine (`camera` vs `thermal_imager`) plus a pool gap (no radio candidates), not sourcing logic.
9. **`rules.DRAFT.json` has no 7A002.a.2 branch** (rate range ≥ 500 °/s), so a ≥ 500 °/s gyro comes out "no draft row; cannot conclude". A rule-table gap for Charlie (D-6).
10. **ICM-42688-P is grey by design.** The S2 verifier confirmed DS-000347 v1.9 publishes no bias stability and no angle random walk, so the row cannot fire and the candidate cannot go green.
11. **The escalation agent is never confident by design.** Origin is a declaration, not a datasheet number, so no span can settle it; the agent proposes sources and a human resolves.
12. **The CSL loader stamps a fixed retrieved-at.** `forge_sourcing/fixtures.py::_load_csl` hardcodes `2026-09-04T00:00:00Z` in all three branches, including the unknown-hash branch, so a freshly refreshed full list would print the snapshot date rather than its own. `refresh_csl.py` records the real timestamp in `.cache/csl/manifest.json` and nothing reads it back. Human-run refresh path only, not load-bearing for any committed output; pending Charlie's ruling (read the refresh manifest, or print "not verified").
13. **Four tree-dependent rows are `not_evaluated` on every single-node dry-run.** `USML-120.41(a)(2)-catch`, `RELEASE-120.41(b)(2)`, `RELEASE-120.41(b)(3)` and `ITAR-120.41-note2` need a tree the single-node dry-run does not have, and `evaluate.py`'s status ladder does not read `dr["not_evaluated"]` — so a GREEN card's line still reads "every check concluded on a copy". Reading `not_evaluated` into the grey condition would grey every card in this slice; the recommended fix (pending Charlie's ruling) is a words line naming the rows deferred to the engine seam and a softened GREEN sentence.

## Where the code diverges from the plan (reviewed, committed, and why)

Every item below is a reviewed change to the plan's verbatim code, made in a numbered fix round with the reviewer's finding recorded in the execution ledger.

1. **The verifier** (`verify.py`, three fix rounds, `ec3ca91 · 4d079fa · c6456c2`). The plan's `parse_number_unit` paired the first number in a quote with the first recognised unit, so "Volumetric 643 Wh/l; Gravimetric 242 Wh/kg" accepted **643 Wh/kg** — a fabricated figure through the lane's core property. Now: a number binds only to its **adjacent** unit; an unknown unit spelling **fails closed** instead of raising; a comma between digits that is not a thousands group **refuses** the quote instead of inventing a number; two figures of the expected unit in one quote are **ambiguous**, not a free pick; a dimension tuple ("160 x 120 pixels") binds every component to the shared unit as **one group**, and ambiguity counts groups; the stored `Spec.value` is the **document's** number, not the model's spelling.
2. **The proposal record** (`service.py`, `1c9bcb1`). Proposals are stored **by copy**, candidate urls are **hashed at proposal time** (so the url in the terminal event is the one that was proposed), and a resolved proposal **refuses** every further verb (no accept-then-reject, no repeat rejects).
3. **The proposer** (`propose.py`, `fetch.py`, `4f96a6e`). `fixture://` names are **confined to the fixtures directory** at both doors (probe-clean against symlink, backslash, absolute and `%2e%2e` forms); escalation sources are **gated to the pool's own documents**, so a url the model invents is ignored; and an abstained proposal is **forced grey and not-confident** even when a candidate was read before the budget ran out.
4. **The engine adapter** (`engine_adapter.py`, `85c8675`). `cannot_evaluate` rows reach `unresolved` from **every** tripwire list, not just `unresolved_tripwires`; an unresolved rule **blocks** the declaration (fail-closed extension, controller's ruling); and the blocked words name the **cause**.
5. **The API** (`app.py`, `50240c3`). Lane refusals are the **only** 409s — body parsing moved inside the boundary so a malformed or incomplete body is **422**, not a 500 and not a 409; `select` without an `attestor` **key** is 422 (an attestor present but refused by the service stays 409); and the read-only and tamper tests assert the property each is named for, rather than asserting F-25 by name.
6. **The extract prompt** (`prompts.py`, `fe5fa45`). It asks for the **shortest clause** containing the figure and its unit, because the verifier refuses a whole row carrying two same-unit groups as ambiguous.
7. **The fix pass after the whole-branch review** (the candidate commit named under Custody; every item below has a covering test).
   - **C1 — attestor guards before mutation.** `resolve_escalation` and `dispatch` refuse an empty or null attestor as their **first line**. Before, the escalation read `resolved` (and the packet read `acknowledged`) before the thread refused the terminal event, so a package could build over an escalation nobody attested — and the page's Cancel on the attestor prompt sends exactly that null. `select`, `adjudicate` and `declare` already refused inside their `build_*` functions and are unchanged.
   - **I5 — proposal lifecycle.** The resolved-once guard tests key presence, not truthiness; `reject_proposal` needs an attestor (`proposal_rejected` is not a terminal kind, so the thread alone let `""` through); `record_proposal` refuses a duplicate `proposal_id` and a `kind` outside `alternative` / `escalation`; the proposal id hashes an ordinal, so two identical proposals in one second are two records.
   - **I6 — the verifier's letter glue.** A number or tuple glued to a letter (`IP67`, `Rev1.9`, `P45B`) and a hex literal (`0x20`) are not figures; a unit followed by `/` is not a unit (`mm/s`). `160x120 pixels` still binds both components. The hex-literal rule was added because the letter-glue rule alone cannot refuse `0x20 mm` (its first component is not glued).
   - **I8 — close-out.** `close_order` refuses an unknown packet (`UNKNOWN_PACKET`) and one never dispatched (`NOT_DISPATCHED`, on `create_packet`'s literal `acknowledgement_state == "not dispatched"`) instead of a bare subscript (a 500 at the API) and a close-out with no dispatch behind it.
   - **I3 — the chain names the bytes.** Every `*_proposed` event's candidate row carries `url` (top-level or `document.url`) and `doc_sha256`; `None`-valued keys are dropped, so a url-less, document-less candidate still hashes as `{mpn, status}`.
   - **I2 — redirects.** A `HTTPRedirectHandler` subclass refuses a redirect off the allowlist **before** the redirected request is made and logs `BLOCKED`; the post-read re-check stays as belt and braces.
   - **I4 — bad vendor bytes.** A byte stream the reader cannot decode greys ONE card (`no document: ERROR <type>`, no `doc_sha256`, no extract call) instead of raising out of the proposal; a `BudgetExhausted` inside the read still aborts the proposal.
   - **I1 — budgeted live mode.** The API builds its live model under `Budget(calls_cap=40, cost_cap_microusd=5_000_000)` (the $5 per-process cap `record_cache.py` uses) and the suite pins `TRIPWIRE_LLM=cache` before any app import.
   - **I7 (plan-mandated; the reviewer confirmed it contradicts no plan text).** `LiveAnthropicModel.propose` records a `Call` for every abstain (`_complete` returns `(response | Abstain, usage | None)`), so `calls[-1].usage` is never the previous call's; usage is kept when tokens were spent on a `stop_reason` or not-JSON abstain.
   - **M1–M5.** `design_revision` is checked with `fullmatch` (a trailing newline no longer passes); the `unresolved` dedupe is keyed on the rule id, the row's citation and the cause node id (all three, not `rule_id` alone), row shape unchanged; a NUL in a `fixture://` name is `BLOCKED`; the escalation budget catch prints `abstained: budget: …`; a non-integer `quantity` / `seq` and an unknown propose `kind` are 422s with the error named.
   - **P-G (plan-mandated; the reviewer confirmed it contradicts no plan text).** The page prints every proposal's `claim_ceiling` under its card, abstained proposals included.
   - Also: the never-say test now scans an adapter-built round (both engine fixtures, through gate and declare); design states are copied (`forge_sourcing.fixtures.design_state`) in the API, the eval harness and the test fixtures; `propose.py`'s docstring says what the model sees (the published paragraph, not the threshold atoms).

## Shared-contract proposals (nothing edited from the lane)

1. **Custody registry** — admit lane `sourcing` from `packages/sourcing/handoff/custody-lane-entry.proposed.json` into `governance/custody.v1.json`. Note that `lane/classification` was merged into `main` on 2026-09-05 with its receipt still `NOT_ADMITTED`, so merging the lane history is the integrator's path here too.
2. **Platform records** — the sourcing, order and proposal event kinds map onto the `supply` and `platform` authority domains of `docs/contracts/platform-records.v1.md`; the lane's `Thread` is a stand-in for the platform log's `append/rederive` and should be replaced by it, events unchanged (ADR-0003).
3. **Engine input shape** — `forge_sourcing_api.engine_adapter.design_for_round` consumes the Wave-0 candidate response **verbatim**. `open_round` reads per node: `node_id, slot, part_class, item_kind, mpn, manufacturer, origin, quantity_per, value_usd, evaluation {jurisdiction, entries, fired, contains_defense_article, flags, flag_text, destinations{CC → {state, because[]}}}`. Two gaps for the engine lane: the response needs **per-country `destinations` cells** before the export gate can pass anything (P0 prints `not_evaluated`), and **real MPNs** before `resolve` finds offers (the Wave-0 design fixture is synthetic).
4. **Log-schema kinds and actor fields** — `handoff/log-schema-kinds.proposed.json` (the enum additions, `actor_kind`/`attestor`/`prev_hash`, and the rule that only `*_proposed` kinds may be written by an agent). `tests/sourcing/test_docs.py` asserts every kind the lane emits is in that file.
5. **S-5 corrections for the two catalogs outside this lane** — `features/tripwire/data/catalog/catalog.json` and `frontend/src/lib/catalog.ts` + `frontend/src/lib/sourcing.ts`:
   - Molicel P45B: **260 → 242 Wh/kg** (datasheet v1.4).
   - Honeywell HG5700: part number `HG5700AB03` → **`68905700-CA01`**; bias stability **0.01 °/h**, ARW **0.0062 °/√h** (not 0.002); drop the time-window note.
   - Amprius: `SA08-450` → **`SA102`**; 4.3 Ah is published, mass and nominal voltage are not.
   - Boson+ is **one** catalog line, with frame rate and ECCN bound per destination at fulfilment.
   - Lepton's declared ECCN in `sourcing.ts` reads `6A003.b.4.a` where THE BUILD's fact-sheet line reads **6A993** — Diego to reconcile.
   (The lane's own descriptions were checked and state no ARW, bias-stability or time-window figure for the HG5700, so nothing inside `packages/sourcing/**` needed the correction.)
6. **Wiring** — mount `forge_sourcing_api.app.router` at a prefix of its own (`FORGE_SOURCING_PREFIX`, e.g. `/api/sourcing-lane`): `apps/product-service/product_service/sourcing_api.py` (Benji, 2026-09-05) already owns `/api/sourcing/*` with a stateless, client-carried-state contract for one part, and `POST /api/sourcing/rounds` exists in both with different bodies and envelopes. On `diego-uiux-refinement` the frontend's Vite `/api` proxy targets the deployed Candidate 0.1 product service by default (`VITE_API_TARGET` overrides it locally), and the Vercel `frontend/api/[...path].ts` allowlist enumerates routes, so the lane's routes need adding there. The FB-04 integration owner mounts the router into the product service or `features/tripwire/backend/app.py` (one `include_router` line with that prefix) **or** runs `make serve` on 8000 during the demo with the page at `GET /`.
7. **`rules.DRAFT.json` gaps 8–9 above** for Charlie's sign-off (D-6).
8. **Corrections to the contract as the plan wrote it** — the integrator should code against these, not against the plan text:
   - A **409 body is nested**: `{"detail": {"refused": <ExceptionName>, "code": <str|null>, "detail": <str>}}`. It carries **no `candidate`** envelope; every 2xx body does. (Whether a 409 should also carry the envelope is pending Charlie; the page was validated against the shipped shape.)
   - `forge_search.model.propose` is **schema-agnostic** — it enforces JSON-parseability only. **Every caller validates**: Call A validates against `EXTRACT_SCHEMA`, Call B and the escalation agent against `SEARCH_SCHEMA`. A new caller that skips `validate()` skips the closed schema.
   - `GET /` lives on **`app`, not `router`**. An integrator who mounts only the router gets the verbs and **not** the page. There is no static-asset route; `round.html` is one self-contained file.
   - `POST /tamper` is **unauthenticated demo tooling**. Env-gate it at integration.
   - `product.engine.canonical_sha256_check` is **always `differs`** — the lane's canonical JSON is not the engine's, so the lane never independently confirms `design_revision`. Either the enum gains a `not_checked` value or the field goes (pending Charlie).
   - The **root product's engine determination is not carried onto the round**: `design_for_round` keeps per-node evaluations only. An additive `product["evaluation"]` was proposed and not built (pending Charlie).
   - The page's ship-to selector offers **two of the four** ship-tos (`US-bench`, `TW-assembly`); the lane accepts `DE-assembly` and `CA-assembly` too.
   - The page prints the search-lane **ceiling sentence only through candidate cards**, so an abstained proposal (which has no cards) shows only the header's "the agent proposes; a human resolves". The proposal record carries a `claim_ceiling` field; rendering it under each proposal card is a one-line page fix (pending Charlie).
   - `POST /rounds` expects an **integer** `quantity`; the page must send an int.
9. **The frontend seam, field by field**, for whoever wires `frontend/src/lib/service.ts`:
   - `openRound(shipTo, qty, mode, intake)` → `POST /rounds {state|design, ship_to, quantity, transport_mode, request_key, run: true}`, with `ShipTo 'US'|'TW'|'DE'|'CA'` → `US-bench|TW-assembly|DE-assembly|CA-assembly`.
   - `refineRound` → `refine` (and `rescreen` for the no-change edit).
   - `selectOffer(lineId, offerId, attestor, reasons)` → `select {line_id, offer_hash, declined[{offer_hash, reason_code}], attestor}`; his `DeclineReason` words map onto the lane's codes: `'lead time' → lead_time`, `'owner screened' → owner_screened`, `'ownership unknown' → ownership_unknown`, `'export gate' → export_gate`.
   - `adjudicate(..., action)` → `adjudicate {role, disposition ∈ false_positive|resolved|escalate}`; `'pin' → escalate`, `'resolve' → resolved`.
   - `setReference` → `gate {references: {line_id: {reference, attestor}}}`.
   - `declareTechData` → `declare`; `'US person' → us_person`, `'foreign person' → foreign_person`.
   - `buildPackage` → `package`. `sendOrder` / `retrySend` → `POST /packets` then `/packets/{id}/dispatch` with the same idempotency key.
   - `proposeEscalation` / `resolveEscalation` → `propose {kind: escalation}` / `accept_proposal` | `reject_proposal`; his Call B → `propose {kind: alternative}`.
   - Fields: his `Line.id` `l-<slot>` ↔ the lane's `line:<node_id>` through `pool.aliases`; `Offer.unitPrice: number` ↔ `unit_price_usd` **decimal string**; `Ladder.rows[].amount: number` ↔ `estimate.ladder[].amount` **string**; `OfferStatus` words identical; `Candidate.state 'green'|'grey'|'abstained'` ↔ the lane's `green|grey` plus a `rejected` list his UI does not show (S4: red is never shown as proposed). His `selectOffer` also refuses an unverified rate, which F-14 does not require and the lane does not do — integrator's call.
10. **Release hygiene** — `packages/sourcing/.gitattributes` exempts the verbatim CRLF screening-list CSV from `git diff --check`; `python3 tools/check_release_diff_hygiene.py --base <main> --candidate <lane> --authored-path 'packages/sourcing/**' --authored-path 'tests/sourcing/**'` prints `AUTHORED_DIFF_HYGIENE_PASS`.
11. **Placement** — this lane is the sourcing lane (F-13…F-16) plus the substance of FB-06 (extractor, replacement search); Benji's `features/tripwire/docs/SHIP_EXECUTION_PLAN.md` keeps FB-05/FB-06 off the hackathon critical path, and this lane touches none of FB-04's allowlist.

## Dependencies, licences, data

Runtime: `forge_sourcing` is **standard library only**. `forge_search` adds `pypdf==6.17.0` (BSD-3-Clause) and `jsonschema==4.26.0` (MIT). The API adds `fastapi==0.121.2` (MIT) and `uvicorn==0.41.0` (BSD-3-Clause). Live, opt-in and not installed by the tests: `anthropic==1.4.0` (MIT). Dev: `pytest==8.4.1` (MIT), `httpx==0.28.1` (BSD-3-Clause), build backend `hatchling==1.27.0` (MIT). The exact-version licence and transitive-notice review AGENTS.md requires is owed before promotion.

One third-party `DeprecationWarning` is visible on `test_api.py`: starlette 0.49.3 reaches `anyio.abc.BlockingPortal` and anyio 4.15.1 has moved it to `anyio.from_thread`. It is left **visible and unfiltered**, and anyio is deliberately **not pinned** — the warning is the truth about the pinned versions, and hiding it would hide the next one too. It goes when starlette catches up.

Data: the CSL subset is public .gov data (data.trade.gov) copied verbatim from the Tripwire corpus snapshot of 2026-09-04 under Charlie's standing pull grant; the draft rules are a byte copy from the ship branch; fixture documents are team-authored and badged SYNTHETIC; real vendor documents are fetched under the allowlist into an ignored cache and never committed.

## Claim ceiling

**Demonstrated:** the round mechanics over fixtures — resolution, the walk, the screen and its roll-up, the ladder's arithmetic and determinism, the refusals, the gate's reading of an engine cell, the declaration rule, the fail-closed package, exactly-once synthetic dispatch, re-derive and tamper — plus the search mechanics on committed fixtures and a scripted model: the fetch allowlist and its BLOCKED log, deterministic text with a recorded extractor pin, the eight forced verifier outcomes and the unit trap, Call A over the poisoned page, the dry-run's three outcomes, the fit comparator, evaluate on copies (the round hash is unchanged), proposals as agent events, human accept/reject, the HTTP adapter and the page.

**Not shown, not claimed:** any classification, customs or legal outcome (every output carries its ceiling sentence); ownership completeness (the table is what was typed); any tariff rate as correct (base rates are expected values); that a typed authorization reference is valid; any real order, supplier contact or filing; signing — plus any **live model behaviour** (no cache recorded, no live run); any **real datasheet extraction** (documents not seeded in this session); two-machine determinism; that the search finds anything **outside the pool**; and any accuracy figure.

## Remaining unknowns

- The engine's real `evaluate()` output (every evaluation block is hand-typed today).
- Base rates for the ten headings and the Chapter 99 headings for the Taiwan action and the 2024 review rows (Charlie, HTS Revision 17 and the FR notices).
- The ownership rows marked "unverified this session" (typed from memory of public filings; the urls are to be read).
- Section 122's current status (printed as a banner, never a rate).
- The ITAR 122.5 retention anchor and period (printed as five years from the transaction; Charlie reads the section).
- **`data/llm_cache/` is not recorded.** Until `make record-cache` runs once, every proposal abstains "cache miss" and `make eval` reports six misses (Charlie holds the key).
- **Documents are not seeded.** `make seed` has not run in this session; st.com, digikey.com and mouser.com are expected to fail.
- **`determinism_check.py` has never run on a second machine**, so cross-machine extraction determinism is unproven (the committed test is same-process by design).
- **Digi-Key v4 terms unread** — nobody has read them, so the distributor-API route stays shut.
- **Charlie's D-6 sign-off** on `rules.DRAFT.json`, and the two rule-table gaps (items 8–9 above).
- The two adapter questions pending Charlie: `canonical_sha256_check` always `differs`, and whether the root product's engine determination should be carried onto the round.

### Known shortcomings carried (reviewed, deferred, all in the execution ledger)

The eight items the whole-branch review carried here (verifier letter glue, the lifecycle truthiness guard, the NUL fixture name, the `unresolved` dedupe key, the bare packet subscript on close, the unscanned adapter round, the live `Call` on abstain, the escalation budget word) were all closed by the fix pass — see "Where the code diverges from the plan", item 7. What remains:

- **`rules.atoms()` drops a row's `not` clause when the row also carries `all` / `any`** (`forge_search/rules.py`), so the dry-run can fire rows their own guard should suppress (`3A001.a.2.a/.b/.c`, `7A002.a.1.b`, `9A610.x`, `USML-120.41(a)(2)-catch`). Every such `not` clause is a `declared` / `part_class_in` atom, so over-firing yields red or grey, never a false green. **Pending Charlie's ruling (P-C); deliberately not touched in the fix pass.**
- **Design states are now copied.** `forge_sourcing.fixtures.design_state(states, name)` returns a deep copy (baseline, or `replace_nodes` laid over the baseline); the API's `_state`, `scripts/eval_search.py` and the test fixtures all go through it, so a round's lines no longer alias the fixture's node dicts (`new_round` copies `evaluation` by reference). A note for the integrator, not a defect.
- **Concurrency.** The sync routes (`GET /health`, `/states`, `/now`, `/rounds/{id}`, `/timeline`, `GET /`, `POST /rederive`) run in Starlette's threadpool while the `async def` verbs (`POST /rounds`, `/rounds/{id}/{verb}`, `/packets…`, `/tamper`) run on the event loop; `SVC` is one in-memory object with no lock, so a read in the threadpool can interleave with a verb mid-mutation, and a live `propose` blocks the loop for the call's duration (20 s timeout). One process, one operator for the demo; a lock or a single worker at integration.

## Deliberately not built

Thread persistence (the platform log replaces `Thread`); the Batches API; PDF-vision input; a headless-browser fetcher; distributor APIs; joint design-to-target search.

## Rollback

Nothing on `main` changed. Delete the branch (`git branch -D lane/sourcing-search`), remove the worktree, and remove `packages/sourcing/.cache`.

## What the page said (Task 5.3 walk-through)

Controller's browser walk-through, 2026-09-06, git `6fd7050`, `TRIPWIRE_LLM=cache`, `data/llm_cache` empty. Server: `make serve` (uvicorn 127.0.0.1:8000). Page: `GET /` (200, text/html). Envelope on `/health`: `git_sha 6fd70505…`, `mode {llm: cache, api: cached}`, `pool_sha256 56682ab9…`, `rules_sha256 ac95bcdd…`, fixture shas `offers@fb1a82ef ownership@51960858 tariff@c4e68789 csl@fa863267`.

1. baseline · US-bench · qty 1 → "Open and run S1". Round headline: `13 lines resolved · screening review (6 review required, 1 blocked) · fixtures offers@fb1a82ef ownership@51960858 tariff@c4e68789 csl@fa863267`; rail `opened offers screened costed selected gated packaged` (costed lit). Timeline tail: `#61 sourcing estimate · line:thermal_core · 8525.80 / US · hash 76de2f08` … `#68 sourcing estimate · line:passives_connectors · aggregate / CN · hash 79dc032a`.
2. Expand `motor · MN5008 · EAR99 · amber 848_amber`. Cards in order: (1) `review required · T-Motor store` — "T-Motor store / CN · manufacturer T-Motor / origin CN (declared) · unit price $60.00 (Diego 2026-09-03 research worked example: $60) · stock in stock · lead 12 d · MOQ 1 · declared ECCN — (not yet classified; nobody, no date) · tariff code 8501.31 (Charlie typed; fork printed: 8501.51-.53 per Kaohsiung Customs, 2026-09-05) · declared, unverified · depth: full_walk (foreign-origin part (CN); red flag fired: 848_amber) · review required: ownership unknown — no ownership row typed for T-Motor (Nanchang); unknown is a review flag, not a match · review required does not stop a selection; review blocked does · Section 301, List 3, 25 %, 9903.88.03 · MPF $33.58 (minimum applied) · landed $110.98 · per unit $110.98 · estimate · Estimate from declared tariff code and origin against a dated tariff table. Not a customs determination. · rate not verified — greyed; sorts last · amber · US Government buyer column: FY2020 NDAA §848 / DoD class deviation 2020-O0015 — component manufactured in the PRC; amber, no export-control change · Distributor-declared availability, price, classification and tariff code as of the fixture date. Not a quote, not a classification determination."; (2) `review blocked · Brightwing Components SYNTHETIC` (second, as planned) — "SYNTHETIC seller · Brightwing Components / HK · manufacturer T-Motor / origin CN (declared) · unit price $42.00 (SYNTHETIC: 30 % below the T-Motor store price) · stock in stock · lead 9 d · MOQ 1 · … · review blocked: owner SZ DJI Technology Co., 60 % owner via owns_ge_50, ownership row SYNTHETIC matched on the Consolidated Screening List (Entity List (EL) - Bureau of Industry and Security via alternate name; Non-SDN Chinese Military-Industrial Complex Companies List (CMIC) - Treasury Department) · … · landed $87.76 · per unit $87.76 · estimate …".
3. Select the T-Motor card (attestor "benji"). Line header gains `· selected`. Timeline: `#69 sourcing selected T-Motor store · cheaper offer declined · owner screened · attested by benji`.
4. f3_boson → "Open and run S1". thermal_core line now `thermal_core · 20640A012-6PAAX · 6A003.b.4.b`. Timeline `#130 sourcing estimate · line:thermal_core · 8525.80 / US · hash d6b61f15` … `#137`.
5. "Propose alternative" on thermal_core (no committed cache) → Proposals section: `grey · alternative · line:thermal_core CACHED [Reject]` / `abstained: cache miss`. Timeline: `#138 proposal agent proposed 0 candidates for line:thermal_core · grey · not confident · CACHED · abstained: cache miss · pool 56682ab9 · rules ac95bcdd`.
6. "Re-derive" → `138 events · chain intact · unsigned in this lane (hash chain only); Ed25519 signing belongs to the log module · 28 estimates recomputed, 28 hashes equal · 50 screenings recomputed, 50 equal`.
7. Tamper seq=69 field=declined.0.reason_code value=price → "Re-derive" → `BREAK at #69 (offer_selected) · 138 events · chain verification stopped`.

Observations for the integrator (not defects in the page's own logic): the ship-to selector offers only `US-bench` and `TW-assembly` although the lane accepts `DE-assembly` and `CA-assembly` too; an abstained proposal card shows no candidate cards, so the search-lane ceiling sentence appears only where a candidate card prints it; the page's Select / Accept / Reject use `window.prompt()` for the attestor (a plain dialog, fine for the demo). Footer on every render: `llm cache · git 6fd70505 · log head #<seq>`.

## Custody check (verbatim)

Run against the proposed lane row, because the registry does not carry this lane yet: the repository's `tools/check_custody.py` and `governance/custody.v1.json` were **not modified**; a copy of the tool with `REPO_ROOT` and `REGISTRY_PATH` rewritten was run over a merged registry (the repository's registry plus `packages/sourcing/handoff/custody-lane-entry.proposed.json`), both written under the coordinator's gitignored scratch directory.

```
lane=sourcing
branch=lane/sourcing-search
base=92241b9ca7c9df37cc48e55b4ea388cb21686bb4
head=HEAD
changed_paths=95
  governance/receipts/sourcing.json
  packages/sourcing/.gitattributes
  packages/sourcing/.gitignore
  packages/sourcing/CONTEXT.md
  packages/sourcing/HANDOFF.md
  packages/sourcing/Makefile
  packages/sourcing/README.md
  packages/sourcing/data/csl_subset.csv
  packages/sourcing/data/kestrel_round_input.json
  packages/sourcing/data/llm_cache/.gitkeep
  packages/sourcing/data/manifest.json
  packages/sourcing/data/offers.json
  packages/sourcing/data/ownership.json
  packages/sourcing/data/search/documents.json
  packages/sourcing/data/search/engine/evaluate-camera-flag.json
  packages/sourcing/data/search/engine/evaluate-missing-evidence.json
  packages/sourcing/data/search/engine/kestrel-baseline.design.json
  packages/sourcing/data/search/fixtures/gx220_vendor_page.html
  packages/sourcing/data/search/fixtures/icm42688p_test_excerpt.txt
  packages/sourcing/data/search/fixtures/imu_ng_synthetic_sheet.txt
  packages/sourcing/data/search/fixtures/lepton35_test_sheet.txt
  packages/sourcing/data/search/fixtures/molicel_p45b_test_excerpt.txt
  packages/sourcing/data/search/gold_swaps.json
  packages/sourcing/data/search/pool.json
  packages/sourcing/data/search/rules.DRAFT.json
  packages/sourcing/data/tariff.json
  packages/sourcing/docs/adr/0001-round-defaults-are-refinable-and-the-fixture-is-the-truth.md
  packages/sourcing/docs/adr/0002-status-outranks-price-and-the-declined-offer-is-the-record.md
  packages/sourcing/docs/adr/0003-hash-chain-in-the-lane-signing-in-the-log-synthetic-dispatch-exactly-once.md
  packages/sourcing/docs/adr/0004-a-bounded-proposer-over-an-owned-pool.md
  packages/sourcing/docs/adr/0005-pypdf-pinned-character-offsets-hidden-text-kept.md
  packages/sourcing/forge_search/__init__.py
  packages/sourcing/forge_search/documents.py
  packages/sourcing/forge_search/dryrun.py
  packages/sourcing/forge_search/evaluate.py
  packages/sourcing/forge_search/extract.py
  packages/sourcing/forge_search/fetch.py
  packages/sourcing/forge_search/fit.py
  packages/sourcing/forge_search/model.py
  packages/sourcing/forge_search/prompts.py
  packages/sourcing/forge_search/propose.py
  packages/sourcing/forge_search/rules.py
  packages/sourcing/forge_search/schemas.py
  packages/sourcing/forge_search/verify.py
  packages/sourcing/forge_sourcing/__init__.py
  packages/sourcing/forge_sourcing/cost.py
  packages/sourcing/forge_sourcing/fixtures.py
  packages/sourcing/forge_sourcing/gate.py
  packages/sourcing/forge_sourcing/hashing.py
  packages/sourcing/forge_sourcing/order.py
  packages/sourcing/forge_sourcing/package.py
  packages/sourcing/forge_sourcing/parties.py
  packages/sourcing/forge_sourcing/round.py
  packages/sourcing/forge_sourcing/screen.py
  packages/sourcing/forge_sourcing/select.py
  packages/sourcing/forge_sourcing/service.py
  packages/sourcing/forge_sourcing/thread.py
  packages/sourcing/forge_sourcing_api/__init__.py
  packages/sourcing/forge_sourcing_api/app.py
  packages/sourcing/forge_sourcing_api/engine_adapter.py
  packages/sourcing/forge_sourcing_api/static/round.html
  packages/sourcing/handoff/custody-lane-entry.proposed.json
  packages/sourcing/handoff/log-schema-kinds.proposed.json
  packages/sourcing/pyproject.toml
  packages/sourcing/scripts/build_manifest.py
  packages/sourcing/scripts/determinism_check.py
  packages/sourcing/scripts/eval_search.py
  packages/sourcing/scripts/record_cache.py
  packages/sourcing/scripts/refresh_cross.py
  packages/sourcing/scripts/refresh_csl.py
  packages/sourcing/scripts/refresh_hts.py
  packages/sourcing/scripts/refresh_ownership.py
  packages/sourcing/scripts/seed_documents.py
  tests/sourcing/conftest.py
  tests/sourcing/test_api.py
  tests/sourcing/test_boundary.py
  tests/sourcing/test_claims_vocabulary.py
  tests/sourcing/test_cost_hash.py
  tests/sourcing/test_docs.py
  tests/sourcing/test_engine_adapter.py
  tests/sourcing/test_eval_search.py
  tests/sourcing/test_package_and_order.py
  tests/sourcing/test_refresh_scripts.py
  tests/sourcing/test_search_claims.py
  tests/sourcing/test_search_documents.py
  tests/sourcing/test_search_evaluate.py
  tests/sourcing/test_search_extract.py
  tests/sourcing/test_search_fetch.py
  tests/sourcing/test_search_fit.py
  tests/sourcing/test_search_fixtures.py
  tests/sourcing/test_search_model.py
  tests/sourcing/test_search_propose.py
  tests/sourcing/test_search_rules_dryrun.py
  tests/sourcing/test_search_verifier.py
  tests/sourcing/test_sourcing_flips.py
CUSTODY_PASS
```
