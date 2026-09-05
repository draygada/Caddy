# Frozen cross-lane contract: PartDocument and AssemblyDocument v1

- Contract ID: `FORGE-PART-DOCUMENT-001`
- Wire version: `forge.part-document/1`
- Contract revision: `2` (supersedes the unaccepted `e7d9737` draft)
- Freeze state: `FROZEN_FOR_6H_CANDIDATE`
- Authority: main integration owner
- Canonical encoding: UTF-8 JSON, RFC 8785 canonicalization, SHA-256 lowercase hex
- Scope: core-kernel, assemblies-configurations, browser-workbench, and history-collaboration
  lanes; multi-body parts, reusable subassembly definitions, configurations and fixed transforms
- Normative hash vectors: `docs/contracts/part-document.v1.test-vectors.json`

This is the smallest shared contract for the six-hour candidate. It freezes names,
ownership, state semantics, and cross-lane messages. A lane may define private
implementation types, but its boundary adapter must emit and accept these wire shapes.
Breaking changes require an integration-owner revision. Lanes return proposed changes in
their handoff rather than editing this file or another lane.

## Ownership and authority

| Record | Writes | Reads | Authority rule |
|---|---|---|---|
| `PartDocument`, `AssemblyDocument`, definition/configuration revisions, and revision envelopes | history-collaboration | all lanes | Canonical typed intent and revision records; never contain executable source |
| `KernelProjection` | history adapter | core-kernel | Pure computational projection of one exact `PartDocument` revision |
| `AssemblyProjection`, resolved occurrence graph, BOM and assembly-result envelope | assemblies-configurations | core-kernel and browser | Assembly/configuration authority; binds exact history records and core receipts |
| `OperationDescriptor` registry | core-kernel | history and browser | Core validates and executes registered operations; consumers treat unknown types as unsupported |
| `KernelResult`, `CoreCompositionReceipt`, `GeometryArtifact`, `ExchangeResult` | core-kernel | history, assemblies and browser | Server kernel is exact B-rep evaluation authority only |
| `ViewportPacket` | core-kernel adapter | browser-workbench | Derived display data only; cannot commit geometry truth |
| proposals, decisions, and revision receipts | history-collaboration | browser and core adapters | Geometry edits are serialized against an exact base revision |

The browser never writes a `KernelResult`, `GeometryArtifact`, semantic resolution, or
exchange verification. The core never invents a revision, actor, authorization, or product-
thread state. History never fabricates geometry success. Presence/comments are outside the
geometry command stream.

The required assembly denominator is a real reusable definition/occurrence graph whose exact
part bodies are evaluated by the server kernel under fixed rigid transforms. A tree, box,
filename, mesh-only mock, or BOM record is not assembly geometry. Production mate solving and
assembly STEP exchange are outside v1; relation metadata cannot move a component unless a
separately admitted solver emits a revision-bound solved-transform receipt.

## Scalar conventions

- Every identifier is an opaque, stable, non-empty string. Array position is never identity.
- Length is millimetres at the kernel boundary; angle is degrees. A document declares both.
- User-authored literals use canonical decimal strings matching
  `^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$`; negative zero is forbidden. Exponents,
  leading zeroes, trailing fractional zeroes, NaN, and infinities are forbidden. Thus `40`,
  `0.5`, and `-2.25` are valid; `40.0`, `4e1`, `.5`, `01`, and `-0` are not.
- Literal decimals are parsed as exact reduced rationals. Resolved numeric values use
  `{ "value_type": <type>, "numerator": <canonical signed integer string>,
  "denominator": <canonical positive integer string> }`, with greatest common divisor one and
  a positive denominator. Zero is always `0/1`.
- `ADD`, `SUBTRACT`, `MIN`, and `MAX` require equal numeric types. `MULTIPLY` permits only
  `SCALAR × X` or `X × SCALAR`. `DIVIDE` permits `X / SCALAR` and equal-type `X / X`, the
  latter yielding `SCALAR`. Other dimensional products are rejected. Arithmetic is exact;
  conversion to kernel binary64 is round-to-nearest, ties-to-even, and the engine manifest
  records that conversion policy.
- Timestamps and observation IDs are excluded from computational hashes.
- All maps are encoded as JSON objects but are hashed with RFC 8785 key ordering. Arrays are
  ordered only where this contract says order is semantic.
- Every boundary envelope below is strict: unlisted fields fail validation unless an operation
  descriptor's payload schema explicitly admits them. A field shown as `null` is required and
  nullable; no other shown field is optional.

## PartDocument

The canonical persisted shape is:

```json
{
  "schema_version": "forge.part-document/1",
  "document_id": "part:bracket",
  "geometry_hash": "<sha256>",
  "revision": {
    "revision_id": "rev:<content-address>",
    "revision_hash": "<sha256>",
    "parent_revision_ids": ["rev:<parent>"],
    "actor_id": "actor:<opaque>",
    "intent": "Increase bracket width",
    "authorization_ref": null
  },
  "units": {"length": "mm", "angle": "deg"},
  "parameters": {},
  "bodies": [],
  "operations": [],
  "semantic_references": {}
}
```

`parameters` and `semantic_references` are keyed by their own stable IDs. `bodies` is sorted by
stable `body_id`. `operations` is a
semantically ordered list and must also form a valid directed acyclic graph through
`depends_on`. Duplicate IDs, missing dependencies, cycles, forward dependencies, and unknown
operation type/version pairs fail closed with stable diagnostic codes.

`geometry_hash` is SHA-256 over the exact `forge.kernel-projection/1` preimage containing
`schema_version`, `document_id`, units, parameters, bodies, operations, and semantic references. The
history-owned `revision_hash` is SHA-256 over the exact `forge.part-document/1` revision
preimage containing `schema_version`, `document_id`, `geometry_hash`, ordered
`parent_revision_ids`, `actor_id`, `intent`, and `authorization_ref`. `revision_id` is exactly
`rev:<revision_hash>`. Core recomputes only `geometry_hash`; history verifies `revision_hash`.
Wall-clock timestamps, results, viewport data, and exports are in neither preimage.

