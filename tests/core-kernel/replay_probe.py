from __future__ import annotations

import json

from kernel_cases import bracket_program, engine
from strafe_forge_core.viewport import tessellate_part


result = engine().recompute(bracket_program())
assert result.current_artifact is not None
part_mesh = tessellate_part(result)
print(
    json.dumps(
        {
            "geometry_hash": result.geometry_hash,
            "manifest_hash": result.engine_manifest_hash,
            "transitions": [item.as_dict() for item in result.transitions],
            "operation_hashes": [item.operation_hash for item in result.operation_results],
            "operation_statuses": [item.status for item in result.operation_results],
            "semantic_resolutions": [item.as_dict() for item in result.semantic_resolutions],
            "semantic_fingerprint": result.current_artifact.semantic_fingerprint,
            "viewport_packet_hash": part_mesh.packet_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
)
