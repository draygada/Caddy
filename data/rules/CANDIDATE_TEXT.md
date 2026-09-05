# Candidate rule text

This is an evidence bundle for human transcription into `rules.json`; it is not a determination and is not `rules.json`. Most candidate printer output below is reproduced exactly as emitted by `tools/print_rule_text.py`. The five 9A012 sections identified as stale in `DRAFT_REVIEW.md` were mechanically regenerated in Wave 0 directly from the pinned raw XML because the current printer begins its scoped search at an earlier cross-reference. Those sections carry reproducible raw-byte receipts and remain explicitly unapproved.

## EAR / title-15 part-774

### 9A012.a

Entry id: `9A012.a`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Wave-0 raw-span candidate (normalized only for display):

```text
a. “UAVs” or unmanned “airships”, designed to have controlled flight out of the direct 'natural vision' of the 'operator' and having any of the following:
```

Receipt: raw bytes `[1837535, 1837731)`, raw-span SHA-256 `ff89b7f79a3da557d9f6c91b5bea6ab14a9d8a836e76fd03d2e9717533d34fef`. Full receipt: `source-receipts.WAVE0-CANDIDATE.json#ecfr-774-9A012-a-chapeau`.

Status: **UNAPPROVED CANDIDATE.** Whether `bvlos` represents this chapeau is reserved for qualified review.

### 9A012.a.1

Entry id: `9A012.a.1`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Wave-0 raw-span candidate (normalized only for display):

```text
a.1. A maximum 'endurance' less than 3 hours;
```

Receipt: raw bytes `[1837732, 1837784)`, raw-span SHA-256 `fc8aae6116915056ab92f90791ad6dbeafb390dabf712790f916b12b6874d2a0`. Full receipt: `source-receipts.WAVE0-CANDIDATE.json#ecfr-774-9A012-a1`.

Status: **UNAPPROVED CANDIDATE.** The chapeau, reason codes, MT handling, and effective date are not approved by this extraction.

### 9A012.a.2

Entry id: `9A012.a.2`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Wave-0 raw-span candidate (normalized only for display):

```text
a.2. A maximum 'endurance' of 3 hours or greater;
```

Receipt: raw bytes `[1837785, 1837841)`, raw-span SHA-256 `5a5cb4fbad7a8e84759c599888397c1197408f7c7b294cc0401a990d65359c6c`. Full receipt: `source-receipts.WAVE0-CANDIDATE.json#ecfr-774-9A012-a2`.

Status: **UNAPPROVED CANDIDATE.** The chapeau, reason codes, MT handling, and effective date are not approved by this extraction.

### 9A012.a.3

Entry id: `9A012.a.3`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Wave-0 raw-span candidate (normalized only for display):

```text
a.3. “UAVs” or unmanned “airships” incorporating items specified in ECCN 6A003.b.3, 6A003.b.4.b, or 6A008.d to .h;
```

Receipt: raw bytes `[1837842, 1837991)`, raw-span SHA-256 `5281dea710ce689c8da668752f290d93f1baac8a0620776a6fa8e2633833ec78`. Full receipt: `source-receipts.WAVE0-CANDIDATE.json#ecfr-774-9A012-a3`.

Status: **UNAPPROVED CANDIDATE.** Parent propagation is not approved by this extraction.

### 9A012.a.5

Entry id: `9A012.a.5`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Wave-0 raw-span candidate (normalized only for display):

```text
a.5. “UAVs” or unmanned “airships” incorporating “inertial measurement equipment or systems” using accelerometers or gyros specified in ECCNs 7A001, 7A002, 7A003, or 7A005.
```

Receipt: raw bytes `[1838110, 1838331)`, raw-span SHA-256 `b81c58cd19742986858446c2b8b7d08296a214513aa653fe8b529393d10c64d9`. Full receipt: `source-receipts.WAVE0-CANDIDATE.json#ecfr-774-9A012-a5`.

Status: **UNAPPROVED CANDIDATE; OUTSIDE P0.** This extraction does not authorize the excluded gyro path.

### 6A003.b.4.b

Entry id: `6A003.b.4.b`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 9 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to 6A003.b.3, 6A003.b.4.a, 6A003.b.4.c and to items controlled in 6A003.b.4.b that have a frame rate greater than 60 Hz or that incorporate a focal plane array with more than 111,000 elements, or to items in 6A003.b.4.b when being exported or reexported to be embedded in a civil product. (But see § 742.6(a)(2)(iii) and (v) for certain exemptions)

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to items controlled in 6A003.b.4.b that have a frame rate of 60 Hz or less and that incorporate a focal plane array with not more than 111,000 elements if not being exported or reexported to be embedded in a civil product

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
See § 743.3 of the EAR for thermal camera reporting for exports that are not authorized by an individually validated license of thermal imaging cameras controlled by ECCN 6A003.b.4.b to destinations in Country Group A:1 (see Supplement No. 1 to part 740 of the EAR), must be reported to BIS.

[Note 3:]  <I>
6A003.b.4.b does not control imaging cameras having any of the following:

[Note:]  <I>
When necessary, details of the items will be provided, upon request, to the Bureau of Industry and Security in order to ascertain compliance with the conditions described in Note 3.b.4 and Note 3.c in this Note to 6A003.b.4.b.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See ECCN 0A919 for foreign made military commodities that incorporate cameras described in 6A993.a that meet the criteria specified in Note 3.a to 6A003.b.4.b (i.e., having a maximum frame rate equal to or less than 9 Hz). (2) Section 744.9 imposes license requirements on cameras described in 6A993.a as a result of meeting the criteria specified in Note 3.a to 6A003.b.4.b (i.e., having a maximum frame rate equal to or less than 9 Hz) if being exported, reexported, or transferred (in-country) for use by a military end-user or for incorporation into a commodity controlled by ECCN 0A919.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.3. “UAVs” or unmanned “airships” incorporating items specified in ECCN 6A003.b.3, 6A003.b.4.b, or 6A008.d to .h;

[Note 3:]  <P>
6A003.b.4.b does not control imaging cameras having any of the following characteristics:

[Note:]  <P>
When necessary, details of the items will be provided, upon request, to the Bureau of Industry and Security in order to ascertain compliance with the conditions described in Note 3.b.4 and Note 3.c in this Note to 6A003.b.4.b.

=== 6A003.b.4.b: 9 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [Note 3:] <I> block beginning “6A003.b.4.b does not control imaging cameras” looks operative because it states an express exclusion keyed to the exact subentry.

### 6A993

Entry id: `6A993`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 4 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.1. Incorporate more than a de minimis amount of U.S.-origin controlled content classified under ECCNs 6A002, 6A003, or 6A993.a (having a maximum frame rate equal to or less than 9 Hz and thus meeting the criterion of Note 3.a to 6A003.b.4);

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
6A993 Cameras, not controlled by 6A003 or 6A203, as follows (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See ECCN 0A919 for foreign made military commodities that incorporate cameras described in 6A993.a that meet the criteria specified in Note 3.a to 6A003.b.4.b (i.e., having a maximum frame rate equal to or less than 9 Hz). (2) Section 744.9 imposes license requirements on cameras described in 6A993.a as a result of meeting the criteria specified in Note 3.a to 6A003.b.4.b (i.e., having a maximum frame rate equal to or less than 9 Hz) if being exported, reexported, or transferred (in-country) for use by a military end-user or for incorporation into a commodity controlled by ECCN 0A919.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
c. “Technology” for the “development” or “production” of cameras controlled by 6A993;

=== 6A993: 4 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “6A993 Cameras” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 7A105.b.1

Entry id: `7A105.b.1`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

**NOT FOUND:** `tools/print_rule_text.py` returned zero blocks from: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01).

Printer output (verbatim, unedited):

```text
=== 7A105.b.1: 0 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): None; the printer returned zero candidate blocks, so there is no block to identify as operative.

### 7A003

Entry id: `7A003`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 28 block(s)

[N.B.:]  <I>
For inertial heading systems, see 7A003.c.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7A003 'Inertial measurement equipment or systems', having any of the following.

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to commodities in 7A003.d that meet or exceed the parameters of 7A103

[Supplement No. 1 to Part 774—The Commerce Control List]  <I>
7A003 does not apply to 'inertial measurement equipment or systems' which are certified for use on “civil aircraft” by civil aviation authorities of one or more Wassenaar Arrangement Participating States, see Supplement No. 1 to part 743 of the EAR.

[Technical Notes:]  <I>
1. For the purposes of 7A003, 'inertial measurement equipment or systems' incorporate accelerometers or gyroscopes to measure changes in velocity and orientation in order to determine or maintain heading or position without requiring an external reference once aligned. 'Inertial measurement equipment or systems' include:

[Technical Notes:]  <I>
2. For the purposes of 7A003, 'positional aiding references' independently provide position, and include:

[Technical Note:]  <I>
For the purposes of 7A003.a.1, 7A003.a.2 and 7A003.a.3, the performance parameters typically apply to 'inertia measurement equipment or systems' designed for “aircraft”, vehicles and vessels, respectively. These parameters result from the utilization of specialized non-'positional aiding references' (e.g., altimeter, odometer, velocity log). As a consequence, the specified performance values cannot be readily converted between these parameters. Equipment designed for multiple platforms are evaluated against each applicable entry 7A003.a.1, 7A003.a.2, or 7A003.a.3.

[Technical Note:]  <I>
For the purposes of 7A003.b, this entry refers to systems in which 'inertial measurement equipment or systems' and other independent 'positional aiding references' are built into a single unit (i.e., embedded) in order to achieve improved performance.

[Note:]  <I>
7A003.d.2 does not apply to 'inertial measurement equipment or systems' that contain “spinning mass gyros” as the only type of gyro.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7A103 Instrumentation, navigation equipment and systems, other than those controlled by 7A003, and “specially designed” “parts” and “components” therefor, as follows (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See ECCN 7A003 and 7A994. (2) Inertial navigation systems and inertial equipment, and “specially designed” “parts” and “components” therefor specifically designed, modified or configured for military use are “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Military fire control, laser, imaging, and guidance equipment that are enumerated in USML Category XII, and technical data (including software) directly related thereto, are subject to the ITAR. (2) See Related Controls in ECCNs 0A504, 2A984, 6A002, 6A003, 6A004, 6A005, 6A007, 6A008, 6A107, 7A001, 7A002, 7A003, 7A005, 7A101, 7A102, and 7A103. (3) See ECCN 3A611 and USML Category XI for controls on countermeasure equipment. (4) See ECCN 0A919 for foreign-made “military commodities” that incorporate more than a de minimis amount of U.S. origin “600 series” controlled content.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x.2. Described in ECCNs 6A007, 6A107, 7A001, 7A002, 7A003, 7A101, 7A102 or 7A103; or

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7A994 Other navigation direction finding equipment, airborne communication equipment, all aircraft inertial navigation systems not controlled under 7A003 or 7A103, and other avionic equipment, including “parts” and “components,” n.e.s.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also 7D101 and 7D994. (2) The “software” related to 7A003.b, 7A005, 7A103.b, 7A105, 7A106, 7A115, 7A116, 7A117, or 7B103 is “subject to the ITAR” (see 22 CFR parts 120 through 130). (3) “Software” for inertial navigation systems and inertial equipment and “parts” or “components” “specially designed” therefor that are directly related to defense articles and not “specially designed” for use on civil aircraft is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7D002 “Source code” for the operation or maintenance of any inertial navigation equipment, including inertial equipment not controlled by 7A003 or 7A004, or Attitude and Heading Reference Systems ('AHRS').

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Software” “specially designed” or modified to improve the operational performance or reduce the navigational error of systems to the levels controlled by 7A003, 7A004 or 7A008;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. “Source code” for hybrid integrated systems which improves the operational performance or reduces the navigational error of systems to the level controlled by 7A003 or 7A008 by continuously combining heading data with any of the following:

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) The “software” related to 7A003.b, 7A005, 7A103.b, 7A105, 7A106, 7A115, 7A116, 7A117, or 7B103 is “subject to the ITAR” (see 22 CFR parts 120 through 130). (2) “Software” for inertial navigation systems and inertial equipment and “parts” and “components” “specially designed” therefor that are directly related to a defense article is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: The “software” related to 7A003.b or 7A103.b is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. Integration “software” “specially designed” for the equipment controlled by 7A003 or 7A103.a.

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to technology for equipment controlled for MT reasons. MT does not apply to “technology” for equipment controlled by 7A008. MT does apply to “technology” for equipment specified in 7A001, 7A002 or 7A003.d that meets or exceeds parameters of 7A101, 7A102 or 7A103

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also 7E101 and 7E994. (2) The “technology” related to 7A003.b, 7A005, 7A103.b, 7A105, 7A106, 7A115, 7A116, 7A117, 7B103, software in 7D101 specified in the Related Controls paragraph of ECCN 7D101, 7D102.a, or 7D103 is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to technology for equipment controlled for MT reasons. MT does not apply to “technology” for equipment controlled by 7A008. MT does apply to “technology” for equipment specified in 7A001, 7A002 or 7A003.d that meets or exceeds parameters of 7A101, 7A102 or 7A103

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also 7E102 and 7E994. (2) The “technology” related to 7A003.b, 7A005, 7A103.b, 7A105, 7A106, 7A115, 7A116, 7A117, or 7B103 is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: The “technology” related to 7A003.b, 7A005, 7A103.b, 7A105, 7A106, 7A115, 7A116, 7A117, 7B103, software specified in the Related Controls paragraph of ECCN 7D101, 7D102.a, or 7D103 is “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.5. “UAVs” or unmanned “airships” incorporating “inertial measurement equipment or systems” using accelerometers or gyros specified in ECCNs 7A001, 7A002, 7A003, or 7A005.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x.4. Described in an ECCN containing “space-qualified” as a control criterion (i.e., 3A001.b.1, .e.4 or .z, 3A002.g.1, 3A991.o, 3A992.b.3, 6A002.a.1, .b.2, .d.1, 6A004.c and .d, 6A008.j.1, 6A998.b, or 7A003.d.2);

=== 7A003: 28 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “7A003 'Inertial measurement equipment or systems'” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 7A994

Entry id: `7A994`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 16 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See USML Category XII(e) for accelerometers subject to the ITAR. (2) See also ECCNs 7A101, 7A611, and 7A994. (3) For angular or rotational accelerometers, see ECCN7A001.b. (4) MT controls do not apply to accelerometers that are “specially designed” and developed as Measurement While Drilling (MWD) sensors for use in downhole well service applications.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See USML Category XII(e) for gyros or angular rate sensors subject to the ITAR. (2) See also ECCNs 7A102, 7A611, and 7A994. (3) For angular or rotational accelerometers, see ECCN 7A001.b.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also ECCNs 7A103, 7A611, and 7A994. (2) See USML Category XII(d) for guidance or navigation systems subject to the ITAR.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See USML Category XV for certain 'star trackers' that are “subject to the ITAR” (see 22 CFR parts 120 through 130). (2) See also 7A104 and 7A994.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also ECCNs 7A105, 7A611 and 7A994. Commercially available “satellite navigation system” receivers do not typically employ decryption or adaptive antennae and are classified as 7A994. (2) See USML Category XII(d) for “satellite navigation system” receiving equipment subject to the ITAR and USML Category XI(c)(10) for antennae that are subject to the ITAR. (3) Items that otherwise would be covered by ECCN 7A005.a are “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: See also 7A106, 7A994 and Category 6 for controls on radar.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See USML Category XII(e) for gyros or angular rate sensors subject to the ITAR. (2) See also ECCNs 7A002, 7A611, and 7A994.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See ECCN 7A003 and 7A994. (2) Inertial navigation systems and inertial equipment, and “specially designed” “parts” and “components” therefor specifically designed, modified or configured for military use are “subject to the ITAR” (see 22 CFR parts 120 through 130).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See also 7A005, 7A611 and 7A994. (2) See USML Category XII(d) for GNSS receiving equipment subject to the ITAR and USML Category XI(c)(10) for antennae that are subject to the ITAR. (3) Items that otherwise would be covered by ECCN 7A105.b.2 are “subject to the ITAR” (see 22 CFR parts 120 through 130). (4) See USML Category XII(d) for GPS receiving equipment in 7A105.a, b.1 and b.3 that are subject to the ITAR.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7A994 Other navigation direction finding equipment, airborne communication equipment, all aircraft inertial navigation systems not controlled under 7A003 or 7A103, and other avionic equipment, including “parts” and “components,” n.e.s.

[License Requirement Notes:]  <I>
Typically commercially available GPS do not employ decryption or adaptive antenna and are classified as 7A994.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7B001 Test, calibration or alignment equipment, “specially designed” for equipment controlled by 7A (except 7A994).

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7B003 Equipment “specially designed” for the “production” of equipment controlled by 7A (except 7A994).

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7D001 “Software” “specially designed” or modified for the “development” or “production” of equipment controlled by 7A (except 7A994) or 7B (except 7B994).

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7E001 “Technology” according to the General Technology Note for the “development” of equipment or “software,” specified by 7A. (except 7A994), 7B. (except 7B994), 7D001, 7D002, 7D003 or 7D005.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
7E002 “Technology” according to the General Technology Note for the “production” of equipment controlled by 7A (except 7A994) or 7B (except 7B994).

=== 7A994: 16 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “7A994 Other navigation direction finding equipment” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 3A991.a.2

Entry id: `3A991.a.2`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

**NOT FOUND:** `tools/print_rule_text.py` returned zero blocks from: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01).

Printer output (verbatim, unedited):

```text
=== 3A991.a.2: 0 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): None; the printer returned zero candidate blocks, so there is no block to identify as operative.

