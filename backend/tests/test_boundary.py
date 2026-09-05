"""No language model is on the change path. THE_BUILD.md §3.5."""
import ast, pathlib
ENGINE = pathlib.Path(__file__).resolve().parents[1] / "engine"
FORBIDDEN = {"anthropic", "openai", "httpx", "requests", "urllib"}

def test_engine_imports_no_model_client():
    for f in ENGINE.glob("*.py"):
        tree = ast.parse(f.read_text())
        for n in ast.walk(tree):
            mods = []
            if isinstance(n, ast.Import): mods = [a.name.split(".")[0] for a in n.names]
            elif isinstance(n, ast.ImportFrom) and n.module: mods = [n.module.split(".")[0]]
            assert not (set(mods) & FORBIDDEN), f"{f.name} imports {mods}"
