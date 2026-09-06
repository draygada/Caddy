"""Build the package: three artefacts stored by hash, only after every bound blob and fixture re-verifies."""
from __future__ import annotations

from datetime import date

from .hashing import sha256

DISCLAIMER_LINES = "Prepared from declared data for broker and counsel validation. Not an entry, not a filing."
DISCLAIMER_LOCKED = ("Draft prepared for review by a licensed customs broker. Not a customs entry, not a broker engagement or power "
                     "of attorney, not legal, customs or tax advice. The importer of record remains responsible under 19 CFR 141.1; "
                     "all codes and figures require independent verification before filing.")
FIRST_RUN_CHECKLIST = [
    "DDTC registration (DS-2032) if any defense article or technical data is manufactured or exported",
    "Empowered official designation (22 CFR 120.25, 120.67)",
    "Broker power of attorney (CBP Form 5291)",
    "Importer number (CBP Form 5106)",
    "Continuous customs bond (19 CFR 113)",
    "ACH authorization for duties and fees",
]
RETENTION_RULES = [
    {"regime": "EAR", "citation": "15 CFR 762.6", "years": 5, "anchor": "latest of export, reexport or transaction termination"},
    {"regime": "ITAR", "citation": "22 CFR 122.5 (anchor and period to be confirmed from the section)", "years": 5, "anchor": "licence or agreement expiry, or the transaction"},
    {"regime": "OFAC", "citation": "31 CFR 501.601", "years": 10, "anchor": "transaction date"},
    {"regime": "Customs", "citation": "19 CFR 163.4", "years": 5, "anchor": "date of entry"},
]
ORDER_PROGRAMS = ["Section 232", "Section 301", "Country action", "AD/CVD"]


