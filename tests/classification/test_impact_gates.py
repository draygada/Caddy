"""Impact is a diff; gates are attributable state. (The memo is out of the lane's scope by Charlie's
instruction of 2026-09-05: this lane is the decision-making engine, not a memo generator.)"""
import copy

import pytest

from forge_classification.contracts import example_envelope
from forge_classification.gates import STAGES, GateState, stale_after, waive
from forge_classification.impact import impact
from forge_classification.pack import build_pack_from_xml, resolve
from fixtures import RAW, pack


def _env_with_real_citations():
    """The example envelope, with its citations re-pointed at real units."""
    env = example_envelope()
    for cand in env["candidates"]:
        for el in cand["elements"]:
            if el["citation"]:
                unit = resolve(pack(), el["unit_key"])
                quote = unit.text[:12]
                el["citation"] = {"unit_key": unit.unit_key, "unit_sha256": unit.sha256, "start": 0, "end": len(quote), "quote": quote}
    env["pack_sha256"] = pack().sha256
    return env


# --- impact ------------------------------------------------------------------------------------

def test_impact_lists_exactly_the_candidates_that_cited_a_changed_unit():
    usml = (RAW / "title-22-part-121.xml").read_text(encoding="utf-8")
    ccl = (RAW / "title-15-part-774.xml").read_text(encoding="utf-8")
    edited = ccl.replace("<P>a.2. A maximum 'endurance' of 1 hour or greater;</P>", "<P>a.2. A maximum 'endurance' of 3 hours or greater;</P>")
    other = build_pack_from_xml(usml, edited, manifest=pack().manifest,
                                itar_sd_xml=(RAW / "title-22-section-120.41.xml").read_text(encoding="utf-8"),
                                ear_definitions_xml=(RAW / "title-15-section-772.1.xml").read_text(encoding="utf-8"))
    env_a = _env_with_real_citations()
    env_b = _env_with_real_citations()
    env_b["item"]["part_revision_id"] = "rev:" + "8" * 64
    unit = resolve(pack(), "9A012.a.2")
    env_b["candidates"][2]["elements"][0]["citation"] = {"unit_key": "9A012.a.2", "unit_sha256": unit.sha256, "start": 0, "end": 9, "quote": unit.text[:9]}
    env_b["candidates"][2]["elements"][0]["unit_key"] = "9A012.a.2"
    report = impact(pack(), other, [env_a, env_b])
    assert report["changed_units"] == ["9A012.a.2"]
    assert [a["part_revision_id"] for a in report["affected"]] == ["rev:" + "8" * 64]
    assert report["affected"][0]["cited_unit"] == "9A012.a.2"
    assert report["proposals"][0]["action"] == "reanalyse" and report["proposals"][0]["cause"] == "lists_moved"


def test_impact_with_no_change_reports_nothing():
    report = impact(pack(), pack(), [_env_with_real_citations()])
    assert report["changed_units"] == [] and report["affected"] == [] and report["proposals"] == []


# --- gates -------------------------------------------------------------------------------------

def test_gates_have_eight_stages_and_a_waiver_is_never_a_pass():
    assert len(STAGES) == 8 and STAGES[0] == "intake" and STAGES[-1] == "decision"
    state = GateState("candidate_surfacing")
    assert state.status == "hold"
    waived = waive(state, actor_id="actor:charlie", reason="criteria not yet defined", at="2026-09-05T21:00:00Z")
    assert waived.status == "waived" and waived.actor_id == "actor:charlie"
    assert "pass" not in {s.status for s in (state, waived)}
    with pytest.raises(ValueError):
        GateState("candidate_surfacing", status="pass")


def test_stale_after_marks_every_downstream_stage():
    assert stale_after("introduction") == STAGES[STAGES.index("introduction") + 1:]
    assert stale_after("decision") == ()
