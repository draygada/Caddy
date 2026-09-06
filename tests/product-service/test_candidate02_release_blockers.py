from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


REPO = Path(__file__).resolve().parents[2]
for source_root in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "compliance-bridge",
    REPO / "packages" / "classification",
    REPO / "packages" / "cad-output" / "src",
    REPO / "packages" / "order-execution" / "src",
):
    sys.path.insert(0, str(source_root))

from product_service.app import (  # noqa: E402
    CANDIDATE02_POST_ROUTES,
    RELEASE_CANDIDATE_ID,
    RELEASE_CANDIDATE_VERSION,
    RELEASE_REVISION_ID,
    Candidate02Routes,
)


def test_default_order_runtime_is_inline_and_recording_only(monkeypatch) -> None:
    monkeypatch.delenv("CADDYDADDY_ORDER_PACKAGE_ROOT", raising=False)
    identity = {
        "candidate_id": RELEASE_CANDIDATE_ID,
        "revision_id": RELEASE_REVISION_ID,
        "snapshot_sha256": "a" * 64,
    }
    routes = Candidate02Routes(identity, classification_action=lambda _: (200, {}))

    status, body = routes.dispatch("/api/orders/packages/validate", {
        "candidate": {
            "candidate_id": RELEASE_CANDIDATE_ID,
            "revision": RELEASE_REVISION_ID,
            "artifact_sha256": "a" * 64,
        }
    })

    assert status != 503
    assert body["runtime_boundary"] == {
        "persistence": "PROCESS_LOCAL_DEMO_ONLY",
        "connector": "RECORDING_ONLY",
        "external_effect": "NONE",
        "external_calls": 0,
    }
    assert routes.post_paths == frozenset(CANDIDATE02_POST_ROUTES)


def test_isolated_bundle_closes_identity_contract_and_order_blockers(tmp_path: Path) -> None:
    bundle = tmp_path / "candidate"
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [
            sys.executable,
            str(REPO / "apps" / "product-service" / "scripts" / "build_bundle.py"),
            "--output",
            str(bundle),
        ],
        cwd=REPO,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert completed.returncode == 0, completed.stderr
    summary = json.loads(completed.stdout)
    probe = summary["runtime_probe"]
    assert probe["health_candidate"] == RELEASE_CANDIDATE_VERSION
    assert probe["candidate_identity"] == {
        "candidate_id": RELEASE_CANDIDATE_ID,
        "revision_id": RELEASE_REVISION_ID,
        "snapshot_sha256": summary["snapshot_sha256"],
    }
    assert probe["classification_status"] == 200
    assert probe["order_status"] != 503
    assert probe["order_boundary"]["connector"] == "RECORDING_ONLY"
    assert probe["order_boundary"]["external_effect"] == "NONE"
    assert probe["order_boundary"]["external_calls"] == 0
    assert (bundle / "packages" / "classification" / "contracts" / "determination.schema.json").is_file()
    assert (bundle / "packages" / "classification" / "data" / "ecfr" / "raw" / "title-22-part-121.xml").is_file()