Each `bodies` entry is strict:

```json
{
  "body_id": "body:bracket",
  "name": "Bracket",
  "root_operation_id": "op:fillet",
  "root_semantic_reference_id": "ref:bracket-solid",
  "default_visibility": true,
  "metadata": {},
  "material_mass": {
    "material_ref": null,
    "density_kg_per_mm3": null,
    "mass_override_kg": null
  },
  "bom_identity": null
}
```

`metadata` is a map of string keys to string values. Non-null density/mass values are canonical
decimals and remain declared placeholders until backed by evidence. Non-null `bom_identity` has
exact fields `part_number`, `revision`, `description`, and `unit`, where v1 unit is `EA`.
`root_operation_id` must name an enabled operation in the same body and
`root_semantic_reference_id` must resolve exactly to one `SOLID`. Each succeeded body emits its
own independently valid BREP artifact, bounds, topology counts, mass properties, engine manifest
hash, and semantic fingerprint. A PartDocument may contain two or more bodies without fusing
them; array position is not body identity.

## AssemblyDocument and reusable definitions

The canonical assembly separates immutable part definitions, immutable reusable assembly
definitions, configuration resolution, and the derived exact composition. The persisted shape is:

```json
{
  "schema_version": "forge.assembly-document/1",
  "assembly_id": "assembly:fixture",
  "assembly_content_hash": "<sha256>",
  "assembly_geometry_hash": "<sha256>",
  "revision": {
    "revision_id": "assembly-rev:<sha256>",
    "revision_hash": "<sha256>",
    "parent_revision_ids": [],
    "actor_id": "actor:<opaque>",
    "intent": "Place two brackets and one pin",
    "authorization_ref": null
  },
  "part_definitions": {},
  "assembly_definitions": {},
  "root_assembly_definition_revision_id": "assemblydef-rev:<sha256>",
  "resolved_configuration": {},
  "metadata": {}
}
```

`part_definitions` is keyed by immutable `definition_revision_id`. A strict
`PartDefinitionRevision` is:

```json
{
  "definition_id": "partdef:bracket",
  "definition_revision_id": "partdef-rev:<sha256>",
  "definition_revision_hash": "<sha256>",
  "part_document_id": "part:bracket",
  "part_revision_id": "rev:<sha256>",
  "part_geometry_hash": "<sha256>",
  "body_bindings": [
    {
      "body_id": "body:bracket",
      "brep_artifact_id": "artifact:<sha256>",
      "brep_content_hash": "<sha256>",
      "semantic_fingerprint": "<sha256>"
    }
  ],
  "metadata": {},
  "material_mass": {
    "material_ref": null,
    "density_kg_per_mm3": null,
    "mass_override_kg": null
  },
  "bom_identity": {
    "part_number": "BRACKET-001",
    "revision": "A",
    "description": "Fixture bracket",
    "unit": "EA"
  }
}
```

`definition_revision_hash` is SHA-256 over the full RFC 8785 definition with
`definition_revision_id` and `definition_revision_hash` omitted; the ID is exactly
`partdef-rev:<definition_revision_hash>`. `body_bindings` is non-empty, sorted by `body_id`, and
binds real independently valid BREP artifacts from the exact part revision. Definitions are
reused by reference: an assembly never copies a PartDocument or BREP payload into a component to
simulate reuse. Definition metadata uses string values. Material/mass fields are canonical-
decimal placeholders and do not become verified properties without kernel/source evidence.

`assembly_definitions` is keyed by immutable `definition_revision_id`. A strict
`AssemblyDefinitionRevision` is:

```json
{
  "definition_id": "assemblydef:clamp-pair",
  "definition_revision_id": "assemblydef-rev:<sha256>",
  "definition_revision_hash": "<sha256>",
  "components": [],
  "metadata": {},
  "bom_identity": null
}
```

Its hash is SHA-256 over the full RFC 8785 object with `definition_revision_id` and
`definition_revision_hash` omitted; its ID is exactly
`assemblydef-rev:<definition_revision_hash>`. Each component ID is local to this definition.
An assembly definition may target part or assembly definition revisions, but the directed
definition graph must be acyclic. Reusing one assembly definition revision twice does not copy,
rename, or globalize its child component IDs.

Every local component definition is strict:

```json
{
  "component_id": "component:bracket-left",
  "target_definition_kind": "PART",
  "target_definition_id": "partdef:bracket",
  "target_definition_revision_id": "partdef-rev:<sha256>",
  "multiplicity": 1,
  "nominal_transform": {
    "matrix4x4_row_major": [
      "1", "0", "0", "-25",
      "0", "1", "0", "0",
      "0", "0", "1", "0",
      "0", "0", "0", "1"
    ]
  },
  "default_composition_state": "INCLUDED",
  "default_visibility_state": "VISIBLE",
  "default_bom_state": "INCLUDED",
  "relation_ids": [],
  "metadata": {}
}
```

`target_definition_kind` is exactly `PART | ASSEMBLY` and must agree with the referenced map and
definition ID/revision pair. `multiplicity` is a positive integer. Components sort
lexicographically by local `component_id`; duplicate local IDs, missing/stale targets, kind
mismatches, definition cycles, and invalid transforms fail closed. A resolved occurrence identity
is the full ordered `occurrence_path` of local component IDs from the root definition. Thus two
uses of the same subassembly share child local IDs but have distinct full paths.

The exact resolved configuration is strict:

```json
{
  "schema_version": "forge.resolved-configuration/1",
  "configuration_id": "configuration:default",
  "configuration_revision_id": "configuration-rev:<sha256>",
  "configuration_revision_hash": "<sha256>",
  "parent_revision_ids": [],
  "actor_id": "actor:<opaque>",
  "intent": "Resolve default configuration",
  "authorization_ref": null,
  "name": "Default",
  "base_assembly_definition_revision_id": "assemblydef-rev:<sha256>",
  "overrides": [],
  "resolved_configuration_hash": "<sha256>",
  "resolved_configuration_id": "configuration-resolved:<sha256>"
}
```

