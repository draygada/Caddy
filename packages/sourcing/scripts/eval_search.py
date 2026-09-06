"""The eval harness (brief §6 item 6; S5 §(e)): per-swap pass or fail over the gold set, verifier acceptance by
reason, structural zero false-green, abstain reasons, cost per green from recorded usage, cache misses.
It never prints an accuracy percentage: nine partly-synthetic rows have a noise floor far above any headroom.
Usage: eval_search.py [--mode cache|live] [--assert-cached]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))
from forge_search.evaluate import STATUS_ORDER  # noqa: E402
from forge_search.model import Abstain  # noqa: E402
from forge_search.propose import default_ports, propose_alternative, propose_escalation  # noqa: E402
from forge_sourcing.fixtures import design_state as _state  # noqa: E402

DATA = PKG / "data"
PRICE_MICROUSD_PER_TOKEN = {"claude-opus-5": (5, 25), "claude-sonnet-5": (2, 10), "claude-haiku-4-5": (1, 5)}   # $/MTok = µ$/token


def _cost(usage: dict | None) -> int | None:
    if not usage:
        return None
    inp, out = PRICE_MICROUSD_PER_TOKEN.get(usage.get("model", ""), (5, 25))
    return int(usage.get("input_tokens", 0)) * inp + int(usage.get("output_tokens", 0)) * out


def run_gold(gold: list[dict], make_service, ports_for, *, states: dict) -> dict:
    results, errors = [], []
    accepted = rejected = 0
    rejected_by_reason: dict[str, int] = {}
    abstains: dict[str, int] = {}
    cache_misses = false_green = 0
    for row in gold:
        try:
            service = make_service()
            ports = ports_for(row)
            r = service.open_round(_state(states, row["state"]), ship_to="US-bench", quantity=1, transport_mode="air", request_key=f"eval-{row['id']}", opened_at="2026-09-06T02:00:00Z")
            rid = r["round_id"]
            service.resolve(rid); service.screen(rid); service.cost(rid, entry_date="2026-09-06")
            if row.get("kind") == "escalation":
                p = propose_escalation(service, rid, row["line_id"], row["reason"], ports, proposed_at="2026-09-06T02:30:00Z")
            else:
                p = propose_alternative(service, rid, row["line_id"], ports, proposed_at="2026-09-06T02:30:00Z")
        except Exception as error:  # noqa: BLE001 - an attempt that produced no scorable output goes to errors.jsonl, never results
            errors.append({"id": row["id"], "error": f"{type(error).__name__}: {error}"})
            continue
        want = row["expect"]
        # One candidate can carry several documents, and the proposer emits one card per (mpn, url). A gold row names a
        # CANDIDATE, so the observation is the BEST card for that mpn — green when the proposal ranked it — never
        # whichever card the model happened to name first; the phrase check reads every card for that mpn.
        cards = [c for c in p["candidates"] if c["mpn"] == want["mpn"]] if want.get("mpn") else []
        cand = min(cards, key=lambda c: STATUS_ORDER[c["status"]]) if cards else None
        observed = "green" if cand and cand["mpn"] in p["ranked"] else cand["status"] if cand else p["status"]
        reasons = [s for c in cards for s in c["reasons"] + c["words"]] if cards else p["reasons"] + p["words"]
        reason_hit = (want.get("reason_contains") is None) or any(want["reason_contains"] in s for s in reasons)
        confident_ok = ("confident" not in want) or (p["confident"] == want["confident"])
        ok = observed == want["status"] and reason_hit and confident_ok and (p["abstained"] is None)
        usage_rows = [c.get("document", {}).get("extract", {}) for c in p["candidates"]]
        usage_rows = [u.get("usage") for u in usage_rows if u] + [p.get("usage")]
        cost = sum(c for c in (_cost(u) for u in usage_rows) if c is not None) if any(u for u in usage_rows) else None
        for c in p["candidates"]:
            ex = (c.get("document") or {}).get("extract") or {}
            accepted += ex.get("accepted", 0)
            for rj in ex.get("rejected", []):
                rejected += 1
                rejected_by_reason[rj["reason"]] = rejected_by_reason.get(rj["reason"], 0) + 1
            if c["status"] == "green" and not (c.get("specs") and c.get("flip", {}).get("gone")):
                false_green += 1
        if p["abstained"]:
            abstains[p["abstained"]] = abstains.get(p["abstained"], 0) + 1
            if p["abstained"] == "cache miss":
                cache_misses += 1
        results.append({"id": row["id"], "real": row["real"], "kind": row.get("kind", "alternative"), "expected": want["status"], "observed": observed, "pass": ok,
                        "reason_hit": reason_hit, "candidate": cand["mpn"] if cand else None, "abstained": p["abstained"], "cache_misses": int(p["abstained"] == "cache miss"),
                        "usage": [u for u in usage_rows if u], "cost_microusd": cost})
    greens = [r for r in results if r["observed"] == "green" and r["pass"]]
    costs = [r["cost_microusd"] for r in greens if r["cost_microusd"] is not None]
    measurements = {
        "per_swap": {r["id"]: {"pass": r["pass"], "real": r["real"], "expected": r["expected"], "observed": r["observed"]} for r in results},
        "verifier_acceptance": {"accepted": accepted, "rejected": rejected, "rejected_by_reason": rejected_by_reason},
        "false_green_structural": false_green,
        "abstain_reasons": abstains,
        "cost_per_green_microusd": (sum(costs) // len(costs)) if costs else None,
        "cache_misses": cache_misses,
        "note": "per-swap pass/fail on a partly synthetic gold set; no top-line rate is reported by design (S5 §(e))",
    }
    return {"results": results, "errors": errors, "measurements": measurements}


if __name__ == "__main__":
    from forge_sourcing.service import Service
    mode = sys.argv[sys.argv.index("--mode") + 1] if "--mode" in sys.argv else "cache"
    gold = json.loads((DATA / "search" / "gold_swaps.json").read_text(encoding="utf-8"))
    states = json.loads((DATA / "kestrel_round_input.json").read_text(encoding="utf-8"))["states"]
    out = run_gold(gold, lambda: Service(DATA), lambda row: default_ports(DATA, mode=mode, offline=(mode != "live")), states=states)
    outdir = PKG / ".cache" / "eval"
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in out["results"]), encoding="utf-8")
    (outdir / "errors.jsonl").write_text("".join(json.dumps(r) + "\n" for r in out["errors"]), encoding="utf-8")
    for r in out["results"]:
        print(f"{'PASS' if r['pass'] else 'FAIL'}  {r['id']:32s} {'REAL' if r['real'] else 'SYNTHETIC':9s} expected {r['expected']:5s} observed {r['observed']:5s}"
              + (f"  abstained: {r['abstained']}" if r["abstained"] else ""))
    print(json.dumps(out["measurements"], indent=1))
    if "--assert-cached" in sys.argv and out["measurements"]["cache_misses"]:
        print(f"{out['measurements']['cache_misses']} cache miss(es): record the cache before the demo (make record-cache)")
        sys.exit(1)
