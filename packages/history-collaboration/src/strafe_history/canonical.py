"""Small RFC 8785 JSON Canonicalization Scheme implementation.

Canonical decimal *domain values* are strings at the Forge boundary.  This
module nevertheless handles finite IEEE-754 JSON numbers so opaque JSON can be
retained without relying on dictionary iteration order or Python's exponent
formatting.  Integers outside the interoperable IEEE-754 range fail closed.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Iterable, List, Tuple, Union

from .errors import DiagnosticError


JSONScalar = Union[None, bool, int, float, str]
JSONValue = Union[JSONScalar, List["JSONValue"], dict]
_MAX_SAFE_INTEGER = 9007199254740991


def _reject_duplicate_keys(pairs: Iterable[Tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise DiagnosticError(
                "JSON_DUPLICATE_KEY",
                "duplicate object member is not a valid canonical record",
                details={"key": key},
            )
        result[key] = value
    return result


def parse_json(payload: Union[str, bytes], require_canonical: bool = False) -> JSONValue:
    """Parse JSON while rejecting duplicate keys, constants, BOMs, and ambiguity."""

    if isinstance(payload, bytes):
        try:
            text = payload.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise DiagnosticError("JSON_UTF8_INVALID", "record is not valid UTF-8") from exc
    elif isinstance(payload, str):
        text = payload
    else:
        raise DiagnosticError("JSON_TYPE_INVALID", "JSON input must be text or bytes")
    if text.startswith("\ufeff"):
        raise DiagnosticError("JSON_BOM_FORBIDDEN", "canonical JSON cannot contain a BOM")
    try:
        value = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=lambda token: (_ for _ in ()).throw(
                DiagnosticError("JSON_NUMBER_NON_FINITE", "non-finite JSON number", details={"token": token})
            ),
        )
    except DiagnosticError:
        raise
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise DiagnosticError("JSON_MALFORMED", "record is not valid JSON") from exc
    _validate_json_value(value, "$")
    if require_canonical and canonical_text(value) != text:
        raise DiagnosticError("JSON_NOT_CANONICAL", "persisted record is not RFC 8785 canonical JSON")
    return value


def _validate_string(value: str, path: str) -> None:
    for char in value:
        point = ord(char)
        if 0xD800 <= point <= 0xDFFF:
            raise DiagnosticError("JSON_UNICODE_INVALID", "lone surrogate is forbidden", path=path)


def _validate_json_value(value: Any, path: str) -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        if abs(value) > _MAX_SAFE_INTEGER:
            raise DiagnosticError(
                "JSON_INTEGER_UNSAFE",
                "integer exceeds the interoperable IEEE-754 range",
                path=path,
                details={"maximum": _MAX_SAFE_INTEGER},
            )
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise DiagnosticError("JSON_NUMBER_NON_FINITE", "non-finite JSON number", path=path)
        return
    if isinstance(value, str):
        _validate_string(value, path)
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_json_value(item, "{0}[{1}]".format(path, index))
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise DiagnosticError("JSON_KEY_INVALID", "JSON object keys must be strings", path=path)
            _validate_string(key, path)
            _validate_json_value(item, "{0}.{1}".format(path, key))
        return
    raise DiagnosticError(
        "JSON_VALUE_INVALID",
        "value is outside the JSON data model",
        path=path,
        details={"type": type(value).__name__},
    )


def _utf16_sort_key(value: str) -> bytes:
    try:
        return value.encode("utf-16-be")
    except UnicodeEncodeError as exc:
        raise DiagnosticError("JSON_UNICODE_INVALID", "lone surrogate is forbidden") from exc


def _encode_string(value: str) -> str:
    _validate_string(value, "$")
    # json.dumps uses the short JSON escapes and lower-case \u00xx escapes that
    # JCS requires when ensure_ascii is disabled.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _float_to_jcs(value: float) -> str:
    if not math.isfinite(value):
        raise DiagnosticError("JSON_NUMBER_NON_FINITE", "non-finite JSON number")
    if value == 0.0:
        return "0"

    negative = value < 0
    raw = repr(abs(value)).lower()
    if "e" in raw:
        mantissa, exponent_text = raw.split("e", 1)
        exponent = int(exponent_text)
    else:
        mantissa = raw
        exponent = 0

    if "." in mantissa:
        whole, fraction = mantissa.split(".", 1)
    else:
        whole, fraction = mantissa, ""
    digits = (whole + fraction).lstrip("0") or "0"
    power = exponent - len(fraction)
    while len(digits) > 1 and digits.endswith("0"):
        digits = digits[:-1]
        power += 1

    decimal_position = len(digits) + power
    magnitude = abs(value)
    if 1e-6 <= magnitude < 1e21:
        if decimal_position <= 0:
            encoded = "0." + ("0" * -decimal_position) + digits
        elif decimal_position >= len(digits):
            encoded = digits + ("0" * (decimal_position - len(digits)))
        else:
            encoded = digits[:decimal_position] + "." + digits[decimal_position:]
    else:
        fraction_digits = digits[1:]
        encoded = digits[0]
        if fraction_digits:
            encoded += "." + fraction_digits
        scientific_exponent = decimal_position - 1
        sign = "+" if scientific_exponent >= 0 else ""
        encoded += "e" + sign + str(scientific_exponent)
    return ("-" if negative else "") + encoded


def _serialize(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        if abs(value) > _MAX_SAFE_INTEGER:
            raise DiagnosticError("JSON_INTEGER_UNSAFE", "integer exceeds the interoperable IEEE-754 range")
        return str(value)
    if isinstance(value, float):
        return _float_to_jcs(value)
    if isinstance(value, str):
        return _encode_string(value)
    if isinstance(value, list):
        return "[" + ",".join(_serialize(item) for item in value) + "]"
    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys(), key=_utf16_sort_key):
            if not isinstance(key, str):
                raise DiagnosticError("JSON_KEY_INVALID", "JSON object keys must be strings")
            parts.append(_encode_string(key) + ":" + _serialize(value[key]))
        return "{" + ",".join(parts) + "}"
    raise DiagnosticError(
        "JSON_VALUE_INVALID",
        "value is outside the JSON data model",
        details={"type": type(value).__name__},
    )


def canonical_text(value: JSONValue) -> str:
    _validate_json_value(value, "$")
    return _serialize(value)


def canonical_bytes(value: JSONValue) -> bytes:
    return canonical_text(value).encode("utf-8")


def digest_json(value: JSONValue) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()
