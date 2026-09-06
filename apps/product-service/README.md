# CADdyDaddy Candidate 0.1 product service

The bundle builder executes deterministic public-demo geometry once through the admitted local
`core-kernel`, then writes an immutable verified snapshot. The deployed Python service reads that
snapshot, serves the built workbench, and invokes the actual imported Tripwire evaluator through
`compliance-bridge` for an exact selected entity binding. It never imports or installs the native
geometry runtime.

```sh
uv sync --project packages/core-kernel --group dev --locked
npm --prefix apps/browser-workbench ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/browser-workbench run build
packages/core-kernel/.venv/bin/python apps/product-service/scripts/build_bundle.py --output /tmp/caddydaddy-candidate-0.1
cd /tmp/caddydaddy-candidate-0.1
PYTHONPATH=apps/product-service:packages/compliance-bridge python -m product_service --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`, select a face, and run the review-only compliance check in Properties.
Every accepted result remains `DRAFT_REVIEW_ONLY`, `INSUFFICIENT_EVIDENCE`,
`HUMAN_REVIEW_REQUIRED`, and `legal_effect: NONE`. The product-owned guardrail reports only which
review evidence fields are present or missing; it cannot clear or classify anything.

Build the allowlist-only Vercel deploy-source bundle and deterministic archive with:

```sh
packages/core-kernel/.venv/bin/python apps/product-service/scripts/build_bundle.py --output /tmp/caddydaddy-candidate-0.1
```

The output root contains `api/index.py`, the production browser build under `public/`, a Python 3.12
declaration, the exact non-native runtime dependency closure, the generated snapshot, fail-closed
`vercel.json` routing, required schemas, and notices only for distributed contents. The resolved
manifest binds the source commit/tree, build command, snapshot hash/provenance, and evaluator/rulepack
identity. Source policy, README, generator, native core source/lock/runtime, and native redistribution
notice are not admitted to the runtime artifact.

No provider link/state, credentials, governance/task records, private data, Tripwire CSL/PX4 data,
Kestrel/BOM datasets, internal fixtures, tests, docs/history, source policy/config inputs, caches, or
Git state is included.

## Explicit live-classification lane

Classification remains deterministic `ScriptedModel` unless `REAL_LLM_AUTHORIZED=true` exactly.
Live mode additionally requires `ANTHROPIC_API_KEY`, an `ANTHROPIC_MODEL` of
`claude-sonnet-5` or `claude-opus-5`, `CADDYDADDY_LIVE_LLM_ACCESS_TOKEN`, and positive bounded
`CADDYDADDY_LIVE_LLM_CALLS_CAP`, `CADDYDADDY_LIVE_LLM_COST_CAP_MICROUSD`, and
`CADDYDADDY_LIVE_LLM_ESTIMATED_CALL_COST_MICROUSD` values. Each live request must present the
configured token as `X-CADdyDaddy-Live-Token`. Client call and total-cost ceilings can only lower
the server caps; the per-call budget reservation is server-owned. Missing or invalid configuration
fails closed, and the sanitized build probe removes every live flag and secret before importing the
bundle. Configuration authorizes neither deployment nor spend by itself.