### 3A611

Entry id: `3A611`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 38 block(s)

[Note 1 to 0A614:]  <I>
This entry includes operational flight trainers, radar target trainers, flight simulators for aircraft classified under ECCN 9A610.a, human-rated centrifuges, radar trainers for radars classified under ECCN 3A611, instrument flight trainers for military aircraft, navigation trainers for military items, target equipment, armament trainers, military pilotless aircraft trainers, mobile training units and training “equipment” for ground military operations.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See Category XV of the USML for certain “space-qualified” electronics and Category XI of the USML for certain ASICs, 'transmit/receive modules,' 'transmit modules,' or 'MMICs' “subject to the ITAR.” (2) See also 3A090, 3A101, 3A201, 3A611, 3A901 for cryogenic CMOS integrated circuits and parametric signal amplifiers or quantum limited amplifiers not controlled by 3A001, 3A991, and 9A515.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
3A611 Military electronics, as follows (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
NS applies to entire entry except 3A611.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to entire entry except 3A611.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to 3A611.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
UN applies to entire entry except 3A611.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
LVS: $1,500 for 3A611.a, .d through .h and .x; N/A for ECCN 3A611.c.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
STA: Paragraph (c)(2) of License Exception STA (§ 740.20(c)(2) of the EAR) may not be used for any item in 3A611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Electronic items that are enumerated in USML Category XI or other USML categories, and technical data (including software) directly related thereto, are subject to the ITAR. (2) Application specific integrated circuits (ASICs) and programmable logic devices (PLD) that are programmed for defense articles that are subject to the ITAR are controlled in USML Category XI(c)(1). (3) See ECCN 3A001.a.7 for controls on unprogrammed programmable logic devices (PLD). (4) Printed circuit boards and populated circuit cards with a layout that is “specially designed” for defense articles are controlled in USML Category XI(c)(2). (5) Multichip modules for which the pattern or layout is “specially designed” for defense articles are controlled in USML Category XI(c)(3). (6) Electronic items “specially designed” for military application that are not controlled in any USML category but are within the scope of another “600 series” ECCN or a 9x515 ECCN are controlled by that “600 series” ECCN or 9x515 ECCN. For example, electronic components not enumerated on the USML or a “600 series” other than 3A611 that are “specially designed” for a military aircraft controlled by USML Category VIII or ECCN 9A610 are controlled by the catch-all control in ECCN 9A610.x. Electronic components not enumerated on the USML or another “600 series” entry that are “specially designed” for a military vehicle controlled by USML Category VII or ECCN 0A606 are controlled by ECCN 0A606.x. Electronic components not enumerated on the USML that are “specially designed” for a missile controlled by USML Category IV are controlled by ECCN 9A604.(7) Certain radiation-hardened microelectronic circuits are controlled by ECCN 9A515.d or 9A515.e, when “specially designed” for defense articles, “600 series” items, or items controlled by 9A515.

[Note to 3A611.a:]  <I>
Note to 3A611.a:

[Note to 3A611.a:]  <I>
ECCN 3A611.a includes any radar, telecommunications, acoustic or computer equipment, end items, or systems “specially designed” for military application that are not enumerated or otherwise described in any USML category or controlled by another “600 series” ECCN.

[Note to 3A611.e:]  <I>
Note to 3A611.e:

[Note to 3A611.e:]  <I>
ECCN 3A611.e does not apply to systems, equipment, and assemblies “specially designed” for marine traffic control.

[Note 1 to ECCN 3A611.x:]  <I>
Note 1 to ECCN 3A611.x:

[Note 1 to ECCN 3A611.x:]  <I>
ECCN 3A611.x includes “parts,” “components,” “accessories,” and “attachments” “specially designed” for a radar, telecommunications, acoustic system or equipment or computer “specially designed” for military application that are neither controlled in any USML category nor controlled in any paragraph other than the .x paragraph of another “600 series” ECCN.

[Note 2 to ECCN 3A611.x:]  <I>
Note 2 to ECCN 3A611.x:

[Note 2 to ECCN 3A611.x:]  <I>
ECCN 3A611.x controls “parts” and “components” “specially designed” for underwater sensors or projectors controlled by USML Category XI(c)(12) containing single-crystal lead magnesium niobate lead titanate (PMN-PT) based piezoelectrics.

[Note 3 to ECCN 3A611.x:]  <I>
Note 3 to ECCN 3A611.x:

[Note 3 to ECCN 3A611.x:]  <I>
“Parts,” “components,” “accessories,” and “attachments” subject to the EAR and within the scope of any 600 series .x entry that are of a type that are or would potentially be for use in or with multiple platforms (e.g., military electronics, military vehicles, and military aircraft) may be classified under 3A611.x.

[Note to ECCN 3A611:]  <I>
Note to ECCN 3A611:

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP>
Items: a. Test, inspection, and production end items and equipment “specially designed” for the “development,” “production,” repair, overhaul or refurbishing of items controlled in ECCN 3A611 (except 3A611.y) or USML Category XI that are not enumerated in USML Category XI or controlled by another “600 series” ECCN.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Software” “specially designed” for the “development,” “production,” operation, or maintenance of commodities controlled by ECCN 3A611 (other than 3A611.y) and 3B611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y. “Software” “specially designed” for the “production,” “development,” operation or maintenance of commodities enumerated in ECCNs 3A611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Technology” (other than that controlled by 3E611.b or 3E611.y) “required” for the “development,” “production,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities or software controlled by ECCN 3A611, 3B611 or 3D611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. “Technology” “required” for the “development,” “production,” operation, installation, maintenance, repair, overhaul, or refurbishing of the following if controlled by ECCN 3A611, including 3A611.x:

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y. “Technology” “required” for the “production,” “development,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities or software enumerated in ECCNs 3A611.y or 3D611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
4A611 Computers, and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor, “specially designed” for a military application that are not enumerated in any USML category are controlled by ECCN 3A611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
5A611 Telecommunications equipment, and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor, “specially designed” for a military application that are not enumerated in any USML category are controlled by ECCN 3A611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
6A611 Acoustic systems and equipment, radar, and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor, “specially designed” for a military application that are not enumerated in any USML category or other ECCN are controlled by ECCN 3A611. Military fire control, laser, imaging, and guidance equipment that are not enumerated in any USML category or ECCN are controlled by ECCN 7A611.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Military fire control, laser, imaging, and guidance equipment that are enumerated in USML Category XII, and technical data (including software) directly related thereto, are subject to the ITAR. (2) See Related Controls in ECCNs 0A504, 2A984, 6A002, 6A003, 6A004, 6A005, 6A007, 6A008, 6A107, 7A001, 7A002, 7A003, 7A005, 7A101, 7A102, and 7A103. (3) See ECCN 3A611 and USML Category XI for controls on countermeasure equipment. (4) See ECCN 0A919 for foreign-made “military commodities” that incorporate more than a de minimis amount of U.S. origin “600 series” controlled content.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x.3. Elsewhere specified in ECCN 7A611.y or 3A611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. “Parts,” “components,” “accessories” and “attachments” that are “specially designed” for a commodity enumerated or otherwise described in ECCN 8A609 (except for 8A609.y) or a defense article enumerated or otherwise described in USML Category VI and not specified elsewhere on the USML, in 8A609.y or 3A611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. “Parts,” “components,” “accessories” and “attachments” that are “specially designed” for a commodity enumerated or otherwise described in ECCN 8A620 (except for 8A620.b or 8A620.y) and not elsewhere specified on the USML, in 8A620.y or 3A611.y.

[Note 2 to 9A515.d and .e:]  <I>
See USML Category XI for military electronics. See 3A611.f for PLDs and ASICs programmed for 600 series items.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. “Parts,” “components,” “accessories,” and “attachments” that are “specially designed” for a commodity enumerated or otherwise described in ECCN 9A610 (except for 9A610.y) or a defense article enumerated or otherwise described in USML Category VIII and not elsewhere specified on the USML or in 9A610.y, 9A619.y, or 3A611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. Parts,” “components,” “accessories,” and “attachments” that are “specially designed” for a commodity controlled by this ECCN 9A619 (other than ECCN 9A619.c) or for a defense article enumerated in USML Category XIX and not specified elsewhere on the USML or in ECCN 3A611.y, 9A610.y or 9A619.y.

[Note to paragraph .x:]  <I>
“Parts,” “components,” “accessories,” and “attachments” specified in USML subcategory XIX(f) are subject to the controls of that paragraph. “Parts,” “components,” “accessories,” and “attachments” specified in ECCN 3A611.y, 9A610.y or 9A619.y are subject to the controls of that paragraph.

=== 3A611: 38 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “3A611 Military electronics” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 5A992.c

Entry id: `5A992.c`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 3 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
Related Controls: (1) ECCN 5A002.a controls “components” providing the means or functions necessary for “information security.” All such “components” are presumptively “specially designed” and controlled by 5A002.a. (2) See USML Categories XI (including XI(b)) and XIII(b) (including XIII(b)(2)) for controls on systems, equipment, and components described in 5A002.d or .e that are “subject to the ITAR” (see 22 CFR parts 120 through 130). (3) For “satellite navigation system” receiving equipment containing or employing decryption see 7A005, and for related decryption “software” and “technology” see 7D005 and 7E001. (4) Noting that items may be controlled elsewhere on the CCL, examples of items not controlled by ECCN 5A002.a.4 include the following: (a) An automobile where the only 'cryptography for data confidentiality' having a 'described security algorithm' is performed by a Category 5—Part 2 Note 3 eligible mobile telephone that is built into the car. In this case, secure phone communications support a non-primary function of the automobile but the mobile telephone (equipment), as a standalone item, is not controlled by ECCN 5A002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5A992.c). (b) An exercise bike with an embedded Category 5—Part 2 Note 3 eligible web browser, where the only controlled cryptography is performed by the web browser. In this case, secure web browsing supports a non-primary function of the exercise bike but the web browser (“software”), as a standalone item, is not controlled by ECCN 5D002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5D992.c). (5) After classification or self-classification in accordance with § 740.17(b) of the EAR, mass market encryption commodities that meet eligibility requirements are released from “EI” and “NS” controls. These commodities are designated 5A992.c. (6) See also ECCNs 3A090 and 4A090.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.1. Commodities that are described in 5A992.c and that also meet or exceed the performance parameters in 3A090.a or 4A090.a; or

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.2 Commodities that are described in 5A992.c and that also meet or exceed the performance parameters in 3A090.b or 4A090.b.

=== 5A992.c: 3 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <P> Related Controls block containing “These commodities are designated 5A992.c” is the closest operative candidate because it expressly states what receives that designation.

### 5A002

Entry id: `5A002`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 72 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See ECCNs 3D001, 3E001, 5D002.z, and 5D992.z for associated technology and software controls. (2) See ECCNs 3A001.z, 5A002.z, 5A004.z, and 5A992.z.

