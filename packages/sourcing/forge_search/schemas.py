"""The three closed schemas. There is no classification, jurisdiction, entry, origin, ownership or screening key
anywhere: a vendor's "EAR99" has no path in (F-07)."""
from __future__ import annotations

import jsonschema

UNVERIFIED_SPEC_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["field", "value", "unit", "quote", "start", "end", "doc_sha256"],
    "properties": {
        "field": {"type": "string", "minLength": 1},
        "value": {"type": "string", "pattern": "^[-+]?[0-9]+(\\.[0-9]+)?$"},
        "unit": {"type": "string", "minLength": 1},
        "quote": {"type": "string", "minLength": 1},
        "start": {"type": "integer", "minimum": 0},
        "end": {"type": "integer", "minimum": 0},
        "doc_sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
    },
}
EXTRACT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["specs"],
    "properties": {"specs": {"type": "array", "maxItems": 40, "items": UNVERIFIED_SPEC_SCHEMA}},
}
SEARCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["candidates"],
    "properties": {
        "candidates": {
            "type": "array",
            "maxItems": 5,
            "items": {"type": "object", "additionalProperties": False, "required": ["mpn", "url"],
                      "properties": {"mpn": {"type": "string", "minLength": 1}, "url": {"type": "string", "minLength": 1}}},
        }
    },
}


def validate(instance, schema: dict) -> str | None:
    try:
        jsonschema.Draft202012Validator(schema).validate(instance)
    except jsonschema.ValidationError as error:
        return error.message
    return None
