import type {
  CadDependencyGraph,
  CadDocument,
  CadExportRequest,
  CadExportResponse,
  CadImportRequest,
  CadKernelReceipt,
  CadMesh,
  CadRecomputeRequest,
  CadRecomputeResponse,
  CadTransferFormat,
} from './types';

export class CadApiError extends Error {
  code: 'CAD_API_UNAVAILABLE' | 'CAD_API_REJECTED' | 'CAD_RESPONSE_INVALID' | 'CAD_STALE';
  status: number | null;

  constructor(code: CadApiError['code'], message: string, status: number | null = null) {
    super(message);
    this.name = 'CadApiError';
    this.code = code;
    this.status = status;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseDocument(value: unknown): CadDocument {
  if (!object(value) || value.schemaVersion !== 'caddydaddy.cad-document/1' || !text(value.id) || !text(value.name) || !text(value.revisionId)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD service returned an invalid document identity. The last valid revision remains displayed.');
  }
  if (!Array.isArray(value.parameters) || !Array.isArray(value.sketches) || !Array.isArray(value.operations) || !Array.isArray(value.bodies) || !object(value.assembly)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD service returned an incomplete authoring document. The last valid revision remains displayed.');
  }
  return value as unknown as CadDocument;
}

export function parseCadRecomputeResponse(value: unknown): CadRecomputeResponse {
  if (!object(value) || !text(value.revisionId) || !text(value.documentHash)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD recompute response is missing revision identity or document hash.');
  }
  const document = parseDocument(value.document);
  if (document.revisionId !== value.revisionId) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD recompute returned a mismatched document revision chain.');
  }
  if (!object(value.dependencyGraph) || !Array.isArray(value.dependencyGraph.nodes) || !Array.isArray(value.dependencyGraph.edges)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD recompute returned no valid dependency graph.');
  }
  if (!object(value.mesh) || value.mesh.revisionId !== value.revisionId || !Array.isArray(value.mesh.vertices) || !Array.isArray(value.mesh.triangles) || !Array.isArray(value.mesh.groups)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD recompute returned no revision-bound mesh.');
  }
  if (!Array.isArray(value.diagnostics) || !object(value.kernel) || !text(value.kernel.name) || !text(value.kernel.artifactHash)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD recompute returned incomplete diagnostics or kernel provenance.');
  }
  return {
    document,
    revisionId: value.revisionId,
    documentHash: value.documentHash,
    dependencyGraph: value.dependencyGraph as unknown as CadDependencyGraph,
    mesh: value.mesh as unknown as CadMesh,
    diagnostics: value.diagnostics as CadRecomputeResponse['diagnostics'],
    kernel: value.kernel as unknown as CadKernelReceipt,
  };
}

async function postJson(path: string, payload: unknown, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new CadApiError('CAD_API_UNAVAILABLE', `CAD service is unavailable: ${error instanceof Error ? error.message : 'network request failed'}. Your draft and last valid revision are preserved.`);
  }
  if (response.status === 409 || response.status === 412) {
    throw new CadApiError('CAD_STALE', 'The document changed before this operation could run. Reload or restore the last valid revision before retrying.', response.status);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new CadApiError('CAD_API_REJECTED', `CAD service rejected the request (${response.status})${detail ? `: ${detail.slice(0, 240)}` : '.'}`, response.status);
  }
  try {
    return await response.json() as unknown;
  } catch {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD service returned a non-JSON response. The last valid revision remains displayed.', response.status);
  }
}

export async function recomputeCad(request: CadRecomputeRequest, fetchImpl: typeof fetch = fetch): Promise<CadRecomputeResponse> {
  return parseCadRecomputeResponse(await postJson('/api/cad/recompute', request, fetchImpl));
}

export async function importCad(request: CadImportRequest, fetchImpl: typeof fetch = fetch): Promise<CadRecomputeResponse> {
  return parseCadRecomputeResponse(await postJson('/api/cad/import', request, fetchImpl));
}

const FORMATS = new Set<CadTransferFormat>(['STEP', 'IGES', 'STL']);

export function parseCadExportResponse(value: unknown): CadExportResponse {
  if (!object(value) || !text(value.fileName) || !text(value.mimeType) || !text(value.dataBase64) || !text(value.revisionId) || !text(value.documentHash) || !FORMATS.has(value.format as CadTransferFormat)) {
    throw new CadApiError('CAD_RESPONSE_INVALID', 'CAD export response is incomplete; no download was created.');
  }
  return value as unknown as CadExportResponse;
}

export async function exportCad(request: CadExportRequest, fetchImpl: typeof fetch = fetch): Promise<CadExportResponse> {
  return parseCadExportResponse(await postJson('/api/cad/export', request, fetchImpl));
}
