from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from helpers import CANDIDATE, write_manifest
from order_execution import DeliveryOutcome, OrderDispatcher, RecordingConnector


ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / "packages" / "order-execution" / "contracts"


def test_contracts_are_valid_and_runtime_records_conform(tmp_path: Path) -> None:
    schemas = {path.name: json.loads(path.read_text(encoding="utf-8")) for path in SCHEMAS.glob("*.schema.json")}
    assert set(schemas) == {
        "sealed-sourcing-package.v1.schema.json",
        "order-dispatch-request.v1.schema.json",
        "order-dispatch-receipt.v1.schema.json",
        "order-audit-event.v1.schema.json",
    }
    validators = {}
    for name, schema in schemas.items():
        Draft202012Validator.check_schema(schema)
        validators[name] = Draft202012Validator(schema)

    manifest_path = write_manifest(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validators["sealed-sourcing-package.v1.schema.json"].validate(manifest)
    dispatcher = OrderDispatcher()
    result = dispatcher.dispatch(
        manifest_path=manifest_path, package_root=tmp_path,
        expected_candidate=CANDIDATE,
        connector=RecordingConnector(outcome=DeliveryOutcome.ACKNOWLEDGED),
        route_ref="supplier:fixture", idempotency_key="schema-key-001",
        actor_id="actor:test", occurred_at="2026-09-05T18:00:00Z",
    )
    validators["order-dispatch-request.v1.schema.json"].validate(result.request.as_dict())
    validators["order-dispatch-receipt.v1.schema.json"].validate(result.receipt.as_dict())
    for event in dispatcher.audit_events:
        validators["order-audit-event.v1.schema.json"].validate(event.as_dict())
