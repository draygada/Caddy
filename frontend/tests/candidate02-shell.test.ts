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
    expect(vercel.rewrites).toEqual([{ source: '/now', destination: '/api/now' }]);
    expect(vercelSource).not.toMatch(/"destination"\s*:\s*"https?:\/\//i);
    expect(vercel.headers.flatMap((entry) => entry.headers)).toEqual(expect.arrayContaining([
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]));
    expect(appSource).not.toContain('CADDYDADDY_CAD_SERVICE_URL');
  });
});