class PackageRefused(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code


def _plus_years(d: str, years: int) -> str:
    y, m, dd = (int(x) for x in d[:10].split("-"))
    try:
        return date(y + years, m, dd).isoformat()
    except ValueError:
        return date(y + years, m, 28).isoformat()


def retention(anchor_date: str, *, any_itar: bool, any_import: bool) -> dict:
    windows = []
    for rule in RETENTION_RULES:
        applies = not ((rule["regime"] == "ITAR" and not any_itar) or (rule["regime"] == "Customs" and not any_import))
        windows.append({**rule, "applies": applies, "anchor_date": anchor_date, "until": _plus_years(anchor_date, rule["years"]) if applies else None})
    longest = max((w for w in windows if w["applies"]), key=lambda w: w["until"])
    return {"windows": windows, "retain_until": longest["until"], "longest_regime": longest["regime"],
            "words": f"retain until {longest['until']} ({longest['regime']}, {longest['citation']}; computed per transaction from {anchor_date})"}


def verify_bindings(rnd: dict, store, cost_fn) -> list[str]:
    """Re-read every bound blob by hash and every fixture manifest; return the mismatches (empty = clean)."""
    problems = []
    for name, sha in rnd["fixture_shas"].items():
        if store.manifest[name]["sha256"] != sha:
            problems.append(f"fixture {name}@{sha[:8]} is not the committed fixture ({store.manifest[name]['sha256'][:8]})")
    for line in rnd["lines"]:
        for card in line["offers"]:
            if sha256(card["offer"]) != card["offer_hash"]:
                problems.append(f"bound offer {card['offer_hash'][:8]} on {line['line_id']} failed re-verification")
            if store.offer(card["offer_hash"]) is None:
                problems.append(f"offer {card['offer_hash'][:8]} is not in the committed offers fixture")
            est = card.get("estimate")
            if est:
                again = cost_fn(card)
                if again["hash"] != est["hash"]:
                    problems.append(f"estimate {est['hash'][:8]} on {line['line_id']} did not recompute to the same hash")
    return problems


def pre_entry_lines(rnd: dict) -> dict:
    lines = []
    for line in rnd["lines"]:
        sel = line["selection"]
        card = next(c for c in line["offers"] if c["offer_hash"] == sel["offer_hash"])
        offer, est = card["offer"], card["estimate"]
        if rnd["destination_country"] != "US":
            lines.append({"line_id": line["line_id"], "mpn": line["mpn"], "quantity": line["quantity"],
                          "note": "; ".join(l["note"] for l in est["ladder"] if l["layer"] == "Import layers"), "import_modelled": False})
            continue
        if est.get("domestic"):
            lines.append({"line_id": line["line_id"], "mpn": line["mpn"], "quantity": line["quantity"], "note": "domestic purchase; no entry", "import_modelled": False})
            continue
        overlays = [{"program": l["layer"], "label": l.get("label"), "heading_9903": l.get("citation"), "rate": l["rate"], "amount": l["amount"]}
                    for p in ORDER_PROGRAMS for l in est["ladder"] if l["layer"] == p and l.get("amount")]
        flags = []
        if line.get("part_class") == "radio":
            flags.append("FCC: two states — 'authorized already' or 'barred from new authorization under the Covered List (DA 25-1086)'; check by model number (47 CFR 2); status: to be checked")
        if line.get("part_class") == "cell":
            flags.append("lithium: carriage documentation (UN3480 cells alone; UN 38.3 test summary; shipper's declaration by air), not an entry flag (49 CFR 173.185)")
        flags.append("9802.00.80: not applicable to a part import; the assembler's declaration (19 CFR 10.24) applies at the product level")
        lines.append({
            "line_id": line["line_id"], "description": line["description"], "mpn": line["mpn"], "quantity": line["quantity"],
            "unit_value_usd": offer.get("unit_price_usd"), "valuation_basis": est["valuation_basis"],
            "tariff_code": {"value": (offer.get("declared_hts") or {}).get("value"), "rationale": "declared by " + str((offer.get("declared_hts") or {}).get("declared_by")), "heading_level_only": True},
            "origin": {"value": est["origin"], "rationale": (offer.get("manufacturer") or {}).get("origin_basis")},
            "manufacturer": offer["manufacturer"]["name"], "seller": offer["seller"]["name"],
            "overlays_in_cbp_order": overlays,
            "adcvd": next(l["note"] for l in est["ladder"] if l["layer"] == "AD/CVD"),
            "estimate_hash": est["hash"], "tariff_fixture_sha": est["tariff_fixture_sha"],
            "partner_agency_flags": flags, "import_modelled": True, "disclaimer": DISCLAIMER_LINES,
        })
    return {"artefact": "pre_entry_lines", "round_id": rnd["round_id"], "design_hash": rnd["design_hash"], "entry_date": rnd.get("entry_date"),
            "lines": lines, "disclaimer": DISCLAIMER_LINES, "disclaimer_locked": DISCLAIMER_LOCKED}


def diligence_record(rnd: dict, adjudications: list[dict]) -> dict:
    offers = []
    for line in rnd["lines"]:
        for card in line["offers"]:
            offers.append({"line_id": line["line_id"], "offer_hash": card["offer_hash"], "seller": card["offer"]["seller"]["name"],
                           "manufacturer": card["offer"]["manufacturer"]["name"], "depth_tier": card["party_tree"]["depth_tier"],
                           "parties": [{"name": n["name"], "role": n["role"], "relation_to_child": n["relation_to_child"], "percent": n["percent"],
                                        "evidence_url": n["evidence_url"], "ownership": n["ownership"], "synthetic": n["synthetic"],
                                        "match_kind": n["run"]["match_kind"], "entries": n["run"]["entries"], "effective_status": n["effective_status"]}
                                       for n in card["party_tree"]["nodes"]],
                           "rollup": card["screening"]["status"], "list_snapshot_sha": card["screening"]["list_snapshot_sha"]})
    selections = [{"line_id": l["line_id"], **l["selection"]} for l in rnd["lines"] if l["selection"]]
    any_itar = any(l["evaluation"]["jurisdiction"] == "ITAR" for l in rnd["lines"])
    any_import = rnd["destination_country"] == "US" and any(c["estimate"] and not c["estimate"].get("domestic") for l in rnd["lines"] for c in l["offers"] if l["selection"] and c["offer_hash"] == l["selection"]["offer_hash"])
    return {"artefact": "diligence_record", "round_id": rnd["round_id"], "design_hash": rnd["design_hash"],
            "order": "mirrors the BIS export compliance elements for screening and CBP's forced-labor tracing appendices for supply-chain records",
            "parties_and_screenings": offers, "adjudications": adjudications, "selections_with_declined": selections,
            "technical_data_declarations": rnd["declarations"], "export_gates": [{"line_id": l["line_id"], **l["gate"]} for l in rnd["lines"] if l["gate"]],
            "escalations": [e for l in rnd["lines"] for e in l["escalations"]],
            "retention": retention(rnd.get("entry_date") or rnd["opened_at"][:10], any_itar=any_itar, any_import=any_import),
            "claim_ceiling": "The diligence record supports, never discharges, the importer's own reasonable care (19 CFR 141.1)."}


def export_references(rnd: dict) -> dict:
    refs = []
    for line in rnd["lines"]:
        ev = line["evaluation"]
        ref = {"line_id": line["line_id"], "mpn": line["mpn"], "jurisdiction": ev["jurisdiction"], "entries": ev["entries"], "fired": ev.get("fired", [])}
        if rnd["destination_country"] != "US":
            sel = line["selection"]
            card = next(c for c in line["offers"] if c["offer_hash"] == sel["offer_hash"])
            price = card["offer"].get("unit_price_usd")
            value = float(price) * line["quantity"] if price else None
            licensed = (line["gate"] or {}).get("state", "").startswith(("LIC", "DDTC"))
            eei = licensed or ev["jurisdiction"] == "ITAR" or (value is not None and value > 2500)
            why = "licensed or ITAR line: always files" if (licensed or ev["jurisdiction"] == "ITAR") else ("value over $2,500 per Schedule B line" if eei else "under $2,500 and no licence: NOEEI 30.37(a)")
            ref.update({"eei_required": eei, "eei_why": why, "gate": line["gate"]["state"] if line["gate"] else None,
                        "destination_control_statement": "fixed text per 15 CFR 758.6 / 22 CFR 123.9(b)(1); generated on the invoice, non-editable (roadmap)"})
        refs.append(ref)
    return {"artefact": "export_references", "round_id": rnd["round_id"], "design_hash": rnd["design_hash"], "design_seq": rnd["design_seq"],
            "design_decision_record_hash": None, "classification_memo_hash": None, "memo_note": "classification memo not requested", "lines": refs}


def warnings(rnd: dict) -> list[str]:
    if rnd["destination_country"] == "US":
        eei = "EEI required: no — this is the import leg; EEI applies to an export shipment"
    else:
        eei = "EEI required: see export references per line (over $2,500 per Schedule B line, or any licensed or ITAR line)"
    return ["No de minimis since 29 August 2025 (EO 14324; CBP IFR 2026-06-24)",
            "lithium: hazmat carriage documentation (UN3480 / UN3481), not a customs filing", eei]