[Note 4 to 3A090.a and 3A090.b:]  <I>
For integrated circuits that are excluded from ECCN 3A090 under Note 2 or 3 to 3A090, those ICs are also not applicable for classifications made under ECCNs 3A001.z, 4A003.z, 4A004.z, 4A005.z, 4A090, 5A002.z, 5A004.z, 5A992.z, 5D002.z, or 5D992.z because those other CCL classifications are based on the incorporation of an integrated circuit that meets the control parameters under ECCN 3A090 or otherwise meets or exceeds the control parameters or ECCNs 3A090 or 4A090. The performance parameters under ECCN 3A090.c are not used for determining whether an item is classified in a .z ECCN. See the Related Controls paragraphs of ECCNs 3A001.z, 4A003.z, 4A004.z, 4A005.z, 4A090, 5A002.z, 5A004.z, 5A992.z, 5D002.z, or 5D992.z.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) For associated “software” for commodities in this ECCN, see 3D991 and for associated “technology for commodities in this ECCN, see 3E991. (2) See also ECCNs 5A002.z, 5A004.z, and 5A992.z.

[Note 3:]  <I>
Commodities and “software” in ECCNs 4A005 and 4D004 that are also controlled in ECCNs 5A002.a, 5A002.z.1, 5A002.z.6, 5A004.a, 5A004.b, 5A004.z, 5D002.c.1, 5D002.c.3, 5D002.z.6, 5D002.z.8, or 5D002.z.9, remain controlled in Category 5—Part 2 by those entries. Category 5—Part 2 does not apply to elements of source code that implement functionality controlled by these Category 4 ECCNs, or to any item subject to the EAR where Encryption Item (EI) functionality is absent, removed or otherwise non-existent.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) For associated “software” for commodities in this ECCN, see 4D090, 5D002.z, and 5D992.z and for associated “technology” for commodities in this ECCN, see 4E001. (2) Also ECCNs 4A003.z, 4A004.z, 4A005.z, 5A002.z, 5A004.z, and 5A992.z.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) For associated “software” for commodities in this ECCN, see 4D994 and for associated “technology” for commodities in this ECCN, see 4E992. (2) See also ECCNs 4A003.z, 4A004.z, 4A005.z, 5A002.z, 5A004.z, and 5A992.z.

[3.]  <I>
Commodities in ECCN 5A001.j, and related “software” specified in 5D001.c (for 5A001.j) that are also controlled in ECCNs 5A002.a, 5A002.z.1, 5A002.z.6, 5A004.a, 5A004.b, 5A004.z, 5D002.c.1, 5D002.c.3, 5D002.z.6, 5D002.z.8, or z 5D002.z.9, remain controlled in Category 5—Part 2 by those entries. Category 5—Part 2 does not apply to elements of source code that implement functionality controlled by these Category 5 Part 1 ECCNs, or to any item subject to the EAR where Encryption Item (EI) functionality is absent, removed or otherwise non-existent.

[Note 3:]  <I>
Cryptography Note: ECCNs 5A002, 5D002.a.1, .b, .c.1, z.1, z.5, and z.6, do not control items as follows:

[Technical Note:]  <I>
For the purpose of the Cryptography Note, 'executable software' means “software” in executable form, from an existing hardware component excluded from 5A002, by the Cryptography Note.

[N.B. to Note 3 (Cryptography Note):]  <I>
You must submit a classification request or self-classification report to BIS for certain mass market encryption commodities and software eligible for the Cryptography Note employing a key length greater than 64 bits for the symmetric algorithm (or, for commodities and software not implementing any symmetric algorithms, employing a key length greater than 768 bits for asymmetric algorithms described by Technical note 2.b to 5A002.a or greater than 128 bits for elliptic curve algorithms, or any asymmetric algorithm described by Technical Note 2.c to 5A002.a) in accordance with the requirements of § 740.17(b) of the EAR in order to be released from the “EI” and “NS” controls of ECCN 5A002 or 5D002. For mass market commodities and software that do not require a self-classification report pursuant to § 740.17(b) and (e)(3) of the EAR, such items are also released from “EI” and “NS” controls and controlled under ECCN 5A992 or 5D992.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
5A002 “Information security” systems, equipment and “components,” as follows (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to items controlled by 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to items controlled by 5A002.z.1.b, z.2.b, z.3.b, z.4.b, z.5.b

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
N/A for systems and equipment. N/A for 5A002.z.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
NAC/ACA: Yes, for 5A002.z.1.b, z.2.b

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
AIA: Yes 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
ACM: Yes for 5A002.z

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
LPP: Yes for 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a

[Note:]  <I>
See § 740.2(a)(9)(ii) of the EAR for license exception restrictions for ECCN 5A002.z.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
Related Controls: (1) ECCN 5A002.a controls “components” providing the means or functions necessary for “information security.” All such “components” are presumptively “specially designed” and controlled by 5A002.a. (2) See USML Categories XI (including XI(b)) and XIII(b) (including XIII(b)(2)) for controls on systems, equipment, and components described in 5A002.d or .e that are “subject to the ITAR” (see 22 CFR parts 120 through 130). (3) For “satellite navigation system” receiving equipment containing or employing decryption see 7A005, and for related decryption “software” and “technology” see 7D005 and 7E001. (4) Noting that items may be controlled elsewhere on the CCL, examples of items not controlled by ECCN 5A002.a.4 include the following: (a) An automobile where the only 'cryptography for data confidentiality' having a 'described security algorithm' is performed by a Category 5—Part 2 Note 3 eligible mobile telephone that is built into the car. In this case, secure phone communications support a non-primary function of the automobile but the mobile telephone (equipment), as a standalone item, is not controlled by ECCN 5A002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5A992.c). (b) An exercise bike with an embedded Category 5—Part 2 Note 3 eligible web browser, where the only controlled cryptography is performed by the web browser. In this case, secure web browsing supports a non-primary function of the exercise bike but the web browser (“software”), as a standalone item, is not controlled by ECCN 5D002 because it is excluded by the Cryptography Note (Note 3) (See ECCN 5D992.c). (5) After classification or self-classification in accordance with § 740.17(b) of the EAR, mass market encryption commodities that meet eligibility requirements are released from “EI” and “NS” controls. These commodities are designated 5A992.c. (6) See also ECCNs 3A090 and 4A090.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.2. Digital communication or networking systems, equipment or components, not specified in paragraph 5A002.a.1;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.3. Computers, other items having information storage or processing as a primary function, and components therefor, not specified in paragraphs 5A002.a.1 or .a.2;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.4. Items, not specified in paragraphs 5A002.a.1 to a.3, where the 'cryptography for data confidentiality' having a 'described security algorithm' meets all of the following:

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.4.b. It is performed by incorporated equipment or “software” that would, as a standalone item, be specified by ECCNs 5A002, 5A003, 5A004, 5B002 or 5D002.

[N.B. to paragraph a.4:]  <I>
See Related Control Paragraph (4) of this ECCN 5A002 for examples of items not controlled by 5A002.a.4.

[Technical Notes:]  <I>
1. For the purposes of 5A002.a, 'cryptography for data confidentiality' means “cryptography” that employs digital techniques and performs any cryptographic function other than any of the following:

[Technical Notes:]  <I>
2. For the purposes of 5A002.a, 'described security algorithm' means any of the following:

[Note 1:]  <I>
a. Whether the item meets the criteria of 5A002.a.1 to a.4; or

[Note 1:]  <I>
b. Whether the cryptographic capability for data confidentiality specified by 5A002.a is usable without “cryptographic activation.”

[Note 2:]  <I>
5A002.a does not control any of the following items, or specially designed “information security” components therefor:

[Note 2:]  <I>
a.1.a.1.a. Equipment or systems, not described by 5A002.a.1 to a.4;

[Note 2:]  <I>
a.1.a.1.c. Equipment or systems, excluded from 5A002.a by entries b. to f. of this Note; and

[Technical Note to paragraph a.1.b.1 of Note 2:]  <I>
For the purposes of 5A002.a Note 2.-a.1.b.1, 'personal data' includes any data specific to a particular person or entity, such as the amount of money stored and data necessary for “authentication.”

[Technical Note to paragraph a.2 of Note 2:]  <I>
'For the purposes of 5A002.a Note 2.a.2, 'readers/writers' include equipment that communicates with smart cards or electronically readable documents through a network.

[Technical Note to paragraph b. of Note 2:]  <I>
For the purposes of 5A002.a Note 2.b, 'money transactions' in 5A002 Note 2 paragraph b. includes the collection and settlement of fares or credit functions.

[Technical Notes:]  <I>
1. For the purposes of 5A002.a Note 2.j, 'connected civil industry application' means a network-connected consumer or civil industry application other than “information security”, digital communication, general purpose networking or computing.

[Technical Notes:]  <I>
2. For the purposes of 5A002.a Note 2.j.1.a.1, 'non-arbitrary data' means sensor or metering data directly related to the stability, performance or physical measurement of a system (e.g., temperature, pressure, flow rate, mass, volume, voltage, physical location, etc.), that cannot be changed by the user of the device.

[Technical Note:]  <I>
For the purposes of 5A002.b, a 'cryptographic activation token' is an item designed or modified for any of the following:

[Technical Note:]  <I>
1. Converting, by means of “cryptographic activation”, an item not specified by Category 5—Part 2 into an item specified by 5A002.a or 5D002.c.1, and not released by the Cryptography Note (Note 3 in Category 5—Part 2); or

[Technical Note:]  <I>
2. Enabling by means of “cryptographic activation”, additional functionality specified by 5A002.a of an item already specified by Category 5—Part 2;

[Technical Note:]  <I>
For the purposes of 5A002.c,”quantum cryptography” is also known as Quantum Key Distribution (QKD).

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
e. Designed or modified to use cryptographic techniques to generate the spreading code for “spread spectrum” systems, not specified by 5A002.d, including the hopping code for “frequency hopping” systems.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.1.a. Commodities that are described in 5A002.a and that also meet or exceed the performance parameters in 3A090.a or 4A090.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.1.b Commodities that are described in 5A002.a and that also meet or exceed the performance parameters in 3A090.b or 4A090.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.2.a Commodities that are described in 5A002.b and that also meet or exceed the performance parameters in 3A090.a or 4A090.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.2.b Commodities that are described in 5A002.b and that also meet or exceed the performance parameters in 3A090.b or 4A090.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.3.a Commodities that are described in 5A002.c and that also meet or exceed the performance parameters in 3A090.a or 4A090.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.3.b Commodities that are described in 5A002.c and that also meet or exceed the performance parameters in 3A090.b or 4A090.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.4.a Commodities that are described in 5A002.d and that also meet or exceed the performance parameters in 3A090.a or 4A090.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.4.b Commodities that are described in 5A002.d and that also meet or exceed the performance parameters in 3A090.b or 4A090.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.5.a Commodities that are described in 5A002.e and that also meet or exceed the performance parameters in 3A090.a or 4A090.a; or

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
z.5.b Commodities that are described in 5A002.e and that also meet or exceed the performance parameters in 3A090.b or 4A090.b.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
5A992 Equipment not controlled by 5A002 (see List of Items Controlled)

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. Equipment “specially designed” for the “development” or “production” of equipment controlled by 5A002, 5A003, 5A004 or 5B002.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. Measuring equipment “specially designed” to evaluate and validate the “information security” functions of equipment controlled by 5A002, 5A003 or 5A004, or of “software” controlled by 5D002.a, z.1 through z.4, or 5D002.c or z.6 through z.9.

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
EI applies to “software” in 5D002.a.1, a.3, .b, c.1 and c.3, for commodities or “software” controlled for EI reasons in ECCN 5A002, 5A004 or 5D002

[Supplement No. 1 to Part 774—The Commerce Control List]  <E>
Note: Encryption software is controlled because of its functional capacity, and not because of any informational value of such software; such software is not accorded the same treatment under the EAR as other “software'; and for export licensing purposes, encryption software is treated under the EAR in the same manner as a commodity included in ECCN 5A002.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a.1. Equipment specified by 5A002 or “software” specified by 5D002.c.1;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. “Software” having the characteristics of a 'cryptographic activation token' specified by 5A002.b;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
c.1. Equipment specified by 5A002.a, .c, .d or .e;

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “technology” for commodities controlled by 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a or 5A004.z.1.a, z.2.a or “software” specified by 5D002 (for 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a or 5A004.z.1.a, z.2.a commodities)

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “technology” for commodities controlled by 5A002.z.1.b, z.2.b, z.3.b, z.4.b, z.5.b or 5A004.z.1.b, z.2.b or “software” specified by 5D002 (for 5A002.z.1.b, z.2.b, z.3.b, z.4.b, z.5.b or 5A004.z.1.b, z.2.b commodities)

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
EI applies to “technology” in 5E002.a for commodities or “software” controlled for EI reasons in ECCNs 5A002, 5A004 or 5D002, and to “technology” in 5E002.b

