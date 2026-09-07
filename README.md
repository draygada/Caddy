# Caddy

Caddy is CAD designed for ITAR and hardware teams. It surfaces how a design change reads against the export-control rules (ITAR and EAR), quoted word for word.

[Demo video](https://drive.google.com/file/d/1vKpyvdiFhcUQ6lwq6Rlr4LLmRkFlHDOR/view?usp=sharing)

## The problem

Export controls change with the hardware design. One part swap can move a product from freely exportable to license-required, which controls who may see the product, where it can ship, and the trajectory of the product itself. Today the engineer who made the swap finds out after the design is frozen, from counsel or at the shipping dock, when the only fix is a redesign.

## What Caddy does

An engineer swaps a battery or types a wing span. Caddy shows which USML paragraph or ECCN the design now meets, the number that crossed the line, and what that means for export. It then sources each part with a landed-cost estimate and a walkthrough of the supply-chain and import considerations, and writes every accepted change to a log that re-derives when the rules change.

Caddy is the design-time front door of Albatrust, our startup building the system of record for regulatory compliance, starting with export controls: classify a product when it is first designed, then re-classify it when the product or the law moves.

## The three tabs

- **Design.** A parametric drone on a browser CAD viewport with a component browser, spec dock and product status. Every project starts with the declared use case, because the rules read it.
- **Classification.** The parts of concern with the modeled row that fired, the number that crossed, the eCFR text behind it, and a destination strip. A deterministic rules engine recomputes on every edit. A guarded live lane sends a part or the whole product to the classification engine, which follows the order of review under strict output schemas and hash-verified citations.
- **Sourcing.** Four steps: the declared use case, a supplier pick per part signed by a named attestor, the package and a simulated order that dispatches exactly once, and a customs filing draft with pre-entry lines, duties, fees and export references for the broker to review. Every seller is screened against the Consolidated Screening List; every round is sealed to the exact design revision.

## Run it locally

Three processes, from the repository root.

Frontend on port 5173:

```bash
npm run dev --prefix frontend -- --port 5173 --strictPort
```

Product service on port 4173. `python3 tools/live_stack.py init` writes `.env.live.local` (gitignored) with every live setting and a generated access token; paste an Anthropic key on the `ANTHROPIC_API_KEY=` line, then:

```bash
python3 tools/live_stack.py serve
```

Use `serve-scripted` instead for a run that makes no model calls. Put `VITE_API_TARGET=http://127.0.0.1:4173` in `frontend/.env.local` so the dev server proxies `/api` to it.

CAD service on port 8000:

```bash
PORT=8000 CAD_ALLOWED_HOSTS=localhost,127.0.0.1 uv run --directory apps/cad-service python -m cad_service.server
```

In the app, open Settings, paste the access token from `.env.live.local`, confirm the data is public or synthetic, and press "Run classification" on any part.

## Repository layout

| Path | What it holds |
|---|---|
| `frontend/` | The React and TypeScript app, its Vercel proxy and tests |
| `apps/product-service/` | The Python service: classification, sourcing, provenance and order lanes |
| `apps/cad-service/` | The OpenCascade CAD service |
| `packages/classification/` | The classification engine and the order of review |
| `packages/sourcing/` | Supplier search, screening, ownership and landed cost |
| `packages/compliance-bridge/`, `packages/core-kernel/`, `packages/cad-output/` | Shared contracts, the design kernel and sealed CAD outputs |
| `features/tripwire/` | The rule pack and the compliance-at-design-click engine |
| `tests/` | Package and service suites |

## Tests

```bash
cd frontend && npx vitest run
```

```bash
PYTHONPATH=packages/sourcing uv run --python 3.12 --with pytest --with pypdf --with jsonschema --with fastapi --with uvicorn --with httpx python -m pytest tests/sourcing -q
```

## Engineering notes

The kernel decisions, the first target contract and the lane custody model are documented in [docs/BASELINE.md](docs/BASELINE.md), [docs/contracts/first-target.md](docs/contracts/first-target.md) and [docs/adr/0001-kernel-reuse-and-runtime-boundary.md](docs/adr/0001-kernel-reuse-and-runtime-boundary.md). The classification and order lanes are review support only and never a legal conclusion; the data boundary admits public or synthetic data only.
