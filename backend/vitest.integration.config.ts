import { defineConfig } from 'vitest/config';

// DB-backed integration suite. Requires a reachable Postgres via DATABASE_URL
// (whose name must contain "test" — see resetDb guard). Files run serially so
// per-test truncation in one spec cannot race another sharing the schema.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['src/test/setup.integration.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
