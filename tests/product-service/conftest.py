"""Portable import boundary for the product-service integration suite."""

from pathlib import Path
import sys


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

for source_root in (
    REPOSITORY_ROOT / "apps" / "product-service",
    REPOSITORY_ROOT / "packages" / "compliance-bridge",
    REPOSITORY_ROOT / "packages" / "core-kernel" / "src",
):
    source = str(source_root)
    if source not in sys.path:
        sys.path.insert(0, source)
