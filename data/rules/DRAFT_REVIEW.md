# Tripwire rules draft review

Draft only. Do not rename this file or `rules.DRAFT.json` to the production names until Charlie has checked every row. The JSON contains 40 rule objects covering all 14 rows, including propagation, MT, and release branches.

## Row 1 — 9A012.a.2

Atoms in plain English: the node is a BVLOS airframe, and derived endurance is greater than or equal to 3.0 hours.

Exact `text` for `CCL-9A012.a.2`:

```text
a.2. A maximum 'endurance' of 3 hours or greater;
```

CHECK: Confirm `>= 3.0 h`, `rule_effective: 2026-08-13`, and that the XML's internal CITA line is not used as a date.

## Row 2 — 9A012 MT range branch

Atoms in plain English: the node is a BVLOS airframe, and derived maximum range is greater than or equal to 300 km. Payload is deliberately not part of the firing condition; it matters only to the STA exception.

Exact `text` for `CCL-9A012-MT-range`:

```text
MT applies to “Unmanned Aerial Vehicles” (“UAVs”) and Remotely Piloted Vehicles (RPVs) that are capable of a maximum range of at least 300 kilometers (km), regardless of payload, and “UAVs” that meet the requirements of 9A120
```

CHECK: Confirm the 300 km MT atom is independent of endurance and that the XML's trailing 9A120 clause remains intact.

## Row 3 — 6A003.b.4.b and 9A012.a.3

Atoms in plain English: a sensor crosses into 6A003.b.4.b when frame rate is strictly greater than 9 Hz; at 9 Hz or below, Note 3.a supplies the 6A993.a release. A BVLOS airframe adds 9A012.a.3 when any descendant is in 6A003.b.3, 6A003.b.4.b, or 6A008.d through .h.

Exact `text` strings:

`CCL-6A003.b.4.b`

```text
b.4.b. Incorporating “focal plane arrays” controlled by 6A002.a.3.f; or
```

`CCL-9A012.a.3`

```text
a.3. “UAVs” or unmanned “airships” incorporating items specified in ECCN 6A003.b.3, 6A003.b.4.b, or 6A008.d to .h;
```

`RELEASE-6A003.b.4.b-note3a`

```text
a. A maximum frame rate equal to or less than 9 Hz;
```

CHECK: The single `sta` object cannot express “c(1) available to A:5 but c(2) barred to A:6 for 6A003.b.4”; verify how the engine represents that destination-specific distinction.

## Row 4 — 6A003.b.4.b RS branch

Atoms in plain English: RS1 fires if frame rate is strictly greater than 60 Hz, or if focal-plane-array element count is strictly greater than 111,000. The civil-product embedding clause is printed but not evaluated.

Exact `text` for `CCL-6A003.b.4.b-RS1`:

```text
RS applies to 6A003.b.3, 6A003.b.4.a, 6A003.b.4.c and to items controlled in 6A003.b.4.b that have a frame rate greater than 60 Hz or that incorporate a focal plane array with more than 111,000 elements, or to items in 6A003.b.4.b when being exported or reexported to be embedded in a civil product. (But see § 742.6(a)(2)(iii) and (v) for certain exemptions)
```

CHECK: Confirm 60 Hz does not fire the frame-rate atom; the Boson fires this row only because 327,680 is greater than 111,000.

## Row 5 — 7A002.a.1.a, 7A003.d.1, MT, and 9A012.a.5

Atoms in plain English: the EAR gyro branch requires rate range strictly below 500 deg/s and one-month fixed-calibration bias stability strictly below 0.5 deg/h. Its 7A102.a MT branch requires published one-sigma drift-rate stability strictly below 0.5 deg/h; an empty field cannot fire and prints the specified message. The 7A003.d.1 wrapper uses the same demonstrated 7A002 performance. A BVLOS airframe adds 9A012.a.5 when a descendant is in 7A001, 7A002, 7A003, or 7A005.

Exact `text` strings:

`CCL-7A002.a.1.a`

```text
a.1.a. A “bias” “stability” of less (better) than 0.5 degree per hour, when measured in a 1 g environment over a period of one month, and with respect to a fixed calibration value; or
```

`CCL-7A003.d.1`

```text
d.1. Performance specified by 7A001 or 7A002 along any axis, without the use of any aiding references; or
```

`CCL-9A012.a.5`

```text
a.5. “UAVs” or unmanned “airships” incorporating “inertial measurement equipment or systems” using accelerometers or gyros specified in ECCNs 7A001, 7A002, 7A003, or 7A005.
```

