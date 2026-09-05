"""Loader for the lane's frozen JSON Schema contract."""

from __future__ import annotations

import json
from pathlib import Path

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"


def load_schema(name: str) -> dict:
    return json.loads((CONTRACTS_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))
