# Native OCCT Vercel adapter

This directory is the source template for a deterministic, allowlist-only Vercel deployment root. Do not deploy the repository directory directly. Build a clean bundle from a committed tree:

```bash
BUNDLE_PARENT="$(mktemp -d)"
BUNDLE_ROOT="$BUNDLE_PARENT/caddydaddy-cad-vercel"
python3.12 apps/cad-service/scripts/build_vercel_bundle.py \
  --output "$BUNDLE_ROOT" \
  --require-clean
(cd "$BUNDLE_ROOT" && vercel deploy --yes)
```

The deployment uses Vercel's Python 3.12 ASGI runtime. It contains only the native service modules, exact runtime requirements, license/evidence closure, the ASGI entrypoint, and `BUNDLE_MANIFEST.json`. The manifest binds every source/output path to SHA-256 and records the source commit and aggregate payload hash without timestamps.

## Native service environment

All settings are non-secret. Defaults are production-bounded and can be reduced per deployment:

- `CAD_ALLOWED_HOSTS`: comma-separated explicit hostnames. Vercel's validated `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL` are also admitted when the project exposes system environment variables.
- `CAD_CORS_ORIGINS`: comma-separated exact HTTP(S) browser origins. Empty denies cross-origin browser access; the product-service connection is server-to-server and needs no CORS grant.
- `CAD_MAX_REQUEST_BYTES=4000000`
- `CAD_MAX_RESPONSE_BYTES=4000000`
- `CAD_TRANSPORT_TIMEOUT_SECONDS=40`
- `CAD_NATIVE_TIMEOUT_SECONDS=30`
- `CAD_MAX_CONCURRENCY=1`
- `CAD_NATIVE_CPU_SECONDS=25`
- `CAD_NATIVE_MAX_ADDRESS_SPACE_MIB=0`
- `CAD_NATIVE_MAX_OPEN_FILES=256`

The service has no user authentication or rate limiting. Host and CORS validation are not authentication. Use synthetic/public data only and keep this deployment behind the product-service facade.

## Product connection

The browser does not consume the native service directly:

1. Frontend `CADDYDADDY_PRODUCT_SERVICE_URL` points to the matching product-service origin.
2. Product-service `CADDYDADDY_CAD_SERVICE_URL` points to this native service origin, without a trailing path.
3. Product-service `GET /api/cad/capabilities` performs the runtime-truth probe. The frontend never probes the native origin directly.
4. Native-service `CAD_NATIVE_RUNTIME_OWNER_APPROVAL` remains unset until the repository owner records acceptance for the exact runtime packet and then supplies the manifest-bound value returned by the blocked readiness response.

After deploying the native service URL as `CAD_URL`, deploy or redeploy the product service with:

```bash
vercel deploy apps/product-service/vercel --yes \
  --env CADDYDADDY_CAD_SERVICE_URL="$CAD_URL"
```

Then deploy the frontend with the exact matching product-service and capability endpoints:

```bash
vercel deploy frontend --yes \
  --env CADDYDADDY_PRODUCT_SERVICE_URL="$PRODUCT_SERVICE_URL"
```

## Boundaries

- Vercel's Python runtime is beta.
- Each native operation starts a killable subprocess and uses `/tmp`; there is no durable CAD state.
- The service caps both request and response bodies at 4,000,000 bytes, below Vercel's 4.5 MB platform ceiling.
- The standard Python function limit is 500 MB uncompressed; measure the resolved Linux wheel closure before deployment.
- Cold starts and native imports can materially affect latency.
- STEP, IGES, and STL exchange are bounded by the transport ceiling and are not suitable for large assemblies.
- Artifact evidence: **PASS**.
- Legal determination: **NOT_PERFORMED**.
- The release closure must preserve `licenses/**`, `THIRD_PARTY_NOTICES.md`, and `REDISTRIBUTION_EVIDENCE.md`.
