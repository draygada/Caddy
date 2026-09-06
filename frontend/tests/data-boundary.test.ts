import { describe, expect, it } from 'vitest';
import appSource from '../src/App.tsx?raw';
import noticeSource from '../src/panels/DataBoundaryNotice.tsx?raw';
import vercelSource from '../vercel.json?raw';
import {
  assessDataBoundary,
  DATA_BOUNDARY_POLICY,
  type BlockedDataClass,
} from '../src/lib/data-boundary';

const vercel = JSON.parse(vercelSource) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites: Array<{ source: string; destination: string }>;
};

function headersFor(source: string) {
  return Object.fromEntries(
    (vercel.headers.find((entry) => entry.source === source)?.headers ?? [])
      .map(({ key, value }) => [key, value]),
  );
}

describe('hackathon data boundary', () => {
  it.each(['PUBLIC', 'SYNTHETIC'] as const)('permits an explicit %s declaration', (classification) => {
    expect(assessDataBoundary(classification)).toMatchObject({ allowed: true, classification });
  });

  it.each([
    'CUI',
    'ITAR_CONTROLLED_TECHNICAL_DATA',
    'EXPORT_CONTROLLED_CUSTOMER_DESIGN',
    'SECRET',
    'CREDENTIAL',
  ] satisfies BlockedDataClass[])('blocks %s with a clear reason', (classification) => {
    const decision = assessDataBoundary(classification);
    expect(decision).toMatchObject({ allowed: false, classification });
    expect(decision.reason).toMatch(/^Blocked:/);
  });

  it('fails closed for missing and unknown declarations without claiming stronger controls', () => {
    expect(assessDataBoundary('')).toMatchObject({ allowed: false, classification: null });
    expect(assessDataBoundary('INTERNAL')).toMatchObject({ allowed: false, classification: 'INTERNAL' });
    expect(DATA_BOUNDARY_POLICY).toMatchObject({
      authentication: 'NONE',
      govCloudAssurance: 'NONE',
      contentScanning: 'NONE',
    });
  });

  it('gates the application shell and keeps the limitation visible', () => {
    expect(appSource).toContain('<DataBoundaryNotice>');
    expect(appSource).toContain('<StrafeApplication />');
    expect(noticeSource).toContain('Hackathon data boundary: PUBLIC or SYNTHETIC only');
    expect(noticeSource).toContain('No authentication or GovCloud assurance.');
    expect(noticeSource).toContain('This selection gate does not scan content or claim regulated compliance.');
    expect(noticeSource).toContain("decision.allowed ? (");
  });

  it('sets browser security headers while retaining same-origin API access', () => {
    const documentHeaders = headersFor('/(.*)');
    expect(documentHeaders).toMatchObject({
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    expect(documentHeaders['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(documentHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headersFor('/api/(.*)')).toMatchObject({ 'Cache-Control': 'no-store' });
    expect(vercel.rewrites).toContainEqual({ source: '/now', destination: '/api/now' });
    expect(vercelSource).not.toMatch(/"destination"\s*:\s*"https?:\/\//i);
  });
});