CHECK: `CCL-7A003.d.1.mt` is intentionally null because §2.2 states no 7A103 threshold; do not copy the 7A102 gyro threshold into a 7A103 branch.

## Row 6 — gyro angle random walk

Atoms in plain English: the USML rule is evaluated first and fires below 0.001 deg/sqrt(h). The EAR rule requires rate range below 500 deg/s and angle random walk less than or equal to 0.0035 deg/sqrt(h), unless the gyro is declared spinning-mass. VIII(a)(5) fires only when `designed_to_incorporate` is explicitly true.

Exact `text` strings:

`USML-XII(e)(12)(i)`

```text
(i) Having an angle random walk of less (better) than 0.001 degrees per square root hour; or
```

`CCL-7A002.a.1.b`

```text
a.1.b. An “angle random walk” of less (better) than or equal to 0.0035 degree per square root hour; or
```

`USML-VIII(a)(5)`

```text
* (5) Unmanned aerial vehicles (UAVs) specially designed to incorporate a defense article;
```

`RELEASE-7A002.a.1.b-spinning-mass`

```text
7A002.a.1.b does not control “spinning mass gyros”.
```

CHECK: This is the operator trap: EAR is `<= 0.0035`; ITAR is `< 0.001`. Merely containing the ITAR gyro must not set VIII(a)(5) without the separate declaration.

## Row 7 — accelerometer performance

Atoms in plain English: the EAR branch requires a linear acceleration range at or below 15 g and one-year fixed-calibration bias stability strictly below 130 micro g. MT additionally requires an inertial-navigation declaration, scale-factor repeatability below 1,250 ppm, and bias repeatability below 1,250 micro g; an empty scale-factor field cannot fire. ITAR fires either when both repeatability values are below 10, or when measurable range is above 100,000 g.

Exact `text` strings:

`CCL-7A001.a.1.a`

```text
a.1.a. A “bias” “stability” of less (better) than 130 micro g with respect to a fixed calibration value over a period of one year; or
```

`USML-XII(e)(11)-bias-scale` and `USML-XII(e)(11)-high-g`

```text
(11) Accelerometers having a bias repeatability of less (better) than 10 µg and a scale factor repeatability of less (better) than 10 parts per million, or capable of measuring greater than 100,000 g (MT);
```

CHECK: Confirm the two ITAR alternatives stay split so bias and scale are conjunctive, while the greater-than-100,000-g branch is independent.

## Row 8 — GNSS receiver features

Atoms in plain English: an adaptive-antenna declaration fires 7A005.b. Its nested MT branch additionally requires anti-jam and is blocked by a true civil/Safety-of-Life GNSS-service declaration. A separate speed branch fires only above 600 m/s. PPS encryption/decryption is an independent ITAR-first declaration.

Exact `text` strings:

`CCL-7A005.b-adaptive-antenna`

```text
b. Employing 'adaptive antenna systems'.
```

`CCL-7A105.b.1-speed`

```text
b.1. Capable of providing navigation information at speeds in excess of 600 m/s;
```

`USML-XII(d)(2)(ii)`

```text
(ii) Global Positioning System (GPS) receiving equipment specially designed for encryption or decryption (e.g., Y-Code, M-Code) of GPS protected positioning service (PPS) signals (MT if designed or modified for airborne applications);
```

`RELEASE-7A105.b.2-b.3-civil-service`

```text
7A105.b.2 and 7A105.b.3 do not control equipment designed for commercial, civil or Safety of Life (e.g., data integrity, flight safety) 'navigation satellite system' services.
```

CHECK: Confirm “in excess of 600 m/s” maps to `>`, not `>=`, and the civil-service release applies only to 7A105.b.2/.b.3, not the .b.1 speed branch.

## Row 9 — integrated-circuit temperature grade

Atoms in plain English: subparagraph .a fires above +125 °C; .b fires below −55 °C; .c requires the whole inclusive −55 °C through +125 °C range. Each is blocked by a civil automobile/railway declaration.

Exact `text` strings:

`CCL-3A001.a.2.a`

```text
a.2.a. Rated for operation at an ambient temperature above 398 K (+125 °C);
```

`CCL-3A001.a.2.b`

```text
a.2.b. Rated for operation at an ambient temperature below 218 K (−55 °C); or
```

`CCL-3A001.a.2.c`

```text
a.2.c. Rated for operation over the entire ambient temperature range from 218 K (−55 °C) to 398 K (+125 °C);
```

