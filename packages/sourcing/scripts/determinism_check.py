"""Print sha256(extracted text) for every cached document and every fixture document.

Run on two machines with the same pinned pypdf; diff the two outputs. A mismatch is a release blocker for the
extractor pin (S3 §(e)), not a warning.
"""
from __future__ import annotations

import platform
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_search.documents import EXTRACTOR, document_text, text_sha256  # noqa: E402

if __name__ == "__main__":
    print(f"extractor {EXTRACTOR['name']} {EXTRACTOR['version']} · python {platform.python_version()} · {platform.platform()}")
    files = sorted((PKG / "data" / "search" / "fixtures").iterdir()) + sorted((PKG / ".cache" / "fetch").glob("*.bin"))
    for f in files:
        raw = f.read_bytes()
        try:
            text = document_text(raw, f.name)
            print(f"{text_sha256(text)}  {f.name}  chars={len(text)}")
        except Exception as error:  # noqa: BLE001 - a failed extraction is a finding, printed, never hidden
            print(f"ERROR {type(error).__name__}  {f.name}")
