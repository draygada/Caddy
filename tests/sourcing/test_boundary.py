"""The change path is model-free and network-free: no module in the lane imports a model client or a socket."""
from __future__ import annotations

import ast
from pathlib import Path

FORBIDDEN = {"anthropic", "openai", "requests", "httpx", "urllib", "socket", "http", "aiohttp", "sqlite3"}


def test_no_model_or_network_import_in_the_lane():
    pkg = Path(__file__).resolve().parents[2] / "packages" / "sourcing" / "forge_sourcing"
    for path in pkg.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name.split(".")[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module.split(".")[0]]
            bad = FORBIDDEN & set(names)
            assert not bad, f"{path.name} imports {bad}"


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
