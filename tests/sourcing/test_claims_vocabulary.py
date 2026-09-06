"""Nothing an outsider sees says cleared, compliant, duty owed, certifies, determines, or entry-as-a-status."""
from __future__ import annotations

import re

from conftest import run_s1
from test_sourcing_flips import _select_all

NEVER = [r"\bcleared\b", r"\bcompliant\b", r"\bduty owed\b", r"\bcertif(y|ies|ied)\b", r"\bdetermines\b", r"\bready to ship\b",
         r"\bprocurement decision support\b", r"\blegal memo\b"]
ENTRY_ALLOWED = ("no entry", "not an entry", "pre-entry", "pre_entry", "not a customs entry", "entry date", "entry_date", "entry summary",
                 "actual or intended importation", "entry flag", "date of entry", "enter formally", "entered value", "entry_level", "entry clock", "entry_rule")


def strings(value, out):
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for k, v in value.items():
            strings(v, out)
    elif isinstance(value, (list, tuple)):
        for v in value:
            strings(v, out)
    return out


def offenders(seen: list[str], patterns: list[str]) -> list[tuple[str, str]]:
    return [(pat, s) for s in seen for pat in patterns if re.search(pat, s, re.I)]


def entry_offenders(seen: list[str]) -> list[str]:
    """Every string with a bare `entry` outside the allowed phrases (a 24/12-character window around the word)."""
    out = []
    for s in seen:
        low = s.lower()
        for m in re.finditer(r"\bentry\b", low):
            window = low[max(0, m.start() - 24): m.end() + 12]
            if not any(a in window for a in ENTRY_ALLOWED):
                out.append(s)
    return out


def test_never_say_list(service, baseline):
    rid = run_s1(service, baseline)
    _select_all(service, rid)
    service.resolve_escalation(rid, "line:io_mcu", "origin_depends_on_lot", attestor="charlie", resolution={"origin": "MY"})
    service.build_package(rid, built_at="2026-09-06T03:00:00Z")
    seen = strings(service.round_view(rid), []) + strings(service.thread.events, []) + [service.rederive()["line"]]
    assert not offenders(seen, NEVER), offenders(seen, NEVER)[:5]
    assert not entry_offenders(seen), entry_offenders(seen)[:5]
