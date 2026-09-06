import { afterEach, describe, expect, it, vi } from 'vitest';
import complianceRoute from '../api/compliance-at-design-click';
import classificationRoute from '../api/classification';
import sourcingRoundsRoute from '../api/sourcing/rounds';
import sourcingAdjudicationsRoute from '../api/sourcing/adjudications';
import sourcingSelectionsRoute from '../api/sourcing/selections';
import sourcingPackagesRoute from '../api/sourcing/packages';
import sourcingDispatchesRoute from '../api/sourcing/dispatches';
import provenanceInspectRoute from '../api/provenance/inspect';
import provenanceVerifyRoute from '../api/provenance/verify';
import provenanceAcceptRoute from '../api/provenance/accept';
import cadRecomputeRoute from '../api/cad/recompute';
import cadImportRoute from '../api/cad/import';
import cadExportRoute from '../api/cad/export';
import cadNativeSealRoute from '../api/cad/outputs/native/seal';
import cadNativeLoadRoute from '../api/cad/outputs/native/load';
import cadOutputGenerateRoute from '../api/cad/outputs/generate';
import orderPackageValidateRoute from '../api/orders/packages/validate';
import orderDispatchRoute from '../api/orders/dispatches';
import orderReceiptReadRoute from '../api/orders/receipts/read';
import orderReceiptAcknowledgeRoute from '../api/orders/receipts/acknowledge';
import orderReceiptReconcileRoute from '../api/orders/receipts/reconcile';
import orderReceiptCloseRoute from '../api/orders/receipts/close';
import orderAuditVerifyRoute from '../api/orders/audit/verify';

type Capture = { body: unknown; headers: Record<string, string>; statusCode: number };

function responseCapture() {
  const capture: Capture = { body: null, headers: {}, statusCode: 0 };
  return {
    capture,
    response: {
      setHeader(name: string, value: string) { capture.headers[name] = value; },
      status(code: number) { capture.statusCode = code; return this; },
      json(value: unknown) { capture.body = value; },
    },
  };
}

const ROUTES = [
  ['/api/compliance-at-design-click', complianceRoute],
  ['/api/classification', classificationRoute],
  ['/api/sourcing/rounds', sourcingRoundsRoute],
  ['/api/sourcing/adjudications', sourcingAdjudicationsRoute],
  ['/api/sourcing/selections', sourcingSelectionsRoute],
  ['/api/sourcing/packages', sourcingPackagesRoute],
  ['/api/sourcing/dispatches', sourcingDispatchesRoute],
  ['/api/provenance/inspect', provenanceInspectRoute],
  ['/api/provenance/verify', provenanceVerifyRoute],
  ['/api/provenance/accept', provenanceAcceptRoute],
  ['/api/cad/recompute', cadRecomputeRoute],
  ['/api/cad/import', cadImportRoute],
  ['/api/cad/export', cadExportRoute],
  ['/api/cad/outputs/native/seal', cadNativeSealRoute],
  ['/api/cad/outputs/native/load', cadNativeLoadRoute],
  ['/api/cad/outputs/generate', cadOutputGenerateRoute],
  ['/api/orders/packages/validate', orderPackageValidateRoute],
  ['/api/orders/dispatches', orderDispatchRoute],
  ['/api/orders/receipts/read', orderReceiptReadRoute],
  ['/api/orders/receipts/acknowledge', orderReceiptAcknowledgeRoute],
  ['/api/orders/receipts/reconcile', orderReceiptReconcileRoute],
  ['/api/orders/receipts/close', orderReceiptCloseRoute],
  ['/api/orders/audit/verify', orderAuditVerifyRoute],
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Vite/Vercel product-service route filesystem', () => {
  it('materializes and forwards every frontend-consumed route from its clean public URL', async () => {
    vi.stubEnv('CADDYDADDY_PRODUCT_SERVICE_URL', 'https://product-preview-runtime-team.vercel.app');
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchImpl);

    for (const [path, handler] of ROUTES) {
      const { capture, response } = responseCapture();
      await handler({
        method: 'POST',
        url: path,
        query: {},
        headers: { 'content-type': 'application/json' },
        body: { synthetic: true },
      } as never, response as never);
      expect(capture.statusCode, path).toBe(200);
      expect(capture.body, path).toEqual({ status: 'ok' });
    }

    expect(fetchImpl).toHaveBeenCalledTimes(ROUTES.length);
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual(
      ROUTES.map(([path]) => [`https://product-preview-runtime-team.vercel.app${path}`, 'POST']),
    );
  });
});