`RELEASE-3A001.a.2-civil-auto-rail`

```text
3A001.a.2 does not apply to integrated circuits designed for civil automobile or railway train applications.
```

CHECK: Confirm the synthetic −55/+125 part fires .c at equality; it must not fire the strictly-above .a or strictly-below .b branches.

## Row 10 — confidentiality cryptography

Atoms in plain English: the radio uses data-confidentiality cryptography, the symmetric key is strictly longer than 56 bits, and mass-market status is false. The mutually exclusive release branch has the same first two conditions and mass-market status true.

Exact `text` strings:

`CCL-5A002.a-symmetric`

```text
2.a. A “symmetric algorithm” employing a key length in excess of 56 bits, not including parity bits;
```

`RELEASE-5A002-to-5A992.c-mass-market`

```text
Related Controls: (1) ECCN 5A002.a controls “components” providing the means or functions necessary for “information security.” All such “components” are presumptively “specially designed” and controlled by 5A002.a. (2) See USML Categories XI (including XI(b)) and XIII(b) (including XIII(b)(2)) for controls on systems, equipment, and components described in 5A002.d or .e that are “subject to the ITAR” (see 22 CFR parts 120 through 130). (3) For “satellite navigation system” receiving equipment containing or employing decryption see 7A005, and for related decryption “software” and “technology” see 7D005 and 7E001. (4) Noting that items may be controlled elsewhere on the CCL, examples of items not controlled by ECCN 5A002.a.4 include the following: (a) An automobile where the only 'cryptography for data confidentiality' having a 'described security algorithm' is performed by a Category 5—Part 2 Note 3 eligible mobile telephone that is built into the car. In this case, secure phone communications support a non-primary function of the automobile but the mobile telephone (equipment), as a standalone item, is not controlled by ECCN 5A002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5A992.c). (b) An exercise bike with an embedded Category 5—Part 2 Note 3 eligible web browser, where the only controlled cryptography is performed by the web browser. In this case, secure web browsing supports a non-primary function of the exercise bike but the web browser (“software”), as a standalone item, is not controlled by ECCN 5D002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5D992.c). (5) After classification or self-classification in accordance with § 740.17(b) of the EAR, mass market encryption commodities that meet eligibility requirements are released from “EI” and “NS” controls. These commodities are designated 5A992.c. (6) See also ECCNs 3A090 and 4A090.
```

CHECK: Mass-market is a declared, documented fact; the engine must not infer it from AES or key length.

## Row 11 — secondary-cell energy density

Atoms in plain English: an individual cell fires only when energy density strictly exceeds 350 Wh/kg. A battery or battery-pack part class takes the battery release and must not inherit the cell result.

Exact `text` strings:

`CCL-3A001.e.1.b`

```text
e.1.b. 'Secondary cells' having an 'energy density' exceeding 350 Wh/kg at 20 °C;
```

`RELEASE-3A001.e-battery`

```text
3A001.e does not control batteries, including single-cell batteries.
```

CHECK: Keep `cell` and `battery`/`battery_pack` as distinct part classes; the pack remains released even when a controlled cell is inside it.

## Row 12 — PCB layout target and .y releases

Atoms in plain English: `board_target = civil_uav` maps to 9A991.d; `600_series_uav` maps to 3A611.g; `usml_article` maps to XI(c)(2). Connector and heat-sink .y rows require their part class plus an EAR ancestor, pending a way to constrain that ancestor specifically to the correct 600-series entry.

Exact `text` strings:

`CCL-9A991.d-board-civil-uav`

```text
d. “Parts” and “components,” “specially designed” for “aircraft,” n.e.s.
```

`CCL-3A611.g-board-600-series`

```text
g. Printed circuit boards and populated circuit card assemblies that are not controlled by paragraph .y of this entry and for which the layout is “specially designed” for “600 series” items.
```

`USML-XI(c)(2)-board`

```text
(2) Printed Circuit Boards (PCBs) and populated circuit card assemblies for which the layout is specially designed for defense articles in this subchapter;
```

`RELEASE-3A611.y.1-connector`

```text
y.1. Electrical connectors;
```

`RELEASE-3A611.y.3-heat-sink`

```text
y.3. Heat sinks;
```

CHECK: The allowed atom grammar has no `ancestor.entry_in`; do not accept the current EAR-ancestor approximation unless the engine scopes .y release rows to a 3A611 parent outside this rule object.

