# ADR-0004: A bounded proposer over an owned pool; no live distributor call; no tool loop

- Status: accepted (lane-local), 2026-09-06
- Source: strafe-prototype `docs/agentic_part_search_research_2026-09-05.md` §1–§2, decisions S-1 and S-2; THE BUILD §3.5 and §3.12; engineering direction §3.4

## Context

Every distributor API a research stream could reach either forbids persisting what was proposed (Arrow: caching revokes credentials; element14: no caching, sales use only; TrustedParts: no own database; Nexar: 24 hours, no part-number carve-out) or hid its terms (Digi-Key, Mouser). A compliance record must persist what it proposed. The fields the rule rows read are datasheet sentences, not parametric attributes (no distributor filter for one-month bias stability; the ICM-42688-P's full datasheet has none). Exhaustive per-slot evaluation is hundreds to a few thousand dry-runs, cheap in code.

## Decision

1. The proposer reads an **owned pool** (`data/search/pool.json`) and manufacturer documents fetched directly under a static allowlist. No distributor API is called. Digi-Key v4 may be added after a human reads its terms; Nexar and element14 not before a written scope read.
2. **One bounded `search` call** proposes `{mpn, url}` pairs from the pool; everything after it is code: fetch, extract (one bounded call per document), verify, dry-run, walk, screen, cost, on copies. No tool-looping agent: it breaks the four-bounded-calls rule, the prompt-hash cache and the spend arithmetic.
3. **Model split**: `search` on `claude-opus-5`, `extract` on `claude-sonnet-5`; a `Budget` in micro-dollars is reserved before every call.
4. **Live government data refreshes fixtures** (CSL bulk file, USITC HTS, CROSS, GLEIF); nothing on the request path is live. A Hong Kong or mainland-Chinese party prints "ownership unknown" by design until a Sayari-class provider is bought.

## Consequences

- The pool is the ceiling of the search; a candidate not in it cannot be proposed. This is the honest state under the terms read.
- The demo replays from a committed cache; a cache miss is an abstain on screen, never a live call by surprise.
- A no-vector-index architecture at every scale: the pre-filter is in-context today, a parametric query at ten thousand parts, a live structured API at a million.