[License Requirements Notes:]  <I>
(2) When a person performs or provides technical assistance that incorporates, or otherwise draws upon, “technology” that was either obtained in the United States or is of U.S.-origin, then a release of the “technology” takes place. Such technical assistance, when rendered with the intent to aid in the “development” or “production” of encryption commodities or software that would be controlled for “EI” reasons under ECCN 5A002, 5A004 or 5D002, may require authorization under the EAR even if the underlying encryption algorithm to be implemented is from the public domain or is not of U.S.-origin.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
AIA: Yes for “technology” for commodities controlled by 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a or 5A004.z.1.a, z.2.a or “software” specified by 5D002 (for 5A002.z.1.a, z.2.a, z.3.a, z.4.a, z.5.a or 5A004.z.1.a, z.2.a commodities)

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
ACM: Yes for “technology” for commodities controlled by 5A002.z or 5A004.z or “software” specified by 5D002 (for 5A002.z or 5A004.z commodities

[Note:]  <I>
See § 740.2(a)(9)(ii) of the EAR for license exception restrictions for technology for .z paragraphs under ECCNs 5A002, 5A004 or “software” specified by 5D002 (for 5A002.z or 5A004.z commodities).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: See also 5E992. This entry does not control “technology” “required” for the “use” of equipment excluded from control under the Related Controls paragraph or the Technical Notes in ECCN 5A002 or “technology” related to equipment excluded from control under ECCN 5A002.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Technology” according to the General Technology Note for the “development,” “production” or “use” of equipment controlled by 5A002, 5A003, 5A004 or 5B002, or of “software” controlled by 5D002.a, z.1 through z.3, or 5D002.c, z.6 through z.8.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. “Technology” having the characteristics of a 'cryptographic activation token' specified by 5A002.b, z.2.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
d. “Spacecraft payloads” incorporating items specified by 3A001.b.1.a.4 or z (if also described in 3A001.b.1.a.4), 3A002.g, 5A001.a.1, .b.3, 5A002.c, z.3 or z.8, .e, z.5, 6A002.a.1, a.2, .b, .d, 6A003.b, 6A004.c, .e, 6A008.d, .e, .k, .l or 9A010.c.

[Supplement No. 3 to Part 774—Statements of Understanding]  <P>
(c) Category 5—Part 2—Note 4 Statement of Understanding. All items previously described by Notes (b), (c) and (h) to 5A002 are now described by Note 4 to Category 5—Part 2. Note (h) to 5A002 prior to June 25, 2010 stated that the following was not controlled by 5A002:

=== 5A002: 72 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “5A002 'Information security'” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 9A610

Entry id: `9A610`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 58 block(s)

[Note 1 to 0A614:]  <I>
This entry includes operational flight trainers, radar target trainers, flight simulators for aircraft classified under ECCN 9A610.a, human-rated centrifuges, radar trainers for radars classified under ECCN 3A611, instrument flight trainers for military aircraft, navigation trainers for military items, target equipment, armament trainers, military pilotless aircraft trainers, mobile training units and training “equipment” for ground military operations.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y.1. Construction equipment “specially designed” for military use, including such equipment “specially designed” for transport in aircraft controlled by USML VIII(a) or ECCN 9A610.a.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Defense articles, such as materials made from classified information, that are controlled by USML Category X or XIII of the ITAR, and technical data (including software) directly related thereto, are “subject to the ITAR.” (2) See ECCN 0A919 for foreign-made “military commodities” that incorporate more than a de minimis amount of US-origin “600 series” controlled content. (3) See ECCN 9A610.g for anti-gravity suits (“G-suits”) and pressure suits capable of operating at altitudes higher than 55,000 feet above sea level. (4) For other military helmet “components” or “accessories” not specified in 1A613.c, see the relevant ECCN in the CCL or USML Entry.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Electronic items that are enumerated in USML Category XI or other USML categories, and technical data (including software) directly related thereto, are subject to the ITAR. (2) Application specific integrated circuits (ASICs) and programmable logic devices (PLD) that are programmed for defense articles that are subject to the ITAR are controlled in USML Category XI(c)(1). (3) See ECCN 3A001.a.7 for controls on unprogrammed programmable logic devices (PLD). (4) Printed circuit boards and populated circuit cards with a layout that is “specially designed” for defense articles are controlled in USML Category XI(c)(2). (5) Multichip modules for which the pattern or layout is “specially designed” for defense articles are controlled in USML Category XI(c)(3). (6) Electronic items “specially designed” for military application that are not controlled in any USML category but are within the scope of another “600 series” ECCN or a 9x515 ECCN are controlled by that “600 series” ECCN or 9x515 ECCN. For example, electronic components not enumerated on the USML or a “600 series” other than 3A611 that are “specially designed” for a military aircraft controlled by USML Category VIII or ECCN 9A610 are controlled by the catch-all control in ECCN 9A610.x. Electronic components not enumerated on the USML or another “600 series” entry that are “specially designed” for a military vehicle controlled by USML Category VII or ECCN 0A606 are controlled by ECCN 0A606.x. Electronic components not enumerated on the USML that are “specially designed” for a missile controlled by USML Category IV are controlled by ECCN 9A604.(7) Certain radiation-hardened microelectronic circuits are controlled by ECCN 9A515.d or 9A515.e, when “specially designed” for defense articles, “600 series” items, or items controlled by 9A515.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See 9A610.r. and 9A610.s. for items designed or modified for military UAVs. (2) See USML Category IV for items “specially designed” for use in rockets or missiles that are “subject to the ITAR.”

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP>
Items: a. Pneumatic, hydraulic, mechanical, electro-optical, or electromechanical flight control systems (including fly-by-wire and fly-by-light systems) designed or modified for UAVs capable of delivering at least 500 kilograms of payload to a range of at least 300 km, other than those controlled by either USML paragraph VIII(a) or ECCN 9A610.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. Attitude control equipment designed or modified for UAVs capable of delivering at least 500 kilograms of payload to a range of at least 300 km, other than those controlled by either USML paragraph VIII(a) or ECCN 9A610.a;

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) See USML Category VIII. (2) Also see ECCN 9A610 and § 744.3 of the EAR. (3) For “UAVs” that are “sub-orbital craft,” see ECCNs 9A004.h and 9A515.a. (4) For military “UAVs” see 9A610 and USML Category VIII.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
(a) See ECCN 9A610 for the aircraft, refuelers, ground equipment, parachutes, harnesses, and instrument flight trainers, as well as “parts”, “accessories,” and “attachments” for the forgoing that, immediately prior to October 15, 2013, were classified under 9A018.a.1, .a.3, .c, .d, .e, or .f.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: See the U.S. Munitions List (22 CFR part 121). Also see ECCN 9A610.u.

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: Spacecraft, launch vehicles and related articles that are described on the USML, and technical data (including “software”) directly related thereto, and all services (including training) directly related to the integration of any satellite or spacecraft to a launch vehicle, including both planning and onsite support, or furnishing any assistance (including training) in the launch failure analysis or investigation for items in ECCN 9A515.a, are “subject to the ITAR.” All other “spacecraft,” as enumerated below and defined in § 772.1, are subject to the controls of this ECCN. See also ECCNs 3A001, 3A002, 3A991, 3A992, 6A002, 6A004, 6A008, and 6A998 for specific “space-qualified” items, 7A004 and 7A104 for star trackers, and 9A004 for the International Space Station (ISS), the James Webb Space Telescope (JWST), and “specially designed” “parts” and “components” therefor. See USML Category XI(c) for controls on certain “Monolithic Microwave Integrated Circuit” (“MMIC”) amplifiers. See ECCN 9A610.g for pressure suits used for high altitude aircraft.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9A610 Military Aircraft and Related Commodities, Other Than Those Enumerated in 9A991.a (See List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
NS applies to entire entry except: 9A610.b; parts and components controlled in 9A610.x if being exported or reexported for use in an aircraft controlled in 9A610.b; and 9A610.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to entire entry except: 9A610.b; parts and components controlled in 9A610.x if being exported or reexported for use in an aircraft controlled in 9A610.b; and 9A610.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to 9A610.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to 9A610.t, .u, .v, and .w and to “Unmanned Aerial Vehicles” (“UAVs”) and Remotely Piloted Vehicles (RPVs) in 9A610.a that are capable of a maximum range of at least 300 kilometers (km), regardless of payload

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
UN applies to entire entry except 9A610.y

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
STA: (1) Paragraph (c)(1) of License Exception STA (§ 740.20(c)(1) of the EAR) may not be used for any item in 9A610.a (i.e., “end item” military aircraft), unless determined by BIS to be eligible for License Exception STA in accordance with § 740.20(g) (License Exception STA eligibility requests for 9x515 and “600 series” items). (2) License Exception STA may not be used to ship commodities in 9A610.a that are controlled for missile technology (MT) reasons that have a payload capability of at least 500 kg to a range of at least 300 km to any of the destinations listed in Country Groups A:5 or A:6 (See supplement no.1 to part 740 of the EAR). (3) Paragraph (c)(2) of License Exception STA (§ 740.20(c)(2) of the EAR) may not be used for any item in 9A610.

[Note 2:]  <I>
9A610.a does not control 'military aircraft' or “lighter-than-air vehicles” that:

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
e. Mobile aircraft arresting and engagement runway systems for aircraft controlled by either USML Category VIII(a) or ECCN 9A610.a.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
f. Pressure refueling equipment and equipment that facilitates operations in confined areas, “specially designed” for aircraft controlled by either USML paragraph VIII(a) or ECCN 9A610.a.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
g. Aircrew life support equipment, aircrew safety equipment and other devices for emergency escape from aircraft controlled by either USML paragraph VIII(a) or ECCN 9A610.a.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
h. Parachutes, paragliders, complete parachute canopies, harnesses, platforms, electronic release mechanisms, “specially designed” for use with aircraft controlled by either USML paragraph VIII(a) or ECCN 9A610.a, and “equipment” “specially designed” for military high altitude parachutists, such as suits, special helmets, breathing systems, and navigation equipment.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
u. Apparatus and devices “specially designed” for the handling, control, activation and non-ship-based launching of “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a, and capable of a range equal to or greater than 300 km.

[Note to paragraph .u:]  <I>
Apparatus and devices “specially designed” for the handling, control, activation and non-ship-based launching of “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a with a maximum range less than 300 km are controlled in paragraph .x of this entry.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
v. Radar altimeters designed or modified for use in “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a., and capable of delivering at least 500 kilograms payload to a range of at least 300 km.

[Note to paragraph .v:]  <I>
Radar altimeters designed or modified for use in “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a. that are not capable of delivering at least 500 kilograms payload to a range of at least 300 km are controlled in paragraph .x of this entry.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
w.1. Pneumatic hydraulic, mechanical, electro-optical, or electromechanical flight control systems (including fly-by-wire and fly-by-light systems) and attitude control equipment designed or modified for “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a., and capable of delivering at least 500 kilograms payload to a range of at least 300 km.

[Note to paragraph .w.1:]  <I>
Pneumatic, hydraulic, mechanical, electro-optical, or electromechanical flight control systems (including fly-by-wire and fly-by-light systems) and attitude control equipment designed or modified for “UAVs” controlled by either USML paragraph VIII(a) or ECCN 9A610.a., not capable of delivering at least 500 kilograms payload to a range of at least 300 km are controlled in paragraph .x of this entry.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
w.2. Flight control servo valves designed or modified for the systems in 9A610.w.1. and designed or modified to operate in a vibration environment greater than 10g rms over the entire range between 20Hz and 2 kHz.

[Note to paragraph .w:]  <I>
Paragraphs 9A610.w.1. and 9A610.w.2. include the systems, equipment and valves designed or modified to enable operation of manned aircraft as unmanned aerial vehicles.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. “Parts,” “components,” “accessories,” and “attachments” that are “specially designed” for a commodity enumerated or otherwise described in ECCN 9A610 (except for 9A610.y) or a defense article enumerated or otherwise described in USML Category VIII and not elsewhere specified on the USML or in 9A610.y, 9A619.y, or 3A611.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y.30. “Parts,” “components,” “accessories,” and “attachments,” other than electronic items or navigation equipment, for use in or with a commodity controlled by ECCN 9A610.h;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y.33. Brackets, carrying cases, controllers, cables and adapters, chargers, docks, mounts, propellers, propeller systems, and propeller blades for “UAVs” and RPVs described in 9A610.a.

[Note:]  <I>
For purposes of ECCN 9A619.a, the term “military gas turbine engines” means gas turbine engines “specially designed” for “end items” enumerated in USML Categories VI, VII or VIII or on the CCL under ECCNs 0A606, 8A609 or 9A610.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
x. Parts,” “components,” “accessories,” and “attachments” that are “specially designed” for a commodity controlled by this ECCN 9A619 (other than ECCN 9A619.c) or for a defense article enumerated in USML Category XIX and not specified elsewhere on the USML or in ECCN 3A611.y, 9A610.y or 9A619.y.

[Note to paragraph .x:]  <I>
“Parts,” “components,” “accessories,” and “attachments” specified in USML subcategory XIX(f) are subject to the controls of that paragraph. “Parts,” “components,” “accessories,” and “attachments” specified in ECCN 3A611.y, 9A610.y or 9A619.y are subject to the controls of that paragraph.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y. Specific “parts,” “components,” “accessories,” and “attachments” “specially designed” for a commodity subject to control in this entry, ECCN 9A610, or for a defense article in USML Category VIII or Category XIX and not elsewhere specified on the USML or in the CCL, and other commodities, as follows, and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor:

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9B610 Test, inspection, and production “equipment” and related commodities “specially designed” for the “development” or “production” of commodities enumerated or otherwise described in ECCN 9A610 or USML Category VIII (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP>
Items: a. Test, inspection, and production “equipment” “specially designed” for the “production,” “development,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities enumerated or otherwise described in ECCN 9A610 (except 9A610.y) or USML Category VIII, and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b. Environmental test facilities “specially designed” for the certification, qualification, or testing of commodities enumerated or otherwise described in ECCN 9A610 (except for 9A610.y) or USML Category VIII and “parts,” “components,” “accessories,” and “attachments” “specially designed” therefor.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
c. “Production facilities” designed or modified for UAVs or drones that are (i) controlled by either USML paragraph VIII(a) or ECCN 9A610.a and (ii) capable of a range equal to or greater than 300 km.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9C610 Materials “specially designed” for commodities controlled by USML Category VIII or ECCN 9A610 and not elsewhere specified in the CCL or the USML (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
List of Items Controlled a. Materials not elsewhere specified in the USML or the CCL and “specially designed” for commodities enumerated or otherwise described in USML Category VIII or ECCN 9A610 (except 9A610.y).

[Note 2:]  <I>
Materials “specially designed” for both aircraft enumerated in USML Category VIII and aircraft enumerated in ECCN 9A610 are subject to the controls of this ECCN.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9D610 Software “specially designed” for the “development,” “production,” operation, or maintenance of military aircraft and related commodities controlled by 9A610, equipment controlled by 9B610, or materials controlled by 9C610 (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to software “specially designed” for the operation, installation, maintenance, repair, overhaul, or refurbishing of commodities controlled for MT reasons in 9A610 or 9B610

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Software” (other than software controlled in paragraphs .b or .y of this entry) “specially designed” for the “development,” “production,” operation, or maintenance of commodities controlled by ECCN 9A610, ECCN 9B610, or ECCN 9C610.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b.6. Fatigue life monitoring systems “specially designed” to relate actual usage to the analytical or design spectrum and to compute amount of fatigue life “specially designed” for aircraft controlled by either USML subcategory VIII(a) or ECCN 9A610.a, except for Military Commercial Derivative Aircraft;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b.7. Landing gear, and “parts” and “components” “specially designed” therefor, “specially designed” for use in aircraft weighing more than 21,000 pounds controlled by either USML subcategory VIII(a) or ECCN 9A610.a, except for Military Commercial Derivative Aircraft;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y. Specific “software” “specially designed” for the “development,” “production,” operation, or maintenance of commodities enumerated in ECCN 9A610.y.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9E610 Technology “required” for the “development,” “production,” operation, installation, maintenance, repair, overhaul, or refurbishing of military aircraft and related commodities controlled by 9A610, equipment controlled by 9B610, materials controlled by 9C610, or software controlled by 9D610 (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
MT applies to “technology” “required” for the “development,” “production,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities or software controlled for MT reasons in 9A610, 9B610, or 9D610 for MT reasons

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
a. “Technology” (other than technology controlled by paragraphs .b or .y of this entry) “required” for the “development,” “production,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities or software controlled by ECCN 9A610, 9B610, 9C610, or 9D610.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b.6. Fatigue life monitoring systems “specially designed” to relate actual usage to the analytical or design spectrum and to compute amount of fatigue life “specially designed” for aircraft controlled by either USML subcategory VIII(a) or ECCN 9A610.a, except for Military Commercial Derivative Aircraft;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b.7. Landing gear, and “parts” and “components” “specially designed” therefor, “specially designed” for use in aircraft weighing more than 21,000 pounds controlled by either USML subcategory VIII(a) or ECCN 9A610.a, except for Military Commercial Derivative Aircraft;

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
b.15. Technology “required” for the “development” or “production” of “parts” or “components” controlled in 9A610.x and “specially designed” for damage or failure-adaptive flight control systems controlled in Category VIII(h)(7) of the USML.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
y. Specific “technology” “required” for the “production,” “development,” operation, installation, maintenance, repair, overhaul, or refurbishing of commodities or software enumerated in ECCN 9A610.y or 9D610.y.

=== 9A610: 58 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “9A610 Military Aircraft and Related Commodities” looks operative because it is the exact ECCN heading rather than a cross-reference.

### 9A991

Entry id: `9A991`

Source file(s) searched: `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 13 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “software” for inertial navigation systems and inertial equipment, and “components” therefor, for “9A991.b aircraft”

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “technology” for inertial navigation systems or inertial equipment, and “components” therefor, for 9A991.b aircraft

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “technology” for inertial navigation systems or inertial equipment, and “components” therefor, for 9A991.b aircraft

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
RS applies to “technology” required for the use of inertial navigation systems, or inertial equipment, or “specially designed” “parts” and “components” therefor, “specially designed” for 9A991.b aircraft

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: See also 9A101 and 9A991.

[Supplement No. 1 to Part 774—The Commerce Control List]  <P>
s.4 Described in 9A001, 9A002, 9A003, 9A515, or 9A991.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9A610 Military Aircraft and Related Commodities, Other Than Those Enumerated in 9A991.a (See List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: (1) Military gas turbine engines and related articles that are enumerated or otherwise described in USML Category XIX, and technical data (including software) directly related thereto, are subject to the jurisdiction of the International Traffic in Arms Regulations (ITAR). (2) Gas turbine engines designated 501-D22 are controlled in ECCN 9A991.d regardless of the aircraft type into which they will be installed. (3) See ECCN 0A919 for foreign-made “military commodities” that incorporate more than a de minimis amount of U.S.-origin “600 series” controlled content. (4) “Parts,” “components,” “accessories,” and “attachments” specified in USML Category XIX(f) are subject to the controls of that paragraph. (5) “Parts,” “components,” “accessories,” and “attachments” specified in ECCN 9A619.y are subject to the controls of that paragraph.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9A991 “Aircraft,” n.e.s., and gas turbine engines not controlled by 9A001 or 9A101 and “parts” and “components,” n.e.s. (see List of Items Controlled).

[Supplement No. 1 to Part 774—The Commerce Control List]  <TD>
UN applies to 9A991.a

[Note:]  <I>
9A991.c does not control aero gas turbine engines that are destined for use in civil “aircraft” and that have been in use in bona fide civil “aircraft” for more than eight years. If they have been in use in bona fide civil “aircraft” for more than eight years, such engines are controlled under 9A991.d.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9D991 “Software”, for the “development” or “production” of equipment controlled by 9A991 or 9B991.

[Supplement No. 1 to Part 774—The Commerce Control List]  <B>
9E991 “Technology”, for the “development”, “production” or “use” of equipment controlled by 9A991 or 9B991.

=== 9A991: 13 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The <B> block beginning “9A991 “Aircraft,” n.e.s.” looks operative because it is the exact ECCN heading rather than a cross-reference.

## ITAR / title-22 part-121

### XII(e)(12)

Entry id: `XII(e)(12)`

Source file(s) searched: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01)

**NOT FOUND:** `tools/print_rule_text.py` returned zero blocks from: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01).

Printer output (verbatim, unedited):

```text
=== XII(e)(12): 0 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): None; the printer returned zero candidate blocks, so there is no block to identify as operative.

### VIII(a)(5)

Entry id: `VIII(a)(5)`

Source file(s) searched: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01)

**NOT FOUND:** `tools/print_rule_text.py` returned zero blocks from: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01).

Printer output (verbatim, unedited):

```text
=== VIII(a)(5): 0 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): None; the printer returned zero candidate blocks, so there is no block to identify as operative.

### VIII(h)

Entry id: `VIII(h)`

Source file(s) searched: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-121-2026-09-01.xml  (ecfr_date 2026-09-01)  — 3 block(s)

[Note 1 to paragraph (b):]  <P>
For controls on non-SLV launcher mechanisms for use on aircraft, see USML Category VIII(h).

[§ 121.1 The United States Munitions List.]  <P>
(5) Integrated helmets, not specified in USML Category VIII(h)(15) or USML Category XII, incorporating optical sights or slewing devices, which include the ability to aim, launch, track, or manage munitions;

[§ 121.1 The United States Munitions List.]  <P>
(i) Aircraft listed in USML Category VIII(h)(1)(i), (ii), or (iii);

=== VIII(h): 3 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): No returned block contains Category VIII(h)'s operative text; the § 121.1 <P> block beginning “(5) Integrated helmets” is the closest candidate because it applies an express VIII(h)(15) exclusion.

### XI

Entry id: `XI`

Source file(s) searched: `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-121-2026-09-01.xml  (ecfr_date 2026-09-01)  — 30 block(s)

[Note 2 to paragraph (c):]  <P>
Aircraft Missile Protection Systems (AMPS) are controlled in USML Category XI.

[§ 121.1 The United States Munitions List.]  <P>
(7) Rocket, SLV, and missile engines and motors, not otherwise enumerated in paragraphs (d)(1) through (d)(6) of this category or USML Category XIX.

[Note 2 to paragraph (f):]  <P>
For controls related to ship signature management, see USML Category XIII.

[Note to paragraphs (g)(3)-(6):]  <P>
See USML Category XIII(m)(1)-(4) for interpretations which explain and amplify terms used in these paragraphs.

[§ 121.1 The United States Munitions List.]  <P>
(iv) Aircraft included in a USML Category XXI(a) determination;

[§ 121.1 The United States Munitions List.]  <P>
(28) Electrical power or thermal management systems specially designed for an engine controlled in Category XIX and having any of the following:

[§ 121.1 The United States Munitions List.]  <P>
(5) Radar trainers specially designed for training on radar controlled by USML Category XI;

[Note 2 to paragraph (a)(1):]  <P>
See USML Category XIII(e) for controls on related materials.

[Note to paragraph (a)(2):]  <P>
See USML Category XIII(j) for controls on related materials.

[§ 121.1 The United States Munitions List.]  <P>
(5) Integrated helmets, not specified in USML Category VIII(h)(15) or USML Category XII, incorporating optical sights or slewing devices, which include the ability to aim, launch, track, or manage munitions;

[Note 2 to paragraph (a)(7):]  <P>
See USML Category XII for sensor protection equipment.

[§ 121.1 The United States Munitions List.]  <HD1>
Category XI—Military Electronics

[§ 121.1 The United States Munitions List.]  <P>
(a) Electronic equipment and systems not included in Category XII of the U.S. Munitions List, as follows:

[Note 6 to paragraph (c)(4):]  <P>
USML Category XI(c)(4) applies to transmit/receive modules and to transmit modules, with or without a heat sink. The value of length d in USML Category XI(c)(4)(iii) does not include any portion of the transmit/receive module or transmit module that functions as a heat sink.

[Note to Category XI:]  <HED>
Note to Category XI:

[Note to Category XI:]  <P>
Category XI does not control transmit/receive modules, transmit/receive MMICs, transmit modules, or transmit MMICs that incorporate or are MMICs fabricated exclusively with homojunction CMOS silicon-based circuits on silicon substrates, or radars and radar antennas specially designed to use only such modules or MMICs.

[§ 121.1 The United States Munitions List.]  <HD1>
Category XII—Fire Control, Laser, Imaging, and Guidance Equipment

[§ 121.1 The United States Munitions List.]  <P>
(iii) GNSS receiving equipment specially designed for use with an antenna described in Category XI(c)(10) (MT if designed or modified for airborne applications); or

[§ 121.1 The United States Munitions List.]  <P>
(3) GNSS anti-jam systems specially designed for use with an antenna described in Category XI(c)(10);

[§ 121.1 The United States Munitions List.]  <P>
(13) Optical sensors having a spectral filter specially designed for systems or equipment controlled in USML Category XI(a)(4), or optical sensor assemblies that provide threat warning or tracking for systems or equipment controlled in Category XI(a)(4);

[Note to Category XII:]  <HED>
Note to Category XII:

[§ 121.1 The United States Munitions List.]  <HD1>
Category XIII— Materials and Miscellaneous Articles

[§ 121.1 The United States Munitions List.]  <P>
(ii) Coatings described in USML Category XIV(f)(7);

[§ 121.1 The United States Munitions List.]  <P>
(iii) Engines listed in USML Category XIX(f)(1)(i) or (ii); or

[§ 121.1 The United States Munitions List.]  <HD1>
Category XIV—Toxicological Agents, Including Chemical Agents, Biological Agents, and Associated Equipment

[§ 121.1 The United States Munitions List.]  <P>
* (13) Are classified, contain classified software or hardware, are manufactured using classified production data, or are being developed using classified information (e.g., having classified requirements, specifications, functions, or operational characteristics or include classified cryptographic items controlled under USML Category XIII of this subchapter).

[§ 121.1 The United States Munitions List.]  <HD1>
Category XIX—Gas Turbine Engines and Associated Equipment

[§ 121.1 The United States Munitions List.]  <P>
(iii) Engines included in a USML Category XXI(a) determination.

[§ 121.1 The United States Munitions List.]  <HD1>
Category XXI—Articles, Technical Data, and Defense Services Not Otherwise Enumerated

[Note 1 to Category XXI:]  <HED>
Note 1 to Category XXI:

=== XI: 30 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The § 121.1 <HD1> block naming “Category XI—Military Electronics” looks operative because it is the exact USML category heading rather than a cross-reference.

## Propagation / definitions

### 120.11

Entry id: `120.11`

Source file(s) searched: `ecfr/title-22-part-120-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-120-2026-09-01.xml  (ecfr_date 2026-09-01)  — 1 block(s)

[§ 120.11 Order of review.]  <HEAD>
§ 120.11 Order of review.

=== 120.11: 1 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 120.11 Order of review.] <HEAD> block is the operative locator because it exactly matches the requested section number and title, although the printer returned no body paragraph.

### 120.41

Entry id: `120.41`

Source file(s) searched: `ecfr/title-22-part-120-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-120-2026-09-01.xml  (ecfr_date 2026-09-01)  — 3 block(s)

[§ 120.3 Policy on designating or determining defense articles and services on the U.S. Munitions List.]  <P>
(2) Meets one of the criteria of § 120.41(b) when the article is used in or with a defense article and specially designed is used as a control criteria.

[§ 120.11 Order of review.]  <P>
(b) Specially designed. (1) If the entry includes the term specially designed, refer to § 120.41 to determine if the article qualifies for one or more of the exclusions articulated in § 120.41(b).

[§ 120.41 Specially designed.]  <HEAD>
§ 120.41 Specially designed.

=== 120.41: 3 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 120.41 Specially designed.] <HEAD> block is the operative locator because it exactly matches the requested section number and title, although the printer returned no body paragraph.

### 120.3

Entry id: `120.3`

Source file(s) searched: `ecfr/title-22-part-120-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-120-2026-09-01.xml  (ecfr_date 2026-09-01)  — 16 block(s)

[§ 120.3 Policy on designating or determining defense articles and services on the U.S. Munitions List.]  <HEAD>
§ 120.3 Policy on designating or determining defense articles and services on the U.S. Munitions List.

[§ 120.3 Policy on designating or determining defense articles and services on the U.S. Munitions List.]  <P>
(a) For purposes of this subchapter, a specific article or service may be designated a defense article (see § 120.31) or defense service (see § 120.32) if it:

[Note 2 to § 120.3:]  <HED>
Note 2 to § 120.3:

[§ 120.12 Commodity jurisdiction determination requests.]  <P>
(a) Upon electronic submission of a Commodity Jurisdiction Determination Form (Form DS-4076), the Directorate of Defense Trade Controls (DDTC) shall provide a determination of whether a particular article or service is covered by the U.S. Munitions List in part 121 of this subchapter. The determination, consistent with §§ 120.2, 120.3, and 120.4, entails consultation among the Departments of State, Defense, Commerce, and other U.S. Government agencies and industry in appropriate cases. State, Defense, and Commerce will resolve commodity jurisdiction determination disputes in accordance with established procedures. State shall notify Defense and Commerce, and other U.S. Government agencies as appropriate, of the initiation and conclusion of each case.

[§ 120.30 Directorate of Defense Trade Controls.]  <HEAD>
§ 120.30 Directorate of Defense Trade Controls.

[§ 120.31 Defense article.]  <HEAD>
§ 120.31 Defense article.

[§ 120.31 Defense article.]  <P>
(c) The policy described in § 120.3 is applicable to designations of additional items.

[§ 120.32 Defense service.]  <HEAD>
§ 120.32 Defense service.

[§ 120.33 Technical data.]  <HEAD>
§ 120.33 Technical data.

[§ 120.33 Technical data.]  <P>
(b) The definition in paragraph (a) of this section does not include information concerning general scientific, mathematical, or engineering principles commonly taught in schools, colleges, and universities, or information in the public domain as defined in § 120.34 or telemetry data as defined in note 3 to Category XV(f) of § 121.1 of this subchapter. It also does not include basic marketing information on function or purpose or general system descriptions of defense articles.

[§ 120.34 Public domain.]  <HEAD>
§ 120.34 Public domain.

[§ 120.35 [Reserved]]  <HEAD>
§ 120.35 [Reserved]

[§ 120.36 Significant military equipment.]  <HEAD>
§ 120.36 Significant military equipment.

[§ 120.37 Major defense equipment.]  <HEAD>
§ 120.37 Major defense equipment.

[§ 120.38 Classified.]  <HEAD>
§ 120.38 Classified.

[§ 120.39 Foreign defense article or defense service.]  <HEAD>
§ 120.39 Foreign defense article or defense service.

=== 120.3: 16 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The § 120.3 <P> block beginning “(a) For purposes of this subchapter” looks operative because it states the section's substantive designation criteria.

### 122.5

Entry id: `122.5`

Source file(s) searched: `ecfr/title-22-part-122-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-22-part-122-2026-09-01.xml  (ecfr_date 2026-09-01)  — 1 block(s)

[§ 122.5 Maintenance of records by registrants.]  <HEAD>
§ 122.5 Maintenance of records by registrants.

=== 122.5: 1 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 122.5 Maintenance of records by registrants.] <HEAD> block is the operative locator because it exactly matches the requested section number and title, although the printer returned no body paragraph.

