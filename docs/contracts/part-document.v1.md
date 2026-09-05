# Frozen cross-lane contract: PartDocument v1

- Contract ID: `FORGE-PART-DOCUMENT-001`
- Wire version: `forge.part-document/1`
- Freeze state: `FROZEN_FOR_6H_CANDIDATE`
- Authority: main integration owner
- Canonical encoding: UTF-8 JSON, RFC 8785 canonicalization, SHA-256 lowercase hex
- Scope: core-kernel, browser-workbench, and history-collaboration lanes

This is the smallest shared contract for the six-hour candidate. It freezes names,
ownership, state semantics, and cross-lane messages. A lane may define private
implementation types, but its boundary adapter must emit and accept these wire shapes.
Breaking changes require an integration-owner revision. Lanes return proposed changes in
their handoff rather than editing this file or another lane.

## Ownership and authority

| Record | Writes | Reads | Authority rule |
|---|---|---|---|
| `PartDocument` and `PartRevision` | history-collaboration | all lanes | Canonical typed intent and revision record; never contains executable source |
| `KernelProjection` | history adapter | core-kernel | Pure computational projection of one exact `PartDocument` revision |
| `OperationDescriptor` registry | core-kernel | history and browser | Core validates and executes registered operations; consumers treat unknown types as unsupported |
| `KernelResult`, `GeometryArtifact`, `ExchangeResult` | core-kernel | history and browser | Server kernel is geometry authority |
| `ViewportPacket` | core-kernel adapter | browser-workbench | Derived display data only; cannot commit geometry truth |
| proposals, decisions, and revision receipts | history-collaboration | browser and core adapters | Geometry edits are serialized against an exact base revision |

The browser never writes a `KernelResult`, `GeometryArtifact`, semantic resolution, or
exchange verification. The core never invents a revision, actor, authorization, or product-
thread state. History never fabricates geometry success. Presence/comments are outside the
geometry command stream.

## Scalar conventions

- Every identifier is an opaque, stable, non-empty string. Array position is never identity.
- Length is millimetres at the kernel boundary; angle is degrees. A document declares both.
- User-authored and resolved scalar values cross the wire as canonical decimal strings, not
  binary JSON numbers. `-0` normalizes to `0`; NaN and infinities are forbidden.
- Timestamps and observation IDs are excluded from computational hashes.
- All maps are encoded as JSON objects but are hashed with RFC 8785 key ordering. Arrays are
  ordered only where this contract says order is semantic.

## PartDocument

The canonical persisted shape is:

```json
{
  "schema_version": "forge.part-document/1",
  "document_id": "part:bracket",
  "revision": {
    "revision_id": "rev:<content-address>",
    "parent_revision_ids": ["rev:<parent>"],
    "actor_id": "actor:<opaque>",
    "intent": "Increase bracket width",
    "authorization_ref": "authorization:<opaque-or-null>"
  },
  "units": {"length": "mm", "angle": "deg"},
  "parameters": {},
  "operations": [],
  "semantic_references": {}
}
```

`parameters` and `semantic_references` are keyed by their own stable IDs. `operations` is a
semantically ordered list and must also form a valid directed acyclic graph through
`depends_on`. Duplicate IDs, missing dependencies, cycles, forward dependencies, and unknown
operation type/version pairs fail closed with stable diagnostic codes.

`document_hash` is the SHA-256 of the RFC 8785 canonical revision payload:
`schema_version`, `document_id`, ordered `parent_revision_ids`, actor/intent/authorization,
units, parameters, operations, and semantic references, with `revision_id` itself omitted.
`revision_id` is exactly `rev:<document_hash>`. Wall-clock timestamps, recompute results,
viewport data, and exports are not part of this hash.

## Parameter and expression store

A parameter is exactly one of a literal or expression:

```json
{
  "parameter_id": "param:width",
  "name": "width",
  "value_type": "LENGTH",
  "literal": "40",
  "expression": null
}
```

```json
{
  "parameter_id": "param:half_width",
  "name": "half_width",
  "value_type": "LENGTH",
  "literal": null,
  "expression": {
    "kind": "BINARY",
    "operator": "DIVIDE",
    "left": {"kind": "PARAMETER", "parameter_id": "param:width"},
    "right": {"kind": "SCALAR", "value": "2", "value_type": "SCALAR"}
  }
}
```

Frozen `value_type` values are `SCALAR | LENGTH | ANGLE | INTEGER | BOOLEAN | STRING`.
Frozen expression nodes are:

- `SCALAR { value, value_type }`
- `BOOLEAN { value }`
- `STRING { value }`
- `PARAMETER { parameter_id }`
- `UNARY { operator: NEGATE | ABS, operand }`
- `BINARY { operator: ADD | SUBTRACT | MULTIPLY | DIVIDE | MIN | MAX, left, right }`

Expression dependencies must be acyclic. Type/unit errors, division by zero, missing
parameters, unsupported nodes, and non-finite results fail with stable codes before geometry
execution. Arbitrary source, `eval`, callbacks, and environment access are forbidden.

