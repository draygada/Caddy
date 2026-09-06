"""The allowlisted fetcher (S3 §(a)): a static allowlist, a content-addressed cache under .cache/fetch, a committed
manifest of URL → sha256, and every request logged. Blocked hosts are logged BLOCKED and never requested, and a
`fixture://` url names ONE file inside fixtures_dir — it is never a path out of it (S-1: owned data only).
This is the only module in forge_search that imports urllib.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from forge_sourcing.hashing import sha256_bytes

ALLOWLIST = (
    "st.com", "invensense.tdk.com", "tdk.com", "d17t6iyxenbwp1.cloudfront.net",
    "u-blox.com", "content.u-blox.com",
    "flir.com", "teledyneflir.com", "groupgets.com", "groupgets-files.s3.amazonaws.com", "futureelectronics.com",
    "aerospace.honeywell.com", "honeywellaerospace.com", "prod-edam.honeywell.com",
    "bosch-sensortec.com", "microhardcorp.com", "modalai.com", "molicel.com", "amprius.com", "kdedirect.com",
    "lcsc.com", "datasheet.lcsc.com", "wmsc.lcsc.com", "digikey.com", "mouser.com",
)
BLOCKED_DEMO = ("pastebin.com", "federalregister.gov")
USER_AGENT = "StrafeForgeSourcing/0.1 (allowlisted fetcher)"
TIMEOUT = 20.0
FIXTURE = "fixture://"


def host_allowed(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    if not host or any(host == b or host.endswith("." + b) for b in BLOCKED_DEMO):
        return False
    return any(host == a or host.endswith("." + a) for a in ALLOWLIST)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class RedirectOffAllowlist(Exception):
    """A redirect to a host outside the allowlist: refused before the redirected request is made."""


class AllowlistRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not host_allowed(newurl):
            raise RedirectOffAllowlist(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


@dataclass(frozen=True)
class FetchResult:
    url: str
    status: str
    sha256: str | None
    bytes: int
    retrieved_at: str

    def ok(self) -> bool:
        return self.sha256 is not None


class Fetcher:
    def __init__(self, cache_dir: Path, manifest_path: Path, fixtures_dir: Path, *, offline: bool = True):
        self.cache_dir, self.manifest_path, self.fixtures_dir, self.offline = Path(cache_dir), Path(manifest_path), Path(fixtures_dir), offline
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.manifest: dict[str, dict] = json.loads(self.manifest_path.read_text(encoding="utf-8")) if self.manifest_path.is_file() else {}
        self.log: list[dict] = []

    def _record(self, result: FetchResult) -> FetchResult:
        self.log.append(asdict(result))
        return result

    def _fixture_path(self, url: str) -> Path | None:
        """The name after fixture:// is one file IN fixtures_dir; a separator, a `..`, a NUL or a symlink out of it is not a fixture."""
        name = url[len(FIXTURE):]
        if not name or "/" in name or "\\" in name or ".." in name or "\x00" in name:
            return None
        path = self.fixtures_dir / name
        return path if path.resolve().parent == self.fixtures_dir.resolve() else None

    def fetch(self, url: str, *, refresh: bool = False) -> FetchResult:
        if url.startswith(FIXTURE):
            path = self._fixture_path(url)
            if path is None:
                return self._record(FetchResult(url, "BLOCKED", None, 0, _now()))
            if not path.is_file():
                return self._record(FetchResult(url, "ERROR missing fixture", None, 0, _now()))
            data = path.read_bytes()
            return self._record(FetchResult(url, "FIXTURE", sha256_bytes(data), len(data), self.manifest.get(url, {}).get("retrieved_at", "2026-09-05T23:30:00Z")))
        if not host_allowed(url):
            return self._record(FetchResult(url, "BLOCKED", None, 0, _now()))
        entry = self.manifest.get(url)
        if entry and not refresh and (self.cache_dir / f"{entry['sha256']}.bin").is_file():
            return self._record(FetchResult(url, "CACHED", entry["sha256"], entry["bytes"], entry["retrieved_at"]))
        if self.offline:
            return self._record(FetchResult(url, "OFFLINE", None, 0, _now()))
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.build_opener(AllowlistRedirectHandler).open(req, timeout=TIMEOUT) as resp:
                if not host_allowed(resp.geturl()):
                    return self._record(FetchResult(url, "BLOCKED", None, 0, _now()))      # belt and braces: the handler already refused it
                data, status = resp.read(), str(resp.status)
        except RedirectOffAllowlist:
            return self._record(FetchResult(url, "BLOCKED", None, 0, _now()))              # redirected off the allowlist: never requested
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            return self._record(FetchResult(url, f"ERROR {type(error).__name__}", None, 0, _now()))
        digest = sha256_bytes(data)
        (self.cache_dir / f"{digest}.bin").write_bytes(data)
        self.manifest[url] = {"sha256": digest, "bytes": len(data), "retrieved_at": _now(), "status": status}
        self.manifest_path.write_text(json.dumps(self.manifest, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        return self._record(FetchResult(url, status, digest, len(data), self.manifest[url]["retrieved_at"]))

    def read(self, result: FetchResult) -> bytes:
        if result.url.startswith(FIXTURE):
            path = self._fixture_path(result.url)
            if path is None:
                raise ValueError(f"not a fixture in {self.fixtures_dir}: {result.url}")
            return path.read_bytes()
        return (self.cache_dir / f"{result.sha256}.bin").read_bytes()
