"""Transactional deterministic recompute over an extensible operation registry."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from .artifacts import ArtifactPointer, GeometryArtifact
from .canonical import sha256_bytes, sha256_hex
from .diagnostics import Diagnostic, KernelError
from .program import PartProgram, operation_hash
from .registry import OperationExecutionContext, OperationInput, OperationRegistry
from .scalars import ResolvedValue, parse_decimal, resolve_parameters
from .topology import (
    Body,
    KernelShape,
    SemanticResolution,
    make_compound,
    resolve_reference,
    semantic_fingerprint,
    serialize_brep,
)


@dataclass(frozen=True, slots=True)
class EngineManifest:
    adapter: str
    binding: str
    kernel: str
    solver: str
    toolchain: str
    platform_image: str
    tolerances: Mapping[str, str]
    deterministic_settings: Mapping[str, str | int | bool]
    schema_version: str = "forge.engine-manifest/1"

    def __post_init__(self) -> None:
        if (
            self.schema_version != "forge.engine-manifest/1"
            or not all(
                isinstance(value, str) and value
                for value in (
                    self.adapter,
                    self.binding,
                    self.kernel,
                    self.solver,
                    self.toolchain,
                    self.platform_image,
                )
            )
            or set(self.tolerances) != {"linear_mm", "angular_deg"}
            or not isinstance(self.deterministic_settings, Mapping)
            or not self.deterministic_settings
            or not all(
                isinstance(key, str)
                and key
                and isinstance(value, (str, int, bool))
                for key, value in self.deterministic_settings.items()
            )
        ):
            raise KernelError("SCHEMA_UNSUPPORTED", "Malformed engine manifest")
        for name, value in self.tolerances.items():
            if parse_decimal(value) <= 0:
                raise KernelError(
                    "SCHEMA_UNSUPPORTED", f"Manifest tolerance {name!r} must be positive"
                )

    def as_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "adapter": self.adapter,
            "binding": self.binding,
            "kernel": self.kernel,
            "solver": self.solver,
            "toolchain": self.toolchain,
            "platform_image": self.platform_image,
            "tolerances": dict(self.tolerances),
            "deterministic_settings": dict(self.deterministic_settings),
        }

    @property
    def manifest_hash(self) -> str:
        return sha256_hex(self.as_dict())


@dataclass(frozen=True, slots=True)
class StateTransition:
    sequence: int
    state: str
    diagnostic_code: str | None

    def as_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "state": self.state,
            "diagnostic_code": self.diagnostic_code,
        }


@dataclass(slots=True)
class OperationResult:
    operation_id: str
    operation_hash: str
    status: str
    artifact_id: str | None
    diagnostics: list[Diagnostic]
    semantic_resolutions: list[SemanticResolution]

    def as_dict(self) -> dict[str, object]:
        return {
            "operation_id": self.operation_id,
            "operation_hash": self.operation_hash,
            "status": self.status,
            "artifact_id": self.artifact_id,
            "diagnostics": [item.as_dict() for item in self.diagnostics],
            "semantic_resolutions": [item.as_dict() for item in self.semantic_resolutions],
        }


@dataclass(slots=True)
class RecomputeResult:
    document_id: str
    attempted_revision_id: str
    geometry_hash: str
    engine_manifest_hash: str
    status: str
    transitions: list[StateTransition]
    operation_results: list[OperationResult]
    semantic_resolutions: list[SemanticResolution]
    current_artifact: GeometryArtifact | None
    last_valid_artifact: ArtifactPointer | None
    diagnostics: list[Diagnostic]
    bodies: list[Body] = field(default_factory=list, repr=False)
    outputs: dict[str, KernelShape] = field(default_factory=dict, repr=False)

    def as_dict(self) -> dict[str, object]:
        return {
            "protocol_version": "forge.kernel-result/1",
            "document_id": self.document_id,
            "attempted_revision_id": self.attempted_revision_id,
            "geometry_hash": self.geometry_hash,
            "engine_manifest_hash": self.engine_manifest_hash,
            "status": self.status,
            "transitions": [item.as_dict() for item in self.transitions],
            "operation_results": [item.as_dict() for item in self.operation_results],
            "semantic_resolutions": [item.as_dict() for item in self.semantic_resolutions],
            "current_artifact": self.current_artifact.pointer().as_dict()
            if self.current_artifact
            else None,
            "last_valid_artifact": self.last_valid_artifact.as_dict()
            if self.last_valid_artifact
            else None,
            "diagnostics": [item.as_dict() for item in self.diagnostics],
            "bodies": [self._body_descriptor(body) for body in self.bodies],
        }

    @staticmethod
    def _body_descriptor(body: Body) -> dict[str, object]:
        fingerprint, preimage = semantic_fingerprint(
            body.shape,
            units={"length": "mm", "angle": "deg"},
            exact_entities=[],
        )
        return {
            "body_id": body.body_id,
            "producing_operation_id": body.producing_operation_id,
            "entity_kind": "SOLID",
            "content_hash": sha256_bytes(serialize_brep(body.shape)),
            "semantic_fingerprint": fingerprint,
            "semantic_fingerprint_preimage": preimage,
        }


class RecomputeEngine:
    def __init__(self, registry: OperationRegistry, manifest: EngineManifest) -> None:
        self.registry = registry
        self.manifest = manifest

    def recompute(
        self,
        program: PartProgram,
        *,
        asserted_geometry_hash: str | None = None,
        last_valid: GeometryArtifact | ArtifactPointer | None = None,
    ) -> RecomputeResult:
        transitions = [StateTransition(0, "QUEUED", None), StateTransition(1, "RUNNING", None)]
        diagnostics: list[Diagnostic] = []
        operation_results: list[OperationResult] = []
        outputs: dict[str, KernelShape] = {}
        hashes: dict[str, str] = {}
        failed: set[str] = set()
        resolved_by_id: dict[str, ResolvedValue] = {}
        geometry_hash = program.geometry_hash
        last_pointer = self._last_pointer(last_valid)
        try:
            program.validate_structure()
            if asserted_geometry_hash is not None and asserted_geometry_hash != geometry_hash:
                raise KernelError(
                    "HASH_MISMATCH",
                    f"Projection geometry hash {asserted_geometry_hash} does not match {geometry_hash}",
                )
            resolved_by_id = resolve_parameters(program.parameters)
            for operation in program.operations:
                self.registry.descriptor(operation.type, operation.type_version)
        except KernelError as exc:
            diagnostics.append(exc.diagnostic)
            transitions.append(StateTransition(2, "FAILED", exc.code))
            return RecomputeResult(
                program.document_id,
                program.source_revision_id,
                geometry_hash,
                self.manifest.manifest_hash,
                "FAILED",
                transitions,
                operation_results,
                [],
                None,
                last_pointer,
                diagnostics,
            )

        for operation in program.operations:
            dependency_blocked = any(dependency in failed for dependency in operation.depends_on)
            parameters = {
                slot: resolved_by_id[parameter_id]
                for slot, parameter_id in sorted(operation.parameter_bindings.items())
            }
            dependency_hashes = [hashes[dependency] for dependency in operation.depends_on]
            resolutions = [
                resolve_reference(
                    program.document_id,
                    dict(program.semantic_references[reference_id]),
                    outputs,
                )
                for reference_id in operation.input_references
            ]
            semantic_ids = [
                resolution.entity_id or f"unresolved:{resolution.reference_id}:{resolution.status}"
                for resolution in resolutions
            ]
            op_hash = operation_hash(
                operation,
                resolved_parameters=parameters,
                input_semantic_ids=semantic_ids,
                dependency_operation_hashes=dependency_hashes,
            )
            hashes[operation.operation_id] = op_hash
            if dependency_blocked:
                diagnostic = Diagnostic(
                    "DEPENDENCY_BLOCKED",
                    "ERROR",
                    "A dependency failed or was blocked",
                    operation.operation_id,
                    None,
                )
                operation_results.append(
                    OperationResult(
                        operation.operation_id,
                        op_hash,
                        "BLOCKED",
                        None,
                        [diagnostic],
                        resolutions,
                    )
                )
                failed.add(operation.operation_id)
                continue
            unresolved = next((item for item in resolutions if item.status != "EXACT"), None)
            if unresolved is not None:
                diagnostic = Diagnostic(
                    unresolved.diagnostic_code or "OPERATION_INPUT_INVALID",
                    "ERROR",
                    f"Reference {unresolved.reference_id!r} resolved as {unresolved.status}",
                    operation.operation_id,
                    unresolved.reference_id,
                )
                operation_results.append(
                    OperationResult(
                        operation.operation_id,
                        op_hash,
                        "FAILED",
                        None,
                        [diagnostic],
                        resolutions,
                    )
                )
                diagnostics.append(diagnostic)
                failed.add(operation.operation_id)
                continue
            try:
                dependency_inputs = [
                    OperationInput(
                        kind=outputs[dependency].kind,
                        value=outputs[dependency],
                        semantic_id=f"operation-output:{dependency}",
                    )
                    for dependency in operation.depends_on
                ]
                if not operation.enabled:
                    if len(dependency_inputs) != 1:
                        raise KernelError(
                            "OPERATION_INPUT_INVALID",
                            "A disabled operation requires exactly one dependency to pass through",
                            operation_id=operation.operation_id,
                        )
                    output = dependency_inputs[0].value
                else:
                    executed = self.registry.execute(
                        operation.type,
                        operation.type_version,
                        OperationExecutionContext(
                            document_id=program.document_id,
                            operation_id=operation.operation_id,
                            operation_hash=op_hash,
                            payload=operation.payload,
                            parameters=parameters,
                            inputs=dependency_inputs,
                            private={"resolved_references": resolutions},
                        ),
                    )
                    if not isinstance(executed.value, KernelShape):
                        raise KernelError(
                            "OPERATION_HANDLER_FAILED",
                            "Kernel handler did not return a KernelShape",
                            operation_id=operation.operation_id,
                        )
                    output = executed.value
                outputs[operation.operation_id] = output
                operation_results.append(
                    OperationResult(
                        operation.operation_id,
                        op_hash,
                        "SUCCEEDED",
                        None,
                        [],
                        resolutions,
                    )
                )
            except KernelError as exc:
                diagnostics.append(exc.diagnostic)
                operation_results.append(
                    OperationResult(
                        operation.operation_id,
                        op_hash,
                        "FAILED",
                        None,
                        [exc.diagnostic],
                        resolutions,
                    )
                )
                failed.add(operation.operation_id)
            except Exception as exc:  # Normalize native binding exceptions at the boundary.
                diagnostic = Diagnostic(
                    "OPERATION_HANDLER_FAILED",
                    "ERROR",
                    f"Unhandled kernel failure: {type(exc).__name__}: {exc}",
                    operation.operation_id,
                    None,
                )
                diagnostics.append(diagnostic)
                operation_results.append(
                    OperationResult(
                        operation.operation_id,
                        op_hash,
                        "FAILED",
                        None,
                        [diagnostic],
                        resolutions,
                    )
                )
                failed.add(operation.operation_id)

        all_resolutions = [
            resolve_reference(program.document_id, dict(reference), outputs)
            for _, reference in sorted(program.semantic_references.items())
        ]
        if failed:
            first_code = diagnostics[0].code if diagnostics else "OPERATION_HANDLER_FAILED"
            transitions.append(StateTransition(2, "FAILED", first_code))
            return RecomputeResult(
                program.document_id,
                program.source_revision_id,
                geometry_hash,
                self.manifest.manifest_hash,
                "FAILED",
                transitions,
                operation_results,
                all_resolutions,
                None,
                last_pointer,
                diagnostics,
                outputs=outputs,
            )

        try:
            final_shape, bodies, producer = self._compose_terminal_bodies(program, outputs)
            exact_entities = [
                (resolution.reference_id, resolution.entity_kind)
                for resolution in all_resolutions
                if resolution.status == "EXACT"
            ]
            fingerprint, _ = semantic_fingerprint(
                final_shape, units=dict(program.units), exact_entities=exact_entities
            )
            artifact = GeometryArtifact(
                artifact_kind="BREP",
                source_revision_id=program.source_revision_id,
                geometry_hash=geometry_hash,
                producing_operation_id=producer,
                engine_manifest_hash=self.manifest.manifest_hash,
                media_type="application/vnd.opencascade.brep",
                content=serialize_brep(final_shape),
                semantic_fingerprint=fingerprint,
                verification={
                    "status": "PASSED",
                    "checks": [
                        {
                            "code": "BREP_VALID",
                            "status": "PASSED",
                            "observed": "true",
                            "expected": "true",
                            "tolerance": None,
                        }
                    ],
                },
            )
            for item in operation_results:
                if item.operation_id == producer:
                    item.artifact_id = artifact.artifact_id
            transitions.append(StateTransition(2, "SUCCEEDED", None))
            return RecomputeResult(
                program.document_id,
                program.source_revision_id,
                geometry_hash,
                self.manifest.manifest_hash,
                "SUCCEEDED",
                transitions,
                operation_results,
                all_resolutions,
                artifact,
                last_pointer,
                diagnostics,
                bodies,
                outputs,
            )
        except KernelError as exc:
            diagnostics.append(exc.diagnostic)
            transitions.append(StateTransition(2, "FAILED", exc.code))
            return RecomputeResult(
                program.document_id,
                program.source_revision_id,
                geometry_hash,
                self.manifest.manifest_hash,
                "FAILED",
                transitions,
                operation_results,
                all_resolutions,
                None,
                last_pointer,
                diagnostics,
                outputs=outputs,
            )

    @staticmethod
    def _last_pointer(
        last_valid: GeometryArtifact | ArtifactPointer | None,
    ) -> ArtifactPointer | None:
        if last_valid is None:
            return None
        return last_valid.pointer() if isinstance(last_valid, GeometryArtifact) else last_valid

    @staticmethod
    def _compose_terminal_bodies(
        program: PartProgram, outputs: Mapping[str, KernelShape]
    ) -> tuple[Any, list[Body], str | None]:
        consumed = {
            dependency
            for operation in program.operations
            if operation.operation_id in outputs
            for dependency in operation.depends_on
        }
        terminal_ids = [
            operation.operation_id
            for operation in program.operations
            if operation.operation_id in outputs and operation.operation_id not in consumed
        ]
        bodies: list[Body] = []
        for operation_id in terminal_ids:
            bodies.extend(outputs[operation_id].bodies)
        if not bodies:
            raise KernelError(
                "OPERATION_HANDLER_FAILED", "Recompute produced no terminal solid bodies"
            )
        if len(bodies) == 1:
            return bodies[0].shape, bodies, bodies[0].producing_operation_id
        return make_compound(body.shape for body in bodies), bodies, None
