from __future__ import annotations

import pytest

from strafe_forge_core.diagnostics import KernelError
from strafe_forge_core.program import PartProgram, ProgramOperation

from kernel_cases import literal


def operation(operation_id: str, depends_on: tuple[str, ...] = ()) -> ProgramOperation:
    return ProgramOperation(
        operation_id,
        "primitive.box",
        1,
        depends_on,
        {"length": "size", "width": "size", "height": "size"},
        (),
        {},
        True,
    )


def program(*operations: ProgramOperation) -> PartProgram:
    return PartProgram(
        "part:dag",
        "rev:dag",
        {"length": "mm", "angle": "deg"},
        {"size": literal("size", "LENGTH", "1")},
        operations,
        {},
    )


@pytest.mark.parametrize(
    ("operations", "code"),
    [
        ((operation("a"), operation("a")), "DUPLICATE_ID"),
        ((operation("a", ("missing",)),), "DEPENDENCY_MISSING"),
        (
            (operation("a", ("b",)), operation("b", ("a",))),
            "DEPENDENCY_CYCLE",
        ),
        ((operation("a", ("b",)), operation("b")), "DEPENDENCY_ORDER_INVALID"),
    ],
)
def test_invalid_operation_graphs_have_stable_codes(
    operations: tuple[ProgramOperation, ...], code: str
) -> None:
    with pytest.raises(KernelError) as caught:
        program(*operations).validate_structure()
    assert caught.value.code == code


def test_program_round_trip_is_exact_and_hash_preserving() -> None:
    original = program(operation("a"))
    restored = PartProgram.from_dict(original.as_dict())
    assert restored == original
    assert restored.geometry_hash == original.geometry_hash