### 772.1

Entry id: `772.1`

Source file(s) searched: `ecfr/title-15-part-734-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-738-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-738-appendix-suppl1-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-740-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-742-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-744-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-120-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-122-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-734-2026-09-01.xml  (ecfr_date 2026-09-01)  — 4 block(s)

[Note to paragraph (b)(3):]  <P>
Except as set forth in part 760 of this title, information that is not within the scope of the definition of “technology” (see § 772.1 of the EAR) is not subject to the EAR.

[§ 734.4 De minimis U.S. content.]  <P>
(3) There is no de minimis level for equipment meeting the parameters in ECCN 3B993.f.1 of the Commerce Control List in supplement no. 1 to part 774 of the EAR, when the equipment is destined for use in the “development” or “production” of “advanced-node integrated circuits” and the “advanced-node integrated circuits” meet the parameter specified in paragraph (1) of that definition in § 772.1 of the EAR, unless the country from which the foreign-made item was first exported 1 has this commodity specified on an export control list.

[§ 734.20 Activities that are not deemed reexports.]  <P>
(2) The foreign person is a bona fide 'permanent and regular employee' of the entity and is not a proscribed person (see § 772.1 for definition of proscribed person);

[§ 734.20 Activities that are not deemed reexports.]  <P>
(2) The foreign person is a bona fide 'permanent and regular employee' of the entity and is not a proscribed person (see § 772.1 for definition of proscribed person);

### title-15-part-740-2026-09-01.xml  (ecfr_date 2026-09-01)  — 6 block(s)

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(i) Being made to Australia, India, Japan, New Zealand, or a NATO (North Atlantic Treaty Organization) member state (see NATO membership listing in § 772.1 of the EAR):

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(15) If they are sold under a contract that includes $14,000,000 or more of “600 Series Major Defense Equipment” (as defined in § 772.1), exports of “600 series” items to a country not listed in Country Group A:5 (see supplement no. 1 to part 740 of the EAR), are not eligible for any license exception except to U.S. Government end users under License Exception GOV (§ 740.11(b) of the EAR).

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(16) If they are sold under a contract that includes $25,000,000 or more of “600 Series Major Defense Equipment” (as defined in § 772.1), exports of “600 series” items to a country listed in Country Group A:5 (see supplement no. 1 to part 740 of the EAR), are not eligible for any license exception except to U.S. Government end users under License Exception GOV (§ 740.11(b) of the EAR).

[§ 740.10 License Exception Servicing and replacement of parts and equipment (RPL).]  <P>
(iv) No replacement parts, components, accessories, or attachments may be exported to countries in Country Group E:1 (see supplement no. 1 to this part) (countries designated by the Secretary of State as supporting acts of international terrorism) if the commodity to be repaired is an “aircraft” (as defined in § 772.1 of the EAR) or is controlled for national security (NS) reasons.

[§ 740.20 License Exception Strategic Trade Authorization (STA).]  <P>
(iii) For purposes of determining reexport or transfer eligibility under this section, the consignee may rely on the ECCN provided to it by the party required to furnish the ECCN under paragraph (d)(1)(i) or (ii) of this section unless the consignee knows that the ECCN is incorrect or has changed. The word “knows” has the same meaning as the term “knowledge” in § 772.1 of the EAR.

[§ 740.23 Medical Devices (MED).]  <P>
(a) Scope. License Exception MED authorizes the export, reexport, or transfer (in country) of “medical devices” designated as EAR99 to or within Russia, Belarus, the temporarily occupied Crimea region of Ukraine, or the covered regions of Ukraine (as specified in § 746.6(a)(2) of the EAR). See Supplement no. 3 to part 774—Statements of Understanding under paragraph (a) (Statement of Understanding—medical equipment) for guidance on classifying medical equipment and the definition of “medical device” in § 772.1 of the EAR. License Exception MED also authorizes the export, reexport, or transfer (in country) to or within Russia, Belarus, the temporarily occupied Crimea region of Ukraine, or the covered regions of Ukraine of “parts,” “components,” “accessories,” and “attachments” designated as EAR99 that are exclusively for use in or with “medical devices” designated as EAR99. This license exception authorizes transactions involving items designated as EAR99 that would otherwise require a license pursuant to § 746.6 or paragraphs (a)(5) through (8) of § 746.8 of the EAR, subject to the terms and conditions described in this section. For “parts,” “components,” “accessories,” and “attachments” authorized under License Exception MED, such replacement “parts,” “components,” “accessories,” and “attachments” may only be exported, reexported, or transferred (in-country) if they also meet the additional requirements under paragraphs (a)(1) and (2) of this section:

### title-15-part-742-2026-09-01.xml  (ecfr_date 2026-09-01)  — 1 block(s)

[§ 742.15 Encryption items.]  <P>
(a) Licensing requirements and policy—(1) Licensing requirements. A license is required to export or reexport encryption items (“EI”) classified under ECCN 5A002, 5A004, 5D002.a, .c.1 or .d (for equipment and “software” in ECCNs 5A002 or 5A004, 5D002.c.1); or 5E002 for “technology” for the “development,” “production,” or “use” of commodities or “software” controlled for EI reasons in ECCNs 5A002, 5A004 or 5D002, and “technology” classified under 5E002.b to all destinations, except Canada. Refer to part 740 of the EAR, for license exceptions that apply to certain encryption items, and to § 772.1 of the EAR for definitions of encryption items and terms. Most encryption items may be exported under the provisions of License Exception ENC set forth in § 740.17 of the EAR. Following classification or self-classification, items that meet the criteria of Note 3 to Category 5—Part 2 of the Commerce Control List (the “mass market” note), are classified under ECCN 5A992 or 5D992 and are no longer subject to this Section (see § 740.17 of the EAR). Before submitting a license application, please review License Exception ENC to determine whether this license exception is available for your item or transaction. For exports, reexports, or transfers (in-country) of encryption items that are not eligible for a license exception, you must submit an application to obtain authorization under a license or an Encryption Licensing Arrangement.

### title-15-part-744-2026-09-01.xml  (ecfr_date 2026-09-01)  — 5 block(s)

[§ 744.6 Restrictions on specific activities of “U.S. persons.”]  <P>
(4) Exclusion to paragraphs (c)(2)(i) through (iii) of this section. (i) Paragraphs (c)(2)(i) through (iii) do not apply to a natural “U.S. person,” as defined in paragraphs (a)(1) and (3) of the definition in § 772.1 of the EAR, employed or working on behalf of a company headquartered in the United States or a destination specified in Country Group A:5 or A:6 and not majority-owned by an entity that is headquartered in either Macau or a destination specified in Country Group D:5.

[§ 744.6 Restrictions on specific activities of “U.S. persons.”]  <P>
(ii) Any activities a natural “U.S. person,” as defined in paragraphs (a)(1) and (3) of that term's definition in § 772.1 of the EAR, undertakes when employed or acting on behalf of a company not headquartered in the United States or a destination specified in Country Group A:5 or A:6 must comply with the requirements in this paragraph (d)(4) as applicable. For example, if a natural “U.S. person” is a freelancer who works or acts on behalf of a company headquartered in the United States or a destination specified in Country Group A:5 or A:6, those activities would not be prohibited under paragraphs (c)(2)(i) through (iii) of this section. However, if that same natural “U.S. person” was also working or acting on behalf of a company headquartered somewhere other than the United States or a destination specified in Country Group A:5 or A:6, the activities performed on behalf of such a company would not be excluded under paragraphs (c)(2)(i) through (iii) and a license would be required.

[§ 744.11 License requirements that apply to entities acting or at significant risk of acting contrary to the national security or foreign policy interests of the United States.]  <P>
(b) Criteria for revising the Entity List. Entities for which there is reasonable cause to believe, based on specific and articulable facts, that the entity or party to the transaction that is operating at an address that presents a high diversion risk has been involved, is involved, or poses a significant risk of being or becoming involved in activities that are contrary to the national security or foreign policy interests of the United States and those acting on behalf of such entities or conducting operations at an address that presents a high diversion risk may be added to the Entity List pursuant to this section. An entity or address that presents a high diversion risk may pose a significant risk through certain circumstances that may be outside of its own control or in the case of addresses with high diversion risk, outside the control of certain parties to the transaction operating at such address that presents a high diversion risk. Such circumstances that may place an entity or address that presents a high diversion risk include situations involving a sustained lack of cooperation by a host government authority, for example, by preventing an end-use check from being conducted, that effectively prevents BIS from determining compliance with the EAR. This section may not be used to place any U.S. person, as defined in § 772.1 of the EAR, on the Entity List. Paragraphs (b)(1) through (5) of this section provide an illustrative list of activities that could be or represent a significant risk of being contrary to the national security or foreign policy interests of the United States, including the foreign policy interest of the protection of human rights throughout the world.

[§ 744.21 Restrictions on certain 'military end uses' or 'military end users'.]  <P>
(1) Any item subject to the EAR listed in supplement no. 2 to this part without a license if, at the time of the export, reexport, or transfer (in-country), you have “knowledge,” as defined in § 772.1 of the EAR, that the item is intended, entirely or in part, for a 'military end use,' as defined in paragraph (f) of this section, in Burma, Cambodia, the People's Republic of China (China), Nicaragua, or Venezuela, or a Burmese, Cambodian, Chinese, Nicaraguan, or Venezuelan 'military end user,' as defined in paragraph (g) of this section, wherever located. 'Military end users' located outside of Burma, Cambodia, China, Nicaragua, or Venezuela are limited to entities identified on the 'Military End-User' (MEU) List under supplement no. 7 to this part.

[§ 744.21 Restrictions on certain 'military end uses' or 'military end users'.]  <P>
(2) Any item subject to the EAR without a license if, at the time of the export, reexport, or transfer (in-country), you have “knowledge,” as defined in § 772.1 of the EAR that the item is intended, entirely or in part, for a 'military end use,' as defined in paragraph (f) of this section, in Belarus or Russia, or a Belarusian or Russian 'military end user,' as defined in paragraph (g) of this section, wherever located. Belarusian or Russian 'military end users' located outside of Belarus or Russia are limited to entities identified on the Entity List under supplement no. 4 to this part with a footnote 3 designation and a reference to this section.

### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 6 block(s)

[Note 2 to paragraph i:]  <I>
For purpose of the application of “specially designed” for the riflescopes controlled under 0A504.i, paragraph (a)(1) of the definition of “specially designed” in § 772.1 of the EAR is what is used to determine whether the riflescope is “specially designed.”

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Definitions: See Section 772.1 of the EAR for the definitions of “software,” “program,” and “microprogram.”

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Definitions: (1) For the purposes of this entry, the term “dedicated” means committed entirely to a single purpose or device. (2) See Section 772.1 of the EAR for the definitions of “software,” “program,” and “microprogram.”

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Definitions: See Section 772.1 of the EAR for the definitions of “software,” “program,” and “microprogram.”

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Controls: Spacecraft, launch vehicles and related articles that are described on the USML, and technical data (including “software”) directly related thereto, and all services (including training) directly related to the integration of any satellite or spacecraft to a launch vehicle, including both planning and onsite support, or furnishing any assistance (including training) in the launch failure analysis or investigation for items in ECCN 9A515.a, are “subject to the ITAR.” All other “spacecraft,” as enumerated below and defined in § 772.1, are subject to the controls of this ECCN. See also ECCNs 3A001, 3A002, 3A991, 3A992, 6A002, 6A004, 6A008, and 6A998 for specific “space-qualified” items, 7A004 and 7A104 for star trackers, and 9A004 for the International Space Station (ISS), the James Webb Space Telescope (JWST), and “specially designed” “parts” and “components” therefor. See USML Category XI(c) for controls on certain “Monolithic Microwave Integrated Circuit” (“MMIC”) amplifiers. See ECCN 9A610.g for pressure suits used for high altitude aircraft.

[Supplement No. 4 to Part 774—Commerce Control List Order of Review]  <P>
(i) Step 4.a. Determine whether the item would meet the criteria of either paragraphs (a)(1) or (a)(2) of the “specially designed” definition in § 772.1 of the EAR. (These are informally known as the “catch” paragraphs.) If not applicable, then the item is not within the scope of the ECCN paragraph that contains a “specially designed” control parameter. Skip to Step 5.

### title-22-part-121-2026-09-01.xml  (ecfr_date 2026-09-01)  — 1 block(s)

[Note 4 to paragraph (e):]  <P>
(1) A determination that a specific article (or commodity) (e.g., by product serial number) is space-qualified by virtue of testing alone does not mean that other articles in the same production run or model series are space-qualified if not individually tested. (2) “Article” is synonymous with “commodity,” as defined in EAR § 772.1. (3) A specific article not designed or manufactured for use at altitudes greater than 100 km above the surface of the Earth is not space-qualified before it is successfully tested. (4) The terms “designed” and “manufactured” in this definition are synonymous with “specially designed.”

=== 772.1: 23 block(s) across 10 file(s) ===
```

