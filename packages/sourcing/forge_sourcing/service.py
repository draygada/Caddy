"""THE SEAM. Every caller — the browser, the tests, the demo driver — crosses this facade.

The browser renders what this returns and computes nothing.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from . import cost as costmod
from . import gate as gatemod
from . import order as ordermod
from . import package as pkgmod
from . import parties as partiesmod
from . import screen as screenmod
from . import select as selectmod
from .fixtures import FixtureStore
from .hashing import sha256
from .round import RoundRefused, STATUS_LABEL, new_round, transition
from .thread import Thread

OFFER_CLAIM_CEILING = ("Distributor-declared availability, price, classification and tariff code as of the fixture date. "
                       "Not a quote, not a classification determination.")
DESTINATION_NOTES = {
    "TW": ["Taiwan customs: not modelled", "Taiwan SHTC export permit (Foreign Trade Act Art. 13): not modelled"],
    "VN": ["import licence: Decree 288/2025 Art. 6"],
}
BLOCKING_ESCALATIONS = ("no_offer_match", "origin_depends_on_lot")


class Service:
    def __init__(self, data_dir: Path, *, csl_file: Path | str | None = None):
        self.store = FixtureStore(data_dir, csl_file=csl_file)
        self.thread = Thread()
        self.rounds: dict[str, dict] = {}
        self.adjudications: dict[str, dict] = {}   # key: f"{round_id}|{offer_hash}|{party_id}"
        self.packets: dict[str, dict] = {}
        self.dispatches: dict[str, dict] = {}       # idempotency key -> receipt
        self.current_design_hash: str | None = None

    # ------------------------------------------------------------ helpers
    def _round(self, round_id: str) -> dict:
        try:
            return self.rounds[round_id]
        except KeyError:
            raise RoundRefused(f"unknown round {round_id}") from None

    def _line(self, rnd: dict, line_id: str) -> dict:
        try:
            return next(l for l in rnd["lines"] if l["line_id"] == line_id)
        except StopIteration:
            raise RoundRefused(f"unknown line {line_id}") from None

    def _card(self, rnd: dict, offer_hash: str) -> tuple[dict, dict]:
        for line in rnd["lines"]:
            for card in line["offers"]:
                if card["offer_hash"] == offer_hash:
                    return line, card
        raise RoundRefused(f"unknown offer {offer_hash[:8]} in this round")

    def _bind(self, rnd: dict, **extra) -> dict:
        return {"round_id": rnd["round_id"], "design_hash": rnd["design_hash"], "design_seq": rnd["design_seq"],
                "fixture_shas": rnd["fixture_shas"], **extra}

    def _append(self, rnd: dict, kind: str, actor_kind: str = "system", attestor: str | None = None, **payload) -> dict:
        return self.thread.append(kind, actor_kind, self._bind(rnd, **payload), attestor=attestor)

    def _estimate(self, rnd: dict, line: dict, card: dict, *, entry_date: str | None = None, transport_mode: str | None = None) -> dict:
        return costmod.estimate(card["offer"], card["offer_hash"], line["quantity"], self.store.tariff, rnd["fixture_shas"]["tariff"],
                                entry_date=entry_date or rnd["entry_date"], transport_mode=transport_mode or rnd["transport_mode"],
                                destination_country=rnd["destination_country"], destination_notes=DESTINATION_NOTES.get(rnd["destination_country"]))

    # ------------------------------------------------------------ open / resolve / screen / cost
    def open_round(self, design: dict, *, ship_to: str, quantity: int, transport_mode: str, request_key: str,
                   opened_at: str, assembly_country: str | None = None, actor: str = "human") -> dict:
        rnd = new_round(design, ship_to=ship_to, quantity=quantity, transport_mode=transport_mode, request_key=request_key,
                        opened_at=opened_at, fixture_shas=self.store.shas(), assembly_country=assembly_country)
        existing = self.rounds.get(rnd["round_id"])
        if existing is not None:
            return existing                                    # idempotent on (design hash, ship-to, quantity, request key)
        self.current_design_hash = design["design_hash"]
        for other in self.rounds.values():                     # a newer design state for the same ship-to supersedes the live round
            if other["ship_to"] == ship_to and other["status"] != "superseded" and other["design_hash"] != rnd["design_hash"]:
                other["status"] = "superseded"
                other["superseded_by"] = rnd["round_id"]
                other["superseded_note"] = f"superseded by round {rnd['round_id'][6:14]} (design state changed at seq {rnd['design_seq']})"
                rnd["supersedes"] = other["round_id"]
        self.rounds[rnd["round_id"]] = rnd
        self._append(rnd, "round_opened", actor, ship_to=ship_to, destination_country=rnd["destination_country"], quantity=quantity,
                     transport_mode=transport_mode, assembly_country=rnd["assembly_country"], supersedes=rnd["supersedes"], opened_at=opened_at)
        return rnd

    def resolve(self, round_id: str) -> dict:
        rnd = self._round(round_id)
        transition(rnd, "offers_resolved")
        resolved, pending = 0, []
        for line in rnd["lines"]:
            line["offers"] = []
            for offer_hash, offer in self.store.offers_for(line["mpn"]):
                line["offers"].append({"offer_hash": offer_hash, "offer": deepcopy(offer), "fixture_sha": rnd["fixture_shas"]["offers"],
                                       "party_tree": None, "screening": None, "estimate": None})
            if line["offers"]:
                resolved += 1
            else:
                pending.append((line, "no_offer_match", f"0 offers in fixture offers@{rnd['fixture_shas']['offers'][:8]} for {line['mpn']}"))
            if any(o["offer"]["manufacturer"].get("origin_depends_on_lot") for o in line["offers"]):
                pending.append((line, "origin_depends_on_lot", line.get("origin_note") or "origin depends on lot"))
        self._append(rnd, "offers_resolved", lines=len(rnd["lines"]), resolved=resolved,
                     offer_hashes=[o["offer_hash"] for l in rnd["lines"] for o in l["offers"]])
        for line, reason, detail in pending:
            self._escalate(rnd, line, reason, detail)
        return rnd

    def _escalate(self, rnd: dict, line: dict, reason: str, detail: str) -> None:
        if any(e["reason"] == reason for e in line["escalations"]):
            return
        line["escalations"].append({"line_id": line["line_id"], "reason": reason, "detail": detail, "state": "open", "resolved_by": None, "resolution": None})
        self._append(rnd, "escalation_opened", line_id=line["line_id"], reason=reason, detail=detail)

    def resolve_escalation(self, round_id: str, line_id: str, reason: str, *, attestor: str, resolution: dict) -> dict:
        rnd = self._round(round_id)
        line = self._line(rnd, line_id)
        esc = next((e for e in line["escalations"] if e["reason"] == reason and e["state"] == "open"), None)
        if esc is None:
            raise RoundRefused(f"no open escalation {reason} on {line_id}")
        esc.update(state="resolved", resolved_by=attestor, resolution=resolution, tag="human-resolved")
        self._append(rnd, "escalation_resolved", "human", attestor, line_id=line_id, reason=reason, resolution=resolution)
        self._maybe_confirm(rnd)
        return esc

    def _screen_card(self, rnd: dict, line: dict, card: dict, tier: str, reasons: list[str], csl: dict, *, emit: bool = True) -> None:
        nodes = partiesmod.walk(partiesmod.extract_parties(card["offer"]), self.store, tier)
        for n in nodes:
            if emit:
                self._append(rnd, "party_extracted", line_id=line["line_id"], offer_hash=card["offer_hash"], depth_tier=tier, party=n["name"],
                             role=n["role"], child=n["child"], relation_to_child=n["relation_to_child"], percent=n["percent"],
                             ownership=n["ownership"], ownership_sha=rnd["fixture_shas"]["ownership"])
            run = screenmod.screen(n["name"], self.store.csl_index, csl["sha256"], csl["retrieved_at"])
            n["run"] = run
            n["adjudication"] = self.adjudications.get(f"{rnd['round_id']}|{card['offer_hash']}|{n['party_id']}")
            n["effective_status"] = screenmod.node_status(n, run, n["adjudication"])
            if emit:
                self._append(rnd, "screening_run", line_id=line["line_id"], offer_hash=card["offer_hash"], party=n["name"],
                             match_kind=run["match_kind"], entries=run["entries"], snapshot_sha=run["snapshot_sha"], run_hash=sha256(run))
        card["party_tree"] = {"depth_tier": tier, "tier_reasons": reasons, "nodes": nodes, "ownership_sha": rnd["fixture_shas"]["ownership"]}
        card["screening"] = {**screenmod.rollup(nodes), "list_snapshot_sha": csl["sha256"], "retrieved_at": csl["retrieved_at"],
                             "claim_ceiling": screenmod.CLAIM_CEILING, "fuzzy": False}

    def screen(self, round_id: str) -> dict:
        rnd = self._round(round_id)
        transition(rnd, "screened")
        csl = self.store.manifest["csl"]
        for line in rnd["lines"]:
            tier, reasons = partiesmod.depth_tier(line, rnd["product"])
            for card in line["offers"]:
                self._screen_card(rnd, line, card, tier, reasons, csl)
        self._append(rnd, "screening_rolled_up", snapshot_sha=csl["sha256"],
                     statuses={o["offer_hash"]: o["screening"]["status"] for l in rnd["lines"] for o in l["offers"]})
        return rnd

    def rescreen(self, round_id: str) -> dict:
        """Re-run every screening against the current snapshot; append new runs; report how many outcomes changed."""
        rnd = self._round(round_id)
        csl = self.store.manifest["csl"]
        before = {o["offer_hash"]: o["screening"]["status"] for l in rnd["lines"] for o in l["offers"]}
        runs = 0
        for line in rnd["lines"]:
            tier, reasons = partiesmod.depth_tier(line, rnd["product"])
            for card in line["offers"]:
                self._screen_card(rnd, line, card, tier, reasons, csl)
                runs += len(card["party_tree"]["nodes"])
        after = {o["offer_hash"]: o["screening"]["status"] for l in rnd["lines"] for o in l["offers"]}
        changed = sum(1 for k in after if before.get(k) != after[k])
        self._append(rnd, "screening_rolled_up", snapshot_sha=csl["sha256"], statuses=after, rescreen=True, runs=runs, changed=changed)
        report = {"runs": runs, "changed": changed, "snapshot_sha": csl["sha256"], "words": f"re-screened {runs} names against snapshot {csl['sha256'][:8]} · {changed} changed"}
        rnd["refinements"].append({"kind": "rescreen", **report})
        return report

    def cost(self, round_id: str, *, entry_date: str) -> dict:
        rnd = self._round(round_id)
        transition(rnd, "costed")
        rnd["entry_date"] = entry_date
        self._cost_all(rnd)
        return rnd

    def _cost_all(self, rnd: dict) -> int:
        n = 0
        for line in rnd["lines"]:
            for card in line["offers"]:
                est = self._estimate(rnd, line, card)
                card["estimate"] = est
                n += 1
                self._append(rnd, "cost_estimated", line_id=line["line_id"], offer_hash=card["offer_hash"], quantity=line["quantity"],
                             heading=est["heading"], origin=est["origin"], entry_date=rnd["entry_date"], transport_mode=rnd["transport_mode"],
                             destination_country=rnd["destination_country"], tariff_sha=rnd["fixture_shas"]["tariff"], result_hash=est["hash"])
        return n

    def refine(self, round_id: str, *, quantity: int | None = None, transport_mode: str | None = None, attestor: str = "engineer") -> dict:
        """A round default refined after open: estimates recompute for every line; statuses do not move."""
        rnd = self._round(round_id)
        changes = []
        if quantity is not None and quantity != rnd["quantity"]:
            changes.append({"field": "quantity", "from": rnd["quantity"], "to": quantity})
            rnd["quantity"] = quantity
            for line in rnd["lines"]:
                line["quantity"] = line["quantity_per"] * quantity
        if transport_mode is not None and transport_mode != rnd["transport_mode"]:
            if transport_mode not in ("air", "ocean", "truck"):
                raise RoundRefused(f"unknown transport mode {transport_mode}")
            changes.append({"field": "transport_mode", "from": rnd["transport_mode"], "to": transport_mode})
            rnd["transport_mode"] = transport_mode
        if not changes:
            return {"changes": [], "estimates_recomputed": 0, "status_changes": 0, "words": "no refinement"}
        statuses_before = {o["offer_hash"]: o["screening"]["status"] for l in rnd["lines"] for o in l["offers"]}
        self._append(rnd, "round_refined", "human", attestor, changes=changes, provenance="typed after open; earlier estimates are superseded, not deleted")
        n = self._cost_all(rnd)
        for line in rnd["lines"]:
            if line["selection"]:
                line["selection"]["stale"] = "estimate refined after selection; re-select to bind the new estimate"
        report = {"changes": changes, "estimates_recomputed": n, "status_changes": 0,
                  "words": f"re-evaluated {n} estimates · {sum(1 for k, v in statuses_before.items() if v != statuses_before[k])} status changes · "
                           + ", ".join(f"{c['field']} {c['from']} → {c['to']}" for c in changes)}
        rnd["refinements"].append({"kind": "refine", **report})
        return report

    # ------------------------------------------------------------ select / adjudicate
    def select(self, round_id: str, line_id: str, offer_hash: str, *, declined: list[dict], attestor: str | None) -> dict:
        rnd = self._round(round_id)
        line = self._line(rnd, line_id)
        if rnd["status"] == "superseded":
            raise selectmod.SelectionRefused(rnd["superseded_note"])
        sel = selectmod.build_selection(rnd, line, offer_hash, declined, attestor or "", self.thread.head["seq"] + 1)
        line["selection"] = sel
        self._append(rnd, "offer_selected", "human", attestor, line_id=line_id, offer_hash=offer_hash, selection_id=sel["selection_id"],
                     declined=sel["declined"], predecessor=sel["predecessor"], status_at_selection=sel["status_at_selection"])
        self._maybe_confirm(rnd)
        return sel

    def _maybe_confirm(self, rnd: dict) -> None:
        if rnd["status"] not in ("costed",):
            return
        for line in rnd["lines"]:
            if line["selection"]:
                continue
            if any(e["reason"] == "no_offer_match" and e["state"] == "resolved" for e in line["escalations"]):
                continue
            return
        transition(rnd, "selection_confirmed")
        self._append(rnd, "selection_confirmed", lines=len(rnd["lines"]))
        self._maybe_gate(rnd)

    def adjudicate(self, round_id: str, offer_hash: str, party_id: str, *, role: str, disposition: str, reason_code: str,
                   rationale: str, attestor: str) -> dict:
        rnd = self._round(round_id)
        line, card = self._card(rnd, offer_hash)
        node = next((n for n in card["party_tree"]["nodes"] if n["party_id"] == party_id), None)
        if node is None:
            raise selectmod.AdjudicationRefused(f"unknown party {party_id} on offer {offer_hash[:8]}")
        adj = selectmod.build_adjudication(round_id, offer_hash, node, role=role, disposition=disposition, reason_code=reason_code,
                                           rationale=rationale, attestor=attestor, seq=self.thread.head["seq"] + 1)
        self.adjudications[f"{round_id}|{offer_hash}|{party_id}"] = adj
        node["adjudication"] = adj
        node["effective_status"] = screenmod.node_status(node, node["run"], adj)
        card["screening"].update(screenmod.rollup(card["party_tree"]["nodes"]))
        self._append(rnd, "match_adjudicated", "human", attestor, offer_hash=offer_hash, party_id=party_id, party=node["name"], role=role,
                     disposition=disposition, reason_code=reason_code, rationale=rationale, list_snapshot_sha=adj["list_snapshot_sha"],
                     adjudication_id=adj["adjudication_id"], rollup_after=card["screening"]["status"])
        return adj

    # ------------------------------------------------------------ gate / declare / package
    def gate(self, round_id: str, references: dict[str, dict] | None = None) -> dict:
        rnd = self._round(round_id)
        if rnd["destination_country"] == "US":
            return {"applies": False, "words": "export gate: not applicable — ship-to is inside the United States"}
        references = references or {}
        blocked = []
        for line in rnd["lines"]:
            result = gatemod.evaluate_gate(line, rnd["destination_country"], references.get(line["line_id"]))
            line["gate"] = result
            self._append(rnd, "export_gate_evaluated", line_id=line["line_id"], state=result["state"], passes=result["passes"],
                         reference=result["reference"], because=result["because"])
            if not result["passes"]:
                blocked.append(f"{line['line_id']}: {result['state']}")
        if blocked:
            self._append(rnd, "package_blocked", reason="export_gate", lines=blocked)
        self._maybe_gate(rnd)
        return {"applies": True, "blocked": blocked, "passes": not blocked}

    def _maybe_gate(self, rnd: dict) -> None:
        if rnd["status"] == "selection_confirmed" and rnd["destination_country"] != "US":
            if all(l["gate"] and l["gate"]["passes"] for l in rnd["lines"]):
                transition(rnd, "gated")

    def declare(self, round_id: str, *, party: str, person_status: str, sharing: str, reference: str | None, attestor: str) -> dict:
        rnd = self._round(round_id)
        decl = gatemod.build_declaration(rnd["lines"], party=party, person_status=person_status, sharing=sharing, reference=reference,
                                         attestor=attestor, seq=self.thread.head["seq"] + 1)
        rnd["declarations"].append(decl)
        self._append(rnd, "technical_data_declared", "human", attestor, party=party, person_status=person_status, sharing=sharing,
                     required_reference_kind=decl["required_reference_kind"], reference=reference, blocked=decl["blocked"])
        if decl["blocked"]:
            self._append(rnd, "package_blocked", reason="technical_data_declaration", party=party, required=decl["required_reference_kind"])
        return decl

    def build_package(self, round_id: str, *, built_at: str) -> dict:
        rnd = self._round(round_id)
        try:
            if rnd["status"] == "superseded":
                raise pkgmod.PackageRefused("SUPERSEDED", rnd["superseded_note"])
            need = "gated" if rnd["destination_country"] != "US" else "selection_confirmed"
            if rnd["status"] not in (need, "package_ready"):
                raise pkgmod.PackageRefused("ROUND_NOT_READY", f"round is {rnd['status']}, needs {need}")
            open_esc = [f"{e['line_id']}: {e['reason']}" for l in rnd["lines"] for e in l["escalations"] if e["state"] == "open" and e["reason"] in BLOCKING_ESCALATIONS]
            if open_esc:
                raise pkgmod.PackageRefused("ESCALATION_OPEN", "; ".join(open_esc))
            if rnd["destination_country"] != "US":
                if not rnd["declarations"]:
                    raise pkgmod.PackageRefused("DECLARATION_MISSING", "technical-data declaration required for a ship-to outside the US")
                if any(d["blocked"] for d in rnd["declarations"]):
                    raise pkgmod.PackageRefused("DECLARATION_BLOCKED", "a technical-data declaration is missing its reference")
            problems = pkgmod.verify_bindings(rnd, self.store, lambda card: self._estimate(rnd, self._card(rnd, card["offer_hash"])[0], card))
            if problems:
                raise pkgmod.PackageRefused("BINDING_MISMATCH", "; ".join(problems))
        except pkgmod.PackageRefused as exc:
            self._append(rnd, "package_blocked", reason=exc.code, detail=str(exc))
            raise
        adjudications = [a for a in self.adjudications.values() if a["round_id"] == round_id]
        artefacts = {"pre_entry_lines": pkgmod.pre_entry_lines(rnd), "diligence_record": pkgmod.diligence_record(rnd, adjudications),
                     "export_references": pkgmod.export_references(rnd)}
        shas = {k: sha256(v) for k, v in artefacts.items()}
        rnd["package"] = {"built_at": built_at, "artefacts": shas, "documents": artefacts, "first_run_checklist": list(pkgmod.FIRST_RUN_CHECKLIST),
                          "warnings": pkgmod.warnings(rnd), "disclaimer": pkgmod.DISCLAIMER_LOCKED, "claim_ceiling": pkgmod.DISCLAIMER_LINES,
                          "bindings": {"design_hash": rnd["design_hash"], "design_seq": rnd["design_seq"], "fixture_shas": rnd["fixture_shas"]}}
        transition(rnd, "package_ready")
        self._append(rnd, "package_built", **shas, built_at=built_at)
        return rnd["package"]

    # ------------------------------------------------------------ order send-off
    def create_packet(self, round_id: str, *, recipient_placeholder: str, approver: dict, created_at: str) -> dict:
        rnd = self._round(round_id)
        packet = ordermod.create_packet(rnd, recipient_placeholder=recipient_placeholder, approver=approver,
                                        current_design_hash=self.current_design_hash or "", created_at=created_at)
        self.packets[packet["packet_id"]] = packet
        receipt = self._append(rnd, "order_packet_created", packet_id=packet["packet_id"], attachments=packet["attachments"], approver=packet["approver"])
        packet["audit_evidence"].append(receipt["seq"])
        return packet

    def dispatch(self, packet_id: str, *, idempotency_key: str, attestor: str, dispatched_at: str) -> dict:
        packet = self.packets.get(packet_id)
        if packet is None:
            raise ordermod.OrderRefused("UNKNOWN_PACKET", packet_id)
        if idempotency_key in self.dispatches:
            return self.dispatches[idempotency_key]                   # exactly once: a retry returns the first receipt
        rnd = self._round(packet["approved_revision"]["round_id"])
        if rnd["status"] == "superseded" or rnd["design_hash"] != self.current_design_hash:
            raise ordermod.OrderRefused("STALE_REVISION", "packet's revision is no longer the log head's")
        receipt = ordermod.synthetic_dispatch(packet, idempotency_key, dispatched_at)
        packet.update(idempotency_key=idempotency_key, dispatch_timestamp=dispatched_at, provider_response_id=receipt["provider_response_id"],
                      acknowledgement_state=receipt["state"], exception_state=receipt["exception"])
        ev = self._append(rnd, "order_dispatched", "human", attestor, packet_id=packet_id, idempotency_key=idempotency_key, adapter=receipt["adapter"],
                          label=receipt["label"], provider_response_id=receipt["provider_response_id"])
        packet["audit_evidence"].append(ev["seq"])
        kind = "order_acknowledged" if receipt["state"] == "acknowledged" else "order_exception"
        ev2 = self._append(rnd, kind, packet_id=packet_id, provider_response_id=receipt["provider_response_id"], exception=receipt["exception"])
        packet["audit_evidence"].append(ev2["seq"])
        receipt["words"] = (f"order packet · revision {rnd['design_hash'][:8]} · qty {rnd['quantity']} · recipient: {packet['recipient']['placeholder']} · "
                            f"{receipt['label']} dispatch · {receipt['state']} · idempotency key {idempotency_key}")
        self.dispatches[idempotency_key] = receipt
        return receipt

    def close_order(self, packet_id: str, *, receiving: dict | None, inspection: dict | None, attestor: str, closed_at: str) -> dict:
        packet = self.packets[packet_id]
        rnd = self._round(packet["approved_revision"]["round_id"])
        packet.update(receiving_record=receiving, inspection_result=inspection, closeout_state="closed")
        ev = self._append(rnd, "order_closed", "human", attestor, packet_id=packet_id, receiving=receiving, inspection=inspection, closed_at=closed_at)
        packet["audit_evidence"].append(ev["seq"])
        return packet

    # ------------------------------------------------------------ re-derive / tamper
    def rederive(self) -> dict:
        intact, break_at = self.thread.verify_chain()
        report = {"events": len(self.thread.events), "chain_intact": intact, "break_at": break_at, "signing": self.thread.signing,
                  "estimates_recomputed": 0, "estimates_equal": 0, "screenings_recomputed": 0, "screenings_equal": 0}
        if not intact:
            kind = self.thread.events[break_at - 1]["kind"]
            report["line"] = f"BREAK at #{break_at} ({kind}) · {report['events']} events · chain verification stopped"
            return report
        csl = self.store.manifest["csl"]
        for e in self.thread.events:
            if e["kind"] == "cost_estimated":
                offer = self.store.offer(e["offer_hash"])
                if offer is None or e["tariff_sha"] != self.store.manifest["tariff"]["sha256"]:
                    report["estimates_recomputed"] += 1
                    continue
                again = costmod.estimate(offer, e["offer_hash"], e["quantity"], self.store.tariff, e["tariff_sha"], entry_date=e["entry_date"],
                                         transport_mode=e["transport_mode"], destination_country=e["destination_country"],
                                         destination_notes=DESTINATION_NOTES.get(e["destination_country"]))
                report["estimates_recomputed"] += 1
                report["estimates_equal"] += int(again["hash"] == e["result_hash"])
            elif e["kind"] == "screening_run":
                if e["snapshot_sha"] != csl["sha256"]:
                    report["screenings_recomputed"] += 1
                    continue
                run = screenmod.screen(e["party"], self.store.csl_index, csl["sha256"], csl["retrieved_at"])
                report["screenings_recomputed"] += 1
                report["screenings_equal"] += int(sha256(run) == e["run_hash"])
        report["line"] = (f"{report['events']} events · chain intact · {self.thread.signing} · "
                          f"{report['estimates_recomputed']} estimates recomputed, {report['estimates_equal']} hashes equal · "
                          f"{report['screenings_recomputed']} screenings recomputed, {report['screenings_equal']} equal")
        return report

    def tamper(self, seq: int, field: str, value) -> None:
        self.thread.tamper(seq, field, value)

    # ------------------------------------------------------------ read model
    def timeline(self, round_id: str | None = None, last: int = 8) -> list[dict]:
        rows = []
        for e in self.thread.events:
            if round_id and e.get("round_id") != round_id:
                continue
            rows.append({"seq": e["seq"], "kind": e["kind"], "lane": "order" if e["kind"].startswith("order_") else "sourcing",
                         "actor_kind": e["actor_kind"], "attestor": e.get("attestor"), "hash": e["hash"][:8], "words": self._event_words(e)})
        return rows[-last:]

    def _event_words(self, e: dict) -> str:
        k = e["kind"]
        if k == "offer_selected":
            rnd = self.rounds.get(e["round_id"])
            _, card = self._card(rnd, e["offer_hash"])
            chosen_price = card["offer"].get("unit_price_usd")
            parts = [f"selected {card['offer']['seller'].get('display', card['offer']['seller']['name'])}"]
            for d in e["declined"]:
                cheaper = d.get("unit_price_usd") is not None and chosen_price is not None and float(d["unit_price_usd"]) < float(chosen_price)
                parts.append(("cheaper offer declined" if cheaper else f"declined {d['seller']}") + " · " + d["reason_code"].replace("_", " "))
            return " · ".join(parts) + f" · attested by {e['attestor']}"
        if k == "round_opened":
            return f"round opened · ship-to {e['ship_to']} · qty {e['quantity']} · {e['transport_mode']} · bound to design {e['design_hash'][:8]} seq {e['design_seq']}"
        if k == "cost_estimated":
            return f"estimate · {e['line_id']} · {e['heading']} / {e['origin']} · hash {e['result_hash'][:8]}"
        if k == "screening_run":
            return f"screened {e['party']} · {e['match_kind']} · snapshot {e['snapshot_sha'][:8]}"
        if k == "match_adjudicated":
            return f"{e['role']} recorded {e['disposition']} on {e['party']} · {e['reason_code']} · bound to snapshot {e['list_snapshot_sha'][:8]}"
        if k == "export_gate_evaluated":
            return f"export gate · {e['line_id']} · {e['state']} · {'passes' if e['passes'] else 'blocked'}"
        if k == "package_blocked":
            return f"package blocked · {e.get('reason')} · {e.get('detail') or e.get('lines') or e.get('party')}"
        if k == "package_built":
            return f"package built · pre-entry lines {e['pre_entry_lines'][:8]} · diligence {e['diligence_record'][:8]} · export refs {e['export_references'][:8]}"
        if k == "order_dispatched":
            return f"order dispatched · {e['label']} · {e['provider_response_id']} · key {e['idempotency_key']}"
        return k.replace("_", " ")

    def round_view(self, round_id: str) -> dict:
        rnd = self._round(round_id)
        lines = [self._line_view(rnd, line) for line in rnd["lines"]]
        n_req = sum(1 for l in lines for c in l["offers"] if c["status"] == "review_required")
        n_blk = sum(1 for l in lines for c in l["offers"] if c["status"] == "review_blocked")
        resolved = sum(1 for l in lines if l["offers"])
        shas = " ".join(f"{k}@{v[:8]}" for k, v in rnd["fixture_shas"].items())
        headline = f"{resolved} lines resolved · screening review ({n_req} review required, {n_blk} blocked) · fixtures {shas}"
        if rnd["status"] == "superseded":
            headline = rnd["superseded_note"]
        return {
            "round_id": rnd["round_id"], "status": rnd["status"], "status_label": STATUS_LABEL[rnd["status"]],
            "status_rail": [STATUS_LABEL[s] for s in ("opened", "offers_resolved", "screened", "costed", "selection_confirmed", "gated", "package_ready")],
            "headline": headline, "design_hash": rnd["design_hash"], "design_seq": rnd["design_seq"],
            "ship_to": rnd["ship_to"], "ship_to_label": rnd["ship_to_label"], "destination_country": rnd["destination_country"],
            "quantity": rnd["quantity"], "transport_mode": rnd["transport_mode"], "assembly_country": rnd["assembly_country"],
            "defaults_note": rnd["defaults_note"], "entry_date": rnd.get("entry_date"),
            "supersedes": rnd["supersedes"], "superseded_by": rnd["superseded_by"], "superseded_note": rnd.get("superseded_note"),
            "fixtures": {k: dict(self.store.manifest[k]) for k in rnd["fixture_shas"]},
            "lines": lines, "refinements": rnd["refinements"], "declarations": rnd["declarations"], "package": rnd["package"],
            "timeline": self.timeline(round_id), "thread_head": self.thread.head, "signing": self.thread.signing,
            "affiliates_rule": self.store.tariff.get("affiliates_rule"),
            "first_run_checklist": list(pkgmod.FIRST_RUN_CHECKLIST) if rnd["package"] else None,
        }

    def _line_view(self, rnd: dict, line: dict) -> dict:
        cards = [self._card_view(rnd, line, c) for c in line["offers"]]
        cards.sort(key=lambda c: (screenmod.STATUS_SEVERITY[c["status"]], c["sort_landed"] is None, c["sort_landed"] or 0))
        ev = line["evaluation"]
        return {
            "line_id": line["line_id"], "node_id": line["node_id"], "slot": line["slot"], "mpn": line["mpn"],
            "manufacturer": line["manufacturer"], "description": line["description"], "origin": line["origin"],
            "quantity": line["quantity"], "jurisdiction": ev["jurisdiction"], "entries": ev["entries"], "flags": ev.get("flags", []),
            "destination_cell": ev["destinations"].get(rnd["destination_country"]),
            "offers": cards, "escalations": line["escalations"], "selection": line["selection"], "gate": line["gate"],
        }

    def _card_view(self, rnd: dict, line: dict, card: dict) -> dict:
        offer = card["offer"]
        scr = card.get("screening")
        tree = card.get("party_tree")
        est = card.get("estimate")
        status = scr["status"] if scr else "abstained"
        words: list[str] = []
        synthetic = bool(offer["seller"].get("synthetic"))
        if synthetic:
            words.append("SYNTHETIC seller")
        seller_disp = offer["seller"].get("display", offer["seller"]["name"])
        words.append(f"{seller_disp} / {offer['seller']['country']} · manufacturer {offer['manufacturer'].get('display', offer['manufacturer']['name'])} / origin {offer['manufacturer']['country_of_origin']} (declared)")
        if offer.get("unit_price_usd") is not None:
            words.append(f"unit price ${offer['unit_price_usd']} ({offer.get('price_basis')}) · stock {offer.get('stock')} · lead {offer.get('lead_time_days')} d · MOQ {offer.get('moq')}")
        else:
            words.append(f"price: {offer.get('price_basis')} · stock {offer.get('stock')} · lead {offer.get('lead_time_days')} d")
        eccn = offer.get("declared_eccn") or {}
        hts = offer.get("declared_hts") or {}
        words.append(f"declared ECCN {eccn.get('value') or '—'} ({eccn.get('state')}; {eccn.get('declared_by') or 'nobody'}, {eccn.get('date') or 'no date'}) · "
                     f"tariff code {hts.get('value') or '—'} ({hts.get('declared_by') or 'nobody'}, {hts.get('date') or 'no date'}) · declared, unverified")
        if tree:
            words.append(f"depth: {tree['depth_tier']} ({'; '.join(tree['tier_reasons'])})")
        screening_words = []
        if scr:
            worst = next((n for n in tree["nodes"] if n["name"] == scr["worst_node"]), None)
            adjudicated = [n for n in tree["nodes"] if n.get("adjudication")]
            unknown = [n["name"] for n in tree["nodes"] if n["ownership"] == "unknown"]
            if status == "review_blocked" and worst:
                lists = "; ".join(sorted({e["source_list"] + (" via alternate name" if e["matched_on"] == "alt_name" else "") for e in worst["run"]["entries"]}))
                owner = "" if worst["role"] != "owner" else f"owner {worst['name']}, {worst.get('percent')} % owner via {worst['relation_to_child']}, ownership row {'SYNTHETIC' if worst['synthetic'] else 'REAL'}"
                words.append(f"review blocked: {owner or worst['name']} matched on the Consolidated Screening List ({lists})")
                if worst.get("adjudication") and worst["adjudication"]["disposition"] == "escalate":
                    words.append(f"escalated by the empowered official ({worst['adjudication']['attestor']}): pinned review blocked")
                screening_words.append(f"match kind {worst['run']['match_kind']} · not fuzzy · list snapshot {scr['list_snapshot_sha'][:8]} retrieved {scr['retrieved_at']}")
            elif status == "review_required":
                if unknown:
                    words.append("review required: ownership unknown — no ownership row typed for " + ", ".join(unknown) + "; unknown is a review flag, not a match")
                for n in adjudicated:
                    a = n["adjudication"]
                    if a["role"] == "analyst" and a["disposition"] == "false_positive":
                        words.append(f"review required: match on {n['name']} marked false positive by analyst {a['attestor']} ({a['reason_code']}), pending counsel — empowered official to resolve")
                screening_words.append(f"no list hits as of {scr['retrieved_at']} (snapshot {scr['list_snapshot_sha'][:8]}) · not fuzzy")
            elif status == "abstained":
                words.append("abstained: a party name could not be searched")
                screening_words.append("not fuzzy")
            else:
                words.append(f"no candidate match: {len(tree['nodes'])} parties screened, no list hits as of {scr['retrieved_at']}")
                screening_words.append(f"no list hits as of {scr['retrieved_at']} (snapshot {scr['list_snapshot_sha'][:8]}) · not fuzzy")
            words.append("review required does not stop a selection; review blocked does")
        if est:
            for layer in est["ladder"]:
                if layer["layer"] == "Section 301" and layer.get("amount"):
                    words.append(f"{layer['label']}, {layer['rate']}, {layer['citation']}")
                if layer["layer"] == "Country action" and layer.get("amount"):
                    words.append(f"{layer['label']}: {layer['rate']} on ${est['entered_value']} = ${layer['amount']} (estimate)")
                if layer["layer"] == "Merchandise processing fee" and layer.get("amount"):
                    words.append(f"MPF ${layer['amount']} ({layer['note']})")
                if layer["layer"] == "Harbor maintenance fee" and layer.get("amount"):
                    words.append(f"HMF ${layer['amount']} (ocean)")
                if layer["layer"] == "Import layers":
                    words.append(layer["note"])
            if est.get("domestic"):
                words.append(f"domestic purchase ({offer['seller']['country']}): no entry; import layers not applicable")
            if est.get("per_unit_landed_usd"):
                words.append(f"landed ${est['landed_total_usd']} · per unit ${est['per_unit_landed_usd']} · estimate · {est['claim_ceiling']}")
            else:
                words.append(f"estimate: {est.get('note')}")
            if not est.get("verified"):
                words.append("rate not verified — greyed; sorts last")
        for flag in line["evaluation"].get("flags", []):
            words.append(f"amber · {(line['evaluation'].get('flag_text') or {}).get(flag, flag)}")
        if line.get("gate"):
            words.extend(line["gate"]["words"])
        words.append(OFFER_CLAIM_CEILING)
        landed = est.get("per_unit_landed_usd") if est else None
        return {
            "offer_id": offer["offer_id"], "offer_hash": card["offer_hash"], "fixture_sha": card["fixture_sha"],
            "seller": {"name": offer["seller"]["name"], "display": seller_disp, "country": offer["seller"]["country"],
                       "synthetic": synthetic, "authorized_distributor": offer["seller"].get("authorized_distributor")},
            "manufacturer": offer["manufacturer"], "ship_from": offer.get("ship_from"), "unit_price_usd": offer.get("unit_price_usd"),
            "declared_eccn": eccn, "declared_hts": hts, "source_url": offer.get("source_url"), "synthetic": synthetic,
            "status": status, "status_word": screenmod.STATUS_WORD[status],
            "party_tree": tree, "screening": {**scr, "words": " · ".join(screening_words)} if scr else None,
            "estimate": est, "sort_landed": (float(landed) if (landed is not None and est and est.get("verified")) else None),
            "words": words, "claim_ceiling": OFFER_CLAIM_CEILING,
        }
