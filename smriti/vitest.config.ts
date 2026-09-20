import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Only the handful of vars the real-Supabase integration tests need reach
// process.env here — everything else keeps reading from vi.mock'd modules,
// same as before. Vitest does not load .env.local on its own.
const env = loadEnv('', process.cwd(), ['NEXT_PUBLIC_SUPABASE_', 'SUPABASE_SERVICE_ROLE_KEY']);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // jsdom withholds localStorage for opaque origins; give it a real one.
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    // Only the vars that are actually set are passed through. Listing them
    // unconditionally handed the tests the literal string "undefined" for a
    // missing key, which reads as "configured" to any truthiness check — so
    // the integration tests tried to run without credentials and failed on
    // "Invalid supabaseUrl" instead of skipping.
    env: Object.fromEntries(
      (['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const)
        .filter((key) => env[key])
        .map((key) => [key, env[key]]),
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mirrors the webpack alias in next.config.js — confetti is out of
      // scope for patient screens per the app's accessibility spec.
      'canvas-confetti': path.resolve(__dirname, './src/lib/stubs/canvas-confetti.ts'),
    },
  },
});