SUGGESTION (unverified): No returned block looks like operative § 772.1 definition text; the part-774 <FP-1> block beginning “Related Definitions: See Section 772.1” is the closest locator because it points to the unfetched definitions part.

### 734.4

Entry id: `734.4`

Source file(s) searched: `ecfr/title-15-part-734-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-734-2026-09-01.xml  (ecfr_date 2026-09-01)  — 9 block(s)

[§ 734.3 Items subject to the EAR.]  <P>
(i) In any quantity, as described in § 734.4(a) of this part; or

[§ 734.3 Items subject to the EAR.]  <P>
(ii) In quantities exceeding the de minimis levels, as described in § 734.4(c) or § 734.4(d) of this part;

[§ 734.4 De minimis U.S. content.]  <HEAD>
§ 734.4 De minimis U.S. content.

[Editorial Note:]  <PSPACE>
For Federal Register citations affecting § 734.4, see the List of CFR Sections Affected, which appears in the Finding Aids section of the printed volume and at www.govinfo.gov.

[Supplement No. 2 to Part 734—Guidelines for De Minimis Rules]  <P>
(a) Calculation of the value of controlled U.S.-origin content in foreign-made items is to be performed for the purposes of § 734.4 of this part, to determine whether the percentage of U.S.-origin content is de minimis. (Note that you do not need to make these calculations if the foreign made item does not require a license to the destination in question.) Use the following guidelines to perform such calculations:

[Note to paragraph (a)(1):]  <P>
U.S.-origin controlled content is considered ‘incorporated’ for de minimis purposes if the U.S.-origin controlled item is: Essential to the functioning of the foreign equipment; customarily included in sales of the foreign equipment; and reexported with the foreign produced item. U.S.-origin software may be ‘bundled’ with foreign produced commodities; see § 734.4 of this part. For purposes of determining de minimis levels, technology and source code used to design or produce foreign-made commodities or software are not considered to be incorporated into such foreign-made commodities or software.

[Supplement No. 2 to Part 734—Guidelines for De Minimis Rules]  <P>
(4) Calculating percentage value of U.S.-origin items. To determine the percentage value of U.S-origin controlled content incorporated in, commingled with, or “bundled” with the foreign produced item, divide the total value of the U.S.-origin controlled content by the foreign-made item value, then multiply the resulting number times 100. If the percentage value of incorporated U.S.-origin items is equal to or less than the de minimis level described in § 734.4 of the EAR, then the foreign-made item is not subject to the EAR.

[Supplement No. 2 to Part 734—Guidelines for De Minimis Rules]  <P>
(b) One-time report. As stated in paragraphs (c) and (d) of § 734.4, a one-time report is required before reliance on the de minimis rules for technology. The purpose of the report is solely to permit the U.S. Government to evaluate whether U.S. content calculations were performed correctly.

[Supplement No. 2 to Part 734—Guidelines for De Minimis Rules]  <P>
(3) Report and wait. If you have not been contacted by BIS concerning your report within thirty days after filing the report with BIS, you may rely upon the calculations described in the report unless and until BIS contacts you and instructs you otherwise. BIS may contact you with questions concerning your report or to indicate that BIS does not accept the assumptions or rationale for your calculations. If you receive such a contact or communication from BIS within thirty days after filing the report with BIS, you may not rely upon the calculations described in the report, and may not use the de minimis rules for technology that are described in § 734.4 of this part, until BIS has indicated that such calculations were performed correctly.

=== 734.4: 9 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 734.4 De minimis U.S. content.] <HEAD> block is the operative locator because it exactly matches the requested section number and title, although the printer returned no body paragraph.

### 740.20

Entry id: `740.20`

Source file(s) searched: `ecfr/title-15-part-740-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-740-2026-09-01.xml  (ecfr_date 2026-09-01)  — 13 block(s)

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(iv) Authorized by § 740.20 of the EAR (License Exception STA).

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(G) License Exception STA (§ 740.20(c)(1)(ii) of the EAR).

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(13) “600 series” items that are controlled for missile technology (MT) reasons may not be exported, reexported, or transferred (in-country) under License Exception STA (§ 740.20), except ECCN 9A610.a. Items controlled under ECCNs 9D610.b, 9D619.b, 9E610.b, or 9E619.b or .c are not eligible for license exceptions except for License Exception GOV (§ 740.11(b)(2)). Only the following license exceptions may be used to export “600 series” items to destinations other than those identified in Country Group D:5 or Hong Kong (see supplement no. 1 to this part):

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(vii) License Exception STA under § 740.20(c)(1) of the EAR, provided all of the applicable terms and conditions, including those specific to the “600 series” are met.

