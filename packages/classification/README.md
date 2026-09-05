# Strafe Forge — classification lane

A pure order-of-review engine over a dated reference pack. Give it a product description or a Forge part revision and a model client; it runs the whole order of review — USML first, then the CCL stage by stage, then the EAR99 residual — with a per-provision advocate and judge whose citations must resolve to bytes in the pack, and returns the jurisdictional determination. End to end, no human gate. No memo. No CJ or CCATS recommendation.

```python
from forge_classification import run
from forge_classification.model import CacheModel  # or LiveAnthropicModel, or your own ModelClient

out = run("Helmet-mounted night-vision monocular with a Gen 3 image intensifier tube.",
          CacheModel("fixtures/llm_cache"), facts={"spec.tube_generation": "3"})
out["determination"]["jurisdiction"]     # "ITAR" | "EAR" | "EAR99" | "UNDETERMINED"
out["determination"]["classification"]   # the provisions it rests on, e.g. ["USML XII(c)"]
out["candidates"]                        # the board: every provision walked, with status, elements and citations
```

Runtime: Python 3.12, standard library only. Dev: `pytest`, `jsonschema` (lane-local, pinned).

```bash
cd packages/classification
uv venv .venv -p 3.12 && uv sync --group dev
.venv/bin/pytest ../../tests/classification -q
.venv/bin/python scripts/build_manifest.py           # regenerate data/ecfr/manifest.json and print the pack hash
```

| Real | Not real, or not claimed |
|---|---|
| Reference pack parsed from committed eCFR XML: all 21 USML categories, 637 CCL entries, 22 CFR 120.41 (five releases) and the 15 CFR 772.1 "specially designed" definition (six releases), at paragraph grain, hashed | Any content-date claim for the part-121/part-774 exports (retrieved 2026-06-25; the two section files are at eCFR content date 2026-09-01) |
| The order-of-review route table, the reconciliation rules (a knockout needs a cited failed element; a model's silence is never a finding), the verifier's byte-match — all pinned by tests with scripted model outputs | Any live model run: no API key, no spend; the live adapter is untested by design |
| The determination contract as a frozen JSON Schema | Accuracy, coverage, legal validity, counsel review, or a legal determination of any kind |

`UNDETERMINED` is an outcome, not a gate: the run completes and returns; it means the USML step could not be closed on the facts given.
