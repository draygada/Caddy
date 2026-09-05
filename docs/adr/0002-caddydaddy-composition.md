# ADR-0002: CADdyDaddy composition and compliance boundary

- Status: accepted for foundation; runtime and Odyssey deployment remain on hold
- Date: 2026-09-05
- Forge base: 92241b9ca7c9df37cc48e55b4ea388cb21686bb4
- Tripwire source commit: 898f6167e4305a4f86f3ebe4a473278ffbd56530
- Tripwire source tree: b8f32adddb0c9a894a41d15ead89b4cb1db91aed
- Tripwire import commit: 7a41388ffb49786495efd46b5821d402912c36da

## Decision

CADdyDaddy is the larger product. Forge is its general CAD and versioned product-thread system. Tripwire is its compliance-at-design-click capability. Tripwire is imported unsquashed and unchanged under features/tripwire; it does not become a second CAD model, geometry authority, revision authority, or product ledger.

Forge owns canonical geometry, revisions, recompute state, stable record identity, occurrence identity, and the product thread. Tripwire receives only a derived, revision-bound compliance input after a successful Forge recompute. Tripwire output is review support and cannot mutate Forge or confer a legal, export-control, certification, safety, or release conclusion.

The browser displays server-produced state. It does not derive IDs, convert units, evaluate rules, bind observations, or decide currentness.

## Deterministic identity and units

A projected node ID is tripwire-node:SHA256(RFC8785(preimage)), where the preimage contains exactly:

    product_thread_id
    forge_record_id
    occurrence_path

Array position, MPN, display name, mesh index, face or edge number, tessellation order, and transient topology never enter the preimage. MPN may remain derived business data without affecting identity.

Forge millimetres are projected to Tripwire metres on the server with the exact decimal operation metres = millimetres * 0.001. Values used in contract hashes are decimal strings.

## Failure and currentness

A failed Forge recompute creates no compliance input and no current compliance observation. A Tripwire failure leaves the Forge revision and CAD artifacts unchanged, creates no current compliance observation, and blocks every compliance-dependent claim. A prior observation may be retained only as last-valid, never current.

Only caddydaddy.compliance-binding-receipt/1 can designate an observation as current. A successful binding still requires human review because the imported rule pack remains DRAFT_REVIEW_ONLY.

## Evidence and deferred work

The three schemas and their RFC 8785/SHA-256 vectors freeze the boundary. The provenance manifest supplements, without changing, Tripwire's original truncated data/manifest.tsv and records every source blob with its Git object ID and full SHA-256.

This foundation does not implement a runtime bridge, application shell, browser integration, persistence, authentication, deployment configuration, target smoke checks, or rollback automation. Odyssey deployment is HOLD until those components and the full backend, frontend, end-to-end, security, claims, and target-specific readiness gates exist and pass.