[§ 740.2 Restrictions on all License Exceptions.]  <P>
(18) 9x515 items that are controlled for missile technology (MT) reasons may not be exported, reexported, or transferred (in-country) under License Exception STA (§ 740.20 of the EAR).

[§ 740.11 Governments, international organizations, international inspections under the Chemical Weapons Convention, and the International Space Station (GOV).]  <P>
(vii) Items listed as not eligible for License Exception STA in § 740.20(b)(2)(ii) of the EAR; or

[§ 740.20 License Exception Strategic Trade Authorization (STA).]  <HEAD>
§ 740.20 License Exception Strategic Trade Authorization (STA).

[§ 740.20 License Exception Strategic Trade Authorization (STA).]  <P>
(iii) License Exception STA may not be used to export, reexport, or transfer (in-country) end items described in ECCN 0A606.a, ECCN 8A609.a, ECCN 8A620.a or .b, or ECCN 9A610.a until after BIS has approved their export under STA under the procedures set out in § 740.20(g).

[Note to paragraph (c)(1)(i).]  <P>
License Exception STA under § 740.20(c)(1)(i) may be used to authorize the export, reexport, or transfer (in-country) of “600 series” items only if the purchaser, intermediate consignee, ultimate consignee, and end user have previously been approved on a license or other approval, i.e., Directorate of Defense Trade Controls (DDTC) Manufacturing License Agreement (MLA), Technical Assistance Agreement (TAA), Warehouse Distribution Agreement (WDA), or General Correspondence approval (GC) issued by BIS or DDTC at the U.S. Department of State.

[§ 740.20 License Exception Strategic Trade Authorization (STA).]  <P>
(i) Is aware that [INSERT GENERAL DESCRIPTION AND APPLICABLE ECCN(S) OF ITEMS TO BE SHIPPED (e.g., aircraft parts and components classified under ECCN 9A610)] will be shipped pursuant to License Exception Strategic Trade Authorization (STA) in § 740.20 of the United States Export Administration Regulations (15 CFR 740.20);

[Editorial Note:]  <PSPACE>
For Federal Register citations affecting § 740.20, see the List of CFR Sections Affected, which appears in the Finding Aids section of the printed volume and at www.govinfo.gov.

[Supplement No. 1 to Part 740—Country Groups]  <TD>
5 Consistent with § 740.2(a)(26), License Exception STA (see § 740.20) is only available to approved entities in the UAE. See supplement no. 8 to part 740 for a list of approved entities in the UAE eligible for License Exception STA.

[Supplement No. 8 to Part 740—Approved Ultimate Consignees and End Users for Advanced Computing Items and/or License Exception STA in the UAE]  <P>
This supplement specifies the ultimate consignees and end users in the UAE that may, as specified, receive certain advanced computing items license-free consistent with § 742.6(a)(6)(iii)(A)-(B) or items under License Exception STA, provided that in the case of License Exception STA, the export, reexport, or transfer (in-country) is not otherwise restricted under any of the general restrictions under § 740.2 and meets all of the applicable terms and conditions of License Exception STA. See §§ 740.2(a)(26) and 740.20. Other parties to the transaction, i.e., purchaser or intermediate consignee, do not need to be specified in this supplement in order to be parties to transactions made under License Exception STA. Ultimate consignees and end users in the UAE that seek to become approved to receive advanced computing items license-free or for use of License Exception STA by being specified under this supplement, including U.S.-headquartered entities operating in the UAE, may submit a request for an advisory opinion to BIS consistent with the provisions of § 748.3(c). Within 30 days of receiving a request, the Secretary of Commerce, in consultation with the Secretary of State and the Assistant to the President for National Security Affairs, shall determine whether the entity should be approved for addition to this supplement and the scope of any such authorization (i.e., for the receipt of advanced computing items license-free, for use of License Exception STA, or both). Within 5 days of a determination, BIS will notify the entity requesting the advisory opinion of the determination and, if approved, initiate the process to add the requestor to the approved entities listed in this supplement no. 8 to part 740.

=== 740.20: 13 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 740.20 License Exception Strategic Trade Authorization (STA).] <HEAD> block is the operative locator because it exactly matches the requested section number and title.

### 744.9

Entry id: `744.9`

Source file(s) searched: `ecfr/title-15-part-744-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-744-2026-09-01.xml  (ecfr_date 2026-09-01)  — 3 block(s)

[§ 744.1 General provisions.]  <P>
(a)(1) Introduction. In this part, references to the EAR are references to 15 CFR chapter VII, subchapter C. This part contains prohibitions against exports, reexports, and selected transfers to certain end users and end uses as introduced under General Prohibitions Five (End use/End users) and Nine (Orders, Terms, and Conditions), unless authorized by BIS. Sections 744.2, 744.3, and 744.4 prohibit exports, reexports, and transfers (in-country) of items subject to the EAR to defined nuclear, missile, and chemical and biological weapons proliferation activities. Section 744.5 prohibits exports, reexports, and transfers (in-country) of items subject to the EAR to defined nuclear maritime end-uses. Consistent with General Prohibition Seven (Support of Proliferation Activities and certain Military-Intelligence End Uses and End Users (“U.S. person” activities)), § 744.6 prohibits specific activities by U.S. persons in support of certain nuclear, missile, chemical and biological weapons end uses, and whole plants for chemical weapons precursors, as well as certain military-intelligence end uses and military-intelligence end users. Section 744.7 prohibits exports, reexports, and transfers (in-country) of certain items for certain aircraft and vessels. Section 744.8 prohibits exports, reexports, and transfers (in-country) without authorization when a person designated on the list of Specially Designated Nationals and Blocked Persons (SDN List) pursuant to certain specified sanctions programs is a party to the transaction. Section 744.9 sets forth restrictions on exports, reexports, and transfers (in-country) of certain cameras, systems, or related components. Section 744.11 imposes license requirements, to the extent specified in supplement no. 4 to this part, on entities listed in supplement no. 4 to this part for activities contrary to the national security or foreign policy interests of the United States. Section 744.15 sets forth the conditions for exports, reexports, and transfers (in-country) to persons listed on the Unverified List (UVL) in supplement no. 6 to this part, the criteria for revising the UVL, as well as procedures for requesting removal or modification of a listing on the UVL. Section 744.16 sets forth the license requirements, policies and procedures for the Entity List. Section 744.17 sets forth restrictions on exports, reexports, and transfers (in-country) of microprocessors and associated “software” and “technology” for military end uses and to military end users. Section 744.19 sets forth BIS's licensing policy for applications for export, reexport, and transfer (in-country) when a party to the transaction is an entity that has been sanctioned pursuant to any of three specified statutes that require certain license applications to be denied. In addition, these sections include license review standards for export, reexport, and in-country transfer license applications submitted as required by these sections. It should also be noted that part 764 of the EAR prohibits exports, reexports, and certain transfers of items subject to the EAR to denied parties. Section 744.21 imposes restrictions for exports, reexports, and transfers (in-country) of item subject to the EAR listed in supplement no. 2 to this part for a military end use or military end user in Burma, Cambodia, the People's Republic of China (PRC or China), Nicaragua, or Venezuela and for a Burmese, Cambodian, Chinese, Nicaraguan, or Venezuelan military end user if identified in supplement no. 7 to this part. Section 744.21 also imposes restrictions for exports, reexports, and transfers (in-country) for all items subject to the EAR for a military end use or military end user in Belarus or Russia and for a Belarusian or Russian military end user wherever located if identified on supplement no. 4 to this part. Section 744.22 imposes restrictions on exports, reexports, and transfers (in-country) for a military-intelligence end use or military-intelligence end user in Burma, China, Russia, or Venezuela; or for a country listed in Country Groups E:1 or E:2 (see supplement no. 1 to part 740 of the EAR). Section 744.23 sets forth restrictions on exports, reexports, and transfers (in-country) for certain “supercomputer” and semiconductor manufacturing end use.

[§ 744.1 General provisions.]  <P>
(2) Determine applicability. Second, determine whether any of the end-use and end-user prohibitions described in this part are applicable to your planned export, reexport, shipment, transmission, transfer (in-country) or other activity. See supplement no. 1 to part 732 for guidance. For exports, reexports, shipments, transmissions, or transfers (in-country) that are in transit at the time you are informed by BIS that a license is required in accordance with §§ 744.2(b), 744.3(b), 744.4(b), 744.6(c), 744.9(b), 744.11(c), 744.17(b), 744.21(b), or 744.22(b) of the EAR, you may not proceed any further with the transaction unless you first obtain a license from BIS (see part 748 of the EAR for instructions on how to apply for a license). The provisions of § 748.4(d)(2) of the EAR shall not apply to license applications submitted pursuant to a notification from BIS that occurs while an export, reexport, or transfer (in-country) is in transit.

[§ 744.9 Restrictions on exports, reexports, and transfers (in-country) of certain cameras, systems, or related components.]  <HEAD>
§ 744.9 Restrictions on exports, reexports, and transfers (in-country) of certain cameras, systems, or related components.

=== 744.9: 3 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 744.9 Restrictions on exports, reexports, and transfers (in-country) of certain cameras, systems, or related components.] <HEAD> block is the operative locator because it exactly matches the requested section number and title.

### 744.21

Entry id: `744.21`

Source file(s) searched: `ecfr/title-15-part-744-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-744-2026-09-01.xml  (ecfr_date 2026-09-01)  — 1212 block(s)

