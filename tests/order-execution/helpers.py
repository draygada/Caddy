from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from order_execution.canonical import digest_json
from order_execution.records import CandidateIdentity


CANDIDATE = CandidateIdentity("candidate:0.2", "revision:ba23c16", "a" * 64)


def write_manifest(root: Path, *, selection_status: str = "APPROVED", gate_state: str = "CLEARED", candidate: CandidateIdentity = CANDIDATE) -> Path:
    files = {
        "purchase-order.json": b'{"currency":"USD","total":"125.00"}\n',
        "bom.csv": b"line,offer,qty\nL-1,O-1,2\n",
    }
    declarations = []
    for relative, payload in files.items():
        destination = root / relative
        destination.write_bytes(payload)
        declarations.append({
            "path": relative,
            "byte_length": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        })
    preimage: dict[str, Any] = {
        "schema_version": "strafe.sealed-sourcing-package/1",
        "package_id": "sourcing-package:fixture-001",
        "package_status": "SEALED",
        "candidate": candidate.as_dict(),
        "selections": [{
            "line_id": "L-1", "offer_id": "O-1", "selected": True,
            "offer_status": selection_status, "gate_state": gate_state,
        }],
        "files": declarations,
    }
    manifest = {**preimage, "seal": {"algorithm": "SHA-256", "manifest_sha256": digest_json(preimage)}}
    path = root / "sealed-sourcing-package.v1.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return path
