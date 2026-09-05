# Strafe Forge — classification lane

A pure order-of-review engine over a dated reference pack. It reads one part revision's facts for one item (commodity, software, or technology), argues each candidate provision through a per-provision advocate and judge whose citations must resolve to bytes in the pack, and lets code decide the route, the claim class and the questions. The output is an envelope; it is a proposal on the product thread until a human adopts it.

Runtime: Python 3.12, standard library only. Dev: `pytest`, `jsonschema` (lane-local, pinned).

```bash
cd packages/classification
uv venv .venv -p 3.12 && uv sync --group dev
.venv/bin/pytest ../../tests/classification -q         # run from the repository root works too
.venv/bin/python scripts/build_manifest.py           # regenerate data/ecfr/manifest.json and print the pack hash
```

| Real | Not real, or not claimed |
|---|---|
| Reference pack parsed from committed eCFR XML: all 21 USML categories, 637 CCL entries, 22 CFR 120.41 (five releases) and the 15 CFR 772.1 "specially designed" definition (six releases), at paragraph grain, hashed | Any content-date claim for the part-121/part-774 exports (retrieved 2026-06-25; the two section files are at eCFR content date 2026-09-01) |
| Hashing that matches the repository's normative `forge.record/1` vector | Admission of the `compliance` authority domain or the lane into `governance/custody.v1.json` (proposed in `HANDOFF.md`) |
| The route table, reconciliation rules, claim-class cap, question ranking, thread refusals — all pinned by tests with scripted model outputs | Any live model run: no API key, no spend, the live adapter is untested by design |
| The envelope schema and the verifier's citation class | Accuracy, coverage, legal validity, counsel review, or a determination of any kind |

What this is not: a memo generator (Charlie, 2026-09-05), a CJ or CCATS, legal advice, or a clearance.