[§ 744.1 General provisions.]  <P>
(a)(1) Introduction. In this part, references to the EAR are references to 15 CFR chapter VII, subchapter C. This part contains prohibitions against exports, reexports, and selected transfers to certain end users and end uses as introduced under General Prohibitions Five (End use/End users) and Nine (Orders, Terms, and Conditions), unless authorized by BIS. Sections 744.2, 744.3, and 744.4 prohibit exports, reexports, and transfers (in-country) of items subject to the EAR to defined nuclear, missile, and chemical and biological weapons proliferation activities. Section 744.5 prohibits exports, reexports, and transfers (in-country) of items subject to the EAR to defined nuclear maritime end-uses. Consistent with General Prohibition Seven (Support of Proliferation Activities and certain Military-Intelligence End Uses and End Users (“U.S. person” activities)), § 744.6 prohibits specific activities by U.S. persons in support of certain nuclear, missile, chemical and biological weapons end uses, and whole plants for chemical weapons precursors, as well as certain military-intelligence end uses and military-intelligence end users. Section 744.7 prohibits exports, reexports, and transfers (in-country) of certain items for certain aircraft and vessels. Section 744.8 prohibits exports, reexports, and transfers (in-country) without authorization when a person designated on the list of Specially Designated Nationals and Blocked Persons (SDN List) pursuant to certain specified sanctions programs is a party to the transaction. Section 744.9 sets forth restrictions on exports, reexports, and transfers (in-country) of certain cameras, systems, or related components. Section 744.11 imposes license requirements, to the extent specified in supplement no. 4 to this part, on entities listed in supplement no. 4 to this part for activities contrary to the national security or foreign policy interests of the United States. Section 744.15 sets forth the conditions for exports, reexports, and transfers (in-country) to persons listed on the Unverified List (UVL) in supplement no. 6 to this part, the criteria for revising the UVL, as well as procedures for requesting removal or modification of a listing on the UVL. Section 744.16 sets forth the license requirements, policies and procedures for the Entity List. Section 744.17 sets forth restrictions on exports, reexports, and transfers (in-country) of microprocessors and associated “software” and “technology” for military end uses and to military end users. Section 744.19 sets forth BIS's licensing policy for applications for export, reexport, and transfer (in-country) when a party to the transaction is an entity that has been sanctioned pursuant to any of three specified statutes that require certain license applications to be denied. In addition, these sections include license review standards for export, reexport, and in-country transfer license applications submitted as required by these sections. It should also be noted that part 764 of the EAR prohibits exports, reexports, and certain transfers of items subject to the EAR to denied parties. Section 744.21 imposes restrictions for exports, reexports, and transfers (in-country) of item subject to the EAR listed in supplement no. 2 to this part for a military end use or military end user in Burma, Cambodia, the People's Republic of China (PRC or China), Nicaragua, or Venezuela and for a Burmese, Cambodian, Chinese, Nicaraguan, or Venezuelan military end user if identified in supplement no. 7 to this part. Section 744.21 also imposes restrictions for exports, reexports, and transfers (in-country) for all items subject to the EAR for a military end use or military end user in Belarus or Russia and for a Belarusian or Russian military end user wherever located if identified on supplement no. 4 to this part. Section 744.22 imposes restrictions on exports, reexports, and transfers (in-country) for a military-intelligence end use or military-intelligence end user in Burma, China, Russia, or Venezuela; or for a country listed in Country Groups E:1 or E:2 (see supplement no. 1 to part 740 of the EAR). Section 744.23 sets forth restrictions on exports, reexports, and transfers (in-country) for certain “supercomputer” and semiconductor manufacturing end use.

[§ 744.1 General provisions.]  <P>
(2) Determine applicability. Second, determine whether any of the end-use and end-user prohibitions described in this part are applicable to your planned export, reexport, shipment, transmission, transfer (in-country) or other activity. See supplement no. 1 to part 732 for guidance. For exports, reexports, shipments, transmissions, or transfers (in-country) that are in transit at the time you are informed by BIS that a license is required in accordance with §§ 744.2(b), 744.3(b), 744.4(b), 744.6(c), 744.9(b), 744.11(c), 744.17(b), 744.21(b), or 744.22(b) of the EAR, you may not proceed any further with the transaction unless you first obtain a license from BIS (see part 748 of the EAR for instructions on how to apply for a license). The provisions of § 748.4(d)(2) of the EAR shall not apply to license applications submitted pursuant to a notification from BIS that occurs while an export, reexport, or transfer (in-country) is in transit.

[§ 744.21 Restrictions on certain 'military end uses' or 'military end users'.]  <HEAD>
§ 744.21 Restrictions on certain 'military end uses' or 'military end users'.

[Effective Date Note:]  <PSPACE>
At 90 FR 50857, Nov. 12, 2025, in § 744.21, paragraph (a)(3), the introductory text of paragraph (b)(2), and the last sentence in paragraph (d) were stayed, effective until Nov. 9, 2026.

[§ 744.22 Restrictions on exports, reexports, and transfers (in-country) to certain military-intelligence end uses or end users.]  <P>
(2) 'Military-intelligence end user' means any intelligence or reconnaissance organization of the armed services (army, navy, marine, air force, or coast guard); or national guard. For license requirements applicable to other government intelligence or reconnaissance organizations of these countries, see § 744.21. 'Military-intelligence end users' subject to the license requirements set forth in this section located in Belarus, Burma, Cambodia, China, Russia, or Venezuela; or a country listed in Country Groups E:1 or E:2 (see supplement no. 1 to part 740 of the EAR) include, but are not limited to, the 'military-intelligence end users' identified in this paragraph (f)(2). For 'military-intelligence end users' located in all other countries this paragraph (f)(2) is an exhaustive listing.

[Supplement No. 2 to Part 744—List of Items Subject to the Military End Use or End User License Requirement of § 744.21]  <HEAD>
Supplement No. 2 to Part 744—List of Items Subject to the Military End Use or End User License Requirement of § 744.21

[Supplement No. 2 to Part 744—List of Items Subject to the Military End Use or End User License Requirement of § 744.21]  <P>
The following items, as described, are subject to the military end use or end user license requirement in § 744.21.

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR). This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 744.8(b), 744.11, 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e).

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e).

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 744.8(b), 744.11, 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 744.8(b), 744.11, 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3). of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3). of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR, apart from items that are related to transactions that are authorized by the Department of the Treasury's Office of Foreign Assets Control pursuant to General License No. 1B of March 2, 2021. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR). This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR). This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3). of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR). The license requirements under this entry also extend to any export, reexport and transfer (in-country) to the entity wherever located worldwide

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR). The license requirements under this entry also extend to any export, reexport and transfer (in-country) to the entity wherever located worldwide

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR) This license requirement may be overcome by License Exception GOV under § 740.11(b)(2) and (e).

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99 and for items for U.S. Government supported use in the International Space Station (ISS), which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b) and 746.8(a)(3). Of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
All items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 744.21(b), and 746.8(a)(3) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
For all items subject to the EAR. (See §§ 734.9(g),3 746.8(a)(3), and 744.21(b) of the EAR)

[Supplement No. 4 to Part 744—Entity List]  <TD>
Policy of Denial for all items subject to the EAR apart from food and medicine designated as EAR99, which will be reviewed on a case-by-case basis. See §§ 746.8(b) and 744.21(e)

[Supplement No. 4 to Part 744—Entity List]  <TD>
3 For this entity, “items subject to the EAR” includes foreign-produced items that are subject to the EAR under § 734.9(g) of the EAR. See §§ 744.11, 744.21, and 746.8 of the EAR for related license requirements, license review policy, and restrictions on license exceptions.

[Supplement No. 5 to Part 744—Procedures for End-User Review Committee Entity List and 'Military End User' (MEU) List Decisions]  <P>
When determining to add an entry or modify an existing entry, to the Entity List or MEU List, the ERC will also specify the section or sections of the EAR that provide the basis for that determination. All additions and modifications to the MEU List are done pursuant to § 744.21(b). The license requirements, the license application review policy, or the availability of license exceptions for entities or address entries on the MEU List are specified in § 744.21 under paragraphs (b) to (e). In addition, for the Entity List, if the section or sections that form the basis for an addition or modification do not specify the license requirements, the license application review policy, or the availability of license exceptions, the ERC will specify the license requirements, the license application review policy and which license exceptions (if any) will be available for shipments to that entry.

[Supplement No. 7 to Part 744—'Military End-User' (MEU) List]  <P>
The license requirement for entities listed in supplement no. 7 to part 744 applies to the export, reexport, or transfer (in-country) of any item subject to the EAR listed in supplement no. 2 to part 744. A license is required to export, reexport, or transfer (in-country) any item subject to the EAR listed in supplement no. 2 to part 744 when an entity that is listed on the MEU List is a party to the transaction as described in § 748.5(c) through (f). No license exceptions are available for exports, reexports, or transfers (in-country) to listed entities on the MEU List for items specified in supplement no. 2 to part 744, except license exceptions for items authorized under the provisions of License Exception GOV set forth in § 740.11(b)(2)(i) and (ii) of the EAR as specified in § 744.21(c). The MEU List license requirements and other MEU List restrictions also apply to any foreign entity that is owned, directly or indirectly, individually or in aggregate, 50 percent or more by one or more listed entities or entities that are subject to restrictions based upon their ownership. An entity owned 50 percent or more, directly or indirectly, by multiple entities subject to EAR license requirements pursuant to some combination of the Entity List, MEU List, or SDN List designated under programs listed in § 744.8(a)(1), is subject to the most restrictive license requirements, license exception eligibility, and license review policy applicable to one or more of its owners under the EAR. If an exporter, reexporter, or transferor cannot determine the ownership percentage of a foreign entity that is an entity owned, directly or indirectly, by one or more listed entities, they must resolve the Red Flag or obtain a license from BIS prior to proceeding with the export, reexport, or transfer (in-country) (see Red Flag 29 in supplement no. 3 to part 732). The license application procedure and license review policy for entities specified in this supplement 7 to part 744 is specified in § 744.21(d) and (e).

=== 744.21: 1212 block(s) across 1 file(s) ===
```

SUGGESTION (unverified): The [§ 744.21 Restrictions on certain 'military end uses' or 'military end users'.] <HEAD> block is the operative locator because it exactly matches the requested section number and title; the other returned blocks are principally cross-references.

### 770.2

Entry id: `770.2`

Source file(s) searched: `ecfr/title-15-part-734-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-738-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-738-appendix-suppl1-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-740-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-742-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-744-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-15-part-774-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-120-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-121-2026-09-01.xml` (ecfr_date 2026-09-01); `ecfr/title-22-part-122-2026-09-01.xml` (ecfr_date 2026-09-01)

Printer output (verbatim, unedited):

```text
### title-15-part-774-2026-09-01.xml  (ecfr_date 2026-09-01)  — 2 block(s)

[Supplement No. 1 to Part 774—The Commerce Control List]  <FP-1>
Related Definitions: See § 770.2(k) of the EAR for synonyms for the chemicals listed in this entry.

[Notes to paragraph (a):]  <P>
(4) See also § 770.2(b) interpretation 2, for other types of equipment that incorporate items on the Commerce Control List that are subject to the EAR.

=== 770.2: 2 block(s) across 10 file(s) ===
```

SUGGESTION (unverified): No returned block looks like operative § 770.2 interpretation text; the part-774 <P> block beginning “(4) See also § 770.2(b) interpretation 2” is the closest locator because it points to the unfetched interpretations part.

## Report

| Entry id | Block count | File(s) |
|---|---:|---|
| `9A012.a` | 1 regenerated raw-span candidate | `title-15-part-774-2026-09-01.xml` |
| `9A012.a.1` | 1 regenerated raw-span candidate | `title-15-part-774-2026-09-01.xml` |
| `9A012.a.2` | 1 regenerated raw-span candidate | `title-15-part-774-2026-09-01.xml` |
| `9A012.a.3` | 1 regenerated raw-span candidate | `title-15-part-774-2026-09-01.xml` |
| `9A012.a.5` | 1 regenerated raw-span candidate | `title-15-part-774-2026-09-01.xml` (outside P0) |
| `6A003.b.4.b` | 9 | `title-15-part-774-2026-09-01.xml` |
| `6A993` | 4 | `title-15-part-774-2026-09-01.xml` |
| `7A105.b.1` | 0 | `title-15-part-774-2026-09-01.xml` (searched; no blocks) |
| `7A003` | 28 | `title-15-part-774-2026-09-01.xml` |
| `7A994` | 16 | `title-15-part-774-2026-09-01.xml` |
| `3A991.a.2` | 0 | `title-15-part-774-2026-09-01.xml` (searched; no blocks) |
| `3A611` | 38 | `title-15-part-774-2026-09-01.xml` |
| `5A992.c` | 3 | `title-15-part-774-2026-09-01.xml` |
| `5A002` | 72 | `title-15-part-774-2026-09-01.xml` |
| `9A610` | 58 | `title-15-part-774-2026-09-01.xml` |
| `9A991` | 13 | `title-15-part-774-2026-09-01.xml` |
| `XII(e)(12)` | 0 | `title-22-part-121-2026-09-01.xml` (searched; no blocks) |
| `VIII(a)(5)` | 0 | `title-22-part-121-2026-09-01.xml` (searched; no blocks) |
| `VIII(h)` | 3 | `title-22-part-121-2026-09-01.xml` |
| `XI` | 30 | `title-22-part-121-2026-09-01.xml` |
| `120.11` | 1 | `title-22-part-120-2026-09-01.xml` |
| `120.41` | 3 | `title-22-part-120-2026-09-01.xml` |
| `120.3` | 16 | `title-22-part-120-2026-09-01.xml` |
| `122.5` | 1 | `title-22-part-122-2026-09-01.xml` |
| `772.1` | 23 | `title-15-part-734-2026-09-01.xml`, `title-15-part-740-2026-09-01.xml`, `title-15-part-742-2026-09-01.xml`, `title-15-part-744-2026-09-01.xml`, `title-15-part-774-2026-09-01.xml`, `title-22-part-121-2026-09-01.xml` |
| `734.4` | 9 | `title-15-part-734-2026-09-01.xml` |
| `740.20` | 13 | `title-15-part-740-2026-09-01.xml` |
| `744.9` | 3 | `title-15-part-744-2026-09-01.xml` |
| `744.21` | 1212 | `title-15-part-744-2026-09-01.xml` |
| `770.2` | 2 | `title-15-part-774-2026-09-01.xml` |

### NOT FOUND entries

- `7A105.b.1` — searched `ecfr/title-15-part-774-2026-09-01.xml`
- `3A991.a.2` — searched `ecfr/title-15-part-774-2026-09-01.xml`
- `XII(e)(12)` — searched `ecfr/title-22-part-121-2026-09-01.xml`
- `VIII(a)(5)` — searched `ecfr/title-22-part-121-2026-09-01.xml`
