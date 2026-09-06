import { describe, expect, it } from 'vitest';
import appSource from '../src/App.tsx?raw';
import vercelSource from '../vercel.json?raw';

const vercel = JSON.parse(vercelSource) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites: Array<{ source: string; destination: string }>;
};

describe('Candidate 0.2 shell integration', () => {

  it('does not mount Atlas, Now, or handoff product islands', () => {
    expect(appSource).not.toMatch(/TripwireAtlas|<Now\b|HandoffWorkspace/);
  });

  it('keeps browser contracts same-origin and API responses uncached', () => {
    expect(vercel.rewrites[0].source).toBe('/api/:path*');
    expect(vercel.headers).toEqual([{ source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] }]);
    expect(appSource).not.toContain('CADDYDADDY_CAD_SERVICE_URL');
  });
});
