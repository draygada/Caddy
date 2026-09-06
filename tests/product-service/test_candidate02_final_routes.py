from __future__ import annotations

from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[2]
for source_root in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "order-execution" / "src",
    REPO / "packages" / "cad-output" / "src",
):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)

from product_service.app import Candidate02Routes  # noqa: E402
from product_service.cad_output_api import CadOutputRuntime  # noqa: E402
from product_service.order_api import OrderApiRuntime, RUNTIME_BOUNDARY  # noqa: E402


CANDIDATE_IDENTITY = {
    "candidate_id": "candidate:0.2",
    "revision_id": "revision:integration-fixture",
    "snapshot_sha256": "a" * 64,
}
ORDER_PATHS = {
    "/api/orders/packages/validate",
    "/api/orders/dispatches",
    "/api/orders/receipts/read",
    "/api/orders/receipts/acknowledge",
    "/api/orders/receipts/reconcile",
    "/api/orders/receipts/close",
    "/api/orders/audit/verify",
}
CAD_OUTPUT_PATHS = {
    "/api/cad/outputs/native/seal",
    "/api/cad/outputs/native/load",
    "/api/cad/outputs/generate",
}


def _routes(tmp_path: Path) -> Candidate02Routes:
    order_runtime = OrderApiRuntime(tmp_path, {
        "candidate_id": CANDIDATE_IDENTITY["candidate_id"],
        "revision": CANDIDATE_IDENTITY["revision_id"],
        "artifact_sha256": CANDIDATE_IDENTITY["snapshot_sha256"],
    })
    return Candidate02Routes(
        CANDIDATE_IDENTITY,
        order_runtime=order_runtime,
        cad_output_runtime=CadOutputRuntime(),
    )


def test_every_order_lifecycle_and_cad_output_route_is_mounted(tmp_path: Path) -> None:
    routes = _routes(tmp_path)
    assert ORDER_PATHS | CAD_OUTPUT_PATHS <= routes.post_paths

    for path in ORDER_PATHS:
        status, body = routes.dispatch(path, {})
        assert status != 404
        assert body["runtime_boundary"] == RUNTIME_BOUNDARY
        assert body["runtime_boundary"]["connector"] == "RECORDING_ONLY"
        assert body["runtime_boundary"]["external_effect"] == "NONE"
        assert body["runtime_boundary"]["external_calls"] == 0

    for path in CAD_OUTPUT_PATHS:
        status, body = routes.dispatch(path, {})
        assert status != 404
        assert body["schema_version"] == "caddydaddy.cad-output-api/1"
        assert body["status"] == "REJECTED"


def test_unconfigured_order_routes_stay_mounted_and_fail_closed(monkeypatch) -> None:
    monkeypatch.delenv("CADDYDADDY_ORDER_PACKAGE_ROOT", raising=False)
    routes = Candidate02Routes(CANDIDATE_IDENTITY, cad_output_runtime=CadOutputRuntime())

    for path in ORDER_PATHS:
        status, body = routes.dispatch(path, {})
        assert status == 503
        assert body["status"] == "BLOCKED"
        assert body["domain"] == "orders"
        assert body["diagnostic"]["code"] == "ADAPTER_UNAVAILABLE"


def test_unknown_route_does_not_fall_through_to_an_adapter(tmp_path: Path) -> None:
    status, body = _routes(tmp_path).dispatch("/api/orders/live-send", {})
    assert status == 404
    assert body["diagnostic"]["code"] == "ROUTE_NOT_FOUND"
