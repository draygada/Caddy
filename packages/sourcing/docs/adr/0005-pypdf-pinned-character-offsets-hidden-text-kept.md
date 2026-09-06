# ADR-0005: pypdf pinned; character offsets into the extracted text; hidden text kept

- Status: accepted (lane-local), 2026-09-06
- Source: research evidence S3 §(a), §(c), §(e) and its verifier pass; THE BUILD §3.5 Call A and §7; AGENTS.md dependency rule

## Context

No PDF library documents a cross-version byte-offset determinism guarantee (S3, confirmed). PyMuPDF is AGPL-3.0 with a compiled wheel per platform; AGENTS.md requires an exact-version licence review for every dependency. The model cannot address bytes of a PDF image; it can address characters of a text it was shown.

## Decision

1. **`pypdf==6.17.0`** (pure Python, BSD-3-Clause), plain `extract_text()` per page joined by form feeds; HTML through the stdlib parser. Determinism is manufactured: the pin, a same-machine twice test, and `scripts/determinism_check.py` diffed across two machines before any pin bump.
2. **The model is shown the extracted text with per-line character offsets, not the PDF.** `doc_sha256` is the sha256 of that exact text; `start`/`end` are character offsets into it; the verifier checks `text[start:end] == quote`, parses the number and unit with a fixed regex, and compares both. PDF-vision input is deferred.
3. **Hidden text stays in the document text**, because a PDF's white text would too. The hidden line is printed on the card. The demo fixture's hidden instruction carries no parseable number, so obeying it ends in `unparseable`, half-obeying in `number_mismatch`, and the truth at 7A002.a.1.a.

## Consequences

- The verifier proves the document was read correctly; it does not prove the datasheet is current, nor that a quoted sentence is a specification rather than an instruction. Both limits are printed on every accepted number.
- A hidden instruction that itself contains a parseable spec sentence could be quoted and accepted; that is the S3 §(c) limit, stated, not hidden.
- Vendor bytes are never committed; hashes, spans and the fixture documents are.