`configuration_revision_hash` uses the same history-owned parent/actor/intent/authorization
preimage rule as document revisions and additionally binds stable configuration ID, display name,
exact base definition revision and ordered overrides; its ID is
`configuration-rev:<configuration_revision_hash>`. `resolved_configuration_hash` is SHA-256 over
`schema_version`, exact base definition revision,
and the canonical ordered `overrides`; display `name`, moving heads, and hidden file copies are
not identity. `resolved_configuration_id` is exactly
`configuration-resolved:<resolved_configuration_hash>`. Every override has a stable
`override_id`, typed `override_kind`, exact target (stable parameter/feature ID or full occurrence
path), and typed `value`. Unknown/stale/ambiguous targets and conflicting overrides reject the
configuration. Supported assembly-state overrides remain disjoint:

- `SUPPRESSED` removes the occurrence and descendants from resolved composition and normal BOM.
- `HIDDEN` is display-only and does not alter composition or BOM.
- `EXCLUDED_FROM_BOM` affects BOM only and does not remove exact geometry.
- nominal-transform overrides change only the exact targeted occurrence in this configuration.

An `ExplodedState` is a separate derived presentation record bound to exact assembly revision and
resolved-configuration hashes. Its per-occurrence rigid `exploded_transform` never changes the
nominal/solved placement, assembly geometry hash, relation result, or BOM.

Nominal transforms are fixed local-to-parent rigid transforms. The matrix has exactly 16 canonical
decimal strings; its last row is exactly `0,0,0,1`. The upper 3×3 must be orthonormal with
determinant +1 within the manifest angular tolerance, and all values must be finite. Parent-to-
child multiplication uses exact rationals before the declared binary64 conversion. Non-rigid
scale/shear/reflection is rejected. A result preserves both `nominal_transform` and nullable
`solved_transform`, with `placement_source: FIXED | SOLVED`. v1 requires `FIXED`, a null solved
transform, and exact nominal world-transform composition. Relation metadata cannot silently
change placement. Occurrence/configuration state never mutates a reused definition.

`assembly_content_hash` is SHA-256 over the exact RFC 8785 `forge.assembly-content/1` preimage
containing `assembly_id`, complete part/assembly definition maps, root definition revision,
complete resolved configuration, and metadata. `assembly_geometry_hash` is SHA-256 over the
exact RFC 8785 `forge.assembly-composition/1` preimage containing only active resolved occurrence
paths, typed target definition revisions, multiplicity-expanded instance ordinals, and nominal
world transforms. Hidden and BOM-only state do not change it; suppression and nominal placement
do. The history-owned assembly revision hash binds `assembly_id`, `assembly_content_hash`,
`assembly_geometry_hash`, `resolved_configuration_hash`, ordered parents, actor, intent, and
authorization. The revision ID is `assembly-rev:<revision_hash>`.

`AssemblyProjection` carries the exact content/composition preimages plus `source_revision_id`,
both hashes, complete strict BREP `GeometryArtifact` transports for every unique part-body
binding, and the strict engine manifest. Assemblies-configurations resolves definition reuse,
configuration state, occurrence paths and BOM. Core recomputes only the exact B-rep composition
and emits a `CoreCompositionReceipt` bound to the input assembly-geometry hash; it cannot author
occurrences, configurations, suppression, BOM or assembly revision truth.

`AssemblyResult` is strict:

```json
{
  "protocol_version": "forge.assembly-result/1",
  "assembly_id": "assembly:fixture",
  "attempted_revision_id": "assembly-rev:<sha256>",
  "assembly_content_hash": "<sha256>",
  "assembly_geometry_hash": "<sha256>",
  "resolved_configuration_id": "configuration-resolved:<sha256>",
  "engine_manifest_hash": "<sha256>",
  "status": "SUCCEEDED",
  "transitions": [],
  "core_composition_receipt": {},
  "component_results": [],
  "bom_result": {
    "protocol_version": "forge.bom-result/1",
    "assembly_revision_id": "assembly-rev:<sha256>",
    "assembly_geometry_hash": "<sha256>",
    "bom_hash": "<sha256>",
    "lines": []
  },
  "current_composition": {
    "assembly_revision_id": "assembly-rev:<sha256>",
    "assembly_geometry_hash": "<sha256>",
    "component_result_hash": "<sha256>",
    "bom_hash": "<sha256>"
  },
  "last_valid_composition": null,
  "diagnostics": []
}
```

Transitions and diagnostics use the kernel-result records. Each resolved component result has
exact fields `occurrence_path`, local `component_id`, target kind/ID/revision, `instance_ordinal`,
`nominal_transform`, nullable `solved_transform`, `placement_source`, `world_transform`, the three
disjoint resolved states, `body_instances`, and `diagnostics`. Each body instance has exact fields
`body_id`, `source_brep_artifact_id`, `source_semantic_fingerprint`, `valid`, `world_bounds_mm`,
and `world_centroid_mm`. Bounds/centroids are canonical decimals after normalized kernel
measurement. Results sort lexicographically by full occurrence path, then instance ordinal and
body ID. The fixture must reuse one subassembly definition at least twice without copying its
children and resolve at least two independently valid B-rep body instances.

`component_result_hash` is SHA-256 over the RFC 8785 ordered component-results array. The BOM
result has exact top-level fields `protocol_version`, `assembly_revision_id`,
`assembly_geometry_hash`, `bom_hash`, and `lines`. Each line has exact fields `bom_line_id`,
`definition_id`, `definition_revision_id`, `part_revision_id`, `part_geometry_hash`, `body_ids`,
`part_number`, `revision`, `description`, `quantity`, `unit`, `resolved_configuration_id`,
`effectivity`, and `source_occurrence_paths`. Lines sort by exact item/definition revision,
configuration and effectivity keys. Quantity is the product of multiplicities across all included
resolved subassembly paths. Hidden occurrences remain; suppressed and excluded-from-BOM
occurrences do not. Grouping by label or mutable row number is forbidden. `bom_hash` is SHA-256
over the RFC 8785 lines array, and `bom_line_id` is
`bom:<sha256>` over the line with ID omitted.

