# FB-01 — Golden design and evaluate contract

Owner lane: data/contract. Priority: P0. Timebox: 45 minutes.

## Outcome

Provide one canonical, schema-valid Kestrel design fixture and one evaluator response fixture so backend and frontend can build independently without inventing incompatible shapes.

## Required artifacts

- `data/demo/kestrel-baseline.design.json`
- `data/demo/kestrel-catalog.json` or a documented filtered view of the existing catalog
- `backend/tests/fixtures/kestrel-baseline.design.json`
- `backend/tests/fixtures/evaluate-baseline.json`
- `backend/tests/fixtures/evaluate-camera-flag.json`
- `docs/api/evaluate.md`

The duplicate test fixture must be mechanically compared with the canonical data file; it is not a second editable source.

## Fixture requirements

- Stable tree: product → assemblies → visible parts.
- Every visible mesh has a stable node ID and a named model anchor (`position`, `mesh_key`, or equivalent rendering metadata outside the frozen legal attributes).
- Baseline includes battery, wing, flight controller, IMU, GNSS, thermal camera, datalink, motor/prop, and board.
- Real and synthetic provenance is explicit.
- Missing source facts remain null/absent; never backfill them for visual convenience.
- The rule-pack digest is pinned but the unapproved `.DRAFT` filename is not disguised as an approved pack.

## Evaluate API

`POST /evaluate` accepts a schema-valid design and returns:

```json
{
  "design_revision": "sha256:...",
  "rule_pack_sha": "sha256:...",
  "ecfr_date": "2026-09-01",
  "determinations": {
    "node-id": {
      "state": "clear|watch|question|flag",
      "jurisdiction": "ITAR|EAR|EAR99|null",
      "entries": [],
      "active_tripwires": [],
      "potential_tripwires": [],
      "propagated_from": [],
      "destinations": {},
      "evidence_level": "verified|declared|synthetic|missing"
    }
  },
  "changed_nodes": [],
  "summary": {"clear": 0, "watch": 0, "question": 0, "flag": 0}
}
```

Internal `evaluate()` may keep returning the determinations map; `backend/app.py` owns the envelope. The fixtures settle field names before parallel implementation starts.

## Acceptance

- All four frozen schema tests pass.
- Every node ID is unique; every parent resolves; the root is a product.
- Every visible part used by FB-03 resolves to exactly one node.
- Baseline and camera-swap responses validate against the documented API shape.
- Reordering JSON object keys does not change the canonical design digest.
- Frontend can render both response fixtures with no backend running.

## Falsifier

Inject an orphan parent, duplicate node ID, unknown response node, and mismatched rule-pack digest. Contract tests must reject each one. If the UI silently ignores any of them, FB-01 fails.

## Cut line

Do not build a generic CAD importer, arbitrary catalog browser, or second product. Hard-code the one Kestrel rendering map if necessary; keep legal facts in the canonical design fixture.
