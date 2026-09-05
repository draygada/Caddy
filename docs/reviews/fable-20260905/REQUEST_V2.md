# D-050-derived request V2 — Tripwire planning falsifier design

Status: prepared for one shadow-only invocation. This file supersedes `REQUEST.md` only for model identity; the original request remains immutable evidence.

## Narrow supersession

Benji first authorized one read-only `claude-fable-5` GUI `FALSIFIER_DESIGN` review and required every other D-050 limit to remain. Benji then supplied this exact follow-up:

> make it 5.1

For this invocation only, that follow-up changes the required requested and served provider identity from `claude-fable-5` to `claude-fable-5-1`. It does not retroactively authorize the D-052b anomaly, relax any read-only or shadow restriction, permit a fallback/retry, or change the candidate, trigger, mode, lane, revision, output, or claim ceiling below.

## Admission

- Governing controls: `D-050/FABLE_BOUNDED_ESCALATION_V1`, except for the one-shot model-identity substitution explicitly recorded above.
- Canonical policy SHA-256: `3b74c92dfd68f4259c546990230a7d4b644a057b62d7abf895f9bd54560f1ca5`
- Shadow-only accounting: proposed invocation 1 of 6; record the identity exception in the receipt.
- Requested GUI label: `Fable 5.1`
- Required requested and served provider identity: `claude-fable-5-1`
- Effort: `high`
- Permission mode: `plan` / read-only
- Trigger: `NOVEL_HIGH_CONSEQUENCE_FALSIFIER_GAP`
- Mode: `FALSIFIER_DESIGN`
- Lane: `TRIPWIRE-PLAN-V1`
- Revision: `2` (request-envelope revision only; candidate remains revision 1)

The prior anomalous Fable session recorded under D-052b fired `UNAUTHORIZED_WRITE`. Benji explicitly superseded that quality stop for this one read-only review. The old session remains `NOT_RUN`, is not retroactively authorized, and consumes no trial slot.

## Immutable candidate

- Repository: `/Users/benjihuh/Programming/tripwire`
- Commit: `a9db03b0d922a1754522d846b5915d0fcd892c2f`
- Tree: `215b7fde905afaaa8b682312f9e67ee313221c0f`
- Planning packet: `docs/NORTH_STAR.md`, `docs/SHIP_EXECUTION_PLAN.md`, and every file under `docs/feature-bibles/` at that commit.
- Current implementation context: `README.md`, `frontend/src/App.jsx`, `backend/app.py`, `backend/engine/`, `backend/tests/`, frozen `schemas/`, and committed `data/` at that commit.
- Historical input, not implementation authority: `/Users/benjihuh/Programming/Strafe/hackathon-dc-2026/THE_BUILD.md` and `/Users/benjihuh/Programming/Strafe/hackathon-dc-2026/doc/ADDENDUM_2026-09-05_prep_and_corrections.md`.

Inspect the pinned commit with read-only Git commands. Do not treat mutable working-tree bytes as the candidate.

## Objective

Act as a fresh-eyes product architect and falsifier designer. Determine whether the packet is specific, coherent, minimal, parallelizable, and sufficient to start implementation of this exact hackathon thesis:

> A designer inspects what is in a CAD/BOM assembly and sees, on the affected geometry and its parents, which deterministic source-cited export-control tripwires fired, why, and what needs review while the design is still changeable.

Identify the smallest plan changes that materially increase the probability of a working, legible, honest demo before the event deadline.

## Required output

1. `KILL`: the three most likely ways this plan produces activity but no coherent demo.
2. `CONTRADICTIONS`: every material mismatch among north star, bibles, frozen schemas, code, tests, data approval state, historical spec, and SHIP capability.
3. `MISSING CONTRACTS`: exact decisions builders would otherwise invent independently.
4. `CRITICAL PATH`: the smallest ordered vertical slice, with what must be cut now.
5. `FALSIFIERS`: one preconstruction falsifier per P0 bible, including a visual falsifier for the CAD overlay.
6. `SESSION TOPOLOGY`: safe parallel ownership with no overlapping files and a separate verification route.
7. `PLAN PATCH`: concise file-by-file amendments, not code.
8. `ADVISORY`: end with `PROCEED_WITH_CHANGES`, `PROCEED_AS_WRITTEN`, or `REPLAN`, followed by no more than five reasons. This is advisory and not a gate verdict.

## Falsifier for this review

The plan is inadequate if any of the following remains true after reading only the pinned packet:

- two independent builders can make incompatible but locally reasonable API/data decisions;
- the visual overlay can pass while detached from engine causality or stable node identity;
- the critical demo depends on an unapproved rule pack, network, secret, unavailable SHIP action, or unimplemented generic CAD import;
- P0 work cannot be divided without two sessions editing the same file;
- verification can report green while canonical flip tests are skipped or visual states are unreadable;
- the scope cannot be cut to a working minimal vertical slice before optional AI/audit work begins.

## Environment and data identity

- Local macOS repository and public/synthetic hackathon data only.
- No customer, controlled, privileged, credential, secret, private-key, or unrelated personal data.
- No network research or external action is needed or permitted.
- The repository commit and tree above define implementation identity; the two historical files are read-only context.

## Claim ceiling and permissions

This is a read-only, shadow-phase advisory artifact. It may design falsifiers and architecture amendments. It may not:

- edit or create files;
- run mutation, build, test, or provider/delegation actions that write state;
- acquire/release a writer lock, move a ref, commit, curate, gatekeep, adjudicate, or override a verdict;
- authorize implementation, integration, deployment, external communication, credential use, spend, or legal claims;
- recursively delegate or retry itself;
- validate the revised plan produced from its advice.

The output goes directly to the controlling Codex orchestrator. A separate non-Fable verifier must evaluate any revised packet.

## Why ordinary validators are insufficient for this one use

The live repo was scaffolded from a detailed CAD/export-control spec while an older canonical-looking bible still described a different agent-gate project. The requested in-model visual tripwire layer also joins CAD semantics, deterministic legal-rule causality, demo legibility, and multi-session orchestration. The high-consequence gap is a preconstruction falsifier that attacks the join before parallel builders encode incompatible assumptions; this is not a standing Fable lane.

## Stop condition

Return the required advisory once and stop. If the provider lifecycle evidence does not show `claude-fable-5-1`, or if a write/delegation is attempted, the exact model is unavailable, restricted data is needed, or the pinned commit cannot be inspected, report `NOT_RUN`; do not fallback or retry.
