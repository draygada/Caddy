# CAD authoring contracts v1

These generated JSON Schemas are the wire boundary for the stateless CAD service in
`apps/cad-service`. Regenerate them with:

```bash
uv run --project apps/cad-service python apps/cad-service/scripts/export_schemas.py
```

The schemas distinguish exact OCCT execution from unsupported product claims:

- recompute binds an edited candidate to the exact supplied base revision;
- constraint mode is `VALIDATE_ONLY` rather than a general sketch solver;
- STEP and IGES produce editable exact B-rep imports, while STL is mesh-only;
- unsupported native assembly, drawing, and manufacturing formats return diagnostics rather
  than surrogate output.

The service is a new candidate boundary. It does not modify or supersede the frozen
`forge.part-document/1` integration contract.