Mass aggregation records `COMPLETE | INCOMPLETE`, exact density/mass source or override
provenance, transformed center of mass and inertia. Unknown density/mass is `INCOMPLETE`, never
numeric zero. Geometry analysis classifies positive common volume above tolerance as
`INTERFERENCE`, zero/near-zero separation within the pinned tolerance as `CONTACT`, and positive
separation above tolerance as `CLEARANCE`, with exact occurrence/body refs and witness geometry.

Assembly recompute is transactional like part recompute. Only SUCCEEDED has
`current_composition`; failures preserve a separately revision-bound `last_valid_composition`.
Fresh-process replay under the same manifest must preserve definition/configuration/assembly
hashes, occurrence paths and transforms, body fingerprints, normalized world bounds, recursive
BOM, and state/diagnostic order. Failed recompute retains a producing-revision-labelled last-valid
analysis; it is never relabelled current. Fixed transforms are mandatory. No general mate solver,
kinematics, flexible component, imported hierarchy, or production assembly claim is implied.

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
execution. `INTEGER` literals must have denominator one. `BOOLEAN` and `STRING` do not enter
numeric operators. Arbitrary source, `eval`, callbacks, and environment access are forbidden.

## Typed operation DAG and registry

Every operation has the common envelope:

```json
{
  "operation_id": "op:extrude",
  "body_id": "body:bracket",
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
  "protocol_version": "forge.operation-descriptor/1",
  "type": "solid.extrude",
  "type_version": 1,
  "display": {
    "label": "Extrude",
    "category": "Solid",
    "description": "Create a solid from a closed profile"
  },
  "payload_schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  },
  "payload_fields": [],
  "parameter_slots": [
    {
      "slot": "distance",
      "label": "Distance",
      "value_type": "LENGTH",
      "required": true,
      "default_literal": "10",
      "minimum_literal": "0.000001",
      "maximum_literal": null,
      "step_literal": "1",
      "order": 0
    }
  ],
  "input_kinds": ["WIRE"],
  "output_roles": ["result", "cap:start", "cap:end", "side:*"],
  "determinism": "REQUIRED"
}
```

Registry dispatch is by the exact `(type, type_version)` pair. Adding an operation registers a
descriptor and handler without modifying a central evaluator. Duplicate registration,
unknown type/version, invalid payload, missing parameter slot, input-kind mismatch, and handler
failure return stable diagnostic codes. Operation payloads must round-trip losslessly.

`protocol_version` is fixed at `forge.operation-descriptor/1`. `payload_schema` is strict JSON
Schema Draft 2020-12 and must declare the exact `$schema` URI,
root `type: object`, a `required` array, and `additionalProperties: false`. Each entry in
`payload_fields` has exact fields `json_pointer`, `label`, `control`, `required`, `order`, and
`options`; `control` is `NUMBER | TEXT | BOOLEAN | SELECT | ENTITY_REFERENCE`, and `options` is
an ordered array of `{ "value": <JSON scalar>, "label": <string> }`. The pointer must address a
declared payload property. `parameter_slots` and `payload_fields` are sorted by unique `order`.
This metadata is sufficient for generic proposal UI; the handler ABI remains core-private.

The six-hour target requires the registry mechanism plus only the coherent operation path that
can be evidenced. The contract admits, but does not claim implementation of, version-1 types
under these namespaces: `primitive.*`, `sketch.*`, `solid.extrude`, `solid.revolve`,
`solid.boolean.*`, `solid.fillet`, `solid.chamfer`, `transform.*`, `pattern.*`, and
`exchange.import.*`. Unsupported descriptors remain explicit `TARGET`, never silent no-ops.

`operation_hash` is SHA-256 over this exact RFC 8785 preimage:

```json
{
  "schema_version": "forge.operation-hash/1",
  "operation": {},
  "resolved_parameters": {},
  "input_semantic_ids": [],
  "dependency_operation_hashes": []
}
```

`operation` is the complete common envelope shown above. `resolved_parameters` is keyed by
slot and contains the reduced-rational object defined under Scalar conventions.
`input_semantic_ids` follows `input_references` order and contains the resolved stable
`entity_id` strings.
`dependency_operation_hashes` follows `depends_on` order. Kernel objects, timestamps, and
diagnostic text are excluded. Normative byte strings and digests are in
`docs/contracts/part-document.v1.test-vectors.json`.

## Stable semantic references

A durable reference records intent and lineage, never a face/edge/triangle ordinal:

