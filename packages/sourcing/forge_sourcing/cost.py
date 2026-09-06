"""The landed-cost ladder. A pure function: same inputs, same hash.

One row per layer with citation, rate, amount and note; never one folded duty number.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from .hashing import sha256

CENT = Decimal("0.01")
CLAIM_CEILING = "Estimate from declared tariff code and origin against a dated tariff table. Not a customs determination."
ASSUMPTIONS = [
    "origin as declared by seller",
    "value is the seller's unit price × quantity, not a customs value",
    "heading level only; the ten-digit line is a licensed broker's",
]


def pct(rate: str | None) -> str:
    if rate is None:
        return "—"
    d = Decimal(rate)
    if d == 0:
        return "Free"
    return f"{(d * 100).normalize():f} %"


def money(d: Decimal) -> str:
    return str(d.quantize(CENT, rounding=ROUND_HALF_UP))


def _heading6(code: str | None) -> str | None:
    if not code or code == "aggregate":
        return code
    return code[:7] if len(code) >= 7 and code[4] == "." else code


def _fee_row(tariff: dict, entry_date: str) -> dict | None:
    for row in tariff["fees"]:
        if row["effective_from"] <= entry_date <= row["effective_to"]:
            return row
    return None


def _in_window(row: dict, entry_date: str) -> bool:
    return row["effective_from"] <= entry_date and (row.get("effective_to") is None or entry_date <= row["effective_to"])


def estimate(offer: dict, offer_hash: str, quantity: int, tariff: dict, tariff_sha: str, *,
             entry_date: str, transport_mode: str, destination_country: str, destination_notes: list[str] | None = None) -> dict:
    unit = offer.get("unit_price_usd")
    heading = _heading6((offer.get("declared_hts") or {}).get("value"))
    origin = (offer.get("manufacturer") or {}).get("country_of_origin")
    seller_country = (offer.get("seller") or {}).get("country")
    result = {
        "offer_hash": offer_hash, "quantity": quantity, "heading": heading, "origin": origin,
        "entry_date": entry_date, "transport_mode": transport_mode, "destination_country": destination_country,
        "hts_revision": tariff.get("hts_revision"), "tariff_fixture_sha": tariff_sha,
        "valuation_basis": "seller's unit price × quantity; not a customs value",
        "assumptions": list(ASSUMPTIONS), "claim_ceiling": CLAIM_CEILING,
        "disclaimer": tariff.get("disclaimer_h350722"), "de_minimis": tariff["de_minimis"]["text"],
        "ladder": [], "verified": True, "domestic": False, "note": None,
    }
    ladder = result["ladder"]
    if destination_country != "US" and seller_country != destination_country:
        result["import_modelled"] = False
        notes = destination_notes or [f"{destination_country} customs: not modelled"]
        result["note"] = "; ".join(notes)
        for n in notes:
            ladder.append({"layer": "Import layers", "citation": None, "rate": None, "amount": None, "note": n})
        if unit is None:
            result.update({"entered_value": None, "verified": False, "note": result["note"] + "; price not declared (quote only); no estimate; sorts last",
                           "total_duties_and_fees_usd": None, "landed_total_usd": None, "per_unit_landed_usd": None})
            return _finish(result)
        value = Decimal(unit) * quantity
        result["entered_value"] = money(value)
        return _totals(result, value, Decimal("0"), quantity)
    if unit is None:
        result.update({"entered_value": None, "verified": False, "note": "price not declared (quote only); no estimate; sorts last",
                       "total_duties_and_fees_usd": None, "landed_total_usd": None, "per_unit_landed_usd": None})
        return _finish(result)
    value = Decimal(unit) * quantity
    result["entered_value"] = money(value)

    if seller_country == destination_country:
        result["domestic"] = True
        result["note"] = "no entry"
        for layer in ("Base rate", "Section 232", "Section 301", "Country action", "AD/CVD",
                      "Merchandise processing fee", "Harbor maintenance fee", "Section 122"):
            ladder.append({"layer": layer, "citation": None, "rate": None, "amount": None, "note": "not applicable"})
        if (offer.get("manufacturer") or {}).get("origin_basis", "").find("USMCA") >= 0:
            result["usmca"] = "USMCA origin: claim available, not asserted (supplier certification required)"
        return _totals(result, value, Decimal("0"), quantity)

    duties = Decimal("0")
    # Base rate
    base = next((r for r in tariff["base_rows"] if r["heading"] == heading), None)
    if base is None:
        ladder.append({"layer": "Base rate", "citation": f"HTS {heading}; {tariff.get('hts_revision')}", "rate": "not verified",
                       "amount": None, "note": "rate not verified; no base row typed for this heading; sorts last"})
        result["verified"] = False
    else:
        amt = (value * Decimal(base["general_rate"])).quantize(CENT, rounding=ROUND_HALF_UP)
        duties += amt
        note = base.get("note") or ""
        if not base.get("verified"):
            note = "rate not verified · " + note
            result["verified"] = False
        ladder.append({"layer": "Base rate", "citation": f"HTS {heading}; {tariff.get('hts_revision')}", "rate": pct(base["general_rate"]),
                       "amount": money(amt), "note": note})
    # Overlays in CBP's reporting order
    ladder.append({"layer": "Section 232", "citation": "91 FR 53699; metals proclamations", "rate": None, "amount": None,
                   "note": "not in scope: " + tariff["scope_notes"]["Section 232"]})
    matched_301 = False
    for ov in tariff["overlays"]:
        if ov["program"] != "Section 301":
            continue
        if origin in ov["origins"] and (heading in ov["headings"] or "*" in ov["headings"]) and heading not in ov.get("exempt_headings", []) and _in_window(ov, entry_date):
            amt = (value * Decimal(ov["rate"])).quantize(CENT, rounding=ROUND_HALF_UP)
            duties += amt
            matched_301 = True
            note = ov.get("note") or ""
            if not ov.get("verified"):
                note = "rate not verified · " + note
            ladder.append({"layer": "Section 301", "label": ov["label"], "citation": ov["citation"], "rate": pct(ov["rate"]),
                           "amount": money(amt), "note": note, "heading_9903": ov["citation"], "effective_from": ov["effective_from"]})
    if not matched_301:
        ladder.append({"layer": "Section 301", "citation": None, "rate": None, "amount": None,
                       "note": f"not applicable: no China list reaches heading {heading} at origin {origin}"})
    matched_ca = False
    for ov in tariff["overlays"]:
        if ov["program"] != "Country action":
            continue
        if origin in ov["origins"] and ("*" in ov["headings"] or heading in ov["headings"]) and heading not in ov.get("exempt_headings", []) and _in_window(ov, entry_date):
            amt = (value * Decimal(ov["rate"])).quantize(CENT, rounding=ROUND_HALF_UP)
            duties += amt
            matched_ca = True
            ladder.append({"layer": "Country action", "label": ov["label"], "citation": ov["citation"], "rate": pct(ov["rate"]),
                           "amount": money(amt), "note": (ov.get("note") or "") + f" · effective {ov['effective_from']}",
                           "effective_from": ov["effective_from"]})
    if not matched_ca:
        ladder.append({"layer": "Country action", "citation": None, "rate": None, "amount": None, "note": f"not listed: origin {origin}"})
    ladder.append({"layer": "AD/CVD", "citation": "19 CFR 351", "rate": None, "amount": None, "note": tariff["scope_notes"]["AD/CVD"]})
    # Fees
    fees = Decimal("0")
    fee_row = _fee_row(tariff, entry_date)
    if fee_row is None:
        ladder.append({"layer": "Merchandise processing fee", "citation": "19 CFR 24.23", "rate": None, "amount": None, "note": "no fee row for this entry date"})
        result["verified"] = False
    else:
        raw = value * Decimal(fee_row["mpf_rate"])
        mpf = raw
        note = "as computed"
        if raw < Decimal(fee_row["mpf_min"]):
            mpf, note = Decimal(fee_row["mpf_min"]), "minimum applied"
        elif raw > Decimal(fee_row["mpf_max"]):
            mpf, note = Decimal(fee_row["mpf_max"]), "maximum applied"
        mpf = mpf.quantize(CENT, rounding=ROUND_HALF_UP)
        fees += mpf
        result["fiscal_year"] = fee_row["fiscal_year"]
        ladder.append({"layer": "Merchandise processing fee", "citation": f"{fee_row['citation']} ({fee_row['fiscal_year']})",
                       "rate": pct(fee_row["mpf_rate"]), "amount": money(mpf), "note": note})
        if transport_mode == "ocean":
            hmf = (value * Decimal(fee_row["hmf_rate"])).quantize(CENT, rounding=ROUND_HALF_UP)
            fees += hmf
            ladder.append({"layer": "Harbor maintenance fee", "citation": "19 CFR 24.24", "rate": pct(fee_row["hmf_rate"]), "amount": money(hmf), "note": "ocean"})
        else:
            ladder.append({"layer": "Harbor maintenance fee", "citation": "19 CFR 24.24", "rate": None, "amount": None, "note": f"not applicable, {transport_mode}"})
    ladder.append({"layer": "Section 122", "citation": "19 U.S.C. 2132", "rate": None, "amount": None, "note": tariff["scope_notes"]["Section 122"]})
    return _totals(result, value, duties + fees, quantity)


def _totals(result: dict, value: Decimal, extra: Decimal, quantity: int) -> dict:
    landed = value + extra
    result["total_duties_and_fees_usd"] = money(extra)
    result["landed_total_usd"] = money(landed)
    result["per_unit_landed_usd"] = money(landed / quantity)
    result["ladder"].append({"layer": "Total", "citation": None, "rate": None, "amount": money(landed),
                             "note": f"entered value {money(value)} + duties and fees {money(extra)}"})
    return _finish(result)


def _finish(result: dict) -> dict:
    result["hash"] = sha256({k: v for k, v in result.items() if k != "hash"})
    return result
