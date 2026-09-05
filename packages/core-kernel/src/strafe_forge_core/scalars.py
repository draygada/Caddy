"""Exact, non-executable parameter and expression evaluation."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from fractions import Fraction
from typing import Any, Mapping

from .diagnostics import KernelError


NUMERIC_TYPES = frozenset({"SCALAR", "LENGTH", "ANGLE", "INTEGER"})
VALUE_TYPES = NUMERIC_TYPES | {"BOOLEAN", "STRING"}
DECIMAL_PATTERN = re.compile(r"^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$")
INTEGER_PATTERN = re.compile(r"^-?(?:0|[1-9][0-9]*)$")


def parse_decimal(value: object) -> Fraction:
    """Parse the contract's canonical finite decimal subset into an exact rational."""

    if not isinstance(value, str) or not DECIMAL_PATTERN.fullmatch(value) or value == "-0":
        raise KernelError("DECIMAL_INVALID", f"Invalid canonical decimal: {value!r}")
    negative = value.startswith("-")
    unsigned = value[1:] if negative else value
    if "." not in unsigned:
        result = Fraction(int(unsigned), 1)
    else:
        whole, fraction = unsigned.split(".", 1)
        denominator = 10 ** len(fraction)
        numerator = int(whole) * denominator + int(fraction)
        result = Fraction(numerator, denominator)
    return -result if negative else result


def canonical_decimal(value: float, *, digits: int = 12) -> str:
    """Normalize a finite kernel binary64 observation for semantic evidence.

    OCCT calculations are binary64.  Observations are rounded to a declared number of
    decimal places before entering semantic fingerprints; raw binary values are never
    presented as exact authored dimensions.
    """

    if not math.isfinite(value):
        raise KernelError("PARAMETER_NON_FINITE", "Kernel produced a non-finite value")
    if abs(value) < 0.5 * (10.0 ** -digits):
        return "0"
    rendered = f"{value:.{digits}f}".rstrip("0").rstrip(".")
    return "0" if rendered == "-0" else rendered


@dataclass(frozen=True, slots=True)
class ResolvedValue:
    value_type: str
    value: Fraction | bool | str

    def __post_init__(self) -> None:
        if self.value_type not in VALUE_TYPES:
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH", f"Unsupported value type {self.value_type!r}"
            )
        if self.value_type in NUMERIC_TYPES and not isinstance(self.value, Fraction):
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH", f"{self.value_type} must resolve to a rational"
            )
        if self.value_type == "INTEGER" and isinstance(self.value, Fraction):
            if self.value.denominator != 1:
                raise KernelError(
                    "PARAMETER_TYPE_MISMATCH", "INTEGER must have denominator one"
                )
        if self.value_type == "BOOLEAN" and not isinstance(self.value, bool):
            raise KernelError("PARAMETER_TYPE_MISMATCH", "BOOLEAN must resolve to bool")
        if self.value_type == "STRING" and not isinstance(self.value, str):
            raise KernelError("PARAMETER_TYPE_MISMATCH", "STRING must resolve to str")

    @property
    def rational(self) -> Fraction:
        if self.value_type not in NUMERIC_TYPES or not isinstance(self.value, Fraction):
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH", f"{self.value_type} is not numeric"
            )
        return self.value

    def as_dict(self) -> dict[str, object]:
        if isinstance(self.value, Fraction):
            return {
                "value_type": self.value_type,
                "numerator": str(self.value.numerator),
                "denominator": str(self.value.denominator),
            }
        return {"value_type": self.value_type, "value": self.value}

    def as_float(self) -> float:
        result = float(self.rational)
        if not math.isfinite(result):
            raise KernelError(
                "PARAMETER_NON_FINITE", "Rational value does not fit finite binary64"
            )
        return result


