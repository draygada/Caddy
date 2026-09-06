import { describe, expect, it } from 'vitest';
import vercelSource from '../vercel.json?raw';

const vercel = JSON.parse(vercelSource) as {
  rewrites: Array<{ source: string; destination: string }>;
};

describe('Candidate 0.2 backend target', () => {
  it('pins same-origin API traffic to the public Candidate 0.2 product service', () => {
    expect(vercel.rewrites).toContainEqual({
      source: '/api/:path*',
      destination: 'https://caddydaddy-product-service.vercel.app/api/:path*',
    });
  });

  it('rejects every Candidate 0.1 backend destination', () => {
    const destinations = vercel.rewrites.map(({ destination }) => destination);

    expect(destinations).not.toEqual(expect.arrayContaining([expect.stringMatching(/candidate-0-1/i)]));
  });
});
