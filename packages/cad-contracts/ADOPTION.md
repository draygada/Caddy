# Contract and kernel adoption decision

- Decision: use direct `cadquery-ocp-novtk==7.9.3.1` / OCCT 7.9.3 execution.
- Reason: this exact runtime is already pinned and exercised by the repository core-kernel lane;
  adopting it avoids a second geometry authority and does not require copying third-party code.
- Service model: deterministic and stateless, with exact base/candidate revision binding.
- Interchange: STEP AP242, IGES 5.3, and STL only.
- Constraint boundary: validate authored geometry; do not claim general constraint solving.
- Assembly boundary: fixed/point/distance and prealigned-concentric placement only.
- Reversal condition: replace the adapter when an admitted geometry service exposes durable
  revision storage, persistent topological naming, a production sketch/mate solver, and verified
  native assembly/drawing/manufacturing exchange.
- Distribution: HOLD until the OCCT notice/source/relink obligations in the lane adoption record
  receive repository license-authority approval.