class ParameterEvaluator:
    def __init__(self, parameters: Mapping[str, Mapping[str, Any]]) -> None:
        self._parameters = parameters
        self._resolved: dict[str, ResolvedValue] = {}
        self._active: list[str] = []

    def resolve_all(self) -> dict[str, ResolvedValue]:
        for parameter_id in sorted(self._parameters):
            self.resolve(parameter_id)
        return dict(self._resolved)

    def resolve(self, parameter_id: str) -> ResolvedValue:
        if parameter_id in self._resolved:
            return self._resolved[parameter_id]
        if parameter_id in self._active:
            cycle = " -> ".join([*self._active, parameter_id])
            raise KernelError("PARAMETER_CYCLE", f"Parameter cycle: {cycle}")
        parameter = self._parameters.get(parameter_id)
        if parameter is None:
            raise KernelError("PARAMETER_MISSING", f"Unknown parameter {parameter_id!r}")
        if parameter.get("parameter_id") != parameter_id:
            raise KernelError(
                "DUPLICATE_ID", f"Parameter map key does not match {parameter_id!r}"
            )
        value_type = parameter.get("value_type")
        if value_type not in VALUE_TYPES:
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH", f"Invalid type for {parameter_id!r}"
            )
        literal = parameter.get("literal")
        expression = parameter.get("expression")
        if (literal is None) == (expression is None):
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH",
                f"{parameter_id!r} must define exactly one literal or expression",
            )
        self._active.append(parameter_id)
        try:
            if expression is not None:
                result = self._evaluate_expression(expression)
            else:
                result = self._literal(value_type, literal)
            if result.value_type != value_type:
                raise KernelError(
                    "PARAMETER_TYPE_MISMATCH",
                    f"{parameter_id!r} declares {value_type} but resolves to {result.value_type}",
                )
            self._resolved[parameter_id] = result
            return result
        finally:
            self._active.pop()

    @staticmethod
    def _literal(value_type: str, literal: object) -> ResolvedValue:
        if value_type in NUMERIC_TYPES:
            return ResolvedValue(value_type, parse_decimal(literal))
        if value_type == "BOOLEAN" and isinstance(literal, bool):
            return ResolvedValue(value_type, literal)
        if value_type == "STRING" and isinstance(literal, str):
            return ResolvedValue(value_type, literal)
        raise KernelError(
            "PARAMETER_TYPE_MISMATCH", f"Invalid literal for {value_type}: {literal!r}"
        )

    def _evaluate_expression(self, expression: object) -> ResolvedValue:
        if not isinstance(expression, Mapping):
            raise KernelError("PARAMETER_TYPE_MISMATCH", "Expression must be an object")
        kind = expression.get("kind")
        if kind == "SCALAR":
            value_type = expression.get("value_type")
            if value_type not in NUMERIC_TYPES:
                raise KernelError(
                    "PARAMETER_TYPE_MISMATCH", "SCALAR node requires a numeric value_type"
                )
            return ResolvedValue(value_type, parse_decimal(expression.get("value")))
        if kind == "BOOLEAN":
            value = expression.get("value")
            if not isinstance(value, bool):
                raise KernelError("PARAMETER_TYPE_MISMATCH", "BOOLEAN node requires bool")
            return ResolvedValue("BOOLEAN", value)
        if kind == "STRING":
            value = expression.get("value")
            if not isinstance(value, str):
                raise KernelError("PARAMETER_TYPE_MISMATCH", "STRING node requires str")
            return ResolvedValue("STRING", value)
        if kind == "PARAMETER":
            parameter_id = expression.get("parameter_id")
            if not isinstance(parameter_id, str):
                raise KernelError(
                    "PARAMETER_MISSING", "PARAMETER node requires parameter_id"
                )
            return self.resolve(parameter_id)
        if kind == "UNARY":
            operand = self._evaluate_expression(expression.get("operand"))
            value = operand.rational
            operator = expression.get("operator")
            if operator == "NEGATE":
                return ResolvedValue(operand.value_type, -value)
            if operator == "ABS":
                return ResolvedValue(operand.value_type, abs(value))
            raise KernelError(
                "PARAMETER_TYPE_MISMATCH", f"Unsupported unary operator {operator!r}"
            )
        if kind == "BINARY":
            left = self._evaluate_expression(expression.get("left"))
            right = self._evaluate_expression(expression.get("right"))
            return self._binary(expression.get("operator"), left, right)
        raise KernelError(
            "PARAMETER_TYPE_MISMATCH", f"Unsupported expression kind {kind!r}"
        )

    @staticmethod
    def _binary(
        operator: object, left: ResolvedValue, right: ResolvedValue
    ) -> ResolvedValue:
        left_value = left.rational
        right_value = right.rational
        if operator in {"ADD", "SUBTRACT", "MIN", "MAX"}:
            if left.value_type != right.value_type:
                raise KernelError(
                    "PARAMETER_DIMENSION_INVALID",
                    f"{operator} requires equal numeric types",
                )
            if operator == "ADD":
                value = left_value + right_value
            elif operator == "SUBTRACT":
                value = left_value - right_value
            elif operator == "MIN":
                value = min(left_value, right_value)
            else:
                value = max(left_value, right_value)
            return ResolvedValue(left.value_type, value)
        if operator == "MULTIPLY":
            if left.value_type == "SCALAR":
                return ResolvedValue(right.value_type, left_value * right_value)
            if right.value_type == "SCALAR":
                return ResolvedValue(left.value_type, left_value * right_value)
            raise KernelError(
                "PARAMETER_DIMENSION_INVALID",
                "MULTIPLY requires at least one SCALAR operand",
            )
        if operator == "DIVIDE":
            if right_value == 0:
                raise KernelError("PARAMETER_DIVIDE_BY_ZERO", "Division by zero")
            if right.value_type == "SCALAR":
                return ResolvedValue(left.value_type, left_value / right_value)
            if left.value_type == right.value_type:
                return ResolvedValue("SCALAR", left_value / right_value)
            raise KernelError(
                "PARAMETER_DIMENSION_INVALID",
                "DIVIDE requires X / SCALAR or equal numeric types",
            )
        raise KernelError(
            "PARAMETER_TYPE_MISMATCH", f"Unsupported binary operator {operator!r}"
        )


def resolve_parameters(
    parameters: Mapping[str, Mapping[str, Any]],
) -> dict[str, ResolvedValue]:
    return ParameterEvaluator(parameters).resolve_all()
