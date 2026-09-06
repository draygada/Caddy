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


# Claude structured outputs accept only a subset of JSON Schema. The reference lists as NOT supported:
# "Recursive schemas", "Numerical constraints (`minimum`, `maximum`, `multipleOf`)", "String constraints
# (`minLength`, `maxLength`)", "Complex array constraints", and "`additionalProperties` set to anything other
# than `false`" (claude-api/shared/tool-use-concepts.md, "JSON Schema Limitations"). `pattern` is a string
# constraint and appears nowhere in that section's "Supported" list, so it goes too; `additionalProperties` is
# only ever False here, which the same list calls "required for all objects", so it stays.
API_UNSUPPORTED_KEYWORDS = frozenset({
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minLength", "maxLength", "pattern",
    "minItems", "maxItems", "uniqueItems", "contains", "minContains", "maxContains",
})


def api_schema(schema: dict) -> dict:
    """A deep copy of `schema` stripped to the subset the API accepts in `output_config.format.schema`.

    The API rejects the rest outright — 400 "For 'array' type, property 'maxItems' is not supported" — which
    turned every live call into an abstain. Stripping them relaxes nothing: the caller still runs
    `validate(response, <full schema>)` on what comes back, and THAT is the fail-closed gate for the caps,
    patterns and minimums, not the request.
    """
    out: dict = {}
    for key, value in schema.items():
        if key in API_UNSUPPORTED_KEYWORDS:
            continue
        if key == "properties" and isinstance(value, dict):
            out[key] = {name: api_schema(sub) for name, sub in value.items()}   # property NAMES are data, never keywords
        elif isinstance(value, dict):
            out[key] = api_schema(value)
        elif isinstance(value, list):
            out[key] = [api_schema(item) if isinstance(item, dict) else item for item in value]
        else:
            out[key] = value
    return out


def validate(instance, schema: dict) -> str | None:
    try:
        jsonschema.Draft202012Validator(schema).validate(instance)
    except jsonschema.ValidationError as error:
        return error.message
    return None
