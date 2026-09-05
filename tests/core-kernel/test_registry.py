from fractions import Fraction

import pytest

from strafe_forge_core.diagnostics import KernelError
from strafe_forge_core.registry import (
    OperationDescriptor,
    OperationExecutionContext,
    OperationOutput,
    OperationRegistry,
    ParameterSlot,
    object_schema,
)
from strafe_forge_core.scalars import ResolvedValue


def descriptor() -> OperationDescriptor:
    return OperationDescriptor(
        type="test.echo",
        type_version=1,
        display={"label": "Echo", "category": "Test", "description": "External extension"},
        payload_schema=object_schema(
            {"label": {"type": "string"}}, required=("label",)
        ),
        payload_fields=(),
        parameter_slots=(
            ParameterSlot("distance", "Distance", "LENGTH", True, "1", "0", None, "1", 0),
        ),
        input_kinds=(),
        output_roles=("result",),
    )


def context(*, payload: dict[str, object] | None = None) -> OperationExecutionContext:
    return OperationExecutionContext(
        "part:test",
        "op:test",
        "hash",
        payload or {"label": "ok"},
        {"distance": ResolvedValue("LENGTH", Fraction(2))},
        (),
    )


def test_external_operation_registers_without_evaluator_change() -> None:
    registry = OperationRegistry()
    registry.register(
        descriptor(),
        lambda execution: OperationOutput(
            "TEST", {"label": execution.payload["label"], "distance": execution.parameters["distance"].as_dict()}
        ),
    )
    result = registry.execute("test.echo", 1, context())
    assert result.value["label"] == "ok"
    assert result.value["distance"]["numerator"] == "2"


def test_duplicate_unknown_version_payload_and_type_fail_stably() -> None:
    registry = OperationRegistry()
    registry.register(descriptor(), lambda _: OperationOutput("TEST", None))
    with pytest.raises(KernelError) as caught:
        registry.register(descriptor(), lambda _: OperationOutput("TEST", None))
    assert caught.value.code == "DUPLICATE_ID"
    with pytest.raises(KernelError) as caught:
        registry.execute("missing", 1, context())
    assert caught.value.code == "OPERATION_UNKNOWN"
    with pytest.raises(KernelError) as caught:
        registry.execute("test.echo", 2, context())
    assert caught.value.code == "OPERATION_VERSION_UNSUPPORTED"
    with pytest.raises(KernelError) as caught:
        registry.execute("test.echo", 1, context(payload={"label": 3}))
    assert caught.value.code == "OPERATION_PAYLOAD_INVALID"
    wrong = context()
    wrong.parameters = {"distance": ResolvedValue("ANGLE", Fraction(2))}
    with pytest.raises(KernelError) as caught:
        registry.execute("test.echo", 1, wrong)
    assert caught.value.code == "PARAMETER_TYPE_MISMATCH"
