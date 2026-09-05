"""Boundary-neutral typed operation program and deterministic DAG validation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .canonical import sha256_hex
from .diagnostics import KernelError
from .scalars import ResolvedValue


@dataclass(frozen=True, slots=True)
class ProgramOperation:
    operation_id: str
    type: str
    type_version: int
    depends_on: tuple[str, ...]
    parameter_bindings: Mapping[str, str]
    input_references: tuple[str, ...]
    payload: Mapping[str, Any]
    enabled: bool

    def validate_envelope(self) -> None:
        if (
            not isinstance(self.operation_id, str)
            or not self.operation_id
            or not isinstance(self.type, str)
            or not self.type
            or not isinstance(self.type_version, int)
            or isinstance(self.type_version, bool)
            or self.type_version < 1
            or not isinstance(self.depends_on, tuple)
            or not all(isinstance(item, str) and item for item in self.depends_on)
            or not isinstance(self.parameter_bindings, Mapping)
            or not all(
                isinstance(key, str) and key and isinstance(value, str) and value
                for key, value in self.parameter_bindings.items()
            )
            or not isinstance(self.input_references, tuple)
            or not all(
                isinstance(item, str) and item for item in self.input_references
            )
            or not isinstance(self.payload, Mapping)
            or not isinstance(self.enabled, bool)
        ):
            raise KernelError("OPERATION_PAYLOAD_INVALID", "Malformed operation envelope")

    def as_dict(self) -> dict[str, object]:
        return {
            "operation_id": self.operation_id,
            "type": self.type,
            "type_version": self.type_version,
            "depends_on": list(self.depends_on),
            "parameter_bindings": dict(self.parameter_bindings),
            "input_references": list(self.input_references),
            "payload": dict(self.payload),
            "enabled": self.enabled,
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "ProgramOperation":
        try:
            operation_id = value["operation_id"]
            operation_type = value["type"]
            type_version = value["type_version"]
            depends_on = value["depends_on"]
            bindings = value["parameter_bindings"]
            references = value["input_references"]
            payload = value["payload"]
            enabled = value["enabled"]
        except KeyError as exc:
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", f"Operation is missing field {exc.args[0]!r}"
            ) from exc
        if (
            not isinstance(operation_id, str)
            or not operation_id
            or not isinstance(operation_type, str)
            or not operation_type
            or not isinstance(type_version, int)
            or isinstance(type_version, bool)
            or type_version < 1
            or not isinstance(depends_on, list)
            or not all(isinstance(item, str) and item for item in depends_on)
            or not isinstance(bindings, Mapping)
            or not all(isinstance(k, str) and isinstance(v, str) for k, v in bindings.items())
            or not isinstance(references, list)
            or not all(isinstance(item, str) and item for item in references)
            or not isinstance(payload, Mapping)
            or not isinstance(enabled, bool)
        ):
            raise KernelError("OPERATION_PAYLOAD_INVALID", "Malformed operation envelope")
        return cls(
            operation_id,
            operation_type,
            type_version,
            tuple(depends_on),
            dict(bindings),
            tuple(references),
            dict(payload),
            enabled,
        )


@dataclass(frozen=True, slots=True)
class PartProgram:
    document_id: str
    source_revision_id: str
    units: Mapping[str, str]
    parameters: Mapping[str, Mapping[str, Any]]
    operations: tuple[ProgramOperation, ...]
    semantic_references: Mapping[str, Mapping[str, Any]]

    def as_dict(self) -> dict[str, object]:
        return {
            "protocol_version": "forge.core-part-program/1",
            "document_id": self.document_id,
            "source_revision_id": self.source_revision_id,
            "units": dict(self.units),
            "parameters": {
                key: dict(value) for key, value in self.parameters.items()
            },
            "operations": [operation.as_dict() for operation in self.operations],
            "semantic_references": {
                key: dict(value) for key, value in self.semantic_references.items()
            },
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "PartProgram":
        expected = {
            "protocol_version",
            "document_id",
            "source_revision_id",
            "units",
            "parameters",
            "operations",
            "semantic_references",
        }
        if (
            set(value) != expected
            or value.get("protocol_version") != "forge.core-part-program/1"
        ):
            raise KernelError("SCHEMA_UNSUPPORTED", "Unsupported internal part program")
        document_id = value.get("document_id")
        revision_id = value.get("source_revision_id")
        units = value.get("units")
        parameters = value.get("parameters")
        operations = value.get("operations")
        references = value.get("semantic_references")
        if (
            not isinstance(document_id, str)
            or not isinstance(revision_id, str)
            or not isinstance(units, Mapping)
            or not isinstance(parameters, Mapping)
            or not all(
                isinstance(key, str) and isinstance(item, Mapping)
                for key, item in parameters.items()
            )
            or not isinstance(operations, list)
            or not all(isinstance(item, Mapping) for item in operations)
            or not isinstance(references, Mapping)
            or not all(
                isinstance(key, str) and isinstance(item, Mapping)
                for key, item in references.items()
            )
        ):
            raise KernelError("SCHEMA_UNSUPPORTED", "Malformed internal part program")
        program = cls(
            document_id=document_id,
            source_revision_id=revision_id,
            units=dict(units),
            parameters={key: dict(item) for key, item in parameters.items()},
            operations=tuple(ProgramOperation.from_dict(item) for item in operations),
            semantic_references={
                key: dict(item) for key, item in references.items()
            },
        )
        program.validate_structure()
        return program

    def geometry_preimage(self) -> dict[str, object]:
        return {
            "schema_version": "forge.kernel-projection/1",
            "document_id": self.document_id,
            "units": dict(self.units),
            "parameters": {key: dict(value) for key, value in self.parameters.items()},
            "operations": [operation.as_dict() for operation in self.operations],
            "semantic_references": {
                key: dict(value) for key, value in self.semantic_references.items()
            },
        }

    @property
    def geometry_hash(self) -> str:
        return sha256_hex(self.geometry_preimage())

    def validate_structure(self) -> None:
        if (
            not isinstance(self.document_id, str)
            or not self.document_id
            or not isinstance(self.source_revision_id, str)
            or not self.source_revision_id
        ):
            raise KernelError("SCHEMA_UNSUPPORTED", "Program identities must be non-empty")
        if not isinstance(self.units, Mapping) or dict(self.units) != {
            "length": "mm",
            "angle": "deg",
        }:
            raise KernelError("SCHEMA_UNSUPPORTED", "Kernel boundary requires mm and deg")
        if not isinstance(self.parameters, Mapping) or not isinstance(
            self.semantic_references, Mapping
        ):
            raise KernelError("SCHEMA_UNSUPPORTED", "Program maps are malformed")
        for key, parameter in self.parameters.items():
            if not isinstance(key, str) or not isinstance(parameter, Mapping):
                raise KernelError("SCHEMA_UNSUPPORTED", "Parameter map is malformed")
            if parameter.get("parameter_id") != key:
                raise KernelError("DUPLICATE_ID", f"Parameter map key mismatch {key!r}")
        if not isinstance(self.operations, tuple):
            raise KernelError("SCHEMA_UNSUPPORTED", "Operations must be an ordered tuple")
        operation_ids: list[str] = []
        for operation in self.operations:
            if not isinstance(operation, ProgramOperation):
                raise KernelError("OPERATION_PAYLOAD_INVALID", "Malformed operation envelope")
            operation.validate_envelope()
            operation_ids.append(operation.operation_id)
        if len(operation_ids) != len(set(operation_ids)):
            duplicate = next(
                operation_id
                for index, operation_id in enumerate(operation_ids)
                if operation_id in operation_ids[:index]
            )
            raise KernelError("DUPLICATE_ID", f"Duplicate operation {duplicate!r}")
        all_ids = set(operation_ids)
        graph = {
            operation.operation_id: set(operation.depends_on)
            for operation in self.operations
        }
        for operation in self.operations:
            missing_dependencies = sorted(set(operation.depends_on) - all_ids)
            if missing_dependencies:
                raise KernelError(
                    "DEPENDENCY_MISSING",
                    f"{operation.operation_id!r} has missing dependencies {missing_dependencies!r}",
                    operation_id=operation.operation_id,
                )

        visited: set[str] = set()
        active: list[str] = []

        def visit(operation_id: str) -> None:
            if operation_id in active:
                cycle_start = active.index(operation_id)
                cycle = " -> ".join([*active[cycle_start:], operation_id])
                raise KernelError("DEPENDENCY_CYCLE", f"Operation cycle: {cycle}")
            if operation_id in visited:
                return
            active.append(operation_id)
            for dependency in sorted(graph[operation_id]):
                visit(dependency)
            active.pop()
            visited.add(operation_id)

        for operation_id in operation_ids:
            visit(operation_id)

        seen: set[str] = set()
        dependencies: dict[str, set[str]] = {}
        for operation in self.operations:
            if len(operation.depends_on) != len(set(operation.depends_on)):
                raise KernelError(
                    "DUPLICATE_ID",
                    f"Duplicate dependencies on {operation.operation_id!r}",
                    operation_id=operation.operation_id,
                )
            missing_parameters = sorted(
                parameter_id
                for parameter_id in operation.parameter_bindings.values()
                if parameter_id not in self.parameters
            )
            if missing_parameters:
                raise KernelError(
                    "PARAMETER_MISSING",
                    f"{operation.operation_id!r} binds missing parameters {missing_parameters!r}",
                    operation_id=operation.operation_id,
                )
            missing = [dependency for dependency in operation.depends_on if dependency not in seen]
            if missing:
                raise KernelError(
                    "DEPENDENCY_ORDER_INVALID",
                    f"{operation.operation_id!r} depends on later operations {missing!r}",
                    operation_id=operation.operation_id,
                )
            closure = set(operation.depends_on)
            for dependency in operation.depends_on:
                closure.update(dependencies[dependency])
            for reference_id in operation.input_references:
                reference = self.semantic_references.get(reference_id)
                if reference is None:
                    raise KernelError(
                        "SEMANTIC_REFERENCE_MISSING",
                        f"Unknown reference {reference_id!r}",
                        operation_id=operation.operation_id,
                        reference_id=reference_id,
                    )
                producer = reference.get("producer_operation_id")
                if producer not in closure:
                    raise KernelError(
                        "DEPENDENCY_MISSING",
                        f"Reference producer {producer!r} is not in the dependency closure",
                        operation_id=operation.operation_id,
                        reference_id=reference_id,
                    )
            dependencies[operation.operation_id] = closure
            seen.add(operation.operation_id)
        for reference_id, reference in self.semantic_references.items():
            if reference.get("reference_id") != reference_id:
                raise KernelError("DUPLICATE_ID", f"Reference map key mismatch {reference_id!r}")
            expected_fields = {
                "reference_id",
                "producer_operation_id",
                "entity_kind",
                "semantic_role",
                "lineage",
                "expected_cardinality",
            }
            if set(reference) != expected_fields:
                raise KernelError(
                    "OPERATION_INPUT_INVALID",
                    f"Semantic reference {reference_id!r} fields are not exact; ordinals are forbidden",
                    reference_id=reference_id,
                )
            if (
                reference.get("entity_kind")
                not in {"VERTEX", "EDGE", "WIRE", "FACE", "SHELL", "SOLID", "COMPOUND", "MESH"}
                or not isinstance(reference.get("semantic_role"), str)
                or not reference.get("semantic_role")
                or reference.get("expected_cardinality") not in {"ONE", "MANY"}
                or not isinstance(reference.get("lineage"), list)
            ):
                raise KernelError(
                    "OPERATION_INPUT_INVALID",
                    f"Semantic reference {reference_id!r} is malformed",
                    reference_id=reference_id,
                )
            for lineage in reference["lineage"]:
                if (
                    not isinstance(lineage, Mapping)
                    or set(lineage)
                    != {"operation_id", "event", "source_reference_id"}
                    or not isinstance(lineage.get("operation_id"), str)
                    or lineage.get("event") not in {"GENERATED", "MODIFIED", "PRESERVED"}
                    or (
                        lineage.get("source_reference_id") is not None
                        and not isinstance(lineage.get("source_reference_id"), str)
                    )
                ):
                    raise KernelError(
                        "OPERATION_INPUT_INVALID",
                        f"Semantic reference {reference_id!r} has malformed lineage",
                        reference_id=reference_id,
                    )
            if reference.get("producer_operation_id") not in seen:
                raise KernelError(
                    "SEMANTIC_REFERENCE_MISSING",
                    f"Reference producer is missing for {reference_id!r}",
                    reference_id=reference_id,
                )


def operation_hash(
    operation: ProgramOperation,
    *,
    resolved_parameters: Mapping[str, ResolvedValue],
    input_semantic_ids: Sequence[str],
    dependency_operation_hashes: Sequence[str],
) -> str:
    return sha256_hex(
        {
            "schema_version": "forge.operation-hash/1",
            "operation": operation.as_dict(),
            "resolved_parameters": {
                key: value.as_dict() for key, value in resolved_parameters.items()
            },
            "input_semantic_ids": list(input_semantic_ids),
            "dependency_operation_hashes": list(dependency_operation_hashes),
        }
    )
