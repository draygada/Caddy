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

Build an allowlist-only bundle with:

```sh
packages/core-kernel/.venv/bin/python apps/product-service/scripts/build_bundle.py --output /tmp/caddydaddy-candidate-0.1
```

No provider state, deployment configuration, credentials, governance/task records, private data,
Tripwire CSL data, Kestrel BOM data, or history-collaboration code is included.
