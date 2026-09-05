from __future__ import annotations

import json
import sys

from strafe_forge_core.persistence import RecomputeCheckpoint


restored = RecomputeCheckpoint.from_bytes(sys.stdin.buffer.read())
artifact = restored.last_valid_artifact
print(
    json.dumps(
        {
            "checkpoint_hash": restored.checkpoint_hash,
            "program_revision": restored.program.source_revision_id,
            "attempted_revision": restored.result_payload["attempted_revision_id"],
            "status": restored.result_payload["status"],
            "last_valid_revision": artifact.source_revision_id if artifact else None,
            "last_valid_artifact_id": artifact.artifact_id if artifact else None,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
)
