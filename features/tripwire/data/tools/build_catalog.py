#!/usr/bin/env python3
"""Build catalog.json for the 12 baseline + 9 swap parts named in THE_BUILD.md §2.1.

Two provenance channels, deliberately kept apart so a human can diff them:
  spec[]  — values transcribed from THE_BUILD.md §2.1 (vendor-declared ECCN, origin, source URL)
  lcsc[]  — live lookup from JLCSearch -> LCSC detail, for parts LCSC actually carries
Nothing here merges the two. If they disagree, that is a finding, not a bug to paper over.
"""
import json, sys, time, urllib.parse, urllib.request, pathlib

UA = {"User-Agent": "Mozilla/5.0"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "catalog" / "catalog.json"

# (slot, mpn, vendor, origin, declared_eccn, source_url, pinned_lcsc)
SPEC = [
 ("battery_bay","INR-21700-P45B","Molicel","TW",None,"https://www.molicel.com/inr-21700-p45b/",None),
 ("fc_mcu","STM32H743VIT6","ST","MY","3A991.a.2","https://estore.st.com/en/stm32h743vit6-cpn.html","C114409"),
 ("io_mcu","STM32F100C8T6B","ST",None,"EAR99","https://estore.st.com/en/stm32f100c8t6b-cpn.html",None),
 ("imu","ICM-42688-P","TDK","US","7A994","https://www.lcsc.com/product-detail/C1850418.html","C1850418"),
 ("baro","BMP388","Bosch","DE",None,None,None),
 ("mag","BMM150","Bosch","DE",None,None,None),
 ("gnss","NEO-M9N","u-blox","CH","7A994","https://content.u-blox.com/sites/default/files/NEO-M9N-00B_DataSheet_UBX-19014285.pdf",None),
 ("nose_thermal","500-0771-01","Teledyne FLIR","US","6A993","https://www1.futureelectronics.com/doc/FLIR%20SYSTEMS/Lepton%20Export%20fact%20sheet.pdf",None),
 ("datalink","OEM-M0048-4-1","Microhard","CA","5A992.c","https://www.modalai.com/products/oem-m0048-4-1",None),
 ("esc","KDE-UAS55HVL","KDE","US","EAR99",None,None),
 ("motor","MN5008","T-Motor","CN",None,None,None),
 ("prop","18x6.1 CF","T-Motor","CN",None,None,None),
 # --- swap palette ---
 ("swap_battery","INR-21700-P45B (1,300 Wh pack)","Molicel","TW",None,"https://www.molicel.com/inr-21700-p45b/",None),
 ("swap_thermal","Boson+ 640 (60 Hz)","Teledyne FLIR","US","6A003.b.4.b","https://groupgets.com/products/boson-plus",None),
 ("swap_imu","68905700-CA01","Honeywell",None,"7A003.d.1",None,None),
 ("swap_cell","SiCore 450 Wh/kg","Amprius","US",None,"https://ir.amprius.com/",None),
]

def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def jlc(mpn):
    try:
        d = get("https://jlcsearch.tscircuit.com/api/search?q=%s&limit=3" % urllib.parse.quote(mpn))
        return d.get("components") or []
    except Exception as e:
        return [{"_error": str(e)}]

def lcsc(code):
    try:
        d = get("https://wmsc.lcsc.com/ftps/wm/product/detail?productCode=%s" % code)
        r = d.get("result") or d
        return {k: r.get(k) for k in ("productCode","productModel","brandNameEn","eccn","pdfUrl","encapStandard")
                if r.get(k) is not None}
    except Exception as e:
        return {"_error": str(e)}

def main():
    parts = []
    for slot, mpn, vendor, origin, eccn, url, pinned in SPEC:
        rec = {"slot": slot,
               "spec": {"mpn": mpn, "vendor": vendor, "origin": origin,
                        "declared_eccn": eccn, "source_url": url,
                        "from": "THE_BUILD.md §2.1"},
               "lcsc": None, "jlcsearch_top": None}
        if pinned:
            rec["lcsc"] = lcsc(pinned); time.sleep(0.6)
        hits = jlc(mpn.split(" ")[0])
        if hits:
            h = hits[0]
            rec["jlcsearch_top"] = {k: h.get(k) for k in ("lcsc","mfr","package","description") if k in h}
            rec["search_matches_pin"] = (pinned is not None
                                         and str(h.get("lcsc")) == pinned.lstrip("C"))
        time.sleep(0.6)
        parts.append(rec)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generated": "2026-09-04",
                               "note": "spec[] is transcribed from THE_BUILD.md; lcsc[] is live. "
                                       "They are NOT merged. Disagreement = finding.",
                               "parts": parts}, indent=2))
    res = sum(1 for p in parts if p["lcsc"] and "_error" not in p["lcsc"])
    print("wrote %s — %d parts, %d resolved on LCSC" % (OUT, len(parts), res))

if __name__ == "__main__":
    sys.exit(main())
