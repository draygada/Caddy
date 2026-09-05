# Correction 1 to the D-050 Fable 5.1 NOT RUN receipt

This is an append-only correction to `RECEIPT_V2_NOT_RUN.md` as committed at `5e508cbe75b571647f6a3c3001e97bf20037e8f8`. The original receipt remains immutable.

## Corrected statement

The original receipt says:

> The temporary local archive no longer exists; its observed upload hash and byte count are retained here.

That statement is false. A read-only audit after the receipt was committed found the archive still retained at:

`/private/tmp/tripwire-fable.xZ0Ag5/tripwire-a9db03b.zip`

Its verified state on 2026-09-05 was:

- SHA-256: `5e6a168e29d46c9cdcfb45cdf8a0fc8dd765a49db22b3afaa1cb9eee13f72eda`.
- Bytes: `3,492,411`.
- Filesystem mode: regular file, `-rw-r--r--`.

`REQUEST_V2.md`, `THE_BUILD.md`, and `ADDENDUM_2026-09-05_prep_and_corrections.md` were uploaded as separate files alongside the candidate archive. The archive was not expected to contain the two historical context files.

The file was not deleted or altered to make the original receipt appear correct. This correction does not change the immutable candidate, provider-write finding, `NOT_RUN` result, retry count, trial accounting, authority effect, or requirement for independent non-Fable verification.

## Quality-stop schema correction

The original receipt incorrectly listed `MODEL_IDENTITY_UNVERIFIED` and `PERMISSION_MODE_UNVERIFIED` inside the named D-050 `quality_stops` map. They are runtime unknowns and fail-closed admission conditions, not additional named quality stops. This block supersedes only that map:

```yaml
quality_stops:
  UNAUTHORIZED_WRITE: FIRED
  MODEL_IDENTITY_DRIFT: UNDETERMINED
  BUILDER_SELF_VALIDATION: NOT_OBSERVED
  DUAL_WRITER: NOT_OBSERVED
  DUPLICATE_SHEPHERD: NOT_OBSERVED
  STALE_EVIDENCE: NOT_OBSERVED
  REDUCED_VALIDATION: NOT_OBSERVED
runtime_unknowns:
  served_model_identity: UNVERIFIED
  lifecycle_permission_mode: UNVERIFIED
fail_closed_conditions:
  exact_served_identity_proven: false
  plan_permission_lifecycle_proven: false
```

`NOT_OBSERVED` is bounded to the available evidence and is not an exhaustive negative audit. Identity drift is `UNDETERMINED`, so it cannot convert the unverified identity into valid admission evidence. Either runtime unknown independently preserves `NOT_RUN`, and the observed unauthorized write already fired the controlling quality stop.

## Attempt accounting correction

The original receipt's “Trial consumed: false” refers only to valid D-050 trial accounting. It must not be read as saying that no provider interaction occurred:

```yaml
provider_attempts: 1
valid_D050_trial_count_before: 0/6
valid_D050_trial_count_after: 0/6
valid_trial_consumed: false
request_revision_2_exhausted: true
retry_allowed: false
retry_performed: false
```

The single admitted request revision reached the provider, failed closed, and cannot be replayed under the quoted authorization.

The original statement that “make it 5.1” mapped to `claude-fable-5-1` records the controller's pre-dispatch interpretation used to construct `REQUEST_V2.md`; the provider ID was not verbatim human language and was never provider-attested. This clarification grants no broader supersession. Served identity remains `UNVERIFIED`.

## Information visibility

The provider-visible input set was:

- `REQUEST_V2.md`;
- the immutable `tripwire-a9db03b.zip` candidate archive;
- `THE_BUILD.md`;
- `ADDENDUM_2026-09-05_prep_and_corrections.md`.

No builder transcript, builder rationale, prior verifier verdict, credential, secret, customer data, or controlled data was supplied. This is an input-manifest statement, not a claim about what the model actually read before interruption.

## Evidence-ceiling correction

The original repository-effect statement was too broad. Pre/post Git observations support only that Fable did not change the local Tripwire HEAD, tree, index, tracked files, ref, or pre-existing writer-lock ownership. No credential, deployment, external-send, delegation, or additional local-process mutation was visible, but those negative claims were not independently audited and must not be treated as proven. The browser/provider interaction itself necessarily changed runtime state.

The Claude Desktop paragraph in the original receipt is an operator-observed, post-attempt process note, not provider lifecycle evidence for this web run. PIDs `93106`/`93107` were observed with `claude-opus-5`, effort `max`, `bypassPermissions`, and `fastMode=false`; no immutable hash of that process listing was captured in the receipt. It supports the decision not to use or disturb that worker and nothing more.

## Binding

- Superseded fields: the archive-presence sentence, the malformed `quality_stops` map, the ambiguous attempt-accounting wording, and the overbroad repository/runtime-effect claim described above.
- Original receipt SHA-256: `2044b66137c71618d8d65a64e510df53ea15014ca9637a73f56149dcc2ae0321`.
- Original receipt bytes: `5,452`.
- All other original receipt fields remain in force.
