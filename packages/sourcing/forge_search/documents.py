"""Document text: the characters the verifier binds and the model is shown.

pypdf is pinned (pure Python, BSD-3-Clause); determinism is manufactured by the pin and checked by
scripts/determinism_check.py on two machines. HTML goes through the stdlib parser; hidden nodes stay in the
text because a PDF's white text would too — the verifier binds bytes, not visibility.
"""
from __future__ import annotations

import hashlib
import io
import re
from html.parser import HTMLParser

import pypdf

EXTRACTOR = {
    "name": "pypdf",
    "version": pypdf.__version__,
    "mode": "PdfReader(...).pages[i].extract_text(); pages joined by \\f",
    "html": "stdlib html.parser; script/style dropped; hidden nodes kept; block tags start a new line",
}
_HIDDEN = re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d]*[1-9])", re.I)
BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "li", "tr", "br", "span", "title", "td", "th"}


def pdf_text(data: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(data))
    return "\f".join((page.extract_text() or "") for page in reader.pages)


class _Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden: list[str] = []
        self._skip = 0
        self._hidden_tags: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        a = dict(attrs)
        if "hidden" in a or _HIDDEN.search(a.get("style") or ""):
            self._hidden_tags.append(tag)
        if tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1
        if self._hidden_tags and self._hidden_tags[-1] == tag:
            self._hidden_tags.pop()

    def handle_data(self, data):
        if self._skip:
            return
        self.parts.append(data)
        if self._hidden_tags and data.strip():
            self.hidden.append(data.strip())


def _parse(data: bytes) -> _Text:
    p = _Text()
    p.feed(data.decode("utf-8", errors="replace"))
    p.close()
    return p


def _tidy(text: str) -> str:
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


def html_text(data: bytes) -> str:
    return _tidy("".join(_parse(data).parts))


def hidden_spans(data: bytes) -> list[str]:
    return _parse(data).hidden


def document_text(data: bytes, name: str | None = None) -> str:
    if data.startswith(b"%PDF-"):
        return pdf_text(data)
    if (name or "").lower().endswith((".html", ".htm")) or data.lstrip().startswith(b"<"):
        return html_text(data)
    return data.decode("utf-8")


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def numbered(text: str) -> str:
    out, pos = [], 0
    for line in text.split("\n"):
        end = pos + len(line)
        out.append(f"[{pos}:{end}] {line}")
        pos = end + 1
    return "\n".join(out)