## Row 13 — sensor pod used-on platform and specially-designed releases

Atoms in plain English: the demo's exact `used_on = [F-22]` declaration fires VIII(h)(1); descendants under an ITAR ancestor are caught by 120.41(a)(2) unless their class is in the (b)(2) list or a production non-USML equivalent has been named. The exact `used_on = [F-16]` live-run branch is a 9A610.x candidate unless that equivalent is present.

Exact `text` strings:

`USML-VIII(h)(1)-listed-aircraft`

```text
(1) Parts, components, accessories, and attachments specially designed for aircraft listed within paragraphs (h)(1)(i) through (ii) of this category, excluding those common to aircraft that are or were in production and are not listed within paragraphs (h)(1)(i) through (iv) of this category, as follows:
```

`USML-120.41(a)(2)-catch`

```text
(2) Is a part, component, accessory, attachment, or software for use in or with a defense article.
```

`RELEASE-120.41(b)(2)-commodity-list`

```text
(2) Is, regardless of form or fit, a fastener (e.g., screws, bolts, nuts, nut plates, studs, inserts, clips, rivets, pins), washer, spacer, insulator, grommet, bushing, spring, wire, or solder;
```

`RELEASE-120.41(b)(3)-production-equivalent`

```text
(3) Has the same function, performance capabilities, and the same or equivalent form and fit as a commodity or software used in or with a commodity that:
```

`CCL-9A610.x-unlisted-aircraft`

```text
x. “Parts,” “components,” “accessories,” and “attachments” that are “specially designed” for a commodity enumerated or otherwise described in ECCN 9A610 (except for 9A610.y) or a defense article enumerated or otherwise described in USML Category VIII and not elsewhere specified on the USML or in 9A610.y, 9A619.y, or 3A611.y.
```

`ITAR-120.41-note2-missing-document`

```text
For a defense article not to be specially designed on the basis of paragraph (b)(4) or (5) of this section, documents contemporaneous with its development, in their totality, must establish the elements of paragraph (b)(4) or (5). Such documents may include concept design information, marketing plans, declarations in patent applications, or contracts. Absent such documents, the commodity may not be excluded from being specially designed by either paragraph (b)(4) or (5).
```

CHECK: `production_nonusml_equivalent` is a named string in the design model, but the allowed atom grammar has no non-null/existence operator; the draft's `equals: true` requires an engine-normalized boolean or a schema change.

## Row 14 — PRC-origin UAS procurement warning

Atoms in plain English: the component origin is PRC and the part class is flight controller, radio, camera, or gimbal. This is amber procurement guidance only and changes no destination licence result.

Exact `text` for `USG-FY2020-NDAA-848-PRC-component`:

```text
null
```

CHECK: This row is not ITAR or EAR, `origin` is a top-level node field rather than a declared fact, and its quoted NDAA text is absent from every fetched `ecfr/*.xml`; `jurisdiction: EAR` is only a schema placeholder and must not ship.

## Null-field report

All 40 objects contain at least one intentional nullable field (`mt`, `reasons_if_mt`, `sta`, `lvs_usd`, `gbs`, `text`, or `rule_effective`). The five objects with a materially unresolved `reasons` or `text` field are:

- `RELEASE-6A003.b.4.b-note3a` — `reasons`, `sta`, and `gbs` are not stated for the release row.
- `RELEASE-5A002-to-5A992.c-mass-market` — post-release reason/exception fields are not stated in §2.2.
- `CCL-9A991.d-board-civil-uav` — reason/exception fields are not stated in §2.2.
- `CCL-9A610.x-unlisted-aircraft` — reason and LVS fields are not stated in §2.2.
- `USG-FY2020-NDAA-848-PRC-component` — `text` is null because the cited procurement sentence is not in the fetched XML.

## OPEN

OPEN build-row IDs: `3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14`.

