# Strafe Forge sourcing lane

"Source this design" as a Job-1 evidence record: who the part is bought from, who owns them, what it costs to land, and what the shipment to the assembly site needs. Every fact declared and dated, every unknown printed. The lane never re-evaluates a regulation: the export gate is the rule engine's destination cell verbatim, and if a screen ever needs a paragraph the engine did not print, that is a rule-table gap, not sourcing logic.

Direction of record: strafe-prototype `docs/dnhacks_engineering_direction_2026-09-05.md` §3.6–§3.8 and `docs/dnhacks_feature_specs_2026-09-05.md` F-13…F-17, as corrected by Diego's 2026-09-03 research and 2026-09-05 validation (the six tabs of *DNHacks 2026 The Build*). Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/`.

## Run

```bash
uv venv packages/sourcing/.venv -p 3.12
uv pip install --python packages/sourcing/.venv/bin/python pytest==8.4.1
packages/sourcing/.venv/bin/python -m pytest tests/sourcing -q
packages/sourcing/.venv/bin/python packages/sourcing/scripts/build_manifest.py   # rewrite data/manifest.json
```

Runtime is the Python standard library only. The suite passes with the network cable out: nothing on the request path is live.

## The seam

One facade, `forge_sourcing.service.Service(data_dir)`. The browser posts these verbs and renders `round_view`; it computes nothing.

| Verb | What it does | Event(s) appended |
|---|---|---|
| `open_round(design, ship_to, quantity, transport_mode, request_key, opened_at)` | binds a round to the design hash and sequence; idempotent on (design hash, ship-to, quantity, request key); a newer design state supersedes the live round for that ship-to | `round_opened` |
| `resolve(round_id)` | offers per line from the committed offer fixture, stored by content hash; no offer → escalation | `offers_resolved`, `escalation_opened` |
| `screen(round_id)` | seller and manufacturer, the risk-tiered ownership walk, one screening run per party against the CSL snapshot, the worst-node roll-up | `party_extracted` ×N, `screening_run` ×N, `screening_rolled_up` |
| `cost(round_id, entry_date)` | the landed-cost ladder per offer, one row per layer, hashed | `cost_estimated` ×N |
| `refine(round_id, quantity=, transport_mode=)` · `rescreen(round_id)` | round defaults refined after open: estimates recompute, statuses do not move; re-screen appends new runs and counts changes | `round_refined`, `cost_estimated` ×N · `screening_rolled_up` |
| `select(round_id, line_id, offer_hash, declined=[…], attestor=)` | refuses a review-blocked offer, a stale tariff fixture, or a failed hash; records every shown-and-declined offer with a reason code and the state at decline; append-only with a predecessor pointer | `offer_selected` (human), `selection_confirmed` |
| `adjudicate(round_id, offer_hash, party_id, role=, disposition=, …)` | analyst → false positive pending counsel; empowered official → resolve or escalate; bound to the list snapshot hash | `match_adjudicated` (human) |
| `resolve_escalation(round_id, line_id, reason, attestor=, resolution=)` | a human resolves; an agent may only propose | `escalation_resolved` (human) |
| `gate(round_id, references={line_id: {reference, attestor}})` | ship-to outside the US only: the engine's cell verbatim; a typed, attested reference lifts LIC/DDTC and is never validated | `export_gate_evaluated` ×N, `package_blocked` |
| `declare(round_id, party=, person_status=, sharing=, reference=, attestor=)` | the three-line technical-data rule; the 734.13 sentence printed for EAR technology | `technical_data_declared` (human) |
| `build_package(round_id, built_at)` | re-reads every bound blob and fixture by hash; refuses with a structured reason; three artefacts stored by hash | `package_built` or `package_blocked` |
| `create_packet` · `dispatch` · `close_order` | the order packet from the approved revision only; synthetic adapter; exactly once by idempotency key | `order_packet_created`, `order_dispatched` (human), `order_acknowledged` / `order_exception`, `order_closed` |
| `rederive()` · `tamper(seq, field, value)` | walk the chain, recompute every estimate and screening from its bound inputs, print one line; tamper one field and watch it break | — |

## Real and synthetic, in one table

| Thing | State |
|---|---|
| Kestrel lines (13) and their engine evaluations | hand-typed from THE BUILD §2.1–§2.4 and the 2026-09-05 validation; **the rule engine replaces every `evaluation` block** |
| Offers (17) | REAL sellers and manufacturers; prices marked `typed, unverified` were not read from a vendor page; **Brightwing Components (HK) and Nordkap Sensor (NO) are SYNTHETIC** and badged |
| Ownership rows (18) | REAL rows typed from memory of public filings with a URL each, badged *unverified this session*; Brightwing → SZ DJI and Nordkap → Nordkap Holding are SYNTHETIC |
| Consolidated Screening List | a 7-row verbatim subset of the 2026-09-04 snapshot (full file sha `44f89e8f…`, 26,082 rows); the loader takes the full CSV unchanged |
| Tariff table | headings and overlays typed from the build spec and the two research passes; every base rate is `verified: false` until read from HTS Revision 17; MPF FY2026/FY2027 and the Taiwan 301 row are verified; Chapter 99 headings for the 2024 review rows and the Taiwan action are **not typed** |
| Order dispatch | synthetic adapter only, labelled SYNTHETIC; no real send exists |
| Signing | hash chain only; Ed25519 signing belongs to the platform log module and the line says so |

## Determinism

On a fresh instance, S1 on the baseline (13 lines, 14 offers, 25 party screenings) reproduces:

```
S1 round digest  6c7b94613e126e26c45c849aac3daf167a1bc2c5609fc53ce2b7f3711ec64213
Re-derive        68 events · chain intact · unsigned in this lane (hash chain only); Ed25519 signing belongs to the log module · 14 estimates recomputed, 14 hashes equal · 25 screenings recomputed, 25 equal
```

`tests/sourcing/test_cost_hash.py` asserts the digest is equal across two instances; the value above is the one printed on 2026-09-06 and changes only when a fixture changes.

## What this lane does not claim

- No "cleared", "compliant", "duty owed", "entry", "determines" or "certifies" anywhere an outsider reads (`test_claims_vocabulary.py` greps every string in the round view and the thread).
- Not a classification determination, not a customs determination, not a legal determination, not an entry, not a filing, not ready to ship.
- Screening is a name match (exact and suffix-normalized, never fuzzy) over a committed ownership table; unknown ownership is a review flag, never a block and never a percentage.
- Base tariff rates are expected values until Charlie reads the schedule; every import card prints "rate not verified" and sorts last on cost until then.
- The authorization reference on the export gate is a typed string a human attested; the gate never checks that the authorization is valid.
- No model call, no network call, no live distributor, no live screening list, no live rate lookup anywhere in the lane (`test_boundary.py`).