## Typed operation DAG and registry

Every operation has the common envelope:

```json
{
  "operation_id": "op:extrude",
  "type": "solid.extrude",
  "type_version": 1,
  "depends_on": ["op:sketch"],
  "parameter_bindings": {"distance": "param:thickness"},
  "input_references": ["ref:closed-profile"],
  "payload": {},
  "enabled": true
}
```

The public registry accepts `OperationDescriptor` values:

```json
{
  "type": "solid.extrude",
  "type_version": 1,
  "payload_schema": {},
  "parameter_slots": {"distance": "LENGTH"},
  "input_kinds": ["WIRE"],
  "output_roles": ["result", "cap:start", "cap:end", "side:*"],
  "determinism": "REQUIRED"
}
```

Registry dispatch is by the exact `(type, type_version)` pair. Adding an operation registers a
descriptor and handler without modifying a central evaluator. Duplicate registration,
unknown type/version, invalid payload, missing parameter slot, input-kind mismatch, and handler
failure return stable diagnostic codes. Operation payloads must round-trip losslessly.

The six-hour target requires the registry mechanism plus only the coherent operation path that
can be evidenced. The contract admits, but does not claim implementation of, version-1 types
under these namespaces: `primitive.*`, `sketch.*`, `solid.extrude`, `solid.revolve`,
`solid.boolean.*`, `solid.fillet`, `solid.chamfer`, `transform.*`, `pattern.*`, and
`exchange.import.*`. Unsupported descriptors remain explicit `TARGET`, never silent no-ops.

`operation_hash` is SHA-256 over the canonical operation envelope plus resolved parameter
values, resolved input semantic IDs, and dependency operation hashes. It excludes kernel
objects, iteration order, timestamps, and diagnostics text.

## Stable semantic references

A durable reference records intent and lineage, never a face/edge/triangle ordinal:

```json
{
  "reference_id": "ref:top-edge",
  "producer_operation_id": "op:extrude",
  "entity_kind": "EDGE",
  "semantic_role": "side:outer/top",
  "lineage": [
    {"operation_id": "op:sketch", "event": "GENERATED", "source_reference_id": "ref:profile-top"},
    {"operation_id": "op:extrude", "event": "GENERATED", "source_reference_id": "ref:profile-top"}
  ],
  "expected_cardinality": "ONE"
}
```

Frozen entity kinds are `VERTEX | EDGE | WIRE | FACE | SHELL | SOLID | COMPOUND | MESH`.
Frozen lineage events are `GENERATED | MODIFIED | PRESERVED`. Kernel output resolves each
reference as `EXACT | HEURISTIC_CONFIRMED | AMBIGUOUS | MISSING | DELETED`. Only `EXACT` and a
separately recorded human-confirmed `HEURISTIC_CONFIRMED` may feed an automatic downstream
operation. Ambiguous, missing, or deleted references fail the consuming operation and block its
dependents. Any kernel-local handle or transient ordinal is non-persisted evidence only.

## Deterministic recompute and last-valid preservation

`KernelProjection` contains exactly `schema_version`, `document_id`, `revision_id`,
`document_hash`, units, parameters, operations, semantic references, and an `engine_manifest`
with adapter, binding, kernel, solver, toolchain/platform image, tolerances, and deterministic
settings. Core rejects a projection whose recomputed document hash or derived revision ID does
not match the supplied identity.

`KernelResult` has this boundary shape:

```json
{
  "protocol_version": "forge.kernel-result/1",
  "document_id": "part:bracket",
  "attempted_revision_id": "rev:<attempt>",
  "document_hash": "<sha256>",
  "status": "FAILED",
  "transitions": [
    {"sequence": 0, "state": "QUEUED", "diagnostic_code": null},
    {"sequence": 1, "state": "RUNNING", "diagnostic_code": null},
    {"sequence": 2, "state": "FAILED", "diagnostic_code": "PARAMETER_NEGATIVE_LENGTH"}
  ],
  "operation_results": [],
  "current_artifact": null,
  "last_valid_artifact": {
    "artifact_id": "artifact:<sha256>",
    "producing_revision_id": "rev:<prior>",
    "content_hash": "<sha256>",
    "semantic_fingerprint": "<sha256>"
  },
  "diagnostics": []
}
```

Attempt states are `QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED | TIMED_OUT | WORKER_CRASHED | STALE`.
Transitions have contiguous zero-based sequence numbers. Operation
results are in document order and have `PENDING | SUCCEEDED | FAILED | BLOCKED` status, exact
operation hash, diagnostics, semantic resolutions, and optional artifact reference.

Recompute is transactional. Only `SUCCEEDED` may set `current_artifact`. Every other terminal
state leaves it null and may point to a separately labeled `last_valid_artifact` carrying its
own producing revision. Failure never changes canonical input, never relabels the attempted
revision successful, and survives serialize/restart. Dependents of a failed operation are
`BLOCKED`, not executed against stale geometry.

Under the same projection and engine manifest, fresh processes must produce identical document
and operation hashes, ordered states/codes, topology resolution, and semantic geometry
fingerprint. Raw STEP bytes are outside this equality unless writer canonicalization is proven.

