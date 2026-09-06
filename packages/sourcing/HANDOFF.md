# Handoff: sourcing lane

## Objective

The sourcing backend the DNHacks design suite specifies: "Source this design" as a Job-1 evidence record. A round bound to one exact design state resolves offers per line from a committed fixture, walks ownership with risk-tiered depth, screens every party against a dated Consolidated Screening List snapshot, computes a landed-cost ladder per offer as a pure hashed function, records the engineer's selection with every declined offer and its reason, gates each line for a ship-to outside the US on the rule engine's destination cell verbatim, takes the technical-data declaration under the three-line rule, builds a fail-closed package of three hashed artefacts, and dispatches a synthetic order packet exactly once. Everything is an event in a hash-chained thread that re-derives. Direction of record: strafe-prototype `docs/dnhacks_engineering_direction_2026-09-05.md` §3.6–§3.8 and `docs/dnhacks_feature_specs_2026-09-05.md` F-13…F-17, as corrected by Diego's 2026-09-03 research and 2026-09-05 validation. Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001…0003`.

## Custody

- Branch: `lane/sourcing` (fresh from `main @ 92241b9ca7c9`); candidate (code) commit `3b7e840845c250f821884be50ffe9acd84ed9fca`; this handoff commit is its direct successor and changes no runtime source.
- Worktree label `forge/sourcing`; writable `packages/sourcing/**`, `tests/sourcing/**`, `governance/receipts/sourcing.json` — every changed path is inside that allowlist (custody output below).
- Registry: **not admitted**; the lane entry is proposed at `packages/sourcing/handoff/custody-lane-entry.proposed.json`. No shared file was edited from the lane.
- Authority: Charlie Haywood's in-session instruction, 2026-09-05 evening ("implement the sourcing back end"). Not pushed; merge to `main` is not requested here.
- Base and independence: the lane is based on `main`, not on `ship/caddydaddy-integration`, and imports nothing from `features/tripwire`, `packages/classification` or `packages/compliance-bridge`. It takes the engine's per-node evaluation as input data.

## The lane (`packages/sourcing/forge_sourcing/`)

```python
from forge_sourcing import Service
svc = Service(Path("packages/sourcing/data"))
r = svc.open_round(design, ship_to="US-bench", quantity=1, transport_mode="air", request_key="demo-1", opened_at="2026-09-06T01:00:00Z")
svc.resolve(r["round_id"]); svc.screen(r["round_id"]); svc.cost(r["round_id"], entry_date="2026-09-06")
view = svc.round_view(r["round_id"])        # the browser renders this and computes nothing
```

| Module | Interface | Owns |
|---|---|---|
| `service` | the seam: `open_round · resolve · screen · rescreen · cost · refine · select · adjudicate · resolve_escalation · gate · declare · build_package · create_packet · dispatch · close_order · rederive · tamper · round_view · timeline` | binding every event to design hash, design seq and fixture hashes; the words on every card |
| `round` | `new_round`, `transition`, `request_key_hash` | the round record, the status order, idempotency, supersession |
| `parties` | `depth_tier`, `extract_parties`, `walk` | risk-tiered depth (printed with reasons); the walk over the ownership table; `unknown` and `terminal` ownership states |
| `screen` | `normalize`, `screen`, `node_status`, `rollup` | exact and suffix-normalized matching over name and alternate names; adjudication effects; worst-node roll-up |
| `cost` | `estimate` (pure) | the ladder: base by heading with HTS revision · Section 232 scope · Section 301 by Chapter 99 heading · country action · AD/CVD · MPF by fiscal-year row with min/max · HMF ocean-only · Section 122 banner · de minimis note · total, per-unit, assumptions, claim ceiling, hash; domestic → "no entry"; foreign ship-to → destination notes |
| `select` | `build_selection`, `build_adjudication`, `default_reason` | refusals (blocked, stale fixture, hash fail, missing decline, unknown reason); two roles; snapshot binding |
| `gate` | `evaluate_gate`, `required_reference`, `build_declaration` | the engine's cell verbatim; typed-not-validated references; the three-line rule with the 734.13 sentence |
| `package` | `verify_bindings`, `pre_entry_lines`, `diligence_record`, `export_references`, `retention`, `warnings` | fail-closed re-verification; Chapter 99 lines per program in CBP's order; FCC two states; lithium as carriage; 9802 pointer; retention per regime; locked disclaimers; first-run checklist |
| `order` | `create_packet`, `synthetic_dispatch` | the packet fields of thread 5 §10; SYNTHETIC label; the exception fixture |
| `thread` | `append`, `verify_chain`, `tamper`, `of_kind`, `head` | hash chain; actor discipline (agents propose only; terminal kinds need a human attestor); no signing (ADR-0003) |
| `fixtures` | `FixtureStore` | manifests (source, retrieved-at, sha256, row count, revision); offers by content hash; ownership by normalized child; the CSL index |
| `hashing` | `canonical_bytes`, `sha256`, `content_id` | canonical JSON; floats refused |

Data (`packages/sourcing/data/`, manifested in `manifest.json`): `kestrel_round_input.json` (13 lines with hand-typed engine evaluations; the F4 HG5700 state), `offers.json` (17 offers; two SYNTHETIC sellers), `ownership.json` (18 rows; two SYNTHETIC), `tariff.json`, `csl_subset.csv` (7 verbatim rows of the 2026-09-04 snapshot; the loader takes the full 26,082-row CSV unchanged).

## Tests

