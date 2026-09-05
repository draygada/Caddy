"""Make the lane package importable without installing it (stdlib only)."""
import sys
from pathlib import Path

LANE = Path(__file__).resolve().parents[2] / "packages" / "classification"
if str(LANE) not in sys.path:
    sys.path.insert(0, str(LANE))
