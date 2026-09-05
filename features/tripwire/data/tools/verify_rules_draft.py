#!/usr/bin/env python3
"""Adversarial check of rules/rules.DRAFT.json against the fetched eCFR XML.

Nothing here trusts the drafter. Every `text` must be a real substring of the corpus, every
operator must match the wording of its own sentence, and the schema must be complete.
Exit 0 = clean. Exit 1 = do not hand this to Charlie yet.
"""
import json, re, html, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ALLOWED_ATOM_KEYS = ({"attr","op","threshold","unit"}, {"declared","equals"},
                     {"any_descendant"}, {"ancestor"}, {"part_class_in"})
REQUIRED = ["id","jurisdiction","entry","text","url","ecfr_date"]
OPMAP = [("less (better) than or equal to","<="), ("equal to or greater than",">="),
         ("equal to or less than","<="), ("in excess of",">"), ("greater than",">"),
         ("exceeding",">"), ("less (better) than","<"), ("less than","<"), ("above",">")]

def norm(s):
    s = html.unescape(s).replace(" "," ").replace(" "," ")
    s = s.replace("–","-").replace("—","-")
    return re.sub(r"\s+","", s)

def main():
    p = ROOT/"rules"/"rules.DRAFT.json"
    if not p.exists():
        print("rules/rules.DRAFT.json not found"); return 1
    corpus = norm(" ".join(
        re.sub(r"<[^>]+>"," ", f.read_text(encoding="utf-8", errors="ignore"))
        for f in sorted((ROOT/"ecfr").glob("*.xml"))))
    data = json.loads(p.read_text())
    rows = data if isinstance(data, list) else (data.get("rules") or data.get("rows") or [])
    fail, warn = [], []
    for r in rows:
        rid = r.get("id","<no id>")
        non_ecfr = (r.get("entry") == "NO_EXPORT_CONTROL_CHANGE"
                    or r.get("jurisdiction") not in ("ITAR", "EAR"))
        for k in REQUIRED:
            if k == "text" and non_ecfr:
                if not r.get("url"):
                    fail.append(f"{rid}: non-eCFR row must still carry a `url`")
                continue
            if r.get(k) in (None,""): fail.append(f"{rid}: missing required field `{k}`")
        t = r.get("text")
        if t and norm(t) not in corpus:
            fail.append(f"{rid}: `text` is NOT a verbatim substring of the XML -> {t[:90]!r}")
        if r.get("ecfr_date") != "2026-09-01":
            fail.append(f"{rid}: ecfr_date is {r.get('ecfr_date')!r}, expected '2026-09-01'")
        if r.get("rule_effective") and "9A012" not in str(r.get("entry","")):
            warn.append(f"{rid}: rule_effective set on a non-9A012 entry ({r.get('entry')})")
        # operator vs the wording of this row's own text
        def atoms(node):
            if isinstance(node, dict):
                if set(node) & {"attr","op"}: yield node
                for v in node.values(): yield from atoms(v)
            elif isinstance(node, list):
                for v in node: yield from atoms(v)
        # Localised operator check: find THIS atom's threshold in the text, then read the
        # operator phrase immediately before it. A row with several atoms legitimately carries
        # several different operators, so a whole-text match would be meaningless.
        for a in atoms(r.get("when")):
            op, thr = a.get("op"), a.get("threshold")
            if not op or thr is None or not t: continue
            low = t.lower().replace(",", "")
            # Match the threshold as a whole number token. Without the boundary, rstrip("0")
            # turns 500 into "5" and matches the 5 inside "0.0035" -> a phantom failure.
            cands = [str(thr)]
            if isinstance(thr, float) and thr == int(thr): cands.append(str(int(thr)))
            if isinstance(thr, float): cands.append(repr(thr).rstrip("0").rstrip("."))
            pos = -1
            for c in cands:
                m = re.search(r"(?<![\d.])" + re.escape(c) + r"(?![\d])", low)
                if m: pos = m.start(); break
            if pos < 0:
                warn.append(f"{rid}: threshold {thr} for {a.get('attr')} not located in text; "
                            f"operator unchecked")
                continue
            window = low[max(0, pos-75):pos]
            hit = next((o for phrase,o in OPMAP if phrase in window), None)
            if hit is None:
                warn.append(f"{rid}: no operator phrase near {thr} for {a.get('attr')}")
            elif op != hit:
                phrase = [ph for ph,o in OPMAP if ph in window][0]
                fail.append(f"{rid}: atom {a.get('attr')} op={op!r} but the sentence before "
                            f"{thr} says {phrase!r} -> expected {hit!r}")
        for a in atoms(r.get("when")):
            if not any(set(a) <= s or set(a) == s for s in ALLOWED_ATOM_KEYS):
                if not (set(a) <= {"attr","op","threshold","unit"}):
                    warn.append(f"{rid}: unrecognised atom shape {sorted(a)}")
    print(f"rows: {len(rows)}")
    print(f"FAIL: {len(fail)}")
    for f in fail: print("  ✗", f)
    print(f"WARN: {len(warn)}")
    for w in warn[:15]: print("  !", w)
    if not fail: print("\nVERDICT: verbatim + operator + schema checks PASS")
    else: print("\nVERDICT: FAIL — do not hand to Charlie until these are fixed")
    return 1 if fail else 0

if __name__ == "__main__":
    sys.exit(main())
