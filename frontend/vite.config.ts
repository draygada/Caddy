import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The backend (FastAPI, `backend/app/main.py`) is the seam. Until it exists the
// frontend runs against its local synthetic outcome; `/api` is proxied so
// wiring the service later is a one-line change in src/lib/service.ts.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
