# Third-party dependency and notice review

Status: spike/evaluation reviewed; redistribution approval is **HOLD**.

No third-party source code or license text is copied into this package. Runtime and test
dependencies are fetched from the hashes in `uv.lock`.

## Exact geometry boundary

| Item | Exact identity | License evidence | Observation |
|---|---|---|---|
| `cadquery-ocp-novtk` | 7.9.3.1; CPython 3.12 macOS arm64 wheel SHA-256 `a070f99039e877e9558759570fd379365e2d28de3850b62e33c9c48e5ac1f0e3` | CadQuery/OCP tag `7.9.3.1`, commit `d69b064a3a604ebf245b1f3b14fb54c835a3a571`, Apache-2.0 license file SHA-256 `a13caea71627202ad33cc4cafafdd18e667e16716488f8d9c568127121fb89fd` | Installed module reports `7.9.3.1`. Wheel METADATA has no license field and installed wheel has no license file. |
| OCP wheel build system | tag `v7.9.3.1`, commit `648499040b66a769293edfa844ff170ff8046619` | Repository Apache-2.0 license SHA-256 `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` | Workflow identifies OCCT 7.9.3 and copies the OCP license during the build, but that license was not present in the installed wheel observation. |
| `cadquery-ocp-proxy` | 7.9.3.1; wheel SHA-256 `8259b53668784b682fe2e4a6c1fed8293886d52bf6c3b2ecc2aec986c49e92d7` | Source lives in the Apache-2.0 build-system repository above | Wheel METADATA declares no license. It contains only version/proxy packaging, but distribution still requires an approved notice conclusion. |
| Open CASCADE Technology | 7.9.3; tag `V7_9_3`, commit `a016080bf6738d6aeae020badee4e888ad1540a5` | LGPL 2.1 text SHA-256 `e237fa56668030e928551ddd60f05df5fe957f75eab874bbd017e085ed722e7c`; OCCT exception 1.0 SHA-256 `04580a884ea6cea294402649ff7b5cbb167d47462d1340a4ed33e550db10a81b` | Native libraries are bundled in the OCP wheel. A shipped product needs prominent notice, accessible license text/source, and an approved relink/replaceability mechanism. |

Pinned source links:

- <https://github.com/CadQuery/OCP/tree/d69b064a3a604ebf245b1f3b14fb54c835a3a571>
- <https://github.com/CadQuery/ocp-build-system/tree/648499040b66a769293edfa844ff170ff8046619>
- <https://github.com/Open-Cascade-SAS/OCCT/tree/a016080bf6738d6aeae020badee4e888ad1540a5>

## Remaining Python packages

The installed metadata reports:

| Package | Version | License metadata |
|---|---:|---|
| attrs | 26.1.0 | MIT |
| hatchling | 1.27.0 | MIT |
| iniconfig | 2.3.0 | MIT |
| jsonschema | 4.25.1 | MIT |
| jsonschema-specifications | 2025.9.1 | MIT |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pathspec | 1.1.1 | MPL-2.0 classifier |
| pluggy | 1.6.0 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| pytest | 8.4.2 | MIT |
| referencing | 0.37.0 | MIT |
| rfc8785 | 0.1.4 | Apache license classifier |
| rpds-py | 2026.6.3 | MIT |
| trove-classifiers | 2026.6.1.19 | Apache license classifier |
| typing_extensions | 4.16.0 | PSF-2.0 |

`hatchling`, `pytest`, and their exclusive transitives are development/build-only. Exact
URLs and hashes for every resolved artifact are in `uv.lock`.

## Distribution gate

Before distributing a binary/runtime bundle, independently verify the exact wheel
contents against the cited build source, preserve all required copyright/notice texts,
make the corresponding OCCT source and modifications available as required, establish
the user-visible notice and replace/relink path, and obtain the repository's license
authority approval. This packet is engineering evidence, not legal advice or approval.