## Persistence envelope

Persist one `PartRevision` as:

```json
{
  "protocol_version": "forge.part-revision/1",
  "part_document": {},
  "document_hash": "<sha256>",
  "kernel_result": {},
  "artifacts": [],
  "provenance": {
    "parent_revision_ids": [],
    "actor_id": "actor:<opaque>",
    "authorization_ref": "authorization:<opaque-or-null>",
    "engine_manifest_hash": "<sha256>"
  }
}
```

Deserialize validates schema version, all hashes, DAG and expression acyclicity, referential
integrity, units/types, registry availability, and artifact provenance before recompute.
Malformed data and unsupported versions fail closed. Unknown JSON fields may be retained for a
same-major-version round trip but cannot affect execution until a registered descriptor declares
them. No executable code, absolute path, secret, prompt, or transcript body is persisted.

## Viewport protocol

The browser consumes only a `ViewportPacket` derived from a kernel result:

```json
{
  "protocol_version": "forge.viewport/1",
  "document_id": "part:bracket",
  "requested_revision_id": "rev:<attempt>",
  "displayed_revision_id": "rev:<producing>",
  "display_state": "LAST_VALID",
  "source_artifact_id": "artifact:<sha256>",
  "source_artifact_hash": "<sha256>",
  "mesh": {
    "positions": [],
    "normals": [],
    "indices": []
  },
  "entity_ranges": [
    {
      "primitive": "TRIANGLE",
      "start": 0,
      "count": 12,
      "entity_id": "entity:<stable>",
      "semantic_reference_id": "ref:top-face",
      "feature_id": "op:extrude"
    }
  ],
  "diagnostics": []
}
```

`display_state` is `CURRENT | LAST_VALID | STALE | UNAVAILABLE`. `CURRENT` requires requested
and displayed revisions to match a succeeded result. `LAST_VALID` requires them to differ and
must remain visibly labeled. `STALE` cannot accept edits as though current. Mesh buffer indexes
are display ranges only; selection resolves through `entity_ranges` to stable semantic and
feature IDs. Browser fallback, network/worker failure, keyboard selection, and review-only mobile
must preserve the same truth labels.

## STEP/STL exchange

An exchange request binds exact geometry truth:

```json
{
  "protocol_version": "forge.exchange/1",
  "request_id": "exchange:<opaque>",
  "direction": "EXPORT",
  "format": "STEP",
  "source_revision_id": "rev:<succeeded>",
  "source_artifact_id": "artifact:<sha256>",
  "units": "mm",
  "options": {}
}
```

`direction` is `IMPORT | EXPORT`; `format` is `STEP | STL`. `ExchangeResult` records request,
status `SUCCEEDED | FAILED`, exact engine manifest hash, content hash, semantic fingerprint,
byte length, units, diagnostics, and verification. STEP export verification requires real-kernel
re-import, shape validity, declared units, mass/topology checks, and tolerances. STL verification
requires parse, non-empty triangles, watertightness, orientation, bounds, and tessellation
tolerances. STL import is a mesh artifact and never silently becomes exact B-rep authority.
Fixture bytes or mocks establish only adapter behavior.

## Frozen diagnostic minimum

Codes are stable machine identifiers; human text is supplemental. Each lane must preserve at
least these relevant codes:

`SCHEMA_UNSUPPORTED`, `HASH_MISMATCH`, `DUPLICATE_ID`, `DEPENDENCY_MISSING`,
`DEPENDENCY_CYCLE`, `PARAMETER_MISSING`, `PARAMETER_CYCLE`, `PARAMETER_TYPE_MISMATCH`,
`PARAMETER_DIVIDE_BY_ZERO`, `PARAMETER_NON_FINITE`, `OPERATION_UNKNOWN`,
`OPERATION_VERSION_UNSUPPORTED`, `OPERATION_PAYLOAD_INVALID`, `OPERATION_INPUT_INVALID`,
`OPERATION_HANDLER_FAILED`, `SEMANTIC_REFERENCE_AMBIGUOUS`, `SEMANTIC_REFERENCE_MISSING`,
`SEMANTIC_REFERENCE_DELETED`, `DEPENDENCY_BLOCKED`, `ARTIFACT_STALE`,
`EXCHANGE_IMPORT_FAILED`, and `EXCHANGE_VERIFICATION_FAILED`.

## Six-hour composition gate

The integrated candidate is coherent only if one exact document/revision crosses the real path:

1. history persists and proposes a typed parameter change;
2. core validates, resolves, recomputes, and emits a real result/artifact;
3. browser renders its viewport packet and maps selection to stable IDs;
4. an invalid edit remains failed while the prior artifact is visibly last-valid;
5. STEP and STL export verification bind the same succeeded revision; and
6. accept/reject/rollback and replay preserve exact hashes and provenance.

Lane-local mocks are useful contract tests but prove only `TARGET` integration. Unsupported breadth
is reported plainly; it does not block the smallest evidenced vertical spine.
