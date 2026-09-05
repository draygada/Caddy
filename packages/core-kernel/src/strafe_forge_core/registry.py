"""Extensible typed operation registry.

Dispatch is data-driven by an exact (type, version) key.  Built-in operation handlers are
registered by the OCP adapter; the evaluator itself has no operation-type switch.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Protocol, Sequence

from jsonschema import Draft202012Validator, SchemaError

from .diagnostics import KernelError
from .scalars import ResolvedValue, VALUE_TYPES


JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema"


@dataclass(frozen=True, slots=True)
class ParameterSlot:
    slot: str
    label: str
    value_type: str
    required: bool
    default_literal: str | None
    minimum_literal: str | None
    maximum_literal: str | None
    step_literal: str | None
    order: int


@dataclass(frozen=True, slots=True)
class PayloadField:
    json_pointer: str
    label: str
    control: str
    required: bool
    order: int
    options: tuple[dict[str, object], ...] = ()


@dataclass(frozen=True, slots=True)
class OperationDescriptor:
    type: str
    type_version: int
    display: Mapping[str, str]
    payload_schema: Mapping[str, Any]
    payload_fields: tuple[PayloadField, ...]
    parameter_slots: tuple[ParameterSlot, ...]
    input_kinds: tuple[str, ...]
    output_roles: tuple[str, ...]
    determinism: str = "REQUIRED"

    @property
    def key(self) -> tuple[str, int]:
        return (self.type, self.type_version)


@dataclass(slots=True)
class OperationInput:
    kind: str
    value: Any
    semantic_id: str


@dataclass(slots=True)
class OperationExecutionContext:
    document_id: str
    operation_id: str
    operation_hash: str
    payload: Mapping[str, Any]
    parameters: Mapping[str, ResolvedValue]
    inputs: Sequence[OperationInput]
    private: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class OperationOutput:
    kind: str
    value: Any
    entities: list[Any] = field(default_factory=list)
    deleted_semantic_ids: set[str] = field(default_factory=set)
    metadata: dict[str, Any] = field(default_factory=dict)


class OperationHandler(Protocol):
    def __call__(self, context: OperationExecutionContext) -> OperationOutput: ...


class OperationRegistry:
    def __init__(self) -> None:
        self._descriptors: dict[tuple[str, int], OperationDescriptor] = {}
        self._handlers: dict[tuple[str, int], OperationHandler] = {}

    def register(
        self, descriptor: OperationDescriptor, handler: OperationHandler
    ) -> None:
        self._validate_descriptor(descriptor)
        if descriptor.key in self._descriptors:
            raise KernelError(
                "DUPLICATE_ID",
                f"Operation descriptor already registered: {descriptor.key!r}",
            )
        self._descriptors[descriptor.key] = descriptor
        self._handlers[descriptor.key] = handler

    def descriptor(self, operation_type: str, type_version: int) -> OperationDescriptor:
        key = (operation_type, type_version)
        descriptor = self._descriptors.get(key)
        if descriptor is not None:
            return descriptor
        versions = sorted(v for t, v in self._descriptors if t == operation_type)
        if versions:
            raise KernelError(
                "OPERATION_VERSION_UNSUPPORTED",
                f"Unsupported {operation_type!r} version {type_version}; available {versions}",
            )
        raise KernelError("OPERATION_UNKNOWN", f"Unknown operation {operation_type!r}")

    def descriptors(self) -> tuple[OperationDescriptor, ...]:
        return tuple(self._descriptors[key] for key in sorted(self._descriptors))

    def execute(
        self,
        operation_type: str,
        type_version: int,
        context: OperationExecutionContext,
    ) -> OperationOutput:
        descriptor = self.descriptor(operation_type, type_version)
        errors = sorted(
            Draft202012Validator(descriptor.payload_schema).iter_errors(context.payload),
            key=lambda error: tuple(str(part) for part in error.absolute_path),
        )
        if errors:
            detail = "; ".join(error.message for error in errors)
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID",
                detail,
                operation_id=context.operation_id,
            )
        expected_slots = {slot.slot: slot for slot in descriptor.parameter_slots}
        unexpected = sorted(set(context.parameters) - set(expected_slots))
        missing = sorted(
            slot.slot
            for slot in descriptor.parameter_slots
            if slot.required and slot.slot not in context.parameters
        )
        if unexpected or missing:
            raise KernelError(
                "OPERATION_INPUT_INVALID",
                f"Parameter slots missing={missing}, unexpected={unexpected}",
                operation_id=context.operation_id,
            )
        for name, value in context.parameters.items():
            if value.value_type != expected_slots[name].value_type:
                raise KernelError(
                    "PARAMETER_TYPE_MISMATCH",
                    f"Slot {name!r} requires {expected_slots[name].value_type}, got {value.value_type}",
                    operation_id=context.operation_id,
                )
        if descriptor.input_kinds:
            actual = tuple(item.kind for item in context.inputs)
            if len(actual) != len(descriptor.input_kinds) or any(
                expected != "*" and expected != received
                for expected, received in zip(descriptor.input_kinds, actual)
            ):
                raise KernelError(
                    "OPERATION_INPUT_INVALID",
                    f"Input kinds require {descriptor.input_kinds!r}, got {actual!r}",
                    operation_id=context.operation_id,
                )
        return self._handlers[descriptor.key](context)

    @staticmethod
    def _validate_descriptor(descriptor: OperationDescriptor) -> None:
        if not descriptor.type or descriptor.type_version < 1:
            raise KernelError("OPERATION_PAYLOAD_INVALID", "Invalid descriptor identity")
        if descriptor.determinism != "REQUIRED":
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", "Only REQUIRED determinism is admitted"
            )
        if set(descriptor.display) != {"label", "category", "description"}:
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", "Descriptor display fields are not exact"
            )
        schema = descriptor.payload_schema
        if (
            schema.get("$schema") != JSON_SCHEMA_2020_12
            or schema.get("type") != "object"
            or not isinstance(schema.get("required"), list)
            or schema.get("additionalProperties") is not False
        ):
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", "Payload schema must be strict Draft 2020-12"
            )
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as exc:
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", f"Invalid payload schema: {exc.message}"
            ) from exc
        slot_orders = [slot.order for slot in descriptor.parameter_slots]
        field_orders = [field.order for field in descriptor.payload_fields]
        if slot_orders != sorted(set(slot_orders)) or field_orders != sorted(set(field_orders)):
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", "Descriptor orders must be sorted and unique"
            )
        if any(slot.value_type not in VALUE_TYPES for slot in descriptor.parameter_slots):
            raise KernelError(
                "OPERATION_PAYLOAD_INVALID", "Descriptor has an invalid parameter type"
            )
        properties = schema.get("properties", {})
        for field_item in descriptor.payload_fields:
            if (
                not field_item.json_pointer.startswith("/")
                or field_item.json_pointer[1:] not in properties
            ):
                raise KernelError(
                    "OPERATION_PAYLOAD_INVALID",
                    f"Payload field {field_item.json_pointer!r} is not a declared property",
                )
            if field_item.control not in {
                "NUMBER",
                "TEXT",
                "BOOLEAN",
                "SELECT",
                "ENTITY_REFERENCE",
            }:
                raise KernelError(
                    "OPERATION_PAYLOAD_INVALID", "Invalid payload control"
                )


def object_schema(
    properties: Mapping[str, Mapping[str, Any]] | None = None,
    *,
    required: Sequence[str] = (),
) -> dict[str, Any]:
    """Build the strict schema shape used by built-in operation descriptors."""

    return {
        "$schema": JSON_SCHEMA_2020_12,
        "type": "object",
        "properties": dict(properties or {}),
        "required": list(required),
        "additionalProperties": False,
    }
