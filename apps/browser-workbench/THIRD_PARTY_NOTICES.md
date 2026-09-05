# Third-party notices

This lane uses one runtime dependency and does not vendor third-party source into the
repository. The exact resolved package and integrity are recorded in `package-lock.json`.

| Package | Exact version | License | Purpose |
|---|---:|---|---|
| `three` | `0.180.0` | MIT | Derived mesh display, camera controls, and ray casting |

The production build copies the installed Three.js module, `OrbitControls` add-on, and its
license into the ignored `dist/vendor/three/` directory. No browser geometry output is treated
as canonical CAD truth.

Three.js 0.180.0 is distributed under the MIT License; its complete license text is copied from
the exact installed package into the build artifact.
