"""F1-F8, THE_BUILD.md §5. The names are frozen here at the 10:00 schema freeze; the
assertions land as the engine does. Each is skipped, not passing, so a green run never
overstates what is built."""
import pytest

FLIPS = {
    "F1": "pack 1,000 -> 1,300 Wh (row 1)",
    "F2": "span 3.0 -> 3.4 m (row 2, requires F1)",
    "F3": "Lepton -> Boson+ 640 (rows 3, 4)",
    "F4": "ICM-42688-P -> HG5700 (row 5)",
    "F5": "pod used-on -> F-22 (row 13)",
    "F6": "add F-16 as second host (row 13, 9A610.x; live run only)",
    "F7": "GX-220 drag (row 5 via the extractor)",
    "F8": "three no-change edits (0402, JST, H743 -> H753) assert zero changed determinations",
}

@pytest.mark.parametrize("fid,desc", sorted(FLIPS.items()))
def test_flips(fid, desc):
    pytest.skip(f"{fid} not implemented yet — {desc}")
