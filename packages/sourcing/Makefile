PY   := $(abspath .venv/bin/python)
REPO := $(abspath ../..)
HERE := $(abspath .)
.PHONY: env test serve seed determinism eval refresh-csl refresh-hts refresh-cross refresh-ownership record-cache manifest custody

env:
	uv venv .venv -p 3.12
	uv pip install --python $(PY) pytest==8.4.1 pypdf==6.17.0 jsonschema==4.26.0 fastapi==0.121.2 uvicorn==0.41.0 httpx==0.28.1

## the loop: offline, no model, no network. Budget: < 3 s.
test:
	cd $(REPO) && $(PY) -m pytest tests/sourcing -q

serve:
	cd $(REPO) && FORGE_SOURCING_ROOT=$(HERE) $(PY) -m uvicorn forge_sourcing_api.app:app --app-dir packages/sourcing --port 8000

seed:               ## fetch the pool's real documents into .cache/fetch under the allowlist (network)
	$(PY) scripts/seed_documents.py

determinism:        ## print sha256(extracted text) per cached document; compare across two machines
	$(PY) scripts/determinism_check.py

eval:               ## the six measurements over data/search/gold_swaps.json; cache mode; asserts zero cache misses with --assert-cached
	$(PY) scripts/eval_search.py --mode cache

refresh-csl:        ## download the full Consolidated Screening List into .cache/csl (public .gov data)
	$(PY) scripts/refresh_csl.py

refresh-hts:        ## read the base rates for tariff.json's headings from the USITC HTS REST API; print the diff, write with --write
	$(PY) scripts/refresh_hts.py

refresh-cross:
	$(PY) scripts/refresh_cross.py

refresh-ownership:
	$(PY) scripts/refresh_ownership.py

record-cache:       ## LIVE model calls under the $50 cap; human-run only; requires ANTHROPIC_API_KEY
	TRIPWIRE_LLM=live $(PY) scripts/record_cache.py

manifest:
	$(PY) scripts/build_manifest.py

custody:
	cd $(REPO) && python3 tools/check_custody.py --lane sourcing --base 92241b9ca7c9df37cc48e55b4ea388cb21686bb4
