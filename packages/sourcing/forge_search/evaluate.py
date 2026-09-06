"""The evaluate step (S4 §(e), brief §2.4): fit → dry-run → walk and screen → cost, each on a copy.

Red: a fit dimension fails, the tripped row still fires or a new control row fires, or any party matches the list.
Grey: a check could not conclude (no accepted span, a field the rows read not published, a fit dimension unknown,
ownership unknown, abstained, price not declared, rate not verified). Green: every check concluded.
Ranking: screening status first, then per-unit landed cost; never price alone. The event kind is
"compared-and-confirmed", never "inherited" (F-10).
"""
from __future__ import annotations

from copy import deepcopy
from decimal import Decimal

from forge_sourcing import cost as costmod
from forge_sourcing import parties as partiesmod
from forge_sourcing import screen as screenmod
from forge_sourcing.hashing import sha256
from forge_sourcing.service import DESTINATION_NOTES

from .dryrun import dry_run, flip_gone
from .fit import fit_check
from .verify import Spec

CLAIM_CEILING = ("The agent proposes; a human resolves. Every candidate is re-checked by the rule rows on a copy of the design and by the "
                 "walk, the screen and the cost function on a copy of the round. Fetches are allowlisted. Nothing here is a selection, "
                 "a classification determination or a customs determination.")
HONESTY_NOTE = ("a byte match proves the document was read correctly, not that the datasheet is current, and not that the quoted "
                "sentence is a specification rather than an instruction")
STATUS_ORDER = {"green": 0, "grey": 1, "red": 2}


def _provisional_evaluation(line: dict, dr: dict) -> dict:
    fired = [f["entry"] for f in dr["fired"]]
    released = [r["entry"] for r in dr["released"]]
    jurisdiction = "ITAR" if any(f["jurisdiction"] == "ITAR" for f in dr["fired"]) else "EAR"
    entries = fired or released or ["EAR99 (provisional: no draft row fired)"]
    return {"jurisdiction": jurisdiction, "entries": entries, "fired": fired, "contains_defense_article": [], "flags": [f["entry"] for f in dr["flags"]],
            "destinations": deepcopy(line["evaluation"]["destinations"]), "provisional": "dry-run over rules.DRAFT.json; the engine replaces this"}


