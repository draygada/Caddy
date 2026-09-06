import { describe, expect, it } from 'vitest';
import vercelSource from '../vercel.json?raw';

const vercel = JSON.parse(vercelSource) as {
  rewrites: Array<{ source: string; destination: string }>;
};

describe('Candidate 0.2 backend target', () => {
  it('keeps product-service selection in the server-side proxy environment', () => {
    expect(vercel.rewrites).toEqual([{ source: '/now', destination: '/api/now' }]);
    expect(vercel.rewrites).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/api/:path*' }),
    ]));
  });

  it('rejects every Candidate 0.1 backend destination', () => {
    const destinations = vercel.rewrites.map(({ destination }) => destination);

    expect(destinations).not.toEqual(expect.arrayContaining([expect.stringMatching(/candidate-0-1/i)]));
  });
});
