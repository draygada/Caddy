#!/usr/bin/env python3
"""Print candidate rule text by entry id from the committed eCFR XML.

Usage:  print_rule_text.py <entry-id> [xml ...]     e.g. 9A012 · 6A003.b.4.b · 120.11 · 740.20

Counting unit is the DEEPEST element containing the id, which is the eCFR's own
granularity: 9A012 in title-15 part-774 gives 26, matching THE_BUILD.md §5.
Each block prints the enclosing section heading, the element tag, and the text verbatim.
That printout — not any prose document — is what gets typed into rules.json."""
import sys, html, re, pathlib, xml.etree.ElementTree as ET

DATA = pathlib.Path(__file__).resolve().parent.parent / "ecfr"

def text_of(el):
    return " ".join(html.unescape("".join(el.itertext())).split())

def collect(path, needle):
    root = ET.parse(path).getroot()
    parent = {c: p for p in root.iter() for c in p}
    out = []
    for el in root.iter():
        t = text_of(el)
        if needle not in t:
            continue
        if any(needle in text_of(c) for c in el):      # not the deepest
            continue
        head, node = "", el
        while node is not None and not head:
            for c in list(node):
                if c.tag in ("HEAD", "HED", "SUBJECT") and text_of(c):
                    head = text_of(c); break
            node = parent.get(node)
        out.append((head, el.tag, t))
    return out

def scoped(path, base, suffix):
    """CCL/USML sub-paragraphs are written 'a.2.' INSIDE the parent entry, never as
    '9A012.a.2'. So: find the parent entry's blocks, then from that point forward take
    paragraphs whose text starts with the suffix, stopping at the next top-level entry."""
    root = ET.parse(path).getroot()
    els = [el for el in root.iter() if text_of(el)]
    start = next((i for i, el in enumerate(els)
                  if base in text_of(el) and len(text_of(el)) < 400), None)
    if start is None:
        return []
    out, pat = [], re.compile(r"^" + re.escape(suffix) + r"[.\s]")
    for el in els[start:start + 400]:
        t = text_of(el)
        if pat.match(t):
            out.append(("(sub-paragraph of %s)" % base, el.tag, t))
        # stop once a different top-level entry id appears
        if re.match(r"^\d[A-E]\d{3}\b", t) and base not in t:
            break
    seen, uniq = set(), []
    for h, tag, t in out:
        if t not in seen:
            seen.add(t); uniq.append((h, tag, t))
    return uniq

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    needle = sys.argv[1]
    files = [pathlib.Path(p) for p in sys.argv[2:]] or sorted(DATA.glob("*.xml"))
    total = 0
    for f in files:
        d = re.search(r"(\d{4}-\d{2}-\d{2})", f.name)
        hits = collect(f, needle)
        if not hits and re.search(r"^(.+?)\.([a-z0-9.]+)$", needle):
            m = re.match(r"^(.+?)\.([a-z0-9.]+)$", needle)
            hits = scoped(f, m.group(1), m.group(2))
        if not hits and re.match(r"^([IVX]+)\((.+)\)$", needle):
            m = re.match(r"^([IVX]+)\((.+)\)$", needle)
            hits = scoped(f, "Category " + m.group(1), "(" + m.group(2) + ")")
        if not hits:
            continue
        print(f"\n### {f.name}  (ecfr_date {d.group(1) if d else '?'})  — {len(hits)} block(s)")
        for head, tag, t in hits:
            total += 1
            print(f"\n[{head or '—'}]  <{tag}>\n{t}")
    print(f"\n=== {needle}: {total} block(s) across {len(files)} file(s) ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())
