"""Nothing on a round with proposals says cleared, compliant, inherited, finds compliant, or entry-as-a-status."""
from __future__ import annotations

import re

from conftest import DATA, make_ports, run_s1
from test_claims_vocabulary import ENTRY_ALLOWED, NEVER, strings

SEARCH_NEVER = NEVER + [r"\binherit(s|ed|ance)?\b", r"\bfinds compliant\b", r"\bcompliant (part|alternative|supplier)s?\b", r"\bnobody does ai part search\b"]


def _doc(name):
    from forge_search.documents import document_text, text_sha256
    text = document_text((DATA / "search" / "fixtures" / name).read_bytes(), name)
    return text, text_sha256(text)


def test_never_say_list_over_proposals(service, f3_state, baseline):
    from forge_search.model import ScriptedModel
    from forge_search.propose import propose_alternative, propose_escalation
    text, sha = _doc("lepton35_test_sheet.txt")

    def claim(field, value, unit, quote):
        s = text.index(quote)
        return {"field": field, "value": value, "unit": unit, "quote": quote, "start": s, "end": s + len(quote), "doc_sha256": sha}
    model = ScriptedModel({"search": [{"candidates": [{"mpn": "500-0771-01", "url": "fixture://lepton35_test_sheet.txt"}]}],
                           "extract": [{"specs": [claim("frame_rate_hz", "8.7", "Hz", "Frame rate: 8.7 Hz effective."), claim("resolution_w", "160", "elements", "160 x 120 pixels"),
                                                  claim("resolution_h", "120", "elements", "120 pixels")]}],
                           "escalation": [{"candidates": [{"mpn": "STM32F100C8T6B", "url": "https://www.st.com/resource/en/datasheet/stm32f100c8.pdf"}]}]})
    ports = make_ports(model)
    r = service.open_round(f3_state, ship_to="US-bench", quantity=1, transport_mode="air", request_key="f3", opened_at="2026-09-06T02:00:00Z")
    rid = r["round_id"]
    service.resolve(rid); service.screen(rid); service.cost(rid, entry_date="2026-09-06")
    propose_alternative(service, rid, "line:thermal_core", ports, proposed_at="2026-09-06T02:30:00Z")
    rid2 = run_s1(service, baseline, request_key="esc")
    propose_escalation(service, rid2, "line:io_mcu", "origin_depends_on_lot", ports, proposed_at="2026-09-06T02:31:00Z")
    seen = strings(service.round_view(rid), []) + strings(service.round_view(rid2), []) + strings(service.thread.events, []) + [service.rederive()["line"]]
    offenders = [(pat, s) for s in seen for pat in SEARCH_NEVER if re.search(pat, s, re.I)]
    assert not offenders, offenders[:5]
    entry_offenders = []
    for s in seen:
        low = s.lower()
        for m in re.finditer(r"\bentry\b", low):
            window = low[max(0, m.start() - 24): m.end() + 12]
            if not any(a in window for a in ENTRY_ALLOWED):
                entry_offenders.append(s)
    assert not entry_offenders, entry_offenders[:5]
