# CADdyDaddy Candidate 0.1 product service

This local Python service executes deterministic public-demo geometry through `core-kernel`, projects
that admitted result into the browser `PartDocument`, serves the built workbench, and invokes the
imported Tripwire evaluator through `compliance-bridge` for an exact selected entity binding.

```sh
uv sync --project packages/core-kernel --group dev --locked
npm --prefix apps/browser-workbench ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/browser-workbench run build
PYTHONPATH=apps/product-service packages/core-kernel/.venv/bin/python -m product_service --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`, select a face, and run the review-only compliance check in Properties.
Every accepted result remains `DRAFT_REVIEW_ONLY`, `HUMAN_REVIEW_REQUIRED`, and `legal_effect: NONE`.

Build the allowlist-only Vercel deploy-source bundle and deterministic archive with:

```sh
packages/core-kernel/.venv/bin/python apps/product-service/scripts/build_bundle.py --output /tmp/caddydaddy-candidate-0.1
```

The output root contains `api/index.py`, the production browser build under `public/`, a Python 3.12
declaration, exact direct runtime dependency pins, fail-closed `vercel.json` routing, required schemas,
and third-party notices. Source policy, README, project metadata, and lockfile inputs are not admitted
to the runtime artifact. Launch the same handler locally from the bundle root with:

```sh
PYTHONPATH=apps/product-service python -m product_service --host 127.0.0.1 --port 4173
```

No provider link/state, credentials, governance/task records, private data, Tripwire CSL/PX4 data,
Kestrel/BOM datasets, internal fixtures, tests, docs/history, source policy/config inputs, caches, or
Git state is included.
