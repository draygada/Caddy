# Order execution boundary

This package defines the provider-neutral transaction boundary between a sealed
sourcing package and a supplier transport. It is intentionally stdlib-only and
does not contain a live EDI, HTTP API, or email transport.

## Guarantees

- The manifest seal is recalculated from canonical JSON before dispatch.
- Every declared package file is read from disk and checked for exact byte size
  and SHA-256 digest. Symlinks, traversal, duplicate paths, and undeclared
  candidate substitutions fail closed.
- Candidate ID, revision, and artifact SHA-256 must exactly match the caller's
  expected identity.
- Every selected offer must be `APPROVED`, selected, and `CLEARED` by its gate.
- A key can identify only one dispatch fingerprint. An identical replay returns
  the original immutable request and receipt without invoking the connector.
- Requests, receipts, and audit events use canonical SHA-256 identities. Audit
  events form a verified append-only hash chain.
- `EXCEPTION` means the connector established that no send occurred and is safe
  to retry under a new key. `UNKNOWN` means a send may have occurred and requires
  reconciliation before retry.

## State machine

```text
DRAFT -> DISPATCH_PENDING -> DISPATCHED -> ACKNOWLEDGED -> CLOSED
                          \-> EXCEPTION -----------------> CLOSED
                          \-> UNKNOWN -------------------> CLOSED
```

An `UNKNOWN` transaction can close only with an evidence reference and an
explicit reconciliation of whether the send occurred.

## Connector ceiling

`RecordingConnector` is deterministic and test-only. Its receipts always carry
`execution_mode: RECORDING_ONLY` and `external_effect: NONE`; workflow states
such as `DISPATCHED` are simulations and are not claims of supplier contact.

`EDIConnector`, `APIConnector`, and `EmailLikeConnector` are disabled boundary
sentinels. They reject missing configuration, reject missing scope-bound send
authority, and still stop at `CONNECTOR_IMPLEMENTATION_UNAVAILABLE` when both
are present. This repository therefore cannot send a real RFQ or order through
this package. A future live adapter must be separately implemented, reviewed,
configured, authorized, and integrated behind `OrderConnector`.

## Input contract

The caller supplies a path to `sealed-sourcing-package.v1.json`, its package
root, an expected `CandidateIdentity`, a connector, and an idempotency key.
Examples are generated in `tests/order-execution/`; no production supplier or
customer data is included.
