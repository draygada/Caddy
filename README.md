# Tripwire

Design-stage export-control guidance. DNHacks, Station DC, 5–6 September 2026.

Canonical implementation authority:

1. `docs/NORTH_STAR.md`
2. `docs/feature-bibles/00_INDEX.md` and the assigned feature bible
3. frozen schemas and fixtures in this repository

Research/scenario source: `~/Programming/Strafe/hackathon-dc-2026/THE_BUILD.md`.
The older `hackathon-dc-2026/bible/` describes a superseded project and is not build authority.

## What is real vs. what is scaffolding

| | State |
|---|---|
| `schemas/` — the four JSON shapes | scaffolded, but the P0 rule grammar needs the controlled FB-00 thaw/refreeze before it is implementation authority |
| `data/` — regulation corpus, catalog, chart, rules draft | corpus/catalog/chart are committed inputs; the rules draft remains unapproved research; all eCFR at content date 2026-09-01 |
| `backend/engine/evaluate.py` | **stub.** Returns empty determinations. Diego fills it |
| `backend/app.py` | skeleton — `/health` and a stubbed `/evaluate` |
| `frontend/` | CAD-style Kestrel primitives + span input build and render; visually smoke-checked at 1280×720. Native CAD import, installed-part context, tripwire overlays, and API transport are not implemented |
| `data/rules/rules.DRAFT.json` | 40 objects, machine-verified research only; it is not the approved partial `rules.P0.json` |

## Run

```bash
make env          # uv venv + deps
make test-fast    # the loop: no network, no kicad, no model, no DB. Budget < 2s
make test-flips   # F1-F8, names frozen, all skipped until the engine lands
make test-all     # everything. Cut lines only: 20:00, 02:00, 07:00
npm install && npm run dev     # frontend on :5173
make serve                     # backend on :8000
```

`make test-all` currently reports **10 passed, 8 skipped**. `backend/tests/test_perf.py` asserts an
80-node evaluation stays under 50 ms, but currently exercises an empty rules array; it becomes P0
evidence only after it loads the approved partial rule pack.

## Lanes

Two writers never touch one file, so a rebase can never conflict and there are no PRs to merge.
Ownership is enforced by `.git/hooks/pre-commit` (source: `tools/pre-commit`) reading `.lane` —
in git rather than in a harness hook, so it holds for Codex, Claude, an Odyssey safe-mode slot,
and a human alike.

| Path | Owner |
|---|---|
| `schemas/` | joint — changes need both Benji and Diego present |
| `frontend/` | Benji |
| `backend/`, `backend/tests/` | Diego |
| `data/` | Charlie |
| `docs/`, `README.md` | Charlie |
| `tools/`, `Makefile` | Benji |

The `.lane` file at the repo root is currently permissive (all paths) because one person scaffolded
everything. **Narrow it per worktree before parallel work starts.**

## Open at the freeze

- Charlie's Step 0 answer on `items[]` — ADR-001 takes his recommended option, reversibly
- FB-00 truth pack — approve only the minimal executable F1/F3/F8 subset and produce `rules.P0.json`; machine verification of `rules.DRAFT.json` is not sign-off
- `response.json` + `fixtures/llm_cache/` — needs the API key
- Whether Diego already created a repo; if so, reconcile rather than run two

**Implementation is HOLD pending FB-00.** Visual-shell work may use visibly labeled committed fixtures, but no session may present draft rules, exact destination outcomes, or fixture output as live evaluation.