- `CCL-6A003.b.4.b`: destination-specific STA c(1)/c(2) behavior does not fit the single `sta` object.
- `CCL-7A003.d.1`: §2.2 gives no 7A103 threshold, so this wrapper has no MT branch.
- `CCL-7A001.a.1.a`: §2.2 says STA c(2) is “not verified for 7A001”; only c(1) is encoded.
- `CCL-7A005.b-adaptive-antenna`: `cannot_fire_text` is null because §2.2 supplies no empty-field message for the declaration-based MT branch.
- `RELEASE-6A003.b.4.b-note3a`, `RELEASE-5A002-to-5A992.c-mass-market`, `CCL-9A991.d-board-civil-uav`, and `CCL-9A610.x-unlisted-aircraft`: material fields listed above remain null rather than inferred.
- `RELEASE-3A611.y.1-connector` and `RELEASE-3A611.y.3-heat-sink`: the grammar cannot require a particular ancestor entry, so the present EAR-ancestor condition needs engine scoping or an atom extension.
- Row 12's 9A610.y.10 and 9A610.y.33 bracket branches are not encoded because the allowed grammar cannot test both the precise ancestor entry and the bracket's listed use without inventing a declaration.
- `USML-120.41(a)(2)-catch`, `RELEASE-120.41(b)(3)-production-equivalent`, and `CCL-9A610.x-unlisted-aircraft`: the named-equivalent string cannot be tested for non-null with the allowed atoms.
- Row 13's connector treatment is OPEN: §2.1 calls connectors a 120.41(b)(2) auto-release, but the fetched (b)(2) paragraph does not list electrical connectors, so the draft follows the XML list rather than adding `connector`.
- `USG-FY2020-NDAA-848-PRC-component`: procurement authority has no valid ITAR/EAR jurisdiction value, no XML-verbatim `text`, and no allowed atom for the top-level `origin` field.
- Candidate-text pointers for rows 5, 6, 7, 8, 9, 11, and 13 land on the nearest existing `###` section because the committed candidate bundle predates the printer's current scoped/manual lookup coverage for several subparagraphs; rerun those headings before promotion.

---

# Machine verification — run 2026-09-04 23:20 by `tools/verify_rules_draft.py`

**VERDICT: PASS.** 40 rule objects, 0 failures.

Checks that ran, and what each one guarantees:

| Check | Result |
|---|---|
| Every `text` is a verbatim substring of the fetched eCFR XML (whitespace/entity normalised) | 40/40 pass |
| Every atom operator matches the wording of the sentence containing its own threshold | all checkable atoms pass |
| `ecfr_date` == 2026-09-01 on every row | pass |
| `rule_effective` set only on 9A012 entries | pass |
| Required fields present (`text` exempted only for the non-eCFR §848 row, which must carry a `url`) | pass |
| All 14 rows of THE_BUILD.md §2.2 have at least one rule object | pass — 40 objects, no orphans |

Jurisdiction split: EAR 29 · ITAR 11.

## Charlie's targeted checklist — the 12 atoms the machine could NOT check

Each of these is an atom whose threshold does not appear in its own row's quoted `text`, because the
condition comes from a **parent chapeau or a sibling paragraph**. That is structurally normal — e.g.
7A002.a.1's "rate range less than 500 °/s" gate governs both a.1.a and a.1.b — but it means the
operator and threshold are unverified by machine and want a human eye. These are the rows to read
first; everything else is already proven verbatim.

```
  ! CCL-9A012.a.2: no operator phrase near 3.0 for endurance_h
  ! CCL-9A012-MT-range: no operator phrase near 300 for range_km
  ! CCL-6A003.b.4.b: threshold 9 for frame_rate_hz not located in text; operator unchecked
  ! CCL-7A002.a.1.a: threshold 500 for gyro_rate_range_deg_s not located in text; operator unchecked
  ! CCL-7A003.d.1: threshold 500 for gyro_rate_range_deg_s not located in text; operator unchecked
  ! CCL-7A003.d.1: threshold 0.5 for gyro_bias_stability_1mo_deg_h not located in text; operator unchecked
  ! CCL-7A002.a.1.b: threshold 500 for gyro_rate_range_deg_s not located in text; operator unchecked
  ! CCL-7A001.a.1.a: threshold 15 for accel_linear_range_g not located in text; operator unchecked
  ! CCL-3A001.a.2.b: threshold -55 for min_operating_temp_c not located in text; operator unchecked
  ! CCL-3A001.a.2.c: threshold -55 for min_operating_temp_c not located in text; operator unchecked
  ! CCL-3A001.a.2.c: no operator phrase near 125 for max_operating_temp_c
  ! RELEASE-5A002-to-5A992.c-mass-market: threshold 56 for symmetric_key_bits not located in text; operator unchecked
```

## Known encoding note

USML XII(e)(11) is split across two objects: `USML-XII(e)(11)-bias-scale` (bias repeatability and
scale-factor repeatability, both `<` 10) and `USML-XII(e)(11)-high-g` (the "or capable of measuring
greater than 100,000 g" disjunct). Confirm that split is how you want the `or` evaluated.
