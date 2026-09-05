# Prep corpus — DNHacks 2026 / Tripwire

Staged **2026-09-04**, before the build window opens (Sat 5 Sept 10:00). Data files and cached
responses only, per THE_BUILD.md §5 *"No project code before Sat 10:00."* Ready to commit into the
project repo at 10:00.

## What is here

| Path | Contents |
|---|---|
| `ecfr/` | Nine eCFR versioner XML parts, all at content date **2026-09-01** (no fallback to 08-31 was needed) |
| `fr/2026-16628.json` | Federal Register metadata for the drone rule |
| `manifest.tsv` | title · part · content_date · bytes · sha256 (first 16) · file |
| `tools/print_rule_text.py` | The rule-text printer — see below |

Every rule quote typed into `rules.json` must come from this XML, and each row's `ecfr_date`
is **2026-09-01** for all nine parts.

## Verified against THE_BUILD.md

- **FR 2026-16628** — title *"Streamlining Export Controls for Drone Exports"*, published
  **2026-08-14**, effective **2026-08-13**, citation **91 FR 52501**. Matches §2 decision (c) exactly;
  the badge prints both dates.
- **`9A012` in title-15 part-774 = 26 blocks**, reproducing the number in §5's Thursday row.
- Spot-checked verbatim and present: `9A012.a.1` endurance-under-3-hours line; *"except .a.1"*;
  `6A003` Note 3.a *"equal to or less than 9 Hz"*; `7A105.b.1` *"in excess of 600 m/s"*;
  22 CFR 120.11(c) *"following incorporation or integration"*; 740.20(b)(2)(iii) MT bar for STA;
  734.4 **(c) 10%** and **(d) 25%** de minimis rules plus the **no-de-minimis** cases at
  (a)(6)(i)/(ii) for 9x515 and 600-series to Country Group D:5.

## Two corrections to THE_BUILD.md §4

1. **22 CFR part 122 was missing from the fetch list.** §4 names title-22 parts 121 and 120 only,
   but the `/record` footer quotes **22 CFR 122.5(a)** verbatim — *"none of it may be altered once it
   is initially recorded without recording all changes, who made them, and when they were made"* —
   and Charlie's parts handoff cites the same clause as R6. Part 122 is now fetched
   (`ecfr/title-22-part-122-2026-09-01.xml`, 18 KB) and the clause is confirmed present.
2. **Pin the LCSC product codes; do not trust search ranking.** `C1850418` resolves correctly to
   ICM-42688-P / TDK InvenSense / ECCN `7A994`, matching the baseline table. But the JLCSearch
   top hit for `ICM-42688-P` is a *different* variant (`ICM-42688P-HXY`, lcsc 46550687). Build
   `catalog.json` from the codes named in §2.1, using search only to discover codes not yet pinned.
   `C114409` → STM32H743VIT6, ECCN `3A991A2`, 480 MHz, −40/+85 — matches the baseline row.

## 3. Country Chart — the appendix is a separate fetch, and its shape is not what §4 says

§4 warns that the Country Chart *"is not in `?part=738`, it is only at
`?part=738&appendix=Supplement%20No.%201%20to%20Part%20738`"* — correct, and now staged as
`ecfr/title-15-part-738-appendix-suppl1-2026-09-01.xml` (160,651 bytes, content date 2026-09-01).
It needs `-A "Mozilla/5.0"`; the eCFR API returns **406 Not Acceptable** to a default urllib UA.

Two details in §4's parser note are wrong as applied to the XML, and either one silently corrupts
every row:

1. **"16 cells per row including empties" means 16 *control columns*, not 16 `<TD>`s.**
   A country row has **17** `<TD>` children — cell[0] is the country name, cells[1..16] are the
   controls. Row-length distribution across the 212 `<TR>`s: 17 x196, 16 x1 (the header), 9 x1,
   2 x4, 1 x10. A parser asserting `len(tds) == 16` fails on all 196 country rows.
2. **Footnote digits are `<sup>` elements, not glued digits.** Germany's cell is literally
   `<TD ...>Germany <sup>3</sup></TD>`, so `itertext()` yields `"Germany 3"` — with a space. The
   advice to *"strip trailing footnote digits"* leaves `"Germany "` and the country never matches.
   Correct handling: drop the `<sup>` child, keep its text as the footnote, then strip whitespace.
   This is exactly why a first pass found Canada, Taiwan, Vietnam and China but not Germany.

Some cells carry `colspan` / `rowspan`; country rows appear not to, but a parser should fail loudly
rather than assume.

The 16 column headers, read from the second `<TR>`:
`CB 1 · CB 2 · CB 3 · NP 1 · NP 2 · NS 1 · NS 2 · MT 1 · RS 1 · RS 2 · FC 1 · CC 1 · CC 2 · CC 3 · AT 1 · AT 2`

Known-good spot check — **Canada** is `X` at CB 1 and FC 1 and empty in the other fourteen.

## 4. catalog.json

`catalog/catalog.json` holds all 16 named parts with two provenance channels kept deliberately
apart: `spec` (transcribed from THE_BUILD.md §2.1) and `lcsc` (live lookup). They are never merged —
a disagreement is a finding, not something to reconcile silently. Only two parts are LCSC-carried,
and both agree with the spec: `C114409` → STM32H743VIT6 / `3A991A2`, and `C1850418` → ICM-42688-P /
`7A994`. The rest (FLIR, Microhard, Molicel, KDE, u-blox, Honeywell, Amprius, T-Motor) are not LCSC
parts; their authority is the datasheet URL already cited in §2.1.

