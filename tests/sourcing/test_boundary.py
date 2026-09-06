"""The change path is model-free and network-free.

forge_sourcing: no module imports a model client or a socket, and none imports forge_search or the API.
forge_search: only fetch.py may import urllib, only model.py may import anthropic, only documents.py may import pypdf.
"""
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "packages" / "sourcing"
FORBIDDEN = {"anthropic", "openai", "requests", "httpx", "urllib", "socket", "http", "aiohttp", "sqlite3"}
SEARCH_ALLOWED = {"fetch.py": {"urllib"}, "model.py": {"anthropic"}, "documents.py": {"pypdf"}}


def _imports(path: Path) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module.split(".")[0])
    return names


def test_no_model_or_network_import_in_the_sourcing_lane():
    for path in (ROOT / "forge_sourcing").glob("*.py"):
        bad = FORBIDDEN & _imports(path)
        assert not bad, f"{path.name} imports {bad}"


def test_sourcing_never_imports_search_or_api():
    for path in (ROOT / "forge_sourcing").glob("*.py"):
        bad = {"forge_search", "forge_sourcing_api"} & _imports(path)
        assert not bad, f"{path.name} imports {bad}"


def test_search_package_boundary():
    pkg = ROOT / "forge_search"
    assert pkg.is_dir(), "forge_search package missing"
    for path in pkg.glob("*.py"):
        bad = ((FORBIDDEN | {"pypdf"}) & _imports(path)) - SEARCH_ALLOWED.get(path.name, set())
        assert not bad, f"forge_search/{path.name} imports {bad}"


def test_api_package_exists():
    assert (ROOT / "forge_sourcing_api").is_dir()


def test_agents_cannot_write_terminal_events():
    import pytest
    from forge_sourcing.thread import Thread, ThreadRefused
    t = Thread()
    with pytest.raises(ThreadRefused):
        t.append("offer_selected", "agent", {"x": 1})
    with pytest.raises(ThreadRefused):
        t.append("offer_selected", "human", {"x": 1})              # no attestor
    with pytest.raises(ThreadRefused):
        t.append("part_swapped", "agent", {"x": 1})
    t.append("alternative_proposed", "agent", {"x": 1})
    t.append("offer_selected", "human", {"x": 1}, attestor="benji")
    assert t.verify_chain() == (True, None)
