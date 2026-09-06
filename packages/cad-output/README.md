# CAD output package

`caddydaddy-cad-output` is a deterministic downstream output boundary. It accepts an
identity-bound native document, a validated kernel triangle packet, and optional kernel-produced
STEP, IGES, or STL bytes. It emits:

- canonical `caddydaddy.native-document/1` JSON;
- top, front, and right wire projections as SVG and ASCII DXF;
- a deterministic assembly BOM CSV; and
- a sealed `caddydaddy.manufacturing-package/1` manifest with reread SHA-256 evidence.

The package does not execute geometry operations. It does not generate or claim CAM toolpaths,
G-code, tolerancing/GD&T, hidden-line drawings, manufacturability certification, native-format
compatibility with third-party CAD, or round-trip B-rep fidelity. STEP/IGES/STL bytes must come
from a kernel receipt bound to the exact document hash and revision.
