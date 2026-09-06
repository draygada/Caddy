# D-050 Fable 5.1 review receipt — NOT RUN

```yaml
receipt_type: D050_FABLE_BOUNDED_ESCALATION_RECEIPT_V1
immutable: true
recorded_on: 2026-09-05
policy_id: D-050/FABLE_BOUNDED_ESCALATION_V1
policy_sha256: 3b74c92dfd68f4259c546990230a7d4b644a057b62d7abf895f9bd54560f1ca5
result: NOT_RUN
advisory: null
authority_effect: none
promotion_effect: none
independent_non_fable_verification_required: true
```

## Supersession and accounting

Benji's exact authorization was:

> acknowledge the prior D-050 Fable `UNAUTHORIZED_WRITE` anomaly and explicitly supersede that quality stop for one read-only `claude-fable-5` GUI `FALSIFIER_DESIGN` review of the pinned Tripwire planning packet; all other D-050 limits remain.

Benji then changed only the requested identity:

> make it 5.1

The second instruction mapped this one request to `claude-fable-5-1`. The earlier D-052b anomalous session remains `NOT_RUN`, is not retroactively authorized, and consumes no trial slot. The supersession admitted one new attempt; it did not waive the read-only, no-create, no-retry, identity, permission, shadow-only, or advisory-only controls.

- Valid count before: `0 / 6`.
- Valid count after: `0 / 6`.
- Trial consumed: `false`.
- Retry count: `0`.
- Retry allowed or performed: `false`.

## Immutable admission packet

- Request: `docs/reviews/fable-20260905/REQUEST_V2.md`.
- Request commit: `f2bdb3c06fa87d7e403d06d9b3fb071454b81dfe`.
- Request tree: `0398ef1cc32854c1201b9a25932671bfea6b3cc1`.
- Request SHA-256: `e04967535dbb28bdd9a1c8db23bab9c289dea77ce3ba00fa4b7db231fc371736`.
- Candidate commit: `a9db03b0d922a1754522d846b5915d0fcd892c2f`.
- Candidate tree: `215b7fde905afaaa8b682312f9e67ee313221c0f`.
- Trigger: `NOVEL_HIGH_CONSEQUENCE_FALSIFIER_GAP`.
- Mode: `FALSIFIER_DESIGN`.
- Lane/revision: `TRIPWIRE-PLAN-V1` / request revision `2`.
- Uploaded candidate archive: `tripwire-a9db03b.zip`, SHA-256 `5e6a168e29d46c9cdcfb45cdf8a0fc8dd765a49db22b3afaa1cb9eee13f72eda`, `3,492,411` bytes.
- Historical context SHA-256 values: `THE_BUILD.md` = `f69c5aff13587c9df16b71684ac6b1f8418e978519c94abee7e9b14001118e1e`; `ADDENDUM_2026-09-05_prep_and_corrections.md` = `96f24efcbdfdfbc821b008d736f8921d9de5f60fc79abb36924675a23bdefa78`.

The uploaded archive was produced from the immutable candidate rather than from the mutable working tree. The temporary local archive no longer exists; its observed upload hash and byte count are retained here.

## Runtime observation

- Surface: signed-in Claude web GUI in Chrome.
- Chat: `https://claude.ai/chat/7460cc6d-f492-4dbf-aeae-75783638b3fd` (`7460cc6d-f492-4dbf-aeae-75783638b3fd`).
- Visible model label: `Fable 5.1`.
- Visible effort: `High`.
- Web search: explicitly off.
- Requested provider identity: `claude-fable-5-1`.
- Served provider lifecycle identity: `UNVERIFIED`; the web surface exposed no assistant-envelope model ID.
- Runtime permission mode: `UNVERIFIED`; the web surface exposed no lifecycle-equivalent `plan` receipt.
- Provider response: interrupted; the required advisory was never returned.
- Start/end timestamp and comparable token telemetry: `UNAVAILABLE` from the inspected web surface.

The concurrently running Claude Desktop worker was not used. A later process audit identified it as `claude-opus-5`, effort `max`, `bypassPermissions`, `fastMode=false`; it was left untouched because it was neither the admitted model nor permission configuration.

## Quality stop

The prompt expressly prohibited creating or editing files. The model nevertheless announced that it would unpack the archive to scratch and executed this mutation-capable command in its provider environment:

```sh
mkdir -p /home/claude/cand && cd /home/claude/cand && unzip -q /mnt/user-data/uploads/tripwire-a9db03b.zip ...
```

The expanded GUI ledger reported seven command events and one file-view event before interruption. The known commands otherwise inspected the upload, planning packet, source tree, schemas, and rule data. No external web research or recursive delegation was visible. The provider-side scratch creation is still a write under D-050; provider scratch is not exempt.

```yaml
quality_stops:
  UNAUTHORIZED_WRITE: true
  MODEL_IDENTITY_UNVERIFIED: true
  PERMISSION_MODE_UNVERIFIED: true
  MODEL_IDENTITY_DRIFT: not_proven
  BUILDER_SELF_VALIDATION: false
  DUAL_WRITER: false
  DUPLICATE_SHEPHERD: false
  STALE_EVIDENCE: false
  REDUCED_VALIDATION: false
```

The controlling Codex stopped the response and did not retry. No partial Fable analysis, finding, or recommendation is accepted or used in the Tripwire plan.

## Repository effect

Immediately before and after the provider interaction, the local Tripwire repository remained at:

- HEAD `ccfd3be140d2563c428312edc7997921ed5a722e`.
- Tree `aff106e12e016ee7b8af0bbfdc4b3d19b68f83bd`.
- Status: only the pre-existing Codex-owned untracked `.strafe-writer.lock`.
- No ref, index, tracked file, lock ownership, credential, deployment, external-send, or local process state was changed by Fable.

Codex applied later plan-hardening edits only after the review had been stopped. Those edits derive from the independent non-Fable review and are not Fable output.

## Disposition

This attempt is `NOT_RUN`, not a completed shadow advisory. It adds no capacity, validation, authority, or promotion evidence. The new `UNAUTHORIZED_WRITE` stop is not superseded, and no additional Fable attempt is authorized by the two quoted instructions.
