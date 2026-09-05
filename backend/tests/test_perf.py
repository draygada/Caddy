"""Written on day one so the suite can never become slow enough to need test selection.
The spec puts a full evaluation at microseconds; 50 ms is generous by three orders."""
import time, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from engine import model, evaluate

def _tree(n=80):
    nodes = [{"id": "root", "kind": "product"}]
    nodes += [{"id": f"p{i}", "kind": "part", "parent": "root", "part_class": "ic"} for i in range(n)]
    return model.load({"root": "root", "nodes": nodes})

def test_evaluate_under_50ms():
    d = _tree()
    t = time.perf_counter()
    evaluate.evaluate(d, [], {"countries": {"CA": {}, "DE": {}, "TW": {}, "VN": {}, "CN": {}}})
    assert time.perf_counter() - t < 0.05