Also staged: `catalog/PX4_PARTS_DATABASE.csv` (66 KB, tab-separated) and
`catalog/consolidated_screening_list.csv` (26,083 rows, 16.7 MB, from
`data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv` — the
`api.trade.gov/static/...` path in §4 does not resolve).

## The rule-text printer

```bash
python3 tools/print_rule_text.py 9A012 ecfr/title-15-part-774-2026-09-01.xml
python3 tools/print_rule_text.py "endurance' of 3 hours or greater"
```

Counting unit is the **deepest element containing the id**, which is the eCFR's own granularity and
what makes 9A012 come out at 26. Each block prints the enclosing supplement/section heading, the XML
tag, and the text verbatim. With no file arguments it searches every XML in `ecfr/`.

That printout, not this file and not THE_BUILD.md, is what gets typed into `rules.json`.

## 6. rules.DRAFT.json

Drafted by an agent from `CANDIDATE_TEXT.md` and THE_BUILD.md §2.2, then machine-verified. This
**inverts** §5's instruction that Charlie types `rules.json` from the printout — done deliberately,
on Benji's call, because the safety property is preserved: the drafter cannot invent regulation and
survive `tools/verify_rules_draft.py`, and Charlie still signs off. The file is named `.DRAFT.json`
until he does; nothing reads it as `rules.json` yet.

**40 rule objects covering all 14 rows of §2.2** (EAR 29 · ITAR 11), no orphans. Verification:

- every `text` is a verbatim substring of the fetched XML — 40/40
- every atom operator matches the wording of the sentence holding its own threshold
- `ecfr_date` 2026-09-01 everywhere; `rule_effective` 2026-08-13 only on 9A012 entries
- required fields present, with `text` exempted only for the non-eCFR FY2020 NDAA §848 row

`rules/DRAFT_REVIEW.md` is Charlie's read-through: one section per §2.2 row with the atoms in plain
English, the exact quoted text, and a "CHECK:" line per row, followed by the machine verdict and a
**12-atom targeted checklist** — the atoms whose thresholds sit in a parent chapeau rather than the
row's own quoted text (e.g. 7A002.a.1's 500 °/s rate-range gate governing both a.1.a and a.1.b), so
no machine can check them and a human should.

Two notes while writing the verifier, both cases of the checker being wrong rather than the draft:
a whole-row operator match flags every multi-atom row falsely, and `rstrip("0")` turns a threshold of
`500` into `"5"`, which matches inside `0.0035`. Operator checks must be localised to each atom's own
threshold, anchored on a digit boundary.

## Still outstanding before 10:00

- `rules.json` — Charlie verifies `rules.DRAFT.json` against `DRAFT_REVIEW.md` and renames it
- `response.json` + `fixtures/llm_cache/` — the two cached API responses (needs the API key)

## 5. Rule-text lookups — what resolves and what does not

`rules/CANDIDATE_TEXT.md` (364 KB, 59 sections) is the verbatim printout Charlie types `rules.json`
from. **Fidelity audit: 1,502 of 1,550 candidate lines match the fetched XML byte-for-byte after
whitespace/entity normalisation. All 48 non-matching lines are the bundle's own metadata
(`Source file(s) searched: …`) or the printer's `[heading] <TAG>` echo. No regulatory text was
invented.**

The printer now falls back to a **scoped sub-paragraph lookup**: CCL and USML sub-paragraphs are
written `a.2.` *inside* the parent entry, never as `9A012.a.2`, so an exact-string search misses them.
`9A012.a.2 / .a.3 / .a.5` and `3A991.a.2` now resolve — `9A012.a.2` returns
`a.2. A maximum 'endurance' of 3 hours or greater;`, matching §2 decision (c).

**Three still need a manual find. Their text is located, so this is a lookup limitation, not a gap:**

| Entry | Where the text actually is | Search string |
|---|---|---|
| `7A105.b.1` | `title-15-part-774` (CCL) | `b.1. Capable of providing navigation information at speeds in excess of 600 m/s` |
| `XII(e)(12)` | `title-22-part-121`, inside Category XII | search `(e)(12)` within the Category XII region |
| `VIII(a)(5)` | `title-22-part-121`, inside Category VIII | search `(a)(5)` within the Category VIII region |

### The 600 m/s line exists on BOTH sides of the order of review

Worth knowing before the engine is written. The same threshold appears twice, with different effect:

- **EAR**, `title-15-part-774`, 7A105.b: *"b.1. Capable of providing navigation information at speeds
  in excess of 600 m/s"*
- **ITAR**, `title-22-part-121`, Category XI/XII GNSS entry: *"GNSS receiving equipment specially
  designed for military applications (MT if designed or modified for airborne applications and
  capable of providing navigation information at speeds in excess of 600 m/s)"*

§2 decision (d) picks 600 m/s over the 515 m/s firmware convention and cites 7A105.b.1 — correct.
But because USML is evaluated before CCL, a GNSS part that also meets the Category XII "specially
designed for military applications" condition must resolve on the ITAR side first. The engine's
hard-coded USML → CCL → EAR99 order already handles this; the rule rows just need both cites so the
screen can show why the EAR row did *not* fire.
