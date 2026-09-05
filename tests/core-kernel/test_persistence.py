from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from strafe_forge_core.diagnostics import KernelError
from strafe_forge_core.persistence import RecomputeCheckpoint

from kernel_cases import bracket_program, engine


def test_failed_attempt_restores_separate_revision_bound_last_valid_in_fresh_process() -> None:
    valid_program = bracket_program(include_dependent=True, revision_id="rev:valid")
    valid = engine().recompute(valid_program)
    assert valid.current_artifact is not None
    failed_program = bracket_program(
        fillet_radius="100",
        include_dependent=True,
        revision_id="rev:failed",
    )
    failed = engine().recompute(failed_program, last_valid=valid.current_artifact)
    checkpoint = RecomputeCheckpoint.capture(
        failed_program,
        failed,
        prior_last_valid=valid.current_artifact,
    )
    probe = Path(__file__).with_name("checkpoint_probe.py")
    observed = json.loads(
        subprocess.check_output(
            [sys.executable, str(probe)],
            input=checkpoint.as_bytes(),
        )
    )
    assert observed == {
        "attempted_revision": "rev:failed",
        "checkpoint_hash": checkpoint.checkpoint_hash,
        "last_valid_artifact_id": valid.current_artifact.artifact_id,
        "last_valid_revision": "rev:valid",
        "program_revision": "rev:failed",
        "status": "FAILED",
    }


def test_success_checkpoint_round_trips_canonically() -> None:
    program = bracket_program(revision_id="rev:success")
    result = engine().recompute(program)
    checkpoint = RecomputeCheckpoint.capture(program, result)
    encoded = checkpoint.as_bytes()
    restored = RecomputeCheckpoint.from_bytes(encoded)
    assert restored.program == program
    assert restored.checkpoint_hash == checkpoint.checkpoint_hash
    assert restored.last_valid_artifact is not None
    assert restored.last_valid_artifact.source_revision_id == "rev:success"


def test_checkpoint_rejects_noncanonical_or_hash_tampered_bytes() -> None:
    program = bracket_program(revision_id="rev:success")
    result = engine().recompute(program)
    encoded = RecomputeCheckpoint.capture(program, result).as_bytes()
    with pytest.raises(KernelError) as caught:
        RecomputeCheckpoint.from_bytes(b" " + encoded)
    assert caught.value.code == "SCHEMA_UNSUPPORTED"

    decoded = json.loads(encoded)
    decoded["payload"]["program"]["source_revision_id"] = "rev:tampered"
    tampered = json.dumps(decoded, sort_keys=True, separators=(",", ":")).encode()
    with pytest.raises(KernelError) as caught:
        RecomputeCheckpoint.from_bytes(tampered)
    assert caught.value.code == "CHECKPOINT_HASH_MISMATCH"
