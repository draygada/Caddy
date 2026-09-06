"""The export gate and the technical-data declaration. The gate is the engine's destination cell verbatim; it adds no rule."""
from __future__ import annotations

PASS_WITH_EXCEPTION = ("STA", "GBS", "LVS", "ENC")
BLOCKING = ("LIC", "DDTC", "DENIAL")
SENTENCE_734_13 = ("15 CFR 734.13: transferring 'technology' to a foreign person is an export; releasing it to a foreign "
                   "person in the United States is a deemed export (734.13(a)(2), (b))")
CLAIM_CEILING = ("Destination state as computed by the rule engine for the part as designed; licence-exception eligibility "
                 "beyond the quoted paths not modelled. An authorization reference is a typed string, never validated.")
UNCURABLE = ("unknown_person_status", "unknown_classification")   # a typed reference does not answer these; the declaration stays blocked


class GateRefused(ValueError):
    pass


def evaluate_gate(line: dict, destination_country: str, reference: dict | None) -> dict:
    cell = line["evaluation"]["destinations"].get(destination_country)
    if cell is None:
        return {"state": None, "because": [], "passes": False, "reference": None,
                "words": [f"no destination cell for {destination_country}: cannot gate — engine did not print this destination"], "claim_ceiling": CLAIM_CEILING}
    state = cell["state"]
    because = list(cell.get("because") or [])
    head = state.split()[0].rstrip(",")
    result = {"state": state, "because": because, "reference": None, "claim_ceiling": CLAIM_CEILING}
    if head == "NLR":
        result.update(passes=True, words=[f"export gate: {state} ({'; '.join(because)}); passes"])
    elif head in PASS_WITH_EXCEPTION:
        result.update(passes=True, words=[f"export gate: {state} ({'; '.join(because)}); passes with the exception named on the pre-entry line"])
    elif head == "DENIAL":
        result.update(passes=False, words=[f"export gate: {state} ({'; '.join(because)}); package blocked; no reference field"])
    elif head in ("LIC", "DDTC"):
        if reference and reference.get("reference") and reference.get("attestor"):
            result["reference"] = {"reference": reference["reference"], "attestor": reference["attestor"], "validated": False}
            result.update(passes=True, words=[f"export gate: {state} ({'; '.join(because)}); authorization reference "
                                              f"'{reference['reference']}' typed by {reference['attestor']} — reference typed, not validated"])
        else:
            what = "a licence reference" if head == "LIC" else "a DDTC authorization reference"
            result.update(passes=False, words=[f"export gate: {state} ({'; '.join(because)}); package blocked until {what} is entered"])
    else:
        result.update(passes=False, words=[f"export gate: {state}: state not understood by the gate; blocked"])
    return result


def required_reference(lines: list[dict], person_status: str, sharing: str) -> tuple[str, list[str]]:
    """The three-line rule over the lines whose technical data will be shared."""
    if sharing in ("none", "uncontrolled_only") or person_status == "us_person":
        return "none", ["no reference required: " + ("nothing controlled will be shared" if sharing != "controlled_drawings" else "US person")]
    if person_status == "unknown":
        return "unknown_person_status", ["person status unknown: declaration cannot pass until it is declared"]
    unknown = [l["line_id"] for l in lines if l["evaluation"].get("jurisdiction") not in ("ITAR", "EAR") or not l["evaluation"].get("entries")
               or l["evaluation"].get("unresolved")]
    if unknown:
        words = [f"classification not established for {', '.join(unknown)}: the engine has not concluded; declaration cannot pass"]
        words += [f"{l['line_id']}: rule {u.get('rule_id')} on {u.get('entry')} could not be evaluated"
                  + (f" — {u['problem']}" if u.get("problem") else "") + (f"; missing {', '.join(u['missing'])}" if u.get("missing") else "")
                  for l in lines for u in l["evaluation"].get("unresolved") or []]
        return "unknown_classification", words
    if any(l["evaluation"]["jurisdiction"] == "ITAR" for l in lines):
        return "ddtc_authorization", ["ITAR technical data + foreign person + controlled drawings: DDTC authorization reference required (22 CFR 120.50, 123, 124)"]
    if any(l["evaluation"]["jurisdiction"] == "EAR" and l["evaluation"]["entries"] != ["EAR99"] for l in lines):
        return "ear_licence_or_exception", ["EAR technology + foreign person: licence or exception reference required", SENTENCE_734_13]
    return "none", ["EAR99 only: no reference required"]


def build_declaration(lines: list[dict], *, party: str, person_status: str, sharing: str, reference: str | None, attestor: str, seq: int) -> dict:
    if person_status not in ("us_person", "foreign_person", "unknown"):
        raise GateRefused(f"unknown person_status {person_status!r}")
    if sharing not in ("none", "controlled_drawings", "uncontrolled_only"):
        raise GateRefused(f"unknown sharing {sharing!r}")
    if not attestor:
        raise GateRefused("a declaration needs a human attestor")
    kind, words = required_reference(lines, person_status, sharing)
    blocked = kind in UNCURABLE or (kind != "none" and not reference)
    if reference and kind != "none":
        words.append(f"reference '{reference}' typed by {attestor} — reference typed, not validated")
    if blocked:
        words.append("package blocked: a reference cannot cure this" if kind in UNCURABLE else "package blocked until the reference is entered")
    words.append("not a deemed-export determination: the declaration prints the 734.13 sentence and records what the user declared")
    return {"party": party, "person_status": person_status, "sharing": sharing, "required_reference_kind": kind,
            "reference": reference, "validated": False, "attestor": attestor, "blocked": blocked, "words": words, "seq": seq}
