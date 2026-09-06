"""The harness measures; it never claims an accuracy percentage."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from conftest import DATA, make_ports

SCRIPTS = Path(__file__).resolve().parents[2] / "packages" / "sourcing" / "scripts"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _doc(name):
    from forge_search.documents import document_text, text_sha256
    text = document_text((DATA / "search" / "fixtures" / name).read_bytes(), name)
    return text, text_sha256(text)


def _claim(text, sha, field, value, unit, quote):
    s = text.index(quote)
    return {"field": field, "value": value, "unit": unit, "quote": quote, "start": s, "end": s + len(quote), "doc_sha256": sha}


def test_run_gold_reports_the_six_measurements_without_a_percentage(data_dir, kestrel):
    from forge_search.model import ScriptedModel
    from forge_sourcing.service import Service
    m = _load("eval_search")
    gold = json.loads((DATA / "search" / "gold_swaps.json").read_text(encoding="utf-8"))
    lep, lsha = _doc("lepton35_test_sheet.txt"); icm, isha = _doc("icm42688p_test_excerpt.txt"); ng, nsha = _doc("imu_ng_synthetic_sheet.txt")
    gx, gsha = _doc("gx220_vendor_page.html"); mol, msha = _doc("molicel_p45b_test_excerpt.txt")
    scripts = {
        "thermal_lepton_after_boson": {"search": [{"candidates": [{"mpn": "500-0771-01", "url": "fixture://lepton35_test_sheet.txt"}]}],
                                       "extract": [{"specs": [_claim(lep, lsha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."),
                                                              _claim(lep, lsha, "resolution_w", "160", "elements", "160 x 120 pixels"),
                                                              _claim(lep, lsha, "resolution_h", "120", "elements", "120 pixels")]}]},
        "imu_icm_after_hg5700": {"search": [{"candidates": [{"mpn": "ICM-42688-P", "url": "fixture://icm42688p_test_excerpt.txt"}]}],
                                 "extract": [{"specs": [_claim(icm, isha, "gyro_rate_range_deg_s", "2000", "deg/s", "full-scale range: 2000 dps")]}]},
        "imu_ng_synthetic": {"search": [{"candidates": [{"mpn": "IMU-NG", "url": "fixture://imu_ng_synthetic_sheet.txt"}]}],
                             "extract": [{"specs": [_claim(ng, nsha, "gyro_rate_range_deg_s", "400", "deg/s", "Gyro rate range: 400 deg/s"), _claim(ng, nsha, "gyro_arw_deg_sqrt_h", "0.0008", "deg/sqrt(h)", "Angle random walk: 0.0008 deg/sqrt(h)")]}]},
        "gx220_poisoned": {"search": [{"candidates": [{"mpn": "GX-220", "url": "fixture://gx220_vendor_page.html"}]}],
                           "extract": [{"specs": [_claim(gx, gsha, "gyro_rate_range_deg_s", "300", "deg/s", "Rate range: ±300 °/s"), _claim(gx, gsha, "gyro_bias_stability_1mo_deg_h", "0.3", "deg/h", "Bias stability: 0.3 °/h")]}]},
        "cell_p45b_after_sicore": {"search": [{"candidates": [{"mpn": "INR-21700-P45B", "url": "fixture://molicel_p45b_test_excerpt.txt"}]}],
                                   "extract": [{"specs": [_claim(mol, msha, "energy_density_wh_kg", "242", "Wh/kg", "Gravimetric 242 Wh/kg")]}]},
        "io_mcu_origin_escalation": {"escalation": [{"candidates": [{"mpn": "STM32F100C8T6B", "url": "https://www.st.com/resource/en/datasheet/stm32f100c8.pdf"}]}]},
    }
    out = m.run_gold(gold, lambda: Service(data_dir), lambda row: make_ports(ScriptedModel(scripts[row["id"]])), states=kestrel["states"])
    assert [r["pass"] for r in out["results"]] == [True] * 6 and out["errors"] == []
    meas = out["measurements"]
    assert meas["per_swap"]["thermal_lepton_after_boson"] == {"pass": True, "real": True, "expected": "green", "observed": "green"}
    assert meas["verifier_acceptance"]["accepted"] == 9 and meas["verifier_acceptance"]["rejected_by_reason"] == {}
    assert meas["false_green_structural"] == 0 and meas["cache_misses"] == 0
    assert meas["cost_per_green_microusd"] is None                              # scripted model records no usage
    assert "accuracy" not in json.dumps(meas).lower() and "%" not in json.dumps(meas)


def test_a_candidate_with_several_documents_is_observed_on_its_best_card(data_dir, kestrel):
    """One candidate, two documents, so two cards — the unreadable one first. The gold row is about the CANDIDATE,
    so the observation is the best card for that mpn, not whichever card the model happened to name first."""
    from forge_search.model import ScriptedModel
    from forge_sourcing.service import Service
    m = _load("eval_search")
    gold = [r for r in json.loads((DATA / "search" / "gold_swaps.json").read_text(encoding="utf-8")) if r["id"] == "thermal_lepton_after_boson"]
    lep, lsha = _doc("lepton35_test_sheet.txt")
    script = {"search": [{"candidates": [{"mpn": "500-0771-01", "url": "https://www1.futureelectronics.com/doc/FLIR%20SYSTEMS/Lepton%20Export%20fact%20sheet.pdf"},
                                         {"mpn": "500-0771-01", "url": "fixture://lepton35_test_sheet.txt"}]}],
              "extract": [{"specs": [_claim(lep, lsha, "frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."),
                                     _claim(lep, lsha, "resolution_w", "160", "elements", "160 x 120 pixels"),
                                     _claim(lep, lsha, "resolution_h", "120", "elements", "120 pixels")]}]}
    out = m.run_gold(gold, lambda: Service(data_dir), lambda row: make_ports(ScriptedModel(script)), states=kestrel["states"])
    r = out["results"][0]
    assert out["measurements"]["verifier_acceptance"]["accepted"] == 3      # only the fixture card read a document; a card with no accepted span is grey
    assert r["observed"] == "green" and r["pass"] is True and r["reason_hit"] is True and r["candidate"] == "500-0771-01"


def test_cache_misses_are_counted_and_abstains_bucketed(data_dir, kestrel, tmp_path):
    from forge_search.model import CacheModel
    from forge_sourcing.service import Service
    m = _load("eval_search")
    gold = json.loads((DATA / "search" / "gold_swaps.json").read_text(encoding="utf-8"))[:1]
    out = m.run_gold(gold, lambda: Service(data_dir), lambda row: make_ports(CacheModel(tmp_path / "empty")), states=kestrel["states"])
    assert out["results"][0]["pass"] is False and out["results"][0]["abstained"] == "cache miss"
    assert out["measurements"]["cache_misses"] == 1 and out["measurements"]["abstain_reasons"] == {"cache miss": 1}
