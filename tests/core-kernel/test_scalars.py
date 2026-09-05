from fractions import Fraction

import pytest

from strafe_forge_core.diagnostics import KernelError
from strafe_forge_core.scalars import parse_decimal, resolve_parameters

from kernel_cases import literal


@pytest.mark.parametrize("value", ["0", "40", "0.5", "-2.25", "1000000000000.000001"])
def test_canonical_decimal_is_exact(value: str) -> None:
    assert isinstance(parse_decimal(value), Fraction)


@pytest.mark.parametrize("value", ["-0", "40.0", "4e1", ".5", "01", "1.", "nan", 1])
def test_noncanonical_decimal_fails_closed(value: object) -> None:
    with pytest.raises(KernelError, match="Invalid canonical decimal") as caught:
        parse_decimal(value)
    assert caught.value.code == "DECIMAL_INVALID"


def test_expression_graph_uses_exact_dimensional_arithmetic() -> None:
    parameters = {
        "p:w": literal("p:w", "LENGTH", "41"),
        "p:two": literal("p:two", "SCALAR", "2"),
        "p:half": {
            "parameter_id": "p:half",
            "name": "half",
            "value_type": "LENGTH",
            "literal": None,
            "expression": {
                "kind": "BINARY",
                "operator": "DIVIDE",
                "left": {"kind": "PARAMETER", "parameter_id": "p:w"},
                "right": {"kind": "PARAMETER", "parameter_id": "p:two"},
            },
        },
        "p:ratio": {
            "parameter_id": "p:ratio",
            "name": "ratio",
            "value_type": "SCALAR",
            "literal": None,
            "expression": {
                "kind": "BINARY",
                "operator": "DIVIDE",
                "left": {"kind": "PARAMETER", "parameter_id": "p:half"},
                "right": {"kind": "PARAMETER", "parameter_id": "p:w"},
            },
        },
    }
    result = resolve_parameters(parameters)
    assert result["p:half"].rational == Fraction(41, 2)
    assert result["p:half"].as_dict() == {
        "value_type": "LENGTH",
        "numerator": "41",
        "denominator": "2",
    }
    assert result["p:ratio"].rational == Fraction(1, 2)


def test_expression_cycle_and_divide_by_zero_have_stable_codes() -> None:
    cyclic = {
        "a": {
            "parameter_id": "a",
            "name": "a",
            "value_type": "LENGTH",
            "literal": None,
            "expression": {"kind": "PARAMETER", "parameter_id": "b"},
        },
        "b": {
            "parameter_id": "b",
            "name": "b",
            "value_type": "LENGTH",
            "literal": None,
            "expression": {"kind": "PARAMETER", "parameter_id": "a"},
        },
    }
    with pytest.raises(KernelError) as caught:
        resolve_parameters(cyclic)
    assert caught.value.code == "PARAMETER_CYCLE"

    divide = {
        "a": literal("a", "LENGTH", "1"),
        "zero": literal("zero", "SCALAR", "0"),
        "bad": {
            "parameter_id": "bad",
            "name": "bad",
            "value_type": "LENGTH",
            "literal": None,
            "expression": {
                "kind": "BINARY",
                "operator": "DIVIDE",
                "left": {"kind": "PARAMETER", "parameter_id": "a"},
                "right": {"kind": "PARAMETER", "parameter_id": "zero"},
            },
        },
    }
    with pytest.raises(KernelError) as caught:
        resolve_parameters(divide)
    assert caught.value.code == "PARAMETER_DIVIDE_BY_ZERO"


def test_invalid_dimension_product_is_rejected() -> None:
    parameters = {
        "a": literal("a", "LENGTH", "2"),
        "b": literal("b", "LENGTH", "3"),
        "bad": {
            "parameter_id": "bad",
            "name": "bad",
            "value_type": "LENGTH",
            "literal": None,
            "expression": {
                "kind": "BINARY",
                "operator": "MULTIPLY",
                "left": {"kind": "PARAMETER", "parameter_id": "a"},
                "right": {"kind": "PARAMETER", "parameter_id": "b"},
            },
        },
    }
    with pytest.raises(KernelError) as caught:
        resolve_parameters(parameters)
    assert caught.value.code == "PARAMETER_DIMENSION_INVALID"
