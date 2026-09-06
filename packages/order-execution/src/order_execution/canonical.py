from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Iterable, Tuple

from .errors import OrderExecutionError, require


def _pairs(pairs: Iterable[Tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, child in pairs:
        require(key not in value, "JSON_DUPLICATE_KEY", "duplicate JSON members are forbidden", key=key)
        value[key] = child
    return value


def _validate(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (bool, str, int)):
        return
    if isinstance(value, float):
        require(math.isfinite(value), "JSON_NUMBER_INVALID", "non-finite JSON numbers are forbidden", path=path)
        raise OrderExecutionError("JSON_FLOAT_FORBIDDEN", "boundary numbers must use integers or decimal strings", path=path)
    if isinstance(value, list):
        for index, child in enumerate(value):
            _validate(child, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, child in value.items():
            require(isinstance(key, str), "JSON_KEY_INVALID", "JSON object keys must be strings", path=path)
            _validate(child, f"{path}.{key}")
        return
    raise OrderExecutionError("JSON_VALUE_INVALID", "value is outside the supported JSON data model", path=path)


def canonical_bytes(value: Any) -> bytes:
    _validate(value)
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def parse_json(payload: bytes) -> Any:
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise OrderExecutionError("JSON_UTF8_INVALID", "JSON must be UTF-8") from exc
    require(not text.startswith("\ufeff"), "JSON_BOM_FORBIDDEN", "JSON BOM is forbidden")
    try:
        value = json.loads(
            text,
            object_pairs_hook=_pairs,
            parse_constant=lambda token: (_ for _ in ()).throw(
                OrderExecutionError("JSON_NUMBER_INVALID", "non-finite JSON numbers are forbidden", token=token)
            ),
        )
    except OrderExecutionError:
        raise
    except json.JSONDecodeError as exc:
        raise OrderExecutionError("JSON_MALFORMED", "manifest is not valid JSON") from exc
    _validate(value)
    return value
