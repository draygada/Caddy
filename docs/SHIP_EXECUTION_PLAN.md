# SHIP execution plan for Tripwire

## Purpose

Turn the feature bibles into isolated build and verification sessions without letting orchestration become another implementation project.

## Reality check

The current Shipyard Helm candidate is an evidence projection and synthetic control proof. It does not currently own or expose live session actions. The existing Charlie collaboration broker can create, send, hand off, cancel, retry, rename, and archive Codex/Claude sessions, but it must first have Tripwire registered as an explicit workspace. Until a live Helm adapter is separately authorized and verified, use the broker for sessions and use SHIP/LIVE NOW only to observe alias-safe evidence.

## Fleet topology

Maximum useful live topology for this small repository:

| Slot | Role | Bible | Mutates? | Verification |
|---|---|---|---|---|
| 1 | engine builder | FB-01/FB-02 | backend/data lane | fresh non-builder on candidate |
| 2 | visual builder | FB-03 | frontend lane | visual + contract verifier |
| 3 | integration owner | FB-04 then FB-05 | serialized integration | full-suite verifier |
| 4 | adversarial verifier | current candidate only | no | owns GO/HOLD evidence |

FB-06 starts only after Slot 3 has a verified FB-04 candidate. Do not run two sessions against `backend/app.py` or `frontend/src/App.jsx` at once.

## Session packet template

Each build session receives:

```text
Objective: implement <bible ID> exactly.
Base: <immutable commit>.
Workspace/worktree: <exact path and branch>.
Owned paths: <allowlist>.
Forbidden paths: everything else, especially frozen schemas.
Inputs: docs/NORTH_STAR.md, docs/feature-bibles/<file>, named fixtures only.
Acceptance: <commands and visible states copied from the bible>.
Falsifier: <prewritten mutation/adversarial check>.
Stop: schema conflict, disputed rule, overlapping writer, or missing approved rule pack.
Return: candidate commit, changed-file list, command output, unresolved items.
Your output claims nothing—a blinded verifier decides what is true.
```

The verifier gets the bible, immutable candidate, fixtures, and falsifier—never the builder transcript or rationale.

## Dispatch order

1. Register `/Users/benjihuh/Programming/tripwire` as a broker workspace using the existing explicit workspace configuration path; verify it is neither the live console checkout nor inside it.
2. Prove the collaboration broker idle before any restart needed for configuration.
3. Create isolated worktrees from the plan commit and write a narrow `.lane` in each.
4. Dispatch engine and visual builders in parallel.
5. Dispatch fresh verifiers when candidates exist; do not ask builders whether their own work is correct.
6. Integrate one candidate at a time; run fast tests/build after each.
7. Dispatch FB-04 on the integrated base.
8. Run FB-07 from a fresh clone and emit GO/HOLD evidence.
9. Archive completed sessions only after their candidate/evidence pointers are recorded.

## Evidence SHIP should display

- north star and exact active objective;
- bible/lane alias, owner profile, base and candidate commit aliases;
- state: queued, building, candidate, verifying, hold, integrated;
- last material change and elapsed time;
- blocker with exact clearer and next evidence;
- check state with receipt pointer;
- current critical path and final candidate.

Prompts, transcript bodies, provider-native IDs, workspace roots, credentials, and raw command output stay in the source broker and do not enter the SHIP projection.

## Model routing

- Use one profile to build and the other to verify when available.
- Fable is not a standing broker profile. It may be used only through its separate bounded governance path and never as a mutation owner or terminal verdict.
- No fallback model is silently substituted; record requested and served identities.

## Stop conditions

- Tripwire is not an allowlisted broker workspace.
- A restart would interrupt an active turn.
- Two sessions target the same file.
- A candidate changes frozen schemas without integration-owner presence.
- Any path requires secrets, live spend, deployment, or external communication not named by current authority.
- SHIP observation is mistaken for permission to mutate a source session.
