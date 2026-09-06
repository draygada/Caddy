import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `/api` is the product service (apps/product-service: /api/health, /api/candidate,
// /api/compliance-at-design-click). In production frontend/vercel.json rewrites it to
// the deployed Candidate 0.1 service; the dev proxy defaults to the same deployment so
// a local run matches production. Put VITE_API_TARGET=http://127.0.0.1:4173 in
// frontend/.env.local (gitignored) to point at a locally running `python -m product_service`.
const DEPLOYED = 'https://caddydaddy-candidate-0-1-ivicmmeny-strafe1.vercel.app';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const target = env.VITE_API_TARGET || DEPLOYED;
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { '/api': { target, changeOrigin: true, secure: target.startsWith('https') } },
    },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
