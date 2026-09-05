# Core-kernel atomic-leaf proposals

Proposal only. These are not admitted IDs, verdicts, coverage, or shared-contract edits.
Every proposed leaf remains `HOLD` until the integration owner maps it to the committed
successor ledger and an independent verifier binds proof to the candidate commit.

| Proposed atomic behavior | Proposed authority split | Local proof candidate | Known failure/limit |
|---|---|---|---|
| Recompute one exact PartProgram into valid B-rep | core executes geometry; history owns canonical revision/input | `test_real_bracket_spine_and_semantic_selection` | solver-free fixed sketch construction only |
| Evaluate exact rational parameters/expressions | core executes projected values; history owns authored parameters | `test_expression_graph_uses_exact_dimensional_arithmetic` | no symbolic functions/units beyond scalar, length, angle, integer |
| Execute registered operation by exact type/version | core | `test_external_operation_registers_without_evaluator_change` | only the 15 registered v1 handlers are demonstrated |
| Preserve failed-attempt truth and materialized last-valid B-rep | core attests geometry transaction; history owns revision lifecycle | `test_failed_attempt_restores_separate_revision_bound_last_valid_in_fresh_process` | no worker-crash/timeout supervisor |
| Resolve semantic entity through generated/modified/deleted lineage | core | `test_real_occt_modified_history_preserves_semantic_selection`; `test_real_occt_boolean_deleted_history_blocks_dependent_feature` | bounded roles, not general topological naming |
| Derive selectable tessellation from exact part B-rep | core executes derivation; browser owns display interaction | `test_real_bracket_spine_and_semantic_selection`; fresh-process replay | browser selection behavior is outside this lane |
| Preserve multiple exact terminal solid bodies | core | `test_part_document_preserves_multiple_real_solid_bodies` | no body naming/merge policy outside operation-derived IDs |
| Write/read and geometry-check STEP | interop should own request/receipt/profile; core supplies OCCT exact-geometry execution | `test_step_export_reimports_and_verifies_exact_geometry` | no XDE hierarchy/PMI/name/color fidelity |
| Write/read and geometry-check STL | interop should own request/receipt/profile; core supplies meshing execution | `test_stl_export_is_watertight_outward_and_mesh_only_on_import` | import is mesh-only and non-editable |

Requested successor seam corrections:

1. Keep canonical document/revision/provenance and operation authorization in history.
2. Keep cross-lane request/result, artifact, unit/tolerance, diagnostic, manifest, and
   capability-leaf schemas in integration-owned paths.
3. Split exchange receipt/profile authority from the kernel call that implements STEP or
   STL encoding.
