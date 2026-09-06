# SHIP execution plan for Tripwire

## Purpose

Turn the feature bibles into isolated build and verification sessions without letting orchestration become another implementation project.

## Reality check

The current Shipyard Helm candidate is an evidence projection and synthetic control proof. It does not currently own or expose live session actions. The existing Charlie collaboration broker can create, send, hand off, cancel, retry, rename, and archive Codex/Claude sessions, but it must first have Tripwire registered as an explicit workspace. Until a live Helm adapter is separately authorized and verified, use the broker for sessions and use SHIP/LIVE NOW only to observe alias-safe evidence.

## Fleet topology

The live broker currently has two workers. Use waves; do not pretend four listed roles can all run concurrently.

| Wave | Role | Bible | Mutates? | Verification |
|---|---|---|---|---|
| 0 | truth/contract integration owner | FB-00 then FB-01 | serialized exact allowlist across `schemas/`, `data/demo/`, `data/rules/`, `backend/tests/fixtures/`, `docs/api/` | fresh read-only contract verifier |
| 1A | engine builder | FB-02 | backend engine lane | fresh transcript-blind task on candidate |
| 1B | visual builder | FB-03 | frontend lane | fresh transcript-blind task on candidate |
| 2 | integration owner | FB-04 | serialized exact allowlist: `backend/app.py`, `backend/tests/test_api.py`, `frontend/src/api/`, `frontend/src/App.jsx`, `vite.config.js` | fresh full-suite verifier |
| 3 | final adversarial verifier | FB-07 candidate only | no | owns GO/HOLD evidence |

FB-05 and FB-06 are outside the hackathon critical path. Do not run two sessions against `backend/app.py` or `frontend/src/App.jsx` at once.

The README human-owner table is not a session allowlist. Wave 0 and Wave 2 are deliberate serialized integration lanes with the exact paths above; no other writer runs while either cross-owner lane is active. Every other builder gets a single-root `.lane`.

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

The verifier gets the bible, immutable candidate, fixtures, and falsifier—never the builder transcript or rationale. Use a new `create_session`; do not use `handoff_session`, because handoff injects the parent transcript and defeats blindness.

## Dispatch order

1. Write a private external `workspaces.json` that preserves the existing `strafe` alias and adds `tripwire`, `tw-engine`, `tw-visual`, `tw-integration`, and `tw-verify`; keep secrets in Keychain, never in that file.
2. Persist its path as `STRAFE_OPERATOR_WORKSPACES_FILE` in the managed launch configuration. Prove the collaboration broker has zero active sessions, then restart only through its exact-PID managed lifecycle.
3. Verify collaboration mode, `test_mode=false`, Sol/Opus readiness, every intended alias, historical session preservation, and a 200 response from `/api/operator/now`. Current live runtime predates disk HEAD and returns 404 there, so this verification is mandatory.
4. Create isolated worktrees from the immutable plan commit and write a narrow `.lane` in each. The hook is commit-time protection, not a write sandbox.
5. Clear FB-00 and verify FB-01 before engine dispatch. A visual builder may work against labeled golden fixtures in parallel; it may not claim live evaluation.
6. Dispatch engine and visual builders under the two-worker limit.
7. Create fresh verifier sessions on candidate-pinned disposable verifier worktrees. Use the controlling Sol/xhigh/fast route, with a new transcript-blind task and no builder rationale; never use handoff for acceptance.
8. Integrate one verified candidate at a time; run fast tests/build after each. Dispatch FB-04 only on the integrated base.
9. Run FB-07 from a fresh clone and emit GO/HOLD evidence. Archive completed sessions only after candidate/evidence pointers are recorded. Do not start roadmap lanes until that verdict exists.

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

- Benji's 2026-09-05 correction, relayed from source task `01a072c3-2d8d-7e31-93cd-f5f65fa6844c`, is controlling for future Codex dispatches on this Mac: “set everything to sol extra high fast 1.5x.” Concretely, request `gpt-5.6-sol`, `xhigh`, and service tier `fast`. This supersedes only the Codex model/reasoning/service-tier clause of D-089's older Spark/high route; it does not interrupt existing turns or change custody, evidence, privacy, legal, security, claims, release, spend, or deployment gates. Claude routing is unchanged.
- Builder-distinct verification still requires a fresh candidate-bound task. Since the current route uses one Codex profile, independence comes from a fresh task with no builder transcript, read-only custody, immutable candidate identity, and prewritten falsifiers—not from silently substituting another model.
- Fable is not a standing broker profile. It may be used only through its separate bounded governance path and never as a mutation owner or terminal verdict.
- No fallback model is silently substituted; record requested and served identities.

## Stop conditions

- Tripwire is not an allowlisted broker workspace.
- A restart would interrupt an active turn.
- Two sessions target the same file.
- A candidate changes frozen schemas without integration-owner presence.
- Any path requires secrets, live spend, deployment, or external communication not named by current authority.
- SHIP observation is mistaken for permission to mutate a source session.
- A verifier is created by transcript-bearing handoff rather than as a fresh candidate-bound session.

## Current dispatch verdict

**INTEGRATION HOLD; TECHNICAL COMPATIBILITY PASS.** The current exact candidates are FB-00 mechanical prestage `ca358fa28d90c6c59c20eef92b7be5b05c523c09` and FB-03 visual shell `05cb545e3fca7e0df0084e6f1e624e777d701457`. Each has a fresh candidate-bound read-only acceptance verdict, clean pinned verification evidence, and an allowlist-clean lineage from governed base `4ac523c101d6e9967e582a1c527e038f753aa6ff`.

A separate integration-readiness rehearsal applied both exact diffs to a detached scratch clone. Combined tree `d5e4af7b1d17528a7d6120a8162266e3a18feef6` passed 5/5 frontend design/schema validations, 11/11 frontend contract tests, 10 backend tests with eight inherited flip placeholders skipped, production build, and Chrome 152 at 1280×720, 1920×1080, and 390×844 with zero marker overlap and passing synchronization, evidence, keyboard, and pending-continuity checks. The full receipt is `docs/verification/INTEGRATION_READINESS_2026-09-05_FB00_FB03.md`.

Canonical integration remains barred by the pre-existing gates: the FB-00 approval packet is OPEN, D1-D3 and qualified semantic review are unrecorded, `rules.P0.json` is absent, and FB-01 has no freeze receipt. The visual candidate is therefore accepted only as a technically compatible, visibly synthetic fixture shell—not live evaluation, an approved rule pack, or a legal result. No rebase, merge, push, promotion, deployment, or external publication has been performed.
