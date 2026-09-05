# Candidate integration release evidence

## Purpose and timing

The repository tracks the receipt schema, template, generator, and hygiene gate. The final exact
receipt is an external generated artifact under `.release-evidence/` or another ignored/output path.
It must be generated only after final integration, when the target branch points to the full candidate
commit and all named checks have passed.

A tracked receipt cannot truthfully bind the commit that first contains itself: adding the receipt
changes that commit and its tree. Do not commit a placeholder candidate hash, substitute this lane's
pre-integration hash, or amend a candidate after its receipt is generated. If the candidate changes,
discard the stale external receipt and generate a new one against the new full hash.

Generation reads the Tripwire provenance manifest from the candidate commit, proves the candidate's
`features/tripwire` subtree equals the recorded source root tree, verifies the source Git object and
content hashes, and requires the named branch and checked-out `HEAD` to equal the supplied full hash.
The output records no deployment effect and fixes spend, real-data, public-Git, provider, deployment,
and credential boundaries at prohibited/not-granted values.

## Release diff hygiene

Run the hygiene gate before receipt generation:

```bash
python3 tools/check_release_diff_hygiene.py \
  --base <pre-integration-full-hash> \
  --candidate <final-integrated-full-hash>
```

With no `--authored-path` options, every changed path outside `features/tripwire/**` is treated as
authored and passed to `git diff --check`. A lane-local preflight may repeat `--authored-path` with
exact files or `prefix/**`, but the final integration gate must omit those filters so another authored
path cannot escape whitespace review.

Tripwire is checked separately. The accepted provenance manifest is loaded from `--provenance-ref`
(default: `--base`), its recorded source root tree is compared with the source commit, the candidate
manifest binding, and the candidate's actual `features/tripwire` subtree tree object. Any drift fails.

Imported third-party/source whitespace is provenance-governed. Reformatting, trimming trailing spaces,
or normalizing EOFs would change source blob and tree identities and would silently turn an exact import
into an adaptation. Therefore `git diff --check` applies to authored paths while imported bytes remain
untouched and are guarded by exact tree identity. A source cleanup must happen upstream and arrive as a
new explicitly reviewed import with new provenance, never as release-lane normalization.

## External receipt generation

After final integration and successful checks, run:

```bash
python3 tools/generate_candidate_integration_release_receipt.py \
  --branch <final-integration-branch> \
  --candidate <final-integrated-full-hash> \
  --authorization-quote '<exact human authorization quote>' \
  --authorization-scope '<exact bounded scope>' \
  --bundle-manifest <sanitized-manifest-path> \
  --bundle-archive <sanitized-archive-path> \
  --target-project '<target project>' \
  --target-alias '<target alias>' \
  --claim-ceiling '<exact claim ceiling>' \
  --check 'release-diff-hygiene=<immutable evidence pointer>' \
  --rollback '<exact rollback instruction>' \
  --exclusion '<explicit exclusion>'
```

Repeat `--check NAME=EVIDENCE` and `--exclusion VALUE` as needed. Only passing checks are representable.
The sanitized bundle declaration is supplied by the authorized operator; the generator hashes the exact
manifest and archive bytes but does not inspect, upload, deploy, alias, spend, use credentials, or infer
that sanitization occurred. The default output is
`.release-evidence/candidate-integration-release-receipt.<candidate>.json`.

Rollback for these repository changes is a normal revert of the release-evidence lane commit. Rollback
of an external receipt means retaining it as stale evidence, preventing its use for promotion, and
generating a fresh receipt only after a new immutable candidate passes the complete gate again.
