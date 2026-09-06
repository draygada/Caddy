"""Fail-closed service adapter for the preserved Forge classification engine.

The default adapter is deliberately local and deterministic. It can use only
``ScriptedModel`` or ``CacheModel`` unless an integrator explicitly constructs an
adapter with ``allow_external_model=True``. No environment variable, API key, or
installed provider SDK can silently opt the default route into external calls.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
import json
from typing import Any

from forge_classification import ModelUnavailable, ReferencePack, default_pack, run
from forge_classification.contracts import load_schema
from forge_classification.model import BudgetExhausted, CacheModel, ModelClient, ScriptedModel
from forge_classification.verifier import Accepted, verify_citation
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


ENDPOINT_PATH = "/api/classification"
ERROR_SCHEMA_VERSION = "caddydaddy.classification-error/1"
_ITEM_KINDS = frozenset({"commodity", "software", "technology"})
_REQUEST_KEYS = frozenset({"product_or_part", "facts", "item_kind", "budget"})
_BUDGET_KEYS = frozenset({"calls_cap", "cost_cap_microusd", "estimated_cost_microusd"})
_LOCAL_MODEL_TYPES = (ScriptedModel, CacheModel)


class RequestRejected(ValueError):
    """The request cannot be admitted to the classification engine."""


class OutputRejected(RuntimeError):
    """The engine result cannot cross the service boundary."""


@dataclass(frozen=True, slots=True)
class ClassificationRequest:
    product_or_part: dict[str, Any] | str
    facts: dict[str, Any] | list[dict[str, Any]] | None
    item_kind: str
    calls_cap: int
    cost_cap_microusd: int
    estimated_cost_microusd: int


def _bounded_integer(value: Any, *, name: str, default: int, maximum: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > maximum:
        raise RequestRejected(f"{name} must be an integer from 0 through {maximum}")
    return value


def _parse_request(payload: Any) -> ClassificationRequest:
    if not isinstance(payload, Mapping):
        raise RequestRejected("request body must be a JSON object")
    unknown = set(payload) - _REQUEST_KEYS
    if unknown:
        raise RequestRejected(f"unknown request fields: {', '.join(sorted(unknown))}")
    if "product_or_part" not in payload:
        raise RequestRejected("product_or_part is required")

    product_or_part = payload["product_or_part"]
    if isinstance(product_or_part, str):
        product_or_part = product_or_part.strip()
        if not product_or_part:
            raise RequestRejected("product description must not be empty")
    elif isinstance(product_or_part, Mapping):
        product_or_part = dict(product_or_part)
        if product_or_part.get("protocol_version") != "forge.part-revision/1":
            raise RequestRejected("part input must use forge.part-revision/1")
    else:
        raise RequestRejected("product_or_part must be a description or forge.part-revision/1 object")

    facts = payload.get("facts")
    if facts is not None and not isinstance(facts, (dict, list)):
        raise RequestRejected("facts must be an object, an array, or null")
    if isinstance(facts, list) and not all(isinstance(fact, dict) for fact in facts):
        raise RequestRejected("every facts array entry must be an object")

    item_kind = payload.get("item_kind", "commodity")
    if item_kind not in _ITEM_KINDS:
        raise RequestRejected(f"item_kind must be one of {', '.join(sorted(_ITEM_KINDS))}")

    budget = payload.get("budget", {})
    if not isinstance(budget, Mapping):
        raise RequestRejected("budget must be an object")
    unknown_budget = set(budget) - _BUDGET_KEYS
    if unknown_budget:
        raise RequestRejected(f"unknown budget fields: {', '.join(sorted(unknown_budget))}")

    return ClassificationRequest(
        product_or_part=product_or_part,
        facts=facts,
        item_kind=item_kind,
        calls_cap=_bounded_integer(budget.get("calls_cap"), name="calls_cap", default=16, maximum=64),
        cost_cap_microusd=_bounded_integer(
            budget.get("cost_cap_microusd"),
            name="cost_cap_microusd",
            default=8_000_000,
            maximum=100_000_000,
        ),
        estimated_cost_microusd=_bounded_integer(
            budget.get("estimated_cost_microusd"),
            name="estimated_cost_microusd",
            default=250_000,
            maximum=10_000_000,
        ),
    )


def _default_scripted_model() -> ScriptedModel:
    # Two explicit, non-abstaining empty proposal responses let the engine record
    # that USML was not demonstrated and return UNDETERMINED. This default never
    # guesses a candidate and never reaches an external provider.
    empty = {"candidates": [], "specially_designed_read": "", "no_usml_reasoning": "No scripted candidate."}
    return ScriptedModel({"usml_propose": [dict(empty), dict(empty)]})


def _blocked(code: str, message: str) -> dict[str, Any]:
    return {
        "schema_version": ERROR_SCHEMA_VERSION,
        "status": "BLOCKED",
        "diagnostic": {"code": code, "message": message},
    }


def _verify_carried_citations(result: Mapping[str, Any], pack: ReferencePack) -> None:
    for candidate in result.get("candidates", []):
        for element in candidate.get("elements", []):
            citation = element.get("citation")
            if citation is not None and not isinstance(verify_citation(pack, citation), Accepted):
                raise OutputRejected("engine output carried a citation that does not verify against the active pack")


class ClassificationAdapter:
    """Invoke, serialize, and validate the classification engine as one transaction."""

    def __init__(
        self,
        *,
        model_factory: Callable[[], ModelClient] | None = None,
        pack_factory: Callable[[], ReferencePack] = default_pack,
        allow_external_model: bool = False,
    ) -> None:
        self._model_factory = model_factory or _default_scripted_model
        self._pack_factory = pack_factory
        self._allow_external_model = allow_external_model
        self._validator = Draft202012Validator(load_schema("determination"))
        self._pack: ReferencePack | None = None

    def _active_pack(self) -> ReferencePack:
        if self._pack is None:
            self._pack = self._pack_factory()
        return self._pack

    def classify(self, payload: Any) -> tuple[int, dict[str, Any]]:
        """Return ``(http_status, body)`` without ever returning a partial determination."""
        try:
            request = _parse_request(payload)
        except RequestRejected as error:
            return 400, _blocked("CLASSIFICATION_REQUEST_INVALID", str(error))

        try:
            model = self._model_factory()
        except Exception:  # noqa: BLE001 - provider construction details must not cross the boundary
            return 503, _blocked("CLASSIFICATION_MODEL_UNAVAILABLE", "classification model could not be initialized")
        if not self._allow_external_model and not isinstance(model, _LOCAL_MODEL_TYPES):
            return 503, _blocked(
                "CLASSIFICATION_EXTERNAL_MODEL_DISABLED",
                "only scripted or cache-backed models are enabled for this adapter",
            )

        try:
            pack = self._active_pack()
            result = run(
                request.product_or_part,
                model,
                item_kind=request.item_kind,
                facts=request.facts,
                pack=pack,
                calls_cap=request.calls_cap,
                cost_cap_microusd=request.cost_cap_microusd,
                estimated_cost_microusd=request.estimated_cost_microusd,
            )
            serialized = json.loads(json.dumps(result, ensure_ascii=False, allow_nan=False, sort_keys=True))
            self._validator.validate(serialized)
            _verify_carried_citations(serialized, pack)
            return 200, serialized
        except BudgetExhausted:
            return 429, _blocked("CLASSIFICATION_BUDGET_EXHAUSTED", "classification budget was exhausted before completion")
        except ModelUnavailable:
            return 503, _blocked("CLASSIFICATION_MODEL_UNAVAILABLE", "scripted analysis could not produce a candidate board")
        except (ValidationError, OutputRejected, TypeError, OverflowError):
            return 502, _blocked("CLASSIFICATION_OUTPUT_INVALID", "classification output failed contract validation")
        except (KeyError, ValueError):
            return 400, _blocked("CLASSIFICATION_INPUT_INVALID", "classification input could not be normalized")
        except Exception:  # noqa: BLE001 - fail closed without leaking pack, model, or prompt details
            return 500, _blocked("CLASSIFICATION_FAILED", "classification failed without producing a determination")


def create_router(adapter: ClassificationAdapter | None = None):
    """Build an optional FastAPI router; mount later with ``app.include_router(create_router())``."""
    try:
        from fastapi import APIRouter, Request
        from fastapi.responses import JSONResponse
    except ImportError as error:  # FastAPI is not a product-service runtime dependency today.
        raise RuntimeError("FastAPI is not installed; use ClassificationAdapter.classify directly") from error

    active = adapter or ClassificationAdapter()
    router = APIRouter()

    @router.post(ENDPOINT_PATH)
    async def classify_request(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except Exception:  # noqa: BLE001 - malformed request bodies fail before engine invocation
            return JSONResponse(
                status_code=400,
                content=_blocked("CLASSIFICATION_REQUEST_INVALID", "request body must be valid JSON"),
            )
        status, body = active.classify(payload)
        return JSONResponse(status_code=status, content=body)

    return router


__all__ = ["ClassificationAdapter", "ClassificationRequest", "ENDPOINT_PATH", "create_router"]
