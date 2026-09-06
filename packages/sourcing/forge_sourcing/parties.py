"""Who you are really buying from: seller, manufacturer, and the risk-tiered ownership walk."""
from __future__ import annotations

from .screen import normalize

MAX_DEPTH = 6


def depth_tier(line: dict, product: dict) -> tuple[str, list[str]]:
    """seller_and_manufacturer for a domestic EAR99 commodity; full_walk otherwise, with the reasons printed."""
    ev = line["evaluation"]
    reasons = []
    if line.get("origin") != "US":
        reasons.append(f"foreign-origin part ({line.get('origin')})")
    if ev.get("entries") != ["EAR99"] or ev.get("jurisdiction") != "EAR":
        reasons.append(f"controlled ECCN {', '.join(ev.get('entries') or ['?'])} (not EAR99)")
    if line.get("item_kind") != "commodity":
        reasons.append(f"item kind {line.get('item_kind')}")
    if ev.get("flags"):
        reasons.append("red flag fired: " + ", ".join(ev["flags"]))
    if (product.get("declared") or {}).get("prime_flowdown"):
        reasons.append("prime flow-down declared on the product")
    if reasons:
        return "full_walk", reasons
    return "seller_and_manufacturer", ["domestic, EAR99, commodity; no red flag; no prime flow-down"]


def extract_parties(offer: dict) -> list[dict]:
    seller = offer["seller"]
    manu = offer["manufacturer"]
    parties = [{"name": seller["name"], "role": "seller", "country": seller.get("country"), "synthetic": bool(seller.get("synthetic"))}]
    if normalize(manu["name"]) != normalize(seller["name"]):
        parties.append({"name": manu["name"], "role": "manufacturer", "country": manu.get("country_of_origin"), "synthetic": bool(manu.get("synthetic", False))})
    return parties


def walk(parties: list[dict], store, tier: str) -> list[dict]:
    """Returns the party tree as a flat node list: each node names the child it was reached from."""
    nodes: list[dict] = []
    seen: set[str] = set()

    def add(name, role, country, synthetic, depth, child, relation, percent, evidence_url, note):
        key = normalize(name)
        node = {"party_id": f"party:{key}", "name": name, "role": role, "country": country, "synthetic": synthetic,
                "depth": depth, "child": child, "relation_to_child": relation, "percent": percent,
                "evidence_url": evidence_url, "note": note, "ownership": "known"}
        nodes.append(node)
        seen.add(key)
        return node

    frontier = []
    for p in parties:
        node = add(p["name"], p["role"], p["country"], p["synthetic"], 0, None, None, None, None, None)
        frontier.append(node)

    if tier != "full_walk":
        for n in nodes:
            n["ownership"] = "not walked (tier: seller and manufacturer only)"
        return nodes

    while frontier:
        node = frontier.pop(0)
        if node["depth"] >= MAX_DEPTH:
            node["ownership"] = "unknown"
            node["note"] = "walk cap reached"
            continue
        rows = store.ownership_rows(node["name"])
        if not rows:
            node["ownership"] = "unknown"
            continue
        for row in rows:
            if row["relation"] == "no_controlling_owner":
                node["ownership"] = "terminal"
                node["terminal_note"] = row.get("note")
                node["evidence_url"] = node["evidence_url"] or row.get("evidence_url")
                continue
            parent = row["parent"]
            if normalize(parent) in seen:
                continue
            child_node = add(parent, "owner", None, bool(row.get("synthetic")), node["depth"] + 1, node["name"],
                             row["relation"], row.get("percent"), row.get("evidence_url"), row.get("note"))
            frontier.append(child_node)
    return nodes
