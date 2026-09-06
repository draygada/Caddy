"""Export exact Pydantic request/response schemas into the owned contract package."""

from __future__ import annotations

import json
from pathlib import Path

from cad_service.models import (
    AssemblyRequest,
    AssemblyResponse,
    CadDocument,
    ExchangeRequest,
    ExchangeResponse,
    RecomputeRequest,
    RecomputeResponse,
)


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "packages" / "cad-contracts" / "schemas"
MODELS = {
    "cad-document.v1.schema.json": CadDocument,
    "recompute-request.v1.schema.json": RecomputeRequest,
    "recompute-result.v1.schema.json": RecomputeResponse,
    "assembly-request.v1.schema.json": AssemblyRequest,
    "assembly-result.v1.schema.json": AssemblyResponse,
    "exchange-request.v1.schema.json": ExchangeRequest,
    "exchange-result.v1.schema.json": ExchangeResponse,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, model in MODELS.items():
        path = OUT / name
        path.write_text(json.dumps(model.model_json_schema(), indent=2, sort_keys=True) + "\n", encoding="ascii")


if __name__ == "__main__":
    main()