```json
{
  "reference_id": "ref:top-edge",
  "body_id": "body:bracket",
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
reference with this strict record:

```json
{
  "reference_id": "ref:top-edge",
  "entity_id": "entity:<sha256>",
  "body_id": "body:bracket",
  "entity_kind": "EDGE",
  "producing_operation_id": "op:extrude",
  "status": "EXACT",
  "matched_entity_count": 1,
  "diagnostic_code": null
}
```

`entity_id` is `entity:<sha256>` over the RFC 8785 object
`{ "document_id", "body_id", "semantic_reference_id", "entity_kind" }`, so buffer or kernel iteration
order cannot change identity. Resolution status is `EXACT | HEURISTIC_CONFIRMED | AMBIGUOUS |
MISSING | DELETED`; `entity_id` is null unless status is `EXACT` or
`HEURISTIC_CONFIRMED`. The six-hour v1 path admits only `EXACT` as an automatic downstream
input. `HEURISTIC_CONFIRMED` remains an observable future state but is rejected for execution
with `SEMANTIC_REFERENCE_CONFIRMATION_UNSUPPORTED` because v1 intentionally defines no human-
confirmation receipt. Ambiguous, missing, deleted, or heuristic references fail the consuming
operation and block dependents. Any kernel-local handle or transient ordinal is non-persisted
evidence only.

## Deterministic recompute and last-valid preservation

`KernelProjection` is the strict object below. It carries the history-owned source identity but
does not ask core to reconstruct that identity:

```json
{
  "schema_version": "forge.kernel-projection/1",
  "document_id": "part:bracket",
  "source_revision_id": "rev:<history-hash>",
  "geometry_hash": "<sha256>",
  "units": {"length": "mm", "angle": "deg"},
  "parameters": {},
  "bodies": [],
  "operations": [],
  "semantic_references": {},
  "engine_manifest": {
    "schema_version": "forge.engine-manifest/1",
    "adapter": "ocp",
    "binding": "OCP@<exact>",
    "kernel": "OCCT@<exact>",
    "solver": "<name>@<exact>",
    "toolchain": "<exact>",
    "platform_image": "sha256:<digest>",
    "tolerances": {"linear_mm": "0.000001", "angular_deg": "0.000001"},
    "deterministic_settings": {"parallel": false}
  }
}
```

The `geometry_hash` preimage is the projection with `source_revision_id`, `geometry_hash`, and
`engine_manifest` omitted. The engine manifest hash is SHA-256 over the complete RFC 8785
manifest object. Core rejects a mismatched geometry hash; history verifies that
`source_revision_id` names a revision whose stored geometry hash is identical. Manifest keys
inside `deterministic_settings` are versioned by the manifest schema and must be JSON scalars.

`KernelResult` has this boundary shape:

```json
{
  "protocol_version": "forge.kernel-result/1",
  "document_id": "part:bracket",
  "attempted_revision_id": "rev:<attempt>",
  "geometry_hash": "<sha256>",
  "engine_manifest_hash": "<sha256>",
  "status": "FAILED",
  "transitions": [
    {"sequence": 0, "state": "QUEUED", "diagnostic_code": null},
    {"sequence": 1, "state": "RUNNING", "diagnostic_code": null},
    {"sequence": 2, "state": "FAILED", "diagnostic_code": "PARAMETER_NEGATIVE_LENGTH"}
  ],
  "operation_results": [],
  "semantic_resolutions": [],
  "body_results": [],
  "current_artifact": null,
  "last_valid_artifact": {
    "artifact_id": "artifact:<sha256>",
    "producing_revision_id": "rev:<prior>",
    "geometry_hash": "<sha256>",
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

Each `operation_results` entry has exact fields `operation_id`, `operation_hash`, `status`,
`artifact_id` (nullable), `diagnostics`, and `semantic_resolutions`. Each diagnostic has exact
fields `code`, `severity` (`INFO | WARNING | ERROR`), `message`, `operation_id` (nullable), and
`reference_id` (nullable). `semantic_resolutions` uses the strict record above. Both
`current_artifact` and `last_valid_artifact` are nullable strict pointers with exact fields
`artifact_id`, `producing_revision_id`, `geometry_hash`, `content_hash`, and
`semantic_fingerprint`. These pointers never carry bytes; the artifact transport below does.

Each `body_results` entry has exact fields `body_id`, `status` (`SUCCEEDED | FAILED |
BLOCKED`), `brep_artifact` (nullable artifact pointer), `valid`, `bounds_mm`,
`mass_properties`, `topology_counts`, `semantic_fingerprint` (nullable), and `diagnostics`.
Bounds, mass properties, topology counts, and diagnostics use the strict fingerprint/common
records defined below. A succeeded body requires a non-null BREP pointer, `valid: true`, and a
fingerprint. Failed or blocked bodies cannot borrow another body's artifact. For a successful
multi-body result, every declared body has one independently checked result.

Recompute is transactional. Only `SUCCEEDED` may set `current_artifact`. Every other terminal
state leaves it null and may point to a separately labeled `last_valid_artifact` carrying its
own producing revision. Failure never changes canonical input, never relabels the attempted
revision successful, and survives serialize/restart. Dependents of a failed operation are
`BLOCKED`, not executed against stale geometry.

Under the same projection and engine manifest, fresh processes must produce identical geometry
and operation hashes, ordered states/codes, topology resolution, and semantic geometry
fingerprint. Raw STEP bytes are outside this equality unless writer canonicalization is proven.

## Persistence envelope

Persist one `PartRevision` as:

```json
{
  "protocol_version": "forge.part-revision/1",
  "part_document": {
    "schema_version": "forge.part-document/1",
    "document_id": "part:test",
    "geometry_hash": "581f842568b1ed35d1de04a0bd9a666f06b20b395eff7d7149be8a55ec5fb3de",
    "revision": {
      "revision_id": "rev:26e436d1021a3702d736383c0c4f10c6b03924ab6693cf2c12a888bfd661a9f0",
      "revision_hash": "26e436d1021a3702d736383c0c4f10c6b03924ab6693cf2c12a888bfd661a9f0",
      "parent_revision_ids": [],
      "actor_id": "actor:test",
      "intent": "test",
      "authorization_ref": null
    },
    "units": {"length": "mm", "angle": "deg"},
    "parameters": {},
    "bodies": [],
    "operations": [],
    "semantic_references": {}
  },
  "revision_hash": "26e436d1021a3702d736383c0c4f10c6b03924ab6693cf2c12a888bfd661a9f0",
  "geometry_hash": "581f842568b1ed35d1de04a0bd9a666f06b20b395eff7d7149be8a55ec5fb3de",
  "kernel_result": null,
  "artifacts": [],
  "provenance": {
    "parent_revision_ids": [],
    "actor_id": "actor:<opaque>",
    "authorization_ref": "authorization:<opaque-or-null>",
    "engine_manifest_hash": "<sha256>"
  }
}
```

`part_document` is the complete strict `PartDocument`; `kernel_result` is null or the complete
strict `KernelResult`; and every `artifacts` item is the complete strict `GeometryArtifact`
defined below. `revision_hash` and `geometry_hash` must equal the embedded document values.

Deserialize validates schema version, all hashes, DAG and expression acyclicity, referential
integrity, units/types, registry availability, and artifact provenance before recompute.
Malformed data, unsupported versions, and unknown envelope fields fail closed. Only an operation
`payload` may contain descriptor-declared fields, and it is validated by that descriptor before
execution. No executable code, absolute path, secret, prompt, or transcript body is persisted.

## Geometry artifacts and transport

`GeometryArtifact` is the strict descriptor plus payload and verification envelope:

```json
{
  "protocol_version": "forge.geometry-artifact/1",
  "descriptor": {
    "artifact_id": "artifact:<sha256>",
    "artifact_kind": "BREP",
    "source_revision_id": "rev:<sha256>",
    "geometry_hash": "<sha256>",
    "body_id": "body:bracket",
    "producing_operation_id": "op:extrude",
    "engine_manifest_hash": "<sha256>",
    "media_type": "application/vnd.opencascade.brep",
    "byte_length": 1234,
    "content_hash": "<sha256-of-raw-bytes>",
    "semantic_fingerprint": "<sha256>"
  },
  "payload": {"encoding": "INLINE_BASE64", "data": "<base64>"},
  "verification": {"status": "NOT_RUN", "checks": []}
}
```

`artifact_kind` is `BREP | MESH | STEP | STL`. `body_id`, `producing_operation_id`, and
`semantic_fingerprint` are nullable only when source semantics do not exist. `payload` is either
the inline form above or `{ "encoding": "OMITTED", "data": null }`; an exchange result used in
the integrated six-hour path must be inline. Base64 is RFC 4648 standard alphabet with required
padding and no whitespace. Decoded bytes must match `byte_length` and `content_hash`.

The `artifact_id` is `artifact:<artifact_record_hash>`. `artifact_record_hash` is SHA-256 over
the RFC 8785 descriptor fields with `artifact_id` omitted and with
`schema_version: forge.artifact/1` replacing the transport protocol field. Payload and
verification are excluded, while content identity remains bound by `content_hash`.

`verification.status` is `PASSED | FAILED | NOT_RUN`. Every check has exact fields `code`,
`status` (`PASSED | FAILED`), `observed` (string or null), `expected` (string or null), and
`tolerance` (canonical decimal string or null). A failed check makes the overall status failed.

The `semantic_fingerprint` is SHA-256 over this strict RFC 8785 preimage:

```json
{
  "schema_version": "forge.semantic-fingerprint/1",
  "units": {"length": "mm", "angle": "deg"},
  "bounds_mm": {"min": ["0", "0", "0"], "max": ["1", "1", "1"]},
  "mass_properties": {"area_mm2": "6", "volume_mm3": "1"},
  "topology_counts": {"VERTEX": 8, "EDGE": 12, "FACE": 6, "SOLID": 1},
  "entities": [{"semantic_reference_id": "ref:result", "entity_kind": "SOLID"}]
}
```

Metric values use canonical decimals. `topology_counts` contains every observed entity kind as
a non-negative integer. `entities` is sorted by `(semantic_reference_id, entity_kind)` and
contains only exact resolutions. Hash test vectors cover this preimage and the artifact record.

## Viewport protocol

The browser consumes only a `ViewportPacket` derived from a kernel or assembly result. The same
shape supports a multi-body part and reusable assembly instances without copying definition
geometry:

```json
{
  "protocol_version": "forge.viewport/1",
  "subject_kind": "ASSEMBLY",
  "document_id": "assembly:fixture",
  "requested_revision_id": "assembly-rev:<attempt>",
  "displayed_revision_id": "assembly-rev:<producing>",
  "display_state": "CURRENT",
  "mesh_definitions": [
    {
      "mesh_id": "mesh:bracket-body",
      "part_definition_revision_id": "partdef-rev:<sha256>",
      "body_id": "body:bracket",
      "source_artifact_id": "artifact:<sha256>",
      "source_artifact_content_hash": "<sha256>",
      "mesh": {
        "coordinate_system": {"handedness": "RIGHT", "up_axis": "+Z", "length_unit": "mm"},
        "topology": "TRIANGLES",
        "front_face": "CCW",
        "index_type": "UINT32",
        "positions": [0, 0, 0, 1, 0, 0, 0, 1, 0],
        "normals": [0, 0, 1, 0, 0, 1, 0, 0, 1],
        "indices": [0, 1, 2]
      },
      "semantic_resolutions": [],
      "entity_ranges": []
    }
  ],
  "draw_instances": [
    {
      "draw_instance_id": "draw:bracket-left/body:bracket",
      "component_id": "component:bracket-left",
      "occurrence_path": ["component:clamp-left", "component:bracket-left"],
      "part_definition_id": "partdef:bracket",
      "part_definition_revision_id": "partdef-rev:<sha256>",
      "body_id": "body:bracket",
      "mesh_id": "mesh:bracket-body",
      "world_transform": {
        "matrix4x4_row_major": [
          "1", "0", "0", "-25",
          "0", "1", "0", "0",
          "0", "0", "1", "0",
          "0", "0", "0", "1"
        ]
      },
      "effective_visible": true
    }
  ],
  "diagnostics": []
}
```

`subject_kind` is `PART | ASSEMBLY`; `display_state` is `CURRENT | LAST_VALID | STALE |
UNAVAILABLE`. Current requires requested/displayed revision equality and a succeeded source.
Last-valid requires different exact revisions and a persistent visible label. Stale cannot be
edited as current. For unavailable, displayed revision is null and both geometry arrays are
empty. Browser fallback, worker/network failure, keyboard selection, and mobile review preserve
these truth labels.

Each `mesh_definitions` entry is unique by `mesh_id` and sorted by it. For a part,
`part_definition_revision_id` is null; for an assembly it is exact. The mesh is right-handed
Cartesian, +Z up, millimetres. Positions/normals are flat xyz triplets of finite JSON binary64
numbers; normals are outward and unit length within tolerance. Indices are non-negative UINT32
vertex indexes, and triangles are counter-clockwise from outside.

An entity range has exact fields `primitive: INDEXED_TRIANGLE`, `start`, `count`, `entity_id`,
`semantic_reference_id`, and `feature_id`. Start/count address index-array elements, not bytes or
triangle ordinals; count is divisible by three; ranges sort by `(start, entity_id)`, do not
overlap, and remain in bounds. Every range references an EXACT semantic resolution for the same
body. Mesh/buffer reordering may move a range but cannot change stable entity identity.

Each draw instance references, rather than copies, one mesh definition. Its world transform is
the complete 16-value fixed rigid matrix from assembly composition. For a direct part viewport,
component/definition fields are null, occurrence path is empty, and one identity draw exists per
body. For an assembly they are non-null and occurrence path begins with a local component in the
root definition and ends at the exact nested local component. Reusing one definition twice
produces two draw instances pointing to the same
`mesh_id` with distinct component IDs and transforms.

Selection identity is the exact tuple `(displayed assembly revision or null, occurrence_path,
component_id or null, part_definition_revision_id or null, body_id, semantic_reference_id,
entity_id)`. This distinguishes two instances of one part while preserving part-level semantic
identity. A hidden occurrence removes only its draw; a suppressed occurrence does not appear in
the resolved composition; BOM exclusion does not affect drawing. The same effective visibility
and occurrence tuple apply when a last-valid assembly is displayed after a failed attempt.
Viewport packets and exploded transforms never enter canonical hashes.

## Proposal, diff, review, and rollback protocol

The history-to-browser boundary uses these strict messages. A `ChangeProposal` is:

```json
{
  "protocol_version": "forge.change-proposal/1",
  "proposal_id": "proposal:<opaque>",
  "document_kind": "PART",
  "document_id": "part:bracket",
  "base_revision_id": "rev:<sha256>",
  "base_geometry_hash": "<sha256>",
  "actor_id": "actor:<opaque>",
  "intent": "Increase width",
  "authorization_ref": null,
  "preconditions": [
    {"kind": "PARAMETER_EQUALS", "target_id": "param:width", "expected_hash": "<sha256>"}
  ],
  "changes": [
    {
      "kind": "SET_PARAMETER",
      "target_id": "param:width",
      "value": {
        "parameter_id": "param:width",
        "name": "width",
        "value_type": "LENGTH",
        "literal": "50",
        "expression": null
      }
    }
  ]
}
```

`document_kind` is `PART | ASSEMBLY`; its revision prefix and geometry-hash field must match the
kind. Every precondition has exactly `kind`, `target_id`, and `expected_hash`. `kind` is
`REVISION_EQUALS | PARAMETER_EQUALS | OPERATION_EQUALS | BODY_EQUALS | DEFINITION_EQUALS |
COMPONENT_EQUALS | SEMANTIC_REFERENCE_EXACT`.
The expected hash is SHA-256 over the complete RFC 8785 target object; for
`SEMANTIC_REFERENCE_EXACT`, it is the hash of the strict resolution record.

Every change has exactly `kind`, `target_id`, and `value`. `kind` is `SET_PARAMETER |
UPSERT_OPERATION | REMOVE_OPERATION | UPSERT_BODY | REMOVE_BODY | UPSERT_DEFINITION |
REMOVE_DEFINITION | UPSERT_COMPONENT | REMOVE_COMPONENT | SET_COMPONENT_TRANSFORM |
SET_COMPONENT_VISIBILITY | ROLLBACK_TO_REVISION`. Upserts carry the complete strict target;
removals carry null; transform/visibility changes carry the complete replacement field; rollback
carries `{ "revision_id": <existing immutable revision ID> }`. Part-only kinds are rejected for
assemblies and assembly-only kinds are rejected for parts. Changes are applied in array order to
an isolated candidate, then the whole document is validated and replayed transactionally.

History returns a `SemanticDiff`:

```json
{
  "protocol_version": "forge.semantic-diff/1",
  "proposal_id": "proposal:<opaque>",
  "document_kind": "PART",
  "base_revision_id": "rev:<sha256>",
  "candidate_revision_id": null,
  "changed_parameter_ids": ["param:width"],
  "changed_operation_ids": [],
  "changed_body_ids": [],
  "changed_definition_revision_ids": [],
  "changed_component_ids": [],
  "moved_component_ids": [],
  "visibility_changed_component_ids": [],
  "bom_changed": false,
  "predicted_dependent_operation_ids": ["op:extrude", "op:fillet"],
  "conflicts": []
}
```

IDs in each diff array are unique and sorted lexicographically. Definition changes and occurrence
transform/visibility changes are never collapsed into one generic assembly change. `bom_changed`
is recomputed from definition/add/remove/replace changes; transform and visibility alone cannot
change it. A conflict has exact fields
`code`, `target_ids` (unique sorted strings), `left_proposal_id` (nullable),
`right_proposal_id` (nullable), and `message`; code is `STALE_BASE | PRECONDITION_FAILED |
NONCOMMUTATIVE | REPLAY_DIVERGED`. `candidate_revision_id` is null when conflicts exist and is
the predicted content-addressed revision otherwise.

Each review transition is an append-only `ReviewReceipt`:

```json
{
  "protocol_version": "forge.review-receipt/1",
  "receipt_id": "review:<opaque>",
  "proposal_id": "proposal:<opaque>",
  "document_kind": "PART",
  "document_id": "part:bracket",
  "state": "AUTHORIZED",
  "base_revision_id": "rev:<sha256>",
  "resulting_revision_id": null,
  "actor_id": "actor:<opaque>",
  "authorization_ref": "authorization:<opaque>",
  "reason_code": "HUMAN_APPROVED",
  "previous_receipt_id": "review:<requested>"
}
```

`document_kind` and `document_id` must match the proposal. `state` is `REQUESTED | AUTHORIZED |
APPLIED | VERIFIED | REJECTED | ROLLED_BACK`.
`resulting_revision_id` is non-null only for applied, verified, or rolled-back transitions.
`authorization_ref` is required and nullable; `previous_receipt_id` is null only for REQUESTED.
Application is not inferred to be authorized or verified. Rollback is a new authorized proposal
to an existing immutable revision and never rewrites the superseded history.

Two proposals may auto-compose only when they share the exact base revision, target disjoint
IDs, have disjoint predicted dependency closures, all preconditions still pass, and replay of
both deterministic orders yields the same geometry hash. Otherwise they are noncommutative and
block. This protocol drives generic browser history/review UI; fake-kernel replay proves only
history mechanics.

## STEP/STL exchange

One strict request envelope covers both directions; fields irrelevant to a direction remain
required and null so languages do not infer shape from omissions:

```json
{
  "protocol_version": "forge.exchange/1",
  "request_id": "exchange:<opaque>",
  "direction": "EXPORT",
  "format": "STEP",
  "source_revision_id": "rev:<succeeded>",
  "source_artifact_id": "artifact:<sha256>",
  "source_blob": null,
  "units": "mm",
  "options": {}
}
```

`direction` is `IMPORT | EXPORT`; `format` is `STEP | STL`. Export requires non-null source
revision and artifact IDs plus null `source_blob`. Import requires both source IDs null and this
strict source blob:

```json
{
  "source_id": "source:<opaque>",
  "media_type": "model/step",
  "byte_length": 1234,
  "content_hash": "<sha256>",
  "payload": {"encoding": "INLINE_BASE64", "data": "<base64>"}
}
```

Import bytes obey the same base64, length, and content-hash rules as artifacts. Frozen media
types are `model/step` for STEP and `model/stl` for STL. `options` is strict by format:
STEP admits `{"schema":"AP242"}` where schema is `AP203 | AP214 | AP242`; STL admits
`{"linear_deflection_mm":<canonical decimal>,"angular_deflection_deg":<canonical decimal>,
"binary":<boolean>}`. Import uses `{}` in v1. Unknown options fail closed.

`ExchangeResult` is exact:

```json
{
  "protocol_version": "forge.exchange-result/1",
  "request_id": "exchange:<opaque>",
  "direction": "EXPORT",
  "format": "STEP",
  "status": "FAILED",
  "source_revision_id": "rev:<succeeded>",
  "source_artifact_id": "artifact:<sha256>",
  "engine_manifest_hash": "<sha256>",
  "output_artifact": null,
  "diagnostics": [
    {
      "code": "EXCHANGE_VERIFICATION_FAILED",
      "severity": "ERROR",
      "message": "STEP re-import failed validity check",
      "operation_id": null,
      "reference_id": null
    }
  ],
  "verification": {
    "status": "FAILED",
    "checks": [
      {
        "code": "STEP_REIMPORT_VALID",
        "status": "FAILED",
        "observed": "false",
        "expected": "true",
        "tolerance": null
      }
    ]
  }
}
```

`output_artifact` is the complete strict `GeometryArtifact` on success and is null on failure.
Diagnostics and verification use the common strict records.
On export its kind is STEP or STL and it binds the requested source revision/artifact. On STEP
import its kind is BREP; on STL import its kind is MESH and can never silently become exact
B-rep authority.

STEP export verification requires real-kernel re-import, shape validity, declared units,
mass/topology checks, and tolerances. STL verification requires parse, non-empty triangles,
watertightness, orientation, bounds, and tessellation tolerances. Fixture bytes or mocks
establish only adapter behavior.

## Frozen diagnostic minimum

Codes are stable machine identifiers; human text is supplemental. Each lane must preserve at
least these relevant codes:

`SCHEMA_UNSUPPORTED`, `HASH_MISMATCH`, `DUPLICATE_ID`, `DEPENDENCY_MISSING`,
`DEPENDENCY_CYCLE`, `DECIMAL_INVALID`, `PARAMETER_MISSING`, `PARAMETER_CYCLE`,
`PARAMETER_TYPE_MISMATCH`, `PARAMETER_DIMENSION_INVALID`, `PARAMETER_DIVIDE_BY_ZERO`,
`PARAMETER_NON_FINITE`, `OPERATION_UNKNOWN`,
`OPERATION_VERSION_UNSUPPORTED`, `OPERATION_PAYLOAD_INVALID`, `OPERATION_INPUT_INVALID`,
`OPERATION_HANDLER_FAILED`, `SEMANTIC_REFERENCE_AMBIGUOUS`, `SEMANTIC_REFERENCE_MISSING`,
`SEMANTIC_REFERENCE_DELETED`, `SEMANTIC_REFERENCE_CONFIRMATION_UNSUPPORTED`,
`DEPENDENCY_BLOCKED`, `ARTIFACT_STALE`, `ARTIFACT_HASH_MISMATCH`,
`EXCHANGE_SOURCE_INVALID`, `EXCHANGE_IMPORT_FAILED`, `EXCHANGE_VERIFICATION_FAILED`,
`STALE_BASE`, `PRECONDITION_FAILED`, `NONCOMMUTATIVE`, and `REPLAY_DIVERGED`.

## Six-hour composition gate

The integrated candidate is coherent only if the same exact revisions cross the real path:

1. history persists and proposes a typed parameter change;
2. core validates, resolves, recomputes, and emits a real result/artifact;
3. browser renders its viewport packet and maps selection to stable IDs;
4. an invalid edit remains failed while the prior artifact is visibly last-valid;
5. two independently valid B-rep bodies are produced, and an immutable definition is reused by
   two fixed-transform occurrences with distinct world bounds/selection identities;
6. hierarchy, visibility, BOM, definition/instance semantic diff, persistence, and fresh-process
   replay preserve exact assembly identity and provenance;
7. STEP and STL export verification bind a succeeded part revision; and
8. accept/reject/rollback and replay preserve exact hashes and provenance.

The mission-to-feedback product-thread journey is a separate integrated gate defined by
`docs/contracts/platform-records.v1.md`. Passing this CAD contract alone cannot pass that journey,
and a platform record graph or rendered dashboard cannot substitute for the real B-rep,
tessellation, exchange, history, and assembly requirements here.

Lane-local mocks are useful contract tests but prove only `TARGET` integration. Unsupported breadth
is reported plainly; it does not block the smallest evidenced vertical spine.
