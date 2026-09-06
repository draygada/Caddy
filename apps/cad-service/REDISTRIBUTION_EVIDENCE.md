# Native redistribution evidence

This is an objective engineering record, not a legal determination.

## Exact result

- The pinned artifact remains byte-for-byte unmodified:
  cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl,
  67,439,751 bytes,
  SHA-256 8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b.
- The installed CPython 3.12 Linux closure contains 70 ELF files mapped to 22
  package or source components.
- licenses/native-runtime-manifest.v1.json records every ELF path, byte count,
  SHA-256, component, package artifact, mapping method, exact license evidence,
  and source-set ID.
- licenses/native-source-artifacts.v1.json records 22 corresponding-source or
  build-recipe sets. All recorded URLs, byte counts, and SHA-256 values were
  fetched and verified on 2026-09-05.
- The wheel's own CycloneDX file is preserved exactly at
  licenses/native/OCP-WHEEL-AUDITWHEEL-CDX-1.4.json. Its 19 generated component
  entries leave licenses undeclared, so it is evidence of bundled dependencies,
  not a sufficient notice bundle by itself.
- Exact Ubuntu binary-package copyright files, conda package license files and
  embedded recipe metadata, the OCP Apache text, the OCCT LGPL text and
  exception, and the pydantic-core wheel license are carried beside the wheel.

## Wheel-alone versus service-bundle boundary

The unmodified wheel alone is not factually notice/source complete. It does not
contain the complete third-party notice set or corresponding-source ledger.

The deployable service artifact can keep that wheel unmodified and include this
directory. On that boundary, the objective missing-artifact HOLD is closed only
when scripts/verify_redistribution_evidence.py passes against the installed
site-packages tree and the deployment packaging includes licenses/**.

## Reproducible checks

    python apps/cad-service/scripts/verify_redistribution_evidence.py \
      --site-packages /path/to/linux/site-packages

To re-fetch and hash every binary package, source artifact, and build-recipe
archive:

    python apps/cad-service/scripts/verify_redistribution_evidence.py \
      --fetch-all-artifacts \
      --cache-dir /tmp/caddydaddy-native-artifacts

The checker fails on a changed or missing notice, unknown component/source ID,
incomplete source coordinate, altered SBOM, native-file hash drift, or any extra
unmapped ELF file. It prints legal_determination: NOT_PERFORMED by design.

## Authority boundary

Technical deployment authority was granted by the user before Lane J2. This
Lane J2 instruction nevertheless prohibits push and deployment, so neither was
performed here.

Repository-owner acceptance of the license obligations remains a separate
human governance decision. It is not a missing source, notice, package identity,
runtime, or deployment-authority fact, and this evidence does not pretend to
supply legal approval.
