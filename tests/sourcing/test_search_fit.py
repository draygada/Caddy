"""Fit: function, performance, form (incl. material), fit — each resolved, unresolved or failed; unknown is never a pass."""
from __future__ import annotations

import json

from conftest import DATA


def _slot(name):
    return json.loads((DATA / "search" / "pool.json").read_text(encoding="utf-8"))["slots"][name]


def test_lepton_resolves_every_dimension_of_the_thermal_comparator():
    from forge_search.fit import fit_check
    slot = _slot("thermal_core")
    lepton = next(c for c in slot["candidates"] if c["mpn"] == "500-0771-01")
    out = fit_check(slot["comparator"], lepton["declared"])
    assert out["resolved"] and not out["failed"] and all(d["state"] == "resolved" for d in out["dimensions"].values())


def test_imu_ng_fails_form_and_fit_and_sa102_fails_the_cell_format():
    from forge_search.fit import fit_check
    imu = _slot("imu")
    ng = next(c for c in imu["candidates"] if c["mpn"] == "IMU-NG")
    out = fit_check(imu["comparator"], ng["declared"])
    assert out["failed"] and out["dimensions"]["form"]["state"] == "fail" and out["dimensions"]["fit"]["state"] == "fail"
    assert out["dimensions"]["performance"]["state"] == "fail"            # 400 deg/s below the 1000 minimum
    cells = _slot("battery_cells")
    sa = next(c for c in cells["candidates"] if c["mpn"] == "SA102")
    assert fit_check(cells["comparator"], sa["declared"])["dimensions"]["form"]["state"] == "fail"


def test_missing_field_is_unresolved_and_substring_matching_is_case_insensitive():
    from forge_search.fit import fit_check
    comp = {"function": {"kind": "imu_6axis"}, "performance": {"gyro_rate_range_deg_s": {"min": "1000"}}, "form": {"interface": "SPI"}, "fit": {}}
    out = fit_check(comp, {"kind": "IMU_6AXIS", "interface": "spi/i2c"})
    assert out["dimensions"]["function"]["state"] == "resolved" and out["dimensions"]["form"]["state"] == "resolved"
    assert out["dimensions"]["performance"]["state"] == "unresolved" and not out["resolved"] and not out["failed"]
    assert out["dimensions"]["fit"]["state"] == "resolved"               # nothing to check resolves
