# Tripwire

Design-stage export-control guidance. DNHacks, Station DC, 5–6 September 2026.
Spec: `~/Programming/Strafe/hackathon-dc-2026/THE_BUILD.md`.

## What is real vs. what is scaffolding

| | State |
|---|---|
| `schemas/` — the four JSON shapes | **frozen** 2026-09-05 10:00, §3.8 plus `items[]` (see `docs/adr/ADR-001-items-axis.md`) |
| `data/` — regulation corpus, catalog, chart, rules draft | **real**, staged before the window; all eCFR at content date 2026-09-01 |
| `backend/engine/evaluate.py` | **stub.** Returns empty determinations. Diego fills it |
| `backend/app.py` | skeleton — `/health` and a stubbed `/evaluate` |
| `frontend/` | Kestrel as primitives + span input. Builds; **not yet visually verified** |
| `data/rules/rules.DRAFT.json` | 40 objects, machine-verified, **awaiting Charlie's sign-off** — not `rules.json` |

## Run

```bash
make env          # uv venv + deps
make test-fast    # the loop: no network, no kicad, no model, no DB. Budget < 2s
make test-flips   # F1-F8, names frozen, all skipped until the engine lands
make test-all     # everything. Cut lines only: 20:00, 02:00, 07:00
npm install && npm run dev     # frontend on :5173
make serve                     # backend on :8000
```

`test-fast` currently runs in **0.16 s**. `backend/tests/test_perf.py` asserts a full evaluation of
an 80-node tree stays under 50 ms — written on day one so the suite can never become slow enough to
need test selection. If it fails, something reached for a database or the network inside the engine.

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
- `rules.json` — Charlie verifies `data/rules/rules.DRAFT.json` against `DRAFT_REVIEW.md`
- `response.json` + `fixtures/llm_cache/` — needs the API key
- Whether Diego already created a repo; if so, reconcile rather than run two
