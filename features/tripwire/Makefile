PY := .venv/bin/python
.PHONY: env test test-fast test-flips test-all serve

env:
	uv venv -p 3.12 .venv
	uv pip install -p $(PY) -r requirements.txt

## the loop — no network, no kicad, no model, no DB. Budget: < 2s.
test-fast:
	$(PY) -m pytest backend/tests -q -k "not flips" --no-header

## the eight named flips that also drive the video. Budget: < 5s.
test-flips:
	$(PY) -m pytest backend/tests -q -k "flips" --no-header

## everything. Cut lines only — 20:00, 02:00, 07:00.
test-all:
	$(PY) -m pytest backend/tests -q --no-header

test: test-fast

serve:
	$(PY) -m uvicorn backend.app:app --reload --port 8000
