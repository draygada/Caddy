"""Unit normalisation at load. THE_BUILD.md §3.2."""
NM_TO_M = 1852.0
_CONV = {
    ("nm", "m"): lambda v: v * NM_TO_M,
    ("km", "m"): lambda v: v * 1000.0,
    ("deg/sqrt(h)", "deg/sqrt(h)"): lambda v: v,
    ("deg/h", "deg/h"): lambda v: v,
    ("micro g", "ug"): lambda v: v,
    ("ug", "ug"): lambda v: v,
}
def normalise(value, unit, to=None):
    if value is None or unit is None or to is None or unit == to:
        return value
    fn = _CONV.get((unit, to))
    if fn is None:
        raise ValueError(f"no conversion {unit!r} -> {to!r}")
    return fn(value)
