# FB-01 — Golden design and evaluate contract

Owner lane: data/contract. Priority: P0. Depends on FB-00. Timebox: 45 minutes after the truth pack is admitted.

## Outcome

Provide one canonical, schema-valid Kestrel design fixture and one evaluator response fixture so backend and frontend can build independently without inventing incompatible shapes.

## Required artifacts

- `data/demo/kestrel-baseline.design.json`
- `data/demo/kestrel.scene.json`
- `data/demo/kestrel-catalog.json` or a documented filtered view of the existing catalog
- `backend/tests/fixtures/kestrel-baseline.design.json`
- `backend/tests/fixtures/evaluate-baseline.json`
- `backend/tests/fixtures/evaluate-battery-flag.json`
- `backend/tests/fixtures/evaluate-camera-flag.json`
- `backend/tests/fixtures/evaluate-no-change.json`
- `backend/tests/fixtures/evaluate-missing-evidence.json`
- `docs/api/evaluate.md`

The duplicate test fixture must be mechanically compared with the canonical data file; it is not a second editable source.

## Fixture requirements

- Stable tree: product → assemblies → visible parts.
- Every visible mesh has a stable node ID. Rendering anchors live in a separate scene-projection map, never in the frozen legal attributes.
- Baseline includes battery, wing, flight controller, IMU, GNSS, thermal camera, datalink, motor/prop, and board. P0 scene slots are `nose_thermal`, `belly_sensor_pod`, `fc_bay`, `battery_bay`, and `mast_datalink`.
- Real and synthetic provenance is explicit.
- Missing source facts remain null/absent; never backfill them for visual convenience.
- The rule-pack digest is pinned but the unapproved `.DRAFT` filename is not disguised as an approved pack.

## Evaluate API

The browser calls same-origin `POST /api/evaluate`; the development server proxies it to FastAPI `POST /evaluate`. It accepts the complete small design plus an opaque monotonic UI request ID. The backend owns the rule pack; the browser does not post rules or legal logic.

```json
{
  "request_id": 7,
  "changed_node_id": "nose_thermal",
  "design": {"root": "kestrel", "nodes": []}
}
```

It returns:

The example below is a shape-only `SYNTHETIC_DEMO` fixture. It does not approve the named rule semantics or prove that frame rate alone establishes an entry. A live evaluator may return `stub: false` only after the signed P0 pack supplies every required positive condition, prerequisite, and exclusion.