`packages/sourcing/.venv/bin/python -m pytest tests/sourcing -q` → **40 passed in 0.16 s** on `3b7e840845c2`. Families: S1 (resolve every line; round binds the design state; unknown ownership is a flag not a block; depth tier printed; the motor's 301 line and the §848 amber; the cells' MPF minimum and Taiwan 10 %; domestic "no entry"; claim ceilings on every card; event order; idempotent open); S2 (the cheaper motor second and blocked with both lists named; selection records declined reason, status and classification state; reason defaults; refuse a blocked offer, an unknown reason code, a missing attestor; re-selection appends a successor; round confirms when every line is selected; two adjudication roles bound to the snapshot; refuse an analyst escalation and an unknown role); S3 (supersession with the seq in the note; the gate as the engine cell; typed reference lifts the block and is never validated; the three-line declaration rule); S4 (re-derive covers both lanes; tamper on the declined reason breaks at that seq); the three no-change edits (quantity 1→2; air→ocean adds only HMF; re-screen changes nothing); package (refuses on open origin escalation, on a tampered blob, on a Taiwan round without gate and declaration; three hashed artefacts with the locked disclaimer, checklist, warnings and retention); order (exactly once; exception path; refusals for unapproved and stale); cost hash (equal across instances; entry date moves the fiscal year); claims vocabulary (never-say grep over every string in the view and the thread); boundary (no model or network import; agents cannot write terminal events).

Every run is offline. **No model call, no network call, no spend.**

## Where the data diverges from the spec (and the code follows the data)

1. **Thirteen lines, not twelve.** THE BUILD §1.1 says twelve; §2.4 lists thirteen rows. The fixture carries the thirteen; counts are read off the output.
2. **The DJI match lands on two lists.** The real CSL names "SZ DJI Technology Co., Ltd." on Treasury's CMIC list and lists it as an alternate name of "DJI" on the BIS Entity List. F-14's card text assumed the Entity List alone; the card prints both.
3. **Six review-required lines at baseline, not two.** Under the risk-tiered full walk, GroupGets, T-Motor, JLCPCB and LCSC have no ownership row, so thermal core, motor, propeller, board, passives and the IMU (sold by LCSC) are review-required; the other seven are clean because public terminal rows were typed for their manufacturers. S1's "every other tree no candidate match" was written for a seven-row table.
4. **No Kestrel line crosses the MPF minimum at quantity 2.** $576 × 0.3464 % is $2.00; the minimum needs about $9,694 of entered value. F-05's sentence was arithmetic, not law; the test asserts "minimum applied" at both quantities.
5. **Molicel cells on the Taiwan round are a domestic purchase there** (seller TW, ship-to TW): the card says "domestic purchase (TW): no entry", not "Taiwan customs: not modelled".
6. **The HG5700 has no list price** (quote only): its estimate prints "price not declared; sorts last" and the S3 gate still blocks the line on LIC.
7. **Every import card says "rate not verified"** because every base rate in `tariff.json` is expected, not read; the cost sort key is suppressed for unverified estimates by design (Tab 3 step 6). Charlie's data pass flips this.

## Shared-contract proposals (for the integrator; nothing was edited from the lane)

1. **Custody registry** — admit lane `sourcing` (`handoff/custody-lane-entry.proposed.json`).
2. **Platform records** — the sourcing and order event kinds (`round_opened … order_closed`) map onto the `supply` and `platform` authority domains of `docs/contracts/platform-records.v1.md`; the lane's `Thread` is a stand-in for the platform log's `append/rederive` and should be replaced by it, events unchanged (ADR-0003).
3. **Engine input shape** — `open_round` reads per node: `node_id, slot, part_class, item_kind, mpn, manufacturer, origin, quantity_per, value_usd, evaluation {jurisdiction, entries, fired, contains_defense_article, flags, flag_text, destinations{CC → {state, because[]}}}`. That is the contract the engine lane must emit; `kestrel_round_input.json` is the example.

## Dependencies, licences, data

- Runtime: Python standard library only. Dev (lane-local): `pytest==8.4.1` (MIT); build backend `hatchling==1.27.0` (MIT). The exact-version licence and transitive-notice review AGENTS.md requires is owed before promotion.
- Data: the CSL subset is public .gov data (data.trade.gov) copied verbatim from the Tripwire corpus snapshot of 2026-09-04 under Charlie's standing pull grant; everything else is typed from the team's own documents and badged.

## Claim ceiling

Demonstrated: the round mechanics over fixtures — resolution, the walk, the screen and its roll-up, the ladder's arithmetic and determinism, the refusals, the gate's reading of an engine cell, the declaration rule, the fail-closed package, exactly-once synthetic dispatch, re-derive and tamper.

Not shown, not claimed: any classification, customs or legal determination (every output carries its ceiling sentence); ownership completeness (the table is what was typed); any tariff rate as correct (base rates are expected values); that a typed authorization reference is valid; any real order, supplier contact or filing; signing.

## Remaining unknowns

- The engine's real `evaluate()` output (every evaluation block is hand-typed today).
- Base rates for the ten headings and the Chapter 99 headings for the Taiwan action and the 2024 review rows (Charlie, HTS Revision 17 and the FR notices).
- The ownership rows marked "unverified this session" (typed from memory of public filings; the URLs are to be read).
- Section 122's current status (printed as a banner, never a rate).
- The ITAR 122.5 retention anchor and period (printed as five years from the transaction; Charlie reads the section).

## Rollback

Nothing on `main` changed. Delete the branch (`git branch -D lane/sourcing`; remove the worktree) and the lane is gone.

## Custody check (verbatim, changed paths elided — all inside the allowlist; run against the proposed registry entry)

```
lane=sourcing
branch=lane/sourcing
base=92241b9ca7c9df37cc48e55b4ea388cb21686bb4
head=HEAD
changed_paths=35
CUSTODY_PASS
```
