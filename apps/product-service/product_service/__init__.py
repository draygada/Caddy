"""Local CADdyDaddy Candidate 0.1 product service."""

from pathlib import Path
import sys

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
for _source in (
    REPOSITORY_ROOT / "packages" / "core-kernel" / "src",
    REPOSITORY_ROOT / "packages" / "compliance-bridge",
):
    if str(_source) not in sys.path:
        sys.path.insert(0, str(_source))

__version__ = "0.1.0"