```json
{
  "request_id": 7,
  "stub": true,
  "fixture_mode": "SYNTHETIC_DEMO",
  "design_revision": "sha256:...",
  "rule_pack_sha": "sha256:...",
  "destination_policy_sha": null,
  "ecfr_date": "2026-09-01",
  "determinations": {
    "nose_thermal": {
      "state": "flag",
      "jurisdiction": "EAR",
      "entries": ["6A003.b.4.b"],
      "direct_tripwires": [{
        "rule_id": "CCL-6A003.b.4.b",
        "state": "fired",
        "jurisdiction": "EAR",
        "entry": "6A003.b.4.b",
        "reason_for_control": ["NS2", "AT1"],
        "node_id": "nose_thermal",
        "cause_node_id": "nose_thermal",
        "facts": [
          {"attribute": "frame_rate_hz", "observed": 60, "unit": "Hz", "operator": ">", "threshold": 9},
          {"attribute": "camera_prerequisite", "observed": "synthetic-present", "unit": null, "operator": "equals", "threshold": "approved-value-required"},
          {"attribute": "camera_exclusion", "observed": "synthetic-not-applicable", "unit": null, "operator": "equals", "threshold": "approved-review-required"}
        ],
        "text": "shape-only pinned-text placeholder",
        "source_url": "https://www.ecfr.gov/...",
        "ecfr_date": "2026-09-01",
        "rule_effective": null,
        "evidence": {"level": "synthetic", "sha256": "...", "span": [120, 184]}
      }],
      "propagated_tripwires": [],
      "unresolved_tripwires": [],
      "destinations": {"status": "not_evaluated", "reason": "P0 has no approved destination policy"},
      "evidence_level": "synthetic"
    },
    "kestrel": {
      "state": "flag",
      "jurisdiction": "EAR",
      "entries": ["9A012.a.3"],
      "direct_tripwires": [],
      "propagated_tripwires": [{
        "rule_id": "CCL-9A012.a.3",
        "state": "fired",
        "jurisdiction": "EAR",
        "entry": "9A012.a.3",
        "reason_for_control": ["NS1", "AT1"],
        "node_id": "kestrel",
        "cause_node_id": "nose_thermal",
        "path": ["nose_thermal", "kestrel"],
        "facts": [
          {"attribute": "bvlos", "observed": true, "unit": null, "operator": "equals", "threshold": true},
          {"attribute": "installed_descendant_entry", "observed": "6A003.b.4.b", "unit": null, "operator": "in", "threshold": ["6A003.b.3", "6A003.b.4.b", "6A008.d", "6A008.e", "6A008.f", "6A008.g", "6A008.h"]}
        ],
        "text": "shape-only pinned-text placeholder",
        "source_url": "https://www.ecfr.gov/...",
        "ecfr_date": "2026-09-01",
        "rule_effective": "2026-08-13",
        "evidence": {"level": "synthetic", "sha256": "...", "span": [220, 340]}
      }],
      "unresolved_tripwires": [],
      "destinations": {"status": "not_evaluated", "reason": "P0 has no approved destination policy"},
      "evidence_level": "synthetic"
    }
  },
  "delta": {
    "changed_nodes": ["nose_thermal", "kestrel"],
    "tripwires_added": [
      {"node_id": "nose_thermal", "rule_id": "CCL-6A003.b.4.b", "kind": "direct"},
      {"node_id": "kestrel", "rule_id": "CCL-9A012.a.3", "kind": "propagated", "cause_node_id": "nose_thermal"}
    ],
    "tripwires_removed": [],
    "rules_evaluated": ["CCL-6A003.b.4.b", "CCL-9A012.a.3"]
  },
  "summary": {"clear": 0, "watch": 0, "question": 0, "flag": 2}
}
```

Internal `evaluate()` may keep returning the determinations map; `backend/app.py` owns the envelope. The fixtures settle field names before parallel implementation starts. The echoed `request_id` and canonical `design_revision` are both required: one rejects browser response races and the other binds evidence to content.

`direct_tripwires`, `propagated_tripwires`, and `unresolved_tripwires` use this same complete object. Every object carries its target `node_id`; `cause_node_id` names the originating node and may equal it for a direct finding. `facts[]` exposes every positive condition, prerequisite, exclusion, and propagation fact used by the approved predicate; an absent required fact produces `cannot_evaluate`. Propagated objects additionally require `path`; unresolved objects name the missing or incompatible fact. The separate RS1 object, if retained by the signed pack, owns its approved reason code and prerequisite; no frame-rate atom is independently promoted as a complete camera finding. `destinations` belongs to the node determination, not to each tripwire. The inspector renders these fields directly and never joins hidden legal data in React.

## Acceptance

- All four frozen schema tests pass.
- Every node ID is unique; every parent resolves; the root is a product.
- Cycles and duplicate IDs are rejected before the in-memory map is built; silent overwrite is forbidden.
- Every visible part used by FB-03 resolves to exactly one node.
- Baseline, F1, F3, F8, and missing-evidence responses validate against the documented API shape.
- Reordering JSON object keys does not change the canonical design digest.
- Frontend can render every required response fixture with no backend running.
- Baseline, F1, F3, F8, and missing-evidence fixtures exist; fixture metadata says `fixture`, never `live`.

## Falsifier

Inject an orphan parent, cycle, duplicate node ID, unknown scene/response node, stale request ID, and mismatched design or rule-pack digest. Contract tests must reject each one. If the UI silently ignores any of them, FB-01 fails.

## Cut line

Do not build a generic CAD importer, arbitrary catalog browser, or second product. Hard-code the one Kestrel rendering map if necessary; keep legal facts in the canonical design fixture.
