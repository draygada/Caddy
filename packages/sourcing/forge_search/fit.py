"""The fit check under 22 CFR 120.41(b)(3) / 15 CFR 772.1: function, performance, form (incl. material), fit.
Each dimension resolves, fails, or stays unresolved; unresolved is never a pass (S4 §(e))."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

DIMENSIONS = ("function", "performance", "form", "fit")


def _check(expected, have) -> tuple[bool | None, str]:
    if isinstance(expected, dict):
        try:
            v = Decimal(str(have))
        except InvalidOperation:
            return None, f"{have!r} is not a number"
        lo, hi = expected.get("min"), expected.get("max")
        ok = (lo is None or v >= Decimal(lo)) and (hi is None or v <= Decimal(hi))
        return ok, f"{have} {'within' if ok else 'outside'} [{lo}, {hi}]"
    ok = str(expected).lower() in str(have).lower()
    return ok, f"{have!r} {'matches' if ok else 'does not match'} {expected!r}"


def fit_check(comparator: dict, candidate_fields: dict) -> dict:
    dims: dict[str, dict] = {}
    for dim in DIMENSIONS:
        state, detail = "resolved", []
        for field, expected in (comparator.get(dim) or {}).items():
            have = candidate_fields.get(field)
            if have is None:
                detail.append(f"{field}: not declared")
                state = state if state == "fail" else "unresolved"
                continue
            ok, why = _check(expected, have)
            detail.append(f"{field}: {why}")
            if ok is None:
                state = state if state == "fail" else "unresolved"
            elif not ok:
                state = "fail"
        dims[dim] = {"state": state, "detail": detail}
    return {"dimensions": dims, "resolved": all(d["state"] == "resolved" for d in dims.values()), "failed": any(d["state"] == "fail" for d in dims.values())}
