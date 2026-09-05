"""Vercel file-based Python entrypoint for CADdyDaddy Candidate 0.1."""

from pathlib import Path
import sys


_BUNDLE_ROOT = Path(__file__).resolve().parents[1]
for _source in (
    _BUNDLE_ROOT / "apps" / "product-service",
    _BUNDLE_ROOT / "packages" / "compliance-bridge",
):
    _relative_runtime_path = str(_source)
    if _relative_runtime_path not in sys.path:
        sys.path.insert(0, _relative_runtime_path)

from product_service.app import create_handler


handler = create_handler(static_root=_BUNDLE_ROOT / "public")
