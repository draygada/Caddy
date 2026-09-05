from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def test_three_clean_process_replays_are_semantically_identical() -> None:
    probe = Path(__file__).with_name("replay_probe.py")
    observations = []
    for seed in ("1", "7", "31337"):
        environment = dict(os.environ)
        environment["PYTHONHASHSEED"] = seed
        output = subprocess.check_output(
            [sys.executable, str(probe)],
            text=True,
            env=environment,
        )
        observations.append(json.loads(output))
    assert observations[0] == observations[1] == observations[2]