def evaluate_candidate(service, rnd: dict, line: dict, slot: dict, candidate: dict, *, specs: list[Spec], rules: dict, tripped: list[str]) -> dict:
    rnd_before, line_before = sha256({k: v for k, v in rnd.items() if k != "proposals"}), sha256(line)
    rnd_c, line_c = deepcopy(rnd), deepcopy(line)
    offer = deepcopy(candidate["offer"])
    offer_hash = sha256(offer)
    reasons: list[str] = []
    words: list[str] = [f"{candidate['mpn']} · {candidate['manufacturer']} · {'approved-manufacturer match' if candidate['aml'] else 'opportunistic find'}"
                        + (" · SYNTHETIC" if candidate["synthetic"] else "")]
    # 1. fit
    fit = fit_check(slot["comparator"], candidate["declared"])
    for dim, d in fit["dimensions"].items():
        words.append(f"fit · {dim}: {d['state']}" + (f" ({'; '.join(d['detail'])})" if d["detail"] else ""))
    if fit["failed"]:
        reasons.append("fit: " + "; ".join(f"{dim} fails" for dim, d in fit["dimensions"].items() if d["state"] == "fail"))
    elif not fit["resolved"]:
        reasons.append("fit unresolved: " + "; ".join(f"{dim}" for dim, d in fit["dimensions"].items() if d["state"] == "unresolved"))
    # 2. dry-run over the verified fields
    fields = {s.field: {"value": s.value, "unit": s.unit, "quote": s.quote, "doc_sha256": s.doc_sha256} for s in specs}
    declared = {k: v for k, v in candidate["declared"].items() if isinstance(v, bool)}
    declared["origin"] = offer["manufacturer"]["country_of_origin"]
    dr = dry_run(rules, part_class=slot["part_class"], role=slot["role"], fields=fields, declared=declared)
    flip = flip_gone(tripped, list(line["evaluation"]["entries"]), dr, rules)
    for s in specs:
        words.append(f"{s.field} {s.value} {s.unit} · quote '{s.quote}' · chars {s.start}–{s.end} · sha {s.doc_sha256[:8]} · ACCEPTED")
    if not specs:
        reasons.append("no accepted span: no document number was verified for this candidate")
    words.extend(flip["reasons"])
    for r in dr["released"]:
        words.append(f"release: {r['entry']} ({r['text']})")
    cannot_attrs = [c for c in dr["cannot_fire"] if any(not m.startswith("declared.") for m in c["missing"])]
    for c in cannot_attrs:
        if c["entry"] not in tripped:
            reasons.append(f"{c['entry']}: cannot fire — {', '.join(c['missing'])} not published")
    reasons.extend(r for r in flip["reasons"] if "cannot fire" in r or "no draft row" in r)
    if flip["still"] or flip["new"]:
        reasons.extend(r for r in flip["reasons"] if "still fires" in r or "new row fires" in r)
    # 3. walk and screen on the copy
    line_c["origin"] = offer["manufacturer"]["country_of_origin"]
    line_c["evaluation"] = _provisional_evaluation(line, dr)
    tier, tier_reasons = partiesmod.depth_tier(line_c, rnd_c["product"])
    csl = service.store.manifest["csl"]
    nodes = partiesmod.walk(partiesmod.extract_parties(offer), service.store, tier)
    for n in nodes:
        n["run"] = screenmod.screen(n["name"], service.store.csl_index, csl["sha256"], csl["retrieved_at"])
        n["adjudication"] = None
        n["effective_status"] = screenmod.node_status(n, n["run"], None)
    roll = screenmod.rollup(nodes)
    screening = {**roll, "depth_tier": tier, "tier_reasons": tier_reasons, "list_snapshot_sha": csl["sha256"], "retrieved_at": csl["retrieved_at"],
                 "nodes": [{"name": n["name"], "role": n["role"], "ownership": n["ownership"], "match_kind": n["run"]["match_kind"], "effective_status": n["effective_status"]} for n in nodes]}
    words.append(f"screening: {roll['status_word']} · depth {tier} · {len(nodes)} parties · snapshot {csl['sha256'][:8]} · not fuzzy")
    if roll["status"] == "review_blocked":
        reasons.append(f"screening: {roll['worst_node']} matched on the Consolidated Screening List")
    elif roll["status"] in ("review_required", "abstained"):
        reasons.append(f"screening: {roll['status_word']} ({roll['worst_node']})")
    # 4. cost on the copy
    est = costmod.estimate(offer, offer_hash, line_c["quantity"], service.store.tariff, rnd_c["fixture_shas"]["tariff"],
                           entry_date=rnd_c.get("entry_date") or rnd_c["opened_at"][:10], transport_mode=rnd_c["transport_mode"],
                           destination_country=rnd_c["destination_country"], destination_notes=DESTINATION_NOTES.get(rnd_c["destination_country"]))
    estimate = {"hash": est["hash"], "verified": est["verified"], "domestic": est["domestic"], "per_unit_landed_usd": est.get("per_unit_landed_usd"),
                "landed_total_usd": est.get("landed_total_usd"), "note": est.get("note"), "claim_ceiling": est["claim_ceiling"]}
    if est.get("per_unit_landed_usd") is None:
        reasons.append(f"cost: {est.get('note')}")
        words.append(f"estimate: {est.get('note')}")
    else:
        words.append(f"landed ${est['landed_total_usd']} · per unit ${est['per_unit_landed_usd']} · estimate · {est['claim_ceiling']}")
        if not est["verified"]:
            reasons.append("cost: rate not verified — greyed; sorts last")
    # 5. status
    if fit["failed"] or flip["still"] or flip["new"] or roll["status"] == "review_blocked":
        status = "red"
    elif not specs or not fit["resolved"] or cannot_attrs or flip["cannot"] or flip["unknown"] or roll["status"] != "no_candidate_match" \
            or est.get("per_unit_landed_usd") is None or not est["verified"]:
        status = "grey"
    else:
        status = "green"
    words.append(f"{status.upper()}: " + ("; ".join(reasons) if reasons else "every check concluded on a copy of the design and the round"))
    words.append("event kind: compared-and-confirmed (a fresh evaluation on a copy, not a carried-over classification)")
    words.append(HONESTY_NOTE)
    words.append(CLAIM_CEILING)
    if sha256({k: v for k, v in rnd.items() if k != "proposals"}) != rnd_before or sha256(line) != line_before:
        raise RuntimeError("evaluate_candidate mutated the round or the line; it must work on copies")
    return {"mpn": candidate["mpn"], "manufacturer": candidate["manufacturer"], "aml": candidate["aml"], "synthetic": candidate["synthetic"],
            "status": status, "reasons": reasons, "fit": fit,
            "dry_run": {k: dr[k] for k in ("rules_sha256", "fired", "released", "flags", "cannot_fire", "not_evaluated")},
            "flip": flip, "screening": screening, "estimate": estimate, "offer_hash": offer_hash, "specs": [s.as_dict() for s in specs],
            "words": words, "event_kind": "compared-and-confirmed"}


def rank(evaluations: list[dict]) -> dict:
    green = [e for e in evaluations if e["status"] == "green"]
    green.sort(key=lambda e: (screenmod.STATUS_SEVERITY[e["screening"]["status"]], Decimal(e["estimate"]["per_unit_landed_usd"])))
    return {"ranked": green, "needs_input": [e for e in evaluations if e["status"] == "grey"], "rejected": [e for e in evaluations if e["status"] == "red"]}
